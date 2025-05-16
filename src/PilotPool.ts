import { Pilot } from "./Pilot";

/**
 * 驾驶员对象池
 * 用于管理驾驶员对象的创建和回收，提高性能
 */
export class PilotPool {
    private static _instance: PilotPool;
    
    private constructor() {}
    
    /**
     * 获取对象池单例
     */
    public static get instance(): PilotPool {
        if (!PilotPool._instance) {
            PilotPool._instance = new PilotPool();
        }
        return PilotPool._instance;
    }
    
    /**
     * 从池中获取一个驾驶员对象
     */
    public getPilot(): Pilot {
        // 每次都创建新的驾驶员对象
        return new Pilot(true);
    }
    
    /**
     * 回收驾驶员对象
     */
    public recyclePilot(pilot: Pilot): void {
        if (!pilot || pilot.destroyed) return;
        
        // 停止所有动画
        pilot.clearAnimations();
        
        // 从父容器中移除
        if (pilot.parent) {
            pilot.parent.removeChild(pilot);
        }
        
        // 直接销毁
        pilot.destroy();
    }
    
    /**
     * 暂停场景中所有驾驶员的计时器
     * @param gameBox 游戏容器
     */
    public static pauseAllPilots(gameBox: Laya.Sprite): void {
        if (!gameBox) return;
        
        // 查找场景中所有的驾驶员
        for (let i = 0; i < gameBox.numChildren; i++) {
            const child = gameBox.getChildAt(i);
            if (child instanceof Pilot) {
                // 暂停每个驾驶员的计时器
                child.pauseTimer();
            }
        }
        
        console.log("已暂停所有驾驶员的计时器");
    }
    
    /**
     * 恢复场景中所有驾驶员的计时器
     * @param gameBox 游戏容器
     */
    public static resumeAllPilots(gameBox: Laya.Sprite): void {
        if (!gameBox) return;
        
        // 查找场景中所有的驾驶员
        for (let i = 0; i < gameBox.numChildren; i++) {
            const child = gameBox.getChildAt(i);
            if (child instanceof Pilot) {
                // 恢复每个驾驶员的计时器
                child.resumeTimer();
            }
        }
        
        console.log("已恢复所有驾驶员的计时器");
    }
    
    /**
     * 重置场景中所有驾驶员的计时器为完整的6秒
     * @param gameBox 游戏容器
     */
    public static resetAllPilotsTimer(gameBox: Laya.Sprite): void {
        if (!gameBox) return;
        
        // 查找场景中所有的驾驶员
        for (let i = 0; i < gameBox.numChildren; i++) {
            const child = gameBox.getChildAt(i);
            if (child instanceof Pilot) {
                // 重置每个驾驶员的计时器
                (child as Pilot).resetTimer();
            }
        }
        
        console.log("已重置所有驾驶员的计时器为6秒");
    }
} 