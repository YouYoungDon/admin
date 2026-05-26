import { ITEMS, STORAGE_KEYS } from './sobagi-schema';
import { addToList, loadJson, saveJson, todayString, unique } from './storage-adapter';

export type DiscoveryState = {
  keptIds: string[];
  queue: string[];
  foundIds: string[];
  stagedId: string | null;
  pendingNewItemId: string | null;
  lastItemDate: string | null;
  queueFront: string | null;
  duplicateFoundCounts: Array<{ id: string; count: number }>;
};

export function getDiscoveryState(): DiscoveryState {
  const queue = loadJson<string[]>(STORAGE_KEYS.DISCOVERY_QUEUE, []);
  const foundIds = loadJson<string[]>(STORAGE_KEYS.FOUND_ITEM_IDS, []);
  const counts = new Map<string, number>();
  for (const id of foundIds) counts.set(id, (counts.get(id) ?? 0) + 1);

  return {
    keptIds: loadJson<string[]>(STORAGE_KEYS.KEPT_ITEM_IDS, []),
    queue,
    foundIds,
    stagedId: loadJson<string | null>(STORAGE_KEYS.STAGED_ITEM_ID, null),
    pendingNewItemId: loadJson<string | null>(STORAGE_KEYS.PENDING_NEW_ITEM_ID, null),
    lastItemDate: loadJson<string | null>(STORAGE_KEYS.LAST_ITEM_DATE, null),
    queueFront: queue[0] ?? null,
    duplicateFoundCounts: [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([id, count]) => ({ id, count })),
  };
}

export function forceEnqueueItem(id: string): void {
  addToList(STORAGE_KEYS.DISCOVERY_QUEUE, id);
}

export function forceKeepItem(id: string): void {
  addToList(STORAGE_KEYS.KEPT_ITEM_IDS, id);
  addToList(STORAGE_KEYS.FOUND_ITEM_IDS, id);
}

export function clearDiscoveryQueue(): void {
  saveJson(STORAGE_KEYS.DISCOVERY_QUEUE, []);
}

export function resetKeptItems(): void {
  saveJson(STORAGE_KEYS.KEPT_ITEM_IDS, []);
}

export function resetFoundTrinkets(): void {
  saveJson(STORAGE_KEYS.FOUND_ITEM_IDS, []);
  saveJson(STORAGE_KEYS.PENDING_NEW_ITEM_ID, null);
  saveJson(STORAGE_KEYS.STAGED_ITEM_ID, null);
}

export function triggerSampleDiscovery(): string {
  const state = getDiscoveryState();
  const discovered = new Set([...state.foundIds, ...state.queue]);
  const candidate = ITEMS.find((item) => item.source === 'findable' && !discovered.has(item.id))
    ?? ITEMS.find((item) => item.source === 'findable')
    ?? ITEMS[0];

  if (!candidate) throw new Error('No item definitions available.');

  forceEnqueueItem(candidate.id);
  saveJson(STORAGE_KEYS.STAGED_ITEM_ID, candidate.id);
  saveJson(STORAGE_KEYS.LAST_ITEM_DATE, todayString());
  return candidate.id;
}

export function repairDiscoveryLists(): void {
  saveJson(STORAGE_KEYS.KEPT_ITEM_IDS, unique(loadJson<string[]>(STORAGE_KEYS.KEPT_ITEM_IDS, [])));
  saveJson(STORAGE_KEYS.DISCOVERY_QUEUE, unique(loadJson<string[]>(STORAGE_KEYS.DISCOVERY_QUEUE, [])));
}
