# 任务系统 - BJF 数据流设计文档

**日期**: 2026-02-13
**PRD**: H:\Work\U3D_EF\ProjectEF\Assets\Doc\10_Projects\TaskSystem\PRD\tasksytem.md

---

## Phase 1: 语义解构 (Semantic Decomposition)

### 1.1 名词分析 (Nouns → Data Entities)

#### Business Data Entities (Logic Data)
存储在 MainTofu 的 m_dataCache 中：

- **TaskInfo**: 任务信息
  - task_id, task_type, task_name, task_desc
  - status (Locked/Acceptable/InProgress/Completed/Finished/Failed)
  - next_task_id, auto_reward, accept_type, is_team_task

- **TaskObjective**: 任务目标
  - objective_id, belong_task_id, trigger_id
  - condition_params, target_value, current_progress
  - scene_mark_pos (MapID, X, Y, Z)

- **TaskReward**: 任务奖励
  - reward_id, reward_items, is_claimed

- **TriggerConfig**: 触发器配置
  - event_name, check_params, compare_logic, value_type

- **TeamTaskInfo**: 组队任务信息
  - team_id, shared_members, progress_contributors

- **TaskChain**: 任务链信息
  - chain_id, current_task, next_task_id

#### Display Data Models (Display Data)
传递给 UIController 的简化数据：

- **TaskListItemData**: 任务列表项
  - taskId, taskName, taskType, status
  - isClaimable, isTracked, isTeamTask

- **TaskDetailData**: 任务详情
  - taskName, taskDesc, objectives[], rewards[]
  - isClaimable, isTeamTask

- **ObjectiveDisplayData**: 目标显示
  - description, progressText (e.g., "3/10")
  - progressPercentage, isCompleted

- **TrackingTaskData**: 追踪任务
  - taskName, objectives[], sceneMarkers[]

- **ProgressTipData**: 进度提示
  - text, duration, contributorName (队友名称)

### 1.2 动词分析 (Verbs → Events/Logic)

#### Business Logic Events (业务逻辑事件)
触发 UpdatePipeline 或 NetTask：

- **OnTaskUnlocked**: 任务解锁（前置条件满足）
- **OnTaskAccepted**: 任务接取（自动/手动）
- **OnTaskProgressUpdated**: 任务进度更新
- **OnTaskObjectiveCompleted**: 任务目标完成
- **OnTaskCompleted**: 任务达成
- **OnTaskRewardClaimed**: 奖励领取
- **OnTaskChainAdvanced**: 链式任务推进
- **OnTeamTaskProgressShared**: 组队任务进度共享

#### Interaction Logic Events (交互事件)
由 UIController 抛出：

- **OnTrackButtonClicked**: 追踪按钮点击
- **OnClaimRewardButtonClicked**: 领取奖励按钮点击
- **OnTaskItemSelected**: 任务条目选中
- **OnMapTabSwitched**: 地图页签切换
- **OnTaskListOpened**: 任务界面打开

---

## Phase 2: 数据流设计 (Data Flow Architecture)

### 2.1 数据输入源 (Data Input Sources)

#### Initialization Input
```csharp
public class TaskSystemUIIntent
{
    public TaskSystemUIIntentOpenMode OpenMode;
    public int InitialSelectedTaskId;  // 初始选中的任务ID
    public int FromSceneId;            // 来源场景ID（用于自动追踪）
}
```

#### Asynchronous Input

**Server Push**:
- `TaskStatusChangedPush`: 任务状态变更推送
- `TaskProgressUpdatedPush`: 任务进度更新推送（含队友贡献）
- `TaskRewardGrantedPush`: 奖励发放推送

**Global Events**:
- `OnPlayerActionEvent`: 玩家行为事件（钓鱼、买卖等）→ 触发任务进度检查
- `OnEnterNewMapEvent`: 进入新地图事件 → 触发自动追踪逻辑
- `OnTeamMemberActionEvent`: 队友行为事件 → 触发组队任务进度共享

### 2.2 数据转换逻辑 (DataCacheUpdate Stage)

