import {
  forceDeliverLetter,
  getMailboxStatuses,
  markLetterRead,
  markLetterUnread,
  reconcileMailboxLists,
  resetMailbox,
} from './mailbox';
import {
  clearDiscoveryQueue,
  forceEnqueueItem,
  forceKeepItem,
  getDiscoveryState,
  repairDiscoveryLists,
  resetFoundTrinkets,
  resetKeptItems,
  triggerSampleDiscovery,
} from './discovery';
import {
  clearExampleExpenses,
  freshWipeLocalAppState,
  resetDiscoveryAndBagState,
  resetMailboxState,
  seedExampleExpenses,
  setAdminClock,
  simulateNextDay,
} from './debug-actions';
import { getAppStateSummary } from './state';
import { ITEMS, LETTERS } from './sobagi-schema';
import { readRawStorage } from './storage-adapter';
import {
  addFoundItem,
  addKeptItem,
  clearOutbox,
  deleteMessage,
  listAuditLog,
  listOutbox,
  markMessageSentLocal,
  queueOperatorMessage,
  removeFoundItem,
  removeKeptItem,
  removeQueuedItem,
  setFoundItemCount,
  setPebbleCount,
  setPendingItem,
  setQueueFront,
  setRoomStage,
  setStagedItem,
} from './operator';

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

function button(id: string, handler: () => void): void {
  byId<HTMLButtonElement>(id).addEventListener('click', () => {
    try {
      handler();
      render();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    }
  });
}

function confirmDanger(message: string, action: () => void): void {
  if (window.confirm(message)) action();
}

