export const STORAGE_KEYS = {
  USER: 'sobagi-user',
  EXPENSES: 'sobagi-expenses',
  LAST_EMOTION: 'sobagi-last-emotion',
  MAILBOX_READ_IDS: 'sobagi-mailbox-read-ids',
  FOUND_ITEM_IDS: 'sobagi-found-item-ids',
  PENDING_NEW_ITEM_ID: 'sobagi-pending-item-id',
  LAST_ITEM_DATE: 'sobagi-last-item-date',
  STAGED_ITEM_ID: 'sobagi-staged-item-id',
  LAST_VISIT_DATE: 'sobagi-last-visit-date',
  OBSERVATION_SAVE_COUNT: 'sobagi-observation-save-count',
  MAILBOX_DELIVERED_IDS: 'sobagi-mailbox-delivered-ids',
  LAST_BAG_OPEN_DAYS: 'sobagi-last-bag-open-days',
  ROOM_PLACEMENTS: 'sobagi-room-placements',
  PENDING_PLACEMENT: 'sobagi-pending-placement',
  CATEGORY_MIGRATION_DONE: 'sobagi-category-migration-done',
  PEBBLE_COUNT: 'sobagi-pebble-count',
  RESTS_TODAY: 'sobagi-rests-today',
  LAST_REST_DATE: 'sobagi-last-rest-date',
  LAST_REST_AT: 'sobagi-last-rest-at',
  KEPT_ITEM_IDS: 'sobagi-kept-item-ids',
  DISCOVERY_QUEUE: 'sobagi-discovery-queue',
  DISCOVERY_MIGRATION_DONE: 'sobagi-discovery-migration-done',
} as const;

export const ADMIN_KEYS = {
  CLOCK_OVERRIDE: 'sobagi-admin-clock-override',
  LAST_ACTION: 'sobagi-admin-last-action',
  OPERATOR_OUTBOX: 'sobagi-admin-operator-outbox',
  OPERATOR_AUDIT_LOG: 'sobagi-admin-operator-audit-log',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export type LetterType = 'personal' | 'seasonal' | 'rest';

export type LetterDefinition = {
  id: string;
  type: LetterType;
  label: string;
  triggerDays?: number;
  month?: number;
  day?: number;
  endDay?: number;
  triggerPebbles?: number;
};

export const LETTERS: LetterDefinition[] = [
  { id: '001', type: 'personal', label: '첫 방문 환영 편지', triggerDays: 0 },
  { id: 'personal-week1', type: 'personal', label: '7일 기록 편지', triggerDays: 7 },
  { id: 'personal-month1', type: 'personal', label: '30일 기록 편지', triggerDays: 30 },
  { id: 'personal-month3', type: 'personal', label: '90일 기록 편지', triggerDays: 90 },
  { id: 'seasonal-may-2026', type: 'seasonal', label: '2026년 5월 계절 편지', month: 5, day: 1, endDay: 31 },
  { id: 'seasonal-spring-2026', type: 'seasonal', label: '2026년 봄 편지', month: 3, day: 1, endDay: 15 },
  { id: 'seasonal-rain-2026', type: 'seasonal', label: '2026년 장마 편지', month: 6, day: 20, endDay: 31 },
  { id: 'seasonal-autumn-2026', type: 'seasonal', label: '2026년 가을 편지', month: 10, day: 10, endDay: 25 },
  { id: 'seasonal-yearend-2026', type: 'seasonal', label: '2026년 연말 편지', month: 12, day: 20, endDay: 31 },
  { id: 'rest1', type: 'rest', label: '휴식 조약돌 편지 1', triggerPebbles: 30 },
  { id: 'rest2', type: 'rest', label: '휴식 조약돌 편지 2', triggerPebbles: 100 },
  { id: 'rest3', type: 'rest', label: '휴식 조약돌 편지 3', triggerPebbles: 250 },
  { id: 'rest4', type: 'rest', label: '휴식 조약돌 편지 4', triggerPebbles: 500 },
  { id: 'rest5', type: 'rest', label: '휴식 조약돌 편지 5', triggerPebbles: 1000 },
];

export type ItemDefinition = {
  id: string;
  label: string;
  source: 'findable' | 'bag';
  minDays?: number;
};

export const ITEMS: ItemDefinition[] = [
  { id: 'f1', label: 'Four-leaf clover', source: 'findable' },
  { id: 'f2', label: 'Shiny shard', source: 'findable' },
  { id: 'f3', label: 'Small acorn', source: 'findable' },
  { id: 'f4', label: 'Ribbon scrap', source: 'findable' },
  { id: 'f5', label: 'Tea leaf piece', source: 'findable' },
  { id: 'f6', label: 'Petal', source: 'findable' },
  { id: 'f7', label: 'Small feather', source: 'findable' },
  { id: 'f8', label: 'Shell fragment', source: 'findable' },
  { id: 'a1', label: '가방 아이템 a1', source: 'bag', minDays: 0 },
  { id: 'a2', label: '가방 아이템 a2', source: 'bag', minDays: 5 },
  { id: 'a3', label: '가방 아이템 a3', source: 'bag', minDays: 14 },
  { id: 'a4', label: '가방 아이템 a4', source: 'bag', minDays: 25 },
  { id: 'a5', label: '가방 아이템 a5', source: 'bag', minDays: 50 },
  { id: 'a6', label: '가방 아이템 a6', source: 'bag', minDays: 30 },
  { id: 'm1', label: '가방 아이템 m1', source: 'bag', minDays: 0 },
  { id: 'm2', label: '가방 아이템 m2', source: 'bag', minDays: 7 },
  { id: 'm3', label: '가방 아이템 m3', source: 'bag', minDays: 18 },
  { id: 'm4', label: '가방 아이템 m4', source: 'bag', minDays: 32 },
  { id: 'm5', label: '가방 아이템 m5', source: 'bag', minDays: 28 },
  { id: 'm6', label: '가방 아이템 m6', source: 'bag', minDays: 45 },
  { id: 's1', label: '가방 아이템 s1', source: 'bag', minDays: 0 },
  { id: 's2', label: '가방 아이템 s2', source: 'bag', minDays: 10 },
  { id: 's3', label: '가방 아이템 s3', source: 'bag', minDays: 20 },
  { id: 's4', label: '가방 아이템 s4', source: 'bag', minDays: 35 },
  { id: 's5', label: '가방 아이템 s5', source: 'bag', minDays: 55 },
  { id: 't1', label: '가방 아이템 t1', source: 'bag', minDays: 3 },
  { id: 't2', label: '가방 아이템 t2', source: 'bag', minDays: 12 },
  { id: 't3', label: '가방 아이템 t3', source: 'bag', minDays: 22 },
  { id: 't4', label: '가방 아이템 t4', source: 'bag', minDays: 40 },
  { id: 't5', label: '가방 아이템 t5', source: 'bag', minDays: 35 },
];

export const ALL_STORAGE_KEYS: string[] = [
  ...Object.values(STORAGE_KEYS),
  ...Object.values(ADMIN_KEYS),
];

export type OperatorMessageKind = 'letter' | 'notice';

export type OperatorMessage = {
  id: string;
  kind: 'letter';
  title: string;
  body: string;
  sig: string;
  target: 'all' | 'user';
  targetUserId?: string;
  status: 'local-draft' | 'sent-server';
  createdAt: string;
  updatedAt: string;
};

export type AuditEntry = {
  id: string;
  action: string;
  detail: string;
  createdAt: string;
};
