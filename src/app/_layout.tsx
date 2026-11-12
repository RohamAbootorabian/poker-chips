import { Lalezar_400Regular } from '@expo-google-fonts/lalezar/400Regular';
import { Vazirmatn_400Regular } from '@expo-google-fonts/vazirmatn/400Regular';
import { Vazirmatn_600SemiBold } from '@expo-google-fonts/vazirmatn/600SemiBold';
import { Vazirmatn_700Bold } from '@expo-google-fonts/vazirmatn/700Bold';
import { useFonts } from '@expo-google-fonts/vazirmatn/useFonts';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSyncExternalStore } from 'react';
import { View } from 'react-native';

import { getLang, subscribeLang } from '@/ui/lang';
import { colors } from '@/ui/theme';

export default function RootLayout() {
  // Re-mount everything when the language changes so every screen re-reads its strings.
  const lang = useSyncExternalStore(subscribeLang, getLang, getLang);
  const [loaded, error] = useFonts({ Lalezar_400Regular, Vazirmatn_400Regular, Vazirmatn_600SemiBold, Vazirmatn_700Bold });
  // Hold a blank navy screen until the fonts are in (or failed: system fonts still work).
  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <>
      <StatusBar style="light" />
      <Stack key={lang} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </>
  );
}
