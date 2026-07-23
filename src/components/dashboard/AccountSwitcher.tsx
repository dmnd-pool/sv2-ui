import { useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { LiAltArrowDown, LiRoundedMagnifer } from 'solar-icon-react/li';
import { cn, overlayContainer } from '@/lib/utils';
import { useAuth } from '@/auth';
import { useAccountSwitcher } from '@/hooks/useAccountSwitcher';
import { useSubaccountList } from '@/hooks/useSubaccounts';
import { subaccountName } from '@/lib/subaccountsTable';
import { accountInitials } from './accountInitials';

// Avatar colors cycle through the palette the design uses for subaccounts; the main
// account keeps the blue avatar it has elsewhere in the shell.
const SUB_COLORS = [
  { bg: '#d946ef', border: '#f0abfc' },
  { bg: '#22c55e', border: '#86efac' },
  { bg: '#f97316', border: '#fdba74' },
];
const MAIN_COLOR = { bg: '#2b7fff', border: '#93c5fd' };

function Avatar({ label, color }: { label: string; color: { bg: string; border: string } }) {
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold text-white"
      style={{ backgroundColor: color.bg, borderColor: color.border }}
    >
      {label}
    </span>
  );
}

/** One selectable account row: avatar, name, and whether it is the main account. */
function AccountRow({
  name,
  subtitle,
  color,
  disabled,
  onSelect,
}: {
  name: string;
  subtitle: string;
  color: { bg: string; border: string };
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className="flex w-full items-center gap-1 rounded-lg px-2 py-1 text-left transition-colors hover:bg-muted disabled:opacity-60"
    >
      <Avatar label={name.slice(0, 1).toUpperCase()} color={color} />
      <span className="min-w-0">
        <span className="block truncate text-sm text-foreground">{name}</span>
        <span className="block text-xs text-body-alt">{subtitle}</span>
      </span>
    </button>
  );
}

/**
 * The sidebar account block: shows the account currently in view and opens a list of
 * the other accounts to switch to. While viewing a subaccount the list leads with the
 * main account, which is how a miner gets back.
 */
export function AccountSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { session } = useAuth();
  const { data: subs } = useSubaccountList();
  const { viewingAccountId, switching, error, switchToSubaccount, switchToMain } = useAccountSwitcher();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Stable empty list so the options memo does not recompute on every render while
  // the subaccounts are still loading.
  const rows = useMemo(() => subs ?? [], [subs]);
  const current = rows.find((s) => s.id === viewingAccountId);
  const mainLabel = session?.email ?? 'Account';

  // The list offers every account except the one already in view; the main account
  // only appears while a subaccount is being viewed.
  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    const subOptions = rows
      .filter((s) => s.id !== viewingAccountId)
      .map((s, i) => ({
        id: s.id,
        token: s.token ?? '',
        name: subaccountName(s),
        subtitle: 'Subaccount',
        color: SUB_COLORS[i % SUB_COLORS.length],
      }));
    const all = viewingAccountId
      ? [{ id: null, token: '', name: mainLabel, subtitle: 'Main account', color: MAIN_COLOR }, ...subOptions]
      : subOptions;
    return q ? all.filter((o) => o.name.toLowerCase().includes(q)) : all;
  }, [rows, viewingAccountId, query, mainLabel]);

  // Nothing to switch between until the account has subaccounts.
  if (rows.length === 0) return null;

  const triggerName = current ? subaccountName(current) : mainLabel;
  const triggerSubtitle = current ? 'Subaccount' : 'Main account';
  const triggerColor = current
    ? SUB_COLORS[Math.max(0, rows.findIndex((s) => s.id === current.id)) % SUB_COLORS.length]
    : MAIN_COLOR;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          title={collapsed ? triggerName : undefined}
          aria-label={`Switch account, currently ${triggerName}`}
          className={cn(
            'mx-3 mb-3 flex items-center rounded-lg text-left transition-colors hover:bg-muted',
            collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-2.5 py-2',
          )}
        >
          <Avatar
            label={current ? triggerName.slice(0, 1).toUpperCase() : accountInitials(session?.email).slice(0, 1)}
            color={triggerColor}
          />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{triggerName}</span>
                <span className="block text-xs text-body-alt">{triggerSubtitle}</span>
              </span>
              <LiAltArrowDown className="h-4 w-4 shrink-0 text-placeholder" />
            </>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal container={overlayContainer()}>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={12}
          className="z-50 flex w-[189px] flex-col gap-1 rounded-xl bg-background p-3 shadow-2xl"
        >
          <label className="flex h-10 items-center gap-3 rounded-2xl bg-muted p-2">
            <LiRoundedMagnifer className="h-3.5 w-3.5 shrink-0 text-placeholder" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name"
              aria-label="Search accounts by name"
              className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-placeholder"
            />
          </label>

          {options.map((o) => (
            <div key={o.id ?? 'main'} className="flex flex-col gap-1">
              <span aria-hidden className="h-px w-full bg-border" />
              <AccountRow
                name={o.name}
                subtitle={o.subtitle}
                color={o.color}
                disabled={switching}
                onSelect={() => {
                  if (o.id === null) switchToMain();
                  else void switchToSubaccount({ id: o.id, token: o.token });
                  setOpen(false);
                }}
              />
            </div>
          ))}

          {error && <p className="px-2 text-xs text-destructive">{error}</p>}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
