'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon, ArrowRightOnRectangleIcon, CameraIcon, CheckCircleIcon, ClockIcon, ExclamationTriangleIcon, WifiIcon } from '@heroicons/react/24/outline';
import { signOutAction } from '@/app/(auth)/admin/actions';
import { setHousekeepingStatusAction } from '@/app/admin/housekeeping/actions';
import {
  cacheRooms, cachedRooms, queueChange, queuedChanges, removeChange,
  type OfflineHousekeepingChange, type OfflineRoom,
} from '@/lib/application/housekeeper-offline';
import { fieldClass, pill } from '@/lib/ui';
import { HousekeepingPhotoError, prepareHousekeepingPhoto, type HousekeepingPhotoErrorCode } from '@/lib/application/housekeeping-photo';
import styles from './housekeeper-board.module.css';

const photoErrorMessages: Record<HousekeepingPhotoErrorCode, string> = {
  invalid_type: 'Нужно фото JPEG, PNG или WebP.',
  decode_failed: 'Не удалось открыть фото. Выберите другое.',
  processing_failed: 'Не удалось обработать фото.',
  too_large: 'Фото слишком большое. Выберите другое.',
  read_failed: 'Не удалось прочитать фото.',
};

const labels = { dirty: 'Грязный', in_progress: 'В процессе', clean: 'Чисто' } as const;
const statusStyle = {
  dirty: { icon: ExclamationTriangleIcon },
  in_progress: { icon: ClockIcon },
  clean: { icon: CheckCircleIcon },
} as const;

