# 钓具组装完整流程 - 详细功能设计文档

## 1. 概述

本文档基于已实现的钓具组装界面三状态交互功能，结合钓具工厂系统设计和场景控制器分析，提供钓具组装完整流程的详细功能设计。该设计实现了从UI交互到3D模型热替换的完整流程，确保用户可以在钓具组装界面中实时预览和更换钓具部件。

## 2. 系统架构概览

### 2.1 分层架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                     UI交互层 (UI Layer)                      │
├─────────────────────────────────────────────────────────────┤
│  TackleAssembleUITask    │  TackleAssembleTackleUITask      │
│  (主控制器)               │  (3D展示)                        │
│                         │                                  │
│  TackleAssembleBaitGroupUITask  │  PartSelectionUITask     │
│  (钓组放大镜)             │  (部件选择界面)                   │
└─────────────────────────────────────────────────────────────┘
                                │
                         适配器模式转换
                                │
┌─────────────────────────────────────────────────────────────┐
│                   工厂与资源层 (Factory Layer)                │
├─────────────────────────────────────────────────────────────┤
│  TackleFactory           │  ResourceManager                 │
│  (钓具工厂)               │  (资源管理)                       │
│                         │                                  │
│  PartConfigProvider      │  AssetLoader                     │
│  (配置提供者)             │  (资源加载器)                     │
└─────────────────────────────────────────────────────────────┘
                                │
                        组件调用与更新
                                │
┌─────────────────────────────────────────────────────────────┐
│                   3D控制器层 (Controller Layer)               │
├─────────────────────────────────────────────────────────────┤
│  TackleActorController   │  LureRigActorController          │
│  (钓具控制器)             │  (钓组控制器)                     │
│                         │                                  │
│  TackleActorViewCtrl     │  Scene管理组件                    │
│  (视图控制代理)           │  (FLSceneTaskComp...)            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 核心数据流

```
用户操作 → UI事件 → 适配器转换 → 工厂创建 → 控制器更新 → 视图刷新
```

## 3. 核心组件详细设计

### 3.1 TackleAssembleUITaskCompMainTofu 增强设计

#### 3.1.1 新增核心接口

```csharp
namespace BlackJack.ProjectEF.Runtime.UI
{
    public interface ITackleAssembleUITaskCompMainTofu : IUITaskCompTofuBase
    {
        // 现有接口...

        /// <summary>
        /// 部件热替换接口
        /// </summary>
        /// <param name="slotName">配件槽名称</param>
        /// <param name="newPartConfigId">新部件配置ID</param>
        void PartHotSwap(string slotName, int newPartConfigId);

        /// <summary>
        /// 获取TackleActorController引用
        /// </summary>
        /// <returns>钓具控制器</returns>
        TackleActorController TackleActorControllerGet();

        /// <summary>
        /// 获取LureRigActorController引用
        /// </summary>
        /// <returns>钓组控制器</returns>
        LureRigActorController LureRigActorControllerGet();

        /// <summary>
        /// 启动部件选择UI
        /// </summary>
        /// <param name="slotType">配件槽类型</param>
        /// <param name="currentPartId">当前装配的部件ID</param>
        void PartSelectionUIStart(ESlotType slotType, int currentPartId);
    }
}
```

#### 3.1.2 部件热替换核心实现

```csharp
/// <summary>
/// 部件热替换实现
/// </summary>
/// <param name="slotName">配件槽名称</param>
/// <param name="newPartConfigId">新部件配置ID</param>
public void PartHotSwap(string slotName, int newPartConfigId)
{
    if (m_tackleActorController == null)
    {
        Debug.LogError("TackleAssembleUITaskCompMainTofu: TackleActorController未初始化");
        return;
    }

    // 根据槽类型执行不同的热替换逻辑
    var slotInfo = SlotInfoGet(slotName);
    if (slotInfo == null)
    {
        Debug.LogError($"TackleAssembleUITaskCompMainTofu: 未找到配件槽 {slotName}");
        return;
    }

    switch (slotInfo.m_slotType)
    {
        case ESlotType.Tackle:
            TacklePartHotSwap(slotName, newPartConfigId);
            break;
        case ESlotType.BaitGroup:
            BaitGroupPartHotSwap(slotName, newPartConfigId);
            break;
    }
}

/// <summary>
/// 钓具部件热替换
/// </summary>
/// <param name="slotName">配件槽名称</param>
/// <param name="newPartConfigId">新部件配置ID</param>
private void TacklePartHotSwap(string slotName, int newPartConfigId)
{
    // 1. 通过资源管理器加载新部件Prefab
    GameObject newPartPrefab = LoadPartPrefab(slotName, newPartConfigId);
    if (newPartPrefab == null)
    {
        Debug.LogError($"TackleAssembleUITaskCompMainTofu: 加载部件失败 {slotName}, ConfigId: {newPartConfigId}");
        return;
    }

    // 2. 调用TackleActorController的对应接口
    switch (slotName)
    {
        case "Rod":
            m_tackleActorController.RodWithHandleSet(newPartPrefab);
            Debug.Log($"TackleAssembleUITaskCompMainTofu: 钓竿热替换完成 - ConfigId: {newPartConfigId}");
            break;
        case "Reel":
            m_tackleActorController.ReelSet(newPartPrefab);
            Debug.Log($"TackleAssembleUITaskCompMainTofu: 渔轮热替换完成 - ConfigId: {newPartConfigId}");
            break;
        default:
            Debug.LogWarning($"TackleAssembleUITaskCompMainTofu: 不支持的钓具部件槽 {slotName}");
            break;
    }

    // 3. 更新配件槽UI状态
    m_mainUICtrl?.UpdateSlotButtonStatus(slotName, TackleAssembleUIController.SlotStatus.Equipped);
}

/// <summary>
/// 钓组部件热替换
/// </summary>
/// <param name="slotName">配件槽名称</param>
/// <param name="newPartConfigId">新部件配置ID</param>
private void BaitGroupPartHotSwap(string slotName, int newPartConfigId)
{
    if (m_lureRigActorController == null)
    {
        Debug.LogError("TackleAssembleUITaskCompMainTofu: LureRigActorController未初始化");
        return;
    }

    // 1. 根据配置加载钓组部件
    GameObject hookPrefab = null;
    GameObject lurePrefab = null;

    switch (slotName)
    {
        case "Hook":
            hookPrefab = LoadPartPrefab(slotName, newPartConfigId);
            break;
        case "Lure":
            lurePrefab = LoadPartPrefab(slotName, newPartConfigId);
            break;
        case "LureRig":
            // 完整钓组替换，需要加载钓组配置
            var lureRigConfig = LoadLureRigConfig(newPartConfigId);
            hookPrefab = LoadPartPrefab("Hook", lureRigConfig.HookId);
            lurePrefab = LoadPartPrefab("Lure", lureRigConfig.LureId);
            break;
    }

    // 2. 调用LureRigActorController的替换接口
    if (hookPrefab != null && lurePrefab != null)
    {
        m_lureRigActorController.LureRigReset(hookPrefab, lurePrefab);
    }
    else if (hookPrefab != null)
    {
        // 单独替换鱼钩（需要扩展LureRigActorController接口）
        Debug.LogWarning("TackleAssembleUITaskCompMainTofu: 单独替换鱼钩功能待实现");
    }
    else if (lurePrefab != null)
    {
        // 单独替换假饵（需要扩展LureRigActorController接口）
        Debug.LogWarning("TackleAssembleUITaskCompMainTofu: 单独替换假饵功能待实现");
    }

    // 3. 更新钓组放大镜视图
    RefreshBaitGroupView();

    // 4. 更新TackleActorController中的钓组引用
    m_tackleActorController.LureRigSet(m_lureRigActorController.gameObject);

    Debug.Log($"TackleAssembleUITaskCompMainTofu: 钓组热替换完成 - {slotName}, ConfigId: {newPartConfigId}");
}
```

