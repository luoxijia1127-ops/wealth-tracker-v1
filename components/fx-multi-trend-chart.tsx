/**
 * 汇率走势图：平滑贝塞尔曲线；纵轴为传入序列并集（单币种时即该币种的量级）；
 * 每条序列单独标注该币种的最低、最高。
 */

import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

const PAD_L = 50;
const PAD_R = 10;
const PAD_T = 12;
const PAD_B = 44;
const GRID_SEG = 4;

const Y_PAD_RATIO = 0.04;

function buildPlotHelpers(
  n: number,
  width: number,
  height: number,
  yMin: number,
  yMax: number,
  xAt: (i: number) => number
) {
  const plotW = width - PAD_L - PAD_R;
  const plotH = height - PAD_T - PAD_B;
  const yAtValue = (v: number) => {
    const t = (v - yMin) / (yMax - yMin);
    return PAD_T + plotH - t * plotH;
  };
  const yAtIndex = (values: number[], i: number) =>
    yAtValue(values[i]!);
  return { plotW, plotH, xAt, yAtValue, yAtIndex };
}

/** 与净值走势图一致的平滑贝塞尔折线（双二次贝塞尔穿过相邻点中点） */
function buildBezierPath(
  values: number[],
  width: number,
  height: number,
  yMin: number,
  yMax: number,
  xAt: (i: number) => number
): string {
  const n = values.length;
  if (n === 0) return '';
  const { yAtIndex } = buildPlotHelpers(
    n,
    width,
    height,
    yMin,
    yMax,
    xAt
  );
  if (n === 1) {
    const cx = xAt(0);
    const cy = yAtIndex(values, 0);
    return `M ${cx - 20} ${cy} L ${cx + 20} ${cy}`;
  }
  return [`M${xAt(0)},${yAtIndex(values, 0)}`]
    .concat(
      values.slice(0, -1).map((_, i) => {
        const x_mid = (xAt(i) + xAt(i + 1)) / 2;
        const y_mid = (yAtIndex(values, i) + yAtIndex(values, i + 1)) / 2;
        const cp_x1 = (x_mid + xAt(i)) / 2;
        const cp_x2 = (x_mid + xAt(i + 1)) / 2;
        return (
          'Q ' +
          cp_x1 +
          ',' +
          yAtIndex(values, i) +
          ' ' +
          x_mid +
          ',' +
          y_mid +
          ' Q ' +
          cp_x2 +
          ',' +
          yAtIndex(values, i + 1) +
          ' ' +
          xAt(i + 1) +
          ',' +
          yAtIndex(values, i + 1)
        );
      })
    )
    .join(' ');
}

function shortDateLabel(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return ymd;
  return `${parseInt(m[2]!, 10)}/${parseInt(m[3]!, 10)}`;
}

function padSeries(values: number[], n: number): number[] {
  if (values.length >= n) return values.slice(0, n);
  const last = values.length > 0 ? values[values.length - 1]! : 100;
  const out = [...values];
  while (out.length < n) out.push(last);
  return out.slice(0, n);
}

export type FxMultiSeries = {
  code: string;
  color: string;
  /** 与 dates 等长：多少基准 = 1 目标（`unitsOfTargetPerBase` 的倒数） */
  values: number[];
};

type SeriesExtreme = {
  code: string;
  color: string;
  seriesIndex: number;
  minI: number;
  maxI: number;
  minV: number;
  maxV: number;
  flat: boolean;
};

type Props = {
  dates: string[];
  series: FxMultiSeries[];
  width: number;
  height: number;
  gridStroke: string;
  axisLabelColor: string;
  formatY: (n: number) => string;
};

