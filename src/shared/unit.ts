export interface UnitDto {
    name: string;
    id: string;
    maxHp: number;
    currentHp?: number;
    meleeAttack: number;
    rangedAttack: number;
    attackRange: number;
    defense: number;
    speed: number;
    cost: number;
    uniqueId?: number;
    position?: { q: number; r: number } | null;
    playerId?: string;
}
