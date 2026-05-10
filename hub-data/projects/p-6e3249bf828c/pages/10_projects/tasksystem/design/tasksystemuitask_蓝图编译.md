# TaskSystem 蓝图编译输出 (BJFramework Blueprint Compiler)

## Step 1: 语义提取 (Semantic Extraction)

### 核心元素识别表

| 类型 | 元素名称 | BJFramework映射 | 角色标注 |
|------|----------|-----------------|----------|
| **名词** | TaskInfo | `<<Entity>>` | 任务基础数据 |
| **名词** | TaskObjective | `<<Entity>>` | 任务目标数据 |
| **名词** | TaskStatus | `<<Entity>>` | 状态枚举值 |
| **名词** | TaskProgress | `<<Entity>>` | 进度缓存 |
| **动词** | AcceptTask | `<<Service>>` | 接取任务逻辑 |
| **动词** | ClaimReward | `<<Service>>` | 领取奖励逻辑 |
| **动词** | TrackTask | `<<Service>>` | 追踪任务逻辑 |
| **动词** | UpdateProgress | `<<Service>>` | 进度更新逻辑 |
| **反馈** | TaskListView | `<<View>>` | 任务列表UI |
| **反馈** | TaskDetailView | `<<View>>` | 任务详情UI |
| **反馈** | ProgressTips | `<<View>>` | 进度提示UI |
| **消息** | OnTaskClick | `<<Event>>` | 点击事件 |
| **消息** | OnProgressUpdate | `<<Event>>` | 进度更新事件 |

---

## Step 2: ER模型 (Entity Relationship)

```mermaid
erDiagram
    TASK_INFO {
        int task_id PK
        string task_name
        string task_desc
        int task_type "主线/地图"
        int status "Locked/Acceptable/InProgress/Achieved/Finished/Invalid"
        bool is_team_task
        bool auto_reward
        int accept_type "Auto/Manual"
        int next_task_id FK
    }
    
    TASK_OBJECTIVE {
        int objective_id PK
        int belong_task_id FK
        int trigger_id
        string condition_params
        string target_value
        int value_type "累加/单次/集合"
        string scene_mark_pos
    }
    
    TASK_PROGRESS {
        int task_id PK
        int current_progress
        int target_value
        bool is_completed
    }
    
    TASK_TRACK {
        int tracked_task_id PK
        int map_id
        Vector3 mark_position
    }
    
    REWARD_INFO {
        int reward_id PK
        int task_id FK
        int item_id
        int quantity
    }
    
    MAP_TASK_GROUP {
        int map_id PK
        string map_name
        bool is_expanded
    }
    
    TASK_INFO ||--o{ TASK_OBJECTIVE : "contains"
    TASK_INFO ||--o{ TASK_PROGRESS : "tracks"
    TASK_INFO ||--o{ REWARD_INFO : "rewards"
    MAP_TASK_GROUP ||--o{ TASK_INFO : "groups"
    TASK_INFO ||--|| TASK_TRACK : "tracks"
```

---

## Step 3: 蓝图拓扑 (Blueprint Topology)

### 主执行流：任务接取流程

```mermaid
graph LR
    subgraph view_layer["View: TaskListPanel"]
        direction TB
        V1["m_TaskItemBtn: Button"] 
        V2["m_AcceptBtn: Button"]
        V3["m_TaskListScroll: LoopScrollRect"]
    end
    
    subgraph logic_layer["Service: TaskMainTofu"]
        direction TB
        S1([OnTaskItemClick]) ==> S2["SelectTask(taskId)"]
        S2 ==> S3["UpdateContextSetup"]
        S3 ==> S4{"CheckAcceptCondition"}
        S4 --"true"--> S5["ShowAcceptButton"]
        S4 --"false"--> S6["HideAcceptButton"]
        
        S7([OnAcceptButtonClick]) ==> S8{"CheckCanAccept"}
        S8 --"Pass"--> S9["TaskAcceptReqNetTask"]
        S9 --"Success"--> S10["LaunchPipeline"]
        S10 ==> S11["RefreshTaskList | RefreshDetail"]
        S8 --"Fail"--> S12["ShowErrorTip"]
    end
    
    subgraph data_layer["Entity: DataCache"]
        direction TB
        D1[("m_MapTaskGroups: List")]
        D2[("m_SelectedTaskId: int")]
        D3[("m_SelectedTaskDetail: TaskDetailInfo")]
        D4[("PlayerGO: IPlayerGameObject")]
    end
    
    subgraph network_layer["Network: NetTask"]
        N1["TaskAcceptReqNetTask"]
        N2["TaskClaimRewardReqNetTask"]
    end
    
    %% View -> Logic (Event触发)
    V1 -->|"[Event:OnClick]"| S1
    V2 -->|"[Event:OnClick]"| S7
    
    %% Logic -> Data (数据读写)
    S2 -.->|"[Write]"| D2
    S4 -.->|"[Read]"| D4
    S9 -.->|"[Invoke]"| N1
    
    %% Data -> View (绑定刷新)
    D1 -->|"[Bind:OneWay]"| V3
    D3 -->|"[Bind:OneWay]"| V2
    
    %% 样式
    style view_layer fill:#e7f5ff,stroke:#1971c2
    style logic_layer fill:#e5dbff,stroke:#5f3dc4
    style data_layer fill:#fff4e6,stroke:#e67700
    style network_layer fill:#d3f9d8,stroke:#2f9e44
```

