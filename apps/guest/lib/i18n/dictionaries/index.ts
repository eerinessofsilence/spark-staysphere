import type { Locale } from '../locale';
import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { hr } from './hr';
import { it } from './it';
import { pl } from './pl';
import { ru } from './ru';
import type { TranslationKey } from './en';
import { catalogCopy } from '../catalog-copy';

export type { TranslationKey } from './en';

function catalogDictionary(locale: Locale, base: Record<TranslationKey, string>): Record<TranslationKey, string> {
  const copy = catalogCopy(locale);
  return { ...base,
    'nav.myTrips': copy.services,
    'room.yourStay': copy.yourStay,
    'room.total': copy.total,
    'room.chooseExactRoom': copy.plan,
    'rooms.freeForYourDates': copy.match,
    'rooms.legendAvailable': copy.match,
    'rooms.availableForDatesOne': `{available} / {total} · ${copy.match}`,
    'rooms.availableForDatesOther': `{available} / {total} · ${copy.match}`,
    'rooms.forNightsTaxesIn': `{nights} · ${copy.estimate}`,
    'room.taxesIncluded': `{nights} · ${copy.estimate}`,
  };
}

export const DICTIONARIES: Record<Locale, Record<TranslationKey, string>> = {
  en: catalogDictionary('en', en), ru: catalogDictionary('ru', ru), hr: catalogDictionary('hr', hr), de: catalogDictionary('de', de),
  fr: catalogDictionary('fr', fr), it: catalogDictionary('it', it), es: catalogDictionary('es', es), pl: catalogDictionary('pl', pl),
};
