import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StatsService } from './stats.service';
import { RecordBattleDto } from './dto/record-battle.dto';

@UseGuards(JwtAuthGuard)
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Post('record')
  record(@Req() req: any, @Body() dto: RecordBattleDto) {
    return this.statsService.recordBattle(req.user.userId, dto);
  }

  @Get()
  getStats(@Req() req: any) {
    return this.statsService.getUserStats(req.user.userId);
  }
}
