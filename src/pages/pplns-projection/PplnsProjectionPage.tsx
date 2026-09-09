import { usePplnsProjection } from '@/hooks/usePplnsProjection';
import { PplnsProjectionPanel } from '@/components/pplns-projection/PplnsProjectionPanel';

export function PplnsProjectionPage() {
  const { data, isLoading, isError } = usePplnsProjection();

  return <PplnsProjectionPanel projection={data} isLoading={isLoading} isError={isError} />;
}
