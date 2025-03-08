const { regClass } = Laya;

interface LeaderboardEntry {
    rank: number;
    score: number;
    rankName: string;
    level: number;
    percentile: number;
}

@regClass()
export class LeaderboardManager {
    private static _instance: LeaderboardManager;
    private static readonly POINTS_PER_RANK = 3000; // 每个小段位所需分数
    private static readonly GREAT_WALL_THRESHOLD = 60000; // 调整长城段位门槛
    private static readonly RANK_THRESHOLDS = {
        KING: 45000,    // 王者 (45000-59999)
        DIAMOND: 33000, // 钻石 (33000-44999)
        GOLD: 21000,   // 黄金 (21000-32999)
        SILVER: 9000,  // 白银 (9000-20999)
        BRONZE: 0      // 青铜 (0-8999)
    };
    private static readonly STORAGE_KEY = "tankGame_bestScore7";
    private static readonly RANK_STORAGE_KEY = "tankGame_rankInfo7"; // 新增：保存段位信息的key
    private static readonly SCORE_EXPIRY_DAYS = 1; // 战绩保存天数，1天后自动清除
    private currentScore: number = 0;
    private bestScore: number = 0;
    private lastRank: number = -1;
    private savedRankInfo: LeaderboardEntry | null = null; // 新增：保存的段位信息

    // 基础玩家数量（会根据分数段动态调整）
    private static readonly BASE_POPULATION = 10000;

    private constructor() {
        // 从本地存储加载最高分和段位信息
        const savedScore = localStorage.getItem(LeaderboardManager.STORAGE_KEY);
        const savedRankData = localStorage.getItem(LeaderboardManager.RANK_STORAGE_KEY);
        const savedTimestamp = localStorage.getItem(LeaderboardManager.STORAGE_KEY + "_timestamp");
        
        // 检查战绩是否过期
        let isExpired = false;
        if (savedTimestamp) {
            const savedDate = new Date(parseInt(savedTimestamp));
            const currentDate = new Date();
            const daysDiff = (currentDate.getTime() - savedDate.getTime()) / (1000 * 60 * 60 * 24);
            isExpired = daysDiff >= LeaderboardManager.SCORE_EXPIRY_DAYS;
        }
        
        if (savedScore && !isExpired) {
            this.bestScore = parseInt(savedScore);
        } else if (isExpired) {
            // 清除过期战绩
            localStorage.removeItem(LeaderboardManager.STORAGE_KEY);
            localStorage.removeItem(LeaderboardManager.RANK_STORAGE_KEY);
            localStorage.removeItem(LeaderboardManager.STORAGE_KEY + "_timestamp");
        }
        
        if (savedRankData && !isExpired) {
            try {
                this.savedRankInfo = JSON.parse(savedRankData);
                this.lastRank = this.savedRankInfo.rank;
            } catch (e) {
                console.error("Failed to parse saved rank info");
            }
        }
    }

    public static get instance(): LeaderboardManager {
        if (!this._instance) {
            this._instance = new LeaderboardManager();
        }
        return this._instance;
    }

    public getRankInfo(score: number): { rankName: string, level: number } {
        // 长城段位判断（66000分以上）
        if (score >= LeaderboardManager.GREAT_WALL_THRESHOLD) {
            return { rankName: "长城", level: 1 };
        }
        
        // 定义每个段位的分数区间
        const ranks = [
            { name: "王者", startScore: LeaderboardManager.RANK_THRESHOLDS.KING },
            { name: "钻石", startScore: LeaderboardManager.RANK_THRESHOLDS.DIAMOND },
            { name: "黄金", startScore: LeaderboardManager.RANK_THRESHOLDS.GOLD },
            { name: "白银", startScore: LeaderboardManager.RANK_THRESHOLDS.SILVER },
            { name: "青铜", startScore: LeaderboardManager.RANK_THRESHOLDS.BRONZE }
        ];
        
        // 找到当前分数对应的段位
        for (const rank of ranks) {
            if (score >= rank.startScore) {
                // 计算在当前段位的等级（1-4）
                const scoreInRank = score - rank.startScore;
                const level = Math.min(4, Math.floor(scoreInRank / LeaderboardManager.POINTS_PER_RANK) + 1);
                return {
                    rankName: rank.name,
                    level: level
                };
            }
        }
        
        // 默认返回青铜1
        return { rankName: "青铜", level: 1 };
    }

