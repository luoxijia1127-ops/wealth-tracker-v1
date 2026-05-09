/**
 * 应用推荐分享：先展示社交网络快捷入口（复制文案并尝试唤起 App），
 * 「更多应用」再走系统 Share（因系统分享面板无法强制排序社交目标）。
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { useLanguage } from '@/contexts/language-context';
import { pickTextOnAccent, rgbaFromHex } from '@/lib/color-utils';
import type { TranslationKey } from '@/lib/language';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SocialRow = {
  id: string;
  labelKey: TranslationKey;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  /** 唤起客户端；复制后尝试打开 */
  nativeUrl?: string;
  /** Web：新开页分享 */
  webUrl?: string;
};

function socialTargets(message: string): SocialRow[] {
  const enc = encodeURIComponent(message);
  return [
    {
      id: 'wechat',
      labelKey: 'settings.share.social.wechat',
      icon: 'wechat',
      nativeUrl: 'weixin://',
    },
    {
      id: 'weibo',
      labelKey: 'settings.share.social.weibo',
      icon: 'sina-weibo',
      nativeUrl: 'sinaweibo://',
      webUrl: `https://service.weibo.com/share/share.php?title=${enc}&url=`,
    },
    {
      id: 'xiaohongshu',
      labelKey: 'settings.share.social.xiaohongshu',
      icon: 'notebook',
      nativeUrl: 'xhsdiscover://',
    },
    {
      id: 'x',
      labelKey: 'settings.share.social.x',
      icon: 'twitter',
      nativeUrl: `twitter://post?message=${enc}`,
      webUrl: `https://twitter.com/intent/tweet?text=${enc}`,
    },
    {
      id: 'instagram',
      labelKey: 'settings.share.social.instagram',
      icon: 'instagram',
      nativeUrl: 'instagram://app',
    },
  ];
}

export function ShareAppSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { theme, appearance } = useAppPalette();
  const { t } = useLanguage();
  const message = t('settings.share.message');
  const sheetBg = theme.surfaceWhite;
  const ink = theme.primary;
  const muted = rgbaFromHex(theme.primary, appearance === 'dark' ? 0.72 : 0.55);
  const targets = socialTargets(message);
  const chipW = Math.min(92, (width - 40 - 16) / 4);

  const copyAndMaybeOpen = async (row: SocialRow) => {
    await Clipboard.setStringAsync(message);
    if (Platform.OS === 'web') {
      if (row.webUrl) {
        await Linking.openURL(row.webUrl);
      } else {
        await Share.share({ message, title: 'Assetup' });
      }
      onClose();
      return;
    }
    if (row.nativeUrl) {
      try {
        await Linking.openURL(row.nativeUrl);
      } catch {
        /* 仍依赖剪贴板 */
      }
    }
    Alert.alert(t('settings.share.copiedTitle'), t('settings.share.copiedPasteHint'));
    onClose();
  };

  const openSystemShare = async () => {
    try {
      await Share.share({
        message,
        title: 'Assetup',
      });
    } catch {
      Alert.alert(t('settings.share.failedTitle'), t('settings.share.failedMessage'));
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
        />
        <View
          style={{
            backgroundColor: sheetBg,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            paddingBottom: insets.bottom + 16,
            paddingTop: 12,
            maxHeight: '62%',
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: rgbaFromHex(theme.primary, 0.18),
              marginBottom: 14,
            }}
          />
          <Text
            style={{
              fontSize: 17,
              fontWeight: '800',
              color: ink,
              paddingHorizontal: 20,
              marginBottom: 14,
            }}
          >
            {t('settings.share.sheetTitle')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 16,
              gap: 12,
              paddingBottom: 8,
            }}
          >
            {targets.map((row) => (
              <Pressable
                key={row.id}
                accessibilityRole="button"
                accessibilityLabel={t(row.labelKey)}
                onPress={() => void copyAndMaybeOpen(row)}
                style={({ pressed }) => ({
                  width: chipW,
                  alignItems: 'center',
                  opacity: pressed ? 0.82 : 1,
                })}
              >
                <View
                  style={{
                    width: chipW - 8,
                    aspectRatio: 1,
                    maxWidth: 72,
                    maxHeight: 72,
                    borderRadius: 18,
                    backgroundColor: rgbaFromHex(theme.primary, 0.1),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialCommunityIcons name={row.icon} size={30} color={ink} />
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    fontWeight: '700',
                    color: muted,
                    textAlign: 'center',
                  }}
                >
                  {t(row.labelKey)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            onPress={() => void openSystemShare()}
            style={({ pressed }) => ({
              marginHorizontal: 16,
              marginTop: 12,
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: theme.ctaPillBg,
              opacity: pressed ? 0.88 : 1,
              alignItems: 'center',
            })}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: '800',
                color: pickTextOnAccent(theme.ctaPillBg),
              }}
            >
              {t('settings.share.more')}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => ({
              marginTop: 8,
              paddingVertical: 12,
              alignItems: 'center',
              opacity: pressed ? 0.65 : 1,
            })}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: muted }}>
              {t('common.cancel')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
