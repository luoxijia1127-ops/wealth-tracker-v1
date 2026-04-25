/**
 * 最近删除：从主列表删除的资产快照（含流水），表格展示，可恢复并回补净值相关快照。
 */

import { RecycleRecordsTable } from '@/components/recycle-records-table';
import { SettingsEditorialMasthead } from '@/components/settings-editorial-masthead';
import { SettingsHubBackTopBar } from '@/components/settings-hub-back-navigation';
import { useAppPalette } from '@/contexts/app-palette-context';
import { useLanguage } from '@/contexts/language-context';
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
  const { t } = useLanguage();
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
      t('trash.restoreTitle'),
      t('trash.restoreMessage', { name: rec.asset.name, detail }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('trash.restore'),
          onPress: () => {
            setBusyId(rec.recordId);
            void (async () => {
              try {
                await restoreFromTrash(rec.recordId);
                await load();
              } catch (e) {
                Alert.alert(
                  t('common.failed'),
                  e instanceof Error ? e.message : t('trash.restoreFailed')
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
        {t('trash.description')}
      </Text>
      {loading ? (
        <ActivityIndicator color={p} style={{ marginTop: 24 }} />
      ) : rows.length === 0 ? (
        <Text style={{ fontSize: 15, color: muted, marginTop: 12 }}>{t('trash.empty')}</Text>
      ) : (
        <RecycleRecordsTable
          variant="restore"
          rows={rows}
          busyId={busyId}
          nameHeader={t('trash.asset')}
          dateHeader={t('trash.date')}
          onRestore={onRestore}
        />
      )}
        </View>
      </ScrollView>
    </View>
  );
}
