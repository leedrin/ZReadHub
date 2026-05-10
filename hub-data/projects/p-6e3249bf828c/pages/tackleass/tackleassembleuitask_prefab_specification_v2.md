# 钓具组装UITask - UIPrefab结构说明文档 v2.0

## 修订说明
本版本基于放大的Prefab结构图进行完全修正，确保层级结构与实际Prefab完全一致。

---

## 1. UIPrefab资源列表

### 1.1 主界面Prefab
- **资源路径**：`Pfb_UI_Main_TackleAssemble`
- **Layer名称**：`TackleAssembleUILayer`
- **UIController**：`TackleAssembleUIController`

### 1.2 配件槽Item Prefab
- **资源路径**：`TackleAssembleItemRoot`（作为子Prefab嵌入主Prefab）
- **用途**：显示单个配件槽
- **数量**：根据钓具配置动态生成（通常6-15个）

### 1.3 顶部Tab按钮Prefab
- **资源路径**：`Pfb_UI_TackleAssembleTitleButton`
- **用途**：顶部Tab切换（装配/方案/改装）
- **数量**：3个固定按钮

---

## 2. 主界面Prefab完整层级结构

```
Pfb_UI_Main_TackleAssemble
│
├── Canvas (Environment)
│   └── (环境Canvas，用于编辑预览)
│
└── Pfb_UI_Main_TackleAssemble (根节点)
    └── TackleAssembleRoot (主根节点)
        ├── Pfb_UI_TackleAssemble_BGPanel (背景面板 Prefab 隐藏)
        │
        ├── CloseButton (关闭按钮)
        │   └── Image (按钮图标)
        │
        ├── TopGroup (顶部区域组)
        │   ├── TackleAssembleTitle (标题文本)
        │   ├── TopButtonGroup (顶部按钮组)
        │   │     ├── BGGroup (背景组)
        │   │     └── StoreTitleButtonScrollView (顶部Tab滚动视图)
        │   │         ├── Viewport
        │   │         └── Content
        │   │             ├── Pfb_UI_TackleAssembleTitleButton (装配Tab)
        │   │             ├── Pfb_UI_TackleAssembleTitleButton (1) (方案Tab)
        │   │             └── Pfb_UI_TackleAssembleTitleButton (2) (改装Tab)
        │   └── HandButton (手持按钮操作区域)
        └── AssemblePanelRoot (组装面板根节点)
            ├── DetailPanel (详情面板)
            │   └── AssemblePanel (组装详情面板)
            │   │   └── Scroll View (外层滚动视图 - 可能用于整体滚动)
            │   │       ├── Viewport
            │   │       └── Content
            │   │   
            │   ├── SlotScrollView (配件槽滚动视图)
            │   │   ├── Shadowing (阴影层)
            │   │   ├── BGing (背景层)
            │   │   └── Scroll View (内层滚动视图)
            │   │       ├── Viewport
            │   │       └── Content
            │   │           ├── TackleAssembleItemRoot (配件槽Item #1)
            │   │           ├── TackleAssembleItemRoot (1) (配件槽Item #2)
            │   │           ├── TackleAssembleItemRoot (2) (配件槽Item #3)
            │   │           ├── TackleAssembleItemRoot (3) (配件槽Item #4)
            │   │           └── ... (更多配件槽Item根据配置动态生成)
            │   │   
            │   └── AssemblyScrollView (装配列表滚动视图)
            │       ├── Shadowing (阴影层)
            │       ├── BGing (背景层)
            │       ├── Scroll View (内层滚动视图)
            │           ├── Viewport
            │           └── Content
```

---

## 3. 关键节点详细说明

### 3.1 层级1：根节点和环境

#### Canvas (Environment)
- **类型**：Canvas
- **用途**：Unity编辑器中预览用的环境Canvas
- **运行时**：不参与实际运行

#### Pfb_UI_Main_TackleAssemble
- **类型**：GameObject根节点
- **用途**：整个Prefab的根节点

#### TackleAssembleRoot
- **类型**：Transform
- **用途**：钓具组装的主根节点
- **重要性**：所有UI内容的容器

---

#### 3.2 CloseButton
- **类型**：Button
- **用途**：关闭界面按钮
- **事件绑定**：`EventOnCloseButtonClick`

