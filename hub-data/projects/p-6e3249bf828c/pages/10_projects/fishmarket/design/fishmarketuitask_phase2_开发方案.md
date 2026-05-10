# 鱼市二期开发设计方案文档

**文档版本**: v1.0  
**创建日期**: 2026-02-03  
**编写人**: AI Assistant  
**审核人**:  
**状态**: 初稿  

---

## 1. 文档概述

### 1.1 背景
鱼市功能已完成一期开发，主要实现了鱼护展示、基础售卖流程和UI框架。二期需要完成**鱼市任务功能**，包括任务显示、进度跟踪、奖励领取等核心玩法。

### 1.2 参考文档
- **PRD文档**: `Doc/10_Projects/PRD/FishmarketUITask_PRD.md`
- **一期设计文档**: `Doc/10_Projects/Design/FishMarketUITask_设计文档.md`
- **一期代码目录**: `GameProject/Scripts/Runtime/GameView/UI/FishmarketUITask`

### 1.3 术语定义
| 术语 | 说明 |
|------|------|
| 鱼市任务 | 限时热收任务，玩家需要在规定时间内售卖指定数量/重量的鱼 |
| 任务栏 | 显示任务的UI区域，共8个栏位 |
| 任务状态 | 进行中(InProgress) / 待领取(Claimable) / 已完成(Completed) / 待解锁(Locked) |
| 新鲜度 | 鱼的新鲜程度，0%时无法完成任务但可售卖 |

---

## 2. 一期现状评估

### 2.1 已完成内容 
1. **UI框架**: FishMarketUITask + 4个Tofu组件(Main/Keeper/Quest/SellConfirm)
2. **鱼护展示**: KeeperTofu实现鱼列表、排序、多选功能
3. **售卖流程**: 多选 → 确认界面 → 动画表现
4. **基础数据结构**: FishMarketFishItemInfo, FishMarketQuestData
5. **逻辑层接口**: IPlayerGameObjectFishMarketQuestClient 已定义

### 2.2 待完成内容 
1. **任务数据接入**: QuestTofu目前使用Mock数据，需接入真实服务器数据
2. **任务进度同步**: 售卖鱼后需更新任务进度
3. **奖励领取**: 完成任务后的领取流程
4. **倒计时功能**: 任务剩余时间显示和刷新
5. **网络请求**: FishMarketQuestCompleteReq 等协议对接
6. **任务匹配逻辑**: 判断鱼是否满足任务条件

---

## 3. 二期开发内容

### 3.1 功能清单

#### P0 - 核心功能 (必须完成)
| 序号 | 功能 | 说明 | 涉及文件 |
|------|------|------|----------|
| 1 | 任务数据接入 | 从服务器获取真实任务数据 | QuestTofu |
| 2 | 任务列表显示 | 8个任务栏位，显示进度/倒计时 | QuestUIController |
| 3 | 任务进度更新 | 售卖鱼后更新任务进度 | MainTofu → QuestTofu |
| 4 | 奖励领取 | 点击领取按钮，发送网络请求 | QuestTofu |
| 5 | 倒计时显示 | 剩余时间显示，最后30分钟变红 | QuestUIController |

#### P1 - 体验优化 (建议完成)
| 序号 | 功能 | 说明 | 涉及文件 |
|------|------|------|----------|
| 6 | 任务悬浮态 | 点击任务栏自动排序任务鱼 | QuestTofu → KeeperTofu |
| 7 | 任务完成动效 | 进度达成时播放完成动画 | QuestUIController |
| 8 | 刷新表现 | 倒计时结束后新任务刷新动效 | QuestUIController |
| 9 | 任务鱼标记 | 鱼护中标记满足任务条件的鱼 | KeeperTofu |

