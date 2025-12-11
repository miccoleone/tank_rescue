const { regClass, property } = Laya;
import { SceneManager } from "./SceneManager";
import { LeaderboardManager, LeaderboardEntry } from "./LeaderboardManager";
import { RankConfig } from "./RankConfig";
import { PopupPanel } from "./PopupPanel";
import { Achievement, MilitaryRank } from "./Achievement";
import { TutorialManager } from "./TutorialManager";
import { RescueModeUnlockManager } from "./RescueModeUnlockManager";

// 添加微信小游戏API的类型声明
declare const wx: {
    showShareMenu: (options: { 
        withShareTicket?: boolean;
        menus?: string[];
    }) => void;
    onShareAppMessage: (callback: () => { 
        title: string; 
        imageUrl?: string;
        desc?: string;
    }) => void;
};

/**
 * 游戏首页
 */
@regClass()
export class HomePage extends Laya.Script {
    /** 玩家信息 */
    private playerInfo: {
        name: string;
        avatar: string;
    };
    
    /** @private 弹框组件 */
    private popupPanel: PopupPanel;
    
    /** 布局常量 */
    private static readonly ICON_RIGHT_MARGIN = 0.05; // 图标区域右边距（屏幕宽度的5%）
    private static readonly ICON_TOP_MARGIN = 0.22; // 图标区域顶部边距（屏幕高度的22%）
    private static readonly ICON_SIZE = 48; // 图标大小
    
    /** 服务器主机地址 */
    private static readonly HOST = "studydayday.cn"; // 生产环境
    // private static readonly HOST = "localhost:4396"; // 本地调试环境
    
    constructor() {
        super();
        // 初始化玩家信息
        this.initializePlayerInfo();
    }
    
    /**
     * 初始化玩家信息
     */
    private initializePlayerInfo(): void {
        // 检查是否已保存deviceId
        let deviceId = Laya.LocalStorage.getItem("deviceId");
        if (!deviceId) {
            // 生成新的deviceId (UUID)
            deviceId = this.generateUUID();
            Laya.LocalStorage.setItem("deviceId", deviceId);
        }
        
        // 检查是否已保存玩家昵称
        let playerName = Laya.LocalStorage.getItem("playerName");
        if (!playerName) {
            // 生成默认昵称，使用当前时间毫秒值的后6位
            const timestamp = Date.now().toString();
            const lastSixDigits = timestamp.substring(timestamp.length - 6);
            playerName = `玩家${lastSixDigits}`;
            Laya.LocalStorage.setItem("playerName", playerName);
        }
        
        this.playerInfo = {
            name: playerName,
            avatar: "resources/player_log.png"
        };
    }
    
    /**
     * 生成UUID
     */
    private generateUUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    onEnable(): void {
        console.log("HomePage onEnable");
        
        // 每次启用时检查救援模式解锁状态并更新按钮
        this.updateRescueModeButtonState();
    }
    
    onAwake(): void {
        console.log("HomePage onAwake");
        
        // 设置游戏屏幕适配
        Laya.stage.scaleMode = Laya.Stage.SCALE_FIXED_WIDTH;
        Laya.stage.alignH = Laya.Stage.ALIGN_CENTER;
        Laya.stage.alignV = Laya.Stage.ALIGN_MIDDLE;
        Laya.stage.screenMode = Laya.Stage.SCREEN_HORIZONTAL;
        
        // 初始化弹框组件
        try {
            this.popupPanel = this.owner.addComponent(PopupPanel);
        } catch (e) {
            console.error("初始化弹框组件失败:", e);
        }

        // 初始化微信分享功能
        this.initWxShare();

        // 预加载资源
        const resources = [
            { url: "resources/click.mp3", type: Laya.Loader.SOUND },
            { url: "resources/home_bg.jpg", type: Laya.Loader.IMAGE },
            { url: "resources/endless_mode.png", type: Laya.Loader.IMAGE },
            { url: "resources/save_mode.jpg", type: Laya.Loader.IMAGE },
            { url: "resources/stats_icon.png", type: Laya.Loader.IMAGE },
            { url: "resources/achievement.png", type: Laya.Loader.IMAGE },
            { url: "resources/lock.png", type: Laya.Loader.IMAGE },
        ];
        Laya.loader.load(
            resources,
            Laya.Handler.create(this, () => {
                console.log("HomePage resources loaded successfully");
                // 检查图片资源是否加载成功
                const endlessTexture = Laya.loader.getRes("resources/endless_mode.png");
                const saveTexture = Laya.loader.getRes("resources/save_mode.jpg");
                console.log("Endless mode texture:", endlessTexture);
                console.log("Save mode texture:", saveTexture);
                
                // 初始化UI
                this.initUI();
                // 显示欢迎提示（移到资源加载完成后）
                TutorialManager.instance.showWelcomeTip(this.owner as Laya.Sprite);
            }),
            Laya.Handler.create(this, (progress: number) => {
                console.log(`HomePage loading progress: ${progress}`);
            })
        );

        // 确保场景尺寸正确
        const owner = this.owner as Laya.Scene;
        owner.width = Laya.stage.width;
        owner.height = Laya.stage.height;
    }
    
    /**
     * 初始化微信分享功能
     */
    private initWxShare(): void {
        // 检查是否在微信环境中
        if (typeof wx !== 'undefined') {
            // 显示转发菜单
            wx.showShareMenu({
                withShareTicket: true,
                menus: ['shareAppMessage', 'shareTimeline']
            });

            // 监听用户点击右上角菜单的"转发"按钮时触发的事件
            wx.onShareAppMessage(() => {
                return {
                    title: '坦克大救援 - 快来和我一起玩吧',
                    imageUrl: 'resources/endless_mode.png'
                };
            });
        }
    }
    
