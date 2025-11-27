import { Module } from '@nestjs/common';
import { PlayerService } from './player.service';
import { PlayerController } from './player.controller';
import { UnitsModule } from 'src/units/units.module';
import { PlayerRepositoryAdapter } from 'src/infrastructure/PlayerRepositoryAdapter';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [UnitsModule, PrismaModule],
  providers: [PlayerService, PlayerRepositoryAdapter],
  controllers: [PlayerController],
  exports: [PlayerService],
})
export class PlayerModule {}
