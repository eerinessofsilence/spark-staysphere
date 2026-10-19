'use client';

import { useSyncExternalStore } from 'react';
import { useAdminT } from '@/lib/i18n/admin/context';
import { deletionQueue, type PendingDeletion } from './deletion-queue';
import { toast } from './toast';

const empty: PendingDeletion[] = [];

export function usePendingDeletions() {
  return useSyncExternalStore(deletionQueue.subscribe, deletionQueue.getSnapshot, () => empty);
}

export function useUndoableDelete() {
  const t = useAdminT();
  return async function deferDelete<T>(key: string, label: string, action: () => Promise<T>) {
    try {
      return await deletionQueue.enqueue(key, label, action);
    } catch {
      toast.error(t('toast.deleteFailed'));
      return null;
    }
  };
}