---

### 3.3 层级3：顶部区域 (TopGroup)

#### TackleAssembleTitle
- **类型**：Text / TextMeshProUGUI
- **用途**：显示标题 "钓具组装"
- **绑定字段**：`m_titleText`

#### TopButtonGroup
包含顶部Tab切换按钮组。

##### StoreTitleButtonScrollView
- **类型**：ScrollRect
- **用途**：顶部Tab的横向滚动视图
- **内容**：
  - `Pfb_UI_TackleAssembleTitleButton`: "装配" Tab
  - `Pfb_UI_TackleAssembleTitleButton (1)`: "方案" Tab
  - `Pfb_UI_TackleAssembleTitleButton (2)`: "改装" Tab

**Tab按钮功能**：
- **装配Tab**：显示配件槽列表和部件选择（默认）
- **方案Tab**：显示钓具组装方案列表（切换到独立UITask）
- **改装Tab**：显示钓具改装界面（可能的扩展功能）

---

### 3.4 层级4：操作区域

#### AssemblePanelRoot
主要的组装操作区域根节点。

##### DetailPanel
- **类型**：Panel
- **用途**：显示选中配件的详细信息
- **显示内容**：
  - 配件名称
  - 配件属性（负载、长度等）
  - 配件描述
- **绑定字段**：`m_detailPanel`

##### AssemblePanel
主要的组装面板，包含配件槽列表和部件选择列表。

###### 外层Scroll View
- **类型**：ScrollRect
- **用途**：可能用于整体内容的滚动（如果内容过多）

###### SlotScrollView (配件槽滚动视图)
这是**配件槽列表的容器**，是核心UI区域。

**结构**：
- `Shadowing`: 阴影效果层
- `BGing`: 背景层
- `Scroll View`: 实际的滚动视图
  - `Viewport`: 视口
  - `Content`: 内容容器
    - **TackleAssembleItemRoot**: 配件槽Item根节点（多个）

**重要字段绑定**：
```csharp
// TackleAssembleUIController
private ScrollRect m_slotScrollView;  // 绑定路径：AssemblePanel/SlotScrollView/Scroll View
private Transform m_slotScrollViewContent;  // 绑定路径：AssemblePanel/SlotScrollView/Scroll View/Viewport/Content
```

**TackleAssembleItemRoot数量**：
- **重要说明**：Prefab中预制的4个示例Item（TackleAssembleItemRoot、TackleAssembleItemRoot (1)、(2)、(3)）**仅用于编辑器预览效果，运行时会被删除**
- 实际运行时使用**对象池统一管理**所有配件槽Item
- 根据钓具配置动态生成（通常6-15个）
- 每个Item代表一个配件槽（渔轮、主线、子线、鱼钩等）

###### AssemblyScrollView (装配列表滚动视图)
这是**部件选择列表的容器**，当用户点击配件槽后显示。

**结构**：
- `TackleRoot`: 钓具根节点
  - (动态生成部件选择Item)

**重要字段绑定**：
```csharp
// TackleAssembleUIController
private ScrollRect m_partSelectionScrollView;  // 绑定路径：AssemblePanel/AssemblyScrollView
private Transform m_partSelectionScrollViewContent;  // 绑定路径：AssemblePanel/AssemblyScrollView/TackleRoot
```

#### Panel_Main
- **类型**：Panel
- **用途**：可能用于其他辅助功能或备用面板

---

## 4. UI状态切换逻辑

### 4.1 主要状态

根据实际Prefab结构，UI状态切换由`SlotScrollView`和`PartSelectionScrollView`的显示/隐藏控制。

```csharp
// TackleAssembleUIController
public void SetToUIState(string stateName)
{
    switch (stateName)
    {
        case "SlotScrollView":
            // 显示配件槽列表
            m_slotScrollView.gameObject.SetActive(true);
            m_partSelectionScrollView.gameObject.SetActive(false);
            break;

        case "PartSelectionScrollView":
            // 显示部件选择列表
            m_slotScrollView.gameObject.SetActive(false);
            m_partSelectionScrollView.gameObject.SetActive(true);
            break;
    }
}
```

### 4.2 状态转换流程

