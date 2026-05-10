# 钓具组装UITask详细功能设计文档 v2.0

## 修订说明

本版本基于v1.0进行以下关键修订：
1. **配件槽数据模型**：去除3D Prefab相关字段（UI锚点、3D Transform），改为使用UIPrefab的SlotScrollView
2. **ESlotType重新定义**：`Reel`（渔轮）、`RodLine`（主线）、`BaitLine`（子线）、`Hook`（鱼钩）、`LureBait`（假饵）、`ExtraWeight`（配重）
3. **逻辑层接口明确**：基于`PlayerGameObjectCompRodAssembleClient`和`IPlayerGameObjectRodAssembleClient`
4. **数据流、控制流、状态机更加明确**：遵循BJFramework UITask使用范式
5. **补充完整初始化流程**：详见`DataFlow_Initialization_Supplement.md`
6. **统一UI Prefab命名**：与`TackleAssembleUITask_Prefab_Specification_v2.md`保持一致
   - `SlotScrollView` - 配件槽滚动视图
   - `PartSelectionScrollView` - 部件选择滚动视图（Prefab中实际节点名为`AssemblyScrollView`）
   - UI状态切换改为通过`SetActive`控制，而非`AdvanceUIStateController`
   - 对象池统一管理所有Item（Prefab中的预制Item仅用于预览）

---

## 1. 文档概述

### 1.1 文档目的
本文档基于 `TackleAssembleUITask_Design_Proposal.md` 需求方案，结合BJFramework框架规范、UITask使用范式和现有代码实现，提供钓具组装UI的详细功能设计。

### 1.2 参考文档
- `Assets/Doc/TackleAssemble/TackleAssembleUITask_Design_Proposal.md` - 需求方案
- `Assets/Doc/TackleAssemble/DataFlow_Initialization_Supplement.md` - 初始化流程详解
- `Assets/Doc/BJFramework_UITask_Usage_Pattern.md` - **UITask使用范式（重要）**
- `Assets/.cursor/rules/bjframework.mdc` - BJFramework开发规范
- `Assets/.cursor/rules/UIProcess.mdc` - UIProcess使用规范
- 逻辑层接口：`PlayerGameObjectCompRodAssembleClient`、`IPlayerGameObjectRodAssembleClient`
- 现有实现：`TackleAssembleUITask`、`TackleAssembleTackleUITask`
- 参考实现：`FishingBagStoreInteractUITask` (Pipeline Mask模式)

### 1.3 关键设计原则
1. **严格遵循BJFramework UITask使用范式**
2. **逻辑层/网络层只在Tofu中访问，UIController只负责展示和事件**
3. **使用PipelineUpdateMask最小化刷新**
4. **使用StageActorViewUITask管理3D舞台**
5. **事件冒泡模式**：内部组件→子Tofu→子Task接口→父Tofu监听
6. **UITask作为Facade封装内部实现**

---

## 2. 架构设计

### 2.1 整体架构图

```
┌────────────────────── GameLogic Layer ──────────────────────┐
│  PlayerGameObjectCompRodAssembleClient                      │
│  ├─ ReelItemListGet4Assemble()                              │
│  ├─ RodLineItemListGet4Assemble()                           │
│  ├─ BaitLineItemListGet4Assemble()                          │
│  ├─ HookItemListGet4Assemble()                              │
│  ├─ LureBaitItemListGet4Assemble()                          │
│  ├─ ExtraWeightItemListGet4Assemble()                       │
│  ├─ RodAssembleInfoBuild4*()                                │
│  └─ RodAssemble() / RodAssembleCheck()                      │
└──────────────────────────────────────────────────────────────┘
                            ↑
                            │ Tofu访问逻辑层
                            │
┌────────────────────── UITask Layer ─────────────────────────┐
│                  TackleAssembleUITask (Facade)               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │       TackleAssembleUITaskCompMainTofu                │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  管线生命周期                                   │  │   │
│  │  │  - UpdateContextSetup (获取Mask)               │  │   │
│  │  │  - DataCacheUpdate (从逻辑层刷新)              │  │   │
│  │  │  - DynamicResCollect4Load (收集资源)           │  │   │
│  │  │  - ViewUpdate (刷新UI)                         │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  业务逻辑                                       │  │   │
│  │  │  - 配件槽数据管理 (m_slotDataList)             │  │   │
│  │  │  - 部件选择列表数据 (m_partFilterCtxList)      │  │   │
│  │  │  - Mode状态机 (Default/SlotEdit/BaitGroupEdit) │  │   │
│  │  │  - UI事件处理 (点击/拖拽/切换)                │  │   │
│  │  │  - 网络请求 (Check→NetTask→Mask刷新)         │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │       TackleAssembleUIController                      │   │
│  │  - UI元素绑定与显示                                   │   │
│  │  - 配件槽按钮列表 (SlotScrollView)                    │   │
│  │  - 部件选择列表 (PartSelectionScrollView)            │   │
│  │  - UI状态切换 (通过SetActive控制)                    │   │
│  │  - ButtonEx事件 → EventOn* 事件                      │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                            │
                            │ 启动子任务（劫持管线）
                            ↓
┌────────────────────── 3D Layer ─────────────────────────────┐
│          TackleAssembleTackleUITask (StageActorViewUITask)   │
│  - 管理TackleStageActor (3D模型)                             │
│  - 提供配件槽特写/相机控制                                    │
│  - 事件冒泡：EventOnActorReady / EventOnDragStart            │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 层次职责划分（遵循UITask使用范式）

#### 2.2.1 TackleAssembleUITask (Facade层)
**必须做的**：
- 构造通用组件：`UITaskCompUpdatePipelineManager`、`UITaskCompUIProcessManager`、`UITaskCompSubUITaskManager`
- `AllCompTofuConstruct`：构造`TackleAssembleUITaskCompMainTofu`
- 实现：
  - `LayerDescArray`：`TackleAssembleUILayer` + UIPrefab路径
  - `UIControllerDescArray`：`TackleAssembleUIController`
  - `CustomParamKey4UIIntentDefineArray`：`IntentParamKey4RodInstanceId`、`ParamKeyPipelineUpdateMask`
  - `ModeDefineList4Register`：`Default`、`SlotEdit`、`BaitGroupEdit`

**不建议做的**：
- 不在UITask内写业务逻辑
- 不直接访问PlayerContext
- 不发网络包

#### 2.2.2 TackleAssembleUITaskCompMainTofu (核心业务Tofu)

**核心职责**（遵循UITask使用范式）：

**1. 状态与数据缓存**
```csharp
// 当前钓竿实例ID
private ulong m_rodInstanceId;