---

### 主执行流：领取奖励流程

```mermaid
graph LR
    subgraph view_layer["View: TaskDetailPanel"]
        V1["m_ClaimRewardBtn: ButtonEx"]
        V2["m_RewardListRoot: Transform"]
        V3["m_CompleteTips: GameObject"]
    end
    
    subgraph logic_layer["Service: TaskMainTofu"]
        S1([OnClaimButtonClick]) ==> S2{"CheckCanClaim"}
        S2 --"Pass"--> S3["TaskClaimRewardReqNetTask"]
        S3 --"Success"--> S4["LaunchPipeline"]
        S4 ==> S5["PlayCompleteTips"]
        S5 ==> S6["RefreshAll"]
        S2 --"Fail"--> S7["ShowErrorTip"]
    end
    
    subgraph data_layer["Entity: TaskDetail"]
        D1[("Status: TaskStatus")]
        D2[("Rewards: List<RewardInfo>")]
    end
    
    subgraph network_layer["Network"]
        N1["TaskClaimRewardReqNetTask"]
    end
    
    V1 -->|"[Event:OnClick]"| S1
    S2 -.->|"[Read:Status]"| D1
    S3 -.->|"[Invoke]"| N1
    S5 ==> V3
    S6 -.->|"[Write]"| D1
    
    style view_layer fill:#e7f5ff,stroke:#1971c2
    style logic_layer fill:#e5dbff,stroke:#5f3dc4
    style data_layer fill:#fff4e6,stroke:#e67700
```

---

### 主执行流：任务追踪流程

```mermaid
graph LR
    subgraph view_layer["View: TaskListItem"]
        V1["m_TrackBtn: ButtonEx"]
        V2["m_TrackIcon: Image"]
        V3["m_SelectedHighlight: GameObject"]
    end
    
    subgraph logic_layer["Service: TaskTrackService"]
        S1([OnTrackButtonClick]) ==> S2["ToggleTrackState"]
        S2 ==> S3{"IsTracking?"}
        S3 --"Yes"--> S4["UntrackTask"]
        S3 --"No"--> S5["TrackTask"]
        S4 ==> S6["RefreshTrackState"]
        S5 ==> S6
        S6 ==> S7["UpdateSceneMark"]
    end
    
    subgraph data_layer["Entity: TrackState"]
        D1[("m_TrackedTaskId: int")]
        D2[("m_SceneMarkPos: Vector3")]
    end
    
    subgraph scene_layer["Scene: WorldMap"]
        SC1["SceneMarkController"]
        SC2["MinimapIcon"]
    end
    
    V1 -->|"[Event:OnClick]"| S1
    S2 -.->|"[Read/Write]"| D1
    S6 -.->|"[Write]"| D1
    D1 -->|"[Bind]"| V2
    S7 -.->|"[Bind:Position]"| D2
    D2 -->|"[Event:PositionUpdate]"| SC1
    D2 -->|"[Event:PositionUpdate]"| SC2
    
    style view_layer fill:#e7f5ff,stroke:#1971c2
    style logic_layer fill:#e5dbff,stroke:#5f3dc4
    style data_layer fill:#fff4e6,stroke:#e67700
    style scene_layer fill:#ffe7cc,stroke:#d9480f
```

---

### 数据流：Pipeline更新管线

