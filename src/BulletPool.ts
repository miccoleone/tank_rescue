const { regClass } = Laya;

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

    public getItem(sign: string): Laya.Sprite {
        let pool = this.poolDic[sign];
        if (!pool) {
            pool = [];
            this.poolDic[sign] = pool;
        }
        
        let bullet: Laya.Sprite;
        if (pool.length > 0) {
            bullet = pool.pop();
        } else {
            bullet = this.createBullet();
        }
        
        // 确保子弹状态重置
        bullet.alpha = 0.8;
        bullet.rotation = 0;
        bullet.scale(1, 1);
        return bullet;
    }

    public recover(sign: string, item: Laya.Sprite): void {
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
        item.alpha = 0.9;
        
        // 添加到对象池
        let pool = this.poolDic[sign];
        if (!pool) {
            pool = [];
            this.poolDic[sign] = pool;
        }
        pool.push(item);
    }

    private createBullet(): Laya.Sprite {
        const bullet = new Laya.Sprite();
        const bulletImage = new Laya.Image();
        // bulletImage.skin = "resources/Retina/shotThin.png";
        bulletImage.skin = "resources/Retina/barrelBlack_side.png";
        // bulletImage.width = 16;
        // bulletImage.height = 40;
        // bulletImage.pivot(8, 20);
        bulletImage.rotation = 90;
        bulletImage.scale(0.7, 0.7);
        bulletImage.pivot(bulletImage.width / 2, bulletImage.height / 2);
        bullet.addChild(bulletImage);
        bullet.alpha = 0.5;
        return bullet;
    }
} 