# 任务系统架构蓝图 (Task System Architecture Blueprint)

**日期**: 2026-02-13
**PRD**: tasksytem.md

---

## 1. ER 数据模型

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
        int status
        int next_task_id
        bool auto_reward
        int accept_type
        int accept_cond_id
        bool is_team_task
    }

    TaskObjective {
        int objective_id PK
        int belong_task_id FK
        int trigger_id FK
        string condition_params
        string target_value
        int current_progress
        string scene_mark_pos
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
        int compare_logic
        int value_type
    }

    TeamTaskInfo {
        int task_id PK
        int team_id
        string shared_members
        string progress_contributors
    }
```

---

## 2. 追踪任务流程蓝图

```mermaid
graph LR
    subgraph view_layer["View Layer: TaskListController"]
        direction LR
        V1["TrackButton: ButtonEx"]
        V2["TaskItemView"]
    end

    subgraph logic_layer["Service Layer: TaskSystemUITaskMainTofu"]
        direction TB
        S1([OnTrackButtonClicked])
        S2{"CheckCanTrack()"}
        S3["GetTask(taskId)"]
        S4{"task.Status<br/>== Finished?"}
        S5["NetTask:<br/>RequestTrackTask"]
        S6["OnNetSuccess:<br/>UpdateTrackedId"]
        S7["SetMask:<br/>RefreshTracking"]
        S8["StartPipeline"]
    end

    subgraph data_layer["Entity Layer: DataCache"]
        direction TB
        D1[("m_trackedTaskId: int")]
        D2[("m_allTasks: List<TaskInfo>")]
        D3[("m_cachedTrackingData:<br/>TrackingTaskData")]
    end

    subgraph pipeline_layer["Pipeline Layer"]
        direction TB
        P1["DataCacheUpdate:<br/>BuildTrackingData"]
        P2["ViewUpdate:<br/>RefreshTracking"]
    end

    subgraph view_output["View Output: TrackingController"]
        direction TB
        VO1["RefreshTracking()"]
        VO2["UpdateObjectives"]
        VO3["ShowSceneMarker"]
    end

    %% 执行流
    V1 -->|"[Event:OnClick]"| S1
    S1 ==> S2
    S2 ==>|"Pass"| S3
    S3 ==> S4
    S4 ==>|"No"| S5
    S4 -->|"Yes"| ERR["Error:<br/>已结束任务不可追踪"]
    S5 ==> S6
    S6 ==> S7
    S7 ==> S8

    %% 数据流
    S3 -->|"[Read]"| D2
    S6 -.->|"[Write]"| D1
    S8 ==> P1
    P1 -->|"[Transform]"| D3
    P1 ==> P2
    P2 -->|"[Bind:Data]"| VO1
    VO1 ==> VO2
    VO1 ==> VO3

    %% 样式
    style view_layer fill:#e7f5ff,stroke:#1971c2
    style logic_layer fill:#e5dbff,stroke:#5f3dc4
    style data_layer fill:#fff4e6,stroke:#e67700
    style pipeline_layer fill:#d0f4de,stroke:#2d6a4f
    style view_output fill:#e7f5ff,stroke:#1971c2
```

---

## 3. 任务进度更新流程蓝图

```mermaid
graph TB
    subgraph event_source["Event Source"]
        direction LR
        E1["PlayerActionEvent<br/><<Event>>"]
        E2["TeamMemberActionEvent<br/><<Event>>"]
    end

    subgraph logic_layer["Service Layer: TaskSystemLogic"]
        direction TB
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
        S11["SetMask:<br/>ShowProgressTip"]
        S12["SetMask:<br/>RefreshClaimable"]
        S13["StartPipeline"]
    end

    subgraph data_layer["Entity Layer"]
        direction TB
        D1[("m_allTasks:<br/>List<TaskInfo>")]
        D2[("TaskObjective:<br/>current_progress")]
        D3[("TaskInfo:<br/>status")]
    end

    subgraph pipeline_layer["Pipeline Layer"]
        direction TB
        P1["DataCacheUpdate:<br/>BuildProgressTip"]
        P2["ViewUpdate:<br/>ShowTip"]
        P3["ViewUpdate:<br/>UpdateDetail"]
    end

    subgraph view_output["View Output"]
        direction TB
        V1["TipManager:<br/>ShowProgressTip"]
        V2["TaskDetailController:<br/>UpdateObjectiveProgress"]
        V3["TrackingController:<br/>HighlightObjective"]
    end

    %% 执行流
    E1 ==>|"[Event:Fire]"| S1
    E2 ==>|"[Event:Fire]"| S1
    S1 ==> S2
    S2 ==>|"Yes"| S3
    S2 -->|"No"| END1["Ignore"]
    S3 ==> S4
    S4 ==>|"Yes"| S5
    S4 -->|"No"| END1
    S5 ==> S6
    S6 ==>|"No"| S7
    S6 ==>|"Yes"| S9
    S7 ==> S8
    S8 ==> S11
    S9 ==> S10
    S10 ==>|"Yes"| S12
    S10 ==>|"No"| S11
    S11 ==> S13
    S12 ==> S13

    %% 数据流
    S3 -->|"[Read]"| D1
    S5 -.->|"[Write]"| D2
    S8 -.->|"[Write]"| D2
    S9 -.->|"[Write]"| D3
    S13 ==> P1
    P1 ==> P2
    P1 ==> P3
    P2 -->|"[Call]"| V1
    P3 -->|"[Call]"| V2
    P3 -->|"[Call]"| V3

    %% 样式
    style event_source fill:#ffd8a8,stroke:#d9480f
    style logic_layer fill:#e5dbff,stroke:#5f3dc4
    style data_layer fill:#fff4e6,stroke:#e67700
    style pipeline_layer fill:#d0f4de,stroke:#2d6a4f
    style view_output fill:#e7f5ff,stroke:#1971c2
