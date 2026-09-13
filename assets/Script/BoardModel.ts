export interface Cell {
    row: number;
    col: number;
}

export enum SuperTileType {
    Row,
    Column,
    Radius,
    Board,
}

export interface ColorTile {
    kind: "color";
    color: number;
}

export interface SuperTile {
    kind: "super";
    type: SuperTileType;
}

export type Tile = ColorTile | SuperTile;

export interface TileMove {
    from: Cell;
    to: Cell;
}

export interface PlacedTile {
    cell: Cell;
    tile: Tile;
}

export interface GravityResult {
    moves: TileMove[];
    spawned: PlacedTile[];
}

export class BoardModel {
    private readonly grid: (Tile | null)[][] = [];

    constructor(
        public readonly rows: number,
        public readonly cols: number,
        private readonly colorsCount: number,
        private readonly random: () => number = Math.random
    ) {
        for (let row = 0; row < rows; row++) {
            this.grid[row] = [];
            for (let col = 0; col < cols; col++) {
                this.grid[row][col] = this.randomColorTile();
            }
        }
    }

    public getTile(cell: Cell): Tile | null {
        return this.grid[cell.row][cell.col];
    }

    public allCells(): Cell[] {
        const cells: Cell[] = [];
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                cells.push({ row, col });
            }
        }
        return cells;
    }

    public findGroup(start: Cell): Cell[] {
        const startTile = this.getTile(start);
        if (!startTile || startTile.kind !== "color") {
            return [];
        }

        const group: Cell[] = [];
        const visited = new Set<string>();
        const stack: Cell[] = [start];

        for (let cell = stack.pop(); cell; cell = stack.pop()) {
            const key = `${cell.row}:${cell.col}`;

            if (!this.isInside(cell) || visited.has(key) || !this.hasColor(cell, startTile.color)) {
                continue;
            }

            visited.add(key);
            group.push(cell);
            stack.push(
                { row: cell.row + 1, col: cell.col },
                { row: cell.row - 1, col: cell.col },
                { row: cell.row, col: cell.col + 1 },
                { row: cell.row, col: cell.col - 1 }
            );
        }

        return group;
    }

    public hasGroupOfSize(minSize: number): boolean {
        return this.allCells().some((cell) => this.findGroup(cell).length >= minSize);
    }

    public hasSuperTile(): boolean {
        return this.allCells().some((cell) => {
            const tile = this.getTile(cell);
            return tile !== null && tile.kind === "super";
        });
    }

    public removeCells(cells: Cell[]): void {
        for (const cell of cells) {
            this.grid[cell.row][cell.col] = null;
        }
    }

    public placeTile(cell: Cell, tile: Tile | null): void {
        this.grid[cell.row][cell.col] = tile;
    }

    public swapTiles(first: Cell, second: Cell): void {
        const firstTile = this.getTile(first);
        this.placeTile(first, this.getTile(second));
        this.placeTile(second, firstTile);
    }

    public shuffle(): TileMove[] {
        const targets = this.allCells();
        const sources = targets.slice();

        for (let i = sources.length - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1));
            [sources[i], sources[j]] = [sources[j], sources[i]];
        }

        const tiles = sources.map((cell) => this.getTile(cell));
        targets.forEach((cell, index) => this.placeTile(cell, tiles[index]));

        return targets.map((to, index) => ({ from: sources[index], to }));
    }

    public applyGravity(): GravityResult {
        const result: GravityResult = { moves: [], spawned: [] };

        for (let col = 0; col < this.cols; col++) {
            let emptyBelow = 0;

            for (let row = 0; row < this.rows; row++) {
                if (this.grid[row][col] === null) {
                    emptyBelow++;
                } else if (emptyBelow > 0) {
                    const targetRow = row - emptyBelow;
                    this.grid[targetRow][col] = this.grid[row][col];
                    this.grid[row][col] = null;
                    result.moves.push({ from: { row, col }, to: { row: targetRow, col } });
                }
            }

            for (let row = this.rows - emptyBelow; row < this.rows; row++) {
                const tile = this.randomColorTile();
                this.grid[row][col] = tile;
                result.spawned.push({ cell: { row, col }, tile });
            }
        }

        return result;
    }

    private isInside(cell: Cell): boolean {
        return cell.row >= 0 && cell.row < this.rows && cell.col >= 0 && cell.col < this.cols;
    }

    private hasColor(cell: Cell, color: number): boolean {
        const tile = this.getTile(cell);
        return tile !== null && tile.kind === "color" && tile.color === color;
    }

    private randomColorTile(): ColorTile {
        return { kind: "color", color: Math.floor(this.random() * this.colorsCount) };
    }
}