```mermaid
graph TB
    subgraph pipeline["UpdatePipeline: TaskMainTofu"]
        P1([StartPipeline]) ==> P2[UpdateContextSetup]
        P2 ==> P3{DataCacheUpdateIsNeeded}
        P3 --"true"--> P4[DataCacheUpdate]
        P3 --"false"--> P5[Skip]
        P4 ==> P6[FetchFromPlayerGO]
        P6 ==> P7[BuildMapTaskGroups]
        P7 ==> P8[BuildSelectedDetail]
        P8 ==> P9{DynamicResLoadIsNeeded}
        P9 --"true"--> P10[DynamicResCollect4Load]
        P9 --"false"--> P11[Skip]
        P10 ==> P12[LoadIcons]
        P12 ==> P13[ViewUpdate]
        P11 ==> P13
        P5 ==> P13
        
        P13 ==> P14{CheckMask}
        P14 --"RefreshTaskList"--> P15[Call TaskListRefresh]
        P14 --"RefreshDetail"--> P16[Call DetailPanelRefresh]
        P14 --"RefreshTrack"--> P17[Call TrackStateRefresh]
        P14 --"PlayAnimation"--> P18[Play UIProcess]
        
        P15 ==> P19([PipelineEnd])
        P16 ==> P19
        P17 ==> P19
        P18 ==> P19
    end
    
    subgraph data_cache["DataCache"]
        D1[MapTaskGroups]
        D2[SelectedTaskDetail]
        D3[TrackedTaskId]
    end
    
    P4 -.->|"[Write]"| D1
    P4 -.->|"[Write]"| D2
    P7 -.->|"[Write]"| D1
    P8 -.->|"[Write]"| D2
    
    P15 -.->|"[Read]"| D1
    P16 -.->|"[Read]"| D2
    P17 -.->|"[Read]"| D3
    
    style pipeline fill:#e5dbff,stroke:#5f3dc4
    style data_cache fill:#fff4e6,stroke:#e67700
```

---

### 状态机：任务状态转换

```mermaid
stateDiagram-v2
    [*] --> Locked: 初始化
    
    subgraph entity_state["<<Entity>> TaskState"]
        Locked
        Acceptable
        InProgress
        Achieved
        Finished
        Invalid
    end
    
    subgraph service_transition["<<Service>> StateTransition"]
        CheckAcceptCondition
        CheckCanAccept
        CheckCanClaim
        CheckProgressComplete
    end
    
    Locked --> Acceptable: 前置条件满足
    Locked --> InProgress: 自动接取
    Acceptable --> InProgress: 手动接取\nCheckCanAccept
    Acceptable --> Invalid: 超时
    InProgress --> Achieved: 进度达标\n+手动领奖
    InProgress --> Finished: 进度达标\n+自动领奖
    InProgress --> Invalid: 超时/放弃
    Achieved --> Finished: 手动领奖\nCheckCanClaim
    Achieved --> Invalid: 超时
    Finished --> [*]
    Invalid --> [*]
    
    CheckAcceptCondition --> Locked: false
    CheckAcceptCondition --> Acceptable: true
    CheckCanAccept --> InProgress: Pass
    CheckCanClaim --> Finished: Pass
    CheckProgressComplete --> Achieved: true
    CheckProgressComplete --> InProgress: false
```

---

## Step 4: 元数据校验清单

### ✅ 质量检查清单 (Checklist)