// 钓竿组装信息（从逻辑层获取）
private ConfigDataRodAssembleInfo m_currentRodAssembleInfo;

// 配件槽数据列表（UI显示用）
private List<SlotData> m_slotDataList;

// 当前编辑的配件槽类型
private ESlotType m_currentEditingSlotType;
private int m_currentEditingSegIndex; // 用于钓组线段编辑

// 部件选择列表数据（从逻辑层获取）
private List<TacklePartFilterCtx> m_partFilterCtxList;

// 排序/筛选状态
private TacklePartSortType m_partSortType;
private TacklePartFilterState m_partFilterState;
```

**2. 管线逻辑实现**
- `UpdateContextSetup`：解析本轮管线的Mask
- `DataCacheUpdateIsNeededCheck`：根据Mask & Mode决定
- `DataCacheUpdate`：从逻辑层刷新缓存数据
- `DynamicResCollect4Load`：根据Mask收集资源
- `ViewUpdate`：按Mode + Mask刷新UI

**3. 事件中心**
- 集中注册/拆卸所有Controller的事件
- 将ButtonEx/列表/拖拽事件转换为业务行为

**4. 逻辑层/网络层协作**
- 所有Check调用与NetworkTask调用集中在Tofu层完成
- 网络成功后：设置管线Mask → 启动管线

#### 2.2.3 TackleAssembleUIController (UI表现层)

**只做**：
- UI展示：修改文本、图标、颜色、布局
- 输入→事件：把ButtonEx/列表交互封装为`EventOn*`事件
- 提供高层刷新接口：
  ```csharp
  public void SlotListRefresh(List<SlotData> slotDataList);
  public void PartSelectionListRefresh(List<TacklePartFilterCtx> partFilterCtxList);
  public void SetToUIState(string stateName); // 通过SetActive控制SlotScrollView/PartSelectionScrollView显示隐藏
  ```

**不做**：
- 不写任何业务规则逻辑
- 不访问PlayerContext
- 不直接发网络请求

---

## 3. 数据模型设计

### 3.1 配件槽类型枚举（重新定义）

```csharp
/// <summary>
/// 配件槽类型枚举
/// </summary>
public enum ESlotType
{
    /// <summary>
    /// 渔轮
    /// </summary>
    Reel,

    /// <summary>
    /// 主线
    /// </summary>
    RodLine,

    /// <summary>
    /// 子线
    /// </summary>
    BaitLine,

    /// <summary>
    /// 鱼钩
    /// </summary>
    Hook,

    /// <summary>
    /// 假饵
    /// </summary>
    LureBait,

    /// <summary>
    /// 配重
    /// </summary>
    ExtraWeight
}
```

### 3.2 配件槽数据模型（修订）

```csharp
/// <summary>
/// 配件槽UI显示数据
/// 从逻辑层的ConfigDataRodAssembleInfo转换而来，用于UI显示
/// </summary>
public class SlotData
{
    /// <summary>
    /// 配件槽名称（显示用）
    /// 例如："渔轮"、"主线"、"鱼钩-段1"
    /// </summary>
    public string SlotName { get; set; }

    /// <summary>
    /// 配件槽类型
    /// </summary>
    public ESlotType SlotType { get; set; }

    /// <summary>
    /// 当前装配的物品GlobalId（0表示未装配）
    /// </summary>
    public UnitedStoreItemGlobalId CurrentItemGlobalId { get; set; }

    /// <summary>
    /// 配件槽状态
    /// </summary>
    public SlotStatus Status { get; set; }

    /// <summary>
    /// 线段索引（仅用于钓组配件，如Hook/LureBait/ExtraWeight）
    /// -1表示非钓组配件
    /// </summary>
    public int SegmentIndex { get; set; }

