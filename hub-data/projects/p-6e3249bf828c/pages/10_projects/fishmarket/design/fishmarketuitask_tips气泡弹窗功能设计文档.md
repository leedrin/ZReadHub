# FishMarketUITask - Tips气泡弹窗功能设计文档

**文档版本:** 1.0
**创建日期:** 2026年2月9日
**需求来源:** `FishMarketUITask_Tips功能需求变更.md`
**功能概述:** 将任务鱼感叹号标记的交互方式从"点击触发弹窗"改为"鼠标悬浮触发TipBubble气泡弹窗"

---

## 1. 现有代码分析

### 1.1 涉及文件清单

| 文件 | 路径 | 角色 |
|------|------|------|
| FishMarketFishItemUIController.cs | `GameView/UI/FishMarketUITask/Controller/` | 鱼卡片Controller，管理单条鱼的UI |
| FishMarketFishItemUICtrlDesc.cs | 同上 | 鱼卡片Desc，定义AutoBind字段 |
| FishMarketFishItemUIControllerAutogen.cs | 同上 | 鱼卡片自动生成绑定代码 |
| FishMarketKeeperUIController.cs | 同上 | 鱼护列表Controller，管理对象池和列表 |
| FishMarketKeeperUICtrlDesc.cs | 同上 | 鱼护列表Desc |
| FishMarketKeeperUIControllerAutogen.cs | 同上 | 鱼护列表自动生成绑定代码 |
| FishMarketUITaskCompKeeperTofu.cs | `GameView/UI/FishMarketUITask/Comp/` | Keeper业务Tofu组件 |
| FishMarketUITask.cs | `GameView/UI/FishMarketUITask/` | UITask主体，定义Layer |
| TipBubbleUIController.cs | `GameView/UI/Tip/` | 气泡弹窗通用Controller |
| TipSelfAdaptPosUIControllerBase.cs | `GameView/UI/Tip/` | 气泡弹窗位置自适应基类 |
| PrefabControllerCreater.cs | `BJFramework/Script/Runtime/Prefab/` | Prefab控制器创建工具 |
| Pfb_UI_Store_HighlightTips.prefab | `RuntimeAssets/UI/UIPrefab/CommonUIPrefab_ABS/` | 通用气泡弹窗预制体 |
| Pfb_UI_KeepnetFishListltem.prefab | `RuntimeAssets/UI/UIPrefab/FishMarketUIPrefab_ABS/` | 鱼列表Item预制体 |

### 1.2 现有架构关系

```
FishMarketUITask (UITask主体)
├── MainLayer: "FishMarketMainLayer"
│   ├── FishMarketKeeperUIController (鱼护列表Controller)
│   │   ├── EasyObjectPool (对象池管理)
│   │   ├── LoopVerticalScrollRect (虚拟滚动列表)
│   │   └── FishMarketFishItemUIController[] (鱼卡片Controller, 由对象池创建)
│   │       ├── m_questFishListItemStateController (任务鱼状态机: Show/Hide/Tip/TipSelected)
│   │       └── m_button (Root按钮, 点击事件)
│   └── [新增] TipBubbleUIController (气泡弹窗Controller, 通过Prefab加载)
│
└── FishMarketUITaskCompKeeperTofu (Keeper业务Tofu)
    ├── 管理 m_keeperUICtrl (FishMarketKeeperUIController引用)
    ├── 订阅 Controller事件 → 执行业务逻辑
    └── [新增] 管理 m_bubbleTipCtrl (气泡显示/关闭的统一控制点)
```

### 1.3 现有状态机

`FishMarketFishItemUIController` 中 `m_questFishListItemStateController` 的状态:

| 状态名 | 常量 | 含义 | 视觉表现 |
|--------|------|------|----------|
| `"Show"` | `QuestFishStateName4Show` | 正常任务鱼 | 限时热收标记正常显示 |
| `"Hide"` | `QuestFishStateName4Hide` | 非任务鱼 | 标记隐藏 |
| `"Tip"` | `QuestFishStateName4Tip` | 新鲜度为0的任务鱼 | 标记置灰 + 感叹号显示 |
| `"TipSelected"` | `QuestFishStateName4TipSelected` | 点击Tip后弹窗(旧) | 标记置灰 + 弹窗显示 |

### 1.4 参考实现 - FishingBagQuickAccess

`FishingBagQuickAccessUITaskCompMainTofu` 中的 TipBubble 使用模式:

**加载流程:**
1. `FishingBagQuickAccessUIController.OnBindFiledsCompleted()` 中调用 `PrefabControllerCreater.CreateAllControllers(m_tipBubbleRoot)` 初始化Prefab内部的Controller
2. `m_tipBubbleRoot` 是 Autogen 中的 `[AutoBindDesc("m_tipBubbleRoot")] public GameObject m_tipBubbleRoot`，在Prefab中指向 `Pfb_UI_Store_HighlightTips` 的根节点
3. `OnEventUIControllerLoadCompleted()` 中通过 `GetComponentInChildren<TipBubbleUIController>(true)` 获取Controller

**初始化:**
```csharp
m_bubbleTipCtrl = m_mainUICtrl.GetComponentInChildren<TipBubbleUIController>(true);
m_bubbleTipCtrl.Init(m_mainLayer, TipsPositionType.Up, TipsPositionType.LeftRight, false, 10, 0);
// 参数说明: Layer(取相机), 主方向(上), 依赖方向(左右), 不忽略边距, 主偏移10px, 依赖偏移0px
```

