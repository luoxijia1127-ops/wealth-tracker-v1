/**
 * Insights · 资产分布：环形图 + 大类明细
 */

import {
  formatMoney,
  getAssetCurrency,
  getAssetDisplayValue,
} from '@/lib/asset-value';
import {
  convertDisplayValueToCurrency,
  hasUsdAnchoredFxTable,
  type FxUsdMidRates,
} from '@/lib/fx-rates';
import { useLanguage } from '@/contexts/language-context';
import type { TranslationKey } from '@/lib/language';
import { numberSingleLineTextProps } from '@/lib/numeric-display-one-line';
import {
  DONUT_EXPLODE,
  DONUT_PCT_LABEL_INSIDE_MIN,
  DONUT_PCT_LABEL_OMIT_BELOW,
  DONUT_PCT_LABEL_OUTSIDE_PAD,
  DONUT_SELECTED_SCALE,
  getDonutPieCurves,
  type DonutSlice,
} from '@/lib/insights-model';
import type { InsightsStyles } from '@/lib/insights-styles';
import { type AssetCategory, type SimpleAsset } from '@/types/asset';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { G, Path, Svg, Text as SvgText } from 'react-native-svg';

export function DistributionDonut({
  slices,
  width,
  ringSize,
  selectedCategory,
  onToggleCategory,
  labelInk = 'rgba(36, 40, 52, 0.92)',
}: {
  slices: DonutSlice[];
  width: number;
  ringSize: number;
  selectedCategory: AssetCategory | null;
  onToggleCategory: (category: AssetCategory) => void;
  /** 环外占比数字颜色（与主题主色一致更易读） */
  labelInk?: string;
}) {
  const { t } = useLanguage();
  const { curves, total, outer } = getDonutPieCurves(slices, width, ringSize);
  const cx = width / 2;
  const cy = ringSize / 2;
  const pctFontSize = Math.max(9, Math.min(13, Math.round(outer * 0.28)));
  const pctFontSizeOutside = Math.max(10, Math.min(14, Math.round(outer * 0.32)));

  return (
    <Svg width={width} height={ringSize} style={{ overflow: 'visible' }}>
      <G x={cx} y={cy}>
        {curves.map((c) => {
          const isSel = selectedCategory === c.item.category;
          const dimOthers = selectedCategory !== null && !isSel;
          const [gx, gy] = c.sector.centroid;
          const len = Math.hypot(gx, gy) || 1;
          const ux = gx / len;
          const uy = gy / len;
          const pull = isSel ? DONUT_EXPLODE : 0;
          const pullDx = ux * pull;
          const pullDy = uy * pull;
          const scale = isSel ? DONUT_SELECTED_SCALE : 1;
          const transform =
            scale !== 1
              ? `translate(${pullDx},${pullDy}) translate(${gx},${gy}) scale(${scale}) translate(${-gx},${-gy})`
              : `translate(${pullDx},${pullDy})`;

          const pctRaw = total > 0 ? (100 * c.item.value) / total : 0;
          const pctLabel =
            pctRaw > 0 && pctRaw < 1 ? '<1%' : `${Math.round(pctRaw)}%`;

          const showPctLabel = pctRaw >= DONUT_PCT_LABEL_OMIT_BELOW;
          const useOutside =
            pctRaw > 0 &&
            pctRaw < DONUT_PCT_LABEL_INSIDE_MIN &&
            pctRaw >= DONUT_PCT_LABEL_OMIT_BELOW;
          const labelX = useOutside ? ux * (outer + DONUT_PCT_LABEL_OUTSIDE_PAD) : gx;
          const labelY = useOutside ? uy * (outer + DONUT_PCT_LABEL_OUTSIDE_PAD) : gy;
          const fs = useOutside ? pctFontSizeOutside : pctFontSize;

          return (
            <G key={`${c.item.category}-${c.index}`} transform={transform}>
              <Path
                d={c.sector.path.print()}
                fill={c.item.color}
                fillOpacity={dimOthers ? 0.38 : 1}
                stroke={isSel ? '#FFFFFF' : 'rgba(255,255,255,0.35)'}
                strokeWidth={isSel ? 2.5 : 1}
                onPress={() => onToggleCategory(c.item.category)}
                accessibilityLabel={`${t(
                  `asset.category.${c.item.category}` as TranslationKey
                )}, ${pctRaw.toFixed(1)}%`}
              />
              {showPctLabel ? (
                <SvgText
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  alignmentBaseline="central"
                  fontSize={fs}
                  fontWeight="700"
                  fill={useOutside ? labelInk : 'rgba(255,255,255,0.96)'}
                  stroke={
                    useOutside
                      ? 'rgba(255,255,255,0.88)'
                      : 'rgba(45, 52, 72, 0.35)'
                  }
                  strokeWidth={useOutside ? 0.55 : 0.35}
                  fillOpacity={dimOthers ? 0.42 : 1}
                  pointerEvents="none"
                >
                  {pctLabel}
                </SvgText>
              ) : null}
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
  displayCurrency = 'CNY',
}: {
  category: AssetCategory;
  assets: SimpleAsset[];
  styles: InsightsStyles;
  primary: string;
  textSecondary: string;
  /** 有缓存汇率时明细行折至默认货币，与环形图口径一致 */
  usdRates?: FxUsdMidRates['rates'] | null;
  displayCurrency?: string;
}) {
  const { t } = useLanguage();
  const useFx = hasUsdAnchoredFxTable(usdRates);
  const target = /^[A-Z]{3}$/.test(displayCurrency) ? displayCurrency : 'CNY';

  const items = useMemo(() => {
    return assets
      .filter(
        (a) => a.category === category && getAssetDisplayValue(a) > 0
      )
      .sort((a, b) => {
        if (!useFx || !usdRates) {
          return getAssetDisplayValue(b) - getAssetDisplayValue(a);
        }
        const ca = convertDisplayValueToCurrency(
          getAssetDisplayValue(a),
          getAssetCurrency(a),
          target,
          usdRates
        );
        const cb = convertDisplayValueToCurrency(
          getAssetDisplayValue(b),
          getAssetCurrency(b),
          target,
          usdRates
        );
        return cb - ca;
      });
  }, [assets, category, useFx, usdRates, target]);

  return (
    <View style={styles.breakdownCard}>
      <Text
        style={[styles.breakdownTitle, { color: primary }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {t(`asset.category.${category}` as TranslationKey)} ·{' '}
        {t('insights.distribution.detail')}
        {useFx ? ` (${t('insights.distribution.converted', { target })})` : ''}
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
                  convertDisplayValueToCurrency(v, cur, target, usdRates),
                  target
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
                {...numberSingleLineTextProps}
                style={[styles.breakdownValue, { color: textSecondary }]}
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
