import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeletionQueue, DELETE_UNDO_MS } from './deletion-queue';

describe('deletion queue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs a deletion only after the undo window', async () => {
    const queue = createDeletionQueue();
    const action = vi.fn(async () => 'deleted');
    const result = queue.enqueue('guest:1', 'Guest', action);

    await vi.advanceTimersByTimeAsync(DELETE_UNDO_MS - 1);
    expect(action).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    await expect(result).resolves.toBe('deleted');
    expect(action).toHaveBeenCalledOnce();
    expect(queue.getSnapshot()).toEqual([]);
  });

  it('cancels a pending deletion without calling the action', async () => {
    const queue = createDeletionQueue();
    const action = vi.fn(async () => 'deleted');
    const result = queue.enqueue('room:1', 'Room 101', action);

    expect(queue.undo('room:1')).toBe(true);
    await expect(result).resolves.toBeNull();
    await vi.advanceTimersByTimeAsync(DELETE_UNDO_MS);

    expect(action).not.toHaveBeenCalled();
    expect(queue.getSnapshot()).toEqual([]);
  });

  it('does not undo once the deletion has begun', async () => {
    const queue = createDeletionQueue();
    let finish!: (value: string) => void;
    const result = queue.enqueue('rate:1', 'Flexible rate', () => new Promise((resolve) => { finish = resolve; }));

    await vi.advanceTimersByTimeAsync(DELETE_UNDO_MS);
    expect(queue.getSnapshot()[0]?.phase).toBe('deleting');
    expect(queue.undo('rate:1')).toBe(false);
    finish('deleted');

    await expect(result).resolves.toBe('deleted');
  });
});
