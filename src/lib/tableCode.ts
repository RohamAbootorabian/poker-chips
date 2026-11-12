// Pure (no React Native imports) so it can be unit-tested in Node.

/**
 * The table code inside a scanned or pasted text: a table link
 * (".../table/ABCDE") or just the code. null when it is neither.
 */
export function parseTableCode(text: string): string | null {
  const s = text.trim();
  const fromLink = s.match(/\/table\/([A-Za-z0-9]{4,8})(?:[/?#]|$)/);
  if (fromLink) return fromLink[1].toUpperCase();
  if (/^[A-Za-z0-9]{4,8}$/.test(s)) return s.toUpperCase();
  return null;
}
