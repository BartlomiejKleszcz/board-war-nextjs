import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UnitsModule } from './units/units.module';
import { PlayerModule } from './player/player.module';
import { BoardModule } from './board/board.module';
import { GameModule } from './game/game.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [UnitsModule, PlayerModule, BoardModule, GameModule, PrismaModule, AuthModule, UserModule, StatsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
