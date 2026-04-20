/**
 * 数据与导出：
 *   - 完整备份（.zip）——换机恢复的推荐格式，包含资产、每日净值、归档等全量数据。
 *   - 期间 CSV——仅手动流水（现金增减 + 场内买卖），供 Excel 审阅，不用于恢复。
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { getAssets } from '@/lib/asset-storage';
import {
  buildBackupZip,
  collectBackupData,
  defaultBackupFileName,
  writeZipToCache,
} from '@/lib/backup-bundle';
import { rgbaFromHex } from '@/lib/color-utils';
import {
  collectManualTransactions,
  getPresetDateRange,
  manualTransactionsToCsv,
  type DatePresetId,
} from '@/lib/manual-transactions-export';
import type { SimpleAsset } from '@/types/asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
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
  { id: 'm3', label: '近3个月' },
  { id: 'year', label: '本年' },
  { id: 'all', label: '全部' },
];

type ExportMode = 'backup' | 'csv';

function validateYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default function SettingsExportScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppPalette();
  const muted = rgbaFromHex(theme.primary, 0.5);
  const chipBg = rgbaFromHex(theme.primary, 0.1);
  const chipActiveBg = rgbaFromHex(theme.primary, 0.22);

  const [mode, setMode] = useState<ExportMode>('backup');
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<SimpleAsset[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activePreset, setActivePreset] = useState<DatePresetId | null>('d30');
  const [exporting, setExporting] = useState(false);

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

  const onExportBackup = async () => {
    setExporting(true);
    try {
      const payload = await collectBackupData();
      if (payload.assets.length === 0) {
        Alert.alert('无数据', '当前没有任何资产数据可备份。');
        return;
      }
      const bytes = await buildBackupZip(payload);
      const fileName = defaultBackupFileName();

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        try {
          const blob = new Blob([new Uint8Array(bytes)], {
            type: 'application/zip',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
        } catch {
          Alert.alert('导出失败', '浏览器无法生成下载，请重试。');
        }
        return;
      }

      const uri = await writeZipToCache(bytes, fileName);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/zip',
          UTI: 'public.zip-archive',
          dialogTitle: '保存备份文件',
        });
      } else {
        Alert.alert('备份已生成', `文件路径：${uri}`);
      }
    } catch (e) {
      Alert.alert('导出失败', (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const onExportCsv = async () => {
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
    const downloadName = `nest-手动交易-${fileSafe}.csv`;
    /** 原生路径仅用 ASCII，避免部分系统对中文路径支持不佳 */
    const nativeFileName = `nest-manual-${fileSafe}.csv`;

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadName;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        Alert.alert('导出失败', '浏览器无法生成下载，请重试。');
      }
      return;
    }

    const cacheDir = FileSystem.cacheDirectory;
    if (cacheDir) {
      const fileUri = `${cacheDir}${nativeFileName}`;
      try {
        await FileSystem.writeAsStringAsync(fileUri, csv, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            UTI: 'public.comma-separated-values-text',
            dialogTitle: '导出 CSV',
          });
          return;
        }
      } catch {
        /* 回退为纯文本分享 */
      }
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

  const modeTabs: { id: ExportMode; label: string; sub: string }[] = [
    { id: 'backup', label: '完整备份 (.zip)', sub: '换机恢复推荐' },
    { id: 'csv', label: '期间 CSV', sub: '手动流水明细' },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.pageBg }}
      contentContainerStyle={{
        paddingTop: 12,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 20,
      }}
    >
      {loading ? (
        <ActivityIndicator color={theme.primary} style={{ marginVertical: 24 }} />
      ) : (
        <>
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: chipBg,
              borderRadius: 12,
              padding: 4,
              marginBottom: 18,
            }}
          >
            {modeTabs.map((t) => {
              const active = mode === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setMode(t.id)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: active ? theme.surfaceWhite : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '800',
                      color: active ? theme.primary : muted,
                      textAlign: 'center',
                    }}
                  >
                    {t.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: muted,
                      textAlign: 'center',
                      marginTop: 2,
                    }}
                  >
                    {t.sub}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {mode === 'backup' ? (
            <>
              <Text
                style={{ fontSize: 14, fontWeight: '700', color: theme.primary, marginBottom: 10 }}
              >
                完整备份
              </Text>
              <Text style={{ fontSize: 13, color: muted, lineHeight: 20, marginBottom: 12 }}>
                导出一个 .zip 文件，内含 backup.json（换机恢复的唯一数据源）以及三份 CSV（供 Excel 审阅）。
                覆盖范围：
              </Text>
              <View style={{ marginBottom: 12 }}>
                {[
                  '所有资产及其交易流水、现金流水、每日市值历史',
                  '每日总净值快照（含折算人民币）',
                  '每日逐资产市值（最长 730 天，支持重建「资产变动」视图）',
                  '归档与最近删除记录',
                ].map((s) => (
                  <Text
                    key={s}
                    style={{ fontSize: 13, color: theme.primary, lineHeight: 22 }}
                  >
                    · {s}
                  </Text>
                ))}
              </View>
              <Text style={{ fontSize: 12, color: muted, lineHeight: 18, marginBottom: 16 }}>
                备份文件为明文 JSON，未加密。请妥善保管，切勿上传到公开云盘。
              </Text>

              <Pressable
                onPress={() => void onExportBackup()}
                disabled={exporting}
                style={{
                  alignSelf: 'flex-start',
                  paddingHorizontal: 22,
                  paddingVertical: 14,
                  borderRadius: 14,
                  backgroundColor: rgbaFromHex(theme.primary, 0.9),
                  opacity: exporting ? 0.6 : 1,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>
                  {exporting ? '正在生成…' : '导出完整备份 (.zip)'}
                </Text>
              </Pressable>
            </>
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
                onPress={() => void onExportCsv()}
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
                  : '将通过系统分享面板发送 UTF-8 的 .csv 文件；若无法调起文件分享，将回退为纯文本。'}
              </Text>
              <Text style={{ fontSize: 12, color: muted, marginTop: 6, lineHeight: 18 }}>
                注：CSV 仅为明细审阅，不能用于换机恢复。换机恢复请使用「完整备份 (.zip)」。
              </Text>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}