#### 3.1.3 资源加载与管理

```csharp
/// <summary>
/// 加载部件Prefab
/// </summary>
/// <param name="slotName">配件槽名称</param>
/// <param name="partConfigId">部件配置ID</param>
/// <returns>加载的Prefab</returns>
private GameObject LoadPartPrefab(string slotName, int partConfigId)
{
    try
    {
        string prefabPath = GetPartPrefabPath(slotName, partConfigId);
        if (string.IsNullOrEmpty(prefabPath))
        {
            Debug.LogError($"TackleAssembleUITaskCompMainTofu: 获取部件资源路径失败 {slotName}, ConfigId: {partConfigId}");
            return null;
        }

        // 通过动态资源管理器加载
        var dynamicResMgr = m_owner.CompDynamicResourceCacheManagerGet();
        var prefab = dynamicResMgr.DynamicResourceAlloc(prefabPath) as GameObject;

        if (prefab == null)
        {
            Debug.LogError($"TackleAssembleUITaskCompMainTofu: 加载部件Prefab失败 {prefabPath}");
            return null;
        }

        return prefab;
    }
    catch (System.Exception ex)
    {
        Debug.LogError($"TackleAssembleUITaskCompMainTofu: 加载部件异常 {slotName}, ConfigId: {partConfigId}, Error: {ex.Message}");
        return null;
    }
}

/// <summary>
/// 获取部件Prefab资源路径
/// </summary>
/// <param name="slotName">配件槽名称</param>
/// <param name="partConfigId">部件配置ID</param>
/// <returns>资源路径</returns>
private string GetPartPrefabPath(string slotName, int partConfigId)
{
    var configLoader = m_owner.ConfigDataLoaderGet();

    switch (slotName)
    {
        case "Rod":
            var rodConfig = configLoader.GetConfigDataRodInfo(partConfigId);
            return rodConfig?.PrefabAssetPath;
        case "Reel":
            var reelConfig = configLoader.GetConfigDataReelInfo(partConfigId);
            return reelConfig?.PrefabAssetPath;
        case "Hook":
            var hookConfig = configLoader.GetConfigDataHookInfo(partConfigId);
            return hookConfig?.PrefabAssetPath;
        case "Lure":
            var lureConfig = configLoader.GetConfigDataLureInfo(partConfigId);
            return lureConfig?.PrefabAssetPath;
        case "LureRig":
            var lureRigConfig = configLoader.GetConfigDataLureRigInfo(partConfigId);
            return lureRigConfig?.PrefabAssetPath;
        default:
            Debug.LogWarning($"TackleAssembleUITaskCompMainTofu: 不支持的部件类型 {slotName}");
            return null;
    }
}
```

#### 3.1.4 控制器引用管理

```csharp
/// <summary>
/// 缓存的TackleActorController引用
/// </summary>
private TackleActorController m_tackleActorController;

/// <summary>
/// 缓存的LureRigActorController引用
/// </summary>
private LureRigActorController m_lureRigActorController;

/// <summary>
/// 当Actor准备就绪时缓存控制器引用
/// </summary>
/// <param name="actor">准备就绪的Actor</param>
private void OnActorReady(IStageActor actor)
{
    Debug.Log($"TackleAssembleUITaskCompMainTofu: 接收到ActorReady事件 for actor: {actor.ActorId}");

    // 获取并缓存TackleActorController
    if (actor.Instance != null)
    {
        m_tackleActorController = actor.Instance.GetComponent<TackleActorController>();
        if (m_tackleActorController == null)
        {
            Debug.LogError("TackleAssembleUITaskCompMainTofu: 无法获取TackleActorController组件");
        }
        else
        {
            Debug.Log("TackleAssembleUITaskCompMainTofu: TackleActorController缓存成功");
        }

        // 尝试获取LureRigActorController（可能在子对象中）
        m_lureRigActorController = actor.Instance.GetComponentInChildren<LureRigActorController>();
        if (m_lureRigActorController == null)
        {
            Debug.LogWarning("TackleAssembleUITaskCompMainTofu: 未找到LureRigActorController组件");
        }
        else
        {
            Debug.Log("TackleAssembleUITaskCompMainTofu: LureRigActorController缓存成功");
        }
    }

    // 现有逻辑...
    SlotInfoListFromPrefabInit();
    m_mainUICtrl.InitializeTackleAssembleUI(m_slotInfoList, m_owner.CompDynamicResourceCacheManagerGet().DynamicResCacheDictGet());
}

/// <summary>
/// 获取TackleActorController引用
/// </summary>
/// <returns>钓具控制器</returns>
public TackleActorController TackleActorControllerGet()
{
    return m_tackleActorController;
}

/// <summary>
/// 获取LureRigActorController引用
/// </summary>
/// <returns>钓组控制器</returns>
public LureRigActorController LureRigActorControllerGet()
{
    return m_lureRigActorController;
}
```

