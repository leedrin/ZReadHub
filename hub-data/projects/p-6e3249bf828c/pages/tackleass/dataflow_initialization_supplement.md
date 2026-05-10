# 钓具组装UITask - 完整数据流图（含初始化流程）

## 1. 初始化流程完整数据流

### 1.1 UITask启动到初始化完成

```
┌──────────────────────────────────────────────────────────────────┐
│  用户触发：打开钓具组装界面                                        │
│  - 从背包界面点击钓竿                                              │
│  - 从房间内钓具管理界面进入                                        │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────────────────┐
│  外部调用：启动UITask                                              │
│  TackleAssembleUITask.TackleAssembleUITaskStart(rodInstanceId)   │
│  ├─ 创建UIIntentCustom                                           │
│  │  └─ SetParam(IntentParamKey4RodInstanceId, rodInstanceId)    │
│  └─ UIManager.Instance.StartUITask(uiIntent, onPipelineEnd)     │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────────────────┐
│  框架层：UITask管线启动                                            │
│  UpdatePipelineStartType.Init                                    │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────────────────┐
│  Step 1: UpdateContextSetup (设置更新现场)                        │
│  TackleAssembleUITaskCompMainTofu.UpdateContextSetup()          │
│  ├─ 从UIIntent获取参数                                           │
│  │  └─ m_rodInstanceId = paramDict.GetStructParam<ulong>(       │
│  │         IntentParamKey4RodInstanceId)                         │
│  ├─ 获取Pipeline Mask (初始化时为None或RefreshAll)              │
│  │  └─ m_currPipelineUpdateMask = paramDict.GetStructParam<>()  │
│  └─ 记录管线启动类型                                              │
│     └─ m_pipelineStartType = pipelineStartType (Init)           │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────────────────┐
│  Step 2: DataCacheUpdateIsNeededCheck (检查是否需要刷新数据缓存)  │
│  return IsUITaskUpdatePipelineInitOrResume() → true              │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────────────────┐
│  Step 3: DataCacheUpdate (刷新数据缓存 - 从逻辑层获取数据)        │
│  TackleAssembleUITaskCompMainTofu.DataCacheUpdate()             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  3.1 获取PlayerContext和逻辑层组件                         │ │
│  │  var playerGO = PlayerCtx.PlayerGameObjectGet();           │ │
│  │  var rodAssembleComp = playerGO.CompRodAssembleGet()       │ │
│  │      as IPlayerGameObjectCompRodAssembleClient;            │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  3.2 获取钓竿组装配置信息                                  │ │
│  │  m_currentRodAssembleInfo =                                │ │
│  │      playerGO.RodAssembleConfInfoGet(m_rodInstanceId);     │ │
│  │                                                            │ │
│  │  返回：ConfigDataRodAssembleInfo 包含：                    │ │
│  │  - m_reelItemGlobalId (渔轮物品ID)                        │ │
│  │  - m_rodLineItemGlobalId (主线物品ID)                     │ │
│  │  - m_baitGroupAssembleType (钓组组装类型)                 │ │
│  │  - m_baitLineItemGlobalId (子线物品ID)                    │ │
│  │  - m_hookItemGlobalIds[] (鱼钩物品ID数组)                 │ │
│  │  - m_lureBaitItemGlobalIds[] (假饵物品ID数组)             │ │
│  │  - m_extraWeightItemGlobalIds[] (配重物品ID数组)          │ │
│  │  - m_segmentCount (线段数量)                              │ │
│  │  - m_segmentLengths[] (线段长度数组)                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  3.3 获取钓竿物品信息（用于显示钓竿名称、图标等）          │ │
│  │  m_rodStoreItem =                                          │ │
│  │      playerGO.RodStoreItemGet4Assemble(m_rodInstanceId);   │ │
│  │                                                            │ │
│  │  返回：IRodStoreItemInfoProvider 包含：                    │ │
│  │  - ConfGet() (钓竿配置数据)                               │ │
│  │  - InstanceIdGet() (钓竿实例ID)                           │ │
│  │  - DisplayNameGet() (显示名称)                            │ │
│  │  - IconPathGet() (图标路径)                               │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  3.4 构建配件槽数据列表（UI显示用）                        │ │
│  │  BuildSlotDataList()                                       │ │
│  │  {                                                         │ │
│  │      m_slotDataList = new List<SlotData>();               │ │
│  │                                                            │ │
│  │      // 3.4.1 添加固定配件槽                               │ │
│  │      // 渔轮槽                                             │ │
│  │      m_slotDataList.Add(new SlotData {                    │ │
│  │          SlotName = "渔轮",                                │ │
│  │          SlotType = ESlotType.Reel,                        │ │
│  │          CurrentItemGlobalId =                             │ │
│  │              m_currentRodAssembleInfo.m_reelItemGlobalId, │ │
│  │          Status = m_currentRodAssembleInfo                 │ │
│  │              .m_reelItemGlobalId.IsValid()                 │ │
│  │              ? SlotStatus.Equipped                         │ │
│  │              : SlotStatus.MustEquip,                       │ │
│  │          SegmentIndex = -1                                 │ │
│  │      });                                                   │ │
│  │                                                            │ │
│  │      // 主线槽                                             │ │
│  │      m_slotDataList.Add(new SlotData {                    │ │
│  │          SlotName = "主线",                                │ │
│  │          SlotType = ESlotType.RodLine,                     │ │
│  │          CurrentItemGlobalId =                             │ │
│  │              m_currentRodAssembleInfo.m_rodLineItemGlobalId,│ │
│  │          Status = m_currentRodAssembleInfo                 │ │
│  │              .m_rodLineItemGlobalId.IsValid()              │ │
│  │              ? SlotStatus.Equipped                         │ │
│  │              : SlotStatus.MustEquip,                       │ │
│  │          SegmentIndex = -1                                 │ │
│  │      });                                                   │ │
│  │                                                            │ │
│  │      // 3.4.2 根据钓组类型添加钓组配件槽                   │ │
│  │      BuildBaitGroupSlots(m_currentRodAssembleInfo);       │ │
│  │      // 详见 BuildBaitGroupSlots() 实现                    │ │
│  │  }                                                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  3.5 初始化其他缓存数据                                    │ │
│  │  m_partFilterCtxList = null; // 部件列表初始化时不加载     │ │
│  │  m_currentEditingSlotType = ESlotType.Reel; // 默认值      │ │
│  │  m_currentEditingSegIndex = -1;                            │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────────────────┐
│  Step 4: DynamicResLoadIsNeededCheck (检查是否需要加载动态资源)   │
│  return IsUITaskUpdatePipelineInitOrResume() → true              │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────────────────┐
│  Step 5: DynamicResCollect4Load (收集需要加载的动态资源)          │
│  TackleAssembleUITaskCompMainTofu.DynamicResCollect4Load()      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  5.1 收集配件槽图标资源                                    │ │
│  │  CollectSlotIcons(ref resPathList)                         │ │
│  │  {                                                         │ │
│  │      foreach (var slotData in m_slotDataList)             │ │
│  │      {                                                     │ │
│  │          if (slotData.CurrentItemGlobalId.IsValid())      │ │
│  │          {                                                 │ │
│  │              // 获取物品提供者                             │ │
│  │              var itemProvider = GetItemProvider(          │ │
│  │                  slotData.CurrentItemGlobalId);           │ │
│  │              // 添加图标路径                               │ │
│  │              resPathList.Add(                             │ │
│  │                  itemProvider.IconPathGet());             │ │
│  │          }                                                 │ │
│  │      }                                                     │ │
│  │  }                                                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  5.2 收集UI预制件资源                                      │ │
│  │  resPathList.Add(SlotItemPrefabPath);                     │ │
│  │  resPathList.Add(PartItemPrefabPath);                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  5.3 收集3D模型资源（通过TackleStageActor）               │ │
│  │  // 注意：3D模型资源由子任务TackleAssembleTackleUITask    │ │
│  │  // 在其管线中收集，这里不需要                             │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────────────────┐
│  Step 6: 框架层加载动态资源                                        │
│  Addressables.LoadAssetsAsync<UnityEngine.Object>(resPathList)  │
│  - 异步加载所有收集的资源                                          │
│  - 加载完成后缓存到CompDynamicResourceCacheManager               │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────────────────┐
│  Step 7: OnEventUIControllerLoadCompleted (UIController加载完成) │
│  TackleAssembleUITaskCompMainTofu.OnEventUIControllerLoadCompleted│
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  7.1 获取UIController引用                                  │ │
│  │  m_mainUICtrl = m_compUIControllerManager                  │ │
│  │      .UIControllerGetByName(nameof(TackleAssembleUIController));│
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  7.2 初始化UIController的EasyObjectPool                    │ │
│  │  // UIController内部自动初始化                             │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────────────────┐
│  Step 8: ViewUpdate (刷新视图显示)                                │
│  TackleAssembleUITaskCompMainTofu.ViewUpdate()                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  8.1 刷新配件槽列表                                        │ │
│  │  m_mainUICtrl.SlotListRefresh(m_slotDataList,             │ │
│  │      m_owner.CompDynamicResourceCacheManagerGet()          │ │
│  │          .DynamicResCacheDictGet());                       │ │
│  │  {                                                         │ │
│  │      // UIController内部实现：                             │ │
│  │      // - 从对象池获取/创建SlotItem                        │ │
│  │      // - 填充数据（名称、图标、状态）                     │ │
│  │      // - 设置视觉效果（颜色、可点击性）                   │ │
│  │  }                                                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  8.2 设置UI状态机到初始状态                                │ │
│  │  m_mainUICtrl.SetToUIState("SlotScrollView");             │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  8.3 注册所有UI事件                                        │ │
│  │  RegisterAllUIEvents();                                    │ │
│  │  {                                                         │ │
│  │      m_mainUICtrl.EventOnSlotButtonClick +=                │ │
│  │          OnSlotButtonClick;                                │ │
│  │      m_mainUICtrl.EventOnReturnButtonClick +=              │ │
│  │          OnReturnButtonClick;                              │ │
│  │      // ... 其他事件注册                                   │ │
│  │  }                                                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  8.4 播放淡入UIProcess                                     │ │
│  │  var fadeInProcess = m_mainUICtrl.FadeInOutUIProcessGet(true);│
│  │  m_compUIProcessManager.UIProcessPlay(fadeInProcess);     │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────────────────┐
│  Step 9: CooperativeUITaskUpdate (协同更新 - 启动子任务)          │
│  TackleAssembleUITaskCompUpdatePipeline.CooperativeUITaskUpdate │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  9.1 创建TackleStageActor（3D钓具模型）                    │ │
│  │  var mainTofu = m_owner.CompMainTofuGet();                │ │
│  │  var tackleActor = mainTofu.TackleCreate(m_rodInstanceId);│ │
│  │  {                                                         │ │
│  │      // MainTofu.TackleCreate() 实现：                     │ │
│  │      var tackleInitInfo =                                  │ │
│  │          playerGO.TackleInitInfoGet4Assemble(             │ │
│  │              m_rodInstanceId);                             │ │
│  │                                                            │ │
│  │      var tackleInfoProvider = new SpinningTackleInfoProvider(│
│  │          tackleInitInfo,                                   │ │
│  │          ConfigDataHelper.s_configDataLoader,             │ │
│  │          ConfigDataHelper.s_exportDataLoader);            │ │
│  │                                                            │ │
│  │      m_currentTackleActor =                                │ │
│  │          new TackleStageActor(tackleInfoProvider);        │ │
│  │                                                            │ │
│  │      return m_currentTackleActor;                          │ │
│  │  }                                                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  9.2 启动TackleAssembleTackleUITask子任务（劫持管线）      │ │
│  │  var tackleViewIntent =                                    │ │
│  │      TackleAssembleTackleUITask                            │ │
│  │          .TackleAssembleTackleUIIntentCreate(              │ │
│  │              tackleActor,                                  │ │
│  │              StagePresets.TackleStage,                     │ │
│  │              actorRotateEnabled: true,                     │ │
│  │              enableInteraction: true);                     │ │
│  │                                                            │ │
│  │  m_redirectPipelineWaitingCount++;                        │ │
│  │  m_owner.CompSubUITaskManagerGet().SubUITaskStart(        │ │
│  │      tackleViewIntent,                                     │ │
│  │      redirectPipelineHost: this);                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  9.3 注册子任务事件                                        │ │
│  │  mainTofu.TackleEventRegister();                          │ │
│  │  {                                                         │ │
│  │      m_tackleAssembleTackleUITask =                        │ │
│  │          UIManager.Instance.FindUITaskWithName(            │ │
│  │              nameof(TackleAssembleTackleUITask));         │ │
│  │                                                            │ │
│  │      var tackleTaskInterface =                             │ │
│  │          m_tackleAssembleTackleUITask as                   │ │
│  │              ITackleAssembleTackleUITask;                  │ │
│  │                                                            │ │
│  │      tackleTaskInterface.EventOnActorReady +=              │ │
│  │          OnActorReady;                                     │ │
│  │      tackleTaskInterface.EventOnDragStart +=               │ │
│  │          OnDragStart;                                      │ │
│  │      tackleTaskInterface.EventOnDragEnd +=                 │ │
│  │          OnDragEnd;                                        │ │
│  │  }                                                         │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────────────────┐
│  Step 10: TackleAssembleTackleUITask子任务初始化                  │
│  (子任务独立的管线流程)                                            │
│  ├─ UpdateContextSetup: 获取IStageActor                          │
│  ├─ ViewUpdate: DisplayStageActorInternal() 实例化3D模型         │
│  └─ 触发EventOnActorReady事件                                    │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────────────────┐
│  Step 11: 接收子任务事件回调                                      │
│  TackleAssembleUITaskCompMainTofu.OnActorReady(IStageActor actor)│
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  11.1 获取3D模型的配件槽信息（可选）                       │ │
│  │  // 如果需要根据3D模型调整UI配件槽位置                     │ │
│  │  var tackleSlotList =                                      │ │
│  │      actor.GameObject.GetComponent<TackleSlotList>();     │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  11.2 初始化完成标记                                       │ │
│  │  m_isInitialized = true;                                   │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────────────────┐
│  初始化完成                                                        │
│  - 配件槽列表显示完成                                              │
│  - 3D钓具模型显示完成                                              │
│  - 所有事件已注册                                                  │
│  - 用户可以开始交互                                                │
└──────────────────────────────────────────────────────────────────┘
```

