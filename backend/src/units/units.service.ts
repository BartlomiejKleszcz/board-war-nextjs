import { Injectable } from '@nestjs/common';
import { Player } from 'src/player/domain/player';
import { Unit, UnitName } from './domain/unit.types';
import { UnitFactory } from './domain/unit-factory';

export type VictoryMode = 'points' | 'last-standing' | 'turns';

export interface GameConfig {
    mode: VictoryMode;
    turnLimit?: number;
}

export interface BattleStats {
    totalDamage: number;
    totalDamageByPlayer: Record<number, number>;
    unitsByType: Record<UnitName, {
        count: number;
        alive: number;
        damageTaken: number;
    }>;
}

export interface GameEndState {
    gameOver: true;
    winnerId?: number;
    reason: string;
    stats: BattleStats;
}

export interface AttackResult {
    attackerId: number;
    defenderId: number;
    mode: 'melee' | 'ranged';
    damage: number;
    defenderHpBefore: number;
    defenderHpAfter: number;
    destroyed: boolean;
    gameOver: boolean;
    winnerId?: number;
    reason?: string;
    stats?: BattleStats;
}

@Injectable()
export class UnitsService {

    private customUnits: Unit[] = [];
    private readonly factory = new UnitFactory();
    private readonly unitHp = new Map<number, number>(); // uniqueId -> current hp
    private readonly totalDamageByPlayer = new Map<number, number>(); // playerId -> total damage dealt
    private gameConfig: GameConfig | null = null;
    private turnCount = 0;
    private gameOver = false;
    private winnerId: number | undefined;
    private endReason: string | undefined;

    createUnit(id: UnitName, player: Player): Unit {
        return this.createUnitForPlayer(id, player, true);
    }
    createUnitWithoutPlayer(id: UnitName): Unit {
        const newUnit = this.factory.createFromName(id);
        newUnit.playerId = 0;
        return this.registerUnit(newUnit);
    }

    createUnitForPlayer(id: UnitName, player: Player, subtractBudget = false): Unit {
        const newUnit = this.factory.createFromName(id);
        newUnit.playerId = player.id;

        if (subtractBudget) {
            player.budget -= newUnit.cost;
            if (player.budget < 0) {
                throw new Error('Insufficient budget to create this unit.');
            }
        }

        return this.registerUnit(newUnit);
    }

    private registerUnit(unit: Unit): Unit {
        this.customUnits.push(unit);
        this.unitHp.set(unit.uniqueId, unit.maxHp);
        return unit;
    }

    getPlayerUnits(playerId: Player['id']): Unit[] {
        return this.customUnits.filter(unit => unit.playerId === playerId);
    }

    resetPlayerUnits(playerId: Player['id']) {
        const remainingUnits = this.customUnits.filter(unit => unit.playerId !== playerId);
        const remainingIds = new Set(remainingUnits.map(unit => unit.uniqueId));

        this.customUnits = remainingUnits;

        Array.from(this.unitHp.keys()).forEach(uniqueId => {
            if (!remainingIds.has(uniqueId)) {
                this.unitHp.delete(uniqueId);
            }
        });

        this.totalDamageByPlayer.delete(playerId);
    }

    resetUnitsHp(units: Unit[]) {
        units.forEach(unit => {
            this.unitHp.set(unit.uniqueId, unit.maxHp);
        });
    }

    resetBattleStatsForPlayers(playerIds: Player['id'][]) {
        playerIds.forEach(id => this.totalDamageByPlayer.delete(id));
    }

    cloneArmyForPlayer(units: Unit[], player: Player): Unit[] {
        return units.map(unit => this.createUnitForPlayer(unit.id, player));
    }

    startGame(config: GameConfig) {
        if (config.mode === 'turns' && (!config.turnLimit || config.turnLimit < 1)) {
            throw new Error('Turn limit must be provided and greater than 0 for turn-based mode.');
        }
        this.gameConfig = config;
        this.turnCount = 0;
        this.gameOver = false;
        this.winnerId = undefined;
        this.endReason = undefined;
        this.totalDamageByPlayer.clear();
    }

    getAllAvailableUnits(): Unit[] {
        return this.factory.getAllUnitTemplates();
    }

    getUnitById(id: UnitName): Unit {
        return this.factory.createFromName(id);
    }

    getUnitInstance(uniqueId: number): Unit | undefined {
        return this.customUnits.find(u => u.uniqueId === uniqueId);
    }

    getCurrentHp(uniqueId: number): number | undefined {
        return this.unitHp.get(uniqueId);
    }

