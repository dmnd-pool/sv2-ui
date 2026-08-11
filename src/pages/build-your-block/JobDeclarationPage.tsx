import { LiArrowRightUp } from 'solar-icon-react/li';
import heroImage from '@/assets/guide-hero-job-declaration.png';
import {
  DocHero,
  DocPage,
  DocSection,
  DocText,
  DocList,
  Chip,
  DocFooterPrompt,
} from '@/components/docs/DocPrimitives';

const SV2_TP_README = 'https://github.com/stratum-mining/sv2-tp#readme';
const DMND_CLIENT_REPO = 'https://github.com/dmnd-pool/dmnd-client';

/**
 * Enable job declaration support: what a miner runs to build their own block
 * templates.
 *
 * The Bitcoin Core version differs from the design, which says v30+. The Template
 * Provider's own release notes require v31.0 or later, and its last release
 * supporting v30.2 predates the current IPC changes, so following the drawn version
 * would leave a miner unable to connect.
 */
export function JobDeclarationPage() {
  return (
    <DocPage title="Enable job declaration support">
      <DocHero src={heroImage} />

      <DocText>
        Job Declaration is the key Stratum V2 feature that lets miners build their own block templates, improving
        decentralization, censorship resistance, and latency. To use it, you run two components on your own
        infrastructure:
      </DocText>

      <DocList
        items={[
          <>
            <strong className="font-medium text-foreground">Bitcoin Core (v31.0+)</strong> with IPC enabled — your own
            node.
          </>,
          <>
            <strong className="font-medium text-foreground">Stratum V2 Template Provider</strong> (<Chip>sv2-tp</Chip>)
            — a separate binary that connects to Bitcoin Core via IPC and serves block templates to the DMND Client.
          </>,
        ]}
      />

      <DocSection title="Set up the Template Provider">
        <DocText>
          Follow the setup instructions in the sv2-tp README — it covers both running Bitcoin Core with IPC enabled and
          running the Template Provider, and is always up to date:
        </DocText>
        <a
          href={SV2_TP_README}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1 rounded-xl bg-muted px-4 py-2 text-sm leading-5 text-foreground transition-opacity hover:opacity-80"
        >
          {SV2_TP_README}
          <LiArrowRightUp className="h-3.5 w-3.5" />
        </a>
        <DocText>
          The Template Provider listens on port <Chip>8336</Chip> by default — you'll need that in the next section.
        </DocText>
        <DocText>
          <span className="font-medium text-foreground">Verify:</span> the sv2-tp log should show a successful IPC
          connection to Bitcoin Core and new templates being generated as blocks arrive.
        </DocText>
      </DocSection>

      <DocFooterPrompt href={DMND_CLIENT_REPO} />
    </DocPage>
  );
}
