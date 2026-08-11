import { useState } from 'react';
import { LiCopy, LiCheckCircle, LiQuestionCircle, LiSquareShareLine } from 'solar-icon-react/li';
import { BoSort } from 'solar-icon-react/bo';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import type { WatcherLink } from '@/api/types';
import {
  accountLabel,
  formatWatcherDate,
  truncateToken,
  visibleScopeChips,
  watcherLinkUrl,
  watcherUrlLabel,
} from '@/lib/watcherLinks';
import type { Subaccount } from '@/api/types';

/** The empty message shown in the table body when a search or filter excludes every row. */
export interface WatcherLinksEmpty {
  title: string;
  hint: string;
  clearLabel: string;
  onClear: () => void;
}

/** A scope chip: rounded-8 badge, Geist 12px in the body-alt colour (matches the design). */
function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex h-6 items-center rounded-lg border-[0.5px] border-border px-3 text-xs leading-4 text-body-alt">
      {label}
    </span>
  );
}

/** The "+N" overflow count: a small rounded-full pill after the visible chips. */
function OverflowChip({ count }: { count: number }) {
  return (
    <span className="inline-flex h-4 items-center rounded-full bg-btn-secondary px-1.5 text-xs leading-4 text-body-alt">
      +{count}
    </span>
  );
}

function InfoHint({ label }: { label: string }) {
  return <LiQuestionCircle className="ml-1 inline h-3.5 w-3.5 align-middle text-placeholder" aria-label={label} />;
}

/** Copies `value` to the clipboard; hidden at rest, revealed on hover or focus. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setCopied(true);
        // The design confirms a copy with the neutral toast, not just the icon swap.
        toast({ type: 'info', message: `${label.charAt(0).toUpperCase()}${label.slice(1)} copied` });
        setTimeout(() => setCopied(false), 1500);
      }}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      className={cn(
        'shrink-0 text-placeholder transition-opacity hover:text-foreground',
        copied
          ? 'opacity-100'
          : 'opacity-0 focus-visible:opacity-100 group-hover/cell:opacity-100 [@media(hover:none)]:opacity-100',
      )}
    >
      {copied ? <LiCheckCircle className="h-3.5 w-3.5 text-success" /> : <LiCopy className="h-3.5 w-3.5" />}
    </button>
  );
}

/** The watcher links table: Account, Scopes, Token, URL, Created, Action. */
/**
 * One link as a mobile card: Account / Scopes on the first line, Token / URL on the
 * second. The frame drops the select column, `Created` and the row action, so this
 * card carries none of them; a watcher link is still opened from its URL affordance.
 */
