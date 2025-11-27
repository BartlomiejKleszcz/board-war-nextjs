import { IsInt, Min } from "class-validator";

export class SetUnitPosition{
    @IsInt()
    @Min(0)
    q: number;
    @IsInt()
    @Min(0)
    r: number;
    constructor(q : number, r : number){
        this.q = q;
        this.r = r;
    }
}