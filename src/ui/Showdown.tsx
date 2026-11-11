import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Action, TableState } from '@/engine/types';

import { Button, T } from './kit';
import { colors, fmt } from './theme';

/** Host picks who won the next undecided pot (several winners = split). */
export function Showdown({ state, run }: { state: TableState; run: (a: Action) => void }) {
  const potIndex = state.pots.findIndex((p) => !p.winners);
  const [picked, setPicked] = useState<{ pot: number; ids: string[] }>({ pot: potIndex, ids: [] });
  if (potIndex < 0) return null;
  const pot = state.pots[potIndex];
  const ids = picked.pot === potIndex ? picked.ids : [];
  const toggle = (id: string) =>
    setPicked({ pot: potIndex, ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] });
  const title = state.pots.length === 1 ? 'پات' : potIndex === 0 ? 'پات اصلی' : `پات کناری ${fmt(potIndex)}`;

  return (
    <View style={{ gap: 10 }}>
      <T style={{ textAlign: 'center' }}>
        برندهٔ {title} ({fmt(pot.amount)}) را انتخاب کنید
      </T>
      <View style={styles.chips}>
        {pot.eligible.map((id) => {
          const on = ids.includes(id);
          return (
            <Pressable key={id} onPress={() => toggle(id)} style={[styles.chip, on && styles.chipOn]}>
              <T style={[styles.chipLabel, on && { color: colors.ink }]}>
                {state.players.find((p) => p.id === id)?.name}
              </T>
            </Pressable>
          );
        })}
      </View>
      <Button
        label={ids.length > 1 ? 'تقسیم پات' : 'تأیید برنده'}
        disabled={ids.length === 0}
        onPress={() => run({ type: 'award', potIndex, winnerIds: ids })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipLabel: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
});