| 检查项 | 状态 | 说明 |
|--------|------|------|
| **Subgraph角色标注** | ✅ | 所有subgraph都有明确的框架角色(View/Service/Data/Network/Scene) |
| **连线标签参数** | ✅ | 包含[Event:Type]、[Bind:Path]、[Read/Write]等代码生成参数 |
| **节点ID合法性** | ✅ | 所有节点ID符合C#变量命名规范(无空格，无特殊字符) |
| **执行流逻辑闭环** | ✅ | 所有==>执行流都有明确的起点和终点 |
| **语义标签(Stereotypes)** | ✅ | 所有关键节点使用<< >>标注(Entity/Service/View/Event) |
| **色彩规范** | ✅ | Logic紫色(#e5dbff)、Entity黄色(#fff4e6)、View蓝色(#e7f5ff) |

---

## Step 5: 代码映射示例

基于蓝图编译结果，以下是可直接映射的C#代码结构：

### Entity 映射

```csharp
// <<Entity>> TaskInfo
public class TaskInfo
{
    public int TaskId { get; set; }          // PK
    public string TaskName { get; set; }
    public string TaskDesc { get; set; }
    public TaskType TaskType { get; set; }   // 主线/地图
    public TaskStatus Status { get; set; }   // Locked/Acceptable/InProgress...
    public bool IsTeamTask { get; set; }
    public bool AutoReward { get; set; }
    public AcceptType AcceptType { get; set; }
    public int NextTaskId { get; set; }      // FK
}

// <<Entity>> TaskObjective
public class TaskObjective
{
    public int ObjectiveId { get; set; }     // PK
    public int BelongTaskId { get; set; }    // FK -> TaskInfo
    public int TriggerId { get; set; }
    public string ConditionParams { get; set; }
    public string TargetValue { get; set; }
    public ProgressType ValueType { get; set; }  // 累加/单次/集合
    public string SceneMarkPos { get; set; }
}
```

### Service 映射

```csharp
// <<Service>> TaskMainTofu
public partial class TaskMainUITaskCompMainTofu : UITaskCompTofuBase
{
    // DataCache (Entity)
    private TaskMainTofuDataCache m_dataCache;
    
    // Service Methods
    private void OnAcceptButtonClick(int taskId)
    {
        // CheckCanAccept
        if (!CheckCanAccept(taskId, out var error))
        {
            ShowErrorTip(error);
            return;
        }
        
        // NetTask
        var netTask = new TaskAcceptReqNetTask(taskId);
        netTask.EventOnStop += task =>
        {
            // LaunchPipeline
            var info = m_compUpdatePipelineManager.UpdatePipelineInitInfoAlloc();
            info.m_customParamDict.SetParam(ParamKeyPipelineUpdateMask, 
                PipelineUpdateMask.RefreshTaskList | PipelineUpdateMask.RefreshDetailPanel);
            m_compUpdatePipelineManager.UpdatePipelineLaunch(info);
        };
        netTask.Start();
    }
}
```

### View 映射

```csharp
// <<View>> TaskMainUIController
public partial class TaskMainUIController : UIControllerBase
{
    // [AutoBind] 对应蓝图中的 [Bind:Path]
    [AutoBind("TaskListScroll")]
    private LoopVerticalScrollRect m_taskListScroll;
    
    [AutoBind("DetailPanel")]
    private GameObject m_detailPanelRoot;
    
    // [Event] 对应蓝图中的 [Event:OnClick]
    public event Action<int> EventOnTaskItemClick;
    public event Action<int> EventOnAcceptButtonClick;
    
    // Service Call
    public void TaskListRefresh(List<MapTaskGroup> mapGroups, int currentMapId)
    {
        // 执行数据绑定
    }
}
```

---

## 附录：蓝图完整拓扑总图

```mermaid
graph TB
    subgraph UITaskContainer["TaskMainUITask <<Container>>"]
        direction TB
        
        subgraph ViewLayer["View Layer <<View>>"]
            V1[TaskListPanel]
            V2[TaskDetailPanel]
            V3[ProgressTips]
        end
        
        subgraph LogicLayer["Logic Layer <<Service>>"]
            L1[TaskMainTofu]
            L2[TaskAcceptService]
            L3[TaskClaimService]
            L4[TaskTrackService]
        end
        
        subgraph DataLayer["Data Layer <<Entity>>"]
            D1[TaskInfo]
            D2[TaskObjective]
            D3[TaskProgress]
            D4[TaskTrack]
        end
        
        subgraph NetworkLayer["Network Layer"]
            N1[TaskAcceptReqNetTask]
            N2[TaskClaimRewardReqNetTask]
        end
    end
    
    %% 外部依赖
    PlayerGO[(PlayerGO)]
    SceneMark[SceneMarkController]
    
    %% 连接关系
    V1 -->|"[Event:OnClick]"| L1
    L1 ==> L2
    L2 -.->|"[Read]"| D1
    L2 -.->|"[Invoke]"| N1
    N1 -.->|"[Write]"| D3
    D3 -.->|"[Bind]"| V1
    
    L1 ==> L4
    L4 -.->|"[Read/Write]"| D4
    D4 -->|"[Bind:Position]"| SceneMark
    
    V2 -->|"[Event:OnClick]"| L3
    L3 -.->|"[Invoke]"| N2
    N2 -.->|"[Write]"| D1
    
    L1 -.->|"[Fetch]"| PlayerGO
    
    %% 样式
    style ViewLayer fill:#e7f5ff,stroke:#1971c2
    style LogicLayer fill:#e5dbff,stroke:#5f3dc4
    style DataLayer fill:#fff4e6,stroke:#e67700
    style NetworkLayer fill:#d3f9d8,stroke:#2f9e44
```

---

**蓝图编译完成** | BJFramework Blueprint Compiler v1.0
