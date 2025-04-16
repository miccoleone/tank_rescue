/**
 * 游戏通用工具类
 */
export class Util {
    /**
     * 绘制结算面板背景
     * @param panel 要绘制的面板Sprite
     * @param width 面板宽度
     * @param height 面板高度
     * @param isDarkTheme 是否使用深色主题（黑色背景）
     */
    public static drawPanel(panel: Laya.Sprite, width: number = 400, height: number = 400, isDarkTheme: boolean = true): void {
        if (isDarkTheme) {
            // 绘制半透明黑色背景
            panel.graphics.drawRect(0, 0, width, height, "rgba(0, 0, 0, 0.85)");
            
            // 绘制左右边框
            panel.graphics.drawRect(0, 0, 1, height, "rgba(255, 255, 255, 0.2)"); // 左边框
            panel.graphics.drawRect(width-1, 0, 1, height, "rgba(255, 255, 255, 0.2)"); // 右边框
        } else {
            // 绘制白色背景和边框
            panel.graphics.drawRect(0, 0, width, height, "#ffffff");
            panel.graphics.drawRect(0, 0, width, height, null, "#e0e0e0", 1);
        }
    }
    
    /**
     * 创建装饰分割线
     * @param panel 要添加分割线的面板
     * @param y 分割线的y坐标
     * @param isDarkTheme 是否使用深色主题
     */
    public static createDecorativeLine(panel: Laya.Sprite, y: number, isDarkTheme: boolean = true): void {
        const line = new Laya.Sprite();
        const lineWidth = 340;
        const lineHeight = 1;
        
        if (isDarkTheme) {
            // 使用半透明白色线条，适合黑色背景
            line.graphics.drawRect(30, y, lineWidth, lineHeight, "rgba(255, 255, 255, 0.2)");
        } else {
            // 使用浅灰色线条，适合白色背景
            line.graphics.drawRect(30, y, lineWidth, lineHeight, "#e0e0e0");
        }
        
        panel.addChild(line);
    }
    
    /**
     * 创建统计项UI
     * @param stat 统计数据对象
     * @param index 项目索引，用于计算位置
     * @param isDarkTheme 是否使用深色主题
     */
    public static createStatItem(stat: { icon: string, label: string, value: number }, index: number, isDarkTheme: boolean = true): Laya.Sprite {
        const item = new Laya.Sprite();
        item.y = index * 40;
        
        // 创建图标
        const iconImage = new Laya.Image();
        iconImage.skin = stat.icon;
        iconImage.width = index === 0 ? 24 : 24; 
        iconImage.height = index === 0 ? 24 : 24;
        iconImage.pos(0, 0);
        item.addChild(iconImage);
        
        // 创建标签
        const label = new Laya.Text();
        label.fontSize = index === 0 ? 20 : 20; // 第一项文字更大
        
        if (isDarkTheme) {
            label.color = "#cccccc"; // 深色主题：使用浅灰色
        } else {
            label.color = "#666666"; // 浅色主题：使用深灰色
        }
        
        label.x = 40;
        label.text = stat.label;
        item.addChild(label);
        
        // 创建数值
        const value = new Laya.Text();
        value.fontSize = index === 0 ? 20 : 20; // 第一项文字更大
        
        if (isDarkTheme) {
            value.color = "#ffffff"; // 深色主题：使用白色
        } else {
            value.color = "#333333"; // 浅色主题：使用深灰色
        }
        
        value.x = 300;
        value.text = stat.value.toString();
        item.addChild(value);
        
        return item;
    }
    
    /**
     * 处理玩家坦克与敌方AI坦克的碰撞
     * @param playerTank 玩家坦克
     * @param enemyTank 敌方AI坦克
     * @param gameBox 游戏容器
     * @param collisionDistance 碰撞检测距离
     * @param explosionManager 爆炸管理器
     * @param isPlayerInvincible 玩家是否处于无敌状态
     * @param gameOverCallback 游戏结束回调函数
     * @returns 是否发生碰撞
     */
    public static handleTankCollision(
        playerTank: Laya.Sprite,
        enemyTank: Laya.Sprite,
        gameBox: Laya.Sprite,
        collisionDistance: number,
        explosionManager: any,
        isPlayerInvincible: boolean,
        gameOverCallback: () => void
    ): boolean {
        if (!playerTank || playerTank.destroyed || !enemyTank || enemyTank.destroyed) {
            return false;
        }
        
        // 计算两个坦克之间的距离
        const dx = playerTank.x - enemyTank.x;
        const dy = playerTank.y - enemyTank.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 如果距离小于碰撞检测距离，发生碰撞
        if (distance < collisionDistance) {
            // 如果玩家不处于无敌状态，触发游戏结束
            if (!isPlayerInvincible) {
                // 对敌方坦克进行爆炸处理
                explosionManager.playExplosion(enemyTank.x, enemyTank.y, gameBox);
                enemyTank.destroy();
                
                // 调用游戏结束回调
                gameOverCallback();
                return true;
            }
        }
        
        return false;
    }
}
