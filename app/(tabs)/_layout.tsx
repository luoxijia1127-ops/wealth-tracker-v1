/**
 * TAB LAYOUT — Expo Router
 *
 * Renders a bottom tab bar for Dashboard and Insights.
 * Uses Tabs (not Stack) so users can switch between screens.
 * Uses @expo/vector-icons directly (IconSymbol lacks mappings for our icon names).
 */

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';
import React from 'react';

/** 与 Dashboard sea 雾蓝底一致 */
const DASHBOARD_SCENE_BG = '#B1D4F8';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#5C6390',
        tabBarInactiveTintColor: 'rgba(92, 99, 144, 0.45)',
        tabBarStyle: {
          backgroundColor: 'rgba(255, 255, 255, 0.92)',
          borderTopColor: 'rgba(92, 99, 144, 0.12)',
        },
        /** Critical for Expo Go: default dark theme scene was hiding the periwinkle dashboard. */
        sceneStyle: { backgroundColor: DASHBOARD_SCENE_BG },
        headerShown: false,
      }}>
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
    </Tabs>
  );
}