#### P2 - 边界处理 (需要处理)
| 序号 | 功能 | 说明 | 涉及文件 |
|------|------|------|----------|
| 10 | 跨关卡售卖 | 非当前关卡钓的鱼无法完成任务 | KeeperTofu |
| 11 | 新鲜度为0 | 新鲜度0%的鱼无法完成任务 | KeeperTofu |
| 12 | 任务过期 | 未领取奖励时任务刷新，奖励邮件发送 | QuestTofu |

---

## 4. 技术方案

### 4.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                     FishMarketUITask                         │
├─────────────┬─────────────┬─────────────┬───────────────────┤
│  MainTofu   │ KeeperTofu  │  QuestTofu  │ SellConfirmTofu   │
├─────────────┴─────────────┴─────────────┴───────────────────┤
│                 IPlayerGameObjectFishMarketQuestClient      │
├─────────────────────────────────────────────────────────────┤
│              PlayerGameObjectCompFishMarketQuestClient      │
├─────────────────────────────────────────────────────────────┤
│                    网络层 (NetTask)                          │
│     FishMarketQuestCompleteReq / FishMarketQuestRefreshNtf  │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Tofu职责划分

#### MainTofu - 业务协调中心
- **职责**: 跨Tofu协调、网络请求发起、状态管理
- **关键功能**:
  - 接收KeeperTofu的售卖事件，通知QuestTofu更新进度
  - 接收QuestTofu的领取请求，发起网络请求
  - 管理管线Mask，驱动UI刷新

#### KeeperTofu - 鱼护管理 (一期已完成，需扩展)
- **新增职责**:
  - 标记任务鱼 (`m_isTaskFish`)
  - 判断鱼是否满足任务条件 (重量/关卡)
  - 售卖时通知QuestTofu有哪些任务鱼被卖出

#### QuestTofu - 任务管理 (二期主要开发对象)
- **职责**: 任务数据管理、倒计时、进度跟踪
- **关键功能**:
  - 从逻辑层获取任务数据 (`FishMarketQuestGetAll`)
  - 管理任务状态转换
  - 倒计时管理
  - 奖励领取流程

#### SellConfirmTofu - 售卖确认 (一期已完成)
- **状态**: 无需修改

---

## 5. 数据结构设计

### 5.1 现有数据结构 (无需修改)

```csharp
// FishMarketQuestData - UI层任务数据结构
public class FishMarketQuestData
{
    public int m_questId;              // 任务ID
    public QuestState m_state;         // 任务状态
    public int m_taskConfigId;         // 配置ID
    public int m_requiredFishId;       // 所需鱼ID
    public string m_requiredFishName;  // 鱼名称
    public int m_requiredCount;        // 目标数量
    public int m_minWeightRequired;    // 最小重量要求(g)
    public int m_currentProgress;      // 当前进度
    public float m_remainingSeconds;   // 剩余时间(秒)
    public int m_rewardSilverCoin;     // 奖励银币
}

// QuestState - 任务状态枚举
public enum QuestState
{
    Locked,       // 待解锁 (Alpha1不做)
    InProgress,   // 进行中
    Claimable,    // 待领取
    Completed     // 已完成
}
```

### 5.2 逻辑层数据结构 (已有)

```csharp
// FishMarketQuestInfo - DC层数据结构
public struct FishMarketQuestInfo
{
    public int m_confId;           // 任务配置Id
    public int m_completedCount;   // 已完成数量
    public bool m_isCompleted;     // 是否完成确认
    public DateTime m_endTime;     // 任务结束时间
}

// IFishMarketQuestInfoProvider - 数据提供接口
public interface IFishMarketQuestInfoProvider
{
    ConfigDataFishMarketQuestInfo ConfGet();
    int CompletedCountGet();
    bool IsReachCondition();
    bool IsCompleted();
    TimeSpan LeftTimeGet();
}
```

---

## 6. 业务流程设计

### 6.1 任务进度更新流程

