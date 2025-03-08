const { regClass, property } = Laya;
import { Joystick } from "./Joystick";
import { BulletPool } from "./BulletPool";
import { Box, BoxType } from "./Box";
import { ExplosionManager } from "./ExplosionManager";
import { EnemyTank } from "./EnemyTank";
import { LeaderboardManager } from "./LeaderboardManager";

// 段位系统配置
interface RankLevel {
    name: string;
    icon: string;
    count: number;
}

@regClass()
export class GameMain extends Laya.Script {
    private static readonly MAP_WIDTH = 1334; // iPhone 6/7/8 Plus 横屏宽度
    private static readonly MAP_HEIGHT = 750; // iPhone 6/7/8 Plus 横屏高度
    private static readonly MIN_BOX_COUNT = 15; // 最小箱子数量
    private static readonly BOX_CHECK_INTERVAL = 2000; // 检查箱子数量的间隔（毫秒）
    private static readonly POINTS_PER_RANK = 3000; // 每个小段位所需分数
    private static readonly ENEMY_TANK_SCORE = 500; // 修改击毁敌方坦克的得分
    
    // 段位系统定义
    private static readonly RANKS: RankLevel[] = [
        { name: "青铜", icon: "resources/moon.png", count: 4 },
        { name: "白银", icon: "resources/star.png", count: 4 },
        { name: "黄金", icon: "resources/sun.png", count: 4 },
        { name: "钻石", icon: "resources/diamond.png", count: 4 },
        { name: "王者", icon: "resources/king.png", count: 4 },
        { name: "长城", icon: "resources/greatwall.png", count: 1 }
    ];
    
    /** @prop {name: gameBox, tips: "游戏容器", type: Node, default: null}*/
    @property(Laya.Sprite)
    private gameBox: Laya.Sprite;
    
    /** @prop {name: tank, tips: "玩家坦克", type: Node, default: null}*/
    @property(Laya.Sprite)
    private tank: Laya.Sprite;
    
    private joystick: Joystick;
    private fireBtn: Laya.Sprite;
    private bullets: Laya.Sprite[] = [];
    private boxes: Box[] = [];
    private score: number = 0;
    private scoreText: Laya.Text;
    private rankText: Laya.Text;
    private fireSound: Laya.SoundChannel;
    private bgMusic: Laya.SoundChannel;
    private levelUpSound: Laya.SoundChannel;
    private static readonly BULLET_SIGN = "bullet";
    private static readonly GRID_SIZE = 40;
    private miniMap: Laya.Sprite;
    private playerDot: Laya.Sprite;
    private lastRankIndex: number = -1; // 用于跟踪上一次的段位
    private enemyTanks: EnemyTank[] = [];
    private static readonly ENEMY_CHECK_INTERVAL = 2000; // 检查敌人数量的间隔（毫秒）
    private static readonly COLLISION_DISTANCE = 30; // 碰撞检测距离
    private killCount: number = 0;
    private woodBoxCount: number = 0;
    private metalBoxCount: number = 0;
    private treasureBoxCount: number = 0;
    private leaderboardBtn: Laya.Sprite;
    private leaderboardMask: Laya.Sprite | null = null;
    private leaderboardPanel: Laya.Sprite | null = null;
    private rankUpScores: number[] = [];
    
    constructor() {
        super();
        // 预加载音效和图片
        Laya.loader.load([
            "resources/fire.mp3",
            "resources/background.mp3",
            "resources/tank.png",
            "resources/bullet.png",
            "resources/woodBox.png",
            "resources/metalBox.png",
            "resources/explosion.png",
            "resources/level_up.mp3",
            "resources/score.mp3",
            "resources/enemy-tank.png",
            "resources/moon.png",
            "resources/star.png",
            "resources/sun.png",
            "resources/diamond.png",
            "resources/king.png",
            "resources/greatwall.png",
            "resources/fire_bg.png"
        ], Laya.Handler.create(this, () => {
            // 确保爆炸管理器初始化
            ExplosionManager.instance;
            console.log("所有资源加载完成");
        }));
    }

    onAwake(): void {
        // 设置游戏屏幕适配
        Laya.stage.scaleMode = Laya.Stage.SCALE_FIXED_WIDTH;
        Laya.stage.alignH = Laya.Stage.ALIGN_CENTER;
        Laya.stage.alignV = Laya.Stage.ALIGN_MIDDLE;
        Laya.stage.screenMode = Laya.Stage.SCREEN_HORIZONTAL;
        
        // 设置黑色背景
        Laya.stage.bgColor = "#000000";
        
        // 播放背景音乐
        this.bgMusic = Laya.SoundManager.playMusic("resources/background.mp3", 0);
        this.bgMusic.volume = 0.5;
        
        // 初始化游戏场景
        this.initGameScene();
        // 初始化玩家坦克
        this.initPlayerTank();
        // 初始化虚拟摇杆
        this.initJoystick();
        // 初始化积分和段位显示
        this.initScoreDisplay();
        // 初始化排行榜按钮
        this.initLeaderboardButton();
        // 初始化箱子
        this.initBoxes();
        // 开始箱子检查定时器
        Laya.timer.loop(GameMain.BOX_CHECK_INTERVAL, this, this.checkBoxCount);
        // 开始敌人检查定时器
        Laya.timer.loop(GameMain.ENEMY_CHECK_INTERVAL, this, this.checkEnemyCount);
        // 开始碰撞检测
        Laya.timer.frameLoop(1, this, this.checkCollisions);
    }

    private initGameScene(): void {
        // 创建游戏容器
        this.gameBox = new Laya.Sprite();
        this.gameBox.name = "GameBox";
        this.owner.addChild(this.gameBox);

        // 创建格子背景
        const gridBackground = new Laya.Sprite();
        gridBackground.name = "GridBackground";
        
        // 设置背景颜色为白色
        Laya.stage.bgColor = "#ffffff";
        
        // 绘制格子
        const gridSize = GameMain.GRID_SIZE; // 使用已定义的格子大小
        const width = Laya.stage.width;
        const height = Laya.stage.height;
        
        // 使用浅灰色绘制格子线
        const gridGraphics = gridBackground.graphics;
        
        // 绘制垂直线
        for (let x = 0; x <= width; x += gridSize) {
            gridGraphics.drawLine(x, 0, x, height, "#e0e0e0", 1);
        }
        
        // 绘制水平线
        for (let y = 0; y <= height; y += gridSize) {
            gridGraphics.drawLine(0, y, width, y, "#e0e0e0", 1);
        }
        
        // 将格子背景添加到游戏容器中，确保它在最底层
        this.gameBox.addChildAt(gridBackground, 0);
    }

