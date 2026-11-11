import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { potTotal } from '@/engine/engine';
import { Action, Player, TableState } from '@/engine/types';
import { getDeviceId, getName } from '@/lib/identity';
import { useTable } from '@/net/useTable';
import { ActionBar } from '@/ui/ActionBar';
import { Button, Notice, Row, T } from '@/ui/kit';
import { Ledger } from '@/ui/Ledger';
import { Showdown } from '@/ui/Showdown';
import { actionName, describeError, streetName } from '@/ui/strings';
import { colors, fmt, fmtSigned, radius } from '@/ui/theme';

const isGuest = (id: string) => id.startsWith('guest-');

export default function TableScreen() {
  const params = useLocalSearchParams<{ code: string }>();
  const code = (params.code ?? '').toUpperCase();
  const me = useMemo(getDeviceId, []);
  const { state, status, dispatch } = useTable(code, me);
  const [error, setError] = useState<string | null>(null);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [actForOther, setActForOther] = useState(false);
  const joining = useRef(false);

  const run = (action: Action) => {
    setError(null);
    dispatch(action).catch((e) => setError(describeError(e)));
  };

  // Take a seat the first time this device opens the table.
  const seated = state?.players.some((p) => p.id === me) ?? false;
  useEffect(() => {
    if (!state || seated || joining.current) return;
    const name = getName();
    if (!name) {
      router.replace({ pathname: '/', params: { code } });
      return;
    }
    joining.current = true;
    dispatch({ type: 'join', playerId: me, name }).catch((e) => setError(describeError(e)));
  }, [state, seated, code, me, dispatch]);

  const turnId = state?.turnId ?? null;
  useEffect(() => {
    setActForOther(false);
  }, [turnId]);

  if (!state) {
    return (
      <SafeAreaView style={styles.center}>
        {status === 'loading' ? (
          <ActivityIndicator color={colors.gold} />
        ) : (
          <>
            <T style={{ textAlign: 'center' }}>
              {status === 'notFound' ? 'میزی با این کد پیدا نشد.' : 'ارتباط با سرور برقرار نشد.'}
            </T>
            <Button label="بازگشت" variant="secondary" onPress={() => router.replace('/')} />
          </>
        )}
      </SafeAreaView>
    );
  }

  const isHost = state.hostId === me;
  const turn = state.players.find((p) => p.id === state.turnId) ?? null;
  const betweenHands = state.phase === 'lobby' || state.phase === 'handOver';
  // Who this device is acting for right now, if anyone.
  const actingId =
    turn && (turn.id === me || (isHost && (isGuest(turn.id) || actForOther))) ? turn.id : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.page}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Pressable onPress={() => router.replace('/')} hitSlop={10}>
            <T style={styles.link}>خروج</T>
          </Pressable>
          <Pressable onPress={() => Share.share({ message: `کد میز پوکر: ${code}` }).catch(() => {})} hitSlop={10}>
            <T style={styles.code}>{code}</T>
          </Pressable>
          <Pressable onPress={() => setLedgerOpen(true)} hitSlop={10}>
            <T style={styles.link}>دفتر حساب</T>
          </Pressable>
        </Row>

        <Center state={state} />

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8 }}>
          {state.players
            .filter((p) => !p.left)
            .map((p) => (
              <PlayerRow key={p.id} p={p} state={state} isMe={p.id === me} />
            ))}
        </ScrollView>

        <Notice text={error} />

        <View style={styles.bottom}>
          {state.phase === 'betting' && turn ? (
            actingId ? (
              <>
                {actingId !== me ? <T style={styles.hint}>اقدام به جای {turn.name}</T> : null}
                <ActionBar state={state} playerId={actingId} run={run} />
              </>
            ) : (
              <>
                <T style={styles.hint}>نوبت {turn.name} است…</T>
                {isHost ? (
                  <Button label={`اقدام به جای ${turn.name}`} variant="ghost" onPress={() => setActForOther(true)} />
                ) : null}
              </>
            )
          ) : null}

          {state.phase === 'showdown' ? (
            isHost ? (
              <Showdown state={state} run={run} />
            ) : (
              <T style={styles.hint}>کارت‌ها را نشان دهید؛ میزبان برنده را ثبت می‌کند.</T>
            )
          ) : null}

          {betweenHands ? (
            isHost ? (
              <Button
                label={state.phase === 'lobby' ? 'شروع بازی' : 'دست بعدی'}
                onPress={() => run({ type: 'startHand' })}
              />
            ) : (
              <T style={styles.hint}>منتظر میزبان برای شروع دست…</T>
            )
          ) : null}

          {isHost && state.undo ? (
            <Pressable onPress={() => run({ type: 'undo' })} hitSlop={8}>
              <T style={[styles.link, { textAlign: 'center' }]}>برگرداندن آخرین حرکت</T>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Ledger state={state} isHost={isHost} visible={ledgerOpen} onClose={() => setLedgerOpen(false)} run={run} />
    </SafeAreaView>
  );
}

