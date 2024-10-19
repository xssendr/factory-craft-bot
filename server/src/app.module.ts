import { Module } from '@nestjs/common';
import { WhitelistService } from './telegram/telegram.service';

@Module({
  imports: [],
  controllers: [],
  providers: [WhitelistService],
})
export class AppModule {}
