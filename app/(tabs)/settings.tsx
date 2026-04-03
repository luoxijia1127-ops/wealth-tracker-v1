/**
 * 「More」：账号卡 + 工具 / 设置 / 数据 / 支持 分区网格。
 */

import { GlassSurface } from '@/components/glass-surface';
import { SettingsGridTile } from '@/components/settings-grid-tile';
import { useAppPalette } from '@/contexts/app-palette-context';
import { rgbaFromHex } from '@/lib/color-utils';
import { createSettingsScreenStyles } from '@/lib/settings-screen-styles';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Tile = {
  id: string;
  label: string;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  onPress: () => void;
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useAppPalette();
  const styles = useMemo(() => createSettingsScreenStyles(theme), [theme]);

  const decorColors = useMemo(
    () => [
      rgbaFromHex('#A7D9F5', 0.35),
      rgbaFromHex('#9FE6D8', 0.32),
      rgbaFromHex('#F6DB62', 0.28),
    ],
    []
  );

  const openMembership = () => {
    Alert.alert('会员 / 付费', '更多高级能力将在后续版本开放。');
  };

  const toolTiles: Tile[] = useMemo(
    () => [
      {
        id: 'about',
        label: '应用简介',
        icon: 'info-outline',
        onPress: () => router.push('/settings-about'),
      },
      {
        id: 'market',
        label: '市场大盘',
        icon: 'show-chart',
        onPress: () => router.push('/market'),
      },
      {
        id: 'attribution',
        label: '净值归因',
        icon: 'stacked-line-chart',
        onPress: () => router.push('/settings-attribution'),
      },
      {
        id: 'fx',
        label: '汇率数据',
        icon: 'currency-exchange',
        onPress: () => router.push('/settings-fx'),
      },
    ],
    [router]
  );

  const settingsTiles: Tile[] = useMemo(
    () => [
      {
        id: 'currency',
        label: '默认货币',
        icon: 'monetization-on',
        onPress: () => router.push('/settings-display-currency'),
      },
      {
        id: 'language',
        label: '语言设置',
        icon: 'language',
        onPress: () => router.push('/settings-language'),
      },
      {
        id: 'cashflow',
        label: '主题颜色',
        icon: 'invert-colors-on',
        onPress: () => router.push('/settings-cashflow-colors'),
      },
    ],
    [router]
  );

  const dataTiles: Tile[] = useMemo(
    () => [
      {
        id: 'export',
        label: '导出数据',
        icon: 'save-alt',
        onPress: () => router.push('/settings-export'),
      },
      {
        id: 'archived',
        label: '已归档',
        icon: 'inventory-2',
        onPress: () => router.push('/settings-archived'),
      },
      {
        id: 'trash',
        label: '最近删除',
        icon: 'delete-outline',
        onPress: () => router.push('/settings-trash'),
      },
    ],
    [router]
  );

  const onFeedback = () => {
    router.push('/settings-help');
  };

  const onRate = () => {
    Alert.alert(
      '好评鼓励',
      '若喜欢本应用，请前往 App Store 或本机应用商店搜索并评分（上架后可用）。'
    );
  };

  const onShareApp = async () => {
    try {
      await Share.share({
        message: '推荐 Wealth Tracker：本地资产与净值记账。',
        title: 'Wealth Tracker',
      });
    } catch {
      Alert.alert('分享失败', '请重试。');
    }
  };

  const supportTiles: Tile[] = [
    { id: 'feedback', label: '意见反馈', icon: 'feedback', onPress: onFeedback },
    { id: 'rate', label: '好评鼓励', icon: 'star-outline', onPress: onRate },
    {
      id: 'share',
      label: '分享给朋友',
      icon: 'share',
      onPress: () => void onShareApp(),
    },
  ];

  const renderGrid = (tiles: Tile[]) => (
    <View style={styles.gridWrap}>
      {tiles.map((item) => (
        <SettingsGridTile
          key={item.id}
          label={item.label}
          icon={item.icon}
          theme={theme}
          onPress={item.onPress}
        />
      ))}
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.decorWrap} pointerEvents="none">
        <View
          style={[
            styles.decorBlob,
            {
              width: 220,
              height: 320,
              top: -40,
              left: -60,
              backgroundColor: decorColors[0],
            },
          ]}
        />
        <View
          style={[
            styles.decorBlob,
            {
              width: 280,
              height: 260,
              top: 120,
              right: -80,
              backgroundColor: decorColors[1],
            },
          ]}
        />
        <View
          style={[
            styles.decorBlob,
            {
              width: 200,
              height: 200,
              bottom: 80,
              left: 20,
              backgroundColor: decorColors[2],
            },
          ]}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 28,
            backgroundColor: 'transparent',
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.headerRow, { paddingHorizontal: 12 }]}>
          <View style={{ width: 46 }} />
          <Text style={styles.headerTitle}>More</Text>
          <View style={{ width: 46 }} />
        </View>

        <GlassSurface borderRadius={28} intensity={50} style={styles.profileGlassOuter}>
          <View style={styles.profileCardInner}>
            <View style={[styles.profileTopRow, { marginBottom: 0 }]}>
              <View style={styles.avatar}>
                <MaterialIcons name="person" size={28} color={theme.primary} />
              </View>
              <View style={styles.profileNameBlock}>
                <Text style={styles.profileName}>本地账本</Text>
                <Text style={styles.profileSub} numberOfLines={2}>
                  本地账户 · 数据仅保存在本机，不上传服务器。
                </Text>
              </View>
              <Pressable
                onPress={openMembership}
                style={({ pressed }) => [
                  styles.profileCta,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.profileCtaText}>会员</Text>
              </Pressable>
            </View>
          </View>
        </GlassSurface>

        <GlassSurface borderRadius={26} intensity={44} style={styles.sectionGlassOuter}>
          <Text style={styles.sectionLabel}>工具</Text>
          {renderGrid(toolTiles)}
        </GlassSurface>

        <GlassSurface borderRadius={26} intensity={44} style={styles.sectionGlassOuter}>
          <Text style={styles.sectionLabel}>设置</Text>
          {renderGrid(settingsTiles)}
        </GlassSurface>

        <GlassSurface borderRadius={26} intensity={44} style={styles.sectionGlassOuter}>
          <Text style={styles.sectionLabel}>数据</Text>
          {renderGrid(dataTiles)}
        </GlassSurface>

        <GlassSurface borderRadius={26} intensity={44} style={styles.sectionGlassOuter}>
          <Text style={styles.sectionLabel}>支持</Text>
          {renderGrid(supportTiles)}
        </GlassSurface>
      </ScrollView>
    </View>
  );
}
