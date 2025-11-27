import { Injectable } from '@nestjs/common';
import { BattleResult, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RecordBattleDto } from './dto/record-battle.dto';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordBattle(userId: number, dto: RecordBattleDto) {
    return this.prisma.userBattle.create({
      data: {
        userId,
        gameId: dto.gameId ?? null,
        result: dto.result,
        damageDealt: dto.damageDealt,
        damageTaken: dto.damageTaken,
        units: dto.units as unknown as Prisma.JsonArray,
      },
    });
  }

  async getUserStats(userId: number) {
    const battles = await this.prisma.userBattle.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const totals = battles.reduce(
      (acc, battle) => {
        acc.battles += 1;
        acc.damageDealt += battle.damageDealt;
        acc.damageTaken += battle.damageTaken;
        if (battle.result === BattleResult.win) acc.wins += 1;
        if (battle.result === BattleResult.lose) acc.losses += 1;
        if (battle.result === BattleResult.draw) acc.draws += 1;
        return acc;
      },
      { battles: 0, wins: 0, losses: 0, draws: 0, damageDealt: 0, damageTaken: 0 },
    );

    return { total: totals, battles };
  }
}
