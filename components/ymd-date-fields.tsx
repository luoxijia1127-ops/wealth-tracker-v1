/**
 * 成交日期等：年 - 月 - 日 分栏，左右对称等分，存库仍为 YYYY-MM-DD。
 */

import { useLanguage } from '@/contexts/language-context';
import type { SupportedLocale } from '@/lib/language';
import { useEffect, useState } from 'react';
import { Text, TextInput, View, type TextStyle } from 'react-native';

function parseYmd(s: string): { y: string; m: string; d: string } {
  const t = s.trim();
  const full = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (full) {
    return {
      y: full[1]!,
      m: full[2]!.padStart(2, '0'),
      d: full[3]!.padStart(2, '0'),
    };
  }
  const ym = /^(\d{4})-(\d{1,2})$/.exec(t);
  if (ym) {
    return { y: ym[1]!, m: ym[2]!.padStart(2, '0'), d: '' };
  }
  if (/^\d{1,4}$/.test(t)) {
    return { y: t.slice(0, 4), m: '', d: '' };
  }
  return { y: '', m: '', d: '' };
}

/** 将 YYYY-MM-DD 格式化为界面展示：中文「2026年04月02日」，英文如 Apr 2, 2026 */
export function formatYmdForLocale(ymd: string, locale: SupportedLocale): string {
  const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!p) return ymd.trim();
  const y = parseInt(p[1]!, 10);
  const mo = parseInt(p[2]!, 10) - 1;
  const d = parseInt(p[3]!, 10);
  const date = new Date(y, mo, d);
  if (Number.isNaN(date.getTime())) return ymd.trim();
  if (locale === 'en-US') {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  return `${p[1]}年${p[2]}月${p[3]}日`;
}

/** 始终按中文展示（兼容旧调用） */
export function formatYmdChineseLine(ymd: string): string {
  return formatYmdForLocale(ymd, 'zh-CN');
}

function buildYmdString(y: string, m: string, d: string): string {
  const ys = y.replace(/\D/g, '').slice(0, 4);
  const ms = m.replace(/\D/g, '').slice(0, 2);
  const ds = d.replace(/\D/g, '').slice(0, 2);
  if (!ys && !ms && !ds) return '';
  if (ys && !ms && !ds) return ys;
  if (ys && ms && !ds) return `${ys}-${ms.padStart(2, '0')}`;
  if (ys && ms && ds) return `${ys}-${ms.padStart(2, '0')}-${ds.padStart(2, '0')}`;
  return ys ? `${ys}-${ms.padStart(2, '0')}` : '';
}

export function YmdDateFields({
  value,
  onChangeText,
  placeholderColor,
  inputStyle,
  labelColor,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholderColor: string;
  inputStyle: TextStyle;
  /** 年/月/日 标签颜色 */
  labelColor: string;
}) {
  const { t, locale } = useLanguage();
  const [y, setY] = useState('');
  const [m, setM] = useState('');
  const [d, setD] = useState('');

  useEffect(() => {
    const p = parseYmd(value);
    setY(p.y);
    setM(p.m);
    setD(p.d);
  }, [value]);

  const emit = (ny: string, nm: string, nd: string) => {
    setY(ny);
    setM(nm);
    setD(nd);
    onChangeText(buildYmdString(ny, nm, nd));
  };

  const labelStyle = {
    fontSize: 14,
    fontWeight: '600' as const,
    color: labelColor,
    width: locale === 'en-US' ? 14 : 18,
    textAlign: 'center' as const,
  };
  const sep3 = t('dateField.sep3');

  const cell = { flex: 1, flexBasis: 0, minWidth: 0, textAlign: 'center' as const };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        gap: 4,
      }}
    >
      <TextInput
        style={[inputStyle, cell]}
        value={y}
        onChangeText={(tx) => emit(tx.replace(/\D/g, '').slice(0, 4), m, d)}
        placeholder={t('dateField.phY')}
        placeholderTextColor={placeholderColor}
        keyboardType="number-pad"
        maxLength={4}
        selectTextOnFocus
      />
      <Text style={labelStyle}>{t('dateField.sep1')}</Text>
      <TextInput
        style={[inputStyle, cell]}
        value={m}
        onChangeText={(tx) => emit(y, tx.replace(/\D/g, '').slice(0, 2), d)}
        placeholder={t('dateField.phM')}
        placeholderTextColor={placeholderColor}
        keyboardType="number-pad"
        maxLength={2}
        selectTextOnFocus
      />
      <Text style={labelStyle}>{t('dateField.sep2')}</Text>
      <TextInput
        style={[inputStyle, cell]}
        value={d}
        onChangeText={(tx) => emit(y, m, tx.replace(/\D/g, '').slice(0, 2))}
        placeholder={t('dateField.phD')}
        placeholderTextColor={placeholderColor}
        keyboardType="number-pad"
        maxLength={2}
        selectTextOnFocus
      />
      {sep3.length > 0 ? <Text style={labelStyle}>{sep3}</Text> : null}
    </View>
  );
}
