/**
 * Insights · 投资回报：累计收益率 × 持有天数散点图 + 筛选/排序表
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { AppFont } from '@/lib/app-fonts';
import type { AppPaletteTheme } from '@/lib/app-palette';
import { formatMoney } from '@/lib/asset-value';
import { pickTextOnAccent, rgbaFromHex } from '@/lib/color-utils';
import { FINANCE_UP } from '@/lib/finance-colors';
import type { InsightsStyles } from '@/lib/insights-styles';
import {
  CUMULATIVE_CHART_CAP,
  CUMULATIVE_CHART_FLOOR,
  clampCumulativeForAxis,
  computeAllReturnMetrics,
  isPlottableMetric,
  type InvestmentReturnMetric,
} from '@/lib/investment-return-metrics';
import {
  ASSET_CATEGORY_ORDER,
  CATEGORY_LABEL_ZH,
  type AssetCategory,
  type SimpleAsset,
} from '@/types/asset';
import { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Circle, G, Line, Svg, Text as SvgText } from 'react-native-svg';

type SortKey = 'holdingDays' | 'cumulativeReturn' | 'annualizedReturn' | 'buyAmount';

function pctFmt(ratio: number, digits = 2): string {
  if (!Number.isFinite(ratio)) return '—';
  return `${(ratio * 100).toFixed(digits)}%`;
}

function reasonLabel(m: InvestmentReturnMetric): string {
  switch (m.reason) {
    case 'no_buy':
      return '缺少有效买入成本';
    case 'bad_days':
      return '持有天数≤0';
    case 'bad_return_base':
      return '累计亏损≥100%（年化不可用）';
    case 'unsupported':
      return '不支持或数据不足';
    default:
      return '—';
  }
}

/** 与散点图内平均参考线一致 */
const RETURN_AVG_HOLDING_LINE = '#F59E0B';

const RETURN_AVG_RETURN_LINE = FINANCE_UP;

type ScatterPoint = {
  id: string;
  m: InvestmentReturnMetric;
  x: number;
  y: number;
  r: number;
  color: string;
};

function buildScatterModel(
  rows: InvestmentReturnMetric[],
  categoryAccents: Record<AssetCategory, string>,
  plotW: number,
  plotH: number,
  padL: number,
  padT: number
): {
  points: ScatterPoint[];
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  avgDays: number | null;
  avgCum: number | null;
  /** 未裁剪的算术平均累计收益率 */
  avgCumRaw: number | null;
} {
  const plottable = rows.filter(isPlottableMetric);
  if (plottable.length === 0) {
    return {
      points: [],
      xMin: 0,
      xMax: 1,
      yMin: -0.1,
      yMax: 0.1,
      avgDays: null,
      avgCum: null,
      avgCumRaw: null,
    };
  }

  const xs = plottable.map((m) => m.holdingDays);
  const ys = plottable.map((m) => clampCumulativeForAxis(m.cumulativeReturn));
  let xMin = 0;
  let xMax = Math.max(30, ...xs, 1);
  let yMin = Math.min(-0.05, ...ys, -0.02);
  let yMax = Math.max(0.05, ...ys, 0.02);
  const xPad = (xMax - xMin) * 0.06 || 2;
  const yPad = (yMax - yMin) * 0.08 || 0.02;
  xMax += xPad;
  yMin -= yPad;
  yMax += yPad;
  yMin = Math.max(CUMULATIVE_CHART_FLOOR, yMin);
  yMax = Math.min(CUMULATIVE_CHART_CAP, yMax);
  if (yMax - yMin < 0.08) {
    yMin -= 0.04;
    yMax += 0.04;
  }

  const avgDays = plottable.reduce((s, m) => s + m.holdingDays, 0) / plottable.length;
  const avgCumRaw =
    plottable.reduce((s, m) => s + m.cumulativeReturn, 0) / plottable.length;
  const avgCum = clampCumulativeForAxis(avgCumRaw);

  const buyVals = plottable.map((m) => m.buyAmount);
  const bMin = Math.min(...buyVals);
  const bMax = Math.max(...buyVals);
  const rMin = 5;
  const rMax = 22;
  const sizeOf = (b: number) => {
    if (!(bMax > bMin) && bMax > 0) return (rMin + rMax) / 2;
    if (!(bMax > bMin)) return rMin;
    const t = (b - bMin) / (bMax - bMin);
    return rMin + t * (rMax - rMin);
  };

  const mapX = (d: number) => padL + ((d - xMin) / (xMax - xMin)) * plotW;
  const mapY = (a: number) =>
    padT + plotH - ((a - yMin) / (yMax - yMin)) * plotH;

  const points: ScatterPoint[] = plottable.map((m) => {
    const ax = clampCumulativeForAxis(m.cumulativeReturn);
    return {
      id: m.assetId,
      m,
      x: mapX(m.holdingDays),
      y: mapY(ax),
      r: sizeOf(m.buyAmount),
      color: categoryAccents[m.category] ?? '#5C6390',
    };
  });

  return {
    points,
    xMin,
    xMax,
    yMin,
    yMax,
    avgDays,
    avgCum,
    avgCumRaw,
  };
}

