import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, max } from "class-validator";
import * as unitTypes from "../domain/unit.types";

export class CreateUnitDto {
    @ApiProperty()
    @IsString()
    name: string;
    @ApiProperty()
    @IsString()
    id: unitTypes.UnitName;
    @ApiProperty()
    @IsInt()
    maxHp: number;
    @ApiProperty()
    @IsInt()
    meleeAttack: number
    @ApiProperty()
    @IsInt()
    rangedAttack: number;
    @ApiProperty()
    @IsInt()
    attackRange: number;
    @ApiProperty()
    @IsInt()
    defense: number;
    @ApiProperty()
    @IsInt()
    speed: number;
    @ApiProperty()
    @IsInt()
    cost: number;

    constructor(
        name: string,
        id: unitTypes.UnitName,
        maxHp: number,
        meleeAttack: number,
        rangedAttack: number,
        attackRange: number,
        defense: number,
        speed: number,
        cost: number,
    ){
        this.name = name;
        this.id = id;
        this.maxHp = maxHp;
        this.meleeAttack = meleeAttack;
        this.rangedAttack = rangedAttack;
        this.attackRange = attackRange;
        this.defense = defense;
        this.speed = speed;
        this.cost = cost;
    }
}