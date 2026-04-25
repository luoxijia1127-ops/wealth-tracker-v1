/**
 * TAB LAYOUT — Expo Router
 *
 * Renders a bottom tab bar for 总览 / 洞察 / 更多。
 * Uses Tabs (not Stack) so users can switch between screens.
 * Uses @expo/vector-icons directly (IconSymbol lacks mappings for our icon names).
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { useLanguage } from '@/contexts/language-context';
import { AppFont } from '@/lib/app-fonts';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';
import React, { useMemo } from 'react';

export default function TabLayout() {
  const { theme } = useAppPalette();
  const { t } = useLanguage();

  const screenOptions = useMemo(
    () => ({
      tabBarActiveTintColor: theme.tabActive,
      tabBarInactiveTintColor: theme.tabInactive,
      tabBarStyle: {
        backgroundColor: theme.tabBarBg,
        borderTopWidth: 0,
        elevation: 0,
        shadowColor: '#1e1b4b',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
      },
      tabBarLabelStyle: {
        fontFamily: AppFont.semiBold,
        fontSize: 11,
      },
      sceneStyle: { backgroundColor: theme.pageBg },
      headerShown: false as const,
    }),
    [theme]
  );

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.dashboard'),
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="pie-chart" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: t('tabs.insights'),
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="lightbulb-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.more'),
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="widgets" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
