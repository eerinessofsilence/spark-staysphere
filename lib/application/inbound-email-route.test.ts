import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The webhook's own two rules, without a server: it is closed while no
 * secret is configured or the caller presents the wrong one, and with the
 * right one a mail becomes an email-channel thread — attached to the
 * booking only when the sender is that booking's guest.
 */
const receive = vi.fn();
let secret: string | null = null;

vi.mock('@/lib/application/container', () => ({
  DEMO_HOTEL_SLUG: 'asteria-cove',
  communicationsService: { receive: (...args: unknown[]) => receive(...args) },
  inboundEmailAuthorized: (presented: string | null) => secret !== null && presented === secret,
}));

const { POST } = await import('@/app/api/inbound/email/route');

function post(body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return POST(new Request('http://localhost/api/inbound/email', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }));
}

describe('POST /api/inbound/email', () => {
  afterEach(() => {
    receive.mockReset();
    secret = null;
  });

  it('is closed without a configured secret, and to a caller with the wrong one', async () => {
    expect((await post({ from: { email: 'ada@example.com' }, text: 'Hi' })).status).toBe(401);
    secret = 's3cret';
    expect((await post({ from: { email: 'ada@example.com' }, text: 'Hi' }, { 'x-inbound-secret': 'nope' })).status).toBe(401);
    expect(receive).not.toHaveBeenCalled();
  });

  it('files a mail as an email thread, subject first, and drops a reference that is not the sender’s', async () => {
    secret = 's3cret';
    receive
      .mockResolvedValueOnce({ ok: false, error: 'bookingMismatch' })
      .mockResolvedValueOnce({ ok: true, conversation: { id: 'c1' }, message: {} });
    const response = await post(
      { from: { email: 'ada@example.com', name: 'Ada' }, subject: 'Late check-in', text: 'We land at 23:00.', reference: 'ZZZ999' },
      { 'x-inbound-secret': 's3cret' },
    );
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ conversationId: 'c1' });
    expect(receive).toHaveBeenNthCalledWith(1, 'asteria-cove', expect.objectContaining({ channel: 'email', bookingReference: 'ZZZ999', body: 'Late check-in\n\nWe land at 23:00.' }));
    expect(receive).toHaveBeenNthCalledWith(2, 'asteria-cove', expect.objectContaining({ bookingReference: null }));
  });

  it('rejects a body without a sender or text', async () => {
    secret = 's3cret';
    expect((await post({ text: 'no sender' }, { 'x-inbound-secret': 's3cret' })).status).toBe(400);
  });
});
