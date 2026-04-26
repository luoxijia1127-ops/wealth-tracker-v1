/**
 * 与「默认货币 / 语言」等设置子页一致：海报风主标题 + kicker（文案由调用方 `t()` 传入）。
 */

import type { SettingsScreenStyles } from '@/lib/settings-screen-styles';
import { Text, View } from 'react-native';

type Props = {
  styles: SettingsScreenStyles;
  title: string;
  kicker: string;
};

export function SettingsEditorialMasthead({ styles, title, kicker }: Props) {
  return (
    <View style={styles.mastheadBlockHub}>
      <Text style={styles.masthead}>{title}</Text>
      <Text style={styles.kicker}>{kicker}</Text>
    </View>
  );
}
