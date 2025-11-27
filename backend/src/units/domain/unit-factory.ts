import { UNIT_TEMPLATES } from '../data/unit-definitions';
import { GameUnit } from './game-unit';
import { Unit, UnitName } from './unit.types';

export class UnitFactory {
  createFromName(id: UnitName): Unit {
    const template = UNIT_TEMPLATES[id];
    if (!template) {
        throw new Error(`Unknown unit type: ${id}`);
    }

    return new GameUnit(
      template.name,
      id,
      template.maxHp,
      template.meleeAttack,
      template.rangedAttack,
      template.attackRange,
      template.defense,
      template.speed,
      template.cost,
    );
  }

  getAllUnitTemplates(): GameUnit[] {
    return Object.values(UNIT_TEMPLATES).map(template => 
      new GameUnit(
        template.name,
        template.id,
        template.maxHp,
        template.meleeAttack,
        template.rangedAttack,
        template.attackRange,
        template.defense,
        template.speed,
        template.cost,
      )
    );
  }
}
