'use client';

import * as React from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/site/modal';
import { SearchInput } from '@/components/ui/search-input';

export interface MenuPdfLine {
  name: string;
  description: string;
  price: string;
  unit: string;
}

export interface MenuPdfItem extends MenuPdfLine {
  id: string;
  category: 'service' | 'dining';
  categoryLabel: string;
  photo: string | null;
  extras: MenuPdfLine[];
}

export interface MenuPdfCopy {
  title: string;
  subtitle: string;
  extras: string;
  page: string;
  qrPrompt: string;
}

export function MenuPdfButton({
  hotelName,
  items,
  copy,
}: {
  hotelName: string;
  items: MenuPdfItem[];
  copy: MenuPdfCopy;
}) {
  const t = useAdminT();
  const [mounted, setMounted] = React.useState(false);
  const [state, setState] = React.useState<'idle' | 'creating' | 'failed' | 'done'>('idle');
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [query, setQuery] = React.useState('');
  const [publicBaseUrl, setPublicBaseUrl] = React.useState('');
  React.useEffect(() => setMounted(true), []);
  const chosenItems = items.filter((item) => selected.includes(item.id));
  const matchingItems = items.filter((item) =>
    [item.name, item.description, item.categoryLabel, ...item.extras.flatMap((extra) => [extra.name, extra.description])]
      .join(' ')
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );

  async function createPdf() {
    if (state === 'creating' || chosenItems.length === 0) return;
    setState('creating');
    try {
      const [{ Document, pdf }, { DiningMenuPdf }, { qrMatrix }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./menu-pdf-document'),
        import('@/lib/qr-matrix'),
      ]);
      const menuUrl = new URL('/services/menu', publicBaseUrl);
      menuUrl.searchParams.set('ids', chosenItems.map((item) => item.id).join(','));
      const qrImage = qrDataUrl(qrMatrix(menuUrl.toString()));
      const withPhotos = await Promise.all(chosenItems.map(async (item) => ({ ...item, photo: item.photo ? await pdfPhoto(item.photo) : null })));
      const file = await pdf(
        React.createElement(
          Document,
          { title: `${hotelName} - ${copy.title}`, author: hotelName },
          React.createElement(DiningMenuPdf, { hotelName, items: withPhotos, copy, menuUrl: menuUrl.toString(), qrImage }),
        ),
      ).toBlob();
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filenamePart(hotelName)}-food-menu.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setState('done');
      setOpen(false);
      window.setTimeout(() => setState('idle'), 5_000);
    } catch (error) {
      console.error('Could not create the service menu PDF:', error);
      setState('failed');
    }
  }

  return (
    <>
      <div className="flex flex-col items-start gap-1">
      <button type="button" onClick={() => { setSelected([]); setQuery(''); setPublicBaseUrl(window.location.origin); setState('idle'); setOpen(true); }} disabled={!mounted || items.length === 0 || state === 'creating'} className={pill('secondary')}>
        <ArrowDownTrayIcon className={cn('size-4', state === 'creating' && 'animate-bounce')} aria-hidden="true" />
        {state === 'creating' ? t('addOns.creatingPdf') : t('addOns.createPdfMenu')}
      </button>
      <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
        {state === 'failed'
          ? t('addOns.pdfFailed')
          : state === 'creating'
            ? t('addOns.creatingPdf')
            : state === 'done'
              ? t('addOns.pdfCreated')
              : items.length === 0
                ? t('addOns.noMenuItems')
                : null}
      </span>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={t('addOns.pdfChooseService')} className="sm:max-w-3xl">
        <div className="grid gap-5">
          <p className="text-sm text-muted-foreground">{t('addOns.pdfChooseDescription')}</p>
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('addOns.pdfSearchPlaceholder')}
            aria-label={t('addOns.pdfSearchPlaceholder')}
          />
          <div role="group" aria-label={t('addOns.pdfChooseService')} className="grid gap-2">
            {matchingItems.map((item) => {
              const checked = selected.includes(item.id);
              return (
                <label key={item.id} className={cn('flex cursor-pointer items-center gap-3 rounded-[18px] border p-3 transition-colors', checked ? 'border-foreground bg-stone/40' : 'border-border hover:bg-stone/40')}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setSelected((current) => checked ? current.filter((id) => id !== item.id) : [...current, item.id])}
                    className="size-4 shrink-0 accent-ink"
                  />
                  {item.photo ? (
                    <img src={item.photo} alt="" width={72} height={72} className="size-16 shrink-0 rounded-xl object-cover" />
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{item.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{item.categoryLabel} · {item.price} {item.unit}</span>
                    {item.description ? <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{item.description}</span> : null}
                    {item.extras.length ? <span className="mt-1 block text-xs text-muted-foreground">{t('addOns.pdfExtrasCount', { count: item.extras.length })}</span> : null}
                  </span>
                </label>
              );
            })}
            {matchingItems.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{t('addOns.pdfSearchEmpty')}</p> : null}
          </div>
          {state === 'failed' ? <p role="alert" className="text-sm text-danger">{t('addOns.pdfFailed')}</p> : null}
          <p className="text-xs text-muted-foreground">{t('addOns.pdfSelectedCount', { count: selected.length })}</p>
          <div>
            <label htmlFor="menu-public-url" className="block text-sm font-medium">{t('addOns.pdfPublicUrl')}</label>
            <input id="menu-public-url" type="url" value={publicBaseUrl} onChange={(event) => setPublicBaseUrl(event.target.value)} className="mt-2 w-full rounded-[18px] border border-border bg-card px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" />
            <p className="mt-1 text-xs text-muted-foreground">{t('addOns.pdfPublicUrlHint')}</p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setOpen(false)} className={pill('secondary')}>{t('addOns.pdfCancel')}</button>
            <button type="button" onClick={createPdf} disabled={chosenItems.length === 0 || state === 'creating' || !isValidBaseUrl(publicBaseUrl)} className={pill('primary')}>
              <ArrowDownTrayIcon className="size-4" aria-hidden="true" />
              {state === 'creating' ? t('addOns.creatingPdf') : t('addOns.createSelectedPdf')}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function filenamePart(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'hotel'
  );
}

async function pdfPhoto(path: string): Promise<string | null> {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement('canvas');
    canvas.width = 560;
    canvas.height = Math.round(560 * bitmap.height / bitmap.width);
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch {
    return null;
  }
}

function isValidBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
  } catch {
    return false;
  }
}

function qrDataUrl(matrix: boolean[][]): string {
  const quietZone = 4;
  const cellSize = 16;
  const size = (matrix.length + quietZone * 2) * cellSize;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);
  context.fillStyle = '#161616';
  matrix.forEach((row, y) => row.forEach((filled, x) => {
    if (filled) context.fillRect((x + quietZone) * cellSize, (y + quietZone) * cellSize, cellSize, cellSize);
  }));
  return canvas.toDataURL('image/png');
}
