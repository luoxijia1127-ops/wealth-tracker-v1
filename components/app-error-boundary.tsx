/**
 * 应用级错误兜底页面。
 * - 由 expo-router 自动识别 `_layout.tsx` 中导出的 ErrorBoundary；
 * - 发生异常时展示本地化提示和「重试」按钮（调用 retry）；
 * - 不依赖 Provider：Error boundary 渲染时上层 context 可能尚未建立，
 *   文案用系统语言简写回退，避免再次抛异常。
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ErrorBoundaryProps } from 'expo-router';
import { Pressable, SafeAreaView, Text, View } from 'react-native';

type FallbackText = {
  title: string;
  body: string;
  retry: string;
};

/** 浏览器/RN 都可用的轻量 locale 判定，避免触发 expo-localization 等副作用 */
function guessFallbackText(): FallbackText {
  try {
    const g = globalThis as {
      navigator?: { language?: string };
      Intl?: { DateTimeFormat?: () => { resolvedOptions?: () => { locale?: string } } };
    };
    const rn =
      g.navigator?.language ??
      g.Intl?.DateTimeFormat?.().resolvedOptions?.()?.locale;
    const isZh = typeof rn === 'string' && rn.toLowerCase().startsWith('zh');
    if (isZh) {
      return {
        title: '出了点小问题',
        body: '页面遇到了意外错误。你的数据仍保存在本机，可尝试重试。',
        retry: '重试',
      };
    }
  } catch {
    /* noop */
  }
  return {
    title: 'Something went wrong',
    body: 'The screen ran into an unexpected error. Your local data is still intact. Please retry.',
    retry: 'Retry',
  };
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const pageBg = isDark ? '#121212' : '#fafafa';
  const textColor = isDark ? '#f5f5f5' : '#1a1a1a';
  const mutedColor = isDark ? '#a3a3a3' : '#555555';
  const accent = isDark ? '#8ab4f8' : '#0b57d0';

  const fallback = guessFallbackText();
  const detail =
    error instanceof Error
      ? (error.message || error.name || '').slice(0, 200)
      : '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: pageBg }}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: 28,
        }}
      >
        <Text
          style={{
            fontSize: 22,
            fontWeight: '800',
            color: textColor,
            marginBottom: 12,
          }}
        >
          {fallback.title}
        </Text>
        <Text
          style={{
            fontSize: 15,
            lineHeight: 22,
            color: mutedColor,
            marginBottom: 20,
          }}
        >
          {fallback.body}
        </Text>
        {detail ? (
          <Text
            style={{
              fontSize: 12,
              lineHeight: 18,
              color: mutedColor,
              opacity: 0.8,
              marginBottom: 20,
            }}
            numberOfLines={4}
          >
            {detail}
          </Text>
        ) : null}
        <Pressable
          onPress={retry}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            backgroundColor: accent,
            paddingHorizontal: 22,
            paddingVertical: 12,
            borderRadius: 12,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
            {fallback.retry}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
