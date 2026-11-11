import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSyncExternalStore } from 'react';

import { getLang, subscribeLang } from '@/ui/lang';
import { colors } from '@/ui/theme';

export default function RootLayout() {
  // Re-mount everything when the language changes so every screen re-reads its strings.
  const lang = useSyncExternalStore(subscribeLang, getLang, getLang);
  return (
    <>
      <StatusBar style="light" />
      <Stack key={lang} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </>
  );
}
