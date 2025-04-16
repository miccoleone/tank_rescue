const { regClass } = Laya;
import { PilotPool } from "./PilotPool";
import { ScoreEffects } from "./ScoreEffects";

@regClass()
export class Pilot extends Laya.Sprite {
    // 日志级别控制
    private static readonly LOG_LEVEL = {
        NONE: 0,   // 不输出日志
        ERROR: 1,  // 只输出错误
        WARN: 2,   // 输出警告和错误
        INFO: 3,   // 输出普通信息、警告和错误
        DEBUG: 4,  // 输出所有日志，包括调试信息
    };
    
    // 当前日志级别 - 修改这个值可以控制日志输出
    private static readonly CURRENT_LOG_LEVEL = Pilot.LOG_LEVEL.ERROR;
    
    // 静态实例计数，用于标识每个驾驶员实例
    private static instanceCount: number = 0;
    private instanceId: number;

    private static readonly PILOT_IMAGES = [
        "resources/savemode/man1.png",
        "resources/savemode/man2.png",
        "resources/savemode/man3.png",
        "resources/savemode/man4.png",
        "resources/savemode/man5.png"
    ];

    private static readonly PILOT_LIFETIME = 7000; // 驾驶员存活时间7秒

    private pilotImage: Laya.Image;
    private particleContainer: Laya.Sprite;
    private isRescued: boolean = false;
    private isPoolObject: boolean = false; // 标记是否为池对象
    private hasAutoDestroyTimer: boolean = false; // 是否有自动销毁计时器
    private autoDestroyTimer: number | null = null;

    // 静态属性用于跟踪救援数量
    private static rescueCount: number = 0;
    
    // 获取已救援驾驶员数量
    public static getRescueCount(): number {
        return Pilot.rescueCount;
    }
    
    // 重置救援计数
    public static resetRescueCount(): void {
        Pilot.rescueCount = 0;
    }

    // 调试辅助方法
    private log(level: number, message: string): void {
        if (level <= Pilot.CURRENT_LOG_LEVEL) {
            const prefix = `[Pilot#${this.instanceId}] `;
            switch(level) {
                case Pilot.LOG_LEVEL.ERROR:
                    console.error(prefix + message);
                    break;
                case Pilot.LOG_LEVEL.WARN:
                    console.warn(prefix + message);
                    break;
                case Pilot.LOG_LEVEL.INFO:
                    console.log(prefix + message);
                    break;
                case Pilot.LOG_LEVEL.DEBUG:
                    console.log(prefix + "DEBUG: " + message);
                    break;
            }
        }
    }

    constructor(isPoolObject: boolean = false) {
        super();
        this.instanceId = ++Pilot.instanceCount;
        this.isPoolObject = isPoolObject;
        this.log(Pilot.LOG_LEVEL.INFO, `创建新驾驶员实例，ID=${this.instanceId}, isPoolObject=${isPoolObject}`);
        this.init();
    }

    /**
     * 重置驾驶员状态，用于对象池复用
     */
    public reset(): void {
        this.log(Pilot.LOG_LEVEL.INFO, "重置驾驶员状态");
        
        // 重置基本属性
        this.isRescued = false;
        this.alpha = 1;
        this.visible = true;
        this.rotation = 0;
        
        // 清除所有动画和计时器
        this.clearAnimations();
        
        // 重新初始化基本属性，包括设置新的自动销毁计时器
        this.initBasic();
    }

    /**
     * 初始化基本属性，但不创建动画
     * 这样可以先添加到父容器再创建动画
     */
    private initBasic(): void {
        this.log(Pilot.LOG_LEVEL.INFO, "初始化驾驶员基本属性");
        
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
        this.particleContainer.name = "ParticleContainer";
        this.particleContainer.pos(0, 0); // 与驾驶员图片中心对齐
        this.addChild(this.particleContainer);

        // 设置自动销毁定时器
        const timerCallback = () => {
            PilotPool.instance.recyclePilot(this);
        };
        // 存储返回的timerid
        this.autoDestroyTimer = Laya.timer.once(Pilot.PILOT_LIFETIME, this, timerCallback) as unknown as number;
        
        this.log(Pilot.LOG_LEVEL.INFO, "驾驶员基本属性初始化完成");
    }