    private initUI(): void {
        // 创建渐变背景
        this.createBackground();
        
        // 计算每个区域的宽度
        const totalWidth = Laya.stage.width;
        const unit = totalWidth / 10; // 总共10个单位(3+3+3+1)
        const sectionWidth = unit * 3;  // 前三个区域宽度
        const iconSectionWidth = unit;   // 最后一个区域宽度
        
        // 创建四个区域容器
        const playerSection = new Laya.Sprite();
        playerSection.name = "PlayerSection";
        playerSection.x = 0;
        playerSection.width = sectionWidth;
        this.owner.addChild(playerSection);
        
        const endlessSection = new Laya.Sprite();
        endlessSection.name = "EndlessSection";
        endlessSection.x = sectionWidth;
        endlessSection.width = sectionWidth;
        this.owner.addChild(endlessSection);
        
        const saveSection = new Laya.Sprite();
        saveSection.name = "SaveSection";
        saveSection.x = sectionWidth * 2;
        saveSection.width = sectionWidth;
        this.owner.addChild(saveSection);
        
        const iconSection = new Laya.Sprite();
        iconSection.name = "IconSection";
        iconSection.x = sectionWidth * 3;
        iconSection.width = iconSectionWidth;
        this.owner.addChild(iconSection);
        
        // 创建各个区域的内容
        this.createPlayerInfo(playerSection);
        this.createGameModes(endlessSection, saveSection);
        this.createIconBar(iconSection);
    }
    
    /**
     * 创建渐变背景
     */
    private createBackground(): void {
        const bg = new Laya.Image();
        bg.name = "Background";
        bg.skin = "resources/home_bg.jpg";
        
        // 计算缩放比例，确保图片能完全覆盖屏幕
        const stageRatio = Laya.stage.width / Laya.stage.height;
        const imageRatio = bg.width / bg.height;
        
        if (stageRatio > imageRatio) {
            // 如果屏幕更宽，按宽度缩放
            bg.width = Laya.stage.width;
            bg.height = Laya.stage.width / imageRatio;
        } else {
            // 如果屏幕更高，按高度缩放
            bg.height = Laya.stage.height;
            bg.width = Laya.stage.height * imageRatio;
        }
        
        // 居中定位
        bg.x = (Laya.stage.width - bg.width) / 2;
        bg.y = (Laya.stage.height - bg.height) / 2;
        
        this.owner.addChild(bg);
    }
    
    /**
     * 创建玩家信息区域
     */
    private createPlayerInfo(container: Laya.Sprite): void {
        // 根据屏幕尺寸动态计算边距
        const MARGIN = Math.min(Laya.stage.width, Laya.stage.height) * 0.06;
        
        // 创建头像容器
        const avatarContainer = new Laya.Sprite();
        avatarContainer.name = "AvatarContainer";
        avatarContainer.x = MARGIN * 3;
        avatarContainer.y = MARGIN;
        
        // 创建头像
        const avatar = new Laya.Image();
        avatar.name = "Avatar";
        avatar.skin = this.playerInfo.avatar;
        avatar.width = 40;
        avatar.height = 40;
        avatar.x = 0;
        avatar.y = 0;
        
        avatarContainer.addChild(avatar);
        
        // 创建玩家名称
        const nameText = new Laya.Text();
        nameText.name = "PlayerName";
        nameText.text = this.playerInfo.name;
        nameText.fontSize = Math.floor(avatar.height * 0.7);
        nameText.color = "#ffffff";
        nameText.x = avatar.width + Math.floor(MARGIN * 0.2);
        nameText.y = (avatar.height - nameText.fontSize) / 2;
        
        avatarContainer.addChild(nameText);

        // 创建编辑昵称按钮
        const editButton = new Laya.Text();
        editButton.text = "📝";
        editButton.fontSize = Math.floor(avatar.height * 0.7);
        editButton.color = "#FFFF00";
        editButton.x = nameText.x + nameText.width + Math.floor(MARGIN * 0.2);
        editButton.y = nameText.y;
        editButton.on(Laya.Event.CLICK, this, () => {
            // 检查玩家军衔是否达到营长
            const currentRank = Achievement.instance.getCurrentRankInfo_junxian().rank;
            const requiredRank = MilitaryRank.BattalionCommander; // 营长
            
            // 简单的军衔比较（实际应用中可能需要更复杂的比较逻辑）
            const rankOrder = [
                MilitaryRank.Private, MilitaryRank.SquadLeader, MilitaryRank.PlatoonLeader,
                MilitaryRank.CompanyCommander, MilitaryRank.BattalionCommander, MilitaryRank.RegimentalCommander,
                MilitaryRank.BrigadeCommander, MilitaryRank.DivisionCommander, MilitaryRank.CorpsCommander,
                MilitaryRank.ArmyCommander, MilitaryRank.FieldMarshal, MilitaryRank.GrandMarshal, MilitaryRank.Emperor
            ];
            
            const currentRankIndex = rankOrder.indexOf(currentRank);
            const requiredRankIndex = rankOrder.indexOf(requiredRank);
            
            if (currentRankIndex >= requiredRankIndex) {
                // 军衔达到要求，可以修改昵称（暂不实现具体功能）
                this.popupPanel.showMessage("军衔达到要求，可以修改昵称！", "提示");
            } else {
                // 军衔未达到要求
                this.popupPanel.showMessage("军衔晋升至营长可自定义昵称！", "提示");
            }
        });
        avatarContainer.addChild(editButton);

        // 创建军衔显示
        const militaryRankText = new Laya.Text();
        militaryRankText.name = "MilitaryRank";
        militaryRankText.text = Achievement.instance.getCurrentRankInfo_junxian().rank;
        militaryRankText.fontSize = Math.floor(avatar.height * 0.7);
        militaryRankText.color = "#4CAF50";
        militaryRankText.x = editButton.x + editButton.width + Math.floor(MARGIN * 0.2);  // 在编辑按钮右边，留一些间距
        militaryRankText.y = nameText.y;  // 与名字在同一行
        
        avatarContainer.addChild(militaryRankText);
        
        // 创建今日战绩容器
        const todayStatsContainer = new Laya.Sprite();
        todayStatsContainer.name = "TodayStatsContainer";
        todayStatsContainer.x = avatarContainer.x;
        todayStatsContainer.y = avatarContainer.y + avatar.height + MARGIN;
        
        // 创建今日战绩标题
        const todayTitle = new Laya.Text();
        todayTitle.text = "今日战绩";
        todayTitle.fontSize = Math.floor(avatar.height * 0.5);
        todayTitle.color = "#FFFF00";
        todayTitle.stroke = 2;
        todayTitle.strokeColor = "#000000";
        
        // 获取玩家数据
        const currentPlayerData = LeaderboardManager.instance.getCurrentPlayerEntry();
        const rankInfo = RankConfig.getRankByScore(currentPlayerData.score);
        
        // 创建段位信息容器
        const rankContainer = new Laya.Sprite();
        rankContainer.y = todayTitle.fontSize + MARGIN * 0.5;  // 放在标题下方
        
        // 创建段位名称
        const rankText = new Laya.Text();
        rankText.text = rankInfo.slogan;
        rankText.fontSize = Math.floor(avatar.height * 0.5);
        rankText.color = "#ffffff";  // 改为黄色，与标题颜色一致
        rankText.stroke = 2;  // 添加描边
        rankText.strokeColor = "#000000";  // 黑色描边
        rankContainer.addChild(rankText);
        
        // 创建段位图标
        const rankIcon = new Laya.Image();
        rankIcon.skin = rankInfo.icon;
        rankIcon.width = 32;
        rankIcon.height = 32;
        rankIcon.x = rankText.width + 4;  // 放在文字后面，间距4像素
        rankIcon.y = (rankText.height - rankIcon.height) / 2;  // 垂直居中对齐
        rankContainer.addChild(rankIcon);
        
        // 创建今日最高分数
        const todayScoreText = new Laya.Text();
        todayScoreText.text = `最高分数: ${currentPlayerData.score}`;
        todayScoreText.fontSize = Math.floor(avatar.height * 0.5);
        todayScoreText.color = "#ffffff";
        todayScoreText.stroke = 2;  // 添加描边
        todayScoreText.y = rankContainer.y + rankText.fontSize + MARGIN * 0.5;  // 使用rankText.fontSize代替rankIcon.height
        
        // 创建今日排名
        const todayRankText = new Laya.Text();
        todayRankText.text = `今日排名: ${currentPlayerData.rank}`;
        todayRankText.fontSize = todayScoreText.fontSize;
        todayRankText.color = "#ffffff";
        todayRankText.stroke = 2;  // 添加描边
        todayRankText.y = todayScoreText.y + todayScoreText.fontSize + MARGIN * 0.5;  // 增加行间距
        
        // 创建超越百分比
        const todayPercentText = new Laya.Text();
        todayPercentText.text = `超越了${currentPlayerData.percentile}%的玩家`;
        todayPercentText.fontSize = todayScoreText.fontSize;
        todayPercentText.color = "#4CAF50";
        todayPercentText.stroke = 2;  // 添加描边
        todayPercentText.y = todayRankText.y + todayRankText.fontSize + MARGIN * 0.5;  // 增加行间距
        
        todayStatsContainer.addChild(todayTitle);
        todayStatsContainer.addChild(rankContainer);
        todayStatsContainer.addChild(todayScoreText);
        todayStatsContainer.addChild(todayRankText);
        todayStatsContainer.addChild(todayPercentText);
        
        container.addChild(avatarContainer);
        container.addChild(todayStatsContainer);
    }
    