```
初始状态：SlotScrollView (显示配件槽列表)
    │
    ├─> 用户点击配件槽Item
    │   └─> 切换到 PartSelectionScrollView (显示部件选择列表)
    │       └─> 用户选择部件 or 点击返回
    │           └─> 切换回 SlotScrollView
    │
    └─> 用户点击"方案"Tab
        └─> 启动方案管理UITask（独立界面）
```

---

## 5. UIController字段完整绑定

```csharp
public partial class TackleAssembleUIController : UIControllerBase
{
    // ========== 顶部区域 ==========

    /// <summary>
    /// 关闭按钮
    /// 绑定路径：TackleAssembleRoot/Pfb_UI_TackleAssemble_BGPanel/CloseButton
    /// </summary>
    private Button m_closeButton;

    /// <summary>
    /// 标题文本
    /// 绑定路径：TackleAssembleRoot/Pfb_UI_TackleAssemble_BGPanel/TopGroup/TackleAssembleTitle
    /// </summary>
    private Text m_titleText;

    /// <summary>
    /// 顶部Tab滚动视图
    /// 绑定路径：TackleAssembleRoot/Pfb_UI_TackleAssemble_BGPanel/TopGroup/TopButtonGroup/StoreTitleButtonScrollView
    /// </summary>
    private ScrollRect m_topTabScrollView;

    /// <summary>
    /// 顶部Tab按钮列表
    /// </summary>
    private List<TackleAssembleTitleButtonController> m_topTabButtons;

    // ========== 主要内容区域 ==========

    /// <summary>
    /// 详情面板
    /// 绑定路径：TackleAssembleRoot/.../AssemblePanelRoot/DetailPanel
    /// </summary>
    private GameObject m_detailPanel;

    /// <summary>
    /// 配件槽滚动视图
    /// 绑定路径：TackleAssembleRoot/.../AssemblePanel/SlotScrollView/Scroll View
    /// </summary>
    private ScrollRect m_slotScrollView;

    /// <summary>
    /// 配件槽内容容器
    /// 绑定路径：TackleAssembleRoot/.../AssemblePanel/SlotScrollView/Scroll View/Viewport/Content
    /// </summary>
    private Transform m_slotScrollViewContent;

    /// <summary>
    /// 部件选择滚动视图
    /// 绑定路径：TackleAssembleRoot/.../AssemblePanel/AssemblyScrollView
    /// </summary>
    private ScrollRect m_partSelectionScrollView;

    /// <summary>
    /// 部件选择内容容器
    /// 绑定路径：TackleAssembleRoot/.../AssemblePanel/AssemblyScrollView/TackleRoot
    /// </summary>
    private Transform m_partSelectionScrollViewContent;

    // ========== 阴影和背景层 ==========

    /// <summary>
    /// 配件槽滚动视图的阴影层
    /// 绑定路径：TackleAssembleRoot/.../AssemblePanel/SlotScrollView/Shadowing
    /// </summary>
    private GameObject m_slotScrollViewShadowing;

    /// <summary>
    /// 配件槽滚动视图的背景层
    /// 绑定路径：TackleAssembleRoot/.../AssemblePanel/SlotScrollView/BGing
    /// </summary>
    private GameObject m_slotScrollViewBGing;

    // ========== 数据和缓存 ==========

    /// <summary>
    /// 当前活跃的配件槽Item控制器列表
    /// </summary>
    private List<TackleAssembleItemController> m_slotItemCtrls = new List<TackleAssembleItemController>();

    /// <summary>
    /// 当前活跃的部件选择Item控制器列表
    /// </summary>
    private List<PartSelectionItemController> m_partSelectionItemCtrls = new List<PartSelectionItemController>();
}
```

---

## 6. 配件槽Item结构 (TackleAssembleItemRoot)

根据之前的分析，每个`TackleAssembleItemRoot`是一个配件槽Item，其内部结构在之前的文档中已详细说明（包含品质状态控制器、图标、文本等）。

**关键点**：
- 这些Item是**嵌套在Prefab中的子Prefab**，**仅用于编辑器预览**
- **重要**：Prefab中的示例Item会在运行时删除
- 实际运行时通过**EasyObjectPool对象池统一管理**，动态生成和回收
- 对象池按需分配，优化内存使用