    /// <summary>
    /// 配件图标路径（从物品Provider获取）
    /// </summary>
    public string IconPath { get; set; }
}

/// <summary>
/// 配件槽状态枚举
/// </summary>
public enum SlotStatus
{
    /// <summary>
    /// 必须装配（红色显示）
    /// </summary>
    MustEquip,

    /// <summary>
    /// 可以装配（绿色显示）
    /// </summary>
    CanEquip,

    /// <summary>
    /// 不开放（灰色显示，不可点击）
    /// </summary>
    NotAvailable,

    /// <summary>
    /// 已装配（蓝色显示）
    /// </summary>
    Equipped
}
```

### 3.3 逻辑层数据模型（来自GameLogic层）

```csharp
/// <summary>
/// 钓具部件过滤器现场（逻辑层提供）
/// </summary>
public struct TacklePartFilterCtx
{
    /// <summary>
    /// 钓具部件物品Id
    /// </summary>
    public UnitedStoreItemGlobalId m_itemGlobalId;

    /// <summary>
    /// 钓具部件过滤器状态
    /// </summary>
    public TacklePartFilterState m_filterState;
}

/// <summary>
/// 钓具部件过滤器状态（Flags枚举）
/// </summary>
[Flags]
public enum TacklePartFilterState
{
    /// <summary>
    /// 能够装配
    /// </summary>
    CanAssemble = 1,

    /// <summary>
    /// 类型不匹配
    /// </summary>
    TypeNotMatch = 1 << 1,

    /// <summary>
    /// Size不匹配
    /// </summary>
    SizeNotMatch = 1 << 2,

    /// <summary>
    /// 鱼钩不适配鱼饵
    /// </summary>
    HookNotMatch4Lure = 1 << 3,

    /// <summary>
    /// 已经参与组装
    /// </summary>
    AlreadyAssembled = 1 << 4,

    /// <summary>
    /// 不在背包中
    /// </summary>
    NotInFishingBag = 1 << 5,
}

/// <summary>
/// 钓组组装类型枚举
/// </summary>
public enum BaitGroupAssembleType
{
    Invalid = 0,
    Simple = 1,         // 简单路亚钓组
    Frog = 2,           // 雷蛙钓组
    JiggingRig = 3,     // 铅头钩钓组
}
```

---

## 4. 控制流设计（Mode状态机）

### 4.1 Mode定义

```csharp
// TackleAssembleUITask
public const string ModeName4Default = "Default";
public const string ModeName4SlotEdit = "SlotEdit";
public const string ModeName4BaitGroupEdit = "BaitGroupEdit";
```

### 4.2 Mode状态转换图

```
┌─────────────────────────────────────────────────────────┐
│                      Default                            │
│  - 显示配件槽列表                                        │
│  - 显示3D模型                                            │
│  - 允许旋转观察                                          │
└────┬────────────────────────────────────┬───────────────┘
     │ 点击配件槽按钮                      │ 点击钓组类型切换
     │ (Reel/RodLine/Hook等)              │
     │                                    │
     ↓                                    ↓
┌────────────────────────┐         ┌───────────────────────┐
│     SlotEdit           │         │  BaitGroupEdit        │
│  - 隐藏配件槽列表       │         │  - 显示钓组类型列表    │
│  - 显示部件选择列表     │         │  - 可切换钓组类型      │
│  - 3D模型聚焦到配件槽   │         │  - 选择后重构配件槽    │
│    (可选功能)          │         │                       │
└────┬───────────────────┘         └───────┬───────────────┘
     │ 选择部件 or 点击返回                │ 选择类型 or 返回
     │                                    │
     ↓                                    ↓
┌─────────────────────────────────────────────────────────┐
│                     Default                             │
│  (刷新配件槽列表和3D模型)                                │
└─────────────────────────────────────────────────────────┘
```

### 4.3 Mode切换实现

```csharp
// TackleAssembleUITaskCompMainTofu
public void CurrModeSet(string modeName)
{
    string currentMode = CurrModeGet();
    if (currentMode == modeName) return;

    // 退出当前模式
    OnModeExit(currentMode);

    // 更新BasicInfo组件的模式
    m_compBasicInfo?.CurrModeSet(modeName);

    // 进入新模式
    OnModeEnter(modeName);

    Debug.Log($"[TackleAssemble] Mode切换: {currentMode} → {modeName}");
}

private void OnModeEnter(string modeName)
{
    switch (modeName)
    {
        case ModeName4Default:
            // 显示配件槽列表
            m_mainUICtrl?.SetToUIState("SlotScrollView");
            // 3D模型返回整体视图（可选）
            ReturnToOverviewOptional();
            break;

        case ModeName4SlotEdit:
            // 显示部件选择列表
            m_mainUICtrl?.SetToUIState("PartSelectionScrollView");
            // 3D模型聚焦到配件槽（可选功能）
            FocusOnSlotOptional(m_currentEditingSlotType);
            break;

        case ModeName4BaitGroupEdit:
            // 显示钓组类型选择列表
            m_mainUICtrl?.SetToUIState("BaitGroupTypeScrollView");
            break;
    }
}

