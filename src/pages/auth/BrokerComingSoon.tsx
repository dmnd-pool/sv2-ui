import { useLocation } from 'wouter';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';

/** Placeholder for the broker auth flow, which is a later PR. */
export function BrokerComingSoon() {
  const [, navigate] = useLocation();
  return (
    <AuthLayout onBack={() => navigate('/signin')}>
      <div className="space-y-3 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Broker access is coming soon</h1>
        <p className="text-sm text-muted-foreground">
          The broker dashboard isn't available here yet. If you're a miner, sign in to your miner account.
        </p>
        <Button className="mt-2 w-full" onClick={() => navigate('/signin')}>
          Go to miner sign in
        </Button>
      </div>
    </AuthLayout>
  );
}
