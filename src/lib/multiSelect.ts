/**
 * Toggle one option in an "all checked by default" multi-select. An empty selection means
 * every option is included (all boxes checked, the default), so the first toggle seeds the
 * full list and drops the clicked option; re-selecting every option collapses back to empty
 * (no filter), and unchecking the last remaining one collapses too, so the control can never
 * produce an empty result. Shared by the Workers and Payouts Account facets.
 */
export function toggleAllCheckedSelection(current: string[], name: string, all: string[]): string[] {
  const effective = current.length === 0 ? all : current;
  const next = effective.includes(name) ? effective.filter((v) => v !== name) : [...effective, name];
  return next.length === all.length ? [] : next;
}

/** Whether an option renders checked in an "all checked by default" multi-select. */
export function isAllCheckedSelected(selection: string[], name: string): boolean {
  return selection.length === 0 || selection.includes(name);
}