```
玩家售卖鱼
    │
    ▼
KeeperTofu.SellSelectedFish()
    │
    ▼
EventOnSellFishRequest ──────► MainTofu.OnKeeperTofuSellFishRequest()
    │                              │
    │                              ▼
    │                         调用卖鱼网络请求
    │                              │
    │                              ▼
    │                         网络成功
    │                              │
    ▼                              ▼
EventOnQuestFishSold ◄────── MainTofu
    │
    ▼
QuestTofu.OnQuestFishSold()
    │
    ├────► 检查卖出的鱼是否匹配任务
    │
    ├────► 更新任务进度 m_currentProgress
    │
    ├────► 检查是否达到目标 (m_currentProgress >= m_requiredCount)
    │          │
    │          ▼
    │     是：设置状态为 Claimable
    │          │
    │          ▼
    │     启动管线刷新 (RefreshQuestList)
    │
    ▼
QuestUIController.RefreshQuestList()
    │
    ▼
UI更新显示：进度条满，显示"领取"按钮
```

### 6.2 奖励领取流程

```
玩家点击领取按钮
    │
    ▼
QuestUIController.EventOnClaimClick
    │
    ▼
QuestTofu.OnClaimClick(questId)
    │
    ├────► 前置检查：状态是否为 Claimable
    │
    ▼
发送网络请求：FishMarketQuestCompleteReq
    │
    ├────► fishingLevelConfId (当前关卡ID)
    ├────► index (任务索引)
    │
    ▼
等待服务器响应：FishMarketQuestCompleteAck
    │
    ├────► Result (0=成功)
    ├────► CurrencyUpdateCtxInfo (货币更新信息)
    │
    ▼
QuestTofu.FishMarketQuestComplete()
    │
    ├────► 更新任务状态：Claimable → Completed
    ├────► 更新DC数据
    │
    ▼
启动管线刷新 (RefreshQuestList)
    │
    ▼
UI更新：
    ├────► 任务显示为"已完成"状态
    ├────► 播放奖励领取动效
    └────► 货币栏数字更新
```

### 6.3 任务刷新流程

```
倒计时结束 / 服务器推送
    │
    ▼
服务器发送：FishMarketQuestRefreshNtf
    │
    ├────► fishingLevelConfId
    ├────► index (刷新的任务索引)
    ├────► FishMarketQuestInfo (新任务数据)
    │
    ▼
PlayerGameObjectClient.OnFishMarketQuestRefresh()
    │
    ▼
更新DC数据：DC.FishMarketQuestUpdate()
    │
    ▼
如果是当前打开的鱼市界面：
    │
    ▼
启动管线刷新 (RefreshQuestList)
    │
    ▼
UI更新：
    ├────► 播放任务刷新动效
    └────► 显示新任务信息
```

---

## 7. 关键接口与实现

### 7.1 逻辑层接口 (已有)

```csharp
// IPlayerGameObjectFishMarketQuestClient
public interface IPlayerGameObjectFishMarketQuestClient
{
    // 获取指定关卡所有鱼市任务
    IReadOnlyList<IFishMarketQuestInfoProvider> FishMarketQuestGetAll(int fishingLevelConfId);

    // 鱼是否是满足正在进行中的任务
    bool IsFishRequiredByProgressingQuests(int fishLevelConfId, KeepnetFishSellInfo keepnetFishSellInfo);

    // 同步鱼市任务刷新 (服务器推送回调)
    void OnFishMarketQuestRefresh(int fishingLevelConfId, int index, FishMarketQuestInfo fishMarketQuestInfo);

    // 鱼市任务完成 (网络响应回调)
    bool FishMarketQuestComplete(int fishingLevelConfId, int index, 
        CurrencyUpdateCtxInfo currencyUpdateCtxInfo, out int errCode);
}
```

### 7.2 网络协议 (已有)

