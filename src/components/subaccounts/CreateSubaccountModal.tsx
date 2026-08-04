import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { LiClipboardText } from 'solar-icon-react/li';
import { BoShieldWarning } from 'solar-icon-react/bo';
import { BdCheckCircle } from 'solar-icon-react/bd';
import { cn, isValidBitcoinAddress, overlayContainer } from '@/lib/utils';
import { useCreateSubaccount } from '@/hooks/useSubaccounts';

/** Accept either a mainnet or a testnet payout address; the server is the final authority. */
function looksLikeBtc(addr: string): boolean {
  const a = addr.trim();
  return isValidBitcoinAddress(a, 'mainnet') || isValidBitcoinAddress(a, 'testnet4');
}

/** The 40px field used by both inputs: no visible border, muted fill, 16px radius. */
function Field({
  id,
  label,
  required,
  value,
  onChange,
  placeholder,
  action,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm leading-5 text-body-alt">
        {label}
        {required && <span className="ml-[3px]">*</span>}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-[16px] bg-muted px-4 py-2 text-sm leading-5 text-foreground placeholder:text-placeholder focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {action && <div className="flex justify-end">{action}</div>}
    </div>
  );
}

/** The primary action pill: full width, 44 tall, 32 radius. */
function PrimaryButton({
  children,
  disabled,
  onClick,
  type = 'button',
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-11 w-full items-center justify-center rounded-[32px] border border-black/20',
        'bg-[hsl(var(--btn))] px-6 py-2.5 text-base leading-6 text-[hsl(var(--btn-foreground))]',
        'transition-opacity hover:opacity-90 disabled:opacity-40',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Create a subaccount: name + optional payout address, then a confirmation step.
 *
 * Both steps are the same drawer the worker details panel uses (a right-side panel on
 * desktop, a bottom sheet on mobile). The create endpoint takes only
 * {sub_account, bitcoin_address} and, unlike the standalone address endpoint, needs no
 * 2FA token, so the form has no verification step.
 *
 * The payout address is optional here because it can be set afterwards against the
 * subaccount; the format is still validated whenever one is typed, since a wrong
 * address sends mining income somewhere unrecoverable.
 */
export function CreateSubaccountModal({
  onClose,
  onOpenCreated,
}: {
  onClose: () => void;
  /** Switches the dashboard to the subaccount just created, by name. */
  onOpenCreated?: (name: string) => void;
}) {
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

  const canSubmit = name.trim().length > 0 && !create.isPending;

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
    const addr = address.trim();
    if (addr && !looksLikeBtc(addr)) {
      setAddrError('Enter a valid Bitcoin address.');
      return;
    }
    setAddrError(null);
    create.mutate({ name: name.trim(), bitcoinAddress: addr });
  };

  const errorMessage = create.isError
    ? ((create.error as Error)?.message ?? 'Could not create the subaccount. Please try again.')
    : null;

  const closeButton = (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-[32px] bg-btn-secondary text-foreground transition-opacity hover:opacity-80',
        'h-10 w-10 p-3 sm:h-12 sm:w-12 sm:p-4',
      )}
    >
      <X className="h-4 w-4 sm:h-6 sm:w-6" />
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[8px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create subaccount"
        className={cn(
          'absolute flex flex-col gap-6 overflow-y-auto bg-background shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]',
          // Mobile: a bottom sheet at the frame's fixed height, capped so it can never
          // outgrow a short viewport. Desktop: the 472px right-side drawer.
          'inset-x-0 bottom-0 h-[632px] max-h-[85vh] p-6',
          'sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-0 sm:h-auto sm:max-h-screen sm:w-full sm:max-w-[472px] sm:p-8',
        )}
      >
        {create.isSuccess ? (
          <div className="flex flex-1 flex-col gap-6">
            <div className="flex justify-end">{closeButton}</div>

            <div className="flex flex-1 flex-col items-center justify-center gap-6">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-toast-success">
                <BdCheckCircle className="h-12 w-12 text-[#22C55E]" />
              </span>
              <div className="w-[335px] max-w-full">
                <p className="font-heading text-2xl font-semibold leading-9 text-foreground">
                  Subaccount created successfully
                </p>
                <p className="text-sm leading-5 text-body-alt">
                  You can now connect workers and manage mining activity separately.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="border-t-[0.5px] border-border" />
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-[32px] bg-btn-secondary px-6 py-2.5 text-base leading-6 text-foreground transition-opacity hover:opacity-80"
                >
                  Close
                </button>
                <div className="flex-1">
                  <PrimaryButton onClick={() => onOpenCreated?.(name.trim())} disabled={!onOpenCreated}>
                    Open subaccount
                  </PrimaryButton>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-heading text-2xl font-semibold leading-9 tracking-[-1px] text-foreground">
                    Create subaccount
                  </h2>
                  <p className="text-sm leading-5 text-body-alt">
                    Create a separate mining account to organize workers, earnings, and payouts independently.
                  </p>
                </div>
                {closeButton}
              </div>
              <div className="border-t-[0.5px] border-border" />
            </div>

            <form
              className="flex flex-col gap-6"
              onSubmit={(e) => {
                e.preventDefault();
                if (canSubmit) submit();
              }}
            >
              <Field
                id="sub-name"
                label="Subaccount Name"
                required
                value={name}
                onChange={setName}
                placeholder="e.g. Warehouse 01"
              />

              <Field
                id="sub-addr"
                label="Bitcoin address"
                value={address}
                onChange={(v) => {
                  setAddress(v);
                  setAddrError(null);
                }}
                placeholder="Enter your bitcoin address"
                action={
                  <button
                    type="button"
                    onClick={() => void paste()}
                    className="inline-flex items-center gap-1 text-sm leading-5 text-foreground transition-opacity hover:opacity-70"
                  >
                    Paste address <LiClipboardText className="h-3.5 w-3.5" />
                  </button>
                }
              />

              {addrError && <p className="text-sm leading-5 text-destructive">{addrError}</p>}

              {address.trim().length > 0 && (
                <div className="flex gap-1 rounded-[16px] bg-toast-warning p-3">
                  <span className="pt-0.5">
                    <BoShieldWarning className="h-5 w-5 shrink-0 text-[#EAB308]" />
                  </span>
                  <div className="flex flex-col gap-2">
                    <p className="text-base font-bold leading-6 text-foreground">Double check address</p>
                    <p className="text-sm leading-5 text-foreground">
                      Bitcoin payments sent to the wrong address cannot be recovered by anyone, including DMND Pool.
                    </p>
                  </div>
                </div>
              )}

              {errorMessage && <p className="text-sm leading-5 text-destructive">{errorMessage}</p>}

              <div className="flex flex-col gap-4">
                <div className="border-t-[0.5px] border-border" />
                <PrimaryButton type="submit" disabled={!canSubmit}>
                  {create.isPending ? 'Creating...' : 'Continue'}
                </PrimaryButton>
              </div>
            </form>
          </>
        )}
      </div>
    </div>,
    overlayContainer(),
  );
}
