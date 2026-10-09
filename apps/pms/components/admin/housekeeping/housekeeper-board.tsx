'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon, ArrowRightOnRectangleIcon, CameraIcon, CheckCircleIcon, ClockIcon, ExclamationTriangleIcon, WrenchScrewdriverIcon, XMarkIcon, WifiIcon } from '@heroicons/react/24/outline';
import { signOutAction } from '@/app/(auth)/admin/actions';
import { setHousekeepingStatusAction } from '@/app/admin/housekeeping/actions';
import {
  cacheRooms, cachedRooms, queueChange, queuedChanges, removeChange,
  type OfflineHousekeepingChange, type OfflineRoom,
} from '@/lib/application/housekeeper-offline';
import { fieldClass, pill, statusBadge } from '@/lib/ui';
import { Modal } from '@/components/site/modal';
import { HousekeepingPhotoError, prepareHousekeepingPhoto, type HousekeepingPhotoErrorCode } from '@/lib/application/housekeeping-photo';
import { MAINTENANCE_ISSUE_CATEGORIES, type HousekeeperMaintenanceIssue } from '@/lib/domain/maintenance-issue';
import { maintenanceCategoryKeys, maintenanceStatusKeys } from '@/lib/i18n/admin/maintenance';
import { adminT } from '@/lib/i18n/admin/translate';
import { AdminLocaleProvider } from '@/lib/i18n/admin/context';
import { UploadDropzone } from '@/components/admin/content/upload-dropzone';
import { MaintenanceCapture } from './maintenance-capture';
import { appendMaintenancePhotos, type MaintenanceAttachment } from '@/lib/application/maintenance-photo';
import { AdminTour } from '@/components/admin/onboarding/admin-tour';
import { HOUSEKEEPER_TOUR_START_EVENT, HOUSEKEEPER_TOUR_STEPS, HOUSEKEEPER_REPORT_TOUR_START_EVENT, HOUSEKEEPER_REPORT_TOUR_STEPS } from '@/components/admin/onboarding/tour-steps';
import styles from './housekeeper-board.module.css';

const photoErrorMessages: Record<HousekeepingPhotoErrorCode, string> = {
  invalid_type: 'Нужно фото JPEG, PNG или WebP.',
  decode_failed: 'Не удалось открыть фото. Выберите другое.',
  processing_failed: 'Не удалось обработать фото.',
  too_large: 'Фото слишком большое. Выберите другое.',
  read_failed: 'Не удалось прочитать фото.',
};