```csharp
// 鱼市任务完成确认请求
public class FishMarketQuestCompleteReq
{
    public int FishingLevelConfId;  // 关卡Id
    public int Index;               // 任务索引
}

// 鱼市任务完成确认响应
public class FishMarketQuestCompleteAck
{
    public int Result;                      // 结果 0=成功
    public int FishingLevelConfId;          // 关卡Id
    public int Index;                       // 任务索引
    public ProCurrencyUpdateCtxInfo CurrencyUpdateCtxInfo;  // 货币更新信息
}

// 鱼市任务刷新通知 (服务器推送)
public class FishMarketQuestRefreshNtf
{
    public int FishingLevelConfId;              // 关卡Id
    public int Index;                           // 任务索引
    public ProFishMarketQuestInfo FishMarketQuestInfo;  // 新任务信息
}
```

### 7.3 需要新增的网络请求类

```csharp
/// <summary>
/// 鱼市任务完成请求网络任务
/// </summary>
public class FishMarketQuestCompleteReqNetTask : NetTaskBase
{
    private int m_fishingLevelConfId;
    private int m_index;

    public FishMarketQuestCompleteReqNetTask(int fishingLevelConfId, int index)
    {
        m_fishingLevelConfId = fishingLevelConfId;
        m_index = index;
    }

    protected override void OnStart()
    {
        var req = new FishMarketQuestCompleteReq
        {
            FishingLevelConfId = m_fishingLevelConfId,
            Index = m_index
        };
        
        // 发送网络请求
        // ...
    }

    // 处理响应
    private void OnAck(FishMarketQuestCompleteAck ack)
    {
        Result = ack.Result;
        // 存储响应数据供Tofu使用
    }
}
```

---

## 8. 核心代码实现要点

### 8.1 QuestTofu 数据加载改造

```csharp
// QuestTofu.QuestDataUpdate() - 从Mock数据改为真实数据
protected void QuestDataUpdate()
{
    m_questDataList.Clear();

    // TODO: 获取当前关卡ID
    int currentLevelId = PlayerCtx?.CurrentFishingLevelIdGet() ?? 0;
    if (currentLevelId == 0)
    {
        Debug.LogError("FishMarketQuestTofu: Cannot get current fishing level ID");
        return;
    }

    // 从逻辑层获取任务数据
    var playerGameObject = PlayerCtx?.PlayerGameObjectGet();
    if (playerGameObject == null)
    {
        Debug.LogError("FishMarketQuestTofu: PlayerGameObject is null");
        return;
    }

    var questInfoList = playerGameObject.FishMarketQuestGetAll(currentLevelId);
    
    // 转换为UI层数据结构
    for (int i = 0; i < questInfoList.Count; i++)
    {
        var questInfo = questInfoList[i];
        var questConf = questInfo.ConfGet();
        
        var questData = new FishMarketQuestData
        {
            m_questId = i,  // 使用索引作为任务ID
            m_taskConfigId = questConf.ID,
            m_requiredFishId = questConf.FishTypeId,
            m_requiredFishName = GetFishName(questConf.FishTypeId),
            m_requiredCount = questConf.CountCond,
            m_minWeightRequired = questConf.WeightCond,
            m_currentProgress = questInfo.CompletedCountGet(),
            m_rewardSilverCoin = questConf.RewardSilverCoin,
            m_state = GetQuestState(questInfo),
            m_remainingSeconds = (float)questInfo.LeftTimeGet().TotalSeconds
        };
        
        m_questDataList.Add(questData);
    }
}
```

### 8.2 KeeperTofu 任务鱼标记

```csharp
// KeeperTofu.QuestFishMarkUpdate() - 已有方法，需要完善
private void QuestFishMarkUpdate()
{
    if (m_currentKeeperMode != KeeperModeName4FishMarket)
        return;

    // 获取当前关卡ID
    int currentLevelId = PlayerCtx?.CurrentFishingLevelIdGet() ?? 0;
    
    // 从逻辑层判断每条鱼是否满足任务条件
    var playerGameObject = PlayerCtx?.PlayerGameObjectGet();
    if (playerGameObject == null) return;

    for (int i = 0; i < m_fishItemInfoList.Count; i++)
    {
        var fishInfo = m_fishItemInfoList[i];
        
        // 构造鱼的售卖信息
        var sellInfo = new KeepnetFishSellInfo
        {
            FishInfoConfId = fishInfo.m_fishInfoConfId,
            Weight = fishInfo.m_weight,
            // ... 其他字段
        };
        
        // 调用逻辑层接口判断是否是任务鱼
        fishInfo.m_isTaskFish = playerGameObject.IsFishRequiredByProgressingQuests(
            currentLevelId, sellInfo);
        
        m_fishItemInfoList[i] = fishInfo;
    }
}
```

