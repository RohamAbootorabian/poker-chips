import { Card, compareHands, evaluate, newDeck, shuffle } from './cards';
import { reduce } from './engine';
import { Action, GameError, TableState } from './types';

/**
 * Server-only part of an online table. It never leaves the server:
 * players only receive their own hole cards.
 */
export interface PrivateState {
  /** Remaining deck for the current hand; the first five cards are the board. */
  deck: Card[];
  holes: Record<string, Card[]>;
  /** playerId -> secret chosen by that player's device (proves identity). */
  keys: Record<string, string>;
}

export const emptyPrivate = (): PrivateState => ({ deck: [], holes: {}, keys: {} });

const BOARD_SIZE = { preflop: 0, flop: 3, turn: 4, river: 5 } as const;

/**
 * One step of an online game: the normal betting rules plus dealing, the
 * board and an automatic showdown. Pure apart from `rand`.
 */
export function onlineStep(
  state: TableState,
  priv: PrivateState,
  action: Action,
  actorId: string,
  rand: (n: number) => number,
): { state: TableState; priv: PrivateState } {
  // The server decides winners, and undo would bring back cards already seen.
  if (action.type === 'award' || action.type === 'undo') throw new GameError('notAllowed');

  let s = reduce(state, action, actorId);
  let p = priv;
  s.undo = null;

  if (s.handNumber !== state.handNumber) {
    const deck = shuffle(newDeck(), rand);
    const holes: Record<string, Card[]> = {};
    for (const pl of s.players) if (pl.inHand) holes[pl.id] = deck.splice(0, 2);
    p = { ...priv, deck, holes };
    s.board = [];
    s.shown = {};
    s.handRanks = {};
  }

  if (s.phase === 'betting') {
    s.board = p.deck.slice(0, BOARD_SIZE[s.street]);
  } else if (s.phase === 'showdown') {
    const board = p.deck.slice(0, 5);
    s.board = board;
    const shown: Record<string, Card[]> = {};
    const ranks: Record<string, number> = {};
    const values = new Map(
      s.players
        .filter((pl) => pl.inHand && !pl.folded)
        .map((pl) => {
          const v = evaluate([...p.holes[pl.id], ...board]);
          shown[pl.id] = p.holes[pl.id];
          ranks[pl.id] = v.category;
          return [pl.id, v] as const;
        }),
    );
    for (let i = 0; i < s.pots.length; i++) {
      const pot = s.pots[i];
      if (pot.winners) continue;
      const best = pot.eligible.reduce((a, b) => (compareHands(values.get(b)!, values.get(a)!) > 0 ? b : a));
      const winnerIds = pot.eligible.filter((id) => compareHands(values.get(id)!, values.get(best)!) === 0);
      s = reduce(s, { type: 'award', potIndex: i, winnerIds }, s.hostId);
    }
    s.undo = null;
    s.shown = shown;
    s.handRanks = ranks;
  }
  return { state: s, priv: p };
}
