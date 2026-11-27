import { useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, ArrowRight, Bitcoin, Blocks, Check, ChevronRight, Download, Eye, EyeOff, Layers, Monitor, RotateCcw, Server, Settings2, ShieldCheck, Undo2, X, type LucideIcon } from 'lucide-react';
import { Button as BaseButton, type ButtonProps } from '@/components/ui/button';
import { CodeBlock } from '@/components/docs/DocGuide';
import { DocText } from '@/components/docs/DocPrimitives';
import { useAccountProfile } from '@/hooks/useAccountData';
import { useActiveAccountId } from '@/hooks/useActiveAccountId';
import { useConnectionAccount } from '@/components/workers/ConnectionDetails';
import { cn } from '@/lib/utils';
import {
  DEFAULT_SETUP, PLATFORMS, SETUP_STEPS, SETUP_STEP, bridgeCommand, buildsFromSource, clientBuild, clientCommand, clientRelease,
  maskSecrets, minerConnection, nextSetupStep, requiredCredentialStep, restoreSetup,
  rskCommand, templateAddress, updateSetup, usesDockerDesktop, validClientPorts, validDifficulty, validHashrate, validMinerName, validRewardAddress, validTpAddress,
  type SetupAnswers, type SetupProgress, type SetupSecrets,
} from '@/lib/blockSetup';

const TP_DOCS = 'https://github.com/stratum-mining/sv2-tp#readme';
const BRIDGE_REPO = 'https://github.com/dmnd-pool/demand-rsk-op-return-bridge';
const inputClass = 'h-11 w-full min-w-0 rounded-xl border border-transparent bg-muted px-3.5 text-sm text-foreground placeholder:text-placeholder focus-visible:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const STEP_DESCRIPTIONS = ['What you’ll be running', 'Install your Bitcoin node', 'Serve your own templates', 'Choose your transactions', 'Add Rootstock rewards', 'Connect to the DMND pool', 'Put your hardware to work'];
const STEP_TITLES = ['Build your own blocks.', 'First, your Bitcoin node.', 'Template provider.', 'Prioritize transactions.', 'Merged mining.', 'Let’s connect it all.', 'Bring your miners online.'];
const LAST_STEP = SETUP_STEPS.length - 1;

const NO_SECRETS: SetupSecrets = { token: '', rpcPassword: '', txToken: '', mergeSecret: '' };

function generateSecret() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function Button({ variant, className, ...props }: ButtonProps) {
  return <BaseButton type="button" {...props} variant={variant} className={cn('h-10 rounded-full px-5 text-sm', !variant && '!bg-btn !text-btn-foreground hover:!bg-btn/90', className)} />;
}

/** `error: true` marks the field wrong and shows its hint, in red, as the reason. */
function Field({ label, hint, value, onChange, secret = false, placeholder, error, required = false, readOnly, onGenerate }: {
  label: string; hint?: string; value: string; onChange: (value: string) => void;
  secret?: boolean; placeholder?: string; error?: string | boolean; required?: boolean; readOnly?: boolean; onGenerate?: () => void;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const [left, setLeft] = useState(false);
  // Wait until the reader leaves the field before calling a half-typed value wrong.
  const reason = error && (left || !focused) ? (error === true ? hint : error) : undefined;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-heading">{label}{required && <span className="ml-1 text-body-alt">*</span>}</label>
        {onGenerate && <button type="button" className="shrink-0 text-xs text-foreground underline underline-offset-4 hover:opacity-70" onClick={onGenerate}>{value ? 'Generate new' : 'Generate'}</button>}
      </div>
      <div className="relative">
        <input id={id} className={cn(inputClass, secret && 'pr-12')} value={value} placeholder={placeholder}
          type={secret && !visible ? 'password' : 'text'} autoComplete="off" spellCheck={false} required={required} readOnly={readOnly}
          aria-invalid={!!reason} aria-describedby={hint || reason ? `${id}-hint` : undefined}
          onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); setLeft(true); }}
          onChange={(event) => onChange(event.target.value)} />
        {secret && <button type="button" aria-label={`${visible ? 'Hide' : 'Show'} ${label}`} aria-pressed={visible} aria-controls={id}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-body-alt hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setVisible((previous) => !previous)}>{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>}
      </div>
      {(hint || reason) && <p id={`${id}-hint`} className={cn('text-xs leading-5', reason ? 'text-destructive-text' : 'text-body-alt')}>{reason || hint}</p>}
    </div>
  );
}

/** Collapsible settings. Like each Field's, its error waits while the reader is typing in it. */
function SettingsGroup({ error, children }: { error?: string | false; children: ReactNode }) {
  const [typing, setTyping] = useState(false);
  return <>
    <details className="rounded-xl border border-border p-4"
      onFocus={(event) => setTyping(event.target.matches('input[type="text"]'))}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setTyping(false); }}>
      {children}
    </details>
    {error && !typing && <p role="alert" className="text-sm text-destructive-text">{error}</p>}
  </>;
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="w-fit text-sm text-foreground underline underline-offset-4 hover:opacity-70">{children} ↗</a>;
}

