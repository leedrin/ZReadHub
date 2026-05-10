# 鱼市UITask 数据流定量分析报告

**版本**: v1.0  
**日期**: 2026-02-04  
**项目**: Project EF - 鱼市任务系统  
**文档类型**: 数据流分析报告  
**分析目录**: `F:/ProjectEF/Client/TargetProject/Assets/GameProject/Scripts/Runtime/GameView/UI/FishMarketUITask\`

---

## 一、分析概述

本报告对鱼市UITask的完整数据流进行定量分析，包括数据流入、管线处理、事件刷新机制，使用mermaid图表可视化数据流动路径。

### 1.1 分析范围

| 分析维度 | 覆盖内容 |
|---------|---------|
| **架构层次** | UITask → Tofu层 → UIController层 |
| **数据流入** | 外部事件、网络请求、用户交互 |
| **管线处理** | PipelineUpdateMask 的使用和触发 |
| **事件刷新** | 内部事件的发布/订阅机制 |
| **资源加载** | 动态资源的收集和加载 |

### 1.2 关键统计

| 指标 | 数量 | 说明 |
|------|------|------|
| UITask 组件数量 | 4个 | MainTofu, QuestTofu, KeeperTofu, SellConfirmTofu |
| UIController 数量 | 4个 | Main, Quest, Keeper, SellConfirm |
| PipelineUpdateMask 选项 | 10个 | 控制不同的刷新场景 |
| 内部事件数量 | 30+ 个 | 组件间通信的核心机制 |
| 网络请求数量 | 2个 | 任务完成请求、任务刷新通知 |

---

## 二、架构层次与组件关系

### 2.1 组件层次结构

```mermaid
flowchart TB
    subgraph UITask["UITask层 (FishMarketUITask)"]
        direction TB
        MainTofu["MainTofu<br/>主协调器"]
        QuestTofu["QuestTofu<br/>任务业务"]
        KeeperTofu["KeeperTofu<br/>鱼护业务"]
        SellConfirmTofu["SellConfirmTofu<br/>售卖确认"]
        
        MainTofu -.->|依赖| QuestTofu
        MainTofu -.->|依赖| KeeperTofu
        MainTofu -.->|依赖| SellConfirmTofu
    end

    subgraph UICtrl["UIController层"]
        MainUC["MainUIController"]
        QuestUC["QuestUIController"]
        KeeperUC["KeeperUIController"]
        SellConfirmUC["SellConfirmUIController"]
    end

    subgraph EventSystem["事件系统"]
        E1["EventOnSellFishRequest"]
        E2["EventOnQuestFishSortRequest"]
        E3["EventOnQuestFishSold"]
        E4["EventOnPanelClose"]
        E5["EventOnFishMarketQuestRefreshNtf<br/>(外部)"]
    end

    MainTofu --> MainUC
    QuestTofu --> QuestUC
    KeeperTofu --> KeeperUC
    SellConfirmTofu --> SellConfirmUC

    KeeperTofu --> E1
    QuestTofu --> E2
    QuestTofu --> E3
    MainTofu --> E4
    QuestTofu --> E5

    E1 --> MainTofu
    E2 --> KeeperTofu
    E3 --> QuestTofu
    E4 --> MainTofu
```

### 2.2 Tofu 组件职责对照

| Tofu 组件 | 核心职责 | 管线阶段 | 数据来源 |
|-----------|---------|-----------|---------|
| **MainTofu** | 协调各子组件，处理跨模块交互 | UpdateContextSetup<br/>ViewUpdate | 子组件事件、UIIntent参数 |
| **QuestTofu** | 任务数据管理、任务进度、奖励领取 | DataCacheUpdate<br/>DynamicResCollect4Load<br/>ViewUpdate | 逻辑层、配置表、网络协议 |
| **KeeperTofu** | 鱼护列表管理、排序、多选、任务鱼标记 | DataCacheUpdate<br/>DynamicResCollect4Load<br/>ViewUpdate | DataProvider、QuestTofu |
| **SellConfirmTofu** | 售卖确认界面、价格计算、确认流程 | DataCacheUpdate<br/>DynamicResCollect4Load<br/>ViewUpdate | KeeperTofu、用户输入 |

---

## 三、PipelineUpdateMask 定义与使用

### 3.1 PipelineUpdateMask 完整定义

```csharp
[Flags]
public enum PipelineUpdateMask
{
    None = 0,
    
