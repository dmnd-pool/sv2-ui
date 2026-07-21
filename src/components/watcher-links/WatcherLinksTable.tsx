import { useState } from 'react';
import { LiCopy, LiCheckCircle, LiQuestionCircle, LiSquareShareLine } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';
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
    <span className="inline-flex items-center rounded-lg border border-border px-3 py-1 text-xs text-body-alt">
      {label}
    </span>
  );
}

/** The "+N" overflow count: a small rounded-full pill after the visible chips. */
function OverflowChip({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-xs text-body-alt">
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
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setCopied(true);
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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] border-collapse text-sm">
        <thead>
          <tr className="border-y border-border text-xs text-body-alt">
            <th className="px-6 py-3.5 text-left font-medium">Account</th>
            <th className="px-6 py-3.5 text-left font-medium">Scopes</th>
            <th className="px-6 py-3.5 text-left font-medium">
              Token
              <InfoHint label="The secret this Watcher link authenticates with. Copy it to use the link." />
            </th>
            <th className="px-6 py-3.5 text-left font-medium">
              URL
              <InfoHint label="Share this link to give read-only access to the scopes above." />
            </th>
            <th className="px-6 py-3.5 text-left font-medium">Created</th>
            <th className="px-6 py-3.5 text-left font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {links.length === 0 && empty && (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center">
                <p className="text-sm font-semibold text-foreground">{empty.title}</p>
                <p className="mt-1 text-sm text-body-alt">{empty.hint}</p>
                <button
                  type="button"
                  onClick={empty.onClear}
                  className="mt-4 inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {empty.clearLabel}
                </button>
              </td>
            </tr>
          )}
          {links.map((l) => {
            const account = accountLabel(l.user_id, sessionAccountId, subaccounts);
            const { chips, overflow } = visibleScopeChips(l.scopes);
            const url = watcherLinkUrl(origin, l.user_id, l.token);
            return (
              <tr key={l.id} className="border-b border-border last:border-0">
                <td className="whitespace-nowrap px-6 py-3.5 text-foreground">{account ?? '--'}</td>
                <td className="px-6 py-3.5">
                  <span className="flex items-center gap-1">
                    {chips.map((c) => (
                      <Chip key={c} label={c} />
                    ))}
                    {overflow > 0 && <OverflowChip count={overflow} />}
                  </span>
                </td>
                <td className="group/cell px-6 py-3.5 text-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="font-mono">{truncateToken(l.token)}</span>
                    <CopyButton value={l.token} label="token" />
                  </span>
                </td>
                <td className="group/cell px-6 py-3.5 text-foreground">
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
                <td className="px-6 py-3.5 text-foreground">{formatWatcherDate(l.created_at)}</td>
                <td className="px-6 py-3.5">
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
  );
}
