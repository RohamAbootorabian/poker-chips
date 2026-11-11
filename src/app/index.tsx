import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createTable } from '@/engine/engine';
import { getDeviceId, getName, newTableCode, setName } from '@/lib/identity';
import { store } from '@/net/store';
import { Button, Card, Field, Notice, Row, T } from '@/ui/kit';
import { describeError } from '@/ui/strings';
import { colors, parseAmount } from '@/ui/theme';

export default function Home() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [name, setNameText] = useState(getName());
  const [code, setCode] = useState((params.code ?? '').toUpperCase());
  const [smallBlind, setSmallBlind] = useState('5');
  const [bigBlind, setBigBlind] = useState('10');
  const [buyIn, setBuyIn] = useState('1000');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const requireName = () => {
    if (!name.trim()) {
      setError('اول اسم خودتان را وارد کنید.');
      return false;
    }
    setName(name);
    return true;
  };

  const create = async () => {
    if (!requireName()) return;
    setBusy(true);
    setError(null);
    try {
      const settings = {
        smallBlind: parseAmount(smallBlind),
        bigBlind: parseAmount(bigBlind),
        buyIn: parseAmount(buyIn),
      };
      // A code collision is unlikely; try a few codes before giving up.
      for (let i = 0; i < 4; i++) {
        const state = createTable(newTableCode(), getDeviceId(), name.trim(), settings);
        if (await store.create(state)) {
          router.push(`/table/${state.code}`);
          return;
        }
      }
      setError('ساخت میز انجام نشد. دوباره تلاش کنید.');
    } catch (e) {
      setError(
        (e as { code?: string }).code === 'badAmount'
          ? 'بلایندها و مبلغ ورود باید عدد مثبت باشند و بلایند کوچک ≤ بلایند بزرگ ≤ مبلغ ورود.'
          : describeError(e),
      );
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    if (!requireName()) return;
    const c = code.trim().toUpperCase();
    if (c.length < 4) {
      setError('کد میز را وارد کنید.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (await store.fetch(c)) router.push(`/table/${c}`);
      else setError('میزی با این کد پیدا نشد.');
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 4, marginTop: 12 }}>
            <T style={styles.title}>چیپ پوکر</T>
            <T style={{ color: colors.muted }}>با کارت واقعی بازی کنید؛ حساب چیپ‌ها با اپ.</T>
          </View>

          <Field label="اسم شما" value={name} onChangeText={setNameText} placeholder="مثلاً علی" maxLength={20} />
          <Notice text={error} />

          <Card>
            <T style={styles.cardTitle}>ورود به میز</T>
            <Field
              label="کد میز"
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={5}
              style={styles.codeInput}
            />
            <Button label="ورود" onPress={join} disabled={busy} />
          </Card>

          <Card>
            <T style={styles.cardTitle}>ساخت میز جدید</T>
            <Row>
              <Field label="بلایند کوچک" value={smallBlind} onChangeText={setSmallBlind} keyboardType="number-pad" />
              <Field label="بلایند بزرگ" value={bigBlind} onChangeText={setBigBlind} keyboardType="number-pad" />
            </Row>
            <Field label="مبلغ ورود هر نفر" value={buyIn} onChangeText={setBuyIn} keyboardType="number-pad" />
            <Button label="ساخت میز" variant="secondary" onPress={create} disabled={busy} />
          </Card>

          <Card style={{ opacity: 0.6 }}>
            <T style={styles.cardTitle}>پوکر آنلاین (به‌زودی)</T>
            <T style={{ color: colors.muted }}>بازی کامل چندنفره با کارت‌های داخل اپ.</T>
          </Card>

          {!store.online ? (
            <T style={styles.offline}>
              حالت آزمایشی: سرور تنظیم نشده و میزها فقط روی همین دستگاه ذخیره می‌شوند.
            </T>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, gap: 16, maxWidth: 520, width: '100%', alignSelf: 'center' },
  title: { fontSize: 34, fontWeight: '800', color: colors.gold },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  codeInput: { textAlign: 'center', letterSpacing: 6, fontSize: 24, fontWeight: '700' },
  offline: { color: colors.muted, fontSize: 13, textAlign: 'center' },
});
