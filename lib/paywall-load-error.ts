/**
 * 将 RevenueCat / StoreKit 返回的英文异常文案映射为付费墙友好提示键。
 * @see https://rev.cat/why-are-offerings-empty
 */

import type { TranslationKey } from '@/lib/language';

/** 是否为「Offering / App Store 商品未对齐」类错误（套餐列表为空或加载抛错） */
export function paywallLoadErrorTranslationKey(
  rawMessage: string | undefined
): Extract<TranslationKey, 'paywall.storeProductsUnavailable'> | null {
  if (!rawMessage) return null;
  const m = rawMessage.toLowerCase();

  if (
    m.includes('none of the products registered') ||
    m.includes('could not be fetched from app store') ||
    m.includes('why-are-offerings-empty') ||
    m.includes('there is an issue with your configuration') ||
    m.includes("there's a problem with your configuration") ||
    (m.includes('configuration') && m.includes('rev.cat'))
  ) {
    return 'paywall.storeProductsUnavailable';
  }

  return null;
}