    /**
     * 初始化动画效果
     * 这个方法应该在驾驶员被添加到场景后调用
     */
    public initAnimations(): void {
        this.log(Pilot.LOG_LEVEL.INFO, `开始初始化动画，当前位置:(${this.x}, ${this.y})`);
        
        if (!this.parent) {
            this.log(Pilot.LOG_LEVEL.ERROR, "驾驶员没有父节点，无法创建动画");
            return;
        }
        
        // 立即记录关键的坐标信息
        console.warn(`[位置调试] Pilot#${this.instanceId} 初始化动画前 position=(${this.x}, ${this.y}), global=(${this.globalToLocal(new Laya.Point(0,0)).x}, ${this.globalToLocal(new Laya.Point(0,0)).y})`);
        
        // 确保位置正确后再创建动画
        Laya.timer.frameOnce(1, this, () => {
            // 记录延迟一帧后的位置信息
            console.warn(`[位置调试] Pilot#${this.instanceId} 延迟一帧后 position=(${this.x}, ${this.y}), global=(${this.globalToLocal(new Laya.Point(0,0)).x}, ${this.globalToLocal(new Laya.Point(0,0)).y})`);
            
            // 创建呼救动画
            this.createRescueAnimation();
    
            // 创建粒子效果
            this.createParticles();
            
            // 7秒后自动消失（无论是否为池对象）
            this.hasAutoDestroyTimer = true;
        });
        
        this.log(Pilot.LOG_LEVEL.INFO, "动画初始化安排完成");
    }

    private init(): void {
        this.log(Pilot.LOG_LEVEL.INFO, "初始化驾驶员");
        
        // 初始化基本属性
        this.initBasic();
        
        // 如果有父节点，立即初始化动画
        if (this.parent) {
            this.initAnimations();
        } else {
            this.log(Pilot.LOG_LEVEL.INFO, "驾驶员暂无父节点，将在添加到场景后创建动画");
        }
        
        this.log(Pilot.LOG_LEVEL.INFO, "驾驶员初始化完成");
    }

    /**
     * 清理所有动画，在对象被回收或销毁前调用
     */
    public clearAnimations(): void {
        this.log(Pilot.LOG_LEVEL.INFO, "清理所有动画和计时器");
        
        // 停止所有与此对象相关的动画
        Laya.Tween.clearAll(this);
        if (this.pilotImage && !this.pilotImage.destroyed) {
            Laya.Tween.clearAll(this.pilotImage);
        }
        
        // 清除所有子节点上的动画
        for (let i = 0; i < this.numChildren; i++) {
            const child = this.getChildAt(i);
            if (child && !child.destroyed) {
                Laya.Tween.clearAll(child);
            }
        }

        // 清除自动销毁计时器
        if (this.autoDestroyTimer !== null) {
            Laya.timer.clear(this, this.fadeOut);
            Laya.timer.clear(this, this.rescue);
            // 清除所有绑定到this的定时器
            Laya.timer.clearAll(this);
            this.autoDestroyTimer = null;
        }
    }

    private createRescueAnimation(): void {
        this.log(Pilot.LOG_LEVEL.INFO, "创建救援动画 ======开始======");
        
        // 跳过已销毁或父节点已销毁的驾驶员
        if (this.destroyed || !this.parent) {
            this.log(Pilot.LOG_LEVEL.WARN, "驾驶员已销毁或无父节点，跳过动画创建");
            return;
        }
        
        // 初始位置设置
        this.pilotImage.y = 0;
        this.log(Pilot.LOG_LEVEL.DEBUG, `设置初始位置 y=${this.pilotImage.y}`);
        
        // 上下跳动动画 - 使用坦克大救援中的简单跳动效果
        const jumpAnimation = () => {
            // 跳过已销毁或父节点已销毁的驾驶员
            if (this.destroyed || !this.parent) {
                this.log(Pilot.LOG_LEVEL.WARN, "驾驶员已销毁或无父节点，停止跳动动画");
                return;
            }
            
            try {
                // 向上跳动
                Laya.Tween.to(this.pilotImage, {
                    y: -10 // 向上跳动10像素
                }, 200, Laya.Ease.sineOut, Laya.Handler.create(this, () => {
                    // 跳过已销毁的驾驶员
                    if (this.destroyed || !this.parent) {
                        this.log(Pilot.LOG_LEVEL.WARN, "回落检测到驾驶员已销毁，停止动画");
                        return;
                    }
                    
                    // 回到原位
                    Laya.Tween.to(this.pilotImage, {
                        y: 0 // 回到原位
                    }, 200, Laya.Ease.sineIn, Laya.Handler.create(this, jumpAnimation));
                }));
            } catch (e) {
                this.log(Pilot.LOG_LEVEL.ERROR, "创建跳动动画失败:" + e);
            }
        };
        
        // 启动跳动动画
        jumpAnimation();
        
        // 启动摇晃动画
        this.createSwayAnimation();
    }
    
