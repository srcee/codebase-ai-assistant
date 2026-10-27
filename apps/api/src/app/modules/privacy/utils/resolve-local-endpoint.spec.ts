import { PrivacyPolicyError } from '../errors/privacy-policy.error';
import { resolveLocalEndpoint } from './resolve-local-endpoint';

describe('resolveLocalEndpoint', () => {
  it('keeps an IP literal as is without any DNS lookup', async () => {
    const lookup = jest.fn();
    await expect(
      resolveLocalEndpoint('http://127.0.0.1:11434', lookup),
    ).resolves.toEqual({ origin: 'http://127.0.0.1:11434' });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('pins localhost to the resolved IPv4 loopback address', async () => {
    const lookup = jest.fn().mockResolvedValue([
      { address: '::1', family: 6 },
      { address: '127.0.0.1', family: 4 },
    ]);
    await expect(
      resolveLocalEndpoint('http://localhost:11434', lookup),
    ).resolves.toEqual({ origin: 'http://127.0.0.1:11434' });
    expect(lookup).toHaveBeenCalledWith('localhost');
  });

  it('pins localhost to IPv6 loopback when that is all it resolves to', async () => {
    const lookup = jest.fn().mockResolvedValue([{ address: '::1', family: 6 }]);
    await expect(
      resolveLocalEndpoint('http://localhost:11434', lookup),
    ).resolves.toEqual({ origin: 'http://[::1]:11434' });
  });

  it.each([
    ['a public address', [{ address: '203.0.113.10', family: 4 }]],
    [
      'a mix of loopback and public addresses',
      [
        { address: '127.0.0.1', family: 4 },
        { address: '203.0.113.10', family: 4 },
      ],
    ],
    ['no addresses', []],
  ])('rejects localhost resolving to %s', async (_label, addresses) => {
    const lookup = jest.fn().mockResolvedValue(addresses);
    await expect(
      resolveLocalEndpoint('http://localhost:11434', lookup),
    ).rejects.toThrow(PrivacyPolicyError);
  });

  it('rejects when localhost cannot be resolved', async () => {
    const lookup = jest.fn().mockRejectedValue(new Error('ENOTFOUND'));
    await expect(
      resolveLocalEndpoint('http://localhost:11434', lookup),
    ).rejects.toThrow(PrivacyPolicyError);
  });

  it('rejects remote URLs before any lookup', async () => {
    const lookup = jest.fn();
    await expect(
      resolveLocalEndpoint('http://example.com:11434', lookup),
    ).rejects.toThrow(PrivacyPolicyError);
    expect(lookup).not.toHaveBeenCalled();
  });
});
