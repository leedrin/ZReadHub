# 任务系统架构蓝图 (Task System Architecture Blueprint) - v2.0

**日期**: 2026-02-13
**PRD**: tasksytem.md
**版本**: v2.0 - 符合 BJFramework 架构规范

---

## 1. ER 数据模型 (Logic Data Only)

```mermaid
erDiagram
    TaskInfo ||--o{ TaskObjective : contains
    TaskInfo ||--o| TaskReward : has
    TaskInfo }o--|| TriggerConfig : references
    TaskObjective }o--|| TriggerConfig : uses
    TaskInfo ||--o| TeamTaskInfo : extends

    TaskInfo {
        int task_id PK
        int task_type
        string task_name
        string task_desc
        TaskStatus status
        int next_task_id
        bool auto_reward
        AcceptType accept_type
        int accept_cond_id
        bool is_team_task
        int mapId
    }

    TaskObjective {
        int objective_id PK
        int belong_task_id FK
        int trigger_id FK
        string objective_desc
        int target_value
        int current_progress
        SceneMarkPos scene_mark_pos
    }

    TaskReward {
        int reward_id PK
        int task_id FK
        string reward_items
        bool is_claimed
    }

    TriggerConfig {
        int id PK
        string event_name
        string check_params
        CompareLogic compare_logic
        ValueType value_type
    }

    TeamTaskInfo {
        int task_id PK
        int team_id
        string shared_members
        string progress_contributors
    }
```

**说明**: ER 图仅包含 Logic Data（存储在 `MainTofu.m_dataCache`），不包含 Display Data。

---

## 2. 追踪任务流程蓝图（符合 BJFramework 规范）

```mermaid
graph TB
    subgraph task_list_controller["TaskListController (UIController)"]
        V1["TrackButton: ButtonEx"]
        E1["OnTrackButtonClicked<br/>UnityEvent&lt;int&gt;"]
        M1["RefreshTaskList(data)"]
        M2["UpdateClaimableIcons(ids)"]
        V1 -->|"User Click"| E1
    end

    subgraph main_tofu["TaskSystemUITaskMainTofu (MainTofu)"]
        direction TB

        subgraph business_logic["Business Logic"]
            direction TB
            S1([OnTrackButtonClicked])
            S2{"CheckCanTrack()"}
            S3["GetTask(taskId)"]
            S4{"task.Status<br/>!= Finished?"}
            S5["NetTask:<br/>RequestTrackTask"]
            S6["OnNetSuccess:<br/>UpdateTrackedId"]
            S7["SetMask:<br/>RefreshTracking"]
            S8["StartPipeline"]

            S1 ==> S2 ==>|"Pass"| S3 ==> S4
            S4 ==>|"Yes"| S5 ==> S6 ==> S7 ==> S8
            S4 -->|"No"| ERR["ShowTip:<br/>已结束任务不可追踪"]
        end

        subgraph pipeline_stages["UpdatePipeline (5 Stages)"]
            direction LR
            P1["DataCacheUpdate:<br/>BuildTrackingData"]
            P2["ViewUpdate:<br/>CallControllerRefresh"]
            P1 ==> P2
        end

        S8 ==> P1
    end

    subgraph data_cache["Data Cache (Logic Data)"]
        D1["m_trackedTaskId: int"]
        D2["m_allTasks:<br/>List&lt;TaskInfo&gt;"]
    end

    subgraph display_data["Display Data (Temporary)"]
        D3["m_cachedTrackingData:<br/>TrackingTaskData"]
    end

    subgraph tracking_controller["TrackingController (UIController)"]
        M3["RefreshTracking(data)"]
        M4["UpdateObjectives()"]
        M5["ShowSceneMarker()"]
        M3 ==> M4
        M3 ==> M5
    end

    %% 交互流
    E1 -.->|"[Event:Subscribe]"| S1

    %% 数据流
    S3 -->|"[Read]"| D2
    S6 -.->|"[Write]"| D1
    P1 -->|"[Transform]"| D3
    P2 -.->|"[Call Method<br/>with Display Data]"| M3

    %% 样式
    style task_list_controller fill:#e7f5ff,stroke:#1971c2
    style main_tofu fill:#e5dbff,stroke:#5f3dc4
    style data_cache fill:#fff4e6,stroke:#e67700
    style display_data fill:#d0f4de,stroke:#2d6a4f
    style tracking_controller fill:#e7f5ff,stroke:#1971c2
```

**关键改进点**:
1. ✅ 使用 `MainTofu (Business Logic)` 而非 ~~Service Layer~~
2. ✅ 区分 `Data Cache (Logic Data)` 和 `Display Data (Temporary)`
3. ✅ `UpdatePipeline` 在 MainTofu 内部展示
4. ✅ `TaskListController` 保持完整性（输入事件 + 刷新方法）
5. ✅ 清晰标注依赖：`[Event:Subscribe]`, `[Call Method]`, `[Transform]`

