import { LiCopy } from 'solar-icon-react/li';
import { OffGridIcon } from './OffGridIcon';

/**
 * Shown when no miner has used this broker's referral code yet. The code moves into
 * the block here, since sharing it is the only action that resolves the state.
 */
export function BrokerEmptyState({
  referralCode,
  onCopy,
  copied,
}: {
  referralCode: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-6 border-t-[0.5px] border-border p-8">
      <OffGridIcon className="text-placeholder" />

      <div className="text-center">
        <p className="font-heading text-xl font-semibold leading-8 text-foreground">No miners yet</p>
        <p className="mx-auto max-w-[582px] text-sm leading-5 text-body-alt">
          You don't have any miners assigned to your referral code yet. Share your referral code with miners to
          start tracking their activity.
        </p>
      </div>

      {referralCode && (
        <div className="flex items-center gap-3 rounded-xl bg-muted px-4 py-2">
          <span className="font-heading text-2xl font-semibold leading-9 tracking-[-1px] text-foreground">
            {referralCode}
          </span>
          <span aria-hidden className="h-6 w-[0.5px] bg-border" />
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-1 text-sm leading-5 text-foreground transition-opacity hover:opacity-80"
          >
            {copied ? 'Copied' : 'Copy'}
            <LiCopy className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
