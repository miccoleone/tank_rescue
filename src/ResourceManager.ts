const { regClass, property } = Laya;

/**
 * 资源管理器 - 管理游戏资源的加载和缓存
 */
@regClass()
export class ResourceManager extends Laya.Script {
    private static _instance: ResourceManager;
    private loadedResources: Set<string> = new Set();

    private constructor() {
        super();
        console.log("ResourceManager constructed");
    }

    // 获取单例实例
    public static get instance(): ResourceManager {
        if (!this._instance) {
            const scene = new Laya.Scene();
            scene.name = "ResourceManager";
            Laya.stage.addChild(scene);
            this._instance = scene.addComponent(ResourceManager);
            console.log("ResourceManager instance created");
        }
        return this._instance;
    }

    /**
     * 预加载资源
     * @param resources 资源路径数组
     * @param onComplete 加载完成的回调函数
     */
    public preloadResources(resources: string[], onComplete?: Laya.Handler): void {
        // 过滤出尚未加载的资源
        const newResources = resources.filter(res => !this.loadedResources.has(res));
        
        if (newResources.length === 0) {
            // 如果没有新资源需要加载，直接调用完成回调
            if (onComplete) onComplete.run();
            return;
        }

        // 加载资源
        console.log("开始加载资源:", newResources);
        Laya.loader.load(newResources, Laya.Handler.create(this, () => {
            // 记录已加载的资源
            newResources.forEach(res => this.loadedResources.add(res));
            console.log("资源加载完成:", newResources);
            // 调用加载完成的回调函数
            if (onComplete) onComplete.run();
        }));
    }

    /**
     * 生成简单的图像资源(用于测试)
     * @param width 图像宽度
     * @param height 图像高度
     * @param backgroundColor 背景颜色
     * @param text 显示的文本
     * @param textColor 文本颜色
     * @returns HTMLCanvasElement Canvas元素
     */
    public static generateImage(width: number, height: number, backgroundColor: string, text: string, textColor: string = "#FFFFFF"): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // 绘制背景
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);
        
        // 绘制文本
        ctx.fillStyle = textColor;
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, width / 2, height / 2);
        
        return canvas;
    }

    /**
     * 生成并保存测试资源
     * 此方法仅用于开发阶段，快速创建测试资源
     */
    public static generateTestResources(): void {
        console.log("生成测试资源...");
        
        // 生成主页背景图
        const homeBackground = this.generateImage(800, 600, "#1E1E1E", "主页背景");
        const homeBackgroundURL = homeBackground.toDataURL();
        Laya.loader.cacheRes("resources/home_bg.jpg", homeBackgroundURL);
        
        // 生成无尽模式图标
        const endlessModeIcon = this.generateImage(280, 120, "#4CAF50", "无尽模式");
        const endlessModeIconURL = endlessModeIcon.toDataURL();
        Laya.loader.cacheRes("resources/endless_mode.png", endlessModeIconURL);
        
        // 生成救援模式图标
        const saveModeIcon = this.generateImage(280, 120, "#2196F3", "救援模式");
        const saveModeIconURL = saveModeIcon.toDataURL();
        Laya.loader.cacheRes("resources/save_mode.jpg", saveModeIconURL);
        
        // 生成玩家头像
        const playerAvatar = this.generateImage(40, 40, "#9C27B0", "我");
        const playerAvatarURL = playerAvatar.toDataURL();
        Laya.loader.cacheRes("resources/player_log.png", playerAvatarURL);
        
        // 生成排行榜图标
        const rankIcon = this.generateImage(48, 48, "#FF9800", "排行");
        const rankIconURL = rankIcon.toDataURL();
        Laya.loader.cacheRes("resources/rank_icon.png", rankIconURL);
        
        console.log("测试资源生成完成");
    }
} 