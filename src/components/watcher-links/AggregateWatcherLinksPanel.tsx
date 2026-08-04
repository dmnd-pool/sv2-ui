import { useEffect, useMemo, useRef, useState } from 'react';
import { LiCloseCircle, LiAltArrowDown, LiMagnifer } from 'solar-icon-react/li';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Subaccount, WatcherLink } from '@/api/types';
import { accountLabel } from '@/lib/watcherLinks';
import {
  MULTIWATCHER_MODES,
  modeLabel,
  eligibleLinks,
  highestPerAccount,
  multiwatcherUrl,
  type MultiwatcherMode,
} from '@/lib/multiwatcher';
import { MultiwatcherCreated } from './MultiwatcherCreated';

// What a multiwatcher link means for the holder; the design lists these as guidance.
const EXPLAINERS = [
  'The multiwatcher link will show the selected permission for the selected accounts.',
  'Only Watcher links with the selected permission set are available.',
  "The generated link won't appear in your Watcher links list because it's created from existing Watcher links.",
  'It remains valid until one of the selected Watcher links is revoked.',
  'If multiple keys belong to the same account, the key with the highest permissions is used automatically.',
];

/**
 * The "Aggregate watcher links" panel. It composes several existing watcher links,
 * chosen by account, into one multiwatcher link under a single enforcement mode. The
 * link is built entirely client-side: there is no create call, so on "generate" the
 * panel simply shows the resulting URL. Only accounts with a link eligible for the
 * chosen mode can be selected; one link per account (the highest-permission one).
 */
