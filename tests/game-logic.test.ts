import { BoardModel, Cell, SuperTileType, Tile } from "../assets/Script/BoardModel";
import { ColumnArea, RadiusArea, RowArea, WholeBoardArea } from "../assets/Script/BurnArea";
import { GameResult, GameRules, GameSession } from "../assets/Script/GameSession";

function assertEqual<T>(actual: T, expected: T, message: string): void {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    if (actualJson !== expectedJson) {
        throw new Error(`${message}: expected ${expectedJson}, got ${actualJson}`);
    }
}

function sequence(values: number[]): () => number {
    let index = 0;
    return () => {
        if (index >= values.length) {
            throw new Error("random sequence exhausted");
        }
        return values[index++];
    };
}

function colors(values: number[], colorsCount: number): () => number {
    return sequence(values.map((color) => (color + 0.5) / colorsCount));
}

function sortCells(cells?: Cell[]): Cell[] {
    return cells ? cells.slice().sort((a, b) => a.row - b.row || a.col - b.col) : [];
}

function readColors(board: BoardModel): (number | string)[][] {
    const grid: (number | string)[][] = [];
    for (let row = 0; row < board.rows; row++) {
        grid[row] = [];
        for (let col = 0; col < board.cols; col++) {
            const tile: Tile | null = board.getTile({ row, col });
            if (!tile) {
                grid[row][col] = "empty";
            } else {
                grid[row][col] = tile.kind === "color" ? tile.color : `super:${SuperTileType[tile.type]}`;
            }
        }
    }
    return grid;
}

function rules(overrides: Partial<GameRules>): GameRules {
    return {
        targetScore: 1000,
        maxMoves: 10,
        minGroupSize: 2,
        pointsPerTile: 10,
        maxShuffles: 3,
        superTileThreshold: 5,
        superTileRadius: 1,
        bombCount: 1,
        bombRadius: 1,
        teleportCount: 1,
        ...overrides,
    };
}

function testGroupsAndGravity(): void {
    const board = new BoardModel(3, 3, 4, colors([
        0, 0, 1,
        2, 0, 1,
        2, 2, 2,
        3, 3, 3,
    ], 4));

    assertEqual(
        sortCells(board.findGroup({ row: 2, col: 2 })),
        [{ row: 1, col: 0 }, { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }],
        "group follows only same-colored neighbours"
    );

    const group = board.findGroup({ row: 0, col: 0 });
    board.removeCells(group);
    const gravity = board.applyGravity();

    assertEqual(gravity.moves, [
        { from: { row: 1, col: 0 }, to: { row: 0, col: 0 } },
        { from: { row: 2, col: 0 }, to: { row: 1, col: 0 } },
        { from: { row: 2, col: 1 }, to: { row: 0, col: 1 } },
    ], "tiles fall down");
    assertEqual(gravity.spawned.map((spawned) => spawned.cell), [
        { row: 2, col: 0 },
        { row: 1, col: 1 },
        { row: 2, col: 1 },
    ], "new tiles fill the top");
    assertEqual(readColors(board), [
        [2, 2, 1],
        [2, 3, 1],
        [3, 3, 2],
    ], "grid after gravity");
}

function testAreas(): void {
    const board = new BoardModel(4, 4, 2);

    const center = { row: 2, col: 2 };

    assertEqual(new RowArea().cellsAround(board, center).every((cell) => cell.row === 2), true, "row keeps the row");
    assertEqual(new RowArea().cellsAround(board, center).length, 4, "row covers all columns");
    assertEqual(new ColumnArea().cellsAround(board, center).length, 4, "column covers all rows");
    assertEqual(new RadiusArea(1).cellsAround(board, { row: 0, col: 0 }).length, 4, "radius is clipped by the corner");
    assertEqual(new RadiusArea(1).cellsAround(board, center).length, 9, "radius 1 is a 3x3 square");
    assertEqual(new WholeBoardArea().cellsAround(board).length, 16, "whole board");
}

