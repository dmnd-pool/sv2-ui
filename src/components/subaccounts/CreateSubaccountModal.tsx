import { useEffect, useState } from 'react';
import { LiCloseCircle, LiCheckCircle, LiClipboard } from 'solar-icon-react/li';
import { isValidBitcoinAddress } from '@/lib/utils';
import { useCreateSubaccount } from '@/hooks/useSubaccounts';

/** Accept either a mainnet or a testnet payout address; the server is the final authority. */
function looksLikeBtc(addr: string): boolean {
  const a = addr.trim();
  return isValidBitcoinAddress(a, 'mainnet') || isValidBitcoinAddress(a, 'testnet4');
}

/**
 * Right-side drawer to create a subaccount: name + payout address -> create -> success.
 * The create endpoint takes only {sub_account, bitcoin_address} (no 2FA token in the
 * body), so the form has no 2FA step.
 */
export function CreateSubaccountModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [addrError, setAddrError] = useState<string | null>(null);
  const create = useCreateSubaccount();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const canSubmit = name.trim().length > 0 && address.trim().length > 0 && !create.isPending;

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setAddress(text.trim());
        setAddrError(null);
      }
    } catch {
      // Clipboard read can be blocked (permission / insecure context); the user can
      // still type or paste manually, so fail silently.
    }
  };

  const submit = () => {
    if (!looksLikeBtc(address)) {
      setAddrError('Enter a valid Bitcoin address.');
      return;
    }
    setAddrError(null);
    create.mutate({ name: name.trim(), bitcoinAddress: address.trim() });
  };

  const errorMessage =
    create.isError ? ((create.error as Error)?.message ?? 'Could not create the subaccount. Please try again.') : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create subaccount"
        className="relative flex max-h-full w-full max-w-[472px] flex-col overflow-y-auto rounded-bl-xl border-b border-l border-border bg-popover shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-6">
          <div>
            <h2 className="text-lg font-semibold text-heading">Create subaccount</h2>
            <p className="mt-1 text-sm text-body-alt">
              Create a separate mining account to organize workers, earnings, and payouts independently.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-placeholder transition-colors hover:text-foreground"
          >
            <LiCloseCircle className="h-6 w-6" />
          </button>
        </div>

        {create.isSuccess ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <LiCheckCircle className="h-12 w-12 text-success" />
            <p className="mt-3 text-base font-semibold text-foreground">Subaccount created</p>
            <p className="mt-1 text-sm text-body-alt">{name.trim()} is ready.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 inline-flex items-center rounded-lg bg-[hsl(var(--btn))] px-5 py-2 text-sm font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
            >
              Done
            </button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-5 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) submit();
            }}
          >
            <div>
              <label htmlFor="sub-name" className="text-sm font-medium text-foreground">
                Subaccount Name <span className="text-destructive">*</span>
              </label>
              <input
                id="sub-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Warehouse 01"
                className="mt-1.5 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-placeholder focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="sub-addr" className="text-sm font-medium text-foreground">
                Bitcoin address
              </label>
              <input
                id="sub-addr"
                type="text"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setAddrError(null);
                }}
                placeholder="Enter your bitcoin address"
                className="mt-1.5 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-placeholder focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="mt-1.5 flex items-center justify-between">
                {addrError ? <span className="text-xs text-destructive">{addrError}</span> : <span />}
                <button
                  type="button"
                  onClick={() => void paste()}
                  className="inline-flex items-center gap-1 text-xs font-medium text-body-alt transition-colors hover:text-foreground"
                >
                  Paste address <LiClipboard className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

            <div className="-mx-6 border-t border-border" />

            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center justify-center rounded-lg bg-[hsl(var(--btn))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {create.isPending ? 'Creating...' : 'Continue'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
