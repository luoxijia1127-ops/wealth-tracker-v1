import AsyncStorage from '@react-native-async-storage/async-storage';
import { isValidAssetCurrency } from '@/lib/asset-currency';

const KEY = '@assetup/display-currency';

/** ISO 4217，默认 CNY；仅接受当前 App 支持的展示币种 */
export async function loadDisplayCurrency(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw && isValidAssetCurrency(raw)) return raw;
    if (raw && /^[A-Z]{3}$/.test(raw) && !isValidAssetCurrency(raw)) {
      try {
        await AsyncStorage.setItem(KEY, 'CNY');
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  return 'CNY';
}

export async function saveDisplayCurrency(code: string): Promise<void> {
  if (!isValidAssetCurrency(code)) return;
  try {
    await AsyncStorage.setItem(KEY, code);
  } catch {
    /* ignore */
  }
}
