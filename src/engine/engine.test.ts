import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildPots, createTable, legalActions, potTotal, reduce, settle } from './engine';
import { Action, GameError, TableState } from './types';

const SETTINGS = { smallBlind: 5, bigBlind: 10, buyIn: 1000 };

function table(n: number, settings = SETTINGS): TableState {
  let s = createTable('ABCD', 'p0', 'P0', settings);
  for (let i = 1; i < n; i++) s = reduce(s, { type: 'join', playerId: `p${i}`, name: `P${i}` }, `p${i}`);
  return s;
}
const host = (s: TableState, a: Action) => reduce(s, a, 'p0');
const by = (s: TableState, id: string) => s.players.find((p) => p.id === id)!;
// Chips in stacks plus chips still in the middle. Pots that were already paid
// (e.g. an auto-awarded side pot during showdown) are in a stack, so `won` is subtracted.
const total = (s: TableState) =>
  s.players.reduce((sum, p) => sum + p.stack, 0) +
  (s.phase === 'handOver' ? 0 : potTotal(s) - s.players.reduce((sum, p) => sum + p.won, 0));
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as GameError).code;
  }
  return null;
};

test('blinds and first to act, three players', () => {
  const s = host(table(3), { type: 'startHand' });
  assert.equal(s.dealerId, 'p0');
  assert.equal(by(s, 'p1').bet, 5);
  assert.equal(by(s, 'p2').bet, 10);
  assert.equal(s.turnId, 'p0');
});

test('heads-up: dealer is small blind and acts first preflop, last postflop', () => {
  let s = host(table(2), { type: 'startHand' });
  assert.equal(s.dealerId, 'p0');
  assert.equal(by(s, 'p0').bet, 5);
  assert.equal(s.turnId, 'p0');
  s = reduce(s, { type: 'call', playerId: 'p0' }, 'p0');
  assert.equal(s.turnId, 'p1', 'big blind gets the option');
  s = reduce(s, { type: 'check', playerId: 'p1' }, 'p1');
  assert.equal(s.street, 'flop');
  assert.equal(s.turnId, 'p1');
});

test('everyone folds: last player wins without showdown', () => {
  let s = host(table(3), { type: 'startHand' });
  s = reduce(s, { type: 'raise', playerId: 'p0', to: 30 }, 'p0');
  s = reduce(s, { type: 'fold', playerId: 'p1' }, 'p1');
  s = reduce(s, { type: 'fold', playerId: 'p2' }, 'p2');
  assert.equal(s.phase, 'handOver');
  assert.equal(by(s, 'p0').stack, 1015);
  assert.equal(by(s, 'p0').handNet, 15);
  assert.equal(by(s, 'p2').handNet, -10);
  assert.equal(total(s), 3000);
});

test('validation', () => {
  const s = host(table(3), { type: 'startHand' });
  assert.equal(code(() => reduce(s, { type: 'fold', playerId: 'p1' }, 'p1')), 'notYourTurn');
  assert.equal(code(() => reduce(s, { type: 'fold', playerId: 'p0' }, 'p2')), 'notAllowed');
  assert.equal(code(() => reduce(s, { type: 'check', playerId: 'p0' }, 'p0')), 'cannotCheck');
  assert.equal(code(() => reduce(s, { type: 'raise', playerId: 'p0', to: 15 }, 'p0')), 'raiseTooSmall');
  assert.equal(code(() => reduce(s, { type: 'raise', playerId: 'p0', to: 5000 }, 'p0')), 'notEnoughChips');
  assert.equal(code(() => reduce(s, { type: 'startHand' }, 'p1')), 'notHost');
  assert.deepEqual(legalActions(s, 'p0'), {
    canCheck: false,
    toCall: 10,
    canRaise: true,
    minRaiseTo: 20,
    maxRaiseTo: 1000,
  });
});