private void OnModeExit(string modeName)
{
    switch (modeName)
    {
        case ModeName4SlotEdit:
            // 清理编辑状态
            m_currentEditingSlotType = ESlotType.Reel;
            m_currentEditingSegIndex = -1;
            break;
    }
}
```

---

## 5. UI状态切换设计（通过SetActive控制）

### 5.1 UI状态定义

```csharp
// UI状态名称常量
public const string UIState_SlotScrollView = "SlotScrollView";
public const string UIState_PartSelectionScrollView = "PartSelectionScrollView";
public const string UIState_BaitGroupTypeScrollView = "BaitGroupTypeScrollView";
```

### 5.2 UI状态转换流程

```
用户操作                  Mode切换                UI状态切换
─────────────────────────────────────────────────────────────
点击配件槽按钮      →   Default → SlotEdit   →   SlotScrollView
                                                   ↓
                                                PartSelectionScrollView

选择部件/点击返回    →   SlotEdit → Default   →   PartSelectionScrollView
                                                   ↓
                                                SlotScrollView

点击钓组类型切换    →   Default → BaitGroupEdit → SlotScrollView
                                                   ↓
                                                BaitGroupTypeScrollView

选择钓组类型/返回   →   BaitGroupEdit → Default → BaitGroupTypeScrollView
                                                   ↓
                                                SlotScrollView
```

### 5.3 UIController中的实现

```csharp
// TackleAssembleUIController
private ScrollRect m_slotScrollView;
private ScrollRect m_partSelectionScrollView;

protected override void OnBindFiledsCompleted()
{
    base.OnBindFiledsCompleted();

    // 设置初始状态：显示配件槽列表
    SetToUIState(UIState_SlotScrollView);
}

public void SetToUIState(string stateName)
{
    switch (stateName)
    {
        case UIState_SlotScrollView:
            // 显示配件槽列表
            m_slotScrollView.gameObject.SetActive(true);
            m_partSelectionScrollView.gameObject.SetActive(false);
            break;

        case UIState_PartSelectionScrollView:
            // 显示部件选择列表
            m_slotScrollView.gameObject.SetActive(false);
            m_partSelectionScrollView.gameObject.SetActive(true);
            break;

        case UIState_BaitGroupTypeScrollView:
            // 显示钓组类型选择列表（未来功能）
            // TODO: 实现钓组类型选择面板
            break;
    }
}
```

---

## 6. Pipeline Mask优化机制

### 6.1 Pipeline Mask定义

```csharp
// TackleAssembleUITaskCompMainTofu
[Flags]
public enum PipelineUpdateMask
{
    None = 0,
    RefreshSlotList = 1 << 0,           // 刷新配件槽列表
    RefreshPartSelection = 1 << 1,       // 刷新部件选择面板
    RefreshBaitGroupType = 1 << 2,       // 刷新钓组类型列表
    Refresh3DModel = 1 << 3,             // 刷新3D模型
    RefreshAll = ~0                      // 全部刷新
}

public const string ParamKeyPipelineUpdateMask = "TackleAssembleUITask.PipelineUpdateMask";
```

### 6.2 启动管线的统一写法（遵循范式）

```csharp
private void LaunchPipelineWithMask(PipelineUpdateMask mask)
{
    var pipelineInitInfo = m_compUpdatePipelineManager.UpdatePipelineInitInfoAlloc();
    pipelineInitInfo.m_customParamDict.SetParam(ParamKeyPipelineUpdateMask, mask);
    m_compUpdatePipelineManager.UpdatePipelineLaunch(pipelineInitInfo);
}

// 使用示例
private void OnSlotButtonClick(ESlotType slotType, int segmentIndex)
{
    // 记录当前编辑状态
    m_currentEditingSlotType = slotType;
    m_currentEditingSegIndex = segmentIndex;

    // 切换Mode
    CurrModeSet(ModeName4SlotEdit);

    // 启动管线，仅刷新部件选择面板
    LaunchPipelineWithMask(PipelineUpdateMask.RefreshPartSelection);
}
```

### 6.3 Tofu端解读Mask的标准流程（遵循范式）

```csharp
// UpdateContextSetup
public override void UpdateContextSetup(
    ICustomParamDictionaryReadOnly paramDict,
    UITaskUpdatePipelineStartType pipelineStartType,
    params object[] extraParamArr)
{
    base.UpdateContextSetup(paramDict, pipelineStartType, extraParamArr);
    m_currPipelineUpdateMask = paramDict.GetStructParam<PipelineUpdateMask>(
        ParamKeyPipelineUpdateMask);
}

// DataCacheUpdateIsNeededCheck
public override bool DataCacheUpdateIsNeededCheck()
{
    if (IsUITaskUpdatePipelineInitOrResume())
        return true;

    return m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshSlotList)
           || m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshPartSelection)
           || m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshBaitGroupType);
}

// DataCacheUpdate
public override void DataCacheUpdate()
{
    if (IsUITaskUpdatePipelineInitOrResume())
    {
        // 全量刷新
        BuildSlotDataList();
    }
    else
    {
        // 增量刷新
        if (m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshSlotList))
        {
            BuildSlotDataList();
        }

        if (m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshPartSelection))
        {
            BuildPartSelectionList();
        }

        if (m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshBaitGroupType))
        {
            BuildBaitGroupTypeList();
        }
    }
}

