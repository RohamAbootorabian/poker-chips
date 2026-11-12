import { getLang } from './lang';

/**
 * A Persian card room: navy walls, a crimson (lakki) felt, ivory cards,
 * brass for chips and numbers, turquoise for "it's your turn" and winnings.
 */
export const colors = {
  bg: '#0F1830',
  felt: '#18233F', // quiet surfaces: fields, panels
  card: '#223056', // raised surfaces: secondary buttons
  line: '#2E3D66',
  text: '#F4ECDB',
  muted: '#9AA6C4',
  gold: '#D6A84A',
  goldDark: '#3B2F12',
  red: '#FF8A80',
  green: '#3FCDBB',
  turq: '#3FCDBB',
  ink: '#0F1830',
  crimson: '#8E1F2F',
  crimsonDeep: '#6C1523',
  rail: '#2B1A14',
  ivory: '#F6F0E2',
};

export const radius = 14;

/** Lalezar for titles and numbers, Vazirmatn for everything else. Both cover Persian and Latin. */
export const fonts = {
  display: 'Lalezar_400Regular',
  body: 'Vazirmatn_400Regular',
  medium: 'Vazirmatn_600SemiBold',
  bold: 'Vazirmatn_700Bold',
};

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** 12500 -> "۱۲٬۵۰۰" in Persian, "12,500" in English. */
export function fmt(n: number): string {
  const sign = n < 0 ? '−' : '';
  const digits = Math.abs(Math.round(n)).toString();
  if (getLang() === 'en') return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, '٬').replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export function fmtSigned(n: number): string {
  return n > 0 ? `+${fmt(n)}` : fmt(n);
}

/** Accepts Persian, Arabic or Latin digits; returns NaN for anything else. */
export function parseAmount(text: string): number {
  const latin = text
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٬,\s]/g, '');
  return /^\d+$/.test(latin) ? Number(latin) : NaN;
}
