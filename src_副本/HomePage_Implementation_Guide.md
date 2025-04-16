# LayaAir 游戏主页实现指南

## 1. 项目结构设置

### 1.1 创建必要的文件
1. 在 `src` 目录下创建以下文件：
   - `HomePage.ts` - 主页场景类
   - `SceneManager.ts` - 场景管理器
   - `ResourceManager.ts` - 资源管理器

### 1.2 资源准备
1. 在 `resources` 目录下放置所需资源：
   - 背景图片
   - 按钮图标
   - UI 元素
   - 音效文件

## 2. 场景管理器实现 (SceneManager.ts)

```typescript
export class SceneManager {
    private static _instance: SceneManager;
    private currentScene: Laya.Scene;

    private constructor() {
        console.log("SceneManager constructed");
    }

    public static get instance(): SceneManager {
        if (!this._instance) {
            this._instance = new SceneManager();
            console.log("SceneManager instance created");
        }
        return this._instance;
    }

    public async toHomePage(): Promise<void> {
        console.log("Switching to HomePage");
        await this.loadScene("HomePage");
    }

    public async toGamePage(): Promise<void> {
        console.log("Switching to GamePage");
        await this.loadScene("GamePage");
    }

    private async loadScene(sceneName: string): Promise<void> {
        console.log(`Loading scene: ${sceneName}`);
        // 销毁当前场景
        if (this.currentScene) {
            this.currentScene.destroy();
        }

        // 加载并创建新场景
        this.currentScene = new Laya.Scene();
        this.currentScene.name = sceneName;
        Laya.stage.addChild(this.currentScene);

        // 根据场景名称创建对应的场景脚本
        let sceneScript;
        if (sceneName === "HomePage") {
            const { HomePage } = await import("./HomePage");
            sceneScript = this.currentScene.addComponent(HomePage);
        } else if (sceneName === "GamePage") {
            const { GameMain } = await import("./GameMain");
            sceneScript = this.currentScene.addComponent(GameMain);
        }
    }
}
```

## 3. 资源管理器实现 (ResourceManager.ts)

```typescript
export class ResourceManager {
    private static _instance: ResourceManager;
    private loadedResources: Set<string> = new Set();

    private constructor() {}

    public static get instance(): ResourceManager {
        if (!this._instance) {
            this._instance = new ResourceManager();
        }
        return this._instance;
    }

    public async loadResources(resources: string[]): Promise<void> {
        const newResources = resources.filter(res => !this.loadedResources.has(res));
        
        if (newResources.length === 0) {
            return;
        }

        return new Promise((resolve) => {
            Laya.loader.load(newResources, Laya.Handler.create(this, () => {
                newResources.forEach(res => this.loadedResources.add(res));
                resolve();
            }));
        });
    }
}
```

## 4. 主页场景实现 (HomePage.ts)

