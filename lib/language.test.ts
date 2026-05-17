import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-localization', () => ({
  getLocales: vi.fn(),
}));

import { getLocales } from 'expo-localization';

import { getSystemLocale, resolveSystemLocale } from './language';

describe('resolveSystemLocale', () => {
  it('maps zh variants to zh-CN', () => {
    expect(resolveSystemLocale('zh-Hans-CN')).toBe('zh-CN');
    expect(resolveSystemLocale('zh-TW')).toBe('zh-CN');
  });

  it('maps non-zh to en-US', () => {
    expect(resolveSystemLocale('en-US')).toBe('en-US');
    expect(resolveSystemLocale('ja-JP')).toBe('en-US');
  });
});

describe('getSystemLocale', () => {
  const mockedGetLocales = vi.mocked(getLocales);

  beforeEach(() => {
    mockedGetLocales.mockReset();
  });

  it('uses expo-localization languageTag first', () => {
    mockedGetLocales.mockReturnValue([
      { languageTag: 'zh-Hans-CN', languageCode: 'zh' },
    ] as ReturnType<typeof getLocales>);
    expect(getSystemLocale()).toBe('zh-Hans-CN');
  });

  it('falls back to languageCode', () => {
    mockedGetLocales.mockReturnValue([{ languageCode: 'en' }] as ReturnType<
      typeof getLocales
    >);
    expect(getSystemLocale()).toBe('en');
  });
});
