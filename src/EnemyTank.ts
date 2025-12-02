const { regClass } = Laya;

@regClass()
export class EnemyTank extends Laya.Sprite {
    private static readonly RANDOM_MOVE_INTERVAL = 1000; // 随机移动的时间间隔
    private static readonly CHASE_SPEED = 2; // 追踪玩家时的速度
    private static readonly RANDOM_SPEED = 2; // 随机移动时的速度
    private static readonly TANK_RADIUS = 16; // 坦克半径
    private static readonly BOX_RADIUS = 16; // 箱子半径
    private static readonly MIN_DISTANCE = EnemyTank.TANK_RADIUS + EnemyTank.BOX_RADIUS;
    
    private static isGameActive: boolean = true; // 新增：游戏是否激活的标志

    private isChasing: boolean;
    private targetTank: Laya.Sprite;
    private lastMoveTime: number = 0;
    private currentAngle: number = 0;
    private boxes: any[] = []; // 存储箱子引用
    private moveSpeed: number = EnemyTank.CHASE_SPEED; // 初始速度
    private skinUrl: string;
    
    // 添加一个静态变量来标记是否需要提速
    private static increasedSpeed: boolean = false;

    // 添加静态方法用于更新速度状态
    public static updateSpeedStatus(isHighSpeed: boolean): void {
        EnemyTank.increasedSpeed = isHighSpeed;
    }
    
    constructor(playerTank: Laya.Sprite, isChasing: boolean = true, boxes: any[] = [], skinUrl?: string) {
        super();
        this.targetTank = playerTank;
        this.isChasing = isChasing;
        this.boxes = boxes;
        this.skinUrl = skinUrl || "resources/enemy-tank.png";
        
        // 设置敌方坦克速度
        this.moveSpeed = EnemyTank.increasedSpeed ? 
            EnemyTank.CHASE_SPEED * 1.5 : // 提速1.5倍
            EnemyTank.CHASE_SPEED;       // 正常速度
        
        this.init();
    }
    
    private init(): void {
        // 创建坦克图像
        let tankImage = new Laya.Image();
        tankImage.skin = this.skinUrl;
        tankImage.width = EnemyTank.TANK_RADIUS * 2;
        tankImage.height = EnemyTank.TANK_RADIUS * 2;
        tankImage.pivot(tankImage.width / 2, tankImage.height / 2);
        tankImage.rotation = -90; // 修正炮口方向
        this.addChild(tankImage);
        
        // 开始更新循环
        Laya.timer.frameLoop(1, this, this.onUpdate);
    }
    
    private onUpdate(): void {
        // 如果游戏未激活，不执行更新（只在无尽模式中检查）
        if (!EnemyTank.isGameActive && this.parent?.parent?.name === "EndlessModeGame") return;

        if (this.isChasing) {
            this.updateChaseMovement();
        } else {
            this.updateRandomMovement();
        }
    }
    
    private updateChaseMovement(): void {
        if (!this.targetTank || this.targetTank.destroyed) return;
        
        // 计算到目标的方向
        const dx = this.targetTank.x - this.x;
        const dy = this.targetTank.y - this.y;
        const angle = Math.atan2(dy, dx);
        
        // 更新旋转
        this.rotation = angle * 180 / Math.PI;
        
        // 计算新位置
        const newX = this.x + Math.cos(angle) * this.moveSpeed;
        const newY = this.y + Math.sin(angle) * this.moveSpeed;
        
        // 只有在不会碰撞的情况下才移动
        if (!this.willCollideWithBoxes(newX, newY)) {
            this.x = newX;
            this.y = newY;
            this.constrainToMap();
        }
    }
    
    private updateRandomMovement(): void {
        const now = Date.now();
        
        // 每隔一段时间改变方向
        if (now - this.lastMoveTime > EnemyTank.RANDOM_MOVE_INTERVAL) {
            this.currentAngle = Math.random() * Math.PI * 2;
            this.lastMoveTime = now;
            this.rotation = this.currentAngle * 180 / Math.PI;
        }
        
        // 计算新位置
        const newX = this.x + Math.cos(this.currentAngle) * EnemyTank.RANDOM_SPEED;
        const newY = this.y + Math.sin(this.currentAngle) * EnemyTank.RANDOM_SPEED;
        
        // 只有在不会碰撞的情况下才移动
        if (!this.willCollideWithBoxes(newX, newY)) {
            this.x = newX;
            this.y = newY;
            this.constrainToMap();
        }
    }
    
    private willCollideWithBoxes(x: number, y: number): boolean {
        // 检查与所有箱子的碰撞
        for (const box of this.boxes) {
            if (!box.destroyed) {
                const dx = x - box.x;
                const dy = y - box.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < EnemyTank.MIN_DISTANCE) {
                    return true;
                }
            }
        }
        return false;
    }
    
    private constrainToMap(): void {
        const margin = 20;
        this.x = Math.max(margin, Math.min(this.x, Laya.stage.width - margin));
        this.y = Math.max(margin, Math.min(this.y, Laya.stage.height - margin));
    }
    
    public destroy(): void {
        Laya.timer.clearAll(this);
        super.destroy();
    }

    /**
     * 设置游戏状态
     * @param active 是否激活
     */
    public static setGameActive(active: boolean): void {
        EnemyTank.isGameActive = active;
    }
} 