test('min raise follows the last raise size', () => {
  let s = host(table(3), { type: 'startHand' });
  s = reduce(s, { type: 'raise', playerId: 'p0', to: 40 }, 'p0'); // raise of 30
  assert.equal(code(() => reduce(s, { type: 'raise', playerId: 'p1', to: 60 }, 'p1')), 'raiseTooSmall');
  s = reduce(s, { type: 'raise', playerId: 'p1', to: 70 }, 'p1');
  assert.equal(s.currentBet, 70);
  assert.equal(s.turnId, 'p2');
});

test('side pots with a short all-in and a split', () => {
  let s = table(3);
  s = host(s, { type: 'rebuy', playerId: 'p1', amount: 1000 }); // p1: 2000
  // make p0 short: 1000, p2: 1000, p1: 2000 -> give p2 extra too
  s = host(s, { type: 'rebuy', playerId: 'p2', amount: 1000 }); // p2: 2000
  s = host(s, { type: 'startHand' }); // dealer p0, sb p1, bb p2, p0 acts
  s = reduce(s, { type: 'allIn', playerId: 'p0' }, 'p0'); // 1000
  s = reduce(s, { type: 'allIn', playerId: 'p1' }, 'p1'); // 2000
  s = reduce(s, { type: 'call', playerId: 'p2' }, 'p2'); // 2000
  assert.equal(s.phase, 'showdown');
  assert.deepEqual(
    s.pots.map((p) => [p.amount, p.eligible]),
    [
      [3000, ['p0', 'p1', 'p2']],
      [2000, ['p1', 'p2']],
    ],
  );
  assert.equal(code(() => host(s, { type: 'award', potIndex: 1, winnerIds: ['p0'] })), 'badWinners');
  s = host(s, { type: 'award', potIndex: 0, winnerIds: ['p0'] });
  s = host(s, { type: 'award', potIndex: 1, winnerIds: ['p1', 'p2'] });
  assert.equal(s.phase, 'handOver');
  assert.equal(by(s, 'p0').stack, 3000);
  assert.equal(by(s, 'p1').stack, 1000);
  assert.equal(by(s, 'p2').stack, 1000);
  assert.equal(total(s), 5000);
});

test('uncalled part of an all-in is returned', () => {
  let s = table(2);
  s = host(s, { type: 'rebuy', playerId: 'p0', amount: 500 }); // p0 1500, p1 1000
  s = host(s, { type: 'startHand' });
  s = reduce(s, { type: 'allIn', playerId: 'p0' }, 'p0');
  s = reduce(s, { type: 'call', playerId: 'p1' }, 'p1');
  assert.equal(s.phase, 'showdown');
  assert.equal(by(s, 'p0').stack, 500);
  assert.deepEqual(s.pots.map((p) => p.amount), [2000]);
});

test('odd chip goes to the first winner left of the dealer', () => {
  let s = host(table(3), { type: 'startHand' });
  s = reduce(s, { type: 'fold', playerId: 'p0' }, 'p0');
  s = reduce(s, { type: 'call', playerId: 'p1' }, 'p1');
  s = reduce(s, { type: 'check', playerId: 'p2' }, 'p2');
  for (let i = 0; i < 3; i++) {
    s = reduce(s, { type: 'check', playerId: 'p1' }, 'p1');
    s = reduce(s, { type: 'check', playerId: 'p2' }, 'p2');
  }
  assert.equal(s.phase, 'showdown');
  // make the pot odd by hand to exercise the split
  s.pots[0].amount = 21;
  by(s, 'p0').stack += 1;
  s = host(s, { type: 'award', potIndex: 0, winnerIds: ['p2', 'p1'] });
  assert.equal(by(s, 'p1').won, 11);
  assert.equal(by(s, 'p2').won, 10);
});

test('undo restores the previous state (host only)', () => {
  const s0 = host(table(3), { type: 'startHand' });
  const s1 = reduce(s0, { type: 'fold', playerId: 'p0' }, 'p0');
  assert.equal(code(() => reduce(s1, { type: 'undo' }, 'p1')), 'notHost');
  const back = host(s1, { type: 'undo' });
  assert.deepEqual({ ...back, undo: null }, { ...s0, undo: null });
  assert.equal(code(() => host(back, { type: 'undo' })), 'nothingToUndo');
});

