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
import { Achievement } from "./Achievement";
import { PopupPanel } from "./PopupPanel";
import { FireButton } from "./FireButton";
import { PlayerTankSkinUtil, TankSkinType } from "./PlayerTankSkinUtil";
import { CongratulationUtils } from "./CongratulationUtils";
import { ScoreUtil } from "./ScoreUtil";

// 添加微信小游戏API的类型声明
declare const wx: {
    createRewardedVideoAd: (options: { adUnitId: string }) => {
        show: () => Promise<any>;
        load: () => Promise<any>;
        onClose: (callback: (res?: { isEnded?: boolean }) => void) => void;
        offClose: () => void;
    };
    shareAppMessage: (options: {
        title: string;
        desc?: string;
        imageUrl?: string;
        success?: () => void;
        fail?: (error: any) => void;
    }) => void;
};

// 段位系统配置
interface RankLevel {
    name: string;
    icon: string;
    count: number;
}

@regClass()
export class RescueModeGame extends Laya.Script {
    private static readonly MAP_WIDTH = 1334; // iPhone 6/7/8 Plus 横屏宽度
    private static readonly MAP_HEIGHT = 750; // iPhone 6/7/8 Plus 横屏高度
    private static readonly MIN_BOX_COUNT = 15; // 最小箱子数量
    private static readonly BOX_CHECK_INTERVAL = 2000; // 检查箱子数量的间隔（毫秒）
    private static readonly POINTS_PER_RANK = 3000; // 每个小段位所需分数
    private static readonly ENEMY_TANK_SCORE = 500; // 击毁敌方坦克得分
    private static readonly PILOT_RESCUE_SCORE = 500; // 救援驾驶员的得分
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
    // 新增：坦克皮肤相关属性
    private currentTankSkin: TankSkinType = TankSkinType.TANK1_RED;
    private tankBody: Laya.Image;
    private upgradeTankEffect: Laya.Sprite | null = null;
    private backgroundTiles: Laya.Sprite[] = [];
    // 开火按钮透明度常量
    private static readonly FIRE_BTN_NORMAL_ALPHA = 0.3;  // 正常状态透明度
    private static readonly FIRE_BTN_PRESSED_ALPHA = 0.8; // 按下状态透明度
    private initialRank: string; // 添加属性来存储初始军衔
    /** @private 弹框组件 */
    private popupPanel: PopupPanel;
    // 添加类属性来跟踪当前显示的弹框
    private currentMessageContainer: Laya.Sprite = null;
    private currentStatsContainer: Laya.Sprite = null;
    // 添加更多跟踪容器
    private currentCountdownContainer: Laya.Sprite = null;
    // 添加视频广告实例
    private videoAd: any;
    private isPlayerDead: boolean = false; // 新增：玩家死亡标志

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
            "resources/circle_60_red.png",
            "resources/home.png",
            "resources/circle_60.png",
            // 加载坦克皮肤和背景资源
            "resources/Retina/tank1_blue.png",
            "resources/Retina/tank1_red.png",
            "resources/Retina/tank2_blue.png",
            "resources/Retina/tank2_red.png",
            "resources/Retina/tank3_red1.png",
            "resources/Retina/tank3_red2.png",
            "resources/Retina/tank4_1.png",
            // 地形图片
            "resources/Retina/tileGrass1.png",
            "resources/Retina/tileGrass2.png",
            "resources/Retina/tileSand1.png",
            "resources/Retina/tileSand2.png",
            "resources/Retina/tileGrass_roadEast.png",
            "resources/Retina/tileGrass_roadNorth.png",
            "resources/Retina/tileGrass_roadCornerLL.png",
            "resources/Retina/tileGrass_roadCornerLR.png",
            "resources/Retina/tileGrass_roadCornerUL.png",
            "resources/Retina/tileGrass_roadCornerUR.png",
            "resources/Retina/tileGrass_roadCrossing.png",
            "resources/Retina/tileGrass_roadCrossingRound.png",
            "resources/Retina/treeGreen_large.png",
            "resources/Retina/treeBrown_large.png",
            "resources/Retina/treeGreen_small.png",
            "resources/Retina/treeBrown_small.png"
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
        
        // 初始化弹框组件
        try {
            this.popupPanel = this.owner.addComponent(PopupPanel);
        } catch (e) {
            console.error("初始化弹框组件失败:", e);
        }
        
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
        Laya.timer.loop(RescueModeGame.BOX_CHECK_INTERVAL, this, this.checkBoxCount);
        // 开始敌人检查定时器
        Laya.timer.loop(RescueModeGame.ENEMY_CHECK_INTERVAL, this, this.checkEnemyCount);
        // 开始碰撞检测
        Laya.timer.frameLoop(1, this, this.checkCollisions);
        // 初始化主页按钮
        this.initHomeButton();
        
