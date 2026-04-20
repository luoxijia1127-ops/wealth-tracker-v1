/**
 * 支持页面
 */
import { useAppPalette } from '@/contexts/app-palette-context';
import { createSettingsScreenStyles } from '@/lib/settings-screen-styles';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SettingsHubBackTopBar } from '@/components/settings-hub-back-navigation';
import { SettingsGridTile } from '@/components/settings-grid-tile';

export default function SettingsSupportHubScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useAppPalette();
  const styles = useMemo(() => createSettingsScreenStyles(theme), [theme]);

  const onFeedback = () => router.push('/settings-help');
  const onRate = () => Alert.alert('好评鼓励', '若喜欢 Nest，可在 App Store 搜索应用名并留下评价，感谢支持。');
  const onShareApp = async () => {
    try {
      await Share.share({ message: '推荐 Nest：本地资产与净值记账。', title: 'Nest' });
    } catch {
      Alert.alert('分享失败', '请重试。');
    }
  };

  const supportTiles = [
    { id: 'privacy', label: '隐私政策', icon: 'privacy-tip' as const, onPress: () => router.push('/settings-privacy') },
    { id: 'terms', label: '用户协议', icon: 'description' as const, onPress: () => router.push('/settings-terms') },
    { id: 'feedback', label: '意见反馈', icon: 'feedback' as const, onPress: onFeedback },
    { id: 'rate', label: '好评鼓励', icon: 'star-outline' as const, onPress: onRate },
    { id: 'share', label: '分享给朋友', icon: 'share' as const, onPress: () => void onShareApp() },
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
          <Text style={styles.masthead}>SUPPORT</Text>
          <Text style={styles.kicker}>HELP & LEGAL</Text>
        </View>

        <View style={styles.preferencesBlock}>
          {supportTiles.map(t => (
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