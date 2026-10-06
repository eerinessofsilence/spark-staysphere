export const DELETE_UNDO_MS = 6000;

export interface PendingDeletion {
  key: string;
  label: string;
  deadline: number;
  phase: 'waiting' | 'deleting';
}

/** Browser-session queue: navigation must not shorten the undo window. */
export function createDeletionQueue() {
  let items: PendingDeletion[] = [];
  const listeners = new Set<() => void>();
  const cancellations = new Map<string, () => void>();
  const emit = () => listeners.forEach((listener) => listener());
  const remove = (key: string) => {
    cancellations.delete(key);
    items = items.filter((item) => item.key !== key);
    emit();
  };

  return {
    getSnapshot: () => items,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    enqueue<T>(key: string, label: string, action: () => Promise<T>): Promise<T | null> {
      if (items.some((item) => item.key === key)) return Promise.resolve(null);
      items = [...items, { key, label, deadline: Date.now() + DELETE_UNDO_MS, phase: 'waiting' }];
      const result = new Promise<T | null>((resolve, reject) => {
        const timer = setTimeout(async () => {
          cancellations.delete(key);
          items = items.map((item) => item.key === key ? { ...item, phase: 'deleting' } : item);
          emit();
          try {
            resolve(await action());
          } catch (error) {
            reject(error);
          } finally {
            remove(key);
          }
        }, DELETE_UNDO_MS);
        cancellations.set(key, () => {
          clearTimeout(timer);
          remove(key);
          resolve(null);
        });
      });
      emit();
      return result;
    },
    undo(key: string) {
      const item = items.find((candidate) => candidate.key === key);
      if (!item || item.phase !== 'waiting' || Date.now() >= item.deadline) return false;
      cancellations.get(key)?.();
      return true;
    },
    // Reloading/closing before commit safely abandons the deletion, including bfcache restores.
    cancelWaiting() {
      for (const cancel of cancellations.values()) cancel();
    },
  };
}

export const deletionQueue = createDeletionQueue();
