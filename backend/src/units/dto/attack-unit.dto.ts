import { IsIn, IsInt, Min } from 'class-validator';

export class AttackUnitDto {
  @IsInt()
  @Min(1)
  attackerId!: number;

  @IsInt()
  @Min(1)
  defenderId!: number;

  @IsIn(['melee', 'ranged'])
  mode: 'melee' | 'ranged' = 'melee';
}
