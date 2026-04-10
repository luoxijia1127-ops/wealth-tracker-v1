/**
 * 市场大盘 · 线性世界地图：经纬网 + 陆块轮廓，标注主要指数/品种点位与数值。
 */

import { MARKET_SECTIONS, type MarketQuoteResult } from '@/lib/market-quotes';
import {
  formatMarketPrice,
  formatMarketPct,
  marketPctColor,
} from '@/lib/market-quote-format';
import { memo, useMemo, type ReactElement } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Text as SvgText,
} from 'react-native-svg';

const FLAT_DEFS = MARKET_SECTIONS.flatMap((s) => s.items);

function quoteForPin(
  id: string,
  byId: Map<string, MarketQuoteResult>
): MarketQuoteResult {
  const found = byId.get(id);
  if (found) return found;
  const def = FLAT_DEFS.find((d) => d.id === id);
  return {
    def: def!,
    price: null,
    changePct: null,
    asOfDate: null,
  };
}

/**
 * 等距圆柱投影，坐标系与下方陆块路径一致：宽 360 = 经度 [-180,180]，高 180 = 纬度 [90,-90]
 */
function project360(lon: number, lat: number): { x: number; y: number } {
  return { x: lon + 180, y: 90 - lat };
}

const MAP_PAD = { l: 18, t: 16, r: 18, b: 44 };
const INNER_W = 360;
const INNER_H = 180;
const VB_W = MAP_PAD.l + INNER_W + MAP_PAD.r;
const VB_H = MAP_PAD.t + INNER_H + MAP_PAD.b;

/**
 * 更可辨的陆块线稿（plate carrée 平面内 0..360 × 0..180），多段 M 描边无填充
 */
const WORLD_LAND_D = `
M 34 36 L 48 33 L 68 36 L 86 42 L 96 52 L 98 68 L 92 84 L 80 96 L 62 102 L 46 98 L 34 84 L 28 64 L 30 48 Z
M 22 30 L 34 27 L 40 34 L 32 40 L 24 38 Z
M 88 108 L 100 112 L 106 128 L 104 148 L 96 158 L 88 156 L 84 138 L 86 120 Z
M 108 24 L 122 22 L 128 30 L 120 38 L 112 36 Z
M 142 38 L 168 35 L 188 40 L 198 50 L 194 66 L 178 74 L 156 70 L 140 58 L 136 46 Z
M 174 60 L 192 64 L 202 88 L 198 118 L 188 128 L 176 126 L 168 100 L 170 74 Z
M 198 58 L 232 54 L 262 60 L 274 76 L 268 92 L 242 90 L 214 84 L 200 70 Z
M 254 38 L 298 34 L 318 44 L 324 62 L 312 78 L 278 76 L 258 64 Z
M 268 56 L 302 52 L 312 66 L 298 78 L 276 76 Z
M 288 74 L 316 78 L 322 94 L 308 104 L 292 98 Z
M 314 48 L 330 46 L 334 56 L 322 60 Z
M 298 122 L 334 120 L 342 134 L 332 148 L 308 146 Z
M 176 128 L 188 132 L 192 148 L 184 156 L 174 152 Z
`;

const PINS: {
  id: string;
  label: string;
  lon: number;
  lat: number;
  /** 在 project360 坐标系内的标注偏移 */
  tx: number;
  ty: number;
  anchor: 'start' | 'middle' | 'end';
}[] = [
  // 美东：标注放东北侧，避开西海岸 BTC
  { id: 'ixic', label: '纳指', lon: -74, lat: 40.7, tx: 20, ty: -28, anchor: 'start' },
  // 美西：标注向东伸入太平洋，避免贴左缘被裁切
  { id: 'btc', label: 'BTC', lon: -122.35, lat: 37.75, tx: 34, ty: -22, anchor: 'start' },
  // 日本：标注放在本州西北侧海面
  { id: 'n225', label: '日经', lon: 139.75, lat: 35.7, tx: -52, ty: -36, anchor: 'end' },
  // 华东：偏东南，与日经拉开
  { id: 'sse', label: '上证', lon: 121.5, lat: 31.2, tx: 22, ty: 22, anchor: 'start' },
  // 英国：偏西北
  { id: 'ftse', label: '富时', lon: -0.1, lat: 51.5, tx: -36, ty: -30, anchor: 'end' },
  // 中欧：与富时错开（东南向）
  { id: 'xau', label: '黄金', lon: 8.55, lat: 47.37, tx: 26, ty: 18, anchor: 'start' },
];

