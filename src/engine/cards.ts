/** A card is rank + suit, e.g. "As", "Td", "2c". */
export type Card = string;

const RANKS = '23456789TJQKA';
const SUITS = 'shdc';

export const rankOf = (c: Card) => RANKS.indexOf(c[0]) + 2;
export const suitOf = (c: Card) => c[1];

export function newDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) deck.push(r + s);
  return deck;
}

/** Fisher–Yates. `rand(n)` must return a uniform integer in [0, n). */
export function shuffle(deck: Card[], rand: (n: number) => number): Card[] {
  const out = [...deck];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 0 high card … 8 straight flush. */
export type Category = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface HandValue {
  category: Category;
  /** Category followed by tie-breakers; compare lexicographically. */
  score: number[];
}

/** Highest card of the best straight in a set of ranks, or 0. The ace also plays low. */
function straightTop(ranks: number[]): number {
  const has = new Set(ranks);
  if (has.has(14)) has.add(1);
  for (let top = 14; top >= 5; top--) {
    let ok = true;
    for (let r = top; r > top - 5; r--) if (!has.has(r)) ok = false;
    if (ok) return top;
  }
  return 0;
}

/** Best five-card poker hand out of 5 to 7 cards. */
export function evaluate(cards: Card[]): HandValue {
  const ranks = cards.map(rankOf).sort((a, b) => b - a);
  const count = new Map<number, number>();
  for (const r of ranks) count.set(r, (count.get(r) ?? 0) + 1);
  const distinct = [...count.keys()].sort((a, b) => b - a);
  const withCount = (n: number) => distinct.filter((r) => count.get(r)! >= n);
  const kickers = (exclude: number[], n: number) => distinct.filter((r) => !exclude.includes(r)).slice(0, n);
  const value = (category: Category, rest: number[]): HandValue => ({ category, score: [category, ...rest] });

  let flush: number[] | null = null;
  for (const s of SUITS) {
    const suited = cards.filter((c) => suitOf(c) === s).map(rankOf).sort((a, b) => b - a);
    if (suited.length >= 5) flush = suited;
  }

  if (flush) {
    const top = straightTop(flush);
    if (top) return value(8, [top]);
  }
  const quads = withCount(4);
  if (quads.length) return value(7, [quads[0], ...kickers([quads[0]], 1)]);
  const trips = withCount(3);
  if (trips.length) {
    const pair = withCount(2).find((r) => r !== trips[0]);
    if (pair) return value(6, [trips[0], pair]);
  }
  if (flush) return value(5, flush.slice(0, 5));
  const top = straightTop(distinct);
  if (top) return value(4, [top]);
  if (trips.length) return value(3, [trips[0], ...kickers([trips[0]], 2)]);
  const pairs = withCount(2);
  if (pairs.length >= 2) return value(2, [pairs[0], pairs[1], ...kickers([pairs[0], pairs[1]], 1)]);
  if (pairs.length === 1) return value(1, [pairs[0], ...kickers([pairs[0]], 3)]);
  return value(0, distinct.slice(0, 5));
}

/** > 0 when `a` beats `b`, 0 on a tie. */
export function compareHands(a: HandValue, b: HandValue): number {
  for (let i = 0; i < Math.max(a.score.length, b.score.length); i++) {
    const d = (a.score[i] ?? 0) - (b.score[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
