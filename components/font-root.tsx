/**
 * 加载 Inter 并设置 Text / TextInput 默认字体。
 */

import { interFontMap } from '@/lib/app-fonts';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { Text, TextInput } from 'react-native';

void SplashScreen.preventAutoHideAsync();

export function FontRoot({ children }: { children: React.ReactNode }) {
  const [loaded, error] = useFonts(interFontMap);
  const appliedDefaults = useRef(false);

  useEffect(() => {
    if (loaded || error) {
      void SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  useEffect(() => {
    if (!loaded || error) return;
    if (appliedDefaults.current) return;
    appliedDefaults.current = true;
    const T = Text as unknown as { defaultProps?: { style?: object } };
    const TI = TextInput as unknown as { defaultProps?: { style?: object } };
    T.defaultProps = T.defaultProps ?? {};
    TI.defaultProps = TI.defaultProps ?? {};
    const base = { fontFamily: 'Inter_400Regular' as const };
    T.defaultProps.style = Array.isArray(T.defaultProps.style)
      ? [base, ...T.defaultProps.style]
      : T.defaultProps.style
        ? [base, T.defaultProps.style]
        : base;
    TI.defaultProps.style = Array.isArray(TI.defaultProps.style)
      ? [base, ...TI.defaultProps.style]
      : TI.defaultProps.style
        ? [base, TI.defaultProps.style]
        : base;
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }
  return <>{children}</>;
}
