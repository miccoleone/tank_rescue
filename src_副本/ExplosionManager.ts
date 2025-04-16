const { regClass } = Laya;

@regClass()
export class ExplosionManager {
    private static _instance: ExplosionManager;
    private static readonly FRAME_WIDTH = 64;   // 每帧宽度 (320/5 = 64)
    private static readonly FRAME_HEIGHT = 64;  // 每帧高度 (320/5 = 64)
    private static readonly FRAME_RATE = 24;    // 帧率
    private static readonly FRAME_COUNT = 23;   // 总帧数
    private static readonly COLS = 5;           // 每行帧数
    private static readonly ROWS = 5;           // 每列帧数
    private isResourceLoaded: boolean = false;
    private isSoundLoaded: boolean = false;
    private texture: Laya.Texture;
    private frames: Laya.Texture[] = [];
    private explosionSound: string = "resources/explosion.mp3";

    private constructor() {
        // 预加载爆炸动画资源
        const explosionUrl = "resources/explosion.png";
        console.log("ExplosionManager: 开始加载爆炸动画资源");
        Laya.loader.load(explosionUrl, Laya.Handler.create(this, this.onResourceLoaded));
        
        // 预加载爆炸音效
        console.log("ExplosionManager: 开始加载爆炸音效");
        Laya.SoundManager.setMusicVolume(1);
        Laya.SoundManager.setSoundVolume(1);
        Laya.loader.load(this.explosionSound, Laya.Handler.create(this, this.onSoundLoaded));
    }

    public static get instance(): ExplosionManager {
        if (!this._instance) {
            this._instance = new ExplosionManager();
        }
        return this._instance;
    }

    private onSoundLoaded(): void {
        this.isSoundLoaded = true;
        console.log("ExplosionManager: 爆炸音效加载完成");
    }

    private onResourceLoaded(): void {
        try {
            // 获取纹理
            this.texture = Laya.loader.getRes("resources/explosion.png");
            if (!this.texture) {
                console.error("ExplosionManager: 无法加载爆炸动画资源");
                return;
            }

            console.log("ExplosionManager: 纹理加载成功，尺寸:", this.texture.width, "x", this.texture.height);

            // 预先切割所有帧
            this.frames = [];
            for (let i = 0; i < ExplosionManager.FRAME_COUNT; i++) {
                const row = Math.floor(i / ExplosionManager.COLS);
                const col = i % ExplosionManager.COLS;
                
                // 从原始纹理中切割出这一帧
                const frameTexture = Laya.Texture.createFromTexture(
                    this.texture,
                    col * ExplosionManager.FRAME_WIDTH,
                    row * ExplosionManager.FRAME_HEIGHT,
                    ExplosionManager.FRAME_WIDTH,
                    ExplosionManager.FRAME_HEIGHT
                );
                
                if (frameTexture) {
                    this.frames.push(frameTexture);
                }
            }

            this.isResourceLoaded = true;
            console.log("ExplosionManager: 爆炸动画资源加载完成，共加载", this.frames.length, "帧");
        } catch (error) {
            console.error("ExplosionManager: 资源加载失败:", error);
        }
    }

    public playExplosion(x: number, y: number, parent: Laya.Sprite, isEnemy: boolean = false): void {
        if (!this.isResourceLoaded || this.frames.length === 0) {
            console.warn("ExplosionManager: 爆炸动画资源尚未加载完成");
            return;
        }
        
        // 如果父容器已经被销毁，不执行爆炸效果
        if (!parent || parent.destroyed) {
            console.warn("ExplosionManager: 父容器已销毁，无法播放爆炸效果");
            return;
        }

        try {
            // 播放爆炸音效
            if (this.isSoundLoaded) {
                Laya.SoundManager.playSound(this.explosionSound, 1);
            }
            
            // 创建动画容器
            const container = new Laya.Sprite();
            container.name = "ExplosionEffect";
            container.pos(x, y);
            container.zOrder = 100;
            parent.addChild(container);

            // 创建动画显示对象
            const animation = new Laya.Sprite();
            animation.pivot(ExplosionManager.FRAME_WIDTH / 2, ExplosionManager.FRAME_HEIGHT / 2);
            animation.scale(1.5, 1.5);
            container.addChild(animation);

            // 当前帧索引
            let currentFrame = 0;
            let frameDelay = Math.floor(60 / ExplosionManager.FRAME_RATE); // 计算帧延迟
            let frameCount = 0;
            
            // 创建帧循环
            const frameLoop = () => {
                // 如果容器或父容器被销毁，立即清理资源并返回
                if (container.destroyed || !parent || parent.destroyed) {
                    Laya.timer.clear(this, frameLoop);
                    return;
                }
                
                frameCount++;
                if (frameCount < frameDelay) return;
                frameCount = 0;

                if (currentFrame >= this.frames.length) {
                    // 动画完成，清理资源
                    Laya.timer.clear(this, frameLoop);
                    
                    // 确保清理所有子对象
                    animation.graphics.clear();
                    animation.removeSelf();
                    animation.destroy();
                    
                    container.removeSelf();
                    container.destroy();
                    return;
                }

                // 清除之前的绘制
                animation.graphics.clear();

                // 绘制当前帧
                animation.graphics.drawTexture(this.frames[currentFrame], 0, 0);

                currentFrame++;
            };

            // 启动帧循环
            Laya.timer.frameLoop(1, this, frameLoop);
        } catch (error) {
            console.error("ExplosionManager: 播放动画失败:", error);
        }
    }
}