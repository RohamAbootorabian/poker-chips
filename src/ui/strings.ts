import { ErrorCode, LastAction, Street } from '@/engine/types';

export const streetName: Record<Street, string> = {
  preflop: 'پیش از فلاپ',
  flop: 'فلاپ',
  turn: 'ترن',
  river: 'ریور',
};

export const actionName: Record<LastAction, string> = {
  fold: 'فولد',
  check: 'چک',
  call: 'کال',
  bet: 'بت',
  raise: 'ریز',
  allIn: 'آل‌این',
  sb: 'بلایند کوچک',
  bb: 'بلایند بزرگ',
};

const errorText: Record<ErrorCode, string> = {
  notHost: 'فقط میزبان می‌تواند این کار را انجام دهد.',
  notAllowed: 'اجازهٔ این کار را ندارید.',
  notYourTurn: 'نوبت شما نیست.',
  wrongPhase: 'الان نمی‌شود این کار را انجام داد.',
  tableFull: 'میز پر است.',
  needTwoPlayers: 'برای شروع دست حداقل دو بازیکن با موجودی لازم است.',
  cannotCheck: 'نمی‌توانید چک کنید؛ باید کال یا فولد کنید.',
  nothingToCall: 'چیزی برای کال کردن نیست.',
  raiseTooSmall: 'مبلغ ریز کمتر از حداقل مجاز است.',
  notEnoughChips: 'موجودی کافی نیست.',
  badAmount: 'مبلغ نامعتبر است.',
  badWinners: 'برنده‌ها را درست انتخاب کنید.',
  nothingToUndo: 'چیزی برای برگرداندن نیست.',
  unknownPlayer: 'بازیکن پیدا نشد.',
};

export function describeError(e: unknown): string {
  const code = (e as { code?: string })?.code;
  if (code && code in errorText) return errorText[code as ErrorCode];
  const message = (e as Error)?.message;
  if (message === 'conflict') return 'هم‌زمان چند تغییر ثبت شد؛ دوباره تلاش کنید.';
  if (message === 'notFound') return 'میز پیدا نشد.';
  return 'ارتباط با سرور برقرار نشد. دوباره تلاش کنید.';
}
