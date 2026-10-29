import { usePplnsProjection, useAggregatedPplnsProjection, PplnsReportUnavailableError } from '@/hooks/usePplnsProjection';
import { PplnsProjectionPanel } from '@/components/pplns-projection/PplnsProjectionPanel';
import { useAggregatedModeContext } from '@/hooks/AggregatedModeProvider';

export function PplnsProjectionPage() {
  const { aggregated } = useAggregatedModeContext();
  const single = usePplnsProjection(!aggregated);
  const combined = useAggregatedPplnsProjection(aggregated);
  const report = aggregated ? combined : single;
  const hasData = report.data !== undefined;
  const awaitingReport = report.error instanceof PplnsReportUnavailableError;
  const updateStatus = hasData ? (
    <span role="status">
      Last updated <time dateTime={new Date(report.dataUpdatedAt).toISOString()}>{new Date(report.dataUpdatedAt).toLocaleString()}</time>
      {report.isFetching || awaitingReport ? ' · Updating…' : report.isError ? <>
        {' · Could not refresh. '}<button type="button" className="underline" onClick={() => void report.refetch()}>Retry</button>
      </> : null}
    </span>
  ) : undefined;

  return <PplnsProjectionPanel projection={aggregated ? undefined : single.data} dailyWork={aggregated ? combined.data : undefined}
    isLoading={!hasData && (report.isPending || awaitingReport)} isError={!hasData && report.isError && !awaitingReport}
    updateStatus={updateStatus} aggregated={aggregated} showStats />;
}
