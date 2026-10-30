import { afterEach, expect, it, vi } from 'vitest';
const hooks = vi.hoisted(() => ({ effects: [] as Array<() => void | (() => void)> }));
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useEffect: (effect: () => void | (() => void)) => hooks.effects.push(effect),
  useId: () => 'finance-range',
  useCallback: (callback: unknown) => callback,
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => [initial, vi.fn()],
}));
import ClubFinancePanel from './ClubFinancePanel';
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); hooks.effects = []; });
it('keeps the finance report stable on focus, tab visibility changes, and elapsed time', async () => {
  vi.useFakeTimers();
  const events = new EventTarget();
  const listeners = { addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events) };
  vi.stubGlobal('window', { ...listeners, setInterval });
  vi.stubGlobal('document', { ...listeners, hidden: false });
  const fetch = vi.fn().mockResolvedValue(Response.json({ count: 0 }));
  vi.stubGlobal('fetch', fetch);
  ClubFinancePanel({ clubId: 'club-a' });
  const cleanups = hooks.effects.map(effect => effect());
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls.map(call => call[0])).toEqual([
    '/api/admin/clubs/club-a/finance?month=all',
    expect.stringMatching(/month=\d{4}-\d{2}\.\.\d{4}-\d{2}$/),
  ]);
  events.dispatchEvent(new Event('focus'));
  events.dispatchEvent(new Event('visibilitychange'));
  await vi.advanceTimersByTimeAsync(120000);
  expect(fetch).toHaveBeenCalledTimes(2);
  cleanups.forEach(cleanup => cleanup?.());
});
