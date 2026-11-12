import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createTable } from '@/engine/engine';
import { getDeviceId, getName, newTableCode, setName } from '@/lib/identity';
import { store } from '@/net/store';
import { Button, Card, D, Field, Notice, Row, T } from '@/ui/kit';
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
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* The near edge of the table: crimson felt inside a walnut and brass rail. */}
          <View style={styles.rail}>
            <SafeAreaView edges={['top']} style={styles.felt}>
              <Pressable onPress={() => setLang(getLang() === 'fa' ? 'en' : 'fa')} hitSlop={10} style={styles.lang}>
                <T style={styles.langLabel}>{t('otherLanguage')}</T>
              </Pressable>
              <D style={styles.title}>{t('appTitle')}</D>
              <T style={styles.tagline}>{t('appTagline')}</T>
            </SafeAreaView>
          </View>

          <View style={styles.page}>
            <Field label={t('yourName')} value={name} onChangeText={setNameText} placeholder={t('namePlaceholder')} maxLength={20} />
            <Notice text={error} />

            <Card>
              <D style={styles.section}>{t('joinTable')}</D>
              <Button label={t('scanQr')} variant="secondary" onPress={() => router.push('/scan')} />
              <Row style={{ alignItems: 'flex-end' }}>
                <Field
                  label={t('tableCode')}
                  value={code}
                  onChangeText={(text) => setCode(text.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={5}
                  style={styles.codeInput}
                />
                <Button label={t('join')} onPress={join} disabled={busy} style={{ minWidth: 96, minHeight: 50 }} />
              </Row>
            </Card>

            <Card>
              <D style={styles.section}>{t('newTable')}</D>
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
              <T style={styles.help}>{t(mode === 'chips' ? 'modeChipsHint' : 'modeOnlineHint')}</T>
              <Row>
                <Field label={t('smallBlind')} value={smallBlind} onChangeText={setSmallBlind} keyboardType="number-pad" />
                <Field label={t('bigBlind')} value={bigBlind} onChangeText={setBigBlind} keyboardType="number-pad" />
                <Field label={t('buyInEach')} value={buyIn} onChangeText={setBuyIn} keyboardType="number-pad" />
              </Row>
              <Button label={t('createTable')} variant="secondary" onPress={create} disabled={busy} />
            </Card>

            {!store.online ? <T style={styles.offline}>{t('offlineNotice')}</T> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  rail: {
    backgroundColor: colors.rail,
    borderBottomLeftRadius: 150,
    borderBottomRightRadius: 150,
    borderBottomWidth: 1.5,
    borderColor: colors.gold,
    paddingBottom: 9,
    paddingHorizontal: 9,
    marginHorizontal: -40,
  },
  felt: {
    backgroundColor: colors.crimson,
    borderBottomLeftRadius: 140,
    borderBottomRightRadius: 140,
    paddingHorizontal: 64,
    paddingTop: 18,
    paddingBottom: 44,
    alignItems: 'center',
    gap: 2,
  },
  lang: { alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14, backgroundColor: colors.crimsonDeep },
  langLabel: { fontSize: 13, color: colors.ivory, textAlign: 'center' },
  title: { fontSize: 58, lineHeight: 78, color: colors.ivory, textAlign: 'center' },
  tagline: { color: colors.ivory, opacity: 0.85, fontSize: 15, textAlign: 'center', maxWidth: 300 },
  page: { padding: 20, gap: 20, maxWidth: 520, width: '100%', alignSelf: 'center' },
  section: { fontSize: 24, lineHeight: 34 },
  help: { color: colors.muted, fontSize: 14 },
  mode: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.felt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeOn: { backgroundColor: colors.gold },
  modeLabel: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  codeInput: { textAlign: 'center', letterSpacing: 6, fontSize: 22 },
  offline: { color: colors.muted, fontSize: 13, textAlign: 'center' },
});
