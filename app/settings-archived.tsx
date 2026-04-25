/**
 * 已归档：清仓资产快照（含交易/余额流水），表格展示已实现盈亏等。
 */

import { RecycleRecordsTable } from '@/components/recycle-records-table';
import { SettingsEditorialMasthead } from '@/components/settings-editorial-masthead';
import { SettingsHubBackTopBar } from '@/components/settings-hub-back-navigation';
import { useAppPalette } from '@/contexts/app-palette-context';
import { useLanguage } from '@/contexts/language-context';
import {
  buildArchivedDisplayRows,
  getArchivedRecords,
  type ArchivedDisplayRow,
} from '@/lib/asset-recycle';
import { rgbaFromHex } from '@/lib/color-utils';
import { createSettingsScreenStyles } from '@/lib/settings-screen-styles';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsArchivedScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppPalette();
  const { t } = useLanguage();
  const hubStyles = useMemo(() => createSettingsScreenStyles(theme), [theme]);
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
          title="ARCHIVE"
          kicker="CLOSED POSITION SNAPSHOTS"
        />
        <View style={{ paddingHorizontal: 16 }}>
      <Text style={{ fontSize: 14, lineHeight: 21, color: muted, marginBottom: 16 }}>
        {t('archive.description')}
      </Text>
      {loading ? (
        <ActivityIndicator color={p} style={{ marginTop: 24 }} />
      ) : rows.length === 0 ? (
        <Text style={{ fontSize: 15, color: muted, marginTop: 12 }}>{t('archive.empty')}</Text>
      ) : (
        <RecycleRecordsTable
          variant="archived"
          rows={rows}
          nameHeader={t('archive.asset')}
          dateHeader={t('archive.date')}
        />
      )}
        </View>
      </ScrollView>
    </View>
  );
}
