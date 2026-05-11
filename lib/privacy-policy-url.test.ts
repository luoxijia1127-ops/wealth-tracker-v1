import { describe, expect, it } from 'vitest';
import { DEFAULT_HOSTED_PRIVACY_POLICY_URL } from './legal-default-hosted-urls';
import { getPrivacyPolicyUrl, getPrivacyPolicyUrlForLocale } from './privacy-policy-url';

describe('getPrivacyPolicyUrl', () => {
  it('falls back to default GitHub Pages URL when env is unset', () => {
    expect(getPrivacyPolicyUrl()).toBe(DEFAULT_HOSTED_PRIVACY_POLICY_URL);
  });
});

describe('getPrivacyPolicyUrlForLocale', () => {
  it('appends locale hash to default URL', () => {
    expect(getPrivacyPolicyUrlForLocale('zh-CN').endsWith('#zh')).toBe(true);
    expect(getPrivacyPolicyUrlForLocale('en-US').endsWith('#en')).toBe(true);
  });
});