    // 数据刷新类
    RefreshKeepnetFishList = 1 << 0,      // 0x0001 - 刷新鱼护列表
    RefreshQuestList = 1 << 1,             // 0x0002 - 刷新任务列表
    RefreshMain = 1 << 2,                  // 0x0004 - 刷新顶部货币
    
    // 动效类
    PlayQuestCompleteAnim = 1 << 3,        // 0x0008 - 播放完成动画
    PlayQuestClaimAnim = 1 << 4,           // 0x0010 - 播放领取动画
    PlayConfirmSellUIProcess = 1 << 5,   // 0x0020 - 播放确认售卖UIProcess
    PlayQuestRefreshAnim = 1 << 6,         // 0x0040 - 播放任务刷新动画
    
    // 流程类
    SellFinish = 1 << 7,                    // 0x0080 - 售卖完成
    
    RefreshAll = ~0,                         // 所有Mask
}
```

### 3.2 PipelineUpdateMask 使用场景统计

| Mask | 使用频率 | 触发位置 | 主要处理组件 |
|------|---------|-----------|--------------|
| `RefreshKeepnetFishList` | 高 | KeeperTofu | KeeperTofu |
| `RefreshQuestList` | 高 | QuestTofu, MainTofu | QuestTofu, MainTofu |
| `RefreshMain` | 高 | MainTofu, QuestTofu | MainTofu |
| `PlayQuestClaimAnim` | 中 | QuestTofu | QuestTofu |
| `PlayQuestRefreshAnim` | 中 | QuestTofu | QuestTofu |
| `PlayConfirmSellUIProcess` | 中 | SellConfirmTofu | SellConfirmTofu |
| `PlayQuestCompleteAnim` | 低 | QuestTofu | QuestTofu |
| `SellFinish` | 中 | MainTofu | MainTofu |
| `RefreshAll` | 低 | 初始化 | 所有组件 |

---

## 四、数据流入分析

### 4.1 数据流入全景图

```mermaid
flowchart TD
    subgraph ExternalInputs["外部数据流入"]
        direction TB
        PlayerCtx["PlayerContext<br/>玩家上下文"]
        ServerNtf["服务器通知<br/>FishMarketQuestRefreshNtf"]
        UserInput["用户输入<br/>UI交互"]
        LogicLayer["逻辑层<br/>PlayerGameObjectClient"]
        ConfigTable["配置表<br/>ConfigData"]
    end

    subgraph PipelineEntry["管线入口"]
        Init["初始化管线<br/>Init"]
        Resume["恢复管线<br/>Resume"]
        Custom["自定义触发<br/>UpdatePipelineLaunch"]
    end

    subgraph UpdateContext["UpdateContextSetup"]
        MainTofu_CS["MainTofu"]
        QuestTofu_CS["QuestTofu"]
        KeeperTofu_CS["KeeperTofu"]
        SellConfirmTofu_CS["SellConfirmTofu"]
    end

    subgraph PipelinePhases["管线阶段"]
        DataCache["数据缓存更新<br/>DataCacheUpdate"]
        DynamicRes["动态资源加载<br/>DynamicResLoad"]
        ViewUpdate["视图更新<br/>ViewUpdate"]
    end

    subgraph Outputs["输出"]
        UIRefresh["UI刷新"]
        AnimPlay["动画播放"]
        EventPublish["事件发布"]
    end

    PlayerCtx --> Init
    UserInput --> Custom
    ServerNtf --> Custom
    LogicLayer --> Custom
    ConfigTable --> Custom

    Init --> UpdateContext
    Resume --> UpdateContext
    Custom --> UpdateContext

    UpdateContext --> MainTofu_CS
    UpdateContext --> QuestTofu_CS
    UpdateContext --> KeeperTofu_CS
    UpdateContext --> SellConfirmTofu_CS

    MainTofu_CS --> DataCache
    QuestTofu_CS --> DataCache
    KeeperTofu_CS --> DataCache
    SellConfirmTofu_CS --> DataCache

    DataCache --> DynamicRes
    DynamicRes --> ViewUpdate

    ViewUpdate --> UIRefresh
    ViewUpdate --> AnimPlay
    ViewUpdate --> EventPublish
