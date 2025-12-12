const { regClass } = Laya;

// 定义子弹类型枚举
export enum BulletType {
    DEFAULT = "default",
    SUPER = "super"
}

// 全局变量控制当前子弹类型
let currentBulletType: BulletType = BulletType.DEFAULT;

// 设置当前子弹类型的方法
export function setCurrentBulletType(type: BulletType): void {
    currentBulletType = type;
}

// 获取当前子弹类型的方法
export function getCurrentBulletType(): BulletType {
    return currentBulletType;
}

@regClass()
export class BulletPool {
    private static _instance: BulletPool;
    private poolDic: { [key: string]: Array<Laya.Sprite> } = {};

    public static get instance(): BulletPool {
        if (!this._instance) {
            this._instance = new BulletPool();
        }
        return this._instance;
    }

    public getItem(): Laya.Sprite {
        // 根据当前子弹类型获取对应的sign
        const sign = currentBulletType === BulletType.SUPER ? "super_bullet" : "default_bullet";
        
        let pool = this.poolDic[sign];
        if (!pool) {
            pool = [];
            this.poolDic[sign] = pool;
        }
        
        let bullet: Laya.Sprite;
        if (pool.length > 0) {
            bullet = pool.pop();
        } else {
            // 根据sign创建不同类型的子弹
            if (sign === "super_bullet") {
                bullet = this.createSuperBullet();
            } else {
                bullet = this.createBullet();
            }
        }
        
        // 确保子弹状态重置
        bullet.alpha = sign === "super_bullet" ? 0.5 : 0.9;
        bullet.rotation = 0;
        bullet.scale(1, 1);
        return bullet;
    }

    public recover(item: Laya.Sprite): void {
        if (!item || item.destroyed) return;
        
        // 清理所有计时器和事件监听
        Laya.timer.clearAll(item);
        item.offAll();
        
        // 从父容器移除
        if (item.parent) {
            item.removeSelf();
        }
        
        // 重置状态
        item.rotation = 0;
        item.scale(1, 1);
        // 根据子弹类型设置不同的alpha值
        const child = item.getChildAt(0) as Laya.Image;
        const isSuperBullet = child?.skin?.includes("barrelBlack_side");
        item.alpha = isSuperBullet ? 0.5 : 0.9;
        
        // 根据子弹类型确定sign
        const sign = isSuperBullet ? "super_bullet" : "default_bullet";
        
        // 添加到对象池
        let pool = this.poolDic[sign];
        if (!pool) {
            pool = [];
            this.poolDic[sign] = pool;
        }
        pool.push(item);
    }

    private createSuperBullet(): Laya.Sprite {
        const bullet = new Laya.Sprite();
        const bulletImage = new Laya.Image();
        bulletImage.skin = "resources/Retina/barrelBlack_side.png";
        bulletImage.rotation = 90;
        bulletImage.scale(0.7, 0.7);
        bulletImage.pivot(bulletImage.width / 2, bulletImage.height / 2);
        bullet.addChild(bulletImage);
        bullet.alpha = 0.5;
        return bullet;
    }

    private createBullet(): Laya.Sprite {
        const bullet = new Laya.Sprite();
        const bulletImage = new Laya.Image();
        bulletImage.skin = "resources/Retina/shotThin.png";
        bulletImage.width = 8;
        bulletImage.height = 26;
        bulletImage.pivot(4, 13);
        bulletImage.rotation = 90;
        bullet.addChild(bulletImage);
        bullet.alpha = 0.9;
        return bullet;
    }
} 