function WatcherLinkCard({
  link,
  account,
  origin,
}: {
  link: WatcherLink;
  account: string | null;
  origin: string;
}) {
  const { chips, overflow } = visibleScopeChips(link.scopes);
  const url = watcherLinkUrl(origin, link.user_id, link.token);
  return (
    <div className="flex flex-col border-x-[0.5px] border-b-[0.5px] border-border px-3 py-2">
      <div className="flex min-h-[47px] items-center gap-6">
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="truncate text-xs leading-4 text-body-alt">Account</p>
          <p className="truncate text-sm leading-5 text-foreground">{account ?? '--'}</p>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="truncate text-xs leading-4 text-body-alt">Scopes</p>
          {/* The frame draws this strip wider than its own column, so the chips are
              allowed to wrap here rather than clip a scope the link actually grants. */}
          <span className="flex flex-wrap items-center gap-1">
            {chips.map((c) => (
              <Chip key={c} label={c} />
            ))}
            {overflow > 0 && <OverflowChip count={overflow} />}
          </span>
        </div>
      </div>
      <div className="flex min-h-[47px] items-center gap-6">
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="truncate text-xs leading-4 text-body-alt">Token</p>
          <span className="group/cell flex items-center gap-1">
            <span className="truncate text-xs leading-4 text-foreground">{truncateToken(link.token)}</span>
            <CopyButton value={link.token} label="token" />
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="truncate text-xs leading-4 text-body-alt">URL</p>
          <span className="flex items-center gap-1">
            <span className="truncate text-xs leading-4 text-foreground">{watcherUrlLabel(origin, link.token)}</span>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              aria-label="Open watcher link"
              className="shrink-0 text-body-alt transition-colors hover:text-foreground"
            >
              <LiSquareShareLine className="h-3.5 w-3.5" />
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}

export function WatcherLinksTable({
  links,
  sessionAccountId,
  subaccounts,
  origin,
  onView,
  empty,
}: {
  links: WatcherLink[];
  sessionAccountId: string | null;
  subaccounts: Subaccount[];
  origin: string;
  onView: (link: WatcherLink) => void;
  empty?: WatcherLinksEmpty;
}) {
  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
      <table className="w-full min-w-[880px] border-collapse text-sm">
        <thead>
          <tr className="border-b-[0.5px] border-border bg-muted text-sm leading-5 text-body-alt">
            <th className="px-6 py-4 text-left font-normal">Account</th>
            <th className="px-6 py-4 text-left font-normal">Scopes</th>
            <th className="px-6 py-4 text-left font-normal">
              Token
              <InfoHint label="The secret this Watcher link authenticates with. Copy it to use the link." />
            </th>
            <th className="px-6 py-4 text-left font-normal">
              URL
              <InfoHint label="Share this link to give read-only access to the scopes above." />
            </th>
            <th className="px-6 py-4 text-left font-normal">Created</th>
            <th className="px-6 py-4 text-left font-normal">Action</th>
          </tr>
        </thead>
        <tbody>
          {links.length === 0 && empty && (
            <tr>
              <td colSpan={6} className="border-x-[0.5px] border-b-[0.5px] border-border p-8 text-center">
                <div className="flex flex-col items-center gap-2">
                  {/* The design uses the Filter glyph itself here, not a magnifier. */}
                  <BoSort className="h-12 w-12 text-placeholder" aria-hidden />
                  <div>
                    <p className="!font-body text-lg font-medium leading-7 text-foreground">{empty.title}</p>
                    <p className="mx-auto max-w-[392px] text-sm leading-5 text-body-alt">{empty.hint}</p>
                  </div>
                  <button
                    type="button"
                    onClick={empty.onClear}
                    className="mt-2 inline-flex h-9 items-center rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-5 text-sm leading-5 text-foreground transition-opacity hover:opacity-80"
                  >
                    {empty.clearLabel}
                  </button>
                </div>
              </td>
            </tr>
          )}
          {links.map((l) => {
            const account = accountLabel(l.user_id, sessionAccountId, subaccounts);
            const { chips, overflow } = visibleScopeChips(l.scopes);
            const url = watcherLinkUrl(origin, l.user_id, l.token);
            return (
              <tr key={l.id} className="border-b-[0.5px] border-border last:border-0">
                <td className="whitespace-nowrap px-6 py-4 text-foreground">{account ?? '--'}</td>
                <td className="px-6 py-4">
                  <span className="flex items-center gap-1">
                    {chips.map((c) => (
                      <Chip key={c} label={c} />
                    ))}
                    {overflow > 0 && <OverflowChip count={overflow} />}
                  </span>
                </td>
                <td className="group/cell px-6 py-4 text-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="font-mono">{truncateToken(l.token)}</span>
                    <CopyButton value={l.token} label="token" />
                  </span>
                </td>
                <td className="group/cell px-6 py-4 text-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="font-mono">{watcherUrlLabel(origin, l.token)}</span>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open watcher link"
                      className="shrink-0 text-placeholder transition-colors hover:text-foreground"
                    >
                      <LiSquareShareLine className="h-3.5 w-3.5" />
                    </a>
                  </span>
                </td>
                <td className="px-6 py-4 text-foreground">{formatWatcherDate(l.created_at)}</td>
                <td className="px-6 py-4">
                  <button
                    type="button"
                    onClick={() => onView(l)}
                    className="text-sm font-medium text-foreground underline underline-offset-2 transition-colors hover:text-body-alt"
                  >
                    View
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        </table>
      </div>

      {/* Below sm the frame replaces the table with a stacked row-card list. */}
      <div className="sm:hidden">
        {links.length === 0 && empty && (
          <div className="border-x-[0.5px] border-b-[0.5px] border-border p-8 text-center">
            <div className="flex flex-col items-center gap-2">
              <BoSort className="h-12 w-12 text-placeholder" aria-hidden />
              <div>
                <p className="!font-body text-lg font-medium leading-7 text-foreground">{empty.title}</p>
                <p className="text-sm leading-5 text-body-alt">{empty.hint}</p>
              </div>
              <button
                type="button"
                onClick={empty.onClear}
                className="mt-2 inline-flex h-9 items-center rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-5 text-sm leading-5 text-foreground transition-opacity hover:opacity-80"
              >
                {empty.clearLabel}
              </button>
            </div>
          </div>
        )}
        {links.map((l) => (
          <WatcherLinkCard
            key={l.id}
            link={l}
            account={accountLabel(l.user_id, sessionAccountId, subaccounts)}
            origin={origin}
          />
        ))}
      </div>
    </>
  );
}
