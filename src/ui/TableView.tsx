import { ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Player, TableState } from '@/engine/types';

import { CardRow } from './Cards';
import { actionName, handRankName, t } from './i18n';
import { D, T } from './kit';
import { colors, fmt, fmtSigned } from './theme';

const SEAT_W = 84;
/** Height of avatar + name plate; the seat is centred on this, the note hangs below. */
const SEAT_H = 86;

/**
 * The poker table seen from above: an oval felt with everyone seated around
 * it. This device's player sits at the bottom; the others follow clockwise in
 * seat order. `children` is drawn in the middle of the felt (pot, board…).
 */
export function TableView({ state, me, children }: { state: TableState; me: string; children: ReactNode }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const seated = state.players.filter((p) => !p.left);
  const mine = Math.max(0, seated.findIndex((p) => p.id === me));
  const order = [...seated.slice(mine), ...seated.slice(0, mine)];
  const rx = size.w / 2 - SEAT_W / 2;
  const ry = size.h / 2 - SEAT_H / 2;

  return (
    <View style={styles.wrap} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <View style={styles.rail}>
        <View style={styles.felt}>
          <View style={styles.middle}>{children}</View>
        </View>
      </View>
      {size.w > 0 &&
        order.map((p, i) => {
          // Screen angles grow clockwise; a quarter turn puts the first seat at the bottom.
          const angle = Math.PI / 2 + (i * 2 * Math.PI) / order.length;
          const x = size.w / 2 + rx * Math.cos(angle);
          const y = size.h / 2 + ry * Math.sin(angle);
          // The bet sits on the felt, part of the way from the seat to the middle.
          const bx = size.w / 2 + rx * 0.5 * Math.cos(angle);
          const by = size.h / 2 + ry * 0.56 * Math.sin(angle);
          const betting = (state.phase === 'betting' || state.phase === 'showdown') && p.bet > 0;
          return (
            <View key={p.id} style={StyleSheet.absoluteFill} pointerEvents="none">
              <View style={[styles.seat, { left: x - SEAT_W / 2, top: y - SEAT_H / 2 }]}>
                <Seat p={p} state={state} isMe={p.id === me} />
              </View>
              {betting ? (
                <View style={[styles.bet, { left: bx - 40, top: by - 13 }]}>
                  <View style={styles.chip} />
                  <T style={styles.betLabel}>{fmt(p.bet)}</T>
                </View>
              ) : null}
            </View>
          );
        })}
    </View>
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
          {state.dealerId === p.id && state.phase !== 'lobby' ? (
            <View style={styles.dealer}>
              <T style={styles.dealerLabel}>D</T>
            </View>
          ) : null}
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
  // Walnut rail with a brass edge, inset so the seats straddle it.
  rail: {
    position: 'absolute',
    left: 26,
    right: 26,
    top: 34,
    bottom: 40,
    borderRadius: 999,
    backgroundColor: colors.rail,
    borderWidth: 1.5,
    borderColor: colors.gold,
    padding: 9,
  },
  felt: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: colors.crimson,
    borderWidth: 1,
    borderColor: colors.crimsonDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { alignItems: 'center', gap: 6, paddingHorizontal: 12 },
  seat: { position: 'absolute', width: SEAT_W },
  seatInner: { alignItems: 'center' },
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
    right: -8,
    top: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.ivory,
    alignItems: 'center',
    justifyContent: 'center',
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
  bet: {
    position: 'absolute',
    width: 80,
    height: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  chip: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.ivory,
  },
  betLabel: { fontSize: 14, fontWeight: '700', color: colors.ivory },
});