type Props = {
  byId: Map<string, MarketQuoteResult>;
  primary: string;
  stroke: string;
  muted: string;
  rise: string;
  fall: string;
  surface: string;
};

export const MarketWorldMapCard = memo(function MarketWorldMapCard({
  byId,
  primary,
  stroke,
  muted,
  rise,
  fall,
  surface,
}: Props) {
  const { width: winW } = useWindowDimensions();
  const cardW = Math.max(280, winW - 28);
  const aspect = VB_H / VB_W;
  const height = Math.round(cardW * aspect);

  const mapTransform = `translate(${MAP_PAD.l},${MAP_PAD.t})`;

  const graticule = useMemo(() => {
    const lines: ReactElement[] = [];
    let key = 0;
    for (let lon = -150; lon <= 150; lon += 30) {
      const x = lon + 180;
      lines.push(
        <Line
          key={`v${key++}`}
          x1={x}
          y1={10}
          x2={x}
          y2={170}
          stroke={stroke}
          strokeWidth={0.35}
          strokeOpacity={0.4}
        />
      );
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = 90 - lat;
      lines.push(
        <Line
          key={`h${key++}`}
          x1={14}
          y1={y}
          x2={346}
          y2={y}
          stroke={stroke}
          strokeWidth={0.35}
          strokeOpacity={0.4}
        />
      );
    }
    return lines;
  }, [stroke]);

  const pinBodies = PINS.map((pin) => {
    const row = quoteForPin(pin.id, byId);
    const p360 = project360(pin.lon, pin.lat);
    const lx = p360.x + pin.tx;
    const ly = p360.y + pin.ty;
    const priceStr = formatMarketPrice(row);
    const pctStr = formatMarketPct(row);
    const pctCol = marketPctColor(row, { muted, rise, fall });
    const lineY2 = ly + 8;
    return {
      pin,
      row,
      p360,
      lx,
      ly,
      lineY2,
      priceStr,
      pctStr,
      pctCol,
    };
  });

  return (
    <View style={{ marginHorizontal: 14, marginBottom: 16 }}>
      <View
        style={{
          borderRadius: 16,
          backgroundColor: surface,
          borderWidth: 1,
          borderColor: 'rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}
      >
        <View style={{ paddingTop: 12, paddingHorizontal: 14, paddingBottom: 6 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: primary }}>
            全球概览
          </Text>
          <Text style={{ fontSize: 11, color: muted, marginTop: 3, lineHeight: 15 }}>
            主要市场指数与黄金、比特币（等距圆柱投影）
          </Text>
        </View>
        <Svg
          width={cardW}
          height={height}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <G transform={mapTransform}>
            <Path
              d={WORLD_LAND_D}
              fill="none"
              stroke={stroke}
              strokeWidth={0.85}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.9}
            />
            {graticule}
            {pinBodies.map(
              ({
                pin,
                p360,
                lx,
                ly,
                lineY2,
                priceStr,
                pctStr,
                pctCol,
              }) => (
                <G key={`${pin.id}-callout`}>
                  <Line
                    x1={p360.x}
                    y1={p360.y}
                    x2={lx}
                    y2={lineY2}
                    stroke={stroke}
                    strokeWidth={0.45}
                    strokeOpacity={0.55}
                  />
                  <SvgText
                    x={lx}
                    y={ly}
                    textAnchor={pin.anchor}
                    fontSize={9.5}
                    fontWeight="700"
                    fill={primary}
                  >
                    {pin.label}
                  </SvgText>
                  <SvgText
                    x={lx}
                    y={ly + 11}
                    textAnchor={pin.anchor}
                    fontSize={8.5}
                    fontWeight="600"
                    fill={primary}
                    opacity={0.92}
                  >
                    {priceStr}
                  </SvgText>
                  <SvgText
                    x={lx}
                    y={ly + 22}
                    textAnchor={pin.anchor}
                    fontSize={8.5}
                    fontWeight="700"
                    fill={pctCol}
                  >
                    {pctStr}
                  </SvgText>
                </G>
              )
            )}
            {pinBodies.map(({ pin, p360 }) => (
              <Circle
                key={`${pin.id}-dot`}
                cx={p360.x}
                cy={p360.y}
                r={3.4}
                fill={surface}
                stroke={primary}
                strokeWidth={1.35}
              />
            ))}
          </G>
        </Svg>
      </View>
    </View>
  );
});
