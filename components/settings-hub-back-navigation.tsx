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
      style={{ width: 44, height:22, justifyContent: 'center' }}
    >
      <Ionicons name="arrow-back" size={28} color={theme.primary} />
    </Pressable>
  );
}

type SettingsHubBackTopBarProps = {
  /**
   * 默认 22（与数据/支持 hub 一致）。
   * 传 `compact` 时默认改为 6，适合带键盘的 modal，减少占高。
   */
  paddingBottom?: number;
  /** 紧凑顶栏：减小 `paddingBottom` 默认值为 6，仍保留 44×44 返回热区 */
  compact?: boolean;
};

/** 返回行固定与 `SettingsHubBackButton` 一致，用于对齐 KeyboardAvoidingView */
const SETTINGS_HUB_BACK_ROW_HEIGHT = 44;

/**
 * 顶栏在 safe area **之下** 的垂直占用（不含 `insets.top`）。
 * 与 `SettingsHubBackTopBar` 的 `paddingBottom` + 返回行高度一致。
 */
export function settingsHubBackTopBarBelowInsetHeight(
  props?: Pick<SettingsHubBackTopBarProps, 'paddingBottom' | 'compact'>
): number {
  const pb =
    props?.paddingBottom !== undefined
      ? props.paddingBottom
      : props?.compact
        ? 6
        : 22;
  return SETTINGS_HUB_BACK_ROW_HEIGHT + pb;
}

/** 含安全区顶距与左右 16，与 settings-data-hub / settings-support-hub 顶栏一致 */
export function SettingsHubBackTopBar({
  paddingBottom: paddingBottomProp,
  compact,
}: SettingsHubBackTopBarProps) {
  const insets = useSafeAreaInsets();
  const paddingBottom =
    paddingBottomProp !== undefined
      ? paddingBottomProp
      : compact
        ? 0
        : 22;
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
