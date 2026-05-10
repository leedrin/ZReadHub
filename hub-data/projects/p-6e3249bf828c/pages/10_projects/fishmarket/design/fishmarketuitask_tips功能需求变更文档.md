# FishMarketUITask - 任务鱼Tips功能需求变更文档

**文档版本:** v1.0  
**更新日期:** 2026年2月6日  
**需求类型:** 功能变更  
**相关模块:** FishMarketUITask - 鱼市任务系统  

---

## 1. 变更概述

### 1.1 原需求回顾

原PRD中关于任务鱼标记的需求：
> 1. 符合任务条件的鱼左上角会额外显示**限时热收**
> 2. 如新鲜度为0了，限时热收的标记会置灰，且弹出感叹号，**点击之后**会弹出提示：新鲜度为0时，无法完成限时热收
> 3. 该标记只显示当前正在进行中的任务所需要的鱼，如任务完成且其他正在进行中的任务没有同类鱼，则隐藏该标记

### 1.2 变更内容

本次变更为**交互方式优化**：
- **交互方式**: 从"点击触发"改为"鼠标悬浮触发"
- **显示方式**: 鼠标移动到感叹号标记上 → 自动弹出Tips气泡弹窗
- **关闭方式**: 鼠标移开触发区域 → 自动关闭Tips弹窗
- **快捷键支持**: 显示Tips时不拦截快捷键，仍可进行交互
- **滚轮支持**: 显示Tips时不拦截滚轮操作，仍可滚动列表

---

## 2. 功能需求详细说明

### 2.1 任务鱼标记显示规则

#### 2.1.1 标记显示条件

| 条件 | 显示规则 |
|------|----------|
| **正常任务鱼** | 显示"限时热收"标记，正常颜色 |
| **新鲜度0%的任务鱼** | 标记置灰 + 显示感叹号(!) |
| **非任务鱼** | 隐藏标记 |
| **任务完成且无其他同类任务** | 隐藏标记 |

#### 2.1.2 状态机定义

参考现有实现（FishMarketFishItemUIController.cs）：

```csharp
// 任务鱼标记状态 - 显示（正常颜色）
private const string QuestFishStateName4Show = "Show";

// 任务鱼标记状态 - 隐藏（非任务鱼）
private const string QuestFishStateName4Hide = "Hide";

// 任务鱼标记状态 - 提示（新鲜度为0的任务鱼，置灰+感叹号）
private const string QuestFishStateName4Tip = "Tip";

// 任务鱼标记状态 - 提示选中（可选，用于弹窗显示状态）
private const string QuestFishStateName4TipSelected = "TipSelected";
```

### 2.2 Tips弹窗交互规则

#### 2.2.1 触发方式对比

| 阶段 | 原方案 | 新方案 |
|------|--------|--------|
| **触发** | 鼠标点击感叹号 | 鼠标移入感叹号区域 |
| **关闭** | 点击其他地方或确认 | 鼠标移出感叹号区域 |
| **快捷键** | 需关闭弹窗后才能使用 | 弹窗显示时仍可使用 |
| **滚轮** | 需关闭弹窗后才能滚动 | 弹窗显示时仍可滚动 |

#### 2.2.2 通用悬浮态规范

根据UI规范文档：
1. **显示方式**: 鼠标位移到触发区域
2. **关闭方式**: 鼠标从触发区域移开
3. **快捷键**: 不拦截快捷键，显示提示时仍然可按快捷键进行交互
4. **滚轮**: 不拦截滚轮操作，显示提示时仍然可以滚轮操作

### 2.3 Tips弹窗实现规范

#### 2.3.1 使用TipBubbleUIController

参考实现：`FishingBagQuickAccessUITaskCompMainTofu.m_bubbleTipCtrl`

