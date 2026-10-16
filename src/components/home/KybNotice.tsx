import { BdClockCircle, BdShieldWarning } from 'solar-icon-react/bd';
import type { KybStatus } from '@/auth';
import { useAccountProfile } from '@/hooks/useAccountData';

export const KYB_VERIFICATION_URL = 'https://in.sumsub.com/websdk/p/uni_MFAZElUyajMzWfft';

const LINK = 'font-medium underline underline-offset-2';

/**
 * The home page's KYB reminder. Only the two states before approval
 *  appear here, so the strip disappears once KYB passes.
 */
export function KybNotice() {
  const { data: profile } = useAccountProfile();
  const status: KybStatus | undefined = profile?.kyb_status;
  if (status !== 'NotStarted' && status !== 'InReview') return null;

  const Icon = status === 'InReview' ? BdClockCircle : BdShieldWarning;

  return (
    <div className="flex items-start gap-2 rounded-xl bg-toast-warning px-4 py-2">
      {/* 2px low so it lines up with the copy's cap height, matching AggregatedBanner. */}
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
      <p className="min-w-0 text-sm leading-5 text-foreground">
        {status === 'NotStarted' ? (
          <>
            You&apos;re currently in test mode. You can still mine, but payouts are paused until{' '}
            <a href={KYB_VERIFICATION_URL} target="_blank" rel="noopener noreferrer" className={LINK}>
              KYB verification
            </a>{' '}
            is complete. Once verified, you&apos;ll be paid for all submitted hashrate.
          </>
        ) : (
          "Your KYB verification is under review."
        )}
      </p>
    </div>
  );
}
