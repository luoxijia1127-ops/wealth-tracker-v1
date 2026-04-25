/**
 * 数据管理页面
 */
import { useAppPalette } from '@/contexts/app-palette-context';
import { useLanguage } from '@/contexts/language-context';
import { createSettingsScreenStyles } from '@/lib/settings-screen-styles';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SettingsHubBackTopBar } from '@/components/settings-hub-back-navigation';
import { SettingsGridTile } from '@/components/settings-grid-tile';

export default function SettingsDataHubScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useAppPalette();
  const { t } = useLanguage();
  const styles = useMemo(() => createSettingsScreenStyles(theme), [theme]);

  const dataTiles = [
    {
      id: 'export',
      label: t('settings.tiles.export'),
      icon: 'save-alt' as const,
      onPress: () => router.push('/settings-export'),
    },
    {
      id: 'import',
      label: t('settings.tiles.import'),
      icon: 'file-upload' as const,
      onPress: () => router.push('/settings-import'),
    },
    {
      id: 'archived',
      label: t('settings.tiles.archived'),
      icon: 'inventory-2' as const,
      onPress: () => router.push('/settings-archived'),
    },
    {
      id: 'trash',
      label: t('settings.tiles.trash'),
      icon: 'delete-outline' as const,
      onPress: () => router.push('/settings-trash'),
    },
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
        <View style={[styles.mastheadBlock, { paddingTop: 16 }]}>
          <Text style={styles.masthead}>DATA</Text>
          <Text style={styles.kicker}>YOUR LOCAL ASSETS</Text>
        </View>

        <View style={styles.preferencesBlock}>
          {dataTiles.map(t => (
            <SettingsGridTile
              key={t.id}
              label={t.label}
              icon={t.icon}
              theme={theme}
              onPress={t.onPress}
              variant="list"
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}