### 3.2 部件选择UI系统设计

#### 3.2.1 PartSelectionUITask 接口设计

```csharp
namespace BlackJack.ProjectEF.Runtime.UI
{
    /// <summary>
    /// 部件选择UI接口
    /// </summary>
    public interface IPartSelectionUITask
    {
        /// <summary>
        /// 部件选择完成事件
        /// </summary>
        event Action<int> EventOnPartSelected;

        /// <summary>
        /// 选择界面关闭事件
        /// </summary>
        event Action EventOnSelectionClosed;

        /// <summary>
        /// 显示指定类型的部件选择列表
        /// </summary>
        /// <param name="slotType">配件槽类型</param>
        /// <param name="currentPartId">当前装配的部件ID</param>
        void ShowPartSelection(ESlotType slotType, int currentPartId);

        /// <summary>
        /// 关闭部件选择界面
        /// </summary>
        void ClosePartSelection();
    }

    /// <summary>
    /// 部件选择UI任务
    /// </summary>
    public class PartSelectionUITask : UITaskBase, IPartSelectionUITask
    {
        /// <summary>
        /// 部件选择完成事件
        /// </summary>
        public event Action<int> EventOnPartSelected;

        /// <summary>
        /// 选择界面关闭事件
        /// </summary>
        public event Action EventOnSelectionClosed;

        /// <summary>
        /// 显示指定类型的部件选择列表
        /// </summary>
        /// <param name="slotType">配件槽类型</param>
        /// <param name="currentPartId">当前装配的部件ID</param>
        public void ShowPartSelection(ESlotType slotType, int currentPartId)
        {
            m_currentSlotType = slotType;
            m_currentPartId = currentPartId;

            // 加载对应类型的部件列表
            LoadPartList(slotType);

            // 显示UI
            SetActive(true);
        }

        /// <summary>
        /// 关闭部件选择界面
        /// </summary>
        public void ClosePartSelection()
        {
            SetActive(false);
            EventOnSelectionClosed?.Invoke();
        }

        /// <summary>
        /// 处理部件选择
        /// </summary>
        /// <param name="partConfigId">选择的部件配置ID</param>
        private void OnPartItemSelected(int partConfigId)
        {
            EventOnPartSelected?.Invoke(partConfigId);
            ClosePartSelection();
        }

        // 内部实现...
        private ESlotType m_currentSlotType;
        private int m_currentPartId;
    }
}
```

#### 3.2.2 部件选择UI集成

```csharp
/// <summary>
/// 启动部件选择UI
/// </summary>
/// <param name="slotType">配件槽类型</param>
/// <param name="currentPartId">当前装配的部件ID</param>
public void PartSelectionUIStart(ESlotType slotType, int currentPartId)
{
    // 启动部件选择UI任务
    var partSelectionIntent = PartSelectionUITask.PartSelectionUIIntentCreate(slotType, currentPartId);
    var partSelectionTask = UIManager.Instance.StartUITask(partSelectionIntent) as PartSelectionUITask;

    if (partSelectionTask != null)
    {
        // 订阅部件选择事件
        partSelectionTask.EventOnPartSelected += OnPartSelectedFromUI;
        partSelectionTask.EventOnSelectionClosed += OnPartSelectionClosed;

        // 缓存引用
        m_currentPartSelectionTask = partSelectionTask;

        Debug.Log($"TackleAssembleUITaskCompMainTofu: 部件选择UI启动 - SlotType: {slotType}, CurrentPartId: {currentPartId}");
    }
}

/// <summary>
/// 处理从UI选择的部件
/// </summary>
/// <param name="selectedPartId">选择的部件ID</param>
private void OnPartSelectedFromUI(int selectedPartId)
{
    // 获取当前正在操作的配件槽
    string currentSlotName = GetCurrentEditingSlotName();
    if (!string.IsNullOrEmpty(currentSlotName))
    {
        // 执行部件热替换
        PartHotSwap(currentSlotName, selectedPartId);
    }

    Debug.Log($"TackleAssembleUITaskCompMainTofu: 用户选择部件 - SlotName: {currentSlotName}, PartId: {selectedPartId}");
}

/// <summary>
/// 处理部件选择界面关闭
/// </summary>
private void OnPartSelectionClosed()
{
    if (m_currentPartSelectionTask != null)
    {
        // 解除事件订阅
        m_currentPartSelectionTask.EventOnPartSelected -= OnPartSelectedFromUI;
        m_currentPartSelectionTask.EventOnSelectionClosed -= OnPartSelectionClosed;
        m_currentPartSelectionTask = null;
    }

    Debug.Log("TackleAssembleUITaskCompMainTofu: 部件选择界面已关闭");
}
```

### 3.3 配件槽点击处理增强

