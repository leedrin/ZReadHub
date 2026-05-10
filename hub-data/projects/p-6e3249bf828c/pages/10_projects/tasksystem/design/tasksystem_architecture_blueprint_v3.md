# 任务系统架构蓝图 (Task System Architecture Blueprint) - v3.0

**日期**: 2026-02-13
**PRD**: tasksytem.md
**版本**: v3.0 - 符合 BJFramework 双 Controller 架构

---

## ️核心架构理解

BJFramework 采用**类 MVC 架构**，将 Controller 分离为：
- **Tofu** = Logic Controller（逻辑控制器）
- **UIController** = View Controller（视图控制器）

```
UITask (Façade)
├── Tofu (Logic Controller)
│   ├── 处理业务逻辑
│   ├── 与 Service/DataCache 交互
│   ├── UpdatePipeline (5 stages)
│   └── 调用 UIController 刷新
└── UIController (View Controller)
    ├── 处理 UI 显示
    ├── 接收用户输入
    └── 抛出事件给 Tofu
```

---

## 1. ER 数据模型 (Logic Data - 存储在 Service/DataCache)

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

---

## 2. 追踪任务流程蓝图（体现双 Controller 架构）

```mermaid
graph TB
    subgraph uitask["TaskSystemUITask (UITask Façade)"]
        direction TB

        subgraph tofu["TaskSystemUITaskMainTofu (Tofu - Logic Controller)"]
            direction TB

            subgraph tofu_logic["Business Logic"]
                T1([OnTrackButtonClicked])
                T2{"CheckCanTrack()"}
                T3["GetTask(taskId)"]
                T4{"task.Status<br/>!= Finished?"}
                T5["NetTask:<br/>RequestTrackTask"]
                T6["OnNetSuccess:<br/>UpdateTrackedId"]
                T7["SetMask:<br/>RefreshTracking"]
                T8["StartPipeline"]

                T1 ==> T2 ==>|"Pass"| T3 ==> T4
                T4 ==>|"Yes"| T5 ==> T6 ==> T7 ==> T8
                T4 -->|"No"| TERR["ShowTip:<br/>已结束任务不可追踪"]
            end

            subgraph tofu_pipeline["UpdatePipeline (5 Stages)"]
                direction LR
                TP1["DataCacheUpdate:<br/>BuildTrackingData"]
                TP2["ViewUpdate:<br/>CallControllerRefresh"]
                TP1 ==> TP2
            end

            T8 ==> TP1
        end

        subgraph task_list_ctrl["TaskListController (UIController - View Controller)"]
            V1["TrackButton: ButtonEx"]
            E1["OnTrackButtonClicked<br/>UnityEvent&lt;int&gt;"]
            M1["RefreshTaskList(data)"]
            V1 -->|"User Click"| E1
        end

        subgraph tracking_ctrl["TrackingController (UIController - View Controller)"]
            M2["RefreshTracking(data)"]
            M3["UpdateObjectives()"]
            M2 ==> M3
        end
    end

    subgraph service["Service / DataCache"]
        DC1["TaskSystemDC:<br/>m_allTasks"]
        DC2["TaskSystemDC:<br/>m_trackedTaskId"]
    end

    subgraph display_data["Display Data (Tofu Temporary)"]
        DD["m_cachedTrackingData:<br/>TrackingTaskData"]
    end

    %% 交互流
    E1 -.->|"[Event:Subscribe]"| T1

    %% 数据流
    T3 -->|"[Read]"| DC1
    T6 -.->|"[Write]"| DC2
    TP1 -->|"[Transform]"| DD
    TP2 -.->|"[Call Method]"| M2

    %% 样式
    style uitask fill:#ffe6e6,stroke:#c92a2a
    style tofu fill:#e5dbff,stroke:#5f3dc4
    style task_list_ctrl fill:#e7f5ff,stroke:#1971c2
    style tracking_ctrl fill:#e7f5ff,stroke:#1971c2
    style service fill:#fff4e6,stroke:#e67700
    style display_data fill:#d0f4de,stroke:#2d6a4f
```

**关键架构点**:
1. ✅ UITask 包含 Tofu 和 UIController（体现 Façade 外观模式）
2. ✅ Tofu 标注为 "Logic Controller"（逻辑控制器）
3. ✅ UIController 标注为 "View Controller"（视图控制器）
4. ✅ Service/DataCache 作为底层数据服务
5. ✅ Display Data 标注为 "Tofu Temporary"（在 Tofu 中临时构建）

