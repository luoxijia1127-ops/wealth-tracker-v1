/**
 * 已归档：清仓资产快照（含交易/余额流水），表格展示，可恢复至主列表并回补净值相关快照。
 */

import { RecycleRecordsTable } from '@/components/recycle-records-table';
import { useAppPalette } from '@/contexts/app-palette-context';
import {
  formatRecycleTransactionSummary,
  getArchivedRecords,
  restoreFromArchived,
  type AssetRecycleRecord,
} from '@/lib/asset-recycle';
import { rgbaFromHex } from '@/lib/color-utils';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
    const detail = formatRecycleTransactionSummary(rec.asset);
    Alert.alert(
      '恢复资产',
      `将「${rec.asset.name}」连同流水恢复到主列表；若同名资产已存在将分配新编号。\n\n恢复后，自归档日当日起的历史净值快照与逐资产日快照将按快照市值回补（今日会再同步行情）；详情见说明。\n\n${detail}`,
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
        从清仓资产详情中「归档」的记录保存在此。表格与资产交易明细一致横向滑动；点「恢复」将回到主列表，并自归档日起回补净值与逐资产日快照（沿用快照内市值与当前缓存汇率折人民币），随后同步当日行情。
      </Text>
      {loading ? (
        <ActivityIndicator color={p} style={{ marginTop: 24 }} />
      ) : rows.length === 0 ? (
        <Text style={{ fontSize: 15, color: muted, marginTop: 12 }}>暂无归档</Text>
      ) : (
        <RecycleRecordsTable
          rows={rows}
          busyId={busyId}
          nameHeader="资产"
          dateHeader="归档日"
          onRestore={onRestore}
        />
      )}
    </ScrollView>
  );
}
