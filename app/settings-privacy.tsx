/**
 * 隐私政策：优先应用内 WebView 加载托管页；未配置 URL 时展示本地摘要。
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { getPrivacyPolicyUrl } from '@/lib/privacy-policy-url';
import { rgbaFromHex } from '@/lib/color-utils';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsPrivacyScreen() {
  const insets = useSafeAreaInsets();
  const { theme, appearance } = useAppPalette();
  const secondary = rgbaFromHex(theme.primary, 0.65);
  const muted = rgbaFromHex(theme.primary, 0.5);

  const policyUrl = useMemo(() => getPrivacyPolicyUrl(), []);
  const [loading, setLoading] = useState(!!policyUrl);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const loadingOverlayBg =
    appearance === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.78)';

  if (policyUrl) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.pageBg }]}>
        {loading && !loadError && (
          <View style={[styles.loadingOverlay, { backgroundColor: loadingOverlayBg }]} pointerEvents="none">
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingHint, { color: muted }]}>
              正在加载隐私政策…
            </Text>
          </View>
        )}
        {loadError && (
          <View style={[styles.errorBox, { paddingTop: insets.top + 16 }]}>
            <Text style={{ fontSize: 15, color: theme.primary, fontWeight: '700' }}>
              无法加载页面
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: secondary, marginTop: 8 }}>
              请检查网络后重试。若问题持续，请确认已正确部署隐私政策链接。
            </Text>
            <Pressable
              onPress={() => {
                setLoadError(false);
                setLoading(true);
                setRetryKey((k) => k + 1);
              }}
              style={({ pressed }) => [
                styles.retryBtn,
                {
                  backgroundColor: rgbaFromHex(theme.primary, 0.9),
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <Text style={styles.retryBtnText}>重试</Text>
            </Pressable>
          </View>
        )}
        {!loadError && (
          <WebView
            key={retryKey}
            source={{ uri: policyUrl }}
            style={[styles.webview, { backgroundColor: theme.pageBg }]}
            onLoadStart={() => {
              setLoadError(false);
              setLoading(true);
            }}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setLoadError(true);
            }}
            onHttpError={() => {
              setLoading(false);
              setLoadError(true);
            }}
            originWhitelist={['http://', 'https://']}
            setSupportMultipleWindows={false}
          />
        )}
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.pageBg }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 20,
      }}
    >
      <Text style={{ fontSize: 17, fontWeight: '800', color: theme.primary, marginBottom: 12 }}>
        隐私与数据
      </Text>
      <Text style={{ fontSize: 15, lineHeight: 22, color: secondary }}>
        默认情况下，您的资产与流水数据仅存储于当前设备。同步行情与汇率时会向公开接口请求市场数据，不会上传您的账本内容。请妥善保管设备与系统备份。
      </Text>
      <Text
        style={{
          fontSize: 14,
          lineHeight: 21,
          color: muted,
          marginTop: 20,
        }}
      >
        完整隐私政策：请在构建时设置环境变量 EXPO_PUBLIC_PRIVACY_POLICY_URL
        为你的托管页面地址（https），将在应用内通过 WebView 展示。
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  loadingHint: {
    marginTop: 12,
    fontSize: 14,
  },
  errorBox: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    marginTop: 20,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