/** The middle of the table: pot and what is going on. */
function Center({ state }: { state: TableState }) {
  if (state.phase === 'lobby') {
    return (
      <View style={styles.centerCard}>
        <T style={styles.caption}>این کد را به دوستانتان بدهید</T>
        <T style={styles.bigCode}>{state.code}</T>
        <T style={styles.caption}>
          بلایندها {fmt(state.settings.smallBlind)} / {fmt(state.settings.bigBlind)} · ورود {fmt(state.settings.buyIn)}
        </T>
      </View>
    );
  }
  if (state.phase === 'handOver') {
    const winners = state.players.filter((p) => p.won > 0);
    return (
      <View style={styles.centerCard}>
        <T style={styles.caption}>پایان دست {fmt(state.handNumber)}</T>
        {winners.map((p) => (
          <T key={p.id} style={styles.winner}>
            {p.name} {fmt(p.won)} برد
          </T>
        ))}
      </View>
    );
  }
  const pot = state.phase === 'showdown' ? state.pots.reduce((sum, p) => sum + p.amount, 0) : potTotal(state);
  return (
    <View style={styles.centerCard}>
      <T style={styles.caption}>
        دست {fmt(state.handNumber)} · {state.phase === 'showdown' ? 'نمایش کارت‌ها' : streetName[state.street]}
      </T>
      <T style={styles.pot}>{fmt(pot)}</T>
      <T style={styles.caption}>پات</T>
    </View>
  );
}

function PlayerRow({ p, state, isMe }: { p: Player; state: TableState; isMe: boolean }) {
  const playing = state.phase === 'betting' || state.phase === 'showdown';
  const isTurn = state.turnId === p.id;
  const out = playing ? !p.inHand || p.folded : p.sittingOut;
  let status: string | null = null;
  let statusColor = colors.muted;
  if (p.sittingOut) status = 'بیرون';
  else if (state.phase === 'handOver' && p.inHand) {
    status = fmtSigned(p.handNet);
    statusColor = p.handNet > 0 ? colors.green : p.handNet < 0 ? colors.red : colors.muted;
  } else if (playing && p.inHand && p.lastAction) {
    status = actionName[p.lastAction];
    if (p.lastAction === 'allIn') statusColor = colors.gold;
    if (p.lastAction === 'fold') statusColor = colors.red;
  } else if (p.stack === 0) status = 'بدون چیپ';

  return (
    <View style={[styles.player, isTurn && styles.playerTurn, out && { opacity: 0.45 }]}>
      <View style={[styles.dealer, state.dealerId !== p.id && { opacity: 0 }]}>
        <T style={styles.dealerLabel}>D</T>
      </View>
      <View style={{ flex: 1 }}>
        <T style={styles.name} numberOfLines={1}>
          {p.name}
          {isMe ? ' (شما)' : ''}
        </T>
        {status ? <T style={{ fontSize: 13, color: statusColor }}>{status}</T> : null}
      </View>
      {playing && p.bet > 0 ? (
        <View style={styles.bet}>
          <T style={styles.betLabel}>{fmt(p.bet)}</T>
        </View>
      ) : null}
      <T style={styles.stack}>{fmt(p.stack)}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 16, gap: 12, maxWidth: 520, width: '100%', alignSelf: 'center' },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  link: { color: colors.muted, fontSize: 15 },
  code: { color: colors.gold, fontSize: 18, fontWeight: '800', letterSpacing: 3 },
  centerCard: {
    backgroundColor: colors.felt,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 4,
  },
  caption: { color: colors.muted, fontSize: 14, textAlign: 'center' },
  bigCode: { color: colors.gold, fontSize: 44, fontWeight: '800', letterSpacing: 8, textAlign: 'center' },
  pot: { color: colors.gold, fontSize: 48, fontWeight: '800', textAlign: 'center', fontVariant: ['tabular-nums'] },
  winner: { color: colors.green, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  player: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.felt,
  },
  playerTurn: { borderColor: colors.gold, backgroundColor: colors.card },
  dealer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealerLabel: { color: colors.ink, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  name: { fontSize: 17, fontWeight: '600' },
  bet: { backgroundColor: colors.goldDark, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  betLabel: { color: colors.gold, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  stack: { fontSize: 18, fontWeight: '700', minWidth: 64, textAlign: 'left', fontVariant: ['tabular-nums'] },
  bottom: { gap: 10 },
  hint: { color: colors.muted, textAlign: 'center' },
});
