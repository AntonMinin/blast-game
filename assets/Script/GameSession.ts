import { BoardModel, Cell, GravityResult, PlacedTile, SuperTile, SuperTileType, TileMove } from "./BoardModel";
import { BurnArea, ColumnArea, RadiusArea, RowArea, WholeBoardArea } from "./BurnArea";

export enum GameResult {
    InProgress,
    Win,
    OutOfMoves,
    NoPossibleMoves,
}

export interface GameRules {
    targetScore: number;
    maxMoves: number;
    minGroupSize: number;
    pointsPerTile: number;
    maxShuffles: number;
    superTileThreshold: number;
    superTileRadius: number;
    bombCount: number;
    bombRadius: number;
    teleportCount: number;
}

export interface BurnOutcome {
    burned: Cell[];
    createdSuperTile: PlacedTile | null;
    gravity: GravityResult;
    shuffles: TileMove[][];
}

export interface SwapOutcome {
    first: Cell;
    second: Cell;
    shuffles: TileMove[][];
}

const SUPER_TILE_TYPES = [SuperTileType.Row, SuperTileType.Column, SuperTileType.Radius, SuperTileType.Board];

export class GameSession {
    private currentScore = 0;
    private remainingMoves: number;
    private remainingShuffles: number;
    private remainingBombs: number;
    private remainingTeleports: number;
    private isDeadlocked = false;
    private readonly bombArea: BurnArea;
    private readonly superTileAreas: Record<SuperTileType, BurnArea>;

    constructor(
        private readonly board: BoardModel,
        private readonly rules: GameRules,
        private readonly random: () => number = Math.random
    ) {
        this.remainingMoves = rules.maxMoves;
        this.remainingShuffles = rules.maxShuffles;
        this.remainingBombs = rules.bombCount;
        this.remainingTeleports = rules.teleportCount;

        this.bombArea = new RadiusArea(rules.bombRadius);
        this.superTileAreas = {
            [SuperTileType.Row]: new RowArea(),
            [SuperTileType.Column]: new ColumnArea(),
            [SuperTileType.Radius]: new RadiusArea(rules.superTileRadius),
            [SuperTileType.Board]: new WholeBoardArea(),
        };
    }

    public get score(): number {
        return this.currentScore;
    }

    public get targetScore(): number {
        return this.rules.targetScore;
    }

    public get movesLeft(): number {
        return this.remainingMoves;
    }

    public get shufflesLeft(): number {
        return this.remainingShuffles;
    }

    public get bombsLeft(): number {
        return this.remainingBombs;
    }

    public get teleportsLeft(): number {
        return this.remainingTeleports;
    }

    public get result(): GameResult {
        if (this.currentScore >= this.rules.targetScore) {
            return GameResult.Win;
        }
        if (this.isDeadlocked) {
            return GameResult.NoPossibleMoves;
        }
        if (this.remainingMoves <= 0) {
            return GameResult.OutOfMoves;
        }
        return GameResult.InProgress;
    }

    public tryMove(cell: Cell): BurnOutcome | null {
        const tile = this.board.getTile(cell);
        if (this.result !== GameResult.InProgress || !tile) {
            return null;
        }

        return tile.kind === "super" ? this.activateSuperTile(cell, tile) : this.burnGroup(cell);
    }

    public tryBomb(cell: Cell): BurnOutcome | null {
        if (this.result !== GameResult.InProgress || this.remainingBombs <= 0) {
            return null;
        }

        this.remainingBombs--;
        return this.burn(this.bombArea.cellsAround(this.board, cell), null);
    }

    public trySwap(first: Cell, second: Cell): SwapOutcome | null {
        const isSameCell = first.row === second.row && first.col === second.col;
        if (this.result !== GameResult.InProgress || this.remainingTeleports <= 0 || isSameCell) {
            return null;
        }

        this.remainingTeleports--;
        this.board.swapTiles(first, second);
        return { first, second, shuffles: this.resolveDeadlock() };
    }

    public resolveDeadlock(): TileMove[][] {
        const shuffles: TileMove[][] = [];

        while (this.result === GameResult.InProgress && !this.hasAvailableMove()) {
            if (this.remainingShuffles <= 0) {
                this.isDeadlocked = true;
                break;
            }
            this.remainingShuffles--;
            shuffles.push(this.board.shuffle());
        }

        return shuffles;
    }

    private burnGroup(cell: Cell): BurnOutcome | null {
        const group = this.board.findGroup(cell);
        if (group.length < this.rules.minGroupSize) {
            return null;
        }

        this.remainingMoves--;
        const superTile = group.length > this.rules.superTileThreshold
            ? { cell, tile: this.randomSuperTile() }
            : null;

        return this.burn(group, superTile);
    }

    private activateSuperTile(cell: Cell, tile: SuperTile): BurnOutcome {
        this.remainingMoves--;
        return this.burn(this.superTileAreas[tile.type].cellsAround(this.board, cell), null);
    }

    private burn(cells: Cell[], superTile: PlacedTile | null): BurnOutcome {
        this.currentScore += cells.length * this.rules.pointsPerTile;
        this.board.removeCells(cells);

        if (superTile) {
            this.board.placeTile(superTile.cell, superTile.tile);
        }

        const gravity = this.board.applyGravity();
        return { burned: cells, createdSuperTile: superTile, gravity, shuffles: this.resolveDeadlock() };
    }

    private hasAvailableMove(): boolean {
        return this.board.hasSuperTile() || this.board.hasGroupOfSize(this.rules.minGroupSize);
    }

    private randomSuperTile(): SuperTile {
        const type = SUPER_TILE_TYPES[Math.floor(this.random() * SUPER_TILE_TYPES.length)];
        return { kind: "super", type };
    }
}
