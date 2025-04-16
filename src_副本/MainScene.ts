const { regClass, property } = Laya;
import { SceneManager } from "./SceneManager";
import { ResourceManager } from "./ResourceManager";

/**
 * 游戏入口场景
 * @author 书小华
 */
@regClass()
export default class MainScene extends Laya.Scene {
    constructor() {
        super();
    }

    onAwake(): void {
        console.log("MainScene starting...");
        
        // 设置游戏屏幕适配
        Laya.stage.width = 1136;
        Laya.stage.height = 640;
        Laya.stage.scaleMode = Laya.Stage.SCALE_FIXED_WIDTH;
        Laya.stage.alignH = Laya.Stage.ALIGN_CENTER;
        Laya.stage.alignV = Laya.Stage.ALIGN_MIDDLE;
        Laya.stage.screenMode = Laya.Stage.SCREEN_HORIZONTAL;
        
        // 预加载所有资源
        ResourceManager.instance.preloadAll(
            (progress) => {
                console.log(`Loading progress: ${progress * 100}%`);
                // TODO: 显示加载进度
            },
            () => {
                // 资源加载完成后初始化场景管理器并进入首页
                // SceneManager.instance.toHomePage();
                SceneManager.instance.navigateToScene("HomePage");
            }
        );
    }
} 