---

## 7. 动态内容管理策略

### 7.1 配件槽Item管理（使用对象池）

**重要说明**：Prefab中的预制Item仅用于编辑器预览，运行时会删除。实际使用**EasyObjectPool对象池**统一管理所有配件槽Item。

#### 初始化阶段 - 清理预制Item
```csharp
// TackleAssembleUIController
public override void OnBindFiledsCompleted()
{
    base.OnBindFiledsCompleted();

    // 清理Prefab中的预制Item（仅用于编辑器预览）
    ClearPreviewItems();
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

#### 对象池管理策略
```csharp
// TackleAssembleUIController
private EasyObjectPool<TackleAssembleItemController> m_slotItemPool;

public void InitializeObjectPool(GameObject itemPrefab)
{
    // 初始化对象池
    m_slotItemPool = new EasyObjectPool<TackleAssembleItemController>(
        prefab: itemPrefab,
        parent: m_slotScrollViewContent,
        initialSize: 6,  // 预分配6个
        maxSize: 15      // 最大15个
    );
}

public void SlotListRefresh(List<SlotData> slotDataList)
{
    // 1. 回收所有现有Item到对象池
    foreach (var item in m_slotItemCtrls)
    {
        m_slotItemPool.Release(item);
    }
    m_slotItemCtrls.Clear();

    // 2. 从对象池获取所需数量的Item
    for (int i = 0; i < slotDataList.Count; i++)
    {
        var itemCtrl = m_slotItemPool.Get();
        itemCtrl.FillData(slotDataList[i]);
        RegisterSlotItemEvents(itemCtrl);
        m_slotItemCtrls.Add(itemCtrl);
    }
}

public void OnUITaskStop()
{
    // 释放所有对象池资源
    m_slotItemPool?.Dispose();
}
```

### 7.2 部件选择Item管理（同样使用对象池）
```csharp
private EasyObjectPool<PartSelectionItemController> m_partSelectionItemPool;

public void PartSelectionListRefresh(List<UnitedStoreItemGlobalId> partList)
{
    // 回收现有Item
    foreach (var item in m_partSelectionItemCtrls)
    {
        m_partSelectionItemPool.Release(item);
    }
    m_partSelectionItemCtrls.Clear();

    // 从对象池获取新Item
    foreach (var partId in partList)
    {
        var itemCtrl = m_partSelectionItemPool.Get();
        itemCtrl.FillData(partId);
        RegisterPartItemEvents(itemCtrl);
        m_partSelectionItemCtrls.Add(itemCtrl);
    }
}
```

---

## 8. 顶部Tab切换实现

```csharp
// TackleAssembleUIController
protected override void OnBindFiledsCompleted()
{
    base.OnBindFiledsCompleted();

    // 绑定顶部Tab按钮
    InitializeTopTabButtons();
}

private void InitializeTopTabButtons()
{
    // 获取所有Tab按钮
    m_topTabButtons = m_topTabScrollView.content.GetComponentsInChildren<TackleAssembleTitleButtonController>().ToList();

    // 绑定点击事件
    for (int i = 0; i < m_topTabButtons.Count; i++)
    {
        int index = i;  // 闭包捕获
        m_topTabButtons[i].EventOnClick += () => OnTopTabClick(index);
    }

    // 设置初始选中状态
    SelectTopTab(0);  // 默认选中"装配"Tab
}

private void OnTopTabClick(int tabIndex)
{
    switch (tabIndex)
    {
        case 0:  // 装配Tab
            SelectTopTab(0);
            // 已经在当前界面，无需操作
            break;

        case 1:  // 方案Tab
            SelectTopTab(1);
            // 启动方案管理UITask
            EventOnSchemeTabClick?.Invoke();
            break;

        case 2:  // 改装Tab
            SelectTopTab(2);
            // TODO: 启动改装UITask
            break;
    }
}

