/**
 * 多币种汇率指数图：平滑贝塞尔曲线，共用同一纵轴（数值需已对齐为同一量纲，如首日=100）。
 */

import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { G, Line, Path, Text as SvgText } from 'react-native-svg';

const PAD_L = 50;
const PAD_R = 10;
const PAD_T = 12;
const PAD_B = 36;
const GRID_SEG = 4;

/** 与 Insights 净值图一致的平滑折线 */
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
  return [`M${xAt(0)},${yAt(0)}`]
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
  /** 与 dates 等长，建议已为「相对窗口首日 = 100」的指数 */
  values: number[];
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
        yMin: 99,
        yMax: 101,
        yTicks: [99, 99.5, 100, 100.5, 101],
        xLabels: [] as { x: number; text: string }[],
        plotW: width - PAD_L - PAD_R,
        plotH: height - PAD_T - PAD_B,
        paths: [] as { code: string; color: string; d: string }[],
      };
    }

    const all: number[] = [];
    for (const s of series) {
      for (let i = 0; i < Math.min(n, s.values.length); i++) {
        const v = s.values[i];
        if (typeof v === 'number' && Number.isFinite(v)) all.push(v);
      }
    }
    let yMin = all.length > 0 ? Math.min(...all) : 99;
    let yMax = all.length > 0 ? Math.max(...all) : 101;
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
      yMin = 99;
      yMax = 101;
    }
    if (yMax - yMin < 1e-6) {
      const c = yMin;
      yMin = c - 0.02;
      yMax = c + 0.02;
    } else {
      const pad = (yMax - yMin) * 0.1;
      yMin -= pad;
      yMax += pad;
    }

    const plotW = width - PAD_L - PAD_R;
    const plotH = height - PAD_T - PAD_B;

    const xAt = (i: number) =>
      n === 1
        ? PAD_L + plotW / 2
        : PAD_L + (i * plotW) / Math.max(1, n - 1);

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
      const d = buildBezierPath(vals, width, height, yMin, yMax);
      return { code: s.code, color: s.color, d };
    });

    return { yMin, yMax, yTicks, xLabels, plotW, plotH, paths };
  }, [dates, series, width, height]);

  if (dates.length === 0 || width <= 20) return null;

  const h = height;
  const w = width;
  const { yMin, yMax, yTicks, xLabels, plotW, plotH, paths } = model;

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
        <G>{xLabs}</G>
      </Svg>
    </View>
  );
}
