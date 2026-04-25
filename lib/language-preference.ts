import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_LANGUAGE_MODE,
  isLanguageMode,
  type LanguageMode,
} from '@/lib/language';

const KEY = '@nest/language-mode';

export async function loadLanguageMode(): Promise<LanguageMode> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw && isLanguageMode(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_LANGUAGE_MODE;
}

export async function saveLanguageMode(mode: LanguageMode): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, mode);
  } catch {
    /* ignore */
  }
}
