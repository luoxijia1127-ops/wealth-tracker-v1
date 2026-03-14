/**
 * DASHBOARD SCREEN - Personal Wealth Tracker
 *
 * Design: modern fintech, minimal, dark theme, card-based UI.
 *
 * Sections:
 * 1. Net Worth card – total value, weekly $ change, and % change
 * 2. Wealth Trend – rectangular card placeholder for a line/area chart
 * 3. Asset Allocation – card placeholder for a pie chart
 * 4. Top Assets – list of holdings with values
 *
 * Tech: React Native (Expo), StyleSheet, rounded cards, spacing between sections.
 *
 * -----------------------------------------------------------------------------
 * STEP-BY-STEP WALKTHROUGH (for beginners)
 * -----------------------------------------------------------------------------
 *
 * 1. IMPORTS
 *    We pull in React Native components (View, Text, ScrollView, etc.) and
 *    the useSafeAreaInsets hook so content doesn't sit under the notch/status bar.
 *
 * 2. HomeScreen (default export)
 *    This is the main component. It returns a ScrollView that wraps all sections.
 *    Inside: one Net Worth card, then section titles + placeholder cards for
 *    Wealth Trend and Asset Allocation, then the Top Assets list. Styles come
 *    from the StyleSheet at the bottom.
 *
 * 3. AssetRow (helper component)
 *    A small component that renders one row: asset name on the left, formatted
 *    currency on the right. We use Intl.NumberFormat to turn a number like 12000
 *    into "$12,000". The isLast prop removes the bottom border on the last row.
 *
 * 4. STYLES (StyleSheet.create)
 *    All visual styling lives here. We define colors, spacing, shadows, and
 *    typography once and reference them in the JSX (e.g. style={styles.card}).
 *    Platform.select lets us use shadow properties on iOS and elevation on Android.
 */

import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  // useSafeAreaInsets() gives us padding values so content doesn't sit under
  // the notch (iPhone) or status bar. We use these for top/bottom padding.
  const insets = useSafeAreaInsets();

  return (
    // ScrollView lets the user scroll when content is taller than the screen.
    // We add padding using insets so content isn't hidden behind system UI.
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: insets.top + 32,
          paddingBottom: insets.bottom + 32,
        },
      ]}
      // Shows a subtle scroll indicator on the right (when scrollable)
      showsVerticalScrollIndicator={false}
    >
      {/* ========== SECTION 1: NET WORTH CARD ========== */}
      {/* This card is the main KPI: total net worth plus weekly change in $ and % */}
      <View style={styles.card}>
        {/* Label above the amount - small, muted, uppercase */}
        <Text style={styles.cardLabel}>Net Worth</Text>
        {/* Main amount - large and prominent so it's the visual focus */}
        <Text style={styles.netWorthAmount}>$248,530</Text>
        {/* Dollar change this week - green for positive gain */}
        <Text style={styles.positiveChange}>+$5,230 this week</Text>
        {/* Percentage change - same green, slightly smaller */}
        <Text style={styles.positiveChangePercent}>+2.3%</Text>
      </View>

      {/* ========== SECTION 2: WEALTH TREND ========== */}
      {/* Rectangular card placeholder for a line/area chart of net worth over time */}
      <Text style={styles.sectionTitle}>Wealth Trend</Text>
      <View style={styles.placeholderBoxRect}>
        <Text style={styles.placeholderText}>Chart placeholder</Text>
        <Text style={styles.placeholderSubtext}>
          Your net worth over time will appear here
        </Text>
      </View>

      {/* ========== SECTION 3: ASSET ALLOCATION ========== */}
      {/* Card placeholder for a pie chart (stocks, bonds, cash, etc.) */}
      <Text style={styles.sectionTitle}>Asset Allocation</Text>
      <View style={styles.placeholderBoxPie}>
        <Text style={styles.placeholderText}>Pie chart placeholder</Text>
        <Text style={styles.placeholderSubtext}>
          Stocks, bonds, cash breakdown will appear here
        </Text>
      </View>

      {/* ========== SECTION 4: TOP ASSETS LIST ========== */}
      {/* Simple list of top holdings with name and value */}
      <Text style={styles.sectionTitle}>Top Assets</Text>
      <View style={styles.listCard}>
        <AssetRow name="Apple" value={12000} isLast={false} />
        <AssetRow name="Tesla" value={8000} isLast={false} />
        <AssetRow name="Cash" value={20000} isLast />
      </View>
    </ScrollView>
  );
}

