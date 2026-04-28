/**
 * 数据管理页面
 */
import { useAppPalette } from '@/contexts/app-palette-context';
import { useLanguage } from '@/contexts/language-context';
import { createSettingsScreenStyles } from '@/lib/settings-screen-styles';
import { resetAllLocalData } from '@/lib/reset-all-data';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SettingsHubBackTopBar } from '@/components/settings-hub-back-navigation';
import { SettingsGridTile } from '@/components/settings-grid-tile';

export default function SettingsDataHubScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useAppPalette();
  const { t } = useLanguage();
  const styles = useMemo(() => createSettingsScreenStyles(theme), [theme]);
  const [resetting, setResetting] = useState(false);

  const onResetAllData = useCallback(() => {
    Alert.alert(
      t('settings.resetData.confirmTitle'),
      t('settings.resetData.confirmMessage'),
      [
        { text: t('settings.resetData.cancel'), style: 'cancel' },
        {
          text: t('settings.resetData.confirm'),
          style: 'destructive',
          onPress: () => {
            setResetting(true);
            resetAllLocalData()
              .then(() => {
                Alert.alert(
                  t('settings.resetData.successTitle'),
                  t('settings.resetData.successMessage')
                );
              })
              .catch((e: unknown) => {
                Alert.alert(
                  t('settings.resetData.failTitle'),
                  e instanceof Error ? e.message : String(e)
                );
              })
              .finally(() => setResetting(false));
          },
        },
      ]
    );
  }, [t]);

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
        <View style={styles.mastheadBlockHub}>
          <Text style={styles.masthead}>{t('masthead.data')}</Text>
          <Text style={styles.kicker}>{t('masthead.dataKicker')}</Text>
        </View>

        <View style={styles.preferencesBlock}>
          {dataTiles.map((tile) => (
            <SettingsGridTile
              key={tile.id}
              label={tile.label}
              icon={tile.icon}
              theme={theme}
              onPress={tile.onPress}
              variant="list"
            />
          ))}
          <SettingsGridTile
            label={t('settings.resetData.tile')}
            icon="delete-forever"
            theme={theme}
            onPress={onResetAllData}
            variant="list"
            disabled={resetting}
          />
        </View>
      </ScrollView>
    </View>
  );
}