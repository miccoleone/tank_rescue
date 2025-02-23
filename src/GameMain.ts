const { regClass, property } = Laya;
import { Joystick } from "./Joystick";
import { BulletPool } from "./BulletPool";

@regClass()
export class GameMain extends Laya.Script {
    
    /** @prop {name: gameBox, tips: "游戏容器", type: Node, default: null}*/
    @property(Laya.Sprite)
    private gameBox: Laya.Sprite;
    
    /** @prop {name: tank, tips: "玩家坦克", type: Node, default: null}*/
    @property(Laya.Sprite)
    private tank: Laya.Sprite;
    
    private joystick: Joystick;
    private fireBtn: Laya.Sprite;
    private bullets: Laya.Sprite[] = [];
    private fireSound: Laya.SoundChannel;
    private static readonly BULLET_SIGN = "bullet";
    private static readonly MAP_WIDTH = 5000;
    private static readonly MAP_HEIGHT = 5000;
    private static readonly GRID_SIZE = 40;
    private miniMap: Laya.Sprite;
    private playerDot: Laya.Sprite;
    private static readonly MINIMAP_SIZE = 150; // 小地图尺寸
    private static readonly MINIMAP_PADDING = 40; // 小地图边距
    
    constructor() {
        super();
        // 预加载音效
        Laya.loader.load("resources/fire.mp3");
    }

    onAwake(): void {
        // 设置游戏屏幕适配
        Laya.stage.scaleMode = Laya.Stage.SCALE_FIXED_WIDTH;
        Laya.stage.alignH = Laya.Stage.ALIGN_CENTER;
        Laya.stage.alignV = Laya.Stage.ALIGN_MIDDLE;
        Laya.stage.screenMode = Laya.Stage.SCREEN_HORIZONTAL;
        
        // 初始化游戏场景
        this.initGameScene();
        // 初始化玩家坦克
        this.initPlayerTank();
        // 初始化虚拟摇杆
        this.initJoystick();
        this.initMiniMap();
    }

    private initGameScene(): void {
        // 创建游戏容器
        this.gameBox = new Laya.Sprite();
        this.gameBox.name = "GameBox";
        this.owner.addChild(this.gameBox);
        
        // 设置游戏区域背景和网格
        let bg = new Laya.Sprite();
        bg.name = "Background";
        
        // 绘制背景色
        bg.graphics.drawRect(0, 0, GameMain.MAP_WIDTH, GameMain.MAP_HEIGHT, "#F0F0F0");
        
        // 绘制网格线
        // 垂直线
        for (let x = 0; x <= GameMain.MAP_WIDTH; x += GameMain.GRID_SIZE) {
            bg.graphics.drawLine(x, 0, x, GameMain.MAP_HEIGHT, "#E0E0E0", 1);
        }
        
        // 水平线
        for (let y = 0; y <= GameMain.MAP_HEIGHT; y += GameMain.GRID_SIZE) {
            bg.graphics.drawLine(0, y, GameMain.MAP_WIDTH, y, "#E0E0E0", 1);
        }
        
        this.gameBox.addChild(bg);

        // 将视口移动到地图中央
        this.centerViewport();
    }

    private centerViewport(): void {
        // 计算地图中心点
        const centerX = GameMain.MAP_WIDTH / 2;
        const centerY = GameMain.MAP_HEIGHT / 2;
        
        // 计算视口偏移量，使屏幕居于地图中央
        const offsetX = centerX - Laya.stage.width / 2;
        const offsetY = centerY - Laya.stage.height / 2;
        
        // 移动游戏容器
        this.gameBox.pos(-offsetX, -offsetY);
        
        // 初始更新小地图
        this.updateMiniMap();
    }

