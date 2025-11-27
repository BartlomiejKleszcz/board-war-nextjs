import { IsIn, IsInt, IsObject, IsOptional } from 'class-validator';
import type { GameActionType } from '../model/game-state';

export class ApplyActionDto {
  @IsIn(['MOVE', 'ATTACK', 'END_TURN'])
  type!: GameActionType;

  @IsInt()
  @IsOptional()
  playerId?: number;

  @IsObject()
  @IsOptional()
  payload?: Record<string, any>;
}
