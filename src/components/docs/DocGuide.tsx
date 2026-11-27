import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link } from 'wouter';
import { LiCopy, LiCheckCircle, LiAltArrowRight, LiAltArrowDown, LiCloseCircle, LiSettings } from 'solar-icon-react/li';
import { OlArrowRightUp } from 'solar-icon-react/ol';
import { cn } from '@/lib/utils';
import { useAccountProfile } from '@/hooks/useAccountData';
import { Chip, DocCallout, DocList, DocText } from '@/components/docs/DocPrimitives';


interface DocCrumb {
  label: string;
  href?: string;
}

/** The page wrapper. Pass trail instead of title when a guide has several pages. */
export function DocPage({
  title,
  trail,
  children,
}: {
  title?: string;
  trail?: DocCrumb[];
  children: ReactNode;
}) {
  // Opened from every page of the section, because the values it holds are the section's,
  // not any one page's.
  const [setupOpen, setSetupOpen] = useState(false);
  // Nothing on the page says the commands can be personalised, so the button marks itself
  // until it has been opened once. After that it is just another control.
  const [seenSetup, setSeenSetup] = useState(() => {
    try {
      return window.localStorage.getItem(SETUP_SEEN) === '1';
    } catch {
      return true;
    }
  });

  const openSetup = () => {
    setSetupOpen(true);
    setSeenSetup(true);
    try {
      window.localStorage.setItem(SETUP_SEEN, '1');
    } catch {
      /* the hint simply shows again next time */
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        {trail ? (
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm leading-5">
            {trail.map((crumb, i) => (
              <span key={crumb.label} className="flex items-center gap-2">
                {i > 0 && <LiAltArrowRight className="h-3.5 w-3.5 shrink-0 text-placeholder" aria-hidden />}
                {crumb.href ? (
                  <Link href={crumb.href} className="text-body-alt transition-colors hover:text-foreground">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={i === trail.length - 1 ? 'font-medium text-foreground' : 'text-body-alt'}>
                    {crumb.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        ) : (
          <h1 className="font-heading text-2xl font-bold leading-9 tracking-[-1px] text-heading">{title}</h1>
        )}
        <button
          type="button"
          onClick={openSetup}
          className={cn(
            'relative inline-flex shrink-0 items-center gap-1.5 rounded-lg border-[0.5px] px-3 py-1.5 text-sm leading-5 transition-colors',
            seenSetup
              ? 'border-border text-body-alt hover:text-foreground'
              : 'border-info/50 bg-info/5 text-foreground',
          )}
        >
          <LiSettings className="h-4 w-4" />
          Your details
          {!seenSetup && (
            <span aria-hidden className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-info opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-info" />
            </span>
          )}
        </button>
      </header>
      {setupOpen && <SetupDrawer onClose={() => setSetupOpen(false)} />}
      <div className="h-[0.5px] w-full bg-border" />
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  );
}

async function copyText(text: string, host: HTMLElement) {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      /* Try the text area below. */
    }
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.readOnly = true;
  area.setAttribute('aria-hidden', 'true');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  const focused = document.activeElement;
  host.appendChild(area);
  area.select();
  const copied = document.execCommand('copy');
  area.remove();
  if (focused instanceof HTMLElement) focused.focus();
  if (!copied) throw new Error('Copy failed');
}

/**
 * A copyable code block. `aligned` opts into the monospace family for blocks whose
 * columns are space-padded and would otherwise render ragged.
 */
export function CodeBlock({
  code,
  display,
  aligned = false,
  className,
}: {
  code: string;
  display?: string;
  aligned?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  // Whatever the reader has told the guide about their setup is substituted in here, so
  // Copy hands over a command that runs rather than one they still have to edit.
  const filled = useCommandFill(code, display === undefined);
  const hidden = display ?? filled.display;
  const hasSecret = hidden !== filled.copy;
  const shown = revealed ? filled.copy : hidden;

  const box = useRef<HTMLDivElement>(null);

  const copy = () => {
    if (!box.current) return;
    void copyText(filled.copy, box.current).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }, () => setCopied(false));
  };

  return (
    <div ref={box} className={cn('flex items-start gap-3 rounded-xl bg-muted px-4 py-2', className)}>
      <pre
        className={cn(
          'min-w-0 flex-1 overflow-x-auto whitespace-pre text-sm leading-5 text-foreground',
          aligned ? 'font-mono' : 'font-body',
        )}
      >
        {shown.split(/(<[^<>\s][^<>]*>)/g).map((part, i) =>
          /^<[^<>\s][^<>]*>$/.test(part) ? (
            <span key={i} className="rounded bg-warning/20 px-0.5 text-foreground">
              {part}
            </span>
          ) : (
            part
          ),
        )}
      </pre>
      <span className="flex shrink-0 items-center gap-3 pt-0.5">
        {/* Secrets are masked on screen but copied in full. */}
        {hasSecret && (
          <>
            <span aria-hidden className="h-6 w-[0.5px] bg-border" />
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              className="text-sm leading-5 text-foreground transition-opacity hover:opacity-80"
            >
              {revealed ? 'Hide' : 'Show'}
            </button>
          </>
        )}
        <span aria-hidden className="h-6 w-[0.5px] bg-border" />
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Copied' : 'Copy code'}
          className="inline-flex items-center gap-1 text-sm leading-5 text-foreground transition-opacity hover:opacity-80"
        >
          {copied ? 'Copied' : 'Copy'}
          {copied ? <LiCheckCircle className="h-3.5 w-3.5 text-success" /> : <LiCopy className="h-3.5 w-3.5" />}
        </button>
      </span>
    </div>
  );
}

export function CommandLegend({ code }: { code: string }) {
  const { filled, remaining } = useCommandFill(code);
  if (!filled.length && !remaining.length) return null;

  return (
    <div className="flex flex-col gap-1.5 text-xs leading-4">
      {filled.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 text-body-alt">
          Filled in from your setup:
          {filled.map((token) => (
            <Chip key={token}>{token}</Chip>
          ))}
        </p>
      )}
      {remaining.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 text-body-alt">
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-warning/40" />
          Replace before running:
          {remaining.map((token) => (
            <Chip key={token}>{token}</Chip>
          ))}
        </p>
      )}
    </div>
  );
}

/** One thing the reader needs, and everything needed to get it. */
interface PrereqItem {
  id: string;
  name: ReactNode;
  label?: string;
  requirement?: ReactNode;
  where?: { href: string; label: string; internal?: boolean };
  detail?: ReactNode;
  /** Already satisfied, so the row reports instead of asking. */
  met?: boolean;
  metNote?: string;
  /** The guide walks through this one further on, so the row points there instead of
   *  leaving the reader to go and solve it first. */
  coveredNext?: boolean;
}

const PREREQ_STORE = 'dmnd.guide.prereqs';

/** Readiness and step ticks. Stored locally: setting up a node spans days, not one sitting. */
export function useGuideTicks(key: string) {
  const [ticked, setTicked] = useState<string[]>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(`${PREREQ_STORE}.${key}`) ?? '[]') as string[];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(`${PREREQ_STORE}.${key}`, JSON.stringify(ticked));
    } catch {
      /* blocked storage just means it is not remembered */
    }
  }, [key, ticked]);

  const toggle = (id: string) =>
    setTicked((current) => (current.includes(id) ? current.filter((i) => i !== id) : [...current, id]));

  return { ticked, toggle };
}