export function FxMultiTrendChart({
  dates,
  series,
  width,
  height,
  gridStroke,
  axisLabelColor,
  formatY,
}: Props) {
  const model = useMemo(() => {
    const n = dates.length;
    if (n === 0 || series.length === 0) {
      return {
        yMin: 0,
        yMax: 1,
        yTicks: [0, 0.25, 0.5, 0.75, 1],
        xLabels: [] as { x: number; text: string }[],
        plotW: width - PAD_L - PAD_R,
        plotH: height - PAD_T - PAD_B,
        paths: [] as { code: string; color: string; d: string }[],
        yAtValue: (_v: number) => 0,
        xAt: (_i: number) => PAD_L,
        seriesExtremes: [] as SeriesExtreme[],
        singleSeries: false,
      };
    }

    const all: number[] = [];
    for (const s of series) {
      const vals =
        s.values.length >= n ? s.values.slice(0, n) : padSeries(s.values, n);
      for (let i = 0; i < n; i++) {
        const v = vals[i];
        if (typeof v === 'number' && Number.isFinite(v)) all.push(v);
      }
    }
    let yMin = all.length > 0 ? Math.min(...all) : 0;
    let yMax = all.length > 0 ? Math.max(...all) : 1;
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
      yMin = 0;
      yMax = 1;
    }
    if (yMax - yMin < 1e-6) {
      const c = yMin;
      yMin = c - 0.02;
      yMax = c + 0.02;
    } else {
      const pad = (yMax - yMin) * Y_PAD_RATIO;
      yMin -= pad;
      yMax += pad;
    }

    const plotW = width - PAD_L - PAD_R;
    const plotH = height - PAD_T - PAD_B;

    const xAt = (i: number) =>
      n === 1
        ? PAD_L + plotW / 2
        : PAD_L + (i * plotW) / Math.max(1, n - 1);

    const { yAtValue } = buildPlotHelpers(
      n,
      width,
      height,
      yMin,
      yMax,
      xAt
    );

    const seriesExtremes: SeriesExtreme[] = series.map((s, seriesIndex) => {
      const vals =
        s.values.length >= n ? s.values.slice(0, n) : padSeries(s.values, n);
      let minI = -1;
      let maxI = -1;
      for (let i = 0; i < n; i++) {
        const v = vals[i]!;
        if (!Number.isFinite(v)) continue;
        if (minI < 0 || v < vals[minI]!) minI = i;
        if (maxI < 0 || v > vals[maxI]!) maxI = i;
      }
      if (minI < 0 || maxI < 0) {
        minI = 0;
        maxI = 0;
      }
      const minV = vals[minI]!;
      const maxV = vals[maxI]!;
      const flat = Math.abs(maxV - minV) < 1e-12;
      return {
        code: s.code,
        color: s.color,
        seriesIndex,
        minI,
        maxI,
        minV,
        maxV,
        flat,
      };
    });

    const yTicks: number[] = [];
    for (let i = 0; i <= GRID_SEG; i++) {
      yTicks.push(yMin + ((yMax - yMin) * i) / GRID_SEG);
    }

    const xLabels: { x: number; text: string }[] = [];
    if (n >= 1) {
      xLabels.push({ x: xAt(0), text: shortDateLabel(dates[0]!) });
    }
    if (n >= 2) {
      xLabels.push({
        x: xAt(n - 1),
        text: shortDateLabel(dates[n - 1]!),
      });
    }
    if (n >= 4) {
      const mid = Math.floor((n - 1) / 2);
      if (mid > 0 && mid < n - 1) {
        xLabels.splice(1, 0, {
          x: xAt(mid),
          text: shortDateLabel(dates[mid]!),
        });
      }
    }

    const paths = series.map((s) => {
      const vals =
        s.values.length >= n ? s.values.slice(0, n) : padSeries(s.values, n);
      const d = buildBezierPath(vals, width, height, yMin, yMax, xAt);
      return { code: s.code, color: s.color, d };
    });

    return {
      yMin,
      yMax,
      yTicks,
      xLabels,
      plotW,
      plotH,
      paths,
      yAtValue,
      xAt,
      seriesExtremes,
      singleSeries: series.length === 1,
    };
  }, [dates, series, width, height]);

  if (dates.length === 0 || width <= 20) return null;

  const h = height;
  const w = width;
  const {
    yMin,
    yMax,
    yTicks,
    xLabels,
    plotW,
    plotH,
    paths,
    yAtValue,
    xAt,
    seriesExtremes,
    singleSeries,
  } = model;

  const plotMidY = PAD_T + plotH / 2;

  const gridLines = yTicks.map((yt, i) => {
    const yy =
      PAD_T + plotH - ((yt - yMin) / (yMax - yMin)) * plotH;
    return (
      <Line
        key={`h-${i}`}
        x1={PAD_L}
        y1={yy}
        x2={PAD_L + plotW}
        y2={yy}
        stroke={gridStroke}
        strokeWidth={1}
      />
    );
  });

  const yLabels = yTicks.map((yt, i) => {
    const yy =
      PAD_T + plotH - ((yt - yMin) / (yMax - yMin)) * plotH;
    return (
      <SvgText
        key={`yl-${i}`}
        x={PAD_L - 6}
        y={yy + 4}
        fontSize={10}
        fontWeight="600"
        fill={axisLabelColor}
        textAnchor="end"
      >
        {formatY(yt)}
      </SvgText>
    );
  });

  const xLabs = xLabels.map((lab, i) => (
    <SvgText
      key={`x-${i}-${lab.text}`}
      x={lab.x}
      y={h - 10}
      fontSize={10}
      fontWeight="600"
      fill={axisLabelColor}
      textAnchor="middle"
    >
      {lab.text}
    </SvgText>
  ));

  return (
    <View style={{ width: w, height: h }}>
      <Svg width={w} height={h}>
        <G>{gridLines}</G>
        <G>{yLabels}</G>
        {paths.map((p) =>
          p.d.length > 0 ? (
            <Path
              key={p.code}
              d={p.d}
              stroke={p.color}
              strokeWidth={2.35}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null
        )}
        <G>
          {seriesExtremes.map((ex) => {
            const dx = singleSeries
              ? 0
              : (ex.seriesIndex - (series.length - 1) / 2) * 8;
            if (ex.flat) {
              const cx = xAt(ex.minI) + dx;
              const cy = yAtValue(ex.minV);
              const preferBelow = cy < plotMidY;
              return (
                <G key={`${ex.code}-flat`}>
                  <Circle
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={ex.color}
                    stroke="#fff"
                    strokeWidth={1.2}
                  />
                  <SvgText
                    x={cx}
                    y={preferBelow ? cy + 14 : cy - 10}
                    fontSize={9}
                    fontWeight="600"
                    fill={axisLabelColor}
                    textAnchor="middle"
                  >
                    {singleSeries
                      ? `最低=最高 ${formatY(ex.minV)}`
                      : `${ex.code} 持平 ${formatY(ex.minV)}`}
                  </SvgText>
                  <SvgText
                    x={cx}
                    y={preferBelow ? cy + 26 : cy + 2}
                    fontSize={8}
                    fontWeight="500"
                    fill={axisLabelColor}
                    textAnchor="middle"
                    opacity={0.85}
                  >
                    {shortDateLabel(dates[ex.minI]!)}
                  </SvgText>
                </G>
              );
            }
            const minCx = xAt(ex.minI) + dx;
            const maxCx = xAt(ex.maxI) + dx;
            const minCy = yAtValue(ex.minV);
            const maxCy = yAtValue(ex.maxV);
            const minBelow = minCy < plotMidY;
            const maxBelow = maxCy < plotMidY;
            return (
              <G key={`${ex.code}-ex`}>
                <Circle
                  cx={minCx}
                  cy={minCy}
                  r={4}
                  fill={ex.color}
                  stroke="#fff"
                  strokeWidth={1.2}
                />
                <SvgText
                  x={minCx}
                  y={minBelow ? minCy + 14 : minCy - 18}
                  fontSize={9}
                  fontWeight="600"
                  fill={axisLabelColor}
                  textAnchor="middle"
                >
                  {singleSeries
                    ? `最低 ${formatY(ex.minV)}`
                    : `最低 ${formatY(ex.minV)} · ${ex.code}`}
                </SvgText>
                <SvgText
                  x={minCx}
                  y={minBelow ? minCy + 26 : minCy - 6}
                  fontSize={8}
                  fontWeight="500"
                  fill={axisLabelColor}
                  textAnchor="middle"
                  opacity={0.85}
                >
                  {shortDateLabel(dates[ex.minI]!)}
                </SvgText>
                <Circle
                  cx={maxCx}
                  cy={maxCy}
                  r={4}
                  fill={ex.color}
                  stroke="#fff"
                  strokeWidth={1.2}
                />
                <SvgText
                  x={maxCx}
                  y={maxBelow ? maxCy + 14 : maxCy - 18}
                  fontSize={9}
                  fontWeight="600"
                  fill={axisLabelColor}
                  textAnchor="middle"
                >
                  {singleSeries
                    ? `最高 ${formatY(ex.maxV)}`
                    : `最高 ${formatY(ex.maxV)} · ${ex.code}`}
                </SvgText>
                <SvgText
                  x={maxCx}
                  y={maxBelow ? maxCy + 26 : maxCy - 6}
                  fontSize={8}
                  fontWeight="500"
                  fill={axisLabelColor}
                  textAnchor="middle"
                  opacity={0.85}
                >
                  {shortDateLabel(dates[ex.maxI]!)}
                </SvgText>
              </G>
            );
          })}
        </G>
        <G>{xLabs}</G>
      </Svg>
    </View>
  );
}
