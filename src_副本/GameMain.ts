const { regClass, property } = Laya;
import { Joystick } from "./Joystick";
import { BulletPool } from "./BulletPool";
import { Box, BoxType } from "./Box";
import { ExplosionManager } from "./ExplosionManager";
import { EnemyTank } from "./EnemyTank";
import { LeaderboardManager } from "./LeaderboardManager";
import { SceneManager } from "./SceneManager";
import { FireButton } from "./FireButton";
import { ScoreEffects } from "./ScoreEffects";
import { CountdownUtil } from "./CountdownUtil";
import { GameConfig } from "./GameConfig";
import { Util } from "./Util";

// 段位系统配置
interface RankLevel {
    name: string;
    icon: string;
    count: number;
}

@regClass()
export class GameMain extends Laya.Script {
    // private static readonly MAP_WIDTH = 1334; // iPhone 6/7/8 Plus 横屏宽度
    // private static readonly MAP_HEIGHT = 750; // iPhone 6/7/8 Plus 横屏高度
    private static readonly MIN_BOX_COUNT = 20; // 最小箱子数量
    private static readonly BOX_CHECK_INTERVAL = 2000; // 检查箱子数量的间隔（毫秒）
    private static readonly POINTS_PER_RANK = 3000; // 每个小段位所需分数
    private static readonly ENEMY_TANK_SCORE = 500; // 修改击毁敌方坦克的得分
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
    private fireBtn: Laya.Sprite;
    private bullets: Laya.Sprite[] = [];
    private boxes: Box[] = [];
    private score: number = 0;
    private scoreText: Laya.Text;
    private rankText: Laya.Text;
    private fireSound: Laya.SoundChannel;
    private bgMusic: Laya.SoundChannel;
    private clickMusic: Laya.SoundChannel;
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
    private homeBtn: Laya.Sprite;  // 改名为 homeBtn
    private rankUpScores: number[] = [];
    private invincibleEffect: Laya.Sprite | null = null;
    private isInvincible: boolean = false;
    private invincibleTimer: number = 0;

    private static readonly FIRE_BTN_PRESSED_ALPHA = 0.5; // 按下状态透明度
    
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
            "resources/click.mp3",
            "resources/enemy-tank.png",
            "resources/moon.png",
            "resources/star.png",
            "resources/sun.png",
            "resources/diamond.png",
            "resources/king.png",
            "resources/greatwall.png",
            "resources/lightning-icon.png",
            "resources/circle_55_鲜红色按钮背景.png",
            "resources/circle_55_白色按钮背景.png",
            "resources/firebutton_bg.png",
            "resources/home.png"  // 确保加载所有需要的资源
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
        this.bgMusic.volume = 0.7;
        
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
        // 初始化Home按钮
        this.initHomeButton();
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
        
        // 设置黑色背景
        const bg = new Laya.Sprite();
        bg.graphics.drawRect(0, 0, Laya.stage.width, Laya.stage.height, "#000000");
        this.gameBox.addChild(bg);
        
