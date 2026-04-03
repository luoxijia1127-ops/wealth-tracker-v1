/**
 * 已归档：清仓资产快照（含交易/余额流水），可恢复到主列表。
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import {
  formatRecycleTransactionSummary,
  getArchivedRecords,
  restoreFromArchived,
  type AssetRecycleRecord,
} from '@/lib/asset-recycle';
import { rgbaFromHex } from '@/lib/color-utils';
import {
  formatMoney,
  getAssetCurrency,
  getAssetDisplayValue,
} from '@/lib/asset-value';
import { useFocusEffect } from '@react-navigation/native';
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

function formatAt(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function SettingsArchivedScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppPalette();
  const p = theme.primary;
  const muted = rgbaFromHex(p, 0.55);
  const [rows, setRows] = useState<AssetRecycleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await getArchivedRecords());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onRestore = (rec: AssetRecycleRecord) => {
    Alert.alert(
      '恢复资产',
      `将「${rec.asset.name}」连同流水恢复到主列表；若同名资产已存在将分配新编号。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '恢复',
          onPress: () => {
            setBusyId(rec.recordId);
            void (async () => {
              try {
                await restoreFromArchived(rec.recordId);
                await load();
              } catch (e) {
                Alert.alert(
                  '失败',
                  e instanceof Error ? e.message : '无法恢复'
                );
              } finally {
                setBusyId(null);
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
        paddingHorizontal: 16,
      }}
    >
      <Text style={{ fontSize: 14, lineHeight: 21, color: muted, marginBottom: 16 }}>
        从清仓资产详情中「归档」的记录保存在此，包含加减仓与现金联动流水；恢复后重新参与净值汇总。
      </Text>
      {loading ? (
        <ActivityIndicator color={p} style={{ marginTop: 24 }} />
      ) : rows.length === 0 ? (
        <Text style={{ fontSize: 15, color: muted, marginTop: 12 }}>暂无归档</Text>
      ) : (
        <View style={{ gap: 12 }}>
          {rows.map((rec) => {
            const a = rec.asset;
            const cur = getAssetCurrency(a);
            const val = getAssetDisplayValue(a);
            const sum = formatRecycleTransactionSummary(a);
            const isBusy = busyId === rec.recordId;
            return (
              <View
                key={rec.recordId}
                style={{
                  borderRadius: 16,
                  padding: 14,
                  backgroundColor: 'rgba(255,255,255,0.92)',
                  borderWidth: 1,
                  borderColor: 'rgba(0,0,0,0.06)',
                }}
              >
                <Text style={{ fontSize: 17, fontWeight: '800', color: p }} numberOfLines={2}>
                  {a.name}
                </Text>
                <Text style={{ fontSize: 12, color: muted, marginTop: 6 }}>
                  归档时间 {formatAt(rec.at)}
                </Text>
                <Text style={{ fontSize: 13, color: rgbaFromHex(p, 0.72), marginTop: 8 }}>
                  {sum}
                </Text>
                <Text style={{ fontSize: 13, color: muted, marginTop: 4 }}>
                  快照市值 {formatMoney(val, cur)}
                </Text>
                <Pressable
                  onPress={() => onRestore(rec)}
                  disabled={isBusy}
                  style={({ pressed }) => ({
                    marginTop: 12,
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor: rgbaFromHex(p, 0.12),
                    alignItems: 'center',
                    opacity: pressed || isBusy ? 0.85 : 1,
                  })}
                >
                  <Text style={{ fontSize: 16, fontWeight: '700', color: p }}>
                    {isBusy ? '恢复中…' : '恢复到主列表'}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
