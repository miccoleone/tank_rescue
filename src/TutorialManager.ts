const { regClass } = Laya;
import { PopupPanel } from "./PopupPanel";

/**
 * 新手引导管理器
 * 负责处理游戏的新手引导提示
 */
@regClass()
export class TutorialManager {
    private static _instance: TutorialManager;
    private static readonly TUTORIAL_KEY_WELCOME = "tank_tutorial_seen74127";
    private static readonly TUTORIAL_KEY_ENDLESS = "tank_tutorial_endless127";
    private popupPanel: PopupPanel;

    private constructor() {
        // 创建 PopupPanel 实例
        const scene = new Laya.Scene();
        scene.name = "TutorialScene";
        Laya.stage.addChild(scene);
        this.popupPanel = scene.addComponent(PopupPanel);
    }

    public static get instance(): TutorialManager {
        if (!this._instance) {
            this._instance = new TutorialManager();
        }
        return this._instance;
    }

    /**
     * 显示欢迎提示（首次打开游戏）
     */
    public showWelcomeTip(container: Laya.Sprite): void {
        // 如果已经看过教程，直接返回
        if (Laya.LocalStorage.getItem(TutorialManager.TUTORIAL_KEY_WELCOME)) return;

        this.popupPanel.showWelcomePanel(
            "新手引导",
            "欢迎来到坦克大救援！在这里，你将驾驶坦克执行救援任务，击败敌人，营救被困的战士！",
            () => {
                // 标记为已显示
                Laya.LocalStorage.setItem(TutorialManager.TUTORIAL_KEY_WELCOME, "1");
            }
        );
    }

    /**
     * 显示无尽模式操作提示
     */
    public showEndlessModeTip(container: Laya.Sprite, joystickPos: { x: number, y: number }): void {
        // 如果已经看过教程，直接返回
        if (Laya.LocalStorage.getItem(TutorialManager.TUTORIAL_KEY_ENDLESS)) return;

        // 延迟一秒显示第一个提示
        Laya.timer.once(100, this, () => {
            this.showScoreTip(container, () => {
                this.showJoystickTip(container, joystickPos, () => {
                    this.showFireTip(container);
                });
            });
        });
    }

    /**
     * 显示得分区域提示
     */
    private showScoreTip(container: Laya.Sprite, onComplete?: Function): void {
        // 创建小弹窗，位于左上角
        this.popupPanel.show("游戏数据", (contentContainer) => {
            // 添加指向箭头
            const arrow = new Laya.Sprite();
            arrow.graphics.drawPath(0, 0, [
                ["moveTo", 0, 0],
                ["lineTo", 20, -20],
                ["lineTo", 40, 0],
                ["closePath"]
            ], { fillStyle: "#ffffff" });
            arrow.pos(contentContainer.width / 2 - 20, -10);
            contentContainer.addChild(arrow);

            const text = new Laya.Text();
            text.text = "这里显示玩家游戏数据";
            text.fontSize = 20;
            text.color = "#333333";
            text.width = contentContainer.width - 40;
            text.x = 20;
            text.y = 20;
            text.wordWrap = true;
            contentContainer.addChild(text);

            // 添加确认按钮
            const okBtn = new Laya.Sprite();
            okBtn.graphics.drawRect(0, 0, 100, 40, "#4CAF50");
            okBtn.x = contentContainer.width - 120;
            okBtn.y = contentContainer.height - 60;
            okBtn.mouseEnabled = true;
            okBtn.on(Laya.Event.CLICK, this, () => {
                this.popupPanel.hide();
                onComplete?.();
            });

            const okText = new Laya.Text();
            okText.text = "确定";
            okText.fontSize = 20;
            okText.color = "#FFFFFF";
            okText.width = 100;
            okText.align = "center";
            okText.y = 10;
            okBtn.addChild(okText);

            contentContainer.addChild(okBtn);
        }, {
            width: 300,
            height: 180
        });
    }

    /**
     * 显示摇杆提示
     */
    private showJoystickTip(container: Laya.Sprite, joystickPos: { x: number, y: number }, onComplete?: Function): void {
        this.popupPanel.show("操作提示", (contentContainer) => {
            const text = new Laya.Text();
            text.text = "操作摇杆移动你的坦克";
            text.fontSize = 20;
            text.color = "#333333";
            text.width = contentContainer.width - 40;
            text.x = 20;
            text.y = 20;
            text.wordWrap = true;
            contentContainer.addChild(text);

            // 添加确认按钮
            const okBtn = new Laya.Sprite();
            okBtn.graphics.drawRect(0, 0, 100, 40, "#4CAF50");
            okBtn.x = contentContainer.width - 120;
            okBtn.y = contentContainer.height - 60;
            okBtn.mouseEnabled = true;
            okBtn.on(Laya.Event.CLICK, this, () => {
                this.popupPanel.hide();
                onComplete?.();
            });

            const okText = new Laya.Text();
            okText.text = "确定";
            okText.fontSize = 20;
            okText.color = "#FFFFFF";
            okText.width = 100;
            okText.align = "center";
            okText.y = 10;
            okBtn.addChild(okText);

            contentContainer.addChild(okBtn);
        }, {
            width: 300,
            height: 180
        });
    }

    /**
     * 显示开火按钮提示
     */
    private showFireTip(container: Laya.Sprite): void {
        this.popupPanel.show("开火提示", (contentContainer) => {
            const text = new Laya.Text();
            text.text = "点击开火开始你的征程！";
            text.fontSize = 20;
            text.color = "#333333";
            text.width = contentContainer.width - 40;
            text.x = 20;
            text.y = 20;
            text.wordWrap = true;
            contentContainer.addChild(text);

            // 添加确认按钮
            const okBtn = new Laya.Sprite();
            okBtn.graphics.drawRect(0, 0, 100, 40, "#4CAF50");
            okBtn.x = contentContainer.width - 120;
            okBtn.y = contentContainer.height - 60;
            okBtn.mouseEnabled = true;
            okBtn.on(Laya.Event.CLICK, this, () => {
                this.popupPanel.hide();
                // 标记为已显示
                Laya.LocalStorage.setItem(TutorialManager.TUTORIAL_KEY_ENDLESS, "1");
            });

            const okText = new Laya.Text();
            okText.text = "确定";
            okText.fontSize = 20;
            okText.color = "#FFFFFF";
            okText.width = 100;
            okText.align = "center";
            okText.y = 10;
            okBtn.addChild(okText);

            contentContainer.addChild(okBtn);
        }, {
            width: 300,
            height: 180
        });
    }
} 