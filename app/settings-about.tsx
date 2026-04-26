/**
 * 关于应用
 */

import { SettingsEditorialMasthead } from '@/components/settings-editorial-masthead';
import { SettingsHubBackTopBar } from '@/components/settings-hub-back-navigation';
import { useAppPalette } from '@/contexts/app-palette-context';
import { useLanguage } from '@/contexts/language-context';
import { rgbaFromHex } from '@/lib/color-utils';
import { createSettingsScreenStyles } from '@/lib/settings-screen-styles';
import Constants from 'expo-constants';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsAboutScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppPalette();
  const { t } = useLanguage();
  const hubStyles = useMemo(() => createSettingsScreenStyles(theme), [theme]);
  const secondary = rgbaFromHex(theme.primary, 0.65);

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={hubStyles.screen}>
      <View style={hubStyles.screenAmbient} pointerEvents="none" />
      <SettingsHubBackTopBar />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          hubStyles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsEditorialMasthead
          styles={hubStyles}
          title="ABOUT"
          kicker="APP & VERSION"
        />
        <View style={{ paddingHorizontal: 20 }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color: theme.primary, marginBottom: 8 }}>
        Nest
      </Text>
      <Text style={{ fontSize: 14, color: secondary, marginBottom: 20 }}>
        {t('settings.about.tagline')}
      </Text>
      <View
        style={{
          borderRadius: 20,
          padding: 16,
          backgroundColor: 'rgba(255,255,255,0.94)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.95)',
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: '600', color: theme.primary }}>
          {t('settings.about.versionLabel', { version })}
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 21, color: secondary, marginTop: 12 }}>
          {t('settings.about.description')}
        </Text>
      </View>
        </View>
      </ScrollView>
    </View>
  );
}
