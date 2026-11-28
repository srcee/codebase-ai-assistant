import { isUnmappedHostPath, mapHostPath } from './map-host-path';

describe('mapHostPath', () => {
  const windows = { hostPrefix: 'C:\\Users\\bob', containerPrefix: '/sources' };
  const posix = { hostPrefix: '/home/bob/', containerPrefix: '/sources/' };

  it('returns the input unchanged without a mapping', () => {
    expect(mapHostPath('C:\\Users\\bob\\repo')).toBe('C:\\Users\\bob\\repo');
  });

  it.each([
    ['C:\\Users\\bob\\code\\repo', '/sources/code/repo'],
    ['c:/users/BOB/code/repo/', '/sources/code/repo'],
    ['C:\\Users\\bob', '/sources'],
  ])('maps the Windows path %s', (input, expected) => {
    expect(mapHostPath(input, windows)).toBe(expected);
  });

  it.each([
    ['/home/bob/code/repo', '/sources/code/repo'],
    ['/home/bob', '/sources'],
  ])('maps the POSIX path %s', (input, expected) => {
    expect(mapHostPath(input, posix)).toBe(expected);
  });

  it('compares POSIX prefixes case-sensitively', () => {
    expect(mapHostPath('/home/BOB/repo', posix)).toBe('/home/BOB/repo');
  });

  it.each([
    'C:\\Users\\bobby\\repo',
    'D:\\Users\\bob\\repo',
    'C:\\Users',
    'relative\\repo',
    '\\\\server\\share\\repo',
  ])('leaves %s outside the prefix unchanged', (input) => {
    expect(mapHostPath(input, windows)).toBe(input);
  });

  it('keeps .. segments so the policy still rejects them', () => {
    expect(mapHostPath('C:\\Users\\bob\\repo\\..\\..\\x', windows)).toBe(
      '/sources/repo/../../x',
    );
  });

  describe('isUnmappedHostPath', () => {
    it('flags a Windows path outside the prefix', () => {
      expect(isUnmappedHostPath('D:\\code\\repo', windows)).toBe(true);
    });

    it.each([
      ['a mapped path', 'C:\\Users\\bob\\repo', windows],
      ['a path with .. segments', 'D:\\code\\..\\repo', windows],
      ['a POSIX mapping', '/opt/repo', posix],
      ['no mapping', 'D:\\code\\repo', undefined],
    ])('does not flag %s', (_name, input, mapping) => {
      expect(isUnmappedHostPath(input, mapping)).toBe(false);
    });
  });
});