**显示/关闭:**
```csharp
// 悬浮开始 → 显示
m_bubbleTipCtrl.PanelShow(new TipBubblePanelPayload("文本内容"), targetRectTransform);
itemUICtrl.ArrowStateSet(true);

// 悬浮结束 → 关闭
m_bubbleTipCtrl.OnPanelClose();
itemUICtrl.ArrowStateSet(false);
```

---

## 2. 架构设计

### 2.1 事件流设计 (Controller→Keeper→Tofu 事件冒泡)

遵循 BJFramework 的 **Controller→Tofu 事件冒泡架构**:

```
                    ┌──────────────────────────────────────────────────────────┐
                    │            FishMarketUITaskCompKeeperTofu               │
                    │  (业务逻辑层 - 统一管理气泡显示/关闭)                   │
                    │                                                          │
                    │  ┌─ OnFishItemQuestTipHoverStart(ctrl)                  │
                    │  │   → m_bubbleTipCtrl.PanelShow(payload, arrowRect)    │
                    │  │   → itemCtrl.ArrowStateSet(true)                     │
                    │  │   → m_currentTipsFishIndex = index                   │
                    │  │                                                       │
                    │  └─ OnFishItemQuestTipHoverEnd(ctrl)                    │
                    │      → m_bubbleTipCtrl.OnPanelClose()                   │
                    │      → itemCtrl.ArrowStateSet(false)                    │
                    │      → m_currentTipsFishIndex = -1                      │
                    └──────────────────────┬───────────────────────────────────┘
                                           │ 订阅事件
                    ┌──────────────────────┴───────────────────────────────────┐
                    │           FishMarketKeeperUIController                    │
                    │  (列表管理层 - 转发子Item事件到Tofu)                     │
                    │                                                          │
                    │  ┌─ EventOnFishItemQuestTipHoverStart  ──→ Tofu         │
                    │  └─ EventOnFishItemQuestTipHoverEnd    ──→ Tofu         │
                    │                                                          │
                    │  OnPoolObjectCreated():                                  │
                    │    → 订阅 itemCtrl.EventOnQuestTipHoverStart            │
                    │    → 订阅 itemCtrl.EventOnQuestTipHoverEnd              │
                    │    → 绑定 Arrow 对象                                     │
                    └──────────────────────┬───────────────────────────────────┘
                                           │ 订阅事件
                    ┌──────────────────────┴───────────────────────────────────┐
                    │         FishMarketFishItemUIController                    │
                    │  (单条鱼Controller - 检测悬浮、抛出事件)                 │
                    │                                                          │
                    │  感叹号区域鼠标Enter:                                    │
                    │    → 检查状态 == "Tip"?                                  │
                    │    → EventOnQuestTipHoverStart?.Invoke(this)             │
                    │                                                          │
                    │  感叹号区域鼠标Exit:                                     │
                    │    → EventOnQuestTipHoverEnd?.Invoke(this)               │
                    └──────────────────────────────────────────────────────────┘
```

### 2.2 层级职责划分

| 层级 | 文件 | 职责 | 原则 |
|------|------|------|------|
| **Controller (Item)** | `FishMarketFishItemUIController` | 检测鼠标悬浮事件，校验状态后抛出事件 | 不直接操作气泡，只发信号 |
| **Controller (Keeper)** | `FishMarketKeeperUIController` | 加载TipBubble Prefab，转发子Item事件到Tofu | 桥接角色，管理Prefab生命周期 |
| **Tofu** | `FishMarketUITaskCompKeeperTofu` | 统一控制气泡显示/关闭，管理状态 | 所有业务逻辑在此处理 |

---

## 3. 详细设计

### 3.1 FishMarketFishItemUIController 修改

#### 3.1.1 新增字段

```csharp
// === 新增字段 ===

/// <summary>
/// QuestTips 下的 HighlightTips_Dummy/Arrow 对象引用
/// 由 KeeperUIController.OnPoolObjectCreated() 中绑定
/// </summary>
private GameObject m_arrowGameObject;

/// <summary>
/// Arrow 的 RectTransform 引用 (缓存，避免每次获取)
/// </summary>
private RectTransform m_arrowRectTransform;
```

#### 3.1.2 新增事件

```csharp
// === 新增事件 (供 KeeperUIController 订阅并转发到 Tofu) ===

/// <summary>
/// 任务鱼感叹号标记鼠标悬停开始事件
/// </summary>
public event Action<UIControllerBase> EventOnQuestTipHoverStart;

/// <summary>
/// 任务鱼感叹号标记鼠标悬停结束事件
/// </summary>
public event Action<UIControllerBase> EventOnQuestTipHoverEnd;
```

#### 3.1.3 新增 OnBindFiledsCompleted 重写

```csharp
protected override void OnBindFiledsCompleted()
{
    base.OnBindFiledsCompleted();

    // 使用框架内建的 ButtonEx 悬停事件机制
    // m_questTipBtn 是 QuestTips/TipsGroup 上的 ButtonEx 组件
    SetButtonHoverStartListener(nameof(m_questTipBtn), OnQuestTipBtnHoverStart);
    SetButtonHoverEndListener(nameof(m_questTipBtn), OnQuestTipBtnHoverEnd);
}
```

#### 3.1.4 新增方法