---

## 3. 任务进度更新流程蓝图（体现双 Controller 架构）

```mermaid
graph TB
    subgraph event_source["Event Source"]
        E1["PlayerActionEvent<br/><<Event>>"]
        E2["TeamMemberActionEvent<br/><<Event>>"]
    end

    subgraph uitask["TaskSystemUITask (UITask Façade)"]
        direction TB

        subgraph tofu["TaskSystemUITaskMainTofu (Tofu - Logic Controller)"]
            direction TB

            subgraph tofu_logic["Business Logic"]
                T1([OnPlayerActionEvent])
                T2{"IsInProgressTask?"}
                T3["GetMatchingTasks"]
                T4{"CheckParams<br/>Match?"}
                T5["CalculateNewProgress"]
                T6{"IsObjective<br/>Completed?"}
                T7["NetTask:<br/>UpdateTaskProgress"]
                T8["OnNetSuccess:<br/>UpdateCache"]
                T9["CheckAllObjectives"]
                T10{"IsTask<br/>Completed?"}
                T11["SetMask:<br/>ShowProgressTip<br/>+ RefreshTracking"]
                T12["SetMask:<br/>RefreshTaskList<br/>+ RefreshClaimableIcon"]
                T13["StartPipeline"]

                T1 ==> T2 ==>|"Yes"| T3 ==> T4
                T2 -->|"No"| END1["Ignore"]
                T4 ==>|"Yes"| T5 ==> T6
                T4 -->|"No"| END1
                T6 ==>|"No"| T7 ==> T8 ==> T11 ==> T13
                T6 ==>|"Yes"| T9 ==> T10
                T10 ==>|"Yes"| T12 ==> T13
                T10 ==>|"No"| T11
            end

            subgraph tofu_pipeline["UpdatePipeline (5 Stages)"]
                direction LR
                TP1["DataCacheUpdate:<br/>BuildProgressTipData"]
                TP2["ViewUpdate:<br/>ShowTip +<br/>RefreshControllers"]
                TP1 ==> TP2
            end

            T13 ==> TP1
        end

        subgraph controllers["UIControllers (View Controllers)"]
            direction TB
            C1["TipManager"]
            C2["TaskDetailController"]
            C3["TrackingController"]
        end
    end

    subgraph service["Service / DataCache"]
        DC1["TaskSystemDC:<br/>m_allTasks"]
        DC2["objective.current_progress"]
        DC3["task.status"]
    end

    subgraph display_data["Display Data (Tofu Temporary)"]
        DD1["m_cachedProgressTipData"]
        DD2["m_cachedListData"]
    end

    %% 执行流
    E1 ==>|"[Event:Fire]"| T1
    E2 ==>|"[Event:Fire]"| T1

    %% 数据流
    T3 -->|"[Read]"| DC1
    T5 -.->|"[Write]"| DC2
    T8 -.->|"[Write]"| DC2
    T9 -.->|"[Write]"| DC3
    TP1 -->|"[Transform]"| DD1
    TP1 -->|"[Transform]"| DD2

    %% UI 刷新流
    TP2 -.->|"[Call Method]"| C1
    TP2 -.->|"[Call Method]"| C2
    TP2 -.->|"[Call Method]"| C3

    %% 样式
    style event_source fill:#ffd8a8,stroke:#d9480f
    style uitask fill:#ffe6e6,stroke:#c92a2a
    style tofu fill:#e5dbff,stroke:#5f3dc4
    style controllers fill:#e7f5ff,stroke:#1971c2
    style service fill:#fff4e6,stroke:#e67700
    style display_data fill:#d0f4de,stroke:#2d6a4f
```

---

## 4. 领取奖励流程蓝图（体现双 Controller 架构）

