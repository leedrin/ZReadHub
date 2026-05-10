# 钓具组装完整流程 - 实现架构文档

## 1. 概述

本文档基于对现有代码的深入分析，重新设计钓具组装完整流程的实现架构。该架构充分利用现有的StageActor系统和TackleAssembleTackleUITask管线机制，实现部件的动态加载和热替换。

## 2. 修正后的系统架构

### 2.1 分层架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                     UI交互层 (UI Layer)                      │
├─────────────────────────────────────────────────────────────┤
│  TackleAssembleUITask (主控制器)                             │
│  └── TackleAssembleUITaskCompMainTofu                      │
│      ├── 处理用户交互事件                                     │
│      ├── 管理子任务生命周期                                   │
│      ├── 协调部件更换流程                                     │
│      └── 集成部件选择功能                                     │
│                                                             │
│  TackleAssembleUIController                                 │
│  ├── 钓具组装主界面控制                                       │
│  ├── 部件选择面板管理                                         │
│  └── 配件槽按钮和状态控制                                     │
└─────────────────────────────────────────────────────────────┘
                                │
                    重启管线传递新钓具配置
                                │
┌─────────────────────────────────────────────────────────────┐
│                StageActor动态加载层                           │
├─────────────────────────────────────────────────────────────┤
│  TackleAssembleTackleUITask                                 │
│  └── TackleAssembleTackleUITaskCompUpdatePipeline          │
│      ├── 根据新配置收集需要加载的资源路径                      │
│      ├── 动态加载StageActor资源                              │
│      ├── ViewUpdate中生成完整钓具Instance实例                │
│      └── 绑定TackleActorController和LureRigActorController │
│                                                             │
│  TackleAssembleBaitGroupUITask                              │
│  └── 独立渲染钓组到RenderTexture                             │
└─────────────────────────────────────────────────────────────┘
                                │
                    Actor实例化与控制器绑定
                                │
┌─────────────────────────────────────────────────────────────┐
│                   3D控制器层 (Controller Layer)               │
├─────────────────────────────────────────────────────────────┤
│  TackleActorController       │  LureRigActorController      │
│  (UI场景专用钓具控制器)        │  (UI场景专用钓组控制器)        │
│  ├── RodWithHandleSet()      │  ├── LureRigSet()            │
│  ├── ReelSet()               │  ├── LureRigReset()          │
│  └── LureRigSet()            │  └── 独立的钓组组件管理        │
│                             │                              │
│  StageActor.Instance         │  GameObject实例               │
│  (完整3D钓具模型)             │  (渲染到UI RenderTexture)     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 核心数据流

```
用户点击配件槽 → 显示部件选择面板 → 用户选择新部件 → 构建新钓具配置 →
重启TackleAssembleTackleUITask管线 → 动态加载新资源 → ViewUpdate生成新实例 →
UI视图自动刷新显示新钓具 → 隐藏部件选择面板
```

## 3. 关键设计原则

### 3.1 利用现有系统
- **StageActor系统**：完整的资源管理和实例化机制
- **管线重启机制**：TackleAssembleTackleUITask已有的动态加载能力
- **Controller绑定**：现有的TackleActorController和LureRigActorController

### 3.2 职责边界清晰
- **UI层**：只负责用户交互和界面状态管理
- **StageActor层**：负责3D资源的动态加载和实例管理
- **Controller层**：负责具体的3D模型控制和渲染

### 3.3 最小化修改
- 最大程度复用现有代码结构
- 只在必要处增加新功能
- 保持与现有系统的兼容性

## 4. 实现组件详细设计

### 4.1 扩展数据结构

#### 4.1.1 ESlotType 槽位类型枚举

```csharp
namespace BlackJack.ProjectEF.Runtime.UI
{
    /// <summary>
    /// 配件槽类型枚举
    /// </summary>
    public enum ESlotType
    {
        /// <summary>
        /// 钓具配件槽（钓竿、渔轮等）
        /// </summary>
        Tackle,

        /// <summary>
        /// 钓组配件槽（鱼钩、假饵等）
        /// </summary>
        BaitGroup
    }
}
```

#### 4.1.2 SlotInfo 配件槽信息扩展

```csharp
namespace BlackJack.ProjectEF.Runtime.UI
{
    /// <summary>
    /// 配件槽信息（扩展版）
    /// </summary>
    [Serializable]
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
        /// UI位置（相对于父容器的锚点位置）
        /// </summary>
        public Vector2 m_uiPosition;

        /// <summary>
        /// 配件槽在3D模型中的Transform引用
        /// </summary>
        public Transform m_slotTransform;

        /// <summary>
        /// 当前装配的部件配置ID
        /// </summary>
        public int m_currentPartConfigId;

        /// <summary>
        /// 配件槽状态
        /// </summary>
        public SlotStatus m_slotStatus = SlotStatus.CanEquip;

        /// <summary>
        /// 支持的部件类型列表（用于过滤可选部件）
        /// </summary>
        public List<int> m_supportedPartTypes = new List<int>();
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
}
```

