import { ReactNode, useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, RadialGradient, Stop } from 'react-native-svg';

import { Player, TableState } from '@/engine/types';

import { CardBack, CardRow } from './Cards';
import { ChipPile } from './Chips';
import { actionName, handRankName, t } from './i18n';
import { D, T } from './kit';
import { colors, fmt, fmtSigned } from './theme';

const SEAT_W = 84;
const SEAT_H = 86;

/**
 * The poker table seen from above: padded leather rail, walnut racetrack,
 * crimson felt with a betting line, and everyone seated around it. This
 * device's player sits at the bottom; the others follow clockwise in seat
 * order. `children` is drawn in the middle of the felt (pot, board…).
 */
export function TableView({ state, me, children }: { state: TableState; me: string; children: ReactNode }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const seated = state.players.filter((p) => !p.left);
  const mine = Math.max(0, seated.findIndex((p) => p.id === me));
  const order = [...seated.slice(mine), ...seated.slice(0, mine)];
  const { w, h } = size;
  const cx = w / 2;
  const cy = h / 2;
  // The table outline, then the seats sit on the rail.
  const railRx = w / 2 - 22;
  const railRy = h / 2 - 30;
  const feltRx = railRx - 20;
  const feltRy = railRy - 20;
  const seatRx = w / 2 - SEAT_W / 2;
  const seatRy = h / 2 - SEAT_H / 2;
  const playing = state.phase === 'betting' || state.phase === 'showdown';

  return (
    <View style={styles.wrap} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {w > 0 ? <Felt w={w} h={h} railRx={railRx} railRy={railRy} feltRx={feltRx} feltRy={feltRy} /> : null}
      {/* The name printed into the felt; hidden while online cards and the pot fill the middle. */}
      {w > 0 && !(state.mode === 'online' && playing) ? (
        <D pointerEvents="none" style={[styles.logo, { top: cy + feltRy * 0.3 }]}>
          {t('appTitle')}
        </D>
      ) : null}
      <View style={[StyleSheet.absoluteFill, styles.middle]} pointerEvents="box-none">
        {children}
      </View>
      {w > 0 &&
        order.map((p, i) => {
          // Screen angles grow clockwise; a quarter turn puts the first seat at the bottom.
          const angle = Math.PI / 2 + (i * 2 * Math.PI) / order.length;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          const at = (k: number) => ({ x: cx + feltRx * k * cos, y: cy + feltRy * k * sin });
          const seat = { x: cx + seatRx * cos, y: cy + seatRy * sin };
          const cards = at(0.68);
          const bet = at(0.56);
          // The dealer button sits on the felt a little clockwise of the dealer's seat.
          const button = {
            x: cx + feltRx * 0.72 * Math.cos(angle - 0.32),
            y: cy + feltRy * 0.72 * Math.sin(angle - 0.32),
          };
          const holding = playing && p.inHand && !p.folded && p.id !== me;
          const facing = (angle * 180) / Math.PI - 90;
          return (
            <View key={p.id} style={StyleSheet.absoluteFill} pointerEvents="none">
              {holding ? (
                <View style={[styles.holeCards, { left: cards.x - 16, top: cards.y - 13, transform: [{ rotate: `${facing}deg` }] }]}>
                  <CardBack width={16} height={23} radius={2.5} rotate={-8} thin />
                  <View style={{ marginLeft: -7 }}>
                    <CardBack width={16} height={23} radius={2.5} rotate={8} thin />
                  </View>
                </View>
              ) : null}
              {playing && p.bet > 0 ? (
                <View style={[styles.bet, { left: bet.x - 50, top: bet.y - 18 }]}>
                  <ChipPile amount={p.bet} size={20} />
                  <T style={styles.betLabel}>{fmt(p.bet)}</T>
                </View>
              ) : null}
              {state.dealerId === p.id && state.phase !== 'lobby' ? (
                <View style={[styles.dealer, { left: button.x - 11, top: button.y - 11 }]}>
                  <T style={styles.dealerLabel}>D</T>
                </View>
              ) : null}
              <View style={[styles.seat, { left: seat.x - SEAT_W / 2, top: seat.y - SEAT_H / 2 }]}>
                <Seat p={p} state={state} isMe={p.id === me} />
              </View>
            </View>
          );
        })}
    </View>
  );
}