// ViewUpdate
public override void ViewUpdate(IUITaskUpdatePipelineController pipelineCtrl)
{
    if (IsUITaskUpdatePipelineInitOrResume())
    {
        m_mainUICtrl.SlotListRefresh(m_slotDataList);
        m_mainUICtrl.SetToUIState(UIState_SlotScrollView);
        RegisterAllUIEvents();
    }

    if (m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshSlotList))
    {
        m_mainUICtrl.SlotListRefresh(m_slotDataList);
    }

    if (m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshPartSelection))
    {
        m_mainUICtrl.PartSelectionListRefresh(m_partFilterCtxList);
    }

    if (m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.Refresh3DModel))
    {
        Refresh3DModel();
    }
}
```

---

## 7. 网络请求标准流程（Check → NetTask → Mask刷新）

### 7.1 标准流程示例

```csharp
// TackleAssembleUITaskCompMainTofu
private void OnPartItemClick(UnitedStoreItemGlobalId itemGlobalId)
{
    var playerGO = PlayerCtx.PlayerGameObjectGet();
    var rodAssembleComp = playerGO.CompRodAssembleGet() as IPlayerGameObjectCompRodAssembleClient;

    // 1. 构建新的RodAssembleInfo
    RodAssembleInfo newAssembleInfo = BuildRodAssembleInfo(itemGlobalId);
    if (newAssembleInfo == null)
    {
        Debug.LogError("[TackleAssemble] BuildRodAssembleInfo失败");
        return;
    }

    // 2. Check（逻辑层校验）
    if (!playerGO.RodAssembleCheck(m_rodInstanceId, newAssembleInfo, out int errCode))
    {
        Debug.LogError($"[TackleAssemble] RodAssembleCheck失败: {errCode}");
        ShowErrorTip(errCode);
        return;
    }

    // 3. 创建并启动网络任务
    var netTask = new RodAssembleReqNetTask(m_rodInstanceId, newAssembleInfo);
    netTask.EventOnStop += task =>
    {
        var assembleTask = task as RodAssembleReqNetTask;
        if (assembleTask == null || assembleTask.IsNetworkError)
        {
            Debug.LogError("[TackleAssemble] 网络错误");
            return;
        }

        if (assembleTask.Result != 0)
        {
            Debug.LogError($"[TackleAssemble] RodAssemble失败: {assembleTask.Result}");
            ShowErrorTip(assembleTask.Result);
            return;
        }

        Debug.Log("[TackleAssemble] 部件装配成功");

        // 4. 网络成功 → 设置Mask → 启动管线
        LaunchPipelineWithMask(
            PipelineUpdateMask.RefreshSlotList | PipelineUpdateMask.Refresh3DModel);

        // 5. 切换回Default模式
        CurrModeSet(ModeName4Default);
    };
    netTask.Start();
}

private RodAssembleInfo BuildRodAssembleInfo(UnitedStoreItemGlobalId itemGlobalId)
{
    var rodAssembleComp = PlayerCtx.PlayerGameObjectGet().CompRodAssembleGet()
        as IPlayerGameObjectCompRodAssembleClient;

    // 根据配件槽类型调用对应的Build方法
    switch (m_currentEditingSlotType)
    {
        case ESlotType.Reel:
            return rodAssembleComp.RodAssembleInfoBuild4ReelUpdate(
                m_rodInstanceId, itemGlobalId.m_itemInstanceId);

        case ESlotType.RodLine:
            return rodAssembleComp.RodAssembleInfoBuild4RodLineUpdate(
                m_rodInstanceId, itemGlobalId.m_itemInstanceId);

        case ESlotType.BaitLine:
            return rodAssembleComp.RodAssembleInfoBuild4BaitLineUpdate(
                m_rodInstanceId, itemGlobalId.m_itemInstanceId);

        case ESlotType.Hook:
            return rodAssembleComp.RodAssembleInfoBuild4HookUpdate(
                m_rodInstanceId, itemGlobalId.m_itemInstanceId, m_currentEditingSegIndex);

        case ESlotType.LureBait:
            return rodAssembleComp.RodAssembleInfoBuild4LureBaitUpdate(
                m_rodInstanceId, itemGlobalId.m_itemInstanceId, m_currentEditingSegIndex);

        case ESlotType.ExtraWeight:
            return rodAssembleComp.RodAssembleInfoBuild4ExtraWeightUpdate(
                m_rodInstanceId, itemGlobalId.m_itemInstanceId, m_currentEditingSegIndex);

        default:
            Debug.LogError($"[TackleAssemble] 未处理的配件槽类型: {m_currentEditingSlotType}");
            return null;
    }
}
```

---

## 8. 钓组类型切换专项设计

### 8.1 钓组类型切换流程

```
用户点击钓组类型切换按钮
    │
    ↓
OnBaitGroupTypeSwitchButtonClick()
    │
    ├─> CurrModeSet(ModeName4BaitGroupEdit)
    ├─> LaunchPipelineWithMask(PipelineUpdateMask.RefreshBaitGroupType)
    │
    ↓
管线执行
    │
    ├─> DataCacheUpdate
    │   └─> BuildBaitGroupTypeList()
    │       └─> 从配置表获取所有可用钓组类型
    │
    ├─> ViewUpdate
    │   └─> BaitGroupTypeListRefresh()
    │       └─> 显示钓组类型列表（Simple/Frog/JiggingRig）
    │
