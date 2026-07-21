import { LiKeyMinimalistic, LiAddCircle, LiAltArrowRight } from 'solar-icon-react/li';

// The docs page for watcher links does not exist yet, so the "Learn about Watcher
// links" link stays hidden until there is a real URL to point at rather than
// shipping a dead one. Set this once the destination is known.
const WATCHER_LINKS_DOCS_URL = '';

/** Shown when the account has no watcher links yet. */
export function WatcherLinksEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 px-8 py-8 text-center">
      <LiKeyMinimalistic className="h-16 w-16 text-placeholder" />
      <div>
        {/* h3 so the heading picks up Radio Canada Big from the .dmnd-app scope. */}
        <h3 className="text-xl font-semibold text-foreground">No Watcher links yet</h3>
        <p className="mt-2 max-w-md text-sm text-body-alt">
          Create your first Watcher link to securely access your mining data from external applications.
        </p>
      </div>
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--btn))] px-5 py-2 text-sm font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
        >
          <LiAddCircle className="h-3.5 w-3.5" /> Create watcher link
        </button>
        {WATCHER_LINKS_DOCS_URL ? (
          <a
            href={WATCHER_LINKS_DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline underline-offset-4 transition-colors hover:text-body-alt"
          >
            Learn about Watcher links
            <LiAltArrowRight className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
    </div>
  );
}
