/**
 * 正文 Inter；标题/杂志风大标题 Newsreader（@expo-google-fonts/*）。
 * FontRoot 加载完成前勿用 family 名。
 */
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import {
  Newsreader_600SemiBold,
  Newsreader_700Bold,
} from '@expo-google-fonts/newsreader';

export const interFontMap = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
};

export const displayFontMap = {
  Newsreader_600SemiBold,
  Newsreader_700Bold,
};

export const AppFont = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
  /** 杂志风章节标题 */
  displaySemiBold: 'Newsreader_600SemiBold',
  displayBold: 'Newsreader_700Bold',
} as const;
