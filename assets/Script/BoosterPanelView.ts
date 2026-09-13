const DISABLED_OPACITY = 120;
const ACTIVE_SCALE = 1.08;
const ACTIVE_PULSE_DURATION = 0.35;

export enum BoosterType {
    Bomb,
    Teleport,
}

export interface BoosterButton {
    node: cc.Node;
    countLabel: cc.Label;
}

const BOOSTER_TYPES = [BoosterType.Bomb, BoosterType.Teleport];

export class BoosterPanelView {
    private readonly buttons: Record<BoosterType, BoosterButton>;

    constructor(bomb: BoosterButton, teleport: BoosterButton, onClick: (type: BoosterType) => void) {
        this.buttons = {
            [BoosterType.Bomb]: bomb,
            [BoosterType.Teleport]: teleport,
        };

        for (const type of BOOSTER_TYPES) {
            this.buttons[type].node.on(cc.Node.EventType.TOUCH_END, () => onClick(type));
        }
    }

    public showCount(type: BoosterType, count: number): void {
        const button = this.buttons[type];
        button.countLabel.string = `${count}`;
        button.node.opacity = count > 0 ? 255 : DISABLED_OPACITY;
    }

    public setActive(activeType: BoosterType | null): void {
        for (const type of BOOSTER_TYPES) {
            const button = this.buttons[type];
            cc.Tween.stopAllByTarget(button.node);
            button.node.scale = 1;

            if (type === activeType) {
                cc.tween(button.node)
                    .repeatForever(
                        cc.tween()
                            .to(ACTIVE_PULSE_DURATION, { scale: ACTIVE_SCALE }, { easing: "sineInOut" })
                            .to(ACTIVE_PULSE_DURATION, { scale: 1 }, { easing: "sineInOut" })
                    )
                    .start();
            }
        }
    }
}
