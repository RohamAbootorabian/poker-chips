import {
  Action,
  GameError,
  LastAction,
  Player,
  Pot,
  Settings,
  Street,
  TableState,
} from './types';

export const MAX_PLAYERS = 10;
const STREETS: Street[] = ['preflop', 'flop', 'turn', 'river'];

export function createTable(code: string, hostId: string, hostName: string, settings: Settings): TableState {
  assertSettings(settings);
  return {
    code,
    hostId,
    settings,
    players: [newPlayer(hostId, hostName, settings.buyIn)],
    phase: 'lobby',
    handNumber: 0,
    dealerId: null,
    street: 'preflop',
    currentBet: 0,
    minRaise: settings.bigBlind,
    turnId: null,
    pots: [],
    undo: null,
  };
}

function newPlayer(id: string, name: string, buyIn: number): Player {
  return {
    id,
    name,
    stack: buyIn,
    buyIn,
    sittingOut: false,
    left: false,
    inHand: false,
    folded: false,
    allIn: false,
    bet: 0,
    committed: 0,
    acted: false,
    lastAction: null,
    won: 0,
    handNet: 0,
  };
}

const isPosInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;

function assertSettings(s: Settings) {
  if (!isPosInt(s.smallBlind) || !isPosInt(s.bigBlind) || !isPosInt(s.buyIn)) throw new GameError('badAmount');
  if (s.smallBlind > s.bigBlind || s.bigBlind > s.buyIn) throw new GameError('badAmount');
}

const live = (p: Player) => p.inHand && !p.folded;
const canAct = (p: Player) => live(p) && !p.allIn;

/** First player after `fromId` (cyclically) matching `pred`. */
function nextAfter(players: Player[], fromId: string | null, pred: (p: Player) => boolean): Player | null {
  const start = players.findIndex((p) => p.id === fromId);
  for (let i = 1; i <= players.length; i++) {
    const p = players[(start + i) % players.length];
    if (pred(p)) return p;
  }
  return null;
}

/** Chips currently in the middle (all pots, including this street's bets). */
export function potTotal(s: TableState): number {
  return s.players.reduce((sum, p) => sum + p.committed, 0);
}

export interface Legal {
  canCheck: boolean;
  /** Chips needed to call (capped by the stack); 0 when checking is possible. */
  toCall: number;
  canRaise: boolean;
  /** Smallest / largest legal `to` for a raise action. */
  minRaiseTo: number;
  maxRaiseTo: number;
}

export function legalActions(s: TableState, playerId: string): Legal | null {
  const p = s.players.find((x) => x.id === playerId);
  if (!p || s.phase !== 'betting' || s.turnId !== playerId) return null;
  const maxRaiseTo = p.bet + p.stack;
  return {
    canCheck: p.bet >= s.currentBet,
    toCall: Math.max(0, Math.min(p.stack, s.currentBet - p.bet)),
    canRaise: maxRaiseTo > s.currentBet,
    minRaiseTo: Math.min(s.currentBet + s.minRaise, maxRaiseTo),
    maxRaiseTo,
  };
}

/**
 * Pure state transition. Returns a new state or throws a GameError.
 * `actorId` is the device/player performing the action; the host may act on
 * behalf of any player (useful when someone's phone is unavailable).
 */