function SetupCard({ href, title, description, icon: Icon = Download, onClick }: {
  href?: string; title: string; description: string; icon?: LucideIcon; onClick?: () => void;
}) {
  const Tag = href ? 'a' : 'button';
  return <Tag href={href} target={href ? '_blank' : undefined} rel={href ? 'noopener noreferrer' : undefined}
    type={href ? undefined : 'button'} onClick={onClick}
    className={cn('group flex items-center gap-4 rounded-2xl border border-border/70', href ? 'p-4' : 'bg-background p-5 text-left', 'transition-colors hover:border-foreground/40 hover:bg-muted/60', !href && 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}>
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted"><Icon className={cn('h-5 w-5', !href && 'text-foreground')} strokeWidth={1.5} /></span>
    <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-heading">{title}{href && ' ↗'}</span><span className="mt-1 block text-xs leading-5 text-body-alt">{description}</span></span>
    {!href && <ChevronRight className="h-4 w-4 shrink-0 text-placeholder transition-transform group-hover:translate-x-0.5" />}
  </Tag>;
}

function Choice({ label, onYes, onNo }: { label: string; onYes: () => void; onNo: () => void }) {
  return <fieldset className="flex flex-col gap-3">
    <legend className="mb-4 text-base font-medium text-heading">{label}</legend>
    <div className="grid gap-3">
      <SetupCard title="Yes, it’s ready" description="I have it running. Continue to the next step." icon={Check} onClick={onYes} />
      <SetupCard title="No, help me set it up" description="Show me how to download, install, and start it." onClick={onNo} />
    </div>
  </fieldset>;
}

function Instruction({ number, title, children }: { number?: number; title: string; children: ReactNode }) {
  const content = <><h4 className="text-sm font-semibold text-heading">{title}</h4>{children}</>;
  if (number === undefined) return <div className="flex min-w-0 flex-col gap-3">{content}</div>;
  return <li className="flex min-w-0 gap-3 sm:gap-4">
    <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-heading">{number}</span>
    <div className="flex min-w-0 flex-1 flex-col gap-3 pt-0.5">{content}</div>
  </li>;
}

/** Keep progress tied to the selected account; switching accounts remounts the saved setup. */
export function BuildYourBlockSetup() {
  const accountId = useActiveAccountId();
  return <SetupWizard key={accountId ?? 'anonymous'} storageKey={`dmnd.block-setup.v1.${accountId ?? 'anonymous'}`} />;
}

function SetupWizard({ storageKey }: { storageKey: string }) {
  const { data: account } = useAccountProfile();
  const { currentName } = useConnectionAccount();
  const [progress, setProgress] = useState(() => {
    try { return restoreSetup(localStorage.getItem(storageKey)); } catch { return restoreSetup(null); }
  });
  const [privateValues, setPrivateValues] = useState<SetupSecrets>(NO_SECRETS);
  // "Start afresh" can be undone until the reader changes anything in the fresh setup.
  const [beforeReset, setBeforeReset] = useState<{ progress: SetupProgress; privateValues: SetupSecrets; fresh: SetupProgress } | null>(null);
  const [open, setOpen] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { answers, status, current } = progress;
  const docker = answers.method === 'docker';
  const desktop = usesDockerDesktop(answers);
  const secrets = { ...privateValues, token: account?.token || privateValues.token };
  const shownSecrets = maskSecrets(secrets);
  // Credentials are never saved, so after a reload they can be missing from a finished setup.
  // Its commands then show placeholders, and only the client step asks for them again.
  const credentialStep = requiredCredentialStep(answers, secrets);
  const completed = Object.values(status).filter((value) => value === 'done').length;
  const skipped = Object.values(status).filter((value) => value === 'skipped').length;
  const percent = ((completed + skipped) / SETUP_STEPS.length) * 100;
  const reachable = nextSetupStep(status);
  const install = current === SETUP_STEP.core || current === SETUP_STEP.tp;
  const setupKey = current === SETUP_STEP.core ? 'coreSetup' : 'tpSetup';
  const showInstallation = install && answers[setupKey] === 'no';
  const done = status[LAST_STEP] === 'done';
  const optionalStep = current === SETUP_STEP.transactions || current === SETUP_STEP.merge;
  const canUndoReset = beforeReset?.fresh === progress && privateValues === NO_SECRETS;

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(progress)); setStorageFailed(false); }
    catch { setStorageFailed(true); }
  }, [progress, storageKey]);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    scrollArea.current?.scrollTo({ top: 0 });
  }, [current]);

  // The browser's modal dialog keeps focus inside, makes the page behind inert, and closes on Escape.
  useEffect(() => {
    if (!open || !dialog.current) return;
    if (!dialog.current.open) dialog.current.showModal();
    heading.current?.focus({ preventScroll: true });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, [open]);
  const close = () => dialog.current?.close();

  const change = (patch: Partial<SetupAnswers>) => setProgress((previous) => updateSetup(previous, patch));
  const advance = (result: 'done' | 'skipped', patch: Partial<SetupAnswers> = {}) => {
    setProgress((previous) => updateSetup(previous, patch, result));
    // Leaving the last step, either way, ends the setup.
    if (current === LAST_STEP) close();
  };
  // Opening the step already shown changes nothing, so "Start afresh" stays undoable.
  const goTo = (step: number) => setProgress((previous) => previous.current === step ? previous : { ...previous, current: step });
  const setSecret = (key: keyof SetupSecrets, value: string) => setPrivateValues((previous) => ({ ...previous, [key]: value }));
  const resetSetup = () => {
    const fresh = restoreSetup(null);
    setBeforeReset({ progress, privateValues, fresh });
    setPrivateValues(NO_SECRETS);
    setProgress(fresh);
  };
  const undoReset = () => {
    if (!beforeReset) return;
    setProgress(beforeReset.progress);
    setPrivateValues(beforeReset.privateValues);
    setBeforeReset(null);
  };
  const field = (key: keyof SetupAnswers | keyof SetupSecrets, label: string, options: Omit<ComponentProps<typeof Field>, 'label' | 'value' | 'onChange'> = {}) => {
    const secret = key in privateValues;
    return <Field label={label} value={String(secret ? privateValues[key as keyof SetupSecrets] : answers[key as keyof SetupAnswers])}
      onChange={(value) => secret ? setSecret(key as keyof SetupSecrets, value) : change({ [key]: value })}
      secret={secret} required={secret} {...options} />;
  };
  // Each command is built twice: with the secrets to copy, and with them hidden to show.
  const code = (command: string | ((answers: SetupAnswers, values: SetupSecrets) => string)) => (
    <CodeBlock code={typeof command === 'string' ? command : command(answers, secrets)}
      display={typeof command === 'string' ? command : command(answers, shownSecrets)} aligned />
  );
  const enableOrSkip = (label: string, key: 'txEnabled' | 'mergeEnabled') => <div className="flex flex-wrap gap-3">
    <Button onClick={() => change({ [key]: true })}>{label}</Button>
    <Button variant="outline" onClick={() => advance('skipped', { [key]: false })}>Skip this feature</Button>
  </div>;

  const validEndpoint = (value: string) => {
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; }
    catch { return false; }
  };
  const tpAddressValid = validTpAddress(templateAddress(answers));
  const portsValid = validClientPorts(answers);
  const difficultyValid = validDifficulty(answers.minDifficulty);
  const advancedValid = portsValid && validHashrate(answers.hashrate) && difficultyValid && validMinerName(answers.minerName);
  const rewardAddressError = !!answers.rewardAddress.trim() && !validRewardAddress(answers.rewardAddress) && 'Use 0x and 40 characters (0–9, a–f).';
  const ready = current === SETUP_STEP.introduction || showInstallation
    || (current === SETUP_STEP.client && advancedValid && tpAddressValid && !!secrets.token && !!secrets.txToken && credentialStep === null)
    || (current === SETUP_STEP.miners && !!answers.clientIp.trim())
    || (current === SETUP_STEP.transactions && answers.txEnabled && !!answers.rpcUser.trim() && !!secrets.rpcPassword && validEndpoint(answers.rpcUrl))
    || (current === SETUP_STEP.merge && answers.mergeEnabled && validRewardAddress(answers.rewardAddress) && !!secrets.mergeSecret && validEndpoint(answers.rskRpcUrl));

  // What the client command is built from: where the templates come from, and the pool token.
  const clientInputs = <>
    {answers.tpSetup === 'no' ? <p className="text-xs text-body-alt">Template Provider: {templateAddress(answers)}</p>
      : field('tpAddress', 'Template Provider address', { hint: 'The address of the sv2-tp instance you’re running.', placeholder: '127.0.0.1:8336, or -sv2port', required: true, error: !tpAddressValid })}
    {account?.token ? <p className="text-sm leading-6 text-body-alt">Your mining token is filled in automatically for <span className="font-medium text-heading">{currentName}</span>.</p>
      : field('token', 'DMND mining token', { hint: 'Use the token from your DMND account. It is not saved in the wizard.' })}
    {field('txToken', 'Dashboard access token', { hint: 'Protects access to your local dashboard. Choose a value or select Generate.', placeholder: 'Choose a token or select Generate', onGenerate: () => setSecret('txToken', generateSecret()) })}
  </>;
  const advancedSettings = (
    <SettingsGroup error={!advancedValid && 'Use different valid ports (1–65535), a positive minimum difficulty, a hashrate such as 100T or 250T, and a miner name of at most 10 bytes.'}>
      <summary className="cursor-pointer text-sm font-medium text-heading"><Settings2 className="mr-2 inline h-4 w-4 text-body-alt" />Advanced settings <span className="font-normal text-body-alt">· optional</span></summary>
      <div className="mt-4 flex flex-col gap-5">
        {field('hashrate', 'Starting hashrate', { hint: 'Optional. Default: 100T. Use the least powerful connected miner’s hashrate, such as 250T. Sets -d; DOWNSTREAM_HASHRATE accepts a number in H/s.', placeholder: '100T (client default)', error: !validHashrate(answers.hashrate) })}
        <div className="grid gap-4 sm:grid-cols-2">
          {field('minerPort', 'Miner port · LISTENING_ADDR', { hint: 'Default: 32767. The client listens on 0.0.0.0 at this port.', error: !portsValid })}
          {field('apiPort', 'Dashboard port · API_SERVER_PORT', { hint: 'Default: 3001. Used by optional features too.', error: !portsValid })}
          {field('minerName', 'Miner name · MINER_NAME', { hint: 'Default: unset. Optional name in the coinbase tag. Maximum 10 bytes.', error: !validMinerName(answers.minerName) })}
          {field('tagPrefix', 'Coinbase prefix · TAG_PREFIX', { hint: 'Fixed by DMND Client: /DMND/.', readOnly: true })}
          {field('minDifficulty', 'Minimum difficulty · DOWNSTREAM_MIN_DIFFICULTY', { hint: 'Default: 131072.', error: !difficultyValid })}
          <label className="flex flex-col gap-1.5 text-sm font-medium text-heading">Logging · LOGLEVEL
            <select className={inputClass} value={answers.loglevel} onChange={(event) => change({ loglevel: event.target.value })}>
              {['error', 'warn', 'info', 'debug', 'trace'].map((level) => <option key={level}>{level}</option>)}
            </select><span className="text-xs font-normal text-body-alt">Default: info.</span>
          </label>
        </div>
        {([
          ['headful', 'Open local dashboard · HEADFUL', 'Default: true for the binary. Docker uses false; open the dashboard yourself.'],
          ['autoUpdate', 'Automatic updates · AUTO_UPDATE', 'Default: true for the binary. Docker uses false; update the container image instead.'],
          ['shareLog', 'Log shares · SHARE_LOG', 'Default: false.'],
        ] as const).map(([key, label, hint]) => {
          const locked = (key === 'headful' && docker) || (key === 'autoUpdate' && (docker || buildsFromSource(answers.platform)));
          return <label key={key} className="flex items-start gap-3 text-sm text-heading">
            <input type="checkbox" className="mt-1 accent-current" checked={locked ? false : answers[key]}
              disabled={locked} onChange={(event) => change({ [key]: event.target.checked })} />
            <span>{label}<span className="mt-1 block text-xs text-body-alt">{hint}</span>
              {locked && answers.method === 'binary' && <span className="mt-1 block text-xs text-body-alt">Off when you build from source. Updates would install a release binary that can’t run on this computer.</span>}
            </span>
          </label>;
        })}
        <p className="text-xs leading-5 text-body-alt">{desktop
          ? 'Docker Desktop publishes the dashboard only on 127.0.0.1 on your Mac. Leave API_BIND_ADDRESS unset so Docker can reach the client inside the container.'
          : 'This guide sets API_BIND_ADDRESS to 127.0.0.1 so the local dashboard and control API stay on this computer.'}</p>
        <p className="text-xs leading-5 text-body-alt">An existing config.toml overrides environment variables. Update or remove conflicting values there.</p>
        {docker && <div className="flex flex-col gap-3 text-xs leading-5 text-body-alt">
          <h4 className="text-sm font-medium text-heading">Docker files and updates</h4>
          <p>The client runs as user ID 1000 in /home/dmnd. To use a config.toml, add this option before the image name. A file at another path is silently ignored.</p>
          {code('-v "$PWD/config.toml:/home/dmnd/config.toml:ro"')}
          <p>With FILE_LOGGING=true, logs go to /home/dmnd/logs. To keep them, also add these options and make the host folder writable by user ID 1000.</p>
          {code('-e FILE_LOGGING=true -v "$PWD/logs:/home/dmnd/logs"')}
          <p>Keep headful = false and auto_update = false in any config.toml. To update, pull a new image tag and recreate the container. If a container named dmnd-client already exists, stop and remove it before running the command again.</p>
          <p>To build the image yourself, run this in the DMND Client repository, then replace dmndcorp/dmnd-client:latest in the run command with dmnd-client.</p>
          {code('docker build -t dmnd-client .')}
        </div>}
        <ExternalLink href="https://github.com/dmnd-pool/dmnd-client#configuration-precedence">All client settings and configuration precedence</ExternalLink>
      </div>
    </SettingsGroup>
  );

  const content = () => {
    if (install) {
      const isCore = current === SETUP_STEP.core;
      const name = isCore ? 'Bitcoin Core' : 'sv2-tp';
      if (!showInstallation) return <>
        <DocText>{isCore ? 'You’ll need a synchronized Bitcoin node with IPC enabled.' : 'sv2-tp connects your Bitcoin node to DMND Client.'}</DocText>
        <Choice label={`Do you already have ${name} set up?`} onYes={() => advance('done', { [setupKey]: 'yes' })} onNo={() => change({ [setupKey]: 'no' })} />
        <ExternalLink href={TP_DOCS}>Check compatible versions and IPC requirements</ExternalLink>
      </>;
      return <>
        <button type="button" className="w-fit text-xs text-body-alt underline underline-offset-4" onClick={() => change({ [setupKey]: null })}>Change my answer</button>
        <ol className="flex flex-col gap-7">
          <Instruction number={1} title={`Download and install ${name}`}>
            <SetupCard href={isCore ? 'https://bitcoincore.org/en/download/' : TP_DOCS} title={`${name} installation guide`}
              description={isCore ? 'Use the command-line binaries for Core v31 or v32.' : 'Install sv2-tp v1.1.3 on the same computer as Bitcoin Core.'} />
          </Instruction>
          <Instruction number={2} title={`Start ${name}`}>
            <DocText>{isCore ? 'Open a terminal in Bitcoin Core’s bin folder and run:' : 'Keep Core running. Open another terminal in sv2-tp’s bin folder and run:'}</DocText>
            {/* The sv2-tp README's Usage commands. */}
            {code(isCore ? './bitcoin -m node -ipcbind=unix' : './sv2-tp -debug=sv2 -loglevel=sv2:trace')}
          </Instruction>
          <Instruction number={3} title={isCore ? 'Wait for the node to sync' : 'Check it is connected'}>
            {isCore ? <>
              <DocText>Leave Core running. In another terminal in the same bin folder, check:</DocText>
              {code('./bitcoin-cli getblockchaininfo')}
              <p className="text-sm leading-6 text-body-alt">Continue when <code>initialblockdownload</code> is <code>false</code>.</p>
            </> : <DocText>Continue when the log shows a successful IPC connection and new templates. Leave both programs running.</DocText>}
          </Instruction>
        </ol>
      </>;
    }
    switch (current) {
      case SETUP_STEP.introduction: return <>
        <p className="text-sm leading-6 text-body-alt">Run your own Bitcoin node, build your own templates, and mine with DMND. We’ll walk you through each part. If you are on Windows, run the tools and commands inside Linux / WSL.</p>
        <div className="grid grid-cols-3 gap-2 py-2" role="group" aria-label="The three parts of your setup">
          {[
            { name: 'Bitcoin Core', sub: 'Your node', icon: Bitcoin },
            { name: 'sv2-tp', sub: 'Your templates', icon: Layers },
            { name: 'DMND Client', sub: 'Your pool connection', icon: Server },
          ].map(({ name, sub, icon: Icon }) => <div key={name} className="flex flex-col items-start gap-5 rounded-2xl bg-muted/80 p-4">
            <Icon className="h-6 w-6 text-foreground" strokeWidth={1.3} /><div><p className="text-xs font-medium text-heading sm:text-sm">{name}</p><p className="mt-1 text-[11px] leading-4 text-body-alt">{sub}</p></div>
          </div>)}
        </div>
      </>;
      case SETUP_STEP.client: return <>
        <DocText>Start the client after your Bitcoin node and Template Provider are running.</DocText>
        {credentialStep !== null && <p className="text-sm leading-6 text-body-alt">Passwords and tokens aren’t saved between visits.{' '}
          <button type="button" className="text-foreground underline underline-offset-4 hover:opacity-70" onClick={() => goTo(credentialStep)}>Enter them again in {SETUP_STEPS[credentialStep]}</button></p>}
        <ol className="flex flex-col gap-7">
          <Instruction number={1} title="Which computer will run your setup?">
            <label className="flex items-center gap-2"><Monitor className="h-4 w-4 shrink-0 text-body-alt" /><span className="sr-only">Which computer will run your setup?</span>
              <select className={inputClass} value={answers.platform} onChange={(event) => change({ platform: event.target.value as SetupAnswers['platform'] })}>
                {Object.entries(PLATFORMS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            {answers.platform.startsWith('windows') && <div role="note" className="rounded-xl border border-info/30 bg-info/5 p-4 text-base leading-6 text-heading">
              <p className="font-semibold">Run every command inside WSL</p>
              <p className="mt-1 text-sm text-body-alt">Open your Linux distribution’s terminal in WSL for all installation and setup steps.{docker && ' Install Docker Engine inside WSL. Docker Desktop for Windows is not tested.'}</p>
            </div>}
          </Instruction>
          <Instruction number={2} title="Configure your client">
            <DocText>These details fill in your start command automatically. Advanced settings are optional; the defaults work for a typical setup.</DocText>
            {clientInputs}
            {advancedSettings}
          </Instruction>
          <Instruction number={3} title="How would you like to run the client?">
            <fieldset><legend className="sr-only">How would you like to run the client?</legend>
              <div className="flex flex-wrap gap-3">{(['binary', 'docker'] as const).map((method) => <label key={method} className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-3 text-sm', answers.method === method ? 'border-info bg-info/5 text-heading' : 'border-border text-body-alt')}>
                <input type="radio" name="client-install-method" value={method} checked={answers.method === method} onChange={() => change({ method })} />{method === 'binary' ? 'Binary' : 'Docker'}</label>)}</div>
            </fieldset>
            <div className="mt-2 flex flex-col gap-7">
              <Instruction title={docker ? 'Install Docker' : buildsFromSource(answers.platform) ? 'Build DMND Client for your computer' : 'Download DMND Client'}>
                {docker ? <>
                  <SetupCard href={desktop ? 'https://docs.docker.com/desktop/setup/install/mac-install/' : 'https://docs.docker.com/engine/install/'}
                    title={desktop ? 'Install Docker Desktop for Mac' : 'Install Docker Engine'}
                    description="The dmndcorp/dmnd-client:latest image contains the newest release. Docker downloads it when you run the command below." />
                </> : buildsFromSource(answers.platform) ? <>
                  <DocText>Install Git and Rust first, then run this command:</DocText>
                  {code(clientBuild())}
                </> : <SetupCard href={clientRelease(answers.platform)} title={clientRelease(answers.platform).split('/').pop() ?? 'dmnd-client'}
                  description="Save the binary as dmnd-client. Then run the command below from that folder." />}
              </Instruction>
              <Instruction title="Start DMND Client">
                {ready ? <>
                  <DocText>{docker ? 'With Docker running, copy this command into your terminal:' : 'Open a terminal in the folder containing dmnd-client, then copy and run this command:'}</DocText>
                  {code(clientCommand)}
                </> : <p role="status" className="text-sm leading-6 text-body-alt">Complete your setup details to generate the start command.</p>}
              </Instruction>
            </div>
          </Instruction>
          <Instruction number={4} title="Check it is connected">
            {docker && code('docker logs -f dmnd-client')}
            {docker || answers.headful ? <>
              <DocText>{docker ? 'Open the dashboard in your browser' : 'When the client starts, its dashboard opens in your browser'} at http://127.0.0.1:{answers.apiPort}. Use it to check the client is connected and declaring templates.</DocText>
              <p className="text-xs leading-5 text-body-alt">No screen on this computer? From your laptop, run <code className="break-all">ssh -L {answers.apiPort}:127.0.0.1:{answers.apiPort} you@&lt;node-computer&gt;</code>, then open http://127.0.0.1:{answers.apiPort}.</p>
            </> : <DocText>Continue once the client declares templates.</DocText>}
          </Instruction>
          {answers.mergeEnabled && <Instruction number={5} title="Once the client is running, start the bridge">
            <SetupCard href={`${BRIDGE_REPO}#build-and-run`} title="Install the merge-mining bridge" description="Follow the build instructions, then run this from the bridge’s folder in another terminal." />
            {code(bridgeCommand)}
            <p className="text-xs leading-5 text-body-alt">Continue once the bridge reports an accepted RSK payload.</p>
          </Instruction>}
        </ol>
      </>;
      case SETUP_STEP.miners: return <>
        <DocText>Open your ASIC’s pool settings. Use the LAN address of the computer running DMND Client.</DocText>
        {field('clientIp', 'DMND Client computer’s LAN IP', { hint: 'For example, 192.168.1.50. This is the address your miners can reach.', placeholder: '192.168.1.50', required: true })}
        <Instruction title="Pool URL">{code(minerConnection(answers))}</Instruction>
        <Instruction title="Password">{code((_, values) => values.token || '<DMND-token>')}</Instruction>
        <DocText>Use any worker name as the username, or leave it empty. Save the ASIC settings, then check that the client receives shares and your workers appear on the dashboard.</DocText>
        <Link href="/workers" className="w-fit text-sm underline underline-offset-4">Open Workers</Link>
      </>;
      case SETUP_STEP.transactions: return <>
        <DocText>Give selected transactions a higher priority in your block templates.</DocText>
        {!answers.txEnabled ? enableOrSkip('Enable transaction prioritization', 'txEnabled') : <>
          <ol className="flex flex-col gap-7">
            <Instruction number={1} title="Connect to Bitcoin Core RPC">
              <ExternalLink href="https://github.com/bitcoin/bitcoin/blob/v31.1/doc/JSON-RPC-interface.md#security">Official Bitcoin Core RPC setup guide</ExternalLink>
              {field('rpcUrl', 'Bitcoin Core RPC URL', { hint: 'Your node’s RPC_URL endpoint.', required: true, error: !validEndpoint(answers.rpcUrl) && `Use a full URL, like ${DEFAULT_SETUP.rpcUrl}.` })}
              {field('rpcUser', 'RPC username', { hint: 'Use the RPC username configured on your node.', required: true })}
              {field('rpcPassword', 'RPC password', { hint: 'Use the RPC password configured on your node.' })}
            </Instruction>
          </ol>
          <p className="text-xs leading-5 text-body-alt">Starting the client resets this node’s existing fee boosts. Don’t manually prioritize transactions managed by the mempool.space feed.</p>
          <ExternalLink href="https://github.com/dmnd-pool/dmnd-client#7-prioritize-transactions-optional">Transaction prioritization guide</ExternalLink>
        </>}
      </>;
      case SETUP_STEP.merge: return <>
        <DocText>Want to add Rootstock rewards? You’ll need an RskJ node and a reward address.</DocText>
        {!answers.mergeEnabled ? enableOrSkip('Enable merge mining', 'mergeEnabled') : <>
          <ol className="flex flex-col gap-7">
            <Instruction number={1} title="Install RskJ">
              <SetupCard href="https://dev.rootstock.io/node-operators/" title="RskJ installation guide" description="Install Java 17 and RskJ VETIVER 9.0.3 on the client computer." />
              <ExternalLink href="https://github.com/rsksmart/rskj/releases/tag/VETIVER-9.0.3">Download the RskJ JAR</ExternalLink>
            </Instruction>
            <Instruction number={2} title="Set your reward address and RPC URL">
              {field('rewardAddress', 'Rootstock reward address', { hint: 'An address you control for receiving rBTC rewards.', placeholder: '0x…', required: true, error: rewardAddressError })}
              {field('rskRpcUrl', 'RskJ RPC URL', { hint: 'RSK_RPC_URL · Default: http://127.0.0.1:4444. Keep RPC private.', required: true, error: !validEndpoint(answers.rskRpcUrl) })}
            </Instruction>
            <Instruction number={3} title="Start RskJ and wait for sync">
              <DocText>From the folder containing the downloaded JAR, run:</DocText>
              {code(rskCommand(answers))}
              <DocText>Leave RskJ running and wait for the mainnet sync to finish.</DocText>
            </Instruction>
            <Instruction number={4} title="Set a merge-mining API secret">
              {field('mergeSecret', 'Merge-mining shared secret', { onGenerate: () => setSecret('mergeSecret', generateSecret()), hint: 'Authenticates the bridge with your client so it can send merge-mining work.' })}
            </Instruction>
          </ol>
        </>}
      </>;
      default: return null;
    }
  };

  return <>
    <section aria-label="Guided mining setup" className="flex flex-col gap-5 rounded-2xl border-[0.5px] border-border bg-muted/50 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-[0.5px] border-border bg-background"><Blocks className="h-6 w-6 text-heading" strokeWidth={1.3} /></span>
      <div className="min-w-0 flex-1"><h2 className="font-heading text-lg font-semibold tracking-[-0.4px] text-heading">Quick Set up</h2><p className="mt-1 text-sm leading-6 text-body-alt">A step-by-step guide to setting up Job Declaration with DMND.</p></div>
      <Button className="w-fit shrink-0" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {done ? 'Review setup' : completed + skipped > 0 ? 'Continue setup' : 'Start setup'}<ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </section>
    {open && <dialog ref={dialog} aria-labelledby={titleId} onClose={() => setOpen(false)}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none items-center justify-center bg-transparent p-0 text-foreground backdrop:bg-transparent open:flex sm:p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[8px]" onClick={close} aria-hidden />
      <div className="relative flex h-[100dvh] w-full max-w-[980px] overflow-hidden bg-background shadow-[0_24px_80px_-12px_rgba(0,0,0,0.3)] sm:h-[min(760px,calc(100dvh-3rem))] sm:rounded-[24px]">
        <aside className="hidden w-[230px] shrink-0 flex-col border-r-[0.5px] border-border bg-muted/60 p-6 md:flex">
          <div className="mb-8 flex items-center gap-2.5"><Blocks className="h-5 w-5 text-heading" strokeWidth={1.5} /><span className="text-sm font-semibold text-heading">Your mining setup</span></div>
          <nav aria-label="Setup steps" className="flex-1">
            <ol>{SETUP_STEPS.map((name, index) => <li key={name} className="relative">
              {index !== LAST_STEP && <span aria-hidden className="absolute left-[13px] top-8 h-7 border-l border-dashed border-border" />}
              <button type="button" disabled={index > reachable} aria-current={current === index ? 'step' : undefined} onClick={() => goTo(index)}
                className={cn('relative flex w-full items-start gap-3 pb-5 text-left transition-opacity disabled:cursor-not-allowed', current === index ? 'text-heading' : 'text-body-alt', index > reachable && 'opacity-50')}>
                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium', status[index] === 'done' ? 'border-foreground bg-foreground text-background' : current === index ? 'border-foreground bg-background text-foreground ring-4 ring-background' : 'border-border bg-background text-placeholder')}>
                  {status[index] === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : index + 1}
                </span>
                <span className="min-w-0 pt-0.5"><span className={cn('block text-xs leading-5', current === index && 'font-semibold')}>{name}</span>
                  <span className="block text-[10px] leading-4 text-placeholder">{status[index] === 'skipped' ? 'Skipped for now' : index === SETUP_STEP.transactions || index === SETUP_STEP.merge ? 'Optional' : current === index ? STEP_DESCRIPTIONS[index] : ''}</span>
                </span>
              </button>
            </li>)}</ol>
          </nav>
          <div className="border-t-[0.5px] border-border pt-5"><div className="mb-2 flex justify-between text-[11px] text-body-alt"><span>{completed} completed{skipped ? ` · ${skipped} skipped` : ''}</span><span>{Math.round(percent)}%</span></div>
            <div className="h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-foreground transition-[width]" style={{ width: `${percent}%` }} /></div>
            <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-4 text-placeholder"><ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />{storageFailed ? 'Progress stays in this open page.' : 'Progress saved. Come back anytime.'}</p>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center justify-between px-6 py-5 sm:px-9">
            <span className="flex items-center gap-2 text-xs text-body-alt"><span className="font-medium text-foreground">{String(current + 1).padStart(2, '0')}</span><span className="text-placeholder">/ {String(SETUP_STEPS.length).padStart(2, '0')}</span><span className="mx-1 h-3 w-px bg-border" />{SETUP_STEPS[current]}</span>
            <div className="flex shrink-0 items-center gap-3">
              <button type="button" onClick={canUndoReset ? undoReset : resetSetup} className={cn('flex items-center gap-1.5 rounded-lg px-1 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', canUndoReset ? 'text-foreground hover:opacity-70' : 'text-body-alt hover:text-foreground')}>
                {canUndoReset ? <><Undo2 className="h-3.5 w-3.5" />Undo</> : <><RotateCcw className="h-3.5 w-3.5" />Start afresh</>}
              </button>
              <button type="button" onClick={close} aria-label="Close setup" className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-body-alt transition-colors hover:bg-secondary hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
          </header>
          <div className="flex gap-1 px-6 pb-2 md:hidden" role="group" aria-label="Setup progress">{SETUP_STEPS.map((name, index) => <button key={name} type="button" aria-label={`Step ${index + 1}: ${name}`} aria-current={current === index ? 'step' : undefined} disabled={index > reachable} onClick={() => goTo(index)} className="flex h-5 flex-1 items-center disabled:cursor-not-allowed"><span className={cn('h-1 w-full rounded-full', current === index || status[index] ? 'bg-foreground' : 'bg-secondary')} /></button>)}</div>
          <div ref={scrollArea} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-8 pt-3 sm:px-9 sm:pt-5">
            <h2 id={titleId} ref={heading} tabIndex={-1} className="mb-6 max-w-[440px] font-heading text-[28px] font-semibold leading-[1.18] tracking-[-1px] text-heading outline-none sm:text-[32px]">{STEP_TITLES[current]}</h2>
            {/* Each step starts fresh, so a revealed secret or an opened section never carries over. */}
            <div key={current} className="flex min-w-0 flex-col gap-5">{content()}</div>
          </div>
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t-[0.5px] border-border bg-background px-6 py-5 sm:px-9">
            {current === 0 ? <span className="flex items-center gap-1.5 text-[11px] text-placeholder"><ShieldCheck className="h-3.5 w-3.5" />Your progress is saved</span>
              : <button type="button" className="flex h-10 items-center gap-2 text-sm text-body-alt hover:text-foreground" onClick={() => goTo(current - 1)}><ArrowLeft className="h-4 w-4" />Back</button>}
            <div className="flex items-center gap-2">
              {current > 0 && <Button variant="ghost" className="px-3 text-body-alt" onClick={() => advance('skipped', current === SETUP_STEP.transactions ? { txEnabled: false } : current === SETUP_STEP.merge ? { mergeEnabled: false } : {})}>Skip{optionalStep ? ' feature' : ' for now'}</Button>}
              {(!install || showInstallation) && <Button disabled={!ready} onClick={() => advance('done')}>
                {current === 0 ? 'Let’s get started' : current === LAST_STEP ? 'Finish setup' : optionalStep ? 'Save and continue' : 'Done, continue'}<ArrowRight className="ml-2 h-4 w-4" />
              </Button>}
            </div>
          </footer>
        </div>
      </div>
    </dialog>}
  </>;
}