    // 分离摇晃动画到单独的方法
    private createSwayAnimation(): void {
        // 额外添加整体轻微的摇晃效果
        const swayAnimation = () => {
            if (this.destroyed || !this.parent) {
                this.log(Pilot.LOG_LEVEL.WARN, "驾驶员已销毁，停止摇晃动画");
                return;
            }
            
            try {
                Laya.Tween.to(this, { 
                    rotation: 3
                }, 1000, Laya.Ease.sineInOut, Laya.Handler.create(this, () => {
                    if (this.destroyed || !this.parent) {
                        this.log(Pilot.LOG_LEVEL.WARN, "检测到驾驶员已销毁，停止动画");
                        return;
                    }
                    
                    Laya.Tween.to(this, {
                        rotation: -3
                    }, 1000, Laya.Ease.sineInOut, Laya.Handler.create(this, swayAnimation));
                }));
            } catch (e) {
                this.log(Pilot.LOG_LEVEL.ERROR, "创建摇晃动画失败:" + e);
            }
        };
        
        swayAnimation();
    }

    private createParticles(): void {
        this.log(Pilot.LOG_LEVEL.INFO, "创建粒子效果 ======开始======");
        
        // 跳过已销毁的驾驶员
        if (this.destroyed || !this.parent) {
            this.log(Pilot.LOG_LEVEL.WARN, "驾驶员已销毁或无父节点，跳过粒子创建");
            return;
        }
        
        // 记录关键的坐标信息，用于调试第一个驾驶员的问题
        console.warn(`[粒子调试] Pilot#${this.instanceId} 创建粒子前 position=(${this.x}, ${this.y})`);
        
        // ===== 关键修改：完全不使用粒子容器，直接将粒子添加到驾驶员中 =====
        
        // 先移除之前的粒子容器和所有粒子
        if (this.particleContainer) {
            this.particleContainer.removeSelf();
            this.particleContainer.destroy();
            this.particleContainer = null;
        }
        
        // 删除所有名称以"Particle_"开头的子节点
        for (let i = this.numChildren - 1; i >= 0; i--) {
            const child = this.getChildAt(i);
            if (child.name && child.name.startsWith("Particle_")) {
                child.removeSelf();
                child.destroy();
            }
        }
        
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
        
        // 为每个驾驶员的第一个粒子打印调试信息
        const firstParticleDebug = true; // 开启首个粒子的调试输出
        
        this.log(Pilot.LOG_LEVEL.INFO, `创建 ${particleCount} 个粒子，半径 ${radius}`);

        // 创建新粒子 - 直接添加到驾驶员，而非容器
        for (let i = 0; i < particleCount; i++) {
            const particle = new Laya.Sprite();
            particle.name = `Particle_${i}`;
            const angle = (Math.PI * 2 / particleCount) * i;
            const color = colors[i % colors.length]; // 每个粒子使用不同颜色

            // 绘制圆形粒子
            try {
                particle.graphics.clear();
                particle.graphics.drawCircle(0, 0, 3, color);
                particle.alpha = 1;
            } catch (e) {
                this.log(Pilot.LOG_LEVEL.ERROR, `粒子 #${i} 绘制失败: ${e}`);
                continue; // 跳过失败的粒子
            }
            
            // 重要：设置粒子位置 - 直接添加到驾驶员，而非容器
            particle.x = Math.cos(angle) * radius;
            particle.y = Math.sin(angle) * radius;
            this.addChild(particle);
            
            // 为第一个粒子特别记录坐标
            if (i === 0 && firstParticleDebug) {
                console.warn(`[粒子调试] Pilot#${this.instanceId} 第一个粒子添加到驾驶员后位置=(${particle.x.toFixed(1)}, ${particle.y.toFixed(1)})`);
            }

            // 创建粒子动画 - 直接动画，不用闭包
            this.animateDirectParticle(particle, angle, radius, i === 0 && firstParticleDebug);
        }
        
        this.log(Pilot.LOG_LEVEL.INFO, "创建粒子效果 ======结束======");
    }
    
