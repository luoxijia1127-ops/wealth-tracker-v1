/**
 * TAB LAYOUT — Expo Router
 *
 * Renders a bottom tab bar for Dashboard and Insights.
 * Uses Tabs (not Stack) so users can switch between screens.
 * Uses @expo/vector-icons directly (IconSymbol lacks mappings for our icon names).
 */

import { useAppPalette } from '@/contexts/app-palette-context';
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
          title: 'Dashboard',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="pie-chart" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="lightbulb-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '设置',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="palette" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
