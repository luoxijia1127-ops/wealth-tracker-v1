import { describe, expect, it } from 'vitest';
import { getPrivacyPolicyUrl } from './privacy-policy-url';

describe('getPrivacyPolicyUrl', () => {
  it('returns null when env is unset or invalid', () => {
    expect(getPrivacyPolicyUrl()).toBe(null);
  });
});
