import { animateScoreLabel, formatScore, ScoreCounter } from "./animateScoreLabel";

const SCORE_COUNT_DURATION = 0.4;
const PUNCH_SCALE = 1.25;
const PUNCH_GROW_DURATION = 0.1;
const PUNCH_RESTORE_DURATION = 0.25;
const LOW_MOVES_THRESHOLD = 3;
const LOW_MOVES_COLOR = cc.color(255, 96, 120);

export class HudView {
    private readonly displayedScore: ScoreCounter = { value: 0 };

    constructor(
        private readonly scoreLabel: cc.Label,
        private readonly movesLabel: cc.Label
    ) {}

    public showScore(score: number, targetScore: number, animated: boolean): void {
        if (!animated) {
            cc.Tween.stopAllByTarget(this.displayedScore);
            this.displayedScore.value = score;
            this.scoreLabel.string = formatScore(score, targetScore);
            return;
        }

        animateScoreLabel(this.scoreLabel, this.displayedScore, score, targetScore, SCORE_COUNT_DURATION);
        this.punch(this.scoreLabel.node);
    }

    public showMoves(movesLeft: number, animated: boolean): void {
        this.movesLabel.string = `${movesLeft}`;
        this.movesLabel.node.color = movesLeft <= LOW_MOVES_THRESHOLD ? LOW_MOVES_COLOR : cc.Color.WHITE;

        if (animated) {
            this.punch(this.movesLabel.node);
        }
    }

    private punch(node: cc.Node): void {
        cc.Tween.stopAllByTarget(node);
        node.scale = 1;

        cc.tween(node)
            .to(PUNCH_GROW_DURATION, { scale: PUNCH_SCALE }, { easing: "quadOut" })
            .to(PUNCH_RESTORE_DURATION, { scale: 1 }, { easing: "backOut" })
            .start();
    }
}
