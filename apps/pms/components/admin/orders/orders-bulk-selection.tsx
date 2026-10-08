'use client';

import * as React from 'react';
import { usePreloaderRouter as useRouter } from '@/components/ui/preloader-navigation';
import { bulkSetOrderStatusAction } from '@/app/admin/orders/actions';
import type { OrderStatus } from '@/lib/domain/orders';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';
import { NativeSelect } from '@/components/ui/native-select';
import { toast } from '@/components/admin/shell/toast';
import { ORDER_STATUS_OPTIONS, orderStatusLabel } from './order-status-menu';

type OrderSelection = { id: string; status: OrderStatus };
type SelectionContextValue = {
  allSelected: boolean;
  selected: Set<string>;
  toggle: (id: string) => void;
  toggleAll: () => void;
};

const SelectionContext = React.createContext<SelectionContextValue | null>(null);

function useSelection() {
  const value = React.useContext(SelectionContext);
  if (!value) throw new Error('Order selection must be inside OrdersBulkSelection.');
  return value;
}

/** Selection is scoped to the server-filtered rows currently visible in the grid. */
export function OrdersBulkSelection({ orders, children }: { orders: OrderSelection[]; children: React.ReactNode }) {
  const t = useAdminT();
  const router = useRouter();
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [nextStatus, setNextStatus] = React.useState<OrderStatus | ''>('');
  const [pending, setPending] = React.useState(false);
  const visibleKey = orders.map((order) => order.id).join('\u0000');
  React.useEffect(() => { setSelectedIds([]); setNextStatus(''); }, [visibleKey]);
  const selected = new Set(selectedIds);
  const allSelected = orders.length > 0 && selected.size === orders.length;
  const toggle = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleAll = () => setSelectedIds(allSelected ? [] : orders.map((order) => order.id));
  const actionable = nextStatus !== '' && orders.some((order) => selected.has(order.id) && order.status !== nextStatus);

  const apply = async () => {
    if (!nextStatus || !actionable || pending) return;
    if (nextStatus === 'cancelled' && !window.confirm(t('orders.bulkCancelConfirm', { count: selected.size }))) return;
    setPending(true);
    try {
      const result = await bulkSetOrderStatusAction({ orderIds: selectedIds, status: nextStatus });
      if (result.ok) {
        toast.success(result.message);
        setSelectedIds([]);
        setNextStatus('');
      } else toast.error(result.message);
      router.refresh();
    } catch {
      toast.error(t('orders.bulkFailed'));
    } finally {
      setPending(false);
    }
  };

  return <SelectionContext.Provider value={{ allSelected, selected, toggle, toggleAll }}>
    {selected.size > 0 ? <div role="toolbar" aria-label={t('orders.bulkActions')} className="flex flex-wrap items-center gap-3 border-b border-border bg-stone/40 px-4 py-3 sm:px-6">
      <p role="status" className="mr-auto text-sm font-medium">{t('orders.bulkSelected', { count: selected.size })}</p>
      <label className="sr-only" htmlFor="orders-bulk-status">{t('orders.bulkStatus')}</label>
      <NativeSelect id="orders-bulk-status" value={nextStatus} onChange={(event) => setNextStatus(event.target.value as OrderStatus | '')} disabled={pending} className="min-w-40">
        <option value="">{t('orders.bulkStatus')}</option>
        {ORDER_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{orderStatusLabel(t, status)}</option>)}
      </NativeSelect>
      <button type="button" disabled={!actionable || pending} onClick={apply} className={pill('primary', 'disabled:cursor-not-allowed disabled:opacity-50')}>
        {pending ? t('orders.bulkApplying') : t('orders.bulkApply')}
      </button>
      <button type="button" disabled={pending} onClick={() => setSelectedIds([])} className={pill('secondary')}>
        {t('orders.bulkClear')}
      </button>
    </div> : null}
    {children}
  </SelectionContext.Provider>;
}

export function OrdersSelectAll() {
  const t = useAdminT();
  const { allSelected, selected, toggleAll } = useSelection();
  const [ready, setReady] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => setReady(true), []);
  React.useEffect(() => { if (input.current) input.current.indeterminate = selected.size > 0 && !allSelected; }, [selected, allSelected]);
  return <label className="grid size-11 place-items-center">
    <input ref={input} type="checkbox" checked={allSelected} disabled={!ready} onChange={toggleAll} aria-label={t('orders.selectAll')} className="size-5 cursor-pointer accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed" />
  </label>;
}

export function OrderSelectionCheckbox({ orderId }: { orderId: string }) {
  const t = useAdminT();
  const { selected, toggle } = useSelection();
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => setReady(true), []);
  return <label className="grid size-11 place-items-center">
    <input type="checkbox" checked={selected.has(orderId)} disabled={!ready} onChange={() => toggle(orderId)} aria-label={t('orders.selectOne', { id: orderId })} className="size-5 cursor-pointer accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed" />
  </label>;
}