**初始化代码:**
```csharp
// 在OnEventUIControllerLoadCompleted中初始化
m_bubbleTipCtrl = m_mainUICtrl.GetComponentInChildren<TipBubbleUIController>(true);
if (m_bubbleTipCtrl == null)
{
    Debug.LogError("OnEventUIControllerLoadCompleted::m_bubbleTipCtrl ctrl is null");
}
else
{
    m_bubbleTipCtrl.Init(m_mainLayer, TipsPositionType.Up, TipsPositionType.LeftRight, false, 10, 0);
}
```

**参数说明:**
- `m_mainLayer`: 所属Layer
- `TipsPositionType.Up`: 弹窗显示在目标上方
- `TipsPositionType.LeftRight`: 水平方向自适应
- `false`: 不显示箭头（或使用箭头根据UI资源）
- `10`: 偏移量
- `0`: 额外偏移

#### 2.3.2 显示Tips弹窗

**显示代码:**
```csharp
// 构造Payload
var payload = new TipBubblePanelPayload("新鲜度为0时，无法完成限时热收");

// 显示弹窗（传入目标RectTransform作为锚点）
m_bubbleTipCtrl.PanelShow(payload, arrowRectTransform);

// 启用箭头显示（如果Arrow是独立对象）
if (arrowGameObject != null)
{
    arrowGameObject.SetActive(true);
}
```

#### 2.3.3 关闭Tips弹窗

**关闭代码:**
```csharp
// 关闭弹窗
m_bubbleTipCtrl.OnPanelClose();

// 禁用箭头显示
if (arrowGameObject != null)
{
    arrowGameObject.SetActive(false);
}
```

---

## 3. UI资源规范

### 3.1 预制体结构

#### 3.1.1 Pfb_UI_KeepnetFishListItem（鱼列表项预制体）

**层级结构:**
```
Pfb_UI_KeepnetFishListItem
├── Root
│   ├── ... (其他UI元素)
│   ├── QuestTips (任务鱼标记根节点)
│   │   ├── Root
│   │   │   ├── Image (限时热收背景图)
│   │   │   ├── Text (限时热收文字)
│   │   │   └── TipsGroup (感叹号组)
│   │   │       ├── Image (感叹号图标)
│   │   │       └── Text (可选)
│   │   └── HighLightTips_Dummy (高亮提示虚拟对象)
│   │       └── Arrow (箭头对象) ← **关键对象**
│   └── ... (其他UI元素)
```

**关键对象说明:**
- `HighLightTips_Dummy`: 作为Tips弹窗定位的虚拟对象
- `Arrow`: 箭头对象，需要在Tips显示时enable，关闭时disable

#### 3.1.2 Pfb_UI_Store_HightlightTips（气泡弹窗预制体）

**用途:** 作为TipBubblePanelPayload的内容预制体

**要求:**
- 独立的UI预制体
- 包含背景、文字、箭头（可选）
- 通过TipBubbleUIController动态实例化
- 位置对准Arrow所在位置的上方

### 3.2 状态机配置

在Pfb_UI_KeepnetFishListItem的StateController中配置以下状态:

| 状态名 | 说明 | UI表现 |
|--------|------|--------|
| **Show** | 正常显示 | 限时热收标记正常颜色 |
| **Hide** | 隐藏 | 标记不可见 |
| **Tip** | 新鲜度0% | 标记置灰 + 显示感叹号 |
| **TipSelected** | 可选 | 弹窗显示时的状态（如需要视觉反馈） |

---

## 4. 代码实现规范

### 4.1 架构设计

#### 4.1.1 职责划分

| 层级 | 职责 | 实现文件 |
|------|------|----------|
| **Controller** | 处理鼠标悬浮事件、调用Tofu方法 | FishMarketFishItemUIController.cs |
| **Tofu** | 管理Tips弹窗生命周期、协调多个Item | FishMarketUITaskCompKeeperTofu.cs |
| **Data** | 提供新鲜度、任务鱼标记数据 | FishMarketFishItemInfo |

#### 4.1.2 事件流