```csharp
/// <summary>
/// 处理配件槽点击事件（增强版）
/// </summary>
/// <param name="slotName">配件槽名称</param>
/// <param name="slotType">配件槽类型</param>
public void HandleSlotClick(string slotName, ESlotType slotType)
{
    Debug.Log($"TackleAssembleUITaskCompMainTofu: 配件槽点击 - {slotName}, 类型: {slotType}");

    // 记录当前编辑的配件槽
    m_currentEditingSlotName = slotName;

    switch (slotType)
    {
        case ESlotType.Tackle:
            // 进入特写状态
            CurrModeSet(TackleAssembleUITask.ModeName4SlotCloseup);
            SlotFocus(slotName);

            // 启动部件选择UI
            int currentTacklePartId = GetCurrentPartId(slotName);
            PartSelectionUIStart(slotType, currentTacklePartId);
            break;

        case ESlotType.BaitGroup:
            // 钓组放大镜特写
            m_mainUICtrl?.AnimateBaitGroupViewToCloseup(true);

            // 启动钓组部件选择UI
            int currentBaitPartId = GetCurrentPartId(slotName);
            PartSelectionUIStart(slotType, currentBaitPartId);
            break;
    }
}

/// <summary>
/// 获取当前部件ID
/// </summary>
/// <param name="slotName">配件槽名称</param>
/// <returns>当前装配的部件ID</returns>
private int GetCurrentPartId(string slotName)
{
    // 从当前钓具配置中获取部件ID
    // 这里需要根据实际的数据结构实现
    switch (slotName)
    {
        case "Rod":
            return GetCurrentRodId();
        case "Reel":
            return GetCurrentReelId();
        case "Hook":
            return GetCurrentHookId();
        case "Lure":
            return GetCurrentLureId();
        case "LureRig":
            return GetCurrentLureRigId();
        default:
            return 0;
    }
}

/// <summary>
/// 获取当前正在编辑的配件槽名称
/// </summary>
/// <returns>配件槽名称</returns>
private string GetCurrentEditingSlotName()
{
    return m_currentEditingSlotName;
}

// 新增数据成员
private string m_currentEditingSlotName;
private PartSelectionUITask m_currentPartSelectionTask;
```

### 3.4 SlotInfo 数据结构扩展

```csharp
/// <summary>
/// 配件槽信息（扩展版）
/// </summary>
public class SlotInfo
{
    /// <summary>
    /// 配件槽名称
    /// </summary>
    public string m_slotName;

    /// <summary>
    /// 配件槽类型
    /// </summary>
    public ESlotType m_slotType;

    /// <summary>
    /// UI位置
    /// </summary>
    public Vector2 m_uiPosition;

    /// <summary>
    /// 配件槽Transform
    /// </summary>
    public Transform m_slotTransform;

    /// <summary>
    /// 当前装配的部件ID
    /// </summary>
    public int m_currentPartId;

    /// <summary>
    /// 支持的部件类型列表
    /// </summary>
    public List<int> m_supportedPartTypes;

    /// <summary>
    /// 配件槽状态
    /// </summary>
    public SlotStatus m_slotStatus;
}

/// <summary>
/// 配件槽状态枚举
/// </summary>
public enum SlotStatus
{
    /// <summary>
    /// 必须装配
    /// </summary>
    MustEquip,

    /// <summary>
    /// 可以装配
    /// </summary>
    CanEquip,

    /// <summary>
    /// 不开放
    /// </summary>
    NotAvailable,

    /// <summary>
    /// 已装配
    /// </summary>
    Equipped
}
```

## 4. TackleFactory 工厂模式设计

### 4.1 TackleFactory 静态工厂实现

