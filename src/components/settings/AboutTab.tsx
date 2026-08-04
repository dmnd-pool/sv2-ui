import { LiArrowRightUp } from 'solar-icon-react/li';

// DMND product version shown on the About tab (distinct from the sv2-ui build).
const DASHBOARD_VERSION = 'v2.0.0';

// External resources shown on the About tab. Contact opens the DMND support inbox.
// Rows with a confirmed destination link out; the rest render as non-interactive
// placeholders (shown per the design) until their real URLs exist, so the tab keeps
// its full shape without ever linking to a page that doesn't resolve.
const LINKS: { label: string; href: string }[] = [
  { label: 'Privacy Policy', href: '' },
  { label: 'Terms of service', href: '' },
  { label: 'Documentation', href: '' },
  { label: 'Blog', href: 'https://blog.dmnd.work/' },
  { label: 'Contact us', href: 'mailto:info@dmnd.work' },
];

/** The About tab: the dashboard version and a set of external document/social links. */
export function AboutTab() {
  return (
    <div className="max-w-[542px] space-y-10 sm:space-y-14">
      <div className="space-y-4">
        <div>
          <h2 className="!font-body text-base font-semibold leading-6 text-heading">DMND Dashboard</h2>
          <p className="mt-1 text-xs leading-4 text-body-alt">{DASHBOARD_VERSION}</p>
        </div>
        <div className="h-[0.5px] w-full bg-border" />
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="!font-body text-base font-semibold leading-6 text-heading">Links</h2>
          <p className="mt-1 text-sm text-body-alt">Access our important documents and social addresses</p>
        </div>
        <div className="h-[0.5px] w-full bg-border" />
        <ul className="space-y-4">
          {LINKS.map((link) =>
            link.href ? (
              <li key={link.label}>
                <a
                  href={link.href}
                  target={link.href.startsWith('mailto:') ? undefined : '_blank'}
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 border-b-[0.5px] border-foreground pb-0.5 text-sm leading-5 text-foreground transition-opacity hover:opacity-80"
                >
                  {link.label}
                  <LiArrowRightUp className="h-3.5 w-3.5" />
                </a>
              </li>
            ) : (
              <li key={link.label}>
                <span
                  aria-disabled
                  className="inline-flex cursor-default items-center gap-1 border-b-[0.5px] border-foreground pb-0.5 text-sm leading-5 text-foreground"
                >
                  {link.label}
                  <LiArrowRightUp className="h-3.5 w-3.5" />
                </span>
              </li>
            ),
          )}
        </ul>
      </div>
    </div>
  );
}