    /**
     * 创建游戏模式区域
     */
    private createGameModes(endlessSection: Laya.Sprite, saveSection: Laya.Sprite): void {
        // 创建整体容器
        const modesContainer = new Laya.Sprite();
        modesContainer.name = "ModesContainer";
        modesContainer.width = endlessSection.width + saveSection.width;
        modesContainer.height = Laya.stage.height;
        modesContainer.pos(endlessSection.x, 0);
        this.owner.addChild(modesContainer);

        // 创建标题栏容器
        const titleContainer = new Laya.Sprite();
        titleContainer.name = "TitleContainer";
        titleContainer.width = modesContainer.width;
        
        // 创建标题背景
        const titleBg = new Laya.Sprite();
        const titleBgWidth = modesContainer.width * 0.7;  // 减小宽度比例，使其更协调
        titleBg.graphics.drawPath(0, 0, [
            ["moveTo", 0, 4],
            ["lineTo", 0, 50],         // 减小高度
            ["lineTo", 4, 54],         // 调整边角
            ["lineTo", titleBgWidth - 4, 54],
            ["lineTo", titleBgWidth, 50],
            ["lineTo", titleBgWidth, 4],
            ["lineTo", titleBgWidth - 4, 0],
            ["lineTo", 4, 0],
            ["closePath"]
        ], { fillStyle: "rgba(0,0,0,0.4)" });
        
        // 让背景居中
        titleBg.pos((modesContainer.width - titleBgWidth) / 2, 40);  // 调整垂直位置
        
        // 创建标题文本
        const titleText = new Laya.Text();
        titleText.text = "选择模式";
        titleText.fontSize = 32;  // 稍微减小字号
        titleText.color = "#FFFF00";
        titleText.stroke = 3;
        titleText.strokeColor = "#000000";
        titleText.width = titleBgWidth;
        titleText.height = 54;  // 匹配背景高度
        titleText.align = "center";
        titleText.valign = "middle";
        titleText.pos(titleBg.x, titleBg.y);
        
        titleContainer.addChild(titleBg);
        titleContainer.addChild(titleText);
        modesContainer.addChild(titleContainer);

        // 创建按钮容器
        const buttonsContainer = new Laya.Sprite();
        buttonsContainer.name = "ButtonsContainer";
        
        // 计算按钮尺寸（基于屏幕高度）
        const buttonHeight = Laya.stage.height * 0.65;  // 按钮高度为屏幕高度的60%
        const buttonWidth = buttonHeight * 0.7;        // 按钮宽度为高度的70%（保持比例）
        const buttonSpacing = buttonWidth * 0.15;      // 按钮间距为按钮宽度的15%
        const totalWidth = buttonWidth * 2 + buttonSpacing;
        
        // 垂直居中定位
        buttonsContainer.pos(
            (modesContainer.width - totalWidth) / 2,
            (modesContainer.height - buttonHeight) / 2 + 32  // 向下偏移一点，避免与标题重叠
        );
        
        // 创建无尽模式按钮
        const endlessMode = this.createModeButton("resources/endless_mode.png", "无尽模式", true, buttonWidth, buttonHeight);
        endlessMode.name = "EndlessMode";
        endlessMode.pos(0, 0);
        
        // 添加点击效果
        endlessMode.on(Laya.Event.MOUSE_DOWN, this, () => {
            endlessMode.scale(0.95, 0.95);
        });
        
        endlessMode.on(Laya.Event.MOUSE_UP, this, () => {
            endlessMode.scale(1, 1);
            Laya.SoundManager.playSound("resources/click.mp3", 1);
            SceneManager.instance.navigateToScene("EndlessModeGame");
        });
        
        endlessMode.on(Laya.Event.MOUSE_OUT, this, () => {
            endlessMode.scale(1, 1);
        });
        
        // 检查救援模式是否已解锁
        const isRescueModeUnlocked = RescueModeUnlockManager.instance.isRescueModeUnlocked();
        
        // 创建拯救模式按钮
        const saveMode = this.createModeButton("resources/save_mode.jpg", "拯救模式", isRescueModeUnlocked, buttonWidth, buttonHeight);
        saveMode.name = "SaveMode";
        saveMode.pos(buttonWidth + buttonSpacing, 0);
        
        // 添加点击效果和事件处理
        saveMode.on(Laya.Event.MOUSE_DOWN, this, () => {
            if (isRescueModeUnlocked) {
                saveMode.scale(0.95, 0.95);
            }
        });
        
        saveMode.on(Laya.Event.CLICK, this, () => {
            // 播放点击音效
            const clickSound = Laya.SoundManager.playSound("resources/click.mp3", 1);
            if (clickSound) {
                clickSound.volume = 1.0;
            }
            
            // 动态检查当前解锁状态（不使用创建时的变量）
            const currentUnlockStatus = RescueModeUnlockManager.instance.isRescueModeUnlocked();
            if (currentUnlockStatus) {
                // 已解锁，正常跳转
                saveMode.scale(1, 1);
                Laya.timer.frameOnce(1, this, () => {
                    SceneManager.instance.navigateToScene("RescueModeGame");
                });
            } else {
                // 未解锁，显示提示
                this.showRescueModeLockedTip();
            }
        });
        
        saveMode.on(Laya.Event.MOUSE_OUT, this, () => {
            if (isRescueModeUnlocked) {
                saveMode.scale(1, 1);
            }
        });
        
        buttonsContainer.addChild(endlessMode);
        buttonsContainer.addChild(saveMode);
        modesContainer.addChild(buttonsContainer);
    }
    
