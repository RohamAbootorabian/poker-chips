import 'expo-sqlite/localStorage/install';

export type Lang = 'fa' | 'en';

const KEY = 'pc.lang';
const listeners = new Set<() => void>();
let current: Lang = localStorage.getItem(KEY) === 'en' ? 'en' : 'fa';

export const getLang = () => current;
export const isRTL = () => current === 'fa';

/** The root layout re-mounts the app when this changes, so screens can read the language while rendering. */
export function setLang(lang: Lang) {
  if (lang === current) return;
  current = lang;
  localStorage.setItem(KEY, lang);
  listeners.forEach((fn) => fn());
}

export function subscribeLang(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// Layout helpers: Persian reads right-to-left, English left-to-right.
export const rowDir = () => (isRTL() ? 'row-reverse' : 'row') as 'row' | 'row-reverse';
export const startAlign = () => (isRTL() ? 'right' : 'left') as 'left' | 'right';
export const endAlign = () => (isRTL() ? 'left' : 'right') as 'left' | 'right';
