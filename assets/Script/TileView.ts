import { Cell, SuperTileType, Tile } from "./BoardModel";
import { requireProperty } from "./requireProperty";

const { ccclass, property } = cc._decorator;

const DROP_IN_HEIGHT = 300;
const DROP_IN_DURATION = 0.35;
const BURN_GROW_DURATION = 0.08;
const BURN_SHRINK_DURATION = 0.18;
const FALL_BASE_DURATION = 0.12;
const FALL_DURATION_PER_ROW = 0.04;
const LAND_SQUASH_DURATION = 0.07;
const LAND_RESTORE_DURATION = 0.12;
const WOBBLE_ANGLE = 12;
const WOBBLE_STEP_DURATION = 0.05;
const RAISED_Z_INDEX = 1;
const DEFAULT_Z_INDEX = 0;
const SELECTED_SCALE = 1.15;
const SELECTED_PULSE_DURATION = 0.3;
const TELEPORT_HALF_DURATION = 0.2;
const SHUFFLE_SHRINK_DURATION = 0.15;
const SHUFFLE_MOVE_DURATION = 0.45;
const SHUFFLE_RESTORE_DURATION = 0.2;
const SUPER_ICON_POP_DURATION = 0.3;
const SUPER_ICON_PULSE_SCALE = 1.06;
const SUPER_ICON_PULSE_DURATION = 0.6;

@ccclass
export default class TileView extends cc.Component {
    @property([cc.SpriteFrame])
    public tileSprites: cc.SpriteFrame[] = [];

    @property(cc.SpriteFrame)
    public rowSuperTileSprite: cc.SpriteFrame | null = null;

    @property(cc.SpriteFrame)
    public columnSuperTileSprite: cc.SpriteFrame | null = null;

    @property(cc.SpriteFrame)
    public radiusSuperTileSprite: cc.SpriteFrame | null = null;

    @property(cc.SpriteFrame)
    public boardSuperTileSprite: cc.SpriteFrame | null = null;

    @property(cc.Sprite)
    public sprite: cc.Sprite | null = null;

    private cell: Cell = { row: 0, col: 0 };
    private onClick: ((cell: Cell) => void) | null = null;
    private superIcon: cc.Node | null = null;

    onLoad() {
        this.node.on(cc.Node.EventType.TOUCH_END, this.handleTouch, this);
    }

    public init(cell: Cell, tile: Tile, onClick: (cell: Cell) => void): void {
        this.cell = cell;
        this.onClick = onClick;

        if (tile.kind === "color") {
            this.getSprite().spriteFrame = this.tileSprites[tile.color];
        } else {
            this.getSprite().enabled = false;
            this.createSuperIcon(tile.type);
        }
    }

    public dropIn(position: cc.Vec2, delay: number): number {
        this.node.setPosition(position.x, position.y + DROP_IN_HEIGHT);
        this.node.opacity = 0;

        cc.tween(this.node)
            .delay(delay)
            .to(DROP_IN_DURATION, { position: cc.v3(position.x, position.y), opacity: 255 }, { easing: "backOut" })
            .start();

        return delay + DROP_IN_DURATION;
    }

    public popIn(delay: number): number {
        const icon = this.superIcon;
        if (!icon) {
            return delay;
        }

        cc.Tween.stopAllByTarget(icon);
        icon.scale = 0;

        cc.tween(icon)
            .delay(delay)
            .to(SUPER_ICON_POP_DURATION, { scale: 1 }, { easing: "backOut" })
            .call(() => this.startSuperIconPulse(icon))
            .start();

        return delay + SUPER_ICON_POP_DURATION;
    }

    public burn(delay: number): number {
        this.raise();

        cc.tween(this.node)
            .delay(delay)
            .to(BURN_GROW_DURATION, { scale: 1.2 }, { easing: "quadOut" })
            .to(BURN_SHRINK_DURATION, { scale: 0, opacity: 0, angle: 45 }, { easing: "backIn" })
            .call(() => this.node.destroy())
            .start();

        return delay + BURN_GROW_DURATION + BURN_SHRINK_DURATION;
    }

    public fallTo(cell: Cell, position: cc.Vec2, rowsToFall: number, delay: number): number {
        this.cell = cell;
        const fallDuration = FALL_BASE_DURATION + FALL_DURATION_PER_ROW * rowsToFall;

        cc.tween(this.node)
            .delay(delay)
            .to(fallDuration, { position: cc.v3(position.x, position.y), opacity: 255 }, { easing: "quadIn" })
            .to(LAND_SQUASH_DURATION, { scaleX: 1.1, scaleY: 0.88 }, { easing: "quadOut" })
            .to(LAND_RESTORE_DURATION, { scaleX: 1, scaleY: 1 }, { easing: "backOut" })
            .start();

        return delay + fallDuration + LAND_SQUASH_DURATION + LAND_RESTORE_DURATION;
    }

