import { Module } from '@nestjs/common';
import { WhitelistService } from './whitelist/whitelist.service';

@Module({
  imports: [],
  controllers: [],
  providers: [WhitelistService],
})
export class AppModule {}
