'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import { assignHousekeepingRoomAction } from '@/app/admin/housekeeping/actions';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/site/modal';
import { toast } from '@/components/admin/shell/toast';
import { Select } from '@/components/admin/content/fields';
import { SearchInput } from '@/components/ui/search-input';

export interface AssignableRoom {
  unitId: string;
  number: string;
  floor: number;
  roomTypeName: string;
  currentAssigneeName: string | null;
}

/**
 * The header's own way to hand several rooms to one housekeeper at once —
 * the per-row select (`HousekeepingAssigneeSelect`) is fine for one room at
 * a time, but not for handing someone their whole floor. The picker is
 * restricted to `housekeepers` (role `Housekeeper` only, already filtered
 * by the page — `assignHousekeepingRoomAction` enforces the same role
 * server-side regardless), and each checked room gets the same person
 * through that one action, room by room.
 */
export function AssignHousekeeperButton({ rooms, housekeepers }: { rooms: AssignableRoom[]; housekeepers: { id: string; name: string }[] }) {
  const t = useAdminT();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [housekeeperId, setHousekeeperId] = React.useState(housekeepers[0]?.id ?? '');
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = React.useState(false);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rooms;
    return rooms.filter((room) => `${room.number} ${room.floor} ${room.roomTypeName}`.toLowerCase().includes(needle));
  }, [rooms, query]);

  const close = React.useCallback(() => {
    setOpen(false);
    setQuery('');
    setSelected(new Set());
  }, []);

  function toggle(unitId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  }

  async function submit() {
    const housekeeper = housekeepers.find((member) => member.id === housekeeperId);
    if (!housekeeper || selected.size === 0) return;
    setSubmitting(true);
    const results = await Promise.all([...selected].map((unitId) => assignHousekeepingRoomAction(unitId, housekeeperId)));
    setSubmitting(false);
    const ok = results.filter((result) => result.ok).length;
    if (ok === results.length) {
      toast.success(t('housekeeping.bulkAssignSuccess', { count: ok, name: housekeeper.name }));
      close();
      router.refresh();
    } else if (ok > 0) {
      toast.error(t('housekeeping.bulkAssignPartial', { ok, total: results.length, name: housekeeper.name }));
      router.refresh();
    } else {
      toast.error(t('housekeeping.bulkAssignFailed'));
    }
  }

  if (housekeepers.length === 0) {
    return null;
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={pill('secondary')}>
        <UserPlusIcon className="size-4" aria-hidden="true" />
        {t('housekeeping.bulkAssign')}
      </button>

      <Modal open={open} onClose={close} title={t('housekeeping.bulkAssignTitle')} className="sm:max-w-lg">
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground">{t('housekeeping.bulkAssignBody')}</p>

          <label className="grid gap-1.5 text-sm">
            {t('housekeeping.bulkAssignWho')}
            <Select id="bulk-assign-housekeeper" value={housekeeperId} onChange={setHousekeeperId}>
              {housekeepers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          </label>

          <div>
            <label htmlFor="bulk-assign-search" className="mb-1.5 block text-sm text-muted-foreground">
              {t('housekeeping.bulkAssignSearchLabel')}
            </label>
            <SearchInput
              id="bulk-assign-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              suggestions={rooms.map((room) => ({ value: room.number, label: room.number, detail: `${room.roomTypeName} · ${room.floor}` }))}
              suggestionsLabel={t('housekeeping.bulkAssignSearchLabel')}
              onSuggestionSelect={(item) => setQuery(item.value)}
              placeholder={t('housekeeping.bulkAssignSearchPlaceholder')}
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('housekeeping.bulkAssignCount', { count: selected.size })}</span>
            <span className="flex gap-3">
              <button type="button" onClick={() => setSelected(new Set(filtered.map((room) => room.unitId)))} className="font-medium underline underline-offset-2 hover:text-accent-strong">
                {t('housekeeping.bulkAssignSelectAll')}
              </button>
              <button type="button" onClick={() => setSelected(new Set())} className="font-medium underline underline-offset-2 hover:text-accent-strong">
                {t('housekeeping.bulkAssignClear')}
              </button>
            </span>
          </div>

          <ul className="grid max-h-64 gap-1 overflow-y-auto rounded-2xl border border-border p-1.5">
            {filtered.length === 0 ? (
              <li className="p-3 text-sm text-muted-foreground">{t('housekeeping.bulkAssignNoMatch')}</li>
            ) : (
              filtered.map((room) => (
                <li key={room.unitId}>
                  <label className={cn('flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm hover:bg-stone', selected.has(room.unitId) && 'bg-stone')}>
                    <input
                      type="checkbox"
                      checked={selected.has(room.unitId)}
                      onChange={() => toggle(room.unitId)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{room.number}</span>
                      <span className="text-muted-foreground"> · {room.roomTypeName}</span>
                    </span>
                    {room.currentAssigneeName ? (
                      <span className="shrink-0 text-xs text-muted-foreground">{t('housekeeping.bulkAssignAlready', { name: room.currentAssigneeName })}</span>
                    ) : null}
                  </label>
                </li>
              ))
            )}
          </ul>

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={close} className={pill('secondary')}>
              {t('frontDesk.cancel')}
            </button>
            <button type="button" onClick={submit} disabled={submitting || !housekeeperId || selected.size === 0} className={pill('primary')}>
              {submitting ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
              {submitting ? t('housekeeping.bulkAssignSubmitting') : t('housekeeping.bulkAssignSubmit')}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
