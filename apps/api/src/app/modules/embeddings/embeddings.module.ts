import { Module } from '@nestjs/common';
import { InferenceModule } from '../inference/inference.module';
import { EmbeddingsService } from './services/embeddings.service';

@Module({
  imports: [InferenceModule],
  providers: [EmbeddingsService],
  exports: [EmbeddingsService],
})
export class EmbeddingsModule {}
