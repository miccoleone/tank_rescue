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
     * 预加载所有游戏资源
     * @param onProgress 加载进度回调
     * @param onComplete 加载完成回调
     */
    public preloadAll(onProgress?: (progress: number) => void, onComplete?: () => void): void {
        const resources = [
            // 玩家相关
            { url: "resources/player_log.png", type: Laya.Loader.IMAGE },
            { url: "resources/tank.png", type: Laya.Loader.IMAGE },
            { url: "resources/bullet.png", type: Laya.Loader.IMAGE },
            
            // 箱子相关
            { url: "resources/woodBox.png", type: Laya.Loader.IMAGE },
            { url: "resources/metalBox.png", type: Laya.Loader.IMAGE },
            { url: "resources/explosion.png", type: Laya.Loader.IMAGE },
            
            // 音效
            { url: "resources/fire.mp3", type: Laya.Loader.SOUND },
            { url: "resources/background.mp3", type: Laya.Loader.SOUND },
            { url: "resources/score.mp3", type: Laya.Loader.SOUND },
            { url: "resources/click.mp3", type: Laya.Loader.SOUND },
            
            // 敌人
            { url: "resources/enemy-tank.png", type: Laya.Loader.IMAGE },
            
            // 段位图标
            { url: "resources/moon.png", type: Laya.Loader.IMAGE },
            { url: "resources/star.png", type: Laya.Loader.IMAGE },
            { url: "resources/sun.png", type: Laya.Loader.IMAGE },
            { url: "resources/diamond.png", type: Laya.Loader.IMAGE },
            { url: "resources/king.png", type: Laya.Loader.IMAGE },
            { url: "resources/greatwall.png", type: Laya.Loader.IMAGE },
            
            // UI图标
            { url: "resources/闪电.png", type: Laya.Loader.IMAGE },
            { url: "resources/circle_60_red.png", type: Laya.Loader.IMAGE },
            { url: "resources/circle_60.png", type: Laya.Loader.IMAGE },
            { url: "resources/home.png", type: Laya.Loader.IMAGE }
        ];
        
        Laya.loader.load(
            resources,
            Laya.Handler.create(this, () => {
                console.log("All resources loaded");
                resources.forEach(res => this.loadedResources.add(res.url));
                onComplete?.();
            }),
            Laya.Handler.create(this, (progress: number) => {
                console.log(`Loading progress: ${progress}`);
                onProgress?.(progress);
            })
        );
    }

    /**
     * 清理所有资源
     */
    public clearAll(): void {
        console.log("Clearing all resources");
        
        // 停止所有音效
        Laya.SoundManager.stopAllSound();
        Laya.SoundManager.stopMusic();
        
        // 清理所有计时器
        Laya.timer.clearAll(this);
        
        // 清理所有已加载的资源
        this.loadedResources.forEach(url => {
            try {
                Laya.loader.clearRes(url);
            } catch (e) {
                console.warn(`Failed to clear resource: ${url}`, e);
            }
        });
        this.loadedResources.clear();
        
        // 清理纹理缓存
        Laya.Resource.destroyUnusedResources();
        
        console.log("All resources cleared");
    }
} 