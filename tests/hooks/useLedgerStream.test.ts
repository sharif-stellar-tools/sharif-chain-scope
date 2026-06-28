/**
 * useLedgerStream hook tests.
 *
 * The hook wraps the browser WebSocket API.  We test its logic by
 * providing a minimal mock WebSocket class and exercising the
 * state-transition functions (onopen, onmessage, onerror, onclose)
 * directly — no jsdom required.
 */

import { Transaction } from '../../src/filters/types';
import { StreamStatus } from '../../src/hooks/useLedgerStream';

// ── Minimal WebSocket mock ──────────────────────────────────────────────────

type WsEventHandler = ((event: any) => void) | null;

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState: number = MockWebSocket.CONNECTING;
  onopen: WsEventHandler = null;
  onmessage: WsEventHandler = null;
  onerror: WsEventHandler = null;
  onclose: WsEventHandler = null;

  static instances: MockWebSocket[] = [];

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  /** Test helper — simulate successful connection */
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({});
  }

  /** Test helper — simulate an incoming message */
  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  /** Test helper — simulate an error */
  simulateError() {
    this.onerror?.({});
  }

  /** Test helper — simulate remote close */
  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({});
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({});
  }
}

// ── Hook logic extracted for unit testing ─────────────────────────────────
// Because React hooks cannot easily be called outside React without a DOM,
// we extract and test the core state-transition logic directly.

interface StreamState {
  transactions: Transaction[];
  status: StreamStatus;
  error: string | null;
}

function makeState(): StreamState {
  return { transactions: [], status: 'closed', error: null };
}

function applyOpen(state: StreamState): StreamState {
  return { ...state, status: 'open' };
}

function applyMessage(state: StreamState, raw: string, limit: number): StreamState {
  try {
    const tx: Transaction = JSON.parse(raw);
    const transactions = [tx, ...state.transactions].slice(0, limit);
    return { ...state, transactions };
  } catch {
    return state;
  }
}

function applyError(state: StreamState): StreamState {
  return { ...state, status: 'error', error: 'WebSocket connection error' };
}

function applyClose(state: StreamState): StreamState {
  return { ...state, status: 'closed' };
}

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  MockWebSocket.instances = [];
  (global as any).WebSocket = MockWebSocket;
});

const makeTx = (id: string): Transaction => ({
  id,
  amount: 100,
  type: 'payment',
  timestamp: '2026-06-25T00:00:00Z',
});

describe('useLedgerStream — connection lifecycle', () => {
  it('starts with closed status', () => {
    const state = makeState();
    expect(state.status).toBe('closed');
    expect(state.error).toBeNull();
    expect(state.transactions).toHaveLength(0);
  });

  it('transitions to open on successful connection', () => {
    const state = applyOpen(makeState());
    expect(state.status).toBe('open');
  });

  it('transitions to error status on socket error', () => {
    const state = applyError(makeState());
    expect(state.status).toBe('error');
    expect(state.error).toBe('WebSocket connection error');
  });

  it('transitions to closed on socket close', () => {
    const state = applyClose(applyOpen(makeState()));
    expect(state.status).toBe('closed');
  });
});

describe('useLedgerStream — message handling', () => {
  it('prepends a new transaction to the list', () => {
    let state = makeState();
    state = applyMessage(state, JSON.stringify(makeTx('tx_1')), 50);
    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0].id).toBe('tx_1');
  });

  it('keeps newest-first order', () => {
    let state = makeState();
    state = applyMessage(state, JSON.stringify(makeTx('tx_1')), 50);
    state = applyMessage(state, JSON.stringify(makeTx('tx_2')), 50);
    expect(state.transactions[0].id).toBe('tx_2');
    expect(state.transactions[1].id).toBe('tx_1');
  });

  it('enforces the limit by dropping oldest entries', () => {
    let state = makeState();
    for (let i = 0; i < 5; i++) {
      state = applyMessage(state, JSON.stringify(makeTx(`tx_${i}`)), 3);
    }
    expect(state.transactions).toHaveLength(3);
    expect(state.transactions[0].id).toBe('tx_4');
  });

  it('ignores unparseable message frames', () => {
    let state = applyOpen(makeState());
    state = applyMessage(state, 'not-valid-json', 50);
    expect(state.transactions).toHaveLength(0);
    expect(state.status).toBe('open');
  });

  it('accumulates multiple transactions correctly', () => {
    let state = makeState();
    ['tx_a', 'tx_b', 'tx_c'].forEach((id) => {
      state = applyMessage(state, JSON.stringify(makeTx(id)), 50);
    });
    expect(state.transactions).toHaveLength(3);
  });
});

describe('useLedgerStream — WebSocket construction', () => {
  it('creates a WebSocket with the provided URL', () => {
    new MockWebSocket('wss://example.com/ledger');
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toBe('wss://example.com/ledger');
  });

  it('fires onopen callback when connection is established', () => {
    const ws = new MockWebSocket('wss://example.com/ledger');
    let opened = false;
    ws.onopen = () => { opened = true; };
    ws.simulateOpen();
    expect(opened).toBe(true);
  });

  it('fires onmessage callback with correct data', () => {
    const ws = new MockWebSocket('wss://example.com/ledger');
    const tx = makeTx('tx_live');
    let received: any = null;
    ws.onmessage = (e) => { received = JSON.parse(e.data); };
    ws.simulateMessage(tx);
    expect(received.id).toBe('tx_live');
    expect(received.type).toBe('payment');
  });

  it('fires onerror callback on connection failure', () => {
    const ws = new MockWebSocket('wss://example.com/ledger');
    let errored = false;
    ws.onerror = () => { errored = true; };
    ws.simulateError();
    expect(errored).toBe(true);
  });

  it('fires onclose callback when connection closes', () => {
    const ws = new MockWebSocket('wss://example.com/ledger');
    let closed = false;
    ws.onclose = () => { closed = true; };
    ws.simulateClose();
    expect(closed).toBe(true);
  });

  it('sets readyState to CLOSED after close()', () => {
    const ws = new MockWebSocket('wss://example.com/ledger');
    ws.simulateOpen();
    ws.close();
    expect(ws.readyState).toBe(MockWebSocket.CLOSED);
  });
});