const labels = { dirty: 'Грязный', in_progress: 'В процессе', clean: 'Чисто' } as const;
const reportT = adminT('ru');
const statusStyle = {
  dirty: { icon: ExclamationTriangleIcon },
  in_progress: { icon: ClockIcon },
  clean: { icon: CheckCircleIcon },
} as const;
const repairMarks = {
  Open: { Icon: WrenchScrewdriverIcon, tone: 'text-warning' },
  'In Progress': { Icon: ClockIcon, tone: 'text-accent-strong' },
  Resolved: { Icon: CheckCircleIcon, tone: 'text-success' },
};

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
  const [issueRoom, setIssueRoom] = React.useState<OfflineRoom | null>(null);
  const [issueCategory, setIssueCategory] = React.useState<string>(MAINTENANCE_ISSUE_CATEGORIES[0]);
  const [issueDescription, setIssueDescription] = React.useState('');
  const [issuePhotos, setIssuePhotos] = React.useState<MaintenanceAttachment[]>([]);
  const [captureOpen, setCaptureOpen] = React.useState(false);
  const [issuePhotoPreviews, setIssuePhotoPreviews] = React.useState<string[]>([]);
  const [issueBusy, setIssueBusy] = React.useState(false);
  const [issueMessage, setIssueMessage] = React.useState('');
  const [repairFeed, setRepairFeed] = React.useState<{ hotelSlug: string; issues: HousekeeperMaintenanceIssue[] }>({ hotelSlug: '', issues: [] });
  const [repairLoading, setRepairLoading] = React.useState(true);
  const [repairError, setRepairError] = React.useState('');
  const [repairRefresh, setRepairRefresh] = React.useState(0);
  const [hintsReady, setHintsReady] = React.useState(false);
  const issueKey = React.useRef(crypto.randomUUID());
  const issueLock = React.useRef(false);
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

  React.useEffect(() => setHintsReady(true), []);

  React.useEffect(() => {
    if (!activeHotel) { setRepairLoading(false); return; }
    setRepairLoading(true);
    setRepairError('');
    if (!online) {
      setRepairError('Нет сети: статусы ремонта могут быть неактуальны.');
      setRepairLoading(false);
      return;
    }
    let active = true;
    let fetching = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const response = await fetch(`/api/housekeeper/maintenance-issues?hotel=${encodeURIComponent(activeHotel)}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Maintenance status unavailable');
        const data = await response.json() as { issues: HousekeeperMaintenanceIssue[] };
        if (active) {
          setRepairFeed({ hotelSlug: activeHotel, issues: data.issues });
          setRepairError('');
        }
      } catch {
        if (active) setRepairError('Не удалось обновить статусы ремонта. Показанные статусы могут быть неактуальны.');
      } finally {
        fetching = false;
        if (active) setRepairLoading(false);
      }
    };
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 15_000);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [activeHotel, online, scope, repairRefresh]);

  React.useEffect(() => {
    if (!photo) { setPhotoPreview(null); return; }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  React.useEffect(() => {
    const urls = issuePhotos.map((photo) => URL.createObjectURL(photo.file));
    setIssuePhotoPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [issuePhotos]);

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

  async function submitIssue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!issueRoom || issueLock.current) return;
    issueLock.current = true;
    setIssueBusy(true);
    setIssueMessage('');
    try {
      if (!issuePhotos.length) { setIssueMessage('Добавьте хотя бы одно фото.'); return; }
      const form = new FormData();
      form.set('hotelSlug', issueRoom.hotelSlug);
      form.set('unitId', issueRoom.unitId);
      form.set('category', issueCategory);
      form.set('description', issueDescription);
      form.set('idempotencyKey', issueKey.current);
      await appendMaintenancePhotos(form, issuePhotos);
      const response = await fetch('/api/housekeeper/maintenance-issues', { method: 'POST', body: form });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        const errors: Record<string, string> = {
          notAssigned: 'Эта комната больше не назначена вам.',
          roomNotFound: 'Комната не найдена. Обновите список номеров.',
          invalidInput: 'Проверьте категорию и фотографии (до 5 снимков).',
          storageUnavailable: 'Не удалось сохранить фото. Данные формы сохранены — попробуйте ещё раз.',
          unavailable: 'Сервис недоступен. Данные формы сохранены — попробуйте ещё раз.',
        };
        setIssueMessage(errors[result?.error ?? ''] ?? 'Не удалось отправить отчёт. Проверьте соединение и попробуйте снова.');
        return;
      }
      const result = await response.json() as { created: boolean; notificationCount: number };
      setMessage(!result.created || result.notificationCount > 0
        ? `Проблема в номере ${issueRoom.number} успешно отправлена.`
        : `Проблема в номере ${issueRoom.number} сохранена. Нет Hotelier с доступом к этому отелю — уведомление не создано.`);
      setIssueRoom(null);
      setIssuePhotos([]);
      setIssueDescription('');
      setIssueCategory(MAINTENANCE_ISSUE_CATEGORIES[0]);
      issueKey.current = crypto.randomUUID();
      setRepairRefresh((current) => current + 1);
    } catch (error) {
      setIssueMessage(error instanceof HousekeepingPhotoError ? photoErrorMessages[error.code] : 'Не удалось отправить отчёт. Проверьте сеть — данные формы сохранены.');
    } finally {
      issueLock.current = false;
      setIssueBusy(false);
    }
  }

  return (
    <main className={styles.board}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <p className={styles.hotelName}>{hotelName ?? 'Хаускипинг'}</p>
          <h1 className={styles.title}>Мои номера</h1>
          <p className={styles.subtitle}>Ваша смена. Всё для уборки — под рукой.</p>
        </div>
        <div className={`${styles.staff} flex-wrap`}>
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
      {repairError ? <div role="status" className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <p>{repairError}</p>{online ? <button type="button" onClick={() => setRepairRefresh((current) => current + 1)} className={pill('ghost')}>Повторить</button> : null}
      </div> : null}
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
      {visible.length === 0 ? <p className={styles.empty}>Назначенных номеров пока нет. Попросите администратора назначить вам комнаты — после этого здесь появятся карточки и подсказки по работе.</p> : (
        <div className={styles.roomGrid}>
          {filteredRooms.map((room) => {
            const repairIssues = repairFeed.hotelSlug === room.hotelSlug ? repairFeed.issues.filter((issue) => issue.unitId === room.unitId) : [];
            const queuedRoom = queued.some((item) => item.unitId === room.unitId);
            const current = statusStyle[room.status as keyof typeof statusStyle];
            const CurrentIcon = current?.icon;
            return <section key={room.unitId} className={styles.roomCard} data-status={room.status} aria-label={`Номер ${room.number}`} aria-busy={working === room.unitId}>
              <div className={styles.roomHead} data-tour="housekeeper-room">
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
              <section data-tour="housekeeper-repairs" className="mb-4 border-b border-border pb-4" aria-label="Мои заявки на ремонт">
                <h3 className="text-sm font-semibold">Мои заявки на ремонт</h3>
                {repairIssues.length > 0 ? <ul className="mt-3 grid gap-3">{repairIssues.map((issue) => {
                  const { Icon, tone } = repairMarks[issue.status];
                  return <li key={issue.id} className="grid gap-1.5">
                    <p className="text-sm font-medium">{reportT(maintenanceCategoryKeys[issue.category])}{issue.demo ? <span className="ml-2 text-xs text-muted-foreground">Демо</span> : null}</p>
                    <span className={statusBadge('w-fit')}><Icon className={`size-4 shrink-0 ${tone}`} aria-hidden="true" />{reportT(maintenanceStatusKeys[issue.status])}</span>
                    {issue.description ? <p className="text-xs leading-relaxed text-muted-foreground">{issue.description}</p> : null}
                  </li>;
                })}</ul> : <p className="mt-2 text-xs text-muted-foreground">{repairLoading ? 'Загружаем статусы ремонта…' : repairError ? 'Статусы ремонта пока недоступны.' : 'Заявок на ремонт пока нет.'}</p>}
              </section>
              <button type="button" data-tour="housekeeper-report" disabled={!hintsReady} onClick={() => { setIssueRoom(room); setIssueMessage(''); setIssuePhotos([]); setIssueCategory(MAINTENANCE_ISSUE_CATEGORIES[0]); setIssueDescription(''); issueKey.current = crypto.randomUUID(); }} className={pill('secondary', 'mb-4 min-h-11 w-full justify-center')}>
                <WrenchScrewdriverIcon className="size-5" aria-hidden="true" /> Сообщить о проблеме
              </button>
              <div className={styles.statusOptions} data-tour="housekeeper-cleaning">
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
      <Modal open={Boolean(issueRoom)} onClose={() => { if (!issueBusy) setIssueRoom(null); }} title="Сообщить о проблеме" sheet fullScreen className="max-h-[100dvh] overflow-y-auto sm:max-h-[90dvh]">
        {issueRoom ? <form onSubmit={submitIssue} className="grid gap-5" aria-busy={issueBusy}>
          <p className="text-sm text-muted-foreground">Заметили поломку во время уборки? Прикрепите фото и опишите проблему, чтобы её передали на ремонт.</p>
          <div className="flex items-center justify-between rounded-2xl bg-stone p-4">
            <span className="text-sm text-muted-foreground">Номер комнаты</span>
            <strong className="text-lg">{issueRoom.number}</strong>
          </div>
          <label data-tour="repair-category" className="grid gap-2 text-sm font-medium">Что сломалось
            <select required value={issueCategory} onChange={(event) => setIssueCategory(event.target.value)} disabled={issueBusy} className={fieldClass}>
              {MAINTENANCE_ISSUE_CATEGORIES.map((category) => <option key={category} value={category}>{reportT(maintenanceCategoryKeys[category])}</option>)}
            </select>
          </label>
          <div data-tour="repair-photos" className="grid gap-2">
            <span className="text-sm font-medium">Фото поломки · обязательно</span>
            <p className="text-sm text-muted-foreground">Снимите сломанную вещь целиком и место повреждения крупным планом. Для кондиционера можно добавить фото дисплея с ошибкой.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {issuePhotos.map((photo, index) => <div key={`${photo.file.name}-${index}`} className="relative size-16">
                <img src={issuePhotoPreviews[index]} alt={`Фото неисправности ${index + 1}`} className="admin-grid-photo bg-stone" />
                <button type="button" aria-label={`Удалить фото ${index + 1}`} disabled={issueBusy} onClick={() => setIssuePhotos((current) => current.filter((_, i) => i !== index))} className="absolute -top-2 -right-2 grid size-11 place-items-center rounded-full bg-card text-foreground shadow-soft"><XMarkIcon className="size-5" /></button>
              </div>)}
            </div>
            {issuePhotos.length < 5 ? <div className="grid gap-3">
              <label className={pill('primary', 'min-h-12 justify-center')}><CameraIcon className="size-5" aria-hidden="true" />Сделать фото<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={issueBusy} className="sr-only" onChange={(event) => { setIssuePhotos((current) => [...current, ...Array.from(event.target.files ?? []).map((file): MaintenanceAttachment => ({ file, view: 'photo' }))].slice(0, 5)); event.currentTarget.value = ''; }} /></label>
              <AdminLocaleProvider locale="ru"><MaintenanceCapture disabled={issueBusy} onOpenChange={setCaptureOpen}
                onCapture={(attachment) => setIssuePhotos((current) => [...current, attachment].slice(0, 5))} /></AdminLocaleProvider>
              <AdminLocaleProvider locale="ru"><UploadDropzone compactMobile disabled={issueBusy} chooseLabel="Загрузить фото поломки"
                hint={reportT('maintenance.photoUploadHelp', { count: 5 - issuePhotos.length })}
                onFiles={(files) => {
                  if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) || issuePhotos.length + files.length > 5) { setIssueMessage(reportT('maintenance.reportInvalid')); return; }
                  setIssueMessage(''); setIssuePhotos((current) => [...current, ...files.map((file): MaintenanceAttachment => ({ file, view: 'photo' }))]);
                }} /></AdminLocaleProvider>
            </div> : null}
            <p className="text-xs text-muted-foreground">Можно добавить до 5 фото. При отказе в доступе к камере выберите загрузку из галереи.</p>
          </div>
          <label data-tour="repair-description" className="grid gap-2 text-sm font-medium">Подробности поломки · необязательно
            <textarea value={issueDescription} onChange={(event) => setIssueDescription(event.target.value)} maxLength={1000} rows={4} disabled={issueBusy} className={`${fieldClass} min-h-32 resize-y`} aria-describedby="maintenance-description-help" placeholder="Например: кондиционер над кроватью включается, но не охлаждает. На дисплее E4, под блоком капает вода." />
            <span id="maintenance-description-help" className="text-xs font-normal text-muted-foreground">Укажите, где находится вещь, что не работает и какие признаки поломки заметили: течь, шум, повреждение или код ошибки.</span>
          </label>
          {issueMessage ? <p role="alert" className="text-sm text-danger">{issueMessage}</p> : null}
          <button type="submit" data-tour="repair-send" disabled={issueBusy || issuePhotos.length === 0} className={pill('primary', 'min-h-12 w-full justify-center disabled:opacity-50')}>
            {issueBusy ? 'Отправляем…' : 'Отправить заявку на ремонт'}
          </button>
          {!issueBusy && !captureOpen ? <AdminLocaleProvider locale="ru">
            <AdminTour tourSteps={HOUSEKEEPER_REPORT_TOUR_STEPS} storageKey={`housekeeper-report-tour.${scope}.seen.v1`}
              startEvent={HOUSEKEEPER_REPORT_TOUR_START_EVENT} modal />
          </AdminLocaleProvider> : null}
        </form> : null}
      </Modal>
      {filteredRooms.length > 0 && !issueRoom ? <AdminLocaleProvider locale="ru">
        <AdminTour tourSteps={HOUSEKEEPER_TOUR_STEPS} storageKey={`housekeeper-tour.${scope}.seen.v1`} startEvent={HOUSEKEEPER_TOUR_START_EVENT} />
      </AdminLocaleProvider> : null}
    </main>
  );
}
