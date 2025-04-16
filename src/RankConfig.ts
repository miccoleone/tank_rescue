export interface RankInfo {
    name: string;           // 段位名称
    startScore: number;     // 起始分数
    totalPlayers: number;   // 该段位总人数
    icon: string;          // 段位图标路径
    slogan: string;        // 段位称号
}

export class RankConfig {
    // 每个小段位所需分数
    public static readonly POINTS_PER_RANK = 3000;

    // 长城段位门槛
    public static readonly GREAT_WALL_THRESHOLD = 60000;

    // 段位配置
    public static readonly RANKS: RankInfo[] = [
        {
            name: "长城",
            startScore: 60000,
            totalPlayers: 20000,  // 约1%
            icon: "resources/medal/长城.png",
            slogan: "万里长城"
        },
        {
            name: "王者",
            startScore: 45000,
            totalPlayers: 30000,  // 约3%
            icon: "resources/medal/王者.png",
            slogan: "至尊王者"
        },
        {
            name: "钻石",
            startScore: 33000,
            totalPlayers: 40000,  // 约6%
            icon: "resources/medal/钻石.png",
            slogan: "璀璨钻石"
        },
        {
            name: "黄金",
            startScore: 21000,
            totalPlayers: 50000,  // 约15%
            icon: "resources/medal/黄金.png",
            slogan: "荣耀黄金"
        },
        {
            name: "白银",
            startScore: 9000,
            totalPlayers: 80000,  // 约30%
            icon: "resources/medal/白银.png",
            slogan: "不屈白银"
        },
        {
            name: "青铜",
            startScore: 0,
            totalPlayers: 90000,  // 约45%
            icon: "resources/medal/青铜.png",
            slogan: "英勇青铜"
        }
    ];

    // 获取段位信息
    public static getRankByScore(score: number): RankInfo {
        // 遍历所有段位，找到对应的段位
        for (const rank of this.RANKS) {
            if (score >= rank.startScore) {
                return rank;
            }
        }
        // 默认返回青铜
        return this.RANKS[this.RANKS.length - 1];
    }

    // 获取总玩家数
    public static getTotalPlayers(): number {
        return this.RANKS.reduce((sum, rank) => sum + rank.totalPlayers, 0);
    }
} 