    /**
     * 创建图标栏
     */
    private createIconBar(container: Laya.Sprite): void {
        // 创建数据统计按钮
        const statsBtn = this.createIconButton("resources/stats_icon.png");
        statsBtn.name = "StatsButton";
        
        // 使用百分比定位，确保在不同屏幕尺寸下都能良好适配
        const rightMargin = Laya.stage.width * HomePage.ICON_RIGHT_MARGIN;
        const topMargin = Laya.stage.height * HomePage.ICON_TOP_MARGIN;
        
        // 设置按钮位置，直接使用 Laya.stage 的尺寸
        statsBtn.x = Laya.stage.width * 0.9;  // 距离右边10%
        statsBtn.y = topMargin;  // 与玩家头像区域对齐
        
        // 添加点击事件
        statsBtn.on(Laya.Event.CLICK, this, () => {
            Laya.SoundManager.playSound("resources/click.mp3", 1);
            if (this.popupPanel.isShowing()) {
                this.popupPanel.hide();
                return;
            }
            this.showRank();
        });
        
        // 添加触摸反馈效果
        statsBtn.on(Laya.Event.MOUSE_DOWN, this, () => {
            statsBtn.alpha = 0.7;
        });
        
        statsBtn.on(Laya.Event.MOUSE_UP, this, () => {
            statsBtn.alpha = 1;
        });
        
        statsBtn.on(Laya.Event.MOUSE_OUT, this, () => {
            statsBtn.alpha = 1;
        });
        
        this.owner.addChild(statsBtn);

        // 创建成就按钮
        const achievementBtn = this.createIconButton("resources/achievement.png");
        achievementBtn.name = "AchievementButton";
        
        // 设置成就按钮位置，在统计按钮下方
        achievementBtn.x = Laya.stage.width * 0.9;  // 距离右边10%
        achievementBtn.y = topMargin + HomePage.ICON_SIZE + 15;  // 在统计按钮下方，间距10像素
        
        // 添加点击事件
        achievementBtn.on(Laya.Event.CLICK, this, () => {
            Laya.SoundManager.playSound("resources/click.mp3", 1);
            if (this.popupPanel.isShowing()) {
                this.popupPanel.hide();
                return;
            }
            this.showAchievementPanel();
        });
        
        // 添加触摸反馈效果
        achievementBtn.on(Laya.Event.MOUSE_DOWN, this, () => {
            achievementBtn.alpha = 0.7;
        });
        
        achievementBtn.on(Laya.Event.MOUSE_UP, this, () => {
            achievementBtn.alpha = 1;
        });
        
        achievementBtn.on(Laya.Event.MOUSE_OUT, this, () => {
            achievementBtn.alpha = 1;
        });
        
        this.owner.addChild(achievementBtn);
    }
    