function PrereqRow({
  item,
  complete,
  current,
  last,
  open,
  coveredNextHref,
  onToggle,
  onOpen,
}: {
  item: PrereqItem;
  coveredNextHref?: string;
  complete: boolean;
  current: boolean;
  last: boolean;
  open: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const name = (
    <span className={cn('min-w-0 flex-1 text-base leading-6', complete ? 'text-body-alt' : 'text-foreground')}>
      {item.name}
    </span>
  );

  return (
    <li className="flex items-start gap-3">
      <span className="flex shrink-0 flex-col items-center self-stretch">
        {item.met ? (
          <LiCheckCircle className="h-5 w-5 shrink-0 text-success" />
        ) : (
          <button
            type="button"
            role="checkbox"
            aria-checked={complete}
            aria-label={item.label ?? (typeof item.name === 'string' ? item.name : undefined)}
            onClick={onToggle}
            className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {complete ? (
              <LiCheckCircle className="h-5 w-5 text-success" />
            ) : (
              <span
                className={cn(
                  'block h-5 w-5 rounded-full border-2 transition-colors',
                  current ? 'border-foreground' : 'border-border hover:border-placeholder',
                )}
              />
            )}
          </button>
        )}
        {!last && <span className="w-0 flex-1 border-l-[0.5px] border-dashed border-border" />}
      </span>

      <span className={cn('flex min-w-0 flex-1 flex-col gap-2', !last && 'pb-5')}>
        <span className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
          {item.detail ? (
            <button
              type="button"
              onClick={onOpen}
              aria-expanded={open}
              className="group flex min-w-0 flex-1 items-start gap-1.5 text-left"
            >
              {name}
              <LiAltArrowDown
                className={cn(
                  'mt-1 h-4 w-4 shrink-0 text-placeholder transition-transform group-hover:text-foreground',
                  open && 'rotate-180',
                )}
              />
            </button>
          ) : (
            name
          )}

          <span className="flex items-center gap-3 sm:gap-4">
            {item.requirement && (
              <span className="shrink-0 rounded bg-background px-2 py-1 text-xs leading-4 text-body-alt">
                {item.requirement}
              </span>
            )}
            {(item.met || item.where) && (
              <span className="shrink-0 sm:w-[104px] sm:text-right">
                {item.met ? (
                  <span className="text-xs leading-4 text-placeholder">{item.metNote}</span>
                ) : item.where?.internal ? (
                  <Link
                    href={item.where.href}
                    className="text-sm leading-5 text-foreground underline underline-offset-4 hover:opacity-70"
                  >
                    {item.where.label}
                  </Link>
                ) : item.where ? (
                  <a
                    href={item.where.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm leading-5 text-foreground hover:opacity-70"
                  >
                    {item.where.label}
                    <OlArrowRightUp className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </span>
            )}
          </span>
        </span>

        {item.coveredNext && coveredNextHref && (
          <Link
            href={coveredNextHref}
            className="inline-flex w-fit items-center gap-1 text-xs leading-4 text-body-alt underline underline-offset-4 hover:text-foreground"
          >
            Covered in the next section
            <LiAltArrowRight className="h-3 w-3" />
          </Link>
        )}
        {item.detail && open && <span className="flex flex-col gap-3">{item.detail}</span>}
      </span>
    </li>
  );
}

function DocPrereqs({
  items,
  extra,
  extraLabel,
  ticked,
  onToggle,
  note,
  coveredNextHref,
  className,
}: {
  items: PrereqItem[];
  /** Requirements one guide adds on top of the shared ones. */
  extra?: PrereqItem[];
  extraLabel?: ReactNode;
  ticked: string[];
  onToggle: (id: string) => void;
  note?: ReactNode;
  /** Where rows marked `coveredNext` are dealt with. */
  coveredNextHref?: string;
  className?: string;
}) {
  const all = [...items, ...(extra ?? [])];
  const isDone = (item: PrereqItem) => item.met === true || ticked.includes(item.id);
  const done = all.filter(isDone).length;
  const currentId = all.find((item) => !isDone(item))?.id;

  // Opening is tracked as an override, so a reader's choice survives them ticking a row.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const isOpen = (item: PrereqItem) => overrides[item.id] ?? item.id === currentId;

  const rows = (group: PrereqItem[], lastOfAll: boolean) =>
    group.map((item, i) => (
      <PrereqRow
        key={item.id}
        item={item}
        complete={isDone(item)}
        current={item.id === currentId}
        last={lastOfAll && i === group.length - 1}
        open={isOpen(item)}
        coveredNextHref={coveredNextHref}
        onToggle={() => onToggle(item.id)}
        onOpen={() => setOverrides((o) => ({ ...o, [item.id]: !isOpen(item) }))}
      />
    ));

  const [open, setOpen] = useState(done < all.length);

  return (
    <div className={cn('flex w-full flex-col rounded-xl bg-muted px-4 py-3 sm:px-5', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group flex items-center gap-3 py-1 text-left"
      >
        <span className="flex-1 text-sm leading-5 text-foreground">
          {done}/{all.length} Complete
        </span>
        <span className="flex gap-[3px]">
          {all.map((item, i) => (
            <span key={item.id} className={cn('h-0.5 w-5 rounded', i < done ? 'bg-foreground' : 'bg-secondary')} />
          ))}
        </span>
        <LiAltArrowDown
          className={cn(
            'h-4 w-4 shrink-0 text-placeholder transition-transform group-hover:text-foreground',
            open && 'rotate-180',
          )}
        />
      </button>

      {!open ? null : (
      <div className="flex flex-col gap-3 border-t-[0.5px] border-border pt-4 mt-2">
      <ul>{rows(items, !extra?.length)}</ul>

      {extra?.length ? (
        <>
          {extraLabel && <p className="text-sm leading-5 text-foreground">{extraLabel}</p>}
          <ul>{rows(extra, true)}</ul>
        </>
      ) : null}

      {note && <p className="text-xs leading-4 text-body-alt">{note}</p>}
      </div>
      )}
    </div>
  );
}

const SV2_TP_README = 'https://github.com/stratum-mining/sv2-tp#readme';

const DMND_CLIENT_SETUP = 'https://github.com/dmnd-pool/dmnd-client#4-run-the-dmnd-client';

const DMND_CLIENT_RELEASES = 'https://github.com/dmnd-pool/dmnd-client/releases';

const MINER_CONNECTION = 'stratum+tcp://<dmnd-client-machine-ip>:32767';

const linkButton =
  'inline-flex w-fit items-center gap-1 rounded-xl bg-background px-4 py-2 text-sm leading-5 text-foreground transition-opacity hover:opacity-80';

function useStackPrereqs() {
  const { data: account } = useAccountProfile();
  const { ticked, toggle } = useGuideTicks('build-your-block');

  const items: PrereqItem[] = [
    {
      id: 'token',
      name: 'DMND token',
      met: Boolean(account?.token),
      metNote: 'On your account',
      where: { href: '/workers', label: 'Workers', internal: true },
    },
    {
      id: 'node-and-tp',
      name: 'Your node and Template Provider',
      requirement: <Chip>v31.0+</Chip>,
      detail: (
        <>
          <DocText>
            You add two components to your DMND Client setup:{' '}
            <strong className="font-medium text-foreground">Bitcoin Core</strong> with IPC enabled, and the{' '}
            <strong className="font-medium text-foreground">Stratum V2 Template Provider</strong> (<Chip>sv2-tp</Chip>).
            The Template Provider connects to Bitcoin Core through IPC and serves its templates to the DMND Client.
          </DocText>
          <a href={SV2_TP_README} target="_blank" rel="noopener noreferrer" className={linkButton}>
            Set up Bitcoin Core and sv2-tp
            <OlArrowRightUp className="h-3.5 w-3.5" />
          </a>
          <DocText>
            The Template Provider listens on port <Chip>8336</Chip> by default.
          </DocText>
          <DocCallout label="Verify" check>
            Bitcoin Core is fully synchronized, and the <Chip>sv2-tp</Chip> log shows a successful IPC connection and
            new templates as blocks arrive.
          </DocCallout>
        </>
      ),
    },
    {
      id: 'dmnd-client',
      name: 'DMND Client',
      where: { href: DMND_CLIENT_RELEASES, label: 'Releases' },
      detail: (
        <>
          <DocText>
            Run the DMND Client with your DMND token and the Template Provider address. It connects upstream to DMND,
            receives your local templates, and exposes a standard Stratum V1 endpoint for your ASICs.
          </DocText>
          <a href={DMND_CLIENT_SETUP} target="_blank" rel="noopener noreferrer" className={linkButton}>
            Continue with DMND Client setup
            <OlArrowRightUp className="h-3.5 w-3.5" />
          </a>
          <DocText>Once the client is healthy, point each ASIC at the machine running it:</DocText>
          <CodeBlock code={MINER_CONNECTION} />
          <DocList
            items={[
              'Replace <dmnd-client-machine-ip> with the client machine’s LAN IP.',
              'Use your DMND token as the miner password.',
              'Use any worker name, or leave the username empty.',
            ]}
          />
          <DocCallout label="Verify" check>
            The DMND Client log shows connections to both <Chip>sv2-tp</Chip> and DMND, with templates being declared.
            Your miners connect normally and begin submitting shares.
          </DocCallout>
        </>
      ),
    },
  ];

  const note = (
    <>
      Current <Chip>sv2-tp</Chip> releases require Bitcoin Core <Chip>v31.0+</Chip>; <Chip>sv2-tp v1.0.6</Chip> is the
      legacy release for Bitcoin Core <Chip>v30.2</Chip>.
    </>
  );

  return { items, ticked, toggle, note, ready: items.every((i) => i.met === true || ticked.includes(i.id)) };
}

export function StackSummary({ href }: { href: string }) {
  const stack = useStackPrereqs();
  const [open, setOpen] = useState(!stack.ready);
  const done = stack.items.filter((i) => i.met === true || stack.ticked.includes(i.id)).length;

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-muted px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        {stack.ready ? (
          <LiCheckCircle className="h-6 w-6 shrink-0 text-success" />
        ) : (
          <span className="h-6 w-6 shrink-0 rounded-full border-2 border-foreground" />
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="group flex min-w-0 flex-1 items-center gap-1.5 text-left text-base leading-6 text-foreground"
        >
          <span className="min-w-0">Build-your-block stack</span>
          <LiAltArrowDown
            className={cn(
              'h-4 w-4 shrink-0 text-placeholder transition-transform group-hover:text-foreground',
              open && 'rotate-180',
            )}
          />
        </button>
        <span className="shrink-0 text-sm leading-5 text-body-alt">
          {done}/{stack.items.length} Complete
        </span>
        <Link href={href} className="shrink-0 text-sm leading-5 text-foreground underline underline-offset-4 hover:opacity-70">
          Job Declaration
        </Link>
      </div>

      {open && (
        <div className="border-t-[0.5px] border-border pt-4">
          <DocPrereqs items={stack.items} ticked={stack.ticked} onToggle={stack.toggle} note={stack.note} />
        </div>
      )}
    </div>
  );
}

/** A readiness list a single guide owns, with its own ticks. */
export function GuidePrereqs({
  items,
  storageKey,
  note,
  coveredNextHref,
  className,
}: {
  items: PrereqItem[];
  storageKey: string;
  note?: ReactNode;
  coveredNextHref?: string;
  className?: string;
}) {
  const { ticked, toggle } = useGuideTicks(storageKey);
  return (
    <DocPrereqs
      items={items}
      ticked={ticked}
      onToggle={toggle}
      note={note}
      coveredNextHref={coveredNextHref}
      className={className}
    />
  );
}

/** Marks one step of a guide finished. Sits at the foot of the step it belongs to. */
export function StepDone({ done, onToggle }: { done: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={done}
      className={cn(
        'inline-flex w-fit items-center gap-2 rounded-lg border-[0.5px] px-3 py-2 text-sm leading-5 transition-colors',
        done ? 'border-success/40 bg-success/5 text-body-alt' : 'border-border text-foreground hover:bg-muted',
      )}
    >
      {done ? (
        <LiCheckCircle className="h-4 w-4 text-success" />
      ) : (
        <span className="h-4 w-4 rounded-[4px] border-[1.5px] border-placeholder" />
      )}
      {done ? 'Done' : 'Mark as done'}
    </button>
  );
}

/** A value the reader supplies once and every command on every guide picks up. */
interface SetupField {
  id: string;
  label: string;
  /** What it replaces in the command text. */
  token: string;
  hint?: string;
}

const SETUP_FIELDS: Record<string, SetupField> = {
  clientIp: {
    id: 'clientIp',
    label: 'DMND Client machine IP',
    token: '<dmnd-client-machine-ip>',
    hint: 'The LAN address your miners reach it on',
  },
  tpAddress: { id: 'tpAddress', label: 'Template Provider address', token: '127.0.0.1:8336' },
  rskAddress: { id: 'rskAddress', label: 'RSK reward address', token: '<your-RSK-address>' },
  rskRpcUrl: { id: 'rskRpcUrl', label: 'RskJ RPC URL', token: 'http://127.0.0.1:4444' },
  rpcUrl: { id: 'rpcUrl', label: 'Bitcoin Core RPC URL', token: 'http://127.0.0.1:8332' },
  rpcUser: { id: 'rpcUser', label: 'Bitcoin Core RPC user', token: '<bitcoin-rpc-user>' },
};

const SETUP_STORE = 'dmnd.guide.setup';

const SETUP_SEEN = 'dmnd.guide.setup.seen';

function loadSetupValues(): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(SETUP_STORE) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

let setupValues: Record<string, string> = loadSetupValues();

const setupListeners = new Set<() => void>();

function setSetupValue(id: string, value: string) {
  setupValues = { ...setupValues, [id]: value };
  try {
    const keep = Object.fromEntries(Object.entries(setupValues).filter(([, v]) => v !== ''));
    window.localStorage.setItem(SETUP_STORE, JSON.stringify(keep));
  } catch {
    /* blocked storage just means the values are not remembered */
  }
  setupListeners.forEach((l) => l());
}

function useSetupValues() {
  return useSyncExternalStore(
    (listener) => {
      setupListeners.add(listener);
      return () => setupListeners.delete(listener);
    },
    () => setupValues,
    () => setupValues,
  );
}

const MASK = '••••••••';

function useCommandFill(code: string, personalize = true) {
  const values = useSetupValues();
  const { data: account } = useAccountProfile();
  const token = account?.token ?? '';

  let display = code;
  let copy = code;
  const filled: string[] = [];

  const apply = (needle: string, value: string, secret: boolean) => {
    if (!personalize || !value || !code.includes(needle)) return;
    copy = copy.split(needle).join(value);
    display = display.split(needle).join(secret ? MASK : value);
    filled.push(needle);
  };

  // The pool token is never asked for: the dashboard already has it for this account.
  apply('<DMND-token>', token, true);
  for (const field of Object.values(SETUP_FIELDS)) {
    apply(field.token, values[field.id] ?? '', false);
  }

  // Whatever is still angle-bracketed is still the reader's to supply.
  const remaining = [...new Set(display.match(/<[^<>\s][^<>]*>/g) ?? [])];

  return { display, copy, filled, remaining };
}

function SetupDrawer({ onClose }: { onClose: () => void }) {
  const values = useSetupValues();
  const { data: account } = useAccountProfile();
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[8px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Your details"
        className="relative flex h-full w-full max-w-md flex-col gap-5 overflow-y-auto bg-background p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold leading-7 text-foreground">Your details</p>
            <p className="text-sm leading-5 text-body-alt">Commands across these guides fill in with these values.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-body-alt transition-colors hover:text-foreground"
          >
            <LiCloseCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase leading-4 tracking-wider text-placeholder">DMND token</span>
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-sm leading-5 text-body-alt">
              {account?.token ? (reveal ? account.token : MASK) : 'Not available'}
            </span>
            {account?.token && (
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                className="shrink-0 text-sm leading-5 text-foreground underline underline-offset-4 hover:opacity-70"
              >
                {reveal ? 'Hide' : 'Show'}
              </button>
            )}
          </div>
          <p className="text-xs leading-4 text-placeholder">From your account. You never type it.</p>
        </div>

        {Object.values(SETUP_FIELDS).map((field) => (
          <div key={field.id} className="flex flex-col gap-1.5">
            <label
              htmlFor={`setup-${field.id}`}
              className="text-xs font-medium uppercase leading-4 tracking-wider text-placeholder"
            >
              {field.label}
            </label>
            <input
              id={`setup-${field.id}`}
              type="text"
              value={values[field.id] ?? ''}
              placeholder={field.token}
              onChange={(e) => setSetupValue(field.id, e.target.value)}
              className="rounded-lg border-[0.5px] border-border bg-card px-3 py-2 text-sm leading-5 text-foreground placeholder:text-placeholder focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {field.hint && <p className="text-xs leading-4 text-placeholder">{field.hint}</p>}
          </div>
        ))}

        <p className="text-xs leading-4 text-body-alt">
          Anything left blank keeps its placeholder in the commands. Passwords and API secrets are never asked for —
          replace those yourself before running. Values stay in this browser.
        </p>
      </div>
    </div>
  );
}