export function AggregateWatcherLinksPanel({
  links,
  sessionAccountId,
  subaccounts,
  origin,
  onClose,
}: {
  links: WatcherLink[];
  sessionAccountId: string | null;
  subaccounts: Subaccount[];
  origin: string;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<MultiwatcherMode>('both');
  const [modeOpen, setModeOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const modeRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (modeRef.current && !modeRef.current.contains(e.target as Node)) setModeOpen(false);
      if (linksRef.current && !linksRef.current.contains(e.target as Node)) setLinksOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  // One eligible link per account for the chosen mode; changing the mode re-derives
  // the pool, so a selection that is no longer eligible drops out.
  const pool = useMemo(() => highestPerAccount(eligibleLinks(links, mode)), [links, mode]);
  useEffect(() => {
    setSelected((cur) => new Set([...cur].filter((id) => pool.some((l) => l.id === id))));
  }, [pool]);

  const filteredPool = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool.filter((l) => {
      const name = accountLabel(l.user_id, sessionAccountId, subaccounts) ?? '';
      return !q || name.toLowerCase().includes(q);
    });
  }, [pool, query, sessionAccountId, subaccounts]);

  const chosen = pool.filter((l) => selected.has(l.id));
  const canGenerate = chosen.length > 0;

  const generate = () => {
    if (!canGenerate) return;
    setCreatedUrl(multiwatcherUrl(origin, mode, chosen));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[8px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Aggregate watcher links"
        className="relative flex max-h-full w-full max-w-[472px] flex-col overflow-y-auto bg-background shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]"
      >
        {createdUrl ? (
          <MultiwatcherCreated url={createdUrl} mode={mode} onClose={onClose} />
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 border-b-[0.5px] border-border p-6 sm:p-8">
              <div>
                <h2 className="text-lg font-semibold text-heading">Aggregate watcher links</h2>
                <p className="mt-1 text-sm text-body-alt">
                  Create a temporary multiwatcher link from existing Watcher links.
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

            <div className="flex flex-col gap-6 p-6 sm:p-8">
              <div ref={modeRef} className="flex flex-col gap-1.5">
                <label className="text-sm text-body-alt">
                  Permissions<span> *</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setModeOpen((o) => !o)}
                    aria-haspopup="listbox"
                    aria-expanded={modeOpen}
                    className="flex h-10 w-full items-center justify-between gap-3 rounded-[16px] bg-muted px-4 py-2 text-left text-sm leading-5 text-foreground transition-opacity hover:opacity-80"
                  >
                    {modeLabel(mode)}
                    <LiAltArrowDown className={cn('h-4 w-4 text-placeholder transition-transform', modeOpen && 'rotate-180')} />
                  </button>
                  {modeOpen && (
                    <div role="listbox" className="absolute left-0 right-0 top-full z-10 mt-1 flex flex-col gap-1 rounded-xl border-[0.5px] border-border bg-background p-3 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]">
                      {MULTIWATCHER_MODES.map((m) => (
                        <button
                          key={m}
                          type="button"
                          role="option"
                          aria-selected={mode === m}
                          onClick={() => {
                            setMode(m);
                            setModeOpen(false);
                          }}
                          className={cn(
                            'flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm leading-5 text-foreground transition-colors hover:bg-muted',
                            mode === m && 'bg-muted',
                          )}
                        >
                          {modeLabel(m)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <ul className="flex flex-col gap-2">
                {EXPLAINERS.map((text) => (
                  <li key={text} className="flex gap-2 text-xs text-body-alt">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--info))]" />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>

              <div ref={linksRef} className="flex flex-col gap-1.5">
                <label className="text-sm text-body-alt">Watcher links</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setLinksOpen((o) => !o)}
                    aria-haspopup="listbox"
                    aria-expanded={linksOpen}
                    className="flex h-10 w-full items-center justify-between gap-3 rounded-[16px] bg-muted px-4 py-2 text-left text-sm leading-5 transition-opacity hover:opacity-80"
                  >
                    <span className={cn('truncate', chosen.length === 0 && 'text-placeholder')}>
                      {chosen.length === 0 ? 'Select Watcher links' : `${chosen.length} selected`}
                    </span>
                    <LiAltArrowDown className={cn('h-4 w-4 shrink-0 text-placeholder transition-transform', linksOpen && 'rotate-180')} />
                  </button>
                  {linksOpen && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-1 flex flex-col gap-1 rounded-xl border-[0.5px] border-border bg-background p-3 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]">
                      <div className="relative px-1 pb-1.5">
                        <LiMagnifer className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-placeholder" />
                        <input
                          type="text"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Search subaccount"
                          aria-label="Search accounts"
                          className="h-10 w-full rounded-[16px] bg-muted py-2 pl-9 pr-4 text-sm leading-5 text-foreground placeholder:text-placeholder focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div className="max-h-56 overflow-y-auto">
                        {filteredPool.length === 0 ? (
                          <p className="px-3 py-6 text-center text-xs text-body-alt">
                            No eligible Watcher links for the selected permission.
                          </p>
                        ) : (
                          filteredPool.map((l) => {
                            const checked = selected.has(l.id);
                            const name = accountLabel(l.user_id, sessionAccountId, subaccounts) ?? l.user_id;
                            return (
                              <button
                                key={l.id}
                                type="button"
                                role="option"
                                aria-selected={checked}
                                onClick={() =>
                                  setSelected((cur) => {
                                    const next = new Set(cur);
                                    if (next.has(l.id)) next.delete(l.id);
                                    else next.add(l.id);
                                    return next;
                                  })
                                }
                                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
                              >
                                <span className="text-sm text-foreground">{name}</span>
                                <span
                                  className={cn(
                                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                                    checked ? 'border-[hsl(var(--btn))] bg-[hsl(var(--btn))]' : 'border-placeholder',
                                  )}
                                >
                                  {checked && <Check className="h-3 w-3 text-[hsl(var(--btn-foreground))]" strokeWidth={3} />}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-auto flex items-center justify-end gap-3 border-t-[0.5px] border-border p-6 sm:p-8">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 items-center rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-6 text-base leading-6 text-foreground transition-opacity hover:opacity-80"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canGenerate}
                onClick={generate}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-[32px] border border-black/20 bg-[hsl(var(--btn))] px-6 text-base leading-6 text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Generate link
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
