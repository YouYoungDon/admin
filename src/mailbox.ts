import { LETTERS, STORAGE_KEYS, type LetterDefinition } from './sobagi-schema';
import { addToList, loadJson, removeFromList, saveJson, unique } from './storage-adapter';

export type LetterStatus = {
  letter: LetterDefinition;
  delivered: boolean;
  read: boolean;
  state: 'read' | 'unread' | 'available' | 'scheduled' | 'condition-unmet' | 'already-delivered';
  reason: string;
};

type UserLike = {
  recordedDaysCount?: number;
  pebbleCount?: number;
};

function explainUndelivered(letter: LetterDefinition, user: UserLike, now: Date): Pick<LetterStatus, 'state' | 'reason'> {
  if (letter.type === 'personal') {
    const recorded = user.recordedDaysCount ?? 0;
    const trigger = letter.triggerDays ?? 0;
    if (recorded >= trigger) {
      return { state: 'available', reason: `condition met: recordedDaysCount ${recorded} >= ${trigger}` };
    }
    return { state: 'condition-unmet', reason: `needs recordedDaysCount >= ${trigger}; current ${recorded}` };
  }

  if (letter.type === 'seasonal') {
    const month = now.getMonth() + 1;
    const day = now.getDate();
    if (month === letter.month && day >= (letter.day ?? 1) && day <= (letter.endDay ?? 31)) {
      return { state: 'available', reason: `seasonal window is open for ${month}/${day}` };
    }
    return {
      state: 'scheduled',
      reason: `scheduled for ${letter.month}/${letter.day}-${letter.endDay}; today is ${month}/${day}`,
    };
  }

  const pebbles = user.pebbleCount ?? 0;
  const trigger = letter.triggerPebbles ?? 0;
  if (pebbles >= trigger) {
    return { state: 'available', reason: `pebble threshold met: ${pebbles} >= ${trigger}` };
  }
  return { state: 'condition-unmet', reason: `needs pebbleCount >= ${trigger}; current ${pebbles}` };
}

export function getMailboxStatuses(now = new Date()): LetterStatus[] {
  const delivered = new Set(loadJson<string[]>(STORAGE_KEYS.MAILBOX_DELIVERED_IDS, []));
  const read = new Set(loadJson<string[]>(STORAGE_KEYS.MAILBOX_READ_IDS, []));
  const user = loadJson<UserLike | null>(STORAGE_KEYS.USER, null) ?? {};

  return LETTERS.map((letter) => {
    const isDelivered = delivered.has(letter.id);
    const isRead = read.has(letter.id);
    if (isDelivered) {
      return {
        letter,
        delivered: true,
        read: isRead,
        state: isRead ? 'read' : 'unread',
        reason: isRead ? 'already delivered and marked read' : 'already delivered; unread marker remains',
      };
    }

    const explanation = explainUndelivered(letter, user, now);
    return {
      letter,
      delivered: false,
      read: false,
      state: explanation.state,
      reason: explanation.reason,
    };
  });
}

export function forceDeliverLetter(id: string): void {
  addToList(STORAGE_KEYS.MAILBOX_DELIVERED_IDS, id);
}

export function markLetterRead(id: string): void {
  addToList(STORAGE_KEYS.MAILBOX_READ_IDS, id);
}

export function markLetterUnread(id: string): void {
  removeFromList(STORAGE_KEYS.MAILBOX_READ_IDS, id);
}

export function resetMailbox(): void {
  saveJson(STORAGE_KEYS.MAILBOX_DELIVERED_IDS, []);
  saveJson(STORAGE_KEYS.MAILBOX_READ_IDS, []);
}

export function reconcileMailboxLists(): void {
  saveJson(STORAGE_KEYS.MAILBOX_DELIVERED_IDS, unique(loadJson<string[]>(STORAGE_KEYS.MAILBOX_DELIVERED_IDS, [])));
  saveJson(STORAGE_KEYS.MAILBOX_READ_IDS, unique(loadJson<string[]>(STORAGE_KEYS.MAILBOX_READ_IDS, [])));
}