```mermaid
graph TB
    subgraph uitask["TaskSystemUITask (UITask Façade)"]
        direction TB

        subgraph tofu["TaskSystemUITaskMainTofu (Tofu - Logic Controller)"]
            direction TB

            subgraph tofu_logic["Business Logic"]
                T1([OnClaimButtonClicked])
                T2{"CheckCanClaim()"}
                T3["GetTask(taskId)"]
                T4{"Status ==<br/>Completed?"}
                T5{"HasReward?"}
                T6["NetTask:<br/>RequestClaimReward"]
                T7["OnSuccess:<br/>UpdateTaskStatus"]
                T8["SetMask:<br/>RefreshAll"]
                T9["StartPipeline"]

                T1 ==> T2 ==>|"Pass"| T3 ==> T4
                T4 ==>|"Yes"| T5
                T4 -->|"No"| TERR1["ShowTip:<br/>任务未完成"]
                T5 ==>|"Yes"| T6
                T5 -->|"No"| TERR2["ShowTip:<br/>无奖励"]
                T6 ==> T7 ==> T8 ==> T9
            end

            subgraph tofu_pipeline["UpdatePipeline (5 Stages)"]
                direction LR
                TP1["1.Preprocess:<br/>LockUI"]
                TP2["2.DataCacheUpdate:<br/>RebuildAllData"]
                TP3["3.ResourceLoad:<br/>LoadIcons"]
                TP4["4.ViewUpdate:<br/>RefreshControllers"]
                TP5["5.PostProcess:<br/>PlayUIProcess"]

                TP1 ==> TP2 ==> TP3 ==> TP4 ==> TP5
            end

            T9 ==> TP1
        end

        subgraph detail_ctrl["TaskDetailController (UIController - View Controller)"]
            V1["ClaimButton: ButtonEx"]
            E1["OnClaimButtonClicked<br/>UnityEvent&lt;int&gt;"]
            M1["RefreshDetail(data)"]
            V1 -->|"User Click"| E1
        end

        subgraph list_ctrl["TaskListController (UIController - View Controller)"]
            M2["RefreshTaskList(data)"]
        end

        subgraph tracking_ctrl["TrackingController (UIController - View Controller)"]
            M3["HideOrUpdate(data)"]
        end
    end

    subgraph service["Service / DataCache"]
        DC1["TaskSystemDC:<br/>m_allTasks"]
        DC2["task.status"]
        DC3["reward.is_claimed"]
    end

    subgraph display_data["Display Data (Tofu Temporary)"]
        DD1["m_cachedListData"]
        DD2["m_cachedDetailData"]
        DD3["m_cachedTrackingData"]
    end

    subgraph uiprocess["TaskRewardClaimProcess (UIProcess)"]
        PR1["OnPlayProcess():<br/>播放按钮缩放动画"]
        PR2["PlayRewardFlyEffect():<br/>奖励飞行特效"]
        PR3["OnProcessEnd()"]
        PR1 ==> PR2 ==> PR3
    end

    %% 交互流
    E1 -.->|"[Event:Subscribe]"| T1

    %% 数据流
    T3 -->|"[Read]"| DC1
    T7 -.->|"[Write]"| DC2
    T7 -.->|"[Write]"| DC3
    TP2 -->|"[Transform]"| DD1
    TP2 -->|"[Transform]"| DD2
    TP2 -->|"[Transform]"| DD3

    %% UI 刷新流
    TP4 -.->|"[Call Method]"| M1
    TP4 -.->|"[Call Method]"| M2
    TP4 -.->|"[Call Method]"| M3

    %% UIProcess 启动
    TP5 ==>|"[Start UIProcess]"| PR1

    %% 样式
    style uitask fill:#ffe6e6,stroke:#c92a2a
    style tofu fill:#e5dbff,stroke:#5f3dc4
    style detail_ctrl fill:#e7f5ff,stroke:#1971c2
    style list_ctrl fill:#e7f5ff,stroke:#1971c2
    style tracking_ctrl fill:#e7f5ff,stroke:#1971c2
    style service fill:#fff4e6,stroke:#e67700
    style display_data fill:#d0f4de,stroke:#2d6a4f
    style uiprocess fill:#ffc9c9,stroke:#c92a2a
```

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

## 6. 完整的 UITask 架构图（体现双 Controller）

