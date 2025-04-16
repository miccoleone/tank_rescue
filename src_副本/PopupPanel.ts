const { regClass } = Laya;

/**
 * 通用弹框组件
 */
@regClass()
export class PopupPanel extends Laya.Script {
    private panel: Laya.Sprite | null = null;
    private mask: Laya.Sprite | null = null;
    private width: number = 400;
    private height: number = 400;
    private onClose: Function | null = null;
    private contentContainer: Laya.Sprite | null = null;  // 内容容器

    /**
     * 显示弹框
     * @param title 标题
     * @param content 内容渲染函数，接收 container 作为参数
     * @param options 配置项
     */
    show(title: string, content: (container: Laya.Sprite) => void, options: {
        width?: number;
        height?: number;
        onClose?: Function;
    } = {}): void {
        if (this.panel) {
            return;
        }

        // 更新配置
        this.width = options.width || this.width;
        this.height = options.height || this.height;
        this.onClose = options.onClose || null;

        // 创建半透明背景
        const mask = new Laya.Sprite();
        mask.graphics.drawRect(0, 0, Laya.stage.width, Laya.stage.height, "rgba(0, 0, 0, 0.5)");
        mask.mouseEnabled = true;
        mask.mouseThrough = false;
        mask.on(Laya.Event.CLICK, this, this.hide);
        this.mask = mask;
        this.owner.addChild(mask);

        // 创建面板容器
        const panel = new Laya.Sprite();
        this.panel = panel;
        
        // 设置面板位置
        panel.pivot(this.width/2, this.height/2);
        panel.pos(Laya.stage.width/2, Laya.stage.height/2);
        
        // 绘制浅色背景
        panel.graphics.drawRect(0, 0, this.width, this.height, "#ffffff");
        this.owner.addChild(panel);

        // 添加标题
        const titleText = new Laya.Text();
        titleText.text = title;
        titleText.fontSize = 24;
        titleText.color = "#333333";
        titleText.width = this.width;
        titleText.align = "center";
        titleText.y = 20;
        panel.addChild(titleText);

        // 创建装饰性分割线
        const line = new Laya.Sprite();
        line.graphics.drawLine(20, 60, this.width - 20, 60, "#e0e0e0", 2);
        panel.addChild(line);

        // 添加关闭按钮
        const closeBtn = new Laya.Text();
        closeBtn.text = "❎";
        closeBtn.fontSize = 32;
        closeBtn.color = "#999999";
        closeBtn.pos(this.width - 40, 10);
        closeBtn.mouseEnabled = true;
        closeBtn.on(Laya.Event.CLICK, this, () => {
            Laya.SoundManager.playSound("resources/click.mp3", 1);
            this.hide();
        });
        panel.addChild(closeBtn);

        // 创建内容容器
        const contentContainer = new Laya.Sprite();
        this.contentContainer = contentContainer;
        contentContainer.width = this.width;
        contentContainer.height = this.height - 90;  // 减去标题区域高度
        contentContainer.y = 90;  // 从标题区域下方开始
        panel.addChild(contentContainer);

        // 渲染内容
        content(contentContainer);

        // 添加入场动画
        panel.alpha = 0;
        panel.scale(0.8, 0.8);
        Laya.Tween.to(panel, {
            alpha: 1,
            scaleX: 1,
            scaleY: 1
        }, 300, Laya.Ease.backOut);
    }

    /**
     * 隐藏弹框
     */
    hide(): void {
        if (this.panel) {
            this.panel.destroy();
            this.panel = null;
        }
        if (this.mask) {
            this.mask.destroy();
            this.mask = null;
        }
        if (this.onClose) {
            this.onClose();
        }
    }

    /**
     * 判断弹框是否显示
     */
    isShowing(): boolean {
        return this.panel !== null;
    }
} 