```
用户鼠标移入感叹号区域
    ↓
FishMarketFishItemUIController.OnPointerEnter()
    ↓
EventOnFishItemTipsEnter(fishIndex) 事件抛出
    ↓
FishMarketUITaskCompKeeperTofu 接收事件
    ↓
调用 m_bubbleTipCtrl.PanelShow() 显示Tips
    ↓
启用对应Item的Arrow对象

用户鼠标移出感叹号区域
    ↓
FishMarketFishItemUIController.OnPointerExit()
    ↓
EventOnFishItemTipsExit(fishIndex) 事件抛出
    ↓
FishMarketUITaskCompKeeperTofu 接收事件
    ↓
调用 m_bubbleTipCtrl.OnPanelClose() 关闭Tips
    ↓
禁用对应Item的Arrow对象
```

### 4.2 关键代码实现

#### 4.2.1 FishMarketFishItemUIController 变更

**新增接口:**
```csharp
public partial class FishMarketFishItemUIController : ScrollItemBaseUIController, 
    IPointerEnterHandler, IPointerExitHandler
{
    // 新增事件
    public event Action<int> EventOnFishItemTipsEnter;  // 鼠标移入Tips区域
    public event Action<int> EventOnFishItemTipsExit;   // 鼠标移出Tips区域
    
    // Arrow对象引用（从AutoGen获取）
    private GameObject m_arrowObject;
    private RectTransform m_arrowRectTransform;
    
    /// <summary>
    /// 初始化（在OnBindFiledsCompleted中调用）
    /// </summary>
    public void InitArrow()
    {
        // 获取Arrow对象引用
        var highLightTipsDummy = transform.Find("QuestTips/HighLightTips_Dummy");
        if (highLightTipsDummy != null)
        {
            m_arrowObject = highLightTipsDummy.Find("Arrow")?.gameObject;
            m_arrowRectTransform = m_arrowObject?.GetComponent<RectTransform>();
        }
    }
    
    /// <summary>
    /// 鼠标移入事件（IPointerEnterHandler）
    /// </summary>
    public void OnPointerEnter(PointerEventData eventData)
    {
        // 检查是否是新鲜度0%的任务鱼
        if (IsFreshnessZeroTaskFish())
        {
            EventOnFishItemTipsEnter?.Invoke(ItemIndex);
        }
    }
    
    /// <summary>
    /// 鼠标移出事件（IPointerExitHandler）
    /// </summary>
    public void OnPointerExit(PointerEventData eventData)
    {
        EventOnFishItemTipsExit?.Invoke(ItemIndex);
    }
    
    /// <summary>
    /// 设置Arrow显示状态
    /// </summary>
    public void ArrowStateSet(bool show)
    {
        if (m_arrowObject != null)
        {
            m_arrowObject.SetActive(show);
        }
    }
    
    /// <summary>
    /// 获取Arrow的RectTransform（用于Tips定位）
    /// </summary>
    public RectTransform GetArrowRectTransform()
    {
        return m_arrowRectTransform;
    }
    
    /// <summary>
    /// 检查是否是新鲜度0%的任务鱼
    /// </summary>
    private bool IsFreshnessZeroTaskFish()
    {
        // 从当前状态或数据中判断
        // 可根据m_questFishListItemStateController当前状态判断
        return m_questFishListItemStateController?.CurrStateName == QuestFishStateName4Tip;
    }
}
```

#### 4.2.2 FishMarketUITaskCompKeeperTofu 变更

**新增成员:**
```csharp
public class FishMarketUITaskCompKeeperTofu : EFUITaskCompMainTofuBase
{
    // Tips弹窗控制器
    private TipBubbleUIController m_bubbleTipCtrl;
    
    // 当前显示Tips的鱼索引（-1表示无）
    private int m_currentTipsFishIndex = -1;
    
    // Tips内容文本（可从配置读取）
    private const string TipsContentText = "新鲜度为0时，无法完成限时热收";
}
```