## 2. 关键数据结构详解

### 2.1 ConfigDataRodAssembleInfo（从逻辑层获取）

```csharp
/// <summary>
/// 钓竿组装配置信息（逻辑层返回）
/// </summary>
public class ConfigDataRodAssembleInfo
{
    /// <summary>
    /// 渔轮物品GlobalId
    /// </summary>
    public UnitedStoreItemGlobalId m_reelItemGlobalId;

    /// <summary>
    /// 主线物品GlobalId
    /// </summary>
    public UnitedStoreItemGlobalId m_rodLineItemGlobalId;

    /// <summary>
    /// 钓组组装类型
    /// </summary>
    public BaitGroupAssembleType m_baitGroupAssembleType;

    /// <summary>
    /// 子线物品GlobalId
    /// </summary>
    public UnitedStoreItemGlobalId m_baitLineItemGlobalId;

    /// <summary>
    /// 线段数量
    /// </summary>
    public int m_segmentCount;

    /// <summary>
    /// 线段长度数组
    /// </summary>
    public List<float> m_segmentLengths;

    /// <summary>
    /// 鱼钩物品GlobalId数组（每个线段一个）
    /// </summary>
    public List<UnitedStoreItemGlobalId> m_hookItemGlobalIds;

    /// <summary>
    /// 假饵物品GlobalId数组（每个线段一个）
    /// </summary>
    public List<UnitedStoreItemGlobalId> m_lureBaitItemGlobalIds;

    /// <summary>
    /// 配重物品GlobalId数组（每个线段一个，可选）
    /// </summary>
    public List<UnitedStoreItemGlobalId> m_extraWeightItemGlobalIds;
}
```

