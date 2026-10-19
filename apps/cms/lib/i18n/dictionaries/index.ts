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

export type { TranslationKey } from './en';

export const DICTIONARIES: Record<Locale, Record<TranslationKey, string>> = { en, ru, hr, de, fr, it, es, pl };