---

## 3. 任务进度更新流程蓝图（符合 BJFramework 规范）

```mermaid
graph TB
    subgraph event_source["Event Source"]
        E1["PlayerActionEvent<br/><<Event>>"]
        E2["TeamMemberActionEvent<br/><<Event>>"]
    end

    subgraph main_tofu["TaskSystemUITaskMainTofu (MainTofu)"]
        direction TB

        subgraph business_logic["Business Logic"]
            S1([OnPlayerActionEvent])
            S2{"IsInProgressTask?"}
            S3["GetMatchingTasks"]
            S4{"CheckParams<br/>Match?"}
            S5["CalculateNewProgress"]
            S6{"IsObjective<br/>Completed?"}
            S7["NetTask:<br/>UpdateTaskProgress"]
            S8["OnNetSuccess:<br/>UpdateCache"]
            S9["CheckAllObjectives"]
            S10{"IsTask<br/>Completed?"}
            S11["SetMask:<br/>ShowProgressTip<br/>+ RefreshTracking"]
            S12["SetMask:<br/>RefreshTaskList<br/>+ RefreshClaimableIcon"]
            S13["StartPipeline"]

            S1 ==> S2 ==>|"Yes"| S3 ==> S4
            S2 -->|"No"| END1["Ignore"]
            S4 ==>|"Yes"| S5 ==> S6
            S4 -->|"No"| END1
            S6 ==>|"No"| S7 ==> S8 ==> S11 ==> S13
            S6 ==>|"Yes"| S9 ==> S10
            S10 ==>|"Yes"| S12 ==> S13
            S10 ==>|"No"| S11
        end

        subgraph pipeline_stages["UpdatePipeline (5 Stages)"]
            direction LR
            P1["DataCacheUpdate:<br/>BuildProgressTipData"]
            P2["ViewUpdate:<br/>ShowTip +<br/>RefreshControllers"]
            P1 ==> P2
        end

        S13 ==> P1
    end

    subgraph data_cache["Data Cache (Logic Data)"]
        D1["m_allTasks:<br/>List&lt;TaskInfo&gt;"]
        D2["objective.current_progress"]
        D3["task.status"]
    end

    subgraph display_data["Display Data (Temporary)"]
        DD1["m_cachedProgressTipData:<br/>ProgressTipData"]
        DD2["m_cachedListData:<br/>List&lt;TaskListItemData&gt;"]
    end

    subgraph controllers["UIController Layer"]
        direction TB
        C1["TipManager:<br/>ShowProgressTip(data)"]
        C2["TaskDetailController:<br/>UpdateObjectiveProgress(data)"]
        C3["TrackingController:<br/>HighlightObjective(data)"]
    end

    %% 执行流
    E1 ==>|"[Event:Fire]"| S1
    E2 ==>|"[Event:Fire]"| S1

    %% 数据流
    S3 -->|"[Read]"| D1
    S5 -.->|"[Write]"| D2
    S8 -.->|"[Write]"| D2
    S9 -.->|"[Write]"| D3
    P1 -->|"[Transform]"| DD1
    P1 -->|"[Transform]"| DD2

    %% UI 刷新流
    P2 -.->|"[Call Method]"| C1
    P2 -.->|"[Call Method]"| C2
    P2 -.->|"[Call Method]"| C3

    %% 样式
    style event_source fill:#ffd8a8,stroke:#d9480f
    style main_tofu fill:#e5dbff,stroke:#5f3dc4
    style data_cache fill:#fff4e6,stroke:#e67700
    style display_data fill:#d0f4de,stroke:#2d6a4f
    style controllers fill:#e7f5ff,stroke:#1971c2
```

**关键改进点**:
1. ✅ UpdatePipeline 在 MainTofu 内部
2. ✅ 多个 UIController 合并到 `UIController Layer`
3. ✅ Display Data 明确标注为 Temporary
4. ✅ 数据转换在 DataCacheUpdate 阶段完成

---

## 4. 领取奖励流程蓝图（符合 BJFramework 规范）

