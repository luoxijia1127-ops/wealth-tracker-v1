/**
 * 内联下拉：在触发位置下方展开滚动列表（不用全屏 Modal）。
 */

import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export type InlineSelectOption<T extends string = string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  value: T;
  options: InlineSelectOption<T>[];
  onChange: (value: T) => void;
  /** 互斥展开：当前展开的 key（与 menuKey 相等时展开） */
  menuKey: string;
  openKey: string | null;
  setOpenKey: (k: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  compact?: boolean;
  /** 嵌入输入框右侧：无独立边框，由外层 inputCurrencyShell 包边 */
  embedded?: boolean;
  primaryColor: string;
  mutedColor: string;
  triggerStyle?: StyleProp<ViewStyle>;
};

export function InlineSelect<T extends string>(props: Props<T>) {
  const {
    value,
    options,
    onChange,
    menuKey,
    openKey,
    setOpenKey,
    placeholder = '选择',
    disabled,
    compact,
    embedded,
    primaryColor,
    mutedColor,
    triggerStyle,
  } = props;

  const open = openKey === menuKey;
  const label = useMemo(
    () => options.find((o) => o.value === value)?.label ?? placeholder,
    [options, value, placeholder]
  );

  return (
    <View style={[styles.wrap, embedded && styles.wrapEmbedded]}>
      <Pressable
        disabled={disabled}
        onPress={() => {
          if (disabled) return;
          setOpenKey(open ? null : menuKey);
        }}
        style={[
          styles.trigger,
          compact && styles.triggerCompact,
          embedded && styles.triggerEmbedded,
          !embedded && { borderColor: `${primaryColor}22` },
          triggerStyle,
        ]}
        accessibilityRole="button"
      >
        <Text
          style={[styles.triggerText, embedded && styles.triggerTextEmbedded, { color: primaryColor }]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Ionicons name="chevron-down" size={embedded ? 12 : 14} color={mutedColor} />
      </Pressable>
      {open ? (
        <View
          style={[
            styles.menu,
            {
              borderColor: `${primaryColor}28`,
              backgroundColor: 'rgba(255,255,255,0.98)',
            },
          ]}
        >
          <ScrollView
            style={styles.menuScroll}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {options.map((o) => (
              <Pressable
                key={String(o.value)}
                onPress={() => {
                  onChange(o.value);
                  setOpenKey(null);
                }}
                style={({ pressed }) => [
                  styles.row,
                  o.value === value && { backgroundColor: `${primaryColor}12` },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={[styles.rowText, { color: primaryColor }]} numberOfLines={2}>
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    zIndex: 2,
    alignSelf: 'stretch',
  },
  wrapEmbedded: {
    flex: 1,
    minWidth: 56,
    maxWidth: 92,
    justifyContent: 'center',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 52,
  },
  triggerCompact: {
    paddingVertical: 5,
    paddingHorizontal: 6,
    minWidth: 48,
  },
  triggerEmbedded: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingVertical: 0,
    paddingHorizontal: 6,
    minWidth: 52,
    minHeight: 36,
    flex: 1,
  },
  triggerText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  triggerTextEmbedded: {
    fontSize: 14,
    textAlign: 'right',
  },
  menu: {
    position: 'absolute',
    right: 0,
    top: '100%',
    marginTop: 4,
    maxHeight: 200,
    minWidth: '100%',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    zIndex: 50,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  menuScroll: {
    maxHeight: 200,
  },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  rowText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