    private initPlayerTank(): void {
        // 创建坦克容器
        this.tank = new Laya.Sprite();
        this.tank.name = "PlayerTank";
        
        // // 创建描边效果
        // const outline = new Laya.Sprite();
        // outline.graphics.drawRect(-16, -16, 32, 32, null, "#00ff00", 1);
        // this.tank.addChild(outline);
        
        // 使用tank.png作为坦克图片
        let tankImage = new Laya.Image();
        // tankImage.skin = "resources/tank.png";
        tankImage.skin = "resources/Retina/tank_sand.png";
        tankImage.width = 30;
        tankImage.height = 30;
        tankImage.pivot(15, 15);
        tankImage.rotation = -90;
        this.tank.addChild(tankImage);
        
        // 将坦克放置在屏幕中央
        this.tank.pos(Laya.stage.width / 2, Laya.stage.height / 2);
        
        this.gameBox.addChild(this.tank);

        // 初始化开火按钮
        this.initFireButton();
    }

    private initJoystick(): void {
        // 创建摇杆容器，并命名
        let joystickContainer = new Laya.Sprite();
        joystickContainer.name = "JoystickContainer";
        
        // 设置鼠标事件支持
        joystickContainer.mouseEnabled = true;
        joystickContainer.mouseThrough = true;
        
        this.owner.addChild(joystickContainer);
        
        // 添加摇杆组件
        this.joystick = joystickContainer.addComponent(Joystick);
        
        // 监听摇杆容器的事件
        joystickContainer.on("joystickMove", this, this.onJoystickMove);
    }

    private initFireButton(): void {
        this.fireBtn = new Laya.Sprite();
        this.fireBtn.name = "FireButton";
        
        // 设置鼠标事件支持
        this.fireBtn.mouseEnabled = true;
        this.fireBtn.mouseThrough = false;
        
        // 创建按钮背景
        let btnBg = new Laya.Sprite();
        btnBg.name = "FireButtonBg";
        btnBg.mouseEnabled = true;
        btnBg.mouseThrough = true;
        
        // 保留绘制但完全透明，用于保持点击区域
        const radius = 60;
        btnBg.graphics.drawCircle(0, 0, radius, "rgba(255, 100, 100, 0)");
        
        // 添加背景图片
        const bgImage = new Laya.Image();
        bgImage.skin = "resources/fire_bg.png";
        const bgScale = (radius * 2) / 256;  // 假设原图是256x256
        bgImage.scale(bgScale, bgScale);
        bgImage.pivot(128, 128);  // 使用原图尺寸的一半作为轴心点
        bgImage.alpha = 0.3;
        
        // 添加红色滤镜
        const redMatrix = [
            1, 0, 0, 0, 255 * 0.5,  // R
            0, 0, 0, 0, 100 * 0.5,  // G
            0, 0, 0, 0, 100 * 0.5,  // B
            0, 0, 0, 1, 0           // A
        ];
        const redFilter = new Laya.ColorFilter(redMatrix);
        bgImage.filters = [redFilter];
        
        btnBg.addChild(bgImage);
        
        this.fireBtn.addChild(btnBg);
        
        // 加载闪电图标
        let lightning = new Laya.Image();
        lightning.name = "LightningIcon";
        lightning.skin = "resources/lightning.png";
        const iconSize = radius * 1.5;
        lightning.width = iconSize;
        lightning.height = iconSize;
        lightning.pivot(iconSize/2, iconSize/2);
        lightning.alpha = 0.5;
        this.fireBtn.addChild(lightning);
        
        // 动态计算按钮位置
        const horizontalMargin = Laya.stage.width * 0.17;
        const verticalMargin = Laya.stage.height * 0.25;
    
        this.fireBtn.pos(Laya.stage.width - horizontalMargin, Laya.stage.height - verticalMargin);
        this.owner.addChild(this.fireBtn);
        
        // 添加按钮事件
        this.fireBtn.on(Laya.Event.MOUSE_DOWN, this, this.onFireStart);
        this.fireBtn.on(Laya.Event.MOUSE_UP, this, this.onFireEnd);
        this.fireBtn.on(Laya.Event.MOUSE_OUT, this, this.onFireEnd);
    }

    private onJoystickMove(angle: number, strength: number): void {
        // 如果排行榜打开，则关闭它
        if (this.leaderboardPanel) {
            this.hideLeaderboard();
        }

        if (strength === 0 || !this.tank || this.tank.destroyed) return;
        
        // 更新坦克旋转角度
        this.tank.rotation = angle;
        
        // 计算移动距离
        let speed = 5 * strength;
        let radian = angle * Math.PI / 180;
        
        // 计算新位置
        let newX = this.tank.x + Math.cos(radian) * speed;
        let newY = this.tank.y + Math.sin(radian) * speed;
        
        // 限制坦克在地图范围内
        const margin = 20; // 留一点边距
        newX = Math.max(margin, Math.min(newX, Laya.stage.width - margin));
        newY = Math.max(margin, Math.min(newY, Laya.stage.height - margin));
        
        // 检查是否会与箱子碰撞
        if (!this.willCollideWithBoxes(newX, newY)) {
            // 更新坦克位置
            this.tank.pos(newX, newY);
        }
    }

