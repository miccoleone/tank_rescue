const { regClass, property } = Laya;
import { SceneManager } from "./SceneManager";

/**
 * 游戏入口类
 */
@regClass()
export class GameEntry extends Laya.Script {
    onAwake(): void {
        console.log("Game starting...");
        // 初始化场景管理器并进入首页
        // SceneManager.instance.toHomePage();
        SceneManager.instance.navigateToScene("HomePage");
    }
} 