/**
 * Toggle one option in an "all checked by default" multi-select. An empty selection means
 * every option is included (all boxes checked, the default), so the first toggle seeds the
 * full list and drops the clicked option; re-selecting every option collapses back to empty
 * (no filter), and unchecking the last remaining one collapses too, so the control can never
 * produce an empty result. Shared by the Workers/Payouts Account facets and the
 * Payouts Mode facet, so it is generic over the option type.
 */
export function toggleAllCheckedSelection<T extends string>(current: T[], name: T, all: readonly T[]): T[] {
  const effective: T[] = current.length === 0 ? [...all] : current;
  const next = effective.includes(name) ? effective.filter((v) => v !== name) : [...effective, name];
  return next.length === all.length ? [] : next;
}

/** Whether an option renders checked in an "all checked by default" multi-select. */
export function isAllCheckedSelected<T extends string>(selection: T[], name: T): boolean {
  return selection.length === 0 || selection.includes(name);
}
