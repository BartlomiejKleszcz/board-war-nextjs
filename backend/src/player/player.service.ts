import { Injectable } from '@nestjs/common';
import { Player as PrismaPlayer } from '@prisma/client';
import { newPlayer, Player } from './domain/player';
import { Unit, UnitName } from 'src/units/domain/unit.types';
import { UnitsService } from 'src/units/units.service';
import { PlayerRepositoryAdapter } from 'src/infrastructure/PlayerRepositoryAdapter';

@Injectable()
export class PlayerService {
    // In-memory helpers kept for unit logic; DB is the source of truth for players
    private players: Player[] = [];
    private idCounter = 1;

    constructor(
        private readonly unitService: UnitsService,
        private readonly playerRepository: PlayerRepositoryAdapter,
    ) {}

    private toDomain(dbPlayer: PrismaPlayer): Player {
        return {
            id: dbPlayer.id,
            name: dbPlayer.name,
            color: dbPlayer.color,
            budget: dbPlayer.budget,
            turn: dbPlayer.turn,
            units: [], // TODO: hydrate units from DB when persisted
        };
    }

    async create(name: string, color: string): Promise<Player> {
        const player: newPlayer = {
            name,
            color,
            units: [],
            budget: 1000,
            turn: true,
        };
        const created = await this.playerRepository.create(player);
        return this.toDomain(created as PrismaPlayer);
    }

    async findAll(): Promise<Player[]> {
        const players = await this.playerRepository.findAll();
        return players.map((p) => this.toDomain(p as PrismaPlayer));
    }

    async findById(id: Player['id']): Promise<Player | undefined> {
        const player = await this.playerRepository.findbyID(id);
        return player ? this.toDomain(player as PrismaPlayer) : undefined;
    }

    deletePlayer(id: number) {
        return this.playerRepository.delete(id);
    }

    async updatePlayer(id: Player['id'], name: string, color: string): Promise<Player | undefined> {
        const updated = await this.playerRepository.update(id, name, color);
        return updated ? this.toDomain(updated as PrismaPlayer) : undefined;
    }

    // Below: legacy in-memory unit helpers; adjust when units are persisted in DB.
    async addUnitToPlayer(playerId: Player['id'], unitIdStr: string): Promise<Player | undefined> {
        const dbPlayer = await this.playerRepository.findbyID(playerId);
        const unitId: UnitName = unitIdStr as UnitName;

        if (!dbPlayer) {
            return undefined;
        }

        const player = this.toDomain(dbPlayer as PrismaPlayer);
        const newUnit = this.unitService.createUnit(unitId, player);
        player.units.push(newUnit);

        return player;
    }

    deleteUnitFromPlayer(playerId: Player['id'], uniqueId: number): Player | undefined {
        const player = this.players.find((p) => p.id === playerId);
        if (!player) {
            return undefined;
        }
        const unitIndex = player.units.findIndex((unit) => unit.uniqueId === uniqueId);
        if (unitIndex !== -1) {
            player.units.splice(unitIndex, 1);
            return player;
        }
        return undefined;
    }

    getPlayerBudget(playerId: Player['id']): number | undefined {
        const player = this.players.find((p) => p.id === playerId);
        return player ? player.budget : undefined;
    }
}