**初始化代码（OnEventUIControllerLoadCompleted）:**
```csharp
protected override void OnEventUIControllerLoadCompleted(string uiCtrlName)
{
    if (uiCtrlName == nameof(FishMarketKeeperUIController))
    {
        // ... 现有代码 ...
        
        // 初始化Tips弹窗控制器
        InitBubbleTipCtrl();
    }
}

/// <summary>
/// 初始化气泡Tips控制器
/// </summary>
private void InitBubbleTipCtrl()
{
    if (m_keeperUICtrl == null) return;
    
    m_bubbleTipCtrl = m_keeperUICtrl.GetComponentInChildren<TipBubbleUIController>(true);
    if (m_bubbleTipCtrl == null)
    {
        Debug.LogError("FishMarketKeeperTofu: m_bubbleTipCtrl is null");
        return;
    }
    
    // 初始化：向上显示，水平自适应，不拦截输入
    m_bubbleTipCtrl.Init(
        m_compLayerManager.LayerDescGetByName(FishMarketUITask.KeeperLayerName)?.m_layer,
        TipsPositionType.Up,
        TipsPositionType.LeftRight,
        false,  // 是否有箭头（根据实际UI调整）
        10,     // 偏移量
        0       // 额外偏移
    );
}
```

**事件处理方法:**
```csharp
/// <summary>
/// 注册鱼Item事件（在Grid初始化后）
/// </summary>
private void RegisterFishItemEvents()
{
    // 获取所有活跃的FishItemUIController
    var itemControllers = GetActiveFishItemControllers();
    foreach (var itemCtrl in itemControllers)
    {
        itemCtrl.EventOnFishItemTipsEnter -= OnFishItemTipsEnter;
        itemCtrl.EventOnFishItemTipsEnter += OnFishItemTipsEnter;
        
        itemCtrl.EventOnFishItemTipsExit -= OnFishItemTipsExit;
        itemCtrl.EventOnFishItemTipsExit += OnFishItemTipsExit;
    }
}

/// <summary>
/// 鼠标移入鱼Item Tips区域
/// </summary>
private void OnFishItemTipsEnter(int fishIndex)
{
    // 关闭当前显示的Tips（如果有）
    if (m_currentTipsFishIndex != -1 && m_currentTipsFishIndex != fishIndex)
    {
        CloseCurrentTips();
    }
    
    // 获取对应的ItemController
    var itemCtrl = GetFishItemControllerByIndex(fishIndex);
    if (itemCtrl == null) return;
    
    // 显示Arrow
    itemCtrl.ArrowStateSet(true);
    
    // 显示Tips弹窗
    var payload = new TipBubblePanelPayload(TipsContentText);
    var arrowRect = itemCtrl.GetArrowRectTransform();
    m_bubbleTipCtrl.PanelShow(payload, arrowRect);
    
    m_currentTipsFishIndex = fishIndex;
}

/// <summary>
/// 鼠标移出鱼Item Tips区域
/// </summary>
private void OnFishItemTipsExit(int fishIndex)
{
    if (m_currentTipsFishIndex == fishIndex)
    {
        CloseCurrentTips();
    }
}

/// <summary>
/// 关闭当前Tips
/// </summary>
private void CloseCurrentTips()
{
    if (m_currentTipsFishIndex != -1)
    {
        var itemCtrl = GetFishItemControllerByIndex(m_currentTipsFishIndex);
        itemCtrl?.ArrowStateSet(false);
    }
    
    m_bubbleTipCtrl?.OnPanelClose();
    m_currentTipsFishIndex = -1;
}
```

### 4.3 输入处理规范

#### 4.3.1 不拦截快捷键

TipBubbleUIController的配置已确保不拦截快捷键：
- `Init()`方法的参数控制输入拦截行为
- 默认配置`false`表示不显示遮罩，不拦截输入

#### 4.3.2 不拦截滚轮

确保TipBubblePanel预制体没有以下组件：
- `GraphicRaycaster`（如果有，需设置blockingObjects为None）
- `Canvas`的overrideSorting不要阻挡下层事件

