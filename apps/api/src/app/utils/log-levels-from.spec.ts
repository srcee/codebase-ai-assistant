import { LOG_LEVELS } from '@codebase-ai/server-config';
import { logLevelsFrom } from './log-levels-from';

describe('logLevelsFrom', () => {
  it.each([
    ['error', ['fatal', 'error']],
    ['warn', ['fatal', 'error', 'warn']],
    ['log', ['fatal', 'error', 'warn', 'log']],
    ['debug', ['fatal', 'error', 'warn', 'log', 'debug']],
    ['verbose', ['fatal', 'error', 'warn', 'log', 'debug', 'verbose']],
  ] as const)('enables %s and everything more severe', (level, expected) => {
    expect(logLevelsFrom(level)).toEqual(expected);
  });

  it('covers every configurable level', () => {
    for (const level of LOG_LEVELS) {
      expect(logLevelsFrom(level)).toContain(level);
    }
  });
});
