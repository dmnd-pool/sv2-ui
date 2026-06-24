import { LiveHashrateCard } from '@/components/home/LiveHashrateCard';
import { ConnectWorkersCard } from '@/components/home/ConnectWorkersCard';
import { WorkerStatCards } from '@/components/home/WorkerStatCards';
import { MiningPerformanceChart } from '@/components/home/MiningPerformanceChart';
import { GettingStartedCard } from '@/components/home/GettingStartedCard';

/** The dashboard landing: live hashrate, connect-workers credentials, worker
 * stats, the performance chart, and a floating setup checklist. */
export function DashboardHome() {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold text-heading">Welcome back</h2>
        <p className="mt-1 text-sm text-body-alt">Connect a worker to start mining and view performance data.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <LiveHashrateCard />
        </div>
        <div className="lg:col-span-2">
          <ConnectWorkersCard />
        </div>
      </div>

      <WorkerStatCards />

      <MiningPerformanceChart />

      <GettingStartedCard />
    </div>
  );
}
