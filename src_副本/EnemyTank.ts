const { regClass } = Laya;

@regClass()
export class EnemyTank extends Laya.Sprite {
    private static readonly RANDOM_MOVE_INTERVAL = 1000; // 随机移动的时间间隔
    private static readonly CHASE_SPEED = 2; // 追踪玩家时的速度
    private static readonly RANDOM_SPEED = 2; // 随机移动时的速度
    public static readonly TANK_RADIUS = 16; // 坦克半径
    private static readonly BOX_RADIUS = 16; // 箱子半径
    private static readonly MIN_DISTANCE = EnemyTank.TANK_RADIUS + EnemyTank.BOX_RADIUS;
    
    private isChasing: boolean;
    private targetTank: Laya.Sprite;
    private lastMoveTime: number = 0;
    private currentAngle: number = 0;
    private boxes: any[] = []; // 存储箱子引用
    
    constructor(targetTank: Laya.Sprite, isChasing: boolean, boxes: any[]) {
        super();
        this.targetTank = targetTank;
        this.isChasing = isChasing;
        this.boxes = boxes;
        
        // 创建坦克图像
        let tankImage = new Laya.Image();
        tankImage.skin = "resources/enemy-tank.png";
        tankImage.width = EnemyTank.TANK_RADIUS * 2;
        tankImage.height = EnemyTank.TANK_RADIUS * 2;;
        tankImage.pivot(tankImage.width / 2, tankImage.height / 2);
        this.addChild(tankImage);
        
        // 开始更新循环
        Laya.timer.frameLoop(1, this, this.onUpdate);
    }
    
    private onUpdate(): void {
        if (this.destroyed) return;
        
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
        const newX = this.x + Math.cos(angle) * EnemyTank.CHASE_SPEED;
        const newY = this.y + Math.sin(angle) * EnemyTank.CHASE_SPEED;
        
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
} 