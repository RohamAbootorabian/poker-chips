import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { tableUrl } from '@/lib/links';

import { t } from './i18n';
import { Button, D, Row, T } from './kit';
import { QrCode } from './QrCode';
import { colors, radius } from './theme';

/** Everything needed to bring someone to this table: QR code, link, copy and share. */
export function InviteSheet({ code, visible, onClose }: { code: string; visible: boolean; onClose: () => void }) {
  const url = tableUrl(code);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    // Called straight from the tap: Safari only allows clipboard writes inside the user gesture.
    Clipboard.setStringAsync(url)
      .then((ok) => setCopied(ok))
      .catch(() => setCopied(false));
  };
  const share = () => {
    Share.share({ message: t('inviteMessage', { url }), url }).catch(() => {});
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('close')} />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.inner}>
          <D style={styles.title}>{t('inviteTitle')}</D>
          <T style={styles.hint}>{t('inviteHint')}</T>
          <View style={styles.qr}>
            <QrCode value={url} size={232} />
          </View>
          <D style={styles.code}>{code}</D>
          <T selectable style={styles.url} numberOfLines={1}>
            {url}
          </T>
          <Row>
            <Button label={copied ? t('linkCopied') : t('copyLink')} onPress={copy} style={{ flex: 1 }} />
            <Button label={t('share')} variant="secondary" onPress={share} style={{ flex: 1 }} />
          </Row>
          <Button label={t('close')} variant="ghost" onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5, 9, 20, 0.6)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    borderColor: colors.gold,
  },
  inner: { padding: 20, gap: 12, maxWidth: 520, width: '100%', alignSelf: 'center', alignItems: 'stretch' },
  title: { fontSize: 28, lineHeight: 40, textAlign: 'center' },
  hint: { color: colors.muted, textAlign: 'center', fontSize: 14 },
  qr: { alignSelf: 'center', padding: 10, backgroundColor: colors.ivory, borderRadius: radius },
  code: { color: colors.gold, fontSize: 30, lineHeight: 40, letterSpacing: 6, textAlign: 'center' },
  url: { color: colors.muted, fontSize: 13, textAlign: 'center', writingDirection: 'ltr' },
});
