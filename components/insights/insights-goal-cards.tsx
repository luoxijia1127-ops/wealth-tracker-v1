/**
 * Insights · 目标进度卡片
 */

import { formatMoney } from '@/lib/asset-value';
import type { InsightsStyles } from '@/lib/insights-styles';
import type { GoalProgressDisplayRow } from '@/lib/goal-aggregate';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Circle, Svg } from 'react-native-svg';
import type { AssetCategory } from '@/types/asset';

const CATEGORY_GOAL_ICONS: Record<
  AssetCategory,
  keyof typeof MaterialIcons.glyphMap
> = {
  Stock: 'trending-up',
  Fund: 'account-balance',
  ETF: 'bar-chart',
  Cash: 'account-balance-wallet',
  Gold: 'star',
};

function GoalProgressRing({
  pct,
  color,
  trackColor,
  styles,
  size = 56,
}: {
  pct: number;
  color: string;
  trackColor: string;
  styles: InsightsStyles;
  size?: number;
}) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const offset = c * (1 - clamped / 100);
  const half = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={half}
          cy={half}
          r={r}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={half}
          cy={half}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${half} ${half})`}
        />
      </Svg>
      <View style={styles.goalRingCenter}>
        <Text style={styles.goalRingPct}>{pct}%</Text>
      </View>
    </View>
  );
}

export function GoalProgressCard({
  row,
  styles,
  textSecondary,
  textMuted,
  primary,
  ringTrackColor,
}: {
  row: GoalProgressDisplayRow;
  styles: InsightsStyles;
  textSecondary: string;
  textMuted: string;
  primary: string;
  ringTrackColor: string;
}) {
  const showDetailLine =
    row.detailLine.trim().length > 0 && row.detailLine !== row.label;
  const onOpen = () => {
    router.push({
      pathname: '/asset-action',
      params: { id: row.primaryAssetId },
    });
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [
        styles.goalCard,
        pressed && styles.goalCardPressed,
      ]}
    >
      <View
        style={[
          styles.goalIconWrap,
          { backgroundColor: `${row.iconTint}22` },
        ]}
      >
        <MaterialIcons
          name={CATEGORY_GOAL_ICONS[row.category] ?? 'track-changes'}
          size={24}
          color={row.iconTint}
        />
      </View>
      <View style={styles.goalCardMid}>
        <Text
          style={[styles.goalCardLabel, { color: textSecondary }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {row.label}
        </Text>
        {showDetailLine ? (
          <Text
            style={[styles.goalCardAssetName, { color: textMuted }]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {row.detailLine}
          </Text>
        ) : null}
        <Text style={[styles.goalCardValues, { color: primary }]}>
          {formatMoney(row.current, row.currency)}
          <Text style={{ color: textSecondary, fontWeight: '600' }}>
            {' '}
            / {formatMoney(row.target, row.currency)}
          </Text>
        </Text>
      </View>
      <GoalProgressRing
        pct={row.pct}
        color={row.ringColor}
        trackColor={ringTrackColor}
        styles={styles}
      />
    </Pressable>
  );
}
