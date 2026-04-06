/**
 * 交易日期：全屏日历选择（与系统滚轮区分，七列网格对齐）
 */

import { rgbaFromHex } from '@/lib/color-utils';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CELL_GAP = 4;
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const;
const MONTH_ZH = [
  '一月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '十一月',
  '十二月',
] as const;

const CAL_COL_BASE: ViewStyle = {
  flex: 1,
  flexBasis: 0,
  minWidth: 0,
};

function calColumnStyle(colPx: number | null): ViewStyle {
  if (colPx != null && colPx > 0) {
    return {
      width: colPx,
      maxWidth: colPx,
      minWidth: 0,
      flexGrow: 0,
      flexShrink: 0,
    };
  }
  return CAL_COL_BASE;
}

/** 保证 7 列 + 6 个间距总宽度不超过容器，避免末列（周六）被挤出可视区 */
function columnWidthPx(containerWidth: number, gap: number): number {
  if (containerWidth <= 0) return 0;
  return Math.floor((containerWidth - 9 * gap) / 7);
}

function monthCells(year: number, month: number): (number | null)[] {
  const first = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0).getDate();
  const startPad = first.getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function chunkCalendarWeeks(cells: (number | null)[]): (number | null)[][] {
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  value: string;
  onSelect: (ymd: string) => void;
  themePrimary: string;
  /** 可选，默认上海「今天」 */
  maxDate?: string;
  /** 可选，默认 1990-01-01 */
  minDate?: string;
};

const DEFAULT_MIN = '1990-01-01';

