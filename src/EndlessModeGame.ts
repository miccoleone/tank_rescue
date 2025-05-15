const { regClass, property } = Laya;
import { Joystick } from "./Joystick";
import { BulletPool } from "./BulletPool";
import { Box, BoxType } from "./Box";
import { ExplosionManager } from "./ExplosionManager";
import { EnemyTank } from "./EnemyTank";
import { LeaderboardManager } from "./LeaderboardManager";
import { Pilot } from "./Pilot";
import { PilotPool } from "./PilotPool";
import { SceneManager } from "./SceneManager";
import { TutorialManager } from "./TutorialManager";
import { FireButton } from "./FireButton";


// 段位系统配置
interface RankLevel {
    name: string;
    icon: string;
    count: number;
}

@regClass()
export class EndlessModeGame extends Laya.Script {
    private static readonly MAP_WIDTH = 1334; // iPhone 6/7/8 Plus 横屏宽度
    private static readonly MAP_HEIGHT = 750; // iPhone 6/7/8 Plus 横屏高度
    private static readonly MIN_BOX_COUNT = 15; // 最小箱子数量
    private static readonly BOX_CHECK_INTERVAL = 2000; // 检查箱子数量的间隔（毫秒）
    private static readonly POINTS_PER_RANK = 3000; // 每个小段位所需分数
    private static readonly ENEMY_TANK_SCORE = 100; // 击毁敌方坦克得分
    private static readonly PILOT_RESCUE_SCORE = 1000; // 救援驾驶员的得分
    private static readonly INVINCIBLE_DURATION = 5000; // 无敌时间5秒
    
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
    /** @prop {name: fireBtn, tips: "开火按钮", type: Node, default: null}*/
    @property(FireButton)
    private fireBtn: FireButton;
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
    private rescuedPilots: number = 0;  // 新增：已救援的驾驶员数量
    private pilotBar: Laya.Sprite;      // 新增：驾驶员血条
    private pilotCountText: Laya.Text;   // 新增：驾驶员数量文本
    private leaderboardBtn: Laya.Sprite;
    private leaderboardMask: Laya.Sprite | null = null;
    private leaderboardPanel: Laya.Sprite | null = null;
    private rankUpScores: number[] = [];
    private invincibleEffect: Laya.Sprite | null = null;
    private isInvincible: boolean = false;
    private invincibleTimer: number = 0;
    private homeBtn: Laya.Sprite;
    // 开火按钮透明度常量
    private static readonly FIRE_BTN_NORMAL_ALPHA = 0.3;  // 正常状态透明度
    private static readonly FIRE_BTN_PRESSED_ALPHA = 0.8; // 按下状态透明度
    
