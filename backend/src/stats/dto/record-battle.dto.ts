import { IsArray, IsEnum, IsInt, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { BattleResult } from '@prisma/client';

export class RecordBattleDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  gameId?: number;

  @IsEnum(BattleResult)
  result!: BattleResult;

  @IsInt()
  @Min(0)
  damageDealt!: number;

  @IsInt()
  @Min(0)
  damageTaken!: number;

  @IsArray()
  @IsString({ each: true })
  units!: string[];
}
