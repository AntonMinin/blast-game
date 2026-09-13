import { GameResult } from "./GameSession";
import { requireProperty } from "./requireProperty";

const { ccclass, property } = cc._decorator;

const WIN_TITLE_COLOR = cc.color(255, 221, 64);
const LOSE_TITLE_COLOR = cc.color(255, 96, 120);
const DIM_COLOR = cc.color(0, 8, 28, 200);

const FADE_IN_DURATION = 0.25;
const PANEL_START_SCALE = 0.3;
const PANEL_POP_DURATION = 0.45;
const RIBBON_DROP_HEIGHT = 250;
const RIBBON_DROP_DELAY = 0.25;
const RIBBON_DROP_DURATION = 0.4;
const SCORE_COUNT_DELAY = 0.5;
const SCORE_COUNT_DURATION = 0.9;
const BUTTON_PULSE_DELAY = 1;
const BUTTON_PULSE_SCALE = 1.07;
const BUTTON_PULSE_DURATION = 0.5;
const SHAKE_DISTANCE = 24;
const SHAKE_STEP_DURATION = 0.05;
const CONFETTI_COUNT = 40;
const CONFETTI_SPREAD_X = 1000;
const CONFETTI_START_Y = 1000;
const CONFETTI_START_Y_SPREAD = 600;
const CONFETTI_END_Y = -1100;
const CONFETTI_MIN_FALL_DURATION = 2;
const CONFETTI_FALL_DURATION_SPREAD = 1.5;

@ccclass
export default class ResultPopup extends cc.Component {
    @property(cc.Node)
    public panel: cc.Node | null = null;

    @property(cc.Node)
    public ribbon: cc.Node | null = null;

    @property(cc.Label)
    public title: cc.Label | null = null;

    @property(cc.Label)
    public subtitle: cc.Label | null = null;

    @property(cc.Label)
    public scoreValue: cc.Label | null = null;

    @property(cc.Node)
    public button: cc.Node | null = null;

    @property([cc.SpriteFrame])
    public confettiFrames: cc.SpriteFrame[] = [];

    onLoad() {
        this.drawDimBackground();
    }

    public show(result: GameResult, score: number, targetScore: number): void {
        const isWin = result === GameResult.Win;
        const title = requireProperty(this.title, "title");
        const button = requireProperty(this.button, "button");

        this.node.active = true;
        title.string = isWin ? "ПОБЕДА!" : "ПОРАЖЕНИЕ";
        title.node.color = isWin ? WIN_TITLE_COLOR : LOSE_TITLE_COLOR;
        requireProperty(this.subtitle, "subtitle").string = this.subtitleFor(result);

        this.playAppear(requireProperty(this.panel, "panel"), isWin);
        this.playRibbonDrop(requireProperty(this.ribbon, "ribbon"));
        this.playScoreCount(requireProperty(this.scoreValue, "scoreValue"), score, targetScore);
        this.scheduleOnce(() => this.playButtonPulse(button), BUTTON_PULSE_DELAY);
    }

    private subtitleFor(result: GameResult): string {
        switch (result) {
            case GameResult.Win:
                return "Цель достигнута";
            case GameResult.NoPossibleMoves:
                return "Нет доступных ходов";
            default:
                return "Ходы закончились";
        }
    }

    private drawDimBackground(): void {
        const graphics = this.getComponent(cc.Graphics) || this.addComponent(cc.Graphics);
        graphics.clear();
        graphics.fillColor = DIM_COLOR;
        graphics.rect(-this.node.width, -this.node.height, this.node.width * 2, this.node.height * 2);
        graphics.fill();
    }

    private playAppear(panel: cc.Node, isWin: boolean): void {
        this.node.opacity = 0;
        cc.tween(this.node).to(FADE_IN_DURATION, { opacity: 255 }).start();

        panel.scale = PANEL_START_SCALE;
        cc.tween(panel)
            .to(PANEL_POP_DURATION, { scale: 1 }, { easing: "backOut" })
            .call(() => (isWin ? this.playConfetti() : this.playShake(panel)))
            .start();
    }

    private playRibbonDrop(ribbon: cc.Node): void {
        const finalY = ribbon.y;
        ribbon.y = finalY + RIBBON_DROP_HEIGHT;
        ribbon.opacity = 0;

        cc.tween(ribbon)
            .delay(RIBBON_DROP_DELAY)
            .to(RIBBON_DROP_DURATION, { y: finalY, opacity: 255 }, { easing: "bounceOut" })
            .start();
    }

    private playScoreCount(scoreValue: cc.Label, score: number, targetScore: number): void {
        scoreValue.string = `0/${targetScore}`;

        cc.tween({ value: 0 })
            .delay(SCORE_COUNT_DELAY)
            .to(SCORE_COUNT_DURATION, { value: score }, {
                easing: "quadOut",
                progress: (start: number, end: number, current: number, ratio: number) => {
                    const value = start + (end - start) * ratio;
                    scoreValue.string = `${Math.round(value)}/${targetScore}`;
                    return value;
                },
            })
            .start();
    }

    private playButtonPulse(button: cc.Node): void {
        cc.tween(button)
            .repeatForever(
                cc.tween()
                    .to(BUTTON_PULSE_DURATION, { scale: BUTTON_PULSE_SCALE }, { easing: "sineInOut" })
                    .to(BUTTON_PULSE_DURATION, { scale: 1 }, { easing: "sineInOut" })
            )
            .start();
    }

    private playShake(panel: cc.Node): void {
        cc.tween(panel)
            .by(SHAKE_STEP_DURATION, { x: -SHAKE_DISTANCE })
            .by(SHAKE_STEP_DURATION * 2, { x: SHAKE_DISTANCE * 2 })
            .by(SHAKE_STEP_DURATION * 2, { x: -SHAKE_DISTANCE * 2 })
            .by(SHAKE_STEP_DURATION, { x: SHAKE_DISTANCE })
            .start();
    }

    private playConfetti(): void {
        if (this.confettiFrames.length === 0) {
            return;
        }

        for (let i = 0; i < CONFETTI_COUNT; i++) {
            const piece = new cc.Node("Confetti");
            piece.addComponent(cc.Sprite).spriteFrame = this.confettiFrames[i % this.confettiFrames.length];
            piece.parent = this.node;
            piece.setSiblingIndex(0);
            piece.scale = 0.4 + Math.random() * 0.4;
            piece.angle = Math.random() * 360;
            piece.setPosition(
                (Math.random() - 0.5) * CONFETTI_SPREAD_X,
                CONFETTI_START_Y + Math.random() * CONFETTI_START_Y_SPREAD
            );

            const fallDuration = CONFETTI_MIN_FALL_DURATION + Math.random() * CONFETTI_FALL_DURATION_SPREAD;
            const endAngle = piece.angle + (Math.random() - 0.5) * 720;

            cc.tween(piece)
                .to(fallDuration, { y: CONFETTI_END_Y, angle: endAngle }, { easing: "quadIn" })
                .call(() => piece.destroy())
                .start();
        }
    }
}
