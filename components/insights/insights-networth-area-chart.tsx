/**
 * 资产净值面积图：平滑 Bezier 曲线 + 纵向渐变填充 + 横向虚线网格 + 左侧千元 Y 轴。
 */

import {
  formatTrendYAxisThousandsCny,
  formatTrendYAxisThousandsDisplay,
  formatYmdChinese,
  type TrendPoint,
} from '@/lib/insights-model';
import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

type Props = {
  series: TrendPoint[];
  width: number;
  height: number;
  yMin: number;
  yMax: number;
  /** 折线：随主题 chartLine */
  lineColor: string;
  /** 面积渐变上下色：随主题 chartFillTop / chartFillBottom */
  fillTop: string;
  fillBottom: string;
  gridStroke: string;
  /** 纵轴刻度：低对比度，融入图内 */
  axisLabelColor: string;
  axisLabelOpacity?: number;
  onPointPress?: (payload: { index: number; x: number; y: number }) => void;
  /** 左侧纵轴刻度；默认千元人民币 */
  formatYAxisValue?: (value: number) => string;
  /** 与 `formatYAxisValue` 一致时传默认货币代码（用于非 CNY 的千元刻度） */
  displayCurrency?: string;
  /** 折线宽度；深色模式下可略加粗以突出走势 */
  lineStrokeWidth?: number;
  /**
   * 浅色：fillTop → fillBottom 渐变。
   * 深色：用折线色做极淡多段渐变，近线处略有色、向下快速透明，避免大面积着色。
   */
  ghostAreaFill?: boolean;
};

const PAD_L = 52;
const PAD_R = 8;
const PAD_T = 10;
const PAD_B = 34;
const SEGMENTS = 4;

function buildBezierPath(
  values: number[],
  width: number,
  height: number,
  yMin: number,
  yMax: number
): string {
  const plotW = width - PAD_L - PAD_R;
  const plotH = height - PAD_T - PAD_B;
  const n = values.length;
  if (n === 0) return '';
  const xAt = (i: number) =>
    n === 1
      ? PAD_L + plotW / 2
      : PAD_L + (i * plotW) / Math.max(1, n - 1);
  const yAt = (i: number) => {
    const v = values[i]!;
    const t = (v - yMin) / (yMax - yMin);
    return PAD_T + plotH - t * plotH;
  };
  if (n === 1) {
    const cx = xAt(0);
    const cy = yAt(0);
    return `M ${cx - 28} ${cy} L ${cx + 28} ${cy}`;
  }
  return ['M' + xAt(0) + ',' + yAt(0)]
    .concat(
      values.slice(0, -1).map((_, i) => {
        const x_mid = (xAt(i) + xAt(i + 1)) / 2;
        const y_mid = (yAt(i) + yAt(i + 1)) / 2;
        const cp_x1 = (x_mid + xAt(i)) / 2;
        const cp_x2 = (x_mid + xAt(i + 1)) / 2;
        return (
          'Q ' +
          cp_x1 +
          ',' +
          yAt(i) +
          ' ' +
          x_mid +
          ',' +
          y_mid +
          ' Q ' +
          cp_x2 +
          ',' +
          yAt(i + 1) +
          ' ' +
          xAt(i + 1) +
          ',' +
          yAt(i + 1)
        );
      })
    )
    .join(' ');
}

