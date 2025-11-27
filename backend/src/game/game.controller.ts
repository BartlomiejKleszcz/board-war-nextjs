import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { GameService } from './game.service';
import { CreateSoloGameDto } from './dto/create-solo-game.dto';
import { SetUnitPosition } from './dto/SetUnitPosition.dto';
import { HexCoords } from 'src/board/domain/hex.types';
import { Game } from './domain/game';
import { ApplyActionDto } from './dto/apply-action.dto';

@Controller('game')
export class GameController {

    constructor(private readonly gameService: GameService){}

    @Post('solo')
    @ApiOperation({summary: 'generate standard solo game'})
    createSoloGame(@Body() dto: CreateSoloGameDto){
        const game = this.gameService.createSoloGame(dto);
        return game;
    }

    @Patch(':gameId/units/:unitUniqueId/position')
    @ApiOperation({summary: 'setting unit on the board'})
    setUnitPosition(@Param('gameId', ParseIntPipe) gameId: number, 
                    @Param('unitUniqueId', ParseIntPipe) unitUniqueId: number,
                    @Body() setUnitPositionDto: SetUnitPosition): Game | undefined{
                        let coords: HexCoords = {
                            q: setUnitPositionDto.q,
                            r: setUnitPositionDto.r
                        }
                        return this.gameService.setUnitPosition(gameId, unitUniqueId, coords)
                    }

    @Post('state/solo')
    @ApiOperation({summary: 'create solo game state and persist snapshot'})
    async createStatefulSoloGame(@Body() dto: CreateSoloGameDto) {
        return this.gameService.createStatefulSoloGame(dto);
    }

    @Get(':gameId/state')
    @ApiOperation({summary: 'load persisted game state snapshot'})
    async getGameState(@Param('gameId', ParseIntPipe) gameId: number) {
        return this.gameService.getGameState(gameId);
    }

    @Post(':gameId/actions')
    @ApiOperation({summary: 'apply action and update game state'})
    async applyAction(
        @Param('gameId', ParseIntPipe) gameId: number,
        @Body() actionDto: ApplyActionDto,
    ) {
        return this.gameService.applyAction(gameId, actionDto);
    }


}
