/**
 * 隐私政策：优先应用内 WebView 加载托管页；未配置 URL 时展示本地摘要。
 */

import { SettingsEditorialMasthead } from '@/components/settings-editorial-masthead';
import { SettingsHubBackTopBar } from '@/components/settings-hub-back-navigation';
import { useAppPalette } from '@/contexts/app-palette-context';
import { useLanguage } from '@/contexts/language-context';
import { getPrivacyPolicyUrlForLocale } from '@/lib/privacy-policy-url';
import { rgbaFromHex } from '@/lib/color-utils';
import { createSettingsScreenStyles } from '@/lib/settings-screen-styles';
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
  const { t, locale } = useLanguage();
  const hubStyles = useMemo(() => createSettingsScreenStyles(theme), [theme]);
  const secondary = rgbaFromHex(theme.primary, 0.65);
  const muted = rgbaFromHex(theme.primary, 0.5);

  const policyUrl = useMemo(() => getPrivacyPolicyUrlForLocale(locale), [locale]);
  const [loading, setLoading] = useState(!!policyUrl);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const loadingOverlayBg =
    appearance === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.78)';

  if (policyUrl) {
    return (
      <View style={[hubStyles.screen, { flex: 1 }]}>
        <View style={hubStyles.screenAmbient} pointerEvents="none" />
        <SettingsHubBackTopBar />
        <SettingsEditorialMasthead
          styles={hubStyles}
          title="PRIVACY"
          kicker="POLICY & HOSTED PAGE"
        />
        <View style={[styles.fill, { backgroundColor: theme.pageBg }]}>
        {loading && !loadError && (
          <View style={[styles.loadingOverlay, { backgroundColor: loadingOverlayBg }]} pointerEvents="none">
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingHint, { color: muted }]}>
              {t('legal.web.loadingPrivacy')}
            </Text>
          </View>
        )}
        {loadError && (
          <View style={[styles.errorBox, { paddingTop: 12 }]}>
            <Text style={{ fontSize: 15, color: theme.primary, fontWeight: '700' }}>
              {t('legal.web.errorTitle')}
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: secondary, marginTop: 8 }}>
              {t('legal.web.errorHintPrivacy')}
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
              <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        )}
        {!loadError && (
          <WebView
            key={`${retryKey}-${locale}-${policyUrl}`}
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
            originWhitelist={['https://']}
            setSupportMultipleWindows={false}
          />
        )}
        </View>
      </View>
    );
  }

  return (
    <View style={hubStyles.screen}>
      <View style={hubStyles.screenAmbient} pointerEvents="none" />
      <SettingsHubBackTopBar />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          hubStyles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsEditorialMasthead
          styles={hubStyles}
          title="PRIVACY"
          kicker="DATA ON YOUR DEVICE"
        />
        <View style={{ paddingHorizontal: 20 }}>
      <Text style={{ fontSize: 17, fontWeight: '800', color: theme.primary, marginBottom: 12 }}>
        {t('legal.privacy.fallbackTitle')}
      </Text>
      <Text style={{ fontSize: 15, lineHeight: 22, color: secondary }}>
        {t('legal.privacy.fallbackBody')}
      </Text>
      <Text
        style={{
          fontSize: 14,
          lineHeight: 21,
          color: muted,
          marginTop: 20,
        }}
      >
        {t('legal.privacy.fallbackHint')}
      </Text>
        </View>
      </ScrollView>
    </View>
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
