import { LiArrowRightUp } from 'solar-icon-react/li';

// DMND product version shown on the About tab (distinct from the sv2-ui build).
const DASHBOARD_VERSION = 'v2.1.0';

// External resources. Contact is the address Prisca asked us to use for now; the
// document links point at the DMND site and should be confirmed before release.
const LINKS: { label: string; href: string }[] = [
  { label: 'Privacy Policy', href: 'https://dmnd.work/privacy-policy' },
  { label: 'Terms of service', href: 'https://dmnd.work/terms' },
  { label: 'Documentation', href: 'https://dmnd.work/docs' },
  { label: 'Blog', href: 'https://dmnd.work/blog' },
  { label: 'Contact us', href: 'mailto:info@dmnd.work' },
];

/** The About tab: the dashboard version and a set of external document/social links. */
export function AboutTab() {
  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-heading">DMND Dashboard</h2>
          <p className="mt-1 text-sm text-body-alt">{DASHBOARD_VERSION}</p>
        </div>
        <div className="h-px w-full bg-border" />
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-heading">Links</h2>
          <p className="mt-1 text-sm text-body-alt">Access our important documents and social addresses</p>
        </div>
        <div className="h-px w-full bg-border" />
        <ul className="space-y-4">
          {LINKS.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                target={link.href.startsWith('mailto:') ? undefined : '_blank'}
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-foreground underline-offset-4 hover:underline"
              >
                {link.label}
                <LiArrowRightUp className="h-3.5 w-3.5 text-body-alt" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
