const { regClass } = Laya;

export enum BoxType {
    Wood = 'wood',
    Metal = 'metal',
    Treasure = 'treasure'
}
// 箱子得分常量
export const BOX_SCORES = {
    WOOD: 100,    // 木箱得分
    METAL: 200,   // 铁箱得分
    TREASURE: 1000 // 宝箱得分
};

// 修改常量配置
let BOX_SIZE = 32; // 箱子大小 木箱32  宝箱32
const BOX_SIZE_METAL = 28; // 箱子大小 铁箱28
const PARTICLE_COUNT = 26; // 发光粒子数量
const PARTICLE_RADIUS = 1; // 粒子大小
const PARTICLE_COLORS = ["#FFD700", "#FFA500", "#FFFF00"]; // 粒子颜色

@regClass()
export class Box extends Laya.Sprite {
    private _type: BoxType;
    private _health: number;
    private _score: number;
    private glowEffect: Laya.Sprite | null = null;

    constructor(type: BoxType) {
        super();
        this._type = type;
        
        // 设置箱子属性
        switch(type) {
            case BoxType.Wood:
                this._health = 1;
                this._score = BOX_SCORES.WOOD;
                this.loadTexture("resources/woodBox.png",type);
                break;
            case BoxType.Metal:
                this._health = 2;
                this._score = BOX_SCORES.METAL;
                this.loadTexture("resources/metalBox.png",type);
                break;
            case BoxType.Treasure:
                this._health = 3;
                this._score = BOX_SCORES.TREASURE;
                this.loadTexture("resources/treasure.png",type);
                // this.createMoonIcon();
                this.createGlowEffect();
                break;
        }

        // 设置箱子大小
        this.width = BOX_SIZE;
        this.height = BOX_SIZE;
        this.pivot(BOX_SIZE/2, BOX_SIZE/2);
    }

    private loadTexture(path: string,type:BoxType): void {
        let image = new Laya.Image();
        image.skin = path;
        if(type == BoxType.Wood){
            BOX_SIZE = BOX_SIZE_METAL;
        }
        image.width = BOX_SIZE;
        image.height = BOX_SIZE;
        image.pivot(image.width /2, image.height /2);
        this.addChild(image);
    }

    private createGlowEffect(): void {
        this.glowEffect = new Laya.Sprite();
        this.addChildAt(this.glowEffect, 0);
        
        // 创建粒子
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const particle = new Laya.Sprite();
            const color = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
            particle.graphics.drawCircle(0, 0, PARTICLE_RADIUS, color);
            particle.alpha = 0.6;
            this.glowEffect.addChild(particle);
            
            // 设置初始位置
            const angle = (Math.PI * 2 / PARTICLE_COUNT) * i;
            const radius = BOX_SIZE/2 + 4;
            particle.pos(
                Math.cos(angle) * radius,
                Math.sin(angle) * radius
            );
            
            // 创建粒子动画
            this.animateParticle(particle, angle);
        }
    }

    private animateParticle(particle: Laya.Sprite, baseAngle: number): void {
        const duration = 2000;
        const radius = BOX_SIZE/2 + 4;
        
        const animate = () => {
            const time = Laya.timer.currTimer;
            const angle = baseAngle + (time / 1000);
            const wobble = Math.sin(time / 500) * 2;
            
            particle.x = Math.cos(angle) * (radius + wobble);
            particle.y = Math.sin(angle) * (radius + wobble);
            particle.alpha = 0.4 + Math.sin(time / 500) * 0.2;
        };
        
        Laya.timer.frameLoop(1, this, animate);
    }

    public hit(): number {
        this._health--;
        if (this._health <= 0) {
            if (this.glowEffect) {
                Laya.timer.clearAll(this);
            }
            this.destroy();
            return this._score;
        }
        return 0;
    }

    public get type(): BoxType {
        return this._type;
    }

    public get health(): number {
        return this._health;
    }

    public get score(): number {
        return this._score;
    }

    public destroy(): void {
        if (this.glowEffect) {
            Laya.timer.clearAll(this);
        }
        super.destroy();
    }
} 