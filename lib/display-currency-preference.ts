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
    notifyDisplayCurrency(code);
  } catch {
    /* ignore */
  }
}

const displayCurrencyListeners = new Set<(code: string) => void>();

/** 订阅展示币种变更；回调收到的是写入后的最新值。返回取消订阅函数。 */
export function subscribeDisplayCurrency(
  listener: (code: string) => void
): () => void {
  displayCurrencyListeners.add(listener);
  return () => {
    displayCurrencyListeners.delete(listener);
  };
}

function notifyDisplayCurrency(code: string): void {
  displayCurrencyListeners.forEach((cb) => {
    try {
      cb(code);
    } catch {
      /* listener 异常不影响其它订阅者 */
    }
  });
}
