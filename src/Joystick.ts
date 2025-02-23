const { regClass, property } = Laya;

@regClass()
export class Joystick extends Laya.Script {
    private joystickBg: Laya.Sprite;
    private joystickBar: Laya.Sprite;
    private touchId: number = -1;
    private originPos: Laya.Point;
    private maxRadius: number = 60; // 减小摇杆底座大小
    private stickRadius: number = 25; // 减小摇杆头的大小
    private maxDistance: number = 35; // 减小最大移动距离
    private isMoving: boolean = false;
    private currentAngle: number = 0;
    private currentStrength: number = 0;

    constructor() {
        super();
    }

    onEnable(): void {
        this.initJoystick();
    }

    private initJoystick(): void {
        // 创建摇杆背景（更透明）
        this.joystickBg = new Laya.Sprite();
        this.joystickBg.name = "JoystickBg";
        
        // 设置鼠标事件支持
        this.joystickBg.mouseEnabled = true;
        this.joystickBg.mouseThrough = true;
        
        // 使用更低的透明度（0.3）和更细腻的灰色
        this.joystickBg.graphics.drawCircle(0, 0, this.maxRadius, "rgba(50, 50, 50, 0.7)");
        // 添加极细的描边
        this.joystickBg.graphics.drawCircle(0, 0, this.maxRadius, null, "rgba(50, 50, 50, 0.3)", 0.5);
        
        // 动态计算摇杆位置
        const horizontalMargin = Laya.stage.width * 0.17; // 距离左边缘17%的距离
        const verticalMargin = Laya.stage.height * 0.25; // 距离底部25%的距离
        this.joystickBg.pos(horizontalMargin, Laya.stage.height - verticalMargin);
        this.owner.addChild(this.joystickBg);

        // 创建摇杆（更细腻的样式）
        this.joystickBar = new Laya.Sprite();
        this.joystickBar.name = "JoystickBar";
        
        // 使用浅灰色和更低的透明度
        this.joystickBar.graphics.drawCircle(0, 0, this.stickRadius, "rgba(225, 225, 225, 0.5)");
        // 添加极细的描边
        this.joystickBar.graphics.drawCircle(0, 0, this.stickRadius, null, "rgba(225, 225, 225, 0.3)", 0.5);
        
        this.joystickBar.pos(this.joystickBg.x, this.joystickBg.y);
        this.owner.addChild(this.joystickBar);

        this.originPos = new Laya.Point(this.joystickBg.x, this.joystickBg.y);

        // 添加触摸事件
        this.joystickBg.on(Laya.Event.MOUSE_DOWN, this, this.onJoystickDown);
        Laya.stage.on(Laya.Event.MOUSE_MOVE, this, this.onJoystickMove);
        Laya.stage.on(Laya.Event.MOUSE_UP, this, this.onJoystickUp);

        // 添加帧循环
        Laya.timer.frameLoop(1, this, this.onUpdate);
    }

    private onJoystickDown(e: Laya.Event): void {
        this.touchId = e.touchId;
        this.isMoving = true;
        this.updateJoystickPos(e.stageX, e.stageY);
    }

    private onJoystickMove(e: Laya.Event): void {
        if (e.touchId != this.touchId) return;
        this.updateJoystickPos(e.stageX, e.stageY);
    }

    private onJoystickUp(e: Laya.Event): void {
        if (e.touchId != this.touchId) return;
        this.touchId = -1;
        this.isMoving = false;
        this.joystickBar.pos(this.originPos.x, this.originPos.y);
        this.currentStrength = 0;
        this.owner.event("joystickMove", [0, 0]);
    }

    private updateJoystickPos(stageX: number, stageY: number): void {
        let dx = stageX - this.originPos.x;
        let dy = stageY - this.originPos.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        
        // 限制在最大移动距离内
        if (distance > this.maxDistance) {
            dx = dx * this.maxDistance / distance;
            dy = dy * this.maxDistance / distance;
            distance = this.maxDistance;
        }

        this.joystickBar.pos(this.originPos.x + dx, this.originPos.y + dy);

        // 更新当前状态
        this.currentAngle = Math.atan2(dy, dx) * 180 / Math.PI;
        this.currentStrength = distance / this.maxDistance;
    }

    protected onUpdate(): void {
        // 如果摇杆处于活动状态，持续发送移动事件
        if (this.isMoving && this.currentStrength > 0) {
            this.owner.event("joystickMove", [this.currentAngle, this.currentStrength]);
        }
    }

    onDisable(): void {
        this.joystickBg.off(Laya.Event.MOUSE_DOWN, this, this.onJoystickDown);
        Laya.stage.off(Laya.Event.MOUSE_MOVE, this, this.onJoystickMove);
        Laya.stage.off(Laya.Event.MOUSE_UP, this, this.onJoystickUp);
        Laya.timer.clear(this, this.onUpdate);
    }
}

// 添加类型声明
declare module Laya {
    interface Script {
        onUpdate?(): void;
    }
} 