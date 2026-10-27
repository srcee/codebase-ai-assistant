import { Module } from '@nestjs/common';
import { InferenceModule } from '../inference/inference.module';
import { GenerationService } from './services/generation.service';

@Module({
  imports: [InferenceModule],
  providers: [GenerationService],
  exports: [GenerationService],
})
export class GenerationModule {}
