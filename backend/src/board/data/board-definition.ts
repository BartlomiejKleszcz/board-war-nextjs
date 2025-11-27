// src/board/data/board-definition.ts
import { HexCoords, HexTile, TerrainType } from '../domain/hex.types';
import GameBoard from '../domain/board';

const BOARD_WIDTH = 30;
const BOARD_HEIGHT = 30;
const SEED = 12345; // deterministic map; change seed for another layout

type Rng = () => number;

function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state * 1775525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const rng = createRng(SEED);

const directions: HexCoords[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

const coordKey = (q: number, r: number) => `${q},${r}`;
const tileMap = new Map<string, HexTile>();

function setTile(q: number, r: number, terrain: TerrainType, passable: boolean, movementCost: number) {
  const key = coordKey(q, r);
  const tile = tileMap.get(key);
  if (!tile) return;
  tile.terrain = terrain;
  tile.passable = passable;
  tile.movementCost = movementCost;
}

function neighbors(q: number, r: number): HexCoords[] {
  return directions
    .map(d => ({ q: q + d.q, r: r + d.r }))
    .filter(c => c.q >= 0 && c.q < BOARD_WIDTH && c.r >= 0 && c.r < BOARD_HEIGHT);
}

function initBase() {
  for (let q = 0; q < BOARD_WIDTH; q++) {
    for (let r = 0; r < BOARD_HEIGHT; r++) {
      tileMap.set(coordKey(q, r), {
        coords: { q, r },
        terrain: TerrainType.Plain,
        passable: true,
        movementCost: 1,
      });
    }
  }
}

function addLake(centerQ: number, centerR: number, radius: number): HexCoords {
  for (let q = centerQ - radius; q <= centerQ + radius; q++) {
    for (let r = centerR - radius; r <= centerR + radius; r++) {
      if (q < 0 || q >= BOARD_WIDTH || r < 0 || r >= BOARD_HEIGHT) continue;
      const dist = Math.abs(centerQ - q) + Math.abs(centerR - r);
      if (dist <= radius * 2) {
        setTile(q, r, TerrainType.Water, false, 99);
      }
    }
  }
  return { q: centerQ, r: centerR };
}

function carveRiver(): HexCoords[] {
  let q = 0;
  let r = Math.floor(BOARD_HEIGHT * 0.2 + rng() * BOARD_HEIGHT * 0.6);
  const maxSteps = BOARD_WIDTH * 3;
  const path: HexCoords[] = [];

  for (let step = 0; step < maxSteps && q < BOARD_WIDTH; step++) {
    setTile(q, r, TerrainType.Water, false, 99);
    path.push({ q, r });

    const choice = rng();
    if (choice < 0.6) {
      q += 1; // flow east
    } else if (choice < 0.8) {
      r += rng() > 0.5 ? 1 : -1; // meander vertically
    } else {
      q += 1;
      r += rng() > 0.5 ? 1 : -1;
    }

    q = Math.max(0, Math.min(BOARD_WIDTH - 1, q));
    r = Math.max(0, Math.min(BOARD_HEIGHT - 1, r));
  }

  return path;
}

function connectLakeToRiver(lakeCenter: HexCoords, riverPath: HexCoords[]) {
  const nearestRiver = riverPath.reduce((best, curr) => {
    const dist = Math.abs(curr.q - lakeCenter.q) + Math.abs(curr.r - lakeCenter.r);
    if (best === null) return { coord: curr, dist };
    return dist < best.dist ? { coord: curr, dist } : best;
  }, null as { coord: HexCoords; dist: number } | null);

  if (!nearestRiver) return;

  let q = lakeCenter.q;
  let r = lakeCenter.r;
  const target = nearestRiver.coord;

  while (q !== target.q || r !== target.r) {
    setTile(q, r, TerrainType.Water, false, 99);

    if (q !== target.q) {
      q += Math.sign(target.q - q);
    } else if (r !== target.r) {
      r += Math.sign(target.r - r);
    }
  }
  setTile(target.q, target.r, TerrainType.Water, false, 99);
}

function seedCluster(
  terrain: TerrainType,
  seeds: number,
  maxRadius: number,
  passable: boolean,
  movementCost: number,
  spread: number,
) {
  for (let i = 0; i < seeds; i++) {
    const q = 2 + Math.floor(rng() * (BOARD_WIDTH - 4));
    const r = 2 + Math.floor(rng() * (BOARD_HEIGHT - 4));
    const frontier: { q: number; r: number; depth: number }[] = [{ q, r, depth: 0 }];

    while (frontier.length) {
      const cur = frontier.pop()!;
      setTile(cur.q, cur.r, terrain, passable, movementCost);
      if (cur.depth >= maxRadius) continue;
      for (const n of neighbors(cur.q, cur.r)) {
        if (rng() < spread) {
          frontier.push({ q: n.q, r: n.r, depth: cur.depth + 1 });
        }
      }
    }
  }
}

function addSwampsNearWater(probability: number) {
  const waterTiles = Array.from(tileMap.values()).filter(t => t.terrain === TerrainType.Water);
  for (const wt of waterTiles) {
    for (const n of neighbors(wt.coords.q, wt.coords.r)) {
      if (rng() < probability) {
        setTile(n.q, n.r, TerrainType.Swamp, true, 3);
      }
    }
  }
}

function addFords(count: number) {
  const candidates = Array.from(tileMap.values()).filter(
    t =>
      t.terrain === TerrainType.Water &&
      t.coords.q > 0 &&
      t.coords.q < BOARD_WIDTH - 1 &&
      t.coords.r > 0 &&
      t.coords.r < BOARD_HEIGHT - 1,
  );
  for (let i = 0; i < count && candidates.length; i++) {
    const idx = Math.floor(rng() * candidates.length);
    const tile = candidates[idx];
    if (tile) {
      tile.terrain = TerrainType.Ford;
      tile.passable = true;
      tile.movementCost = 2;
    }
  }
}

function carveWindingRoad(from: HexCoords, to: HexCoords, wiggle = 0.25) {
  let q = from.q;
  let r = from.r;
  const clampQ = (v: number) => Math.max(0, Math.min(BOARD_WIDTH - 1, v));
  const clampR = (v: number) => Math.max(0, Math.min(BOARD_HEIGHT - 1, v));

  const step = () => {
    const dq = Math.sign(to.q - q);
    const dr = Math.sign(to.r - r);
    const options: HexCoords[] = [
      { q: q + dq, r },
      { q, r: r + dr },
    ];

    // losowe skręty tylko w jednej osi
    if (rng() < wiggle) {
      if (rng() < 0.5) {
        options.push({ q: q + (rng() > 0.5 ? 1 : -1), r });
      } else {
        options.push({ q, r: r + (rng() > 0.5 ? 1 : -1) });
      }
    }

    options.sort(
      (a, b) =>
        Math.abs(a.q - to.q) + Math.abs(a.r - to.r) - (Math.abs(b.q - to.q) + Math.abs(b.r - to.r)),
    );

    const next = options[0];
    q = clampQ(next.q);
    r = clampR(next.r);
  };

  while (q !== to.q || r !== to.r) {
    const key = coordKey(q, r);
    const tile = tileMap.get(key);
    if (tile && tile.terrain !== TerrainType.City) {
      if (tile.terrain === TerrainType.Water) {
        tile.terrain = TerrainType.Bridge;
        tile.passable = true;
        tile.movementCost = 1;
      } else if (tile.terrain === TerrainType.Ford) {
        tile.passable = true;
        tile.movementCost = Math.min(tile.movementCost, 2);
      } else {
        tile.terrain = TerrainType.Road;
        tile.passable = true;
        tile.movementCost = Math.min(tile.movementCost, 1);
      }
    }

    step();
  }

  const endKey = coordKey(to.q, to.r);
  const endTile = tileMap.get(endKey);
  if (endTile && endTile.terrain === TerrainType.Water) {
    endTile.terrain = TerrainType.Bridge;
    endTile.passable = true;
    endTile.movementCost = 1;
  }
}

initBase();
const lakeCenter = addLake(Math.floor(BOARD_WIDTH * 0.2), Math.floor(BOARD_HEIGHT * 0.7), 2 + Math.floor(rng() * 2));
const riverPath = carveRiver();
connectLakeToRiver(lakeCenter, riverPath);
addFords(10);
seedCluster(TerrainType.Hill, 4, 3, true, 3, 0.55);
seedCluster(TerrainType.Forest, 8, 5, true, 2, 0.62);
addSwampsNearWater(0.3);

const citySpots: HexCoords[] = [
  { q: Math.floor(BOARD_WIDTH / 2), r: Math.floor(BOARD_HEIGHT / 2) },
  { q: 5, r: 5 },
  { q: BOARD_WIDTH - 6, r: 8 },
  { q: 8, r: BOARD_HEIGHT - 6 },
];
for (const c of citySpots) {
  setTile(c.q, c.r, TerrainType.City, true, 1);
}

carveWindingRoad(citySpots[0], citySpots[1], 0.45);
carveWindingRoad(citySpots[0], citySpots[2], 0.4);
carveWindingRoad(citySpots[0], citySpots[3], 0.35);
carveWindingRoad(citySpots[1], citySpots[2], 0.3);
carveWindingRoad(citySpots[2], { q: BOARD_WIDTH - 2, r: Math.floor(BOARD_HEIGHT / 2) }, 0.35);
// road exiting to the corner of the map
carveWindingRoad(citySpots[0], { q: BOARD_WIDTH - 1, r: BOARD_HEIGHT - 1 }, 0.2);

const tiles: HexTile[] = Array.from(tileMap.values());

export const DEFAULT_BOARD: GameBoard = {
  tiles,
  getHexTile() {
    return tiles;
  },
};
