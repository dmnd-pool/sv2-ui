import { InfoHint } from '@/components/ui/InfoHint';
import { formatHashrate } from '@/lib/utils';
import { brokerMinerRowId, formatBrokerFee, type BrokerMiner } from '@/lib/brokerTable';

/**
 * A miner's estimated earnings. No endpoint reports broker earnings, so the value
 * reads as unavailable rather than as a number nothing computed.
 */
function Earnings() {
  return <>--</>;
}

/** One miner as a mobile row-card: Name/Hashrate, then Estimated earnings/Broker fee. */
function MinerCard({ miner }: { miner: BrokerMiner }) {
  return (
    <div className="flex flex-col border-x-[0.5px] border-b-[0.5px] border-border px-3 py-2">
      <div className="flex min-h-[47px] items-center gap-6">
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="truncate text-xs leading-4 text-body-alt">Name</p>
          <p className="truncate text-sm leading-5 text-foreground">{miner.name}</p>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="truncate text-xs leading-4 text-body-alt">Hashrate</p>
          <p className="truncate text-sm leading-5 text-foreground">{formatHashrate(miner.hashrate)}</p>
        </div>
      </div>
      <div className="flex min-h-[47px] items-center gap-6">
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="truncate text-xs leading-4 text-body-alt">Estimated earnings</p>
          <p className="truncate text-sm leading-5 text-foreground">
            <Earnings />
          </p>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="truncate text-xs leading-4 text-body-alt">Broker fee</p>
          <p className="truncate text-sm leading-5 text-foreground">{formatBrokerFee(miner.broker_fee)}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * The broker's portfolio: a table at sm+, stacked row-cards below it. The mobile
 * frames rename the first column to Name and drop no other column.
 */
export function BrokerMinersTable({ miners }: { miners: BrokerMiner[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b-[0.5px] border-border bg-muted text-sm leading-5 text-body-alt">
              <th className="px-6 py-4 text-left font-normal">Miner</th>
              <th className="px-6 py-4 text-left font-normal">
                <span className="inline-flex items-center gap-2">
                  Hashrate
                  <InfoHint text="The miner's current hashrate." />
                </span>
              </th>
              <th className="px-6 py-4 text-left font-normal">Estimated earnings</th>
              <th className="px-6 py-4 text-left font-normal">
                <span className="inline-flex items-center gap-2">
                  Broker fee
                  <InfoHint text="The fee you earn from this miner." />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {miners.map((m) => (
              <tr key={brokerMinerRowId(m)} className="border-b-[0.5px] border-border last:border-0">
                <td className="px-6 py-4 text-foreground">{m.name}</td>
                <td className="px-6 py-4 text-foreground">{formatHashrate(m.hashrate)}</td>
                <td className="px-6 py-4 text-foreground">
                  <Earnings />
                </td>
                <td className="px-6 py-4 text-foreground">{formatBrokerFee(m.broker_fee)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sm:hidden">
        {miners.map((m) => (
          <MinerCard key={brokerMinerRowId(m)} miner={m} />
        ))}
      </div>
    </>
  );
}
