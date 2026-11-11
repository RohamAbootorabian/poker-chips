export const colors = {
  bg: '#0A1F19',
  felt: '#103A2E',
  card: '#15463A',
  line: '#22594A',
  text: '#F3EFE4',
  muted: '#9DB8AD',
  gold: '#E8BC4E',
  goldDark: '#3A2F0F',
  red: '#E0655F',
  green: '#5FD08A',
  ink: '#0A1F19',
};

export const radius = 14;

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** 12500 -> "۱۲٬۵۰۰" */
export function fmt(n: number): string {
  const sign = n < 0 ? '−' : '';
  const grouped = Math.abs(Math.round(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  return sign + grouped.replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
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
