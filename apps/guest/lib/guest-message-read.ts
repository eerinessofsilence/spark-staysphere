/** Read receipts are local to this browser, like remembered trips. */
export function markHotelRepliesRead(reference: string, ids: string[]): void {
  try {
    localStorage.setItem(`guest-chat-read:${reference}`, JSON.stringify(ids));
  } catch {
    // Storage may be blocked.
  }
  window.dispatchEvent(new Event('guest-chat-read'));
}