    /**
     * 显示排行
     */
    private showRank(): void {
        // 检查当前分钟是否已经获取过排行榜数据
        const now = new Date();
        const currentMinute = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} ${now.getHours()}:${now.getMinutes()}`;
        const lastFetchMinute = Laya.LocalStorage.getItem("playerClickRank");
        
        if (lastFetchMinute === currentMinute) {
            // 当前分钟已经获取过数据，使用本地缓存
            const cachedRankData = Laya.LocalStorage.getItem("cachedRankData");
            if (cachedRankData) {
                try {
                    const rankData = JSON.parse(cachedRankData);
                    console.log("使用本地缓存的排行榜数据");
                    this.showRankPanel(rankData);
                    return;
                } catch (e) {
                    console.error("解析本地缓存排行榜数据失败:", e);
                }
            }
        }
        
        // 更新playerClickRank为当前分钟
        Laya.LocalStorage.setItem("playerClickRank", currentMinute);
        
        // 创建默认的救援榜数据（写死的JSON数据）
        const defaultRankData = {
            "rescuelist": [
                {
                    "rank": 1,
                    "nickName": "小崽啊你",
                    "resuceMaxNumber": 754,
                    "avatar": "resources/player_log.png"
                },
                {
                    "rank": 2,
                    "nickName": "奶思奶思",
                    "resuceMaxNumber": 671,
                    "avatar": "resources/player_log.png"
                },
                {
                    "rank": 3,
                    "nickName": "晴天",
                    "resuceMaxNumber": 603,
                    "avatar": "resources/player_log.png"
                },
                {
                    "rank": 4,
                    "nickName": "江西小袁",
                    "resuceMaxNumber": 498,
                    "avatar": "resources/player_log.png"
                },
                {
                    "rank": 5,
                    "nickName": "阿虎",
                    "resuceMaxNumber": 322,
                    "avatar": "resources/player_log.png"
                }
            ],
            "junxianlist": [
                {
                    "rank": 1,
                    "nickName": "书小华",
                    "soldiers": 273167,
                    "avatar": "resources/player_log.png"
                },
                {
                    "rank": 2,
                    "nickName": "云边小鱼",
                    "soldiers": 79605,
                    "avatar": "resources/player_log.png"
                },
                {
                    "rank": 3,
                    "nickName": "4396",
                    "soldiers": 62132,
                    "avatar": "resources/player_log.png"
                },
                {
                    "rank": 4,
                    "nickName": "海明威的小鲨鱼",
                    "soldiers": 60397,
                    "avatar": "resources/player_log.png"
                },
                {
                    "rank": 5,
                    "nickName": "凯特琳",
                    "soldiers": 28319,
                    "avatar": "resources/player_log.png"
                }
            ]
        };

        // 尝试从服务器获取排行榜数据
        this.fetchRankList(defaultRankData);
    }

    /**
     * 从服务器获取排行榜数据
     * @param defaultData 默认数据
     */
    private fetchRankList(defaultData: any): void {
        // 获取玩家deviceId和昵称
        const deviceId = Laya.LocalStorage.getItem("deviceId") || this.generateUUID();
        const playerName = Laya.LocalStorage.getItem("playerName") || "玩家";
        
        // 获取玩家的历史最大救援数
        const bestRescueData = Laya.LocalStorage.getItem("bestRescueCount");
        const resuceMaxNumber = bestRescueData ? parseInt(bestRescueData) : 0;
        
        // 获取玩家的总士兵数（从成就系统中获取）
        const achievementInfo = Achievement.instance.getCurrentRankInfo_junxian();
        const soldiers = achievementInfo.soldiers;
        
        // 准备请求数据
        const requestData = {
            deviceId: deviceId,
            nickName: playerName,
            resuceMaxNumber: resuceMaxNumber,
            soldiers: soldiers
        };

        console.log("发送排行榜请求数据:", requestData); // 添加调试日志

        // 使用XMLHttpRequest获取服务器数据
        const xhr = new Laya.HttpRequest();
        xhr.http.timeout = 10000; // 10秒超时
        
        xhr.once(Laya.Event.COMPLETE, this, (data: string) => {
            try {
                const response = JSON.parse(data);
                console.log("从服务器获取排行榜原始数据:", response);
                
                // 检查响应是否成功
                if (response.success) {
                    // 转换数据格式以匹配前端期望的格式
                    const rankData = {
                        rescuelist: response.top5ByRescue.map((item: any, index: number) => ({
                            rank: index + 1,
                            nickName: item.nickName,
                            resuceMaxNumber: item.resuceMaxNumber,
                            avatar: item.avatar || "resources/player_log.png"
                        })),
                        junxianlist: response.top5BySoldiers.map((item: any, index: number) => ({
                            rank: index + 1,
                            nickName: item.nickName,
                            soldiers: item.soldiers,
                            avatar: item.avatar || "resources/player_log.png"
                        }))
                    };
                    
                    console.log("转换后的排行榜数据:", rankData);
                    
                    // 保存数据到本地缓存
                    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD格式
                    Laya.LocalStorage.setItem("lastRankFetchDate", today);
                    Laya.LocalStorage.setItem("cachedRankData", JSON.stringify(rankData));
                    
                    // 显示服务器数据
                    this.showRankPanel(rankData);
                } else {
                    console.error("服务器返回错误:", response.message);
                    // 显示默认数据
                    this.showRankPanel(defaultData);
                }
            } catch (e) {
                console.error("解析服务器排行榜数据失败:", e);
                // 显示默认数据
                this.showRankPanel(defaultData);
            }
        });
        
        xhr.once(Laya.Event.ERROR, this, (data: any) => {
            console.error("从服务器获取排行榜数据失败:", data);
            // 显示默认数据
            this.showRankPanel(defaultData);
        });
        
        // 发送POST请求获取排行榜数据
        xhr.send(`https://${HomePage.HOST}/tank_rescue/ranklist`, 
                 JSON.stringify(requestData), 
                 "post", 
                 "text",
                 ["Content-Type", "application/json"]);
    }

    /**
     * 显示排行榜面板
     * @param rankData 排行榜数据
     */
    private showRankPanel(rankData: any): void {
        this.popupPanel.show("排行", (container: Laya.Sprite) => {
            // 创建Tab容器
            const tabContainer = new Laya.Sprite();
            tabContainer.pos(0, 0);
            container.addChild(tabContainer);

            // 创建救援榜Tab按钮
            const rescueTab = new Laya.Text();
            rescueTab.text = "救援榜";
            rescueTab.fontSize = 20;
            rescueTab.color = "#FFD700";
            rescueTab.width = 100;
            rescueTab.height = 40;
            rescueTab.align = "center";
            rescueTab.valign = "middle";
            rescueTab.bgColor = "#4CAF50";
            rescueTab.pos(50, 0);
            rescueTab.name = "rescueTab";
            tabContainer.addChild(rescueTab);

            // 创建军衔榜Tab按钮
            const junxianTab = new Laya.Text();
            junxianTab.text = "军衔榜";
            junxianTab.fontSize = 20;
            junxianTab.color = "#333333";
            junxianTab.width = 100;
            junxianTab.height = 40;
            junxianTab.align = "center";
            junxianTab.valign = "middle";
            junxianTab.bgColor = "#DDDDDD";
            junxianTab.pos(200, 0);
            junxianTab.name = "junxianTab";
            tabContainer.addChild(junxianTab);

            // 创建内容容器
            const contentContainer = new Laya.Sprite();
            contentContainer.pos(0, 50);
            contentContainer.width = container.width;
            contentContainer.height = container.height - 50;
            container.addChild(contentContainer);

            // 显示默认的救援榜
            this.showRescueList(contentContainer, rankData.rescuelist);

            // 添加Tab点击事件
            rescueTab.on(Laya.Event.CLICK, this, () => {
                // 更新Tab样式
                rescueTab.color = "#FFD700";
                rescueTab.bgColor = "#4CAF50";
                junxianTab.color = "#333333";
                junxianTab.bgColor = "#DDDDDD";
                
                // 清空内容容器
                contentContainer.removeChildren();
                
                // 显示救援榜
                this.showRescueList(contentContainer, rankData.rescuelist);
            });

            junxianTab.on(Laya.Event.CLICK, this, () => {
                // 更新Tab样式
                junxianTab.color = "#FFD700";
                junxianTab.bgColor = "#4CAF50";
                rescueTab.color = "#333333";
                rescueTab.bgColor = "#DDDDDD";
                
                // 清空内容容器
                contentContainer.removeChildren();
                
                // 显示军衔榜
                this.showJunxianList(contentContainer, rankData.junxianlist);
            });
        }, {
            width: 400,
            height: 500
        });
    }

    /**
     * 显示救援榜列表
     * @param container 容器
     * @param rescueList 救援榜数据
     */
    private showRescueList(container: Laya.Sprite, rescueList: any[]): void {
        // 创建排行榜标题
        const title = new Laya.Text();
        title.text = "救援人数排行榜";
        title.fontSize = 18;
        title.color = "#333333";
        title.width = container.width;
        title.align = "center";
        title.y = 10;
        container.addChild(title);

        // 创建排行榜列表
        for (let i = 0; i < rescueList.length; i++) {
            const item = rescueList[i];
            
            // 创建排行项容器
            const itemContainer = new Laya.Sprite();
            itemContainer.width = container.width;
            itemContainer.height = 50;
            itemContainer.y = 40 + i * 60;
            container.addChild(itemContainer);

            // 创建排名
            const rankText = new Laya.Text();
            rankText.text = item.rank.toString();
            rankText.fontSize = 20;
            rankText.color = this.getRankColor(item.rank);
            rankText.width = 30;
            rankText.align = "center";
            rankText.y = 15;
            itemContainer.addChild(rankText);

            // 创建头像
            const avatar = new Laya.Image();
            avatar.skin = item.avatar;
            avatar.width = 40;
            avatar.height = 40;
            avatar.x = 40;
            avatar.y = 5;
            itemContainer.addChild(avatar);

            // 创建玩家名称
            const nameText = new Laya.Text();
            nameText.text = item.nickName;
            nameText.fontSize = 18;
            nameText.color = "#333333";
            nameText.x = 90;
            nameText.y = 15;
            itemContainer.addChild(nameText);

            // 创建救援人数
            const rescueCountText = new Laya.Text();
            rescueCountText.text = item.resuceMaxNumber.toString();
            rescueCountText.fontSize = 18;
            rescueCountText.color = "#4CAF50";
            rescueCountText.x = container.width - 100;
            rescueCountText.y = 15;
            itemContainer.addChild(rescueCountText);

            // 创建"人"字
            const renText = new Laya.Text();
            renText.text = "人";
            renText.fontSize = 18;
            renText.color = "#4CAF50";
            renText.x = container.width - 40;
            renText.y = 15;
            itemContainer.addChild(renText);
        }
    }

    /**
     * 显示军衔榜列表
     * @param container 容器
     * @param junxianList 军衔榜数据
     */
    private showJunxianList(container: Laya.Sprite, junxianList: any[]): void {
        // 创建排行榜标题
        const title = new Laya.Text();
        title.text = "军衔等级排行榜";
        title.fontSize = 18;
        title.color = "#333333";
        title.width = container.width;
        title.align = "center";
        title.y = 10;
        container.addChild(title);

        // 创建排行榜列表
        for (let i = 0; i < junxianList.length; i++) {
            const item = junxianList[i];
            
            // 创建排行项容器
            const itemContainer = new Laya.Sprite();
            itemContainer.width = container.width;
            itemContainer.height = 50;
            itemContainer.y = 40 + i * 60;
            container.addChild(itemContainer);

            // 创建排名
            const rankText = new Laya.Text();
            rankText.text = item.rank.toString();
            rankText.fontSize = 20;
            rankText.color = this.getRankColor(item.rank);
            rankText.width = 30;
            rankText.align = "center";
            rankText.y = 15;
            itemContainer.addChild(rankText);

            // 创建头像
            const avatar = new Laya.Image();
            avatar.skin = item.avatar;
            avatar.width = 40;
            avatar.height = 40;
            avatar.x = 40;
            avatar.y = 5;
            itemContainer.addChild(avatar);

            // 创建玩家名称
            const nameText = new Laya.Text();
            nameText.text = item.nickName;
            nameText.fontSize = 18;
            nameText.color = "#333333";
            nameText.x = 90;
            nameText.y = 15;
            itemContainer.addChild(nameText);

            // 根据soldiers数量判断军衔
            const militaryRank = this.getMilitaryRankBySoldiers(item.soldiers);
            
            // 创建军衔
            const junxianText = new Laya.Text();
            junxianText.text = militaryRank;
            junxianText.fontSize = 18;
            junxianText.color = "#FF9800";
            junxianText.x = container.width - 120;
            junxianText.y = 15;
            itemContainer.addChild(junxianText);
        }
    }

    /**
     * 根据排名获取颜色
     * @param rank 排名
     * @returns 颜色值
     */
    private getRankColor(rank: number): string {
        switch (rank) {
            case 1: return "#FFD700"; // 金牌
            case 2: return "#C0C0C0"; // 银牌
            case 3: return "#CD7F32"; // 铜牌
            default: return "#333333";
        }
    }
    
    /**
     * 根据士兵数量获取军衔
     * @param soldiers 士兵数量
     * @returns 军衔名称
     */
    private getMilitaryRankBySoldiers(soldiers: number): string {
        // 军衔配置（与Achievement.ts中的配置一致）
        const rankConfigs = [
            { name: "列兵", requiredSoldiers: 1 },
            { name: "班长", requiredSoldiers: 12 },
            { name: "排长", requiredSoldiers: 50 },
            { name: "连长", requiredSoldiers: 200 },
            { name: "营长", requiredSoldiers: 1000 },
            { name: "团长", requiredSoldiers: 3000 },
            { name: "旅长", requiredSoldiers: 8000 },
            { name: "师长", requiredSoldiers: 15000 },
            { name: "军长", requiredSoldiers: 50000 },
            { name: "集团军司令", requiredSoldiers: 200000 },
            { name: "元帅", requiredSoldiers: 500000 },
            { name: "大元帅", requiredSoldiers: 1000000 },
            { name: "皇帝", requiredSoldiers: 2000000 }
        ];
        
        // 从高到低检查军衔要求
        for (let i = rankConfigs.length - 1; i >= 0; i--) {
            const config = rankConfigs[i];
            if (soldiers >= config.requiredSoldiers) {
                return config.name;
            }
        }
        
        // 默认返回最低军衔
        return "列兵";
    }

    /**
     * 更新救援模式按钮状态
     */
    private updateRescueModeButtonState(): void {
        // 查找游戏模式容器和救援模式按钮
        const modesContainer = this.owner.getChildByName("ModesContainer");
        if (!modesContainer) return;
        
        const buttonsContainer = modesContainer.getChildByName("ButtonsContainer");
        if (!buttonsContainer) return;
        
        const saveMode = buttonsContainer.getChildByName("SaveMode") as Laya.Sprite;
        if (!saveMode) return;
        
        // 检查当前解锁状态
        const isCurrentlyUnlocked = RescueModeUnlockManager.instance.isRescueModeUnlocked();
        
        // 如果状态发生变化，重新创建按钮
        // 这里简单检查按钮的mouseEnabled属性来判断之前的状态
        const wasUnlocked = saveMode.mouseEnabled;
        
        if (isCurrentlyUnlocked !== wasUnlocked) {
            console.log(`救援模式按钮状态发生变化: ${wasUnlocked} -> ${isCurrentlyUnlocked}`);
            // 重新初始化UI以反映新的状态
            this.initUI();
        }
    }

    /**
     * 显示救援模式未解锁提示
     */
    private showRescueModeLockedTip(): void {
        const unlockRankName = RescueModeUnlockManager.instance.getUnlockRankName();
        this.popupPanel.showMessage(`无尽模式中达到${unlockRankName}表现将解锁救援模式！`,"未解锁");
    }

    /**
     * 显示成就面板
     */
    private showAchievementPanel(): void {
        const rankInfo = Achievement.instance.getCurrentRankInfo_junxian();
        const progress = Achievement.instance.getRankProgress();

        this.popupPanel.show("军衔", (container: Laya.Sprite) => {
            // 创建军衔名称（水平居中）
            const rankText = new Laya.Text();
            rankText.text = rankInfo.rank;
            rankText.fontSize = 24;
            rankText.color = "#FFD700";
            rankText.width = container.width;
            rankText.height = 32;
            rankText.align = "center";
            rankText.stroke = 3;
            rankText.strokeColor = "#000000";
            rankText.y = 30;  // 顶部留出空间
            container.addChild(rankText);

            // 创建进度条容器
            const progressContainer = new Laya.Sprite();
            progressContainer.width = 300;  // 固定宽度
            progressContainer.x = (container.width - progressContainer.width) / 2;  // 水平居中
            progressContainer.y = rankText.y + rankText.height + 40;  // 与军衔名称保持适当间距
            container.addChild(progressContainer);

            // 创建进度条背景
            const progressBg = new Laya.Sprite();
            progressBg.graphics.drawRect(0, 0, progressContainer.width, 30, "#dddddd");
            progressContainer.addChild(progressBg);

            // 创建进度条
            const progressBar = new Laya.Sprite();
            progressBar.graphics.drawRect(0, 0, progressContainer.width * progress.progress, 30, "#4CAF50");
            progressContainer.addChild(progressBar);

            // 创建进度文本
            const progressText = new Laya.Text();
            progressText.text = `${progress.current}/${progress.next}`;
            progressText.fontSize = 18;
            progressText.color = "#555555";
            // progressText.width = progressContainer.width;
            progressText.height = 30;
            // progressText.align = "center";
            progressText.valign = "middle";
            progressText.x = progressContainer.width * progress.progress;
            progressContainer.addChild(progressText);

            // 如果有下一级军衔，显示下一级信息
            if (rankInfo.nextRank) {
                const nextRankText = new Laya.Text();
                nextRankText.text = `下一级: ${rankInfo.nextRank.name}`;
                nextRankText.fontSize = 20;
                nextRankText.color = "#FFD700";
                nextRankText.width = container.width;
                nextRankText.height = 24;
                nextRankText.align = "center";
                nextRankText.y = progressContainer.y + progressContainer.height + 60;  // 与进度条保持适当间距
                container.addChild(nextRankText);

                const nextRankDesc = new Laya.Text();
                nextRankDesc.text = rankInfo.nextRank.description;
                nextRankDesc.fontSize = 16;
                nextRankDesc.color = "#cccccc";
                nextRankDesc.width = container.width;
                nextRankDesc.height = 40;
                nextRankDesc.align = "center";
                nextRankDesc.y = nextRankText.y + nextRankText.height + 15;
                container.addChild(nextRankDesc);
            }
        });
    }
    
    /**
     * 创建模式按钮
     */
    private createModeButton(imagePath: string, text: string, enabled: boolean, width: number, height: number): Laya.Sprite {
        const btn = new Laya.Sprite();
        btn.name = "ModeButton";

        // ======================
        // 1. 边框绘制（三层）
        // ======================
        
        // 1.1 外层金色边框（最粗）
        this.drawRoundedFrame(btn, {
            x: 0, y: 0, 
            width: width, 
            height: height,
            radius: 10,               // 圆角半径
            strokeColor: "#FFD700",    // 金色边框
            strokeWidth: 4,           // 边框粗细
            fillStyle: "rgba(163, 113, 20, 0.9)" // 半透明棕填充
        });

        // 1.2 中层橙色边框（中等粗细）
        this.drawRoundedFrame(btn, {
            x: 4, y: 4, 
            width: width - 8, 
            height: height - 8,
            radius: 8,
            strokeColor: "#FF4500",   // 深橙色
            strokeWidth: 3,
            fillStyle: "rgba(255,165,0,0.9)"
        });

        // 1.3 内层装饰边框（最细）
        this.drawRoundedFrame(btn, {
            x: 10, y: 10, 
            width: width - 20, 
            height: height - 20,
            radius: 6,
            strokeColor: "#FF8C00",   // 亮橙色
            strokeWidth: 2,
            fillStyle: "rgba(255,140,0,0.5)"
        });
        
        // ======================
        // 2. 背景图片（自适应）
        // ======================
        const bgContainer = new Laya.Sprite();
        const bgWidth = width - 24;
        const bgHeight = height - 24;
        
        // 创建背景图
        const bg = new Laya.Image();
        bg.width = bgWidth;
        bg.height = bgHeight;
        bg.zOrder = 0; // 确保背景图片在最底层
        
        // 检查资源是否已加载，如果已加载则直接设置皮肤，否则等待加载完成
        if (Laya.loader.getRes(imagePath)) {
            console.log(`Directly setting skin for ${imagePath}`);
            bg.skin = imagePath;
        } else {
            console.log(`Waiting for resource ${imagePath} to load`);
            // 监听资源加载完成事件
            Laya.loader.once(Laya.Event.COMPLETE, this, () => {
                if (!bg.destroyed) {
                    console.log(`Resource loaded, setting skin for ${imagePath}`);
                    bg.skin = imagePath;
                }
            });
        }
        
        // 不使用遮罩，而是直接设置圆角裁剪效果
        bgContainer.pos(12, 12);
        bgContainer.addChild(bg);
        bgContainer.zOrder = 0; // 确保背景在最底层
        btn.addChild(bgContainer);

        // ======================
        // 3. 文字区域（底部20%高度）
        // ======================
        const textHeight = height * 0.3;  // 文字区占按钮高度30%
        const textY = height - textHeight; // 底部定位
        
        // 3.1 主文字（模式名称）
        const mainText = new Laya.Text();
        mainText.text = text;
        mainText.fontSize = Math.floor(textHeight * 0.25); // 字体高度占文字区35%
        mainText.color = "#FFFFFF";
        mainText.stroke = 3;
        mainText.strokeColor = "#FFA500";
        mainText.width = width;
        mainText.align = "center";
        mainText.y = textY + (textHeight - mainText.fontSize) / 2; // 垂直居中
        mainText.zOrder = 2; // 确保文字在上层
        btn.addChild(mainText);

        // 3.2 附加元素
        if (text == "无尽模式") {
            // // "敬请期待"副文本
            // const subText = new Laya.Text();
            // subText.text = "(初级)";
            // subText.fontSize = Math.floor(textHeight * 0.18); 
            // subText.color = "#999999";
            // subText.width = width;
            // subText.align = "center";
            // subText.y = mainText.y + mainText.fontSize + 7; // 主文字下方
            // subText.zOrder = 2; // 确保文字在上层
            // btn.addChild(subText);
        }else if (text == "拯救模式") {
            const subText = new Laya.Text();
            subText.text = enabled ? "(进阶)" : "(未解锁)";
            subText.fontSize = Math.floor(textHeight * 0.18); 
            subText.color = enabled ? "#999999" : "#FF6666";
            subText.width = width;
            subText.align = "center";
            subText.y = mainText.y + mainText.fontSize + 7; // 主文字下方
            subText.zOrder = 2; // 确保文字在上层
            btn.addChild(subText);
        }

        // 如果按钮未启用，添加锁定效果
        if (!enabled) {
            // 添加半透明遮罩
            const lockOverlay = new Laya.Sprite();
            lockOverlay.graphics.drawRect(0, 0, width, height, "rgba(0, 0, 0, 0.5)");
            lockOverlay.zOrder = 3; // 确保遮罩在最上层
            btn.addChild(lockOverlay);
            
            // 添加锁定图标 - 使用图片而不是emoji
            const lockIcon = new Laya.Image();
            lockIcon.skin = "resources/lock.png";
            const iconSize = Math.floor(height * 0.15); // 稍微增大一点
            lockIcon.width = iconSize;
            lockIcon.height = iconSize;
            lockIcon.x = (width - iconSize) / 2; // 水平居中
            lockIcon.y = (height - iconSize) / 2; // 垂直居中
            lockIcon.zOrder = 4; // 确保锁定图标在最上层
            btn.addChild(lockIcon);
        }

        // ======================
        // 4. 交互设置
        // ======================
        // 始终启用鼠标事件，以便未解锁的按钮也能响应点击
        btn.mouseEnabled = true;
        
        // 精确点击区域（避免边框点击无效）
        const hitArea = new Laya.HitArea();
        hitArea.hit.drawRect(0, 0, width, height, "#000000");
        btn.hitArea = hitArea;
        
        if (enabled) {
            // 点击动画效果
            btn.on(Laya.Event.MOUSE_DOWN, this, () => btn.scale(0.95, 0.95));
            btn.on(Laya.Event.MOUSE_UP, this, () => btn.scale(1, 1));
            btn.on(Laya.Event.MOUSE_OUT, this, () => btn.scale(1, 1));
        }

        return btn;
    }
    
    /**
     * 绘制圆角边框的辅助方法（复用绘制逻辑）
     * @param parent 父容器
     * @param options 绘制参数 
     */
    private drawRoundedFrame(
        parent: Laya.Sprite,
        options: {
            x: number, y: number, 
            width: number, height: number,
            radius: number,
            strokeColor: string,
            strokeWidth: number,
            fillStyle?: string
        }
    ) {
        const frame = new Laya.Sprite();
        frame.graphics.drawPath(
            0, 0, // 坐标系原点
            [
                ["moveTo", options.x + options.radius, options.y],
                ["lineTo", options.x + options.width - options.radius, options.y],
                ["arcTo", options.x + options.width, options.y, options.x + options.width, options.y + options.radius, options.radius],
                ["lineTo", options.x + options.width, options.y + options.height - options.radius],
                ["arcTo", options.x + options.width, options.y + options.height, options.x + options.width - options.radius, options.y + options.height, options.radius],
                ["lineTo", options.x + options.radius, options.y + options.height],
                ["arcTo", options.x, options.y + options.height, options.x, options.y + options.height - options.radius, options.radius],
                ["lineTo", options.x, options.y + options.radius],
                ["arcTo", options.x, options.y, options.x + options.radius, options.y, options.radius],
                ["closePath"]
            ] as any, // 使用类型断言，因为Laya API期望的类型可能与我们提供的不完全匹配
            { 
                strokeColor: options.strokeColor,
                strokeWidth: options.strokeWidth,
                fillStyle: options.fillStyle 
            }
        );
        frame.zOrder = -1; // 确保边框在最底层
        parent.addChild(frame);
    }
    
    /**
     * 创建图标按钮
     * @param iconPath 图标路径
     */
    private createIconButton(iconPath: string): Laya.Sprite {
        const button = new Laya.Sprite();
        
        // 创建图标
        const icon = new Laya.Image();
        icon.skin = iconPath;
        icon.width = HomePage.ICON_SIZE;
        icon.height = HomePage.ICON_SIZE;
        icon.pivot(HomePage.ICON_SIZE / 2, 0);  // 设置轴心点在图标顶部中心
        button.addChild(icon);
        
        // 创建点击区域，稍微扩大以提高可点击性
        const hitArea = new Laya.HitArea();
        hitArea.hit.drawRect(-HomePage.ICON_SIZE, 0, HomePage.ICON_SIZE * 2, HomePage.ICON_SIZE, "#000000");
        button.hitArea = hitArea;
        
        // 确保按钮可以接收点击事件
        button.mouseEnabled = true;
        button.mouseThrough = false;
        
        return button;
    }
    
    onDestroy(): void {
        console.log("HomePage onDestroy");
        // 清理所有事件监听
        this.owner.offAll();
    }
} 