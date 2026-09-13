import { BoardModel, Cell, GravityResult, Tile, TileMove } from "./BoardModel";
import { BurnOutcome, SwapOutcome } from "./GameSession";
import TileView from "./TileView";

const INTRO_ROW_DELAY = 0.04;
const INTRO_COL_DELAY = 0.015;
const BURN_WAVE_STEP = 0.035;
const BURN_WAVE_MAX_DELAY = 0.2;
const SHUFFLE_MAX_STAGGER = 0.15;
const SHUFFLE_PAUSE = 0.15;
const CLIP_PADDING = 10;

export interface BoardLayout {
    rows: number;
    cols: number;
    tileWidth: number;
    tileHeight: number;
}

export class BoardView {
    private readonly tiles: (TileView | null)[][] = [];

    constructor(
        private readonly root: cc.Node,
        private readonly tilePrefab: cc.Prefab,
        private readonly layout: BoardLayout,
        private readonly onTileClick: (cell: Cell) => void
    ) {
        for (let row = 0; row < layout.rows; row++) {
            this.tiles[row] = [];
        }
        this.clipToBoardArea();
    }

    public playIntro(board: BoardModel, onComplete: () => void): void {
        let duration = 0;

        for (const cell of board.allCells()) {
            const model = board.getTile(cell);
            if (!model) {
                throw new Error(`Board cell ${cell.row}:${cell.col} is empty`);
            }

            const tile = this.createTile(cell, model);
            const delay = cell.row * INTRO_ROW_DELAY + cell.col * INTRO_COL_DELAY;
            duration = Math.max(duration, tile.dropIn(this.toPosition(cell), delay));
        }

        this.callAfter(duration, onComplete);
    }

    public playBurn(origin: Cell, outcome: BurnOutcome, onComplete: () => void): void {
        const burnDuration = this.burnTiles(origin, outcome.burned);

        if (outcome.createdSuperTile) {
            const { cell, tile } = outcome.createdSuperTile;
            const superTile = this.createTile(cell, tile);
            superTile.node.setPosition(this.toPosition(cell));
            superTile.popIn(burnDuration);
        }

        const fallDuration = this.dropTiles(outcome.gravity, burnDuration);
        this.playShuffles(outcome.shuffles, Math.max(burnDuration, fallDuration), onComplete);
    }

    public playSwap(outcome: SwapOutcome, onComplete: () => void): void {
        const { first, second } = outcome;
        const firstTile = this.tileAt(first);
        const secondTile = this.tileAt(second);

        this.tiles[first.row][first.col] = secondTile;
        this.tiles[second.row][second.col] = firstTile;

        const duration = Math.max(
            firstTile.teleportTo(second, this.toPosition(second)),
            secondTile.teleportTo(first, this.toPosition(first))
        );
        this.playShuffles(outcome.shuffles, duration, onComplete);
    }

    public playShuffles(shuffles: TileMove[][], startDelay: number, onComplete: () => void): void {
        let delay = startDelay;
        for (const shuffle of shuffles) {
            delay = this.shuffleTiles(shuffle, delay);
        }
        this.callAfter(delay, onComplete);
    }

    public setSelected(cell: Cell, selected: boolean): void {
        this.tileAt(cell).setSelected(selected);
    }

    public playRejectedClick(cell: Cell): void {
        this.tileAt(cell).wobble();
    }

    private burnTiles(origin: Cell, cells: Cell[]): number {
        let duration = 0;

        for (const cell of cells) {
            const distance = Math.abs(cell.row - origin.row) + Math.abs(cell.col - origin.col);
            const delay = Math.min(distance * BURN_WAVE_STEP, BURN_WAVE_MAX_DELAY);
            duration = Math.max(duration, this.tileAt(cell).burn(delay));
            this.tiles[cell.row][cell.col] = null;
        }

        return duration;
    }

    private dropTiles(gravity: GravityResult, delay: number): number {
        let duration = 0;

        for (const move of gravity.moves) {
            const tile = this.tileAt(move.from);
            this.tiles[move.from.row][move.from.col] = null;
            this.tiles[move.to.row][move.to.col] = tile;

            const rowsToFall = move.from.row - move.to.row;
            duration = Math.max(duration, tile.fallTo(move.to, this.toPosition(move.to), rowsToFall, delay));
        }

        const spawnedInColumn = this.countSpawnedByColumn(gravity);
        for (const { cell, tile: model } of gravity.spawned) {
            const rowsToFall = spawnedInColumn[cell.col];
            const tile = this.createTile(cell, model);
            tile.node.setPosition(this.toPosition({ row: cell.row + rowsToFall, col: cell.col }));
            tile.node.opacity = 0;

            duration = Math.max(duration, tile.fallTo(cell, this.toPosition(cell), rowsToFall, delay));
        }

        return duration;
    }

    private shuffleTiles(moves: TileMove[], delay: number): number {
        const movingTiles = moves.map((move) => this.tileAt(move.from));
        let duration = delay;

        for (let index = 0; index < moves.length; index++) {
            const target = moves[index].to;
            const tile = movingTiles[index];
            this.tiles[target.row][target.col] = tile;

            const stagger = Math.random() * SHUFFLE_MAX_STAGGER;
            duration = Math.max(duration, tile.shuffleTo(target, this.toPosition(target), delay + stagger));
        }

        return duration + SHUFFLE_PAUSE;
    }

    private countSpawnedByColumn(gravity: GravityResult): number[] {
        const counts: number[] = [];
        for (let col = 0; col < this.layout.cols; col++) {
            counts[col] = 0;
        }
        for (const spawned of gravity.spawned) {
            counts[spawned.cell.col]++;
        }
        return counts;
    }

    private clipToBoardArea(): void {
        const { rows, cols, tileWidth, tileHeight } = this.layout;
        this.root.setContentSize(cols * tileWidth + CLIP_PADDING * 2, rows * tileHeight + CLIP_PADDING * 2);

        if (!this.root.getComponent(cc.Mask)) {
            this.root.addComponent(cc.Mask);
        }
    }

    private tileAt(cell: Cell): TileView {
        const tile = this.tiles[cell.row][cell.col];
        if (!tile) {
            throw new Error(`No tile view at ${cell.row}:${cell.col}`);
        }
        return tile;
    }

    private createTile(cell: Cell, model: Tile): TileView {
        const node = cc.instantiate(this.tilePrefab);
        node.parent = this.root;

        const tile = node.getComponent(TileView);
        tile.init(cell, model, this.onTileClick);
        this.tiles[cell.row][cell.col] = tile;
        return tile;
    }

    private toPosition(cell: Cell): cc.Vec2 {
        const { rows, cols, tileWidth, tileHeight } = this.layout;
        return cc.v2(
            (cell.col - (cols - 1) / 2) * tileWidth,
            (cell.row - (rows - 1) / 2) * tileHeight
        );
    }

    private callAfter(seconds: number, callback: () => void): void {
        cc.tween(this.root).delay(seconds).call(callback).start();
    }
}
