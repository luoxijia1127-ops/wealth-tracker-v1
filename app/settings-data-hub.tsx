/**
 * 数据管理页面
 */
import { useAppPalette } from '@/contexts/app-palette-context';
import { createSettingsScreenStyles } from '@/lib/settings-screen-styles';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SettingsGridTile } from '@/components/settings-grid-tile';

export default function SettingsDataHubScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useAppPalette();
  const styles = useMemo(() => createSettingsScreenStyles(theme), [theme]);

  const dataTiles = [
    {
      id: 'export',
      label: '导出数据',
      icon: 'save-alt' as const,
      onPress: () => router.push('/settings-export'),
    },
    {
      id: 'archived',
      label: '已归档',
      icon: 'inventory-2' as const,
      onPress: () => router.push('/settings-archived'),
    },
    {
      id: 'trash',
      label: '最近删除',
      icon: 'delete-outline' as const,
      onPress: () => router.push('/settings-trash'),
    },
  ];

  return (
    <View style={styles.screen}>
      <View style={styles.screenAmbient} pointerEvents="none" />
      
      <View style={{ paddingTop: insets.top, paddingHorizontal: 16, paddingBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={() => router.back()} style={{ width: 44, height: 44, justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={28} color={theme.primary} />
        </Pressable>
      </View>

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