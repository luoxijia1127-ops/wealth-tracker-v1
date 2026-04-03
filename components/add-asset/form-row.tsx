/**
 * 与「增加资产」表单一致的左侧图标 + 右侧标签/内容行。
 */

import { Ionicons } from '@expo/vector-icons';
import type { AddModalStyles } from '@/lib/modal-styles';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

export function FormRow({
  icon,
  label,
  children,
  right,
  styles,
  iconMuted,
  first,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label?: string;
  children: ReactNode;
  right?: ReactNode;
  styles: AddModalStyles;
  iconMuted: string;
  /** 卡片内第一行，顶距为 0 */
  first?: boolean;
}) {
  return (
    <View style={[styles.formRow, first ? styles.formRowFirst : undefined]}>
      <View style={styles.formRowIconColumn}>
        {label ? <View style={styles.formRowIconLabelSpacer} /> : null}
        <View style={styles.formRowIconWrap}>
          <Ionicons name={icon} size={18} color={iconMuted} />
        </View>
      </View>
      <View style={styles.formRowBody}>
        {label ? (
          <Text style={styles.formRowLabel}>{label}</Text>
        ) : null}
        <View style={styles.formRowChildren}>
          {right ? (
            <View style={styles.formRowContentRow}>
              <View style={styles.formRowContentMain}>{children}</View>
              <View style={styles.formRowRight}>{right}</View>
            </View>
          ) : (
            children
          )}
        </View>
      </View>
    </View>
  );
}