### 2.2 BuildBaitGroupSlots详细实现

```csharp
/// <summary>
/// 根据钓组类型构建钓组配件槽
/// </summary>
private void BuildBaitGroupSlots(ConfigDataRodAssembleInfo rodAssembleInfo)
{
    if (rodAssembleInfo == null) return;

    switch (rodAssembleInfo.m_baitGroupAssembleType)
    {
        case BaitGroupAssembleType.Simple:
            BuildSimpleBaitGroupSlots(rodAssembleInfo);
            break;

        case BaitGroupAssembleType.Frog:
            BuildFrogBaitGroupSlots(rodAssembleInfo);
            break;

        case BaitGroupAssembleType.JiggingRig:
            BuildJiggingRigBaitGroupSlots(rodAssembleInfo);
            break;

        default:
            Debug.LogWarning($"未知的钓组类型: {rodAssembleInfo.m_baitGroupAssembleType}");
            break;
    }
}

/// <summary>
/// 构建简单钓组配件槽
/// 结构：子线 + 每段的(鱼钩/假饵/配重)
/// </summary>
private void BuildSimpleBaitGroupSlots(ConfigDataRodAssembleInfo info)
{
    // 子线槽
    m_slotDataList.Add(new SlotData
    {
        SlotName = "子线",
        SlotType = ESlotType.BaitLine,
        CurrentItemGlobalId = info.m_baitLineItemGlobalId,
        Status = info.m_baitLineItemGlobalId.IsValid()
            ? SlotStatus.Equipped : SlotStatus.MustEquip,
        SegmentIndex = -1,
        IconPath = GetItemIconPath(info.m_baitLineItemGlobalId)
    });

    // 遍历每个线段
    for (int i = 0; i < info.m_segmentCount; i++)
    {
        // 鱼钩槽
        m_slotDataList.Add(new SlotData
        {
            SlotName = $"鱼钩-段{i + 1}",
            SlotType = ESlotType.Hook,
            CurrentItemGlobalId = info.m_hookItemGlobalIds[i],
            Status = info.m_hookItemGlobalIds[i].IsValid()
                ? SlotStatus.Equipped : SlotStatus.CanEquip,
            SegmentIndex = i,
            IconPath = GetItemIconPath(info.m_hookItemGlobalIds[i])
        });

        // 假饵槽
        m_slotDataList.Add(new SlotData
        {
            SlotName = $"假饵-段{i + 1}",
            SlotType = ESlotType.LureBait,
            CurrentItemGlobalId = info.m_lureBaitItemGlobalIds[i],
            Status = info.m_lureBaitItemGlobalIds[i].IsValid()
                ? SlotStatus.Equipped : SlotStatus.CanEquip,
            SegmentIndex = i,
            IconPath = GetItemIconPath(info.m_lureBaitItemGlobalIds[i])
        });

        // 配重槽（可选）
        m_slotDataList.Add(new SlotData
        {
            SlotName = $"配重-段{i + 1}",
            SlotType = ESlotType.ExtraWeight,
            CurrentItemGlobalId = info.m_extraWeightItemGlobalIds[i],
            Status = info.m_extraWeightItemGlobalIds[i].IsValid()
                ? SlotStatus.Equipped : SlotStatus.CanEquip,
            SegmentIndex = i,
            IconPath = GetItemIconPath(info.m_extraWeightItemGlobalIds[i])
        });
    }
}

/// <summary>
/// 构建雷蛙钓组配件槽
/// 结构：直接连接假饵（无子线、无鱼钩）
/// </summary>
private void BuildFrogBaitGroupSlots(ConfigDataRodAssembleInfo info)
{
    m_slotDataList.Add(new SlotData
    {
        SlotName = "假饵（雷蛙）",
        SlotType = ESlotType.LureBait,
        CurrentItemGlobalId = info.m_lureBaitItemGlobalIds[0],
        Status = info.m_lureBaitItemGlobalIds[0].IsValid()
            ? SlotStatus.Equipped : SlotStatus.MustEquip,
        SegmentIndex = 0,
        IconPath = GetItemIconPath(info.m_lureBaitItemGlobalIds[0])
    });
}

/// <summary>
/// 构建铅头钩钓组配件槽
/// 结构：铅头钩 + 假饵
/// </summary>
private void BuildJiggingRigBaitGroupSlots(ConfigDataRodAssembleInfo info)
{
    // 铅头钩槽（自带配重的鱼钩）
    m_slotDataList.Add(new SlotData
    {
        SlotName = "铅头钩",
        SlotType = ESlotType.Hook,
        CurrentItemGlobalId = info.m_hookItemGlobalIds[0],
        Status = info.m_hookItemGlobalIds[0].IsValid()
            ? SlotStatus.Equipped : SlotStatus.MustEquip,
        SegmentIndex = 0,
        IconPath = GetItemIconPath(info.m_hookItemGlobalIds[0])
    });

    // 假饵槽
    m_slotDataList.Add(new SlotData
    {
        SlotName = "假饵",
        SlotType = ESlotType.LureBait,
        CurrentItemGlobalId = info.m_lureBaitItemGlobalIds[0],
        Status = info.m_lureBaitItemGlobalIds[0].IsValid()
            ? SlotStatus.Equipped : SlotStatus.MustEquip,
        SegmentIndex = 0,
        IconPath = GetItemIconPath(info.m_lureBaitItemGlobalIds[0])
    });
}

/// <summary>
/// 获取物品图标路径
/// </summary>
private string GetItemIconPath(UnitedStoreItemGlobalId itemGlobalId)
{
    if (!itemGlobalId.IsValid())
    {
        return string.Empty;
    }

    var itemProvider = GetItemProvider(itemGlobalId);
    return itemProvider?.IconPathGet() ?? string.Empty;
}

/// <summary>
/// 获取物品提供者
/// </summary>
private IStoreItemInfoProvider GetItemProvider(UnitedStoreItemGlobalId itemGlobalId)
{
    var playerGO = PlayerCtx.PlayerGameObjectGet();

    // 根据物品类型获取对应的Provider
    switch (itemGlobalId.m_itemType)
    {
        case StoreItemType.Reel:
            return playerGO.CompReelItemStore.ReelStoreItemGet(itemGlobalId.m_itemInstanceId);

        case StoreItemType.Line:
            return playerGO.CompLineItemStore.LineStoreItemGet(itemGlobalId.m_itemInstanceId);

        case StoreItemType.Hook:
            return playerGO.CompHookItemStore.HookStoreItemGet(itemGlobalId.m_itemInstanceId);

        case StoreItemType.Lure:
            return playerGO.CompLureItemStore.LureStoreItemGet(itemGlobalId.m_itemInstanceId);

        // ... 其他类型

        default:
            Debug.LogWarning($"未处理的物品类型: {itemGlobalId.m_itemType}");
            return null;
    }
}
```