```csharp
/// <summary>
/// 设置 Arrow 对象引用 (由 KeeperUIController 在对象池创建时调用)
/// </summary>
public void ArrowGameObjectSet(GameObject arrowGo)
{
    m_arrowGameObject = arrowGo;
    m_arrowRectTransform = arrowGo?.transform as RectTransform;
    // 初始状态隐藏
    if (m_arrowGameObject != null)
    {
        m_arrowGameObject.SetActive(false);
    }
}

/// <summary>
/// 获取 Arrow 的 RectTransform (供 Tofu 定位气泡位置)
/// </summary>
public RectTransform ArrowRectTransformGet()
{
    return m_arrowRectTransform;
}

/// <summary>
/// 设置 Arrow 显示/隐藏状态 (由 Tofu 调用)
/// </summary>
public void ArrowStateSet(bool visible)
{
    if (m_arrowGameObject != null)
    {
        m_arrowGameObject.SetActive(visible);
    }
}

/// <summary>
/// 感叹号按钮悬停开始 - 由框架 ButtonEx 的 onHoverStart 触发
/// 通过 SetButtonHoverStartListener 注册
/// </summary>
private void OnQuestTipBtnHoverStart(UIControllerBase ctrl)
{
    // 仅在 "Tip" 状态下触发 (新鲜度为0的任务鱼)
    if (m_questFishListItemStateController?.CurrStateName == QuestFishStateName4Tip)
    {
        EventOnQuestTipHoverStart?.Invoke(this);
    }
}

/// <summary>
/// 感叹号按钮悬停结束 - 由框架 ButtonEx 的 onHoverEnd 触发
/// 通过 SetButtonHoverEndListener 注册
/// </summary>
private void OnQuestTipBtnHoverEnd(UIControllerBase ctrl)
{
    EventOnQuestTipHoverEnd?.Invoke(this);
}
```

**注意事项:**
- `OnEventQuestTipHoverStart()` / `OnEventQuestTipHoverEnd()` 设为 `private`，由 `OnBindFiledsCompleted()` 中通过框架的 `SetButtonHoverStartListener` 机制注册到 `m_questTipBtn` 上
- 框架的 `OnButtonHoverStart`/`OnButtonHoverEnd` 回调签名为 `Action<UIControllerBase>`，因此需要通过 wrapper 方法适配
- Controller 层**不直接操作气泡**，只负责检测并抛出事件

#### 3.1.4 悬停检测方案

**方案: Prefab 中添加 EventTrigger 组件**

在 `Pfb_UI_KeepnetFishListltem` 预制体的 `QuestTips/TipsGroup` (感叹号可交互区域) 上:
1. 添加 `EventTrigger` 组件
2. 添加 `PointerEnter` 事件 → 调用 `FishMarketFishItemUIController.OnEventQuestTipHoverStart()`
3. 添加 `PointerExit` 事件 → 调用 `FishMarketFishItemUIController.OnEventQuestTipHoverEnd()`

或者，如果需要代码方式绑定（不修改 Prefab），则在 Controller 的 `OnBindFiledsCompleted()` 中:
```csharp
// 代码方式绑定悬停事件 (备选方案)
// 需要在 Autogen 中新增 m_questTipHoverArea 字段绑定
var eventTrigger = m_questTipHoverArea.GetComponent<EventTrigger>()
                   ?? m_questTipHoverArea.AddComponent<EventTrigger>();

var enterEntry = new EventTrigger.Entry { eventID = EventTriggerType.PointerEnter };
enterEntry.callback.AddListener(_ => OnEventQuestTipHoverStart());
eventTrigger.triggers.Add(enterEntry);

var exitEntry = new EventTrigger.Entry { eventID = EventTriggerType.PointerExit };
exitEntry.callback.AddListener(_ => OnEventQuestTipHoverEnd());
eventTrigger.triggers.Add(exitEntry);
```

**推荐: 使用框架内建的 `SetButtonHoverStartListener` / `SetButtonHoverEndListener` 机制**

经过对 `UIControllerBase.cs` 和 `ButtonEx.cs` 的分析，BJFramework 已内建悬停检测:
- `ButtonEx` 组件提供 `onHoverStart` / `onHoverEnd` 事件（基于 `IPointerEnterHandler` / `IPointerExitHandler`）
- `UIControllerBase` 提供 `SetButtonHoverStartListener(fieldName, action)` / `SetButtonHoverEndListener(fieldName, action)` 注册方法
- 参考 `CommonItemUIController.cs` 中的用法:
  ```csharp
  SetButtonHoverStartListener(nameof(m_button), OnItemHoverStart);
  SetButtonHoverEndListener(nameof(m_button), OnItemHoverEnd);
  ```

**具体方案:**
1. 在 `Pfb_UI_KeepnetFishListltem` 的 `QuestTips/TipsGroup` 节点上添加 `ButtonEx` 组件（替代普通按钮或新增）
2. 在 `FishMarketFishItemUICtrlDesc` 中新增字段: `[AutoGenAliasName("m_questTipBtn")] public ButtonEx m_questTipBtn;`
3. 在 `FishMarketFishItemUIControllerAutogen` 中新增: `[AutoBindDesc("m_questTipBtn")] public ButtonEx m_questTipBtn;`
4. 在 `FishMarketFishItemUIController` 的 `OnBindFiledsCompleted()` (需新增重写) 中注册:
   ```csharp
   protected override void OnBindFiledsCompleted()
   {
       base.OnBindFiledsCompleted();
       SetButtonHoverStartListener(nameof(m_questTipBtn), OnQuestTipBtnHoverStart);
       SetButtonHoverEndListener(nameof(m_questTipBtn), OnQuestTipBtnHoverEnd);
   }
   ```

