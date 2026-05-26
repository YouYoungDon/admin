import { ADMIN_KEYS, ALL_STORAGE_KEYS, STORAGE_KEYS } from './sobagi-schema';
import { clearKeys, loadJson, saveJson, todayString, yesterdayString } from './storage-adapter';

type UserLike = {
  level?: number;
  streak?: number;
  totalRecordCount?: number;
  recordedDaysCount?: number;
  roomStage?: number;
  pebbleCount?: number;
  restsToday?: number;
  lastRestDate?: string | null;
  lastRestAt?: string | null;
};

export function freshWipeLocalAppState(): void {
  clearKeys(ALL_STORAGE_KEYS);
}

export function resetDiscoveryAndBagState(): void {
  clearKeys([
    STORAGE_KEYS.FOUND_ITEM_IDS,
    STORAGE_KEYS.PENDING_NEW_ITEM_ID,
    STORAGE_KEYS.LAST_ITEM_DATE,
    STORAGE_KEYS.STAGED_ITEM_ID,
    STORAGE_KEYS.LAST_BAG_OPEN_DAYS,
    STORAGE_KEYS.ROOM_PLACEMENTS,
    STORAGE_KEYS.PENDING_PLACEMENT,
    STORAGE_KEYS.KEPT_ITEM_IDS,
    STORAGE_KEYS.DISCOVERY_QUEUE,
    STORAGE_KEYS.DISCOVERY_MIGRATION_DONE,
  ]);
}

export function resetMailboxState(): void {
  clearKeys([STORAGE_KEYS.MAILBOX_DELIVERED_IDS, STORAGE_KEYS.MAILBOX_READ_IDS]);
}

export function simulateNextDay(): void {
  const yesterday = yesterdayString();
  saveJson(STORAGE_KEYS.LAST_VISIT_DATE, yesterday);
  saveJson(STORAGE_KEYS.LAST_REST_DATE, yesterday);
  saveJson(ADMIN_KEYS.LAST_ACTION, `simulate-next-day at ${new Date().toISOString()}`);
}

export function setAdminClock(hour: 8 | 23): void {
  const now = new Date();
  now.setHours(hour, 0, 0, 0);
  saveJson(ADMIN_KEYS.CLOCK_OVERRIDE, now.toISOString());
  saveJson(ADMIN_KEYS.LAST_ACTION, `admin-clock-${hour} at ${new Date().toISOString()}`);
}

export function seedExampleExpenses(): void {
  const today = todayString();
  const now = new Date().toISOString();
  const expenses = loadJson<unknown[]>(STORAGE_KEYS.EXPENSES, []);
  const seed = [
    {
      id: `admin-seed-cafe-${Date.now()}`,
      kind: 'spending',
      amount: 4500,
      category: 'cafe',
      userEmotion: 'calm',
      memo: 'admin seed cafe',
      sobagiEmotion: 'happy',
      createdAt: now,
      localDate: today,
    },
    {
      id: `admin-seed-income-${Date.now()}`,
      kind: 'income',
      amount: 0,
      category: 'received_gift',
      memo: 'admin seed incoming record',
      sobagiEmotion: 'surprised',
      createdAt: now,
      localDate: today,
    },
  ];

  saveJson(STORAGE_KEYS.EXPENSES, [...expenses, ...seed]);

  const user = loadJson<UserLike | null>(STORAGE_KEYS.USER, null) ?? {};
  saveJson(STORAGE_KEYS.USER, {
    level: user.level ?? 1,
    streak: user.streak ?? 1,
    totalRecordCount: (user.totalRecordCount ?? 0) + seed.length,
    recordedDaysCount: Math.max(user.recordedDaysCount ?? 0, 1),
    roomStage: user.roomStage ?? 1,
    pebbleCount: user.pebbleCount ?? 0,
    restsToday: user.restsToday ?? 0,
    lastRestDate: user.lastRestDate ?? null,
    lastRestAt: user.lastRestAt ?? null,
  });
}

export function clearExampleExpenses(): void {
  const expenses = loadJson<Array<{ id?: string }>>(STORAGE_KEYS.EXPENSES, []);
  saveJson(
    STORAGE_KEYS.EXPENSES,
    expenses.filter((expense) => !String(expense.id ?? '').startsWith('admin-seed-')),
  );
}
