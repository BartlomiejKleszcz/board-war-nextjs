import { Injectable } from "@nestjs/common";
import { newPlayer } from "src/player/domain/player";
import { PlayerRepositoryPort } from "src/player/ports/PlayerRepositoryPort";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class PlayerRepositoryAdapter implements PlayerRepositoryPort{
    constructor(private readonly prisma: PrismaService){}
    findByName(name: string) {
                return this.prisma.player.findFirst({
            where: {
                name: name
            }
        })
    }
    create(player: newPlayer) {
        return this.prisma.player.create({
            data: {
                name: player.name,
                color: player.color,
                budget: player.budget,
                turn: player.turn
            },
        });
    }
    findbyID(id: number) {
        return this.prisma.player.findUnique({
            where: { id },
        });
    }

    findAll() {
        return this.prisma.player.findMany();
    }

    delete(id: number) {
        return this.prisma.player.delete({
            where: {
                id: id
            }
        })
    }

    async update(id: number, name: string, color: string) {
    return this.prisma.player.update({
        where: { id },           // który rekord
        data: {                  // jakie pola zmieniasz
        name,
        color,
        },
    });
    }


}
