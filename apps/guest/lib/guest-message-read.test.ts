import { afterEach, expect, test, vi } from 'vitest';
import { markHotelRepliesRead } from './guest-message-read';

afterEach(() => vi.unstubAllGlobals());

test('read replies are stored per reservation and notify mounted views', () => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
  const dispatchEvent = vi.fn();
  vi.stubGlobal('window', { dispatchEvent });
  markHotelRepliesRead('FIRST', ['one']);
  markHotelRepliesRead('SECOND', ['two']);
  expect(values.get('guest-chat-read:FIRST')).toBe('["one"]');
  expect(values.get('guest-chat-read:SECOND')).toBe('["two"]');
  expect(dispatchEvent).toHaveBeenCalledTimes(2);
});

test('blocked storage does not break notifications', () => {
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  expect(() => markHotelRepliesRead('FIRST', ['one'])).not.toThrow();
});
