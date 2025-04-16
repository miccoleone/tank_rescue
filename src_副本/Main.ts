const { regClass, property } = Laya;
import { SceneManager } from "./SceneManager";

/**
 * 游戏主入口
 * @author 书小华
 */
@regClass()
export default class Main extends Laya.Scene {
    constructor() {
        super();
    }

    onAwake(): void {
        console.log("Main scene starting...");
        
        // 设置游戏屏幕适配
        Laya.stage.width = 1136;  // 设置固定设计宽度
        Laya.stage.height = 640;  // 设置固定设计高度
        Laya.stage.scaleMode = Laya.Stage.SCALE_FIXED_WIDTH;
        Laya.stage.alignH = Laya.Stage.ALIGN_CENTER;
        Laya.stage.alignV = Laya.Stage.ALIGN_MIDDLE;
        Laya.stage.screenMode = Laya.Stage.SCREEN_HORIZONTAL;
        
        // 初始化场景管理器并进入首页
        // SceneManager.instance.toHomePage();
        SceneManager.instance.navigateToScene("HomePage");
    }
}