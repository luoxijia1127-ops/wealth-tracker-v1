/**
 * 最近删除：从主列表删除的资产快照（含流水），表格展示，可恢复并回补净值相关快照。
 */

import { RecycleRecordsTable } from '@/components/recycle-records-table';
import { useAppPalette } from '@/contexts/app-palette-context';
import {
  formatRecycleTransactionSummary,
  getTrashRecords,
  restoreFromTrash,
  type AssetRecycleRecord,
} from '@/lib/asset-recycle';
import { rgbaFromHex } from '@/lib/color-utils';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsTrashScreen() {
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
      setRows(await getTrashRecords());
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
    const detail = formatRecycleTransactionSummary(rec.asset);
    Alert.alert(
      '恢复资产',
      `将「${rec.asset.name}」恢复到主列表；若 id 冲突将分配新编号。\n\n恢复后，自删除日当日起的历史净值快照与逐资产日快照将按快照市值回补（今日会再同步行情）。\n\n${detail}`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '恢复',
          onPress: () => {
            setBusyId(rec.recordId);
            void (async () => {
              try {
                await restoreFromTrash(rec.recordId);
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
        在总览删除的资产暂存于此（最近若干条）。表格与资产交易明细一致横向滑动；点「恢复」回到主列表，并自删除日起回补净值与逐资产日快照，随后同步当日行情。
      </Text>
      {loading ? (
        <ActivityIndicator color={p} style={{ marginTop: 24 }} />
      ) : rows.length === 0 ? (
        <Text style={{ fontSize: 15, color: muted, marginTop: 12 }}>暂无删除记录</Text>
      ) : (
        <RecycleRecordsTable
          rows={rows}
          busyId={busyId}
          nameHeader="资产"
          dateHeader="删除日期"
          onRestore={onRestore}
        />
      )}
    </ScrollView>
  );
}
