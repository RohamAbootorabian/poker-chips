import { ReactNode } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  View,
  ViewStyle,
} from 'react-native';

import { isRTL, rowDir, startAlign } from './lang';
import { colors, fonts, radius } from './theme';

/**
 * Body text in the app's default colour, aligned for the current language.
 * Custom fonts have one file per weight, so `fontWeight` is turned into the matching family.
 */
export function T({ style, ...rest }: TextProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  const weight = Number(flat.fontWeight ?? 400);
  const fontFamily = flat.fontFamily ?? (weight >= 700 ? fonts.bold : weight >= 600 ? fonts.medium : fonts.body);
  const dir = { writingDirection: isRTL() ? 'rtl' : 'ltr', textAlign: startAlign() } as const;
  return <Text {...rest} style={[styles.text, dir, flat, { fontFamily, fontWeight: 'normal' }]} />;
}

/** Display text: titles and big numbers. */
export function D({ style, ...rest }: TextProps) {
  return <T {...rest} style={[{ fontFamily: fonts.display }, style]} />;
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button(props: {
  label: string;
  sub?: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = props.variant ?? 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.button,
        buttonStyles[v],
        pressed && { opacity: 0.75 },
        props.disabled && { opacity: 0.4 },
        props.style,
      ]}
    >
      <T style={[styles.buttonLabel, v === 'primary' && { color: colors.ink }]}>{props.label}</T>
      {props.sub ? <T style={[styles.buttonSub, v === 'primary' && { color: colors.ink }]}>{props.sub}</T> : null}
    </Pressable>
  );
}

export function Field({ label, style, ...rest }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <T style={styles.fieldLabel}>{label}</T>
      <TextInput
        placeholderTextColor={colors.muted}
        selectionColor={colors.gold}
        {...rest}
        style={[styles.input, { textAlign: startAlign() }, style]}
      />
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** A horizontal row that follows the reading direction of the current language. */
export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, { flexDirection: rowDir() }, style]}>{children}</View>;
}

export function Notice({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <View style={styles.notice}>
      <T style={{ color: colors.red, textAlign: 'center' }}>{text}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.text, fontSize: 16 },
  button: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { color: colors.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  buttonSub: { color: colors.text, fontSize: 13, opacity: 0.85, textAlign: 'center' },
  fieldLabel: { color: colors.muted, fontSize: 13 },
  input: {
    minHeight: 50,
    borderRadius: radius,
    backgroundColor: colors.felt,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 18,
    paddingHorizontal: 14,
  },
  // A section of a page: grouped by space and a hairline, not boxed.
  card: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 16, gap: 12 },
  row: { alignItems: 'center', gap: 10 },
  notice: {
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.red,
    backgroundColor: '#3A1A2A',
    padding: 10,
  },
});

const buttonStyles = StyleSheet.create({
  primary: { backgroundColor: colors.gold },
  secondary: { backgroundColor: colors.card },
  danger: { backgroundColor: colors.crimson },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
});
