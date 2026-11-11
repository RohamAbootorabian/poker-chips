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
import { colors, radius } from './theme';

/** Text in the app's default colour, aligned for the current language. */
export function T({ style, ...rest }: TextProps) {
  const dir = { writingDirection: isRTL() ? 'rtl' : 'ltr', textAlign: startAlign() } as const;
  return <Text {...rest} style={[styles.text, dir, style]} />;
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
      <Text style={[styles.buttonLabel, v === 'primary' && { color: colors.ink }]}>{props.label}</Text>
      {props.sub ? (
        <Text style={[styles.buttonSub, v === 'primary' && { color: colors.ink }]}>{props.sub}</Text>
      ) : null}
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
  buttonLabel: { color: colors.text, fontSize: 17, fontWeight: '700' },
  buttonSub: { color: colors.text, fontSize: 13, opacity: 0.85, marginTop: 2 },
  fieldLabel: { color: colors.muted, fontSize: 13 },
  input: {
    minHeight: 50,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.felt,
    color: colors.text,
    fontSize: 18,
    paddingHorizontal: 14,
  },
  card: {
    backgroundColor: colors.felt,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 10,
  },
  row: { alignItems: 'center', gap: 10 },
  notice: {
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.red,
    backgroundColor: '#3A1716',
    padding: 10,
  },
});

const buttonStyles = StyleSheet.create({
  primary: { backgroundColor: colors.gold },
  secondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  danger: { backgroundColor: '#5A2220', borderWidth: 1, borderColor: colors.red },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
});
