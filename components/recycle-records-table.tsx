/**
 * 已归档 / 最近删除：与资产详情交易表一致的横向表头 + 行。
 * 已归档末列为「已实现盈亏」；最近删除末列为「恢复」。
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import {
  formatRecycleTransactionSummaryShort,
  type ArchivedDisplayRow,
  type AssetRecycleRecord,
} from '@/lib/asset-recycle';
import { createAddModalStyles } from '@/lib/modal-styles';
import {
  formatMoney,
  getAssetCurrency,
  getAssetDisplayValue,
} from '@/lib/asset-value';
import { formatInstantToShanghaiDateString } from '@/lib/date-shanghai';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

/** 上海日历日 YYYY-MM-DD → MM-DD，节省列宽 */
function compactYmd(ymd: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd.slice(5);
  return ymd;
}

type PropsArchived = {
  variant: 'archived';
  rows: ArchivedDisplayRow[];
  nameHeader: string;
  dateHeader: string;
};

type PropsRestore = {
  variant?: 'restore';
  rows: AssetRecycleRecord[];
  busyId: string | null;
  nameHeader: string;
  dateHeader: string;
  onRestore: (rec: AssetRecycleRecord) => void;
};

type Props = PropsArchived | PropsRestore;

export function RecycleRecordsTable(props: Props) {
  const { theme } = useAppPalette();
  const styles = useMemo(() => createAddModalStyles(theme), [theme]);

  if (props.rows.length === 0) {
    return null;
  }

  if (props.variant === 'archived') {
    return (
      <View style={styles.recycleTableOuter}>
        <View style={styles.tradeTableHeader}>
          <View style={styles.recycleNameCol}>
            <Text style={styles.tradeTh} numberOfLines={1}>
              {props.nameHeader}
            </Text>
          </View>
          <View style={styles.recycleYmdCol}>
            <Text style={styles.tradeTh} numberOfLines={1}>
              {props.dateHeader}
            </Text>
          </View>
          <View style={styles.recycleValueCol}>
            <Text style={styles.tradeTh} numberOfLines={1}>
              市值
            </Text>
          </View>
          <View style={styles.recycleLedgerCol}>
            <Text style={styles.tradeTh} numberOfLines={1}>
              流水
            </Text>
          </View>
          <View style={styles.recyclePnlCol}>
            <Text style={styles.tradeTh} numberOfLines={1}>
              已实现盈亏
            </Text>
          </View>
        </View>
        {props.rows.map((row) => {
          const a = row.record.asset;
          const cur = getAssetCurrency(a);
          const val = getAssetDisplayValue(a);
          const ymd = compactYmd(
            formatInstantToShanghaiDateString(new Date(row.record.at))
          );
          const ledgerShort = formatRecycleTransactionSummaryShort(a);
          const pnl = row.realizedPnlCny;
          const pnlText = pnl === null ? '—' : formatMoney(pnl, 'CNY');
          return (
            <View key={row.key} style={styles.tradeTableRow}>
              <View style={styles.recycleNameCol}>
                <Text style={styles.recycleTdName} numberOfLines={2}>
                  {row.nameDisplay}
                </Text>
              </View>
              <View style={styles.recycleYmdCol}>
                <Text style={styles.recycleTdDate}>{ymd}</Text>
              </View>
              <View style={styles.recycleValueCol}>
                <Text
                  style={styles.recycleTdValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {formatMoney(val, cur)}
                </Text>
              </View>
              <View style={styles.recycleLedgerCol}>
                <Text
                  style={[styles.recycleTdDate, { fontSize: 11 }]}
                  numberOfLines={2}
                >
                  {ledgerShort}
                </Text>
              </View>
              <View style={styles.recyclePnlCol}>
                <Text
                  style={[
                    styles.recycleTdPnlArchived,
                    pnl !== null && pnl > 0
                      ? { color: theme.statusPositive }
                      : pnl !== null && pnl < 0
                        ? { color: theme.statusNegative }
                        : null,
                  ]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                >
                  {pnlText}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  const {
    rows,
    busyId,
    nameHeader,
    dateHeader,
    onRestore,
  } = props;

  return (
    <View style={styles.recycleTableOuter}>
      <View style={styles.tradeTableHeader}>
        <View style={styles.recycleNameCol}>
          <Text style={styles.tradeTh} numberOfLines={1}>
            {nameHeader}
          </Text>
        </View>
        <View style={styles.recycleYmdCol}>
          <Text style={styles.tradeTh} numberOfLines={1}>
            {dateHeader}
          </Text>
        </View>
        <View style={styles.recycleValueCol}>
          <Text style={styles.tradeTh} numberOfLines={1}>
            市值
          </Text>
        </View>
        <View style={styles.recycleLedgerCol}>
          <Text style={styles.tradeTh} numberOfLines={1}>
            流水
          </Text>
        </View>
        <View style={styles.recycleRestoreCol}>
          <Text style={styles.tradeTh} numberOfLines={1}>
            恢复
          </Text>
        </View>
      </View>
      {rows.map((rec) => {
        const a = rec.asset;
        const cur = getAssetCurrency(a);
        const val = getAssetDisplayValue(a);
        const ymd = compactYmd(
          formatInstantToShanghaiDateString(new Date(rec.at))
        );
        const ledgerShort = formatRecycleTransactionSummaryShort(a);
        const busy = busyId === rec.recordId;
        return (
          <View key={rec.recordId} style={styles.tradeTableRow}>
            <View style={styles.recycleNameCol}>
              <Text style={styles.recycleTdName} numberOfLines={2}>
                {a.name}
              </Text>
            </View>
            <View style={styles.recycleYmdCol}>
              <Text style={styles.recycleTdDate}>{ymd}</Text>
            </View>
            <View style={styles.recycleValueCol}>
              <Text
                style={styles.recycleTdValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {formatMoney(val, cur)}
              </Text>
            </View>
            <View style={styles.recycleLedgerCol}>
              <Text
                style={[styles.recycleTdDate, { fontSize: 11 }]}
                numberOfLines={2}
              >
                {ledgerShort}
              </Text>
            </View>
            <View style={styles.recycleRestoreCol}>
              <Pressable
                onPress={() => onRestore(rec)}
                disabled={busy}
                hitSlop={6}
                style={({ pressed }) => ({
                  opacity: pressed || busy ? 0.55 : 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                })}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Text style={styles.recycleRestoreBtn}>恢复</Text>
                )}
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}