在预制体Pfb_UI_Store_HightlightTips中：
- 移除或禁用`Image`组件的`Raycast Target`勾选（背景图除外）
- 确保ScrollRect的事件可以穿透到下层

---

## 5. 开发任务清单

### 5.1 UI资源任务

- [ ] **Pfb_UI_KeepnetFishListItem 预制体调整**
  - [ ] 确保HighLightTips_Dummy对象存在
  - [ ] 确保Arrow对象是HighLightTips_Dummy的子对象
  - [ ] 配置Arrow对象的初始状态为disable
  - [ ] 配置StateController的4个状态（Show/Hide/Tip/TipSelected）

- [ ] **Pfb_UI_Store_HightlightTips 预制体确认**
  - [ ] 确认预制体可以作为TipBubblePanelPayload内容
  - [ ] 确认不拦截滚轮和快捷键的设置
  - [ ] 确认文字内容为"新鲜度为0时，无法完成限时热收"

### 5.2 代码开发任务

- [ ] **FishMarketFishItemUIController.cs**
  - [ ] 实现IPointerEnterHandler和IPointerExitHandler接口
  - [ ] 添加EventOnFishItemTipsEnter和EventOnFishItemTipsExit事件
  - [ ] 添加InitArrow()方法获取Arrow对象引用
  - [ ] 添加ArrowStateSet()方法控制箭头显示
  - [ ] 添加GetArrowRectTransform()方法获取定位锚点

- [ ] **FishMarketUITaskCompKeeperTofu.cs**
  - [ ] 添加m_bubbleTipCtrl成员变量
  - [ ] 添加InitBubbleTipCtrl()初始化方法
  - [ ] 添加RegisterFishItemEvents()事件注册方法
  - [ ] 实现OnFishItemTipsEnter()和OnFishItemTipsExit()事件处理
  - [ ] 实现CloseCurrentTips()关闭方法

- [ ] **FishMarketFishItemUIController.AutoGen.cs**（如有）
  - [ ] 确保Arrow对象的SerializedField声明
  - [ ] 确保QuestTips相关对象绑定

### 5.3 测试验证任务

- [ ] **功能测试**
  - [ ] 新鲜度0%的任务鱼显示置灰标记和感叹号
  - [ ] 鼠标移入感叹号区域，Tips弹窗正确显示
  - [ ] 鼠标移出感叹号区域，Tips弹窗自动关闭
  - [ ] Arrow对象在Tips显示时enable，关闭时disable

- [ ] **交互测试**
  - [ ] Tips显示时，快捷键（如ESC、Space）仍可正常使用
  - [ ] Tips显示时，滚轮可以滚动鱼护列表
  - [ ] 鼠标在多个感叹号之间快速移动，Tips正确切换
  - [ ] 快速移入移出，无异常或内存泄漏

- [ ] **边界测试**
  - [ ] 鱼护列表滚动时，Tips定位仍然准确
  - [ ] 列表项回收复用时，事件正确注销和重新注册
  - [ ] UITask关闭时，Tips正确关闭，无残留

---

## 6. 参考代码

### 6.1 参考实现: FishingBagQuickAccessUITaskCompMainTofu

**文件路径:**
`F:/ProjectEF/Client/TargetProject/Assets/GameProject/Scripts/Runtime/GameView/UI/FishingBagQuickAccessUITask/Comp/FishingBagQuickAccessUITaskCompMainTofu.cs`