export function reduce(state: TableState, action: Action, actorId: string): TableState {
  if (action.type === 'undo') {
    if (actorId !== state.hostId) throw new GameError('notHost');
    if (!state.undo) throw new GameError('nothingToUndo');
    return { ...(JSON.parse(state.undo) as TableState), undo: null };
  }

  const snapshot = JSON.stringify({ ...state, undo: null });
  const s = JSON.parse(snapshot) as TableState;
  const isHost = actorId === s.hostId;
  const requireHost = () => {
    if (!isHost) throw new GameError('notHost');
  };
  const player = (id: string) => {
    const p = s.players.find((x) => x.id === id);
    if (!p) throw new GameError('unknownPlayer');
    return p;
  };
  const selfOrHost = (id: string) => {
    if (actorId !== id && !isHost) throw new GameError('notAllowed');
  };
  const betweenHands = s.phase === 'lobby' || s.phase === 'handOver';

  switch (action.type) {
    // ---------- table management (not undoable) ----------
    case 'join': {
      // The host may seat a guest who has no phone and then act for them.
      selfOrHost(action.playerId);
      const name = action.name.trim().slice(0, 20) || '?';
      const existing = s.players.find((p) => p.id === action.playerId);
      if (existing) {
        existing.name = name;
        if (existing.left) {
          existing.left = false;
          existing.sittingOut = false;
        }
      } else {
        if (s.players.length >= MAX_PLAYERS) throw new GameError('tableFull');
        s.players.push(newPlayer(action.playerId, name, s.settings.buyIn));
      }
      return s;
    }
    case 'sitOut': {
      selfOrHost(action.playerId);
      player(action.playerId).sittingOut = action.value;
      return s;
    }
    case 'leave': {
      selfOrHost(action.playerId);
      const p = player(action.playerId);
      p.left = true;
      p.sittingOut = true;
      return s;
    }
    case 'rebuy': {
      requireHost();
      const p = player(action.playerId);
      if (!isPosInt(action.amount)) throw new GameError('badAmount');
      if (!betweenHands && live(p)) throw new GameError('wrongPhase');
      p.stack += action.amount;
      p.buyIn += action.amount;
      return s;
    }
    case 'settings': {
      requireHost();
      if (!betweenHands) throw new GameError('wrongPhase');
      assertSettings(action.settings);
      s.settings = action.settings;
      return s;
    }

    // ---------- game actions (undoable) ----------
    case 'startHand': {
      requireHost();
      if (!betweenHands) throw new GameError('wrongPhase');
      startHand(s);
      break;
    }
    case 'fold':
    case 'check':
    case 'call':
    case 'raise':
    case 'allIn': {
      if (s.phase !== 'betting') throw new GameError('wrongPhase');
      selfOrHost(action.playerId);
      const p = player(action.playerId);
      if (s.turnId !== p.id) throw new GameError('notYourTurn');
      applyBettingAction(s, p, action);
      afterAction(s, p.id);
      break;
    }
    case 'award': {
      requireHost();
      if (s.phase !== 'showdown') throw new GameError('wrongPhase');
      const pot = s.pots[action.potIndex];
      if (!pot || pot.winners) throw new GameError('badWinners');
      const ids = [...new Set(action.winnerIds)];
      if (ids.length === 0 || ids.some((id) => !pot.eligible.includes(id))) throw new GameError('badWinners');
      payPot(s, pot, ids);
      if (s.pots.every((x) => x.winners)) finishHand(s);
      break;
    }
  }

  s.undo = snapshot;
  return s;
}

function pay(p: Player, amount: number) {
  const chips = Math.min(p.stack, amount);
  p.stack -= chips;
  p.bet += chips;
  p.committed += chips;
  if (p.stack === 0) p.allIn = true;
}

function startHand(s: TableState) {
  const seated = (p: Player) => !p.sittingOut && !p.left && p.stack > 0;
  if (s.players.filter(seated).length < 2) throw new GameError('needTwoPlayers');

  for (const p of s.players) {
    p.inHand = seated(p);
    p.folded = false;
    p.allIn = false;
    p.bet = 0;
    p.committed = 0;
    p.acted = false;
    p.lastAction = null;
    p.won = 0;
    p.handNet = 0;
  }

  const inHand = (p: Player) => p.inHand;
  const dealer = nextAfter(s.players, s.dealerId, inHand)!;
  s.dealerId = dealer.id;
  s.handNumber += 1;

  // Heads-up: the dealer posts the small blind and acts first preflop.
  const headsUp = s.players.filter(inHand).length === 2;
  const sb = headsUp ? dealer : nextAfter(s.players, dealer.id, inHand)!;
  const bb = nextAfter(s.players, sb.id, inHand)!;
  pay(sb, s.settings.smallBlind);
  sb.lastAction = 'sb';
  pay(bb, s.settings.bigBlind);
  bb.lastAction = 'bb';

  s.street = 'preflop';
  s.currentBet = s.settings.bigBlind;
  s.minRaise = s.settings.bigBlind;
  s.pots = [];
  s.phase = 'betting';
  afterAction(s, bb.id);
}

