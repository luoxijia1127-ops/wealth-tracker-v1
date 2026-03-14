/**
 * ADD ASSET SCREEN
 *
 * This screen lets the user add a new asset (stock, fund, or cash) to their
 * wealth tracker. On "Save Asset", we store the asset in AsyncStorage as part
 * of an array. Each asset has: id, name, type, shares, price.
 *
 * Flow:
 * 1. User fills in the form (name, type, shares, price).
 * 2. User taps "Save Asset".
 * 3. We read the existing assets array from AsyncStorage (or start with []).
 * 4. We append the new asset (with a unique id) and write the array back.
 *
 * Comments below explain each part for beginner developers.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Key used to read/write the assets array in AsyncStorage. Same key must be used
// everywhere we read or update the list (e.g. on the Dashboard when we load data).
const ASSETS_STORAGE_KEY = 'wealth_tracker_assets';

// TypeScript type for one asset. Ensures we always have id, name, type, shares, price.
export type AssetType = 'Stock' | 'Fund' | 'Cash';

export type Asset = {
  id: string;
  name: string;
  type: AssetType;
  shares: number;
  price: number;
};

// Options shown in the Asset Type dropdown
const ASSET_TYPE_OPTIONS: AssetType[] = ['Stock', 'Fund', 'Cash'];

export default function AddAssetScreen() {
  const insets = useSafeAreaInsets();

  // ---- Form state ----
  // useState gives each field its own value and setter. When the user types or
  // selects an option, we update state and the UI re-renders with the new values.
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('Stock');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');

  // Controls whether the Asset Type dropdown modal is visible
  const [showTypePicker, setShowTypePicker] = useState(false);

  // True while we're saving (so we can show a spinner and disable the button)
  const [saving, setSaving] = useState(false);

  /**
   * Called when the user taps "Save Asset".
   * 1. Build the new asset with a unique id (Date.now() is fine for this app).
   * 2. Load existing assets from AsyncStorage.
   * 3. Append the new asset and save the array back.
   */
  async function handleSave() {
    // Basic validation: require name and numeric shares/price
    const sharesNum = parseFloat(shares);
    const priceNum = parseFloat(price);
    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter an asset name.');
      return;
    }
    if (isNaN(sharesNum) || sharesNum < 0) {
      Alert.alert('Invalid shares', 'Please enter a valid number of shares.');
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      Alert.alert('Invalid price', 'Please enter a valid price.');
      return;
    }

    setSaving(true);
    try {
      // 1. Read current array from AsyncStorage. getItem returns null if the key
      //    has never been set, so we default to an empty array.
      const stored = await AsyncStorage.getItem(ASSETS_STORAGE_KEY);
      const assets: Asset[] = stored ? JSON.parse(stored) : [];

      // 2. Create the new asset. id must be unique so we can update/delete later.
      const newAsset: Asset = {
        id: Date.now().toString(),
        name: name.trim(),
        type: assetType,
        shares: sharesNum,
        price: priceNum,
      };

      // 3. Add to array and save back as a JSON string
      assets.push(newAsset);
      await AsyncStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(assets));

      // 4. Clear form and show success (you could also navigate to Dashboard)
      setName('');
      setShares('');
      setPrice('');
      setAssetType('Stock');
      Alert.alert('Saved', 'Asset saved successfully.');
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
        <Text style={styles.subtitle}>Enter the details of your asset below.</Text>

        {/* Form card: wraps all inputs in one visual block */}
        <View style={styles.card}>
          {/* ---- Asset Name ---- */}
          <Text style={styles.label}>Asset Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Apple, Savings Account"
            placeholderTextColor="#636366"
            autoCapitalize="words"
            editable={!saving}
          />

          {/* ---- Asset Type (dropdown) ---- */}
          <Text style={styles.label}>Asset Type</Text>
          <Pressable
            style={styles.dropdown}
            onPress={() => !saving && setShowTypePicker(true)}
            disabled={saving}
          >
            <Text style={styles.dropdownText}>{assetType}</Text>
            <Text style={styles.dropdownArrow}>▼</Text>
          </Pressable>

          {/* Modal acts as the dropdown: when showTypePicker is true, user picks Stock, Fund, or Cash */}
          <Modal
            visible={showTypePicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowTypePicker(false)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setShowTypePicker(false)}
            >
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Asset Type</Text>
                {ASSET_TYPE_OPTIONS.map((option) => (
                  <Pressable
                    key={option}
                    style={[
                      styles.modalOption,
                      assetType === option && styles.modalOptionSelected,
                    ]}
                    onPress={() => {
                      setAssetType(option);
                      setShowTypePicker(false);
                    }}
                  >
                    <Text style={styles.modalOptionText}>{option}</Text>
                  </Pressable>
                ))}
              </View>
            </Pressable>
          </Modal>

          {/* ---- Shares ---- */}
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

          {/* ---- Price ---- */}
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
        </View>

        {/* Save button. When saving, show a spinner and disable tap. */}
        <Pressable
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#0A0A0D" />
          ) : (
            <Text style={styles.saveButtonText}>Save Asset</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * STYLES
 *
 * Matches the dashboard: dark background (#0A0A0D), card surface (#141416),
 * white/gray text, green accent. Labels and inputs are styled for readability.
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
    paddingHorizontal: 24,
    gap: 20,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 4,
  },

  card: {
    backgroundColor: '#141416',
    borderRadius: 20,
    padding: 24,
    gap: 20,
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

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  input: {
    backgroundColor: '#0A0A0D',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },

  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0A0A0D',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },

  dropdownText: {
    fontSize: 17,
    color: '#FFFFFF',
  },

  dropdownArrow: {
    fontSize: 12,
    color: '#8E8E93',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  modalContent: {
    backgroundColor: '#141416',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    gap: 8,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },

  modalOption: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
  },

  modalOptionSelected: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
  },

  modalOptionText: {
    fontSize: 17,
    color: '#FFFFFF',
  },

  saveButton: {
    backgroundColor: '#34C759',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },

  saveButtonDisabled: {
    opacity: 0.7,
  },

  saveButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A0A0D',
  },
});
