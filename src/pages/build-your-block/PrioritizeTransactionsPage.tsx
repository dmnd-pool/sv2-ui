import heroImage from '@/assets/guide-hero-prioritize-transactions.png';
import {
  DocHero,
  DocPage,
  DocSection,
  DocText,
  DocList,
  DocTable,
  DocCallout,
  CodeBlock,
  Chip,
  DocFooterPrompt,
} from '@/components/docs/DocPrimitives';

const DMND_CLIENT_REPO = 'https://github.com/dmnd-pool/dmnd-client';

const ENV_EXAMPLE = `TOKEN=<DMND-token> \\
RPC_URL=http://127.0.0.1:8332 \\
RPC_USER=<bitcoin-rpc-user> \\
RPC_PWD=<bitcoin-rpc-password> \\
RPC_FEE_DELTA=100000 \\
API_TX_TOKEN=<api-token> \\
./dmnd-client -l info -d 250T --tp-address="127.0.0.1:8336"`;

const TOML_EXAMPLE = `rpc_url = "http://127.0.0.1:8332"
rpc_user = "<bitcoin-rpc-user>"
rpc_pwd = "<bitcoin-rpc-password>"
rpc_fee_delta = 100000
api_tx_token = "<api-token>"`;

const SUBMIT_EXAMPLE = `curl -X POST \\
  -H "Authorization: Bearer <api-token>" \\
  "http://127.0.0.1:3001/api/tx/submit/<raw-transaction-hex>"`;

const LIST_EXAMPLE = `curl \\
  -H "Authorization: Bearer <api-token>" \\
  "http://127.0.0.1:3001/api/tx/prioritized"`;

const RESPONSE_EXAMPLE = `{
  "success": true,
  "message": null,
  "data": {
    "count": 1,
    "txs": [
      {
        "txid": "<txid>",
        "tx_hex": "<raw-transaction-hex>",
        "tx_fee": {
          "real": 0.00001000,
          "modified": 0.00101000
        }
      }
    ]
  }
}`;

const SETTINGS: { setting: string; flag: string; toml: string; env: string; description: React.ReactNode }[] = [
  {
    setting: 'RPC URL',
    flag: '--rpc-url',
    toml: 'rpc_url',
    env: 'RPC_URL',
    description: (
      <>
        Bitcoin Core RPC, e.g. <Chip>http://127.0.0.1:8332</Chip>
      </>
    ),
  },
  { setting: 'RPC user', flag: '--rpc-user', toml: 'rpc_user', env: 'RPC_USER', description: 'Bitcoin Core RPC username' },
  { setting: 'RPC password', flag: '--rpc-pwd', toml: 'rpc_pwd', env: 'RPC_PWD', description: 'Bitcoin Core RPC password' },
  {
    setting: 'Fee delta',
    flag: '--rpc-fee-delta',
    toml: 'rpc_fee_delta',
    env: 'RPC_FEE_DELTA',
    description: (
      <>
        Virtual fee boost in satoshis, passed to <Chip>prioritisetransaction</Chip>
      </>
    ),
  },
  { setting: 'API token', flag: '--api-tx-token', toml: 'api_tx_token', env: 'API_TX_TOKEN', description: 'Bearer token required by this API' },
];

/**
 * Prioritize transactions: an optional DMND Client API that asks the miner's own
 * Bitcoin Core node to favour a transaction when building templates. The boost is
 * virtual, so it spends nothing and does not alter the transaction on the network.
 */
export function PrioritizeTransactionsPage() {
  return (
    <DocPage title="Prioritize transactions (optional)">
      <DocHero src={heroImage} height={160} />

      <DocText>
        The DMND Client can expose an API endpoint that submits a raw transaction to your Bitcoin Core node and asks it
        to prioritize that transaction for block template selection (via the <Chip>prioritisetransaction</Chip> RPC).
      </DocText>

      <DocSection title="Configuration">
        <DocText>The feature is enabled only when all of the following are configured:</DocText>
        <DocTable
          headers={['Setting', 'CLI flag', 'config.toml', 'Env var', 'Description']}
          rows={SETTINGS.map((s) => [
            s.setting,
            <Chip>{s.flag}</Chip>,
            <Chip>{s.toml}</Chip>,
            <Chip>{s.env}</Chip>,
            s.description,
          ])}
        />

        <DocCallout label="Fee delta units:">
          <Chip>RPC_FEE_DELTA</Chip> is denominated in satoshis. It's a virtual fee adjustment used only for template
          selection on your node — it doesn't spend anything — but set it deliberately. <Chip>100000</Chip> (0.001 BTC
          virtual boost) is a reasonable starting point.
        </DocCallout>

        <DocCallout label="Security:">
          <DocList
            items={[
              <>
                The tx API (default port <Chip>3001</Chip>) should never be exposed to the public internet. Bind it to
                localhost or protect it behind your own gateway.
              </>,
              <>
                <Chip>config.toml</Chip> stores RPC credentials in plaintext — restrict file permissions (
                <Chip>chmod 600 config.toml</Chip>).
              </>,
              <>
                Treat <Chip>API_TX_TOKEN</Chip> like a password.
              </>,
            ]}
          />
        </DocCallout>
      </DocSection>

      <DocSection title="Example environment variables:">
        <CodeBlock code={ENV_EXAMPLE} />
      </DocSection>

      <DocSection title="Example config.toml:">
        <CodeBlock code={TOML_EXAMPLE} />
      </DocSection>

      <DocSection title="Using the API">
        <DocText>Submit a raw transaction hex:</DocText>
        <CodeBlock code={SUBMIT_EXAMPLE} />

        <DocText>List currently tracked prioritized transactions:</DocText>
        <CodeBlock code={LIST_EXAMPLE} />

        <DocText>
          The response includes the tracked transaction count, transaction hex, and live mempool fees from Bitcoin Core —{' '}
          <Chip>tx_fee.real</Chip> is <Chip>getmempoolentry</Chip>'s <Chip>fees.base</Chip>;{' '}
          <Chip>tx_fee.modified</Chip> is the boosted <Chip>fees.modified</Chip>:
        </DocText>
        <CodeBlock code={RESPONSE_EXAMPLE} />

        <DocText>
          The API server port defaults to <Chip>3001</Chip> and can be changed with <Chip>--api-server-port</Chip>,{' '}
          <Chip>api_server_port</Chip>, or <Chip>API_SERVER_PORT</Chip>.
        </DocText>

        <DocText>
          If the prioritization configuration is incomplete, these endpoints are disabled: the client logs that
          transaction prioritization is not enabled and the endpoints return <Chip>503 Service Unavailable</Chip>.
        </DocText>
      </DocSection>

      <DocFooterPrompt href={DMND_CLIENT_REPO} />
    </DocPage>
  );
}
