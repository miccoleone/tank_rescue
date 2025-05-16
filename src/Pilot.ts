const { regClass } = Laya;
import { PilotPool } from "./PilotPool";
import { Achievement } from "./Achievement";
import { ScoreUtil } from "./ScoreUtil";

@regClass()
export class Pilot extends Laya.Sprite {
    private static readonly PILOT_IMAGES = [
        "resources/savemode/man1.png",
        "resources/savemode/man2.png",
        "resources/savemode/man3.png",
        "resources/savemode/man4.png",
        "resources/savemode/man5.png"
    ];

    private pilotImage: Laya.Image;
    private particleContainer: Laya.Sprite;
    private isRescued: boolean = false;
    private isPoolObject: boolean = false; // 标记是否为池对象
    private autoDestroyTimer: number = -1; // 自动销毁计时器ID

    constructor(isPoolObject: boolean = false) {
        super();
        this.isPoolObject = isPoolObject;
        this.init();
    }

    /**
     * 重置驾驶员状态，用于对象池复用
     */
    public reset(): void {
        // 重置基本属性
        this.isRescued = false;
        this.alpha = 1;
        this.visible = true;
        
        // 清除所有动画和计时器
        this.clearAnimations();
        
        // 重新初始化
        this.init();
    }

    /**
     * 清除所有动画和计时器
     */
    public clearAnimations(): void {
        // 清除所有动画
        Laya.Tween.clearAll(this);
        if (this.pilotImage) {
            Laya.Tween.clearAll(this.pilotImage);
        }
        
        // 清除粒子动画
        if (this.particleContainer) {
            for (let i = this.particleContainer.numChildren - 1; i >= 0; i--) {
                const child = this.particleContainer.getChildAt(i);
                Laya.Tween.clearAll(child);
            }
        }
        
        // 清除计时器
        if (this.autoDestroyTimer !== -1) {
            Laya.timer.clear(this, this.fadeOut);
            this.autoDestroyTimer = -1;
        }
    }

    private init(): void {
        // 清除现有内容
        this.removeChildren();
        
        // 随机选择驾驶员图片
        const randomIndex = Math.floor(Math.random() * Pilot.PILOT_IMAGES.length);
        this.pilotImage = new Laya.Image();
        this.pilotImage.skin = Pilot.PILOT_IMAGES[randomIndex];
        // 设置轴心点为图片中心
        this.pilotImage.pivot(this.pilotImage.width / 2, this.pilotImage.height / 2);
        this.pilotImage.pos(0, 0); // 放在坐标原点
        this.addChild(this.pilotImage);

        // 创建粒子效果容器
        this.particleContainer = new Laya.Sprite();
        this.particleContainer.pos(0, 0); // 与驾驶员图片中心对齐
        this.addChild(this.particleContainer);

        // 创建呼救动画
        this.createRescueAnimation();

        // 创建粒子效果
        this.createParticles();

        // 6秒后自动消失（无论是否为池对象）
        this.autoDestroyTimer = Laya.timer.once(6000, this, this.fadeOut) as unknown as number;
    }

    private createRescueAnimation(): void {
        // 为每个驾驶员添加随机性
        const jumpHeight = 8 + Math.random() * 4; // 随机跳跃高度 (8-12)
        const jumpUpDuration = 180 + Math.random() * 40; // 随机上升时间 (180-220ms)
        const jumpDownDuration = 180 + Math.random() * 40; // 随机下降时间 (180-220ms)
        
        // 添加随机初始延迟，使所有驾驶员不同步起跳
        const initialDelay = Math.random() * 400; // 0-400ms的随机延迟
        
        // 上下跳动动画
        const jumpAnimation = () => {
            Laya.Tween.to(this.pilotImage, {
                y: this.pilotImage.y - jumpHeight // 向上跳动，使用随机高度
            }, jumpUpDuration, Laya.Ease.sineOut, Laya.Handler.create(this, () => {
                Laya.Tween.to(this.pilotImage, {
                    y: this.pilotImage.y + jumpHeight // 回到原位，保持与上跳高度一致
                }, jumpDownDuration, Laya.Ease.sineIn, Laya.Handler.create(this, jumpAnimation));
            }));
        };
        
        // 使用随机延迟启动跳动动画
        if (initialDelay > 0) {
            Laya.timer.once(initialDelay, this, jumpAnimation);
        } else {
            jumpAnimation();
        }
        
        // 创建呼救文字气泡
        this.createHelpBubble();
    }

