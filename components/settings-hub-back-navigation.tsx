/**
 * 与「数据」「支持」页一致的左上角返回：44×44 热区 + Ionicons arrow-back 28。
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppPalette } from '@/contexts/app-palette-context';
import { useLanguage } from '@/contexts/language-context';

export function SettingsHubBackButton() {
  const router = useRouter();
  const { theme } = useAppPalette();
  const { t } = useLanguage();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      onPress={() => router.back()}
      style={{ width: 44, height: 44, justifyContent: 'center' }}
    >
      <Ionicons name="arrow-back" size={28} color={theme.primary} />
    </Pressable>
  );
}

type SettingsHubBackTopBarProps = {
  /** 默认 16；紧凑页（如添加资产 modal）可减小 */
  paddingBottom?: number;
};

/** 含安全区顶距与左右 16，与 settings-data-hub / settings-support-hub 顶栏一致 */
export function SettingsHubBackTopBar({
  paddingBottom = 22,
}: SettingsHubBackTopBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top,
        paddingHorizontal: 16,
        paddingBottom,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <SettingsHubBackButton />
    </View>
  );
}
