import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { legalActions, potTotal } from '@/engine/engine';
import { Action, TableState } from '@/engine/types';

import { t } from './i18n';
import { Button, Row, T } from './kit';
import { colors, fmt, parseAmount, radius } from './theme';

/** Fold / check-call / raise controls for the player whose turn it is. */
export function ActionBar(props: { state: TableState; playerId: string; run: (a: Action) => void }) {
  const { state, playerId, run } = props;
  const legal = legalActions(state, playerId);
  const [raising, setRaising] = useState(false);
  const [to, setTo] = useState(0);

  // Close the raise panel whenever the turn or the bet to match changes.
  useEffect(() => {
    setRaising(false);
  }, [state.turnId, state.currentBet, state.street, state.handNumber]);

  if (!legal) return null;
  const { minRaiseTo, maxRaiseTo } = legal;
  const clamp = (n: number) => Math.max(minRaiseTo, Math.min(maxRaiseTo, Math.round(n)));
  const openRaise = () => {
    setTo(minRaiseTo);
    setRaising(true);
  };

  if (raising) {
    const pot = potTotal(state) + legal.toCall;
    const presets: [string, number][] = [
      [t('min'), minRaiseTo],
      [t('halfPot'), clamp(state.currentBet + pot / 2)],
      [t('pot'), clamp(state.currentBet + pot)],
      [t('allIn'), maxRaiseTo],
    ];
    const step = state.settings.bigBlind;
    const valid = to >= minRaiseTo && to <= maxRaiseTo;
    const verb = state.currentBet === 0 ? t('bet') : t('raiseTo');
    return (
      <View style={{ gap: 10 }}>
        {/* Minus on the left, plus on the right in both languages. */}
        <Row style={{ flexDirection: 'row-reverse' }}>
          <Stepper label="+" onPress={() => setTo(clamp(to + step))} />
          <TextInput
            value={to ? fmt(to) : ''}
            onChangeText={(text) => {
              const n = parseAmount(text);
              setTo(Number.isNaN(n) ? 0 : n);
            }}
            keyboardType="number-pad"
            style={styles.amount}
            selectionColor={colors.gold}
          />
          <Stepper label="−" onPress={() => setTo(clamp(to - step))} />
        </Row>
        <Row style={{ gap: 6 }}>
          {presets.map(([label, value]) => (
            <Pressable
              key={label}
              onPress={() => setTo(value)}
              style={[styles.preset, to === value && { borderColor: colors.gold }]}
            >
              <T style={styles.presetLabel}>{label}</T>
            </Pressable>
          ))}
        </Row>
        <Row>
          <Button
            label={to === maxRaiseTo ? t('allIn') : verb}
            sub={valid ? fmt(to) : t('range', { min: fmt(minRaiseTo), max: fmt(maxRaiseTo) })}
            disabled={!valid}
            onPress={() => run({ type: 'raise', playerId, to })}
            style={{ flex: 2 }}
          />
          <Button label={t('cancel')} variant="ghost" onPress={() => setRaising(false)} style={{ flex: 1 }} />
        </Row>
      </View>
    );
  }

  return (
    <Row>
      {legal.canRaise ? (
        <Button label={state.currentBet === 0 ? t('bet') : t('raise')} onPress={openRaise} style={{ flex: 1 }} />
      ) : null}
      {legal.canCheck ? (
        <Button label={t('check')} variant="secondary" onPress={() => run({ type: 'check', playerId })} style={{ flex: 1 }} />
      ) : (
        <Button
          label={legal.canRaise ? t('call') : t('allIn')}
          sub={fmt(legal.toCall)}
          variant="secondary"
          onPress={() => run({ type: 'call', playerId })}
          style={{ flex: 1 }}
        />
      )}
      <Button label={t('fold')} variant="danger" onPress={() => run({ type: 'fold', playerId })} style={{ flex: 1 }} />
    </Row>
  );
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.stepper, pressed && { opacity: 0.7 }]}>
      <T style={{ fontSize: 26, fontWeight: '700', textAlign: 'center' }}>{label}</T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  amount: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.felt,
    color: colors.gold,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  stepper: {
    width: 56,
    height: 52,
    borderRadius: radius,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preset: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetLabel: { fontSize: 14, textAlign: 'center' },
});
