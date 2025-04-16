const { regClass, property } = Laya;
import { SceneManager } from "./SceneManager";

/**
 * 游戏入口类，通过IDE指定为场景脚本
 */
@regClass()
export class GameEntry extends Laya.Script {
    constructor() {
        super();
    }
    
    onAwake(): void {
        console.log("GameEntry onAwake");
        // 导航到主页
        SceneManager.instance.navigateToScene("HomePage");
    }
}