    public updateCurrentScore(score: number): void {
        this.currentScore = score;
        // 更新最高分和段位信息并保存到本地存储
        if (score > this.bestScore) {
            this.bestScore = score;
            localStorage.setItem(LeaderboardManager.STORAGE_KEY, this.bestScore.toString());
            // 保存时间戳
            localStorage.setItem(LeaderboardManager.STORAGE_KEY + "_timestamp", Date.now().toString());
            
            // 计算并保存新的段位信息
            const rankInfo = this.getRankInfo(score);
            const rank = this.calculateRank(score);
            const totalPlayers = 
                90000 + // 青铜
                80000 + // 白银
                50000 + // 黄金
                40000 + // 钻石
                30000 + // 王者
                20000;  // 长城
            const percentile = Math.min(99, Math.max(0, Math.floor((totalPlayers - rank) / totalPlayers * 100)));
            
            this.savedRankInfo = {
                rank,
                score: this.bestScore,
                rankName: rankInfo.rankName,
                level: rankInfo.level,
                percentile
            };
            
            localStorage.setItem(LeaderboardManager.RANK_STORAGE_KEY, JSON.stringify(this.savedRankInfo));
            this.lastRank = rank;
        }
    }

    private getPlayerDistribution(score: number): number {
        const rankInfo = this.getRankInfo(score);
        
        // 使用固定的随机种子确保相同分数得到相同结果
        const seed = score % 10000;
        const getRandom = () => {
            const x = Math.sin(seed) * 10000;
            return x - Math.floor(x);
        };

        // 根据段位设置基础玩家数量，调整比例以确保更合理的超越百分比
        let baseCount;
        switch(rankInfo.rankName) {
            case "青铜": 
                baseCount = 150000 + (getRandom() * 5000 - 2500); // 15万左右，占总玩家约45%
                break;
            case "白银": 
                baseCount = 100000 + (getRandom() * 4000 - 2000); // 10万左右，占总玩家约30%
                break;
            case "黄金": 
                baseCount = 50000 + (getRandom() * 3000 - 1500); // 5万左右，占总玩家约15%
                break;
            case "钻石": 
                baseCount = 20000 + (getRandom() * 2000 - 1000); // 2万左右，占总玩家约6%
                break;
            case "王者": 
                baseCount = 10000 + (getRandom() * 1000 - 500); // 1万左右，占总玩家约3%
                break;
            case "长城": 
                baseCount = 5000 + (getRandom() * 500 - 250);  // 5千左右，占总玩家约1%
                break;
            default:
                baseCount = 150000; // 默认使用青铜段位的基数
        }

        return Math.floor(baseCount);
    }

    private getTotalPlayersBelow(score: number): number {
        const ranks = [
            { name: "王者", startScore: LeaderboardManager.RANK_THRESHOLDS.KING },
            { name: "钻石", startScore: LeaderboardManager.RANK_THRESHOLDS.DIAMOND },
            { name: "黄金", startScore: LeaderboardManager.RANK_THRESHOLDS.GOLD },
            { name: "白银", startScore: LeaderboardManager.RANK_THRESHOLDS.SILVER },
            { name: "青铜", startScore: LeaderboardManager.RANK_THRESHOLDS.BRONZE }
        ];
        
        // 使用分数作为随机种子以确保相同分数得到相同结果
        const seed = score % 10000;
        const getRandom = () => {
            const x = Math.sin(seed) * 10000;
            return x - Math.floor(x);
        };

        // 获取当前段位信息
        const currentRankInfo = this.getRankInfo(score);
        
        // 计算总玩家数
        const totalPlayers = 
            150000 + // 青铜 约45%
            100000 + // 白银 约30%
            50000 + // 黄金 约15%
            20000 + // 钻石 约6%
            10000 + // 王者 约3%
            5000;   // 长城 约1%

        // 根据段位计算应该超越的玩家百分比
        let targetPercentile;
        switch(currentRankInfo.rankName) {
            case "长城":
                // 长城段位至少超越85%的玩家
                targetPercentile = 85 + (currentRankInfo.level - 1) * 3 + getRandom() * 2;
                break;
            case "王者":
                // 王者段位至少超越80%的玩家
                targetPercentile = 80 + (currentRankInfo.level - 1) * 2 + getRandom() * 2;
                break;
            case "钻石":
                // 钻石段位至少超越70%的玩家
                targetPercentile = 70 + (currentRankInfo.level - 1) * 2 + getRandom() * 2;
                break;
            case "黄金":
                // 黄金段位至少超越50%的玩家
                targetPercentile = 50 + (currentRankInfo.level - 1) * 3 + getRandom() * 3;
                break;
            case "白银":
                // 白银段位至少超越30%的玩家
                targetPercentile = 30 + (currentRankInfo.level - 1) * 4 + getRandom() * 3;
                break;
            case "青铜":
                // 青铜段位根据等级超越0-30%的玩家
                targetPercentile = (currentRankInfo.level - 1) * 7 + getRandom() * 5;
                break;
            default:
                targetPercentile = 0;
        }
        
        // 确保百分比在合理范围内
        targetPercentile = Math.min(99, Math.max(0, targetPercentile));
        
        // 根据目标百分比计算应该低于当前分数的玩家数量
        const playersBelow = Math.floor(totalPlayers * (targetPercentile / 100));
        
        // 添加一些随机波动，但确保不会超过总玩家数
        const randomFactor = Math.floor(getRandom() * 500) - 250;
        return Math.max(0, Math.min(totalPlayers, playersBelow + randomFactor));
    }