    attack(attackerId: number, defenderId: number, mode: 'melee' | 'ranged' = 'melee'): AttackResult {
        if (this.gameOver) {
            throw new Error('Game has already finished.');
        }
        const attacker = this.getUnitInstance(attackerId);
        const defender = this.getUnitInstance(defenderId);
        if (!attacker || !defender) {
            throw new Error('Attacker or defender not found');
        }

        const defenderHp = this.unitHp.get(defender.uniqueId);
        if (defenderHp === undefined) {
            throw new Error('Defender HP state missing');
        }

        const attackValue = mode === 'ranged' ? attacker.rangedAttack : attacker.meleeAttack;
        const rawDamage = attackValue - defender.defense;
        const roll = Math.floor(Math.random() * 6) + 1;
        const damage = roll === 6 ? 0 : Math.max(1, rawDamage);

        this.recordDamage(attacker.playerId, damage);

        const newHp = Math.max(0, defenderHp - damage);
        this.unitHp.set(defender.uniqueId, newHp);

        const destroyed = newHp === 0;
        const endState = destroyed ? this.evaluateElimination() : null;
        if (endState) {
            this.setGameOver(endState);
        }

        return {
            attackerId: attacker.uniqueId,
            defenderId: defender.uniqueId,
            mode,
            damage,
            defenderHpBefore: defenderHp,
            defenderHpAfter: newHp,
            destroyed,
            gameOver: endState?.gameOver ?? false,
            winnerId: endState?.winnerId,
            reason: endState?.reason,
            stats: endState?.stats,
        };
    }

    recordTurnEnd(): GameEndState | null {
        if (!this.gameConfig || this.gameConfig.mode !== 'turns' || this.gameOver) {
            return null;
        }
        this.turnCount += 1;
        if (this.gameConfig.turnLimit && this.turnCount >= this.gameConfig.turnLimit) {
            const endState = this.finishByDamage('turn-limit-reached');
            this.setGameOver(endState);
            return endState;
        }
        return null;
    }

    finishPointsMode(): GameEndState {
        if (!this.gameConfig || this.gameConfig.mode !== 'points') {
            throw new Error('Points victory mode is not active.');
        }
        if (this.gameOver && this.endReason) {
            return {
                gameOver: true,
                winnerId: this.winnerId,
                reason: this.endReason,
                stats: this.getBattleStats(),
            };
        }
        const endState = this.finishByDamage('points-mode-finished');
        this.setGameOver(endState);
        return endState;
    }

    getBattleStats(): BattleStats {
        const unitsByType: BattleStats['unitsByType'] = {} as BattleStats['unitsByType'];

        this.customUnits.forEach(unit => {
            const hp = this.unitHp.get(unit.uniqueId);
            const currentHp = hp === undefined ? unit.maxHp : hp;
            const damageTaken = Math.max(0, unit.maxHp - currentHp);
            const bucket = unitsByType[unit.id] ?? {
                count: 0,
                alive: 0,
                damageTaken: 0,
            };
            bucket.count += 1;
            if (currentHp > 0) {
                bucket.alive += 1;
            }
            bucket.damageTaken += damageTaken;
            unitsByType[unit.id] = bucket;
        });

        const totalDamageByPlayer: Record<number, number> = {};
        this.totalDamageByPlayer.forEach((value, playerId) => {
            totalDamageByPlayer[playerId] = value;
        });

        const totalDamage = Object.values(totalDamageByPlayer).reduce((acc, curr) => acc + curr, 0);

        return {
            totalDamage,
            totalDamageByPlayer,
            unitsByType,
        };
    }

    private recordDamage(playerId: number, amount: number) {
        const current = this.totalDamageByPlayer.get(playerId) ?? 0;
        this.totalDamageByPlayer.set(playerId, current + amount);
    }

    private evaluateElimination(): GameEndState | null {
        if (!this.gameConfig || this.gameConfig.mode !== 'last-standing') {
            return null;
        }
        const alivePlayers = this.getAlivePlayerIds();
        if (alivePlayers.length === 1) {
            return this.finishWithWinner(alivePlayers[0], 'all-opponents-eliminated');
        }
        return null;
    }

    private getAlivePlayerIds(): number[] {
        const alive = new Set<number>();
        this.customUnits.forEach(unit => {
            const hp = this.unitHp.get(unit.uniqueId) ?? unit.maxHp;
            if (hp > 0) {
                alive.add(unit.playerId);
            }
        });
        return Array.from(alive);
    }

    private finishByDamage(reason: string): GameEndState {
        const winnerId = this.getWinnerByDamage();
        return this.finishWithWinner(winnerId, reason);
    }

    private getWinnerByDamage(): number | undefined {
        let winnerId: number | undefined;
        let topDamage = -1;
        let tie = false;

        this.totalDamageByPlayer.forEach((damage, playerId) => {
            if (damage > topDamage) {
                topDamage = damage;
                winnerId = playerId;
                tie = false;
            } else if (damage === topDamage) {
                tie = true;
            }
        });

        return tie ? undefined : winnerId;
    }

    private finishWithWinner(winnerId: number | undefined, reason: string): GameEndState {
        const stats = this.getBattleStats();
        return {
            gameOver: true,
            winnerId,
            reason,
            stats,
        };
    }

    private setGameOver(state: GameEndState) {
        this.gameOver = true;
        this.winnerId = state.winnerId;
        this.endReason = state.reason;
    }
}