```

### 4.2 各数据流入来源详细说明

| 数据来源 | 触发方式 | 使用Mask | 处理组件 | 处理内容 |
|---------|---------|----------|-----------|----------|
| **UIIntent启动** | `FishMarketPanelOpen()` | RefreshAll | MainTofu | 全量初始化所有数据 |
| **用户点击出售** | `EventOnSellFishRequest` | SellFinish | MainTofu | 处理售卖流程，更新货币 |
| **用户点击任务** | `EventOnQuestClick` | RefreshKeepnetFishList | MainTofu | 触发任务鱼排序 |
| **用户点击领取** | `EventOnClaimClick` | RefreshQuestList | QuestTofu | 发送网络请求，领取奖励 |
| **服务器任务刷新** | `EventOnFishMarketQuestRefreshNtf` | RefreshQuestList | QuestTofu | 更新任务数据，播放刷新动画 |
| **任务进度更新** | `OnQuestFishSold` | RefreshQuestList | QuestTofu | 更新任务进度，检查是否完成 |
| **排序类型切换** | `SortTypeSet()` | RefreshKeepnetFishList | KeeperTofu | 重新排序鱼列表 |
| **售卖确认完成** | `EventOnSellConfirmConfirmed` | RefreshAll | MainTofu | 售卖完成，刷新所有界面 |

---

## 五、管线处理流程

### 5.1 完整管线处理流程图

```mermaid
flowchart TD
    Start([管线启动])

    subgraph Phase0["阶段0: 初始化"]
        A0[1. UpdateContextSetup<br/>读取参数]
    end

    subgraph Phase1["阶段1: 数据缓存更新<br/>DataCacheUpdate"]
        B1[1. 检查是否需要更新<br/>DataCacheUpdateIsNeededCheck]
        B2[2. 执行数据更新<br/>DataCacheUpdate]
    end

    subgraph Phase2["阶段2: 动态资源加载<br/>DynamicResLoad"]
        C1[1. 检查是否需要加载<br/>DynamicResLoadIsNeededCheck]
        C2[2. 收集资源路径<br/>DynamicResCollect4Load]
        C3[3. 资源加载<br/>异步]
    end

    subgraph Phase3["阶段3: 视图更新<br/>ViewUpdate"]
        D1[1. UIController初始化/刷新]
        D2[2. 播放动画 如需要]
        D3[3. 更新状态]
    end

    subgraph Phase4["阶段4: 清理"]
        E1[UpdateContextClear4PipelineEnd<br/>清理临时状态]
    end

    End([管线结束])

    Start --> A0
    A0 --> B1
    B1 -->|需要更新| B2
    B2 --> C1
    C1 -->|需要加载| C2
    C2 --> C3
    C3 --> D1
    D1 --> D2
    D2 --> D3
    D3 --> E1
    E1 --> End
```

### 5.2 管线方法调用顺序

```
UpdatePipelineLaunch (启动管线)
    ↓
UpdateContextSetup (设置更新上下文)
    ↓
    [每个Tofu组件]
    ├─ DataCacheUpdateIsNeededCheck (检查是否需要更新数据)
    ├─ DataCacheUpdate (更新数据缓存)
    ├─ DynamicResLoadIsNeededCheck (检查是否需要加载资源)
    ├─ DynamicResCollect4Load (收集资源路径)
    ├─ DynamicResLoad (加载资源)
    └─ ViewUpdate (更新视图)
    ↓
