/**
 * PORTFOLIO SCREEN
 *
 * This tab shows the user's portfolio (holdings, positions, etc.).
 * It is the second tab in the bottom tab bar, defined in app/(tabs)/_layout.tsx
 * with the route name "portfolio" (from this file name: portfolio.tsx).
 */

import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.title}>Portfolio</Text>
      <Text style={styles.subtitle}>Your holdings will appear here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0F',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 8,
  },
});
