// board.controller.ts
import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IsNumber, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BoardService } from './board.service';
import { HexCoords } from './domain/hex.types';
import { countMovement } from './domain/hex.utils';

class HexCoordsDto implements HexCoords {
  @IsNumber() q!: number;
  @IsNumber() r!: number;
}

class MoveUnitDto {
  @ValidateNested() @Type(() => HexCoordsDto) @IsObject()
  currentPosition!: HexCoordsDto;

  @ValidateNested() @Type(() => HexCoordsDto) @IsObject()
  targetCoords!: HexCoordsDto;
}

@Controller('board')
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @Get('default')
  @ApiOperation({ summary: 'Get the default game board' })
  @ApiResponse({ status: 200, description: 'The default game board.' })
  getDefaultBoard() {
    return this.boardService.getDefaultBoard();
  }

  @Post('move')
  @ApiOperation({ summary: 'Calculate movement cost between two tiles' })
  @ApiBody({ type: MoveUnitDto })
  moveUnit(@Body() body: MoveUnitDto) {
    if (!body?.currentPosition || !body?.targetCoords) {
      throw new BadRequestException('currentPosition and targetCoords are required');
    }

    return this.boardService.countDistanceBetweenTwoTilles(body.currentPosition, body.targetCoords);
  }
}
