/**
 * 得分和特效工具类
 * 用于显示得分弹出、救援感谢等视觉效果
 */
export class ScoreUtil {
    // 单例模式
    private static instance: ScoreUtil;
    
    // 私有构造函数，确保单例
    private constructor() {}
    
    // 获取单例实例
    public static getInstance(): ScoreUtil {
        if (!ScoreUtil.instance) {
            ScoreUtil.instance = new ScoreUtil();
        }
        return ScoreUtil.instance;
    }
    
    /**
     * 显示得分弹出效果
     * @param x 弹出位置X坐标
     * @param y 弹出位置Y坐标
     * @param score 得分数值
     * @param parent 父容器，通常是gameBox
     * @param prefix 前缀，默认为"+"
     */
    public createScorePopup(x: number, y: number, score: number, parent: Laya.Sprite, prefix: string = "+"): void {
        // 创建得分文本
        const scoreText = new Laya.Text();
        scoreText.text = prefix + score;
        scoreText.fontSize = 24;
        scoreText.color = "#FFD700"; // 使用金色
        scoreText.stroke = 3;
        scoreText.strokeColor = "rgba(0, 0, 0, 0.4)"; // 黑色描边，透明度为0.5
        scoreText.width = 100;
        scoreText.align = "center";
        scoreText.anchorX = 0.5;
        scoreText.anchorY = 0.5;
        scoreText.zOrder = 100; // 确保显示在最上层
        
        // 将文本添加到父容器
        parent.addChild(scoreText);
        scoreText.pos(x, y - 30); // 默认在目标位置上方30像素
        
        // 创建弹出动画
        scoreText.scale(0.5, 0.5);
        Laya.Tween.to(scoreText, {
            scaleX: 1.2,
            scaleY: 1.2
        }, 200, Laya.Ease.backOut, Laya.Handler.create(this, () => {
            // 向上飘并淡出
            Laya.Tween.to(scoreText, {
                y: scoreText.y - 50,
                alpha: 0,
                scaleX: 1,
                scaleY: 1
            }, 800, Laya.Ease.quadOut, Laya.Handler.create(this, () => {
                scoreText.destroy();
            }));
        }));
    }
    
    // /**
    //  * 显示绿色得分弹出效果
    //  * 适用于RescueModeGame中的得分弹出
    //  * @param x 弹出位置X坐标
    //  * @param y 弹出位置Y坐标
    //  * @param score 得分数值
    //  * @param parent 父容器，通常是gameBox
    //  */
    // public createGreenScorePopup(x: number, y: number, score: number, parent: Laya.Sprite): void {
    //     // 创建得分文本
    //     const scoreText = new Laya.Text();
    //     scoreText.text = "+" + score;
    //     scoreText.fontSize = 20;
    //     scoreText.color = "#4CAF50"; // 使用清新的绿色
    //     scoreText.stroke = 2;
    //     scoreText.strokeColor = "#ffffff"; // 使用白色描边
    //     scoreText.align = "center";
    //     scoreText.width = 100;
    //     scoreText.anchorX = 0.5;
    //     scoreText.anchorY = 0.5;
    //     scoreText.pos(x, y);
    //     scoreText.zOrder = 100; // 确保显示在最上层
    //     parent.addChild(scoreText);
        
    //     // 先快速放大一点
    //     scoreText.scale(0.5, 0.5);
    //     Laya.Tween.to(scoreText, {
    //         scaleX: 1.2,
    //         scaleY: 1.2
    //     }, 200, Laya.Ease.backOut, Laya.Handler.create(this, () => {
    //         // 然后开始向上飘并淡出
    //         Laya.Tween.to(scoreText, {
    //             y: y - 80,
    //             alpha: 0,
    //             scaleX: 1,
    //             scaleY: 1
    //         }, 1000, Laya.Ease.quadOut, Laya.Handler.create(this, () => {
    //             scoreText.destroy();
    //         }));
    //     }));
    // }
    
    /**
     * 显示救援感谢效果
     * @param x 弹出位置X坐标
     * @param y 弹出位置Y坐标
     * @param parent 父容器，通常是gameBox
     * @param text 显示的文本，默认为"THANKS!"
     */
    public createThanksEffect(x: number, y: number, parent: Laya.Sprite, text: string = "THANKS!"): void {
        // 创建一个向上飘的"已救援"文本
        const rescueText = new Laya.Text();
        rescueText.text = text;
        rescueText.fontSize = 20;
        rescueText.color = "#2979FF";
        rescueText.stroke = 3;
        rescueText.strokeColor = "rgba(255, 255, 255, 1)"; 
        rescueText.width = 60;
        rescueText.align = "center";
        rescueText.zOrder = 100; // 确保显示在最上层
        
        // 将文本添加到父容器
        parent.addChild(rescueText);
        rescueText.pos(x - 30, y - 20);
        
        // 向上飘并淡出的动画
        Laya.Tween.to(rescueText, {
            y: rescueText.y - 30,
            alpha: 0
        }, 1200, Laya.Ease.quadOut, Laya.Handler.create(this, () => {
            rescueText.destroy();
        }));
    }
} 