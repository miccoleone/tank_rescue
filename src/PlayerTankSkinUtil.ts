/**
 * 坦克皮肤配置枚举
 */
export enum TankSkinType {
    TANK1_RED = "resources/Retina/tank1_red.png",
    TANK1_BLUE = "resources/Retina/tank1_blue.png",
    TANK1_DARK = "resources/Retina/tank1_dark.png",
    TANK1_SAND = "resources/Retina/tank1_sand.png",
    TANK2_RED = "resources/Retina/tank2_red.png",
    TANK2_BLUE = "resources/Retina/tank2_blue.png",
    TANK2_DARK = "resources/Retina/tank2_dark.png",
    TANK2_SAND = "resources/Retina/tank2_sand.png",
    TANK3_RED1 = "resources/Retina/tank3_red1.png",
    TANK3_RED2 = "resources/Retina/tank3_red2.png",
    TANK3_RED3 = "resources/Retina/tank3_red3.png",
    TANK3_RED4 = "resources/Retina/tank3_red4.png",
    TANK4_1 = "resources/Retina/tank4_1.png",
    TANK4_2 = "resources/Retina/tank4_2.png",
}

/**
 * 坦克等级配置
 */
interface TankLevelConfig {
    requiredPilots: number;
    skin: TankSkinType;
    tankName: string;  // 改为真实坦克名称
}

/**
 * 玩家坦克皮肤工具类
 */
export class PlayerTankSkinUtil {
    // 单例模式
    private static instance: PlayerTankSkinUtil;
    
    // 坦克等级配置（从高到低排序）
    private readonly tankLevels: TankLevelConfig[] = [
        { requiredPilots: 130, skin: TankSkinType.TANK4_2, tankName: "99A式" }, // 美国主战坦克
        { requiredPilots: 120, skin: TankSkinType.TANK4_1, tankName: "M1A2艾布拉姆斯" },       // 中国主战坦克
        { requiredPilots: 110, skin: TankSkinType.TANK3_RED4, tankName: "勒克莱尔" },  // 法国主战坦克
        { requiredPilots: 100, skin: TankSkinType.TANK3_RED3, tankName: "挑战者2" },   // 英国主战坦克
        { requiredPilots: 90, skin: TankSkinType.TANK3_RED2, tankName: "梅卡瓦" },     // 以色列主战坦克
        { requiredPilots: 80, skin: TankSkinType.TANK3_RED1, tankName: "K2黑豹" },     // 韩国主战坦克
        { requiredPilots: 70, skin: TankSkinType.TANK2_SAND, tankName: "T-90" },      // 俄罗斯主战坦克
        { requiredPilots: 60, skin: TankSkinType.TANK2_DARK, tankName: "10式" },      // 日本主战坦克
        { requiredPilots: 50, skin: TankSkinType.TANK2_BLUE, tankName: "虎式" },      // 德国二战名坦克
        { requiredPilots: 40, skin: TankSkinType.TANK2_RED, tankName: "谢尔曼" },     // 美国二战名坦克
        { requiredPilots: 30, skin: TankSkinType.TANK1_SAND, tankName: "T-34" },      // 苏联二战名坦克
        { requiredPilots: 20, skin: TankSkinType.TANK1_DARK, tankName: "豹式" },      // 德国二战名坦克
        { requiredPilots: 10, skin: TankSkinType.TANK1_BLUE, tankName: "克伦威尔" },   // 英国二战名坦克
        { requiredPilots: 0, skin: TankSkinType.TANK1_RED, tankName: "斯图亚特" }      // 美国二战轻型坦克
    ];

    private constructor() {
        // 私有构造函数，确保单例
        this.preloadAllSkins();
    }

    public static getInstance(): PlayerTankSkinUtil {
        if (!PlayerTankSkinUtil.instance) {
            PlayerTankSkinUtil.instance = new PlayerTankSkinUtil();
        }
        return PlayerTankSkinUtil.instance;
    }

    /**
     * 预加载所有坦克皮肤
     */
    private preloadAllSkins(): void {
        // 获取所有皮肤路径，直接从枚举中提取值
        const skinValues: string[] = [];
        for (const key in TankSkinType) {
            if (typeof TankSkinType[key] === 'string') {
                skinValues.push(TankSkinType[key] as string);
            }
        }
        
        Laya.loader.load(skinValues, Laya.Handler.create(this, () => {
            console.log("所有坦克皮肤加载完成");
        }));
    }

    /**
     * 获取玩家当前应该使用的坦克皮肤
     * @param rescuedPilots 已救援的驾驶员数量
     * @returns 坦克皮肤配置
     */
    public getPlayerSkin(rescuedPilots: number): TankLevelConfig {
        // 从高到低遍历配置，返回第一个符合条件的等级
        for (const level of this.tankLevels) {
            if (rescuedPilots >= level.requiredPilots) {
                return level;
            }
        }
        // 默认返回最低等级
        return this.tankLevels[this.tankLevels.length - 1];
    }

    /**
     * 检查是否需要升级坦克
     * @param currentSkin 当前皮肤
     * @param rescuedPilots 已救援的驾驶员数量
     * @returns 如果需要升级返回新的等级配置，否则返回null
     */
    public checkUpgrade(currentSkin: TankSkinType, rescuedPilots: number): TankLevelConfig | null {
        // 根据驾驶员数量获取对应皮肤
        const newLevel = this.getPlayerSkin(rescuedPilots);
        
        // 如果皮肤不同，则需要升级
        return (newLevel.skin !== currentSkin) ? newLevel : null;
    }

    /**
     * 获取所有皮肤路径数组
     */
    public getAllSkinPaths(): string[] {
        return Object.values(TankSkinType);
    }

    /**
     * 验证皮肤是否有效
     */
    public isSkinValid(skin: TankSkinType): boolean {
        return !!skin && Object.values(TankSkinType).includes(skin);
    }
} 