### 8.3 奖励领取实现

```csharp
// QuestTofu.ClaimQuestReward() - 需要完善网络请求
public void ClaimQuestReward(int questId)
{
    var questData = m_questDataList.Find(t => t.m_questId == questId);
    if (questData == null || questData.m_state != QuestState.Claimable)
    {
        Debug.LogWarning($"Cannot claim reward for quest {questId}, invalid state");
        return;
    }

    // 获取当前关卡ID和任务索引
    int currentLevelId = PlayerCtx?.CurrentFishingLevelIdGet() ?? 0;
    int questIndex = questId; // 任务ID即索引

    // 创建并启动网络请求
    var netTask = new FishMarketQuestCompleteReqNetTask(currentLevelId, questIndex);
    netTask.EventOnStop += task =>
    {
        if (task.IsNetworkError)
        {
            Debug.LogError("Network error when claiming quest reward");
            return;
        }

        var completeTask = task as FishMarketQuestCompleteReqNetTask;
        if (completeTask == null || completeTask.Result != 0)
        {
            Debug.LogError($"Claim quest reward failed, errCode = {completeTask?.Result}");
            return;
        }

        // 网络请求成功，刷新任务列表
        var pipelineInitInfo = m_owner.CompUpdatePipelineManagerGet().UpdatePipelineInitInfoAlloc();
        pipelineInitInfo.m_customParamDict.SetParam(
            FishMarketUITask.ParamKeyPipelineUpdateMask, 
            FishMarketUITask.PipelineUpdateMask.RefreshQuestList);
        m_owner.CompUpdatePipelineManagerGet().UpdatePipelineLaunch(pipelineInitInfo);
    };
    
    netTask.Start();
}
```

---

## 9. UI刷新策略 (PipelineUpdateMask)

### 9.1 现有Mask定义 (已有)

```csharp
[Flags]
public enum PipelineUpdateMask
{
    None = 0,
    RefreshKeepnetFishList = 1 << 0,    // 刷新鱼护列表
    RefreshQuestList = 1 << 1,          // 刷新任务列表
    RefreshMain = 1 << 2,               // 刷新顶部货币
    PlayConfirmSellUIProcess = 1 << 3,  // 播放售卖动画
    SellFinish = 1 << 4,                // 售卖完成
    RefreshAll = RefreshKeepnetFishList | RefreshQuestList | RefreshMain,
}
```

### 9.2 Mask使用场景

| 场景 | Mask设置 | 说明 |
|------|----------|------|
| 界面初始化 | `RefreshAll` | 首次打开，加载所有数据 |
| 售卖完成 | `RefreshKeepnetFishList \| RefreshQuestList \| RefreshMain` | 鱼护、任务、货币都刷新 |
| 领取奖励 | `RefreshQuestList \| RefreshMain` | 刷新任务状态和货币 |
| 任务刷新 | `RefreshQuestList` | 只刷新任务列表 |
| 排序切换 | `RefreshKeepnetFishList` | 只刷新鱼护列表 |

---

## 10. 风险与注意事项

### 10.1 技术风险

| 风险点 | 影响 | 应对措施 |
|--------|------|----------|
| 服务器数据格式与UI层不一致 | 高 | 提前与后端确认数据格式，定义好转换逻辑 |
| 倒计时精度问题 | 中 | 使用服务器时间校准，避免客户端时间偏差 |
| 任务进度并发更新 | 中 | 网络请求响应后再更新本地状态，避免冲突 |
| 跨关卡状态同步 | 中 | 进入关卡时重新获取任务数据，不依赖缓存 |