用户选择新钓组类型
    │
    ↓
OnBaitGroupTypeItemClick(newBaitGroupType)
    │
    ├─> 构建RodAssembleInfo
    │   └─> rodAssembleComp.RodAssembleInfoBuild4BaitGroupAssembleTypeUpdate()
    │
    ├─> Check
    │   └─> playerGO.RodAssembleCheck()
    │
    ├─> NetTask
    │   └─> RodAssembleReqNetTask
    │
    ↓ 成功
    │
    ├─> LaunchPipelineWithMask(
    │       PipelineUpdateMask.RefreshSlotList | Refresh3DModel)
    │   └─> 重新构建配件槽列表（根据新钓组类型）
    │
    └─> CurrModeSet(ModeName4Default)
```

### 8.2 不同钓组类型的配件槽结构

详见 `DataFlow_Initialization_Supplement.md` 中的 `BuildBaitGroupSlots` 实现。

---

## 9. UI Prefab结构设计

> **详细Prefab结构说明请参考**：`TackleAssembleUITask_Prefab_Specification_v2.md`

### 9.1 主UI Prefab核心结构 (Pfb_UI_Main_TackleAssemble)

```
Pfb_UI_Main_TackleAssemble
└── TackleAssembleRoot
    └── Pfb_UI_TackleAssemble_BGPanel (子Prefab)
        ├── CloseButton (关闭按钮)
        │
        ├── TopGroup (顶部区域组)
        │   ├── TackleAssembleTitle (标题文本)
        │   └── TopButtonGroup
        │       └── StoreTitleButtonScrollView (顶部Tab滚动视图)
        │           └── Content
        │               ├── Pfb_UI_TackleAssembleTitleButton (装配Tab)
        │               ├── Pfb_UI_TackleAssembleTitleButton (1) (方案Tab)
        │               └── Pfb_UI_TackleAssembleTitleButton (2) (改装Tab)
        │
        └── HandButton
            └── AssemblePanelRoot
                ├── DetailPanel (详情面板)
                └── AssemblePanel (主面板)
                    ├── SlotScrollView (配件槽滚动视图)
                    │   ├── Shadowing (阴影层)
                    │   ├── BGing (背景层)
                    │   └── Scroll View
                    │       └── Viewport
                    │           └── Content (配件槽Item容器)
                    │               └── (通过对象池动态生成Item)
                    │
                    └── AssemblyScrollView (部件选择滚动视图，字段名m_partSelectionScrollView)
                        └── TackleRoot (部件Item容器)
                            └── (通过对象池动态生成Item)
```

### 9.2 配件槽Item Prefab (Pfb_UI_TackleAssembleUIItem)

```
Pfb_UI_TackleAssembleUIItem
├── Root (RectTransform + ButtonEx)
│
├── m_qualityStateController (品质状态控制器)
│   ├── Blue (蓝色品质)
│   ├── Purple (紫色品质)
│   └── Golden (金色品质)
│
├── Image (背景图)
├── Image_1 (装饰图层)
├── Leading_quality (前导品质指示器)
├── Scrolling (滚动效果容器)
├── Rotating (旋转效果容器)
│   └── Rotating_1
│
├── Text (配件槽名称)
├── Image_Text (图标+文本组合)
├── LocalText (本地化文本)
└── LocalText_1 (本地化文本备用)
```

### 9.3 UIController字段绑定

```csharp
public partial class TackleAssembleUIController : UIControllerBase
{
    // === 关闭按钮 ===
    private Button m_closeButton;  // 绑定路径：TackleAssembleRoot/.../CloseButton

    // === 标题 ===
    private Text m_titleText;  // 绑定路径：TackleAssembleRoot/.../TopGroup/TackleAssembleTitle

    // === 顶部Tab ===
    private ScrollRect m_topTabScrollView;  // 绑定路径：.../TopGroup/TopButtonGroup/StoreTitleButtonScrollView
    private List<TackleAssembleTitleButtonController> m_topTabButtons;

    // === 详情面板 ===
    private GameObject m_detailPanel;  // 绑定路径：.../AssemblePanelRoot/DetailPanel

    // === 配件槽滚动视图 ===
    private ScrollRect m_slotScrollView;  // 绑定路径：.../AssemblePanel/SlotScrollView/Scroll View
    private Transform m_slotScrollViewContent;  // 绑定路径：.../SlotScrollView/Scroll View/Viewport/Content

    // === 部件选择滚动视图 ===
    private ScrollRect m_partSelectionScrollView;  // 绑定路径：.../AssemblePanel/AssemblyScrollView
    private Transform m_partSelectionScrollViewContent;  // 绑定路径：.../AssemblyScrollView/TackleRoot

    // === 对象池 ===
    private EasyObjectPool<TackleAssembleItemController> m_slotItemPool;
    private EasyObjectPool<PartSelectionItemController> m_partSelectionItemPool;

