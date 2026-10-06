import type { AdminLocale } from '../locale';
import { account } from './account';
import { assistant } from './assistant';
import { auth } from './auth';
import { catalog } from './catalog';
import { communications } from './communications';
import { content } from './content';
import { dashboard } from './dashboard';
import { frontDesk } from './frontDesk';
import { housekeeping } from './housekeeping';
import { onboarding } from './onboarding';
import { operations } from './operations';
import { orders } from './orders';
import { settings } from './settings';
import { shell } from './shell';
import { spinner } from './spinner';
import { uploads } from './uploads';
import { users } from './users';
import { guestImport } from './guestImport';

/**
 * The back office's own words, one area file per group of screens (see
 * `area.ts` for why). What each area covers:
 *
 * - `shell` — sidebar, property switcher, bell, toasts, unsaved-changes guard, page chrome
 * - `auth` — the two-step sign-in (`app/(auth)/admin`), the account menu, the interests card
 * - `dashboard` — `/admin`
 * - `account` — `/admin/account`, including the language picker
 * - `operations` — reservations (list and detail), rates, accounting, and `components/admin/operations`
 * - `frontDesk` — the front desk and the channel manager, with `components/admin/front-desk`
 *   and `components/admin/channel-manager`
 * - `communications` — the guest inbox (`/admin/communications`) and `components/admin/communications`
 * - `housekeeping` — the cleaning board and each room's own page, with `components/admin/housekeeping`
 * - `content` — the CMS's rooms and physical rooms, and the form components every CMS editor
 *   shares (`content-form`, `fields`, `delete-entity-button`, `row-actions`, media and photo editors)
 * - `catalog` — the CMS's add-ons, rate form and hotel settings
 * - `spinner` — 360 Orbit: overview, frames, markup, and `components/admin/spinner-markup`
 * - `assistant` — the admin assistant panel and its composed replies
 * - `onboarding` — the first-run guided hints (`components/admin/onboarding`) and their replay card
 * - `settings` — the unlinked preview screens: settings, team, integrations, media, reset
 *
 * As on the guest site, the hotel's own catalog copy — room and add-on names,
 * descriptions, the hotel's text — is content, not chrome, and is never here.
 */
function merge<L extends AdminLocale>(locale: L) {
  return {
    ...shell[locale],
    ...auth[locale],
    ...dashboard[locale],
    ...account[locale],
    ...operations[locale],
    ...orders[locale],
    ...frontDesk[locale],
    ...housekeeping[locale],
    ...communications[locale],
    ...content[locale],
    ...catalog[locale],
    ...spinner[locale],
    ...assistant[locale],
    ...onboarding[locale],
    ...settings[locale],
    ...uploads[locale],
    ...users[locale],
    ...guestImport[locale],
  };
}

export const ADMIN_DICTIONARIES = {
  en: merge('en'),
  de: merge('de'),
  ru: merge('ru'),
} satisfies Record<AdminLocale, Record<string, string>>;

export type AdminTranslationKey = keyof (typeof ADMIN_DICTIONARIES)['en'];
