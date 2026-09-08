'use client';

import * as React from 'react';
import { rememberTrip } from '@/lib/trips-storage';

/**
 * Writes the confirmed booking into this browser's trip list. It renders
 * nothing: the confirmation page already says everything, and this is only
 * how the stay finds its way onto "My trips" without an account.
 */
export function RememberTrip({ reference }: { reference: string }) {
  React.useEffect(() => {
    rememberTrip(reference);
  }, [reference]);

  return null;
}
