import { Board } from "./board";
import { HexCoords, HexTile } from "./hex.types";


export function countMovement(positionHexCoords: HexCoords, targetHexCoords: HexCoords, board: Board) {
  const distanceQ = positionHexCoords.q - targetHexCoords.q;
  const distanceR = positionHexCoords.r - targetHexCoords.r;
  const distanceS = -(positionHexCoords.q + positionHexCoords.r) + (targetHexCoords.q + targetHexCoords.r);
  return (Math.abs(distanceQ) + Math.abs(distanceR) + Math.abs(distanceS)) / 2;
}



export function countRoad(positionHexTile: HexTile, targetHexTile: HexTile, board: Board){

  let movementCost = 0;
  let road: HexTile[]= [];

  while(positionHexTile.coords.q !== targetHexTile.coords.q &&
        positionHexTile.coords.r !== targetHexTile.coords.r
   ) {
    let direction: number[] | undefined = determineDirection(positionHexTile, targetHexTile, board)
    if(direction !== undefined){
      let newHexCoords: HexCoords = {
        q: positionHexTile.coords.q + direction[0],
        r: positionHexTile.coords.r + direction[1]
      }
      let newPosition: HexTile | undefined = board.tiles.find(tile => tile.coords == newHexCoords)
      if (newPosition !== undefined) road.push(newPosition)
      movementCost =+ 1;
    }

   }

}

function determineDirection(positionHexTile: HexTile, targetHexTile: HexTile, board: Board): number[] | undefined{

  if (positionHexTile.coords.q - targetHexTile.coords.q < 0 ) return [1,0]
  if (positionHexTile.coords.q - targetHexTile.coords.q > 0 ) return [-1,0]
  if (positionHexTile.coords.q - targetHexTile.coords.q === 0 ) {
    if(positionHexTile.coords.r - targetHexTile.coords.r < 0) return [0,1]
    if(positionHexTile.coords.r - targetHexTile.coords.r > 0) return [0,-1]
    if(positionHexTile.coords.r - targetHexTile.coords.r === 0) return [0,0]

  return undefined
  }



};
export type Road = {
  movementCost: number;
  road: HexTile[];


};
export type TileWithCostReach = {
  tile: HexTile;
  cost: number;
  visited: boolean;
}
export function roadByDijkstra(
  positionHexTile: HexTile,
  targetHexTile: HexTile,
  board: Board
): Road | undefined {
  const tilesToCheck: TileWithCostReach[] = [];
  const closed: HexTile[] = [];
  const cameFrom: { tile: HexTile; prev: HexTile | null }[] = [];

  const startTile: TileWithCostReach = {
    tile: positionHexTile,
    cost: 0,
    visited: false,
  };

  tilesToCheck.push(startTile);
  cameFrom.push({ tile: positionHexTile, prev: null });

  const same = (a: HexTile, b: HexTile) =>
    a.coords.q === b.coords.q && a.coords.r === b.coords.r;

  const inList = (arr: HexTile[], t: HexTile) => arr.some(x => same(x, t));

  const getPrevEntry = (t: HexTile) => cameFrom.find(e => same(e.tile, t));

  while (tilesToCheck.length !== 0) {
    let currentIndex = 0;
    for (let i = 1; i < tilesToCheck.length; i++) {
      if (tilesToCheck[i].cost < tilesToCheck[currentIndex].cost) {
        currentIndex = i;
      }
    }

    const current = tilesToCheck.splice(currentIndex, 1)[0];
    current.visited = true;
    closed.push(current.tile);

    if (same(current.tile, targetHexTile)) {
      const path: HexTile[] = [];
      let cur: HexTile | null = current.tile;
      while (cur) {
        path.push(cur);
        const entry = getPrevEntry(cur);
        cur = entry ? entry.prev : null;
      }
      return { movementCost: current.cost, road: path.reverse() };
    }

    const neighbors: HexTile[] = getNeighbors(current.tile, board);

    for (const n of neighbors) {
      if (inList(closed, n)) continue;

      const tentative = current.cost + n.movementCost;

      const existing = tilesToCheck.find(x => same(x.tile, n));
      if (!existing) {
        tilesToCheck.push({ tile: n, cost: tentative, visited: false });
        cameFrom.push({ tile: n, prev: current.tile });
      } else if (tentative < existing.cost) {
        existing.cost = tentative;
        const prevEntry = getPrevEntry(n);
        if (prevEntry) prevEntry.prev = current.tile;
      }
    }
  }

  return undefined;
}

function getNeighbors(tile: HexTile, board: Board): HexTile[] {
  const dirs = [
    { q: 1, r: 0 },  { q: -1, r: 0 },
    { q: 0, r: 1 },  { q: 0, r: -1 },
  ];
  return dirs
    .map(({ q, r }) =>
      board.tiles.find(
        t => t.coords.q === tile.coords.q + q && t.coords.r === tile.coords.r + r,
      ),
    )
    .filter((t): t is HexTile => !!t && t.passable);
}