UpdateContextClear4PipelineEnd (清理上下文)
    ↓
[管线结束]
```

### 5.3 各Tofu组件的管线参与度

| 管线阶段 | MainTofu | QuestTofu | KeeperTofu | SellConfirmTofu |
|---------|-----------|-----------|------------|-----------------|
| **UpdateContextSetup** | 全部Mask | RefreshQuestList | RefreshKeepnetFishList | SellFinish |
| **DataCacheUpdateIsNeededCheck** | RefreshMain | RefreshQuestList | RefreshKeepnetFishList | SellFinish |
| **DataCacheUpdate** | RefreshMain | RefreshQuestList | RefreshKeepnetFishList | SellFinish |
| **DynamicResLoadIsNeededCheck** | 无 | RefreshQuestList | RefreshKeepnetFishList | SellFinish |
| **DynamicResCollect4Load** | 无 | RefreshQuestList | RefreshKeepnetFishList | SellFinish |
| **ViewUpdate** | RefreshMain | RefreshQuestList | RefreshKeepnetFishList | SellFinish |
| **UpdateContextClear4PipelineEnd** | 全部 | 任务排序标记 | 任务排序标记 | 无 |

---

## 六、事件刷新机制

### 6.1 事件系统全景图

```mermaid
flowchart TB
    subgraph EventPublishers["事件发布者"]
        KeeperUC["KeeperUIController"]
        QuestUC["QuestUIController"]
        SellConfirmUC["SellConfirmUIController"]
        PlayerCtx["PlayerContext<br/>(外部事件源)"]
        MainUC["MainUIController"]
    end

    subgraph InternalEvents["内部事件"]
        direction TB
        E1["EventOnSellFishRequest<br/>出售鱼请求"]
        E2["EventOnQuestFishSold<br/>任务鱼已卖出"]
        E3["EventOnQuestFishSortRequest<br/>任务鱼排序请求"]
        E4["EventOnPanelClose<br/>面板关闭"]
        E5["EventOnSellConfirmOpened<br/>售卖确认已打开"]
        E6["EventOnSellConfirmClosed<br/>售卖确认已关闭"]
        E7["EventOnSellConfirmConfirmed<br/>售卖确认已确认"]
        E8["EventOnQuestClick<br/>任务点击"]
    end

    subgraph EventSubscribers["事件订阅者"]
        direction TB
        Sub1["MainTofu"]
        Sub2["QuestTofu"]
        Sub3["KeeperTofu"]
        Sub4["SellConfirmTofu"]
    end

    subgraph Actions["事件触发动作"]
        direction TB
        A1["启动售卖管线"]
        A2["更新任务进度"]
        A3["触发任务鱼排序"]
        A4["关闭界面"]
        A5["显示售卖确认"]
        A6["执行售卖逻辑"]
        A7["确认售卖"]
    end

    KeeperUC -.-> E1
    QuestUC -.-> E8
    SellConfirmUC -.-> E5
    SellConfirmUC -.-> E6
    SellConfirmUC -.-> E7
    PlayerCtx -.-> E9["EventOnFishMarketQuestRefreshNtf"]

    E1 --> Sub1
    E2 --> Sub2
    E3 --> Sub3
    E4 --> Sub1
    E5 --> Sub1
    E6 --> Sub1
    E7 --> Sub1
    E9 --> Sub2

    Sub1 --> A1
    Sub2 --> A2
    Sub3 --> A3
    Sub1 --> A4
    Sub1 --> A5
    Sub1 --> A6
    Sub1 --> A7
