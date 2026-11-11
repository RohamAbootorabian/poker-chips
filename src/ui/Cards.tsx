import { StyleSheet, Text, View } from 'react-native';

import { colors } from './theme';

const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' } as const;
const SIZES = {
  sm: { w: 30, h: 42, rank: 15, suit: 13, r: 5 },
  md: { w: 44, h: 62, rank: 21, suit: 19, r: 7 },
  lg: { w: 64, h: 90, rank: 30, suit: 28, r: 10 },
};

/** One playing card ("As", "Td"…). `null` draws the back; `undefined` an empty slot. */
export function PlayingCard({ card, size = 'md' }: { card?: string | null; size?: keyof typeof SIZES }) {
  const s = SIZES[size];
  const box = { width: s.w, height: s.h, borderRadius: s.r };
  if (card === undefined) return <View style={[styles.slot, box]} />;
  if (card === null) return <View style={[styles.back, box]} />;
  const suit = card[1] as keyof typeof SUIT;
  const color = suit === 'h' || suit === 'd' ? '#C62828' : '#16181D';
  const rank = card[0] === 'T' ? '10' : card[0];
  return (
    <View style={[styles.face, box]} accessibilityLabel={`${rank}${SUIT[suit]}`}>
      <Text style={{ color, fontSize: s.rank, fontWeight: '800', lineHeight: s.rank * 1.1 }}>{rank}</Text>
      <Text style={{ color, fontSize: s.suit, lineHeight: s.suit * 1.1 }}>{SUIT[suit]}</Text>
    </View>
  );
}

/** Cards side by side. Always left-to-right, like a real board. */
export function CardRow(props: { cards: (string | null | undefined)[]; size?: keyof typeof SIZES }) {
  return (
    <View style={styles.row}>
      {props.cards.map((c, i) => (
        <PlayingCard key={i} card={c} size={props.size} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  face: { backgroundColor: '#FAF7EF', alignItems: 'center', justifyContent: 'center' },
  back: { backgroundColor: '#7A2230', borderWidth: 2, borderColor: '#FAF7EF' },
  slot: { borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed' },
});