private void SelectTopTab(int tabIndex)
{
    for (int i = 0; i < m_topTabButtons.Count; i++)
    {
        m_topTabButtons[i].SetSelected(i == tabIndex);
    }
}
```

---

## 9. 与之前文档的对比修正

### 9.1 主要修正点

| 之前的错误理解 | 实际正确结构 |
|--------------|-------------|
| 使用`AdvanceUIStateController`管理UI状态 | 通过`SetActive`控制`SlotScrollView`和`PartSelectionScrollView`的显示隐藏 |
| Prefab中预制Item可直接使用 | Prefab中预制4个Item**仅用于预览**，运行时会删除，实际使用**EasyObjectPool对象池统一管理** |
| Item容器命名 | 实际容器是`SlotScrollView/Scroll View/Viewport/Content`，部件选择容器是`AssemblyScrollView/TackleRoot` |
| Item容器是`TackleAssembleUIItemRoot/Content` | 实际容器是`SlotScrollView/Scroll View/Viewport/Content` |
| 存在独立的`m_leftStateController` | 实际不存在，只是简单的GameObject显示隐藏 |
| 有独立的返回按钮 | 返回功能可能通过`CloseButton`实现 |

### 9.2 层级路径修正

**配件槽内容容器正确路径**：
```
TackleAssembleRoot
└── Pfb_UI_TackleAssemble_BGPanel
    └── HandButton
        └── AssemblePanelRoot
            └── AssemblePanel
                └── SlotScrollView
                    └── Scroll View
                        └── Viewport
                            └── Content  ← 这里是配件槽Item的父容器
```

**装配列表内容容器正确路径**：
```
TackleAssembleRoot
└── Pfb_UI_TackleAssemble_BGPanel
    └── HandButton
        └── AssemblePanelRoot
            └── AssemblePanel
                └── AssemblyScrollView
                    └── TackleRoot  ← 这里是部件选择Item的父容器
```

---

## 10. 开发Checklist（修订版）

### 10.1 UIController开发
- [ ] 正确绑定所有字段（使用修正后的路径）
- [ ] 实现`SlotListRefresh`方法（支持预制Item管理）
- [ ] 实现`SetToUIState`方法（使用SetActive控制）
- [ ] 实现顶部Tab切换逻辑
- [ ] 注册和清理所有UI事件
- [ ] 实现关闭按钮事件处理

### 10.2 ItemController开发
- [ ] 实现`TackleAssembleItemController.FillData`方法
- [ ] 实现品质状态切换逻辑
- [ ] 实现状态视觉效果
- [ ] 实现点击事件触发

### 10.3 测试验证
- [ ] 验证所有字段绑定路径正确
- [ ] 验证配件槽Item正确显示
- [ ] 验证状态切换正常（SlotScrollView ↔ AssemblyScrollView）
- [ ] 验证顶部Tab切换正常
- [ ] 验证事件触发正常
- [ ] 验证内存无泄漏

---

## 11. 完整路径参考表

| 字段名 | 绑定路径 |
|-------|---------|
| `m_closeButton` | `TackleAssembleRoot/Pfb_UI_TackleAssemble_BGPanel/CloseButton` |
| `m_titleText` | `TackleAssembleRoot/Pfb_UI_TackleAssemble_BGPanel/TopGroup/TackleAssembleTitle` |
| `m_topTabScrollView` | `TackleAssembleRoot/Pfb_UI_TackleAssemble_BGPanel/TopGroup/TopButtonGroup/StoreTitleButtonScrollView` |
| `m_detailPanel` | `TackleAssembleRoot/.../AssemblePanelRoot/DetailPanel` |
| `m_slotScrollView` | `TackleAssembleRoot/.../AssemblePanel/SlotScrollView/Scroll View` |
| `m_slotScrollViewContent` | `TackleAssembleRoot/.../AssemblePanel/SlotScrollView/Scroll View/Viewport/Content` |
| `m_assemblyScrollView` | `TackleAssembleRoot/.../AssemblePanel/AssemblyScrollView` |
| `m_assemblyScrollViewContent` | `TackleAssembleRoot/.../AssemblePanel/AssemblyScrollView/TackleRoot` |

---

**文档版本**：v2.0（修正版）
**创建日期**：2025年
**修订依据**：放大Prefab结构图
**作者**：Claude Code
**审阅状态**：待审阅

**配套文档**：
- `TackleAssembleUITask_Detailed_Functional_Design_v2.md` - 详细功能设计
- `DataFlow_Initialization_Supplement.md` - 初始化流程详解