    private createHelpBubble(): void {
        // 创建文字气泡
        const helpBubble = new Laya.Text();
        helpBubble.text = "HELP!";
        helpBubble.fontSize = 16;
        helpBubble.color = "#FFFFFF";
        helpBubble.bgColor = "#FF0000";
        helpBubble.padding = [4, 8];
        helpBubble.pos(-20, -this.pilotImage.height - 20); // 放置在驾驶员头顶
        this.addChild(helpBubble);

        // 文字气泡闪烁动画
        const blinkAnimation = () => {
            Laya.Tween.to(helpBubble, {
                alpha: 0 // 淡出
            }, 500, Laya.Ease.sineInOut, Laya.Handler.create(this, () => {
                Laya.Tween.to(helpBubble, {
                    alpha: 1 // 淡入
                }, 500, Laya.Ease.sineInOut, Laya.Handler.create(this, blinkAnimation));
            }));
        };

        // 启动闪烁动画
        blinkAnimation();
    }

    private createParticles(): void {
        const particleCount = 8; // 粒子数量
        const radius = 20; // 粒子运动半径

        // 彩色粒子颜色
        const colors = [
            "#FF6B6B", // 红色
            "#4ECDC4", // 青色
            "#45B7D1", // 蓝色
            "#96CEB4", // 绿色
            "#FFEEAD", // 米色
            "#FFD93D", // 黄色
            "#FF9999", // 粉色
            "#6C88C4"  // 紫蓝色
        ];

        for (let i = 0; i < particleCount; i++) {
            const particle = new Laya.Sprite();
            const angle = (Math.PI * 2 / particleCount) * i;
            const color = colors[i % colors.length]; // 每个粒子使用不同颜色

            // 设置粒子初始位置
            particle.x = Math.cos(angle) * radius;
            particle.y = Math.sin(angle) * radius;

            // 绘制圆形粒子 - 使用填充
            particle.graphics.clear();
            particle.graphics.drawCircle(0, 0, 3, color);
            particle.alpha = 0.8;

            this.particleContainer.addChild(particle);

            // 创建粒子动画
            const animateParticle = () => {
                if (this.destroyed) return;

                // 粒子向外扩散
                const newRadius = radius + 10;
                const duration = 1500;

                Laya.Tween.to(particle, {
                    x: Math.cos(angle) * newRadius,
                    y: Math.sin(angle) * newRadius,
                    alpha: 0
                }, duration, Laya.Ease.sineInOut, Laya.Handler.create(this, () => {
                    if (!this.destroyed) {
                        // 重置粒子位置和属性
                        particle.x = Math.cos(angle) * radius;
                        particle.y = Math.sin(angle) * radius;
                        particle.alpha = 0.8;
                        // 继续动画
                        animateParticle();
                    }
                }));
            };

            animateParticle();
        }
    }

    private fadeOut(): void {
        if (!this.isRescued && !this.destroyed) {
            Laya.Tween.to(this, {
                alpha: 0
            }, 1000, Laya.Ease.sineOut, Laya.Handler.create(this, () => {
                if (this.isPoolObject) {
                    // 如果是池对象，通知对象池回收
                    PilotPool.instance.recyclePilot(this);
                } else {
                    // 非池对象直接销毁
                    this.destroy();
                }
            }));
        }
    }

    public rescue(): void {
        if (this.isRescued) return;

        this.isRescued = true;

        // 使用ScoreUtil创建救援特效和得分弹出动画
        if (this.parent && this.parent instanceof Laya.Sprite) {
            // 创建救援感谢效果
            ScoreUtil.getInstance().createThanksEffect(this.x, this.y, this.parent);
            
            // 创建得分弹出动画
            ScoreUtil.getInstance().createScorePopup(this.x, this.y, 1000, this.parent);
        }

        // 更新军衔 - 每救援一名驾驶员增加一名战士
        Achievement.instance.addRescuedSoldier();
        
        // 如果是池对象，通知对象池回收
        if (this.isPoolObject) {
            // 回收到对象池
            PilotPool.instance.recyclePilot(this);
        } else {
            // 非池对象直接销毁
            this.destroy();
        }
    }

    public destroy(): void {
        // 停止所有动画
        this.clearAnimations();
        
        // 清理粒子容器
        if (this.particleContainer) {
            for (let i = this.particleContainer.numChildren - 1; i >= 0; i--) {
                const child = this.particleContainer.getChildAt(i);
                if (child instanceof Laya.Sprite) {
                    child.graphics.clear();
                }
                child.destroy();
            }
            this.particleContainer.graphics.clear();
        }
        
        // 清理图像资源
        if (this.pilotImage) {
            this.pilotImage.destroy();
        }
        
        // 调用父类销毁方法
        super.destroy();
    }
}