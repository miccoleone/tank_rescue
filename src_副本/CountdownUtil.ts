const { regClass } = Laya;

/**
 * 倒计时工具类 - 用于游戏结束时的倒计时显示
 */
export class CountdownUtil {
    /**
     * 显示带圆圈背景的倒计时
     * @param seconds 倒计时秒数
     * @param container 放置倒计时UI的容器
     * @param onTick 每秒倒计时回调函数，参数为当前倒计时值
     * @param onComplete 倒计时结束回调函数
     * @param ownerInstance 计时器所属实例，用于清理计时器
     */
    public static showCircleCountdown(
        seconds: number,
        container: Laya.Node,
        onTick?: (countdown: number) => void,
        onComplete?: () => void,
        ownerInstance?: any
    ): Laya.Sprite {
        // 创建倒计时容器
        const countdownContainer = new Laya.Sprite();
        countdownContainer.zOrder = 1002;
        countdownContainer.pivot(60, 60);
        countdownContainer.pos(Laya.stage.width / 2, Laya.stage.height / 2);
        container.addChild(countdownContainer);
        
        // 创建倒计时背景 - 使用半透明圆形
        const bg = new Laya.Sprite();
        bg.graphics.drawCircle(60, 60, 70, "rgba(250, 250, 250, 0.3)");
        countdownContainer.addChild(bg);
        
        // 创建倒计时数字文本
        const numberText = new Laya.Text();
        numberText.text = seconds.toString();
        numberText.fontSize = 80;
        numberText.font = "Arial";
        numberText.bold = true;
        numberText.color = "red";
        numberText.stroke = 4;
        numberText.strokeColor = "#ffffff";
        numberText.width = 120;
        numberText.height = 120;
        numberText.align = "center";
        numberText.valign = "middle";
        numberText.pos(0, 0);
        countdownContainer.addChild(numberText);
        
        // 开始倒计时
        let countdown = seconds;
        const updateCountdown = () => {
            countdown--;
            
            // 更新数字文本
            numberText.text = countdown.toString();
            
            // 播放缩放动画
            countdownContainer.scale(1.5, 1.5);
            Laya.Tween.to(countdownContainer, { scaleX: 1, scaleY: 1 }, 500, Laya.Ease.backOut);
            
            // 如果有每秒回调函数，则调用
            if (onTick) {
                onTick(countdown);
            }
            
            // 倒计时结束
            if (countdown <= 0) {
                // 清理定时器
                if (ownerInstance) {
                    Laya.timer.clear(ownerInstance, updateCountdown);
                } else {
                    Laya.timer.clear(null, updateCountdown);
                }
                
                // 移除倒计时容器
                countdownContainer.destroy();
                
                // 如果有完成回调函数，则调用
                if (onComplete) {
                    onComplete();
                }
            }
        };
        
        // 使用传入的ownerInstance实例来注册定时器，便于后续清理
        if (ownerInstance) {
            Laya.timer.loop(1000, ownerInstance, updateCountdown);
        } else {
            Laya.timer.loop(1000, null, updateCountdown);
        }
        
        return countdownContainer;
    }
} 