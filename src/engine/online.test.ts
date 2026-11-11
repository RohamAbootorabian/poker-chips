import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compareHands, evaluate, newDeck, shuffle } from './cards';
import { createTable, legalActions, reduce } from './engine';
import { emptyPrivate, onlineStep, PrivateState } from './online';
import { Action, TableState } from './types';

const ev = (s: string) => evaluate(s.split(' '));

test('hand categories', () => {
  const cases: [string, number][] = [
    ['As Ks Qs Js Ts 2d 3c', 8],
    ['5h 4h 3h 2h Ah Kd Kc', 8], // steel wheel
    ['9s 9h 9d 9c Kd 2c 3c', 7],
    ['9s 9h 9d Kc Kd Ks 3c', 6], // two trips -> full house
    ['2h 7h 9h Jh Kh Ks Kd', 5],
    ['5s 4h 3d 2c Ad Kd Kc', 4], // wheel
    ['9s 9h 9d Kc Qd 2s 3c', 3],
    ['9s 9h Kd Kc Qd Qs 3c', 2],
    ['9s 9h Kd Jc Qd 2s 3c', 1],
    ['9s 7h Kd Jc Qd 2s 3c', 0],
  ];
  for (const [cards, category] of cases) assert.equal(ev(cards).category, category, cards);
});

test('tie-breakers', () => {
  assert.ok(compareHands(ev('As Ad Kc 7d 2s 3h 9c'), ev('As Ad Qc 7d 2s 3h 9c')) > 0, 'kicker');
  assert.ok(compareHands(ev('6s 5h 4d 3c 2d Kd Kc'), ev('5s 4h 3d 2c Ad Kd Kc')) > 0, '6-high beats wheel');
  assert.ok(compareHands(ev('Ks Kh Kd 2c 2d 9s 8s'), ev('Qs Qh Qd Ac Ad 9s 8s')) > 0, 'full house by trips');
  assert.ok(compareHands(ev('9s 9h Kd Kc Qd Qs Ac'), ev('9s 9h Kd Kc Qd Qs Jc')) > 0, 'third pair is not a kicker');
  assert.equal(compareHands(ev('As Kd Qc Jd Ts 2h 3c'), ev('Ah Kc Qd Jh Td 4h 5c')), 0, 'board-style tie');
});

test('deck and shuffle', () => {
  const deck = shuffle(newDeck(), (n) => n - 1);
  assert.equal(new Set(deck).size, 52);
});

const SETTINGS = { smallBlind: 5, bigBlind: 10, buyIn: 1000 };
const first = () => 0; // rand that leaves the deck in a known order

function start(n: number) {
  let state: TableState = { ...createTable('ABCD', 'p0', 'P0', SETTINGS), mode: 'online' };
  for (let i = 1; i < n; i++) state = reduce(state, { type: 'join', playerId: `p${i}`, name: `P${i}` }, `p${i}`);
  return onlineStep(state, emptyPrivate(), { type: 'startHand' }, 'p0', first);
}

test('dealing: two private cards each, nothing public before the flop', () => {
  const { state, priv } = start(3);
  assert.deepEqual(Object.keys(priv.holes).sort(), ['p0', 'p1', 'p2']);
  const dealt = Object.values(priv.holes).flat();
  assert.equal(dealt.length, 6);
  assert.equal(new Set([...dealt, ...priv.deck]).size, 52);
  assert.deepEqual(state.board, []);
  assert.deepEqual(state.shown, {});
  assert.ok(!JSON.stringify(state).includes(priv.holes.p1[0]), 'public state must not contain hole cards');
});

test('award and undo are refused in online mode', () => {
  const { state, priv } = start(2);
  assert.throws(() => onlineStep(state, priv, { type: 'undo' }, 'p0', first));
  assert.throws(() => onlineStep(state, priv, { type: 'award', potIndex: 0, winnerIds: ['p0'] }, 'p0', first));
});

test('board grows by street and showdown pays the best hand', () => {
  let { state, priv } = start(2);
  const act = (a: Action, id: string) => ({ state, priv } = onlineStep(state, priv, a, id, first));
  act({ type: 'call', playerId: 'p0' }, 'p0');
  act({ type: 'check', playerId: 'p1' }, 'p1');
  assert.equal(state.board!.length, 3);
  for (const size of [4, 5]) {
    act({ type: 'check', playerId: 'p1' }, 'p1');
    act({ type: 'check', playerId: 'p0' }, 'p0');
    if (state.phase === 'betting') assert.equal(state.board!.length, size);
  }
  act({ type: 'check', playerId: 'p1' }, 'p1');
  act({ type: 'check', playerId: 'p0' }, 'p0');
  assert.equal(state.phase, 'handOver');
  assert.equal(state.board!.length, 5);
  assert.deepEqual(Object.keys(state.shown!).sort(), ['p0', 'p1']);
  const v0 = evaluate([...priv.holes.p0, ...state.board!]);
  const v1 = evaluate([...priv.holes.p1, ...state.board!]);
  const cmp = compareHands(v0, v1);
  const [a, b] = [state.players[0].handNet, state.players[1].handNet];
  assert.equal(Math.sign(a), Math.sign(cmp));
  assert.equal(a + b, 0);
});

test('fold ends the hand without revealing cards', () => {
  let { state, priv } = start(3);
  ({ state, priv } = onlineStep(state, priv, { type: 'fold', playerId: 'p0' }, 'p0', first));
  ({ state, priv } = onlineStep(state, priv, { type: 'fold', playerId: 'p1' }, 'p1', first));
  assert.equal(state.phase, 'handOver');
  assert.deepEqual(state.shown, {});
  assert.deepEqual(state.board, []);
});

test('fuzz: online hands always finish and conserve chips', () => {
  let seed = 99;
  const rnd = (n: number) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed % n;
  };
  for (let game = 0; game < 150; game++) {
    const n = 2 + rnd(5);
    let state: TableState = { ...createTable('ABCD', 'p0', 'P0', SETTINGS), mode: 'online' };
    for (let i = 1; i < n; i++) state = reduce(state, { type: 'join', playerId: `p${i}`, name: `P${i}` }, `p${i}`);
    let priv: PrivateState = emptyPrivate();
    for (let hand = 0; hand < 10; hand++) {
      if (state.players.filter((p) => p.stack > 0).length < 2) break;
      ({ state, priv } = onlineStep(state, priv, { type: 'startHand' }, 'p0', rnd));
      let steps = 0;
      while (state.phase === 'betting') {
        assert.ok(++steps < 500);
        const id = state.turnId!;
        const legal = legalActions(state, id)!;
        const r = rnd(10);
        const a: Action =
          r < 2 && !legal.canCheck
            ? { type: 'fold', playerId: id }
            : r < 7 || !legal.canRaise
              ? legal.canCheck
                ? { type: 'check', playerId: id }
                : { type: 'call', playerId: id }
              : r < 9
                ? { type: 'raise', playerId: id, to: legal.minRaiseTo }
                : { type: 'allIn', playerId: id };
        ({ state, priv } = onlineStep(state, priv, a, id, rnd));
      }
      assert.equal(state.phase, 'handOver');
      assert.equal(state.players.reduce((sum, p) => sum + p.stack, 0), n * 1000);
      assert.equal(state.undo, null);
    }
  }
});