    private List<TackleAssembleItemController> m_slotItemCtrls = new List<TackleAssembleItemController>();
    private List<PartSelectionItemController> m_partSelectionItemCtrls = new List<PartSelectionItemController>();
}
```

### 9.4 对象池初始化

```csharp
protected override void OnBindFiledsCompleted()
{
    base.OnBindFiledsCompleted();

    // 清理Prefab中的预制Item（仅用于编辑器预览）
    ClearPreviewItems();

    // 初始化配件槽Item对象池
    var slotItemPrefab = GetAssetInContainer<GameObject>("Pfb_UI_TackleAssembleUIItem");
    m_slotItemPool = new EasyObjectPool<TackleAssembleItemController>(
        prefab: slotItemPrefab,
        parent: m_slotScrollViewContent,
        initialSize: 6,
        maxSize: 15
    );

    // 初始化部件选择Item对象池
    var partItemPrefab = GetAssetInContainer<GameObject>("Pfb_UI_PartSelectionItem");
    m_partSelectionItemPool = new EasyObjectPool<PartSelectionItemController>(
        prefab: partItemPrefab,
        parent: m_partSelectionScrollViewContent,
        initialSize: 10,
        maxSize: 50
    );

    // 设置初始UI状态
    SetToUIState(UIState_SlotScrollView);
}

private void ClearPreviewItems()
{
    // 删除Content下所有预制的TackleAssembleItemRoot
    foreach (Transform child in m_slotScrollViewContent)
    {
        Destroy(child.gameObject);
    }
}
```

---

## 10. 配件槽列表刷新实现

### 10.1 SlotListRefresh完整实现

```csharp
// TackleAssembleUIController
public void SlotListRefresh(List<SlotData> slotDataList, IReadOnlyDictionary<string, UnityEngine.Object> dynamicResDict)
{
    // 1. 回收所有现有Item到对象池
    foreach (var itemCtrl in m_slotItemCtrls)
    {
        m_slotItemPool.Release(itemCtrl);
        UnregisterSlotItemEvents(itemCtrl);
    }
    m_slotItemCtrls.Clear();

    // 2. 从对象池获取所需数量的Item
    for (int i = 0; i < slotDataList.Count; i++)
    {
        var itemCtrl = m_slotItemPool.Get();
        itemCtrl.FillData(slotDataList[i], dynamicResDict);
        RegisterSlotItemEvents(itemCtrl);
        m_slotItemCtrls.Add(itemCtrl);
    }
}

private void RegisterSlotItemEvents(TackleAssembleItemController itemCtrl)
{
    itemCtrl.EventOnClick += OnSlotItemClick;
}

private void UnregisterSlotItemEvents(TackleAssembleItemController itemCtrl)
{
    itemCtrl.EventOnClick -= OnSlotItemClick;
}

private void OnSlotItemClick(TackleAssembleItemController itemCtrl)
{
    var slotData = itemCtrl.SlotDataGet();
    EventOnSlotButtonClick?.Invoke(slotData.SlotType, slotData.SegmentIndex);
}
```

### 10.2 PartSelectionListRefresh实现

```csharp
// TackleAssembleUIController
public void PartSelectionListRefresh(List<TacklePartFilterCtx> partFilterCtxList, IReadOnlyDictionary<string, UnityEngine.Object> dynamicResDict)
{
    // 1. 回收现有Item
    foreach (var itemCtrl in m_partSelectionItemCtrls)
    {
        m_partSelectionItemPool.Release(itemCtrl);
        UnregisterPartSelectionItemEvents(itemCtrl);
    }
    m_partSelectionItemCtrls.Clear();

    // 2. 从对象池获取新Item
    foreach (var filterCtx in partFilterCtxList)
    {
        var itemCtrl = m_partSelectionItemPool.Get();
        itemCtrl.FillData(filterCtx, dynamicResDict);
        RegisterPartSelectionItemEvents(itemCtrl);
        m_partSelectionItemCtrls.Add(itemCtrl);
    }
}

private void RegisterPartSelectionItemEvents(PartSelectionItemController itemCtrl)
{
    itemCtrl.EventOnClick += OnPartSelectionItemClick;
}

private void UnregisterPartSelectionItemEvents(PartSelectionItemController itemCtrl)
{
    itemCtrl.EventOnClick -= OnPartSelectionItemClick;
}

private void OnPartSelectionItemClick(PartSelectionItemController itemCtrl)
{
    var itemGlobalId = itemCtrl.ItemGlobalIdGet();
    EventOnPartSelectionItemClick?.Invoke(itemGlobalId);
}
```

### 10.3 ItemController数据填充

```csharp
// TackleAssembleItemController
public void FillData(SlotData slotData, IReadOnlyDictionary<string, UnityEngine.Object> dynamicResDict)
{
    m_slotData = slotData;

    // 1. 设置配件槽名称
    if (m_slotNameText != null)
    {
        m_slotNameText.text = slotData.SlotName;
    }

    // 2. 设置品质状态（根据装配的配件品质）
    if (m_qualityStateController != null && slotData.CurrentItemGlobalId.IsValid())
    {
        var itemQuality = GetItemQuality(slotData.CurrentItemGlobalId);
        SetQualityState(itemQuality);
    }

    // 3. 设置配件图标（如果已装配）
    if (slotData.CurrentItemGlobalId.IsValid() && !string.IsNullOrEmpty(slotData.IconPath))
    {
        if (dynamicResDict.TryGetValue(slotData.IconPath, out var iconObj))
        {
            var iconSprite = iconObj as Sprite;
            // 设置图标...
        }
    }

    // 4. 设置状态视觉效果
    SetStatusVisual(slotData.Status);

    // 5. 设置交互性
    m_button.interactable = (slotData.Status != SlotStatus.NotAvailable);
}