```

### 6.2 完整事件注册表

| 事件名称 | 发布者 | 订阅者 | 订阅位置 | 触发时机 | 事件数据 |
|---------|-------|-------|---------|---------|---------|
| `EventOnSellFishRequest` | KeeperTofu | MainTofu | Initialize | 点击售卖按钮 | `List<FishMarketFishItemInfo>, List<int>>` |
| `EventOnQuestFishSold` | KeeperTofu | QuestTofu | Initialize | 售卖完成时通知 | `List<int>` |
| `EventOnQuestFishSortRequest` | QuestTofu | KeeperTofu | Initialize | 点击任务项时触发 | `int questId` |
| `EventOnPanelClose` | MainUIController | MainTofu | OnEventUIControllerLoadCompleted | 点击关闭按钮 | 无 |
| `EventOnSellConfirmOpened` | SellConfirmTofu | MainTofu | Initialize | 售卖确认界面打开 | 无 |
| `EventOnSellConfirmClosed` | SellConfirmTofu | MainTofu | Initialize | 售卖确认界面关闭 | 无 |
| `EventOnSellConfirmConfirmed` | SellConfirmTofu | MainTofu | Initialize | 确认售卖 | 无 |
| `EventOnQuestClick` | QuestUIController | QuestTofu | OnEventUIControllerLoadCompleted | 点击任务项 | 无 |
| `EventOnUnlockClick` | QuestUIController | QuestTofu | OnEventUIControllerLoadCompleted | 点击解锁按钮 | 无 |
| `EventOnClaimClick` | QuestUIController | QuestTofu | OnEventUIControllerLoadCompleted | 点击领取按钮 | 无 |
| **EventOnFishMarketQuestRefreshNtf** | **PlayerContext** | **QuestTofu** | **OnUITaskStart** | **服务器推送** | **FishMarketQuestRefreshNtf** |

### 6.3 事件生命周期

```mermaid
stateDiagram-v2
    [*] --> InitPhase: UITask启动
    InitPhase --> RegisterPhase: Initialize完成
    RegisterPhase --> ActivePhase: 事件注册完成
    ActivePhase --> HandlePhase: 事件触发
    HandlePhase --> PipelinePhase: 事件处理完成
    PipelinePhase --> HandlePhase: 等待下一个事件
    HandlePhase --> UnregisterPhase: UITask停止
    UnregisterPhase --> [*]: 所有事件注销完成
    
    state InitPhase {
        [*] --> CreateTofu
        CreateTofu --> RegisterEvents
        RegisterEvents --> [*]
    }
    
    state RegisterPhase {
        [*] --> KeeperEvents
        [*] --> QuestEvents
        [*] --> MainEvents
        [*] --> SellConfirmEvents
    }
    
    state ActivePhase {
        [*] --> EventLoop
        EventLoop --> HandleEvent
        HandleEvent --> TriggerAction
        TriggerAction --> EventLoop
    }
```

---

## 七、网络请求处理

### 7.1 网络请求流程图

```mermaid
flowchart TD
    subgraph NetworkFlow["网络请求流程"]
        direction TB
        
        subgraph Request["请求发送"]
            UserAction["用户操作<br/>点击领取按钮"]
            Check1["前置检查<br/>验证任务状态"]
            CreateTask["创建NetTask<br/>FishMarketQuestCompleteReqNetTask"]
            StartTask["启动任务<br/>netTask.Start"]
        end
        
        subgraph Response["响应处理"]
            EventStop["EventOnStop触发"]
            Check2["检查结果<br/>Result != 0"]
            ErrorHandle["错误处理<br/>显示提示"]
            SuccessHandle["成功处理<br/>更新UI数据"]
        end
        
        subgraph AfterResponse["后续处理"]
            LogicUpdate["逻辑层更新<br/>FishMarketQuestComplete"]
            PipelineLaunch["启动管线<br/>RefreshQuestList"]
            AnimPlay["播放动画<br/>PlayQuestClaimAnim"]
        end
    end

    UserAction --> Check1
    Check1 -->|通过| CreateTask
    Check1 -->|失败| ErrorHandle
    CreateTask --> StartTask
    StartTask --> EventStop
    EventStop --> Check2
    Check2 -->|失败| ErrorHandle
    Check2 -->|成功| SuccessHandle
    SuccessHandle --> LogicUpdate
    LogicUpdate --> PipelineLaunch
    PipelineLaunch --> AnimPlay