function escapeText(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setOptions(select: HTMLSelectElement, rows: Array<{ id: string; label: string }>): void {
  select.innerHTML = rows
    .map((row) => `<option value="${escapeText(row.id)}">${escapeText(row.id)} - ${escapeText(row.label)}</option>`)
    .join('');
}

function selectedValue(id: string): string {
  return byId<HTMLSelectElement>(id).value;
}

function inputValue(id: string): string {
  return byId<HTMLInputElement>(id).value;
}

function numberValue(id: string): number {
  const value = Number(inputValue(id));
  if (!Number.isFinite(value)) throw new Error(`${id} must be a number.`);
  return value;
}

function textareaValue(id: string): string {
  return byId<HTMLTextAreaElement>(id).value;
}

function renderOperatorOutbox(): void {
  const outbox = listOutbox();
  byId('operator-outbox').innerHTML = outbox.length === 0
    ? '<div class="row muted">empty</div>'
    : outbox.map((message) => `
      <div class="row">
        <div class="row-head">
          <div class="row-title">${escapeText(message.kind)} · ${escapeText(message.title)}</div>
          <span class="pill ${message.status === 'sent-local' ? 'ok' : 'warn'}">${escapeText(message.status)}</span>
        </div>
        <div class="muted">${escapeText(message.id)} · ${escapeText(message.target)} · ${escapeText(message.createdAt)}</div>
        <div>${escapeText(message.body)}</div>
        ${message.segmentNote ? `<div class="muted">segment: ${escapeText(message.segmentNote)}</div>` : ''}
        <details>
          <summary>Payload</summary>
          <pre class="payload">${escapeText(JSON.stringify(message, null, 2))}</pre>
        </details>
        <div class="row-actions">
          <button data-message-local="${escapeText(message.id)}" type="button">Mark sent local</button>
          <button data-message-delete="${escapeText(message.id)}" class="danger" type="button">Delete</button>
        </div>
      </div>
    `).join('');
}

function renderMailbox(): void {
  reconcileMailboxLists();
  const statuses = getMailboxStatuses();
  const delivered = statuses.filter((row) => row.delivered).length;
  const unread = statuses.filter((row) => row.delivered && !row.read).length;
  const available = statuses.filter((row) => row.state === 'available').length;

  byId('mailbox-summary').innerHTML = `
    <div><strong>${delivered}</strong> delivered</div>
    <div><strong>${unread}</strong> unread</div>
    <div><strong>${available}</strong> available but not delivered</div>
  `;

  byId('mailbox-list').innerHTML = statuses
    .map((row) => {
      const pillClass = row.state === 'read' ? 'ok' : row.state === 'unread' || row.state === 'available' ? 'warn' : '';
      const action = row.read
        ? `<button data-letter-unread="${escapeText(row.letter.id)}" type="button">Mark unread</button>`
        : `<button data-letter-read="${escapeText(row.letter.id)}" type="button">Mark read</button>`;
      return `
        <div class="row">
          <div class="row-head">
            <div class="row-title">${escapeText(row.letter.id)} · ${escapeText(row.letter.label)}</div>
            <span class="pill ${pillClass}">${escapeText(row.state)}</span>
          </div>
          <div class="muted">${escapeText(row.reason)}</div>
          <div class="row-actions">
            <button data-letter-deliver="${escapeText(row.letter.id)}" type="button">Force deliver</button>
            ${action}
          </div>
        </div>
      `;
    })
    .join('');
}

function renderDiscovery(): void {
  repairDiscoveryLists();
  const state = getDiscoveryState();
  const duplicateText = state.duplicateFoundCounts.length === 0
    ? 'none'
    : state.duplicateFoundCounts.map((row) => `${row.id} x${row.count}`).join(', ');

  byId('discovery-summary').innerHTML = `
    <div><strong>${escapeText(state.queueFront ?? 'none')}</strong> queue front item</div>
    <div><strong>${state.keptIds.length}</strong> kept items</div>
    <div><strong>${state.queue.length}</strong> queued items</div>
    <div><strong>${state.foundIds.length}</strong> found trinket entries; duplicates: ${escapeText(duplicateText)}</div>
    <div>staged: <strong>${escapeText(state.stagedId ?? 'none')}</strong></div>
    <div>pending new item: <strong>${escapeText(state.pendingNewItemId ?? 'none')}</strong></div>
    <div>last item date: <strong>${escapeText(state.lastItemDate ?? 'missing')}</strong></div>
  `;

  byId('queue-list').innerHTML = state.queue.length === 0
    ? '<div class="row muted">empty</div>'
    : state.queue.map((id, index) => `<div class="row">${index + 1}. ${escapeText(id)}</div>`).join('');

  byId('found-list').innerHTML = state.foundIds.length === 0
    ? '<div class="row muted">empty</div>'
    : state.foundIds.map((id) => `<div class="row">${escapeText(id)}</div>`).join('');
}

function renderState(): void {
  const state = getAppStateSummary();
  byId('state-summary').innerHTML = Object.entries(state)
    .map(([key, value]) => `<div>${escapeText(key)}</div><div>${escapeText(value)}</div>`)
    .join('');
}

function renderRaw(): void {
  const rows = readRawStorage();
  byId('raw-storage').textContent = JSON.stringify(rows, null, 2);
}

function renderAuditLog(): void {
  const rows = listAuditLog();
  byId('audit-log').innerHTML = rows.length === 0
    ? '<div class="row muted">empty</div>'
    : rows.slice(0, 20).map((entry) => `
      <div class="row">
        <div class="row-title">${escapeText(entry.action)}</div>
        <div>${escapeText(entry.detail)}</div>
        <div class="muted">${escapeText(entry.createdAt)}</div>
      </div>
    `).join('');
}

function wireDynamicActions(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-letter-deliver]').forEach((node) => {
    node.addEventListener('click', () => {
      forceDeliverLetter(node.dataset.letterDeliver ?? '');
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-letter-read]').forEach((node) => {
    node.addEventListener('click', () => {
      markLetterRead(node.dataset.letterRead ?? '');
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-letter-unread]').forEach((node) => {
    node.addEventListener('click', () => {
      markLetterUnread(node.dataset.letterUnread ?? '');
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-message-local]').forEach((node) => {
    node.addEventListener('click', () => {
      markMessageSentLocal(node.dataset.messageLocal ?? '');
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-message-delete]').forEach((node) => {
    node.addEventListener('click', () => {
      confirmDanger('Delete this queued operator message?', () => deleteMessage(node.dataset.messageDelete ?? ''));
      render();
    });
  });
}

function render(): void {
  renderOperatorOutbox();
  renderMailbox();
  renderDiscovery();
  renderState();
  renderRaw();
  renderAuditLog();
  wireDynamicActions();
}

function boot(): void {
  setOptions(byId<HTMLSelectElement>('letter-select'), LETTERS);
  setOptions(byId<HTMLSelectElement>('item-select'), ITEMS);
  setOptions(byId<HTMLSelectElement>('operator-item-select'), ITEMS);

  button('refresh', render);
  button('queue-message', () => {
    const message = queueOperatorMessage({
      kind: selectedValue('message-kind') === 'notice' ? 'notice' : 'letter',
      target: selectedValue('message-target') as 'local-qa' | 'all-users' | 'segment',
      title: inputValue('message-title'),
      body: textareaValue('message-body'),
      segmentNote: inputValue('message-segment'),
    });
    byId<HTMLInputElement>('message-title').value = '';
    byId<HTMLTextAreaElement>('message-body').value = '';
    byId<HTMLInputElement>('message-segment').value = '';
    window.alert(`Queued ${message.kind}: ${message.id}`);
  });
  button('clear-outbox', () => confirmDanger('Clear all queued operator messages?', clearOutbox));

  button('force-letter', () => forceDeliverLetter(selectedValue('letter-select')));
  button('reset-mailbox', () => confirmDanger('Reset delivered/read mailbox state?', resetMailbox));

  button('enqueue-item', () => forceEnqueueItem(selectedValue('item-select')));
  button('keep-item', () => forceKeepItem(selectedValue('item-select')));
  button('sample-discovery', () => {
    const id = triggerSampleDiscovery();
    window.alert(`Queued sample discovery: ${id}`);
  });
  button('clear-discovery', () => confirmDanger('Clear discovery queue?', clearDiscoveryQueue));
  button('reset-bag', () => confirmDanger('Reset kept/found/discovery state?', () => {
    resetKeptItems();
    resetFoundTrinkets();
    resetDiscoveryAndBagState();
  }));
  button('op-add-kept', () => addKeptItem(selectedValue('operator-item-select')));
  button('op-remove-kept', () => removeKeptItem(selectedValue('operator-item-select')));
  button('op-add-found', () => addFoundItem(selectedValue('operator-item-select')));
  button('op-remove-found', () => removeFoundItem(selectedValue('operator-item-select')));
  button('op-set-found-count', () => setFoundItemCount(selectedValue('operator-item-select'), numberValue('found-count')));
  button('op-set-queue-front', () => setQueueFront(selectedValue('operator-item-select')));
  button('op-remove-queued', () => removeQueuedItem(selectedValue('operator-item-select')));
  button('op-set-pending', () => setPendingItem(selectedValue('operator-item-select')));
  button('op-clear-pending', () => setPendingItem(null));
  button('op-set-staged', () => setStagedItem(selectedValue('operator-item-select')));
  button('op-clear-staged', () => setStagedItem(null));
  button('op-set-pebbles', () => setPebbleCount(numberValue('pebble-count-input')));
  button('op-set-room-stage', () => setRoomStage(numberValue('room-stage-input')));

  button('seed-expenses', seedExampleExpenses);
  button('clear-expenses', () => confirmDanger('Remove admin-seeded expenses only?', clearExampleExpenses));
  button('simulate-next-day', simulateNextDay);
  button('simulate-morning', () => setAdminClock(8));
  button('simulate-night', () => setAdminClock(23));
  button('fresh-wipe', () => confirmDanger('Delete all known Sobagi local/admin keys in this browser?', freshWipeLocalAppState));

  // Expose exact mailbox-only reset as a debug operation without adding another
  // destructive button: the header reset and this action share the same scope.
  void resetMailboxState;

  render();
}

boot();
