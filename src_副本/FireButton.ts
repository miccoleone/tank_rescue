const { regClass } = Laya;

/**
 * 开火按钮组件
 * 统一管理开火按钮的创建、事件监听和状态变化
 */
@regClass()
export class FireButton extends Laya.Script {
    /** 按钮容器 */
    private buttonContainer: Laya.Sprite;
    /** 按钮背景 */
    private btnBg: Laya.Sprite;
    /** 背景图片 */
    private bgImage: Laya.Image;
    /** 火焰图标 */
    private fireIcon: Laya.Text;
    
    /** 按钮正常状态下的透明度 */
    private readonly NORMAL_ALPHA = 0.2;
    /** 按钮按下状态下的透明度 */
    private readonly PRESSED_ALPHA = 0.7;
    
    /** 按钮半径 */
    private readonly BUTTON_RADIUS = 55;
    
    /** 开火事件 */
    public static readonly EVENT_FIRE_START = "fireStart";
    /** 结束开火事件 */
    public static readonly EVENT_FIRE_END = "fireEnd";
    
    /**
     * 组件被添加时调用
     */
    onAwake(): void {
        this.initButton();
    }
    
    /**
     * 初始化开火按钮
     */
    private initButton(): void {
        // 创建按钮容器
        this.buttonContainer = new Laya.Sprite();
        this.buttonContainer.name = "FireButtonContainer";
        this.owner.addChild(this.buttonContainer);
        
        // 创建按钮背景
        this.btnBg = new Laya.Sprite();
        this.btnBg.name = "FireButtonBg";
        this.btnBg.mouseEnabled = true;
        this.btnBg.mouseThrough = false;
        this.buttonContainer.addChild(this.btnBg);
        
        // 创建背景图片
        this.bgImage = new Laya.Image();
        this.bgImage.skin = "resources/circle_55_白色按钮背景.png";
        this.bgImage.width = this.BUTTON_RADIUS * 2;
        this.bgImage.height = this.BUTTON_RADIUS * 2;
        this.bgImage.pivot(this.BUTTON_RADIUS, this.BUTTON_RADIUS);
        this.bgImage.alpha = this.NORMAL_ALPHA;
        this.bgImage.name = "btnBgImage";
        this.btnBg.addChild(this.bgImage);
        
        // 创建火焰图标
        this.fireIcon = new Laya.Text();
        this.fireIcon.name = "FireIcon";
        this.fireIcon.text = "🔥";
        this.fireIcon.font = "Arial, 'Segoe UI Emoji', 'Noto Color Emoji'";
        this.fireIcon.fontSize = 70;
        this.fireIcon.color = "#ffffff";
        this.fireIcon.width = 120;
        this.fireIcon.height = 120;
        this.fireIcon.align = "center";
        this.fireIcon.valign = "middle";
        this.fireIcon.pivot(60, 60);
        this.fireIcon.alpha = 0.8;
        this.fireIcon.bold = true;
        this.buttonContainer.addChild(this.fireIcon);
        
        // 设置按钮位置
        this.positionButton();
        
        // 添加事件监听
        this.addButtonListeners();
    }
    
    /**
     * 设置按钮位置
     */
    private positionButton(): void {
        const horizontalMargin = Math.round(Laya.stage.width * 0.17);
        const verticalMargin = Math.round(Laya.stage.height * 0.25);
        
        this.buttonContainer.pos(
            Math.round(Laya.stage.width - horizontalMargin),
            Math.round(Laya.stage.height - verticalMargin)
        );
    }
    
    /**
     * 添加按钮事件监听
     */
    private addButtonListeners(): void {
        // 按下效果
        this.bgImage.on(Laya.Event.MOUSE_DOWN, this, () => {
            // 缩小图标
            Laya.Tween.to(this.fireIcon, { scale: 0.9 }, 100);
            
            // 切换为红色背景并调整透明度
            this.bgImage.skin = "resources/circle_55_鲜红色按钮背景.png";
            this.bgImage.alpha = this.PRESSED_ALPHA;
            
            // 触发开火事件
            this.owner.event(FireButton.EVENT_FIRE_START);
        });
        
        // 抬起效果
        this.bgImage.on(Laya.Event.MOUSE_UP, this, this.resetButton);
        
        // 鼠标移出效果
        this.bgImage.on(Laya.Event.MOUSE_OUT, this, this.resetButton);
    }
    
    /**
     * 重置按钮状态
     */
    private resetButton(): void {
        // 恢复图标大小
        Laya.Tween.to(this.fireIcon, { scale: 1.0 }, 100);
        
        // 切换回白色背景并恢复透明度
        this.bgImage.skin = "resources/circle_55_白色按钮背景.png";
        this.bgImage.alpha = this.NORMAL_ALPHA;
        
        // 触发结束开火事件
        this.owner.event(FireButton.EVENT_FIRE_END);
    }
    
    /**
     * 禁用按钮
     */
    public disable(): void {
        this.btnBg.mouseEnabled = false;
        this.bgImage.alpha = this.NORMAL_ALPHA;
    }
    
    /**
     * 启用按钮
     */
    public enable(): void {
        this.btnBg.mouseEnabled = true;
    }
    
    /**
     * 组件被销毁时调用
     */
    onDestroy(): void {
        // 清理事件监听
        this.bgImage.offAll();
        
        // 清理动画
        Laya.Tween.clearAll(this.fireIcon);
    }
} 