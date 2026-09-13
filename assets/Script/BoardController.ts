import { BoardModel, Cell } from "./BoardModel";
import { BoardView } from "./BoardView";
import { BoosterPanelView, BoosterType } from "./BoosterPanelView";
import { BurnOutcome, GameResult, GameSession } from "./GameSession";
import { HudView } from "./HudView";
import ResultPopup from "./ResultPopup";
import { requireProperty } from "./requireProperty";

const { ccclass, property } = cc._decorator;

@ccclass
export default class BoardController extends cc.Component {
    @property(cc.Prefab)
    public tilePrefab: cc.Prefab | null = null;

    @property(cc.Integer)
    public rows: number = 8;

    @property(cc.Integer)
    public cols: number = 8;

    @property(cc.Integer)
    public tileSizeX: number = 100;

    @property(cc.Integer)
    public tileSizeY: number = 100;

    @property(cc.Integer)
    public colorsCount: number = 5;

    @property(cc.Integer)
    public minGroupSize: number = 2;

    @property(cc.Integer)
    public pointsPerTile: number = 10;

    @property(cc.Integer)
    public targetScore: number = 500;

    @property(cc.Integer)
    public maxMoves: number = 15;

    @property(cc.Integer)
    public maxShuffles: number = 3;

    @property(cc.Integer)
    public superTileThreshold: number = 5;

    @property(cc.Integer)
    public superTileRadius: number = 1;

    @property(cc.Integer)
    public bombCount: number = 3;

    @property(cc.Integer)
    public bombRadius: number = 2;

    @property(cc.Integer)
    public teleportCount: number = 5;

    @property(cc.Label)
    public scoreLabel: cc.Label | null = null;

    @property(cc.Label)
    public movesLabel: cc.Label | null = null;

    @property(cc.Node)
    public bombBoosterButton: cc.Node | null = null;

    @property(cc.Label)
    public bombCountLabel: cc.Label | null = null;

    @property(cc.Node)
    public teleportBoosterButton: cc.Node | null = null;

    @property(cc.Label)
    public teleportCountLabel: cc.Label | null = null;

    @property(ResultPopup)
    public resultPopup: ResultPopup | null = null;

    private popup!: ResultPopup;
    private session!: GameSession;
    private boardView!: BoardView;
    private hud!: HudView;
    private boosterPanel!: BoosterPanelView;
    private isAnimating = false;
    private activeBooster: BoosterType | null = null;
    private teleportSource: Cell | null = null;

    onLoad() {
        this.popup = requireProperty(this.resultPopup, "resultPopup");
        this.popup.node.active = false;

        const board = new BoardModel(this.rows, this.cols, this.colorsCount);
        this.session = new GameSession(board, {
            targetScore: this.targetScore,
            maxMoves: this.maxMoves,
            minGroupSize: this.minGroupSize,
            pointsPerTile: this.pointsPerTile,
            maxShuffles: this.maxShuffles,
            superTileThreshold: this.superTileThreshold,
            superTileRadius: this.superTileRadius,
            bombCount: this.bombCount,
            bombRadius: this.bombRadius,
            teleportCount: this.teleportCount,
        });

        this.hud = new HudView(
            requireProperty(this.scoreLabel, "scoreLabel"),
            requireProperty(this.movesLabel, "movesLabel")
        );
        this.boosterPanel = new BoosterPanelView(
            {
                node: requireProperty(this.bombBoosterButton, "bombBoosterButton"),
                countLabel: requireProperty(this.bombCountLabel, "bombCountLabel"),
            },
            {
                node: requireProperty(this.teleportBoosterButton, "teleportBoosterButton"),
                countLabel: requireProperty(this.teleportCountLabel, "teleportCountLabel"),
            },
            (type) => this.onBoosterClick(type)
        );
        this.boardView = new BoardView(
            this.node,
            requireProperty(this.tilePrefab, "tilePrefab"),
            { rows: this.rows, cols: this.cols, tileWidth: this.tileSizeX, tileHeight: this.tileSizeY },
            (cell) => this.onTileClick(cell)
        );

        this.updateHud(false);
        this.lockInputWhile((done) => {
            this.boardView.playIntro(board, () => {
                this.boardView.playShuffles(this.session.resolveDeadlock(), 0, done);
            });
        });
    }

    public restartGame(): void {
        cc.director.loadScene(cc.director.getScene().name);
    }

    private onTileClick(cell: Cell): void {
        if (this.isAnimating) {
            return;
        }

        switch (this.activeBooster) {
            case BoosterType.Bomb:
                this.useBomb(cell);
                break;
            case BoosterType.Teleport:
                this.selectTeleportTile(cell);
                break;
            default:
                this.makeMove(cell);
        }
    }

    private onBoosterClick(type: BoosterType): void {
        if (this.isAnimating || this.session.result !== GameResult.InProgress) {
            return;
        }

        const available = type === BoosterType.Bomb ? this.session.bombsLeft : this.session.teleportsLeft;
        const isAlreadyActive = this.activeBooster === type;
        this.setActiveBooster(isAlreadyActive || available <= 0 ? null : type);
    }

    private makeMove(cell: Cell): void {
        const outcome = this.session.tryMove(cell);
        if (!outcome) {
            this.boardView.playRejectedClick(cell);
            return;
        }
        this.playBurn(cell, outcome);
    }

    private useBomb(cell: Cell): void {
        this.setActiveBooster(null);

        const outcome = this.session.tryBomb(cell);
        if (outcome) {
            this.playBurn(cell, outcome);
        }
    }

    private selectTeleportTile(cell: Cell): void {
        if (!this.teleportSource) {
            this.teleportSource = cell;
            this.boardView.setSelected(cell, true);
            return;
        }

        const source = this.teleportSource;
        this.setActiveBooster(null);

        const outcome = this.session.trySwap(source, cell);
        if (!outcome) {
            return;
        }

        this.updateHud(true);
        this.lockInputWhile((done) => this.boardView.playSwap(outcome, done));
    }

    private playBurn(origin: Cell, outcome: BurnOutcome): void {
        this.updateHud(true);
        this.lockInputWhile((done) => this.boardView.playBurn(origin, outcome, done));
    }

    private setActiveBooster(type: BoosterType | null): void {
        if (this.teleportSource) {
            this.boardView.setSelected(this.teleportSource, false);
            this.teleportSource = null;
        }

        this.activeBooster = type;
        this.boosterPanel.setActive(type);
    }

    private lockInputWhile(play: (done: () => void) => void): void {
        this.isAnimating = true;
        play(() => this.onAnimationFinished());
    }

    private onAnimationFinished(): void {
        this.isAnimating = false;

        const result = this.session.result;
        if (result !== GameResult.InProgress) {
            this.popup.show(result, this.session.score, this.session.targetScore);
        }
    }

    private updateHud(animated: boolean): void {
        this.hud.showScore(this.session.score, this.session.targetScore, animated);
        this.hud.showMoves(this.session.movesLeft, animated);
        this.boosterPanel.showCount(BoosterType.Bomb, this.session.bombsLeft);
        this.boosterPanel.showCount(BoosterType.Teleport, this.session.teleportsLeft);
    }
}
