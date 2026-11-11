import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { settle } from '@/engine/engine';
import { Action, TableState } from '@/engine/types';

import { Button, Card, Field, Row, T } from './kit';
import { colors, fmt, fmtSigned, parseAmount } from './theme';

/** Buy-ins, current stacks, results and who owes whom. Host can add chips here. */
export function Ledger(props: {
  state: TableState;
  isHost: boolean;
  visible: boolean;
  onClose: () => void;
  run: (a: Action) => void;
}) {
  const { state, isHost, run } = props;
  const [amount, setAmount] = useState('');
  const [guest, setGuest] = useState('');
  const rebuyAmount = amount ? parseAmount(amount) : state.settings.buyIn;
  const name = (id: string) => state.players.find((p) => p.id === id)?.name ?? '?';
  // Chips in the middle belong to nobody yet, so results are only final between hands.
  const midHand = state.phase === 'betting' || state.phase === 'showdown';
  const transfers = settle(state.players);

  const addGuest = () => {
    if (!guest.trim()) return;
    run({ type: 'join', playerId: `guest-${Date.now().toString(36)}`, name: guest });
    setGuest('');
  };

  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <Row style={{ justifyContent: 'space-between' }}>
            <T style={styles.title}>دفتر حساب</T>
            <Button label="بستن" variant="ghost" onPress={props.onClose} style={{ minHeight: 40 }} />
          </Row>

          <Card>
            <Row>
              <T style={[styles.head, { flex: 2 }]}>بازیکن</T>
              <T style={styles.head}>ورود</T>
              <T style={styles.head}>موجودی</T>
              <T style={styles.head}>نتیجه</T>
            </Row>
            {state.players.map((p) => {
              const net = p.stack + p.committed - p.buyIn;
              return (
                <Row key={p.id}>
                  <T style={{ flex: 2 }} numberOfLines={1}>
                    {p.name}
                    {p.left ? ' (رفته)' : p.sittingOut ? ' (بیرون)' : ''}
                  </T>
                  <T style={styles.cell}>{fmt(p.buyIn)}</T>
                  <T style={styles.cell}>{fmt(p.stack)}</T>
                  <T style={[styles.cell, { color: net > 0 ? colors.green : net < 0 ? colors.red : colors.muted }]}>
                    {fmtSigned(net)}
                  </T>
                </Row>
              );
            })}
          </Card>

          <Card>
            <T style={styles.section}>تسویه</T>
            {midHand ? <T style={styles.muted}>دست در جریان است؛ تسویهٔ نهایی بعد از پایان دست دقیق می‌شود.</T> : null}
            {!midHand && transfers.length === 0 ? <T style={styles.muted}>کسی به کسی بدهکار نیست.</T> : null}
            {!midHand &&
              transfers.map((t, i) => (
                <T key={i}>
                  {name(t.from)} ← {name(t.to)}: <T style={{ color: colors.gold, fontWeight: '700' }}>{fmt(t.amount)}</T>
                </T>
              ))}
          </Card>

          {isHost ? (
            <Card>
              <T style={styles.section}>ابزار میزبان</T>
              <Field
                label="مبلغ خرید مجدد"
                value={amount}
                onChangeText={setAmount}
                keyboardType="number-pad"
                placeholder={fmt(state.settings.buyIn)}
              />
              {state.players.map((p) => (
                <Row key={p.id}>
                  <T style={{ flex: 1 }} numberOfLines={1}>
                    {p.name}
                  </T>
                  <Button
                    label={p.sittingOut ? 'برگرداندن' : 'بیرون'}
                    variant="ghost"
                    onPress={() => run({ type: 'sitOut', playerId: p.id, value: !p.sittingOut })}
                    style={styles.small}
                  />
                  <Button
                    label="+ چیپ"
                    variant="secondary"
                    disabled={!(rebuyAmount > 0)}
                    onPress={() => run({ type: 'rebuy', playerId: p.id, amount: rebuyAmount })}
                    style={styles.small}
                  />
                </Row>
              ))}
              <View style={styles.divider} />
              <Row style={{ alignItems: 'flex-end' }}>
                <Field label="بازیکن بدون گوشی" value={guest} onChangeText={setGuest} placeholder="اسم" maxLength={20} />
                <Button label="افزودن" variant="secondary" onPress={addGuest} disabled={!guest.trim()} />
              </Row>
            </Card>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, gap: 16, maxWidth: 520, width: '100%', alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: '800' },
  section: { fontSize: 17, fontWeight: '700' },
  head: { flex: 1, color: colors.muted, fontSize: 13, textAlign: 'center' },
  cell: { flex: 1, textAlign: 'center', fontVariant: ['tabular-nums'] },
  muted: { color: colors.muted, fontSize: 14 },
  small: { minHeight: 40, paddingHorizontal: 12 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 4 },
});