#### 4.1.3 TackleConfig 钓具配置数据

```csharp
namespace BlackJack.ProjectEF.Runtime.UI
{
    /// <summary>
    /// 钓具配置数据
    /// </summary>
    [Serializable]
    public class TackleConfig
    {
        /// <summary>
        /// 钓竿配置ID
        /// </summary>
        public int RodId { get; set; }

        /// <summary>
        /// 渔轮配置ID
        /// </summary>
        public int ReelId { get; set; }

        /// <summary>
        /// 鱼线配置ID
        /// </summary>
        public int LineId { get; set; }

        /// <summary>
        /// 钓组配置ID
        /// </summary>
        public int LureRigId { get; set; }

        /// <summary>
        /// 鱼钩配置ID（单独配置时使用）
        /// </summary>
        public int HookId { get; set; }

        /// <summary>
        /// 假饵配置ID（单独配置时使用）
        /// </summary>
        public int LureId { get; set; }

        /// <summary>
        /// 创建配置的深拷贝
        /// </summary>
        /// <returns>配置副本</returns>
        public TackleConfig Clone()
        {
            return new TackleConfig
            {
                RodId = this.RodId,
                ReelId = this.ReelId,
                LineId = this.LineId,
                LureRigId = this.LureRigId,
                HookId = this.HookId,
                LureId = this.LureId
            };
        }

        /// <summary>
        /// 检查配置是否有效
        /// </summary>
        /// <returns>配置是否有效</returns>
        public bool IsValid()
        {
            return RodId > 0 && ReelId > 0 && LineId > 0 &&
                   (LureRigId > 0 || (HookId > 0 && LureId > 0));
        }
    }
}
```

### 4.2 TackleAssembleUITaskCompMainTofu 增强

#### 4.2.1 新增接口定义

```csharp
namespace BlackJack.ProjectEF.Runtime.UI
{
    /// <summary>
    /// TackleAssembleUITask主Tofu的组件接口（扩展版）
    /// </summary>
    public interface ITackleAssembleUITaskCompMainTofu : IUITaskCompTofuBase
    {
        // 现有接口...
        IStageActor CurrentTackleGet();
        void SlotFocus(string slotName);
        void ReturnToOverview();
        void RefreshBaitGroupView();
        List<SlotInfo> SlotInfoListGet();
        void CurrModeSet(string modeName);
        string CurrModeGet();
        void HandleSlotClick(string slotName, ESlotType slotType);
        void HandleReturnButtonClick();
        void HandleBaitGroupCloseupReturn();

        // 新增接口
        /// <summary>
        /// 部件热替换接口
        /// </summary>
        /// <param name="slotName">配件槽名称</param>
        /// <param name="newPartConfigId">新部件配置ID</param>
        void PartHotSwap(string slotName, int newPartConfigId);

        /// <summary>
        /// 获取当前钓具配置
        /// </summary>
        /// <returns>当前钓具配置</returns>
        TackleConfig GetCurrentTackleConfig();

        /// <summary>
        /// 显示部件选择面板
        /// </summary>
        /// <param name="slotType">配件槽类型</param>
        /// <param name="slotName">配件槽名称</param>
        /// <param name="currentPartId">当前装配的部件ID</param>
        void ShowPartSelectionPanel(ESlotType slotType, string slotName, int currentPartId);

        /// <summary>
        /// 隐藏部件选择面板
        /// </summary>
        void HidePartSelectionPanel();
    }
}
```

#### 4.2.2 核心实现增强

