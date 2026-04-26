/**
 * 用户协议：可选 WebView 加载托管页；未配置 URL 时展示本地正文。
 */

import { SettingsEditorialMasthead } from '@/components/settings-editorial-masthead';
import { SettingsHubBackTopBar } from '@/components/settings-hub-back-navigation';
import { useAppPalette } from '@/contexts/app-palette-context';
import { useLanguage } from '@/contexts/language-context';
import { rgbaFromHex } from '@/lib/color-utils';
import type { TranslationKey } from '@/lib/language';
import { createSettingsScreenStyles } from '@/lib/settings-screen-styles';
import { getTermsOfServiceUrlForLocale } from '@/lib/terms-of-service-url';
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

const TERMS_SECTION_KEYS: { title: TranslationKey; body: TranslationKey }[] = [
  { title: 'legal.terms.s1Title', body: 'legal.terms.s1Body' },
  { title: 'legal.terms.s2Title', body: 'legal.terms.s2Body' },
  { title: 'legal.terms.s3Title', body: 'legal.terms.s3Body' },
  { title: 'legal.terms.s4Title', body: 'legal.terms.s4Body' },
  { title: 'legal.terms.s5Title', body: 'legal.terms.s5Body' },
  { title: 'legal.terms.s6Title', body: 'legal.terms.s6Body' },
  { title: 'legal.terms.s7Title', body: 'legal.terms.s7Body' },
  { title: 'legal.terms.s8Title', body: 'legal.terms.s8Body' },
  { title: 'legal.terms.s9Title', body: 'legal.terms.s9Body' },
  { title: 'legal.terms.s10Title', body: 'legal.terms.s10Body' },
  { title: 'legal.terms.s11Title', body: 'legal.terms.s11Body' },
  { title: 'legal.terms.s12Title', body: 'legal.terms.s12Body' },
];

function Section({
  title,
  children,
  themePrimary,
  secondary,
}: {
  title: string;
  children: string;
  themePrimary: string;
  secondary: string;
}) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text
        style={{
          fontSize: 16,
          fontWeight: '800',
          color: themePrimary,
          marginBottom: 8,
        }}
      >
        {title}
      </Text>
      <Text style={{ fontSize: 15, lineHeight: 24, color: secondary }}>{children}</Text>
    </View>
  );
}

export default function SettingsTermsScreen() {
  const insets = useSafeAreaInsets();
  const { theme, appearance } = useAppPalette();
  const { t, locale } = useLanguage();
  const hubStyles = useMemo(() => createSettingsScreenStyles(theme), [theme]);
  const secondary = rgbaFromHex(theme.primary, 0.68);
  const muted = rgbaFromHex(theme.primary, 0.52);

  const termsUrl = useMemo(() => getTermsOfServiceUrlForLocale(locale), [locale]);
  const [loading, setLoading] = useState(!!termsUrl);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const loadingOverlayBg =
    appearance === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.78)';

  if (termsUrl) {
    return (
      <View style={[hubStyles.screen, { flex: 1 }]}>
        <View style={hubStyles.screenAmbient} pointerEvents="none" />
        <SettingsHubBackTopBar />
        <SettingsEditorialMasthead
          styles={hubStyles}
          title="TERMS"
          kicker="USER AGREEMENT"
        />
        <View style={[styles.fill, { backgroundColor: theme.pageBg }]}>
        {loading && !loadError && (
          <View style={[styles.loadingOverlay, { backgroundColor: loadingOverlayBg }]} pointerEvents="none">
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingHint, { color: muted }]}>
              {t('legal.web.loadingTerms')}
            </Text>
          </View>
        )}
        {loadError && (
          <View style={[styles.errorBox, { paddingTop: 12 }]}>
            <Text style={{ fontSize: 15, color: theme.primary, fontWeight: '700' }}>
              {t('legal.web.errorTitle')}
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: secondary, marginTop: 8 }}>
              {t('legal.web.errorHintTerms')}
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
            key={`${retryKey}-${locale}-${termsUrl}`}
            source={{ uri: termsUrl }}
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
          { paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsEditorialMasthead
          styles={hubStyles}
          title="TERMS"
          kicker="USER AGREEMENT · LOCAL"
        />
        <View style={{ paddingHorizontal: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: theme.primary, marginBottom: 8 }}>
        {t('legal.terms.docTitle')}
      </Text>
      <Text style={{ fontSize: 13, lineHeight: 20, color: muted, marginBottom: 20 }}>
        {t('legal.terms.meta')}
      </Text>

      {TERMS_SECTION_KEYS.map((k) => (
        <Section
          key={k.title}
          title={t(k.title)}
          themePrimary={theme.primary}
          secondary={secondary}
        >
          {t(k.body)}
        </Section>
      ))}

      <Text style={{ fontSize: 12, lineHeight: 18, color: muted, marginTop: 8 }}>
        {t('legal.terms.footerNote')}
      </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  webview: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  loadingHint: { marginTop: 12, fontSize: 14 },
  errorBox: { flex: 1, paddingHorizontal: 20, paddingBottom: 24 },
  retryBtn: {
    alignSelf: 'flex-start',
    marginTop: 20,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