**核心原则**: 所有数据转换必须在 DataCacheUpdate 阶段完成，ViewUpdate 仅负责调用 Controller 接口。

#### 转换 1: 任务列表过滤与排序
```csharp
// Input: m_allTasks (Logic Data)
// Output: m_cachedListData (Display Data)

var filteredTasks = m_allTasks
    .Where(t => m_currentMapFilter == 0 || t.mapId == m_currentMapFilter)
    .OrderBy(t => t.taskType != TaskType.MainQuest)  // 主线优先
    .ThenBy(t => t.status != TaskStatus.Claimable)   // 可领奖靠前
    .ThenBy(t => t.taskId);

m_cachedListData = filteredTasks
    .Select(t => new TaskListItemData
    {
        TaskId = t.task_id,
        TaskName = t.task_name,
        Status = t.status,
        IsClaimable = t.status == TaskStatus.Completed,
        IsTracked = t.task_id == m_trackedTaskId,
        IsTeamTask = t.is_team_task
    })
    .ToList();
```

#### 转换 2: 进度百分比计算
```csharp
// Input: TaskObjective.current_progress, TaskObjective.target_value
// Output: ObjectiveDisplayData.progressPercentage

progressPercentage = (float)objective.current_progress / objective.target_value;
```

#### 转换 3: 进度文本格式化
```csharp
// 累加型: "3/10"
// 单次型: "5kg/10kg"
// 集合型: "已收集 3/5"

string FormatProgressText(TaskObjective obj)
{
    switch (obj.value_type)
    {
        case ValueType.Accumulate:
            return $"{obj.current_progress}/{obj.target_value}";
        case ValueType.Single:
            return $"{obj.current_progress}{obj.unit}/{obj.target_value}{obj.unit}";
        case ValueType.Collection:
            return $"已收集 {obj.current_progress}/{obj.target_value}";
    }
}
```

#### 转换 4: 场景标记处理
```csharp
// 条件: 未完成 && 有配置坐标 && 匹配当前地图
var sceneMarkers = trackedTask.Objectives
    .Where(obj => !obj.IsCompleted)
    .Where(obj => obj.scene_mark_pos != null)
    .Where(obj => obj.scene_mark_pos.mapId == PlayerCtx.CurrentMapId)
    .Select(obj => new SceneMarkerData
    {
        Position = obj.scene_mark_pos.ToVector3(),
        Icon = "task_marker",
        Label = obj.objective_desc
    })
    .ToList();
```

#### 转换 5: 组队进度提示增强
```csharp
// 队友贡献: "队友[凉皮小王]：钓上了10条鲑鱼 2/10"
// 自己贡献: "钓上了10条鲑鱼 2/10"

string tipText = progressUpdate.contributorName != null
    ? $"队友{progressUpdate.contributorName}：{progressUpdate.objectiveDesc} {progressUpdate.newProgress}/{progressUpdate.targetValue}"
    : $"{progressUpdate.objectiveDesc} {progressUpdate.newProgress}/{progressUpdate.targetValue}";
```

### 2.3 数据绑定机制 (PipelineUpdateMask)

```csharp
[Flags]
public enum TaskSystemPipelineMask
{
    None = 0,
    RefreshTaskList = 1 << 0,           // 刷新任务列表
    RefreshTaskDetail = 1 << 1,         // 刷新任务详情
    RefreshTracking = 1 << 2,           // 刷新追踪区域
    RefreshMapTabs = 1 << 3,            // 刷新地图页签
    ShowProgressTip = 1 << 4,           // 显示进度提示
    RefreshSceneMarker = 1 << 5,        // 刷新场景标记
    RefreshClaimableIcon = 1 << 6,      // 刷新可领奖标识
    RefreshTaskListStayPos = 1 << 7,    // 刷新任务列表（保持位置）
    All = ~0
}
```

**绑定规则**:
- TaskListTofu 检查 `RefreshTaskList` → 调用 `TaskListController.RefreshTaskList(m_cachedListData)`
- TaskDetailTofu 检查 `RefreshTaskDetail` → 调用 `TaskDetailController.RefreshDetail(m_cachedDetailData)`
- TrackingTofu 检查 `RefreshTracking` → 调用 `TrackingController.RefreshTracking(m_cachedTrackingData)`

