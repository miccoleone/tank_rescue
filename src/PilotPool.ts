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
} 