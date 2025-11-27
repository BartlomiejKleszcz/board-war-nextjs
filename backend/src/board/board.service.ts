import { BadRequestException, Injectable } from '@nestjs/common';
import { DEFAULT_BOARD } from './data/board-definition';
import GameBoard, { Board } from './domain/board';
import { HexCoords, HexTile } from './domain/hex.types';
import { Road, roadByDijkstra } from './domain/hex.utils';

@Injectable()
export class BoardService {

    private readonly board: GameBoard = DEFAULT_BOARD;

    getDefaultBoard(): GameBoard {
        return this.board;
    }

    countDistanceBetweenTwoTilles(fromCoords: HexCoords, toCoords: HexCoords
    ): Road {

        const board = this.getDefaultBoard();
        const same = (a: HexCoords, b: HexCoords) => a.q === b.q && a.r === b.r;

        const from = board.tiles.find(t => same(t.coords, fromCoords));
        const to = board.tiles.find(t => same(t.coords, toCoords));

        if (!from || !to) {
        throw new BadRequestException('Coords not on board');
        }

        const path = roadByDijkstra(from, to, board);
        if (!path) {
        throw new BadRequestException('Path not found');
        }
        return path;

    }
}