---

## Phase 3: 事件反馈循环 (Event Handling)

### 3.1 UI 交互事件路径 (UI Input)

**Path**: View → Controller (Event) → Tofu (Subscribe)

#### 交互 1: 追踪任务
```
TrackingButtonEx (View)
→ TaskListController.OnTrackButtonClicked(taskId) (Event)
→ TaskListTofu.HandleTrackRequest(taskId) (Subscribe)
→ Check: 是否允许追踪
→ NetTask: RequestTrackTask(taskId)
→ Server Response → SetMask(RefreshTracking | RefreshSceneMarker) → StartPipeline
```

#### 交互 2: 领取奖励
```
ClaimRewardButtonEx (View)
→ TaskDetailController.OnClaimButtonClicked(taskId) (Event)
→ TaskDetailTofu.HandleClaimReward(taskId) (Subscribe)
→ Check: 任务状态是否为"已达成"
→ NetTask: RequestClaimReward(taskId)
→ Server Response → SetMask(RefreshTaskList | RefreshDetail | RefreshTracking) → StartPipeline
```

#### 交互 3: 切换地图页签
```
MapTabButtonEx (View)
→ TaskListController.OnMapTabClicked(mapId) (Event)
→ TaskListTofu.HandleMapTabSwitch(mapId) (Subscribe)
→ 本地过滤: 更新 m_currentMapFilter
→ SetMask(RefreshTaskList) → StartPipeline
```

### 3.2 业务事件处理流程 (Business Process)

**Flow**: Event Trigger → Check → NetTask → SetMask → StartPipeline

#### 流程 1: 玩家行为触发进度更新
```
玩家钓鱼成功 (PlayerActionEvent)
→ TaskSystemLogic.OnPlayerActionEvent(event)
→ Check: 是否有进行中任务关注此事件
→ Check: 事件参数是否匹配任务配置
→ 若匹配: NetTask.UpdateTaskProgress(taskId, delta)
→ Server Response → SetMask(ShowProgressTip | RefreshTracking) → StartPipeline
```

#### 流程 2: 进入新地图自动追踪
```
玩家进入新地图 (OnEnterNewMapEvent)
→ TaskSystemLogic.OnEnterNewMap(mapId)
→ Check: 当前是否未追踪任何任务
→ Check: 是否有主线任务
→ 若有: 自动追踪第一个主线任务
→ SetMask(RefreshTracking | RefreshSceneMarker) → StartPipeline
```

#### 流程 3: 组队任务进度共享
```
队友行为触发 (OnTeamMemberActionEvent)
→ TaskSystemLogic.OnTeamMemberAction(event)
→ Check: 队友是否在共享范围（同队伍、同地图、同房间）
→ Check: 自己是否接取了该组队任务且状态为"进行中"
→ 若满足: NetTask.UpdateTeamTaskProgress(taskId, delta, memberName)
→ Server Response → SetMask(ShowProgressTip | RefreshTracking) → StartPipeline
```

---

## Phase 4: Pipeline 集成 (UpdatePipeline 5 Stages)

### Stage 1: Preprocess
```csharp
protected override void Preprocess()
{
    // 锁定 UI 操作
    SetInteractable(false);

    // 显示 Loading（仅在网络请求时）
    if (m_hasNetRequest)
    {
        ShowLoading();
    }
}
```

