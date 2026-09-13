import { BoardModel, Cell } from "./BoardModel";

export interface BurnArea {
    cellsAround(board: BoardModel, center: Cell): Cell[];
}

export class RowArea implements BurnArea {
    public cellsAround(board: BoardModel, center: Cell): Cell[] {
        return board.allCells().filter((cell) => cell.row === center.row);
    }
}

export class ColumnArea implements BurnArea {
    public cellsAround(board: BoardModel, center: Cell): Cell[] {
        return board.allCells().filter((cell) => cell.col === center.col);
    }
}

export class RadiusArea implements BurnArea {
    constructor(private readonly radius: number) {}

    public cellsAround(board: BoardModel, center: Cell): Cell[] {
        return board.allCells().filter((cell) =>
            Math.abs(cell.row - center.row) <= this.radius && Math.abs(cell.col - center.col) <= this.radius
        );
    }
}

export class WholeBoardArea implements BurnArea {
    public cellsAround(board: BoardModel): Cell[] {
        return board.allCells();
    }
}
