/**
 * ADD ASSET SCREEN (Card selection UI)
 *
 * The user selects Category and Type by tapping cards (no dropdowns). The selected
 * card is highlighted. Conditional fields: Asset Name always; Shares + Price for
 * ShortTermInvestment/LongTermInvestment; Total Value for Cash. Other category is
 * not mentioned in the latest spec for fields — we show Total Value for Cash only
 * per requirement; for Other we can show Total Value so the form stays usable.
 *
 * Save writes to AsyncStorage under "assets" with structure:
 * { id, name, category, type, shares, price, value }
 *
 * Comments explain each part for beginner developers.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ---- Storage key ----
export const ASSETS_STORAGE_KEY = 'assets';

// ---- Types ----
export type AssetCategory =
  | 'ShortTermInvestment'
  | 'LongTermInvestment'
  | 'Cash'
  | 'Other';

export type AssetType = 'Stock' | 'ETF' | 'Fund' | 'Deposit' | 'Gold';

export type SimpleAsset = {
  id: string;
  name: string;
  category: AssetCategory;
  type: AssetType;
  shares: number;
  price: number;
  value: number;
};

const CATEGORY_OPTIONS: AssetCategory[] = [
  'ShortTermInvestment',
  'LongTermInvestment',
  'Cash',
  'Other',
];

const TYPE_OPTIONS: AssetType[] = ['Stock', 'ETF', 'Fund', 'Deposit', 'Gold'];

/**
 * A single selectable card. When selected, it shows a highlight (border + background).
 * Used for both Category and Type selection.
 */
function SelectableCard({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.optionCard, selected && styles.optionCardSelected]}
    >
      <Text
        style={[
          styles.optionCardText,
          selected && styles.optionCardTextSelected,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function AddAssetScreen() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<AssetCategory>('ShortTermInvestment');
  const [assetType, setAssetType] = useState<AssetType>('Stock');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Investment categories show Shares + Price; Cash shows Total Value. Other: show Total Value.
  const isInvestment =
    category === 'ShortTermInvestment' || category === 'LongTermInvestment';
  const isCash = category === 'Cash';
  const showTotalValue = isCash || category === 'Other';

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter an asset name.');
      return;
    }
    if (isInvestment) {
      const sharesNum = parseFloat(shares);
      const priceNum = parseFloat(price);
      if (isNaN(sharesNum) || sharesNum < 0) {
        Alert.alert('Invalid shares', 'Please enter a valid number of shares.');
        return;
      }
      if (isNaN(priceNum) || priceNum < 0) {
        Alert.alert('Invalid price', 'Please enter a valid price.');
        return;
      }
    }
    if (showTotalValue) {
      const valueNum = parseFloat(totalValue);
      if (isNaN(valueNum) || valueNum < 0) {
        Alert.alert('Invalid value', 'Please enter a valid total value.');
        return;
      }
    }

    setSaving(true);
    try {
      const stored = await AsyncStorage.getItem(ASSETS_STORAGE_KEY);
      const assets: SimpleAsset[] = stored ? JSON.parse(stored) : [];

      const newAsset: SimpleAsset = {
        id: Date.now().toString(),
        name: name.trim(),
        category,
        type: assetType,
        shares: 0,
        price: 0,
        value: 0,
      };

      if (isInvestment) {
        const sharesNum = parseFloat(shares);
        const priceNum = parseFloat(price);
        newAsset.shares = sharesNum;
        newAsset.price = priceNum;
        newAsset.value = sharesNum * priceNum;
      } else {
        newAsset.value = parseFloat(totalValue);
      }

      assets.push(newAsset);
      await AsyncStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(assets));

      setName('');
      setShares('');
      setPrice('');
      setTotalValue('');
      setCategory('ShortTermInvestment');
      setAssetType('Stock');
      router.replace('/(tabs)/portfolio');
    } catch (e) {
      Alert.alert('Error', 'Failed to save asset. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Add Asset</Text>
        <Text style={styles.subtitle}>Select category and type, then fill in details.</Text>

        {/* ---- 1. Category selection: four pressable cards ---- */}
        <Text style={styles.sectionLabel}>Category</Text>
        <View style={styles.optionsRow}>
          {CATEGORY_OPTIONS.map((opt) => (
            <SelectableCard
              key={opt}
              label={opt}
              selected={category === opt}
              onPress={() => setCategory(opt)}
              disabled={saving}
            />
          ))}
        </View>

        {/* ---- 2. Type selection: five pressable cards ---- */}
        <Text style={styles.sectionLabel}>Type</Text>
        <View style={styles.optionsRow}>
          {TYPE_OPTIONS.map((opt) => (
            <SelectableCard
              key={opt}
              label={opt}
              selected={assetType === opt}
              onPress={() => setAssetType(opt)}
              disabled={saving}
            />
          ))}
        </View>

        {/* ---- 3. Fields: Asset Name + conditional Shares/Price or Total Value ---- */}
        <View style={styles.formCard}>
          <Text style={styles.label}>Asset Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Apple, Savings"
            placeholderTextColor="#636366"
            autoCapitalize="words"
            editable={!saving}
          />

          {isInvestment && (
            <>
              <Text style={styles.label}>Shares</Text>
              <TextInput
                style={styles.input}
                value={shares}
                onChangeText={setShares}
                placeholder="e.g. 10"
                placeholderTextColor="#636366"
                keyboardType="decimal-pad"
                editable={!saving}
              />
              <Text style={styles.label}>Price</Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                placeholder="e.g. 150.00"
                placeholderTextColor="#636366"
                keyboardType="decimal-pad"
                editable={!saving}
              />
            </>
          )}

          {showTotalValue && (
            <>
              <Text style={styles.label}>Total Value</Text>
              <TextInput
                style={styles.input}
                value={totalValue}
                onChangeText={setTotalValue}
                placeholder="e.g. 20000"
                placeholderTextColor="#636366"
                keyboardType="decimal-pad"
                editable={!saving}
              />
            </>
          )}
        </View>

        {/* ---- 4. Save button ---- */}
        <Pressable
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * STYLES
 * Simple styling: rounded cards, spacing. Option cards sit in a wrapping row;
 * selected option uses a highlight (border + background). Form and button use
 * rounded corners and consistent padding.
 */
const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: '#0A0A0D',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 15,
    color: '#8E8E93',
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionCard: {
    minWidth: '45%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#1C1C1E',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    borderColor: '#34C759',
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
  },
  optionCardText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  optionCardTextSelected: {
    color: '#FFFFFF',
  },
  formCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#0A0A0D',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  saveButton: {
    backgroundColor: '#34C759',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
