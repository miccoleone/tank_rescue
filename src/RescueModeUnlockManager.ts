const { regClass } = Laya;
import { RankConfig } from "./RankConfig";

/**
 * 救援模式解锁管理器
 * 负责管理救援模式的解锁状态和相关逻辑
 */
@regClass()
export class RescueModeUnlockManager {
    private static _instance: RescueModeUnlockManager;
    
    // 解锁救援模式需要的分数（钻石段位：33000分）
    private static readonly UNLOCK_SCORE_THRESHOLD = 33000;
    
    // 本地存储键名
    private static readonly UNLOCK_STATUS_KEY = "tankGame_rescueModeUnlocked";
    private static readonly UNLOCK_NOTIFIED_KEY = "tankGame_rescueModeUnlockNotified";
    
    private constructor() {}
    
    public static get instance(): RescueModeUnlockManager {
        if (!this._instance) {
            this._instance = new RescueModeUnlockManager();
        }
        return this._instance;
    }
    
    /**
     * 检查救援模式是否已解锁
     */
    public isRescueModeUnlocked(): boolean {
        const unlockStatus = Laya.LocalStorage.getItem(RescueModeUnlockManager.UNLOCK_STATUS_KEY);
        return unlockStatus === "1";
    }
    
    /**
     * 解锁救援模式
     */
    public unlockRescueMode(): void {
        Laya.LocalStorage.setItem(RescueModeUnlockManager.UNLOCK_STATUS_KEY, "1");
        console.log("救援模式已解锁");
    }
    
    /**
     * 检查分数是否达到解锁要求（钻石段位或更高）
     */
    public checkScoreForUnlock(score: number): boolean {
        // 检查是否达到钻石段位
        const rankInfo = RankConfig.getRankByScore(score);
        return score >= RescueModeUnlockManager.UNLOCK_SCORE_THRESHOLD && 
               (rankInfo.name === "钻石" || rankInfo.name === "王者" || rankInfo.name === "长城");
    }

    /**
     * 获取解锁段位名称
     */
    public getUnlockRankName(): string {
        return "钻石";
    }
    
    /**
     * 检查是否已经通知过解锁
     */
    public hasNotifiedUnlock(): boolean {
        const notified = Laya.LocalStorage.getItem(RescueModeUnlockManager.UNLOCK_NOTIFIED_KEY);
        return notified === "1";
    }
    
    /**
     * 标记已通知解锁
     */
    public markUnlockNotified(): void {
        Laya.LocalStorage.setItem(RescueModeUnlockManager.UNLOCK_NOTIFIED_KEY, "1");
    }
    
    /**
     * 获取解锁所需分数
     */
    public getUnlockThreshold(): number {
        return RescueModeUnlockManager.UNLOCK_SCORE_THRESHOLD;
    }
    
    /**
     * 重置解锁状态（仅用于测试）
     */
    public resetUnlockStatus(): void {
        Laya.LocalStorage.removeItem(RescueModeUnlockManager.UNLOCK_STATUS_KEY);
        Laya.LocalStorage.removeItem(RescueModeUnlockManager.UNLOCK_NOTIFIED_KEY);
        console.log("救援模式解锁状态已重置");
    }
} 