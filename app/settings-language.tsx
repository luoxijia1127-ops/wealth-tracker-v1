/**
 * 语言设置
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { AppFont } from '@/lib/app-fonts';
import { rgbaFromHex } from '@/lib/color-utils';
import { createSettingsScreenStyles } from '@/lib/settings-screen-styles';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LIST_ROW = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  paddingVertical: 14,
  paddingHorizontal: 24,
  borderBottomWidth: StyleSheet.hairlineWidth,
  borderBottomColor: 'rgba(0,0,0,0.06)',
};

export default function SettingsLanguageScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useAppPalette();
  const styles = useMemo(() => createSettingsScreenStyles(theme), [theme]);
  const p = theme.primary;
  const muted = rgbaFromHex(p, 0.55);

  return (
    <View style={styles.screen}>
      <View style={styles.screenAmbient} pointerEvents="none" />

      <View
        style={{
          paddingTop: insets.top,
          paddingHorizontal: 16,
          paddingBottom: 16,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ width: 44, height: 44, justifyContent: 'center' }}
        >
          <Ionicons name="arrow-back" size={28} color={theme.primary} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: insets.bottom + 28,
            backgroundColor: 'transparent',
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.mastheadBlock, { paddingTop: 16 }]}>
          <Text style={styles.masthead}>LANGUAGE</Text>
          <Text style={styles.kicker}>INTERFACE</Text>
        </View>

        <View style={styles.preferencesBlock}>
          <View style={LIST_ROW}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: AppFont.semiBold,
                  fontSize: 17,
                  letterSpacing: -0.25,
                  color: p,
                }}
              >
                简体中文
              </Text>
              <Text
                style={{
                  fontFamily: AppFont.medium,
                  fontSize: 12,
                  color: muted,
                  marginTop: 4,
                }}
              >
                已启用
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={22} color={p} />
          </View>
          <Text
            style={{
              fontFamily: AppFont.medium,
              fontSize: 13,
              lineHeight: 19,
              color: muted,
              paddingHorizontal: 24,
              paddingTop: 16,
              paddingBottom: 8,
            }}
          >
            当前界面仅提供简体中文。
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
