/**
 * ADD ASSET MODAL
 *
 * Form to add a new asset. Category and Type are selected via buttons.
 * Type options depend on Category (conditional logic below).
 *
 * SAVE LOGIC: Selected category and type are stored in AsyncStorage as part of
 * the asset object. All assets live under key "assets" as a JSON array.
 *
 * CONDITIONAL TYPE OPTIONS:
 *   ShortTermInvestment | LongTermInvestment → Stock, ETF, Fund
 *   Cash → Deposit
 *   Other → Gold
 *
 * CONDITIONAL INPUT FIELDS:
 *   Investment (Stock/ETF/Fund) → Shares + Price (value computed)
 *   Cash/Other → Total Value
 */

import { addAsset, getAssets, updateAsset } from '@/lib/asset-storage';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { getEditingAssetId, clearEditingAssetId } from '@/lib/edit-asset-store';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  type AssetCategory,
  type AssetType,
  generateAssetId,
  type SimpleAsset,
} from '@/types/asset';

const CATEGORY_OPTIONS: AssetCategory[] = [
  'ShortTermInvestment',
  'LongTermInvestment',
  'Cash',
  'Other',
];

// Type options per category. Keys match AssetCategory.
const TYPE_BY_CATEGORY: Record<AssetCategory, AssetType[]> = {
  ShortTermInvestment: ['Stock', 'ETF', 'Fund'],
  LongTermInvestment: ['Stock', 'ETF', 'Fund'],
  Cash: ['Deposit'],
  Other: ['Gold'],
};

function formatCurrency(v: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(v);
}