```typescript
const { regClass, property } = Laya;
import { SceneManager } from "./SceneManager";
import { ResourceManager } from "./ResourceManager";

@regClass()
export class HomePage extends Laya.Script {
    private static readonly REQUIRED_RESOURCES = [
        "resources/background.jpg",
        "resources/rank_icon.png",
        "resources/stats_icon.png",
        "resources/click.mp3"
    ];

    onAwake(): void {
        // 设置屏幕适配
        Laya.stage.scaleMode = Laya.Stage.SCALE_FIXED_WIDTH;
        Laya.stage.alignH = Laya.Stage.ALIGN_CENTER;
        Laya.stage.alignV = Laya.Stage.ALIGN_MIDDLE;
        Laya.stage.screenMode = Laya.Stage.SCREEN_HORIZONTAL;

        // 初始化主页
        this.initHomePage();
    }

    private async initHomePage(): Promise<void> {
        // 加载必要资源
        await ResourceManager.instance.loadResources(HomePage.REQUIRED_RESOURCES);

        // 创建页面元素
        this.createBackground();
        this.createTopBar();
        this.createGameModes();
        this.createRightPanel();
    }

    private createBackground(): void {
        const bg = new Laya.Sprite();
        bg.name = "Background";
        bg.graphics.drawRect(0, 0, Laya.stage.width, Laya.stage.height, "#1a1a1a");
        this.owner.addChild(bg);
    }

    private createTopBar(): void {
        const topBar = new Laya.Sprite();
        topBar.name = "TopBar";
        
        // 创建头像容器
        const avatarContainer = new Laya.Sprite();
        avatarContainer.name = "AvatarContainer";
        avatarContainer.pos(40, 20);

        // 创建头像背景
        const avatarBg = new Laya.Sprite();
        avatarBg.name = "AvatarBackground";
        avatarBg.graphics.drawCircle(30, 30, 30, "#ffffff");
        avatarContainer.addChild(avatarBg);

        // 创建头像
        const avatar = new Laya.Sprite();
        avatar.name = "Avatar";
        avatar.graphics.drawCircle(30, 30, 28, "#666666");
        avatarContainer.addChild(avatar);

        // 创建玩家名称
        const playerName = new Laya.Text();
        playerName.name = "PlayerName";
        playerName.text = "玩家昵称";
        playerName.fontSize = 24;
        playerName.color = "#ffffff";
        playerName.pos(80, 28);
        avatarContainer.addChild(playerName);

        topBar.addChild(avatarContainer);
        this.owner.addChild(topBar);
    }

    private createGameModes(): void {
        const container = new Laya.Sprite();
        container.name = "GameModes";
        
        // 创建无尽模式按钮
        const endlessMode = this.createModeButton("无尽模式", "#4CAF50");
        endlessMode.name = "EndlessMode";
        endlessMode.pos(Laya.stage.width / 2, Laya.stage.height / 2);
        
        // 设置按钮点击事件
        endlessMode.on(Laya.Event.MOUSE_DOWN, this, () => {
            endlessMode.scale(0.95, 0.95);
            Laya.SoundManager.playSound("resources/click.mp3", 1);
        });
        
        endlessMode.on(Laya.Event.MOUSE_UP, this, () => {
            endlessMode.scale(1, 1);
            SceneManager.instance.toGamePage();
        });
        
        endlessMode.on(Laya.Event.MOUSE_OUT, this, () => {
            endlessMode.scale(1, 1);
        });

        container.addChild(endlessMode);
        this.owner.addChild(container);
    }

    private createModeButton(text: string, color: string): Laya.Sprite {
        const btn = new Laya.Sprite();
        btn.name = "Button";
        
        // 创建按钮背景
        const bg = new Laya.Sprite();
        bg.graphics.drawRoundRect(0, 0, 200, 60, 10, color);
        btn.addChild(bg);
        
        // 创建按钮文本
        const label = new Laya.Text();
        label.text = text;
        label.fontSize = 24;
        label.color = "#ffffff";
        label.width = 200;
        label.height = 60;
        label.align = "center";
        label.valign = "middle";
        btn.addChild(label);
        
        // 设置按钮属性
        btn.pivot(100, 30);
        btn.mouseEnabled = true;
        
        // 创建点击区域
        const hitArea = new Laya.HitArea();
        hitArea.hit.drawRect(0, 0, 200, 60, "#000000");
        btn.hitArea = hitArea;
        
        return btn;
    }

    private createRightPanel(): void {
        const panel = new Laya.Sprite();
        panel.name = "RightPanel";
        
        // 创建排行榜按钮
        const rankBtn = this.createIconButton("resources/rank_icon.png");
        rankBtn.name = "RankButton";
        rankBtn.pos(Laya.stage.width - 100, 20);
        panel.addChild(rankBtn);
        
        // 创建数据统计按钮
        const statsBtn = this.createIconButton("resources/stats_icon.png");
        statsBtn.name = "StatsButton";
        statsBtn.pos(Laya.stage.width - 100, 90);
        panel.addChild(statsBtn);
        
        this.owner.addChild(panel);
    }

    private createIconButton(iconPath: string): Laya.Sprite {
        const btn = new Laya.Sprite();
        
        // 创建图标
        const icon = new Laya.Image();
        icon.skin = iconPath;
        icon.width = 40;
        icon.height = 40;
        btn.addChild(icon);
        
        // 设置按钮属性
        btn.mouseEnabled = true;
        
        // 创建点击区域
        const hitArea = new Laya.HitArea();
        hitArea.hit.drawRect(0, 0, 40, 40, "#000000");
        btn.hitArea = hitArea;
        
        return btn;
    }
}
```

## 5. 入口文件修改 (GameConfig.ts)

```typescript
import { HomePage } from "./HomePage";
import { GameMain } from "./GameMain";
import { SceneManager } from "./SceneManager";

export default class GameConfig {
    static init() {
        // 注册场景类
        Laya.ClassUtils.regClass("HomePage", HomePage);
        Laya.ClassUtils.regClass("GameMain", GameMain);

        // 启动主页场景
        SceneManager.instance.toHomePage();
    }
}
```

## 6. 关键实现细节

### 6.1 场景管理
- 使用单例模式实现 `SceneManager`
- 实现场景异步加载和切换
- 确保场景切换时正确销毁旧场景

### 6.2 资源管理
- 使用单例模式实现 `ResourceManager`
- 实现资源缓存机制，避免重复加载
- 异步加载资源，确保资源加载完成后再创建场景

### 6.3 UI 设计
- 使用 Sprite 和 Text 组件创建 UI 元素
- 实现响应式布局，适应不同屏幕尺寸
- 添加交互反馈（点击效果、音效等）

### 6.4 事件处理
- 为按钮添加点击区域（HitArea）
- 实现按钮缩放动画
- 添加音效反馈

### 6.5 性能优化
- 使用对象池管理频繁创建/销毁的对象
- 合理使用事件监听和解绑
- 优化资源加载策略

## 7. 注意事项

1. 资源管理
   - 确保所有资源路径正确
   - 预加载必要资源
   - 及时释放不需要的资源

2. 场景切换
   - 确保场景切换时清理所有事件监听
   - 正确销毁场景对象
   - 处理场景切换过渡效果

3. UI 交互
   - 添加适当的交互反馈
   - 确保按钮点击区域合理
   - 处理边界情况

4. 性能考虑
   - 避免内存泄漏
   - 优化资源加载
   - 合理使用对象池

5. 代码组织
   - 遵循单一职责原则
   - 使用适当的设计模式
   - 保持代码可维护性

## 8. 调试与测试

1. 控制台日志
   - 添加关键节点的日志输出
   - 监控场景切换状态
   - 跟踪资源加载情况

2. 性能监控
   - 监控内存使用
   - 检查资源加载时间
   - 观察场景切换性能

3. 兼容性测试
   - 测试不同屏幕尺寸
   - 验证触摸/鼠标事件
   - 确保跨平台兼容性 