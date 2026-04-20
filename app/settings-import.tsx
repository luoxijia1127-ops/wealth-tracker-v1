/**
 * 数据与导出：导入备份（换机恢复）。
 * 支持 .zip（推荐）与纯 .json；支持「覆盖恢复」与「合并到当前数据」两种策略。
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { rgbaFromHex } from '@/lib/color-utils';
import {
  applyBackupPayload,
  parseBackupBytes,
  readFileBytes,
  restoreFromRollbackZipFile,
  type ApplyMode,
  type ApplySummary,
  type BackupPayload,
  type BackupPreview,
} from '@/lib/backup-bundle';
import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type PickedFile = {
  name: string;
  uri: string;
  size?: number;
};

export default function SettingsImportScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppPalette();
  const muted = rgbaFromHex(theme.primary, 0.55);
  const chipBg = rgbaFromHex(theme.primary, 0.08);
  const dangerColor = theme.statusNegative;

  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [payload, setPayload] = useState<BackupPayload | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [summary, setSummary] = useState<ApplySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPicked(null);
    setPayload(null);
    setPreview(null);
    setSummary(null);
    setError(null);
  };

  const onPickFile = useCallback(async () => {
    setError(null);
    setSummary(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/zip', 'application/json', 'application/octet-stream', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled) return;
      const f = res.assets?.[0];
      if (!f) return;
      setPicked({ name: f.name, uri: f.uri, size: f.size ?? undefined });
      setParsing(true);
      setPayload(null);
      setPreview(null);
      try {
        const bytes = await readFileBytes(f.uri);
        const parsed = await parseBackupBytes(bytes);
        setPayload(parsed.payload);
        setPreview(parsed.preview);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setParsing(false);
      }
    } catch (e) {
      setError('文件选择失败：' + (e as Error).message);
    }
  }, []);

  const confirmApply = (mode: ApplyMode) => {
    if (!payload) return;
    const title = mode === 'replace' ? '覆盖恢复' : '合并导入';
    const body =
      mode === 'replace'
        ? '这将用备份里的资产、每日净值、归档与最近删除完全替换当前数据。\n\n当前数据会在执行前自动打包保留（可用于回滚），但资产页、洞察页会立刻切换到备份的数据。\n\n确定继续吗？'
        : '合并策略：按 id 合并资产、按日期合并每日净值。同 id 数据以备份里的为准。\n\n确定继续吗？';
    Alert.alert(title, body, [
      { text: '取消', style: 'cancel' },
      {
        text: mode === 'replace' ? '覆盖恢复' : '合并导入',
        style: mode === 'replace' ? 'destructive' : 'default',
        onPress: () => {
          void doApply(mode);
        },
      },
    ]);
  };

  const doApply = async (mode: ApplyMode) => {
    if (!payload) return;
    setApplying(true);
    setError(null);
    try {
      const s = await applyBackupPayload(payload, mode);
      setSummary(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApplying(false);
    }
  };

  const onRollback = () => {
    if (!summary?.rollbackFileUri) return;
    Alert.alert(
      '回滚到导入前',
      '将用本次导入前保存的备份 zip 覆盖当前所有数据。确定继续吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '回滚',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setApplying(true);
              try {
                const s = await restoreFromRollbackZipFile(summary.rollbackFileUri);
                setSummary(s);
                Alert.alert('已回滚', '当前数据已恢复到本次导入前的状态。');
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setApplying(false);
              }
            })();
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.pageBg }}
      contentContainerStyle={{
        paddingTop: 12,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 20,
      }}
    >
      <Text style={{ fontSize: 13, color: muted, lineHeight: 20, marginBottom: 16 }}>
        从上一台设备导出的 .zip 备份中恢复数据。支持「覆盖恢复」（推荐换机场景）与「合并导入」。
        备份为明文 JSON，请妥善保管文件。
      </Text>

      <Pressable
        onPress={() => void onPickFile()}
        disabled={parsing || applying}
        style={{
          alignSelf: 'stretch',
          paddingHorizontal: 18,
          paddingVertical: 16,
          borderRadius: 14,
          backgroundColor: rgbaFromHex(theme.primary, 0.9),
          opacity: parsing || applying ? 0.6 : 1,
          marginBottom: 14,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff', textAlign: 'center' }}>
          {picked ? '重新选择备份文件' : '选择备份文件（.zip 或 .json）'}
        </Text>
      </Pressable>

      {picked && (
        <View
          style={{
            backgroundColor: chipBg,
            borderRadius: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
            marginBottom: 14,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.primary }}>
            {picked.name}
          </Text>
          {typeof picked.size === 'number' && (
            <Text style={{ fontSize: 12, color: muted, marginTop: 2 }}>
              {formatBytes(picked.size)}
            </Text>
          )}
        </View>
      )}

      {parsing && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ActivityIndicator color={theme.primary} />
          <Text style={{ color: muted, fontSize: 13 }}>正在解析备份…</Text>
        </View>
      )}

      {error && (
        <View
          style={{
            backgroundColor: rgbaFromHex(dangerColor, 0.1),
            borderRadius: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: dangerColor }}>
            {error}
          </Text>
        </View>
      )}

      {preview && payload && !summary && (
        <View>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '700',
              color: theme.primary,
              marginBottom: 10,
              marginTop: 6,
            }}
          >
            备份概览
          </Text>
          <PreviewCard preview={preview} theme={theme} muted={muted} chipBg={chipBg} />

          {preview.warnings.length > 0 && (
            <View style={{ marginTop: 8, marginBottom: 4 }}>
              {preview.warnings.map((w, idx) => (
                <Text
                  key={idx}
                  style={{ fontSize: 12, color: dangerColor, lineHeight: 18 }}
                >
                  · {w}
                </Text>
              ))}
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Pressable
              disabled={applying}
              onPress={() => confirmApply('replace')}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: dangerColor,
                opacity: applying ? 0.6 : 1,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff', textAlign: 'center' }}>
                覆盖恢复（推荐）
              </Text>
            </Pressable>
            <Pressable
              disabled={applying}
              onPress={() => confirmApply('merge')}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: theme.primary,
                opacity: applying ? 0.6 : 1,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '800',
                  color: theme.primary,
                  textAlign: 'center',
                }}
              >
                合并导入
              </Text>
            </Pressable>
          </View>

          {applying && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginTop: 12,
              }}
            >
              <ActivityIndicator color={theme.primary} />
              <Text style={{ color: muted, fontSize: 13 }}>正在写入本地数据…</Text>
            </View>
          )}
        </View>
      )}

      {summary && (
        <View style={{ marginTop: 8 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '700',
              color: theme.primary,
              marginBottom: 10,
            }}
          >
            {summary.mode === 'replace' ? '覆盖恢复完成' : '合并导入完成'}
          </Text>
          <SummaryCard
            summary={summary}
            theme={theme}
            muted={muted}
            chipBg={chipBg}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Pressable
              onPress={reset}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: rgbaFromHex(theme.primary, 0.9),
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff', textAlign: 'center' }}>
                再次导入
              </Text>
            </Pressable>
            <Pressable
              onPress={onRollback}
              disabled={applying}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: dangerColor,
                opacity: applying ? 0.6 : 1,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '800',
                  color: dangerColor,
                  textAlign: 'center',
                }}
              >
                回滚到导入前
              </Text>
            </Pressable>
          </View>
          <Text style={{ fontSize: 11, color: muted, marginTop: 8, lineHeight: 16 }}>
            回滚文件保存在应用缓存：{summary.rollbackFileUri}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

type Theme = ReturnType<typeof useAppPalette>['theme'];

function PreviewCard({
  preview,
  theme,
  muted,
  chipBg,
}: {
  preview: BackupPreview;
  theme: Theme;
  muted: string;
  chipBg: string;
}) {
  const rows: { label: string; value: string }[] = [
    { label: '导出时间', value: formatDateTime(preview.exportedAt) },
    { label: 'Schema 版本', value: `v${preview.schemaVersion}` },
    ...(preview.platform ? [{ label: '来源平台', value: preview.platform }] : []),
    ...(preview.appVersion ? [{ label: '来源版本', value: preview.appVersion }] : []),
    { label: '资产数', value: `${preview.counts.assets}` },
    {
      label: '交易 / 现金流水',
      value: `${preview.counts.tradeEntries} / ${preview.counts.cashEntries}`,
    },
    { label: '每日总净值', value: `${preview.counts.snapshots} 天` },
    { label: '每日逐资产', value: `${preview.counts.assetDailySnapshots} 天` },
    {
      label: '归档 / 回收站',
      value: `${preview.counts.archived} / ${preview.counts.trash}`,
    },
    {
      label: '数据日期范围',
      value:
        preview.dateRange.minDate && preview.dateRange.maxDate
          ? `${preview.dateRange.minDate} ~ ${preview.dateRange.maxDate}`
          : '（无日期）',
    },
    {
      label: '完整性校验',
      value:
        preview.integrityOk === true
          ? '通过'
          : preview.integrityOk === false
            ? '未通过（文件可能被修改）'
            : '未提供',
    },
  ];
  return (
    <View
      style={{
        backgroundColor: chipBg,
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 14,
      }}
    >
      {rows.map((r, i) => (
        <View
          key={r.label}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingVertical: 8,
            borderTopWidth: i === 0 ? 0 : 1,
            borderTopColor: rgbaFromHex(theme.primary, 0.08),
          }}
        >
          <Text style={{ fontSize: 13, color: muted }}>{r.label}</Text>
          <Text
            style={{ fontSize: 13, fontWeight: '700', color: theme.primary, maxWidth: '60%' }}
          >
            {r.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function SummaryCard({
  summary,
  theme,
  muted,
  chipBg,
}: {
  summary: ApplySummary;
  theme: Theme;
  muted: string;
  chipBg: string;
}) {
  const rows: { label: string; before: number; after: number }[] = [
    { label: '资产', before: summary.assetsBefore, after: summary.assetsAfter },
    { label: '每日总净值', before: summary.snapshotsBefore, after: summary.snapshotsAfter },
    {
      label: '每日逐资产',
      before: summary.dailyAssetsBefore,
      after: summary.dailyAssetsAfter,
    },
    { label: '归档', before: summary.archivedBefore, after: summary.archivedAfter },
    { label: '回收站', before: summary.trashBefore, after: summary.trashAfter },
  ];
  return (
    <View
      style={{
        backgroundColor: chipBg,
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 14,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          paddingVertical: 6,
          borderBottomWidth: 1,
          borderBottomColor: rgbaFromHex(theme.primary, 0.08),
        }}
      >
        <Text style={{ flex: 1, fontSize: 12, color: muted }}>项目</Text>
        <Text style={{ width: 70, textAlign: 'right', fontSize: 12, color: muted }}>
          之前
        </Text>
        <Text style={{ width: 70, textAlign: 'right', fontSize: 12, color: muted }}>
          之后
        </Text>
      </View>
      {rows.map((r) => (
        <View
          key={r.label}
          style={{ flexDirection: 'row', paddingVertical: 8 }}
        >
          <Text style={{ flex: 1, fontSize: 13, color: theme.primary }}>{r.label}</Text>
          <Text
            style={{
              width: 70,
              textAlign: 'right',
              fontSize: 13,
              color: muted,
            }}
          >
            {r.before}
          </Text>
          <Text
            style={{
              width: 70,
              textAlign: 'right',
              fontSize: 13,
              fontWeight: '700',
              color: theme.primary,
            }}
          >
            {r.after}
          </Text>
        </View>
      ))}
    </View>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (x: number) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}
