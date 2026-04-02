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
};

export function GlassSurface({
  children,
  borderRadius = 28,
  style,
  contentStyle,
  intensity = 48,
}: GlassSurfaceProps) {
  const isWeb = Platform.OS === 'web';

  return (
    <View style={[{ borderRadius, overflow: 'hidden' }, style]}>
      {!isWeb ? (
        <BlurView
          intensity={intensity}
          tint="light"
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
            borderColor: 'rgba(255, 255, 255, 0.38)',
            backgroundColor: isWeb
              ? 'rgba(255, 255, 255, 0.28)'
              : 'rgba(255, 255, 255, 0.16)',
          },
          Platform.select({
            ios: {
              shadowColor: '#1a2744',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.12,
              shadowRadius: 26,
            },
            android: { elevation: 8 },
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
