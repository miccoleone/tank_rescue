/**
 * 资源管理器
 */
export class ResourceManager {
    private static _instance: ResourceManager;
    
    private constructor() {}
    
    public static get instance(): ResourceManager {
        if (!this._instance) {
            this._instance = new ResourceManager();
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
            { url: "resources/level_up.mp3", type: Laya.Loader.SOUND },
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
            { url: "resources/lightning-icon.png", type: Laya.Loader.IMAGE },
            { url: "resources/circle_55_鲜红色按钮背景.png", type: Laya.Loader.IMAGE },
            { url: "resources/circle_55_白色按钮背景.png", type: Laya.Loader.IMAGE },
            { url: "resources/firebutton_bg.png", type: Laya.Loader.IMAGE }
        ];
        
        Laya.loader.load(
            resources,
            Laya.Handler.create(this, () => {
                console.log("All resources loaded");
                onComplete?.();
            }),
            Laya.Handler.create(this, (progress: number) => {
                console.log(`Loading progress: ${progress}`);
                onProgress?.(progress);
            })
        );
    }
} 