## 3. 逻辑层接口完整调用链

```
TackleAssembleUITaskCompMainTofu
    │
    ├─> PlayerCtx.PlayerGameObjectGet()
    │   └─> IPlayerGameObject (PlayerGameObjectClient)
    │
    ├─> playerGO.CompRodAssembleGet()
    │   └─> IPlayerGameObjectCompRodAssembleClient
    │       (PlayerGameObjectCompRodAssembleClient)
    │
    ├─> playerGO.RodAssembleConfInfoGet(rodInstanceId)
    │   └─> ConfigDataRodAssembleInfo
    │       (包含所有配件槽当前装配信息)
    │
    ├─> playerGO.RodStoreItemGet4Assemble(rodInstanceId)
    │   └─> IRodStoreItemInfoProvider
    │       (钓竿物品信息)
    │
    ├─> playerGO.TackleInitInfoGet4Assemble(rodInstanceId)
    │   └─> FLTackleInitInfo
    │       (用于创建TackleStageActor的3D模型初始化信息)
    │
    └─> rodAssembleComp.ReelItemListGet4Assemble(rodInstanceId)
        └─> List<TacklePartFilterCtx>
            (可装配的渔轮列表，含过滤状态)
```

## 4. 初始化时序图

```
外部调用              UITask              MainTofu            逻辑层              框架层
    │                   │                   │                  │                   │
    │  StartUITask      │                   │                  │                   │
    │──────────────────>│                   │                  │                   │
    │                   │  管线启动(Init)    │                  │                   │
    │                   │──────────────────>│                  │                   │
    │                   │                   │ UpdateContextSetup                   │
    │                   │                   │ (获取rodInstanceId)                  │
    │                   │                   │                  │                   │
    │                   │                   │ DataCacheUpdate  │                   │
    │                   │                   │──────────────────>│                  │
    │                   │                   │ RodAssembleConfInfoGet               │
    │                   │                   │<──────────────────│                  │
    │                   │                   │ ConfigDataRodAssembleInfo            │
    │                   │                   │                  │                   │
    │                   │                   │ BuildSlotDataList│                   │
    │                   │                   │ (构建UI数据)      │                   │
    │                   │                   │                  │                   │
    │                   │                   │ DynamicResCollect│                   │
    │                   │                   │──────────────────────────────────────>│
    │                   │                   │                  │  加载资源          │
    │                   │                   │<──────────────────────────────────────│
    │                   │                   │                  │                   │
    │                   │  OnEventUIControllerLoadCompleted    │                   │
    │                   │──────────────────>│                  │                   │
    │                   │                   │ (获取UIController引用)               │
    │                   │                   │                  │                   │
    │                   │  ViewUpdate       │                  │                   │
    │                   │──────────────────>│                  │                   │
    │                   │                   │ SlotListRefresh  │                   │
    │                   │                   │──────────────────>UIController       │
    │                   │                   │                  │  (显示配件槽列表)  │
    │                   │                   │                  │                   │
    │                   │  CooperativeUITaskUpdate             │                   │
    │                   │──────────────────>│                  │                   │
    │                   │                   │ TackleCreate     │                   │
    │                   │                   │──────────────────>│                  │
    │                   │                   │ TackleInitInfoGet│                   │
    │                   │                   │<──────────────────│                  │
    │                   │                   │ FLTackleInitInfo │                   │
    │                   │                   │ (创建TackleStageActor)               │
    │                   │                   │                  │                   │
    │                   │  启动子任务        │                  │                   │
    │                   │──────────────────>TackleAssembleTackleUITask            │
    │                   │                   │                  │ (子任务管线启动)   │
    │                   │                   │                  │ (实例化3D模型)     │
    │                   │                   │                  │                   │
    │                   │  EventOnActorReady│                  │                   │
    │                   │<──────────────────│                  │                   │
    │                   │                   │ OnActorReady     │                   │
    │                   │                   │ (初始化完成)      │                   │
    │                   │                   │                  │                   │
    │  初始化完成        │                   │                  │                   │
    │<──────────────────│                   │                  │                   │
```

## 5. 初始化完成后的状态

初始化完成后，系统达到以下状态：

### 5.1 数据缓存已准备就绪
- `m_rodInstanceId`：当前编辑的钓竿实例ID
- `m_currentRodAssembleInfo`：钓竿组装配置信息（从逻辑层获取）
- `m_slotDataList`：配件槽UI显示数据列表（已根据钓组类型构建）
- `m_rodStoreItem`：钓竿物品信息

### 5.2 UI已显示
- 配件槽列表已渲染（SlotScrollView）
- UI状态机处于"SlotScrollView"状态
- 3D钓具模型已实例化并显示

### 5.3 事件已注册
- UIController的所有事件已订阅
- 子任务的事件已订阅（EventOnActorReady/EventOnDragStart/EventOnDragEnd）

### 5.4 用户可交互
- 可点击配件槽按钮（触发部件选择）
- 可旋转/缩放3D模型
- 可切换钓组类型

---

**补充说明**：
1. 初始化时不加载部件选择列表，只在用户点击配件槽时按需加载
2. 3D模型的实例化由子任务TackleAssembleTackleUITask独立管理
3. 所有逻辑层数据获取都集中在MainTofu的DataCacheUpdate中
4. 资源加载通过Pipeline机制统一管理，支持异步加载
