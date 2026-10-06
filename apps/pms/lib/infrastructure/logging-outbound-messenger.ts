import type { OutboundMessenger } from '../domain/ports';

/**
 * The demo's carrier for email, WhatsApp and SMS replies: it writes the
 * message to the log and delivers nothing. A Worker has no mailer of its
 * own, and the demo has no provider account, so this is the honest stand-in
 * — the reply is still in the thread for the desk to see. Production swaps
 * this for a provider adapter (Resend or MailChannels for email, Twilio or
 * the WhatsApp Cloud API for the others) behind the same `OutboundMessenger`.
 */
export const loggingOutboundMessenger: OutboundMessenger = {
  async send(input) {
    const to = input.channel === 'email' ? input.to.email : (input.to.phone ?? input.to.email);
    const designed = input.html ? ' (designed HTML available)' : '';
    console.info(`[outbound:${input.channel}] to ${to} (${input.guestName}) from ${input.hotelName}: ${input.body}${designed}`);
    return 'demo_only';
  },
};
