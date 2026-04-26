/**
 * 语言设置
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { useLanguage } from '@/contexts/language-context';
import { AppFont } from '@/lib/app-fonts';
import { rgbaFromHex } from '@/lib/color-utils';
import type { LanguageMode } from '@/lib/language';
import { createSettingsScreenStyles } from '@/lib/settings-screen-styles';
import { SettingsHubBackTopBar } from '@/components/settings-hub-back-navigation';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LIST_ROW = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  paddingVertical: 14,
  paddingHorizontal: 24,
  borderBottomWidth: StyleSheet.hairlineWidth,
  borderBottomColor: 'rgba(0,0,0,0.06)',
};

export default function SettingsLanguageScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppPalette();
  const { languageMode, locale, setLanguageMode, t } = useLanguage();
  const styles = useMemo(() => createSettingsScreenStyles(theme), [theme]);
  const p = theme.primary;
  const muted = rgbaFromHex(p, 0.55);
  const options = useMemo(
    () =>
      [
        {
          id: 'system',
          title: t('language.option.system'),
          subtitle: t('language.status.system', {
            locale:
              locale === 'zh-CN'
                ? t('language.resolved.zh')
                : t('language.resolved.en'),
          }),
        },
        {
          id: 'zh-CN',
          title: t('language.option.zh'),
          subtitle: t('language.status.selected'),
        },
        {
          id: 'en-US',
          title: t('language.option.en'),
          subtitle: t('language.status.selected'),
        },
      ] satisfies {
        id: LanguageMode;
        title: string;
        subtitle: string;
      }[],
    [locale, t]
  );

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
          <Text style={styles.masthead}>{t('masthead.language')}</Text>
          <Text style={styles.kicker}>{t('masthead.languageKicker')}</Text>
        </View>

        <View style={styles.preferencesBlock}>
          {options.map((opt) => {
            const selected = languageMode === opt.id;
            return (
              <Pressable
                key={opt.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  void setLanguageMode(opt.id);
                }}
                style={({ pressed }) => [
                  LIST_ROW,
                  pressed && { opacity: 0.82 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: AppFont.semiBold,
                      fontSize: 17,
                      letterSpacing: -0.25,
                      color: p,
                    }}
                  >
                    {opt.title}
                  </Text>
                  <Text
                    style={{
                      fontFamily: AppFont.medium,
                      fontSize: 12,
                      color: muted,
                      marginTop: 4,
                    }}
                  >
                    {opt.subtitle}
                  </Text>
                </View>
                <Ionicons
                  name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={selected ? p : muted}
                />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
