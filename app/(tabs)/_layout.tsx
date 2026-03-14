/**
 * TAB LAYOUT - Expo Router
 *
 * This file defines the bottom tab bar and which screens belong to each tab.
 * In Expo Router, each .tsx file in the (tabs) folder becomes a route; the
 * _layout.tsx file wraps those routes in a tab navigator.
 *
 * How it works:
 * 1. (tabs) is a "route group" (parentheses = no segment in the URL).
 * 2. Files here: index.tsx, portfolio.tsx, add-asset.tsx → routes "", "portfolio", "add-asset".
 * 3. <Tabs> from expo-router renders a tab bar; each <Tabs.Screen> ties a
 *    route (name) to a tab label and icon.
 * 4. The order of <Tabs.Screen> components sets the left-to-right order of tabs.
 */

import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  // useColorScheme() returns 'light' | 'dark' based on the user's system setting.
  // We use it to tint the tab bar so it matches the app theme.
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        // Color of the selected tab's label and icon
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        // Hide the default header; each screen can show its own header if needed
        headerShown: false,
        // HapticTab gives a subtle vibration when a tab is pressed (better UX on mobile)
        tabBarButton: HapticTab,
      }}>
      {/* Dashboard tab: shows the main wealth overview (index.tsx is the default/first route) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} />,
        }}
      />
      {/* Portfolio tab: lists or details of holdings (portfolio.tsx) */}
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'Portfolio',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="briefcase.fill" color={color} />,
        }}
      />
      {/* Add Asset tab: form or flow to add a new asset (add-asset.tsx) */}
      <Tabs.Screen
        name="add-asset"
        options={{
          title: 'Add Asset',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="plus.circle.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
