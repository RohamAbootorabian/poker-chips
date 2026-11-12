import { StyleSheet, Text, View } from 'react-native';

import { colors } from './theme';

const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' } as const;
const SIZES = {
  sm: { w: 30, h: 42, rank: 14, suit: 12, big: 0, r: 4 },
  md: { w: 40, h: 56, rank: 16, suit: 13, big: 22, r: 5 },
  lg: { w: 70, h: 98, rank: 24, suit: 19, big: 42, r: 9 },
};
type Size = keyof typeof SIZES;

/** One playing card ("As", "Td"…). `null` draws the back; `undefined` an empty place on the felt. */
export function PlayingCard({ card, size = 'md' }: { card?: string | null; size?: Size }) {
  const s = SIZES[size];
  const box = { width: s.w, height: s.h, borderRadius: s.r };
  if (card === undefined) return <View style={[styles.slot, box]} />;
  if (card === null) return <CardBack width={s.w} height={s.h} radius={s.r} />;
  const suit = card[1] as keyof typeof SUIT;
  const color = suit === 'h' || suit === 'd' ? '#B3202E' : '#161B2E';
  const rank = card[0] === 'T' ? '10' : card[0];
  return (
    <View style={[styles.face, box]} accessibilityLabel={`${rank}${SUIT[suit]}`}>
      <View style={[styles.corner, { top: s.h * 0.05, left: s.w * 0.1 }]}>
        <Text style={{ color, fontSize: s.rank, fontWeight: '800', lineHeight: s.rank * 1.05, letterSpacing: -0.5 }}>
          {rank}
        </Text>
        <Text style={{ color, fontSize: s.suit, lineHeight: s.suit * 1.05 }}>{SUIT[suit]}</Text>
      </View>
      {s.big ? (
        <Text style={[styles.big, { color, fontSize: s.big, lineHeight: s.big * 1.1, bottom: s.h * 0.08, right: s.w * 0.1 }]}>
          {SUIT[suit]}
        </Text>
      ) : null}
    </View>
  );
}

/** The back of a card: navy with an ivory border and a brass inner frame. */
export function CardBack(props: { width: number; height: number; radius: number; rotate?: number; thin?: boolean }) {
  const { width, height, radius, rotate = 0 } = props;
  return (
    <View style={[styles.back, { width, height, borderRadius: radius, padding: props.thin ? 1 : 2, transform: [{ rotate: `${rotate}deg` }] }]}>
      <View style={[styles.backInner, { borderRadius: Math.max(2, radius - 2) }]} />
    </View>
  );
}

/** Cards side by side. Always left-to-right, like a real board. */
export function CardRow(props: { cards: (string | null | undefined)[]; size?: Size }) {
  return (
    <View style={styles.row}>
      {props.cards.map((c, i) => (
        <PlayingCard key={i} card={c} size={props.size} />
      ))}
    </View>
  );
}

/** Your own two cards, fanned a little as if held in the hand. */
export function HandCards({ cards }: { cards: string[] }) {
  return (
    <View style={styles.hand}>
      {cards.map((c, i) => (
        <View
          key={i}
          style={{ marginLeft: i === 0 ? 0 : -12, transform: [{ rotate: `${(i - (cards.length - 1) / 2) * 12}deg` }, { translateY: i === 0 || i === cards.length - 1 ? 4 : 0 }] }}
        >
          <PlayingCard card={c} size="lg" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, justifyContent: 'center' },
  hand: { flexDirection: 'row', justifyContent: 'center', paddingTop: 4 },
  face: {
    backgroundColor: colors.ivory,
    boxShadow: '0 3px 8px rgba(0, 0, 0, 0.45)',
    overflow: 'hidden',
  },
  corner: { position: 'absolute', alignItems: 'center' },
  big: { position: 'absolute' },
  back: {
    backgroundColor: colors.ivory,
    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.45)',
  },
  backInner: { flex: 1, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.gold },
  // An empty place on the felt where a community card will land.
  slot: { backgroundColor: 'rgba(0, 0, 0, 0.16)', borderWidth: 1, borderColor: 'rgba(246, 240, 226, 0.14)' },
});
