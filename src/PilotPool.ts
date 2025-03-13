import { Pilot } from "./Pilot";

/**
 * 驾驶员对象池
 * 用于管理驾驶员对象的创建和回收，提高性能
 */
export class PilotPool {
    private static _instance: PilotPool;
    private pool: Pilot[] = [];
    private readonly INIT_SIZE = 10; // 初始池大小
    private readonly MAX_SIZE = 20;  // 最大池大小
    
    private constructor() {
        this.initPool();
    }
    
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
     * 初始化对象池
     */
    private initPool(): void {
        // 预创建一定数量的驾驶员对象
        for (let i = 0; i < this.INIT_SIZE; i++) {
            const pilot = new Pilot(true); // 传入true表示是池对象
            pilot.visible = false;
            this.pool.push(pilot);
        }
    }
    
    /**
     * 从池中获取一个驾驶员对象
     */
    public getPilot(): Pilot {
        let pilot: Pilot;
        
        if (this.pool.length > 0) {
            pilot = this.pool.pop();
        } else {
            pilot = new Pilot(true); // 创建新的池对象
        }
        
        pilot.reset(); // 重置状态
        pilot.visible = true;
        return pilot;
    }
    
    /**
     * 回收驾驶员对象到池中
     */
    public recyclePilot(pilot: Pilot): void {
        if (!pilot || pilot.destroyed) return;
        
        if (this.pool.length < this.MAX_SIZE) {
            // 停止所有动画
            pilot.clearAnimations();
            
            // 从父容器中移除
            if (pilot.parent) {
                pilot.parent.removeChild(pilot);
            }
            
            // 隐藏并加入池
            pilot.visible = false;
            this.pool.push(pilot);
        } else {
            // 如果池已满，直接销毁
            pilot.destroy();
        }
    }
} 