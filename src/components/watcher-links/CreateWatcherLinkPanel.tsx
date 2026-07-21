import { useEffect, useState, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { LiCloseCircle, LiAltArrowDown } from 'solar-icon-react/li';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Subaccount, WatcherLink, WatcherScope } from '@/api/types';
import {
  ALL_WATCHER_SCOPES,
  SCOPE_DESCRIPTIONS,
  scopeLabel,
  WATCHER_PRESETS,
  presetScopes,
  type WatcherPreset,
} from '@/lib/watcherLinks';
import { WatcherLinkCreated } from './WatcherLinkCreated';

interface AccountOption {
  userId: string;
  label: string;
}

/**
 * The accounts a watcher link can be scoped to: the master account, then each
 * subaccount. The master is labelled "Main account" to match the links table; the
 * design's company-name prefix has no source in the session (see the page note).
 */
function accountOptions(sessionAccountId: string | null, subaccounts: Subaccount[]): AccountOption[] {
  const master: AccountOption[] =
    sessionAccountId !== null ? [{ userId: sessionAccountId, label: 'Main account' }] : [];
  return [...master, ...subaccounts.map((s) => ({ userId: s.id, label: s.sub_account }))];
}

/** A dropdown-style field: a button showing the value, and a panel of options below it. */
function Field({
  label,
  required,
  hint,
  value,
  placeholder,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  value: string | null;
  placeholder: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-body-alt">
        {label}
        {required && <span className="text-body-alt"> *</span>}
      </label>
      {/* Radix portals the list out of the panel. The panel scrolls its own content,
          so an in-flow dropdown would be clipped by it and force the reader to scroll
          the panel just to reach the options. */}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-haspopup="listbox"
            className="flex w-full items-center justify-between gap-2 rounded-2xl border border-border bg-muted px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:border-foreground/30"
          >
            <span className={cn('truncate', value === null && 'text-placeholder')}>{value ?? placeholder}</span>
            <LiAltArrowDown
              className={cn('h-4 w-4 shrink-0 text-placeholder transition-transform', open && 'rotate-180')}
            />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            role="listbox"
            align="start"
            sideOffset={8}
            collisionPadding={16}
            onOpenAutoFocus={(e) => e.preventDefault()}
            // Match the field's width, and only scroll if the list genuinely cannot
            // fit the space Radix measured (a long account list, never the presets).
            className="z-[60] max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] overflow-y-auto rounded-2xl border border-border bg-popover p-1.5 shadow-xl"
          >
            {children(() => setOpen(false))}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {hint && <p className="text-xs text-body-alt">{hint}</p>}
    </div>
  );
}

function Row({ selected, onClick, children }: { selected?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted',
        selected && 'bg-muted',
      )}
    >
      {children}
    </button>
  );
}

/**
 * The create-watcher-link side panel. The user picks the account the link can read
 * and its scopes (a preset, or a custom set), then creates it. On success the panel
 * swaps to the one-time reveal of the token and URL; the parent keeps it mounted so
 * that view stays until the user closes it.
 */
export function CreateWatcherLinkPanel({
  sessionAccountId,
  subaccounts,
  origin,
  onClose,
  onCreate,
}: {
  sessionAccountId: string | null;
  subaccounts: Subaccount[];
  origin: string;
  onClose: () => void;
  onCreate: (input: { targetUserId: string; scopes: WatcherScope[] }) => Promise<WatcherLink>;
}) {
  const [account, setAccount] = useState<AccountOption | null>(null);
  const [preset, setPreset] = useState<WatcherPreset | null>(null);
  const [customScopes, setCustomScopes] = useState<WatcherScope[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<WatcherLink | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const options = accountOptions(sessionAccountId, subaccounts);
  const scopes = preset === 'custom' ? customScopes : preset ? presetScopes(preset) : [];
  const canSubmit = account !== null && scopes.length > 0 && !submitting;

  const toggleScope = (s: WatcherScope) =>
    setCustomScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const submit = async () => {
    if (!canSubmit || account === null) return; // guards double-submit and a missing account
    setSubmitting(true);
    setError(null);
    try {
      const link = await onCreate({ targetUserId: account.userId, scopes });
      setCreated(link);
    } catch {
      setError("We couldn't create the Watcher link. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const presetValue = preset ? WATCHER_PRESETS.find((p) => p.value === preset)?.label ?? null : null;
  const presetHint = preset
    ? WATCHER_PRESETS.find((p) => p.value === preset)?.hint
    : 'Choose a preset to quickly configure permissions, or customise them';
  const customValue = customScopes.length > 0 ? customScopes.map(scopeLabel).join(', ') : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Create watcher link"
        className="relative flex max-h-full w-full max-w-[472px] flex-col overflow-y-auto rounded-bl-xl border-b border-l border-border bg-popover shadow-xl"
      >
        {created ? (
          <WatcherLinkCreated link={created} origin={origin} onClose={onClose} />
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 border-b border-border p-6">
              <div>
                <h2 className="text-lg font-semibold text-heading">Create watcher link</h2>
                <p className="mt-1 text-sm text-body-alt">Choose the account and data this Watcher link can access.</p>
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

            <div className="flex flex-col gap-5 p-6">
              <Field
                label="Account"
                required
                hint="Select which account this link can read."
                value={account?.label ?? null}
                placeholder="Select an account"
              >
                {(close) =>
                  options.map((o) => (
                    <Row
                      key={o.userId}
                      selected={account?.userId === o.userId}
                      onClick={() => {
                        setAccount(o);
                        close();
                      }}
                    >
                      <span className="text-sm text-foreground">{o.label}</span>
                    </Row>
                  ))
                }
              </Field>

              <Field
                label="Watcher-link presets"
                required
                hint={presetHint}
                value={presetValue}
                placeholder="Select presets"
              >
                {(close) =>
                  WATCHER_PRESETS.map((p) => (
                    <Row
                      key={p.value}
                      selected={preset === p.value}
                      onClick={() => {
                        setPreset(p.value);
                        if (p.value !== 'custom') setCustomScopes([]);
                        close();
                      }}
                    >
                      <span className="flex flex-col">
                        <span className="text-sm text-foreground">{p.label}</span>
                        <span className="text-xs text-body-alt">{p.hint}</span>
                      </span>
                    </Row>
                  ))
                }
              </Field>

              {preset === 'custom' && (
                <Field
                  label="Custom scopes"
                  required
                  value={customValue}
                  placeholder="Select permissions"
                >
                  {() =>
                    ALL_WATCHER_SCOPES.map((s) => {
                      const checked = customScopes.includes(s);
                      return (
                        <Row key={s} selected={checked} onClick={() => toggleScope(s)}>
                          <span className="flex flex-1 flex-col">
                            <span className="text-sm text-foreground">{scopeLabel(s)}</span>
                            <span className="text-xs text-body-alt">{SCOPE_DESCRIPTIONS[s]}</span>
                          </span>
                          <span
                            className={cn(
                              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                              checked ? 'border-[hsl(var(--btn))] bg-[hsl(var(--btn))]' : 'border-placeholder',
                            )}
                          >
                            {checked && <Check className="h-3 w-3 text-[hsl(var(--btn-foreground))]" strokeWidth={3} />}
                          </span>
                        </Row>
                      );
                    })
                  }
                </Field>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <div className="mt-auto flex items-center justify-end gap-3 border-t border-border p-6">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => void submit()}
                className="rounded-full bg-[hsl(var(--btn))] px-5 py-2 text-sm font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {submitting ? 'Creating...' : 'Create watcher link'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
