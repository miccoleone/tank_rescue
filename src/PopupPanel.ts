const { regClass } = Laya;

/**
 * 通用弹框组件
 */
@regClass()
export class PopupPanel extends Laya.Script {
    private panel: Laya.Sprite | null = null;
    private mask: Laya.Sprite | null = null;
    private defaultWidth: number = 400;
    private defaultHeight: number = 400;
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
        // 如果已有弹框，先完全清理
        this.hide();

        // 更新配置
        const width = options.width || this.defaultWidth;
        const height = options.height || this.defaultHeight;
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
        panel.pivot(width/2, height/2);
        panel.pos(Laya.stage.width/2, Laya.stage.height/2);
        
        // 绘制白色背景
        panel.graphics.drawRect(0, 0, width, height, "#ffffff");
        this.owner.addChild(panel);

        // 添加标题
        const titleText = new Laya.Text();
        titleText.text = title;
        titleText.fontSize = 24;
        titleText.color = "#333333";
        titleText.width = width;
        titleText.align = "center";
        titleText.y = 20;
        panel.addChild(titleText);

        // 创建装饰性分割线
        const line = new Laya.Sprite();
        line.graphics.drawLine(20, 60, width - 20, 60, "#e0e0e0", 2);
        panel.addChild(line);

        // 添加分享按钮
        const shareBtn = new Laya.Text();
        shareBtn.text = "↗";
        shareBtn.fontSize = 32;
        shareBtn.color = "#999999";
        shareBtn.pos(width - 85, 10);  // 位于关闭按钮左侧
        shareBtn.mouseEnabled = true;
        shareBtn.on(Laya.Event.CLICK, this, () => {
            Laya.SoundManager.playSound("resources/click.mp3", 1);
            console.log("用户点击了分享按钮");
        });
        panel.addChild(shareBtn);

        // 添加关闭按钮
        const closeBtn = new Laya.Text();
        closeBtn.text = "❎";
        closeBtn.fontSize = 32;
        closeBtn.color = "#999999";
        closeBtn.pos(width - 40, 10);  // 保持在最右侧
        closeBtn.mouseEnabled = true;
        closeBtn.on(Laya.Event.CLICK, this, () => {
            Laya.SoundManager.playSound("resources/click.mp3", 1);
            this.hide();
        });
        panel.addChild(closeBtn);

        // 创建内容容器
        const contentContainer = new Laya.Sprite();
        this.contentContainer = contentContainer;
        contentContainer.width = width;
        contentContainer.height = height - 90;  // 减去标题区域高度
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
        // 清理所有动画
        if (this.panel) {
            Laya.Tween.clearAll(this.panel);
        }
        if (this.contentContainer) {
            Laya.Tween.clearAll(this.contentContainer);
        }

        // 清理所有事件监听
        if (this.mask) {
            this.mask.offAll();
            this.mask.destroy();
            this.mask = null;
        }
        if (this.panel) {
            this.panel.offAll();
            this.panel.destroy();
            this.panel = null;
        }
        if (this.contentContainer) {
            this.contentContainer.offAll();
            this.contentContainer.destroy();
            this.contentContainer = null;
        }

        // 执行关闭回调
        if (this.onClose) {
            this.onClose();
            this.onClose = null;
        }
    }

    /**
     * 判断弹框是否显示
     */
    isShowing(): boolean {
        return this.panel !== null;
    }
    
    /**
     * 显示简单消息弹窗
     * @param message 消息内容
     */
    showMessage(message: string): void {
        this.show("提示", (container) => {
            const text = new Laya.Text();
            text.text = message;
            text.fontSize = 20;
            text.color = "#333333";
            text.width = container.width - 40;
            text.x = 20;
            text.y = 20;
            text.wordWrap = true;
            container.addChild(text);
            
            const okBtn = new Laya.Sprite();
            okBtn.graphics.drawRect(0, 0, 100, 40, "#4CAF50");
            okBtn.x = (container.width - 100) / 2;
            okBtn.y = container.height - 70;
            okBtn.mouseEnabled = true;
            okBtn.on(Laya.Event.CLICK, this, this.hide);
            
            const okText = new Laya.Text();
            okText.text = "确定";
            okText.fontSize = 20;
            okText.color = "#FFFFFF";
            okText.width = 100;
            okText.align = "center";
            okText.y = 10;
            okBtn.addChild(okText);
            
            container.addChild(okBtn);
        }, { width: 300, height: 200 });
    }
} 