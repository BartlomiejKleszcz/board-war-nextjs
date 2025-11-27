import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { GameController } from './game.controller';
import { PlayerModule } from 'src/player/player.module';
import { BoardModule } from 'src/board/board.module';
import { UnitsModule } from 'src/units/units.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PlayerModule, BoardModule, UnitsModule, PrismaModule],
  controllers: [GameController],
  providers: [GameService],
  exports: [GameService],
})
export class GameModule {}
