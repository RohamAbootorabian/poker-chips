import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import { fonts } from './theme';

/** Casino-style chip colours, by value. */
const DENOMS = [
  { value: 1000, base: '#E2D7BE', dark: '#A39673', spot: '#22325F', inlay: '#FFFFFF', ink: '#22325F' },
  { value: 500, base: '#5B2A86', dark: '#381556', spot: '#F4EEDF', inlay: '#F3E8D2', ink: '#5B2A86' },
  { value: 100, base: '#1B1B20', dark: '#000000', spot: '#E2BC5C', inlay: '#F3E8D2', ink: '#1B1B20' },
  { value: 50, base: '#C99532', dark: '#8A631C', spot: '#5B1624', inlay: '#F6EEDB', ink: '#7A5418' },
  { value: 25, base: '#1F8A7C', dark: '#125A51', spot: '#F4EEDF', inlay: '#F3E8D2', ink: '#16695F' },
  { value: 10, base: '#22325F', dark: '#121C3A', spot: '#F4EEDF', inlay: '#F3E8D2', ink: '#22325F' },
  { value: 5, base: '#A3233A', dark: '#6E1426', spot: '#F4EEDF', inlay: '#F3E8D2', ink: '#A3233A' },
  { value: 1, base: '#EDE3CC', dark: '#B9AC8E', spot: '#A3233A', inlay: '#FFFFFF', ink: '#A3233A' },
] as const;
type Denom = (typeof DENOMS)[number];

const MAX_STACKS = 3;
const MAX_PER_STACK = 8;

/**
 * Split an amount into chips, biggest first, as a few short stacks of one
 * colour each. Only a picture of the amount: very large amounts are capped.
 */
export function chipStacks(amount: number): Denom[][] {
  const stacks: Denom[][] = [];
  let rest = Math.max(0, Math.round(amount));
  for (const d of DENOMS) {
    const n = Math.floor(rest / d.value);
    if (n === 0) continue;
    rest -= n * d.value;
    stacks.push(Array.from({ length: Math.min(n, MAX_PER_STACK) }, () => d));
    if (stacks.length === MAX_STACKS) break;
  }
  return stacks;
}

/** One stack of chips seen from slightly above. `size` is the chip diameter in pixels. */
export function ChipStack({ chips, size, showValue }: { chips: Denom[]; size: number; showValue?: boolean }) {
  const uid = useId().replace(/:/g, '');
  if (chips.length === 0) return null;
  const n = chips.length;
  const rx = size / 2;
  const ry = size * 0.2;
  const t = Math.max(1.6, size * 0.09);
  const pad = size * 0.08; // room for the shadow and the uneven stack
  const width = size + pad * 2;
  const height = ry * 2 + t * n + pad;
  // y of the top face centre of chip i (0 = bottom)
  const faceY = (i: number) => ry + (n - 1 - i) * t;
  // Small deterministic wobble so the stack does not look machine-made.
  const dx = (i: number) => (((i * 37) % 5) - 2) * size * 0.012;
  const arc = (x: number) => ry * Math.sqrt(Math.max(0, 1 - ((x - rx) / rx) ** 2));

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={`shade${uid}`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#000" stopOpacity={0.55} />
          <Stop offset="0.22" stopColor="#000" stopOpacity={0.08} />
          <Stop offset="0.38" stopColor="#fff" stopOpacity={0.22} />
          <Stop offset="0.55" stopColor="#000" stopOpacity={0} />
          <Stop offset="0.8" stopColor="#000" stopOpacity={0.25} />
          <Stop offset="1" stopColor="#000" stopOpacity={0.6} />
        </LinearGradient>
      </Defs>
      <Ellipse cx={pad + rx} cy={faceY(0) + t + ry * 0.35} rx={rx * 1.08} ry={ry * 1.05} fill="#000" opacity={0.35} />
      {chips.map((c, i) => {
        const x0 = pad + dx(i);
        const cy = faceY(i);
        const side = `M${x0} ${cy}L${x0} ${cy + t}A${rx} ${ry} 0 0 0 ${x0 + size} ${cy + t}L${x0 + size} ${cy}Z`;
        // Six edge inserts around the rim; about three face the viewer.
        const phase = (i * 23) % 60;
        const spots: string[] = [];
        for (let k = 0; k < 6; k++) {
          const a0 = Math.max(0, phase + k * 60);
          const a1 = Math.min(180, phase + k * 60 + 16);
          if (a1 <= a0) continue;
          const sx0 = rx * (1 - Math.cos((a0 * Math.PI) / 180));
          const sx1 = rx * (1 - Math.cos((a1 * Math.PI) / 180));
          spots.push(
            `M${x0 + sx0} ${cy + arc(sx0)}L${x0 + sx1} ${cy + arc(sx1)}L${x0 + sx1} ${cy + t + arc(sx1)}L${x0 + sx0} ${cy + t + arc(sx0)}Z`,
          );
        }
        return (
          <G key={i}>
            <Path d={side} fill={c.base} />
            {spots.length ? <Path d={spots.join('')} fill={c.spot} /> : null}
            <Path d={side} fill={`url(#shade${uid})`} />
            {i === n - 1 ? <ChipFace c={c} cx={x0 + rx} cy={cy} rx={rx} ry={ry} phase={phase} showValue={showValue} size={size} /> : null}
          </G>
        );
      })}
    </Svg>
  );
}

function ChipFace(props: { c: Denom; cx: number; cy: number; rx: number; ry: number; phase: number; showValue?: boolean; size: number }) {
  const { c, cx, cy, rx, ry, phase } = props;
  const pt = (r: number, a: number) => `${cx + rx * r * Math.cos((a * Math.PI) / 180)} ${cy + ry * r * Math.sin((a * Math.PI) / 180)}`;
  let spots = '';
  for (let k = 0; k < 6; k++) {
    const a0 = phase + k * 60;
    const a1 = a0 + 16;
    spots += `M${pt(0.8, a0)}L${pt(1, a0)}L${pt(1, a1)}L${pt(0.8, a1)}Z`;
  }
  return (
    <G>
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={c.base} />
      <Path d={spots} fill={c.spot} />
      <Ellipse cx={cx} cy={cy} rx={rx * 0.6} ry={ry * 0.6} fill={c.dark} />
      <Ellipse cx={cx} cy={cy} rx={rx * 0.55} ry={ry * 0.55} fill={c.inlay} />
      <Ellipse cx={cx - rx * 0.25} cy={cy - ry * 0.35} rx={rx * 0.6} ry={ry * 0.45} fill="#fff" opacity={0.12} />
      {props.showValue ? (
        <SvgText
          x={cx}
          y={cy + props.size * 0.045}
          fontSize={props.size * 0.16}
          fontFamily={fonts.display}
          fill={c.ink}
          textAnchor="middle"
          scaleY={0.5}
          originY={cy}
        >
          {String(c.value)}
        </SvgText>
      ) : null}
    </G>
  );
}

/** An amount shown as a few stacks of chips side by side. */
export function ChipPile({ amount, size = 22 }: { amount: number; size?: number }) {
  const stacks = chipStacks(amount);
  if (stacks.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      {stacks.map((s, i) => (
        <View key={i} style={{ marginLeft: i === 0 ? 0 : -size * 0.18 }}>
          <ChipStack chips={s} size={size} showValue={size >= 40} />
        </View>
      ))}
    </View>
  );
}
