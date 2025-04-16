const { regClass, property } = Laya;
import { Joystick } from "./Joystick";
import { BulletPool } from "./BulletPool";
import { Box, BoxType } from "./Box";
import { ExplosionManager } from "./ExplosionManager";
import { EnemyTank } from "./EnemyTank";
import { LeaderboardManager } from "./LeaderboardManager";
import { SceneManager } from "./SceneManager";
import { Pilot } from "./Pilot";
import { PilotPool } from "./PilotPool";
import { FireButton } from "./FireButton";
import { ScoreEffects } from "./ScoreEffects";
import { CountdownUtil } from "./CountdownUtil";
import { GameConfig } from "./GameConfig";
import { Util } from "./Util";
import { Achievement, MilitaryRank } from "./Achievement";

// 段位系统配置
interface RankLevel {
    name: string;
    icon: string;
    count: number;
}

@regClass()
export class SaveModeMain extends Laya.Script {
    // 基础配置
    private static readonly MIN_BOX_COUNT = 20; // 最小箱子数量
    private static readonly BOX_CHECK_INTERVAL = 2000; // 检查箱子数量的间隔（毫秒）
    private static readonly POINTS_PER_RANK = 3000; // 每个小段位所需分数
    private static readonly ENEMY_TANK_SCORE = 500; // 击毁敌方坦克得分
    private static readonly PILOT_RESCUE_SCORE = 1000; // 救援驾驶员得分
    private static readonly INVINCIBLE_DURATION = 5000; // 无敌时间5秒
    private static readonly COLLISION_DISTANCE = 30; // 碰撞检测距离
    private static readonly PILOT_RESCUE_DISTANCE = 50; // 驾驶员救援距离，增大以降低难度
    
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
    private killCount: number = 0;
    private woodBoxCount: number = 0;
    private metalBoxCount: number = 0;
    private treasureBoxCount: number = 0;
    private homeBtn: Laya.Sprite;  // 返回主页按钮
    private rankUpScores: number[] = [];
    private invincibleEffect: Laya.Sprite | null = null;
    private isInvincible: boolean = false;
    private invincibleTimer: number = 0;
    private initialMilitaryRank: MilitaryRank; // 记录游戏开始时的军衔
    
    // 救援模式特有的字段
    private rescuedPilots: number = 0;  // 已救援的驾驶员数量
    private pilotCountText: Laya.Text;  // 显示已救援驾驶员数量的文本
    private pilotCountIcon: Laya.Image | null = null; // 驾驶员图标，设为可选类型
    private pilotBar: Laya.Sprite; // 血条