function applyBettingAction(s: TableState, p: Player, action: Extract<Action, { playerId: string }>) {
  let type = action.type;
  let to = 0;
  if (type === 'allIn') {
    if (p.bet + p.stack <= s.currentBet) type = 'call';
    else {
      type = 'raise';
      to = p.bet + p.stack;
    }
  } else if (action.type === 'raise') {
    to = action.to;
  }

  let label: LastAction;
  switch (type) {
    case 'fold':
      p.folded = true;
      label = 'fold';
      break;
    case 'check':
      if (p.bet < s.currentBet) throw new GameError('cannotCheck');
      label = 'check';
      break;
    case 'call': {
      const toCall = s.currentBet - p.bet;
      if (toCall <= 0) throw new GameError('nothingToCall');
      pay(p, toCall);
      label = p.allIn ? 'allIn' : 'call';
      break;
    }
    case 'raise': {
      if (!Number.isInteger(to) || to <= s.currentBet) throw new GameError('raiseTooSmall');
      const need = to - p.bet;
      if (need > p.stack) throw new GameError('notEnoughChips');
      const raiseSize = to - s.currentBet;
      const isAllIn = need === p.stack;
      if (!isAllIn && raiseSize < s.minRaise) throw new GameError('raiseTooSmall');
      label = isAllIn ? 'allIn' : s.currentBet === 0 ? 'bet' : 'raise';
      pay(p, need);
      // Only a full raise re-opens the betting for players who already acted.
      // (A short all-in still has to be called; we let callers re-raise then,
      // a small simplification of the strict rule.)
      if (raiseSize >= s.minRaise) {
        s.minRaise = raiseSize;
        for (const o of s.players) if (o.id !== p.id) o.acted = false;
      }
      s.currentBet = to;
      break;
    }
    default:
      throw new GameError('notAllowed');
  }
  p.acted = true;
  p.lastAction = label;
}

/** Decide what happens after `lastActorId` acted: next turn, next street, showdown or hand end. */
function afterAction(s: TableState, lastActorId: string) {
  const alive = s.players.filter(live);
  if (alive.length === 1) {
    // Everyone else folded: the last player takes everything.
    const pot: Pot = { amount: potTotal(s), eligible: [alive[0].id], winners: null };
    s.pots = [pot];
    payPot(s, pot, pot.eligible);
    finishHand(s);
    return;
  }

  const actors = s.players.filter(canAct);
  let roundDone: boolean;
  if (actors.length <= 1) {
    // At most one player still has chips: they only act if facing a bigger bet.
    const others = Math.max(0, ...alive.filter((p) => p !== actors[0]).map((p) => p.bet));
    roundDone = actors.length === 0 || actors[0].bet >= others;
  } else {
    roundDone = actors.every((p) => p.acted && p.bet === s.currentBet);
  }

  if (!roundDone) {
    const next = nextAfter(s.players, lastActorId, (p) => canAct(p) && (!p.acted || p.bet < s.currentBet));
    s.turnId = next!.id;
    return;
  }

  refundUncalled(s);
  const stillActing = s.players.filter(canAct).length;
  if (s.street === 'river' || stillActing <= 1) {
    showdown(s);
    return;
  }

  s.street = STREETS[STREETS.indexOf(s.street) + 1];
  s.currentBet = 0;
  s.minRaise = s.settings.bigBlind;
  for (const p of s.players) {
    p.bet = 0;
    p.acted = false;
    if (canAct(p)) p.lastAction = null;
  }
  s.turnId = nextAfter(s.players, s.dealerId, canAct)!.id;
}