export function ReturnScatterPanel({
  assets: _assets,
  theme,
  styles,
  textSecondary,
  textMuted,
}: {
  assets: SimpleAsset[];
  theme: AppPaletteTheme;
  styles: InsightsStyles;
  textSecondary: string;
  textMuted: string;
}) {
  const { appearance } = useAppPalette();
  const { width: windowWidth } = useWindowDimensions();
  const scatterPointStroke =
    appearance === 'dark' ? 'rgba(255,255,255,0.5)' : '#FFFFFF';
  const placeholderMuted =
    appearance === 'dark'
      ? 'rgba(255,255,255,0.38)'
      : rgbaFromHex(theme.primary, 0.38);
  const chartTotalW = Math.max(288, Math.min(548, windowWidth - 48 - 40));
  const yLabelCol = 26;
  const chartW = chartTotalW - yLabelCol;
  const padL = 50;
  const padR = 14;
  const padT = 14;
  const padB = 42;
  const plotW = chartW - padL - padR;
  const plotH = 220;

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<Set<AssetCategory> | null>(null);
  const [hideInvalid, setHideInvalid] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('cumulativeReturn');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [tipId, setTipId] = useState<string | null>(null);
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null);

  const metrics = useMemo(() => computeAllReturnMetrics(_assets), [_assets]);

  /** 用户持仓中实际出现的大类（顺序与资产分布一致，最多 6 个） */
  const userCategories = useMemo(() => {
    const present = new Set<AssetCategory>();
    for (const a of _assets) {
      const c = (a.category ?? 'Cash') as AssetCategory;
      if (ASSET_CATEGORY_ORDER.includes(c)) present.add(c);
    }
    return ASSET_CATEGORY_ORDER.filter((c) => present.has(c));
  }, [_assets]);

  useEffect(() => {
    setCatFilter((prev) => {
      if (prev === null) return null;
      const next = new Set<AssetCategory>();
      for (const c of prev) {
        if (userCategories.includes(c)) next.add(c);
      }
      if (next.size === 0 || next.size === userCategories.length) return null;
      return next;
    });
  }, [userCategories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cats = catFilter;
    return metrics.filter((m) => {
      if (cats !== null) {
        if (cats.size === 0) return false;
        if (!cats.has(m.category)) return false;
      }
      if (q.length > 0 && !m.name.toLowerCase().includes(q)) return false;
      if (hideInvalid && m.reason !== 'ok') return false;
      return true;
    });
  }, [metrics, search, catFilter, hideInvalid]);

  const sortedTable = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let va = 0;
      let vb = 0;
      switch (sortKey) {
        case 'holdingDays':
          va = a.holdingDays;
          vb = b.holdingDays;
          break;
        case 'cumulativeReturn':
          va = a.cumulativeReturn;
          vb = b.cumulativeReturn;
          break;
        case 'annualizedReturn':
          va = a.annualizedReturn ?? -1e9;
          vb = b.annualizedReturn ?? -1e9;
          break;
        case 'buyAmount':
          va = a.buyAmount;
          vb = b.buyAmount;
          break;
        default:
          break;
      }
      if (va !== vb) return va > vb ? dir : -dir;
      return a.name.localeCompare(b.name, 'zh-CN');
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const chartRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cats = catFilter;
    return metrics.filter((m) => {
      if (cats !== null) {
        if (cats.size === 0) return false;
        if (!cats.has(m.category)) return false;
      }
      if (q.length > 0 && !m.name.toLowerCase().includes(q)) return false;
      return isPlottableMetric(m);
    });
  }, [metrics, search, catFilter]);

  const model = useMemo(
    () =>
      buildScatterModel(
        chartRows,
        theme.categoryAccents,
        plotW,
        plotH,
        padL,
        padT
      ),
    [chartRows, theme.categoryAccents, plotW, plotH]
  );

  const excludedCount = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cats = catFilter;
    return metrics.filter((m) => {
      if (cats !== null) {
        if (cats.size === 0) return false;
        if (!cats.has(m.category)) return false;
      }
      if (q.length > 0 && !m.name.toLowerCase().includes(q)) return false;
      return !isPlottableMetric(m);
    }).length;
  }, [metrics, search, catFilter]);

  const toggleCategory = (c: AssetCategory) => {
    if (!userCategories.includes(c)) return;
    setCatFilter((prev) => {
      const next = new Set(prev ?? userCategories);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      if (next.size === userCategories.length) return null;
      return next;
    });
  };

  const cycleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir(k === 'holdingDays' || k === 'buyAmount' ? 'desc' : 'desc');
    }
  };

  const chartH = padT + plotH + padB;

  const avgLineX =
    model.avgDays !== null
      ? padL +
        ((model.avgDays - model.xMin) / (model.xMax - model.xMin)) * plotW
      : null;
  const avgLineY =
    model.avgCum !== null
      ? padT +
        plotH -
        ((model.avgCum - model.yMin) / (model.yMax - model.yMin)) * plotH
      : null;

  const gridXs = [0.25, 0.5, 0.75];
  const gridYs = [0.25, 0.5, 0.75];

  return (
    <View style={styles.returnPanelCard}>
      <View style={styles.returnMastheadBlock}>
        <Text style={[styles.returnKicker, { color: textSecondary }]}>
          INVESTMENT
        </Text>
        <Text style={[styles.returnTitle, { color: theme.primary }]}>
          ROI ANALYSIS
        </Text>
        <Text style={[styles.returnSubTitle, { color: textSecondary }]}>
          PERSONAL ASSET MANAGEMENT
        </Text>
      </View>

      <View style={styles.returnChartWrap}>
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: yLabelCol,
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10,
          }}
        >
          <Text
            style={{
              transform: [{ rotate: '-90deg' }],
              width: chartH - 20,
              textAlign: 'center',
              fontSize: 11,
              fontFamily: AppFont.semiBold,
              color: textSecondary,
              letterSpacing: 0.5,
            }}
            numberOfLines={1}
          >
            Cumulative Return (%)
          </Text>
        </View>
        <Svg width={chartW + yLabelCol} height={chartH} style={{ marginLeft: yLabelCol }}>
          <G opacity={0.9}>
            {gridYs.map((t) => {
              const y = padT + t * plotH;
              return (
                <Line
                  key={`gy-${t}`}
                  x1={padL}
                  y1={y}
                  x2={padL + plotW}
                  y2={y}
                  stroke={rgbaFromHex(theme.primary, 0.15)}
                  strokeWidth={1}
                />
              );
            })}
            {gridXs.map((t) => {
              const x = padL + t * plotW;
              return (
                <Line
                  key={`gx-${t}`}
                  x1={x}
                  y1={padT}
                  x2={x}
                  y2={padT + plotH}
                  stroke={rgbaFromHex(theme.primary, 0.15)}
                  strokeWidth={1}
                />
              );
            })}
            <Line
              x1={padL}
              y1={padT}
              x2={padL + plotW}
              y2={padT}
              stroke={rgbaFromHex(theme.primary, 0.3)}
              strokeWidth={1}
            />
            <Line
              x1={padL}
              y1={padT + plotH}
              x2={padL + plotW}
              y2={padT + plotH}
              stroke={rgbaFromHex(theme.primary, 0.3)}
              strokeWidth={1}
            />
            <Line
              x1={padL}
              y1={padT}
              x2={padL}
              y2={padT + plotH}
              stroke={rgbaFromHex(theme.primary, 0.3)}
              strokeWidth={1}
            />
            <Line
              x1={padL + plotW}
              y1={padT}
              x2={padL + plotW}
              y2={padT + plotH}
              stroke={rgbaFromHex(theme.primary, 0.3)}
              strokeWidth={1}
            />

            {avgLineX !== null &&
              avgLineX >= padL &&
              avgLineX <= padL + plotW && (
                <Line
                  x1={avgLineX}
                  y1={padT}
                  x2={avgLineX}
                  y2={padT + plotH}
                  stroke={RETURN_AVG_HOLDING_LINE}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                />
              )}
            {avgLineY !== null &&
              avgLineY >= padT &&
              avgLineY <= padT + plotH && (
                <Line
                  x1={padL}
                  y1={avgLineY}
                  x2={padL + plotW}
                  y2={avgLineY}
                  stroke={RETURN_AVG_RETURN_LINE}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                />
              )}

            {avgLineX !== null &&
              avgLineX >= padL &&
              avgLineX <= padL + plotW &&
              model.avgDays !== null && (
                <SvgText
                  x={
                    avgLineX < padL + plotW * 0.58 ? avgLineX + 5 : avgLineX - 5
                  }
                  y={padT + 13}
                  textAnchor={
                    avgLineX < padL + plotW * 0.58 ? 'start' : 'end'
                  }
                  fill={RETURN_AVG_HOLDING_LINE}
                  fontSize={10}
                  fontFamily={AppFont.semiBold}
                >
                  {`平均 ${model.avgDays.toFixed(0)} 天`}
                </SvgText>
              )}
            {avgLineY !== null &&
              avgLineY >= padT &&
              avgLineY <= padT + plotH &&
              model.avgCumRaw !== null && (
                <SvgText
                  x={padL + plotW - 5}
                  y={avgLineY > padT + 22 ? avgLineY - 5 : avgLineY + 14}
                  textAnchor="end"
                  fill={RETURN_AVG_RETURN_LINE}
                  fontSize={10}
                  fontFamily={AppFont.semiBold}
                >
                  {`平均 ${pctFmt(model.avgCumRaw)}`}
                </SvgText>
              )}

            {model.points.map((p) => {
              // Add a subtle drop shadow effect by rendering a slightly offset darker circle underneath
              return (
                <G key={p.id}>
                  <Circle
                    cx={p.x}
                    cy={p.y + 2}
                    r={p.r}
                    fill={rgbaFromHex(theme.primary, 0.15)}
                  />
                  <Circle
                    cx={p.x}
                    cy={p.y}
                    r={p.r}
                    fill={p.color}
                    fillOpacity={0.88}
                    stroke={rgbaFromHex(theme.primary, 0.1)}
                    strokeWidth={1}
                    onPress={() => {
                      setTipId((id) => (id === p.id ? null : p.id));
                      setTipPos({ x: p.x, y: p.y });
                    }}
                  />
                  {p.r > 12 && (
                    <SvgText
                      x={p.x}
                      y={p.y + 3}
                      textAnchor="middle"
                      fill={pickTextOnAccent(p.color)}
                      fontSize={Math.max(8, Math.min(11, p.r * 0.45))}
                      fontWeight="600"
                      pointerEvents="none"
                    >
                      {p.m.name.length > 5 ? p.m.name.slice(0, 5) : p.m.name}
                    </SvgText>
                  )}
                </G>
              );
            })}
          </G>

          <SvgText
            x={padL + plotW / 2}
            y={chartH - 6}
            textAnchor="middle"
            fill={textSecondary}
            fontSize={11}
            fontFamily={AppFont.semiBold}
            letterSpacing={0.5}
          >
            Holding Period (Days)
          </SvgText>

          <SvgText x={padL} y={padT + plotH + 16} fill={textMuted} fontSize={10} fontFamily={AppFont.medium}>
            {Math.round(model.xMin)}
          </SvgText>
          <SvgText
            x={padL + plotW}
            y={padT + plotH + 16}
            textAnchor="end"
            fill={textMuted}
            fontSize={10}
            fontFamily={AppFont.medium}
          >
            {Math.round(model.xMax)}
          </SvgText>
          <SvgText x={padL - 8} y={padT + 4} textAnchor="end" fill={textMuted} fontSize={10} fontFamily={AppFont.medium}>
            {Math.round(model.yMax * 100)}
          </SvgText>
          <SvgText
            x={padL - 8}
            y={padT + plotH}
            textAnchor="end"
            fill={textMuted}
            fontSize={10}
            fontFamily={AppFont.medium}
          >
            {Math.round(model.yMin * 100)}
          </SvgText>
          <SvgText
            x={padL - 8}
            y={padT + plotH / 2 + 4}
            textAnchor="end"
            fill={textMuted}
            fontSize={10}
            fontFamily={AppFont.medium}
          >
            0
          </SvgText>
        </Svg>

        {tipId &&
          model.points.find((p) => p.id === tipId) &&
          tipPos &&
          (() => {
            const p = model.points.find((x) => x.id === tipId)!;
            const m = p.m;
            const left = Math.max(
              8,
              Math.min(chartW + yLabelCol - 270, yLabelCol + tipPos.x - 140)
            );
            const top = Math.max(8, tipPos.y - 120);
            return (
              <View
                style={[
                  styles.returnTooltip,
                  { left, top },
                ]}
                {...(Platform.OS === 'web'
                  ? ({ onMouseLeave: () => setTipId(null) } as Record<string, unknown>)
                  : {})}
              >
                <Text style={styles.returnTooltipTitle}>{m.name}</Text>
                <Text style={styles.returnTooltipLine}>
                  {CATEGORY_LABEL_ZH[m.category]}
                </Text>
                <Text style={styles.returnTooltipLine}>
                  持有 {m.holdingDays} 天 · 买入{' '}
                  {formatMoney(m.buyAmount, m.currency)}
                </Text>
                <Text style={styles.returnTooltipLine}>
                  期末 {formatMoney(m.endValue, m.currency)}
                </Text>
                <Text style={styles.returnTooltipLine}>
                  现金流 {formatMoney(m.cashFlowNet, m.currency)}
                </Text>
                <Text style={styles.returnTooltipLine}>
                  累计 {pctFmt(m.cumulativeReturn)}
                  {m.annualizedReturn !== null
                    ? ` · 年化(参考) ${pctFmt(m.annualizedReturn)}`
                    : ''}
                </Text>
              </View>
            );
          })()}
      </View>

      <View style={styles.returnFilterRow}>
        <View style={styles.returnSearchIcon}>
           <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={placeholderMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx={11} cy={11} r={8} />
              <Line x1={21} y1={21} x2={16.65} y2={16.65} />
           </Svg>
        </View>
        <TextInput
          style={styles.returnSearchInput}
          placeholder="Search Assets..."
          placeholderTextColor={placeholderMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {userCategories.length > 0 ? (
        <View style={styles.returnCategoryRow}>
          {userCategories.map((c) => {
            const accent = theme.categoryAccents[c] ?? theme.primary;
            const inFilter =
              catFilter === null || (catFilter !== null && catFilter.has(c));
            return (
              <Pressable
                key={c}
                onPress={() => toggleCategory(c)}
                style={({ pressed }) => [
                  styles.returnChipInRow,
                  inFilter
                    ? {
                        backgroundColor: accent,
                        borderColor: 'transparent',
                      }
                    : {
                        backgroundColor: 'transparent',
                        borderColor: rgbaFromHex(accent, 0.42),
                      },
                  !inFilter && catFilter !== null ? { opacity: 0.48 } : null,
                  pressed && inFilter && { opacity: 0.88 },
                  pressed && !inFilter && { opacity: 0.4 },
                ]}
              >
                <View
                  style={[
                    styles.returnChipColorDot,
                    {
                      backgroundColor: accent,
                      opacity: inFilter ? 1 : 0.55,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.returnChipTextInRow,
                    {
                      color: inFilter
                        ? pickTextOnAccent(accent)
                        : rgbaFromHex(theme.primary, 0.92),
                    },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {CATEGORY_LABEL_ZH[c]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.returnToggleRow}>
        <Text style={{ color: textMuted, fontSize: 11, fontFamily: AppFont.medium, textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 8 }}>
          Hide Invalid
        </Text>
        <Switch
          value={hideInvalid}
          onValueChange={setHideInvalid}
          trackColor={{
            false: rgbaFromHex(theme.primary, 0.15),
            true: rgbaFromHex(theme.primary, 0.35),
          }}
          thumbColor={appearance === 'dark' ? rgbaFromHex(theme.primary, 0.9) : '#FFFFFF'}
          style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
        />
      </View>

      <View style={styles.returnListContainer}>
        {sortedTable.map((m, i) => {
          const accent = theme.categoryAccents[m.category] ?? theme.primary;
          // Use index to alternate background color styles for a collage feel
          const blockBg = i % 3 === 0 
            ? rgbaFromHex(accent, 0.25)
            : i % 3 === 1 
              ? rgbaFromHex(accent, 0.15)
              : rgbaFromHex(accent, 0.35);
              
          return (
            <View key={m.assetId} style={styles.returnListItem}>
              <View style={styles.returnListItemLeft}>
                <Text style={styles.returnListItemName} numberOfLines={1}>{m.name}</Text>
                <Text style={styles.returnListItemMeta}>
                  Holding: {m.holdingDays} Days
                  {m.reason !== 'ok' ? ` · ${reasonLabel(m)}` : ''}
                </Text>
              </View>
              <View style={[styles.returnListItemRightBlock, { backgroundColor: blockBg }]}>
                <Text style={styles.returnListItemValue}>
                  {m.cumulativeReturn > 0 ? '+' : ''}{(m.cumulativeReturn * 100).toFixed(1)}%
                </Text>
                <Text style={styles.returnListItemValueLabel}>Cumulative Return</Text>
              </View>
            </View>
          );
        })}
      </View>

      {excludedCount > 0 ? (
        <Text style={[styles.returnFooterHint, { color: textMuted }]}>
          {excludedCount} items hidden due to invalid metrics or filters.
        </Text>
      ) : null}
    </View>
  );
}
