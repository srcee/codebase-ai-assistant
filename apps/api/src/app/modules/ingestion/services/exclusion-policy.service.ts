import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import { BUILT_IN_EXCLUDE_PATTERNS } from '../constants/built-in-exclude-patterns';
import { SECRET_FILENAME_PATTERNS } from '../constants/secret-filename-patterns';
import type { SkipReason } from '../types/skip-reason';
import {
  createPathMatcher,
  type PathMatcher,
} from '../utils/create-path-matcher';
import { isGitignored, type GitignoreLayer } from '../utils/gitignore-layers';

@Injectable()
export class ExclusionPolicyService {
  private readonly builtIn = createPathMatcher(BUILT_IN_EXCLUDE_PATTERNS);
  private readonly secretNames = createPathMatcher(SECRET_FILENAME_PATTERNS);
  private readonly custom: PathMatcher;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.custom = createPathMatcher(config.ingestion.excludePatterns);
  }

  /** Secret names come first so a file is never reported as merely ignored. .gitignore is only a hint. */
  reasonToExclude(
    relativePath: string,
    isDirectory: boolean,
    gitignoreLayers: readonly GitignoreLayer[],
  ): SkipReason | undefined {
    if (this.secretNames.matches(relativePath, isDirectory)) {
      return 'secret-filename';
    }
    if (this.builtIn.matches(relativePath, isDirectory)) return 'excluded-path';
    if (this.custom.matches(relativePath, isDirectory)) {
      return 'custom-exclusion';
    }
    if (isGitignored(gitignoreLayers, relativePath, isDirectory)) {
      return 'gitignored';
    }
    return undefined;
  }
}