    // 对象池
    private bulletPool: Laya.Pool;
    private explosionPool: Laya.Pool;
    private pilotPool: Laya.Pool;
    private scorePopupPool: Laya.Pool;
    private woodBoxPool: Laya.Pool;
    private metalBoxPool: Laya.Pool;
    private treasureBoxPool: Laya.Pool;
    private enemyTankPool: Laya.Pool;

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
            "resources/home.png",
            "resources/savemode/man1.png",
            "resources/savemode/man2.png",
            "resources/savemode/man3.png",
            "resources/savemode/man4.png",
            "resources/savemode/man5.png"
        ], Laya.Handler.create(this, () => {
            // 确保爆炸管理器初始化
            ExplosionManager.instance;
            console.log("所有资源加载完成");
        }));
        // 监听驾驶员救援事件
        Laya.stage.on("PILOT_RESCUED", this, this.handlePilotRescue);
    }

    onAwake(): void {
        // 设置游戏屏幕适配
        Laya.stage.scaleMode = Laya.Stage.SCALE_FIXED_WIDTH;
        Laya.stage.alignH = Laya.Stage.ALIGN_CENTER;
        Laya.stage.alignV = Laya.Stage.ALIGN_MIDDLE;
        Laya.stage.screenMode = Laya.Stage.SCREEN_HORIZONTAL;
        
        // 设置黑色背景
        Laya.stage.bgColor = "#000000";
        
        // 初始化微信分享功能
        this.initWxShare();
        
        // 记录初始军衔
        this.initialMilitaryRank = Achievement.instance.getCurrentRankInfo().rank;
        
        // 播放救援模式背景音乐
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
        Laya.timer.loop(SaveModeMain.BOX_CHECK_INTERVAL, this, this.checkBoxCount);
        // 开始敌人检查定时器
        Laya.timer.loop(SaveModeMain.ENEMY_CHECK_INTERVAL, this, this.checkEnemyCount);
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
        
        // 监听摇杆操作
        joystickContainer.on("joystickMove", this, this.onJoystickMove);
    }

    private onJoystickMove(angle: number, strength: number): void {
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
        if (!this.tank || !this.fireBtn) return;
        
        // 播放开火音效
        this.fireSound = Laya.SoundManager.playSound("resources/fire.mp3", 1);
        this.fireSound.volume = 0.4;
        
        // 从对象池获取子弹
        let bullet = BulletPool.instance.getItem(SaveModeMain.BULLET_SIGN);
        if (!bullet) return;
        
        bullet.name = "Bullet_" + this.bullets.length;
        
        // 设置子弹位置和旋转
        bullet.pos(this.tank.x, this.tank.y);
        bullet.rotation = this.tank.rotation;
        
        // 计算基础速度和段位加成
        let baseSpeed = 15;
        const currentRankInfo = this.getRankInfo(this.score);
        const rankBonus = Math.floor(Math.floor(this.score / SaveModeMain.POINTS_PER_RANK) / 4) * 5; // 每个大段位（4个小段位）增加5点速度
        let speed = baseSpeed + rankBonus;
        
        let radian = bullet.rotation * Math.PI / 180;
        let vx = Math.cos(radian) * speed;
        let vy = Math.sin(radian) * speed;
        
        this.gameBox.addChild(bullet);
        this.bullets.push(bullet);
        
        // 自动回收超时子弹的安全机制
        Laya.timer.once(5000, bullet, () => {
            // 如果5秒后子弹仍然存在，强制回收
            if (bullet && !bullet.destroyed && this.bullets.indexOf(bullet) !== -1) {
                console.log("子弹超时，强制回收");
                this.recycleBullet(bullet);
            }
        });
        
        // 更新子弹位置和检查碰撞
        const updateBullet = () => {
            if (!bullet || bullet.destroyed) return;
            
            bullet.x += vx;
            bullet.y += vy;
            
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
            
            // 检查与敌方坦克的碰撞
            for (const enemy of this.enemyTanks) {
                if (!enemy.destroyed && this.checkBulletEnemyCollision(bullet, enemy)) {
                    // 击中敌方坦克
                    this.score += SaveModeMain.ENEMY_TANK_SCORE;
                    this.updateScoreDisplay();
                    
                    // 记录坦克位置信息用于后续生成驾驶员
                    const enemyX = enemy.x;
                    const enemyY = enemy.y;
                    
                    // 播放爆炸效果
                    ExplosionManager.instance.playExplosion(enemyX, enemyY, this.gameBox);
                    
                    // 添加得分弹出效果
                    this.createScorePopup(enemyX, enemyY, SaveModeMain.ENEMY_TANK_SCORE);
                    
                    // 销毁敌方坦克
                    enemy.destroy();
                    
                    // 记录击杀
                    this.killCount++;
                    
                    // 移除敌人
                    const index = this.enemyTanks.indexOf(enemy);
                    if (index > -1) {
                        this.enemyTanks.splice(index, 1);
                    }
                    
                    // 爆炸动画大约需要1秒，爆炸结束后立即显示小人
                    const pilotTimerId = Laya.timer.once(500, this, () => {
                        if (!this.gameBox || this.gameBox.destroyed) return;
                        this.createPilot(enemyX, enemyY);
                    });
                    
                    // 回收子弹
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

    /**
     * 创建驾驶员 - 救援模式特有功能
     */
    private createPilot(x: number, y: number): void {
        console.log(`createPilot: 在位置 (${x}, ${y}) 创建驾驶员`);
        
        // 确保gameBox存在
        if (!this.gameBox || this.gameBox.destroyed) {
            console.error("createPilot: gameBox为空或已销毁，无法创建驾驶员");
            return;
        }
        
        try {
            // 从对象池获取驾驶员
            const pilot = PilotPool.instance.getPilot();
            console.log("createPilot: 从对象池获取驾驶员成功");
            
            // 设置位置并添加到游戏容器
            pilot.pos(x, y);
            this.gameBox.addChild(pilot);
            console.log(`createPilot: 驾驶员已添加到gameBox, 坐标: (${pilot.x}, ${pilot.y})`);
            
            // 确保驾驶员显示正常
            pilot.visible = true;
            pilot.alpha = 1;
            
            // 重要：现在驾驶员已经有了父节点，初始化动画
            pilot.initAnimations();
            console.log("createPilot: 驾驶员动画已初始化");
            
            // 监听驾驶员被救援事件
            pilot.once('rescued', this, () => {
                console.log("createPilot: 驾驶员被救援事件触发");
                
                // 驾驶员被救援时的处理
                this.handlePilotRescue(pilot);
                
                // 添加血条增长动画效果
                this.animatePilotRescue();
                
                // 播放得分音效
                Laya.SoundManager.playSound("resources/score.mp3", 1);
                
                console.log(`createPilot: 救援完成, 当前救援数: ${this.rescuedPilots}, 得分: ${SaveModeMain.PILOT_RESCUE_SCORE}`);
            });
            
        } catch (e) {
            console.error("createPilot: 创建驾驶员出错", e);
        }
    }

    private handlePilotRescue(pilot: Pilot): void {
        // 播放救援音效
        Laya.SoundManager.playSound("resources/sound/rescue.mp3", 1);
        
        // 增加分数
        this.score += SaveModeMain.PILOT_RESCUE_SCORE;
        this.updateScoreDisplay();
        
        // 更新救援数量
        this.rescuedPilots++;
        
        // 更新UI显示
        this.updatePilotCountDisplay();
        
        // 添加血条增长动画效果
        this.animatePilotRescue();
        
        // 更新成就系统
        Achievement.instance.addRescuedSoldier();
    }

    /**
     * 驾驶员救援时的动画效果
     */
    private animatePilotRescue(): void {
        // 确保pilotBar存在
        if (!this.pilotBar) return;
        
        // 保存当前的驾驶员数量
        const currentCount = this.rescuedPilots;
        
        // 临时更新显示（旧状态）- 使用本地方法而不修改实际计数
        this.drawPilotBar(currentCount - 1);
        
        // 血条缩放效果
        this.pilotBar.scale(1, 0.7);
        
        // 使用缓动动画恢复原始比例并更新显示
        Laya.Tween.to(this.pilotBar, {
            scaleX: 1,
            scaleY: 1
        }, 400, Laya.Ease.backOut, Laya.Handler.create(this, () => {
            // 更新最终显示 - 使用实际计数
            this.updatePilotCountDisplay();
            
            // 添加格子闪烁效果 - 仅对新增的一个格子
            const newGridIndex = currentCount - 1; // 从0开始计数
            const newGridX = newGridIndex * 7; // 7是格子宽度
            
            // 创建闪烁效果的精灵
            const highlight = new Laya.Sprite();
            highlight.graphics.drawRect(newGridX, 0, 7, 20, "rgba(255, 255, 255, 0.8)");
            this.pilotBar.addChild(highlight);
            
            // 闪烁两次然后消失
            Laya.Tween.to(highlight, { alpha: 0 }, 100, null, Laya.Handler.create(this, () => {
                Laya.Tween.to(highlight, { alpha: 0.8 }, 100, null, Laya.Handler.create(this, () => {
                    Laya.Tween.to(highlight, { alpha: 0 }, 100, null, Laya.Handler.create(this, () => {
                        highlight.destroy();
                    }));
                }));
            }));
        }));
    }
    
    /**
     * 仅用于动画效果的本地方法，绘制指定数量的驾驶员血条
     */
    private drawPilotBar(count: number): void {
        const GRID_WIDTH = 7;  // 每格宽度
        const BAR_HEIGHT = 20; // 血条高度
        
        // 确保血条存在
        if (!this.pilotBar) return;
        
        // 清除之前的绘制
        this.pilotBar.graphics.clear();
        
        // 如果没有救援的驾驶员，隐藏显示
        if (count === 0) {
            if (this.pilotCountText) this.pilotCountText.visible = false;
            return;
        }

        // 显示数量文本
        if (this.pilotCountText) {
            this.pilotCountText.visible = true;
            this.pilotCountText.text = `x${count}`;
        }
        
        // 计算总宽度
        const barWidth = count * GRID_WIDTH;
        
        // 先绘制血条边框 - 深绿色
        this.pilotBar.graphics.drawRect(-1, -1, barWidth + 2, BAR_HEIGHT + 2, "rgba(0, 100, 0, 0.5)");
        
        // 绘制整个血条背景 - 鲜亮的绿色
        this.pilotBar.graphics.drawRect(0, 0, barWidth, BAR_HEIGHT, "#4CAF50");
        
        // 添加顶部高亮效果
        this.pilotBar.graphics.drawRect(0, 0, barWidth, BAR_HEIGHT/4, "rgba(255, 255, 255, 0.3)");
        
        // 绘制格子分隔线
        for (let i = 1; i < count; i++) {
            const x = i * GRID_WIDTH;
            this.pilotBar.graphics.drawLine(x, 0, x, BAR_HEIGHT, "rgba(255, 255, 255, 0.5)", 1);
        }
        
        // 更新数量文本位置
        if (this.pilotCountText) {
            this.pilotCountText.x = barWidth + 5;  // 血条后留5像素间距
        }
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
        bullet.offAll(); // 移除所有事件监听
        
        // 回收到对象池
        BulletPool.instance.recover(SaveModeMain.BULLET_SIGN, bullet);
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
        this.scoreText.stroke = 2;
        this.scoreText.strokeColor = "#e0e0e0";
        this.scoreText.pos(adjustedMargin, 20);
        this.scoreText.text = `Score: ${this.score}`;
        uiContainer.addChild(this.scoreText);

        // 段位显示
        this.rankText = new Laya.Text();
        this.rankText.fontSize = 24;
        this.rankText.color = "#ffffff";
        this.rankText.stroke = 2;
        this.rankText.strokeColor = "#000000";
        this.rankText.pos(adjustedMargin, 55);
        uiContainer.addChild(this.rankText);

        // 创建段位图标容器
        const rankIconContainer = new Laya.Sprite();
        rankIconContainer.name = "rankIconContainer";
        rankIconContainer.pos(adjustedMargin, 55);
        uiContainer.addChild(rankIconContainer);

        // 救援模式特有 - 添加驾驶员数量显示
        this.initPilotCountDisplay(uiContainer, adjustedMargin);

        // 初始化显示
        this.updateRankDisplay();
        this.updatePilotCountDisplay();
    }

    /**
     * 初始化驾驶员数量显示 - 救援模式特有
     */
    private initPilotCountDisplay(uiContainer: Laya.Sprite, margin: number): void {
        // 创建驾驶员显示容器
        const pilotContainer = new Laya.Sprite();
        // 放在分数右边，增加间距到50
        pilotContainer.pos(margin + this.scoreText.width + 50, 20);
        uiContainer.addChild(pilotContainer);
        
        // 不再创建驾驶员图标
        this.pilotCountIcon = null;
        
        // 创建血条 - 与坦克大救援一致
        this.pilotBar = new Laya.Sprite();
        this.pilotBar.pos(0, 2); // 稍微上移以对齐
        pilotContainer.addChild(this.pilotBar);
        
        // 创建驾驶员数量文本
        this.pilotCountText = new Laya.Text();
        this.pilotCountText.fontSize = 24;
        this.pilotCountText.color = "#ffffff";
        this.pilotCountText.stroke = 2;
        this.pilotCountText.strokeColor = "#000000";
        this.pilotCountText.pos(5, 0); // 放在血条右边
        this.pilotCountText.visible = false; // 初始不显示
        pilotContainer.addChild(this.pilotCountText);
    }

    /**
     * 更新驾驶员数量显示 - 救援模式特有
     */
    private updatePilotCountDisplay(): void {
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
        
        // 先绘制血条边框 - 深绿色
        this.pilotBar.graphics.drawRect(-1, -1, barWidth + 2, BAR_HEIGHT + 2, "rgba(0, 100, 0, 0.5)");
        
        // 绘制整个血条背景 - 鲜亮的绿色
        this.pilotBar.graphics.drawRect(0, 0, barWidth, BAR_HEIGHT, "#4CAF50");
        
        // 添加顶部高亮效果
        this.pilotBar.graphics.drawRect(0, 0, barWidth, BAR_HEIGHT/4, "rgba(255, 255, 255, 0.3)");
        
        // 绘制格子分隔线
        for (let i = 1; i < this.rescuedPilots; i++) {
            const x = i * GRID_WIDTH;
            this.pilotBar.graphics.drawLine(x, 0, x, BAR_HEIGHT, "rgba(255, 255, 255, 0.5)", 1);
        }
        
        // 更新数量文本位置和内容
        this.pilotCountText.x = barWidth + 5;  // 血条后留5像素间距
        this.pilotCountText.text = `x${this.rescuedPilots}`;
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
        const currentLevel = Math.floor(score / SaveModeMain.POINTS_PER_RANK);
        
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
        for (let i = 0; i < SaveModeMain.RANKS.length; i++) {
            const rank = SaveModeMain.RANKS[i];
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
            const newRankIndex = SaveModeMain.RANKS.findIndex(r => r.name === rankInfo.rankName);
            
            if (newRankIndex !== -1 && newRankIndex !== this.lastRankIndex) {
                this.lastRankIndex = newRankIndex;
                // 不在这里调用checkRankUp，避免递归
            }
        } else {
            this.lastRankIndex = SaveModeMain.RANKS.findIndex(r => r.name === rankInfo.rankName);
        }
    }

    private initRankUpScores(): void {
        // 初始化所有升级分数点
        this.rankUpScores = [];
        for (let i = 1; i <= 22; i++) { // 22个等级点，对应66000分
            this.rankUpScores.push(i * SaveModeMain.POINTS_PER_RANK);
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
                SaveModeMain.COLLISION_DISTANCE, // 使用SaveModeMain的碰撞距离常量
                ExplosionManager.instance,
                this.isInvincible,
                () => this.handleGameOver()
            );
            
            // 如果发生碰撞，直接返回，不再检查其他敌人
            if (hasCollision) {
                return;
            }
        }

        // 救援模式特有 - 检查与驾驶员的碰撞
        this.checkPilotCollisions();
    }

    /**
     * 检查与驾驶员的碰撞 - 救援模式特有
     */
    private checkPilotCollisions(): void {
        if (!this.tank || this.tank.destroyed) return;
        
        // 遍历游戏容器中的所有驾驶员
        for (let i = 0; i < this.gameBox.numChildren; i++) {
            const child = this.gameBox.getChildAt(i);
            if (child instanceof Pilot) {
                const pilot = child as Pilot;
                
                // 计算距离
                const dx = this.tank.x - pilot.x;
                const dy = this.tank.y - pilot.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // 如果距离小于救援距离，触发救援
                if (distance < SaveModeMain.PILOT_RESCUE_DISTANCE) {
                    pilot.rescue();
                }
            }
        }
    }

    private createScorePopup(x: number, y: number, score: number): void {
        // 使用共享的金币特效工具类
        ScoreEffects.createGoldScorePopup(x, y, score, this.gameBox);
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
        while (this.boxes.length < SaveModeMain.MIN_BOX_COUNT) {
            this.createRandomBox();
        }
    }

    private getRequiredEnemyCount(): number {
        const currentLevel = Math.floor(this.score / SaveModeMain.POINTS_PER_RANK);
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

    private handleGameOver(): void {
        // 禁用开火按钮
        if (this.fireBtn) {
            const fireButtonComp = this.fireBtn.getComponent(FireButton) as FireButton;
            if (fireButtonComp) {
                fireButtonComp.disable();
            }
        }
        
        // 停止所有驾驶员相关的动画和Tween
        if(this.pilotBar) {
            Laya.Tween.clearAll(this.pilotBar);
        }
        
        // 确保驾驶员显示与实际数量一致
        this.updatePilotCountDisplay();
        
        // 播放爆炸效果
        ExplosionManager.instance.playExplosion(this.tank.x, this.tank.y, this.gameBox);
        
        // 销毁玩家坦克
        this.tank.destroy();

        // 销毁所有敌方坦克
        this.enemyTanks.forEach(enemy => {
            ExplosionManager.instance.playExplosion(enemy.x, enemy.y, this.gameBox);
            enemy.destroy();
        });
        this.enemyTanks = [];
        
        // 不再清理场景中的驾驶员，让他们保持原有的生命周期
        // this.clearAllPilots();  // 注释掉这行，不清理驾驶员
        
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
        // 使用Util.drawPanel方法，默认使用黑色主题
        Util.drawPanel(panel);
        panel.pivot(200, 200); // 保持轴心点在中心
        panel.pos(Laya.stage.width/2, Laya.stage.height/2); // 保持在屏幕中心
        container.addChild(panel);
        
        // 获取当前段位信息
        const rankInfo = this.getRankInfo(this.score);
        
        // 创建标题
        const title = new Laya.Text();
        title.fontSize = 24;
        title.color = "#FFD700";
        title.width = 400;
        title.height = 50;
        title.align = "center";
        title.stroke = 3;
        title.strokeColor = "#000000";
        title.x = 0;
        title.y = 25;
        title.text = `英雄 你成功救下 ${this.rescuedPilots} 名驾驶员！`;
        panel.addChild(title);
        
        // 获取初始军衔信息
        const initialRankInfo = this.getRankInfo(0);
        
        // 创建段位/晋升显示容器
        const rankContainer = new Laya.Sprite();
        rankContainer.pos(200, 80);
        
        // 获取当前军衔信息
        const currentMilitaryRank = Achievement.instance.getCurrentRankInfo();
        
        if (currentMilitaryRank.rank !== this.initialMilitaryRank) {
            // 如果军衔发生变化，显示晋升文本
            const promotionText = new Laya.Text();
            promotionText.fontSize = 22;
            promotionText.color = "#4CAF50"; // 使用绿色表示晋升
            promotionText.width = 400;
            promotionText.align = "center";
            promotionText.stroke = 2;
            promotionText.strokeColor = "#000000";
            promotionText.x = -200; // 居中显示
            promotionText.text = `恭喜你晋升至${currentMilitaryRank.rank}军衔！`;
            rankContainer.addChild(promotionText);
        } else {
            // 如果没有晋升，显示原有的段位图标
            const rankInfo = this.getRankInfo(this.score);
            rankInfo.icons.forEach((iconPath, index) => {
                const icon = new Laya.Image();
                icon.skin = iconPath;
                icon.width = 32;
                icon.height = 32;
                icon.x = index * (32 + 4) - (rankInfo.icons.length * (32 + 4)) / 2;
                icon.y = 0;
                rankContainer.addChild(icon);
            });
        }
        
        panel.addChild(rankContainer);
        
        // 创建装饰性分割线
        Util.createDecorativeLine(panel, 130);
        
        // 调整统计数据容器位置
        const statsContainer = new Laya.Sprite();
        statsContainer.pos(30, 150);
        panel.addChild(statsContainer);
        
        // 统计数据项（使用图片图标）- 包含救援模式特有的驾驶员统计
        const stats = [
            { icon: "resources/enemy-tank.png", label: "击毁敌人", value: this.killCount },
            { icon: "resources/woodBox.png", label: "摧毁木箱", value: this.woodBoxCount },
            { icon: "resources/metalBox.png", label: "摧毁铁箱", value: this.metalBoxCount },
            { icon: "resources/treasure.png", label: "摧毁宝箱", value: this.treasureBoxCount }
        ];
        
        stats.forEach((stat, index) => {
            // 使用Util.createStatItem方法，默认使用黑色主题
            const item = Util.createStatItem(stat, index);
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
        scoreContainer.pos(30, 350); // 调整总分位置，考虑到多了一项统计
        panel.addChild(scoreContainer);
        
        const scoreLabel = new Laya.Text();
        scoreLabel.fontSize = 28;
        scoreLabel.color = "#FFD700";
        scoreLabel.text = "总积分";
        scoreContainer.addChild(scoreLabel);
        
        const scoreValue = new Laya.Text();
        scoreValue.fontSize = 32; // 调整字体大小
        scoreValue.color = "#ffffff";
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

        // 使用倒计时工具类替换原有倒计时逻辑
        CountdownUtil.showCircleCountdown(
            GameConfig.SAVE_MODE_COUNTDOWN_SECONDS, // 从全局配置获取救援模式倒计时秒数
            this.owner, // 父容器
            (countdown) => {
                // 倒计时每秒回调 - 由于已经删除了Panel上的文本，这里不需要做任何操作
            },
            () => {
                // 倒计时结束回调
                // 退场动画
                Laya.Tween.to(container, {
                    alpha: 0,
                    y: -Laya.stage.height
                }, 500, Laya.Ease.backIn);
                
                Laya.Tween.to(mask, { alpha: 0 }, 500, null, Laya.Handler.create(this, () => {
                    mask.destroy();
                    container.destroy();
                    this.restartGame();
                }));
            },
            this // 传入this实例用于清理计时器
        );
    }
    
    // 清理所有场景中的驾驶员
    private clearAllPilots(): void {
        console.log("clearAllPilots 开始清理驾驶员");
        
        // 添加空检查，防止gameBox为空导致的错误
        if (!this.gameBox || this.gameBox.destroyed) {
            console.log("clearAllPilots: gameBox为空或已销毁，跳过清理");
            return;
        }
        
        // 记录初始驾驶员数量
        let pilotCount = 0;
        
        // 查找场景中所有的驾驶员并移除
        for (let i = this.gameBox.numChildren - 1; i >= 0; i--) {
            const child = this.gameBox.getChildAt(i);
            if (child instanceof Pilot) {
                pilotCount++;
                console.log(`clearAllPilots: 找到驾驶员 #${i}, 开始清理`);
                
                // 先停止动画，再销毁
                try {
                    const pilot = child as Pilot;
                    // 确保清除动画
                    pilot.clearAnimations();
                    pilot.destroy();
                    console.log(`clearAllPilots: 驾驶员 #${i} 已销毁`);
                } catch (e) {
                    console.error(`clearAllPilots: 清理驾驶员 #${i} 出错`, e);
                }
            }
        }
        
        console.log(`clearAllPilots: 清理完成，共清理 ${pilotCount} 个驾驶员`);
    }

    private restartGame(): void {
        // 重置统计数据
        this.killCount = 0;
        this.woodBoxCount = 0;
        this.metalBoxCount = 0;
        this.treasureBoxCount = 0;
        this.rescuedPilots = 0;  // 重置救援计数
        
        // 重置分数和升级点
        this.score = 0;
        this.initRankUpScores(); // 重新初始化升级分数点
        this.updateScoreDisplay();
        this.updatePilotCountDisplay(); // 更新驾驶员显示
        
        // 清理驾驶员
        this.clearAllPilots();
        
        // 移除灰色滤镜
        this.gameBox.filters = null;
        
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
        
        // 清理敌人
        this.enemyTanks.forEach(enemy => enemy.destroy());
        this.enemyTanks = [];
        
        // 重新激活无敌状态
        this.activateInvincible();

        // 重置军衔状态（在倒计时结束后）
        this.initialMilitaryRank = Achievement.instance.getCurrentRankInfo().rank;
    }

    private destroyGame(): void {
        // // 停止所有音效和音乐
        // Laya.SoundManager.stopAll();
        
        // 取消所有定时器和动画
        Laya.timer.clearAll(this);
        Laya.Tween.clearAll(this);
        
        // 停止背景音乐并清理
        if (this.bgMusic) {
            this.bgMusic.stop();
            this.bgMusic = null;
        }
        
        // 停止其他音效并清理
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
        
        // 移除所有子弹并清理它们的计时器
        this.bullets.forEach(bullet => {
            Laya.timer.clearAll(bullet);
            this.recycleBullet(bullet);
        });
        this.bullets = [];
        
        // 移除所有箱子
        this.boxes.forEach(box => {
            if (!box.destroyed) {
                box.destroy();
            }
        });
        this.boxes = [];
        
        // 移除所有敌人
        this.enemyTanks.forEach(enemy => {
            if (!enemy.destroyed) {
                enemy.destroy();
            }
        });
        this.enemyTanks = [];
        
        // 不清理驾驶员，让他们保持原有的生命周期
        // this.clearAllPilots();  // 注释掉这行，不清理驾驶员
        
        // 清理无敌效果
        if (this.invincibleEffect) {
            Laya.Tween.clearAll(this.invincibleEffect);
            this.invincibleEffect.destroy();
            this.invincibleEffect = null;
        }
        
        // 清理坦克
        if (this.tank && !this.tank.destroyed) {
            this.tank.destroy();
        }
        
        // 清理Tween对象
        if (this.pilotBar) {
            Laya.Tween.clearAll(this.pilotBar);
        }
        
        // 清理游戏容器并销毁
        if (this.gameBox) {
            this.gameBox.removeChildren();
            if (!this.gameBox.destroyed) {
                this.gameBox.destroy();
            }
        }
        
        // 清理按钮
        if (this.fireBtn) {
            const fireButtonComp = this.fireBtn.getComponent(FireButton) as FireButton;
            if (fireButtonComp) {
                fireButtonComp.disable();
            }
            this.fireBtn.offAll(); // 移除所有事件监听
        }
        
        // 重置数据
        this.score = 0;
        this.killCount = 0;
        this.woodBoxCount = 0;
        this.metalBoxCount = 0;
        this.treasureBoxCount = 0;
        this.rescuedPilots = 0;
        this.lastRankIndex = -1;
        this.rankUpScores = [];
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

    private createInvincibleEffect(): void {
        // 移除旧的无敌效果（如果存在）
        if (this.invincibleEffect) {
            this.invincibleEffect.destroy();
        }
    
        // 创建无敌效果容器
        this.invincibleEffect = new Laya.Sprite();
        this.gameBox.addChild(this.invincibleEffect);
    
        // 创建渐变圆圈
        const radius = 40; // 坦克周围的保护圈大小
        const gradient = new Laya.Sprite();
        
        // 使用半透明绿色绘制圆圈
        gradient.graphics.drawCircle(0, 0, radius, null, "#00ff00", 2);
        
        // 添加发光效果
        const glowFilter = new Laya.GlowFilter("#00ff00", 10, 5, 5);
        gradient.filters = [glowFilter];
    
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
        if (currentTime - this.invincibleTimer >= SaveModeMain.INVINCIBLE_DURATION) {
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

    /**
     * 初始化微信分享功能
     */
    private initWxShare(): void {
        // 检查是否在微信环境中
        if (typeof window !== 'undefined' && typeof (window as any).wx !== 'undefined') {
            const wx = (window as any).wx;
            
            // 显示转发菜单
            wx.showShareMenu({
                menus: ['shareAppMessage', 'shareTimeline']
            });

            // 监听用户点击右上角菜单的"转发"按钮时触发的事件
            wx.onShareAppMessage(() => {
                return {
                    title: '方块大逃亡 - 快来和我一起玩吧！',
                    imageUrl: 'resources/endless_mode.png'
                };
            });
        }
    }

    /**
     * 销毁脚本时清理所有资源
     */
    onDestroy(): void {
        console.log("SaveModeMain onDestroy");
        
        // 完全销毁游戏
        this.destroyGame();
        
        // 确保所有计时器和动画都被清理
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

    /**
     * 初始化对象池
     */
    private initObjectPools(): void {
        // 创建子弹对象池
        this.bulletPool = Laya.Pool.getPoolBySign("bullet");
        if (!this.bulletPool) {
            this.bulletPool = [];
            Laya.Pool.putBySign("bullet", []);
        }

        // 创建爆炸对象池
        this.explosionPool = Laya.Pool.getPoolBySign("explosion");
        if (!this.explosionPool) {
            this.explosionPool = [];
            Laya.Pool.putBySign("explosion", []);
        }

        // 创建驾驶员对象池
        this.pilotPool = Laya.Pool.getPoolBySign("pilot");
        if (!this.pilotPool) {
            this.pilotPool = [];
            Laya.Pool.putBySign("pilot", []);
        }

        // 创建分数弹出对象池
        this.scorePopupPool = Laya.Pool.getPoolBySign("scorePopup");
        if (!this.scorePopupPool) {
            this.scorePopupPool = [];
            Laya.Pool.putBySign("scorePopup", []);
        }

        // 创建木箱对象池
        this.woodBoxPool = Laya.Pool.getPoolBySign("woodBox");
        if (!this.woodBoxPool) {
            this.woodBoxPool = [];
            Laya.Pool.putBySign("woodBox", []);
        }

        // 创建金属箱对象池
        this.metalBoxPool = Laya.Pool.getPoolBySign("metalBox");
        if (!this.metalBoxPool) {
            this.metalBoxPool = [];
            Laya.Pool.putBySign("metalBox", []);
        }

        // 创建宝箱对象池
        this.treasureBoxPool = Laya.Pool.getPoolBySign("treasureBox");
        if (!this.treasureBoxPool) {
            this.treasureBoxPool = [];
            Laya.Pool.putBySign("treasureBox", []);
        }

        // 创建敌人坦克对象池
        this.enemyTankPool = Laya.Pool.getPoolBySign("enemyTank");
        if (!this.enemyTankPool) {
            this.enemyTankPool = [];
            Laya.Pool.putBySign("enemyTank", []);
        }

        // 注册对象池自定义销毁函数
        this.registerPoolDestroyHandlers();

        console.log("对象池初始化完成");
    }

    /**
     * 注册对象池自定义销毁函数
     */
    private registerPoolDestroyHandlers(): void {
        // 为子弹对象池注册销毁处理函数
        Laya.Pool.setClearHandler("bullet", (bullet: Bullet) => {
            if (bullet) {
                bullet.clearAnimations();
                bullet.destroy(true);
            }
        });

        // 为爆炸对象池注册销毁处理函数
        Laya.Pool.setClearHandler("explosion", (explosion: Explosion) => {
            if (explosion) {
                explosion.clearAnimations();
                explosion.destroy(true);
            }
        });

        // 为驾驶员对象池注册销毁处理函数
        Laya.Pool.setClearHandler("pilot", (pilot: Pilot) => {
            if (pilot) {
                pilot.clearAnimations();
                pilot.destroy(true);
            }
        });

        // 为分数弹出对象池注册销毁处理函数
        Laya.Pool.setClearHandler("scorePopup", (scorePopup: ScorePopup) => {
            if (scorePopup) {
                scorePopup.clearAnimations();
                scorePopup.destroy(true);
            }
        });

        // 为木箱对象池注册销毁处理函数
        Laya.Pool.setClearHandler("woodBox", (woodBox: WoodBox) => {
            if (woodBox) {
                woodBox.clearAnimations();
                woodBox.destroy(true);
            }
        });

        // 为金属箱对象池注册销毁处理函数
        Laya.Pool.setClearHandler("metalBox", (metalBox: MetalBox) => {
            if (metalBox) {
                metalBox.clearAnimations();
                metalBox.destroy(true);
            }
        });

        // 为宝箱对象池注册销毁处理函数
        Laya.Pool.setClearHandler("treasureBox", (treasureBox: TreasureBox) => {
            if (treasureBox) {
                treasureBox.clearAnimations();
                treasureBox.destroy(true);
            }
        });

        // 为敌人坦克对象池注册销毁处理函数
        Laya.Pool.setClearHandler("enemyTank", (enemyTank: EnemyTank) => {
            if (enemyTank) {
                enemyTank.clearAnimations();
                enemyTank.destroy(true);
            }
        });
    }

    /**
     * 清理并重置所有对象池
     */
    private clearObjectPools(): void {
        // 清理所有对象池中的对象
        Laya.Pool.clearBySign("bullet");
        Laya.Pool.clearBySign("explosion");
        Laya.Pool.clearBySign("pilot");
        Laya.Pool.clearBySign("scorePopup");
        Laya.Pool.clearBySign("woodBox");
        Laya.Pool.clearBySign("metalBox");
        Laya.Pool.clearBySign("treasureBox");
        Laya.Pool.clearBySign("enemyTank");

        // 重新初始化对象池
        this.initObjectPools();
    }

    onInit(): void {
        console.log("SaveModeMain.onInit: 初始化开始");
        
        // 初始化游戏状态
        this.isGameOver = false;
        
        // 初始化对象池
        this.initPilotPool();
        
        // 初始化游戏盒子
        this.initGameBox();
        
        // 初始化炮塔旋转控制
        this.initRotationControl();
        
        // 初始化开火按钮
        this.initFireButton();
        
        // 初始化返回主页按钮
        this.initHomeButton();
        
        // 初始化得分显示
        this.initScoreDisplay();
        
        // 初始化游戏对象
        this.initGameObjects();
        
        // 初始化音效
        this.initSounds();
        
        // 初始化游戏循环
        this.initGameLoop();
        
        console.log("SaveModeMain.onInit: 初始化完成");
    }
    
    /**
     * 初始化驾驶员对象池
     */
    private initPilotPool(): void {
        console.log("SaveModeMain.initPilotPool: 初始化驾驶员对象池");
        
        // 确保驾驶员对象池被正确初始化
        const pilotPool = PilotPool.instance;
        console.log("SaveModeMain.initPilotPool: 驾驶员对象池初始化完成");
    }
} 