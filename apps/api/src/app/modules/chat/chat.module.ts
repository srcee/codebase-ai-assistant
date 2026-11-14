import { Module } from '@nestjs/common';
import { DatabaseModule } from '@codebase-ai/server-database';
import { GenerationModule } from '../generation/generation.module';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { ChatController } from './controllers/chat.controller';
import { ConversationsController } from './controllers/conversations.controller';
import { ChatConcurrencyService } from './services/chat-concurrency.service';
import { ChatService } from './services/chat.service';
import { CitationValidatorService } from './services/citation-validator.service';
import { ConversationRetentionService } from './services/conversation-retention.service';
import { ConversationsService } from './services/conversations.service';

@Module({
  imports: [DatabaseModule, RetrievalModule, GenerationModule],
  controllers: [ChatController, ConversationsController],
  providers: [
    ChatService,
    ChatConcurrencyService,
    CitationValidatorService,
    ConversationsService,
    ConversationRetentionService,
  ],
})
export class ChatModule {}
