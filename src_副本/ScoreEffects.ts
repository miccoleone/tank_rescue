const { regClass } = Laya;

/**
 * 分数特效工具类
 * 提供可在无尽模式和拯救模式共用的分数和金币特效
 */
export class ScoreEffects {
    /**
     * 创建分数弹出特效 (无尽模式样式 - 金色)
     * @param x 特效显示的X坐标
     * @param y 特效显示的Y坐标
     * @param score 显示的分数值
     * @param container 特效的父容器
     */
    public static createGoldScorePopup(x: number, y: number, score: number, container: Laya.Sprite): void {
        // 创建得分文本
        const scoreText = new Laya.Text();
        scoreText.text = "+" + score;
        scoreText.fontSize = 20;
        scoreText.color = "#FFD700"; // 使用金色
        scoreText.stroke = 3;
        scoreText.strokeColor = "#000000";
        scoreText.align = "center";
        scoreText.width = 100;
        scoreText.anchorX = 0.5;
        scoreText.anchorY = 0.5;
        scoreText.pos(x, y);
        scoreText.zOrder = 100; // 确保显示在最上层
        container.addChild(scoreText);

        // 先快速放大一点
        scoreText.scale(0.5, 0.5);
        Laya.Tween.to(scoreText, {
            scaleX: 1.2,
            scaleY: 1.2
        }, 200, Laya.Ease.backOut, Laya.Handler.create(null, () => {
            // 然后开始向上飘并淡出
            Laya.Tween.to(scoreText, {
                y: y - 80,
                alpha: 0,
                scaleX: 1,
                scaleY: 1
            }, 1000, Laya.Ease.quadOut, Laya.Handler.create(null, () => {
                scoreText.destroy();
            }));
        }));
    }
}