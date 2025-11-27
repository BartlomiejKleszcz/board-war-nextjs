import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, GameActionType as PrismaGameActionType, GameStatus as PrismaGameStatus } from '@prisma/client';
import { BoardService } from 'src/board/board.service';
import { PlayerService } from 'src/player/player.service';
import { Game } from './domain/game';
import { CreateSoloGameDto } from './dto/create-solo-game.dto';
import { Unit } from 'src/units/domain/unit.types';
import { UnitsService } from 'src/units/units.service';
import { Player } from 'src/player/domain/player';
import { Board } from 'src/board/domain/board';
import { HexCoords } from 'src/board/domain/hex.types';
import { countMovement } from 'src/board/domain/hex.utils';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  GameState,
  HexTileState,
  PlayerInGameState,
  UnitOnBoardState,
} from './model/game-state';
import { ApplyActionDto } from './dto/apply-action.dto';

@Injectable()
export class GameService {

    private games: Game[] = [];
    private idCounter = 1; 

    constructor(
        private readonly playerService: PlayerService, 
        private readonly boardService: BoardService,
        private readonly unitService: UnitsService,
        private readonly prisma: PrismaService,
    ) {}

async createSoloGame(dto: CreateSoloGameDto): Promise<Game> {
  const player = await this.playerService.findById(dto.playerId);
  if (!player) throw new Error("Player doesn't exist");

  const colorEnemy = player.color === 'red' ? 'blue' : 'red';
  let enemy = await this.playerService.findById(1); // lub inny stały ID
  if (!enemy) enemy = await this.playerService.create('Enemy', colorEnemy);
  enemy.turn = false;

  // tutaj TODO: wczytać/persistować armię w DB; tymczasowo trzymaj w pamięci
  const playerArmy: Unit[] = []; // trzeba zasilić z DB lub wygenerować
  const enemyArmy = playerArmy.map(u => this.unitService.createUnit(u.id as any, enemy));

  const board = this.boardService.getDefaultBoard();
  const game = this.createGame(player as any, playerArmy, enemy as any, enemyArmy, board);
  game.phase = 'deployment';
  this.games.push(game);
  return game;
}

private createGame(
  player: Player,
  playerArmy: Unit[],
  enemy: Player,
  enemyArmy: Unit[],
  board: Board,
): Game {

    const game: Game = {
  id: this.idCounter++,
  player,
  playerArmy,
  enemy: enemy,
  enemyArmy,
  board,
  phase: 'created',
  createdAt: new Date(),
};

  return game
}

setUnitPosition(
  gameId: number,
  unitUniqueId: number,
  coords: HexCoords,
): Game | undefined {

  const game: Game = this.findById(gameId);
  const tile = game.board.tiles.find(t => t.coords.q === coords.q && t.coords.r === coords.r)
  let unit = game.playerArmy.find(u => u.uniqueId === unitUniqueId);
  if (!unit) {
    unit = game.enemyArmy.find(u => u.uniqueId === unitUniqueId);
  }
  if (!unit) {
    throw new Error('Unit not found');
  }
  let isOccupied: boolean = this.isOccupied(game.playerArmy, coords)
  isOccupied = this.isOccupied(game.enemyArmy, coords)
  if(isOccupied){
      unit.position = coords;
  }else{
    return undefined
  }

  return game;

}

findById(gameId: number): Game {
  const game: Game[] = this.games.filter(game => game.id === gameId);
  return game[0]
}

 isOccupied(units: Unit[], coords: HexCoords): boolean {
  return units.some(u =>
    u.position?.q != null &&
    u.position?.r != null &&
    u.position.q === coords.q &&
    u.position.r === coords.r
  );
}


finishDeployment(gameId: number): Game | undefined {
  const game: Game = this.findById(gameId);

  const isGameInDeployment: boolean = game.phase === "deployment" ? true: false;

  if (!isGameInDeployment) return undefined;

  const isPlayerArmyDeployed: boolean = game.playerArmy.filter(unit => unit.position == null).length  > 0 ? true : false;
  const isEnemyArmyDeployed: boolean = game.enemyArmy.filter(unit => unit.position == null).length  > 0 ? true : false;
  if(!(isPlayerArmyDeployed && isEnemyArmyDeployed)) return undefined;

  game.phase = 'battle';

  return game;
}

async moveUnit(gameId: number, unitUniqueId: number, targetCoords: HexCoords): Promise<HexCoords | undefined>{
   const game: Game = this.findById(gameId);
   const isPassable = game.board.tiles.find(coords => coords.coords == targetCoords)?.passable
   if(!isPassable){
    return undefined
   }
   const player = await this.playerService.findById(unitUniqueId)
   const currentPosition = player?.units.find(unit => unit.uniqueId == unitUniqueId)?.position
   if (!currentPosition) return undefined
   const costMovement = countMovement(currentPosition,targetCoords, game.board)

   return targetCoords

}

