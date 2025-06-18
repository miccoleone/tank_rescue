# 移速系统实现说明

## 系统概述

在无尽模式中，玩家坦克的移速会随着段位提升而增加，并通过渐隐提示"移速++"来通知玩家。

## 移速梯度设计

根据段位系统，移速梯度重新设计如下（基础3，最高5，前期提升缓慢）：

| 段位 | 等级范围 | 移速 | 提升幅度 | 累计提升 |
|------|----------|------|----------|----------|
| 青铜前期 | 1-2级 | 3.0 | 基础速度 | - |
| 青铜后期 | 3-4级 | 3.1 | +0.1 | +3.3% |
| 白银前期 | 5-6级 | 3.2 | +0.1 | +6.7% |
| 白银后期 | 7-8级 | 3.5 | +0.3 | +16.7% |
| 黄金 | 9-12级 | 4.0 | +0.5 | +33.3% |
| 钻石 | 13-16级 | 4.5 | +0.5 | +50% |
| 王者 | 17-20级 | 4.8 | +0.3 | +60% |
| 长城 | 21级+ | 5.0 | +0.2 | +66.7% |

## 技术实现

### 1. 核心变量
```typescript
private currentMoveSpeed: number = 3; // 当前移速
private lastMoveSpeedLevel: number = 0; // 上次移速等级，用于检测提升
```

### 2. 移速计算方法
```typescript
private calculateMoveSpeed(): number {
    const currentLevel = Math.floor(this.score / EndlessModeGame.POINTS_PER_RANK);
    
    if (currentLevel >= 21) return 5.0;      // 长城段位（最高）
    else if (currentLevel >= 17) return 4.8; // 王者段位
    else if (currentLevel >= 13) return 4.5; // 钻石段位
    else if (currentLevel >= 9) return 4.0;  // 黄金段位
    else if (currentLevel >= 7) return 3.5;  // 白银后期
    else if (currentLevel >= 5) return 3.2;  // 白银前期
    else if (currentLevel >= 3) return 3.1;  // 青铜后期
    else return 3.0;                         // 青铜前期（基础）
}
```

### 3. 移速提升检测
```typescript
private checkMoveSpeedUp(): void {
    const newMoveSpeed = this.calculateMoveSpeed();
    
    if (newMoveSpeed > this.currentMoveSpeed) {
        this.currentMoveSpeed = newMoveSpeed;
        // 显示提升提示
        this.popupPanel.showFadeNotification("移速++", 2000, "#00FF7F");
    }
}
```

### 4. 移速应用
在 `onJoystickMove` 方法中：
```typescript
// 使用动态移速计算
let speed = this.currentMoveSpeed * strength;
```

### 5. 状态重置
在 `resetGame` 方法中：
```typescript
// 重置移速相关
this.currentMoveSpeed = 3;
this.lastMoveSpeedLevel = 0;
```

## 用户体验设计

### 提示效果
- **颜色**：绿色 (#00FF7F)，表示正面提升
- **持续时间**：2秒，简洁不干扰游戏
- **动画**：渐入渐出，优雅的视觉反馈
- **时机**：在分数更新时自动检测，及时反馈

### 移速增长曲线
- **前期缓慢**：青铜阶段（1-4级），从3.0到3.1，增长极其缓慢
- **早期渐进**：白银阶段（5-8级），从3.2到3.5，开始有明显感受
- **中期发力**：黄金阶段（9-12级），提升到4.0，体验显著改善
- **后期稳步**：钻石到长城（13级+），从4.5到5.0，达到最佳操控

## 游戏平衡考虑

1. **基础移速3**：保证新手玩家有基本的操控体验
2. **最高移速5**：达到长城段位时的移速，提供明显但不过分的优势
3. **前期克制**：青铜阶段增长极慢，避免新手过快获得优势
4. **梯度合理**：从3到5的66.7%增长过程平滑，体验变化自然
5. **段位价值**：高移速对应高段位，但不会破坏游戏平衡

## 实现特点

- ✅ **自动检测**：分数更新时自动检查移速提升
- ✅ **即时反馈**：移速提升时立即显示"移速++"提示
- ✅ **状态保持**：游戏过程中移速状态持续有效
- ✅ **正确重置**：重新开始游戏时移速正确重置为基础值
- ✅ **视觉统一**：使用与其他提示一致的渐隐效果

这个移速系统增强了游戏的成长感和段位价值，让玩家在提升段位的过程中获得实实在在的操控体验提升！ 