import { Platform } from 'react-native';

/** The public website. Native apps link here too, so a link works on any phone. */
export const SITE_URL = 'https://poker-chips.expo.app';

/** Address that opens a table directly. On the website it follows the current host (e.g. a preview deploy). */
export function tableUrl(code: string): string {
  const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : SITE_URL;
  return `${origin}/table/${code}`;
}

export { parseTableCode } from './tableCode';

/** The text sent with an invite. Always English, whatever the app language, so every friend can read it. */
export function inviteText(code: string, hostName: string): string {
  return `You're invited to table ${code} by ${hostName.trim() || 'a friend'}\n${tableUrl(code)}`;
}
