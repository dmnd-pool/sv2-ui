import * as aws from "@pulumi/aws";
import * as docker from "@pulumi/docker";
import * as pulumi from "@pulumi/pulumi";

const production_one_infra = new pulumi.StackReference(
  "dmnd-tech-org/dmnd-cloud/production"
);
const env = "prtwo";
const appName = "udfe";

const vpcId = production_one_infra
  .requireOutput("vpc")
  .apply(vpc => vpc["vpcId"]);

const publicSubnetIds = production_one_infra
  .requireOutput("vpc")
  .apply(vpc => vpc["publicSubnetIds"]);

const production_two_infra = new pulumi.StackReference(
  "dmnd-tech-org/dmnd-cloud/production_two"
);
const ecsClusterArn = production_two_infra
  .requireOutput("ecs")
  .apply(ecs => (ecs["ecsCluster"] as any)["arn"]);

// ECR repository
const repo = new aws.ecr.Repository(`${env}-${appName}-repo`);

export const userDashboardFrontendRepoUrl = repo.repositoryUrl;

// Build and push Docker image
const image = new docker.Image(`${env}-${appName}-image`, {
  imageName: pulumi.interpolate`${repo.repositoryUrl}:latest`,
  build: {
    context: "../../",
    dockerfile: "../../Dockerfile.prod",
    platform: "linux/amd64"
  },
  registry: repo.registryId.apply(async () => {
    const creds = await aws.ecr.getAuthorizationToken({});
    const [username, password] = Buffer.from(creds.authorizationToken, "base64")
      .toString()
      .split(":");
    return {
      server: repo.repositoryUrl,
      username,
      password
    };
  })
});

export const userDashboardFrontendImage = image.imageName;

// CloudWatch log group
const logGroup = new aws.cloudwatch.LogGroup(`${env}-${appName}-log-group`, {
  name: `/ecs/${env}-${appName}-log-group`,
  retentionInDays: 1
});

export const userDashboardFrontendLogGroupName = logGroup.name;

// ECS execution role
const taskExecutionRole = new aws.iam.Role(`${env}-${appName}-execution-role`, {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: "ecs-tasks.amazonaws.com"
  })
});
new aws.iam.RolePolicyAttachment(`${env}-${appName}-execution-role-policy`, {
  role: taskExecutionRole.name,
  policyArn:
    "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
});

// Task definition
const taskDef = new aws.ecs.TaskDefinition(`${env}-${appName}-task`, {
  family: `${env}-${appName}`,
  cpu: "256",
  memory: "512",
  networkMode: "awsvpc",
  requiresCompatibilities: ["FARGATE"],
  executionRoleArn: taskExecutionRole.arn,
  containerDefinitions: pulumi.all([image.repoDigest]).apply(([digest]) =>
    JSON.stringify([
      {
        name: appName,
        image: digest,
        essential: true,
        portMappings: [{ containerPort: 80 }],
        logConfiguration: {
          logDriver: "awslogs",
          options: {
            "awslogs-group": `/ecs/${env}-${appName}-log-group`,
            "awslogs-region": aws.config.region,
            "awslogs-stream-prefix": "internal-dashboard-frontend'"
          }
        }
      }
    ])
  )
});

// ALB security group
const albSg = new aws.ec2.SecurityGroup(`${env}-${appName}-alb-sg`, {
  vpcId,
  description: "Allow HTTPS in",
  ingress: [
    {
      protocol: "tcp",
      fromPort: 443,
      toPort: 443,
      cidrBlocks: ["0.0.0.0/0"]
    }
  ],
  egress: [
    { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }
  ]
});

// ECS security group
const ecsSg = new aws.ec2.SecurityGroup(`${env}-${appName}-ecs-sg`, {
  vpcId,
  description: "Allow ALB to reach ECS tasks",
  ingress: [
    {
      protocol: "tcp",
      fromPort: 80,
      toPort: 80,
      securityGroups: [albSg.id] // 👈 Allow only ALB
    }
  ],
  egress: [
    { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }
  ]
});

// ALB
const alb = new aws.lb.LoadBalancer(`${env}-${appName}-alb`, {
  internal: false,
  loadBalancerType: "application",
  securityGroups: [albSg.id],
  subnets: publicSubnetIds
});

const targetGroup = new aws.lb.TargetGroup(`${env}-${appName}-tg`, {
  port: 80,
  protocol: "HTTP",
  targetType: "ip",
  vpcId,
  healthCheck: {
    path: "/",
    protocol: "HTTP"
  }
});

const listener = new aws.lb.Listener(`${env}-${appName}-listener`, {
  loadBalancerArn: alb.arn,
  port: 80,
  protocol: "HTTP",
  defaultActions: [{ type: "forward", targetGroupArn: targetGroup.arn }]
});

export const userDashboardFrontendListener = listener.arn;

// ECS Service
const service = new aws.ecs.Service(`${env}-${appName}-service`, {
  cluster: ecsClusterArn,
  desiredCount: 1,
  launchType: "FARGATE",
  taskDefinition: taskDef.arn,
  networkConfiguration: {
    subnets: publicSubnetIds,
    securityGroups: [ecsSg.id],
    assignPublicIp: true
  },
  loadBalancers: [
    {
      targetGroupArn: targetGroup.arn,
      containerName: appName,
      containerPort: 80
    }
  ]
});

export const userDashboardFrontendUrl = alb.dnsName;
export const userDashboardFrontendServiceName = service.name;