**优势:** 完全使用框架标准机制，无需引入 EventTrigger，对象池复用时悬停事件回调自动正确（绑定在 Controller 实例上）。

> **注意:** `FishMarketFishItemUIController` 当前未重写 `OnBindFiledsCompleted()`。由于它继承自 `ScrollItemBaseUIController`，需要确认基类调用链是否正常。框架中 `UIControllerBase.BindAllFields()` 会自动为所有 `ButtonEx` 字段注册 hover 事件分发器（见 `UIControllerBase.cs:155-157`），所以只要 Autogen 中声明了 `ButtonEx` 字段并绑定到正确节点，`SetButtonHoverStartListener` 就能生效。

---

### 3.2 FishMarketKeeperUIController 修改

#### 3.2.1 新增字段

```csharp
// === 新增字段 ===

/// <summary>
/// 气泡弹窗挂载根节点 (Prefab中的 HighlightTips_Dummy)
/// 需要在 Desc 和 Autogen 中新增对应绑定
/// </summary>
// [AutoBindDesc("m_tipBubbleRoot")]
// public GameObject m_tipBubbleRoot;   // 在 Autogen 中添加
```

**重要: 由于 `Pfb_UI_Store_HighlightTips` 是通用气泡弹窗Prefab，需要作为 `FishMarketKeeperUIController` 所属Prefab的子节点存在。**

Keeper Prefab 中添加结构:
```
FishMarketKeeperRoot
├── ... (现有UI结构)
└── HighlightTips_Dummy  ← m_tipBubbleRoot 绑定到这里
    └── Pfb_UI_Store_HighlightTips (气泡弹窗预制体实例)
```

#### 3.2.2 新增事件 (供 Tofu 订阅)

```csharp
// === 新增事件 ===

/// <summary>
/// 鱼Item感叹号标记鼠标悬停开始事件 (向Tofu冒泡)
/// </summary>
public event Action<UIControllerBase> EventOnFishItemQuestTipHoverStart;

/// <summary>
/// 鱼Item感叹号标记鼠标悬停结束事件 (向Tofu冒泡)
/// </summary>
public event Action<UIControllerBase> EventOnFishItemQuestTipHoverEnd;
```

#### 3.2.3 修改 OnBindFiledsCompleted()

在现有 `OnBindFiledsCompleted()` 末尾添加:

```csharp
protected override void OnBindFiledsCompleted()
{
    base.OnBindFiledsCompleted();

    // ... 现有按钮事件注册代码 ...

    // === 新增: 初始化气泡弹窗 Prefab ===
    if (m_tipBubbleRoot != null)
    {
        PrefabControllerCreater.CreateAllControllers(m_tipBubbleRoot);
    }
}
```

#### 3.2.4 修改 OnPoolObjectCreated()

在现有 `OnPoolObjectCreated()` 中添加 Arrow 绑定和事件订阅:

```csharp
protected void OnPoolObjectCreated(string poolName, GameObject go)
{
    if (m_currentKeeperMode == "FishMarket" && poolName == FishItemPoolName ||
        m_currentKeeperMode == "Keepnet" && poolName == KeepnetItemPoolName)
    {
        var itemCtrl = go.GetComponent<FishMarketFishItemUIController>();
        if (itemCtrl != null)
        {
            itemCtrl.Init(itemCtrl);
            itemCtrl.EventOnUIItemNeedFill += OnItemNeedFill;
            itemCtrl.EventOnUIItemClick += OnItemClick;

            // === 新增: 绑定 Arrow 对象 ===
            var arrowTransform = go.transform.Find("QuestTips/HighlightTips_Dummy/Arrow");
            if (arrowTransform != null)
            {
                itemCtrl.ArrowGameObjectSet(arrowTransform.gameObject);
            }

            // === 新增: 订阅悬浮事件并转发到 Tofu ===
            itemCtrl.EventOnQuestTipHoverStart += OnFishItemQuestTipHoverStart;
            itemCtrl.EventOnQuestTipHoverEnd += OnFishItemQuestTipHoverEnd;
        }
    }
}
```

#### 3.2.5 新增事件转发方法

```csharp
/// <summary>
/// 转发 Item 悬浮开始事件到 Tofu
/// </summary>
private void OnFishItemQuestTipHoverStart(UIControllerBase ctrl)
{
    EventOnFishItemQuestTipHoverStart?.Invoke(ctrl);
}

/// <summary>
/// 转发 Item 悬浮结束事件到 Tofu
/// </summary>
private void OnFishItemQuestTipHoverEnd(UIControllerBase ctrl)
{
    EventOnFishItemQuestTipHoverEnd?.Invoke(ctrl);
}
```

#### 3.2.6 新增公共方法

```csharp
/// <summary>
/// 获取 TipBubbleUIController (供 Tofu 使用)
/// </summary>
public TipBubbleUIController TipBubbleUIControllerGet()
{
    return GetComponentInChildren<TipBubbleUIController>(true);
}
```

---

### 3.3 FishMarketUITaskCompKeeperTofu 修改

#### 3.3.1 新增字段