/** Rail, racetrack, felt and betting line, drawn as one picture behind everything. */
function Felt(props: { w: number; h: number; railRx: number; railRy: number; feltRx: number; feltRy: number }) {
  const { w, h, railRx, railRy, feltRx, feltRy } = props;
  const uid = useId().replace(/:/g, '');
  const cx = w / 2;
  const cy = h / 2;
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={`leather${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#3A2E25" />
          <Stop offset="0.45" stopColor="#1E1712" />
          <Stop offset="1" stopColor="#0E0A08" />
        </LinearGradient>
        <LinearGradient id={`wood${uid}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#8A5632" />
          <Stop offset="0.5" stopColor="#4A2A1A" />
          <Stop offset="1" stopColor="#2E190F" />
        </LinearGradient>
        <RadialGradient id={`felt${uid}`} cx="50%" cy="44%" rx="60%" ry="60%">
          <Stop offset="0" stopColor="#A8344A" />
          <Stop offset="0.55" stopColor={colors.crimson} />
          <Stop offset="1" stopColor="#4E0E1A" />
        </RadialGradient>
      </Defs>
      {/* Shadow of the table on the floor */}
      <Ellipse cx={cx} cy={cy + 10} rx={railRx + 4} ry={railRy + 6} fill="#000" opacity={0.45} />
      {/* Padded leather rail with stitching */}
      <Ellipse cx={cx} cy={cy} rx={railRx} ry={railRy} fill={`url(#leather${uid})`} />
      <Ellipse cx={cx} cy={cy} rx={railRx - 1} ry={railRy - 1} fill="none" stroke="#fff" strokeOpacity={0.1} strokeWidth={1.5} />
      <Ellipse cx={cx} cy={cy} rx={railRx - 6} ry={railRy - 6} fill="none" stroke={colors.gold} strokeOpacity={0.45} strokeWidth={1} strokeDasharray="4 3" />
      {/* Walnut racetrack with a brass edge */}
      <Ellipse cx={cx} cy={cy} rx={feltRx + 8} ry={feltRy + 8} fill={`url(#wood${uid})`} stroke={colors.gold} strokeOpacity={0.75} strokeWidth={1} />
      {/* Felt and betting line */}
      <Ellipse cx={cx} cy={cy} rx={feltRx} ry={feltRy} fill={`url(#felt${uid})`} stroke="#000" strokeOpacity={0.4} strokeWidth={1.5} />
      <Ellipse cx={cx} cy={cy} rx={feltRx * 0.68} ry={feltRy * 0.68} fill="none" stroke={colors.gold} strokeOpacity={0.5} strokeWidth={1.5} />
    </Svg>
  );
}

function Seat({ p, state, isMe }: { p: Player; state: TableState; isMe: boolean }) {
  const playing = state.phase === 'betting' || state.phase === 'showdown';
  const isTurn = state.turnId === p.id;
  const out = playing ? !p.inHand || p.folded : p.sittingOut;
  const shown = state.phase === 'handOver' ? state.shown?.[p.id] : undefined;

  // One short line under the name: what just happened to this player.
  let note: string | null = null;
  let noteColor = colors.muted;
  if (p.sittingOut) note = t('sittingOut');
  else if (state.phase === 'handOver' && p.inHand) {
    const rank = shown ? state.handRanks?.[p.id] : undefined;
    note = fmtSigned(p.handNet);
    if (rank !== undefined) note = `${handRankName(rank)} ${note}`;
    noteColor = p.handNet > 0 ? colors.turq : p.handNet < 0 ? colors.red : colors.muted;
  } else if (playing && p.inHand && p.lastAction) {
    note = actionName(p.lastAction);
    if (p.lastAction === 'allIn') noteColor = colors.gold;
  } else if (p.stack === 0) note = t('noChips');

  return (
    <View style={[styles.seatInner, out && { opacity: 0.45 }]}>
      {shown ? (
        <View style={{ height: 44, justifyContent: 'center' }}>
          <CardRow cards={shown} size="sm" />
        </View>
      ) : (
        <View style={[styles.avatar, isMe && styles.avatarMe, isTurn && styles.avatarTurn]}>
          <D style={[styles.initial, isMe && { color: colors.ink }]}>{p.name.trim().slice(0, 1).toUpperCase()}</D>
        </View>
      )}
      <View style={styles.plate}>
        <T style={styles.name} numberOfLines={1}>
          {p.name}
        </T>
        <T style={styles.stack}>{fmt(p.stack)}</T>
      </View>
      {note ? (
        <T style={[styles.note, { color: noteColor }]} numberOfLines={1}>
          {note}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 360, maxHeight: 620 },
  middle: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 70 },
  logo: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 26,
    lineHeight: 36,
    color: 'rgba(0, 0, 0, 0.26)',
    textShadowColor: 'rgba(255, 255, 255, 0.10)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  seat: { position: 'absolute', width: SEAT_W },
  seatInner: { alignItems: 'center' },
  holeCards: { position: 'absolute', width: 32, height: 26, flexDirection: 'row', justifyContent: 'center' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMe: { backgroundColor: colors.gold },
  avatarTurn: { borderColor: colors.turq, borderWidth: 3 },
  initial: { fontSize: 22, lineHeight: 30, color: colors.text, textAlign: 'center' },
  dealer: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.ivory,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
  },
  dealerLabel: { color: colors.ink, fontSize: 11, lineHeight: 14, fontWeight: '700', textAlign: 'center' },
  plate: {
    marginTop: -6,
    minWidth: 64,
    maxWidth: SEAT_W,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
  },
  name: { fontSize: 12, lineHeight: 17, fontWeight: '600', textAlign: 'center' },
  stack: { fontSize: 13, lineHeight: 17, fontWeight: '700', color: colors.gold, textAlign: 'center' },
  note: { fontSize: 11, lineHeight: 15, textAlign: 'center' },
  bet: { position: 'absolute', width: 100, alignItems: 'center', gap: 1 },
  betLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.ivory,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
