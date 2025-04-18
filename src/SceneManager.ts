const { regClass, property } = Laya;
import { HomePage } from "./HomePage";
import { EndlessModeGame } from "./EndlessModeGame";
import { RescueModeGame } from "./RescueModeGame";
import { ResourceManager } from "./ResourceManager";

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
        console.log(`Loading scene: ${sceneName}, currentScene: ${this.currentScene ? this.currentScene.name : 'none'}`);
        
        // 销毁当前场景
        if (this.currentScene) {
            try {
                console.log(`Destroying current scene: ${this.currentScene.name}`);
                
                // 获取当前场景上的所有组件
                const mainComponent = this.currentScene.getComponent(EndlessModeGame) || 
                                      this.currentScene.getComponent(RescueModeGame) ||
                                      this.currentScene.getComponent(HomePage);
                
                console.log(`Found main component: ${mainComponent ? mainComponent.constructor.name : 'none'}`);
                
                // 如果存在主组件且有onDestroy方法，手动调用它
                if (mainComponent && mainComponent.onDestroy) {
                    console.log("Calling component's onDestroy method");
                    mainComponent.onDestroy();
                }
                
                // 清理所有与当前场景相关的计时器和动画
                console.log("Clearing timers and tweens");
                Laya.timer.clearAll(this.currentScene);
                Laya.Tween.clearAll(this.currentScene);
                
                // 特别清理一次ExplosionManager的计时器
                const explosionManagerInstance = (window as any).ExplosionManager?._instance;
                if (explosionManagerInstance) {
                    console.log("Clearing ExplosionManager timers");
                    Laya.timer.clearAll(explosionManagerInstance);
                }

                // 清理所有资源
                ResourceManager.instance.clearAll();
                
                // 延迟一帧再销毁场景，确保其他清理操作完成
                console.log("Scheduling scene destruction for next frame");
                Laya.timer.frameOnce(1, this, () => {
                    // 销毁场景
                    console.log("Destroying scene");
                    this.currentScene.destroy(true);
                    this.currentScene = null;
                    
                    // 创建新场景
                    console.log("Creating new scene");
                    this.createNewScene(sceneName);
                });
            } catch (e) {
                console.error("场景销毁出错:", e);
                // 即使出错也尝试创建新场景
                console.log("Attempting to create new scene despite error");
                this.createNewScene(sceneName);
            }
        } else {
            // 没有当前场景，直接创建新场景
            console.log("No current scene, creating new scene directly");
            this.createNewScene(sceneName);
        }
    }
    
    /**
     * 创建新场景
     * @param sceneName 场景名称
     */
    private createNewScene(sceneName: string): void {
        try {
            console.log(`Creating new scene: ${sceneName}`);
            
            // 创建新场景
            this.currentScene = new Laya.Scene();
            this.currentScene.name = sceneName;
            Laya.stage.addChild(this.currentScene);
            
            // 预加载场景所需资源
            ResourceManager.instance.preloadAll(
                (progress) => {
                    console.log(`Loading resources: ${progress}%`);
                },
                () => {
                    // 资源加载完成后，添加场景组件
                    let component = null;
                    switch (sceneName) {
                        case "HomePage":
                            console.log("Adding HomePage component");
                            component = this.currentScene.addComponent(HomePage);
                            break;
                        case "EndlessModeGame":
                            console.log("Adding EndlessModeGame component");
                            component = this.currentScene.addComponent(EndlessModeGame);
                            break;
                        case "RescueModeGame":
                            console.log("Adding RescueModeGame component");
                            component = this.currentScene.addComponent(RescueModeGame);
                            break;
                    }
                    
                    console.log(`Scene "${sceneName}" created with component: ${component ? component.constructor.name : 'none'}`);
                }
            );
        } catch (e) {
            console.error("场景创建出错:", e);
        }
    }
} 