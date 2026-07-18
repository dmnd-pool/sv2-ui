/**
 * The Preferences tab: dashboard theme and language. The theme selector and the
 * language control are added in the following commit; this placeholder keeps the tab
 * present in the shell while those are built.
 */
export function PreferencesTab() {
  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-base font-semibold text-heading">Theme</h2>
        <p className="mt-1 text-sm text-body-alt">Choose the theme of your dashboard</p>
      </div>
      <div className="h-px w-full bg-border" />
    </div>
  );
}
