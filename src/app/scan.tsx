import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { parseTableCode } from '@/lib/links';
import { t } from '@/ui/i18n';
import { Button, D, Notice, T } from '@/ui/kit';
import { colors } from '@/ui/theme';

/** Scan a table's QR code with the camera and go straight to that table. */
export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  // The camera reports the same code many times a second; act on the first one only.
  const done = useRef(false);

  const onScan = ({ data }: { data: string }) => {
    if (done.current) return;
    const code = parseTableCode(data);
    if (!code) {
      setError(t('notATableQr'));
      return;
    }
    done.current = true;
    router.replace(`/table/${code}`);
  };

  return (
    <SafeAreaView style={styles.page}>
      <D style={styles.title}>{t('scanQr')}</D>

      {!permission ? null : permission.granted ? (
        <>
          <T style={styles.hint}>{t('scanHint')}</T>
          <View style={styles.frame}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={onScan}
            />
          </View>
          <Notice text={error} />
        </>
      ) : (
        <View style={{ gap: 12 }}>
          <T style={styles.hint}>{permission.canAskAgain ? t('cameraWhy') : t('cameraDenied')}</T>
          {permission.canAskAgain ? <Button label={t('allowCamera')} onPress={requestPermission} /> : null}
        </View>
      )}

      <Button label={t('back')} variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg, padding: 20, gap: 16, maxWidth: 520, width: '100%', alignSelf: 'center' },
  title: { fontSize: 30, lineHeight: 42, textAlign: 'center' },
  hint: { color: colors.muted, textAlign: 'center' },
  frame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: colors.felt,
  },
});