test('dealer button moves and broke players are skipped', () => {
  let s = host(table(3), { type: 'startHand' });
  s = reduce(s, { type: 'allIn', playerId: 'p0' }, 'p0');
  s = reduce(s, { type: 'call', playerId: 'p1' }, 'p1');
  s = reduce(s, { type: 'fold', playerId: 'p2' }, 'p2');
  s = host(s, { type: 'award', potIndex: 0, winnerIds: ['p1'] });
  assert.equal(by(s, 'p0').stack, 0);
  s = host(s, { type: 'startHand' });
  assert.equal(s.dealerId, 'p1');
  assert.equal(by(s, 'p0').inHand, false);
  assert.equal(code(() => host(host(s, { type: 'undo' }), { type: 'sitOut', playerId: 'p2', value: true }) && null), null);
});

test('buildPots: folded chips above the last level stay in the pot', () => {
  const mk = (id: string, committed: number, folded: boolean) => ({ id, committed, folded, inHand: true }) as never;
  const pots = buildPots([mk('a', 100, true), mk('b', 100, false), mk('c', 50, false)]);
  assert.deepEqual(
    pots.map((p) => [p.amount, p.eligible]),
    [
      [150, ['b', 'c']],
      [100, ['b']],
    ],
  );
});

test('settle produces transfers that zero everyone out', () => {
  const players = [
    { id: 'a', buyIn: 1000, stack: 2500 },
    { id: 'b', buyIn: 2000, stack: 500 },
    { id: 'c', buyIn: 1000, stack: 1000 },
    { id: 'd', buyIn: 1000, stack: 1000 + 0 },
  ];
  assert.deepEqual(settle(players), [{ from: 'b', to: 'a', amount: 1500 }]);
});

test('fuzz: random play conserves chips and always terminates', () => {
  let seed = 12345;
  const rnd = (n: number) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed % n;
  };
  for (let game = 0; game < 300; game++) {
    const n = 2 + rnd(6);
    let s = table(n, { smallBlind: 5, bigBlind: 10, buyIn: 200 + rnd(5) * 150 });
    for (let i = 0; i < n; i++) if (rnd(3) === 0) s = host(s, { type: 'rebuy', playerId: `p${i}`, amount: 1 + rnd(700) });
    const chips = total(s);
    for (let hand = 0; hand < 12; hand++) {
      if (s.players.filter((p) => p.stack > 0).length < 2) break;
      s = host(s, { type: 'startHand' });
      let steps = 0;
      while (s.phase === 'betting') {
        assert.ok(++steps < 500, 'hand does not terminate');
        const id = s.turnId!;
        const legal = legalActions(s, id)!;
        const r = rnd(10);
        let a: Action;
        if (r < 2 && !legal.canCheck) a = { type: 'fold', playerId: id };
        else if (r < 6 || !legal.canRaise) a = legal.canCheck ? { type: 'check', playerId: id } : { type: 'call', playerId: id };
        else if (r < 8) a = { type: 'raise', playerId: id, to: legal.minRaiseTo + rnd(legal.maxRaiseTo - legal.minRaiseTo + 1) };
        else a = { type: 'allIn', playerId: id };
        s = reduce(s, a, id);
        assert.equal(total(s), chips);
        assert.ok(s.players.every((p) => p.stack >= 0 && p.bet >= 0));
      }
      if (s.phase === 'showdown') {
        assert.equal(s.pots.reduce((sum, p) => sum + p.amount, 0), potTotal(s));
        s.pots.forEach((pot, i) => {
          if (pot.winners) return;
          const k = 1 + rnd(pot.eligible.length);
          s = host(s, { type: 'award', potIndex: i, winnerIds: pot.eligible.slice(0, k) });
        });
      }
      assert.equal(s.phase, 'handOver');
      assert.equal(potTotal(s), 0);
      assert.equal(total(s), chips);
      assert.equal(s.players.reduce((sum, p) => sum + p.handNet, 0), 0);
    }
  }
});