```csharp
namespace BlackJack.ProjectEF.Runtime.UI
{
    /// <summary>
    /// 钓具配置数据
    /// </summary>
    public class TackleConfig
    {
        public int RodId { get; set; }
        public int ReelId { get; set; }
        public int LineId { get; set; }
        public int LureRigId { get; set; }
        public int HookId { get; set; }
        public int LureId { get; set; }
    }

    /// <summary>
    /// 钓具工厂
    /// </summary>
    public static class TackleFactory
    {
        /// <summary>
        /// 根据配置创建完整的钓具实例
        /// </summary>
        /// <param name="tackleConfig">钓具配置</param>
        /// <param name="resourceManager">资源管理器</param>
        /// <param name="configLoader">配置加载器</param>
        /// <returns>组装完成的钓具根GameObject</returns>
        public static GameObject Create(TackleConfig tackleConfig,
            IMapSceneTaskCompDynamicResourceCacheManager resourceManager,
            IConfigDataLoader configLoader)
        {
            if (tackleConfig == null || resourceManager == null || configLoader == null)
            {
                Debug.LogError("TackleFactory: 参数不能为空");
                return null;
            }

            try
            {
                // 步骤 1: 实例化基础的 TackleActor
                GameObject tackleActorInstance = CreateBaseTackleActor(resourceManager);
                if (tackleActorInstance == null)
                {
                    return null;
                }

                TackleActorController tackleController = tackleActorInstance.GetComponent<TackleActorController>();
                if (tackleController == null)
                {
                    Debug.LogError("TackleFactory: 基础TackleActor Prefab上缺少TackleActorController组件");
                    Destroy(tackleActorInstance);
                    return null;
                }

                // 步骤 2: 初始化控制器
                tackleController.Init();

                // 步骤 3: 装配各个部件
                if (!AssembleRod(tackleController, tackleConfig.RodId, resourceManager, configLoader))
                {
                    Debug.LogError("TackleFactory: 钓竿装配失败");
                    Destroy(tackleActorInstance);
                    return null;
                }

                if (!AssembleReel(tackleController, tackleConfig.ReelId, resourceManager, configLoader))
                {
                    Debug.LogError("TackleFactory: 渔轮装配失败");
                    Destroy(tackleActorInstance);
                    return null;
                }

                if (!AssembleLureRig(tackleController, tackleConfig, resourceManager, configLoader))
                {
                    Debug.LogError("TackleFactory: 钓组装配失败");
                    Destroy(tackleActorInstance);
                    return null;
                }

                if (!AssembleLine(tackleController, tackleConfig.LineId, resourceManager, configLoader))
                {
                    Debug.LogError("TackleFactory: 鱼线装配失败");
                    Destroy(tackleActorInstance);
                    return null;
                }

                Debug.Log($"TackleFactory: 钓具创建成功 - Rod:{tackleConfig.RodId}, Reel:{tackleConfig.ReelId}, LureRig:{tackleConfig.LureRigId}");
                return tackleActorInstance;
            }
            catch (System.Exception ex)
            {
                Debug.LogError($"TackleFactory: 创建钓具时发生异常 - {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// 创建基础钓具Actor
        /// </summary>
        private static GameObject CreateBaseTackleActor(IMapSceneTaskCompDynamicResourceCacheManager resourceManager)
        {
            string tackleActorPrefabPath = "Assets/GameProject/RuntimeAssets/Prefabs/TackleActor/TackleActorBase.prefab";
            var prefab = resourceManager.DynamicResourceAlloc(tackleActorPrefabPath) as GameObject;

            if (prefab == null)
            {
                Debug.LogError($"TackleFactory: 无法加载基础钓具Actor预制件 - {tackleActorPrefabPath}");
                return null;
            }

            return GameObject.Instantiate(prefab);
        }

        /// <summary>
        /// 装配钓竿
        /// </summary>
        private static bool AssembleRod(TackleActorController tackleController, int rodId,
            IMapSceneTaskCompDynamicResourceCacheManager resourceManager, IConfigDataLoader configLoader)
        {
            var rodConfig = configLoader.GetConfigDataRodInfo(rodId);
            if (rodConfig == null)
            {
                Debug.LogError($"TackleFactory: 无法获取钓竿配置 - RodId: {rodId}");
                return false;
            }

            var rodPrefab = resourceManager.DynamicResourceAlloc(rodConfig.PrefabAssetPath) as GameObject;
            if (rodPrefab == null)
            {
                Debug.LogError($"TackleFactory: 无法加载钓竿预制件 - {rodConfig.PrefabAssetPath}");
                return false;
            }

            tackleController.RodWithHandleSet(rodPrefab);
            return true;
        }

        /// <summary>
        /// 装配渔轮
        /// </summary>
        private static bool AssembleReel(TackleActorController tackleController, int reelId,
            IMapSceneTaskCompDynamicResourceCacheManager resourceManager, IConfigDataLoader configLoader)
        {
            var reelConfig = configLoader.GetConfigDataReelInfo(reelId);
            if (reelConfig == null)
            {
                Debug.LogError($"TackleFactory: 无法获取渔轮配置 - ReelId: {reelId}");
                return false;
            }

            var reelPrefab = resourceManager.DynamicResourceAlloc(reelConfig.PrefabAssetPath) as GameObject;
            if (reelPrefab == null)
            {
                Debug.LogError($"TackleFactory: 无法加载渔轮预制件 - {reelConfig.PrefabAssetPath}");
                return false;
            }

            tackleController.ReelSet(reelPrefab);
            return true;
        }

        /// <summary>
        /// 装配钓组
        /// </summary>
        private static bool AssembleLureRig(TackleActorController tackleController, TackleConfig tackleConfig,
            IMapSceneTaskCompDynamicResourceCacheManager resourceManager, IConfigDataLoader configLoader)
        {
            // 创建钓组Actor
            GameObject lureRigInstance = CreateBaseLureRigActor(resourceManager);
            if (lureRigInstance == null)
            {
                return false;
            }

            LureRigActorController lureRigController = lureRigInstance.GetComponent<LureRigActorController>();
            if (lureRigController == null)
            {
                Debug.LogError("TackleFactory: 基础LureRig上缺少LureRigActorController组件");
                Destroy(lureRigInstance);
                return false;
            }

            // 初始化钓组控制器
            lureRigController.Initialize();

            // 装配鱼钩和假饵
            var hookPrefab = LoadPartPrefab("Hook", tackleConfig.HookId, resourceManager, configLoader);
            var lurePrefab = LoadPartPrefab("Lure", tackleConfig.LureId, resourceManager, configLoader);

            if (hookPrefab == null || lurePrefab == null)
            {
                Debug.LogError("TackleFactory: 钓组部件加载失败");
                Destroy(lureRigInstance);
                return false;
            }

            lureRigController.LureRigSet(hookPrefab, lurePrefab);

            // 将钓组设置到钓具上
            tackleController.LureRigSet(lureRigInstance);

            return true;
        }

        /// <summary>
        /// 装配鱼线
        /// </summary>
        private static bool AssembleLine(TackleActorController tackleController, int lineId,
            IMapSceneTaskCompDynamicResourceCacheManager resourceManager, IConfigDataLoader configLoader)
        {
            string linePrefabPath = "Assets/GameProject/RuntimeAssets/Prefabs/TackleLine/TackleLineBase.prefab";
            var linePrefab = resourceManager.DynamicResourceAlloc(linePrefabPath) as GameObject;

            if (linePrefab == null)
            {
                Debug.LogError($"TackleFactory: 无法加载鱼线预制件 - {linePrefabPath}");
                return false;
            }

            tackleController.LineSet(linePrefab);
            return true;
        }

        /// <summary>
        /// 创建基础钓组Actor
        /// </summary>
        private static GameObject CreateBaseLureRigActor(IMapSceneTaskCompDynamicResourceCacheManager resourceManager)
        {
            string lureRigPrefabPath = "Assets/GameProject/RuntimeAssets/Prefabs/LureRig/LureRigBase.prefab";
            var prefab = resourceManager.DynamicResourceAlloc(lureRigPrefabPath) as GameObject;

            if (prefab == null)
            {
                Debug.LogError($"TackleFactory: 无法加载基础钓组预制件 - {lureRigPrefabPath}");
                return null;
            }

            return GameObject.Instantiate(prefab);
        }

        /// <summary>
        /// 加载部件Prefab
        /// </summary>
        private static GameObject LoadPartPrefab(string partType, int partId,
            IMapSceneTaskCompDynamicResourceCacheManager resourceManager, IConfigDataLoader configLoader)
        {
            string prefabPath = GetPartPrefabPath(partType, partId, configLoader);
            if (string.IsNullOrEmpty(prefabPath))
            {
                return null;
            }

            return resourceManager.DynamicResourceAlloc(prefabPath) as GameObject;
        }

        /// <summary>
        /// 获取部件Prefab路径
        /// </summary>
        private static string GetPartPrefabPath(string partType, int partId, IConfigDataLoader configLoader)
        {
            switch (partType)
            {
                case "Hook":
                    var hookConfig = configLoader.GetConfigDataHookInfo(partId);
                    return hookConfig?.PrefabAssetPath;
                case "Lure":
                    var lureConfig = configLoader.GetConfigDataLureInfo(partId);
                    return lureConfig?.PrefabAssetPath;
                default:
                    Debug.LogWarning($"TackleFactory: 不支持的部件类型 {partType}");
                    return null;
            }
        }
    }
}
```