    private backgroundTiles: Laya.Sprite[] = [];
    
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
            "resources/score.mp3",
            "resources/click.mp3",
            "resources/enemy-tank.png",
            "resources/moon.png",
            "resources/star.png",
            "resources/sun.png",
            "resources/diamond.png",
            "resources/king.png",
            "resources/greatwall.png",
            "resources/闪电.png",
            "resources/home.png",
            "resources/circle_60_red.png",
            "resources/circle_60.png"
        ], Laya.Handler.create(this, () => {
            // 确保爆炸管理器初始化
            ExplosionManager.instance;
            console.log("所有资源加载完成");
        }));
    }

    onAwake(): void {
        console.log("EndlessModeGame onAwake");

        // 设置游戏屏幕适配
        Laya.stage.scaleMode = Laya.Stage.SCALE_FIXED_WIDTH;
        Laya.stage.alignH = Laya.Stage.ALIGN_CENTER;
        Laya.stage.alignV = Laya.Stage.ALIGN_MIDDLE;
        Laya.stage.screenMode = Laya.Stage.SCREEN_HORIZONTAL;
        
        // 初始化驾驶员对象池
        PilotPool.instance;
        
        // 播放背景音乐
        this.bgMusic = Laya.SoundManager.playMusic("resources/background.mp3", 0);
        this.bgMusic.volume = 0.5;
        
        // 初始化游戏场景
        this.initGameScene();
        // 初始化玩家坦克
        this.initPlayerTank();
        // 初始化虚拟摇杆
        this.initJoystick();
        // 初始化开火按钮
        this.initFireButton();
        // 初始化积分和段位显示
        this.initScoreDisplay();
        // 初始化排行榜按钮
        // this.initLeaderboardButton();
        // 初始化箱子
        this.initBoxes();
        // 开始箱子检查定时器
        Laya.timer.loop(EndlessModeGame.BOX_CHECK_INTERVAL, this, this.checkBoxCount);
        // 开始敌人检查定时器
        Laya.timer.loop(EndlessModeGame.ENEMY_CHECK_INTERVAL, this, this.checkEnemyCount);
        // 开始碰撞检测
        Laya.timer.frameLoop(1, this, this.checkCollisions);
        // 初始化主页按钮
        this.initHomeButton();

        // 显示无尽模式教程提示
        // TutorialManager.instance.showEndlessModeTip(this.owner as Laya.Sprite, 0, 0, true);
    }

    private initGameScene(): void {
        // 强制设置背景颜色为白色 - 这应该会覆盖任何默认背景
        Laya.stage.bgColor = "#ffffff";
        
        // 创建游戏容器
        this.gameBox = new Laya.Sprite();
        this.gameBox.name = "GameBox";
        this.owner.addChild(this.gameBox);

        // 创建游戏地图背景
        this.createGameBackground();
    }

    private createGameBackground(): void {
        const tileSize = 128; // 地图瓦片大小
        const numTilesX = Math.ceil(Laya.stage.width / tileSize) + 1;
        const numTilesY = Math.ceil(Laya.stage.height / tileSize) + 1;

        // 清除现有的背景瓦片
        this.backgroundTiles.forEach(tile => tile.destroy());
        this.backgroundTiles = [];

        // 创建地图瓦片
        for (let i = 0; i < numTilesX; i++) {
            for (let j = 0; j < numTilesY; j++) {
                const tile = new Laya.Sprite();
                tile.loadImage("resources/Retina/tileGrass1.png");
                tile.width = tileSize;
                tile.height = tileSize;
                tile.x = i * tileSize;
                tile.y = j * tileSize;
                this.gameBox.addChildAt(tile, 0); // 确保瓦片在最底层
                this.backgroundTiles.push(tile);
            }
        }
    }

    private initPlayerTank(): void {
        // 创建坦克容器
        this.tank = new Laya.Sprite();
        this.tank.name = "PlayerTank";
        
        // 使用tank.png作为坦克图片
        let tankImage = new Laya.Image();
        tankImage.skin = "resources/Retina/tank1_red.png";
        tankImage.width = 30;
        tankImage.height = 30;
        tankImage.pivot(15, 15);
        tankImage.rotation = -90;
        this.tank.addChild(tankImage);
        
        // 将坦克放置在屏幕中央
        this.tank.pos(Laya.stage.width / 2, Laya.stage.height / 2);
        this.gameBox.addChild(this.tank);

        // 创建无敌效果
        this.createInvincibleEffect();
        // 激活无敌状态
        this.activateInvincible();
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
        // 创建开火按钮组件
        const fireButtonSprite = new Laya.Sprite();
        fireButtonSprite.name = "FireButtonContainer";
        this.owner.addChild(fireButtonSprite);
        
        // 添加并初始化开火按钮组件
        this.fireBtn = fireButtonSprite.addComponent(FireButton);
        this.fireBtn.init(
            () => this.onFireStart(),
            () => this.onFireEnd()
        );

        // 设置按钮位置
        const horizontalMargin = Math.round(Laya.stage.width * 0.17);
        const verticalMargin = Math.round(Laya.stage.height * 0.25);
        this.fireBtn.setPosition(
            Math.round(Laya.stage.width - horizontalMargin),
            Math.round(Laya.stage.height - verticalMargin)
        );
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
        let speed = 3 * strength;
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
        
        // 播放开火音效并发射子弹
        this.onFire();
    }

    private onFireEnd(): void {
        // 不需要特殊处理
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
        let bullet = BulletPool.instance.getItem(EndlessModeGame.BULLET_SIGN);
        if (!bullet) return;
        
        bullet.name = "Bullet_" + this.bullets.length;
        
        // 计算子弹的起始位置（坦克前方20像素）
        const radian = this.tank.rotation * Math.PI / 180;
        const startX = this.tank.x + Math.cos(radian) * 20;
        const startY = this.tank.y + Math.sin(radian) * 20;
        
        // 设置子弹位置和旋转
        bullet.pos(startX, startY);
        bullet.rotation = this.tank.rotation;
        
        // 计算基础速度和段位加成
        let baseSpeed = 15;
        const currentRankInfo = this.getRankInfo(this.score);
        const rankBonus = Math.floor(Math.floor(this.score / EndlessModeGame.POINTS_PER_RANK) / 4) * 5; // 每个大段位（4个小段位）增加5点速度
        let speed = baseSpeed + rankBonus;
        
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
                    this.score += EndlessModeGame.ENEMY_TANK_SCORE;
                    this.updateScoreDisplay();
                    ExplosionManager.instance.playExplosion(enemy.x, enemy.y, this.gameBox, true);
                    // 添加得分弹出效果
                    this.createScorePopup(enemy.x, enemy.y, EndlessModeGame.ENEMY_TANK_SCORE);
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
                BulletPool.instance.recover(EndlessModeGame.BULLET_SIGN, bullet);
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
            // 注意：不要在这里增加击杀统计，避免重复计数
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

        // 创建驾驶员血条容器
        const pilotContainer = new Laya.Sprite();
        pilotContainer.pos(adjustedMargin + this.scoreText.width + 50, 20); // 放在分数右边，增加间距到50
        uiContainer.addChild(pilotContainer);

        // 创建血条
        this.pilotBar = new Laya.Sprite();
        pilotContainer.addChild(this.pilotBar);

        // 创建驾驶员数量文本
        this.pilotCountText = new Laya.Text();
        this.pilotCountText.fontSize = 24;
        this.pilotCountText.color = "#333333";
        this.pilotCountText.stroke = 2;
        this.pilotCountText.strokeColor = "#e0e0e0";
        this.pilotCountText.pos(5, 0);
        this.pilotCountText.visible = false; // 初始不显示
        pilotContainer.addChild(this.pilotCountText);

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
        const currentLevel = Math.floor(score / EndlessModeGame.POINTS_PER_RANK);
        
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
        for (let i = 0; i < EndlessModeGame.RANKS.length; i++) {
            const rank = EndlessModeGame.RANKS[i];
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
            const newRankIndex = EndlessModeGame.RANKS.findIndex(r => r.name === rankInfo.rankName);
            
            if (newRankIndex !== -1 && newRankIndex !== this.lastRankIndex) {
                this.lastRankIndex = newRankIndex;
                // 不在这里调用checkRankUp，避免递归
            }
        } else {
            this.lastRankIndex = EndlessModeGame.RANKS.findIndex(r => r.name === rankInfo.rankName);
        }
    }

    private initRankUpScores(): void {
        // 初始化所有升级分数点
        this.rankUpScores = [];
        for (let i = 1; i <= 22; i++) { // 22个等级点，对应66000分
            this.rankUpScores.push(i * EndlessModeGame.POINTS_PER_RANK);
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
            this.levelUpSound = Laya.SoundManager.playSound("resources/fire.mp3", 1);
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
            }, duration * speed, Laya.Ease.quadOut, Laya.Handler.create(this, () => {
                particle.destroy();
            }));
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
        while (this.boxes.length < EndlessModeGame.MIN_BOX_COUNT) {
            this.createRandomBox();
        }
    }

    private updateMiniMap(): void {
        // 暂时不实现小地图功能
    }

    private getRequiredEnemyCount(): number {
        const currentLevel = Math.floor(this.score / EndlessModeGame.POINTS_PER_RANK);
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
            
            if (distance < EndlessModeGame.COLLISION_DISTANCE) {
                // 如果处于无敌状态，不触发游戏结束
                if (!this.isInvincible) {
                    this.handleGameOver();
                    return;
                }
            }
        }

        // 检查子弹碰撞
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            
            // 检查与敌方坦克的碰撞
            for (let j = this.enemyTanks.length - 1; j >= 0; j--) {
                const enemy = this.enemyTanks[j];
                if (this.checkEnemyCollision(bullet, enemy)) {
                    // 播放爆炸效果
                    ExplosionManager.instance.playExplosion(enemy.x, enemy.y, this.gameBox, true);
                    
                    // 回收子弹和敌人
                    this.recycleBullet(bullet);
                    enemy.destroy();
                    this.enemyTanks.splice(j, 1);
                    
                    // 增加分数和击杀计数
                    this.score += 1000;
                    this.killCount++;
                    this.updateScoreDisplay();
                    break;
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
        }

        // 检查玩家坦克与驾驶员的碰撞
        if (this.tank && !this.tank.destroyed) {
            // 获取所有驾驶员
            const pilots: Pilot[] = [];
            for (let i = 0; i < this.gameBox.numChildren; i++) {
                const node = this.gameBox.getChildAt(i);
                if (node instanceof Pilot) {
                    pilots.push(node);
                }
            }

            for (const pilot of pilots) {
                // 使用更宽松的碰撞检测（60像素范围 - 光圈大小）
                const dx = this.tank.x - pilot.x;
                const dy = this.tank.y - pilot.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 60) {  // 60像素的救援范围，覆盖光圈区域
                    // 播放得分音效
                    Laya.SoundManager.playSound("resources/score.mp3", 1);
                    
                    // 增加分数
                    this.score += EndlessModeGame.PILOT_RESCUE_SCORE;
                    this.updateScoreDisplay();
                    
                    // 增加救援计数并更新显示
                    this.rescuedPilots++;
                    this.updatePilotDisplay();
                    
                    // 触发救援效果（对象池会自动处理回收）
                    pilot.rescue();
                }
            }
        }
    }

    private checkEnemyCollision(bullet: Laya.Sprite, enemy: Laya.Sprite): boolean {
        const dx = bullet.x - enemy.x;
        const dy = bullet.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < 20; // 使用20像素的碰撞范围
    }

    private handleGameOver(): void {
        // 禁用开火按钮
        if (this.fireBtn) {
            this.fireBtn.setEnabled(false);
        }
        
        // 添加灰色滤镜效果
        const grayFilter = new Laya.ColorFilter([
            0.3, 0.59, 0.11, 0, 0,  // R
            0.3, 0.59, 0.11, 0, 0,  // G
            0.3, 0.59, 0.11, 0, 0,  // B
            0, 0, 0, 1, 0           // A
        ]);
        this.gameBox.filters = [grayFilter];
        
        // 播放爆炸效果
        ExplosionManager.instance.playExplosion(this.tank.x, this.tank.y, this.gameBox);
        
        // 销毁玩家坦克
        this.tank.destroy();

        // 创建结算面板
        this.showGameStats();
        
        // 显示倒计时
        this.showCountdown();
    }

    private showGameStats(): void {
        // 创建结算面板容器
        const container = new Laya.Sprite();
        container.zOrder = 1001;
        container.alpha = 0;
        this.owner.addChild(container);
        
        // 修改面板尺寸和样式
        const panel = new Laya.Sprite();
        this.drawPanel(panel);
        panel.pivot(200, 200);
        panel.pos(Laya.stage.width/2, Laya.stage.height/2);
        container.addChild(panel);
        
        // 获取当前段位信息
        const rankInfo = this.getRankInfo(this.score);
        
        // 创建标题
        const title = new Laya.Text();
        if (this.rescuedPilots > 0) {
            title.text = `英雄 你成功救下 ${this.rescuedPilots}名驾驶员！`;
        } else {
            title.text = `恭喜 你获得「${rankInfo.rankName}」勋章！`;
        }
        title.fontSize = 24;
        title.color = "#333333";
        title.width = 400;
        title.height = 40;
        title.align = "center";
        title.x = 0;
        title.y = 30;
        title.overflow = Laya.Text.HIDDEN;
        title.wordWrap = false;
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
        
        // 统计数据项
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
        scoreContainer.pos(70, 320);
        panel.addChild(scoreContainer);
        
        const scoreLabel = new Laya.Text();
        scoreLabel.fontSize = 28;
        scoreLabel.color = "#FFD700";
        scoreLabel.text = "总分";
        scoreContainer.addChild(scoreLabel);
        
        const scoreValue = new Laya.Text();
        scoreValue.fontSize = 32;
        scoreValue.color = "#666666";
        scoreValue.x = 200;
        scoreValue.text = "0";
        scoreContainer.addChild(scoreValue);
        
        // 入场动画
        container.y = 0;
        container.alpha = 0;
        Laya.Tween.to(container, {
            alpha: 1
        }, 600, Laya.Ease.backOut);
        
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
        
        // 2秒后退场动画
        Laya.timer.once(2000, this, () => {
            Laya.Tween.to(container, {
                alpha: 0,
                y: -50
            }, 500, Laya.Ease.backIn, Laya.Handler.create(this, () => {
                container.destroy();
            }));
        });
    }

    private showCountdown(): void {
        // 创建倒计时容器
        const countdownContainer = new Laya.Sprite();
        countdownContainer.zOrder = 1002;
        countdownContainer.pivot(60, 60);
        countdownContainer.pos(Laya.stage.width / 2, Laya.stage.height / 2);
        this.owner.addChild(countdownContainer);
        
        // 创建倒计时背景 - 使用半透明圆形
        const bg = new Laya.Sprite();
        bg.graphics.drawCircle(60, 60, 70, "rgba(0, 0, 0, 0.3)");
        countdownContainer.addChild(bg);
        
        // 创建倒计时数字文本
        const numberText = new Laya.Text();
        numberText.text = "7";
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
        let countdown = 7;
        const updateCountdown = () => {
            countdown--;
            
            // 更新数字文本
            numberText.text = countdown.toString();
            
            // 播放缩放动画
            countdownContainer.scale(1.5, 1.5);
            Laya.Tween.to(countdownContainer, { scaleX: 1, scaleY: 1 }, 500, Laya.Ease.backOut);
            
            // 在倒计时最后1秒重置游戏数据
            if (countdown === 1) {
                // 重置分数和相关信息
                this.score = 0;
                this.killCount = 0;
                this.woodBoxCount = 0;
                this.metalBoxCount = 0;
                this.treasureBoxCount = 0;
                this.rescuedPilots = 0;
                this.initRankUpScores();
                this.updateScoreDisplay();
                this.updatePilotDisplay();
                
                // 只在当前箱子数量少于15个时才生成新箱子
                const activeBoxCount = this.boxes.filter(box => !box.destroyed).length;
                if (activeBoxCount < EndlessModeGame.MIN_BOX_COUNT) {
                    const boxesToAdd = EndlessModeGame.MIN_BOX_COUNT - activeBoxCount;
                    for (let i = 0; i < boxesToAdd; i++) {
                        this.createRandomBox();
                    }
                }
            }
            
            if (countdown <= 0) {
                Laya.timer.clear(this, updateCountdown);
                
                // 移除灰色滤镜
                this.gameBox.filters = null;
                
                // 移除倒计时容器
                countdownContainer.destroy();
                
                // 重新创建玩家坦克
                this.initPlayerTank();
                
                // 重新启用开火按钮
                if (this.fireBtn) {
                    this.fireBtn.setEnabled(true);
                }

                // 创建无敌效果并激活无敌状态
                this.createInvincibleEffect();
                this.activateInvincible();
            }
        };
        
        Laya.timer.loop(1000, this, updateCountdown);
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

    private updatePilotDisplay(): void {
        const GRID_WIDTH = 7;  // 每格宽度
        const BAR_HEIGHT = 20; // 血条高度
        
        // 确保血条存在
        if (!this.pilotBar) return;
        
        // 清除之前的绘制
        this.pilotBar.graphics.clear();
        
        // 如果没有救援的驾驶员，隐藏显示
        if (this.rescuedPilots === 0) {
            this.pilotCountText.visible = false;
            return;
        }

        // 显示数量文本
        this.pilotCountText.visible = true;
        
        // 计算总宽度
        const barWidth = this.rescuedPilots * GRID_WIDTH;
        
        // 先绘制整个血条背景
        this.pilotBar.graphics.drawRect(0, 0, barWidth, BAR_HEIGHT, "#388E3C");
        
        // 绘制格子分隔线
        for (let i = 1; i < this.rescuedPilots; i++) {
            const x = i * GRID_WIDTH;
            this.pilotBar.graphics.drawLine(x, 0, x, BAR_HEIGHT, "#FFFFFF", 1);
        }
        
        // 更新数量文本位置和内容
        this.pilotCountText.x = barWidth + 5;  // 血条后留5像素间距
        this.pilotCountText.text = `X${this.rescuedPilots}`;
    }

    private createInvincibleEffect(): void {
        // 移除旧的无敌效果（如果存在）
        if (this.invincibleEffect) {
            this.invincibleEffect.destroy();
        }
    
        // 创建无敌效果容器
        this.invincibleEffect = new Laya.Sprite();
        this.gameBox.addChild(this.invincibleEffect);
    
        // 创建渐变圆圈
        const radius = Laya.stage.height / 4; // 屏幕高度的1/4
        const gradient = new Laya.Sprite();
        
        // 使用半透明绿色绘制圆圈
        gradient.graphics.drawCircle(0, 0, radius, null, "green");
        
        // 添加发光效果
        const glowRadius = radius + 5;
        gradient.graphics.drawCircle(0, 0, glowRadius, null, "#00ff0011");
    
        // 添加阴影效果
        const shadowFilter = new Laya.GlowFilter("#00ff00", 10, 7, 7, 2); // 绿色阴影，模糊度为10，偏移量为7
        gradient.filters = [shadowFilter];
    
        this.invincibleEffect.addChild(gradient);
        this.invincibleEffect.pos(this.tank.x, this.tank.y);
        this.invincibleEffect.alpha = 0.6;
    
        // 添加缩放动画
        const scaleAnimation = () => {
            Laya.Tween.to(this.invincibleEffect, {
                scaleX: 1.1,
                scaleY: 1.1,
                alpha: 0.4
            }, 1000, Laya.Ease.sineInOut, Laya.Handler.create(this, () => {
                Laya.Tween.to(this.invincibleEffect, {
                    scaleX: 1,
                    scaleY: 1,
                    alpha: 0.6
                }, 1000, Laya.Ease.sineInOut, Laya.Handler.create(this, scaleAnimation));
            }));
        };
        
        scaleAnimation();
    }

    private activateInvincible(): void {
        this.isInvincible = true;
        this.invincibleTimer = Date.now();
        
        // 启动无敌状态检查
        Laya.timer.frameLoop(1, this, this.checkInvincibleStatus);
    }

    private checkInvincibleStatus(): void {
        if (!this.isInvincible) return;
        
        const currentTime = Date.now();
        if (currentTime - this.invincibleTimer >= EndlessModeGame.INVINCIBLE_DURATION) {
            // 无敌时间结束
            this.isInvincible = false;
            if (this.invincibleEffect) {
                this.invincibleEffect.destroy();
                this.invincibleEffect = null;
            }
            Laya.timer.clear(this, this.checkInvincibleStatus);
        } else {
            // 更新无敌效果位置
            if (this.invincibleEffect && this.tank) {
                this.invincibleEffect.pos(this.tank.x, this.tank.y);
            }
        }
    }

    private initHomeButton(): void {
        // 创建按钮容器
        const btnContainer = new Laya.Sprite();
        btnContainer.name = "HomeButton";
        
        // 创建 Home 图标，使用原始 32x32 大小
        const homeIcon = new Laya.Image();
        homeIcon.skin = "resources/home.png";
        homeIcon.width = 32;
        homeIcon.height = 32;
        // 设置图标的轴心点为中心
        homeIcon.pivot(16, 0);
        homeIcon.alpha = 0.9;
        btnContainer.addChild(homeIcon);
        
        // 使用与开火按钮相同的水平位置
        const horizontalMargin = Math.round(Laya.stage.width * 0.17);
        const verticalMargin = 20;
        btnContainer.pos(
            Math.round(Laya.stage.width - horizontalMargin),
            verticalMargin
        );
        
        // 添加点击区域（相对于轴心点调整）
        const hitArea = new Laya.HitArea();
        hitArea.hit.drawRect(-16, 0, 32, 32, "#000000");
        btnContainer.hitArea = hitArea;
        
        // 确保按钮可以接收点击事件
        btnContainer.mouseEnabled = true;
        btnContainer.mouseThrough = false;
        
        // 添加点击事件，直接返回主页
        btnContainer.on(Laya.Event.CLICK, this, () => {
            console.log("Home button clicked"); // 添加调试日志
            Laya.SoundManager.playSound("resources/click.mp3", 1);
            this.destroyGame();  // 先清理游戏
            // SceneManager.instance.toHomePage();  // 再返回主页
            SceneManager.instance.navigateToScene("HomePage");
        });
        
        this.homeBtn = btnContainer;
        this.owner.addChild(this.homeBtn);
    }

    private destroyGame(): void {
        // 停止所有计时器
        Laya.timer.clearAll(this);
        
        // 停止背景音乐
        if (this.bgMusic) {
            this.bgMusic.stop();
            this.bgMusic = null;
        }
        
        // 停止其他音效
        if (this.fireSound) {
            this.fireSound.stop();
            this.fireSound = null;
        }
        if (this.levelUpSound) {
            this.levelUpSound.stop();
            this.levelUpSound = null;
        }
        // if (this.clickMusic) {
        //     this.clickMusic.stop();
        //     this.clickMusic = null;
        // }
        
        // 销毁所有敌方坦克
        this.enemyTanks.forEach(enemy => {
            if (!enemy.destroyed) {
                enemy.destroy();
            }
        });
        this.enemyTanks = [];
        
        // 销毁所有箱子
        this.boxes.forEach(box => {
            if (!box.destroyed) {
                box.destroy();
            }
        });
        this.boxes = [];
        
        // 销毁所有子弹
        this.bullets.forEach(bullet => {
            if (!bullet.destroyed) {
                this.recycleBullet(bullet);
            }
        });
        this.bullets = [];
        
        // 销毁玩家坦克
        if (this.tank && !this.tank.destroyed) {
            this.tank.destroy();
        }
        
        // 销毁游戏容器
        if (this.gameBox && !this.gameBox.destroyed) {
            this.gameBox.destroy();
        }
        
        // 重置游戏数据
        this.score = 0;
        this.killCount = 0;
        this.woodBoxCount = 0;
        this.metalBoxCount = 0;
        this.treasureBoxCount = 0;
        this.lastRankIndex = -1;
    }

    // 6. 修改 onDestroy 方法，确保完全清理
    onDestroy(): void {
        // 销毁游戏
        this.destroyGame();
        
        // 清理所有计时器和动画
        Laya.timer.clearAll(this);
        Laya.Tween.clearAll(this);
        
        // 清理引用
        this.gameBox = null;
        this.tank = null;
        this.joystick = null;
        this.fireBtn = null;
        this.bullets = [];
        this.boxes = [];
        this.enemyTanks = [];
        this.pilotBar = null;
        this.pilotCountText = null;
        this.invincibleEffect = null;
    }
} 