function testShuffleKeepsTiles(): void {
    const board = new BoardModel(3, 3, 5);
    const before = readColors(board).reduce((all, row) => all.concat(row), []).sort();

    const moves = board.shuffle();
    const after = readColors(board).reduce((all, row) => all.concat(row), []).sort();

    assertEqual(after, before, "shuffle keeps the same tiles");
    assertEqual(moves.length, 9, "every cell gets a tile");
}

function testSuperTile(): void {
    const board = new BoardModel(1, 4, 3, colors([0, 0, 0, 1, 2, 1, 0, 0, 1, 2], 3));
    const session = new GameSession(board, rules({ superTileThreshold: 2 }), sequence([0.1]));

    const created = session.tryMove({ row: 0, col: 0 });
    assertEqual(created?.createdSuperTile, { cell: { row: 0, col: 0 }, tile: { kind: "super", type: SuperTileType.Row } }, "big group creates a super tile at the clicked cell");
    assertEqual(readColors(board), [["super:Row", 2, 1, 1]], "super tile stays, gaps are refilled");
    assertEqual([session.score, session.movesLeft], [30, 9], "burned group is scored");

    const activated = session.tryMove({ row: 0, col: 0 });
    assertEqual(activated?.burned.length, 4, "row super tile burns the whole row");
    assertEqual([session.score, session.movesLeft], [70, 8], "super tile activation costs a move");
}

function testBomb(): void {
    const board = new BoardModel(1, 4, 3, colors([0, 1, 2, 2, 1, 1, 0], 3));
    const session = new GameSession(board, rules({ bombRadius: 1 }));

    const outcome = session.tryBomb({ row: 0, col: 1 });
    assertEqual(sortCells(outcome?.burned), [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }], "bomb burns cells in radius");
    assertEqual([session.score, session.movesLeft, session.bombsLeft], [30, 10, 0], "bomb scores without spending a move");
    assertEqual(session.tryBomb({ row: 0, col: 1 }), null, "no bombs left");
}

function testTeleport(): void {
    const board = new BoardModel(2, 2, 2, colors([0, 0, 1, 1], 2));
    const session = new GameSession(board, rules({}));

    assertEqual(session.trySwap({ row: 0, col: 0 }, { row: 0, col: 0 }), null, "cannot swap a tile with itself");

    session.trySwap({ row: 0, col: 0 }, { row: 1, col: 1 });
    assertEqual(readColors(board), [[1, 0], [1, 0]], "tiles are swapped");
    assertEqual([session.teleportsLeft, session.movesLeft], [0, 10], "teleport is consumed without spending a move");
}

function testDeadlockLosesAfterShuffles(): void {
    let toggle = false;
    const alternating = () => (toggle = !toggle) ? 0.25 : 0.75;
    const board = new BoardModel(1, 2, 2, alternating);
    const session = new GameSession(board, rules({ maxShuffles: 3 }));

    const shuffles = session.resolveDeadlock();
    assertEqual([shuffles.length, session.shufflesLeft, session.result], [3, 0, GameResult.NoPossibleMoves], "three shuffles, then loss");
}

function testWinAndOutOfMoves(): void {
    const winning = new GameSession(new BoardModel(1, 2, 2, colors([0, 0, 1, 0], 2)), rules({ targetScore: 20 }));
    winning.tryMove({ row: 0, col: 0 });
    assertEqual(winning.result, GameResult.Win, "target score reached");
    assertEqual(winning.tryMove({ row: 0, col: 0 }), null, "no moves after the game is over");

    const losing = new GameSession(new BoardModel(1, 2, 2, colors([0, 0, 1, 1], 2)), rules({ maxMoves: 1 }));
    losing.tryMove({ row: 0, col: 0 });
    assertEqual(losing.result, GameResult.OutOfMoves, "out of moves");
}

testGroupsAndGravity();
testAreas();
testShuffleKeepsTiles();
testSuperTile();
testBomb();
testTeleport();
testDeadlockLosesAfterShuffles();
testWinAndOutOfMoves();
console.log("All game logic checks passed");
