/**
 * 庆祝工具类 - 用于处理游戏中的里程碑庆祝提示
 */
export class CongratulationUtils {
    // 单例模式
    private static instance: CongratulationUtils;
    
    // 里程碑记录 - 避免重复显示
    private milestoneShown: Set<number> = new Set<number>();
    
    // 里程碑配置
    private milestones = [
        { count: 50, title: "勇冠三军" },
        { count: 100, title: "天下无敌" }
    ];
    
    // 私有构造函数，确保单例
    private constructor() {}
    
    // 获取单例实例
    public static getInstance(): CongratulationUtils {
        if (!CongratulationUtils.instance) {
            CongratulationUtils.instance = new CongratulationUtils();
        }
        return CongratulationUtils.instance;
    }
    
    // 重置里程碑记录 - 用于游戏重新开始时
    public reset(): void {
        this.milestoneShown.clear();
    }
    
    /**
     * 检查并显示庆祝信息
     * @param rescuedPilots 已救援的驾驶员数量
     * @param showMessageFunc 显示消息的回调函数
     */
    public checkAndShowCongratulation(rescuedPilots: number, showMessageFunc: (title: string, desc: string) => void): void {
        // 检查是否达到里程碑
        for (const milestone of this.milestones) {
            // 只在刚好达到里程碑时显示一次
            if (rescuedPilots === milestone.count && !this.milestoneShown.has(milestone.count)) {
                // 记录已显示
                this.milestoneShown.add(milestone.count);
                
                // 调用显示函数
                showMessageFunc(milestone.title, `你成功救起 ${rescuedPilots}名战士！`);
                
                // 只显示一个里程碑消息
                break;
            }
        }
    }
} 