function buildAreaPath(
  lineD: string,
  values: number[],
  width: number,
  height: number,
  yMin: number,
  yMax: number
): string {
  const plotW = width - PAD_L - PAD_R;
  const plotH = height - PAD_T - PAD_B;
  const n = values.length;
  const bottomY = PAD_T + plotH;
  if (n === 0) return '';
  const xAt = (i: number) =>
    n === 1
      ? PAD_L + plotW / 2
      : PAD_L + (i * plotW) / Math.max(1, n - 1);
  const yAt = (i: number) => {
    const v = values[i]!;
    const t = (v - yMin) / (yMax - yMin);
    return PAD_T + plotH - t * plotH;
  };
  if (n === 1) {
    const cx = xAt(0);
    const cy = yAt(0);
    return `M ${cx - 28} ${cy} L ${cx + 28} ${cy} L ${cx + 28} ${bottomY} L ${cx - 28} ${bottomY} Z`;
  }
  const lastX = xAt(n - 1);
  const firstX = xAt(0);
  return `${lineD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
}

export function InsightsNetWorthAreaChart({
  series,
  width,
  height,
  yMin,
  yMax,
  lineColor,
  fillTop,
  fillBottom,
  gridStroke,
  axisLabelColor,
  axisLabelOpacity = 0.62,
  onPointPress,
  formatYAxisValue,
  displayCurrency = 'CNY',
  lineStrokeWidth = 2.25,
  ghostAreaFill = false,
}: Props) {
  const yAxisFmt = useMemo(() => {
    if (formatYAxisValue) return formatYAxisValue;
    return (v: number) =>
      displayCurrency === 'CNY'
        ? formatTrendYAxisThousandsCny(v)
        : formatTrendYAxisThousandsDisplay(v, displayCurrency);
  }, [formatYAxisValue, displayCurrency]);

  const gid = useMemo(
    () => `nwfill-${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  const values = useMemo(
    () => series.map((p) => p.valueCny),
    [series]
  );

  const { linePath, areaPath, gridYs, yTickVals, hitPoints } = useMemo(() => {
    const plotH = height - PAD_T - PAD_B;
    const plotW = width - PAD_L - PAD_R;
    const linePath = buildBezierPath(values, width, height, yMin, yMax);
    const areaPath = buildAreaPath(linePath, values, width, height, yMin, yMax);
    const gridYs: number[] = [];
    const yTickVals: number[] = [];
    for (let s = 0; s <= SEGMENTS; s++) {
      const val = yMin + (s / SEGMENTS) * (yMax - yMin);
      yTickVals.push(val);
      const t = (val - yMin) / (yMax - yMin);
      gridYs.push(PAD_T + plotH - t * plotH);
    }
    const n = values.length;
    const xAt = (i: number) =>
      n === 1
        ? PAD_L + plotW / 2
        : PAD_L + (i * plotW) / Math.max(1, n - 1);
    const yAt = (i: number) => {
      const v = values[i]!;
      const t = (v - yMin) / (yMax - yMin);
      return PAD_T + plotH - t * plotH;
    };
    const hitPoints =
      n > 0
        ? values.map((_, i) => ({
            index: i,
            cx: xAt(i),
            cy: yAt(i),
          }))
        : [];
    return { linePath, areaPath, gridYs, yTickVals, hitPoints };
  }, [values, width, height, yMin, yMax]);

  const xLabels = useMemo(() => {
    if (series.length === 0) return { start: '', end: '' };
    const a = series[0]!.date;
    const b = series[series.length - 1]!.date;
    return {
      start: formatYmdChinese(a),
      end: formatYmdChinese(b),
    };
  }, [series]);

  if (series.length === 0 || width < 80) {
    return null;
  }

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            {ghostAreaFill
              ? [
                  <Stop
                    key="g0"
                    offset="0"
                    stopColor={lineColor}
                    stopOpacity="0.045"
                  />,
                  <Stop
                    key="g1"
                    offset="0.26"
                    stopColor={lineColor}
                    stopOpacity="0.006"
                  />,
                  <Stop
                    key="g2"
                    offset="1"
                    stopColor={lineColor}
                    stopOpacity="0"
                  />,
                ]
              : [
                  <Stop
                    key="n0"
                    offset="0"
                    stopColor={fillTop}
                    stopOpacity="1"
                  />,
                  <Stop
                    key="n1"
                    offset="1"
                    stopColor={fillBottom}
                    stopOpacity="1"
                  />,
                ]}
          </LinearGradient>
        </Defs>
        <G>
          {gridYs.map((gy, i) => (
            <Line
              key={`h-${i}`}
              x1={PAD_L}
              y1={gy}
              x2={width - PAD_R}
              y2={gy}
              stroke={gridStroke}
              strokeWidth={1}
              strokeDasharray="5,6"
            />
          ))}
        </G>
        {areaPath.length > 0 ? (
          <Path d={areaPath} fill={`url(#${gid})`} stroke="none" />
        ) : null}
        {linePath.length > 0 ? (
          <Path
            d={linePath}
            fill="none"
            stroke={lineColor}
            strokeWidth={lineStrokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        <G opacity={axisLabelOpacity}>
          {yTickVals.map((val, i) => (
            <SvgText
              key={`yl-${i}`}
              x={PAD_L - 2}
              y={gridYs[i]! + 3}
              fontSize={9}
              fill={axisLabelColor}
              textAnchor="end"
              fontWeight="500"
            >
              {yAxisFmt(val)}
            </SvgText>
          ))}
        </G>
        <G opacity={axisLabelOpacity}>
          <SvgText
            x={PAD_L}
            y={height - 8}
            fontSize={9}
            fill={axisLabelColor}
            textAnchor="start"
            fontWeight="500"
          >
            {xLabels.start}
          </SvgText>
          <SvgText
            x={width - PAD_R}
            y={height - 8}
            fontSize={9}
            fill={axisLabelColor}
            textAnchor="end"
            fontWeight="500"
          >
            {xLabels.end}
          </SvgText>
        </G>
        {hitPoints.map((p) => (
          <Circle
            key={`hit-${p.index}`}
            cx={p.cx}
            cy={p.cy}
            r={14}
            fill="transparent"
            onPress={() => onPointPress?.({ index: p.index, x: p.cx, y: p.cy })}
          />
        ))}
      </Svg>
    </View>
  );
}