  async createStatefulSoloGame(dto: CreateSoloGameDto): Promise<GameState> {
    const player = await this.playerService.findById(dto.playerId);
    if (!player) throw new NotFoundException("Player doesn't exist");

    const enemy = await this.resolveEnemy(player);
    const board = this.boardService.getDefaultBoard();
    const playerArmy = this.unitService.getPlayerUnits(player.id);
    this.unitService.resetUnitsHp(playerArmy);
    this.unitService.resetPlayerUnits(enemy.id);
    const enemyArmy = this.unitService.cloneArmyForPlayer(playerArmy, enemy);
    this.unitService.resetBattleStatsForPlayers([player.id, enemy.id]);

    const baseState = this.buildSnapshot(
      '',
      player,
      enemy,
      playerArmy,
      enemyArmy,
      board,
    );

    const createdGame = await this.prisma.game.create({
      data: {
        phase: 'created',
        playerId: player.id,
        enemyId: enemy.id,
        status: PrismaGameStatus.not_started,
      },
    });

    const stateWithId: GameState = { ...baseState, gameId: createdGame.id.toString() };
    await this.prisma.game.update({
      where: { id: createdGame.id },
      data: {
        stateJson: stateWithId as unknown as Prisma.InputJsonValue,
        status: stateWithId.status as PrismaGameStatus,
      },
    });

    return stateWithId;
  }

  async getGameState(gameId: number): Promise<GameState> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game || !game.stateJson) {
      throw new NotFoundException('Game not found');
    }

    return game.stateJson as unknown as GameState;
  }

  async applyAction(gameId: number, actionDto: ApplyActionDto): Promise<GameState> {
    const currentState = await this.getGameState(gameId);
    const updatedState = this.reduceAction({ ...currentState }, actionDto);

    await this.prisma.$transaction([
      this.prisma.game.update({
        where: { id: gameId },
        data: {
          stateJson: updatedState as unknown as Prisma.InputJsonValue,
          status: updatedState.status as PrismaGameStatus,
        },
      }),
      this.prisma.gameAction.create({
        data: {
          gameId,
          turnNumber: updatedState.turnNumber,
          playerId: actionDto.playerId ?? updatedState.currentPlayerId,
          type: actionDto.type as PrismaGameActionType,
          payload: (actionDto.payload ?? {}) as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);

    return updatedState;
  }

  private reduceAction(currentState: GameState, actionDto: ApplyActionDto): GameState {
    const nextState: GameState = {
      ...currentState,
      status: this.bumpStatus(currentState.status),
      units: currentState.units.map(u => ({ ...u })),
    };

    switch (actionDto.type) {
      case 'MOVE': {
        const { unitId, q, r } = actionDto.payload ?? {};
        if (unitId !== undefined && q !== undefined && r !== undefined) {
          nextState.units = nextState.units.map(u =>
            u.unitId === String(unitId) ? { ...u, q, r } : u,
          );
        }
        break;
      }
      case 'ATTACK': {
        const { targetUnitId, damage } = actionDto.payload ?? {};
        if (targetUnitId !== undefined && typeof damage === 'number') {
          nextState.units = nextState.units.map(u =>
            u.unitId === String(targetUnitId)
              ? { ...u, currentHP: Math.max(0, u.currentHP - damage) }
              : u,
          );
        }
        break;
      }
      case 'END_TURN': {
        nextState.turnNumber += 1;
        nextState.currentPlayerId = this.nextPlayerId(
          nextState.players,
          nextState.currentPlayerId,
        );
        break;
      }
      default:
        break;
    }

    return nextState;
  }

  private bumpStatus(status: GameState['status']): GameState['status'] {
    if (status === 'finished' || status === 'paused') {
      return status;
    }
    return status === 'not_started' ? 'in_progress' : status;
  }

  private nextPlayerId(players: PlayerInGameState[], currentPlayerId: number): number {
    if (!players.length) return currentPlayerId;
    const currentIdx = players.findIndex(p => p.playerId === currentPlayerId);
    const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % players.length;
    return players[nextIdx].playerId;
  }

  private buildSnapshot(
    gameId: string,
    player: Player,
    enemy: Player,
    playerArmy: Unit[],
    enemyArmy: Unit[],
    board: Board,
  ): GameState {
    const playersState: PlayerInGameState[] = [
      { playerId: player.id, name: player.name, color: player.color },
      { playerId: enemy.id, name: enemy.name, color: enemy.color },
    ];

    const unitsState = [...playerArmy, ...enemyArmy].map(unit => this.toUnitState(unit));

    return {
      gameId,
      turnNumber: 1,
      currentPlayerId: player.id,
      status: 'not_started',
      players: playersState,
      units: unitsState,
      tiles: this.toTilesState(board),
    };
  }

  private toUnitState(unit: Unit): UnitOnBoardState {
    const hp = this.unitService.getCurrentHp(unit.uniqueId) ?? unit.maxHp;
    return {
      unitId: unit.uniqueId.toString(),
      ownerPlayerId: unit.playerId,
      template: unit.id,
      currentHP: hp,
      q: unit.position?.q ?? 0,
      r: unit.position?.r ?? 0,
    };
  }

  private toTilesState(board: Board): HexTileState[] {
    return board.tiles.map(tile => ({
      q: tile.coords.q,
      r: tile.coords.r,
      terrain: tile.terrain,
      passable: tile.passable,
      movementCost: tile.movementCost,
    }));
  }

  private async resolveEnemy(player: Player): Promise<Player> {
    const colorEnemy = player.color === 'red' ? 'blue' : 'red';
    let enemy = await this.playerService.findById(1);
    if (!enemy) enemy = await this.playerService.create('Enemy', colorEnemy);
    enemy.turn = false;
    return enemy;
  }
}