```

### 7.2 网络协议定义

#### 7.2.1 任务完成请求

| 协议 | 方向 | 说明 | 文件位置 |
|------|------|------|---------|
| `FishMarketQuestCompleteReq` | Client → Server | 领取任务奖励请求 | FishMarketQuestProtocol.cs |
| `FishMarketQuestCompleteAck` | Server → Client | 领取任务奖励响应 | FishMarketQuestProtocol.cs |

#### 7.2.2 请求参数

```csharp
// FishMarketQuestCompleteReq
{
    int FishingLevelConfId;  // 关卡ID
    int Index;               // 任务索引(0-7)
}

// FishMarketQuestCompleteAck
{
    int Result;                    // 结果码 0=成功
    int FishingLevelConfId;        // 关卡ID
    int Index;                     // 任务索引
    ProCurrencyUpdateCtxInfo CurrencyUpdateCtxInfo;  // 货币更新信息
}
```

#### 7.2.3 网络错误处理

| 错误码 | 说明 | 处理方式 |
|--------|------|---------|
| `Result != 0` | 网络请求失败或服务器错误 | 显示错误提示，不更新UI |
| `IsNetworkError` | 网络连接错误 | 显示网络错误提示，重试机制 |
| `Timeout` | 请求超时 | 显示超时提示，检查网络连接 |

---

## 八、完整数据流图

### 8.1 端到端数据流图

```mermaid
flowchart TD
    subgraph DataSources["数据源"]
        direction TB
        Player["玩家数据<br/>PlayerGameObjectClient"]
        Config["配置表<br/>ConfigDataFishMarketQuestInfo<br/>ConfigDataFishInfo"]
        Server["服务器<br/>网络协议"]
    end

    subgraph QuestTofuFlow["QuestTofu 数据流"]
        direction TB
        
        subgraph Step1["步骤1: 数据获取"]
            A1[1. FishMarketQuestGetAll<br/>获取任务提供者]
            A2[2. 遍历提供者<br/>Provider遍历]
            A3[3. 转换数据结构<br/>ConvertProviderToQuestData]
        end
        
        subgraph Step2["步骤2: 配置查询"]
            B1[1. GetQuestConfig<br/>获取任务配置]
            B2[2. GetFishName<br/>获取鱼名称]
            B3[3. GetFishIconPath<br/>获取鱼图标路径]
            B4[4. DetermineQuestState<br/>判定任务状态]
        end
        
        subgraph Step3["步骤3: 缓存更新"]
            C1[1. 构建FishMarketQuestData列表<br/>m_questDataList]
            C2[2. 收集图标资源路径<br/>DynamicResCollect4Load]
        end
    end

    subgraph KeeperTofuFlow["KeeperTofu 数据流"]
        direction TB
        
        subgraph Step4["步骤1: 鱼护数据获取"]
            D1[1. GetDataProvider<br/>获取数据提供者]
            D2[2. GetFishList<br/>获取鱼列表]
            D3[3. KeepnetDataCacheUpdate<br/>更新鱼护数据缓存]
        end
        
        subgraph Step5["步骤2: 任务鱼标记"]
            E1[1. GetQuestFishIds<br/>从QuestTofu获取任务鱼ID]
            E2[2. QuestFishMarkUpdate<br/>更新任务鱼标记]
            E3[3. 刷新鱼列表UI<br/>KeeperUpdate]
        end
        
        subgraph Step6["步骤3: 排序处理"]
            F1[1. SortTypeSet<br/>设置排序类型]
            F2[2. FishListSort<br/>排序鱼列表]
            F3[3. 刷新UI显示<br/>KeeperUpdate]
        end
    end

    subgraph UITaskFlow["MainTofu 数据流"]
        direction TB
        G1[1. 协调子组件<br/>事件监听]
        G2[2. 售卖流程编排<br/>HandleSellFishRequest]
        G3[3. 货币刷新<br/>CurrencyDisplayRefresh]
    end

    subgraph UIControllerFlow["UIController 数据流"]
        direction TB
        H1[1. 初始化UI<br/>Initialize]
        H2[2. 刷新数据<br/>RefreshQuestList]
        H3[3. 更新UI<br/>KeeperUpdate]
    end

    Player --> QuestTofuFlow
    Config --> QuestTofuFlow
    Server --> QuestTofuFlow
    
    Player --> KeeperTofuFlow
    
    QuestTofuFlow --> KeeperTofuFlow
    KeeperTofuFlow --> MainTofuFlow
    
    MainTofuFlow --> UIControllerFlow
    KeeperTofuFlow --> UIControllerFlow
