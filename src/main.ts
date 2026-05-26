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
import { ALL_STORAGE_KEYS, ITEMS, LETTERS } from './sobagi-schema';
import { readRawStorage, readRawValue, removeKey, saveRawJson } from './storage-adapter';
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
  setLastEmotion,
  setLastVisitDate,
  setPendingItem,
  setQueueFront,
  setRoomStage,
  setUserCounts,
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
  if (!Number.isFinite(value)) throw new Error(`${id}에는 숫자를 입력해야 합니다.`);
  return value;
}

function textareaValue(id: string): string {
  return byId<HTMLTextAreaElement>(id).value;
}

function renderOperatorOutbox(): void {
  const outbox = listOutbox();
  byId('operator-outbox').innerHTML = outbox.length === 0
    ? '<div class="row muted">작성된 페이로드가 없습니다.</div>'
    : outbox.map((message) => `
      <div class="row">
        <div class="row-head">
          <div class="row-title">${escapeText(message.kind === 'notice' ? '공지' : '편지')} · ${escapeText(message.title)}</div>
          <span class="pill ${message.status === 'sent-local' ? 'ok' : 'warn'}">${escapeText(statusLabel(message.status))}</span>
        </div>
        <div class="muted">${escapeText(message.id)} · ${escapeText(targetLabel(message.target))} · ${escapeText(message.createdAt)}</div>
        <div>${escapeText(message.body)}</div>
        ${message.segmentNote ? `<div class="muted">대상 메모: ${escapeText(message.segmentNote)}</div>` : ''}
        <details>
          <summary>페이로드 보기</summary>
          <pre class="payload">${escapeText(JSON.stringify(message, null, 2))}</pre>
        </details>
        <div class="row-actions">
          <button data-message-local="${escapeText(message.id)}" type="button">로컬 발송 처리</button>
          <button data-message-delete="${escapeText(message.id)}" class="danger" type="button">삭제</button>
        </div>
      </div>
    `).join('');
}

function statusLabel(status: string): string {
  if (status === 'sent-local') return '로컬 발송됨';
  if (status === 'queued') return '대기 중';
  return status;
}

function targetLabel(target: string): string {
  if (target === 'local-qa') return '로컬 QA';
  if (target === 'all-users') return '전체 사용자';
  if (target === 'segment') return '세그먼트';
  return target;
}

function renderMailbox(): void {
  reconcileMailboxLists();
  const statuses = getMailboxStatuses();
  const delivered = statuses.filter((row) => row.delivered).length;
  const unread = statuses.filter((row) => row.delivered && !row.read).length;
  const available = statuses.filter((row) => row.state === 'available').length;

  byId('mailbox-summary').innerHTML = `
    <div><strong>${delivered}</strong>개 전달됨</div>
    <div><strong>${unread}</strong>개 안 읽음</div>
    <div><strong>${available}</strong>개 조건 충족, 미전달</div>
  `;

  byId('mailbox-list').innerHTML = statuses
    .map((row) => {
      const pillClass = row.state === 'read' ? 'ok' : row.state === 'unread' || row.state === 'available' ? 'warn' : '';
      const action = row.read
        ? `<button data-letter-unread="${escapeText(row.letter.id)}" type="button">안 읽음 처리</button>`
        : `<button data-letter-read="${escapeText(row.letter.id)}" type="button">읽음 처리</button>`;
      return `
        <div class="row">
          <div class="row-head">
            <div class="row-title">${escapeText(row.letter.id)} · ${escapeText(row.letter.label)}</div>
            <span class="pill ${pillClass}">${escapeText(letterStateLabel(row.state))}</span>
          </div>
          <div class="muted">${escapeText(row.reason)}</div>
          <div class="row-actions">
            <button data-letter-deliver="${escapeText(row.letter.id)}" type="button">강제 전달</button>
            ${action}
          </div>
        </div>
      `;
    })
    .join('');
}

function letterStateLabel(state: string): string {
  const labels: Record<string, string> = {
    read: '읽음',
    unread: '안 읽음',
    available: '전달 가능',
    scheduled: '예약됨',
    'condition-unmet': '조건 미충족',
    'already-delivered': '이미 전달됨',
  };
  return labels[state] ?? state;
}

function renderDiscovery(): void {
  repairDiscoveryLists();
  const state = getDiscoveryState();
  const duplicateText = state.duplicateFoundCounts.length === 0
    ? '없음'
    : state.duplicateFoundCounts.map((row) => `${row.id} x${row.count}`).join(', ');

  byId('discovery-summary').innerHTML = `
    <div>대기열 맨 앞: <strong>${escapeText(state.queueFront ?? '없음')}</strong></div>
    <div>보관 아이템: <strong>${state.keptIds.length}</strong>개</div>
    <div>대기열 아이템: <strong>${state.queue.length}</strong>개</div>
    <div>발견 기록: <strong>${state.foundIds.length}</strong>개 · 중복: ${escapeText(duplicateText)}</div>
    <div>staged: <strong>${escapeText(state.stagedId ?? '없음')}</strong></div>
    <div>pending: <strong>${escapeText(state.pendingNewItemId ?? '없음')}</strong></div>
    <div>마지막 아이템 날짜: <strong>${escapeText(state.lastItemDate ?? '없음')}</strong></div>
  `;

  byId('queue-list').innerHTML = state.queue.length === 0
    ? '<div class="row muted">비어 있음</div>'
    : state.queue.map((id, index) => `<div class="row">${index + 1}. ${escapeText(id)}</div>`).join('');

  byId('found-list').innerHTML = state.foundIds.length === 0
    ? '<div class="row muted">비어 있음</div>'
    : state.foundIds.map((id) => `<div class="row">${escapeText(id)}</div>`).join('');
}

