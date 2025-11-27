import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PlayerService } from './player.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { Unit } from 'src/units/domain/unit.types';
import { PlayerRepositoryAdapter } from 'src/infrastructure/PlayerRepositoryAdapter';

@Controller('players')
export class PlayerController {

    private readonly playerService: PlayerService;

    constructor(playerService: PlayerService,
                playerRepository: PlayerRepositoryAdapter
    ) {
        this.playerService = playerService;
    }

    // @Post('create')
    // @ApiOperation({ summary: 'Create a new player' })
    // @ApiResponse({ status: 201, description: 'The player has been successfully created.' })
    // createPlayer(@Body() createPlayerDto: CreatePlayerDto)  {
    //     return this.playerService.createPlayer(createPlayerDto.name, createPlayerDto.color);
    // }
    @Post('create')
    @ApiOperation({summary: 'create a new player'})
    createPlayerDb(@Body() createPlayerDto: CreatePlayerDto)  {
        return this.playerService.create(createPlayerDto.name, createPlayerDto.color)
    }

    @Get()
    @ApiOperation({ summary: 'Get all players' })
    @ApiResponse({ status: 200, description: 'List of all players.' })
    getAllPlayers() {
        return this.playerService.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get player by ID' })
    @ApiResponse({ status: 200, description: 'The player with the specified ID.' })
    getPlayerById(@Param('id', ParseIntPipe) id: number ) {
        return this.playerService.findById(id);
    }

    @Put('update/:id')
    @ApiOperation({ summary: 'Update player details' })
    @ApiResponse({ status: 200, description: 'The player has been successfully updated.' })
    updatePlayer(@Param('id') id: number, @Body() updatePlayerDto: CreatePlayerDto) {
        return this.playerService.updatePlayer(id, updatePlayerDto.name, updatePlayerDto.color);
    }

    @Delete('delete/:id')
    @ApiOperation({ summary: 'Delete a player by ID' })
    @ApiResponse({ status: 200, description: 'The player has been successfully deleted.' })
    deletePlayer(@Param('id') id: number) {
        return this.playerService.deletePlayer(id);
    }

    @Post(':playerId/units/:unitId')
    @ApiOperation({ summary: 'Add a unit to a player' })
    @ApiResponse({ status: 201, description: 'The unit has been successfully added to the player.' })
    addUnitToPlayer(
        @Param('playerId', ParseIntPipe) playerId: number, 
        @Param('unitId') unitId: string) {
        
        const player = this.playerService.addUnitToPlayer(playerId, unitId);
        if (player) {
            return player;
        } else {
            throw new Error('Player not found');
        }   
    }

    @Put(':playerId/units/:unitUniqueId')
    @ApiOperation({ summary: 'Delete unit of player' })
    @ApiResponse({ status: 200, description: 'The unit has been successfully deleted from the player.' })
    deleteUnitFromPlayer(
        @Param('playerId', ParseIntPipe) playerId: number, 
        @Param('unitUniqueId', ParseIntPipe) unitUniqueId: number) {
        const player = this.playerService.deleteUnitFromPlayer(playerId, unitUniqueId);
        if (player) {
            return player;
        } else {
            throw new Error('Player or Unit not found');
        }
    }

    @Get(':playerId/budget')
    @ApiOperation({ summary: 'Get player budget by ID' })
    @ApiResponse({ status: 200, description: 'The budget of the player with the specified ID.' })
    getPlayerBudget(@Param('playerId', ParseIntPipe) playerId: number) {
        const budget = this.playerService.getPlayerBudget(playerId);
        if (budget !== undefined) {
            return { budget };
        } else {
            throw new Error('Player not found');
        }
    }

}
