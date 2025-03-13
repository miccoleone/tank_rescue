const { regClass, property } = Laya;

@regClass()
export class Joystick extends Laya.Script {
    private joystickBg!: Laya.Sprite;
    private joystickBar!: Laya.Sprite;
    private touchId: number = -1;
    private originPos!: Laya.Point;
    private maxRadius: number = 60;
    private stickRadius: number = 25;
    private maxDistance: number = 35;
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
        // 创建摇杆背景
        this.joystickBg = new Laya.Sprite();
        this.joystickBg.name = "JoystickBg";
        
        // 添加背景图片
        const bgImage = new Laya.Image();
        bgImage.skin = "resources/circle_60.png";  // 使用120x120的PNG
        bgImage.width = this.maxRadius * 2;  // 直径120
        bgImage.height = this.maxRadius * 2;
        bgImage.pivot(this.maxRadius, this.maxRadius);  // 中心点在60,60
        bgImage.alpha = 0.3;
        
        // 启用抗锯齿
        bgImage.smooth = true;
        
        // 设置事件支持
        bgImage.mouseEnabled = true;
        bgImage.mouseThrough = false;
        
        this.joystickBg.addChild(bgImage);
        
        // 使用精确定位
        const horizontalMargin = Math.round(Laya.stage.width * 0.17);
        const verticalMargin = Math.round(Laya.stage.height * 0.25);
        this.joystickBg.pos(horizontalMargin, Laya.stage.height - verticalMargin);
        this.owner.addChild(this.joystickBg);

        // 创建摇杆头
        this.joystickBar = new Laya.Sprite();
        this.joystickBar.name = "JoystickBar";
        
        const barImage = new Laya.Image();
        barImage.skin = "resources/circle_25.png";  // 使用50x50的PNG
        barImage.width = this.stickRadius * 2;  // 直径50
        barImage.height = this.stickRadius * 2;
        barImage.pivot(this.stickRadius, this.stickRadius);  // 中心点在25,25
        barImage.alpha = 1;
        barImage.mouseEnabled = false;
        barImage.smooth = true;
        
        this.joystickBar.addChild(barImage);
        this.joystickBar.pos(this.joystickBg.x, this.joystickBg.y);
        this.owner.addChild(this.joystickBar);

        this.originPos = new Laya.Point(this.joystickBg.x, this.joystickBg.y);

        // 添加鼠标和触摸事件
        bgImage.on(Laya.Event.MOUSE_DOWN, this, this.onJoystickDown);
        bgImage.on(Laya.Event.TOUCH_START, this, this.onJoystickDown);
        Laya.stage.on(Laya.Event.MOUSE_MOVE, this, this.onJoystickMove);
        Laya.stage.on(Laya.Event.TOUCH_MOVE, this, this.onJoystickMove);
        Laya.stage.on(Laya.Event.MOUSE_UP, this, this.onJoystickUp);
        Laya.stage.on(Laya.Event.TOUCH_END, this, this.onJoystickUp);
        Laya.stage.on(Laya.Event.TOUCH_OUT, this, this.onJoystickUp);

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
        
        if (distance > this.maxDistance) {
            dx = dx * this.maxDistance / distance;
            dy = dy * this.maxDistance / distance;
            distance = this.maxDistance;
        }

        // 使用Math.round确保像素对齐
        this.joystickBar.pos(
            Math.round(this.originPos.x + dx), 
            Math.round(this.originPos.y + dy)
        );

        this.currentAngle = Math.atan2(dy, dx) * 180 / Math.PI;
        this.currentStrength = distance / this.maxDistance;
    }

    public onUpdate(): void {
        if (this.isMoving && this.currentStrength > 0) {
            this.owner.event("joystickMove", [this.currentAngle, this.currentStrength]);
        }
    }

    onDisable(): void {
        // 移除所有事件监听
        this.joystickBg.off(Laya.Event.MOUSE_DOWN, this, this.onJoystickDown);
        this.joystickBg.off(Laya.Event.TOUCH_START, this, this.onJoystickDown);
        Laya.stage.off(Laya.Event.MOUSE_MOVE, this, this.onJoystickMove);
        Laya.stage.off(Laya.Event.TOUCH_MOVE, this, this.onJoystickMove);
        Laya.stage.off(Laya.Event.MOUSE_UP, this, this.onJoystickUp);
        Laya.stage.off(Laya.Event.TOUCH_END, this, this.onJoystickUp);
        Laya.stage.off(Laya.Event.TOUCH_OUT, this, this.onJoystickUp);
        Laya.timer.clear(this, this.onUpdate);
    }
}

declare module Laya {
    interface Script {
        onUpdate?(): void;
    }
}