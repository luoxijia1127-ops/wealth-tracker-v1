/**
 * TAB LAYOUT — Expo Router
 *
 * Renders a bottom tab bar for 总览 / 洞察 / 更多。
 * Uses Tabs (not Stack) so users can switch between screens.
 * Uses @expo/vector-icons directly (IconSymbol lacks mappings for our icon names).
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { AppFont } from '@/lib/app-fonts';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';
import React, { useMemo } from 'react';

export default function TabLayout() {
  const { theme } = useAppPalette();

  const screenOptions = useMemo(
    () => ({
      tabBarActiveTintColor: theme.tabActive,
      tabBarInactiveTintColor: theme.tabInactive,
      tabBarStyle: {
        backgroundColor: theme.tabBarBg,
        borderTopColor: theme.tabBarBorder,
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
          title: '总览',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="pie-chart" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: '洞察',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="lightbulb-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '更多',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="widgets" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
