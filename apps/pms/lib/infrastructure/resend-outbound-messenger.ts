import type { OutboundMessenger } from '../domain/ports';

const RESEND_BASE_URL = 'https://api.resend.com';

/**
 * The real carrier for outbound email, behind the same `OutboundMessenger`
 * shape `loggingOutboundMessenger` fills when no key is configured — see
 * `container.ts`, which is the only place that decides between the two.
 * WhatsApp and SMS have no provider here yet; this factory is only ever
 * handed a `channel: 'email'` call.
 */
export function createResendOutboundMessenger(apiKey: string, fromEmail: string): OutboundMessenger {
  return {
    async send(input) {
      const response = await fetch(`${RESEND_BASE_URL}/emails`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${input.hotelName} <${fromEmail}>`,
          to: [input.to.email],
          subject: input.subject ?? `Message from ${input.hotelName}`,
          text: input.body,
          // The designed alternative an automation carries (`lib/application/email-html.ts`); a desk's own reply has none and stays text-only.
          ...(input.html ? { html: input.html } : {}),
        }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Resend responded ${response.status}: ${detail}`);
      }
      return 'accepted';
    },
  };
}