private void SetQualityState(ItemQuality quality)
{
    switch (quality)
    {
        case ItemQuality.Blue:
            m_qualityStateController.SetState("Blue");
            break;
        case ItemQuality.Purple:
            m_qualityStateController.SetState("Purple");
            break;
        case ItemQuality.Golden:
            m_qualityStateController.SetState("Golden");
            break;
    }
}

private void SetStatusVisual(SlotStatus status)
{
    switch (status)
    {
        case SlotStatus.MustEquip:
            m_backgroundImage.color = new Color(1f, 0.5f, 0.5f);  // 红色提示
            break;
        case SlotStatus.CanEquip:
            m_backgroundImage.color = Color.white;
            break;
        case SlotStatus.NotAvailable:
            m_backgroundImage.color = new Color(0.5f, 0.5f, 0.5f);  // 灰色
            break;
        case SlotStatus.Equipped:
            m_backgroundImage.color = Color.white;
            PlayEquippedEffect();  // 播放装配成功效果
            break;
    }
}

private void PlayEquippedEffect()
{
    // 播放旋转动画效果
    if (m_rotatingEffect != null)
    {
        m_rotatingEffect.SetActive(true);
        // TODO: 使用DOTween播放动画，完成后自动隐藏
    }
}
```

---

## 11. 性能优化设计

### 11.1 资源加载优化

- **使用更新管线异步加载**：所有动态资源通过更新管线加载
- **Pipeline Mask最小化加载**：只加载本次刷新需要的资源
- **资源缓存**：已加载的资源通过`CompDynamicResourceCacheManager`缓存

### 11.2 UI列表优化

- **EasyObjectPool对象池**：避免频繁创建/销毁GameObject

### 11.3 3D模型优化

- **按需加载**：只在需要时加载3D模型资源

---

## 12. 调试与日志

### 12.1 调试日志规范

```csharp
Debug.Log($"[TackleAssemble] {message}");
Debug.LogWarning($"[TackleAssemble] {message}");
Debug.LogError($"[TackleAssemble] {message}");

// 管线流程追踪
Debug.Log($"[TackleAssemble Pipeline] UpdateContextSetup - Mask: {m_currPipelineUpdateMask}");
Debug.Log($"[TackleAssemble Pipeline] DataCacheUpdate完成");
Debug.Log($"[TackleAssemble Pipeline] ViewUpdate完成");

// Mode切换日志
Debug.Log($"[TackleAssemble] Mode切换: {currentMode} → {newMode}");

// 网络请求日志
Debug.Log($"[TackleAssemble] RodAssembleCheck成功");
Debug.LogError($"[TackleAssemble] RodAssemble失败: {errCode}");
```

---

## 13. 总结

本文档基于BJFramework UITask使用范式，详细设计了钓具组装UITask的完整功能实现。

### 13.1 核心架构
- **严格分层**：Facade层(UITask) → 业务逻辑层(MainTofu) → UI表现层(UIController)
- **逻辑层访问**：只在Tofu中访问PlayerContext和逻辑层接口
- **事件冒泡**：内部组件事件 → 子Tofu → 子Task接口 → 父Tofu监听

### 13.2 数据流
- **统一入口**：通过`PlayerGameObjectCompRodAssembleClient`访问逻辑层
- **标准流程**：Check → NetTask → Mask刷新
- **数据模型**：`SlotData`（UI显示）、`TacklePartFilterCtx`（逻辑层）

### 13.3 控制流
- **Mode状态机**：Default / SlotEdit / BaitGroupEdit
- **UI状态切换**：SlotScrollView / PartSelectionScrollView / BaitGroupTypeScrollView（通过SetActive控制）
- **Pipeline Mask**：最小化刷新范围

### 13.4 关键修订
1. ✅ **配件槽数据**：去除3D相关字段，使用UIPrefab的SlotScrollView
2. ✅ **ESlotType重定义**：Reel/RodLine/BaitLine/Hook/LureBait/ExtraWeight
3. ✅ **逻辑层接口明确**：基于`IPlayerGameObjectRodAssembleClient`
4. ✅ **遵循UITask使用范式**：严格分层、PipelineMask、Check→NetTask→Mask刷新
5. ✅ **完整初始化流程**：详见`DataFlow_Initialization_Supplement.md`
6. ✅ **统一Prefab命名**：与`TackleAssembleUITask_Prefab_Specification_v2.md`保持一致
   - 字段命名：`m_slotScrollView` / `m_partSelectionScrollView`（Prefab节点名为`AssemblyScrollView`）
   - 使用对象池统一管理Item

---

**文档版本**：v2.0
**创建日期**：2025年
**作者**：Claude Code
**审阅状态**：待审阅

**配套文档**：
- `DataFlow_Initialization_Supplement.md` - 初始化流程详解
- `TackleAssembleUITask_Design_Proposal.md` - 需求方案