function renderState(): void {
  const state = getAppStateSummary();
  byId('state-summary').innerHTML = Object.entries(state)
    .map(([key, value]) => `<div>${escapeText(stateKeyLabel(key))}</div><div>${escapeText(value)}</div>`)
    .join('');
}

function stateKeyLabel(key: string): string {
  const labels: Record<string, string> = {
    recordedDaysCount: '기록일 수',
    currentStreak: '현재 연속 기록',
    totalRecordCount: '전체 기록 수',
    todaysRecordCount: '오늘 기록 수',
    todaysSpendingCount: '오늘 지출 기록',
    todaysIncomeCount: '오늘 들어온 기록',
    todaysNoSpend: '오늘 무지출 여부',
    currentEmotion: '현재 감정',
    roomStage: '방 단계',
    lastVisitDate: '마지막 방문일',
    discoveryMigrationDone: '발견 마이그레이션 완료',
    stagedItemId: 'staged 아이템',
    pendingNewItemId: 'pending 아이템',
    pebbleCount: '조약돌 수',
    restsToday: '오늘 쉰 횟수',
    lastRestDate: '마지막 쉰 날짜',
    lastRestAt: '마지막 쉰 시각',
    adminClockOverride: '관리자 시계 override',
    rawKeysPresent: '존재하는 스토리지 키 수',
  };
  return labels[key] ?? key;
}

function renderRaw(): void {
  const rows = readRawStorage();
  byId('raw-storage').textContent = JSON.stringify(rows, null, 2);
}

function renderAuditLog(): void {
  const rows = listAuditLog();
  byId('audit-log').innerHTML = rows.length === 0
    ? '<div class="row muted">아직 작업 로그가 없습니다.</div>'
    : rows.slice(0, 20).map((entry) => `
      <div class="row">
        <div class="row-title">${escapeText(entry.action)}</div>
        <div>${escapeText(entry.detail)}</div>
        <div class="muted">${escapeText(entry.createdAt)}</div>
      </div>
    `).join('');
}

function loadRawEditor(): void {
  const key = selectedValue('raw-key-select');
  byId<HTMLTextAreaElement>('raw-editor').value = readRawValue(key);
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
      confirmDanger('이 운영자 페이로드를 삭제할까요?', () => deleteMessage(node.dataset.messageDelete ?? ''));
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
  setOptions(byId<HTMLSelectElement>('raw-key-select'), ALL_STORAGE_KEYS.map((key) => ({ id: key, label: key })));

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
    window.alert(`${message.kind === 'notice' ? '공지' : '편지'} 페이로드 생성: ${message.id}`);
  });
  button('clear-outbox', () => confirmDanger('작성함의 모든 운영자 페이로드를 비울까요?', clearOutbox));

  button('force-letter', () => forceDeliverLetter(selectedValue('letter-select')));
  button('reset-mailbox', () => confirmDanger('전달/읽음 우편함 상태를 초기화할까요?', resetMailbox));

  button('enqueue-item', () => forceEnqueueItem(selectedValue('item-select')));
  button('keep-item', () => forceKeepItem(selectedValue('item-select')));
  button('sample-discovery', () => {
    const id = triggerSampleDiscovery();
    window.alert(`샘플 발견 대기열 추가: ${id}`);
  });
  button('clear-discovery', () => confirmDanger('발견 대기열을 비울까요?', clearDiscoveryQueue));
  button('reset-bag', () => confirmDanger('보관/발견/대기열 상태를 초기화할까요?', () => {
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
  button('op-set-user-counts', () => setUserCounts({
    recordedDaysCount: numberValue('recorded-days-input'),
    streak: numberValue('streak-input'),
    totalRecordCount: numberValue('total-record-input'),
  }));
  button('op-set-emotion', () => setLastEmotion(selectedValue('emotion-select')));
  button('op-set-pebbles', () => setPebbleCount(numberValue('pebble-count-input')));
  button('op-set-room-stage', () => setRoomStage(numberValue('room-stage-input')));
  button('op-set-last-visit', () => setLastVisitDate(inputValue('last-visit-input')));

  button('seed-expenses', seedExampleExpenses);
  button('clear-expenses', () => confirmDanger('관리자가 심은 예시 기록만 제거할까요?', clearExampleExpenses));
  button('simulate-next-day', simulateNextDay);
  button('simulate-morning', () => setAdminClock(8));
  button('simulate-night', () => setAdminClock(23));
  button('fresh-wipe', () => confirmDanger('이 브라우저의 알려진 소박이 로컬/관리자 키를 모두 삭제할까요?', freshWipeLocalAppState));
  button('load-raw-key', loadRawEditor);
  button('save-raw-key', () => {
    const key = selectedValue('raw-key-select');
    confirmDanger(`${key} 값을 직접 저장할까요? JSON 구조가 틀리면 앱 상태가 깨질 수 있습니다.`, () => {
      saveRawJson(key, textareaValue('raw-editor'));
    });
  });
  button('remove-raw-key', () => {
    const key = selectedValue('raw-key-select');
    confirmDanger(`${key} 키를 삭제할까요?`, () => removeKey(key));
  });

  // Expose exact mailbox-only reset as a debug operation without adding another
  // destructive button: the header reset and this action share the same scope.
  void resetMailboxState;

  render();
}

boot();
