import { Factory } from 'fishery';
import type { DatabaseHealth } from '@codebase-ai/contracts';

class DatabaseHealthFactory extends Factory<DatabaseHealth> {
  unconfigured() {
    return this.params({
      status: 'unconfigured',
      vectorExtension: false,
      embeddingDimensions: null,
    });
  }

  down() {
    return this.params({
      status: 'down',
      vectorExtension: false,
      embeddingDimensions: null,
    });
  }

  withoutVectorExtension() {
    return this.params({ vectorExtension: false });
  }

  notMigrated() {
    return this.params({ embeddingDimensions: null });
  }
}

/** Defaults to a healthy database whose column matches the default EMBEDDING_DIMENSIONS (768). */
export const databaseHealthFactory = DatabaseHealthFactory.define(
  (): DatabaseHealth => ({
    status: 'up',
    vectorExtension: true,
    embeddingDimensions: 768,
  }),
);
