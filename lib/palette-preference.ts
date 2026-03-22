import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_PALETTE_ID,
  type AppPaletteId,
  isPaletteId,
} from '@/lib/app-palette';

const KEY = '@wealth-tracker/palette-id';

export async function loadPaletteId(): Promise<AppPaletteId> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw && isPaletteId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_PALETTE_ID;
}

export async function savePaletteId(id: AppPaletteId): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}
