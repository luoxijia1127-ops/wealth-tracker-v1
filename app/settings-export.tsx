/**
 * 数据与导出：
 *   - 完整备份（.zip）——换机恢复的推荐格式，包含资产、每日净值、归档等全量数据。
 *   - 期间 CSV——仅手动流水（现金增减 + 场内买卖），供 Excel 审阅，不用于恢复。
 */

import { SettingsEditorialMasthead } from '@/components/settings-editorial-masthead';
import { SettingsHubBackTopBar } from '@/components/settings-hub-back-navigation';
import { useAppPalette } from '@/contexts/app-palette-context';
import { useLanguage } from '@/contexts/language-context';
import { getAssets } from '@/lib/asset-storage';
import {
  buildBackupZip,
  collectBackupData,
  defaultBackupFileName,
  writeZipToCache,
} from '@/lib/backup-bundle';
import { rgbaFromHex } from '@/lib/color-utils';
import type { TranslationKey } from '@/lib/language';
import {
  collectManualTransactions,
  getPresetDateRange,
  manualTransactionsToCsv,
  type DatePresetId,
} from '@/lib/manual-transactions-export';
import { createSettingsScreenStyles } from '@/lib/settings-screen-styles';
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

const PRESET_IDS: DatePresetId[] = ['d7', 'd30', 'm3', 'year', 'all'];

type ExportMode = 'backup' | 'csv';

function validateYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default function SettingsExportScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppPalette();
  const { locale, t } = useLanguage();
  const hubStyles = useMemo(() => createSettingsScreenStyles(theme), [theme]);
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
  const presets = useMemo(
    () =>
      PRESET_IDS.map((id) => ({
        id,
        label:
          id === 'all'
            ? t('common.all')
            : t(`export.preset.${id}` as TranslationKey),
      })),
    [t]
  );

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
        Alert.alert(t('common.noData'), t('export.noBackupData'));
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
          Alert.alert(t('export.failedTitle'), t('export.webDownloadFailed'));
        }
        return;
      }

      const uri = await writeZipToCache(bytes, fileName);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/zip',
          UTI: 'public.zip-archive',
          dialogTitle: t('export.backup'),
        });
      } else {
        Alert.alert(t('export.backupReady'), t('export.filePath', { uri }));
      }
    } catch (e) {
      Alert.alert(t('export.failedTitle'), (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const onExportCsv = async () => {
    if (!validateYmd(startDate) || !validateYmd(endDate)) {
      Alert.alert(t('export.invalidDateTitle'), t('export.invalidDateMessage'));
      return;
    }
    if (startDate > endDate) {
      Alert.alert(t('export.invalidRangeTitle'), t('export.invalidRangeMessage'));
      return;
    }
    const rows = collectManualTransactions(assets, {
      start: startDate,
      end: endDate,
    });
    if (rows.length === 0) {
      Alert.alert(t('common.noData'), t('export.noCsvData'));
      return;
    }
    const csv = manualTransactionsToCsv(rows, locale);
    const fileSafe = `${startDate}_${endDate}`.replace(/[^\d_-]/g, '');
    const downloadName = `nest-manual-${fileSafe}.csv`;
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
        Alert.alert(t('export.failedTitle'), t('export.webDownloadFailed'));
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
            dialogTitle: t('export.csv'),
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
        title: t('export.shareCsvTitle'),
      });
    } catch {
      Alert.alert(t('export.failedTitle'), t('export.shareFailed'));
    }
  };

  const modeTabs: { id: ExportMode; label: string; sub: string }[] = [
    { id: 'backup', label: t('export.mode.backup'), sub: t('export.mode.backupSub') },
    { id: 'csv', label: t('export.mode.csv'), sub: t('export.mode.csvSub') },
  ];

  return (
    <View style={hubStyles.screen}>
      <View style={hubStyles.screenAmbient} pointerEvents="none" />
      <SettingsHubBackTopBar />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          hubStyles.scrollContent,
          {
            paddingBottom: insets.bottom + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsEditorialMasthead
          styles={hubStyles}
          title="EXPORT"
          kicker="BACKUP & PERIOD CSV"
        />
        <View style={{ paddingHorizontal: 20 }}>
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
                {t('export.backupTitle')}
              </Text>
              <Text style={{ fontSize: 13, color: muted, lineHeight: 20, marginBottom: 12 }}>
                {t('export.backupDescription')}
                {'\n'}
                {t('export.coverage')}
              </Text>
              <View style={{ marginBottom: 12 }}>
                {[
                  t('export.coverage.assets'),
                  t('export.coverage.snapshots'),
                  t('export.coverage.assetDaily'),
                  t('export.coverage.archive'),
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
                {t('export.warningPlain')}
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
                  {exporting ? t('export.generating') : t('export.mode.backup')}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 14, fontWeight: '700', color: theme.primary, marginBottom: 10 }}>
                {t('export.quickRange')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                {presets.map((p) => {
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
                {t('export.customRange')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <TextInput
                  value={startDate}
                  onChangeText={(t) => {
                    setStartDate(t.trim());
                    setActivePreset(null);
                  }}
                  placeholder={t('export.startDate')}
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
                <Text style={{ color: muted, fontWeight: '700' }}>{t('export.to')}</Text>
                <TextInput
                  value={endDate}
                  onChangeText={(t) => {
                    setEndDate(t.trim());
                    setActivePreset(null);
                  }}
                  placeholder={t('export.endDate')}
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
                {t('export.rowCount', { count: rowCount })}
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
                  {t('export.csv')}
                </Text>
              </Pressable>
              <Text style={{ fontSize: 12, color: muted, marginTop: 12, lineHeight: 18 }}>
                {Platform.OS === 'web'
                  ? t('export.csvWebHint')
                  : t('export.csvNativeHint')}
              </Text>
              <Text style={{ fontSize: 12, color: muted, marginTop: 6, lineHeight: 18 }}>
                {t('export.csvNote')}
              </Text>
            </>
          )}
        </>
      )}
        </View>
      </ScrollView>
    </View>
  );
}