**关键代码片段:**
```csharp
// 行213-221: 初始化m_bubbleTipCtrl
m_bubbleTipCtrl = m_mainUICtrl.GetComponentInChildren<TipBubbleUIController>(true);
if (m_bubbleTipCtrl == null)
{
    Debug.LogError("OnEventUIControllerLoadCompleted::m_bubbleTipCtrl ctrl is null");
}
else
{
    m_bubbleTipCtrl.Init(m_mainLayer, TipsPositionType.Up, TipsPositionType.LeftRight, false, 10, 0);
}

// 行670: 显示Tips
m_bubbleTipCtrl.PanelShow(new TipBubblePanelPayload(StoreUIHelper.ItemBubbleNameContentGet(itemInfo)),
    itemUICtrl.transform as RectTransform);
itemUICtrl.ArrowStateSet(true);

// 行692: 关闭Tips
m_bubbleTipCtrl.OnPanelClose();
itemUICtrl.ArrowStateSet(false);
```

### 6.2 参考实现: FishMarketFishItemUIController

**文件路径:**
`F:/ProjectEF/Client/TargetProject/Assets/GameProject/Scripts/Runtime/GameView/UI/FishMarketUITask/Controller/FishMarketFishItemUIController.cs`

**现有任务鱼状态机代码:**
```csharp
// 行167-203: QuestFishMarkStateUpdate方法
protected void QuestFishMarkStateUpdate(FishMarketFishItemInfo fishInfo)
{
    if (m_questFishListItemStateController == null) return;
    
    if (!fishInfo.m_isTaskFish)
    {
        m_questFishListItemStateController.SetToUIState(QuestFishStateName4Hide);
        return;
    }
    
    float freshnessPercent = fishInfo.m_healthPercent <= 0 ? 0 : fishInfo.m_healthPercent * 100;
    
    if (freshnessPercent <= 0)
    {
        // 新鲜度为0的任务鱼：显示Tip状态
        m_questFishListItemStateController.SetToUIState(QuestFishStateName4Tip);
    }
    else
    {
        // 正常任务鱼：显示标记
        m_questFishListItemStateController.SetToUIState(QuestFishStateName4Show);
    }
}
```

---

## 7. 附录

### 7.1 UI层级图

```
FishMarketUITask
├── FishMarketQuestUIController (任务列表)
├── FishMarketKeeperUIController (鱼护列表)
│   └── LoopScrollRect
│       └── FishMarketFishItemUIController[] (鱼Item列表)
│           └── QuestTips (任务鱼标记)
│               ├── Image (限时热收背景)
│               ├── Text (限时热收文字)
│               └── TipsGroup (感叹号组)
│                   └── Arrow (箭头 - 用于Tips定位)
│
├── TipBubbleUIController (气泡弹窗控制器)
│   └── Pfb_UI_Store_HightlightTips (动态实例化)
│       └── Text (提示文字)
│
└── FishMarketSellConfirmUIController (售卖确认)
```

### 7.2 状态转换图

```
                    是任务鱼?
                   /          \
                  /            \
                是              否
               /                 \
              ↓                   ↓
    新鲜度 > 0%?              [Hide状态]
   /           \
  /             \
是               否
↓                ↓
[Show状态]    [Tip状态]
                ↓
         鼠标移入感叹号
                ↓
         显示Tips弹窗
                ↓
         鼠标移出感叹号
                ↓
         关闭Tips弹窗
                ↓
           [Tip状态]
```

### 7.3 术语表

| 术语 | 说明 |
|------|------|
| **Tips/气泡弹窗** | 鼠标悬浮时显示的提示信息框 |
| **限时热收** | 任务鱼标记的文字内容 |
| **感叹号/!标记** | 新鲜度0%时显示的警告图标 |
| **Arrow** | 指向鱼Item的箭头对象，用于Tips定位 |
| **HighLightTips_Dummy** | 虚拟对象，作为Arrow的父级容器 |
| **TipBubbleUIController** | 气泡弹窗管理器 |
| **TipBubblePanelPayload** | 气泡弹窗内容数据载体 |
| **StateController** | UI状态机控制器 |
| **IPointerEnterHandler** | Unity UI鼠标移入事件接口 |
| **IPointerExitHandler** | Unity UI鼠标移出事件接口 |

---

**文档结束**

**维护记录:**
- v1.0 (2026-02-06): 初始版本，基于UI需求变更创建
