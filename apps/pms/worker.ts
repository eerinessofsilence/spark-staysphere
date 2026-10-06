import handler from 'vinext/server/fetch-handler';
import { guestDocumentService, hotelRepository } from './lib/application/container';
import { runScheduledAutomations } from './lib/application/scheduled-automations';

export default {
  ...handler,
  async scheduled() {
    await guestDocumentService.retryDeletions();
    await runScheduledAutomations(hotelRepository);
  },
};
