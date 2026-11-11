import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createTable } from '@/engine/engine';
import { getDeviceId, getName, newTableCode, setName } from '@/lib/identity';
import { store } from '@/net/store';
import { Button, Card, Field, Notice, Row, T } from '@/ui/kit';
import { describeError, t } from '@/ui/i18n';
import { getLang, setLang } from '@/ui/lang';
import { colors, parseAmount } from '@/ui/theme';

export default function Home() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [name, setNameText] = useState(getName());
  const [code, setCode] = useState((params.code ?? '').toUpperCase());
  const [smallBlind, setSmallBlind] = useState('5');
  const [bigBlind, setBigBlind] = useState('10');
  const [buyIn, setBuyIn] = useState('1000');
  const [mode, setMode] = useState<'chips' | 'online'>('chips');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const requireName = () => {
    if (!name.trim()) {
      setError(t('needName'));
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
        // Validates the settings (throws badAmount) before anything is sent.
        const state = createTable(newTableCode(), getDeviceId(), name.trim(), settings);
        const created =
          mode === 'online'
            ? await store.createOnline(state.code, state.hostId, name.trim(), settings)
            : await store.create(state);
        if (created) {
          router.push(`/table/${state.code}`);
          return;
        }
      }
      setError(t('createFailed'));
    } catch (e) {
      setError(
        (e as { code?: string }).code === 'badAmount'
          ? t('badSettings')
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
      setError(t('needCode'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (await store.fetch(c)) router.push(`/table/${c}`);
      else setError(t('tableNotFound'));
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
            <Row style={{ justifyContent: 'space-between' }}>
              <T style={styles.title}>{t('appTitle')}</T>
              <Pressable onPress={() => setLang(getLang() === 'fa' ? 'en' : 'fa')} hitSlop={10} style={styles.lang}>
                <T style={{ fontSize: 14 }}>{t('otherLanguage')}</T>
              </Pressable>
            </Row>
            <T style={{ color: colors.muted }}>{t('appTagline')}</T>
          </View>

          <Field label={t('yourName')} value={name} onChangeText={setNameText} placeholder={t('namePlaceholder')} maxLength={20} />
          <Notice text={error} />

          <Card>
            <T style={styles.cardTitle}>{t('joinTable')}</T>
            <Field
              label={t('tableCode')}
              value={code}
              onChangeText={(text) => setCode(text.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={5}
              style={styles.codeInput}
            />
            <Button label={t('join')} onPress={join} disabled={busy} />
          </Card>

          <Card>
            <T style={styles.cardTitle}>{t('newTable')}</T>
            <Row style={{ gap: 8 }}>
              {(['chips', 'online'] as const).map((m) => (
                <Pressable
                  key={m}
                  disabled={m === 'online' && !store.online}
                  onPress={() => setMode(m)}
                  style={[styles.mode, mode === m && styles.modeOn, m === 'online' && !store.online && { opacity: 0.4 }]}
                >
                  <T style={[styles.modeLabel, mode === m && { color: colors.ink }]}>
                    {t(m === 'chips' ? 'modeChips' : 'modeOnline')}
                  </T>
                </Pressable>
              ))}
            </Row>
            <T style={{ color: colors.muted, fontSize: 14 }}>
              {t(mode === 'chips' ? 'modeChipsHint' : 'modeOnlineHint')}
            </T>
            <Row>
              <Field label={t('smallBlind')} value={smallBlind} onChangeText={setSmallBlind} keyboardType="number-pad" />
              <Field label={t('bigBlind')} value={bigBlind} onChangeText={setBigBlind} keyboardType="number-pad" />
            </Row>
            <Field label={t('buyInEach')} value={buyIn} onChangeText={setBuyIn} keyboardType="number-pad" />
            <Button label={t('createTable')} variant="secondary" onPress={create} disabled={busy} />
          </Card>

          {!store.online ? (
            <T style={styles.offline}>{t('offlineNotice')}</T>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, gap: 16, maxWidth: 520, width: '100%', alignSelf: 'center' },
  title: { fontSize: 34, fontWeight: '800', color: colors.gold },
  lang: { borderWidth: 1, borderColor: colors.line, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  mode: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  modeLabel: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  codeInput: { textAlign: 'center', letterSpacing: 6, fontSize: 24, fontWeight: '700' },
  offline: { color: colors.muted, fontSize: 13, textAlign: 'center' },
});