```csharp
// === 新增字段 ===

/// <summary>
/// 气泡弹窗 Controller (统一管理气泡显示/关闭)
/// </summary>
private TipBubbleUIController m_bubbleTipCtrl;

/// <summary>
/// 当前正在显示 Tips 的鱼 ItemIndex (-1 表示无)
/// </summary>
private int m_currentTipsFishIndex = -1;

/// <summary>
/// Keeper 所在的 Layer 引用 (用于 TipBubble Init)
/// </summary>
private SceneLayerBase m_keeperLayer;
```

#### 3.3.2 修改 OnEventLayerLoadCompleted (新增)

KeeperTofu 当前没有重写此方法，需要新增:

```csharp
/// <summary>
/// 当 Layer 加载完成，缓存 Layer 引用
/// </summary>
protected override void OnEventLayerLoadCompleted(string layerName)
{
    if (layerName == FishMarketUITask.MainLayerName)
    {
        m_keeperLayer = m_compLayerManager.LayerGetByName(layerName);
    }
}
```

#### 3.3.3 修改 OnEventUIControllerLoadCompleted()

在现有方法末尾添加 TipBubble 初始化:

```csharp
protected override void OnEventUIControllerLoadCompleted(string uiCtrlName)
{
    if (uiCtrlName == nameof(FishMarketKeeperUIController))
    {
        m_keeperUICtrl = m_compUIControllerManager.UIControllerGetByName(
            nameof(FishMarketKeeperUIController)) as FishMarketKeeperUIController;

        if (m_keeperUICtrl != null)
        {
            KeepnetUICtrlUIEventRegister();

            // === 新增: 初始化气泡弹窗 Controller ===
            BubbleTipCtrlInit();
        }
    }
}
```

#### 3.3.4 新增 BubbleTipCtrlInit()

```csharp
/// <summary>
/// 初始化气泡弹窗 Controller
/// </summary>
private void BubbleTipCtrlInit()
{
    m_bubbleTipCtrl = m_keeperUICtrl.TipBubbleUIControllerGet();
    if (m_bubbleTipCtrl == null)
    {
        Debug.LogError("FishMarketKeeperTofu: m_bubbleTipCtrl is null, check Pfb_UI_Store_HighlightTips in Keeper prefab");
        return;
    }

    if (m_keeperLayer != null)
    {
        // 参数: Layer, 主方向(上), 依赖方向(左右), 不忽略边距, 主偏移10px, 依赖偏移0px
        m_bubbleTipCtrl.Init(m_keeperLayer, TipsPositionType.Up, TipsPositionType.LeftRight, false, 10, 0);
    }
    else
    {
        Debug.LogWarning("FishMarketKeeperTofu: m_keeperLayer is null when initializing bubble tip");
    }
}
```

#### 3.3.5 修改 KeepnetUICtrlUIEventRegister()

添加悬浮事件订阅:

```csharp
private void KeepnetUICtrlUIEventRegister()
{
    if (m_keeperUICtrl == null)
    {
        Debug.LogError("m_keeperUICtrl is null in KeepnetUICtrlUIEventRegister");
        return;
    }

    // ... 现有事件注册 ...
    m_keeperUICtrl.EventOnItemClick += EventOnItemClick;
    m_keeperUICtrl.EventOnSellBtnClick += EventOnSellBtnClick;
    m_keeperUICtrl.EventOnSelectAllBtnClick += EventOnSelectAllBtnClick;
    m_keeperUICtrl.EventOnSortByTimeBtnClick += EventOnSortByTimeBtnClick;
    m_keeperUICtrl.EventOnSortByWeightBtnClick += EventOnSortByWeightBtnClick;
    m_keeperUICtrl.EventOnSortByRareBtnClick += EventOnSortByRareBtnClick;
    m_keeperUICtrl.EventOnSortByQuestBtnClick += EventOnSortByQuestBtnClick;
    m_keeperUICtrl.EventOnOrderBtnClick += EventOnOrderBtnClick;
    m_keeperUICtrl.EventOnKeepnetClose += EventOnKeepnetClose;

    // === 新增: 订阅悬浮事件 ===
    m_keeperUICtrl.EventOnFishItemQuestTipHoverStart += OnFishItemQuestTipHoverStart;
    m_keeperUICtrl.EventOnFishItemQuestTipHoverEnd += OnFishItemQuestTipHoverEnd;
}
```

#### 3.3.6 新增悬浮事件处理

