import { IsInt, Min } from "class-validator";

export class CreateSoloGameDto {
    @IsInt()
    @Min(1)
    playerId: number;

    constructor(playerId: number){
        this.playerId = playerId;
    }
}