```csharp
namespace BlackJack.ProjectEF.Runtime.UI
{
    public partial class TackleAssembleUITaskCompMainTofu : UITaskCompTofuBase, ITackleAssembleUITaskCompMainTofu
    {
        #region 新增成员变量

        /// <summary>
        /// 当前钓具配置
        /// </summary>
        private TackleConfig m_currentTackleConfig;

        /// <summary>
        /// 当前正在编辑的配件槽名称
        /// </summary>
        private string m_currentEditingSlotName;


        #endregion

        #region 部件热替换核心逻辑

        /// <summary>
        /// 部件热替换实现
        /// </summary>
        /// <param name="slotName">配件槽名称</param>
        /// <param name="newPartConfigId">新部件配置ID</param>
        public void PartHotSwap(string slotName, int newPartConfigId)
        {
            try
            {
                TackleAssembleLogger.LogInfo($"开始部件热替换 - 槽位: {slotName}, 新部件ID: {newPartConfigId}");

                // 1. 验证参数
                if (string.IsNullOrEmpty(slotName) || newPartConfigId <= 0)
                {
                    throw new System.ArgumentException("部件热替换参数无效");
                }

                // 2. 获取配件槽信息
                var slotInfo = SlotInfoGet(slotName);
                if (slotInfo == null)
                {
                    throw new System.InvalidOperationException($"未找到配件槽: {slotName}");
                }

                // 3. 记录旧配置
                int oldPartConfigId = slotInfo.m_currentPartConfigId;

                // 4. 更新当前钓具配置
                UpdateTackleConfig(slotName, newPartConfigId);

                // 5. 重启TackleAssembleTackleUITask管线以应用新配置
                RestartTackleAssembleTackleUITask();

                // 6. 更新配件槽信息
                slotInfo.m_currentPartConfigId = newPartConfigId;
                slotInfo.m_slotStatus = SlotStatus.Equipped;

                // 7. 更新UI显示
                m_mainUICtrl?.UpdateSlotButtonStatus(slotName, TackleAssembleUIController.SlotStatus.Equipped);

                TackleAssembleLogger.LogPartSwap(slotName, oldPartConfigId, newPartConfigId);
            }
            catch (System.Exception ex)
            {
                TackleAssembleLogger.LogError($"部件热替换失败 - {ex.Message}");
                ShowErrorMessage($"部件更换失败: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// 更新钓具配置
        /// </summary>
        /// <param name="slotName">配件槽名称</param>
        /// <param name="newPartConfigId">新部件配置ID</param>
        private void UpdateTackleConfig(string slotName, int newPartConfigId)
        {
            if (m_currentTackleConfig == null)
            {
                throw new System.InvalidOperationException("当前钓具配置为空");
            }

            switch (slotName)
            {
                case "Rod":
                    m_currentTackleConfig.RodId = newPartConfigId;
                    break;
                case "Reel":
                    m_currentTackleConfig.ReelId = newPartConfigId;
                    break;
                case "Line":
                    m_currentTackleConfig.LineId = newPartConfigId;
                    break;
                case "LureRig":
                    m_currentTackleConfig.LureRigId = newPartConfigId;
                    break;
                case "Hook":
                    m_currentTackleConfig.HookId = newPartConfigId;
                    break;
                case "Lure":
                    m_currentTackleConfig.LureId = newPartConfigId;
                    break;
                default:
                    throw new System.ArgumentException($"不支持的配件槽类型: {slotName}");
            }
        }

        /// <summary>
        /// 重启TackleAssembleTackleUITask管线
        /// </summary>
        private void RestartTackleAssembleTackleUITask()
        {
            // 1. 停止当前的TackleAssembleTackleUITask
            if (m_tackleAssembleTackleUITask != null)
            {
                var tackleTaskInterface = m_tackleAssembleTackleUITask as ITackleAssembleTackleUITask;
                if (tackleTaskInterface != null)
                {
                    tackleTaskInterface.EventOnActorReady -= OnActorReady;
                    tackleTaskInterface.EventOnDragStart -= OnDragStart;
                    tackleTaskInterface.EventOnDragEnd -= OnDragEnd;
                }

                UIManager.Instance.StopUITask(nameof(TackleAssembleTackleUITask));
                m_tackleAssembleTackleUITask = null;
            }

            // 2. 创建新的TackleAssembleTackleUITask Intent，携带新配置
            var tackleIntent = TackleAssembleTackleUITask.TackleAssembleTackleUIIntentCreate(m_currentTackleConfig);

            // 3. 启动新的TackleAssembleTackleUITask
            m_tackleAssembleTackleUITask = UIManager.Instance.StartUITask(tackleIntent) as TackleAssembleTackleUITask;

            if (m_tackleAssembleTackleUITask != null)
            {
                // 重新订阅事件
                var tackleTaskInterface = m_tackleAssembleTackleUITask as ITackleAssembleTackleUITask;
                if (tackleTaskInterface != null)
                {
                    tackleTaskInterface.EventOnActorReady += OnActorReady;
                    tackleTaskInterface.EventOnDragStart += OnDragStart;
                    tackleTaskInterface.EventOnDragEnd += OnDragEnd;
                }

                TackleAssembleLogger.LogInfo("TackleAssembleTackleUITask重启成功");
            }
            else
            {
                throw new System.InvalidOperationException("TackleAssembleTackleUITask重启失败");
            }
        }

        /// <summary>
        /// 获取当前钓具配置
        /// </summary>
        /// <returns>当前钓具配置</returns>
        public TackleConfig GetCurrentTackleConfig()
        {
            return m_currentTackleConfig?.Clone();
        }

        #endregion

        #region 部件选择面板集成

        /// <summary>
        /// 显示部件选择面板
        /// </summary>
        /// <param name="slotType">配件槽类型</param>
        /// <param name="slotName">配件槽名称</param>
        /// <param name="currentPartId">当前装配的部件ID</param>
        public void ShowPartSelectionPanel(ESlotType slotType, string slotName, int currentPartId)
        {
            try
            {
                TackleAssembleLogger.LogInfo($"显示部件选择面板 - 槽位: {slotName}, 类型: {slotType}, 当前部件: {currentPartId}");

                // 记录当前编辑的配件槽
                m_currentEditingSlotName = slotName;

                // 通知UI控制器显示部件选择面板
                m_mainUICtrl?.ShowPartSelectionPanel(slotType, currentPartId, OnPartSelectedFromPanel);

                TackleAssembleLogger.LogInfo("部件选择面板显示成功");
            }
            catch (System.Exception ex)
            {
                TackleAssembleLogger.LogError($"显示部件选择面板失败 - {ex.Message}");
                ShowErrorMessage($"打开部件选择界面失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 隐藏部件选择面板
        /// </summary>
        public void HidePartSelectionPanel()
        {
            try
            {
                // 通知UI控制器隐藏部件选择面板
                m_mainUICtrl?.HidePartSelectionPanel();

                // 清空当前编辑状态
                m_currentEditingSlotName = null;

                TackleAssembleLogger.LogInfo("部件选择面板已隐藏");
            }
            catch (System.Exception ex)
            {
                TackleAssembleLogger.LogError($"隐藏部件选择面板失败 - {ex.Message}");
            }
        }

        /// <summary>
        /// 处理从面板选择的部件
        /// </summary>
        /// <param name="selectedPartId">选择的部件ID</param>
        private void OnPartSelectedFromPanel(int selectedPartId)
        {
            try
            {
                if (!string.IsNullOrEmpty(m_currentEditingSlotName))
                {
                    // 执行部件热替换
                    PartHotSwap(m_currentEditingSlotName, selectedPartId);
                }

                // 隐藏部件选择面板
                HidePartSelectionPanel();

                TackleAssembleLogger.LogInfo($"用户选择部件 - 槽位: {m_currentEditingSlotName}, 部件ID: {selectedPartId}");
            }
            catch (System.Exception ex)
            {
                TackleAssembleLogger.LogError($"处理部件选择失败 - {ex.Message}");
                ShowErrorMessage($"应用部件选择失败: {ex.Message}");
            }
        }

        #endregion

        #region 增强的配件槽点击处理

        /// <summary>
        /// 处理配件槽点击事件（增强版）
        /// </summary>
        /// <param name="slotName">配件槽名称</param>
        /// <param name="slotType">配件槽类型</param>
        public void HandleSlotClick(string slotName, ESlotType slotType)
        {
            TackleAssembleLogger.LogInfo($"配件槽点击 - {slotName}, 类型: {slotType}");

            try
            {
                switch (slotType)
                {
                    case ESlotType.Tackle:
                        HandleTackleSlotClick(slotName);
                        break;
                    case ESlotType.BaitGroup:
                        HandleBaitGroupSlotClick(slotName);
                        break;
                    default:
                        throw new System.ArgumentException($"不支持的配件槽类型: {slotType}");
                }
            }
            catch (System.Exception ex)
            {
                TackleAssembleLogger.LogError($"处理配件槽点击失败 - {ex.Message}");
                ShowErrorMessage($"操作失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 处理钓具配件槽点击
        /// </summary>
        /// <param name="slotName">配件槽名称</param>
        private void HandleTackleSlotClick(string slotName)
        {
            // 1. 进入特写状态
            CurrModeSet(TackleAssembleUITask.ModeName4SlotCloseup);
            SlotFocus(slotName);

            // 2. 获取当前部件ID
            int currentPartId = GetCurrentPartId(slotName);

            // 3. 显示部件选择面板
            ShowPartSelectionPanel(ESlotType.Tackle, slotName, currentPartId);
        }

        /// <summary>
        /// 处理钓组配件槽点击
        /// </summary>
        /// <param name="slotName">配件槽名称</param>
        private void HandleBaitGroupSlotClick(string slotName)
        {
            // 1. 钓组放大镜特写
            m_mainUICtrl?.AnimateBaitGroupViewToCloseup(true);

            // 2. 获取当前部件ID
            int currentPartId = GetCurrentPartId(slotName);

            // 3. 显示钓组部件选择面板
            ShowPartSelectionPanel(ESlotType.BaitGroup, slotName, currentPartId);
        }

        /// <summary>
        /// 获取当前部件ID
        /// </summary>
        /// <param name="slotName">配件槽名称</param>
        /// <returns>当前装配的部件ID</returns>
        private int GetCurrentPartId(string slotName)
        {
            if (m_currentTackleConfig == null)
            {
                return 0;
            }

            switch (slotName)
            {
                case "Rod":
                    return m_currentTackleConfig.RodId;
                case "Reel":
                    return m_currentTackleConfig.ReelId;
                case "Line":
                    return m_currentTackleConfig.LineId;
                case "LureRig":
                    return m_currentTackleConfig.LureRigId;
                case "Hook":
                    return m_currentTackleConfig.HookId;
                case "Lure":
                    return m_currentTackleConfig.LureId;
                default:
                    TackleAssembleLogger.LogWarning($"未知的配件槽类型: {slotName}");
                    return 0;
            }
        }

        #endregion

        #region 初始化增强

        /// <summary>
        /// 初始化当前钓具配置
        /// </summary>
        /// <param name="tackleConfigId">钓具配置ID</param>
        private void InitializeCurrentTackleConfig(int tackleConfigId)
        {
            try
            {
                // 从配置系统加载钓具配置
                var configLoader = m_owner.ConfigDataLoaderGet();
                var tackleMainConfig = configLoader.GetConfigDataTackleInfo(tackleConfigId);

                if (tackleMainConfig == null)
                {
                    throw new System.InvalidOperationException($"无法获取钓具配置 - ConfigId: {tackleConfigId}");
                }

                m_currentTackleConfig = new TackleConfig
                {
                    RodId = tackleMainConfig.RodId,
                    ReelId = tackleMainConfig.ReelId,
                    LineId = tackleMainConfig.LineId,
                    LureRigId = tackleMainConfig.LureRigId,
                    HookId = tackleMainConfig.HookId,
                    LureId = tackleMainConfig.LureId
                };

                if (!m_currentTackleConfig.IsValid())
                {
                    throw new System.InvalidOperationException("钓具配置无效");
                }

                TackleAssembleLogger.LogInfo($"钓具配置初始化成功 - ConfigId: {tackleConfigId}");
            }
            catch (System.Exception ex)
            {
                TackleAssembleLogger.LogError($"钓具配置初始化失败 - {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// 重写UpdateContextSetup方法
        /// </summary>
        public override void UpdateContextSetup(ICustomParamDictionaryReadOnly paramDict,
            UITaskUpdatePipelineStartType pipelineStartType,
            params object[] extraParamArr)
        {
            base.UpdateContextSetup(paramDict, pipelineStartType, extraParamArr);

            // 初始化钓具配置
            int tackleConfigId = paramDict.GetStructParam<int>(TackleAssembleUITask.IntentParamKey4TackleConfigId);
            InitializeCurrentTackleConfig(tackleConfigId);
        }

        #endregion

        #region 工具方法

        /// <summary>
        /// 根据名称获取配件槽信息
        /// </summary>
        /// <param name="slotName">配件槽名称</param>
        /// <returns>配件槽信息</returns>
        private SlotInfo SlotInfoGet(string slotName)
        {
            return m_slotInfoList?.Find(slot => slot.m_slotName == slotName);
        }

        /// <summary>
        /// 显示错误消息
        /// </summary>
        /// <param name="message">错误消息</param>
        private void ShowErrorMessage(string message)
        {
            // 这里可以调用通用的错误提示UI
            TackleAssembleLogger.LogWarning($"用户错误提示: {message}");
            // TODO: 集成实际的错误提示UI系统
        }

        #endregion

        #region 生命周期方法重写

        public override void OnUITaskStop()
        {
            // 隐藏部件选择面板
            HidePartSelectionPanel();

            // 调用基类方法
            base.OnUITaskStop();
        }

        #endregion
    }
}
```