```csharp
/// <summary>
/// 鱼Item感叹号标记悬浮开始事件处理
/// </summary>
private void OnFishItemQuestTipHoverStart(UIControllerBase ctrl)
{
    if (ctrl is not FishMarketFishItemUIController itemCtrl) return;

    int fishIndex = itemCtrl.ItemIndex;

    // 如果当前已有其他 Item 的 Tips 显示，先关闭
    if (m_currentTipsFishIndex != -1 && m_currentTipsFishIndex != fishIndex)
    {
        BubbleTipClose();
    }

    // 显示新的 Tips
    BubbleTipShow(itemCtrl);
    m_currentTipsFishIndex = fishIndex;
}

/// <summary>
/// 鱼Item感叹号标记悬浮结束事件处理
/// </summary>
private void OnFishItemQuestTipHoverEnd(UIControllerBase ctrl)
{
    if (ctrl is not FishMarketFishItemUIController itemCtrl) return;

    int fishIndex = itemCtrl.ItemIndex;

    // 只关闭当前显示的 Tips (避免快速滑动时错误关闭)
    if (m_currentTipsFishIndex == fishIndex)
    {
        BubbleTipClose();
    }
}

/// <summary>
/// 显示新鲜度为0的提示气泡
/// </summary>
private void BubbleTipShow(FishMarketFishItemUIController itemCtrl)
{
    if (m_bubbleTipCtrl == null) return;

    var arrowRect = itemCtrl.ArrowRectTransformGet();
    if (arrowRect == null) return;

    // 显示气泡
    var payload = new TipBubblePanelPayload(FreshnessZeroTipContent);
    m_bubbleTipCtrl.PanelShow(payload, arrowRect);

    // 显示箭头
    itemCtrl.ArrowStateSet(true);
}

/// <summary>
/// 关闭当前 Tips 气泡
/// </summary>
private void BubbleTipClose()
{
    if (m_bubbleTipCtrl == null) return;

    // 关闭气泡
    m_bubbleTipCtrl.OnPanelClose();

    // 隐藏对应 Item 的 Arrow
    if (m_currentTipsFishIndex != -1 && m_keeperUICtrl != null)
    {
        var itemCtrl = m_keeperUICtrl.FindItemControllerByIndex(m_currentTipsFishIndex);
        itemCtrl?.ArrowStateSet(false);
    }

    m_currentTipsFishIndex = -1;
}
```

**注意:** `FindItemControllerByIndex` 已存在于 `FishMarketKeeperUIController` 中，但目前是 `protected`。需要改为 `public` 或提供一个公共访问方法。

#### 3.3.7 修改 OnUITaskStop()

```csharp
public override void OnUITaskStop()
{
    // === 新增: 关闭 Tips 气泡弹窗，防止残留在其他界面 ===
    BubbleTipClose();

    // 注销回调
    if (m_keeperUICtrl != null)
    {
        m_keeperUICtrl.EventOnItemClick -= EventOnItemClick;
        m_keeperUICtrl.EventOnSellBtnClick -= EventOnSellBtnClick;
        m_keeperUICtrl.EventOnSelectAllBtnClick -= EventOnSelectAllBtnClick;
        m_keeperUICtrl.EventOnSortByTimeBtnClick -= EventOnSortByTimeBtnClick;
        m_keeperUICtrl.EventOnSortByWeightBtnClick -= EventOnSortByWeightBtnClick;
        m_keeperUICtrl.EventOnSortByRareBtnClick -= EventOnSortByRareBtnClick;
        m_keeperUICtrl.EventOnSortByQuestBtnClick -= EventOnSortByQuestBtnClick;
        m_keeperUICtrl.EventOnOrderBtnClick -= EventOnOrderBtnClick;
        m_keeperUICtrl.EventOnKeepnetClose -= EventOnKeepnetClose;

        // === 新增: 注销悬浮事件 ===
        m_keeperUICtrl.EventOnFishItemQuestTipHoverStart -= OnFishItemQuestTipHoverStart;
        m_keeperUICtrl.EventOnFishItemQuestTipHoverEnd -= OnFishItemQuestTipHoverEnd;
    }

    base.OnUITaskStop();
}
```

#### 3.3.8 新增常量

```csharp
/// <summary>
/// 新鲜度为0时的提示文本
/// </summary>
private const string FreshnessZeroTipContent = "新鲜度为0时，无法完成限时热收";
```

---

### 3.4 Prefab 修改

#### 3.4.1 Pfb_UI_KeepnetFishListltem (鱼卡片Item预制体)

**现有结构中需确认/添加:**
```
Pfb_UI_KeepnetFishListltem
├── ... (现有UI元素)
└── QuestTips (任务鱼标记根节点, 由 m_questFishListItemStateController 控制)
    ├── Root
    │   ├── Image (限时热收图标)
    │   ├── TextImage (文字背景)
    │   └── TipsGroup (感叹号可交互区域)  ← 添加 ButtonEx 组件
    │       ├── Image (感叹号图标)        ← m_questTipBtn 绑定到此节点的父节点 TipsGroup
    │       └── Text (文字)
    └── HighlightTips_Dummy  ← 确认存在
        └── Arrow (箭头对象)  ← 确认存在, 初始 Active=false
```

**关键修改:**
1. `TipsGroup` 节点上添加 `ButtonEx` 组件（利用框架内建 hover 事件机制）
2. 在 `FishMarketFishItemUICtrlDesc` 中新增 `m_questTipBtn` 字段绑定到 `TipsGroup`
3. 确认 `HighlightTips_Dummy/Arrow` 节点存在且路径正确
4. Arrow 节点的 RectTransform 用于定位气泡弹窗位置

**FishMarketFishItemUICtrlDesc.cs 新增:**
```csharp
[Header("任务鱼感叹号悬浮按钮")]
[AutoGenAliasName("m_questTipBtn")]
public ButtonEx m_questTipBtn;
```

**FishMarketFishItemUIControllerAutogen.cs 新增 (代码生成):**
```csharp
[AutoBindDesc("m_questTipBtn")]
public ButtonEx m_questTipBtn;
```

#### 3.4.2 FishMarketKeeper 所属 Prefab

需要在 Keeper Prefab 中添加 `Pfb_UI_Store_HighlightTips` 作为子节点:

```
FishMarketKeeperRoot
├── ... (现有结构)
└── TipBubbleRoot  ← 新增节点, 挂载 Pfb_UI_Store_HighlightTips
    └── Pfb_UI_Store_HighlightTips (气泡弹窗预制体)
```