```

---

## 4. 领取奖励流程蓝图

```mermaid
graph LR
    subgraph view_layer["View: TaskDetailController"]
        V1["ClaimButton:<br/>ButtonEx"]
    end

    subgraph logic_layer["Service: MainTofu"]
        direction TB
        S1([OnClaimButtonClicked])
        S2{"CheckCanClaim()"}
        S3["GetTask"]
        S4{"Status ==<br/>Completed?"}
        S5{"HasReward?"}
        S6["NetTask:<br/>RequestClaimReward"]
        S7["OnSuccess:<br/>UpdateStatus"]
        S8["SetMask:<br/>RefreshAll"]
        S9["StartPipeline"]
        S10["PlayUIProcess:<br/>RewardClaimProcess"]
    end

    subgraph data_layer["Entity: DataCache"]
        D1[("m_allTasks")]
        D2[("TaskInfo.status")]
        D3[("TaskReward.is_claimed")]
    end

    subgraph pipeline_layer["Pipeline"]
        P1["DataCacheUpdate"]
        P2["ViewUpdate"]
    end

    subgraph view_output["View Output"]
        VO1["TaskListController:<br/>RefreshTaskList"]
        VO2["TaskDetailController:<br/>RefreshDetail"]
        VO3["TrackingController:<br/>HideOrUpdate"]
    end

    subgraph process_layer["UIProcess"]
        PR1["TaskRewardClaimProcess:<br/>播放领奖动画"]
    end

    %% 执行流
    V1 -->|"[Event:OnClick]"| S1
    S1 ==> S2
    S2 ==>|"Pass"| S3
    S3 ==> S4
    S4 ==>|"Yes"| S5
    S4 -->|"No"| ERR1["Error"]
    S5 ==>|"Yes"| S6
    S5 -->|"No"| ERR2["Error"]
    S6 ==> S7
    S7 ==> S8
    S8 ==> S9
    S9 ==> P1
    P1 ==> P2
    P2 ==> S10

    %% 数据流
    S3 -->|"[Read]"| D1
    S7 -.->|"[Write]"| D2
    S7 -.->|"[Write]"| D3
    P2 -->|"[Call]"| VO1
    P2 -->|"[Call]"| VO2
    P2 -->|"[Call]"| VO3
    S10 ==> PR1

    %% 样式
    style view_layer fill:#e7f5ff,stroke:#1971c2
    style logic_layer fill:#e5dbff,stroke:#5f3dc4
    style data_layer fill:#fff4e6,stroke:#e67700
    style pipeline_layer fill:#d0f4de,stroke:#2d6a4f
    style view_output fill:#e7f5ff,stroke:#1971c2
    style process_layer fill:#ffc9c9,stroke:#c92a2a
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

## 6. 质量检查清单

- [x] **Subgraph 有明确的框架角色标注**
  - view_layer、logic_layer、data_layer、pipeline_layer 都有标注

- [x] **连线标签包含代码生成参数**
  - [Event:OnClick]、[Read]、[Write]、[Bind:Data]、[Call]

- [x] **节点 ID 为合法 C# 变量名**
  - S1, S2, D1, V1, P1 等都是合法标识符

- [x] **执行流逻辑闭环**
  - 所有流程都有明确的起点和终点，包括错误处理分支

---

**架构蓝图生成完毕！**
