import { Player } from "../domain/player";

export interface PlayerRepositoryPort{

    create(player: Player);
    findbyID(id: number);
    findByName(name: string);
    findAll();
    update(id: number, name: string, color: string);
}