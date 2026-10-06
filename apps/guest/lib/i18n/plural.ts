import type { Locale } from './locale';

export interface PluralForms {
  one: string;
  /** 2–4 in the Slavic languages below; falls back to `other` where a language does not distinguish it. */
  few?: string;
  /** 5+ (and 11–14) in the Slavic languages below; falls back to `other`. */
  many?: string;
  other: string;
}

const SLAVIC_THREE_FORM = new Set<Locale>(['ru', 'hr', 'pl']);

/**
 * English-shaped one/other for most of the picker's languages; the CLDR
 * one/few/many rule (n%10==1 excluding …11, n%10 in 2–4 excluding …12–14,
 * otherwise "many") for the three Slavic ones. Not the full CLDR table for
 * those three — Polish and Croatian each have their own smaller wrinkles —
 * but this is the shape that gets every count this product actually shows
 * (nights, guests, rooms, services, all well under 100) right.
 */
export function pluralForm(locale: Locale, count: number, forms: PluralForms): string {
  const n = Math.abs(Math.trunc(count));
  if (SLAVIC_THREE_FORM.has(locale)) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return forms.one;
    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return forms.few ?? forms.other;
    return forms.many ?? forms.other;
  }
  return n === 1 ? forms.one : forms.other;
}

/** `count word` — the shape every quantity in this product takes. */
export function pluralCount(locale: Locale, count: number, forms: PluralForms): string {
  return `${count} ${pluralForm(locale, count, forms)}`;
}