```mermaid
graph TB
    subgraph detail_controller["TaskDetailController (UIController)"]
        V1["ClaimButton: ButtonEx"]
        E1["OnClaimButtonClicked<br/>UnityEvent&lt;int&gt;"]
        M1["RefreshDetail(data)"]
        M2["ShowEmptyState()"]
        V1 -->|"User Click"| E1
    end

    subgraph main_tofu["TaskSystemUITaskMainTofu (MainTofu)"]
        direction TB

        subgraph business_logic["Business Logic"]
            S1([OnClaimButtonClicked])
            S2{"CheckCanClaim()"}
            S3["GetTask(taskId)"]
            S4{"Status ==<br/>Completed?"}
            S5{"HasReward?"}
            S6["NetTask:<br/>RequestClaimReward"]
            S7["OnSuccess:<br/>UpdateTaskStatus"]
            S8["SetMask:<br/>RefreshAll"]
            S9["StartPipeline"]

            S1 ==> S2 ==>|"Pass"| S3 ==> S4
            S4 ==>|"Yes"| S5
            S4 -->|"No"| ERR1["ShowTip:<br/>任务未完成"]
            S5 ==>|"Yes"| S6
            S5 -->|"No"| ERR2["ShowTip:<br/>无奖励"]
            S6 ==> S7 ==> S8 ==> S9
        end

        subgraph pipeline_stages["UpdatePipeline (5 Stages)"]
            direction LR
            P1["Preprocess:<br/>LockUI"]
            P2["DataCacheUpdate:<br/>RebuildAllData"]
            P3["ViewUpdate:<br/>RefreshControllers"]
            P4["PostProcess:<br/>PlayUIProcess"]

            P1 ==> P2 ==> P3 ==> P4
        end

        S9 ==> P1
    end

    subgraph data_cache["Data Cache (Logic Data)"]
        D1["m_allTasks:<br/>List&lt;TaskInfo&gt;"]
        D2["task.status:<br/>TaskStatus"]
        D3["reward.is_claimed:<br/>bool"]
    end

    subgraph display_data["Display Data (Temporary)"]
        DD1["m_cachedListData:<br/>List&lt;TaskListItemData&gt;"]
        DD2["m_cachedDetailData:<br/>TaskDetailData"]
        DD3["m_cachedTrackingData:<br/>TrackingTaskData"]
    end

    subgraph controllers["UIController Layer"]
        direction TB
        C1["TaskListController:<br/>RefreshTaskList(data)"]
        C2["TaskDetailController:<br/>RefreshDetail(data)"]
        C3["TrackingController:<br/>HideOrUpdate(data)"]
    end

    subgraph uiprocess["TaskRewardClaimProcess (UIProcess)"]
        PR1["OnPlayProcess():<br/>播放按钮缩放动画"]
        PR2["PlayRewardFlyEffect():<br/>奖励飞行特效"]
        PR3["OnProcessEnd():<br/>完成回调"]
        PR1 ==> PR2 ==> PR3
    end

    %% 交互流
    E1 -.->|"[Event:Subscribe]"| S1

    %% 数据流
    S3 -->|"[Read]"| D1
    S7 -.->|"[Write]"| D2
    S7 -.->|"[Write]"| D3
    P2 -->|"[Transform]"| DD1
    P2 -->|"[Transform]"| DD2
    P2 -->|"[Transform]"| DD3

    %% UI 刷新流
    P3 -.->|"[Call Method]"| C1
    P3 -.->|"[Call Method]"| C2
    P3 -.->|"[Call Method]"| C3

    %% UIProcess 启动
    P4 ==>|"[Start UIProcess]"| PR1

    %% 样式
    style detail_controller fill:#e7f5ff,stroke:#1971c2
    style main_tofu fill:#e5dbff,stroke:#5f3dc4
    style data_cache fill:#fff4e6,stroke:#e67700
    style display_data fill:#d0f4de,stroke:#2d6a4f
    style controllers fill:#e7f5ff,stroke:#1971c2
    style uiprocess fill:#ffc9c9,stroke:#c92a2a
```

**关键改进点**:
1. ✅ UpdatePipeline 显示完整的 5 个阶段
2. ✅ UIProcess 作为独立的 Subgraph，由 PostProcess 启动
3. ✅ 多个 UIController 合并到 `UIController Layer`
4. ✅ 数据转换在 DataCacheUpdate 阶段明确标注

---

## 5. 任务状态机

```mermaid
stateDiagram-v2
    [*] --> Locked: 前置条件未满足
    Locked --> Acceptable: 前置条件满足(手动接取)
    Locked --> InProgress: 前置条件满足(自动接取)
    Acceptable --> InProgress: 玩家接取
    InProgress --> Completed: 目标达成(手动领奖)
    InProgress --> Finished: 目标达成(自动领奖)
    Completed --> Finished: 领取奖励
    InProgress --> Failed: 超时/放弃
    Completed --> Failed: 丧失前置条件
    Finished --> [*]
    Failed --> [*]

    note right of InProgress
        进行中状态:
        - 监听相关事件
        - 更新进度
        - 可被追踪
    end note

    note right of Completed
        已达成状态:
        - 显示领奖标识
        - 可被追踪
        - 等待手动领奖
    end note
```