/** Return the part of the biggest bet that nobody matched. */
function refundUncalled(s: TableState) {
  const sorted = s.players.filter((p) => p.inHand).sort((a, b) => b.bet - a.bet);
  const [top, second] = sorted;
  const extra = top.bet - (second?.bet ?? 0);
  if (extra <= 0) return;
  top.bet -= extra;
  top.committed -= extra;
  top.stack += extra;
  top.allIn = false;
}

/** Split the committed chips into main and side pots. */
export function buildPots(players: Player[]): Pot[] {
  const inHand = players.filter((p) => p.inHand && p.committed > 0);
  const levels = [...new Set(inHand.filter((p) => !p.folded).map((p) => p.committed))].sort((a, b) => a - b);
  const pots: Pot[] = [];
  let prev = 0;
  for (const level of levels) {
    const amount = inHand.reduce((sum, p) => sum + Math.min(p.committed, level) - Math.min(p.committed, prev), 0);
    const eligible = inHand.filter((p) => !p.folded && p.committed >= level).map((p) => p.id);
    const last = pots[pots.length - 1];
    if (last && last.eligible.length === eligible.length) last.amount += amount;
    else if (amount > 0) pots.push({ amount, eligible, winners: null });
    prev = level;
  }
  // Chips a folded player put in above every remaining player's level.
  const rest = inHand.reduce((sum, p) => sum + Math.max(0, p.committed - prev), 0);
  if (rest > 0 && pots.length) pots[pots.length - 1].amount += rest;
  return pots;
}

function showdown(s: TableState) {
  s.turnId = null;
  s.pots = buildPots(s.players);
  for (const pot of s.pots) if (pot.eligible.length === 1) payPot(s, pot, pot.eligible);
  if (s.pots.every((p) => p.winners)) finishHand(s);
  else s.phase = 'showdown';
}

function payPot(s: TableState, pot: Pot, winnerIds: string[]) {
  pot.winners = winnerIds;
  const share = Math.floor(pot.amount / winnerIds.length);
  let odd = pot.amount - share * winnerIds.length;
  // Odd chips go to the winners closest to the left of the dealer.
  const start = s.players.findIndex((p) => p.id === s.dealerId);
  for (let i = 1; i <= s.players.length; i++) {
    const p = s.players[(start + i) % s.players.length];
    if (!winnerIds.includes(p.id)) continue;
    const chips = share + (odd > 0 ? 1 : 0);
    if (odd > 0) odd -= 1;
    p.stack += chips;
    p.won += chips;
  }
}

function finishHand(s: TableState) {
  for (const p of s.players) {
    p.handNet = p.inHand ? p.won - p.committed : 0;
    p.bet = 0;
    p.committed = 0;
    p.allIn = false;
  }
  s.turnId = null;
  s.currentBet = 0;
  s.phase = 'handOver';
}

// ---------- ledger ----------

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

/** Who pays whom so that everyone ends up square, using few transfers. */
export function settle(players: Pick<Player, 'id' | 'stack' | 'buyIn'>[]): Transfer[] {
  const nets = players.map((p) => ({ id: p.id, net: p.stack - p.buyIn }));
  const debtors = nets.filter((n) => n.net < 0).sort((a, b) => a.net - b.net);
  const creditors = nets.filter((n) => n.net > 0).sort((a, b) => b.net - a.net);
  const out: Transfer[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(-debtors[d].net, creditors[c].net);
    out.push({ from: debtors[d].id, to: creditors[c].id, amount });
    debtors[d].net += amount;
    creditors[c].net -= amount;
    if (debtors[d].net === 0) d++;
    if (creditors[c].net === 0) c++;
  }
  return out;
}
