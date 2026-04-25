/**
 * 与「默认货币 / 语言」等设置子页一致：大写英文主标题 + 小写英文副标题。
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
    <View style={[styles.mastheadBlock, { paddingTop: 16 }]}>
      <Text style={styles.masthead}>{title}</Text>
      <Text style={styles.kicker}>{kicker}</Text>
    </View>
  );
}