需要在 `FishMarketKeeperUICtrlDesc` 和 `FishMarketKeeperUIControllerAutogen` 中添加:
```csharp
// FishMarketKeeperUICtrlDesc.cs 中新增:
[Header("气泡弹窗挂载根节点")]
[AutoGenAliasName("m_tipBubbleRoot")]
public GameObject m_tipBubbleRoot;

// FishMarketKeeperUIControllerAutogen.cs 中新增:
[AutoBindDesc("m_tipBubbleRoot")]
public GameObject m_tipBubbleRoot;
```

---

### 3.5 FindItemControllerByIndex 可见性修改

`FishMarketKeeperUIController.FindItemControllerByIndex()` 当前为 `protected`，需要改为 `public` 以供 Tofu 访问:

```csharp
// FishMarketKeeperUIController.cs 第622行
// 修改: protected → public
public FishMarketFishItemUIController FindItemControllerByIndex(int fishIndex)
```

---

## 4. 边界情况处理

### 4.1 列表滚动时 (对象池回收)

**场景:** 用户在气泡显示时滚动鱼护列表，当前显示 Tips 的鱼卡片被对象池回收。

**处理:**
- `FishMarketFishItemUIController` 被回收时（`OnDisable`），确保触发悬浮结束事件
- 需要在 `FishMarketFishItemUIController` 中重写 `OnDisable`:

```csharp
private void OnDisable()
{
    // 对象池回收时，确保关闭悬浮状态
    EventOnQuestTipHoverEnd?.Invoke(this);
}
```

### 4.2 切换排序时

**场景:** 用户切换排序类型，列表刷新。

**处理:** `GridDataRefresh()` 会触发 `LoopVerticalScrollRect.RefillCells...`，重新填充数据。由于排序后 ItemIndex 会变化，需要在排序前关闭气泡:

在 `FishMarketUITaskCompKeeperTofu` 的排序相关事件处理中，排序前先关闭气泡:
```csharp
// 各排序事件处理方法中 (EventOnSortByTimeBtnClick 等)
BubbleTipClose();  // 排序前关闭气泡
```

或在 `KeeperPipelineLaunch()` 中统一处理:
```csharp
private void KeeperPipelineLaunch()
{
    // === 新增: 启动管线前关闭气泡 ===
    BubbleTipClose();

    var pipelineInitInfo = m_owner.CompUpdatePipelineManagerGet().UpdatePipelineInitInfoAlloc();
    // ... 原有代码 ...
}
```

### 4.3 任务状态变化时

**场景:** 任务完成/刷新，`QuestFishMarkStateUpdate()` 改变状态机，感叹号消失。

**处理:** 状态变化通过管线 `ViewUpdate` 触发 `KeeperUpdate` → `GridDataRefresh`，列表刷新时自然关闭气泡（同4.2）。

### 4.4 鼠标快速移入移出

**场景:** 用户快速滑过多个感叹号。

**处理:** `TipBubbleUIController` 内部为单例显示模式。每次 `PanelShow` 前会先关闭当前显示。加上 Tofu 层的 `m_currentTipsFishIndex` 判断，可确保不会出现多个气泡同时显示。

### 4.5 UITask 关闭时

**场景:** 玩家关闭鱼市界面。

**处理:** 在 `OnUITaskStop()` 中调用 `BubbleTipClose()`，已在 3.3.7 中设计。

### 4.6 快捷键和滚轮

**需求:** 气泡显示时不拦截快捷键和滚轮。

**处理:**
- `TipBubbleUIController.Init()` 的 `ignoreMargin=false` 已确保不拦截底层输入
- `TipBubbleUIController` 继承自 `TipSelfAdaptPosUIControllerBase`，默认不拦截滚轮事件
- 滚轮事件由 `LoopVerticalScrollRect` 正常处理
- KeeperTofu 的 `TofuShouldRespondHotKey = false`（已在 `Initialize()` 中设置），不影响快捷键传递

---

## 5. 旧功能清理

### 5.1 移除 TipSelected 状态相关代码

由于交互方式从"点击"改为"悬浮"，以下旧代码需要评估是否移除:

| 方法/字段 | 文件 | 处理 |
|-----------|------|------|
| `QuestFishStateName4TipSelected` 常量 | FishMarketFishItemUIController | **保留** (状态机中仍可能需要) |
| `QuestFishTipSelectedStateSet()` | FishMarketFishItemUIController | **评估移除** (不再有点击触发弹窗的需求) |
| `QuestFishMarkStateReset()` | FishMarketFishItemUIController | **评估移除** (配合TipSelected使用) |

**建议:** 先不移除旧代码，标记为 `[Obsolete]`，在后续版本中清理。

---

## 6. 修改文件汇总

### 6.1 C# 代码修改

