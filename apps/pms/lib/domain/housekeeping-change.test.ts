import { describe, expect, it } from 'vitest';
import { validateHousekeepingChange } from './housekeeping-change';

describe('housekeeping evidence', () => {
  it('requires a photo for clean even if the client skips its file input', () => {
    expect(validateHousekeepingChange('clean', null, true)).toEqual({ ok: false, error: 'photoRequired' });
    expect(validateHousekeepingChange('clean', 'data:image/jpeg;base64,/9j/', true)).toEqual({ ok: true, status: 'clean' });
  });
  it('limits an attendant to three statuses and rejects unsuitable evidence', () => {
    expect(validateHousekeepingChange('inspected', null, true)).toEqual({ ok: false, error: 'invalidStatus' });
    expect(validateHousekeepingChange('dirty', null, true)).toEqual({ ok: true, status: 'dirty' });
    expect(validateHousekeepingChange('clean', 'data:text/plain;base64,SGk=', true)).toEqual({ ok: false, error: 'invalidPhoto' });
  });
});
