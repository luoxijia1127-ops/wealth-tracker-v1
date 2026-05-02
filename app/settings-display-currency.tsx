/**
 * 默认展示货币（汇总与部分文案；资产本币不变）。
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { useLanguage } from '@/contexts/language-context';
import { AppFont } from '@/lib/app-fonts';
import { ASSET_CURRENCY_OPTIONS } from '@/lib/asset-currency';
import { rgbaFromHex } from '@/lib/color-utils';
import { saveDisplayCurrency } from '@/lib/display-currency-preference';
import { createSettingsScreenStyles } from '@/lib/settings-screen-styles';
import { SettingsHubBackTopBar } from '@/components/settings-hub-back-navigation';
import {
  useDisplayCurrency,
  useHydrated,
} from '@/lib/store/selectors';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LIST_ROW = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  paddingVertical: 14,
  paddingHorizontal: 24,
  borderBottomWidth: StyleSheet.hairlineWidth,
  borderBottomColor: 'rgba(0,0,0,0.06)',
};

export default function SettingsDisplayCurrencyScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppPalette();
  const { t } = useLanguage();
  const styles = useMemo(() => createSettingsScreenStyles(theme), [theme]);
  const code = useDisplayCurrency();
  const hydrated = useHydrated();

  /** 写入由 saveDisplayCurrency 触发；store listener 会自动更新 code，无需本地 setState */
  const onPick = useCallback(async (next: string) => {
    await saveDisplayCurrency(next);
  }, []);

  const p = theme.primary;
  const muted = rgbaFromHex(p, 0.55);

  return (
    <View style={styles.screen}>
      <View style={styles.screenAmbient} pointerEvents="none" />

      <SettingsHubBackTopBar />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: insets.bottom + 28,
            backgroundColor: 'transparent',
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mastheadBlockHub}>
          <Text style={styles.masthead}>{t('masthead.currency')}</Text>
          <Text style={styles.kicker}>{t('masthead.currencyKicker')}</Text>
        </View>

        <View style={styles.preferencesBlock}>
          <Text
            style={{
              fontFamily: AppFont.medium,
              fontSize: 13,
              lineHeight: 19,
              color: muted,
              paddingHorizontal: 24,
              marginBottom: 8,
            }}
          >
            {t('settings.currency.description')}
          </Text>
          {!hydrated ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <ActivityIndicator color={p} />
            </View>
          ) : (
            <View>
              {ASSET_CURRENCY_OPTIONS.map((o) => {
                const selected = code === o.code;
                return (
                  <Pressable
                    key={o.code}
                    onPress={() => void onPick(o.code)}
                    style={({ pressed }) => [
                      LIST_ROW,
                      selected && { backgroundColor: rgbaFromHex(p, 0.06) },
                      { opacity: pressed ? 0.88 : 1 },
                    ]}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: AppFont.semiBold,
                        fontSize: 17,
                        letterSpacing: -0.25,
                        color: p,
                      }}
                    >
                      {o.symbol} {o.code}
                    </Text>
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={22} color={p} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
