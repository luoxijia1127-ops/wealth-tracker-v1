/**
 * 玻璃悬浮层：backdrop blur + 半透明描边，参考 Glassmorphism。
 * Web 无模糊时退化为半透明填充。
 */

import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export type GlassSurfaceProps = {
  children: ReactNode;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** iOS/Android 模糊强度，约 20–80 */
  intensity?: number;
  /**
   * 浅色画布用 light（白玻璃）；深色区用 dark（暗玻璃，与 Dashboard 舞台等搭配）。
   * Web 无模糊时仅半透明填充会随 tint 变化。
   */
  tint?: 'light' | 'dark';
};

export function GlassSurface({
  children,
  borderRadius = 28,
  style,
  contentStyle,
  intensity = 48,
  tint = 'light',
}: GlassSurfaceProps) {
  const isWeb = Platform.OS === 'web';
  const isDark = tint === 'dark';

  const overlayTint = isDark ? 'dark' : 'light';
  const borderColor = isDark
    ? 'rgba(255, 255, 255, 0.14)'
    : 'rgba(255, 255, 255, 0.38)';
  const fillWeb = isDark ? 'rgba(28, 32, 42, 0.42)' : 'rgba(255, 255, 255, 0.28)';
  const fillNative = isDark ? 'rgba(22, 26, 34, 0.38)' : 'rgba(255, 255, 255, 0.16)';

  return (
    <View style={[{ borderRadius, overflow: 'hidden' }, style]}>
      {!isWeb ? (
        <BlurView
          intensity={intensity}
          tint={overlayTint}
          style={StyleSheet.absoluteFillObject}
        />
      ) : null}
      <View
        pointerEvents="box-none"
        style={[
          {
            borderRadius,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor,
            backgroundColor: isWeb ? fillWeb : fillNative,
          },
          Platform.select({
            ios: {
              shadowColor: isDark ? '#000000' : '#1a2744',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: isDark ? 0.28 : 0.12,
              shadowRadius: 26,
            },
            android: { elevation: isDark ? 10 : 8 },
            default: {},
          }),
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}
