import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@nest/display-currency';

/** ISO 4217，默认 CNY */
export async function loadDisplayCurrency(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw && /^[A-Z]{3}$/.test(raw)) return raw;
  } catch {
    /* ignore */
  }
  return 'CNY';
}

export async function saveDisplayCurrency(code: string): Promise<void> {
  if (!/^[A-Z]{3}$/.test(code)) return;
  try {
    await AsyncStorage.setItem(KEY, code);
  } catch {
    /* ignore */
  }
}
