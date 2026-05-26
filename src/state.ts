import { ADMIN_KEYS, STORAGE_KEYS } from './sobagi-schema';
import { loadJson, readRawStorage, todayString } from './storage-adapter';

type ExpenseLike = {
  id?: string;
  kind?: string;
  category?: string;
  amount?: number;
  localDate?: string;
  createdAt?: string;
};

type UserLike = {
  recordedDaysCount?: number;
  streak?: number;
  totalRecordCount?: number;
  roomStage?: number;
  pebbleCount?: number;
  restsToday?: number;
  lastRestDate?: string | null;
  lastRestAt?: string | null;
};

export type AppStateSummary = {
  recordedDaysCount: number | string;
  currentStreak: number | string;
  totalRecordCount: number | string;
  todaysRecordCount: number;
  todaysSpendingCount: number;
  todaysIncomeCount: number;
  todaysNoSpend: boolean;
  currentEmotion: string;
  roomStage: number | string;
  lastVisitDate: string | null;
  discoveryMigrationDone: boolean | null;
  stagedItemId: string | null;
  pendingNewItemId: string | null;
  pebbleCount: number | string;
  restsToday: number | string;
  lastRestDate: string | null;
  lastRestAt: string | null;
  adminClockOverride: string | null;
  rawKeysPresent: number;
};

function expenseDate(expense: ExpenseLike): string | null {
  if (expense.localDate) return expense.localDate;
  if (!expense.createdAt) return null;
  const date = new Date(expense.createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return todayString(date);
}

export function getAppStateSummary(now = new Date()): AppStateSummary {
  const user = loadJson<UserLike | null>(STORAGE_KEYS.USER, null);
  const expenses = loadJson<ExpenseLike[]>(STORAGE_KEYS.EXPENSES, []);
  const today = todayString(now);
  const todaysExpenses = expenses.filter((expense) => expenseDate(expense) === today);

  return {
    recordedDaysCount: user?.recordedDaysCount ?? 'missing',
    currentStreak: user?.streak ?? 'missing',
    totalRecordCount: user?.totalRecordCount ?? 'missing',
    todaysRecordCount: todaysExpenses.length,
    todaysSpendingCount: todaysExpenses.filter((expense) => expense.kind !== 'income' && expense.category !== 'no_spend').length,
    todaysIncomeCount: todaysExpenses.filter((expense) => expense.kind === 'income').length,
    todaysNoSpend: todaysExpenses.some((expense) => expense.category === 'no_spend'),
    currentEmotion: loadJson<string | null>(STORAGE_KEYS.LAST_EMOTION, null) ?? 'missing',
    roomStage: user?.roomStage ?? 'missing',
    lastVisitDate: loadJson<string | null>(STORAGE_KEYS.LAST_VISIT_DATE, null),
    discoveryMigrationDone: loadJson<boolean | null>(STORAGE_KEYS.DISCOVERY_MIGRATION_DONE, null),
    stagedItemId: loadJson<string | null>(STORAGE_KEYS.STAGED_ITEM_ID, null),
    pendingNewItemId: loadJson<string | null>(STORAGE_KEYS.PENDING_NEW_ITEM_ID, null),
    pebbleCount: user?.pebbleCount ?? loadJson<number | string>(STORAGE_KEYS.PEBBLE_COUNT, 'missing'),
    restsToday: user?.restsToday ?? loadJson<number | string>(STORAGE_KEYS.RESTS_TODAY, 'missing'),
    lastRestDate: user?.lastRestDate ?? loadJson<string | null>(STORAGE_KEYS.LAST_REST_DATE, null),
    lastRestAt: user?.lastRestAt ?? loadJson<string | null>(STORAGE_KEYS.LAST_REST_AT, null),
    adminClockOverride: loadJson<string | null>(ADMIN_KEYS.CLOCK_OVERRIDE, null),
    rawKeysPresent: readRawStorage().filter((row) => row.exists).length,
  };
}