export default function AddModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useGlobalSearchParams<{ id?: string }>();
  /** Edit mode: store (primary) or URL params. Store works reliably in Expo Go. */
  const editingId = (getEditingAssetId() ?? params.id) ?? undefined;

  /** Clear store when modal loses focus so next open starts fresh. */
  useFocusEffect(
    useCallback(() => () => clearEditingAssetId(), [])
  );

  const [editingAsset, setEditingAsset] = useState<SimpleAsset | null>(null);
  const [category, setCategory] = useState<AssetCategory>('ShortTermInvestment');
  const [type, setType] = useState<AssetType>('Stock');
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  /** Load and pre-fill asset when editing. */
  useEffect(() => {
    if (!editingId) return;
    let cancelled = false;
    (async () => {
      const assets = await getAssets();
      const asset = assets.find((a) => a.id === editingId);
      if (!cancelled && asset) {
        setEditingAsset(asset);
        setName(asset.name);
        setValue(String(asset.value));
        const cat = asset.category as AssetCategory;
        const validTypes = TYPE_BY_CATEGORY[cat] ?? ['Stock'];
        const validType = validTypes.includes(asset.type as AssetType)
          ? (asset.type as AssetType)
          : validTypes[0];
        setCategory(cat);
        setType(validType);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editingId]);

  /** Edit mode: pre-fill from stored asset. When editing, always use Total Value (we only store value). */
  const isEditMode = !!editingId;
  const isInvestment =
    category === 'ShortTermInvestment' || category === 'LongTermInvestment';
  const showSharesPrice = isInvestment && !isEditMode;
  const showTotalValue = !isInvestment || isEditMode;

  /** When category changes, reset type to first valid option. */
  const handleCategoryChange = useCallback((cat: AssetCategory) => {
    setCategory(cat);
    const types = TYPE_BY_CATEGORY[cat];
    setType(types[0]);
  }, []);

  /** Available types for current category. */
  const typeOptions = useMemo(() => TYPE_BY_CATEGORY[category], [category]);

  const saveAsset = async () => {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter an asset name.');
      return;
    }

    if (showSharesPrice) {
      const sharesNum = parseFloat(shares);
      const priceNum = parseFloat(price);
      if (isNaN(sharesNum) || sharesNum <= 0 || isNaN(priceNum) || priceNum <= 0) {
        Alert.alert('Invalid input', 'Please enter valid Shares and Price.');
        return;
      }
    } else {
      const valueNum = parseFloat(value);
      if (isNaN(valueNum) || valueNum < 0) {
        Alert.alert('Invalid input', 'Please enter a valid Total Value.');
        return;
      }
    }

    setSaving(true);
    try {
      let valueNum = 0;
      if (showSharesPrice) {
        valueNum = parseFloat(shares) * parseFloat(price);
      } else {
        valueNum = parseFloat(value);
      }

      const assetToSave: SimpleAsset = {
        id: isEditMode && (editingAsset?.id ?? editingId) ? (editingAsset?.id ?? editingId!) : generateAssetId(),
        name: name.trim(),
        value: valueNum,
        category,
        type,
      };

      if (isEditMode && assetToSave.id) {
        await updateAsset(assetToSave);
      } else {
        await addAsset(assetToSave);
      }

      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not save asset. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 24,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{isEditMode ? 'Edit Asset' : 'Add Asset'}</Text>

      {/* Category selection — 4 options, highlight selected */}
      <Text style={styles.label}>Category</Text>
      <View style={styles.optionsRow}>
        {CATEGORY_OPTIONS.map((opt) => (
          <Pressable
            key={opt}
            style={[styles.option, category === opt && styles.optionSelected]}
            onPress={() => handleCategoryChange(opt)}
          >
            <Text
              style={[
                styles.optionText,
                category === opt && styles.optionTextSelected,
              ]}
              numberOfLines={1}
            >
              {opt}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Type selection — conditional on category, highlight selected */}
      <Text style={styles.label}>Type</Text>
      <View style={styles.optionsRow}>
        {typeOptions.map((opt) => (
          <Pressable
            key={opt}
            style={[styles.option, type === opt && styles.optionSelected]}
            onPress={() => setType(opt)}
          >
            <Text
              style={[
                styles.optionText,
                type === opt && styles.optionTextSelected,
              ]}
            >
              {opt}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Asset Name</Text>
      <TextInput
        placeholder="e.g. AAPL, Savings Account"
        placeholderTextColor="#6B7280"
        style={styles.input}
        value={name}
        onChangeText={setName}
      />

      {showSharesPrice && (
        <>
          <Text style={styles.label}>Shares</Text>
          <TextInput
            placeholder="Number of shares"
            placeholderTextColor="#6B7280"
            style={styles.input}
            value={shares}
            onChangeText={setShares}
            keyboardType="numeric"
          />
          <Text style={styles.label}>Price per share ($)</Text>
          <TextInput
            placeholder="Price"
            placeholderTextColor="#6B7280"
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
          />
        </>
      )}

      {showTotalValue && (
        <>
          <Text style={styles.label}>
            {isEditMode ? 'Current Value' : 'Total Value ($)'}
          </Text>
          {isEditMode && editingAsset != null && (
            <Text style={styles.previousValue}>
              Previous: {formatCurrency(editingAsset.value)}
            </Text>
          )}
          <TextInput
            placeholder="Amount"
            placeholderTextColor="#6B7280"
            style={[styles.input, isEditMode && styles.valueInputHighlight]}
            value={value}
            onChangeText={setValue}
            keyboardType="numeric"
            autoFocus={isEditMode}
          />
        </>
      )}

      <Pressable
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={saveAsset}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? 'Saving…' : 'Save'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0F',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#E5E7EB',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
    marginTop: 16,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  option: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#15161A',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    backgroundColor: '#1E3A2F',
    borderColor: '#34C759',
  },
  optionText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#34C759',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#15161A',
    color: '#E5E7EB',
    padding: 14,
    borderRadius: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  valueInputHighlight: {
    borderColor: '#34C759',
    borderWidth: 2,
    backgroundColor: 'rgba(52, 199, 89, 0.08)',
  },
  previousValue: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
  },
  saveButton: {
    marginTop: 32,
    backgroundColor: '#34C759',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
