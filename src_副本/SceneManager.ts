const { regClass, property } = Laya;
import { HomePage } from "./HomePage";
import { GameMain } from "./GameMain";
import { SaveModeMain } from "./SaveModeMain";

/**
 * 场景管理器 - 管理游戏中所有场景的切换
 */
@regClass()
export class SceneManager extends Laya.Script {
    private static _instance: SceneManager;
    private currentScene: Laya.Scene;
    
    constructor() {
        super();
        console.log("SceneManager constructed");
    }
    
    // 获取单例实例
    public static get instance(): SceneManager {
        if (!this._instance) {
            const scene = new Laya.Scene();
            scene.name = "SceneManager";
            Laya.stage.addChild(scene);
            this._instance = scene.addComponent(SceneManager);
            console.log("SceneManager instance created");
        }
        return this._instance;
    }
    
    // /**
    //  * 切换到首页
    //  */
    // public toHomePage(): void {
    //     console.log("Switching to HomePage");
    //     this.loadScene("HomePage");
    // }
    
    // /**
    //  * 切换到游戏页
    //  */
    // public toGamePage(): void {
    //     console.log("Switching to GamePage");
    //     this.loadScene("GamePage");
    // }
    
    /**
     * 导航到指定场景
     * @param sceneName 场景名称
     */
    public navigateToScene(sceneName: string): void {
        console.log(`Navigating to scene: ${sceneName}`);
        this.loadScene(sceneName);
    }
    
    /**
     * 加载指定场景
     * @param sceneName 场景名称
     */
    private loadScene(sceneName: string): void {
        console.log(`Loading scene: ${sceneName}`);
        
        // 销毁当前场景
        if (this.currentScene) {
            try {
                // 获取当前场景上的所有组件（不直接访问_components）
                const mainComponent = this.currentScene.getComponent(SaveModeMain) || 
                                      this.currentScene.getComponent(GameMain) || 
                                      this.currentScene.getComponent(HomePage);
                
                // 如果存在主组件且有onDestroy方法，手动调用它
                if (mainComponent && mainComponent.onDestroy) {
                    mainComponent.onDestroy();
                }
                
                // 清理所有与当前场景相关的计时器和动画
                Laya.timer.clearAll(this.currentScene);
                Laya.Tween.clearAll(this.currentScene);
                
                // 停止所有音效 点击音效 click之类的必须要正常播放！
                // Laya.SoundManager.stopAll();
                
                // 特别清理一次ExplosionManager的计时器
                const explosionManagerInstance = (window as any).ExplosionManager?._instance;
                if (explosionManagerInstance) {
                    Laya.timer.clearAll(explosionManagerInstance);
                }
                
                // 延迟一帧再销毁场景，确保其他清理操作完成
                Laya.timer.frameOnce(1, this, () => {
                    // 销毁场景
                    this.currentScene.destroy(true);
                    this.currentScene = null;
                    
                    // 主动请求垃圾回收（仅在支持的环境）
                    try {
                        // 在不同环境中尝试调用垃圾回收
                        const globalObj = typeof window !== 'undefined' ? window : 
                                         typeof globalThis !== 'undefined' ? globalThis : null;
                        
                        if (globalObj && (globalObj as any).gc) {
                            console.log("尝试主动触发垃圾回收");
                            (globalObj as any).gc();
                        }
                    } catch (e) {
                        console.log("垃圾回收不可用");
                    }
                    
                    // 创建新场景
                    this.createNewScene(sceneName);
                });
            } catch (e) {
                console.error("场景销毁出错:", e);
                // 即使出错也尝试创建新场景
                this.createNewScene(sceneName);
            }
        } else {
            // 没有当前场景，直接创建新场景
            this.createNewScene(sceneName);
        }
    }
    
    /**
     * 创建新场景
     * @param sceneName 场景名称
     */
    private createNewScene(sceneName: string): void {
        try {
            // 创建新场景
            this.currentScene = new Laya.Scene();
            this.currentScene.name = sceneName;
            Laya.stage.addChild(this.currentScene);
            
            // 根据场景名称加载对应组件
            switch (sceneName) {
                case "HomePage":
                    this.currentScene.addComponent(HomePage);
                    break;
                case "GameMain":
                    this.currentScene.addComponent(GameMain);
                    break;
                case "SaveModeMain":
                    this.currentScene.addComponent(SaveModeMain);
                    break;
            }
        } catch (e) {
            console.error("场景创建出错:", e);
        }
    }
} 