### 10.2 边界情况处理

1. **任务过期未领取**:
   - 倒计时结束后任务自动刷新
   - 未领取的奖励通过邮件发送
   - UI显示新任务，无额外提示

2. **新鲜度为0的鱼**:
   - 仍可正常售卖，按幼年体价格计算
   - 但不计入任务进度
   - UI上标记为灰色，点击显示提示

3. **跨关卡售卖**:
   - 非当前关卡钓的鱼无法完成任务
   - 但可正常售卖
   - 不弹出额外提示(静默处理)

4. **网络异常**:
   - 领取奖励失败时保持当前状态
   - 显示通用错误提示
   - 允许用户重试

### 10.3 性能考虑

1. **倒计时优化**:
   - 使用协程每1秒更新一次，而非每帧
   - 只在秒数变化时更新UI

2. **列表刷新**:
   - 使用LoopScrollRect虚拟滚动
   - 增量更新而非全量刷新

3. **资源加载**:
   - 任务鱼图标预加载
   - 使用DynamicResCollect4Load收集资源

---

## 11. 开发计划

### 11.1 任务拆分

| 序号 | 任务 | 负责人 | 预计工时 | 依赖 |
|------|------|--------|----------|------|
| 1 | 网络请求类实现 (FishMarketQuestCompleteReqNetTask) | | 0.5d | - |
| 2 | QuestTofu数据加载改造 (接入真实数据) | | 1d | 1 |
| 3 | 任务进度更新逻辑 (售卖后更新进度) | | 1d | 2 |
| 4 | 奖励领取流程实现 | | 1d | 1 |
| 5 | 倒计时功能实现 | | 0.5d | 2 |
| 6 | 任务刷新通知处理 | | 0.5d | 2 |
| 7 | UI动效实现 (完成动效/刷新动效) | | 1d | 2 |
| 8 | 边界情况处理 (新鲜度/跨关卡) | | 0.5d | 3 |
| 9 | 联调测试 | | 1d | 全部 |

**总计**: 约7人日

### 11.2 开发顺序建议

1. **第1天**: 网络请求类 + QuestTofu数据接入
2. **第2天**: 任务进度更新 + 奖励领取流程
3. **第3天**: 倒计时 + 任务刷新 + UI动效
4. **第4天**: 边界处理 + 联调测试

---

## 12. 附录

### 12.1 配置文件说明

```csharp
// ConfigDataFishMarketQuestInfo - 任务配置
public class ConfigDataFishMarketQuestInfo
{
    public int ID;                  // 配置ID
    public int FishTypeId;          // 鱼种ID
    public int CountCond;           // 数量条件
    public int WeightCond;          // 重量条件(g)
    public int RewardSilverCoin;    // 奖励银币
    // ... 其他字段
}

// ConfigDataFishMarketQuestPool - 任务池配置
public class ConfigDataFishMarketQuestPool
{
    public int ID;
    public List<int> QuestGroup1;   // 任务组1 (对应任务栏位1)
    public List<int> QuestGroup2;   // 任务组2 (对应任务栏位2)
    // ... 共8个组
}
```

### 12.2 测试用例建议

1. **正常流程**:
   - 进入鱼市，显示8个任务
   - 售卖满足条件的鱼，进度增加
   - 进度满后显示"领取"按钮
   - 点击领取，获得奖励，状态变为"已完成"

2. **倒计时测试**:
   - 倒计时最后30分钟，时间变红
   - 倒计时结束，自动刷新新任务

3. **边界测试**:
   - 新鲜度为0的鱼不计入进度
   - 跨关卡钓的鱼不计入进度
   - 网络异常时重试机制

4. **性能测试**:
   - 快速售卖多条鱼，进度正确更新
   - 界面打开时资源加载不卡顿

---

**文档结束**

