/**
 * 最近删除：从主列表删除的资产快照（含流水），表格展示，可恢复并回补净值相关快照。
 */

import { RecycleRecordsTable } from '@/components/recycle-records-table';
import { SettingsEditorialMasthead } from '@/components/settings-editorial-masthead';
import { SettingsHubBackTopBar } from '@/components/settings-hub-back-navigation';
import { useAppPalette } from '@/contexts/app-palette-context';
import {
  formatRecycleTransactionSummary,
  getTrashRecords,
  restoreFromTrash,
  type AssetRecycleRecord,
} from '@/lib/asset-recycle';
import { rgbaFromHex } from '@/lib/color-utils';
import { createSettingsScreenStyles } from '@/lib/settings-screen-styles';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsTrashScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppPalette();
  const hubStyles = useMemo(() => createSettingsScreenStyles(theme), [theme]);
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
    <View style={hubStyles.screen}>
      <View style={hubStyles.screenAmbient} pointerEvents="none" />
      <SettingsHubBackTopBar />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          hubStyles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsEditorialMasthead
          styles={hubStyles}
          title="TRASH"
          kicker="RECENTLY DELETED ASSETS"
        />
        <View style={{ paddingHorizontal: 16 }}>
      <Text style={{ fontSize: 14, lineHeight: 21, color: muted, marginBottom: 16 }}>
        在总览删除的资产暂存于此。点「恢复」回到主列表。
      </Text>
      {loading ? (
        <ActivityIndicator color={p} style={{ marginTop: 24 }} />
      ) : rows.length === 0 ? (
        <Text style={{ fontSize: 15, color: muted, marginTop: 12 }}>暂无删除记录</Text>
      ) : (
        <RecycleRecordsTable
          variant="restore"
          rows={rows}
          busyId={busyId}
          nameHeader="资产"
          dateHeader="删除日期"
          onRestore={onRestore}
        />
      )}
        </View>
      </ScrollView>
    </View>
  );
}
