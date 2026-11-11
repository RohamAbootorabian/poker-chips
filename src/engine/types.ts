export type Street = 'preflop' | 'flop' | 'turn' | 'river';

/**
 * lobby     – before the first hand
 * betting   – a hand is in progress and someone has to act
 * showdown  – betting is over; the host picks the winner(s) of each pot
 * handOver  – chips have been paid out, waiting for the next hand
 */
export type Phase = 'lobby' | 'betting' | 'showdown' | 'handOver';

export type LastAction = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allIn' | 'sb' | 'bb';

export interface Player {
  id: string;
  name: string;
  /** Chips the player has behind (not counting chips already in the pot). */
  stack: number;
  /** Total chips bought since joining; `stack - buyIn` is the player's result. */
  buyIn: number;
  sittingOut: boolean;
  /** Left the table for good. Kept in the list so the ledger stays complete. */
  left: boolean;

  // --- per-hand state ---
  inHand: boolean;
  folded: boolean;
  allIn: boolean;
  /** Chips put in on the current street. */
  bet: number;
  /** Chips put in over the whole hand. */
  committed: number;
  /** Has acted since the last full bet/raise. */
  acted: boolean;
  lastAction: LastAction | null;
  /** Chips collected from pots this hand. */
  won: number;
  /** Result of the last finished hand (won - committed). */
  handNet: number;
}

export interface Pot {
  amount: number;
  /** Players who can win this pot. */
  eligible: string[];
  /** null until awarded. */
  winners: string[] | null;
}

export interface Settings {
  smallBlind: number;
  bigBlind: number;
  /** Default buy-in given to a player who joins. */
  buyIn: number;
}

export interface TableState {
  code: string;
  hostId: string;
  settings: Settings;
  players: Player[];
  phase: Phase;
  handNumber: number;
  dealerId: string | null;
  street: Street;
  /** Highest street bet that has to be matched. */
  currentBet: number;
  /** Minimum size of the next raise (on top of currentBet). */
  minRaise: number;
  turnId: string | null;
  pots: Pot[];
  /** JSON snapshot of the state before the last game action (single-level undo). */
  undo: string | null;
}

export type Action =
  | { type: 'join'; playerId: string; name: string }
  | { type: 'sitOut'; playerId: string; value: boolean }
  | { type: 'leave'; playerId: string }
  | { type: 'rebuy'; playerId: string; amount: number }
  | { type: 'settings'; settings: Settings }
  | { type: 'startHand' }
  | { type: 'fold'; playerId: string }
  | { type: 'check'; playerId: string }
  | { type: 'call'; playerId: string }
  /** Bet or raise so that the player's street bet becomes `to`. */
  | { type: 'raise'; playerId: string; to: number }
  | { type: 'allIn'; playerId: string }
  | { type: 'award'; potIndex: number; winnerIds: string[] }
  | { type: 'undo' };

export type ErrorCode =
  | 'notHost'
  | 'notAllowed'
  | 'notYourTurn'
  | 'wrongPhase'
  | 'tableFull'
  | 'needTwoPlayers'
  | 'cannotCheck'
  | 'nothingToCall'
  | 'raiseTooSmall'
  | 'notEnoughChips'
  | 'badAmount'
  | 'badWinners'
  | 'nothingToUndo'
  | 'unknownPlayer';

export class GameError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode) {
    super(code);
    this.code = code;
  }
}
