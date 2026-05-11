import { describe, expect, it } from 'vitest';
import { applyLegalPageLocaleHash } from './legal-hosted-url';

describe('applyLegalPageLocaleHash', () => {
  it('appends #zh for zh-CN and replaces existing hash', () => {
    expect(applyLegalPageLocaleHash('https://example.com/privacy.html', 'zh-CN')).toBe(
      'https://example.com/privacy.html#zh'
    );
    expect(applyLegalPageLocaleHash('https://example.com/p.html#en', 'zh-CN')).toBe(
      'https://example.com/p.html#zh'
    );
  });

  it('appends #en for en-US', () => {
    expect(applyLegalPageLocaleHash('https://example.com/terms.html', 'en-US')).toBe(
      'https://example.com/terms.html#en'
    );
  });

  it('preserves query string', () => {
    expect(applyLegalPageLocaleHash('https://example.com/p.html?x=1', 'en-US')).toBe(
      'https://example.com/p.html?x=1#en'
    );
  });
});
