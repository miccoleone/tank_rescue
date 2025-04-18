const { regClass, property } = Laya;

@regClass()
export class FireButton extends Laya.Script {
    // 按钮状态常量
    private static readonly NORMAL_ALPHA = 0.3;  // 正常状态透明度
    private static readonly PRESSED_ALPHA = 0.8; // 按下状态透明度

    // 按钮尺寸常量
    private static readonly BUTTON_RADIUS = 60;  // 按钮半径
    private static readonly ICON_RADIUS = 36;    // 图标半径

    // 按钮容器
    private buttonContainer: Laya.Sprite;
    private buttonBg: Laya.Image;
    private lightningIcon: Laya.Image;

    // 事件回调
    private onFireStartCallback: Function;
    private onFireEndCallback: Function;

    constructor() {
        super();
    }

    /**
     * 初始化按钮
     * @param onFireStart 开火开始回调
     * @param onFireEnd 开火结束回调
     */
    public init(onFireStart: Function, onFireEnd: Function): void {
        this.onFireStartCallback = onFireStart;
        this.onFireEndCallback = onFireEnd;
        this.createButton();
    }

    /**
     * 设置按钮位置
     * @param x X坐标
     * @param y Y坐标
     */
    public setPosition(x: number, y: number): void {
        if (this.buttonContainer) {
            this.buttonContainer.pos(x, y);
        }
    }

    /**
     * 启用/禁用按钮
     * @param enabled 是否启用
     */
    public setEnabled(enabled: boolean): void {
        if (this.buttonContainer) {
            this.buttonContainer.mouseEnabled = enabled;
            this.buttonBg.alpha = enabled ? FireButton.NORMAL_ALPHA : FireButton.NORMAL_ALPHA / 2;
        }
    }

    private createButton(): void {
        // 创建按钮容器
        this.buttonContainer = new Laya.Sprite();
        this.buttonContainer.name = "FireButton";
        this.owner.addChild(this.buttonContainer);

        // 创建按钮背景
        this.buttonBg = new Laya.Image();
        this.buttonBg.skin = "resources/circle_60_red.png";
        this.buttonBg.width = FireButton.BUTTON_RADIUS * 2;
        this.buttonBg.height = FireButton.BUTTON_RADIUS * 2;
        this.buttonBg.pivot(FireButton.BUTTON_RADIUS, FireButton.BUTTON_RADIUS);
        this.buttonBg.alpha = FireButton.NORMAL_ALPHA;
        this.buttonBg.name = "FireButtonBg";
        this.buttonBg.mouseEnabled = true;
        this.buttonBg.mouseThrough = false;
        this.buttonContainer.addChild(this.buttonBg);

        // 创建闪电图标
        this.lightningIcon = new Laya.Image();
        this.lightningIcon.skin = "resources/闪电.png";
        this.lightningIcon.width = FireButton.ICON_RADIUS * 2;
        this.lightningIcon.height = FireButton.ICON_RADIUS * 2;
        this.lightningIcon.pivot(FireButton.ICON_RADIUS, FireButton.ICON_RADIUS - 8);
        this.lightningIcon.alpha = 0.8;
        this.buttonContainer.addChild(this.lightningIcon);

        // 添加按钮事件监听
        this.buttonBg.on(Laya.Event.MOUSE_DOWN, this, this.onButtonDown);
        this.buttonBg.on(Laya.Event.MOUSE_UP, this, this.onButtonUp);
        this.buttonBg.on(Laya.Event.MOUSE_OUT, this, this.onButtonUp);
    }

    private onButtonDown(): void {
        // 按钮按下效果
        this.buttonBg.alpha = FireButton.PRESSED_ALPHA;
        Laya.Tween.to(this.lightningIcon, { scale: 0.9 }, 100);
        
        // 触发开火开始回调
        if (this.onFireStartCallback) {
            this.onFireStartCallback();
        }
    }

    private onButtonUp(): void {
        // 恢复按钮效果
        this.buttonBg.alpha = FireButton.NORMAL_ALPHA;
        Laya.Tween.to(this.lightningIcon, { scale: 1.0 }, 100);
        
        // 触发开火结束回调
        if (this.onFireEndCallback) {
            this.onFireEndCallback();
        }
    }

    onDestroy(): void {
        // 清理事件监听
        if (this.buttonBg) {
            this.buttonBg.offAll();
        }
        
        // 清理引用
        this.onFireStartCallback = null;
        this.onFireEndCallback = null;
    }
} 