import {UnitName } from "../domain/unit.types";

type UnitTemplate = {
    id: UnitName;
    name: string;
    maxHp: number;
    meleeAttack: number;
    rangedAttack: number;
    attackRange: number;
    defense: number;
    speed: number;
    cost: number;
};

export const UNIT_TEMPLATES: Record<UnitName, UnitTemplate> = {
  'light-infantry': {
    id: 'light-infantry',
    name: 'Light Infantry',
    maxHp: 100,
    meleeAttack: 15,
    rangedAttack: 5,
    attackRange: 2,
    defense: 5,
    speed: 4,
    cost: 30,
  },
  'line-infantry': {
    id: 'line-infantry',
    name: 'Line Infantry',
    maxHp: 150,
    meleeAttack: 25,
    rangedAttack: 10,
    attackRange: 3,
    defense: 10,
    speed: 4,
    cost: 45,
  },
    'guard-infantry': {
    id: 'guard-infantry',
    name: 'Guard Infantry',
    maxHp: 200,
    meleeAttack: 35,
    rangedAttack: 15,
    attackRange: 4,
    defense: 15,
    speed: 3,
    cost: 65,
    },
    'light-cavalry': {
    id: 'light-cavalry',
    name: 'Light Cavalry',
    maxHp: 120,
    meleeAttack: 30,
    rangedAttack: 0,
    attackRange: 1,
    defense: 8,
    speed: 8,
    cost: 50,
    },
    'dragon-cavalry': {
    id: 'dragon-cavalry',
    name: 'Dragon Cavalry',
    maxHp: 180,
    meleeAttack: 30,
    rangedAttack: 10,
    attackRange: 2,
    defense: 12,
    speed: 6,
    cost: 80,
    },
    'heavy-cavalry': {
    id: 'heavy-cavalry',
    name: 'Heavy Cavalry',
    maxHp: 250,
    meleeAttack: 60,
    rangedAttack: 0,
    attackRange: 1,
    defense: 20,
    speed: 6,
    cost: 120,
    },
    'twelve-pounder-cannon': {
    id: 'twelve-pounder-cannon',
    name: '12-Pounder Cannon',
    maxHp: 100,
    meleeAttack: 5,
    rangedAttack: 50,
    attackRange: 8,
    defense: 5,
    speed: 3,
    cost: 150,
    },
    'six-pounder-cannon': {
    id: 'six-pounder-cannon',
    name: '6-Pounder Cannon',
    maxHp: 80,
    meleeAttack: 5,
    rangedAttack: 40,
    attackRange: 6,
    defense: 3,
    speed: 3,
    cost: 100,
    },
    'howitzer-cannon': {
    id: 'howitzer-cannon',
    name: 'Howitzer Cannon',
    maxHp: 90,
    meleeAttack: 5,
    rangedAttack: 30,
    attackRange: 7,
    defense: 4,
    speed: 3,
    cost: 130,
    },
};