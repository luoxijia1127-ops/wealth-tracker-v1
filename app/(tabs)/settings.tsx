/**
 * 「我的」：参考 Profile 式排版 — 装饰背景、顶栏、资料卡统计、三列功能网格。
 */

import { SettingsGridTile } from '@/components/settings-grid-tile';
import { useAppPalette } from '@/contexts/app-palette-context';
import {
    filterAssetsForDashboard,
} from '@/lib/asset-value';
import { rgbaFromHex } from '@/lib/color-utils';
import { getCachedFxUsdRates } from '@/lib/fx-rates';
import { assetRepository } from '@/lib/repositories/asset-repository';
import { createSettingsScreenStyles } from '@/lib/settings-screen-styles';
import { getSnapshots } from '@/lib/snapshots';
import type { SimpleAsset } from '@/types/asset';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
    Alert,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SettingsHref =
  | '/settings-palette'
  | '/settings-attribution'
  | '/settings-fx'
  | '/settings-export'
  | '/settings-help'
  | '/settings-about'
  | '/settings-privacy';

type SettingsEntry = {
  id: string;
  label: string;
  href: SettingsHref;
  icon: ComponentProps<typeof MaterialIcons>['name'];
};

const SETTINGS_ENTRIES: SettingsEntry[] = [
  { id: 'palette', label: '应用配色', href: '/settings-palette', icon: 'palette' },
  {
    id: 'attribution',
    label: '净值归因',
    href: '/settings-attribution',
    icon: 'stacked-line-chart',
  },
  { id: 'fx', label: '汇率信息', href: '/settings-fx', icon: 'currency-exchange' },
  { id: 'export', label: '数据与导出', href: '/settings-export', icon: 'save-alt' },
  { id: 'help', label: '帮助反馈', href: '/settings-help', icon: 'help-outline' },
  { id: 'privacy', label: '隐私说明', href: '/settings-privacy', icon: 'verified-user' },
  { id: 'about', label: '关于应用', href: '/settings-about', icon: 'info-outline' },
];

function formatShortDate(ymd: string | undefined): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '—';
  const [y, m, d] = ymd.split('-');
  return `${m}.${d}`;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useAppPalette();
  const styles = useMemo(() => createSettingsScreenStyles(theme), [theme]);

  const [assets, setAssets] = useState<SimpleAsset[]>([]);
  const [snapshotCount, setSnapshotCount] = useState(0);
  const [latestSnapshotDate, setLatestSnapshotDate] = useState<string | null>(null);
  const [fxApiDate, setFxApiDate] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const [list, snaps, fx] = await Promise.all([
            assetRepository.getAll(),
            getSnapshots(),
            getCachedFxUsdRates(),
          ]);
          if (cancelled) return;
          setAssets(list);
          const sorted = [...snaps].sort((a, b) => a.date.localeCompare(b.date));
          setSnapshotCount(sorted.length);
          setLatestSnapshotDate(
            sorted.length > 0 ? sorted[sorted.length - 1]!.date : null
          );
          setFxApiDate(fx?.apiDate ?? null);
        } catch {
          if (!cancelled) {
            setAssets([]);
            setSnapshotCount(0);
            setLatestSnapshotDate(null);
            setFxApiDate(null);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const dash = useMemo(() => filterAssetsForDashboard(assets), [assets]);
  const assetCount = dash.length;
  const categoryCount = useMemo(() => {
    const s = new Set(dash.map((a) => a.category));
    return s.size;
  }, [dash]);

  const decorColors = useMemo(
    () => [
      rgbaFromHex('#A7D9F5', 0.35),
      rgbaFromHex('#9FE6D8', 0.32),
      rgbaFromHex('#F6DB62', 0.28),
    ],
    []
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
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.headerRow, { paddingHorizontal: 12 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="帮助与反馈"
            onPress={() => router.push('/settings-help')}
            style={({ pressed }) => [
              styles.headerSideBtn,
              pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
            ]}
          >
            <MaterialIcons
              name="headset-mic"
              size={22}
              color={theme.primary}
            />
          </Pressable>
          <Text style={styles.headerTitle}>我的</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="应用配色"
            onPress={() => router.push('/settings-palette')}
            style={({ pressed }) => [
              styles.headerSideBtn,
              pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
            ]}
          >
            <MaterialIcons name="settings" size={22} color={theme.primary} />
          </Pressable>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileTopRow}>
            <View style={styles.avatar}>
              <MaterialIcons name="person" size={28} color={theme.primary} />
            </View>
            <View style={styles.profileNameBlock}>
              <Text style={styles.profileName}>本地账本</Text>
              <Text style={styles.profileSub} numberOfLines={2}>
                数据仅保存在本机，可随时在下方管理外观与说明类选项。
              </Text>
            </View>
            <Pressable
              onPress={() =>
                Alert.alert('功能预告', '更多高级能力将在后续版本开放。')
              }
              style={({ pressed }) => [
                styles.profileCta,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.profileCtaText}>了解功能</Text>
            </Pressable>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{assetCount}</Text>
              <Text style={styles.statLabel}>持仓资产</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{categoryCount}</Text>
              <Text style={styles.statLabel}>涉及类别</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{snapshotCount}</Text>
              <Text style={styles.statLabel}>净值快照</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statValue} numberOfLines={1}>
                {formatShortDate(fxApiDate ?? undefined)}
              </Text>
              <Text style={styles.statLabel}>汇率基准</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaLeft}>
              <Text style={styles.metaMuted} numberOfLines={1}>
                最近快照{' '}
                {latestSnapshotDate
                  ? latestSnapshotDate.replace(/-/g, '.')
                  : '暂无'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/settings-help')}
              style={({ pressed }) => [
                styles.metaLink,
                pressed && { opacity: 0.85 },
              ]}
            >
              <MaterialIcons
                name="menu-book"
                size={18}
                color={rgbaFromHex(theme.primary, 0.65)}
              />
              <Text style={styles.metaLinkText}>使用说明</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.sectionLabel}>常用功能</Text>
        <View style={styles.gridWrap}>
          {SETTINGS_ENTRIES.map((item) => (
            <SettingsGridTile
              key={item.id}
              label={item.label}
              icon={item.icon}
              theme={theme}
              onPress={() => router.push(item.href)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