        this.owner.addChild(this.gameBox);
    }
    private initPlayerTank(): void {
        // 创建坦克容器
        this.tank = new Laya.Sprite();
        this.tank.name = "PlayerTank";
        
        // 使用 tank.png 作为坦克图片
        let tankImage = new Laya.Image();
        tankImage.skin = "resources/tank.png";
        tankImage.width = EnemyTank.TANK_RADIUS * 2;
        tankImage.height = EnemyTank.TANK_RADIUS * 2;
        tankImage.pivot(EnemyTank.TANK_RADIUS, EnemyTank.TANK_RADIUS);
        this.tank.addChild(tankImage);
        
        // 将坦克放置在屏幕中央
        this.tank.pos(Laya.stage.width / 2, Laya.stage.height / 2);
        
        // 添加发光效果
        this.addGlowEffect();
    
        // 将坦克添加到游戏容器中
        this.gameBox.addChild(this.tank);
    }
    
    private addGlowEffect(): void {
        // 创建发光滤镜
        const glowFilter = new Laya.GlowFilter("#ffff00", 1, 0, 0); // 发光颜色为黄色，发光强度为 1，偏移量为 (0, 0)
        // 将发光滤镜应用到坦克容器上
        this.tank.filters = [glowFilter];
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
        // 创建开火按钮容器
        this.fireBtn = new Laya.Sprite();
        this.fireBtn.name = "FireButtonContainer";
        this.owner.addChild(this.fireBtn);
        
        // 添加FireButton组件
        const fireButtonComponent = this.fireBtn.addComponent(FireButton);
        
        // 监听开火事件
        this.fireBtn.on(FireButton.EVENT_FIRE_START, this, this.onFireStart);
        this.fireBtn.on(FireButton.EVENT_FIRE_END, this, this.onFireEnd);
    }

    private onJoystickMove(angle: number, strength: number): void {
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
        if (!this.tank || this.tank.destroyed) {
            return;
        }
        
        // 播放开火音效并发射子弹
        this.onFire();
    }

    private onFireEnd(): void {
        // 在FireButton组件中已经处理了按钮的状态恢复
    }

    private onFire(): void {
        if (!this.tank || this.tank.destroyed) {
            return;
        }
        
        // 播放开火音效
        this.fireSound = Laya.SoundManager.playSound("resources/fire.mp3", 1);
        this.fireSound.volume = 0.4;
        
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
        this.scoreText.color = "#ffffff";
        this.scoreText.pos(adjustedMargin, 20);
        this.scoreText.text = `Score: ${this.score}`;
        uiContainer.addChild(this.scoreText);

        // 段位显示
        this.rankText = new Laya.Text();
        this.rankText.fontSize = 24;
        this.rankText.color = "#ffffff";
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
            
            // 使用Util工具类处理坦克碰撞
            const hasCollision = Util.handleTankCollision(
                this.tank,
                enemy,
                this.gameBox,
                GameMain.COLLISION_DISTANCE, // 使用GameMain的碰撞距离常量
                ExplosionManager.instance,
                this.isInvincible,
                () => this.handleGameOver()
            );
            
            // 如果发生碰撞，直接返回，不再检查其他敌人
            if (hasCollision) {
                return;
            }
        }
        
        // 检查与其他对象的碰撞（如果有的话）
    }

    private handleGameOver(): void {
        // 禁用开火按钮
        if (this.fireBtn) {
            const fireButtonComp = this.fireBtn.getComponent(FireButton) as FireButton;
            if (fireButtonComp) {
                fireButtonComp.disable();
            }
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
        // 使用Util.drawPanel方法，传入true表示使用黑色主题
        Util.drawPanel(panel, 400, 400, true);
        panel.pivot(200, 200);
        panel.pos(Laya.stage.width/2, Laya.stage.height/2);
        container.addChild(panel);
        
        // 获取当前段位信息
        const rankInfo = this.getRankInfo(this.score);
        
        // 创建标题
        const title = new Laya.Text();
        title.text = `恭喜 你获得「${rankInfo.rankName}」勋章！`;
        title.fontSize = 24;
        // 修改标题文字颜色为金色，适合黑色背景
        title.color = "#FFD700";
        title.width = 400;
        title.height = 40;
        title.align = "center";
        title.x = 0;
        title.y = 30;
        title.overflow = Laya.Text.HIDDEN;
        title.wordWrap = false;
        // 添加描边使文字在黑色背景上更清晰
        title.stroke = 3;
        title.strokeColor = "#000000";
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
        
        // 使用Util.createDecorativeLine方法，传入true表示使用黑色主题
        Util.createDecorativeLine(panel, 130, true);
        
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
            // 使用Util.createStatItem方法，传入true表示使用黑色主题
            const item = Util.createStatItem(stat, index, true);
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
        // 修改分数颜色为白色，适合黑色背景
        scoreValue.color = "#ffffff";
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
        // 使用倒计时工具类，设置倒计时使用全局配置
        CountdownUtil.showCircleCountdown(
            GameConfig.ENDLESS_MODE_COUNTDOWN_SECONDS, // 从全局配置获取无尽模式倒计时秒数
            this.owner, // 父容器
            (countdown) => {
                // 倒计时每秒回调
                if (countdown === 1) {
                    // 在倒计时最后1秒重置游戏数据
                    // 重置分数和相关信息
                    this.score = 0;
                    this.killCount = 0;
                    this.woodBoxCount = 0;
                    this.metalBoxCount = 0;
                    this.treasureBoxCount = 0;
                    this.initRankUpScores();
                    this.updateScoreDisplay();
                    
                    // 只在当前箱子数量少于最小值时才生成新箱子
                    const activeBoxCount = this.boxes.filter(box => !box.destroyed).length;
                    if (activeBoxCount < GameMain.MIN_BOX_COUNT) {
                        const boxesToAdd = GameMain.MIN_BOX_COUNT - activeBoxCount;
                        for (let i = 0; i < boxesToAdd; i++) {
                            this.createRandomBox();
                        }
                    }
                }
            },
            () => {
                // 倒计时结束回调
                // 移除灰色滤镜
                this.gameBox.filters = null;
                
                // 重新创建玩家坦克
                this.initPlayerTank();
                
                // 重新启用开火按钮
                if (this.fireBtn) {
                    const fireButtonComp = this.fireBtn.getComponent(FireButton) as FireButton;
                    if (fireButtonComp) {
                        fireButtonComp.enable();
                    }
                }
            },
            this // 传入this实例用于清理计时器
        );
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
            const fireButtonComp = this.fireBtn.getComponent(FireButton) as FireButton;
            if (fireButtonComp) {
                fireButtonComp.enable();
            }
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
        if (this.clickMusic) {
            this.clickMusic.stop();
            this.clickMusic = null;
        }
        
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

    private createScorePopup(x: number, y: number, score: number): void {
        // 使用共享的金币特效工具类
        ScoreEffects.createGoldScorePopup(x, y, score, this.gameBox);
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
        homeIcon.alpha = 0.5;
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


} 