    private initPlayerTank(): void {
        // 创建坦克容器
        this.tank = new Laya.Sprite();
        this.tank.name = "PlayerTank";
        
        // 绘制坦克主体（绿色方块）
        let tankBody = new Laya.Sprite();
        tankBody.name = "TankBody";
        tankBody.graphics.drawRect(-15, -15, 30, 30, "#00aa00");
        this.tank.addChild(tankBody);
        
        // 绘制坦克炮管（黑色矩形）
        let tankBarrel = new Laya.Sprite();
        tankBarrel.name = "TankBarrel";
        // tankBarrel.graphics.drawRect(-2, -20, 4, 10, "#000000");
        this.tank.addChild(tankBarrel);
        
        // 设置坦克的中心点
        this.tank.pivot(0, 0);
        
        // 将坦克放置在地图中央
        this.tank.pos(GameMain.MAP_WIDTH / 2, GameMain.MAP_HEIGHT / 2);
        
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
        
        // 通过 addComponent 创建并获取引用
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
        
        // 使用更小的半径和更细腻的样式
        const radius = 60; // 减小按钮大小
        btnBg.graphics.drawCircle(0, 0, radius, "rgba(50, 50, 50, 0.1)");
        this.fireBtn.addChild(btnBg);
        
        // 加载闪电图标
        let lightning = new Laya.Image();
        lightning.name = "LightningIcon";
        lightning.skin = "resources/lightning-icon.png";
        // 设置图标大小为按钮半径的0.8倍，使其更小巧
        const iconSize = radius * 0.9;
        lightning.width = iconSize;
        lightning.height = iconSize;
        lightning.pivot(iconSize/2, iconSize/2);
        lightning.alpha = 0.4; // 稍微提高透明度
        this.fireBtn.addChild(lightning);
        
        // 动态计算按钮位置
        const horizontalMargin = Laya.stage.width * 0.17; // 距离左边缘17%的距离
        const verticalMargin = Laya.stage.height * 0.25; // 距离底部25%的距离
    
        this.fireBtn.pos(Laya.stage.width - horizontalMargin, Laya.stage.height - verticalMargin);
        this.owner.addChild(this.fireBtn);
        
        // 添加按钮事件
        this.fireBtn.on(Laya.Event.MOUSE_DOWN, this, this.onFireStart);
        this.fireBtn.on(Laya.Event.MOUSE_UP, this, this.onFireEnd);
        this.fireBtn.on(Laya.Event.MOUSE_OUT, this, this.onFireEnd);
    }

    private initMiniMap(): void {
        // 创建小地图容器
        this.miniMap = new Laya.Sprite();
        this.miniMap.name = "MiniMap";
        
        // 设置小地图位置（右上角）
        this.miniMap.pos(
            Laya.stage.width - GameMain.MINIMAP_SIZE - GameMain.MINIMAP_PADDING, 
            GameMain.MINIMAP_PADDING
        );
        
        // 绘制小地图背景（灰色半透明带圆角）
        const radius = GameMain.MINIMAP_SIZE * 0.05; // 5% 圆角
        this.miniMap.graphics.drawPath(
            0, 0,
            [
                ["moveTo", radius, 0],
                ["lineTo", GameMain.MINIMAP_SIZE - radius, 0],
                ["arcTo", GameMain.MINIMAP_SIZE, 0, GameMain.MINIMAP_SIZE, radius, radius],
                ["lineTo", GameMain.MINIMAP_SIZE, GameMain.MINIMAP_SIZE - radius],
                ["arcTo", GameMain.MINIMAP_SIZE, GameMain.MINIMAP_SIZE, GameMain.MINIMAP_SIZE - radius, GameMain.MINIMAP_SIZE, radius],
                ["lineTo", radius, GameMain.MINIMAP_SIZE],
                ["arcTo", 0, GameMain.MINIMAP_SIZE, 0, GameMain.MINIMAP_SIZE - radius, radius],
                ["lineTo", 0, radius],
                ["arcTo", 0, 0, radius, 0, radius],
                ["closePath"]
            ],
            {
                fillStyle: "rgba(128, 128, 128, 0.5)"
            }
        );
        
        // 创建表示玩家的蓝点
        this.playerDot = new Laya.Sprite();
        this.playerDot.name = "PlayerDot";
        const dotSize = 3;
        this.playerDot.graphics.drawCircle(0, 0, dotSize, "#4A90E2");
        this.miniMap.addChild(this.playerDot);
        
        // 将小地图添加到场景
        this.owner.addChild(this.miniMap);
        
        // 确保小地图始终在最上层
        this.miniMap.zOrder = 1000;
    }