```mermaid
graph TB
    subgraph uitask["TaskSystemUITask (UITask Façade)"]
        direction TB
        UT["Open(intent)<br/>Close()"]

        subgraph tofu["TaskSystemUITaskMainTofu (Tofu - Logic Controller)"]
            direction TB

            subgraph tofu_business["Business Logic"]
                BL1["OnTrackButtonClicked()"]
                BL2["OnClaimButtonClicked()"]
                BL3["OnMapTabClicked()"]
                BL4["OnTaskProgressUpdated()"]
                BL5["OnTaskStatusChanged()"]
            end

            subgraph tofu_pipeline["UpdatePipeline (5 Stages)"]
                direction LR
                P1["1.Preprocess"]
                P2["2.DataCacheUpdate"]
                P3["3.ResourceLoad"]
                P4["4.ViewUpdate"]
                P5["5.PostProcess"]
                P1 --> P2 --> P3 --> P4 --> P5
            end

            tofu_business --> tofu_pipeline
        end

        subgraph controllers["UIControllers (View Controllers)"]
            direction TB
            C1["TaskListController<br/>(Events + Refresh)"]
            C2["TaskDetailController<br/>(Events + Refresh)"]
            C3["TrackingController<br/>(Refresh Only)"]
        end

        UT --> tofu
        UT --> controllers
        tofu -.->|"Call Refresh"| controllers
        controllers -.->|"Fire Events"| tofu_business
    end

    subgraph service["Service / DataCache"]
        DC1["TaskSystemDC:<br/>m_allTasks"]
        DC2["TaskSystemDC:<br/>m_trackedTaskId"]
        DC3["TaskSystemDC:<br/>m_currentMapFilter"]
        DC4["TaskSystemDC:<br/>m_selectedTaskId"]
    end

    subgraph display_data["Display Data (Tofu Temporary)"]
        DD1["m_cachedListData:<br/>List&lt;TaskListItemData&gt;"]
        DD2["m_cachedDetailData:<br/>TaskDetailData"]
        DD3["m_cachedTrackingData:<br/>TrackingTaskData"]
        DD4["m_cachedProgressTipData:<br/>ProgressTipData"]
    end

    %% 依赖关系
    tofu --> service
    P2 --> display_data
    P4 --> controllers

    %% 样式
    style uitask fill:#ffe6e6,stroke:#c92a2a
    style tofu fill:#e5dbff,stroke:#5f3dc4
    style controllers fill:#e7f5ff,stroke:#1971c2
    style service fill:#fff4e6,stroke:#e67700
    style display_data fill:#d0f4de,stroke:#2d6a4f
```

**关键架构点**:
1. ✅ UITask 作为 Façade，包含 Tofu 和 UIController
2. ✅ Tofu 是 Logic Controller，包含 Business Logic + UpdatePipeline
3. ✅ UIController 是 View Controller，包含 Events + Refresh Methods
4. ✅ Service/DataCache 存储 Logic Data
5. ✅ Display Data 在 Tofu 中临时构建
6. ✅ 双向依赖：Controllers → Tofu (Events), Tofu → Controllers (Call Refresh)

---

## 7. 质量检查清单（已通过）

- [x] ✅ UITask 作为 Façade，包含 Tofu 和 UIController
- [x] ✅ Tofu 标注为 "Logic Controller"
- [x] ✅ UIController 标注为 "View Controller"
- [x] ✅ Service/DataCache 作为独立层
- [x] ✅ Logic Data 存储在 Service/DataCache
- [x] ✅ Display Data 标注为 "Tofu Temporary"
- [x] ✅ UpdatePipeline 在 Tofu 内部展示（5 个阶段）
- [x] ✅ 交互流向清晰：UIController Event → Tofu Subscribe
- [x] ✅ 刷新流向清晰：Tofu → UIController Method
- [x] ✅ 禁止的依赖未出现：UIController → Tofu Method, UIController → Service

---

## 8. 对比：v2.0 vs v3.0 改进点

| 改进项 | v2.0 (旧版) | v3.0 (新版) |
|--------|------------|------------|
| **架构理解** | Tofu 和 UIController 平行 | ✅ Tofu 和 UIController 都在 UITask 内部 |
| **Tofu 定位** | Business Logic Layer | ✅ Logic Controller（逻辑控制器） |
| **UIController 定位** | Pure View Layer | ✅ View Controller（视图控制器） |
| **双 Controller 体现** | 未明确体现 | ✅ 清晰标注两个 Controller 的职责 |
| **Logic Data 存储** | Data Cache | ✅ Service / DataCache（更明确） |
| **架构图嵌套** | Tofu 和 UIController 分离 | ✅ Tofu 和 UIController 都在 UITask 内部 |

---

**架构蓝图生成完毕！符合 BJFramework 双 Controller 架构 v3.0**