### Stage 2: DataCacheUpdate
```csharp
protected override void DataCacheUpdate()
{
    // 1. 刷新任务列表数据
    if (CheckMask(RefreshTaskList))
    {
        var allTasks = TaskSystemDC.GetAllTasks();

        // 过滤
        var filtered = allTasks
            .Where(t => m_currentMapFilter == 0 || t.mapId == m_currentMapFilter);

        // 排序
        var sorted = filtered
            .OrderBy(t => t.taskType != TaskType.MainQuest)
            .ThenBy(t => t.status != TaskStatus.Claimable)
            .ThenBy(t => t.taskId);

        // 转换为 Display Data
        m_cachedListData = sorted.Select(ConvertToDisplayData).ToList();
    }

    // 2. 刷新任务详情数据
    if (CheckMask(RefreshTaskDetail))
    {
        var task = TaskSystemDC.GetTask(m_selectedTaskId);
        m_cachedDetailData = BuildTaskDetailData(task);
    }

    // 3. 刷新追踪任务数据
    if (CheckMask(RefreshTracking))
    {
        var trackedTask = TaskSystemDC.GetTask(m_trackedTaskId);
        m_cachedTrackingData = BuildTrackingData(trackedTask);
    }

    // 4. 构建进度提示数据
    if (CheckMask(ShowProgressTip))
    {
        var update = TaskSystemDC.GetLatestProgressUpdate();
        m_cachedProgressTipData = BuildProgressTipData(update);
    }
}
```

### Stage 3: ResourceLoad
```csharp
protected override void ResourceLoad()
{
    // 加载奖励物品图标
    if (CheckMask(RefreshTaskDetail))
    {
        foreach (var reward in m_cachedDetailData.rewards)
        {
            var iconPath = ItemConfig.GetIconPath(reward.itemId);
            AddressablesLoader.LoadAsync<Sprite>(iconPath, sprite =>
            {
                reward.icon = sprite;
            });
        }
    }

    // 加载场景标记 Prefab
    if (CheckMask(RefreshSceneMarker))
    {
        if (m_cachedTrackingData?.sceneMarkers != null)
        {
            AddressablesLoader.LoadAsync<GameObject>("task_marker_prefab", prefab =>
            {
                m_sceneMarkerPrefab = prefab;
            });
        }
    }
}
```

### Stage 4: ViewUpdate
```csharp
protected override void ViewUpdate()
{
    // 1. 刷新任务列表
    if (CheckMask(RefreshTaskList))
    {
        m_taskListCtrl.RefreshTaskList(m_cachedListData);
    }

    // 2. 刷新任务详情
    if (CheckMask(RefreshTaskDetail))
    {
        m_taskDetailCtrl.RefreshDetail(m_cachedDetailData);
    }

    // 3. 刷新追踪任务
    if (CheckMask(RefreshTracking))
    {
        if (m_cachedTrackingData != null)
            m_trackingCtrl.RefreshTracking(m_cachedTrackingData);
        else
            m_trackingCtrl.HideTracking();
    }

    // 4. 显示进度提示
    if (CheckMask(ShowProgressTip))
    {
        TipManager.ShowTip(m_cachedProgressTipData.Text, m_cachedProgressTipData.Duration);
    }

    // 5. 刷新场景标记
    if (CheckMask(RefreshSceneMarker))
    {
        SceneMarkerManager.RefreshMarkers(m_cachedTrackingData?.SceneMarkers);
    }

    // 6. 刷新可领奖标识
    if (CheckMask(RefreshClaimableIcon))
    {
        var claimableIds = m_cachedListData
            .Where(t => t.IsClaimable)
            .Select(t => t.TaskId)
            .ToList();
        m_taskListCtrl.UpdateClaimableIcons(claimableIds);
    }
}
```

### Stage 5: PostProcess
```csharp
protected override void PostProcess()
{
    // 解锁 UI 操作
    SetInteractable(true);

    // 隐藏 Loading
    HideLoading();

    // 播放完成动画
    if (CheckMask(RefreshClaimableIcon))
    {
        PlayTaskCompleteAnimation();
    }

    // 清理临时数据
    m_hasNetRequest = false;
}
```

---

## Design Checklist Verification

- [x] 所有名词已映射到数据存储位置
- [x] 数据转换仅在 DataCacheUpdate 阶段
- [x] PipelineMask 正确使用（8个Mask位）
- [x] Controller 遵循事件模式（无业务逻辑）
- [x] 交互流遵循 View→Controller→Tofu
- [x] ModeDefine 考虑不同操作模式

---

**数据流设计完成！**