## 5. TackleAssembleUIController 部件选择面板支持

### 5.1 新增部件选择面板接口

```csharp
namespace BlackJack.ProjectEF.Runtime.UI
{
    public partial class TackleAssembleUIController : UIControllerBase
    {
        #region 部件选择面板相关

        /// <summary>
        /// 显示部件选择面板
        /// </summary>
        /// <param name="slotType">配件槽类型</param>
        /// <param name="currentPartId">当前部件ID</param>
        /// <param name="onPartSelected">部件选择回调</param>
        public void ShowPartSelectionPanel(ESlotType slotType, int currentPartId, System.Action<int> onPartSelected)
        {
            if (m_partSelectionPanel == null)
            {
                Debug.LogError("TackleAssembleUIController: 部件选择面板未初始化");
                return;
            }

            // 记录回调
            m_onPartSelectedCallback = onPartSelected;

            // 加载对应类型的部件列表
            LoadPartListForPanel(slotType, currentPartId);

            // 显示面板
            m_partSelectionPanel.SetActive(true);

            // 播放显示动画
            AnimatePartSelectionPanel(true);

            Debug.Log($"TackleAssembleUIController: 显示部件选择面板 - {slotType}");
        }

        /// <summary>
        /// 隐藏部件选择面板
        /// </summary>
        public void HidePartSelectionPanel()
        {
            if (m_partSelectionPanel == null) return;

            // 播放隐藏动画
            AnimatePartSelectionPanel(false, () =>
            {
                m_partSelectionPanel.SetActive(false);
                ClearPartList();
                m_onPartSelectedCallback = null;
            });

            Debug.Log("TackleAssembleUIController: 隐藏部件选择面板");
        }

        /// <summary>
        /// 加载部件列表到面板
        /// </summary>
        /// <param name="slotType">配件槽类型</param>
        /// <param name="currentPartId">当前部件ID</param>
        private void LoadPartListForPanel(ESlotType slotType, int currentPartId)
        {
            // 清空现有列表
            ClearPartList();

            // 根据类型加载部件数据
            var partList = GetAvailablePartList(slotType);
            foreach (var partData in partList)
            {
                CreatePartListItem(partData, currentPartId);
            }
        }

        /// <summary>
        /// 获取可用部件列表
        /// </summary>
        /// <param name="slotType">配件槽类型</param>
        /// <returns>部件数据列表</returns>
        private List<PartItemData> GetAvailablePartList(ESlotType slotType)
        {
            var partList = new List<PartItemData>();

            // 这里需要根据实际的配置系统获取部件列表
            // 示例实现：
            switch (slotType)
            {
                case ESlotType.Tackle:
                    // 加载钓具部件（钓竿、渔轮等）
                    partList.AddRange(LoadTacklePartList());
                    break;
                case ESlotType.BaitGroup:
                    // 加载钓组部件（鱼钩、假饵等）
                    partList.AddRange(LoadBaitGroupPartList());
                    break;
            }

            return partList;
        }

        /// <summary>
        /// 创建部件列表项
        /// </summary>
        /// <param name="partData">部件数据</param>
        /// <param name="currentPartId">当前部件ID</param>
        private void CreatePartListItem(PartItemData partData, int currentPartId)
        {
            if (m_partItemPrefab == null || m_partListContainer == null) return;

            var itemObj = GameObject.Instantiate(m_partItemPrefab, m_partListContainer);
            var itemController = itemObj.GetComponent<PartListItemController>();

            if (itemController != null)
            {
                // 设置部件数据
                itemController.SetPartData(partData);

                // 设置选中状态
                itemController.SetSelected(partData.PartId == currentPartId);

                // 绑定点击事件
                itemController.EventOnItemClick += OnPartListItemClick;
            }
        }

        /// <summary>
        /// 处理部件列表项点击
        /// </summary>
        /// <param name="partId">部件ID</param>
        private void OnPartListItemClick(int partId)
        {
            // 调用回调
            m_onPartSelectedCallback?.Invoke(partId);

            Debug.Log($"TackleAssembleUIController: 用户选择部件 - {partId}");
        }

        /// <summary>
        /// 清空部件列表
        /// </summary>
        private void ClearPartList()
        {
            if (m_partListContainer == null) return;

            for (int i = m_partListContainer.childCount - 1; i >= 0; i--)
            {
                var child = m_partListContainer.GetChild(i);
                var itemController = child.GetComponent<PartListItemController>();
                if (itemController != null)
                {
                    itemController.EventOnItemClick -= OnPartListItemClick;
                }
                GameObject.DestroyImmediate(child.gameObject);
            }
        }

        /// <summary>
        /// 部件选择面板动画
        /// </summary>
        /// <param name="show">是否显示</param>
        /// <param name="onComplete">完成回调</param>
        private void AnimatePartSelectionPanel(bool show, System.Action onComplete = null)
        {
            if (m_partSelectionPanel == null) return;

            var canvasGroup = m_partSelectionPanel.GetComponent<CanvasGroup>();
            if (canvasGroup == null)
            {
                canvasGroup = m_partSelectionPanel.AddComponent<CanvasGroup>();
            }

            if (show)
            {
                canvasGroup.alpha = 0f;
                canvasGroup.DOFade(1f, 0.3f).OnComplete(() => onComplete?.Invoke());
            }
            else
            {
                canvasGroup.DOFade(0f, 0.3f).OnComplete(() => onComplete?.Invoke());
            }
        }

        #endregion

        #region 部件选择面板数据结构

        /// <summary>
        /// 部件列表项数据
        /// </summary>
        [System.Serializable]
        public class PartItemData
        {
            public int PartId;
            public string PartName;
            public string PartDescription;
            public Sprite PartIcon;
            public bool IsAvailable;
        }

        #endregion

        #region 部件选择面板UI元素

        [Header("部件选择面板")]
        /// <summary>
        /// 部件选择面板根节点
        /// </summary>
        [SerializeField] private GameObject m_partSelectionPanel;

        /// <summary>
        /// 部件列表容器
        /// </summary>
        [SerializeField] private Transform m_partListContainer;

        /// <summary>
        /// 部件列表项预制件
        /// </summary>
        [SerializeField] private GameObject m_partItemPrefab;

        /// <summary>
        /// 部件选择回调
        /// </summary>
        private System.Action<int> m_onPartSelectedCallback;

        #endregion
    }
}
```

