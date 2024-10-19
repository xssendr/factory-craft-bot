import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhitelistService } from './whitelist/whitelist.service';

@Module({
  imports: [
      ConfigModule.forRoot()],
  controllers: [],
  providers: [WhitelistService],
})
export class AppModule {}
