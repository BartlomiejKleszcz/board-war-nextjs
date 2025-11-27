import { IsNotEmpty, IsString } from "class-validator";

export class CreatePlayerDto {
    @IsString()
    @IsNotEmpty()
    name: string;
    @IsString()
    @IsNotEmpty()
    color: string;

    constructor(name: string, color: string) {
        this.name = name;
        this.color = color;
    }
}