    private calculateRank(score: number): number {
        // 如果有保存的段位信息且分数相同，直接返回保存的排名
        if (this.savedRankInfo && this.savedRankInfo.score === score) {
            return this.savedRankInfo.rank;
        }

        // 计算总玩家数
        const totalPlayers = 
            90000 + // 青铜
            80000 + // 白银
            50000 + // 黄金
            40000 + // 钻石
            30000 + // 王者
            20000;  // 长城

        // 长城段位特殊处理，确保超越90%以上的玩家
        if (score >= LeaderboardManager.GREAT_WALL_THRESHOLD) {
            // 计算排名，确保在前10%
            const maxRank = Math.floor(totalPlayers * 0.1); // 前10%的排名上限
            
            // 使用分数作为随机种子以确保相同分数得到相同结果
            const seed = score % 10000;
            const getRandom = () => {
                const x = Math.sin(seed) * 10000;
                return x - Math.floor(x);
            };
            
            // 在前10%范围内随机生成排名
            return Math.max(1, Math.floor(maxRank * getRandom()) + 1);
        }

        // 计算低于当前分数的玩家数
        const playersBelow = this.getTotalPlayersBelow(score);
        
        // 确保排名在合理范围内
        return Math.max(1, Math.min(totalPlayers, totalPlayers - playersBelow));
    }

    public getCurrentPlayerEntry(): LeaderboardEntry {
        // 如果有保存的段位信息，直接返回
        if (this.savedRankInfo && this.savedRankInfo.score === this.bestScore) {
            return this.savedRankInfo;
        }

        const rankInfo = this.getRankInfo(this.bestScore);
        const rank = this.calculateRank(this.bestScore);
        
        // 计算总玩家数（使用新的玩家分布）
        const totalPlayers = 
            150000 + // 青铜 约45%
            100000 + // 白银 约30%
            50000 + // 黄金 约15%
            20000 + // 钻石 约6%
            10000 + // 王者 约3%
            5000;   // 长城 约1%
        
        // 计算超越百分比（使用排名计算）
        const percentile = Math.min(99, Math.max(0, Math.floor((totalPlayers - rank) / totalPlayers * 100)));

        // 确保段位与超越百分比匹配
        let adjustedPercentile = percentile;
        if (rankInfo.rankName === "钻石" && percentile < 70) {
            adjustedPercentile = 70 + Math.floor(Math.random() * 10); // 钻石段位至少超越70%
        } else if (rankInfo.rankName === "王者" && percentile < 80) {
            adjustedPercentile = 80 + Math.floor(Math.random() * 10); // 王者段位至少超越80%
        } else if (rankInfo.rankName === "长城" && percentile < 85) {
            adjustedPercentile = 85 + Math.floor(Math.random() * 14); // 长城段位至少超越85%
        }

        // 保存计算结果
        this.savedRankInfo = {
            rank,
            score: this.bestScore,
            rankName: rankInfo.rankName,
            level: rankInfo.level,
            percentile: adjustedPercentile
        };
        localStorage.setItem(LeaderboardManager.RANK_STORAGE_KEY, JSON.stringify(this.savedRankInfo));

        return this.savedRankInfo;
    }
}