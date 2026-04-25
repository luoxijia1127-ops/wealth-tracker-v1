/**
 * 「更多」：海报风分区网格。
 */

import { SettingsGridTile } from '@/components/settings-grid-tile';
import { useAppPalette } from '@/contexts/app-palette-context';
import { useLanguage } from '@/contexts/language-context';
import { usePurchasesEntitlement } from '@/contexts/purchases-context';
import { createSettingsScreenStyles } from '@/lib/settings-screen-styles';
import { FREE_ASSET_LIMIT } from '@/lib/subscription-constants';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useMemo } from 'react';
import { Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pickTextOnAccent, rgbaFromHex } from '@/lib/color-utils';

type Tile = {
  id: string;
  label: string;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  onPress: () => void;
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useAppPalette();
  const { t } = useLanguage();
  const { ready: purchasesReady, isPro } = usePurchasesEntitlement();
  const styles = useMemo(() => createSettingsScreenStyles(theme), [theme]);

  const p = theme.primary;
  const toolsSwatch = theme.swatches[1] ?? p;
  const secondarySwatch = theme.swatches[2] ?? p;
  const toolsBg = rgbaFromHex(toolsSwatch, 0.52);
  const secondaryBg = rgbaFromHex(secondarySwatch, 0.4);

  const openMembership = () => {
    router.push('/paywall');
  };

  const onShareApp = useCallback(async () => {
    try {
      await Share.share({
        message: t('settings.share.message'),
        title: 'Nest',
      });
    } catch {
      Alert.alert(t('settings.share.failedTitle'), t('settings.share.failedMessage'));
    }
  }, [t]);

  const toolTiles: Tile[] = useMemo(
    () => [
      {
        id: 'market',
        label: t('settings.tiles.market'),
        icon: 'show-chart',
        onPress: () => router.push('/market'),
      },
      {
        id: 'attribution',
        label: t('settings.tiles.attribution'),
        icon: 'stacked-line-chart',
        onPress: () => router.push('/settings-attribution'),
      },
      {
        id: 'fx',
        label: t('settings.tiles.fx'),
        icon: 'currency-exchange',
        onPress: () => router.push('/settings-fx'),
      },
    ],
    [router, t]
  );

  const settingsTiles: Tile[] = useMemo(
    () => [
      {
        id: 'currency',
        label: t('settings.tiles.currency'),
        icon: 'monetization-on',
        onPress: () => router.push('/settings-display-currency'),
      },
      {
        id: 'language',
        label: t('settings.tiles.language'),
        icon: 'language',
        onPress: () => router.push('/settings-language'),
      },
      {
        id: 'palette',
        label: t('settings.tiles.palette'),
        icon: 'invert-colors-on',
        onPress: () => router.push('/settings-palette'),
      },
    ],
    [router, t]
  );

  return (
    <View style={styles.screen}>
      <View style={styles.screenAmbient} pointerEvents="none" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom + 28,
            backgroundColor: 'transparent',
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mastheadBlock}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <Text
              style={[styles.masthead, { flex: 1, minWidth: 0 }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              DAYBREAK
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('settings.share.message')}
              hitSlop={10}
              onPress={() => void onShareApp()}
              style={({ pressed }) => ({
                opacity: pressed ? 0.65 : 1,
                padding: 4,
              })}
            >
              <MaterialIcons name="share" size={28} color={p} />
            </Pressable>
          </View>
          <Text style={styles.kicker}>EDITORIAL SETTINGS</Text>
        </View>

        <View style={styles.posterStage}>
          <Pressable style={styles.accountBlock} onPress={openMembership}>
            <View>
              <View style={styles.avatar}>
                <MaterialIcons name="person" size={32} color={p} />
              </View>
              <Text style={styles.profileName}>{t('settings.localLedger')}</Text>
              <Text style={styles.profileSub}>
                {t('settings.localLedgerHint')}
                {purchasesReady
                  ? isPro
                    ? `\n\n${t('settings.pro.unlimitedHint')}`
                    : `\n\n${t('settings.pro.freeAssetHint', { limit: FREE_ASSET_LIMIT })}`
                  : ''}
              </Text>
            </View>
            <View style={styles.profileCta}>
              <Text style={styles.profileCtaText}>{t('settings.member')}</Text>
            </View>
          </Pressable>

          <View style={styles.rightColumn}>
            <View style={styles.toolsBlock}>
              <Text style={styles.toolsHeader}>TOOLS</Text>
              <View style={styles.toolsGrid}>
                {toolTiles.map(t => (
                  <SettingsGridTile
                    key={t.id}
                    label={t.label}
                    icon={t.icon}
                    theme={theme}
                    onPress={t.onPress}
                    variant="tool"
                    color={toolsBg}
                    textColor={pickTextOnAccent(toolsSwatch)}
                  />
                ))}
              </View>
            </View>
            
            <View style={styles.secondaryBlock}>
              <View style={styles.secondaryGrid}>
                <SettingsGridTile
                  label={t('settings.tiles.data')}
                  icon="description"
                  theme={theme}
                  onPress={() => router.push('/settings-data-hub')}
                  variant="secondary"
                  color={secondaryBg}
                  textColor={pickTextOnAccent(secondarySwatch)}
                />
                <SettingsGridTile
                  label={t('settings.tiles.support')}
                  icon="lightbulb-outline"
                  theme={theme}
                  onPress={() => router.push('/settings-support-hub')}
                  variant="secondary"
                  color={secondaryBg}
                  textColor={pickTextOnAccent(secondarySwatch)}
                />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.preferencesBlock}>
          <Text style={styles.sectionMasthead}>PREFERENCES</Text>
          {settingsTiles.map(t => (
            <SettingsGridTile
              key={t.id}
              label={t.label}
              icon={t.icon}
              theme={theme}
              onPress={t.onPress}
              variant="list"
            />
          ))}
        </View>

      </ScrollView>
    </View>
  );
}