## 6. TackleAssembleTackleUITask 管线修改

### 5.1 支持TackleConfig参数的Intent创建

```csharp
namespace BlackJack.ProjectEF.Runtime.UI
{
    public static class TackleAssembleTackleUITaskExtensions
    {
        /// <summary>
        /// 创建带钓具配置的Intent（新增方法）
        /// </summary>
        /// <param name="tackleConfig">钓具配置</param>
        /// <returns>创建的UIIntent</returns>
        public static UIIntentCustom TackleAssembleTackleUIIntentCreate(TackleConfig tackleConfig)
        {
            var uiIntent = new UIIntentCustom(nameof(TackleAssembleTackleUITask));

            // 将TackleConfig序列化为JSON字符串传递
            string configJson = JsonUtility.ToJson(tackleConfig);
            uiIntent.SetParam("TackleConfig", configJson);

            return uiIntent;
        }
    }
}
```

### 5.2 修改UpdatePipeline支持动态配置

```csharp
namespace BlackJack.ProjectEF.Runtime.UI
{
    /// <summary>
    /// TackleAssembleTackleUITask更新管线（修改版）
    /// </summary>
    public partial class TackleAssembleTackleUITaskCompUpdatePipeline : UITaskCompUpdatePipelineBase
    {
        /// <summary>
        /// 当前使用的钓具配置
        /// </summary>
        private TackleConfig m_tackleConfig;

        public override void UpdateContextSetup(ICustomParamDictionaryReadOnly paramDict,
            UITaskUpdatePipelineStartType pipelineStartType,
            params object[] extraParamArr)
        {
            base.UpdateContextSetup(paramDict, pipelineStartType, extraParamArr);

            // 尝试从参数中获取TackleConfig
            if (paramDict.HasParam("TackleConfig"))
            {
                string configJson = paramDict.GetParam<string>("TackleConfig");
                m_tackleConfig = JsonUtility.FromJson<TackleConfig>(configJson);

                TackleAssembleLogger.LogInfo($"管线使用自定义钓具配置: Rod={m_tackleConfig.RodId}, Reel={m_tackleConfig.ReelId}");
            }
            else
            {
                // 回退到原有的tackleConfigId方式
                int tackleConfigId = paramDict.GetStructParam<int>(TackleAssembleTackleUITask.IntentParamKey4TackleConfigId);
                m_tackleConfig = LoadTackleConfigFromId(tackleConfigId);

                TackleAssembleLogger.LogInfo($"管线使用默认钓具配置ID: {tackleConfigId}");
            }
        }

        /// <summary>
        /// 重写资源收集方法，使用TackleConfig
        /// </summary>
        public override void DynamicResCollect4Load(ref List<string> resPathList)
        {
            base.DynamicResCollect4Load(ref resPathList);

            if (m_tackleConfig == null || !m_tackleConfig.IsValid())
            {
                TackleAssembleLogger.LogError("钓具配置无效，无法收集资源");
                return;
            }

            var configLoader = m_owner.ConfigDataLoaderGet();

            try
            {
                // 1. 钓具模板Prefab
                resPathList.Add(GetTackleActorPrefabPath());

                // 2. 钓竿Prefab
                var rodConfig = configLoader.GetConfigDataRodInfo(m_tackleConfig.RodId);
                if (rodConfig != null && !string.IsNullOrEmpty(rodConfig.PrefabAssetPath))
                {
                    resPathList.Add(rodConfig.PrefabAssetPath);
                }

                // 3. 渔轮Prefab
                var reelConfig = configLoader.GetConfigDataReelInfo(m_tackleConfig.ReelId);
                if (reelConfig != null && !string.IsNullOrEmpty(reelConfig.PrefabAssetPath))
                {
                    resPathList.Add(reelConfig.PrefabAssetPath);
                }

                // 4. 鱼线Prefab
                resPathList.Add(GetTackleLinePrefabPath());

                // 5. 钓组相关Prefab
                if (m_tackleConfig.LureRigId > 0)
                {
                    var lureRigConfig = configLoader.GetConfigDataLureRigInfo(m_tackleConfig.LureRigId);
                    if (lureRigConfig != null && !string.IsNullOrEmpty(lureRigConfig.PrefabAssetPath))
                    {
                        resPathList.Add(lureRigConfig.PrefabAssetPath);
                    }
                }

                // 6. 鱼钩和假饵Prefab（如果有单独配置）
                if (m_tackleConfig.HookId > 0)
                {
                    var hookConfig = configLoader.GetConfigDataHookInfo(m_tackleConfig.HookId);
                    if (hookConfig != null && !string.IsNullOrEmpty(hookConfig.PrefabAssetPath))
                    {
                        resPathList.Add(hookConfig.PrefabAssetPath);
                    }
                }

                if (m_tackleConfig.LureId > 0)
                {
                    var lureConfig = configLoader.GetConfigDataLureInfo(m_tackleConfig.LureId);
                    if (lureConfig != null && !string.IsNullOrEmpty(lureConfig.PrefabAssetPath))
                    {
                        resPathList.Add(lureConfig.PrefabAssetPath);
                    }
                }

                TackleAssembleLogger.LogInfo($"收集到 {resPathList.Count} 个资源路径用于加载");
            }
            catch (System.Exception ex)
            {
                TackleAssembleLogger.LogError($"收集钓具资源失败 - {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// 从配置ID加载钓具配置
        /// </summary>
        /// <param name="tackleConfigId">钓具配置ID</param>
        /// <returns>钓具配置</returns>
        private TackleConfig LoadTackleConfigFromId(int tackleConfigId)
        {
            var configLoader = m_owner.ConfigDataLoaderGet();
            var tackleMainConfig = configLoader.GetConfigDataTackleInfo(tackleConfigId);

            if (tackleMainConfig == null)
            {
                throw new System.InvalidOperationException($"无法获取钓具配置 - ConfigId: {tackleConfigId}");
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
        /// 获取钓具Actor预制件路径
        /// </summary>
        /// <returns>预制件路径</returns>
        private string GetTackleActorPrefabPath()
        {
            return "Assets/GameProject/RuntimeAssets/Prefabs/TackleActor/TackleActorBase.prefab";
        }

        /// <summary>
        /// 获取鱼线预制件路径
        /// </summary>
        /// <returns>预制件路径</returns>
        private string GetTackleLinePrefabPath()
        {
            return "Assets/GameProject/RuntimeAssets/Prefabs/TackleLine/TackleLineBase.prefab";
        }
    }
}
```