export function TradingDateCalendarModal({
  visible,
  onClose,
  value,
  onSelect,
  themePrimary,
  maxDate: maxDateProp,
  minDate: minDateProp,
}: Props) {
  const insets = useSafeAreaInsets();
  const maxDate = maxDateProp ?? getShanghaiDateString();
  const minDate = minDateProp ?? DEFAULT_MIN;

  const parsedValue = useMemo(() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!m) return null;
    return {
      y: parseInt(m[1]!, 10),
      mo: parseInt(m[2]!, 10),
      d: parseInt(m[3]!, 10),
    };
  }, [value]);

  const [visibleYear, setVisibleYear] = useState(() => parsedValue?.y ?? new Date().getFullYear());
  const [gridWidth, setGridWidth] = useState(0);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const y = parsedValue?.y ?? new Date().getFullYear();
    setVisibleYear(y);
  }, [visible, parsedValue?.y]);

  useEffect(() => {
    if (!visible) setYearPickerOpen(false);
  }, [visible]);

  const colPx = useMemo(() => {
    if (gridWidth <= 0) return null;
    const w = columnWidthPx(gridWidth, CELL_GAP);
    return w > 0 ? w : null;
  }, [gridWidth]);

  const maxY = useMemo(() => parseInt(maxDate.slice(0, 4), 10), [maxDate]);
  const minY = useMemo(() => parseInt(minDate.slice(0, 4), 10), [minDate]);

  const yearOptions = useMemo(() => {
    const list: number[] = [];
    for (let y = maxY; y >= minY; y--) list.push(y);
    return list;
  }, [maxY, minY]);

  const onDayPress = useCallback(
    (dateStr: string) => {
      if (dateStr < minDate || dateStr > maxDate) return;
      onSelect(dateStr);
      onClose();
    },
    [minDate, maxDate, onSelect, onClose]
  );

  const disabledColor = rgbaFromHex(themePrimary, 0.38);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'fullScreen' : undefined}
      onRequestClose={() => {
        if (yearPickerOpen) setYearPickerOpen(false);
        else onClose();
      }}
    >
      <View style={styles.modalInner}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityLabel="关闭"
            >
              <Ionicons name="close" size={26} color="#111" />
            </Pressable>
          </View>
          <Text style={styles.headerTitle}>交易日期</Text>
          <View style={styles.headerSide}>
            <Pressable
              onPress={() => setYearPickerOpen(true)}
              style={styles.yearPill}
              accessibilityLabel="选择年份"
            >
              <Text style={styles.yearPillText}>{visibleYear}</Text>
            </Pressable>
          </View>
        </View>

        <View
          style={styles.gridMeasure}
          onLayout={(e) => {
            const w = Math.floor(e.nativeEvent.layout.width);
            if (w <= 0) return;
            setGridWidth((prev) => (prev === w ? prev : w));
          }}
        >
          <View style={styles.weekRow}>
            {WEEKDAY_LABELS.map((w, di) => (
              <View
                key={w}
                style={[
                  calColumnStyle(colPx),
                  di > 0 ? { marginLeft: CELL_GAP } : null,
                  styles.weekCell,
                ]}
              >
                <Text
                  style={[styles.weekLabel, { color: rgbaFromHex(themePrimary, 0.45) }]}
                >
                  {w}
                </Text>
              </View>
            ))}
          </View>

          <FlatList
            style={{ flex: 1 }}
            removeClippedSubviews={false}
            data={MONTH_ZH.map((_, i) => i + 1)}
            keyExtractor={(m) => `m-${visibleYear}-${m}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: insets.bottom + 24,
              paddingTop: 4,
            }}
            renderItem={({ item: month }) => (
              <MonthBlock
                year={visibleYear}
                month={month}
                monthLabel={MONTH_ZH[month - 1]}
                colPx={colPx}
                selectedYmd={value}
                minDate={minDate}
                maxDate={maxDate}
                themePrimary={themePrimary}
                disabledColor={disabledColor}
                onDayPress={onDayPress}
              />
            )}
          />
        </View>
      </View>

      {yearPickerOpen ? (
        <View style={styles.yearOverlayWrap} pointerEvents="box-none">
          <Pressable
            style={styles.yearDim}
            onPress={() => setYearPickerOpen(false)}
          />
          <View
            style={[
              styles.yearSheet,
              {
                position: 'absolute',
                left: 16,
                right: 16,
                bottom: insets.bottom + 24,
              },
            ]}
          >
            <Text style={styles.yearSheetTitle}>选择年份</Text>
            <FlatList
              data={yearOptions}
              keyExtractor={(y) => `y-${y}`}
              style={{ maxHeight: 320 }}
              renderItem={({ item: y }) => (
                <Pressable
                  style={styles.yearRow}
                  onPress={() => {
                    setVisibleYear(y);
                    setYearPickerOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.yearRowText,
                      y === visibleYear && { color: themePrimary, fontWeight: '800' },
                    ]}
                  >
                    {y}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      ) : null}
      </View>
    </Modal>
  );
}

function MonthBlock({
  year,
  month,
  monthLabel,
  colPx,
  selectedYmd,
  minDate,
  maxDate,
  themePrimary,
  disabledColor,
  onDayPress,
}: {
  year: number;
  month: number;
  monthLabel: string;
  colPx: number | null;
  selectedYmd: string;
  minDate: string;
  maxDate: string;
  themePrimary: string;
  disabledColor: string;
  onDayPress: (ymd: string) => void;
}) {
  const weeks = useMemo(() => {
    const cells = monthCells(year, month);
    return chunkCalendarWeeks(cells);
  }, [year, month]);

  const DAY_H = 44;

  return (
    <View style={styles.monthBlock}>
      <Text style={styles.monthTitle}>{monthLabel}</Text>
      {weeks.map((week, wi) => (
        <View
          key={`w-${wi}`}
          style={[styles.dayRow, { minHeight: DAY_H }]}
        >
          {week.map((day, di) => {
            if (day === null) {
              return (
                <View
                  key={`pad-${wi}-${di}`}
                  style={[
                    calColumnStyle(colPx),
                    di > 0 ? { marginLeft: CELL_GAP } : null,
                    { height: DAY_H },
                  ]}
                />
              );
            }
            const dateStr = ymd(year, month, day);
            const disabled = dateStr < minDate || dateStr > maxDate;
            const selected = dateStr === selectedYmd;

            return (
              <View
                key={dateStr}
                style={[
                  calColumnStyle(colPx),
                  di > 0 ? { marginLeft: CELL_GAP } : null,
                  styles.dayCellWrap,
                  { height: DAY_H },
                ]}
              >
                <Pressable
                  disabled={disabled}
                  onPress={() => onDayPress(dateStr)}
                  style={({ pressed }) => [
                    styles.dayPress,
                    pressed && !disabled && { opacity: 0.85 },
                  ]}
                  accessibilityLabel={`${dateStr}`}
                >
                  {selected ? (
                    <View
                      style={[
                        styles.selectedCircle,
                        { backgroundColor: themePrimary },
                      ]}
                    >
                      <Text style={styles.selectedDayText}>{day}</Text>
                    </View>
                  ) : (
                    <Text
                      style={[
                        styles.dayText,
                        { color: disabled ? disabledColor : '#111' },
                      ]}
                    >
                      {day}
                    </Text>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  modalInner: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
    minHeight: 48,
  },
  headerSide: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
  },
  yearPill: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  yearPillText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
  },
  gridMeasure: {
    flex: 1,
    paddingHorizontal: 12,
    overflow: 'visible',
  },
  weekRow: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'nowrap',
  },
  weekCell: {
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  monthBlock: {
    marginBottom: 20,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111',
    marginBottom: 8,
  },
  dayRow: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    flexWrap: 'nowrap',
    overflow: 'visible',
  },
  dayCellWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayPress: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: 16,
    fontWeight: '500',
  },
  selectedCircle: {
    minWidth: 28,
    minHeight: 28,
    maxWidth: '100%',
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  selectedDayText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  yearOverlayWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  yearDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  yearSheet: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    maxHeight: '70%',
  },
  yearSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
    color: '#111',
  },
  yearRow: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  yearRowText: {
    fontSize: 17,
    color: '#333',
  },
});