    /**
     * 为直接附加到驾驶员的粒子创建动画
     */
    private animateDirectParticle(particle: Laya.Sprite, angle: number, baseRadius: number, debug: boolean = false): void {
        const newRadius = baseRadius + 10;
        const duration = 1500;
        
        // 设置起始位置（以防万一）
        particle.x = Math.cos(angle) * baseRadius;
        particle.y = Math.sin(angle) * baseRadius;
        
        // 动画函数 - 直接定义，不用闭包
        const doAnimation = () => {
            if (this.destroyed || particle.destroyed) return;
            
            // 向外扩散动画
            Laya.Tween.to(particle, {
                x: Math.cos(angle) * newRadius,
                y: Math.sin(angle) * newRadius,
                alpha: 0
            }, duration, Laya.Ease.sineInOut, Laya.Handler.create(this, () => {
                if (this.destroyed || particle.destroyed) return;
                
                // 重置位置和透明度
                particle.x = Math.cos(angle) * baseRadius;
                particle.y = Math.sin(angle) * baseRadius;
                particle.alpha = 1;
                
                // 延迟一帧继续动画，避免连续执行
                Laya.timer.frameOnce(1, this, doAnimation);
            }));
        };
        
        // 延迟3帧确保一切都准备好了
        Laya.timer.frameOnce(3, this, doAnimation);
    }
    
    /**
     * 这个方法保留但不再使用，被animateDirectParticle替代
     */
    private createParticleAnimation(particle: Laya.Sprite, angle: number, baseRadius: number, debug: boolean = false): void {
        this.animateDirectParticle(particle, angle, baseRadius, debug);
    }
    
    /**
     * 这个方法保留但不再使用
     */
    private animateParticle(particle: Laya.Sprite, angle: number, baseRadius: number): void {
        this.animateDirectParticle(particle, angle, baseRadius);
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
        if (this.isRescued) return; // 防止重复救援
        
        this.isRescued = true;
        
        // 创建救援效果
        this.createRescueEffect();
        
        // 创建分数弹出效果
        this.createScorePopup();
        
        // 播放救援音效
        Laya.SoundManager.playSound("resources/score.mp3", 1);
        
        // 发送救援事件，用于更新UI显示
        Laya.stage.event("PILOT_RESCUED", [this]);
        
        // 立即回收
        PilotPool.instance.recyclePilot(this);
    }

    private createRescueEffect(): void {
        // 创建一个向上飘的"已救援"文本
        const rescueText = new Laya.Text();
        rescueText.text = "THANKS!";
        rescueText.fontSize = 20;
        rescueText.color = "#4CAF50";
        rescueText.width = 60;
        rescueText.align = "center";
        rescueText.pos(-30, -20);

        // 将文本添加到父容器而不是驾驶员本身，这样驾驶员销毁后文本动画仍能继续
        if (this.parent) {
            this.parent.addChild(rescueText);
            rescueText.pos(this.x - 30, this.y - 20);

            // 向上飘并淡出的动画
            Laya.Tween.to(rescueText, {
                y: rescueText.y - 30,
                alpha: 0
            }, 1500, Laya.Ease.quadOut, Laya.Handler.create(this, () => {
                rescueText.destroy();
            }));
        }
    }

    private createScorePopup(): void {
        // 使用共享的金币特效工具类
        if (this.parent) {
            ScoreEffects.createGoldScorePopup(this.x, this.y - 30, 1000, this.parent as Laya.Sprite);
        }
    }

    /**
     * 销毁驾驶员对象，清理所有动画和资源
     */
    public destroy(): void {
        this.log(Pilot.LOG_LEVEL.INFO, "销毁驾驶员对象");
        
        // 清除所有动画
        this.clearAnimations();
        
        // 清理粒子容器
        if (this.particleContainer) {
            for (let i = this.particleContainer.numChildren - 1; i >= 0; i--) {
                const child = this.particleContainer.getChildAt(i);
                if (child instanceof Laya.Sprite) {
                    child.graphics.clear();
                    child.destroy();
                }
            }
            this.particleContainer.graphics.clear();
            this.particleContainer = null;
        }
        
        // 清理图像资源
        if (this.pilotImage) {
            this.pilotImage.destroy();
            this.pilotImage = null;
        }
        
        // 调用父类销毁方法
        super.destroy();
    }
}