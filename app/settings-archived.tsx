/**
 * 已归档：清仓资产快照（含交易/余额流水），表格展示已实现盈亏等。
 */

import { RecycleRecordsTable } from '@/components/recycle-records-table';
import { useAppPalette } from '@/contexts/app-palette-context';
import {
  buildArchivedDisplayRows,
  getArchivedRecords,
  type ArchivedDisplayRow,
} from '@/lib/asset-recycle';
import { rgbaFromHex } from '@/lib/color-utils';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsArchivedScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppPalette();
  const p = theme.primary;
  const muted = rgbaFromHex(p, 0.55);
  const [rows, setRows] = useState<ArchivedDisplayRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const recs = await getArchivedRecords();
      setRows(buildArchivedDisplayRows(recs));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

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
        从清仓资产详情中「归档」的记录保存在此。表格与资产交易明细一致可横向滑动。「已实现盈亏」按流水以摊薄成本计算各笔卖出盈亏，人民币汇总；同一资产快照内若多次建仓—清仓，按每次清仓拆成多行。类现金等无场内交易流水时显示「—」。
      </Text>
      {loading ? (
        <ActivityIndicator color={p} style={{ marginTop: 24 }} />
      ) : rows.length === 0 ? (
        <Text style={{ fontSize: 15, color: muted, marginTop: 12 }}>暂无归档</Text>
      ) : (
        <RecycleRecordsTable
          variant="archived"
          rows={rows}
          nameHeader="资产"
          dateHeader="归档日"
        />
      )}
    </ScrollView>
  );
}