        // 记录初始军衔
        this.initialRank = Achievement.instance.getCurrentRankInfo_junxian().rank;
        // 在onAwake方法末尾添加
        this.initRewardedVideoAd();
    }


        // 在类初始化部分，添加广告实例初始化
    private initRewardedVideoAd(): void {
        if (typeof wx !== 'undefined') {
            try {
                // 创建激励视频广告实例
                this.videoAd = wx.createRewardedVideoAd({
                    adUnitId: 'adunit-c1744ed78e810a8d'
                });
                
                console.log('微信广告初始化成功');
            } catch (e) {
                console.error('微信广告初始化失败', e);
            }
        }
    }

    private initGameScene(): void {
        // 创建游戏容器
        this.gameBox = new Laya.Sprite();
        this.gameBox.name = "GameBox";
        this.owner.addChild(this.gameBox);

        // 创建游戏背景
        this.createGameBackground();
    }

    /**
     * 创建游戏背景，使用Retina目录中的地形图片
     */
    private createGameBackground(): void {
        // 获取舞台宽高
        const width = Laya.stage.width;
        const height = Laya.stage.height;
        
        // 创建背景容器
        const backgroundContainer = new Laya.Sprite();
        backgroundContainer.name = "BackgroundContainer";
        this.gameBox.addChildAt(backgroundContainer, 0);
        
        // 设置地形图片尺寸
        const tileSize = 64; // 每个地形图片的尺寸
        
        // 计算需要的图片数量
        const tilesX = Math.ceil(width / tileSize) + 1; // 多一列用于视差滚动
        const tilesY = Math.ceil(height / tileSize) + 1; // 多一行用于视差滚动
        
        // 可用的地形图片
        const grassTiles = [
            "resources/Retina/tileGrass1.png",
            "resources/Retina/tileGrass2.png"
        ];
        
        const roadTiles = [
            "resources/Retina/tileGrass_roadEast.png",
            "resources/Retina/tileGrass_roadNorth.png",
            "resources/Retina/tileGrass_roadCornerLL.png",
            "resources/Retina/tileGrass_roadCornerLR.png",
            "resources/Retina/tileGrass_roadCornerUL.png",
            "resources/Retina/tileGrass_roadCornerUR.png"
        ];
        
        const specialTiles = [
            "resources/Retina/tileGrass_roadCrossing.png",
            "resources/Retina/tileGrass_roadCrossingRound.png"
        ];
        
        const trees = [
            "resources/Retina/treeGreen_large.png",
            "resources/Retina/treeBrown_large.png",
            "resources/Retina/treeGreen_small.png",
            "resources/Retina/treeBrown_small.png"
        ];
        
        // 地图设计：创建主要道路
        // 首先铺设基础草地
        for (let y = 0; y < tilesY; y++) {
            for (let x = 0; x < tilesX; x++) {
                const tile = new Laya.Sprite();
                const img = new Laya.Image();
                
                // 基础草地随机选择
                img.skin = grassTiles[Math.floor(Math.random() * grassTiles.length)];
                img.width = tileSize;
                img.height = tileSize;
                tile.addChild(img);
                tile.pos(x * tileSize, y * tileSize);
                
                this.backgroundTiles.push(tile);
                backgroundContainer.addChild(tile);
            }
        }
        
        // 添加道路 - 水平主干道
        const mainRoadY = Math.floor(tilesY / 2);
        for (let x = 0; x < tilesX; x++) {
            // 找到对应的grass tile并替换成road
            const index = mainRoadY * tilesX + x;
            if (index < this.backgroundTiles.length) {
                const roadTile = this.backgroundTiles[index];
                roadTile.removeChildren();
                
                const img = new Laya.Image();
                img.skin = "resources/Retina/tileGrass_roadEast.png";
                img.width = tileSize;
                img.height = tileSize;
                roadTile.addChild(img);
            }
        }
        
        // 添加垂直道路
        const crossroads = [
            Math.floor(tilesX * 0.25),
            Math.floor(tilesX * 0.75)
        ];
        
        for (const crossX of crossroads) {
            // 绘制垂直道路
            for (let y = 0; y < tilesY; y++) {
                const index = y * tilesX + crossX;
                if (index < this.backgroundTiles.length) {
                    const roadTile = this.backgroundTiles[index];
                    roadTile.removeChildren();
                    
                    const img = new Laya.Image();
                    // 在十字路口使用特殊的十字路口瓦片
                    if (y === mainRoadY) {
                        img.skin = specialTiles[Math.floor(Math.random() * specialTiles.length)];
                    } else {
                        img.skin = "resources/Retina/tileGrass_roadNorth.png";
                    }
                    img.width = tileSize;
                    img.height = tileSize;
                    roadTile.addChild(img);
                }
            }
        }
        
        // 添加装饰 - 随机树木
        const treeCount = Math.floor((tilesX * tilesY) * 0.05); // 地图5%的位置有树
        for (let i = 0; i < treeCount; i++) {
            // 随机位置，但避免道路
            let x, y;
            let isOnRoad = true;
            
            while (isOnRoad) {
                x = Math.floor(Math.random() * tilesX);
                y = Math.floor(Math.random() * tilesY);
                
                // 检查是否在道路上
                isOnRoad = y === mainRoadY || crossroads.indexOf(x) !== -1; // 使用indexOf代替includes
                
                // 如果不在道路上，添加树木
                if (!isOnRoad) {
                    const treeImg = new Laya.Image();
                    treeImg.skin = trees[Math.floor(Math.random() * trees.length)];
                    treeImg.width = tileSize * 0.8;
                    treeImg.height = tileSize * 0.8;
                    
                    // 随机放置在瓦片内的某个位置
                    const offsetX = (Math.random() * 0.2) * tileSize;
                    const offsetY = (Math.random() * 0.2) * tileSize;
                    
                    treeImg.pos(x * tileSize + offsetX, y * tileSize + offsetY);
                    treeImg.zOrder = y * tilesX + x + 1000; // 确保树木显示在地形上方
                    backgroundContainer.addChild(treeImg);
                }
            }
        }
    }

    private initPlayerTank(): void {
        // 创建坦克容器
        this.tank = new Laya.Sprite();
        this.tank.name = "PlayerTank";
        
        // 创建坦克身体
        this.tankBody = new Laya.Image();
        
        // 设置坦克皮肤 - 简化逻辑
        this.tankBody.skin = this.currentTankSkin;
        this.tankBody.width = 30;  
        this.tankBody.height = 30; 
        this.tankBody.pivot(15, 15); 
        this.tankBody.rotation = -90;
        this.tank.addChild(this.tankBody);
        
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
        
        // 计算移动距离，基础速度为5，最大不超过7.5（1.5倍）
        const baseSpeed = 4;
        const maxSpeed = baseSpeed * 1.5;
        let speed = baseSpeed * strength;
        speed = Math.min(speed, maxSpeed); // 限制最大速度
        
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
        let bullet = BulletPool.instance.getItem(RescueModeGame.BULLET_SIGN);
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
        let baseSpeed = 10;
        const currentRankInfo = this.getRankInfo(this.score);
        const rankBonus = Math.floor(Math.floor(this.score / RescueModeGame.POINTS_PER_RANK) / 4) * 1; // 每个大段位（4个小段位）增加1点速度
        let speed = baseSpeed + rankBonus;
        
        // 限制最大速度不超过15
        speed = Math.min(speed, 15);
        
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
                    this.score += RescueModeGame.ENEMY_TANK_SCORE;
                    this.updateScoreDisplay();
                    ExplosionManager.instance.playExplosion(enemy.x, enemy.y, this.gameBox, true);
                    // 添加得分弹出效果
                    ScoreUtil.getInstance().createScorePopup(enemy.x, enemy.y, RescueModeGame.ENEMY_TANK_SCORE, this.gameBox);
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
                        ScoreUtil.getInstance().createScorePopup(box.x, box.y, earnedScore, this.gameBox);
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
                BulletPool.instance.recover(RescueModeGame.BULLET_SIGN, bullet);
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
        const currentLevel = Math.floor(score / RescueModeGame.POINTS_PER_RANK);
        
        // 长城段位（66000分以上）
        if (score >= 66000) {
            const baseStars = 1; // 基础星星数
            const extraStars = Math.floor((score - 66000) / 3000); // 每3000分增加一颗星
            const totalStars = Math.min(baseStars + extraStars, 7); // 限制最多7个长城图标
            
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
        for (let i = 0; i < RescueModeGame.RANKS.length; i++) {
            const rank = RescueModeGame.RANKS[i];
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
            const newRankIndex = RescueModeGame.RANKS.findIndex((r: RankLevel) => r.name === rankInfo.rankName);
            
            if (newRankIndex !== -1 && newRankIndex !== this.lastRankIndex) {
                this.lastRankIndex = newRankIndex;
                // 不在这里调用checkRankUp，避免递归
            }
        } else {
            this.lastRankIndex = RescueModeGame.RANKS.findIndex((r: RankLevel) => r.name === rankInfo.rankName);
        }
    }

    private initRankUpScores(): void {
        // 初始化所有升级分数点
        this.rankUpScores = [];
        for (let i = 1; i <= 22; i++) { // 22个等级点，对应66000分
            this.rankUpScores.push(i * RescueModeGame.POINTS_PER_RANK);
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
            
            // 如果已经达到最高级段位（7个长城），就不显示特效
            if (this.score >= 84000) return;  // 84000分对应7个长城 (66000 + 3000 * 6)
            
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
            icon.y = 2;
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
        while (this.boxes.length < RescueModeGame.MIN_BOX_COUNT) {
            this.createRandomBox();
        }
    }

    private updateMiniMap(): void {
        // 暂时不实现小地图功能
    }

    private getRequiredEnemyCount(): number {
        const currentLevel = Math.floor(this.score / RescueModeGame.POINTS_PER_RANK);
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
        if (!this.tank || this.tank.destroyed || this.isPlayerDead) return;
        
        // 检查与敌方坦克的碰撞
        for (const enemy of this.enemyTanks) {
            if (enemy.destroyed) continue;
            
            const dx = this.tank.x - enemy.x;
            const dy = this.tank.y - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < RescueModeGame.COLLISION_DISTANCE) {
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
                    // 添加得分弹出效果
                    ScoreUtil.getInstance().createScorePopup(enemy.x, enemy.y, 1000, this.gameBox);
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
                        ScoreUtil.getInstance().createScorePopup(box.x, box.y, earnedScore, this.gameBox);
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

        // 检查玩家坦克与驾驶员的碰撞，只在坦克在屏幕内时执行
        if (!this.tank.destroyed) {
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
                    this.score += RescueModeGame.PILOT_RESCUE_SCORE;
                    this.updateScoreDisplay();
                    
                    // 增加救援计数并更新显示
                    this.rescuedPilots++;
                    this.updatePilotDisplay();
                    
                    // 立即检查军衔晋升 - 提供及时的体验反馈
                    this.checkRankPromotion();
                    
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

    /**
     * 检查军衔晋升 - 可在任何时候调用，提供及时的体验反馈
     */
    private checkRankPromotion(): void {
        const currentRank = Achievement.instance.getCurrentRankInfo_junxian().rank;
        if (currentRank !== this.initialRank) {
            // 使用渐隐通知显示军衔晋升，不打断游戏体验
            this.popupPanel.showFadeNotification(`🎉 你晋升至${currentRank}！`, 4000, "#FFD700");
            // 更新初始军衔记录
            this.initialRank = currentRank;
        }
    }

    private handleGameOver(): void {
        // 先清理所有UI
        this.clearAllUI();
        
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
        
        // 记录坦克位置，用于后续散落驾驶员
        const tankX = this.tank.x;
        const tankY = this.tank.y;
        
        // 彻底禁用碰撞检测，而不是移动坦克
        // 1. 设置一个标志，表示坦克已经"死亡"
        this.isPlayerDead = true;
        
        // 玩家死亡时显示home按钮
        if (this.homeBtn) {
            this.homeBtn.visible = true;
        }
        
        // 2. 可以选择隐藏坦克，但不是必须的
        this.tank.visible = false;
        
        // 若玩家有救援的驾驶员，在死亡时散落这些驾驶员
        if (this.rescuedPilots > 0) {
            this.scatterRescuedPilots(tankX, tankY);
        }

        // 检查军衔晋升 - 使用渐隐通知，不打断游戏
        this.checkRankPromotion();
        
        // 直接显示倒计时，不再显示结算面板
        this.showCountdown();
    }
    
    /**
     * 在玩家死亡时散落所有已救援的驾驶员
     * @param x 坦克X坐标
     * @param y 坦克Y坐标
     */
    private scatterRescuedPilots(x: number, y: number): void {
        // 散落所有驾驶员 上限 50
        if(this.rescuedPilots > 50){
            this.rescuedPilots = 50;
        }

        // 先暂停游戏中所有已有的驾驶员倒计时
        PilotPool.pauseAllPilots(this.gameBox);
        
        // 创建新的驾驶员
        for (let i = 0; i < this.rescuedPilots; i++) {
            // 从对象池获取驾驶员
            const pilot = PilotPool.instance.getPilot();
            
            // 计算散落位置（在爆炸点周围随机位置）
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 70 + 10; // 10-80像素的随机距离，使驾驶员密集一些
            const pilotX = x + Math.cos(angle) * distance;
            const pilotY = y + Math.sin(angle) * distance;
            
            // 设置位置并添加到场景
            pilot.pos(pilotX, pilotY);
            this.gameBox.addChild(pilot);
        }
        
        // 重置救援驾驶员计数
        // this.rescuedPilots = 0;
        // this.updatePilotDisplay();
    }

    /**
     * 继续游戏结束流程
     */
    private continueGameOver(): void {
        // 创建结算面板
        this.showGameStats();
        // 显示倒计时
        this.showCountdown();
    }

    private showGameStats(): void {
        // 清理可能存在的旧面板
        if (this.currentStatsContainer) {
            // 停止所有相关动画
            Laya.Tween.clearAll(this.currentStatsContainer);
            Laya.timer.clearAll(this.currentStatsContainer);
            // 销毁旧面板
            this.currentStatsContainer.destroy();
            this.currentStatsContainer = null;
        }
        
        // 创建结算面板容器
        const container = new Laya.Sprite();
        this.currentStatsContainer = container; // 存储引用以便后续清理
        
        container.zOrder = 1001;
        container.alpha = 0;
        this.owner.addChild(container);
        
        // 修改面板尺寸和样式
        const panel = new Laya.Sprite();
        this.drawPanel(panel);
        panel.pos(Laya.stage.width / 2, Laya.stage.height / 2);
        container.addChild(panel);
        
        // 获取当前段位信息
        const rankInfo = this.getRankInfo(this.score);
        
        // 创建标题
        const title = new Laya.Text();
        if (this.rescuedPilots > 0) {
            title.text = `英雄 你成功救下 ${this.rescuedPilots}名驾驶员！`;
        } else {
            title.text = "你尽力了";
        }
        title.fontSize = 24;
        title.color = "#FFD700"; // 改为金色，与背景搭配
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
                if (!container.destroyed) {
                    Laya.Tween.to(item, {
                        alpha: 1,
                        x: 0
                    }, 400, Laya.Ease.backOut);
                }
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
        scoreValue.color = "#FFFFFF"; // 改为白色，使在深色背景上更清晰
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
            if (container.destroyed) {
                Laya.timer.clear(this, updateScore);
                return;
            }
            
            currentScore = Math.min(currentScore + Math.ceil(this.score / 20), this.score);
            scoreValue.text = currentScore.toString();
            if (currentScore >= this.score) {
                Laya.timer.clear(this, updateScore);
            }
        };
        
        Laya.timer.loop(30, this, updateScore);
        
        // 2秒后退场动画
        Laya.timer.once(2000, this, () => {
            // 确保面板仍然存在
            if (this.currentStatsContainer === container && !container.destroyed) {
                Laya.Tween.to(container, {
                    alpha: 0,
                    y: -50
                }, 500, Laya.Ease.backIn, Laya.Handler.create(this, () => {
                    // 清理面板
                    if (this.currentStatsContainer === container) {
                        this.currentStatsContainer = null;
                    }
                    container.destroy();
                }));
            }
        });
    }

    // 在直接显示倒计时之前，确保所有驾驶员计时器都已正常启动
    private showCountdown(): void {
        // 清理可能存在的旧倒计时面板
        if (this.currentCountdownContainer) {
            Laya.Tween.clearAll(this.currentCountdownContainer);
            Laya.timer.clearAll(this.currentCountdownContainer);
            this.currentCountdownContainer.destroy();
            this.currentCountdownContainer = null;
        }
        
        // 确保清理所有其他UI
        this.clearAllUI();
        
        // 恢复所有驾驶员的计时器，确保它们的倒计时正常运行
        // 注意：这里恢复是为了确保任何之前暂停的驾驶员都会继续倒计时
        PilotPool.resumeAllPilots(this.gameBox);
        
        // 创建倒计时容器
        const countdownContainer = new Laya.Sprite();
        this.currentCountdownContainer = countdownContainer;
        
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

        // 创建复活按钮容器
        const reviveButton = new Laya.Sprite();
        reviveButton.name = "ReviveButton";
        reviveButton.zOrder = 1003;
        
        // 设置按钮位置 - 水平方向保持在75%，垂直方向居中
        reviveButton.pos(Laya.stage.width * 0.75, Laya.stage.height * 0.5);
        this.owner.addChild(reviveButton);

        // 创建按钮背景 - 使用圆角矩形和阴影效果
        const buttonBg = new Laya.Sprite();
        // 先绘制阴影
        buttonBg.graphics.drawRect(-122, 2, 240, 104, "rgba(0,0,0,0.1)");
        // 再绘制白色圆角背景
        buttonBg.graphics.drawPath(-120, 0, [
            ["moveTo", 10, 0],
            ["lineTo", 230, 0],
            ["arcTo", 240, 0, 240, 10, 10],
            ["lineTo", 240, 90],
            ["arcTo", 240, 100, 230, 100, 10],
            ["lineTo", 10, 100],
            ["arcTo", 0, 100, 0, 90, 10],
            ["lineTo", 0, 10],
            ["arcTo", 0, 0, 10, 0, 10],
            ["closePath"]
        ], {fillStyle: "#ffffff"});
        
        // 设置按钮的轴心点 - 将Y轴轴心点设在按钮中心
        reviveButton.pivot(60, 50);
        reviveButton.addChild(buttonBg);

        // 添加视频图标
        const videoIcon = new Laya.Image();
        videoIcon.skin = "resources/video.png";
        videoIcon.width = 40;
        videoIcon.height = 40;
        videoIcon.pos(-80, 30);  // 图标位置保持不变
        reviveButton.addChild(videoIcon);

        // 添加文本
        const buttonText = new Laya.Text();
        buttonText.text = "免费复活";
        buttonText.fontSize = 28;
        buttonText.color = "#333333";
        buttonText.width = 160; 
        buttonText.height = 100;
        buttonText.align = "left"; 
        buttonText.valign = "middle";
        buttonText.pos(-30, 0);  // 文字位置保持不变
        reviveButton.addChild(buttonText);

        // 改进点击区域设置 - 使用与按钮背景完全匹配的区域
        const hitArea = new Laya.HitArea();
        hitArea.hit.drawRect(-120, 0, 240, 100, "#000000");
        reviveButton.hitArea = hitArea;
        reviveButton.mouseEnabled = true;

        // 添加触摸事件
        reviveButton.on(Laya.Event.MOUSE_DOWN, this, () => {
            buttonBg.alpha = 0.85;
            Laya.Tween.to(reviveButton, { scaleX: 0.95, scaleY: 0.95 }, 100, null, null, 0, true, true);
        });
        reviveButton.on(Laya.Event.MOUSE_UP, this, () => {
            buttonBg.alpha = 1;
            Laya.Tween.to(reviveButton, { scaleX: 1, scaleY: 1 }, 100, null, null, 0, true, true);
        });
        reviveButton.on(Laya.Event.MOUSE_OUT, this, () => {
            buttonBg.alpha = 1;
            reviveButton.scale(1, 1);
        });

        // 声明一个变量来控制倒计时是否暂停
        let isCountdownPaused = false;
        // 引用倒计时定时器ID，以便在必要时清除
        let countdownTimerId = -1;
        
        // 复活按钮点击事件部分，使用简化逻辑
        reviveButton.on(Laya.Event.CLICK, this, () => {
            // 播放点击音效
            Laya.SoundManager.playSound("resources/click.mp3", 1);
            
            // 立即暂停倒计时
            isCountdownPaused = true;
            
            // 检查广告实例是否存在并且在微信环境中
            // @ts-ignore
            if (this.videoAd && typeof wx !== 'undefined') {
                console.log("正在拉起广告...");
                
                // 暂停所有驾驶员的倒计时
                PilotPool.pauseAllPilots(this.gameBox);
                
                // 显示微信广告
                this.videoAd.show().catch(() => {
                    // 失败重试一次
                    this.videoAd.load()
                        .then(() => {
                            // 再次暂停所有驾驶员的倒计时（以防在加载期间恢复）
                            PilotPool.pauseAllPilots(this.gameBox);
                            this.videoAd.show();
                        })
                        .catch(() => {
                            console.error('广告显示失败');
                            // 广告显示失败，恢复倒计时
                            isCountdownPaused = false;
                            // 恢复所有驾驶员的倒计时
                            PilotPool.resumeAllPilots(this.gameBox);
                        });
                });
                
                // 监听广告关闭事件
                // @ts-ignore
                this.videoAd.onClose(res => {
                    // 取消监听，避免多次触发
                    this.videoAd.offClose();
                    console.log("广告关闭", res);
                    
                    // 用户完整观看广告
                    // @ts-ignore
                    if (res && res.isEnded || res === undefined) {
                        console.log("广告观看完成，复活玩家");
                        
                        // 重置所有驾驶员的计时器为完整的6秒
                        PilotPool.resetAllPilotsTimer(this.gameBox);
                        
                        // 彻底停止倒计时
                        if (countdownTimerId !== -1) {
                            Laya.timer.clear(this, updateCountdown);
                            countdownTimerId = -1;
                        }
                        
                        // 移除倒计时、复活按钮和分享按钮
                        countdownContainer.destroy();
                        reviveButton.destroy();
                        shareButton.destroy();
                        
                        // 复活玩家
                        this.revivePlayer();
                    } else {
                        console.log("广告未完整观看，继续倒计时");
                        // 广告未完整观看，恢复倒计时
                        isCountdownPaused = false;
                        // 恢复所有驾驶员的倒计时
                        PilotPool.resumeAllPilots(this.gameBox);
                    }
                });
            } else {
                console.log("非微信环境，直接复活");
                // 非微信环境，直接允许复活（开发测试用）
                
                // 重置所有驾驶员的计时器为完整的6秒
                PilotPool.resetAllPilotsTimer(this.gameBox);
                
                // 彻底停止倒计时
                if (countdownTimerId !== -1) {
                    Laya.timer.clear(this, updateCountdown);
                    countdownTimerId = -1;
                }
                
                // 移除倒计时、复活按钮和分享按钮
                countdownContainer.destroy();
                reviveButton.destroy();
                shareButton.destroy();
                
                // 复活玩家
                this.revivePlayer();
            }
        });

        // 创建分享按钮容器
        const shareButton = new Laya.Sprite();
        shareButton.name = "ShareButton";
        shareButton.zOrder = 1003;
        
        // 设置分享按钮位置 - 在复活按钮右侧，增加间距到100像素避免连接
        shareButton.pos(Laya.stage.width * 0.75 + 200, Laya.stage.height * 0.5);
        this.owner.addChild(shareButton);

        // 创建分享按钮背景 - 使用橙色主题与复活按钮区别，调整尺寸
        const shareBg = new Laya.Sprite();
        // 先绘制阴影
        shareBg.graphics.drawRect(-67, 2, 134, 104, "rgba(0,0,0,0.1)");
        // 再绘制橙色圆角背景 - 稍微缩小避免视觉连接
        shareBg.graphics.drawPath(-65, 0, [
            ["moveTo", 10, 0],
            ["lineTo", 124, 0],
            ["arcTo", 134, 0, 134, 10, 10],
            ["lineTo", 134, 90],
            ["arcTo", 134, 100, 124, 100, 10],
            ["lineTo", 10, 100],
            ["arcTo", 0, 100, 0, 90, 10],
            ["lineTo", 0, 10],
            ["arcTo", 0, 0, 10, 0, 10],
            ["closePath"]
        ], {fillStyle: "#FF9966"}); // 淡橙色背景
        
        // 设置分享按钮的轴心点 - 将Y轴轴心点设在按钮中心
        shareButton.pivot(34, 50);
        shareButton.addChild(shareBg);

        // 添加分享图标 - 使用share.png图片
        const shareIcon = new Laya.Image();
        shareIcon.skin = "resources/share.png";
        shareIcon.width = 36;
        shareIcon.height = 36;
        shareIcon.pos(-55, 32);  // 图标位置
        shareButton.addChild(shareIcon);

        // 添加分享文本
        const shareText = new Laya.Text();
        shareText.text = "分享";
        shareText.fontSize = 28;
        shareText.color = "#FFFFFF";
        shareText.width = 70; 
        shareText.height = 100;
        shareText.align = "left"; 
        shareText.valign = "middle";
        shareText.pos(-10, 0);  // 文字位置，在图标右侧
        shareButton.addChild(shareText);

        // 设置分享按钮点击区域
        const shareHitArea = new Laya.HitArea();
        shareHitArea.hit.drawRect(-65, 0, 134, 100, "#000000");
        shareButton.hitArea = shareHitArea;
        shareButton.mouseEnabled = true;

        // 添加分享按钮触摸事件
        shareButton.on(Laya.Event.MOUSE_DOWN, this, () => {
            shareBg.alpha = 0.85;
            Laya.Tween.to(shareButton, { scaleX: 0.95, scaleY: 0.95 }, 100, null, null, 0, true, true);
        });
        shareButton.on(Laya.Event.MOUSE_UP, this, () => {
            shareBg.alpha = 1;
            Laya.Tween.to(shareButton, { scaleX: 1, scaleY: 1 }, 100, null, null, 0, true, true);
        });
        shareButton.on(Laya.Event.MOUSE_OUT, this, () => {
            shareBg.alpha = 1;
            shareButton.scale(1, 1);
        });

        // 分享按钮点击事件
        shareButton.on(Laya.Event.CLICK, this, () => {
            // 播放点击音效
            Laya.SoundManager.playSound("resources/click.mp3", 1);
            
            // 在微信环境中调用分享API
            if (typeof wx !== 'undefined') {
                try {
                    wx.shareAppMessage({
                        title: `我拯救了${this.rescuedPilots}名战士！你能挑战我吗？`,
                        imageUrl: "resources/endless_mode.png", // 可以设置分享图片
                        success: () => {
                            console.log("分享成功");
                            // this.popupPanel.showFadeNotification("分享成功！", 2000, "#00CC00");
                        },
                        fail: (error: any) => {
                            console.log("分享失败", error);
                        }
                    });
                } catch (e) {
                    console.log("分享API调用失败", e);
                }
            } else {
                console.log("非微信环境，显示分享模拟");
            }
        });

        // 开始倒计时
        let countdown = 7;
        const updateCountdown = () => {
            // 如果倒计时被暂停，则跳过更新
            if (isCountdownPaused) return;
            
            // 如果容器已被销毁，清除定时器
            if (countdownContainer.destroyed) {
                if (countdownTimerId !== -1) {
                    Laya.timer.clear(this, updateCountdown);
                    countdownTimerId = -1;
                }
                return;
            }
            
            countdown--;
            
            // 更新数字文本
            numberText.text = countdown.toString();
            
            // 播放缩放动画
            countdownContainer.scale(1.5, 1.5);
            Laya.Tween.to(countdownContainer, { scaleX: 1, scaleY: 1 }, 500, Laya.Ease.backOut);
            
            // 在倒计时结束时重置游戏
            if (countdown <= 0) {
                if (countdownTimerId !== -1) {
                    Laya.timer.clear(this, updateCountdown);
                    countdownTimerId = -1;
                }
                
                // 移除倒计时容器、复活按钮和分享按钮
                countdownContainer.destroy();
                reviveButton.destroy();
                shareButton.destroy();
                
                // 重置游戏
                this.resetGame();
            }
        };
        
        // 记录定时器ID
        countdownTimerId = Laya.timer.loop(1000, this, updateCountdown) as unknown as number;
    }
    
    /**
     * 复活玩家 - 单独封装复活逻辑
     */
    private revivePlayer(): void {
        console.log("执行玩家复活");
        // 移除灰色滤镜
        this.gameBox.filters = null;
        
        // 重置玩家死亡状态
        this.isPlayerDead = false;
        
        // 复活时隐藏home按钮（因为游戏继续）
        if (this.homeBtn) {
            this.homeBtn.visible = false;
        }
        
        // 保持当前皮肤不变，因为玩家完整观看了广告
        // 注意：不重置currentTankSkin，保持之前的高级皮肤
        
        // 重置坦克位置和状态
        if (this.tank.destroyed) {
            this.initPlayerTank();
        } else {
            // 重新显示坦克并放置到屏幕中央
            this.tank.visible = true;
            this.tank.pos(Laya.stage.width / 2, Laya.stage.height / 2);
            this.tankBody.rotation = -90; // 重置旋转
            
            // 保持当前皮肤（当坦克未被销毁时需要手动更新皮肤）
            if (this.tankBody) {
                this.tankBody.skin = this.currentTankSkin;
            }
        }
        
        // 重新启用开火按钮
        if (this.fireBtn) {
            this.fireBtn.setEnabled(true);
        }
        
        // 创建无敌效果并激活无敌状态
        this.createInvincibleEffect();
        this.activateInvincible();
        
        // 确保所有驾驶员的计时器都已恢复正常
        PilotPool.resumeAllPilots(this.gameBox);
        
        // 清零救援人数，让玩家可以重新救援死前散落的驾驶员
        this.rescuedPilots = 0;
        this.updatePilotDisplay();
    }
    
    /**
     * 重置游戏 - 单独封装游戏重置逻辑
     */
    private resetGame(): void {
        console.log("执行游戏重置");
        // 移除灰色滤镜
        this.gameBox.filters = null;
        
        // 重置玩家死亡状态
        this.isPlayerDead = false;
        
        // 重置游戏时隐藏home按钮
        if (this.homeBtn) {
            this.homeBtn.visible = false;
        }
        
        // 重置为初始皮肤（因为玩家未完整观看广告）
        const initialSkin = PlayerTankSkinUtil.getInstance().getPlayerSkin(0);
        this.currentTankSkin = initialSkin.skin;
        
        // 重置游戏数据
        this.score = 0;
        this.killCount = 0;
        this.woodBoxCount = 0;
        this.metalBoxCount = 0;
        this.treasureBoxCount = 0;
        this.rescuedPilots = 0;
        this.initRankUpScores();
        this.updateScoreDisplay();
        this.updatePilotDisplay();
        
        // 重置里程碑庆祝状态
        CongratulationUtils.getInstance().reset();
        
        // 确保所有驾驶员的计时器都已恢复正常
        PilotPool.resumeAllPilots(this.gameBox);
        
        // 只在当前箱子数量少于15个时才生成新箱子
        const activeBoxCount = this.boxes.filter(box => !box.destroyed).length;
        if (activeBoxCount < RescueModeGame.MIN_BOX_COUNT) {
            const boxesToAdd = RescueModeGame.MIN_BOX_COUNT - activeBoxCount;
            for (let i = 0; i < boxesToAdd; i++) {
                this.createRandomBox();
            }
        }
        
        // 重置坦克状态
        if (this.tank.destroyed) {
            this.initPlayerTank();
        } else {
            // 重新显示坦克并放置到屏幕中央
            this.tank.visible = true;
            this.tank.pos(Laya.stage.width / 2, Laya.stage.height / 2);
            this.tankBody.rotation = -90; // 重置旋转
            
            // 应用初始皮肤
            if (this.tankBody) {
                this.tankBody.skin = this.currentTankSkin;
            }
        }
        
        // 重新启用开火按钮
        if (this.fireBtn) {
            this.fireBtn.setEnabled(true);
        }
        
        // 创建无敌效果并激活无敌状态
        this.createInvincibleEffect();
        this.activateInvincible();
    }

    // 修改面板绘制方法
    private drawPanel(panel: Laya.Sprite): void {
        const width = 400;
        const height = 400;
        
        // 绘制半透明黑色背景和金色边框，与坦克升级提示保持一致
        panel.graphics.drawRect(0, 0, width, height, "rgba(255,255,255,0.6)");
        panel.graphics.drawRect(0, 0, width, height, null, "#FFD700", 2);
        
        // 设置轴心点
        panel.pivot(width / 2, height / 2);
    }

    // 修改分割线方法
    private createDecorativeLine(panel: Laya.Sprite, y: number): void {
        const line = new Laya.Sprite();
        const lineWidth = 340;
        const lineHeight = 1;
        
        // 使用金色分割线，与背景搭配
        line.graphics.drawRect(30, y, lineWidth, lineHeight, "#FFD700");
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
        label.color = "#DDDDDD"; // 改为浅色，提高可读性
        label.x = 40;
        label.text = stat.label;
        item.addChild(label);
        
        // 创建数值
        const value = new Laya.Text();
        value.fontSize = 20;
        value.color = "#FFFFFF"; // 改为白色，使在深色背景上更清晰
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
        
        // 判断是否提升地方坦克难度
        const EnemyTank = Laya.ClassUtils.getClass("EnemyTank");
        if (EnemyTank && typeof EnemyTank.updateSpeedStatus === 'function') {
            EnemyTank.updateSpeedStatus(this.rescuedPilots > 50);
        }
        
        // 检查是否需要升级坦克皮肤
        // 简化逻辑，保存当前皮肤，获取新皮肤，比较是否需要升级
        const tempSkin = this.currentTankSkin;
        const skinConfig = PlayerTankSkinUtil.getInstance().getPlayerSkin(this.rescuedPilots);
        
        // 如果皮肤与当前不同，需要升级
        if (skinConfig.skin !== tempSkin) {
            // 保存新皮肤
            this.currentTankSkin = skinConfig.skin;
            
            // 应用新皮肤
            if (this.tankBody) {
                this.tankBody.skin = skinConfig.skin;
            }
            
            // 显示升级提示
            this.showTankUpgradeMessage(skinConfig.tankName);
        }
        
        // 检查并显示救援里程碑庆祝信息
        CongratulationUtils.getInstance().checkAndShowCongratulation(
            this.rescuedPilots, 
            (title, desc) => this.showCongratulationMessage(title, desc)
        );
    }
    
    /**
     * 显示坦克升级消息 - 简化版本，避免渲染问题
     */
    private showTankUpgradeMessage(levelName: string): void {
        // 先清理可能存在的旧面板
        if (this.currentMessageContainer) {
            Laya.Tween.clearAll(this.currentMessageContainer);
            Laya.timer.clearAll(this.currentMessageContainer);
            this.currentMessageContainer.destroy();
            this.currentMessageContainer = null;
        }
        
        // 创建消息容器
        const messageContainer = new Laya.Sprite();
        this.currentMessageContainer = messageContainer;
        
        messageContainer.zOrder = 2000;
        this.gameBox.addChild(messageContainer);
        
        // 设置面板尺寸 - 恢复老版大小
        const panelWidth = 300;
        const panelHeight = 80;
        
        // 简化背景 - 只用一次绘制，避免多层渲染，但恢复老版样式
        const bg = new Laya.Sprite();
        bg.graphics.clear(); // 确保清空
        // 先绘制填充，再绘制边框，避免重叠问题 - 恢复老版的深色背景
        bg.graphics.drawRect(0, 0, panelWidth, panelHeight, "rgba(0, 0, 0, 0.6)"); // 恢复深色半透明背景
        bg.graphics.drawRect(1, 1, panelWidth-2, panelHeight-2, null, "#FFD700", 2); // 黄色边框，内缩1像素避免重叠
        messageContainer.addChild(bg);
        
        // 创建标题 - 恢复老版样式
        const title = new Laya.Text();
        title.text = "坦克升级！";
        title.fontSize = 22; // 恢复老版字体大小
        title.color = "#FFD700";
        title.width = 280;
        title.height = 30;
        title.align = "center";
        title.pos(10, 10); // 恢复老版位置
        messageContainer.addChild(title);
        
        // 创建描述 - 恢复老版样式
        const desc = new Laya.Text();
        desc.text = `已获得 ${levelName} 坦克`;
        desc.fontSize = 16; // 恢复老版字体大小
        desc.color = "#FFFFFF"; // 恢复白色字体
        desc.width = 280;
        desc.height = 40;
        desc.align = "center";
        desc.pos(10, 40); // 恢复老版位置
        messageContainer.addChild(desc);
        
        // 设置位置 - 居中显示
        messageContainer.pivot(panelWidth / 2, panelHeight / 2);
        messageContainer.pos(Laya.stage.width / 2, Laya.stage.height / 2 - 100); // 恢复老版位置
        
        // 简化动画 - 只用淡入淡出，避免缩放导致的渲染问题
        messageContainer.alpha = 0;
        Laya.Tween.to(messageContainer, {
            alpha: 1
        }, 300, Laya.Ease.quadOut, Laya.Handler.create(this, () => {
            // 2秒后隐藏
            Laya.timer.once(2000, this, () => {
                if (this.currentMessageContainer === messageContainer && !messageContainer.destroyed) {
                    Laya.Tween.to(messageContainer, {
                        alpha: 0
                    }, 400, Laya.Ease.quadIn, Laya.Handler.create(this, () => {
                        if (this.currentMessageContainer === messageContainer) {
                            this.currentMessageContainer = null;
                        }
                        messageContainer.destroy();
                    }));
                }
            });
        }));
    }

    /**
     * 显示庆祝消息 - 简化版本，与坦克升级提示保持一致
     */
    private showCongratulationMessage(title: string, desc: string): void {
        // 先清理可能存在的旧面板
        if (this.currentMessageContainer) {
            Laya.Tween.clearAll(this.currentMessageContainer);
            Laya.timer.clearAll(this.currentMessageContainer);
            this.currentMessageContainer.destroy();
            this.currentMessageContainer = null;
        }
        
        // 创建消息容器
        const messageContainer = new Laya.Sprite();
        this.currentMessageContainer = messageContainer;
        
        messageContainer.zOrder = 2000;
        this.gameBox.addChild(messageContainer);
        
        // 设置面板尺寸 - 恢复老版大小
        const panelWidth = 300;
        const panelHeight = 80;
        
        // 简化背景 - 只用一次绘制，避免多层渲染，但恢复老版样式
        const bg = new Laya.Sprite();
        bg.graphics.clear(); // 确保清空
        // 先绘制填充，再绘制边框，避免重叠问题 - 恢复老版的深色背景
        bg.graphics.drawRect(0, 0, panelWidth, panelHeight, "rgba(0, 0, 0, 0.6)"); // 恢复深色半透明背景
        bg.graphics.drawRect(1, 1, panelWidth-2, panelHeight-2, null, "#FFD700", 2); // 黄色边框，内缩1像素避免重叠
        messageContainer.addChild(bg);
        
        // 创建标题 - 恢复老版样式
        const titleText = new Laya.Text();
        titleText.text = title;
        titleText.fontSize = 22; // 恢复老版字体大小
        titleText.color = "#FFD700";
        titleText.width = 280;
        titleText.height = 30;
        titleText.align = "center";
        titleText.pos(10, 10); // 恢复老版位置
        messageContainer.addChild(titleText);
        
        // 创建描述 - 恢复老版样式
        const descText = new Laya.Text();
        descText.text = desc;
        descText.fontSize = 16; // 恢复老版字体大小
        descText.color = "#FFFFFF"; // 恢复白色字体
        descText.width = 280;
        descText.height = 40;
        descText.align = "center";
        descText.pos(10, 40); // 恢复老版位置
        messageContainer.addChild(descText);
        
        // 设置位置 - 居中显示
        messageContainer.pivot(panelWidth / 2, panelHeight / 2);
        messageContainer.pos(Laya.stage.width / 2, Laya.stage.height / 2 - 100); // 恢复老版位置
        
        // 简化动画 - 只用淡入淡出，避免缩放导致的渲染问题
        messageContainer.alpha = 0;
        Laya.Tween.to(messageContainer, {
            alpha: 1
        }, 300, Laya.Ease.quadOut, Laya.Handler.create(this, () => {
            // 2秒后隐藏
            Laya.timer.once(2000, this, () => {
                if (this.currentMessageContainer === messageContainer && !messageContainer.destroyed) {
                    Laya.Tween.to(messageContainer, {
                        alpha: 0
                    }, 400, Laya.Ease.quadIn, Laya.Handler.create(this, () => {
                        if (this.currentMessageContainer === messageContainer) {
                            this.currentMessageContainer = null;
                        }
                        messageContainer.destroy();
                    }));
                }
            });
        }));
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
    
        // 添加阴影效果，修正参数数量
        const shadowFilter = new Laya.GlowFilter("#00ff00", 10, 7, 7);
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
        if (currentTime - this.invincibleTimer >= RescueModeGame.INVINCIBLE_DURATION) {
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
        
        // 使用与开火按钮接近的水平位置
        const horizontalMargin = Math.round(Laya.stage.width * 0.18);
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
        
        // 游戏开始时隐藏home按钮，只有玩家死亡后才显示
        this.homeBtn.visible = false;
    }

    private destroyGame(): void {
        // 重置敌方坦克状态，避免影响其他模式
        EnemyTank.updateSpeedStatus(false);
        EnemyTank.setGameActive(true);
        
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

    // 添加一个清理所有UI的全局方法
    private clearAllUI(): void {
        // 清理坦克升级消息
        if (this.currentMessageContainer) {
            Laya.Tween.clearAll(this.currentMessageContainer);
            Laya.timer.clearAll(this.currentMessageContainer);
            this.currentMessageContainer.destroy();
            this.currentMessageContainer = null;
        }
        
        // 清理结算面板
        if (this.currentStatsContainer) {
            Laya.Tween.clearAll(this.currentStatsContainer);
            Laya.timer.clearAll(this.currentStatsContainer);
            this.currentStatsContainer.destroy();
            this.currentStatsContainer = null;
        }
        
        // 清理倒计时面板
        if (this.currentCountdownContainer) {
            Laya.Tween.clearAll(this.currentCountdownContainer);
            Laya.timer.clearAll(this.currentCountdownContainer);
            this.currentCountdownContainer.destroy();
            this.currentCountdownContainer = null;
        }
    }

    // 6. 修改 onDestroy 方法，确保完全清理
    onDestroy(): void {
        // 先清理所有UI
        this.clearAllUI();
        
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