## 5. UpdatePipeline 集成设计

### 5.1 TackleAssembleUITaskCompUpdatePipeline 修改

```csharp
/// <summary>
/// 钓具组装界面更新管线（修改版）
/// </summary>
public class TackleAssembleUITaskCompUpdatePipeline : UITaskCompUpdatePipelineBase
{
    // 现有代码...

    protected override void SingleStepExecute()
    {
        switch (m_currStepIndex)
        {
            case 0:
                // 使用TackleFactory创建钓具
                CreateTackleUsingFactory();
                break;
            case 1:
                // 启动子任务
                StartSubTasks();
                break;
            case 2:
                // 等待子任务完成
                WaitForSubTasksCompletion();
                break;
            case 3:
                // 完成初始化
                CompleteInitialization();
                break;
        }
    }

    /// <summary>
    /// 使用工厂创建钓具
    /// </summary>
    private void CreateTackleUsingFactory()
    {
        // 从UIIntent获取钓具配置ID
        int tackleConfigId = m_customParamDict.GetStructParam<int>(TackleAssembleUITask.IntentParamKey4TackleConfigId);

        // 构建钓具配置
        var tackleConfig = BuildTackleConfig(tackleConfigId);
        if (tackleConfig == null)
        {
            Debug.LogError("TackleAssembleUITaskCompUpdatePipeline: 构建钓具配置失败");
            OnPipelineError();
            return;
        }

        // 使用工厂创建钓具
        var resourceManager = m_owner.CompDynamicResourceCacheManagerGet();
        var configLoader = m_owner.ConfigDataLoaderGet();

        GameObject tackleInstance = TackleFactory.Create(tackleConfig, resourceManager, configLoader);
        if (tackleInstance == null)
        {
            Debug.LogError("TackleAssembleUITaskCompUpdatePipeline: 钓具工厂创建失败");
            OnPipelineError();
            return;
        }

        // 将钓具实例包装为StageActor
        m_createdTackleActor = CreateStageActorFromGameObject(tackleInstance);
        if (m_createdTackleActor == null)
        {
            Debug.LogError("TackleAssembleUITaskCompUpdatePipeline: StageActor包装失败");
            Destroy(tackleInstance);
            OnPipelineError();
            return;
        }

        Debug.Log($"TackleAssembleUITaskCompUpdatePipeline: 钓具创建成功 - ConfigId: {tackleConfigId}");
        SingleStepComplete();
    }

    /// <summary>
    /// 构建钓具配置
    /// </summary>
    /// <param name="tackleConfigId">钓具配置ID</param>
    /// <returns>钓具配置</returns>
    private TackleConfig BuildTackleConfig(int tackleConfigId)
    {
        // 这里需要根据实际的配置系统实现
        // 从配置中获取钓具的各个部件ID
        var configLoader = m_owner.ConfigDataLoaderGet();
        var tackleMainConfig = configLoader.GetConfigDataTackleInfo(tackleConfigId);

        if (tackleMainConfig == null)
        {
            Debug.LogError($"TackleAssembleUITaskCompUpdatePipeline: 无法获取钓具配置 - ConfigId: {tackleConfigId}");
            return null;
        }

        return new TackleConfig
        {
            RodId = tackleMainConfig.RodId,
            ReelId = tackleMainConfig.ReelId,
            LineId = tackleMainConfig.LineId,
            LureRigId = tackleMainConfig.LureRigId,
            HookId = tackleMainConfig.HookId,
            LureId = tackleMainConfig.LureId
        };
    }

    /// <summary>
    /// 从GameObject创建StageActor
    /// </summary>
    /// <param name="gameObject">游戏对象</param>
    /// <returns>StageActor</returns>
    private IStageActor CreateStageActorFromGameObject(GameObject gameObject)
    {
        // 这里需要根据实际的StageActor系统实现
        // 创建一个包装器将GameObject包装为IStageActor
        return new TackleStageActorWrapper(gameObject);
    }

    // 其他方法...
    private IStageActor m_createdTackleActor;
}

/// <summary>
/// 钓具StageActor包装器
/// </summary>
public class TackleStageActorWrapper : IStageActor
{
    public TackleStageActorWrapper(GameObject instance)
    {
        Instance = instance;
        ActorId = instance.GetInstanceID().ToString();
    }

    public GameObject Instance { get; private set; }
    public string ActorId { get; private set; }

    // 实现其他IStageActor接口...
}
```

## 6. 错误处理与日志系统

### 6.1 异常处理机制

```csharp
/// <summary>
/// 钓具组装异常类
/// </summary>
public class TackleAssembleException : System.Exception
{
    public TackleAssembleException(string message) : base(message) { }
    public TackleAssembleException(string message, System.Exception innerException) : base(message, innerException) { }
}

/// <summary>
/// 部件热替换异常处理
/// </summary>
private void SafePartHotSwap(string slotName, int newPartConfigId)
{
    try
    {
        PartHotSwap(slotName, newPartConfigId);
    }
    catch (TackleAssembleException ex)
    {
        Debug.LogError($"TackleAssembleUITaskCompMainTofu: 部件热替换失败 - {ex.Message}");
        ShowErrorMessage($"部件更换失败: {ex.Message}");
    }
    catch (System.Exception ex)
    {
        Debug.LogError($"TackleAssembleUITaskCompMainTofu: 部件热替换发生未知异常 - {ex.Message}");
        ShowErrorMessage("部件更换发生未知错误，请重试");
    }
}

/// <summary>
/// 显示错误消息
/// </summary>
/// <param name="message">错误消息</param>
private void ShowErrorMessage(string message)
{
    // 这里可以调用通用的错误提示UI
    Debug.LogWarning($"用户错误提示: {message}");
}
```

