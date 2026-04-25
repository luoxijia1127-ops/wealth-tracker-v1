/**
 * 用户协议：可选 WebView 加载托管页；未配置 URL 时展示本地正文。
 */

import { SettingsEditorialMasthead } from '@/components/settings-editorial-masthead';
import { SettingsHubBackTopBar } from '@/components/settings-hub-back-navigation';
import { useAppPalette } from '@/contexts/app-palette-context';
import { rgbaFromHex } from '@/lib/color-utils';
import { createSettingsScreenStyles } from '@/lib/settings-screen-styles';
import { getTermsOfServiceUrl } from '@/lib/terms-of-service-url';
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
  const hubStyles = useMemo(() => createSettingsScreenStyles(theme), [theme]);
  const secondary = rgbaFromHex(theme.primary, 0.68);
  const muted = rgbaFromHex(theme.primary, 0.52);

  const termsUrl = useMemo(() => getTermsOfServiceUrl(), []);
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
            <Text style={[styles.loadingHint, { color: muted }]}>正在加载用户协议…</Text>
          </View>
        )}
        {loadError && (
          <View style={[styles.errorBox, { paddingTop: 12 }]}>
            <Text style={{ fontSize: 15, color: theme.primary, fontWeight: '700' }}>
              无法加载页面
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: secondary, marginTop: 8 }}>
              请检查网络后重试。
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
            originWhitelist={['http://', 'https://']}
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
        Nest 用户协议
      </Text>
      <Text style={{ fontSize: 13, lineHeight: 20, color: muted, marginBottom: 20 }}>
        生效日期：2026年4月5日{'\n'}
        最后更新：2026年4月5日{'\n'}
        运营者：本应用由个人开发者提供。{'\n'}
        联系邮箱：nest_feedback@163.com
      </Text>

      <Section title="一、协议的接受与修订" themePrimary={theme.primary} secondary={secondary}>
        {`欢迎使用 Nest（以下简称「本应用」）。当您下载、安装或使用本应用，即表示您已阅读并同意本用户协议（以下简称「本协议」）。若您不同意，请停止使用本应用。\n\n我们可能不时更新本协议；更新后将在应用内或配套页面公示，并可能修订「生效日期」。您在更新后继续使用，即视为接受修订后的协议。`}
      </Section>

      <Section title="二、服务说明" themePrimary={theme.primary} secondary={secondary}>
        {`Nest 为个人资产记录、净值展示及与市场公开信息相关的辅助工具。本应用按「现状」提供，我们会尽力维护稳定性与数据展示的合理性，但不保证服务持续可用、无中断、无错误，也不保证行情、汇率等第三方数据的实时性、完整性与准确性。`}
      </Section>

      <Section title="三、非投资建议" themePrimary={theme.primary} secondary={secondary}>
        {`本应用不构成任何证券、基金、保险或其他投资产品的购买、出售或持有建议，亦不构成财务、税务或法律意见。您应自行判断并承担基于本应用信息所作决策的全部风险与后果。`}
      </Section>

      <Section title="四、账号与使用资格" themePrimary={theme.primary} secondary={secondary}>
        {`在适用版本不要求注册的前提下，您无需向我们提供账号即可使用核心功能。若未来提供注册或登录功能，我们将另行说明规则，并可能要求您遵守适用平台（如 Apple）关于登录方式的相关规定。\n\n您应保证使用本应用不违反法律法规，不侵害他人合法权益。`}
      </Section>

      <Section title="五、数据与设备" themePrimary={theme.primary} secondary={secondary}>
        {`在默认情况下，您的账本数据主要存储于当前设备本地。请您自行保管设备与系统安全，并注意备份；因设备丢失、损坏、系统清理或卸载应用等导致的数据丢失，在适用法律允许的范围内，我们不承担恢复或赔偿责任。关于我们如何对待个人信息与网络请求，请参阅《隐私政策》。`}
      </Section>

      <Section title="六、订阅与付费（如适用）" themePrimary={theme.primary} secondary={secondary}>
        {`若本应用提供付费或订阅功能，相关价格、周期与权益以 App Store 展示及购买确认页面为准。订阅可能自动续费，您可通过 Apple ID 账户设置管理或取消订阅。因平台规则导致的支付、退款与发票问题，请遵循 Apple 相关政策；我们可在法律允许范围内提供必要协助。`}
      </Section>

      <Section title="七、知识产权" themePrimary={theme.primary} secondary={secondary}>
        {`本应用的界面设计、文案、标识及受法律保护的内容，归运营者或权利人所有。未经许可，您不得复制、修改、传播或用于商业目的（法律另有规定或我们明确授权的除外）。`}
      </Section>

      <Section title="八、第三方服务与行情信息" themePrimary={theme.primary} secondary={secondary}>
        {`为实现行情、汇率、标的联想等功能，本应用可能访问第三方公开接口或服务。该等服务由其提供方独立运营，受其条款约束；我们不对第三方服务的可用性、准确性或合法性作担保。`}
      </Section>

      <Section title="九、责任限制" themePrimary={theme.primary} secondary={secondary}>
        {`在适用法律允许的最大范围内，对于因使用或无法使用本应用而产生的任何直接、间接、偶然、特殊或后果性损害（包括但不限于利润、商誉、数据丢失），除法律强制规定外，我们不承担责任。\n\n本条款不影响法律规定的不得排除的消费者权利。`}
      </Section>

      <Section title="十、协议终止" themePrimary={theme.primary} secondary={secondary}>
        {`您可随时停止使用并卸载本应用。我们亦可能在遵守适用法律的前提下，因维护、合规或业务调整等原因变更或终止部分功能；如涉及重大权益变化，我们将尽量以合理方式提示。`}
      </Section>

      <Section title="十一、适用法律与争议" themePrimary={theme.primary} secondary={secondary}>
        {`本协议的订立、效力与解释，以中华人民共和国大陆地区法律为基准（仅为法律适用选择，不视为我们对任何管辖法院的承诺）。若发生争议，双方应友好协商；协商不成的，您可向有管辖权的人民法院提起诉讼。`}
      </Section>

      <Section title="十二、联系我们" themePrimary={theme.primary} secondary={secondary}>
        {`若对本协议有疑问，请发送邮件至：nest_feedback@163.com。`}
      </Section>

      <Text style={{ fontSize: 12, lineHeight: 18, color: muted, marginTop: 8 }}>
        提示：以上为便于理解的草案，正式上架前建议结合产品与司法辖区由专业人士审阅。
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
