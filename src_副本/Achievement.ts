const { regClass, property } = Laya;

// 军衔等级定义
export enum MilitaryRank {
    Private = "列兵",
    SquadLeader = "班长",
    PlatoonLeader = "排长",
    CompanyCommander = "连长",
    BattalionCommander = "营长",
    RegimentalCommander = "团长",
    BrigadeCommander = "旅长",
    DivisionCommander = "师长",
    CorpsCommander = "军长",
    ArmyCommander = "集团军司令",
    FieldMarshal = "元帅",
    GrandMarshal = "大元帅",
    Emperor = "皇帝"
}

// 军衔配置
interface RankConfig {
    name: MilitaryRank;
    natoCode: string;
    requiredSoldiers: number;
    description: string;
}

@regClass()
export class Achievement {
    private static _instance: Achievement;
    private static readonly STORAGE_KEY = "tankGame_militaryRank72";
    private rescuedSoldiers: number = 0;
    private currentRank: MilitaryRank = MilitaryRank.Private;

    // 军衔配置
    private static readonly RANK_CONFIGS: RankConfig[] = [
        { name: MilitaryRank.Private, natoCode: "PVT", requiredSoldiers: 1, description: "单兵" },
        { name: MilitaryRank.SquadLeader, natoCode: "SGT", requiredSoldiers: 12, description: "1个满编班（12人）" },
        { name: MilitaryRank.PlatoonLeader, natoCode: "2LT", requiredSoldiers: 50, description: "4个班（4×12人+2支援=50人）" },
        { name: MilitaryRank.CompanyCommander, natoCode: "CPT", requiredSoldiers: 200, description: "4个满编排（4×50人）" },
        { name: MilitaryRank.BattalionCommander, natoCode: "MAJ", requiredSoldiers: 1000, description: "5个满编连（5×200人）" },
        { name: MilitaryRank.RegimentalCommander, natoCode: "COL", requiredSoldiers: 3000, description: "3个满编营（3×1,000人）" },
        { name: MilitaryRank.BrigadeCommander, natoCode: "BG", requiredSoldiers: 8000, description: "2.7个团（现实旅≈2-3团，取高值）" },
        { name: MilitaryRank.DivisionCommander, natoCode: "MG", requiredSoldiers: 15000, description: "2个满编旅（2×8,000人）" },
        { name: MilitaryRank.CorpsCommander, natoCode: "LTG", requiredSoldiers: 50000, description: "3.3个师（现实军≈2-3师，取高值）" },
        { name: MilitaryRank.ArmyCommander, natoCode: "GEN", requiredSoldiers: 200000, description: "4个满编军（4×50,000人）" },
        { name: MilitaryRank.FieldMarshal, natoCode: "FM", requiredSoldiers: 500000, description: "2.5个集团军（现实战区级规模）" },
        { name: MilitaryRank.GrandMarshal, natoCode: "GFM", requiredSoldiers: 1000000, description: "2个方面军（现实最高统帅部）" },
        { name: MilitaryRank.Emperor, natoCode: "N/A", requiredSoldiers: 2000000, description: "2个超级集团军（帝国级）" }
    ];

    private constructor() {
        this.loadSavedData();
    }

    public static get instance(): Achievement {
        if (!Achievement._instance) {
            Achievement._instance = new Achievement();
        }
        return Achievement._instance;
    }

    private loadSavedData(): void {
        const savedData = Laya.LocalStorage.getItem(Achievement.STORAGE_KEY);
        if (savedData) {
            const data = JSON.parse(savedData);
            this.rescuedSoldiers = data.rescuedSoldiers || 0;
            this.currentRank = data.currentRank || MilitaryRank.Private;
        }
    }

    private saveData(): void {
        const data = {
            rescuedSoldiers: this.rescuedSoldiers,
            currentRank: this.currentRank
        };
        Laya.LocalStorage.setItem(Achievement.STORAGE_KEY, JSON.stringify(data));
    }

    public addRescuedSoldier(): void {
        this.rescuedSoldiers++;
        this.updateRank();
        this.saveData();
    }

    private updateRank(): void {
        // 从高到低检查军衔要求
        for (let i = Achievement.RANK_CONFIGS.length - 1; i >= 0; i--) {
            const config = Achievement.RANK_CONFIGS[i];
            if (this.rescuedSoldiers >= config.requiredSoldiers) {
                if (this.currentRank !== config.name) {
                    this.currentRank = config.name;
                    // 可以在这里添加军衔升级的提示或特效
                }
                break;
            }
        }
    }

    public getCurrentRankInfo(): { rank: MilitaryRank, natoCode: string, soldiers: number, nextRank?: RankConfig } {
        const currentConfig = Achievement.RANK_CONFIGS.find(config => config.name === this.currentRank);
        const nextRankIndex = Achievement.RANK_CONFIGS.findIndex(config => config.name === this.currentRank) + 1;
        const nextRank = nextRankIndex < Achievement.RANK_CONFIGS.length ? Achievement.RANK_CONFIGS[nextRankIndex] : undefined;

        return {
            rank: this.currentRank,
            natoCode: currentConfig?.natoCode || "PVT",
            soldiers: this.rescuedSoldiers,
            nextRank: nextRank
        };
    }

    public getRankProgress(): { current: number, next: number, progress: number } {
        const currentConfig = Achievement.RANK_CONFIGS.find(config => config.name === this.currentRank);
        const nextRankIndex = Achievement.RANK_CONFIGS.findIndex(config => config.name === this.currentRank) + 1;
        const nextConfig = nextRankIndex < Achievement.RANK_CONFIGS.length ? Achievement.RANK_CONFIGS[nextRankIndex] : undefined;

        if (!nextConfig) {
            return {
                current: this.rescuedSoldiers,
                next: this.rescuedSoldiers,
                progress: 1
            };
        }

        const progress = (this.rescuedSoldiers - (currentConfig?.requiredSoldiers || 0)) / 
                        (nextConfig.requiredSoldiers - (currentConfig?.requiredSoldiers || 0));

        return {
            current: this.rescuedSoldiers,
            next: nextConfig.requiredSoldiers,
            progress: Math.min(progress, 1)
        };
    }
} 