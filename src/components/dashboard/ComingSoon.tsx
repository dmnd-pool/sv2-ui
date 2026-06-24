/**
 * Placeholder body for a nav destination whose own PR hasn't landed yet
 * (Workers, Rewards, API keys, Settings). Keeps the route reachable so the
 * sidebar is fully navigable while the real page is built separately.
 */
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h2 className="text-lg font-semibold text-heading">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-body-alt">This page is coming soon.</p>
    </div>
  );
}