### 6.2 详细日志记录

```csharp
/// <summary>
/// 日志记录器
/// </summary>
private static class TackleAssembleLogger
{
    private const string LogPrefix = "[TackleAssemble]";

    public static void LogInfo(string message)
    {
        Debug.Log($"{LogPrefix} {message}");
    }

    public static void LogWarning(string message)
    {
        Debug.LogWarning($"{LogPrefix} {message}");
    }

    public static void LogError(string message)
    {
        Debug.LogError($"{LogPrefix} {message}");
    }

    public static void LogPartSwap(string slotName, int oldPartId, int newPartId)
    {
        LogInfo($"部件热替换 - 槽位:{slotName}, 旧部件:{oldPartId}, 新部件:{newPartId}");
    }

    public static void LogViewStateChange(string oldState, string newState)
    {
        LogInfo($"视图状态切换 - {oldState} → {newState}");
    }
}
```

## 7. 性能优化考虑

### 7.1 资源预加载策略

```csharp
/// <summary>
/// 资源预加载管理器
/// </summary>
public class TackleAssembleResourcePreloader
{
    /// <summary>
    /// 预加载常用部件资源
    /// </summary>
    /// <param name="resourceManager">资源管理器</param>
    /// <param name="configLoader">配置加载器</param>
    public static void PreloadCommonParts(IMapSceneTaskCompDynamicResourceCacheManager resourceManager,
        IConfigDataLoader configLoader)
    {
        // 预加载常用钓竿
        var commonRodIds = GetCommonPartIds("Rod");
        foreach (var rodId in commonRodIds)
        {
            PreloadPartResource("Rod", rodId, resourceManager, configLoader);
        }

        // 预加载常用渔轮
        var commonReelIds = GetCommonPartIds("Reel");
        foreach (var reelId in commonReelIds)
        {
            PreloadPartResource("Reel", reelId, resourceManager, configLoader);
        }

        // 预加载常用钓组
        var commonLureRigIds = GetCommonPartIds("LureRig");
        foreach (var lureRigId in commonLureRigIds)
        {
            PreloadPartResource("LureRig", lureRigId, resourceManager, configLoader);
        }
    }

    private static void PreloadPartResource(string partType, int partId,
        IMapSceneTaskCompDynamicResourceCacheManager resourceManager, IConfigDataLoader configLoader)
    {
        string prefabPath = GetPartPrefabPath(partType, partId, configLoader);
        if (!string.IsNullOrEmpty(prefabPath))
        {
            resourceManager.DynamicResourceAlloc(prefabPath);
        }
    }

    private static List<int> GetCommonPartIds(string partType)
    {
        // 返回常用部件ID列表
        // 这里可以从配置或者统计数据中获取
        return new List<int> { 1001, 1002, 1003 };
    }
}
```

### 7.2 对象池管理

```csharp
/// <summary>
/// 钓具部件对象池
/// </summary>
public class TacklePartObjectPool
{
    private static readonly Dictionary<string, Queue<GameObject>> s_partPools = new Dictionary<string, Queue<GameObject>>();

    /// <summary>
    /// 获取部件实例
    /// </summary>
    /// <param name="prefabPath">预制件路径</param>
    /// <param name="resourceManager">资源管理器</param>
    /// <returns>部件实例</returns>
    public static GameObject GetPartInstance(string prefabPath, IMapSceneTaskCompDynamicResourceCacheManager resourceManager)
    {
        if (!s_partPools.ContainsKey(prefabPath))
        {
            s_partPools[prefabPath] = new Queue<GameObject>();
        }

        var pool = s_partPools[prefabPath];
        if (pool.Count > 0)
        {
            var instance = pool.Dequeue();
            instance.SetActive(true);
            return instance;
        }

        // 池中没有可用实例，创建新的
        var prefab = resourceManager.DynamicResourceAlloc(prefabPath) as GameObject;
        return prefab != null ? GameObject.Instantiate(prefab) : null;
    }

    /// <summary>
    /// 归还部件实例到对象池
    /// </summary>
    /// <param name="prefabPath">预制件路径</param>
    /// <param name="instance">实例</param>
    public static void ReturnPartInstance(string prefabPath, GameObject instance)
    {
        if (instance == null) return;

        if (!s_partPools.ContainsKey(prefabPath))
        {
            s_partPools[prefabPath] = new Queue<GameObject>();
        }

        instance.SetActive(false);
        s_partPools[prefabPath].Enqueue(instance);
    }
}
```

## 8. 测试与验证

### 8.1 单元测试设计

```csharp
/// <summary>
/// 钓具组装单元测试
/// </summary>
[TestFixture]
public class TackleAssembleTests
{
    [Test]
    public void TestTackleFactoryCreate_ValidConfig_ShouldReturnValidGameObject()
    {
        // Arrange
        var tackleConfig = new TackleConfig
        {
            RodId = 1001,
            ReelId = 2001,
            LineId = 3001,
            LureRigId = 4001
        };

        // Act
        var result = TackleFactory.Create(tackleConfig, mockResourceManager, mockConfigLoader);

        // Assert
        Assert.IsNotNull(result);
        Assert.IsNotNull(result.GetComponent<TackleActorController>());
    }

    [Test]
    public void TestPartHotSwap_ValidSlotAndPart_ShouldUpdateController()
    {
        // Arrange
        var mainTofu = CreateMainTofuForTesting();

        // Act
        mainTofu.PartHotSwap("Rod", 1002);

        // Assert
        // 验证控制器状态已更新
    }
}
```

### 8.2 集成测试流程

