import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { LiAltArrowRight } from 'solar-icon-react/li';
import heroImage from '@/assets/guide-hero-job-declaration.png';
import {
  BlockDrawing,
  DocHero,
  DocLede,
  DocPager,
  DocSection,
  DocText,
  type BlockPart,
} from '@/components/docs/DocPrimitives';
import {
  DocPage,
} from '@/components/docs/DocGuide';
import { cn } from '@/lib/utils';
import { BuildYourBlockSetup } from '@/components/docs/BuildYourBlockSetup';

const JOB_DECLARATION_PATH = '/build-your-block/job-declaration';
const MERGE_MINING_PATH = '/build-your-block/merge-mining';
const PRIORITIZE_TRANSACTIONS_PATH = '/build-your-block/prioritize-transactions';

/** One feature: what it is called, what it does, and the way into it. */
function Feature({
  title,
  href,
  action,
  part,
  main = false,
  children,
}: {
  title: string;
  href: string;
  action: string;
  /** The part of the block this one reaches into; omitted means the whole block. */
  part?: BlockPart;
  main?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-t-[0.5px] border-border pt-4 first:border-t-0 first:pt-0 sm:flex-row sm:gap-5">
      <BlockDrawing highlight={part} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h3
          className={cn(
            'font-heading font-bold tracking-[-0.5px] text-heading',
            main ? 'text-xl leading-7' : 'text-lg leading-6',
          )}
        >
          {title}
        </h3>
        <div className="flex flex-col gap-2">{children}</div>
        <Link
          href={href}
          className="inline-flex w-fit items-center gap-1 text-sm font-medium leading-5 text-foreground underline underline-offset-4 hover:opacity-70"
        >
          {action}
          <LiAltArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

/** The introduction: what building your own block is, and the features that do it. */
export function BuildYourBlockPage() {
  return (
    <DocPage title="Build your block">
      <BuildYourBlockSetup />
      <DocHero src={heroImage} />

      <DocLede>
        Build your own block templates from your own node, and the pool pays you for the valid blocks you find.
      </DocLede>

      <DocSection title="Features">
        <Feature title="Job Declaration" href={JOB_DECLARATION_PATH} action="Set up Job Declaration" main>
          <DocText>
            Keep the convenience of pooled mining while your local Bitcoin node builds the template. DMND accounts for
            shares and payouts without deciding your block contents.
          </DocText>
          <DocText>
            No ASIC replacement or firmware reflash is needed: miners still speak standard Stratum V1 to your local DMND
            Client.
          </DocText>
        </Feature>
      </DocSection>

      <DocSection title="More features">
        <Feature title="Merge mine Rootstock" href={MERGE_MINING_PATH} action="Earn direct rBTC" part="coinbase">
          <DocText>
            Add a Rootstock commitment to the coinbase you control. Use the same ASICs and Bitcoin hash rate, with rBTC
            directed to an address you choose.
          </DocText>
        </Feature>
        <Feature
          title="Prioritize transactions"
          href={PRIORITIZE_TRANSACTIONS_PATH}
          action="Explore transaction priority"
          part="transactions"
        >
          <DocText>
            Favor an eligible transaction in your local template for fee recovery, private inclusion, or a paid
            inclusion workflow.
          </DocText>
        </Feature>
      </DocSection>

      <DocPager
        next={{ href: JOB_DECLARATION_PATH, label: 'Build your own blocks with Job Declaration' }}
        guide="Build your block"
      />
    </DocPage>
  );
}