    private willCollideWithBoxes(x: number, y: number): boolean {
        const tankRadius = 15; // 坦克半径
        const boxRadius = 15; // 箱子半径
        const minDistance = tankRadius + boxRadius;

        // 检查与所有箱子的碰撞
        for (const box of this.boxes) {
            if (!box.destroyed) {
                const dx = x - box.x;
                const dy = y - box.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < minDistance) {
                    return true;
                }
            }
        }
        return false;
    }

    private onFireStart(): void {
        // 如果排行榜打开，则关闭它
        if (this.leaderboardPanel) {
            this.hideLeaderboard();
            return;
        }

        if (!this.tank || this.tank.destroyed) {
            return;
        }
        
        // 按钮按下效果 - 调整透明度和滤镜
        let btnBg = this.fireBtn.getChildByName("FireButtonBg") as Laya.Sprite;
        const bgImage = btnBg.getChildAt(0) as Laya.Image;
        if (bgImage) {
            bgImage.alpha = 0.7;
            // 创建新的更强的红色滤镜
            const pressedRedMatrix = [
                1, 0, 0, 0, 255 * 0.8,  // R: 增加红色
                0, 0, 0, 0, 50 * 0.5,   // G: 降低绿色
                0, 0, 0, 0, 50 * 0.5,   // B: 降低蓝色
                0, 0, 0, 1, 0           // A
            ];
            bgImage.filters = [new Laya.ColorFilter(pressedRedMatrix)];
        }
        
        // 播放开火音效并发射子弹
        this.onFire();
    }

    private onFireEnd(): void {
        // 恢复按钮效果
        let btnBg = this.fireBtn.getChildByName("FireButtonBg") as Laya.Sprite;
        const bgImage = btnBg.getChildAt(0) as Laya.Image;
        if (bgImage) {
            bgImage.alpha = 0.3;
            // 恢复原始红色滤镜
            const originalRedMatrix = [
                1, 0, 0, 0, 255 * 0.5,  // R
                0, 0, 0, 0, 100 * 0.5,  // G
                0, 0, 0, 0, 100 * 0.5,  // B
                0, 0, 0, 1, 0           // A
            ];
            bgImage.filters = [new Laya.ColorFilter(originalRedMatrix)];
        }
    }

    private onFire(): void {
        // 检查坦克是否存在且未被销毁
        if (!this.tank || this.tank.destroyed) {
            return;
        }
        
        // 播放开火音效
        this.fireSound = Laya.SoundManager.playSound("resources/fire.mp3", 1);
        this.fireSound.volume = 0.6;
        
        // 从对象池获取子弹
        let bullet = BulletPool.instance.getItem(GameMain.BULLET_SIGN);
        if (!bullet) return;
        
        bullet.name = "Bullet_" + this.bullets.length;
        
        // 设置子弹位置和旋转
        bullet.pos(this.tank.x, this.tank.y);
        bullet.rotation = this.tank.rotation;
        
        // 计算基础速度和段位加成
        let baseSpeed = 15;
        const currentRankInfo = this.getRankInfo(this.score);
        const rankBonus = Math.floor(Math.floor(this.score / GameMain.POINTS_PER_RANK) / 4) * 5; // 每个大段位（4个小段位）增加5点速度
        let speed = baseSpeed + rankBonus;
        
        let radian = bullet.rotation * Math.PI / 180;
        let vx = Math.cos(radian) * speed;
        let vy = Math.sin(radian) * speed;
        
        this.gameBox.addChild(bullet);
        this.bullets.push(bullet);
        
        // 修改 updateBullet 函数
        const updateBullet = () => {
            if (!bullet || bullet.destroyed) return;
            
            bullet.x += vx;
            bullet.y += vy;
            
            // 检查与敌方坦克的碰撞
            for (const enemy of this.enemyTanks) {
                if (!enemy.destroyed && this.checkBulletEnemyCollision(bullet, enemy)) {
                    // 击中敌方坦克
                    this.score += GameMain.ENEMY_TANK_SCORE;
                    this.updateScoreDisplay();
                    ExplosionManager.instance.playExplosion(enemy.x, enemy.y, this.gameBox);
                    // 添加得分弹出效果
                    this.createScorePopup(enemy.x, enemy.y, GameMain.ENEMY_TANK_SCORE);
                    enemy.destroy();
                    this.recycleBullet(bullet);
                    return;
                }
            }
            
            // 检查与箱子的碰撞
            for (let box of this.boxes) {
                if (!box.destroyed && this.checkBulletCollision(bullet, box)) {
                    const earnedScore = box.hit();
                    if (earnedScore > 0) {
                        this.score += earnedScore;
                        this.updateScoreDisplay();
                        ExplosionManager.instance.playExplosion(box.x, box.y, this.gameBox);
                        // 添加得分弹出效果
                        this.createScorePopup(box.x, box.y, earnedScore);
                        if (box.type === BoxType.Treasure) {
                            // 移除烟花效果，只保留音效
                            Laya.SoundManager.playSound("resources/score.mp3", 1);
                        }
                    }
                    this.recycleBullet(bullet);
                    return;
                }
            }
            
            // 检查子弹是否超出屏幕
            if (bullet.x < 0 || bullet.x > Laya.stage.width || 
                bullet.y < 0 || bullet.y > Laya.stage.height) {
                this.recycleBullet(bullet);
                return;
            }
        };
        
        Laya.timer.frameLoop(1, bullet, updateBullet);
    }

    private recycleBullet(bullet: Laya.Sprite): void {
        if (!bullet || bullet.destroyed) return;
        
        // 从数组中移除
        const index = this.bullets.indexOf(bullet);
                if (index > -1) {
                    this.bullets.splice(index, 1);
                }
        
        // 清理定时器
                Laya.timer.clearAll(bullet);
        
        // 回收到对象池
                BulletPool.instance.recover(GameMain.BULLET_SIGN, bullet);
    }

    private checkBulletCollision(bullet: Laya.Sprite, target: Box): boolean {
        // 获取子弹和箱子的边界
        const bulletBounds = bullet.getBounds();
        const boxBounds = target.getBounds();
        
        // 将边界转换为全局坐标
        bulletBounds.x = bullet.x - bullet.pivotX;
        bulletBounds.y = bullet.y - bullet.pivotY;
        boxBounds.x = target.x - target.pivotX;
        boxBounds.y = target.y - target.pivotY;
        
        // 检查边界是否相交
        if (bulletBounds.intersects(boxBounds)) {
            // 添加箱子类型统计
            if (target.type === BoxType.Wood) this.woodBoxCount++;
            else if (target.type === BoxType.Metal) this.metalBoxCount++;
            else if (target.type === BoxType.Treasure) this.treasureBoxCount++;
            return true;
        }
        return false;
    }

    private checkBulletEnemyCollision(bullet: Laya.Sprite, enemy: EnemyTank): boolean {
        // 获取子弹和敌方坦克的边界
        const bulletBounds = bullet.getBounds();
        const enemyBounds = enemy.getBounds();
        
        // 将边界转换为全局坐标
        bulletBounds.x = bullet.x - bullet.pivotX;
        bulletBounds.y = bullet.y - bullet.pivotY;
        enemyBounds.x = enemy.x - enemy.pivotX;
        enemyBounds.y = enemy.y - enemy.pivotY;
        
        // 检查边界是否相交
        if (bulletBounds.intersects(enemyBounds)) {
            this.killCount++; // 添加击杀统计
            return true;
        }
        return false;
    }

    private initScoreDisplay(): void {
        // 创建UI容器
        const uiContainer = new Laya.Sprite();
        uiContainer.name = "UIContainer";
        this.owner.addChild(uiContainer);
        
        // 计算与摇杆相同的水平边距，并向左偏移摇杆背景圆的半径
        const horizontalMargin = Laya.stage.width * 0.17;
        const adjustedMargin = horizontalMargin - 60; // 60 是摇杆背景圆的半径
        
        // 分数显示
        this.scoreText = new Laya.Text();
        this.scoreText.fontSize = 24;
        this.scoreText.color = "#333333";
        this.scoreText.stroke = 2;
        this.scoreText.strokeColor = "#e0e0e0";
        this.scoreText.pos(adjustedMargin, 20);
        this.scoreText.text = `Score: ${this.score}`;
        uiContainer.addChild(this.scoreText);

        // 段位显示
        this.rankText = new Laya.Text();
        this.rankText.fontSize = 24;
        this.rankText.color = "#333333";
        this.rankText.stroke = 2;
        this.rankText.strokeColor = "#e0e0e0";
        this.rankText.pos(adjustedMargin, 55);
        uiContainer.addChild(this.rankText);

        // 创建段位图标容器
        const rankIconContainer = new Laya.Sprite();
        rankIconContainer.name = "rankIconContainer";
        rankIconContainer.pos(adjustedMargin, 55);
        uiContainer.addChild(rankIconContainer);

        // 初始化显示
        this.updateRankDisplay();
    }

    private updateScoreDisplay(): void {
        if (this.scoreText) {
            this.scoreText.text = `Score: ${this.score}`;
            this.checkRankUp();
            this.updateRankDisplay();
            // 更新排行榜数据
            LeaderboardManager.instance.updateCurrentScore(this.score);
        }
    }

    private getRankInfo(score: number): { rankName: string, level: number, icons: string[] } {
        const currentLevel = Math.floor(score / GameMain.POINTS_PER_RANK);
        
        // 长城段位（66000分以上）
        if (score >= 66000) {
            const baseStars = 1; // 基础星星数
            const extraStars = Math.floor((score - 66000) / 3000); // 每3000分增加一颗星
            const totalStars = baseStars + extraStars;
            
            // 创建图标数组
            const icons = [];
            for (let i = 0; i < totalStars; i++) {
                icons.push("resources/greatwall.png");
            }
            
            return {
                rankName: "长城",
                level: totalStars,
                icons: icons
            };
        }
        
        let totalLevels = 0;
        for (let i = 0; i < GameMain.RANKS.length; i++) {
            const rank = GameMain.RANKS[i];
            totalLevels += rank.count;
            
            if (currentLevel < totalLevels) {
                const levelInRank = rank.count - (totalLevels - currentLevel - 1);
                
                // 创建图标数组
                const icons = [];
                for (let j = 0; j < levelInRank; j++) {
                    icons.push(rank.icon);
                }
                
                return {
                    rankName: rank.name,
                    level: levelInRank,
                    icons: icons
                };
            }
        }
        
        // 默认返回青铜1
        return {
            rankName: "青铜",
            level: 1,
            icons: ["resources/moon.png"]
        };
    }

    private updateRankDisplay(): void {
        if (!this.rankText || !this.owner) return;
        
        const rankInfo = this.getRankInfo(this.score);
        
        // 只显示段位名称，不显示小段位数字
        this.rankText.text = `${rankInfo.rankName}：`;
        
        // 获取UI容器
        const uiContainer = this.owner.getChildByName("UIContainer");
        if (!uiContainer) return;

        // 更新图标容器
        let iconContainer = uiContainer.getChildByName("rankIconContainer") as Laya.Sprite;
        if (iconContainer) {
            iconContainer.removeChildren();
        } else {
            iconContainer = new Laya.Sprite();
            iconContainer.name = "rankIconContainer";
            uiContainer.addChild(iconContainer);
        }

        // 设置图标容器位置
        iconContainer.pos(this.rankText.x + this.rankText.width + 5, this.rankText.y);

        // 添加图标
        rankInfo.icons.forEach((iconPath, index) => {
            const icon = new Laya.Image();
            icon.skin = iconPath;
            icon.width = 24;
            icon.height = 24;
            icon.x = index * (24 + 2);
            icon.y = 2;
            iconContainer.addChild(icon);
        });
        
        // 检查段位变化
        if (this.lastRankIndex !== -1) {
            const newRankIndex = GameMain.RANKS.findIndex(r => r.name === rankInfo.rankName);
            
            if (newRankIndex !== -1 && newRankIndex !== this.lastRankIndex) {
                this.lastRankIndex = newRankIndex;
                // 不在这里调用checkRankUp，避免递归
            }
        } else {
            this.lastRankIndex = GameMain.RANKS.findIndex(r => r.name === rankInfo.rankName);
        }
    }

    private initRankUpScores(): void {
        // 初始化所有升级分数点
        this.rankUpScores = [];
        for (let i = 1; i <= 22; i++) { // 22个等级点，对应66000分
            this.rankUpScores.push(i * GameMain.POINTS_PER_RANK);
        }
    }

    private checkRankUp(): void {
        // 如果数组为空，初始化升级分数点
        if (this.rankUpScores.length === 0) {
            this.initRankUpScores();
        }

        // 检查当前分数是否达到下一个升级点
        const nextRankUpScore = this.rankUpScores[0];
        if (nextRankUpScore && this.score >= nextRankUpScore) {
            // 移除已达到的升级点
            this.rankUpScores.shift();
            
            // 播放升级音效
            this.levelUpSound = Laya.SoundManager.playSound("resources/level_up.mp3", 1);
            this.levelUpSound.volume = 1;
            
            // 获取新的段位信息
            const rankInfo = this.getRankInfo(this.score);
            
            // 创建升级特效容器
            const container = new Laya.Sprite();
            container.pos(this.tank.x, this.tank.y - 30);
            this.gameBox.addChild(container);
            
            // 创建简化的升级效果
            this.createSimplifiedRankUpEffect(container, rankInfo.icons);
        }
    }

    private createSimplifiedRankUpEffect(container: Laya.Sprite, rankIcons: string[]): void {
        const riseHeight = 120; // 增加上升高度
        const particleCount = 50; // 增加粒子数量
        const duration = 1200; // 增加动画持续时间
        
        // 创建段位图标容器
        const iconContainer = new Laya.Sprite();
        iconContainer.alpha = 0;
        container.addChild(iconContainer);
        
        // 添加段位图标
        rankIcons.forEach((iconPath, index) => {
            const icon = new Laya.Image();
            icon.skin = iconPath;
            icon.width = 30;
            icon.height = 30;
            icon.x = index * (30 + 2);
            iconContainer.addChild(icon);
        });
        
        // 居中图标容器
        iconContainer.pivot(iconContainer.width / 2, iconContainer.height / 2);
        iconContainer.pos(0, 0);

        // 更丰富的粒子颜色
        const colors = [
            "#FFD700", "#FFA500", "#FF69B4", // 金色、橙色、粉色
            "#4169E1", "#7B68EE", "#00FF7F", // 蓝色、紫色、绿色
            "#FF4500", "#FF1493", "#FFB6C1", // 红橙、深粉、浅粉
            "#00BFFF", "#1E90FF", "#87CEEB"  // 不同色调的蓝色
        ];

        // 创建向上喷射的粒子效果
        for (let i = 0; i < particleCount; i++) {
            const particle = new Laya.Sprite();
            const initialSize = 1; // 固定初始大小为1
            const finalSize = Math.random() * 7 + 4; // 最终大小在4-9之间
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            particle.graphics.drawCircle(0, 0, initialSize, color);
            particle.pos(0, 0);
            container.addChild(particle);

            // 计算粒子的初始角度（在-45度到45度之间，确保向上发射）
            const angle = (-45 + Math.random() * 90) * Math.PI / 180;
            
            // 计算粒子的速度和距离
            const speed = Math.random() * 0.6 + 0.5; // 0.5 到 1.1 之间的随机速度
            const maxDistance = riseHeight * (0.7 + Math.random() * 0.6); // 70% 到 130% 的上升高度
            
            // 计算最终位置（抛物线轨迹）
            const finalX = Math.sin(angle) * maxDistance * 0.6;
            const finalY = -maxDistance;

            // 添加一些随机性，使效果更自然
            const randomOffset = (Math.random() - 0.5) * 15;

            // 创建完整的上升和消失动画
            Laya.Tween.to(particle, {
                x: finalX + randomOffset,
                y: finalY,
                alpha: 0,
                scaleX: finalSize,
                scaleY: finalSize
            }, duration * speed, Laya.Ease.quadOut);
        }

        // 图标动画
        Laya.Tween.to(iconContainer, {
            y: -riseHeight * 0.7,
            alpha: 1
        }, duration * 0.4, Laya.Ease.quartOut, Laya.Handler.create(this, () => {
            Laya.Tween.to(iconContainer, {
                alpha: 0
            }, duration * 0.6);
        }));

        // 清理
        Laya.timer.once(duration + 100, this, () => {
            container.destroy();
        });
    }

    private initBoxes(): void {
        // 初始生成20个箱子
        for (let i = 0; i < 30; i++) {
            this.createRandomBox();
        }
    }

    private createRandomBox(): Box {
        // 计算当前宝箱数量
        const treasureCount = this.boxes.filter(box => 
            !box.destroyed && box.type === BoxType.Treasure
        ).length;

        // 随机选择箱子类型（木箱:铁箱 = 2:1，宝箱最多1个）
        let type: BoxType;
        if (treasureCount === 0 && Math.random() < 0.1) { // 只有没有宝箱时，才有10%概率生成宝箱
            type = BoxType.Treasure;
        } else {
            // 在木箱和铁箱之间选择（2:1的比例）
            type = Math.random() < 0.67 ? BoxType.Wood : BoxType.Metal;
        }

        // 创建箱子
        const box = new Box(type);
        
        // 随机位置（避免与玩家坦克重叠）
        let x: number, y: number;
        do {
            x = Math.random() * (Laya.stage.width - 80) + 40;
            y = Math.random() * (Laya.stage.height - 80) + 40;
        } while (this.isNearTank(x, y, 100));

        box.pos(x, y);
        this.gameBox.addChild(box);
        this.boxes.push(box);
        return box;
    }

    private isNearTank(x: number, y: number, minDistance: number): boolean {
        const dx = x - this.tank.x;
        const dy = y - this.tank.y;
        return Math.sqrt(dx * dx + dy * dy) < minDistance;
    }

    private checkBoxCount(): void {
        // 移除已销毁的箱子
        this.boxes = this.boxes.filter(box => !box.destroyed);
        
        // 如果箱子数量少于最小值，添加新箱子
        while (this.boxes.length < GameMain.MIN_BOX_COUNT) {
            this.createRandomBox();
        }
    }

    private updateMiniMap(): void {
        // 暂时不实现小地图功能
    }

    private getRequiredEnemyCount(): number {
        const currentLevel = Math.floor(this.score / GameMain.POINTS_PER_RANK);
        if (currentLevel < 6) { // 青铜和白银
            return 3;
        } else if (currentLevel < 9) { // 黄金
            return 4;
        } else if (currentLevel < 12) { // 白金
            return 5;
        } else if (currentLevel < 15) { // 钻石
            return 6;
        } else { // 王者和长城
            return 7;
        }
    }

    private checkEnemyCount(): void {
        // 移除已销毁的敌人
        this.enemyTanks = this.enemyTanks.filter(tank => !tank.destroyed);
        
        const requiredCount = this.getRequiredEnemyCount();
        
        // 如果敌人数量少于要求，添加新敌人
        while (this.enemyTanks.length < requiredCount) {
            this.createEnemyTank();
        }
    }

    private createEnemyTank(): void {
        // 决定是否为追踪型坦克（2/3概率）
        const isChasing = Math.random() < 0.667;
        
        // 创建敌方坦克，传递箱子数组
        const enemy = new EnemyTank(this.tank, isChasing, this.boxes);
        
        // 随机位置（避免与玩家坦克和其他敌方坦克重叠）
        let x: number, y: number;
        let attempts = 0;
        const maxAttempts = 50;
        
        do {
            x = Math.random() * (Laya.stage.width - 80) + 40;
            y = Math.random() * (Laya.stage.height - 80) + 40;
            attempts++;
            
            // 如果尝试次数过多，跳出循环
            if (attempts >= maxAttempts) {
                console.warn("无法找到合适的位置放置敌方坦克");
                return;
            }
        } while (this.isPositionOccupied(x, y));

        enemy.pos(x, y);
        this.gameBox.addChild(enemy);
        this.enemyTanks.push(enemy);
    }

    private isPositionOccupied(x: number, y: number): boolean {
        // 检查是否与玩家坦克太近
        if (this.isNearTank(x, y, 150)) return true;
        
        // 检查是否与其他敌方坦克太近
        for (const enemy of this.enemyTanks) {
            const dx = x - enemy.x;
            const dy = y - enemy.y;
            if (Math.sqrt(dx * dx + dy * dy) < 100) return true;
        }
        
        // 检查是否与箱子太近
        for (const box of this.boxes) {
            if (!box.destroyed) {
                const dx = x - box.x;
                const dy = y - box.y;
                if (Math.sqrt(dx * dx + dy * dy) < 60) return true;
            }
        }
        
        return false;
    }

    private checkCollisions(): void {
        if (!this.tank || this.tank.destroyed) return;
        
        // 检查与敌方坦克的碰撞
        for (const enemy of this.enemyTanks) {
            if (enemy.destroyed) continue;
            
            const dx = this.tank.x - enemy.x;
            const dy = this.tank.y - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < GameMain.COLLISION_DISTANCE) {
                // 发生碰撞，游戏结束
                this.handleGameOver();
                return;
            }
        }
    }

    private handleGameOver(): void {
        // 禁用开火按钮
        if (this.fireBtn) {
            this.fireBtn.mouseEnabled = false;
        }
        
        // 播放爆炸效果
        ExplosionManager.instance.playExplosion(this.tank.x, this.tank.y, this.gameBox);
        
        // 销毁所有对象
        this.tank.destroy();
        this.enemyTanks.forEach(enemy => {
            ExplosionManager.instance.playExplosion(enemy.x, enemy.y, this.gameBox);
            enemy.destroy();
        });
        this.enemyTanks = [];
        
        // 清理所有子弹
        this.bullets.forEach(bullet => this.recycleBullet(bullet));
        this.bullets = [];
        
        // 创建渐变遮罩层
        const mask = new Laya.Sprite();
        mask.graphics.drawRect(0, 0, Laya.stage.width, Laya.stage.height, "rgba(0, 0, 0, 0)");
        mask.zOrder = 1000;
        this.owner.addChild(mask);
        
        // 创建结算面板容器
        const container = new Laya.Sprite();
        container.zOrder = 1001;
        container.alpha = 0;
        this.owner.addChild(container);
        
        // 修改面板尺寸和样式
        const panel = new Laya.Sprite();
        this.drawPanel(panel);
        panel.pivot(200, 200); // 保持轴心点在中心
        panel.pos(Laya.stage.width/2, Laya.stage.height/2); // 保持在屏幕中心
        container.addChild(panel);
        
        // 获取当前段位信息
        const rankInfo = this.getRankInfo(this.score);
        
        // 创建标题
        const title = new Laya.Text();
        title.fontSize = 24;
        title.color = "#666666";
        title.width = 400;
        title.height = 40;
        title.align = "center";
        title.x = 0;
        title.y = 30;
        title.text = `恭喜 你获得「${rankInfo.rankName}」勋章！`;
        panel.addChild(title);
        
        // 创建段位图标容器
        const rankIconContainer = new Laya.Sprite();
        rankIconContainer.pos(200, 80);
        
        // 添加段位图标
        rankInfo.icons.forEach((iconPath, index) => {
            const icon = new Laya.Image();
            icon.skin = iconPath;
            icon.width = 32;
            icon.height = 32;
            icon.x = index * (32 + 4) - (rankInfo.icons.length * (32 + 4)) / 2;
            icon.y = 0;
            rankIconContainer.addChild(icon);
        });
        
        panel.addChild(rankIconContainer);
        
        // 创建装饰性分割线
        this.createDecorativeLine(panel, 130);
        
        // 调整统计数据容器位置
        const statsContainer = new Laya.Sprite();
        statsContainer.pos(30, 150);
        panel.addChild(statsContainer);
        
        // 统计数据项（使用图片图标）
        const stats = [
            { icon: "resources/enemy-tank.png", label: "击毁敌人", value: this.killCount },
            { icon: "resources/woodBox.png", label: "摧毁木箱", value: this.woodBoxCount },
            { icon: "resources/metalBox.png", label: "摧毁铁箱", value: this.metalBoxCount },
            { icon: "resources/treasure.png", label: "摧毁宝箱", value: this.treasureBoxCount }
        ];
        
        stats.forEach((stat, index) => {
            const item = this.createStatItem(stat, index);
            item.alpha = 0;
            item.x = -50;
            statsContainer.addChild(item);
            
            // 延迟入场动画
            Laya.timer.once(300 + index * 100, this, () => {
                Laya.Tween.to(item, {
                    alpha: 1,
                    x: 0
                }, 400, Laya.Ease.backOut);
            });
        });
        
        // 调整总分显示位置
        const scoreContainer = new Laya.Sprite();
        scoreContainer.pos(70, 320); // 调整总分位置
        panel.addChild(scoreContainer);
        
        const scoreLabel = new Laya.Text();
        scoreLabel.fontSize = 28; // 调整字体大小
        scoreLabel.color = "#FFD700";
        scoreLabel.text = "总分";
        scoreContainer.addChild(scoreLabel);
        
        const scoreValue = new Laya.Text();
        scoreValue.fontSize = 32; // 调整字体大小
        scoreValue.color = "#666666";
        scoreValue.x = 200; // 调整位置
        scoreValue.text = "0";
        scoreContainer.addChild(scoreValue);
        
        // 入场动画序列
        Laya.Tween.to(mask, { alpha: 1 }, 300, null, null, 0);
        
        // 修改面板入场动画
        container.y = 0; // 初始位置设为0
        container.alpha = 0;
        Laya.Tween.to(container, {
            alpha: 1
        }, 600, Laya.Ease.backOut, null, 200);
        
        // 分数动画
        let currentScore = 0;
        const updateScore = () => {
            currentScore = Math.min(currentScore + Math.ceil(this.score / 20), this.score);
            scoreValue.text = currentScore.toString();
            if (currentScore >= this.score) {
                Laya.timer.clear(this, updateScore);
            }
        };
        
        Laya.timer.loop(30, this, updateScore);
        
        // 5秒后退场动画
        Laya.timer.once(2000, this, () => {
            Laya.Tween.to(container, {
                alpha: 0,
                y: -Laya.stage.height
            }, 500, Laya.Ease.backIn);
            
            Laya.Tween.to(mask, { alpha: 0 }, 500, null, Laya.Handler.create(this, () => {
                mask.destroy();
                container.destroy();
                this.restartGame();
            }));
        });
    }

    // 修改面板绘制方法
    private drawPanel(panel: Laya.Sprite): void {
        const width = 400;
        const height = 400;
        
        // 绘制白色背景和边框
        panel.graphics.drawRect(0, 0, width, height, "#ffffff");
        panel.graphics.drawRect(0, 0, width, height, null, "#e0e0e0", 1);
    }

    // 修改分割线方法
    private createDecorativeLine(panel: Laya.Sprite, y: number): void {
        const line = new Laya.Sprite();
        const lineWidth = 340;
        const lineHeight = 1;
        
        // 使用浅灰色线条
        line.graphics.drawRect(30, y, lineWidth, lineHeight, "#e0e0e0");
        panel.addChild(line);
    }

    // 修改统计项创建方法
    private createStatItem(stat: { icon: string, label: string, value: number }, index: number): Laya.Sprite {
        const item = new Laya.Sprite();
        item.y = index * 40;
        
        // 创建图标
        const iconImage = new Laya.Image();
        iconImage.skin = stat.icon;
        iconImage.width = 24;
        iconImage.height = 24;
        iconImage.pos(0, 0);
        item.addChild(iconImage);
        
        // 创建标签
        const label = new Laya.Text();
        label.fontSize = 20;
        label.color = "#666666";
        label.x = 40;
        label.text = stat.label;
        item.addChild(label);
        
        // 创建数值
        const value = new Laya.Text();
        value.fontSize = 20;
        value.color = "#333333";
        value.x = 300;
        value.text = stat.value.toString();
        item.addChild(value);
        
        return item;
    }

    private restartGame(): void {
        // 重置统计数据
        this.killCount = 0;
        this.woodBoxCount = 0;
        this.metalBoxCount = 0;
        this.treasureBoxCount = 0;
        
        // 重置分数和升级点
        this.score = 0;
        this.initRankUpScores(); // 重新初始化升级分数点
        this.updateScoreDisplay();
        
        // 重新创建玩家坦克
        this.initPlayerTank();
        
        // 清理并重新生成箱子
        this.boxes.forEach(box => box.destroy());
        this.boxes = [];
        this.initBoxes();
        
        // 重新启用开火按钮
        if (this.fireBtn) {
            this.fireBtn.mouseEnabled = true;
        }
    }

    private createLocalFireworks(x: number, y: number): void {
        // 创建一个容器来存放粒子
        const container = new Laya.Sprite();
        container.pos(x, y);
        this.gameBox.addChild(container);

        // 创建多个粒子
        const particleCount = 12;
        for (let i = 0; i < particleCount; i++) {
            const particle = new Laya.Sprite();
            const size = Math.random() * 3 + 2;
            const colors = ["#FFD700", "#FFA500", "#FF6347"];
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            particle.graphics.drawCircle(0, 0, size, color);
            container.addChild(particle);

            // 计算粒子的随机方向
            const angle = (Math.PI * 2 / particleCount) * i;
            const distance = Math.random() * 30 + 20;
            const duration = Math.random() * 500 + 500;

            // 创建粒子动画
            Laya.Tween.to(particle, {
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance,
                alpha: 0,
                scaleX: 0.5,
                scaleY: 0.5
            }, duration, Laya.Ease.quadOut, Laya.Handler.create(this, () => {
                particle.destroy();
            }));
        }

        // 一段时间后销毁容器
        Laya.timer.once(1000, this, () => {
            container.destroy();
        });
    }

    private initLeaderboardButton(): void {
        const btnContainer = new Laya.Sprite();
        
        // 绘制灰色方框边框
        const width = 105;
        const height = 38;
        const borderWidth = 1;
        
        // 绘制边框
        btnContainer.graphics.drawRect(0, 0, width, height, null, "#999999", borderWidth);
        
        // 创建文本标签
        const label = new Laya.Text();
        label.text = "我的战绩";
        label.fontSize = 18;
        label.color = "#666666";
        label.width = width;
        label.height = height;
        label.align = "center";
        label.valign = "middle";
        label.alpha = 0.7;
        btnContainer.addChild(label);
        
        // 设置按钮位置
        const horizontalMargin = Laya.stage.width * 0.17 - 60;
        const verticalMargin = 10;
        btnContainer.pos(Laya.stage.width - horizontalMargin - width, verticalMargin);
        
        // 确保按钮可以接收触摸事件
        btnContainer.mouseEnabled = true;
        btnContainer.mouseThrough = false;
        
        // 添加点击区域
        const hitArea = new Laya.HitArea();
        hitArea.hit.drawRect(0, 0, width, height, "#000000");
        btnContainer.hitArea = hitArea;
        
        // 添加触摸事件
        btnContainer.on(Laya.Event.CLICK, this, () => {
            if (this.leaderboardPanel) {
                this.hideLeaderboard();
            } else {
                this.showLeaderboard();
            }
        });
        
        // 添加触摸反馈效果
        btnContainer.on(Laya.Event.MOUSE_DOWN, this, () => {
            label.alpha = 0.5;
        });
        
        btnContainer.on(Laya.Event.MOUSE_UP, this, () => {
            label.alpha = 1;
        });
        
        btnContainer.on(Laya.Event.MOUSE_OUT, this, () => {
            label.alpha = 1;
        });
        
        this.leaderboardBtn = btnContainer;
        this.owner.addChild(this.leaderboardBtn);
    }

    private showLeaderboard(): void {
        if (this.leaderboardMask) {
            return; // 已经显示了排行榜
        }

        // 创建半透明遮罩
        this.leaderboardMask = new Laya.Sprite();
        this.leaderboardMask.graphics.drawRect(0, 0, Laya.stage.width, Laya.stage.height, "rgba(0, 0, 0, 0.2)");
        this.leaderboardMask.mouseEnabled = true;
        this.leaderboardMask.mouseThrough = false;
        this.leaderboardMask.zOrder = 1000;
        this.leaderboardMask.on(Laya.Event.CLICK, this, this.hideLeaderboard);
        this.owner.addChild(this.leaderboardMask);

        // 创建排行榜面板
        this.leaderboardPanel = new Laya.Sprite();
        this.leaderboardPanel.zOrder = 1001;
        const panelWidth = 400;
        const panelHeight = 400;
        
        this.drawPanel(this.leaderboardPanel);
        this.leaderboardPanel.pivot(200, 200);
        this.leaderboardPanel.pos(Laya.stage.width/2, Laya.stage.height/2);
        this.owner.addChild(this.leaderboardPanel);

        // 获取玩家数据
        const currentPlayerData = LeaderboardManager.instance.getCurrentPlayerEntry();

        // 创建标题
        const title = new Laya.Text();
        title.text = "最高段位";
        title.fontSize = 24;
        title.color = "#333333";
        title.width = panelWidth;
        title.align = "center";
        title.y = 30;
        this.leaderboardPanel.addChild(title);

        // 创建装饰性分割线
        this.createDecorativeLine(this.leaderboardPanel, 70);

        // 创建段位信息
        const rankText = new Laya.Text();
        rankText.text = `${currentPlayerData.rankName}`;
        rankText.fontSize = 30;
        rankText.color = "#333333";
        rankText.width = panelWidth;
        rankText.align = "center";
        rankText.y = 100;
        this.leaderboardPanel.addChild(rankText);

        // 创建星级图标容器
        const starsContainer = new Laya.Sprite();
        starsContainer.y = 140;
        this.leaderboardPanel.addChild(starsContainer);

        // 根据段位名称选择对应的图标
        let iconPath = "";
        let starCount = 0;
        if (currentPlayerData.rankName.includes("长城")) {
            iconPath = "resources/greatwall.png";
            // 长城段位显示实际星级数量
            starCount = Math.floor((currentPlayerData.score - 66000) / GameMain.POINTS_PER_RANK) + 1;
        } else if (currentPlayerData.rankName.includes("青铜")) {
            iconPath = "resources/moon.png";
            starCount = Math.min(4, Math.ceil(currentPlayerData.score / GameMain.POINTS_PER_RANK) % 4 || 4);
        } else if (currentPlayerData.rankName.includes("白银")) {
            iconPath = "resources/star.png";
            starCount = Math.min(4, Math.ceil((currentPlayerData.score - 12000) / GameMain.POINTS_PER_RANK) % 4 || 4);
        } else if (currentPlayerData.rankName.includes("黄金")) {
            iconPath = "resources/sun.png";
            starCount = Math.min(4, Math.ceil((currentPlayerData.score - 24000) / GameMain.POINTS_PER_RANK) % 4 || 4);
        } else if (currentPlayerData.rankName.includes("钻石")) {
            iconPath = "resources/diamond.png";
            starCount = Math.min(4, Math.ceil((currentPlayerData.score - 36000) / GameMain.POINTS_PER_RANK) % 4 || 4);
        } else if (currentPlayerData.rankName.includes("王者")) {
            iconPath = "resources/king.png";
            starCount = Math.min(4, Math.ceil((currentPlayerData.score - 48000) / GameMain.POINTS_PER_RANK) % 4 || 4);
        }

        // 添加星级图标
        if (iconPath && starCount > 0) {
            const totalWidth = starCount * 24 + (starCount - 1) * 4; // 图标宽度24，间距4
            const startX = (panelWidth - totalWidth) / 2;
            
            for (let i = 0; i < starCount; i++) {
                const star = new Laya.Image();
                star.skin = iconPath;
                star.width = 24;
                star.height = 24;
                star.x = startX + i * (24 + 4);
                starsContainer.addChild(star);
            }
        }

        // 创建分数信息
        const scoreText = new Laya.Text();
        scoreText.text = `最高分数: ${currentPlayerData.score}`;
        scoreText.fontSize = 20;
        scoreText.color = "#666666";
        scoreText.width = panelWidth;
        scoreText.align = "center";
        scoreText.y = 180;
        this.leaderboardPanel.addChild(scoreText);

        // 创建全国排名信息
        const nationalRankText = new Laya.Text();
        nationalRankText.text = `全国排名: ${currentPlayerData.rank}`;
        nationalRankText.fontSize = 20;
        nationalRankText.color = "#666666";
        nationalRankText.width = panelWidth;
        nationalRankText.align = "center";
        nationalRankText.y = 220;
        this.leaderboardPanel.addChild(nationalRankText);

        // 创建超越玩家百分比信息
        const percentileText = new Laya.Text();
        percentileText.text = `超越了${currentPlayerData.percentile}%的玩家`;
        percentileText.fontSize = 20;
        percentileText.color = "#4CAF50";
        percentileText.width = panelWidth;
        percentileText.align = "center";
        percentileText.y = 260;
        this.leaderboardPanel.addChild(percentileText);

        // 添加入场动画
        this.leaderboardPanel.alpha = 0;
        this.leaderboardPanel.scale(0.8, 0.8);
        Laya.Tween.to(this.leaderboardPanel, {
            alpha: 1,
            scaleX: 1,
            scaleY: 1
        }, 300, Laya.Ease.backOut);

        // 两秒后自动关闭
        Laya.timer.once(2000, this, this.hideLeaderboard);
    }

    private hideLeaderboard(): void {
        if (this.leaderboardMask) {
            this.leaderboardMask.offAll();
            this.leaderboardMask.destroy();
            this.leaderboardMask = null;
        }
        if (this.leaderboardPanel) {
            this.leaderboardPanel.offAll();
            this.leaderboardPanel.destroy();
            this.leaderboardPanel = null;
        }
    }

    private createScorePopup(x: number, y: number, score: number): void {
        // 创建得分文本
        const scoreText = new Laya.Text();
        scoreText.text = "+" + score;
        scoreText.fontSize = 20;
        scoreText.color = "#4CAF50"; // 使用清新的绿色
        scoreText.stroke = 2;
        scoreText.strokeColor = "#ffffff"; // 使用白色描边
        scoreText.align = "center";
        scoreText.width = 100;
        scoreText.anchorX = 0.5;
        scoreText.anchorY = 0.5;
        scoreText.pos(x, y);
        scoreText.zOrder = 100; // 确保显示在最上层
        this.gameBox.addChild(scoreText);

        // 先快速放大一点
        scoreText.scale(0.5, 0.5);
        Laya.Tween.to(scoreText, {
            scaleX: 1.2,
            scaleY: 1.2
        }, 200, Laya.Ease.backOut, Laya.Handler.create(this, () => {
            // 然后开始向上飘并淡出
            Laya.Tween.to(scoreText, {
                y: y - 80,
                alpha: 0,
                scaleX: 1,
                scaleY: 1
            }, 1000, Laya.Ease.quadOut, Laya.Handler.create(this, () => {
                scoreText.destroy();
            }));
        }));
    }
} 