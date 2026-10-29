const PROGRESS_KEY = 'dmnd.tour.progress';

type ProgressStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface TourProgress {
  target: string;
  targets: string[];
}

export function readTourProgress(storage?: ProgressStorage): TourProgress | null {
  try {
    const value = JSON.parse((storage ?? localStorage).getItem(PROGRESS_KEY) ?? 'null');
    if (!value || typeof value.target !== 'string' || !Array.isArray(value.targets) ||
      !value.targets.every((target: unknown) => typeof target === 'string') ||
      !value.targets.includes(value.target)) return null;
    return { target: value.target, targets: value.targets };
  } catch {
    return null;
  }
}

export function saveTourProgress(target: string, targets: string[], storage?: ProgressStorage): void {
  try {
    (storage ?? localStorage).setItem(PROGRESS_KEY, JSON.stringify({ target, targets }));
  } catch {
    // A tour must still work when browser storage is unavailable.
  }
}

export function clearTourProgress(storage?: ProgressStorage): void {
  try {
    (storage ?? localStorage).removeItem(PROGRESS_KEY);
  } catch {
    // Storage may be disabled.
  }
}

/** Resume by identity, since widgets and account permissions can change the step order. */
export function resumeTourIndex(progress: TourProgress | null, targets: string[]): number | null {
  if (!progress || targets.length === 0) return null;
  const exact = targets.indexOf(progress.target);
  if (exact >= 0) return exact;

  // If the saved target is hidden, continue at the next available step in the saved tour.
  const remaining = progress.targets.slice(progress.targets.indexOf(progress.target) + 1);
  for (const target of remaining) {
    const index = targets.indexOf(target);
    if (index >= 0) return index;
  }
  return null;
}
