import handler from 'vinext/server/fetch-handler';
import { guestDocumentService } from './lib/application/container';

export default {
  ...handler,
  async scheduled() {
    await guestDocumentService.retryDeletions();
  },
};