## 6. 异常处理和日志系统

### 6.1 钓具组装异常类

```csharp
namespace BlackJack.ProjectEF.Runtime.UI
{
    /// <summary>
    /// 钓具组装异常基类
    /// </summary>
    public class TackleAssembleException : System.Exception
    {
        public TackleAssembleException(string message) : base(message) { }
        public TackleAssembleException(string message, System.Exception innerException) : base(message, innerException) { }
    }

    /// <summary>
    /// 部件配置异常
    /// </summary>
    public class PartConfigException : TackleAssembleException
    {
        public PartConfigException(string message) : base(message) { }
        public PartConfigException(string message, System.Exception innerException) : base(message, innerException) { }
    }

    /// <summary>
    /// 资源加载异常
    /// </summary>
    public class ResourceLoadException : TackleAssembleException
    {
        public ResourceLoadException(string message) : base(message) { }
        public ResourceLoadException(string message, System.Exception innerException) : base(message, innerException) { }
    }
}
```

### 6.2 日志记录器

```csharp
namespace BlackJack.ProjectEF.Runtime.UI
{
    /// <summary>
    /// 钓具组装日志记录器
    /// </summary>
    public static class TackleAssembleLogger
    {
        private const string LogPrefix = "[TackleAssemble]";

        /// <summary>
        /// 记录信息日志
        /// </summary>
        /// <param name="message">日志消息</param>
        public static void LogInfo(string message)
        {
            Debug.Log($"{LogPrefix} {message}");
        }

        /// <summary>
        /// 记录警告日志
        /// </summary>
        /// <param name="message">日志消息</param>
        public static void LogWarning(string message)
        {
            Debug.LogWarning($"{LogPrefix} {message}");
        }

        /// <summary>
        /// 记录错误日志
        /// </summary>
        /// <param name="message">日志消息</param>
        public static void LogError(string message)
        {
            Debug.LogError($"{LogPrefix} {message}");
        }

        /// <summary>
        /// 记录部件热替换日志
        /// </summary>
        /// <param name="slotName">配件槽名称</param>
        /// <param name="oldPartId">旧部件ID</param>
        /// <param name="newPartId">新部件ID</param>
        public static void LogPartSwap(string slotName, int oldPartId, int newPartId)
        {
            LogInfo($"部件热替换完成 - 槽位:{slotName}, 旧部件:{oldPartId}, 新部件:{newPartId}");
        }

        /// <summary>
        /// 记录视图状态切换日志
        /// </summary>
        /// <param name="oldState">旧状态</param>
        /// <param name="newState">新状态</param>
        public static void LogViewStateChange(string oldState, string newState)
        {
            LogInfo($"视图状态切换 - {oldState} → {newState}");
        }

        /// <summary>
        /// 记录管线操作日志
        /// </summary>
        /// <param name="operation">操作类型</param>
        /// <param name="details">操作详情</param>
        public static void LogPipelineOperation(string operation, string details)
        {
            LogInfo($"管线操作 - {operation}: {details}");
        }
    }
}
```

## 7. 总结

这个重新整理的实现架构文档基于以下核心设计原则：

### 7.1 利用现有系统
- **StageActor系统**：完整的资源管理和3D模型实例化
- **管线重启机制**：动态重新配置和加载资源
- **Controller绑定**：直接使用现有的TackleActorController和LureRigActorController

### 7.2 清晰的职责分工
- **UI层**：用户交互、界面状态管理、部件选择界面
- **StageActor层**：动态资源加载、3D模型实例管理
- **Controller层**：3D模型控制和渲染（仅在UI场景中使用）

### 7.3 实现流程
1. 用户点击配件槽 → UI层处理交互
2. 启动部件选择界面 → 用户选择新部件
3. 更新TackleConfig → 重启TackleAssembleTackleUITask管线
4. 管线收集新资源路径 → 动态加载StageActor
5. ViewUpdate生成新的3D模型实例 → UI自动刷新

这个架构避免了直接操作游戏场景的Scene管理组件，完全在UI系统内部实现钓具的动态组装和热替换功能。

---

*文档版本: 1.0*
*创建日期: 2025-01-15*
*基于: 现有代码分析 + StageActor系统设计*