export function HousekeeperBoard({ scope, memberName, rooms }: { scope: string; memberName: string; rooms: OfflineRoom[] }) {
  const router = useRouter();
  const [visible, setVisible] = React.useState(rooms);
  const [queued, setQueued] = React.useState<OfflineHousekeepingChange[]>([]);
  const [online, setOnline] = React.useState(true);
  const [working, setWorking] = React.useState<string | null>(null);
  const [cleaning, setCleaning] = React.useState<string | null>(null);
  const [photo, setPhoto] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
  const [note, setNote] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [selectedHotel, setSelectedHotel] = React.useState(rooms[0]?.hotelSlug ?? '');
  const [selectedFloor, setSelectedFloor] = React.useState<number | null>(null);
  const syncing = React.useRef(false);

  const hotels = [...new Map(visible.map((room) => [room.hotelSlug, room.hotelName])).entries()];
  const activeHotel = hotels.some(([slug]) => slug === selectedHotel) ? selectedHotel : (hotels[0]?.[0] ?? '');
  const hotelRooms = visible.filter((room) => room.hotelSlug === activeHotel);
  const floors = [...new Set(hotelRooms.map((room) => room.floor))].sort((a, b) => a - b);
  const activeFloor = selectedFloor !== null && floors.includes(selectedFloor) ? selectedFloor : null;
  const filteredRooms = hotelRooms.filter((room) => activeFloor === null || room.floor === activeFloor);
  const cleanCount = hotelRooms.filter((room) => room.status === 'clean').length;
  const hotelName = hotels.find(([slug]) => slug === activeHotel)?.[1];

  React.useEffect(() => {
    if (!photo) { setPhotoPreview(null); return; }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const sync = React.useCallback(async () => {
    if (syncing.current || !navigator.onLine) return;
    syncing.current = true;
    try {
      let synced = 0;
      let blocked = false;
      while (true) {
        const pending = await queuedChanges(scope);
        if (!pending.length) break;
        let failed = false;
        for (const change of pending) {
          const result = await setHousekeepingStatusAction(change.unitId, change.status, change.note, change.photoData, change.id, change.hotelSlug);
          if (!result.ok) { setMessage(result.message); failed = true; break; }
          await removeChange(change.id);
          synced += 1;
        }
        if (failed) { blocked = true; break; }
      }
      setQueued(await queuedChanges(scope));
      if (synced && !blocked) setMessage('Изменения синхронизированы.');
      router.refresh();
    } catch {
      setMessage('Сеть пока недоступна. Изменения сохранены на планшете.');
    } finally { syncing.current = false; }
  }, [scope, router]);

  React.useEffect(() => {
    setOnline(navigator.onLine);
    void (async () => {
      try {
        const pending = await queuedChanges(scope);
        setQueued(pending);
        const source = navigator.onLine ? rooms : await cachedRooms(scope);
        if (navigator.onLine) await cacheRooms(scope, rooms);
        setVisible(source.map((room) => {
          const latest = pending.filter((change) => change.unitId === room.unitId).at(-1);
          return latest ? { ...room, status: latest.status } : room;
        }));
        if (navigator.onLine && pending.length) await sync();
      } catch { setMessage('Локальное хранилище недоступно. Офлайн-сохранение не работает.'); }
    })();
    const onOnline = () => { setOnline(true); void sync(); };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, [scope, rooms, sync]);

  const change = async (unitId: string, hotelSlug: string, status: OfflineHousekeepingChange['status']) => {
    if (status === 'clean' && !photo) { setMessage('Для статуса «Чисто» добавьте фото.'); return; }
    setWorking(unitId);
    setMessage('');
    try {
      const photoData = photo ? await prepareHousekeepingPhoto(photo) : null;
      const event: OfflineHousekeepingChange = { id: crypto.randomUUID(), scope, unitId, hotelSlug, status, note: note.trim(), photoData };
      // Persist first: a connection can drop after the server commits but before the reply.
      await queueChange(event);
      setQueued(await queuedChanges(scope));
      setVisible((previous) => previous.map((room) => room.unitId === unitId ? { ...room, status } : room));
      setCleaning(null); setPhoto(null); setNote('');
      if (navigator.onLine) await sync();
      else setMessage('Сохранено на планшете. Отправится при появлении сети.');
    } catch (error) {
      setMessage(error instanceof HousekeepingPhotoError ? photoErrorMessages[error.code] : 'Не удалось сохранить изменение.');
    } finally { setWorking(null); }
  };

  return (
    <main className={styles.board}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <p className={styles.hotelName}>{hotelName ?? 'Хаускипинг'}</p>
          <h1 className={styles.title}>Мои номера</h1>
          <p className={styles.subtitle}>Ваша смена. Всё для уборки — под рукой.</p>
        </div>
        <div className={styles.staff}>
          <div><p className={styles.staffName}>{memberName}</p>
            <span className={styles.connection} data-online={online} role="status">
              <WifiIcon className="size-4" aria-hidden="true" />{online ? 'В сети' : 'Без сети'}
            </span>
          </div>
          <form action={signOutAction}><button className={pill('ghost', styles.signOut)} type="submit"><ArrowRightOnRectangleIcon className="size-5" aria-hidden="true" /><span>Выйти</span></button></form>
        </div>
      </header>
      {hotelRooms.length > 0 ? <div className={styles.progress}>
        <div className={styles.progressCopy}>
          <span><strong>{hotelRooms.length}</strong> номеров назначено</span>
          <span className={styles.progressDone}><CheckCircleIcon className="size-5" aria-hidden="true" /><strong>{cleanCount}</strong> чисто</span>
        </div>
        <div className={styles.progressTrack} role="progressbar" aria-label="Чистые номера" aria-valuemin={0} aria-valuemax={hotelRooms.length} aria-valuenow={cleanCount}>
          <div className={styles.progressFill} style={{ width: `${cleanCount / hotelRooms.length * 100}%` }} />
        </div>
      </div> : null}
      {queued.length ? <div className={styles.queueNotice} role="status">
        <ArrowPathIcon className="size-4" aria-hidden="true" /><span>Ожидают отправки: {queued.length}</span>
        {online ? <button type="button" onClick={() => void sync()} className={pill('ghost')}>Повторить</button> : null}
      </div> : null}
      {message ? <p role="alert" className={styles.notice}>{message}</p> : null}
      {visible.length > 0 ? <div className={styles.toolbar}>
        {hotels.length > 1 ? <label className="block max-w-xs text-sm font-medium">Отель
          <select value={activeHotel} onChange={(event) => { setSelectedHotel(event.target.value); setSelectedFloor(null); }} className={`${fieldClass} mt-2`}>
            {hotels.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
          </select>
        </label> : null}
        <div className={styles.floorGroup} role="group" aria-labelledby="housekeeper-floor-heading">
          <h2 id="housekeeper-floor-heading" className={styles.floorLabel}>Этаж</h2>
          <div className={styles.floorOptions}>
            <button type="button" aria-pressed={activeFloor === null} onClick={() => setSelectedFloor(null)}
              className={styles.floorOption}>
              Все этажи <span>{hotelRooms.length}</span>
            </button>
            {floors.map((floor) => <button key={floor} type="button" aria-pressed={activeFloor === floor} onClick={() => setSelectedFloor(floor)}
              className={styles.floorOption}>
              {floor} этаж <span>{hotelRooms.filter((room) => room.floor === floor).length}</span>
            </button>)}
          </div>
        </div>
        <span className={styles.shownCount}>Показано: {filteredRooms.length}</span>
      </div> : null}
      {visible.length === 0 ? <p className={styles.empty}>Назначенных номеров пока нет.</p> : (
        <div className={styles.roomGrid}>
          {filteredRooms.map((room) => {
            const queuedRoom = queued.some((item) => item.unitId === room.unitId);
            const current = statusStyle[room.status as keyof typeof statusStyle];
            const CurrentIcon = current?.icon;
            return <section key={room.unitId} className={styles.roomCard} data-status={room.status} aria-label={`Номер ${room.number}`} aria-busy={working === room.unitId}>
              <div className={styles.roomHead}>
                <div className={styles.roomMeta}>
                  <span className={styles.roomStatus}>
                    {CurrentIcon ? <CurrentIcon className="size-5" aria-hidden="true" /> : null}
                    {labels[room.status as keyof typeof labels] ?? room.status}
                  </span>
                  <span className={styles.floorTag}>{room.floor} этаж</span>
                </div>
                <div className={styles.roomIdentity}>
                  <h2 className={styles.roomNumber}>{room.number}</h2>
                  <p className={styles.roomType}>{room.roomTypeName}</p>
                </div>
              </div>
              <div className={styles.roomBody}>
              <div className={styles.statusOptions}>
                {(['dirty', 'in_progress', 'clean'] as const).map((status) => {
                  const option = statusStyle[status];
                  const Icon = option.icon;
                  return <button key={status} type="button" aria-pressed={room.status === status}
                  data-status={status} disabled={working === room.unitId} onClick={() => {
                    if (status === 'clean') {
                      if (cleaning !== room.unitId) { setPhoto(null); setNote(''); }
                      setCleaning(room.unitId);
                    } else void change(room.unitId, room.hotelSlug, status);
                  }} className={styles.statusOption}>
                  <Icon className="size-5" aria-hidden="true" />{labels[status]}
                </button>;
                })}
              </div>
              {cleaning === room.unitId ? <div className={styles.evidence}>
                <h3 className={styles.evidenceTitle}>Уборка завершена?</h3>
                <p className={styles.evidenceHint}>Добавьте фото, чтобы подтвердить чистоту номера.</p>
                <label className={styles.photoPicker}>
                  {photoPreview ? <img src={photoPreview} alt="Фото номера перед отправкой" className={styles.photoPreview} /> : <CameraIcon className="size-7" aria-hidden="true" />}
                  <span className={styles.photoLabel}>{photo ? 'Заменить фото' : 'Сделать фото или выбрать'}</span>
                  <span className={styles.photoHint}>{photo ? photo.name : 'Фото после уборки · обязательно'}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required
                    aria-label="Фото после уборки · обязательно" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} className="sr-only" />
                </label>
                <label className="mt-4 block text-sm font-medium">Проблема · необязательно
                  <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} rows={2}
                    className="mt-2 block w-full rounded-2xl border border-border bg-background p-3 focus-visible:outline-2 focus-visible:outline-accent" placeholder="Например, не работает лампа" />
                </label>
                <div className={styles.evidenceActions}>
                  <button type="button" onClick={() => { setCleaning(null); setPhoto(null); setNote(''); }} disabled={working === room.unitId} className={pill('secondary')}>Отмена</button>
                  <button type="button" onClick={() => void change(room.unitId, room.hotelSlug, 'clean')} disabled={!photo || working === room.unitId}
                    className={pill('primary', 'min-h-12 flex-1 disabled:opacity-50')}><CheckCircleIcon className="size-5" /> Подтвердить уборку</button>
                </div>
              </div> : null}
              {queuedRoom ? <p className={styles.roomPending}><ArrowPathIcon className="size-4" aria-hidden="true" />Ожидает синхронизации</p> : null}
              </div>
            </section>;
          })}
        </div>
      )}
    </main>
  );
}
