export interface UnitDto {
    name: string;
    id: string;
    maxHp: number;
    meleeAttack: number;
    rangedAttack: number;
    attackRange: number;
    defense: number;
    speed: number;
    cost: number;
    position?: { x: number; y: number };
    playerId?: string;
}