export interface ScoreCounter {
    value: number;
}

export function formatScore(score: number, targetScore: number): string {
    return `${Math.round(score)}/${targetScore}`;
}

export function animateScoreLabel(
    label: cc.Label,
    counter: ScoreCounter,
    score: number,
    targetScore: number,
    duration: number,
    delay: number = 0
): void {
    cc.Tween.stopAllByTarget(counter);
    cc.tween(counter)
        .delay(delay)
        .to(duration, { value: score }, {
            easing: "quadOut",
            progress: (start: number, end: number, current: number, ratio: number) => {
                const value = start + (end - start) * ratio;
                if (label.isValid) {
                    label.string = formatScore(value, targetScore);
                }
                return value;
            },
        })
        .start();
}