/**
 * ASSET ROW COMPONENT
 *
 * A reusable row for the Top Assets list. Shows asset name on the left
 * and formatted value on the right. We separate this into its own small
 * component to keep the main screen clean and make it easy to add more rows.
 */
function AssetRow({
  name,
  value,
  isLast = false,
}: {
  name: string;
  value: number;
  isLast?: boolean;
}) {
  // Format number as currency: 12000 -> "$12,000"
  const formattedValue = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

  return (
    <View style={[styles.assetRow, isLast && styles.assetRowLast]}>
      <Text style={styles.assetName}>{name}</Text>
      <Text style={styles.assetValue}>{formattedValue}</Text>
    </View>
  );
}

/**
 * STYLES — Modern fintech dashboard
 *
 * StyleSheet.create() builds a styles object once. Using it is more performant
 * than inline styles and keeps the JSX readable.
 *
 * Design tokens:
 * - Background: clean dark (#0A0A0D) so cards pop without feeling harsh
 * - Cards: elevated surface (#141416) with subtle shadow and thin border
 * - Text: primary white, secondary gray (#8E8E93), accent green (#34C759)
 * - Spacing: generous gaps (32px sections) and padding for a premium feel
 */
const styles = StyleSheet.create({
  // ---- Screen & scroll ----
  // Fills the screen; clean dark background reads as “fintech dark” not pure black
  scrollView: {
    flex: 1,
    backgroundColor: '#0A0A0D',
  },

  // Horizontal padding so content doesn’t touch screen edges; gap adds space between all sections
  scrollContent: {
    paddingHorizontal: 24,
    gap: 32,
  },

  // ---- Net Worth card ----
  // Main hero card: elevated surface, rounded corners, subtle shadow (iOS) / elevation (Android)
  card: {
    backgroundColor: '#141416',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    // iOS: shadowColor + offset + opacity + radius create a soft lift off the background
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },

  // Small uppercase label above the number; muted so the amount is the focus
  cardLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Hero number: large, bold typography so net worth is the main focus of the screen
  netWorthAmount: {
    fontSize: 44,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1,
    lineHeight: 52,
  },

  // Dollar change line; green indicates positive movement
  positiveChange: {
    fontSize: 15,
    color: '#34C759',
    marginTop: 12,
    fontWeight: '600',
  },

  // Percentage change; supports the dollar line without competing with it
  positiveChangePercent: {
    fontSize: 14,
    color: '#34C759',
    marginTop: 2,
    fontWeight: '500',
  },

  // ---- Section titles ----
  // Title above each section (Wealth Trend, Asset Allocation, Top Assets); extra margin for breathing room
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },

  // ---- Chart placeholders ----
  // Rectangular card for Wealth Trend (future line/area chart); same elevation and border as main card
  placeholderBoxRect: {
    backgroundColor: '#141416',
    borderRadius: 20,
    padding: 36,
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },

  // Card for Asset Allocation (future pie chart); slightly taller to suit a circular chart
  placeholderBoxPie: {
    backgroundColor: '#141416',
    borderRadius: 20,
    padding: 36,
    minHeight: 220,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },

  // Placeholder primary text inside chart cards
  placeholderText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },

  // Placeholder secondary text; sits below primary
  placeholderSubtext: {
    fontSize: 13,
    color: '#636366',
    marginTop: 8,
  },

  // ---- Top Assets list card ----
  // Same card treatment as others: surface color, radius, border, shadow
  listCard: {
    backgroundColor: '#141416',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },

  // One row per asset: flexDirection row, space-between for name left / value right
  assetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },

  // Last row has no bottom border so the card doesn’t end with a divider
  assetRowLast: {
    borderBottomWidth: 0,
  },

  // Asset name (e.g. Apple, Tesla); medium weight for hierarchy
  assetName: {
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: '500',
  },

  // Asset value; semibold so numbers are easy to scan
  assetValue: {
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