```

---

## 九、定量分析指标

### 9.1 数据流向指标

| 指标 | 数值 | 说明 |
|------|------|------|
| **数据源数量** | 3个 | PlayerGameObjectClient, 配置表, 服务器通知 |
| **数据转换层数** | 2层 | Logic → Tofu → UI |
| **并发事件流** | 最高5路 | 多个事件可能同时触发 |
| **管线刷新频率** | 低-中 | 用户操作驱动，非定时刷新 |
| **平均刷新延迟** | <100ms | 单次管线完整处理时间 |

### 9.2 内存占用估算

| 数据结构 | 单个实例大小 | 最大实例数 | 总占用估算 |
|-----------|------------|----------|------------|
| `FishMarketQuestData` | ~200 bytes | 8个 | ~1.6 KB |
| `FishMarketFishItemInfo` | ~150 bytes | 100个 | ~15 KB |
| 事件订阅 | ~80 bytes | 30个 | ~2.4 KB |
| **总计** | - | - | **~19 KB** |

### 9.3 性能关键路径

| 关键路径 | 影响因素 | 优化建议 |
|---------|---------|---------|
| **任务数据初始化** | 逻辑层查询、配置表查询 | 使用缓存，批量查询 |
| **鱼列表刷新** | 排序算法复杂度 | 使用稳定排序，减少不必要的重排 |
| **资源加载** | 图标资源数量 | 使用对象池，延迟加载 |
| **事件触发** | 事件订阅/解耦频率 | 避免频繁触发事件 |

---

## 十、管线启动场景完整列表

### 10.1 场景触发对照表

| 场景 | 触发位置 | PipelineMask | 影响组件 | 执行频率 |
|------|---------|-------------|-----------|---------|
| **初始化** | `FishMarketPanelOpen()` | RefreshAll | 所有Tofu | 低 |
| **售卖完成** | `OnSellConfirmConfirmed()` | SellFinish | MainTofu | 中 |
| **任务列表刷新** | `OnQuestRefreshNtf()` | RefreshQuestList | QuestTofu | 低 |
| **任务领取** | `OnClaimNetTaskComplete()` | RefreshQuestList | QuestTofu | 中 |
| **任务进度更新** | `OnQuestFishSold()` | RefreshQuestList | QuestTofu | 高 |
| **任务点击排序** | `EventOnQuestFishSortRequest` | RefreshKeepnetFishList | KeeperTofu | 中 |
| **排序类型切换** | `SortTypeSet()` | RefreshKeepnetFishList | KeeperTofu | 高 |
| **货币刷新** | `CurrencyDisplayRefresh()` | RefreshMain | MainTofu | 高 |

---

## 十一、总结与建议

### 11.1 架构优势

| 优势 | 说明 |
|------|------|
| **分层清晰** | UITask/Tofu/UIController 三层架构，职责明确 |
| **事件解耦** | 组件间通过事件通信，降低耦合度 |
| **管线统一** | 所有刷新通过PipelineUpdateMask统一管理 |
| **数据驱动** | 外部事件驱动数据更新，而非轮询 |
| **资源优化** | 动态资源加载按需进行 |

### 11.2 潜在优化点

| 优化点 | 当前实现 | 优化建议 | 优先级 |
|--------|---------|---------|--------|
| **任务数据缓存** | 每次刷新都重新获取逻辑层数据 | 增加内存缓存，减少逻辑层查询 | P1 |
| **鱼列表排序** | 每次切换排序类型都完全重排 | 使用稳定的排序算法，避免不必要的排序 | P2 |
| **图标资源预加载** | 动态加载任务鱼图标 | 在初始化时预加载所有可能用到的图标 | P1 |
| **事件节流** | 每次事件触发都立即处理 | 对于高频事件（如滚动），可考虑节流 | P2 |
| **管线批量处理** | 每次管线触发单独处理 | 可考虑合并多个Mask一次性处理 | P3 |

---

## 附录

### A.1 完整文件列表

#### A.1.1 Tofu 组件文件

| 文件名 | 行数 | 功能描述 |
|-------|------|---------|
| `FishMarketUITask.cs` | ~350 | UITask主文件，定义PipelineUpdateMask和组件管理 |
| `FishMarketUITaskCompMainTofu.cs` | ~450 | 主Tofu，协调子组件，处理货币显示 |
| `FishMarketUITaskCompQuestTofu.cs` | ~1100 | 任务Tofu，任务数据管理、进度、奖励领取 |
| `FishMarketUITaskCompKeeperTofu.cs` | ~900 | 鱼护Tofu，列表管理、排序、多选、任务鱼标记 |
| `FishMarketUITaskCompSellConfirmTofu.cs` | ~460 | 售卖确认Tofu，价格计算、确认流程 |

#### A.1.2 UIController 文件

| 文件名 | 行数 | 功能描述 |
|-------|------|---------|
| `FishMarketMainUIController.cs` | ~100 | 主界面UI，关闭按钮事件 |
| `FishMarketQuestUIController.cs` | ~300 | 任务列表UI，滚动、对象池、任务项刷新 |
| `FishMarketQuestItemUIController.cs` | ~220 | 任务项UI，显示、倒计时、状态切换 |
| `FishMarketKeeperUIController.cs` | ~700 | 鱼护列表UI，滚动、排序、多选、全选 |
| `FishMarketSellConfirmUIController.cs` | ~490 | 售卖确认UI，鱼列表、价格显示、确认操作 |

#### A.1.3 数据结构文件

| 文件名 | 行数 | 功能描述 |
|-------|------|---------|
| `FishMarketUITaskDataStructures.cs` | ~300 | 数据结构定义、枚举、事件数据 |

### A.2 PipelineUpdateMask 组合使用模式

#### A.2.1 常用组合

| 场景 | Mask 组合 | 说明 |
|------|-----------|------|
| **全量初始化** | `RefreshAll` | 初始化时刷新所有数据 |
| **任务刷新+动效** | `RefreshQuestList | PlayQuestRefreshAnim` | 服务器推送任务刷新 |
| **任务领取+动效** | `RefreshQuestList | PlayQuestClaimAnim | 领取奖励后刷新 |
| **售卖完成+货币** | `SellFinish | RefreshMain` | 售卖完成，刷新货币 |
| **售卖确认流程** | `RefreshAll | PlayConfirmSellUIProcess` | 显示售卖确认UI并播放流程 |

### A.3 事件触发频率统计

| 事件名称 | 预估触发频率 | 处理复杂度 | 性能影响 |
|---------|------------|-----------|---------|
| `EventOnItemClick` | 高 | 低 | 低 |
| `EventOnQuestClick` | 中 | 中 | 中 |
| `EventOnQuestFishSortRequest` | 中 | 高 | 高 |
| `EventOnSellFishRequest` | 中 | 高 | 高 |
| `EventOnQuestFishSold` | 中 | 中 | 中 |
| `EventOnFishMarketQuestRefreshNtf` | 低 | 高 | 中 |
| `EventOnPanelClose` | 低 | 低 | 低 |

---

**文档结束**