```csharp
/// <summary>
/// 集成测试流程
/// </summary>
public class TackleAssembleIntegrationTest
{
    /// <summary>
    /// 测试完整的部件更换流程
    /// </summary>
    public void TestCompletePartSwapFlow()
    {
        // 1. 启动钓具组装界面
        var tackleAssembleTask = TackleAssembleUITask.TackleAssembleUITaskStart(3001);

        // 2. 等待初始化完成
        WaitForInitialization(tackleAssembleTask);

        // 3. 模拟点击配件槽
        tackleAssembleTask.CompMainTofuGet().HandleSlotClick("Rod", ESlotType.Tackle);

        // 4. 模拟选择新部件
        SimulatePartSelection(1002);

        // 5. 验证结果
        VerifyPartSwapResult(tackleAssembleTask, "Rod", 1002);
    }
}
```

## 9. 扩展性设计

### 9.1 插件化部件系统

```csharp
/// <summary>
/// 部件处理器接口
/// </summary>
public interface IPartHandler
{
    /// <summary>
    /// 支持的部件类型
    /// </summary>
    string SupportedPartType { get; }

    /// <summary>
    /// 装配部件
    /// </summary>
    /// <param name="controller">控制器</param>
    /// <param name="partPrefab">部件预制件</param>
    /// <returns>是否成功</returns>
    bool AssemblePart(TackleActorController controller, GameObject partPrefab);

    /// <summary>
    /// 移除部件
    /// </summary>
    /// <param name="controller">控制器</param>
    /// <returns>是否成功</returns>
    bool RemovePart(TackleActorController controller);
}

/// <summary>
/// 部件处理器注册表
/// </summary>
public static class PartHandlerRegistry
{
    private static readonly Dictionary<string, IPartHandler> s_handlers = new Dictionary<string, IPartHandler>();

    /// <summary>
    /// 注册部件处理器
    /// </summary>
    /// <param name="handler">处理器</param>
    public static void RegisterHandler(IPartHandler handler)
    {
        s_handlers[handler.SupportedPartType] = handler;
    }

    /// <summary>
    /// 获取部件处理器
    /// </summary>
    /// <param name="partType">部件类型</param>
    /// <returns>处理器</returns>
    public static IPartHandler GetHandler(string partType)
    {
        return s_handlers.GetValueOrDefault(partType);
    }
}
```

### 9.2 自定义动画系统

```csharp
/// <summary>
/// 部件更换动画配置
/// </summary>
[Serializable]
public class PartSwapAnimationConfig
{
    [Tooltip("淡出时长")]
    public float FadeOutDuration = 0.2f;

    [Tooltip("淡入时长")]
    public float FadeInDuration = 0.3f;

    [Tooltip("是否使用缩放效果")]
    public bool UseScaleEffect = true;

    [Tooltip("缩放曲线")]
    public AnimationCurve ScaleCurve = AnimationCurve.EaseInOut(0, 1, 1, 1);
}

/// <summary>
/// 部件更换动画控制器
/// </summary>
public class PartSwapAnimationController
{
    /// <summary>
    /// 执行部件更换动画
    /// </summary>
    /// <param name="oldPart">旧部件</param>
    /// <param name="newPart">新部件</param>
    /// <param name="config">动画配置</param>
    /// <param name="onComplete">完成回调</param>
    public static void PlayPartSwapAnimation(GameObject oldPart, GameObject newPart,
        PartSwapAnimationConfig config, System.Action onComplete = null)
    {
        if (oldPart == null && newPart == null)
        {
            onComplete?.Invoke();
            return;
        }

        Sequence animSequence = DOTween.Sequence();

        // 旧部件淡出
        if (oldPart != null)
        {
            var oldRenderer = oldPart.GetComponentInChildren<Renderer>();
            if (oldRenderer != null)
            {
                animSequence.Append(oldRenderer.material.DOFade(0, config.FadeOutDuration));
            }

            if (config.UseScaleEffect)
            {
                animSequence.Join(oldPart.transform.DOScale(Vector3.zero, config.FadeOutDuration)
                    .SetEase(Ease.InBack));
            }
        }

        // 新部件淡入
        if (newPart != null)
        {
            var newRenderer = newPart.GetComponentInChildren<Renderer>();
            if (newRenderer != null)
            {
                newRenderer.material.SetFloat("_Alpha", 0);
                animSequence.Append(newRenderer.material.DOFade(1, config.FadeInDuration));
            }

            if (config.UseScaleEffect)
            {
                newPart.transform.localScale = Vector3.zero;
                animSequence.Join(newPart.transform.DOScale(Vector3.one, config.FadeInDuration)
                    .SetEase(Ease.OutBack));
            }
        }

        animSequence.OnComplete(() => onComplete?.Invoke());
    }
}
```

## 10. 总结

本详细功能设计文档提供了钓具组装完整流程的全面实现方案，主要特点包括：

### 10.1 核心功能实现
1. **完整的UI到3D模型热替换流程**：从用户点击配件槽到3D模型实时更新
2. **工厂模式的钓具创建系统**：统一的钓具创建和部件装配入口
3. **灵活的部件选择界面**：支持不同类型部件的选择和预览
4. **实时的视图同步机制**：确保主视图和放大镜视图的一致性

### 10.2 架构优势
1. **严格的分层设计**：UI层、工厂层、控制器层职责清晰
2. **松耦合的组件交互**：通过事件和接口实现组件间通信
3. **可扩展的插件化架构**：支持新部件类型的轻松接入
4. **完善的错误处理机制**：确保系统的稳定性和用户体验

### 10.3 性能考虑
1. **资源预加载策略**：优化常用部件的加载性能
2. **对象池管理**：减少频繁的对象创建和销毁
3. **异步加载机制**：避免UI阻塞，提升响应性

### 10.4 扩展性保证
1. **插件化部件处理系统**：支持自定义部件类型
2. **可配置的动画系统**：允许自定义部件更换效果
3. **完整的测试框架**：确保功能的正确性和稳定性

该设计充分利用了现有的BJFramework架构优势，在保持代码可维护性的同时，提供了完整、流畅的钓具组装用户体验。

---

*文档版本: 1.0*
*创建日期: 2025-01-15*
*基于: 钓具组装界面交互优化功能 + 钓具工厂系统设计 + 场景控制器分析*