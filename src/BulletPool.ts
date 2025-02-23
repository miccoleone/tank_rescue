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
        
        if (pool.length > 0) {
            return pool.pop();
        }
        
        return this.createBullet();
    }

    public recover(sign: string, item: Laya.Sprite): void {
        item.removeSelf();
        let pool = this.poolDic[sign];
        if (!pool) {
            pool = [];
            this.poolDic[sign] = pool;
        }
        pool.push(item);
    }

    private createBullet(): Laya.Sprite {
        let bullet = new Laya.Sprite();
        bullet.graphics.drawRect(-15, -15, 30, 30, "#ff0000");
        bullet.alpha = 0.7;
        return bullet;
    }
} 