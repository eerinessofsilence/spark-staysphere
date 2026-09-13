import type { IntegrationStatus } from '@/lib/domain/schemas';

export const adapterLabels: Record<IntegrationStatus['adapter'], string> = {
  pms: 'Property management system',
  channel_manager: 'Channel manager',
  booking_engine: 'Booking engine',
  payment: 'Payment provider',
  crm: 'CRM',
};
