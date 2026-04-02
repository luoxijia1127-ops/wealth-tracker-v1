/**
 * 数据与导出：导出手动增减相关流水（现金余额增减 + 场内买卖），可按期间筛选。
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { getAssets } from '@/lib/asset-storage';
import { rgbaFromHex } from '@/lib/color-utils';
import {
    collectManualTransactions,
    getPresetDateRange,
    manualTransactionsToCsv,
    type DatePresetId,
} from '@/lib/manual-transactions-export';
import type { SimpleAsset } from '@/types/asset';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    Share,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRESETS: { id: DatePresetId; label: string }[] = [
  { id: 'd7', label: '近7天' },
  { id: 'd30', label: '近30天' },
  { id: 'month', label: '本月' },
  { id: 'year', label: '本年' },
  { id: 'all', label: '全部' },
];

function validateYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default function SettingsExportScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppPalette();
  const secondary = rgbaFromHex(theme.primary, 0.65);
  const muted = rgbaFromHex(theme.primary, 0.5);
  const chipBg = rgbaFromHex(theme.primary, 0.1);
  const chipActiveBg = rgbaFromHex(theme.primary, 0.22);

  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<SimpleAsset[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activePreset, setActivePreset] = useState<DatePresetId | null>('d30');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getAssets();
      setAssets(list);
      const r = getPresetDateRange('d30', list);
      setStartDate(r.start);
      setEndDate(r.end);
      setActivePreset('d30');
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const rowCount = useMemo(() => {
    if (!validateYmd(startDate) || !validateYmd(endDate) || startDate > endDate) {
      return 0;
    }
    return collectManualTransactions(assets, { start: startDate, end: endDate }).length;
  }, [assets, startDate, endDate]);

  const placeholderColor = muted;

  const applyPreset = (id: DatePresetId) => {
    const r = getPresetDateRange(id, assets);
    setStartDate(r.start);
    setEndDate(r.end);
    setActivePreset(id);
  };

  const onExport = async () => {
    if (!validateYmd(startDate) || !validateYmd(endDate)) {
      Alert.alert('日期无效', '请使用 YYYY-MM-DD 格式，例如 2026-01-15。');
      return;
    }
    if (startDate > endDate) {
      Alert.alert('期间无效', '开始日期不能晚于结束日期。');
      return;
    }
    const rows = collectManualTransactions(assets, {
      start: startDate,
      end: endDate,
    });
    if (rows.length === 0) {
      Alert.alert('无数据', '所选期间内没有可导出的手动流水。');
      return;
    }
    const csv = manualTransactionsToCsv(rows);
    const fileSafe = `${startDate}_${endDate}`.replace(/[^\d_-]/g, '');
    const filename = `wealth-tracker-手动交易-${fileSafe}.csv`;

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        Alert.alert('导出失败', '浏览器无法生成下载，请重试。');
      }
      return;
    }

    try {
      await Share.share({
        message: csv,
        title: '手动交易明细',
      });
    } catch {
      Alert.alert('导出失败', '无法分享，请重试或检查系统权限。');
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.pageBg }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 20,
      }}
    >
      <Text style={{ fontSize: 17, fontWeight: '800', color: theme.primary, marginBottom: 10 }}>
        数据与存储
      </Text>
      <Text style={{ fontSize: 15, lineHeight: 22, color: secondary, marginBottom: 20 }}>
        资产、流水与快照均保存在本机（AsyncStorage），不会上传至服务器。以下为「手动增减」相关流水导出：现金类
        「加减余额」与场内证券的买卖记录；不含因行情导致的市值变动、也不含每日净值快照本身。
      </Text>

      {loading ? (
        <ActivityIndicator color={theme.primary} style={{ marginVertical: 24 }} />
      ) : (
        <>
          <Text style={{ fontSize: 14, fontWeight: '700', color: theme.primary, marginBottom: 10 }}>
            快捷期间
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {PRESETS.map((p) => {
              const active = activePreset === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => applyPreset(p.id)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: active ? chipActiveBg : chipBg,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: active ? theme.primary : muted,
                    }}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={{ fontSize: 14, fontWeight: '700', color: theme.primary, marginBottom: 8 }}>
            自定义区间（YYYY-MM-DD）
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <TextInput
              value={startDate}
              onChangeText={(t) => {
                setStartDate(t.trim());
                setActivePreset(null);
              }}
              placeholder="开始日期"
              placeholderTextColor={placeholderColor}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: rgbaFromHex(theme.primary, 0.18),
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 15,
                color: theme.primary,
                backgroundColor: rgbaFromHex('#ffffff', 0.85),
              }}
            />
            <Text style={{ color: muted, fontWeight: '700' }}>至</Text>
            <TextInput
              value={endDate}
              onChangeText={(t) => {
                setEndDate(t.trim());
                setActivePreset(null);
              }}
              placeholder="结束日期"
              placeholderTextColor={placeholderColor}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: rgbaFromHex(theme.primary, 0.18),
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 15,
                color: theme.primary,
                backgroundColor: rgbaFromHex('#ffffff', 0.85),
              }}
            />
          </View>
          <Text style={{ fontSize: 12, color: muted, marginBottom: 16 }}>
            当前区间约 {rowCount} 条流水（余额增减与场内买卖合计）
          </Text>

          <Pressable
            onPress={() => void onExport()}
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: 22,
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: rgbaFromHex(theme.primary, 0.9),
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>
              导出 CSV
            </Text>
          </Pressable>
          <Text style={{ fontSize: 12, color: muted, marginTop: 12, lineHeight: 18 }}>
            {Platform.OS === 'web'
              ? '浏览器将下载 UTF-8 CSV 文件，可用 Excel 打开。'
              : '将通过系统分享面板发送文本（CSV）。若内容过长，部分机型可能需改用备忘录或文件 App 保存。'}
          </Text>
        </>
      )}
    </ScrollView>
  );
}
