'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { startConversationAction } from '@/app/admin/communications/actions';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';
import { toast } from '@/components/admin/shell/toast';

/**
 * From a booking straight into its guest's thread: opens the conversation
 * this stay already has, or starts one on the site's chat channel, and
 * lands in `/admin/communications`. One button, no modal — the booking
 * already says who the guest is.
 */
export function MessageGuestButton({ reference }: { reference: string }) {
  const t = useAdminT();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await startConversationAction(reference, 'chat');
          if (!result.ok) {
            toast.error(result.message);
            return;
          }
          router.push(`/admin/communications/${result.id}`);
        })
      }
      className={pill('secondary')}
    >
      {pending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : <ChatBubbleLeftRightIcon className="size-4" aria-hidden="true" />}
      {t('booking.messageGuest')}
    </button>
  );
}
