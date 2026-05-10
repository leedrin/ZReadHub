# 鱼市任务系统 - 开发速查表

## 关键状态标识速查

| 标识 | 含义 | 优先级 | 状态 |
|------|------|--------|------|
| <span style="color:red">**暂时不做**</span> | 当前版本不开发 | - | 灰色 |
| <span style="color:red">**Alpha1不做**</span> | Alpha1版本不做 | 低 | 灰色 |
| <span style="color:red">**本次修改**</span> | 本次修订修改 | 中 | 黄色 |
| <span style="color:red">**开发注意**</span> | 开发时需特别注意 | 高 | 红色 |

---

## 任务状态流转图

```
┌─────────────────────────────────────────────────────────────────┐
│                         任务状态流转                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐                                              │
│   │ 任务进行中   │◄────────────────────┐                        │
│   │ InProgress   │                     │                        │
│   └──────┬───────┘                     │ 倒计时结束              │
│          │                             │ 自动刷新                │
│          │ 达成条件                     │                        │
│          ▼                             │                        │
│   ┌──────────────┐                     │                        │
│   │完成待领取    │                     │                        │
│   │CompleteWait  │─────────────────────┘                        │
│   │   Claim      │                                              │
│   └──────┬───────┘                                              │
│          │                                                       │
│          │ 点击领取                                               │
│          │ 发放奖励                                               │
│          ▼                                                       │
│   ┌──────────────┐                                              │
│   │  已领取     │                                              │
│   │  Completed  │                                              │
│   └──────────────┘                                              │
│                                                                  │
│   ┌──────────────┐                                              │
│   │  待解锁     │                                              │
│   │   Locked    │                                              │
│   └──────────────┘                                              │
│   ⚠️ Alpha1不做                                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 任务状态说明
| 状态 | 显示文本 | 行为 |
|------|---------|------|
| InProgress | 任务进行中 | 可以正常完成 |
| CompleteWaitClaim | 任务完成待领取 | 点击领取奖励 |
| Claimed | 任务已领取 | 已完成状态 |
| Locked | 任务栏待解锁 | <span style="color:red">**Alpha1不做**</span> |

---

## 核心开发任务清单

### 🔴 P0 - 核心功能 (必须完成)

| 任务 | 描述 | 相关文档 | 涉及文件 |
|------|------|----------|----------|
| 任务数据接入 | 从逻辑层获取真实任务数据 | [[FishMarketPhase2_开发设计方案#3. 数据设计]] | QuestTofu |
| 任务显示流程 | 服务器数据获取→配置表查询→UI显示 | [[FishMarketPhase2_开发设计方案#6. 鱼市任务显示流程]] | QuestTofu, QuestUIController |
| 配置表查询 | 通过配置ID获取任务描述、鱼图标 | [[FishMarketPhase2_开发设计方案#6.3 配置表查询与信息获取]] | QuestTofu |
| 8任务栏位显示 | 8个任务栏的UI展示 | [[FishMarketPhase2_开发设计方案#6. UI设计]] | QuestUIController |
| 任务状态切换 | 进行中→待领取→已完成 | [[FishMarketPhase2_开发设计方案#4.1 任务状态流转]] | QuestTofu |
| 倒计时系统 | 倒计时显示+30分钟变红 | [[FishMarketPhase2_开发设计方案#5. 倒计时系统设计]] | QuestUIController |
| 奖励领取流程 | 点击领取→网络请求→发放奖励 | [[FishMarketPhase2_开发设计方案#4.2 奖励领取流程]] | MainTofu |

### 🟡 P1 - 体验优化 (建议完成)

| 任务 | 描述 | 相关文档 | 涉及文件 |
|------|------|----------|----------|
| 任务悬浮态 | 点击任务栏自动排序任务鱼 | [[FishMarketPhase2_开发设计方案#4.4 任务鱼排序]] | QuestTofu |
| 任务完成动效 | 进度达成时播放完成动画 | [[FishMarketPhase2_开发设计方案#7. PipelineUpdateMask设计]] | QuestUIController |
| 刷新动效 | 新任务刷新时的动效表现 | [[FishMarketPhase2_开发设计方案#4.5 任务刷新流程]] | QuestUIController |
| 任务鱼标记 | 鱼护中标记满足条件的鱼 | [[FishMarketPhase2_开发设计方案#9.1 任务鱼标记逻辑]] | KeeperTofu |

### 🟢 P2 - 边界处理 (需要处理)

| 任务 | 描述 | 相关文档 | 涉及文件 |
|------|------|----------|----------|
| 跨关卡检测 | 非当前关卡钓获不计入任务 | PRD 6 | KeeperTofu |
| 新鲜度0%处理 | 新鲜度为0可售卖但不计任务 | PRD 10 | KeeperTofu |
| 邮件补发奖励 | 未领取奖励通过邮件补发 | PRD 3 | QuestTofu |

---

## 关键规则速查

### 倒计时规则
| 规则 | 说明 |
|------|------|
| 显示格式 | 天/小时、小时/分、分/秒 |
| <span style="color:red">**变红条件**</span> | 最后30分钟变红 |
| 刷新时机 | 倒计时归0后自动刷新 |
| 整点对齐 | 与现实世界整点对齐 |
| <span style="color:red">**刷新机制**</span> | UI层监听 `EventOnFishMarketQuestRefreshNtf` 事件，服务器通知后触发管线刷新 |
| <span style="color:red">**不再使用**</span> | UITask.Tick每分钟主动刷新 |
| <span style="color:red">**显示更新**</span> | 从 `FishMarketQuestInfo.m_endTime` 计算，在 `UIController.Update` 中更新 |
| <span style="color:red">**时间获取**</span> | 使用 `GetCurrentGameTime()` 获取服务器时间 |

### 任务条件规则
| 规则 | 说明 |
|------|------|
| <span style="color:red">**条件类型**</span> | 巨物判定 OR 重量条件 (2选1) |
| 巨物判定 | 配置类型为"1条指定鱼的巨物" |
| 重量条件 | 配置具体的重量值，如"10条大于40kg的鲈鱼" |
| <span style="color:red">**显示逻辑**</span> | 显示"> X公斤"，逻辑是"≥ X公斤" |
| 无重量条件 | 重量为0或不填，不显示条件 |
| 图标选择 | 有重量→最小体型图标，无重量→成年体图标 |

### 排序规则
| 排序类型 | 优先级 | 说明 |
|----------|--------|------|
| 获得时间 | 默认 | 按捕获时间排序（降序） |
| 任务 | 特殊 | <span style="color:red">**任务鱼排到最前**</span>，其余按时间 |
| 其他 | - | 稀有度、重量、价格 |

### 任务悬浮态规则
| 场景 | 行为说明 |
|------|---------|
| **场景1：未进入多选态** | <span style="color:red">**自动进入多选**</span> → 自动选中任务鱼 → 任务鱼排到前列 → 切换任务排序 |
| **场景2：已进入多选态 + 有选中鱼** | 切换任务排序 → <span style="color:red">**取消非任务鱼选中**</span> → 选中对应任务鱼 |
| **场景3：已进入多选态 + 无命中任务鱼** | <span style="color:red">**不做任何操作**</span> |

### 任务鱼标记规则
| 状态 | 显示 | 交互 |
|------|------|------|
| 满足条件 | 限时热收(正常) | 可点击选中 |
| <span style="color:red">**新鲜度0%**</span> | 限时热收(置灰) | 点击弹出提示 |
| 任务完成 | 隐藏标记 | - |

---

## 网络协议速查

### 请求
```csharp
FishMarketQuestCompleteReq
{
    int FishingLevelConfId;  // 关卡ID
    int Index;               // 任务索引(0-7)
}
```

### 响应
```csharp
FishMarketQuestCompleteAck
{
    int Result;                    // 结果码 0=成功
    int FishingLevelConfId;        // 关卡ID
    int Index;                     // 任务索引
    ProCurrencyUpdateCtxInfo CurrencyUpdateCtxInfo;
}
```

### 通知
```csharp
FishMarketQuestRefreshNtf
{
    int FishingLevelConfId;        // 关卡ID
    int Index;                     // 任务索引
    ProFishMarketQuestInfo FishMarketQuestInfo;
}
```

---

## PipelineUpdateMask 速查

| Mask | 值 | 用途 |
|------|-----|------|
| RefreshKeepnetFishList | 1 << 0 | 刷新鱼护列表 |
| RefreshQuestList | 1 << 1 | 刷新任务列表 |
| RefreshQuestProgress | 1 << 2 | 仅刷新进度（任务进度或状态变化时使用） |
| RefreshMain | 1 << 3 | 刷新顶部货币 |
| PlayQuestCompleteAnim | 1 << 4 | 播放完成动画 |
| PlayQuestClaimAnim | 1 << 5 | 播放领取动画 |
| PlayConfirmSellUIProcess | 1 << 6 | 播放确认售卖UIProcess |
| PlayQuestRefreshAnim | 1 << 7 | 播放任务刷新动画 |
| SellFinish | 1 << 8 | 售卖完成 |
| RefreshAll | - | 刷新所有 |

> [!important] 注意事项
> - **倒计时显示**：不再使用 PipelineUpdateMask，在 `UIController.Update` 中直接更新
> - **RefreshQuestProgress**：暂保留，可能用于任务进度或状态变化的场景

---

## 常用链接

### 文档
- [[FishmarketUITask_PRD]] - 原始PRD文档
- [[FishmarketUITask_PRD_标注版]] - 标注版PRD
- [[FishmarketUITask_PRD_思维导图]] - 思维导图
- [[FishMarketPhase2_开发设计方案]] - 开发设计方案
- [[FishMarketUITask_设计文档]] - 一期设计文档

### 代码
- `GameProject/Scripts/Runtime/GameView/UI/FishMarketUITask/` - UI代码目录
- `PlayerGameObjectCompFishMarketQuestClient.cs` - 逻辑层接口
- `FishMarketQuestProtocol.cs` - 网络协议

---

*最后更新: 2026-02-03 (Q&A clarifications integrated)*