| 文件 | 修改类型 | 修改内容 |
|------|----------|----------|
| `FishMarketFishItemUIController.cs` | **修改** | 新增OnBindFiledsCompleted重写(注册ButtonEx悬停监听)、新增字段(m_arrowGameObject, m_arrowRectTransform)、事件(EventOnQuestTipHoverStart/End)、方法(ArrowGameObjectSet/ArrowStateSet/ArrowRectTransformGet/OnQuestTipBtnHoverStart/OnQuestTipBtnHoverEnd/OnDisable) |
| `FishMarketFishItemUICtrlDesc.cs` | **修改** | 新增 m_questTipBtn (ButtonEx) 字段 |
| `FishMarketFishItemUIControllerAutogen.cs` | **修改** (代码生成) | 新增 m_questTipBtn 自动绑定 |
| `FishMarketKeeperUIController.cs` | **修改** | OnBindFiledsCompleted新增PrefabControllerCreater调用、OnPoolObjectCreated新增Arrow绑定和事件订阅、新增事件(EventOnFishItemQuestTipHoverStart/End)、新增转发方法、新增TipBubbleUIControllerGet()、FindItemControllerByIndex改为public |
| `FishMarketKeeperUICtrlDesc.cs` | **修改** | 新增 m_tipBubbleRoot 字段 |
| `FishMarketKeeperUIControllerAutogen.cs` | **修改** (代码生成) | 新增 m_tipBubbleRoot 自动绑定 |
| `FishMarketUITaskCompKeeperTofu.cs` | **修改** | 新增字段(m_bubbleTipCtrl, m_currentTipsFishIndex, m_keeperLayer)、新增OnEventLayerLoadCompleted重写、修改OnEventUIControllerLoadCompleted、新增BubbleTipCtrlInit/OnFishItemQuestTipHoverStart/OnFishItemQuestTipHoverEnd/BubbleTipShow/BubbleTipClose、修改KeepnetUICtrlUIEventRegister/OnUITaskStop/KeeperPipelineLaunch |

### 6.2 Prefab 修改

| Prefab | 修改内容 |
|--------|----------|
| FishMarketKeeper Prefab | 新增 TipBubbleRoot 节点，挂载 Pfb_UI_Store_HighlightTips |
| Pfb_UI_KeepnetFishListltem | QuestTips/TipsGroup 添加 ButtonEx 组件；确认 HighlightTips_Dummy/Arrow 结构 |

### 6.3 Desc 配置修改

| Desc 文件 | 修改 |
|-----------|------|
| FishMarketKeeperUICtrlDesc | 新增 `m_tipBubbleRoot` (GameObject) |
| FishMarketFishItemUICtrlDesc | 新增 `m_questTipBtn` (ButtonEx) |

---

## 7. 实施步骤

### Step 1: Prefab 准备
1. 在 FishMarketKeeper 所属 Prefab 中添加 `TipBubbleRoot` 节点
2. 将 `Pfb_UI_Store_HighlightTips` 预制体实例放入 `TipBubbleRoot` 下
3. 确认 `Pfb_UI_KeepnetFishListltem` 中 `QuestTips/HighlightTips_Dummy/Arrow` 结构正确
4. 配置 `FishMarketKeeperUICtrlDesc` 并重新生成 Autogen

### Step 2: Controller 层代码
1. 修改 `FishMarketFishItemUIController.cs` - 添加事件、字段、方法
2. 修改 `FishMarketKeeperUIController.cs` - 添加 Prefab 加载、事件转发、Arrow 绑定

### Step 3: Tofu 层代码
1. 修改 `FishMarketUITaskCompKeeperTofu.cs` - 添加气泡管理逻辑

### Step 4: 悬浮检测绑定
1. 在 `FishMarketFishItemUIController` 中用代码方式绑定 EventTrigger
2. 或在 Prefab 中配置 EventTrigger 组件

### Step 5: 测试验证
1. 悬浮显示/移出关闭是否正常
2. 快速滑动、列表滚动、排序切换时气泡是否正确关闭
3. 快捷键和滚轮是否正常传递
4. UITask 关闭时气泡是否清理
5. 对象池回收/复用时状态是否正确

---

## 8. 关键设计决策说明

### Q1: 为什么气泡弹窗挂在 KeeperController 下而不是每个 FishItem 下？

**原因:**
- `FishItem` 是对象池复用的，如果每个 Item 都挂一个 `Pfb_UI_Store_HighlightTips`，会导致大量重复实例
- 同一时间只会显示一个气泡，采用单例模式（Keeper 级别一个 TipBubbleUIController）更高效
- 参考 `FishingBagQuickAccessUITaskCompMainTofu` 的实现，也是一个 Controller 级别的单例

### Q2: 为什么不在 Controller 中直接操作气泡？

**原因:**
- BJFramework 的设计原则要求 Controller 只负责 UI 展示和事件抛出
- 业务逻辑（如"当前是否允许显示气泡"、"先关闭旧气泡再显示新气泡"）应在 Tofu 层处理
- 这样在 UITask 停止时，Tofu 可以统一清理，避免遗漏

### Q3: 为什么使用 ButtonEx + SetButtonHoverStartListener 而不是 EventTrigger？

**原因:**
- BJFramework 已内建完整的悬停事件机制: `ButtonEx.onHoverStart/onHoverEnd` → `UIControllerBase.OnButtonHoverStart/End` → `SetButtonHoverStartListener` 回调
- 参考 `CommonItemUIController.cs` 使用了完全相同的模式 (`SetButtonHoverStartListener(nameof(m_button), OnItemHoverStart)`)
- 对象池复用时，框架的绑定机制会自动处理 Controller 实例对应关系
- 不需要引入 EventTrigger 等额外 Unity 组件，保持架构一致性
- 悬停回调签名 `Action<UIControllerBase>` 与框架其他事件回调一致

---

**文档结束**

**关联文档:**
- 需求变更: `FishMarketUITask_Tips功能需求变更.md`
- PRD: `FishmarketUITask_PRD_标注版.md`
- 参考实现: `FishingBagQuickAccessUITaskCompMainTofu.cs`