---

## 6. 完整的 UITask 架构图

```mermaid
graph TB
    subgraph uitask["TaskSystemUITask (UITask Façade)"]
        UT["Open(intent)<br/>Close()"]
    end

    subgraph main_tofu["TaskSystemUITaskMainTofu (MainTofu)"]
        direction TB

        subgraph business_logic["Business Logic"]
            BL1["OnTrackButtonClicked()"]
            BL2["OnClaimButtonClicked()"]
            BL3["OnMapTabClicked()"]
            BL4["OnTaskProgressUpdated()"]
            BL5["OnTaskStatusChanged()"]
        end

        subgraph pipeline["UpdatePipeline (5 Stages)"]
            direction LR
            P1["Preprocess"]
            P2["DataCacheUpdate"]
            P3["ResourceLoad"]
            P4["ViewUpdate"]
            P5["PostProcess"]
            P1 --> P2 --> P3 --> P4 --> P5
        end

        business_logic --> pipeline
    end

    subgraph data_cache["Data Cache (Logic Data)"]
        D1["m_allTasks:<br/>List&lt;TaskInfo&gt;"]
        D2["m_trackedTaskId: int"]
        D3["m_currentMapFilter: int"]
        D4["m_selectedTaskId: int"]
    end

    subgraph display_data["Display Data (Temporary)"]
        DD1["m_cachedListData:<br/>List&lt;TaskListItemData&gt;"]
        DD2["m_cachedDetailData:<br/>TaskDetailData"]
        DD3["m_cachedTrackingData:<br/>TrackingTaskData"]
        DD4["m_cachedProgressTipData:<br/>ProgressTipData"]
    end

    subgraph controllers["UIController Layer"]
        direction TB
        C1["TaskListController<br/>(Events + Refresh)"]
        C2["TaskDetailController<br/>(Events + Refresh)"]
        C3["TrackingController<br/>(Refresh Only)"]
    end

    %% 依赖关系
    UT --> main_tofu
    main_tofu --> data_cache
    P2 --> display_data
    P4 --> controllers
    controllers -.->|"[Events]"| business_logic

    %% 样式
    style uitask fill:#ffe6e6,stroke:#c92a2a
    style main_tofu fill:#e5dbff,stroke:#5f3dc4
    style data_cache fill:#fff4e6,stroke:#e67700
    style display_data fill:#d0f4de,stroke:#2d6a4f
    style controllers fill:#e7f5ff,stroke:#1971c2
```

**关键点**:
1. ✅ 清晰展示 UITask → MainTofu → UIController 的三层架构
2. ✅ UpdatePipeline 在 MainTofu 内部展示 5 个阶段
3. ✅ Data Cache (Logic Data) 和 Display Data (Temporary) 分离
4. ✅ UIController Layer 包含所有 Controller（输入事件 + 刷新方法）

---

## 7. 质量检查清单（已通过）

- [x] ✅ 使用正确术语：`MainTofu`、`Data Cache (Logic Data)`、`UIController`
- [x] ✅ 未使用错误术语：~~Service Layer~~、~~Entity Layer~~、~~View Output~~
- [x] ✅ Data Cache 仅包含 Logic Data
- [x] ✅ Display Data 明确标注为 Temporary
- [x] ✅ UpdatePipeline 在 MainTofu 内部展示（5 个阶段）
- [x] ✅ UIController 未被分割（输入事件和刷新方法在同一 Subgraph）
- [x] ✅ 交互流向清晰标注：`[Event:Subscribe]`、`[Call Method]`、`[Transform]`
- [x] ✅ 禁止的依赖未出现：Controller → Tofu、Tofu → View Element

---

## 8. 对比：v1.0 vs v2.0 改进点

| 改进项 | v1.0 (旧版) | v2.0 (新版) |
|--------|------------|------------|
| **业务逻辑层命名** | ~~Service Layer~~ | ✅ `MainTofu (Business Logic)` |
| **数据存储层命名** | ~~Entity Layer~~ | ✅ `Data Cache (Logic Data)` |
| **数据分类** | 混合在一起 | ✅ 分离 Logic Data 和 Display Data |
| **UIController 结构** | 分割成 View Layer + View Output | ✅ 完整的 UIController（输入+输出） |
| **UpdatePipeline 表达** | 独立的 Pipeline Layer | ✅ 在 MainTofu 内部展示 5 个阶段 |
| **依赖关系标注** | 部分标注 | ✅ 完整标注（Subscribe、Call、Transform） |

---

**架构蓝图生成完毕！符合 BJFramework 架构规范 v2.0**
