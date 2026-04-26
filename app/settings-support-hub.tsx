/**
 * 支持页面
 */
import { useAppPalette } from '@/contexts/app-palette-context';
import { useLanguage } from '@/contexts/language-context';
import { createSettingsScreenStyles } from '@/lib/settings-screen-styles';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SettingsHubBackTopBar } from '@/components/settings-hub-back-navigation';
import { SettingsGridTile } from '@/components/settings-grid-tile';

export default function SettingsSupportHubScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useAppPalette();
  const { t } = useLanguage();
  const styles = useMemo(() => createSettingsScreenStyles(theme), [theme]);

  const onFeedback = () => router.push('/settings-help');
  const onRate = () => Alert.alert(t('settings.support.rate'), t('settings.support.rateMessage'));
  const supportTiles = [
    { id: 'privacy', label: t('settings.tiles.privacy'), icon: 'privacy-tip' as const, onPress: () => router.push('/settings-privacy') },
    { id: 'terms', label: t('settings.tiles.terms'), icon: 'description' as const, onPress: () => router.push('/settings-terms') },
    { id: 'feedback', label: t('settings.support.feedback'), icon: 'feedback' as const, onPress: onFeedback },
    { id: 'rate', label: t('settings.support.rate'), icon: 'star-outline' as const, onPress: onRate },
  ];

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
      >
        <View style={styles.mastheadBlockHub}>
          <Text style={styles.masthead}>{t('masthead.support')}</Text>
          <Text style={styles.kicker}>{t('masthead.supportKicker')}</Text>
        </View>

        <View style={styles.preferencesBlock}>
          {supportTiles.map((tile) => (
            <SettingsGridTile
              key={tile.id}
              label={tile.label}
              icon={tile.icon}
              theme={theme}
              onPress={tile.onPress}
              variant="list"
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}