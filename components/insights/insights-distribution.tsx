/**
 * Insights · 资产分布：环形图 + 大类明细
 */

import {
  formatMoney,
  getAssetCurrency,
  getAssetDisplayValue,
} from '@/lib/asset-value';
import {
  convertDisplayValueToCny,
  type FxUsdMidRates,
} from '@/lib/fx-rates';
import {
  DONUT_EXPLODE,
  DONUT_SELECTED_SCALE,
  getDonutPieCurves,
  type DonutSlice,
} from '@/lib/insights-model';
import type { InsightsStyles } from '@/lib/insights-styles';
import {
  CATEGORY_LABEL_ZH,
  type AssetCategory,
  type SimpleAsset,
} from '@/types/asset';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { G, Path, Svg, Text as SvgText } from 'react-native-svg';

export function DistributionDonut({
  slices,
  width,
  ringSize,
  selectedCategory,
  onToggleCategory,
}: {
  slices: DonutSlice[];
  width: number;
  ringSize: number;
  selectedCategory: AssetCategory | null;
  onToggleCategory: (category: AssetCategory) => void;
}) {
  const { curves, total, outer } = getDonutPieCurves(slices, width, ringSize);
  const cx = width / 2;
  const cy = ringSize / 2;
  const pctFontSize = Math.max(9, Math.min(13, Math.round(outer * 0.28)));

  return (
    <Svg width={width} height={ringSize}>
      <G x={cx} y={cy}>
        {curves.map((c) => {
          const isSel = selectedCategory === c.item.category;
          const dimOthers = selectedCategory !== null && !isSel;
          const [gx, gy] = c.sector.centroid;
          const len = Math.hypot(gx, gy) || 1;
          const pull = isSel ? DONUT_EXPLODE : 0;
          const tx = (gx / len) * pull;
          const ty = (gy / len) * pull;
          const scale = isSel ? DONUT_SELECTED_SCALE : 1;
          const transform =
            scale !== 1
              ? `translate(${tx},${ty}) translate(${gx},${gy}) scale(${scale}) translate(${-gx},${-gy})`
              : `translate(${tx},${ty})`;

          const pctRaw = total > 0 ? (100 * c.item.value) / total : 0;
          const pctLabel =
            pctRaw > 0 && pctRaw < 1 ? '<1%' : `${Math.round(pctRaw)}%`;

          return (
            <G key={`${c.item.category}-${c.index}`} transform={transform}>
              <Path
                d={c.sector.path.print()}
                fill={c.item.color}
                fillOpacity={dimOthers ? 0.38 : 1}
                stroke={isSel ? '#FFFFFF' : 'rgba(255,255,255,0.35)'}
                strokeWidth={isSel ? 2.5 : 1}
                onPress={() => onToggleCategory(c.item.category)}
                accessibilityLabel={`${c.item.name}，占比 ${pctRaw.toFixed(1)}%`}
              />
              <SvgText
                x={gx}
                y={gy}
                textAnchor="middle"
                alignmentBaseline="central"
                fontSize={pctFontSize}
                fontWeight="700"
                fill="rgba(255,255,255,0.96)"
                stroke="rgba(45, 52, 72, 0.35)"
                strokeWidth={0.35}
                fillOpacity={dimOthers ? 0.42 : 1}
                pointerEvents="none"
              >
                {pctLabel}
              </SvgText>
            </G>
          );
        })}
      </G>
    </Svg>
  );
}

export function DistributionBreakdown({
  category,
  assets,
  styles,
  primary,
  textSecondary,
  usdRates,
}: {
  category: AssetCategory;
  assets: SimpleAsset[];
  styles: InsightsStyles;
  primary: string;
  textSecondary: string;
  /** 有缓存汇率时明细行显示折合人民币，与环形图口径一致 */
  usdRates?: FxUsdMidRates['rates'] | null;
}) {
  const useFx = usdRates != null && usdRates.CNY > 0;

  const items = useMemo(() => {
    return assets
      .filter(
        (a) => a.category === category && getAssetDisplayValue(a) > 0
      )
      .sort((a, b) => {
        if (!useFx || !usdRates) {
          return getAssetDisplayValue(b) - getAssetDisplayValue(a);
        }
        const ca = convertDisplayValueToCny(
          getAssetDisplayValue(a),
          getAssetCurrency(a),
          usdRates
        );
        const cb = convertDisplayValueToCny(
          getAssetDisplayValue(b),
          getAssetCurrency(b),
          usdRates
        );
        return cb - ca;
      });
  }, [assets, category, useFx, usdRates]);

  return (
    <View style={styles.breakdownCard}>
      <Text
        style={[styles.breakdownTitle, { color: primary }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {CATEGORY_LABEL_ZH[category]} · 明细
        {useFx ? '（折合 CNY）' : ''}
      </Text>
      <ScrollView
        nestedScrollEnabled
        style={styles.breakdownScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {items.map((a) => {
          const v = getAssetDisplayValue(a);
          const cur = getAssetCurrency(a);
          const display =
            useFx && usdRates
              ? formatMoney(
                  convertDisplayValueToCny(v, cur, usdRates),
                  'CNY'
                )
              : formatMoney(v, cur);
          return (
            <View key={a.id} style={styles.breakdownRow}>
              <Text
                style={[styles.breakdownName, { color: primary }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {a.name}
              </Text>
              <Text
                style={[styles.breakdownValue, { color: textSecondary }]}
                numberOfLines={1}
              >
                {display}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