    private updateMiniMap(): void {
        if (!this.playerDot || !this.tank) return;
        
        // 计算玩家在小地图上的位置
        const scale = GameMain.MINIMAP_SIZE / GameMain.MAP_WIDTH;
        const miniX = this.tank.x * scale;
        const miniY = this.tank.y * scale;
        
        // 更新玩家点的位置
        this.playerDot.pos(miniX, miniY);
    }

    private onJoystickMove(angle: number, strength: number): void {
        if (strength === 0) return;
        
        // 更新坦克旋转角度
        this.tank.rotation = angle;
        
        // 计算移动距离
        let speed = 5 * strength;
        let radian = angle * Math.PI / 180;
        
        // 更新坦克位置
        this.tank.x += Math.cos(radian) * speed;
        this.tank.y += Math.sin(radian) * speed;
        
        // 限制坦克在地图范围内
        this.tank.x = Math.max(30, Math.min(this.tank.x, GameMain.MAP_WIDTH - 30));
        this.tank.y = Math.max(30, Math.min(this.tank.y, GameMain.MAP_HEIGHT - 30));
        
        // 更新视口位置，使坦克保持在屏幕中央
        this.updateViewport();
        // 更新小地图
        this.updateMiniMap();
    }

    private updateViewport(): void {
        // 计算目标视口位置
        const targetX = -(this.tank.x - Laya.stage.width / 2);
        const targetY = -(this.tank.y - Laya.stage.height / 2);
        
        // 限制视口不超出地图边界
        const minX = -(GameMain.MAP_WIDTH - Laya.stage.width);
        const minY = -(GameMain.MAP_HEIGHT - Laya.stage.height);
        
        const viewX = Math.min(0, Math.max(minX, targetX));
        const viewY = Math.min(0, Math.max(minY, targetY));
        
        // 更新游戏容器位置
        this.gameBox.pos(viewX, viewY);
    }

    private onFireStart(): void {
        // 按钮按下效果 - 保持大小不变，但闪红色
        let btnBg = this.fireBtn.getChildByName("FireButtonBg") as Laya.Sprite;
        btnBg.graphics.clear();
        btnBg.graphics.drawCircle(0, 0, 60, "rgba(255, 100, 100, 0.9)");
        
        // 播放开火音效并发射子弹
        this.onFire();
    }

    private onFireEnd(): void {
        // 恢复按钮效果
        let btnBg = this.fireBtn.getChildByName("FireButtonBg") as Laya.Sprite;
        btnBg.graphics.clear();
        btnBg.graphics.drawCircle(0, 0, 60, "rgba(50, 50, 50, 0.3)");
    }

    private onFire(): void {
        // 播放开火音效
        this.fireSound = Laya.SoundManager.playSound("resources/fire.mp3", 1);
        
        // 从对象池获取子弹
        let bullet = BulletPool.instance.getItem(GameMain.BULLET_SIGN);
        bullet.name = "Bullet_" + this.bullets.length;
        
        // 设置子弹位置和旋转
        bullet.pos(this.tank.x, this.tank.y);
        bullet.rotation = this.tank.rotation;
        
        // 计算子弹速度
        let speed = 100;
        let radian = bullet.rotation * Math.PI / 180;
        let vx = Math.cos(radian) * speed;
        let vy = Math.sin(radian) * speed;
        
        this.gameBox.addChild(bullet);
        this.bullets.push(bullet);
        
        // 添加子弹运动更新
        Laya.timer.frameLoop(1, bullet, () => {
            bullet.x += vx;
            bullet.y += vy;
            
            // 检查子弹是否超出地图
            if (bullet.x < 0 || bullet.x > GameMain.MAP_WIDTH || 
                bullet.y < 0 || bullet.y > GameMain.MAP_HEIGHT) {
                // 回收子弹到对象池
                let index = this.bullets.indexOf(bullet);
                if (index > -1) {
                    this.bullets.splice(index, 1);
                }
                Laya.timer.clearAll(bullet);
                BulletPool.instance.recover(GameMain.BULLET_SIGN, bullet);
            }
        });
    }
} 