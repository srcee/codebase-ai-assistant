import { Module } from '@nestjs/common';
import { ApiTokenService } from './services/api-token.service';

@Module({
  providers: [ApiTokenService],
  exports: [ApiTokenService],
})
export class AuthModule {}
