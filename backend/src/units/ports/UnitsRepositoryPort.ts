import { AttackUnitDto } from "../dto/attack-unit.dto";

export interface UnitsRepositoryPort {
    createUnit(id: number);
    attackUnit(attackUnitDto: AttackUnitDto);
    getAllAvailableUnits();
}