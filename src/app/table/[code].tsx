import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { potTotal } from '@/engine/engine';
import { Action, TableState } from '@/engine/types';
import { getDeviceId, getName } from '@/lib/identity';
import { useTable } from '@/net/useTable';
import { store } from '@/net/store';
import { ActionBar } from '@/ui/ActionBar';
import { CardRow, HandCards } from '@/ui/Cards';
import { ChipPile } from '@/ui/Chips';
import { Button, D, Notice, Row, T } from '@/ui/kit';
import { InviteSheet } from '@/ui/InviteSheet';
import { Ledger } from '@/ui/Ledger';
import { Showdown } from '@/ui/Showdown';
import { TableView } from '@/ui/TableView';
import { describeError, streetName, t } from '@/ui/i18n';
import { colors, fmt } from '@/ui/theme';

const isGuest = (id: string) => id.startsWith('guest-');

export default function TableScreen() {
  const params = useLocalSearchParams<{ code: string }>();
  const code = (params.code ?? '').toUpperCase();
  const me = useMemo(() => getDeviceId(), []);
  const { state, status, dispatch } = useTable(code, me);
  const [error, setError] = useState<string | null>(null);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  // The host's "act for this player" choice only lasts for that one turn.
  const [actForTurn, setActForTurn] = useState<string | null>(null);
  const joining = useRef(false);

  // One action at a time: a second tap before the first is saved would act on a stale table.
  const busy = useRef(false);
  const run = (action: Action) => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    dispatch(action)
      .catch((e) => setError(describeError(e)))
      .finally(() => {
        busy.current = false;
      });
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

  // Online tables: fetch this device's own two cards whenever a new hand is dealt.
  const online = state?.mode === 'online';
  const handNumber = state?.handNumber ?? 0;
  const [hole, setHole] = useState<{ handNumber: number; cards: string[] } | null>(null);
  useEffect(() => {
    if (!online || !seated || handNumber === 0) return;
    let cancelled = false;
    store
      .holeCards(code, me)
      .then((h) => !cancelled && setHole(h))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [online, seated, handNumber, code, me]);
  const myCards = hole && hole.handNumber === handNumber ? hole.cards : [];

  const actForOther = actForTurn !== null && actForTurn === `${handNumber}|${state?.street}|${state?.turnId}`;

  if (!state) {
    return (
      <SafeAreaView style={styles.center}>
        {status === 'loading' ? (
          <ActivityIndicator color={colors.gold} />
        ) : (
          <>
            <T style={{ textAlign: 'center' }}>
              {status === 'notFound' ? t('tableNotFound') : t('serverError')}
            </T>
            <Button label={t('back')} variant="secondary" onPress={() => router.replace('/')} />
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
            <T style={styles.link}>{t('leave')}</T>
          </Pressable>
          <Pressable onPress={() => setInviteOpen(true)} hitSlop={10} accessibilityLabel={t('inviteFriends')}>
            <D style={styles.code}>{code}</D>
          </Pressable>
          <Pressable onPress={() => setLedgerOpen(true)} hitSlop={10}>
            <T style={styles.link}>{t('ledger')}</T>
          </Pressable>
        </Row>

        <TableView state={state} me={me}>
          <Center state={state} />
        </TableView>

        <Notice text={error} />

        <View style={styles.bottom}>
          {online && myCards.length > 0 && state.phase !== 'lobby' ? <HandCards cards={myCards} /> : null}

          {state.phase === 'betting' && turn ? (
            actingId ? (
              <>
                {actingId !== me ? <T style={styles.hint}>{t('actingFor', { name: turn.name })}</T> : null}
                <ActionBar state={state} playerId={actingId} run={run} />
              </>
            ) : (
              <>
                <T style={styles.hint}>{t('turnOf', { name: turn.name })}</T>
                {isHost ? (
                  <Button label={t('actingFor', { name: turn.name })} variant="ghost" onPress={() => setActForTurn(`${handNumber}|${state.street}|${state.turnId}`)} />
                ) : null}
              </>
            )
          ) : null}

          {state.phase === 'showdown' ? (
            isHost ? (
              <Showdown state={state} run={run} />
            ) : (
              <T style={styles.hint}>{t('showCards')}</T>
            )
          ) : null}

          {state.phase === 'lobby' ? (
            <Button label={t('inviteFriends')} variant="secondary" onPress={() => setInviteOpen(true)} />
          ) : null}

          {betweenHands ? (
            isHost ? (
              <Button
                label={state.phase === 'lobby' ? t('startGame') : t('nextHand')}
                onPress={() => run({ type: 'startHand' })}
              />
            ) : (
              <T style={styles.hint}>{t('waitingHost')}</T>
            )
          ) : null}

          {isHost && state.undo && !online ? (
            <Pressable onPress={() => run({ type: 'undo' })} hitSlop={8}>
              <T style={[styles.link, { textAlign: 'center' }]}>{t('undo')}</T>
            </Pressable>
          ) : null}
        </View>
      </View>

      <InviteSheet
        code={code}
        hostName={state.players.find((p) => p.id === state.hostId)?.name ?? ''}
        visible={inviteOpen} onClose={() => setInviteOpen(false)} />
      <Ledger state={state} isHost={isHost} allowGuests={!online} visible={ledgerOpen} onClose={() => setLedgerOpen(false)} run={run} />
    </SafeAreaView>
  );
}

/** What lies in the middle of the felt: the room code, or the board and the pot. */
function Center({ state }: { state: TableState }) {
  if (state.phase === 'lobby') {
    return (
      <>
        <T style={styles.caption}>{t('shareHint')}</T>
        <D style={styles.bigCode}>{state.code}</D>
        <T style={styles.caption}>
          {t('lobbyInfo', {
            sb: fmt(state.settings.smallBlind),
            bb: fmt(state.settings.bigBlind),
            buyIn: fmt(state.settings.buyIn),
          })}
        </T>
      </>
    );
  }
  // Online tables show the community cards; empty places for the ones still to come.
  const board =
    state.mode === 'online' ? <CardRow cards={[0, 1, 2, 3, 4].map((i) => state.board?.[i])} size="md" /> : null;
  if (state.phase === 'handOver') {
    const winners = state.players.filter((p) => p.won > 0);
    return (
      <>
        <T style={styles.caption}>{t('handOver', { n: fmt(state.handNumber) })}</T>
        {board}
        {winners.map((p) => (
          <D key={p.id} style={styles.winner}>
            {t('wins', { name: p.name, amount: fmt(p.won) })}
          </D>
        ))}
      </>
    );
  }
  const pot = state.phase === 'showdown' ? state.pots.reduce((sum, p) => sum + p.amount, 0) : potTotal(state);
  return (
    <>
      <T style={styles.caption}>
        {t('handTitle', {
          n: fmt(state.handNumber),
          street: state.phase === 'showdown' ? t('showdown') : streetName(state.street),
        })}
      </T>
      {board}
      {pot > 0 ? <ChipPile amount={pot} size={26} /> : null}
      <D style={styles.pot}>{fmt(pot)}</D>
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 16, gap: 10, maxWidth: 520, width: '100%', alignSelf: 'center' },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  link: { color: colors.muted, fontSize: 15 },
  code: { color: colors.gold, fontSize: 22, lineHeight: 30, letterSpacing: 3 },
  // On the crimson felt, captions are ivory rather than the navy-tinted grey.
  caption: { color: colors.ivory, opacity: 0.8, fontSize: 13, textAlign: 'center' },
  bigCode: { color: colors.ivory, fontSize: 46, lineHeight: 60, letterSpacing: 6, textAlign: 'center' },
  pot: { color: colors.gold, fontSize: 30, lineHeight: 40, textAlign: 'center' },
  winner: { color: colors.ivory, fontSize: 22, lineHeight: 32, textAlign: 'center' },
  bottom: { gap: 10 },
  hint: { color: colors.muted, textAlign: 'center' },
});
