import { ADMIN_KEYS, STORAGE_KEYS, type AuditEntry, type OperatorMessage } from './sobagi-schema';
import { addToList, loadJson, removeFromList, saveJson, unique } from './storage-adapter';

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

function id(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function audit(action: string, detail: string): void {
  const entry: AuditEntry = {
    id: id('audit'),
    action,
    detail,
    createdAt: new Date().toISOString(),
  };
  const next = [entry, ...loadJson<AuditEntry[]>(ADMIN_KEYS.OPERATOR_AUDIT_LOG, [])].slice(0, 100);
  saveJson(ADMIN_KEYS.OPERATOR_AUDIT_LOG, next);
  saveJson(ADMIN_KEYS.LAST_ACTION, `${action}: ${detail}`);
}

export function listOutbox(): OperatorMessage[] {
  return loadJson<OperatorMessage[]>(ADMIN_KEYS.OPERATOR_OUTBOX, []);
}

export function listAuditLog(): AuditEntry[] {
  return loadJson<AuditEntry[]>(ADMIN_KEYS.OPERATOR_AUDIT_LOG, []);
}

export function queueOperatorMessage(input: {
  kind: OperatorMessage['kind'];
  title: string;
  body: string;
  target: OperatorMessage['target'];
  segmentNote?: string;
}): OperatorMessage {
  const now = new Date().toISOString();
  const message: OperatorMessage = {
    id: id(input.kind),
    kind: input.kind,
    title: input.title.trim(),
    body: input.body.trim(),
    target: input.target,
    segmentNote: input.segmentNote?.trim() || undefined,
    status: 'queued',
    createdAt: now,
    updatedAt: now,
  };

  if (!message.title || !message.body) {
    throw new Error('Title and body are required.');
  }

  saveJson(ADMIN_KEYS.OPERATOR_OUTBOX, [message, ...listOutbox()]);
  audit(`queue-${message.kind}`, `${message.id} queued for ${message.target}`);
  return message;
}

export function markMessageSentLocal(messageId: string): void {
  const now = new Date().toISOString();
  const next = listOutbox().map((message) => (
    message.id === messageId
      ? { ...message, status: 'sent-local' as const, updatedAt: now }
      : message
  ));
  saveJson(ADMIN_KEYS.OPERATOR_OUTBOX, next);
  audit('mark-message-sent-local', messageId);
}

export function deleteMessage(messageId: string): void {
  saveJson(
    ADMIN_KEYS.OPERATOR_OUTBOX,
    listOutbox().filter((message) => message.id !== messageId),
  );
  audit('delete-message', messageId);
}

export function clearOutbox(): void {
  saveJson(ADMIN_KEYS.OPERATOR_OUTBOX, []);
  audit('clear-outbox', 'operator outbox cleared');
}

export function addKeptItem(idValue: string): void {
  addToList(STORAGE_KEYS.KEPT_ITEM_IDS, idValue);
  audit('add-kept-item', idValue);
}

export function removeKeptItem(idValue: string): void {
  removeFromList(STORAGE_KEYS.KEPT_ITEM_IDS, idValue);
  audit('remove-kept-item', idValue);
}

export function addFoundItem(idValue: string): void {
  const next = [...loadJson<string[]>(STORAGE_KEYS.FOUND_ITEM_IDS, []), idValue];
  saveJson(STORAGE_KEYS.FOUND_ITEM_IDS, next);
  audit('add-found-item-entry', idValue);
}

export function removeFoundItem(idValue: string): void {
  const current = loadJson<string[]>(STORAGE_KEYS.FOUND_ITEM_IDS, []);
  const index = current.indexOf(idValue);
  if (index >= 0) current.splice(index, 1);
  saveJson(STORAGE_KEYS.FOUND_ITEM_IDS, current);
  audit('remove-found-item-entry', idValue);
}

export function setFoundItemCount(idValue: string, count: number): void {
  const safeCount = Math.max(0, Math.floor(count));
  const others = loadJson<string[]>(STORAGE_KEYS.FOUND_ITEM_IDS, []).filter((idItem) => idItem !== idValue);
  saveJson(STORAGE_KEYS.FOUND_ITEM_IDS, [...others, ...Array.from({ length: safeCount }, () => idValue)]);
  audit('set-found-item-count', `${idValue} x${safeCount}`);
}

export function removeQueuedItem(idValue: string): void {
  removeFromList(STORAGE_KEYS.DISCOVERY_QUEUE, idValue);
  audit('remove-queued-item', idValue);
}

export function setQueueFront(idValue: string): void {
  const queue = loadJson<string[]>(STORAGE_KEYS.DISCOVERY_QUEUE, []).filter((itemId) => itemId !== idValue);
  saveJson(STORAGE_KEYS.DISCOVERY_QUEUE, unique([idValue, ...queue]));
  audit('set-queue-front', idValue);
}

export function setPendingItem(idValue: string | null): void {
  saveJson(STORAGE_KEYS.PENDING_NEW_ITEM_ID, idValue);
  audit('set-pending-item', idValue ?? 'null');
}

export function setStagedItem(idValue: string | null): void {
  saveJson(STORAGE_KEYS.STAGED_ITEM_ID, idValue);
  audit('set-staged-item', idValue ?? 'null');
}

export function setPebbleCount(count: number): void {
  const safeCount = Math.max(0, Math.floor(count));
  const user = loadJson<UserLike | null>(STORAGE_KEYS.USER, null) ?? {};
  saveJson(STORAGE_KEYS.PEBBLE_COUNT, safeCount);
  saveJson(STORAGE_KEYS.USER, {
    level: user.level ?? 1,
    streak: user.streak ?? 0,
    totalRecordCount: user.totalRecordCount ?? 0,
    recordedDaysCount: user.recordedDaysCount ?? 0,
    roomStage: user.roomStage ?? 1,
    pebbleCount: safeCount,
    restsToday: user.restsToday ?? 0,
    lastRestDate: user.lastRestDate ?? null,
    lastRestAt: user.lastRestAt ?? null,
  });
  audit('set-pebble-count', String(safeCount));
}

export function setRoomStage(stage: number): void {
  const safeStage = Math.min(5, Math.max(1, Math.floor(stage)));
  const user = loadJson<UserLike | null>(STORAGE_KEYS.USER, null) ?? {};
  saveJson(STORAGE_KEYS.USER, {
    level: user.level ?? 1,
    streak: user.streak ?? 0,
    totalRecordCount: user.totalRecordCount ?? 0,
    recordedDaysCount: user.recordedDaysCount ?? 0,
    roomStage: safeStage,
    pebbleCount: user.pebbleCount ?? loadJson<number>(STORAGE_KEYS.PEBBLE_COUNT, 0),
    restsToday: user.restsToday ?? 0,
    lastRestDate: user.lastRestDate ?? null,
    lastRestAt: user.lastRestAt ?? null,
  });
  audit('set-room-stage', String(safeStage));
}

export function setUserCounts(input: {
  recordedDaysCount: number;
  streak: number;
  totalRecordCount: number;
}): void {
  const user = loadJson<UserLike | null>(STORAGE_KEYS.USER, null) ?? {};
  const recordedDaysCount = Math.max(0, Math.floor(input.recordedDaysCount));
  const streak = Math.max(0, Math.floor(input.streak));
  const totalRecordCount = Math.max(0, Math.floor(input.totalRecordCount));
  saveJson(STORAGE_KEYS.USER, {
    level: user.level ?? 1,
    streak,
    totalRecordCount,
    recordedDaysCount,
    roomStage: user.roomStage ?? 1,
    pebbleCount: user.pebbleCount ?? loadJson<number>(STORAGE_KEYS.PEBBLE_COUNT, 0),
    restsToday: user.restsToday ?? 0,
    lastRestDate: user.lastRestDate ?? null,
    lastRestAt: user.lastRestAt ?? null,
  });
  audit('set-user-counts', `days=${recordedDaysCount}, streak=${streak}, total=${totalRecordCount}`);
}

export function setLastEmotion(emotion: string): void {
  saveJson(STORAGE_KEYS.LAST_EMOTION, emotion);
  audit('set-last-emotion', emotion);
}

export function setLastVisitDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Last visit date must be YYYY-MM-DD.');
  }
  saveJson(STORAGE_KEYS.LAST_VISIT_DATE, date);
  audit('set-last-visit-date', date);
}