    public teleportTo(cell: Cell, position: cc.Vec2): number {
        this.cell = cell;
        this.stopNodeTweens();
        this.raise();

        cc.tween(this.node)
            .to(TELEPORT_HALF_DURATION, { scale: 0, angle: 180 }, { easing: "backIn" })
            .call(() => {
                this.node.setPosition(position);
                this.node.angle = -180;
            })
            .to(TELEPORT_HALF_DURATION, { scale: 1, angle: 0 }, { easing: "backOut" })
            .call(() => this.lower())
            .start();

        return TELEPORT_HALF_DURATION * 2;
    }

    public shuffleTo(cell: Cell, position: cc.Vec2, delay: number): number {
        this.cell = cell;

        cc.tween(this.node)
            .delay(delay)
            .to(SHUFFLE_SHRINK_DURATION, { scale: 0.7 }, { easing: "quadOut" })
            .to(SHUFFLE_MOVE_DURATION, { position: cc.v3(position.x, position.y) }, { easing: "cubicInOut" })
            .to(SHUFFLE_RESTORE_DURATION, { scale: 1 }, { easing: "backOut" })
            .start();

        return delay + SHUFFLE_SHRINK_DURATION + SHUFFLE_MOVE_DURATION + SHUFFLE_RESTORE_DURATION;
    }

    public setSelected(selected: boolean): void {
        this.stopNodeTweens();

        if (!selected) {
            this.lower();
            return;
        }

        this.raise();
        cc.tween(this.node)
            .repeatForever(
                cc.tween()
                    .to(SELECTED_PULSE_DURATION, { scale: SELECTED_SCALE }, { easing: "sineInOut" })
                    .to(SELECTED_PULSE_DURATION, { scale: 1 }, { easing: "sineInOut" })
            )
            .start();
    }

    public wobble(): void {
        cc.tween(this.node)
            .to(WOBBLE_STEP_DURATION, { angle: WOBBLE_ANGLE })
            .to(WOBBLE_STEP_DURATION * 2, { angle: -WOBBLE_ANGLE })
            .to(WOBBLE_STEP_DURATION, { angle: 0 })
            .start();
    }

    private createSuperIcon(type: SuperTileType): void {
        const icon = new cc.Node("SuperTileIcon");
        const sprite = icon.addComponent(cc.Sprite);
        sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = this.superTileSprite(type);
        icon.setContentSize(this.node.getContentSize());
        icon.parent = this.node;

        this.superIcon = icon;
        this.startSuperIconPulse(icon);
    }

    private superTileSprite(type: SuperTileType): cc.SpriteFrame {
        switch (type) {
            case SuperTileType.Row:
                return requireProperty(this.rowSuperTileSprite, "rowSuperTileSprite");
            case SuperTileType.Column:
                return requireProperty(this.columnSuperTileSprite, "columnSuperTileSprite");
            case SuperTileType.Radius:
                return requireProperty(this.radiusSuperTileSprite, "radiusSuperTileSprite");
            default:
                return requireProperty(this.boardSuperTileSprite, "boardSuperTileSprite");
        }
    }

    private startSuperIconPulse(icon: cc.Node): void {
        cc.tween(icon)
            .repeatForever(
                cc.tween()
                    .to(SUPER_ICON_PULSE_DURATION, { scale: SUPER_ICON_PULSE_SCALE }, { easing: "sineInOut" })
                    .to(SUPER_ICON_PULSE_DURATION, { scale: 1 }, { easing: "sineInOut" })
            )
            .start();
    }

    private raise(): void {
        this.node.zIndex = RAISED_Z_INDEX;
    }

    private lower(): void {
        this.node.zIndex = DEFAULT_Z_INDEX;
    }

    private stopNodeTweens(): void {
        cc.Tween.stopAllByTarget(this.node);
        this.node.scale = 1;
        this.node.angle = 0;
    }

    private getSprite(): cc.Sprite {
        if (!this.sprite) {
            this.sprite = this.getComponent(cc.Sprite);
        }
        return this.sprite;
    }

    private handleTouch(): void {
        if (this.onClick) {
            this.onClick(this.cell);
        }
    }
}
