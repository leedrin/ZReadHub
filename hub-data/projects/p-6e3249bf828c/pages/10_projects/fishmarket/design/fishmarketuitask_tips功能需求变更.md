# FishMarketUITask - 任务鱼提示弹窗功能需求变更文档

**文档版本:** 1.0  
**更新日期:** 2026年2月6日  
**变更类型:** 交互方式优化 + 新增气泡提示  
**相关模块:** FishMarketUITask / FishMarketFishItemUIController  

---

## 1. 变更概述

### 1.1 原需求
任务鱼标记的交互方式为**点击触发**：
- 新鲜度为0的任务鱼显示"限时热收"标记置灰 + 感叹号
- **点击**感叹号后弹出提示："新鲜度为0时，无法完成限时热收"
- 点击其他地方关闭弹窗

### 1.2 新需求
交互方式改为**悬浮触发**：
- 新鲜度为0的任务鱼显示"限时热收"标记置灰 + 感叹号
- **鼠标移动到**感叹号上自动弹出TipBubble气泡弹窗
- **鼠标移开**自动关闭气泡弹窗
- 气泡弹窗使用`TipBubblePanelPayload` + `TipBubbleUIController`实现
- 快捷键不拦截、滚轮操作不拦截

---

## 2. 详细需求规格

### 2.1 显示规则

| 条件 | 限时热收标记 | 感叹号 | 气泡提示 |
|------|-------------|--------|----------|
| 任务鱼 + 新鲜度 > 0% | 正常显示 | 不显示 | 不显示 |
| 任务鱼 + 新鲜度 = 0% | 置灰显示 | **显示** | 悬浮时显示 |
| 非任务鱼 | 隐藏 | 不显示 | 不显示 |
| 任务已完成且无其他同类任务 | 隐藏 | 不显示 | 不显示 |

### 2.2 交互规则

#### 2.2.1 悬浮触发机制
```
鼠标移入感叹号区域
    ↓
触发内部鼠标悬停检测（如Button的onHover等）
    ↓
检查: 当前状态是否为"Tip"? (新鲜度为0的任务鱼)
    - 是:
        → 调用 OnEventQuestTipHoverStart()
        → 抛出 EventOnFishItemQuestTipHoverStart?.Invoke(this)
        ↓
[FishMarketKeeperUIController 接收事件]
    ↓
转发事件到 Tofu 层
        → EventOnFishItemQuestTipHoverStart?.Invoke(ctrl)
        ↓
[FishMarketUITaskCompKeeperTofu 处理事件]
    ↓
        → 调用 m_bubbleTipCtrl.PanelShow(payload, arrowRect)
        → 调用 itemCtrl.ArrowStateSet(true)
        → 记录 m_currentTipsFishIndex
    - 否: 不处理
```

#### 2.2.2 移出关闭机制
```
鼠标移出感叹号区域
    ↓
触发内部鼠标悬停检测（如Button的onHover等）
    ↓
调用 OnEventQuestTipHoverEnd()
    → 抛出 EventOnFishItemQuestTipHoverEnd?.Invoke(this)
    ↓
[FishMarketKeeperUIController 接收事件]
    ↓
转发事件到 Tofu 层
    → EventOnFishItemQuestTipHoverEnd?.Invoke(ctrl)
    ↓
[FishMarketUITaskCompKeeperTofu 处理事件]
    ↓
    → 调用 m_bubbleTipCtrl.OnPanelClose()
    → 调用 itemCtrl.ArrowStateSet(false)
    → 重置 m_currentTipsFishIndex = -1
```

#### 2.2.3 快捷键要求
- **不拦截快捷键**: 气泡弹窗显示时，玩家仍可使用快捷键进行交互
- **不拦截滚轮**: 气泡弹窗显示时，玩家仍可进行滚轮操作
- **配置方式**: 在`TipBubbleUIController.Init()`中设置`blockInput = false`

---

## 3. UI资源规格

### 3.1 Prefab结构

#### Pfb_UI_KeepnetFishListItem (鱼列表项预制体)
```
Root
├── ... (其他UI组件)
├── QuestTips (任务鱼标记根节点)
│   ├── Root
│   │   ├── Image (限时热收图标)
│   │   ├── TextImage (文字背景)
│   │   └── TipsGroup
│   │       ├── Image (图标)
│   │       └── Text (文字)
│   └── **HighlightTips_Dummy** (新增/已有)
│       └── **Arrow** (箭头对象)
│           └── Pfb_UI_Store_HightlightTips (独立气泡弹窗)
```

#### Pfb_UI_Store_HightlightTips (气泡弹窗预制体)
- **类型**: 独立的TipBubblePanel
- **位置**: 相对于Arrow对象的上方
- **内容**: Text组件显示"新鲜度为0时，无法完成限时热收"
- **层级**: 在TipLayer中显示

### 3.2 Arrow对象控制

| 状态 | Arrow.visible | 说明 |
|------|---------------|------|
| 弹窗关闭 | **false** | 默认状态，箭头隐藏 |
| 弹窗显示 | **true** | 气泡弹出时，箭头显示作为指示器 |

---

## 4. 代码实现规格

### 4.1 参考实现模式

参考`FishingBagQuickAccessUITaskCompMainTofu`中的`m_bubbleTipCtrl`实现：

```csharp
// 1. 初始化 (OnEventUIControllerLoadCompleted)
m_bubbleTipCtrl = m_mainUICtrl.GetComponentInChildren<TipBubbleUIController>(true);
if (m_bubbleTipCtrl == null)
{
    Debug.LogError("OnEventUIControllerLoadCompleted::m_bubbleTipCtrl ctrl is null");
}
else
{
    // 参数说明: Layer, 主方向(上), 依赖方向(左右), 忽略边距, 主偏移, 依赖偏移
    m_bubbleTipCtrl.Init(m_mainLayer, TipsPositionType.Up, TipsPositionType.LeftRight, false, 10, 0);
}

// 2. 显示弹窗 (悬浮时)
m_bubbleTipCtrl.PanelShow(
    new TipBubblePanelPayload("新鲜度为0时，无法完成限时热收"),
    arrowRectTransform  // Arrow对象的RectTransform
);
itemUICtrl.ArrowStateSet(true);  // 显示箭头

// 3. 关闭弹窗 (移出时)
m_bubbleTipCtrl.OnPanelClose();
itemUICtrl.ArrowStateSet(false);  // 隐藏箭头
```

### 4.2 需要修改的文件

#### 4.2.1 FishMarketKeeperUIController.cs
**新增:**
- `TipBubbleUIController`类型的成员变量`m_bubbleTipCtrl`
- 在`OnBindFiledsCompleted()`中初始化`m_bubbleTipCtrl`
- 在`OnPoolObjectCreated()`中将`m_bubbleTipCtrl`传递给每个FishItemController

#### 4.2.2 FishMarketFishItemUIController.cs
**参考 `FishingBagInventoryUIController` 事件冒泡模式:**

**新增事件 (供Tofu订阅):**
```csharp
/// <summary>
/// 鱼Item感叹号标记鼠标悬停开始事件
/// </summary>
public event Action<UIControllerBase> EventOnFishItemQuestTipHoverStart;

/// <summary>
/// 鱼Item感叹号标记鼠标悬停结束事件
/// </summary>
public event Action<UIControllerBase> EventOnFishItemQuestTipHoverEnd;
```

**新增方法 (内部调用，抛出事件给Tofu):**
```csharp
/// <summary>
/// 感叹号标记鼠标悬停开始 - 由内部事件触发，冒泡到Tofu处理
/// </summary>
private void OnEventQuestTipHoverStart()
{
    // 检查当前是否为"Tip"状态（新鲜度为0的任务鱼）
    if (m_questFishListItemStateController?.CurrStateName == QuestFishStateName4Tip)
    {
        EventOnFishItemQuestTipHoverStart?.Invoke(this);
    }
}

/// <summary>
/// 感叹号标记鼠标悬停结束 - 由内部事件触发，冒泡到Tofu处理
/// </summary>
private void OnEventQuestTipHoverEnd()
{
    EventOnFishItemQuestTipHoverEnd?.Invoke(this);
}

    /// <summary>
    /// 设置Arrow显示状态 (由Tofu调用)
    /// </summary>
    public void ArrowStateSet(bool visible)
    {
        if (m_arrowGameObject != null)
        {
            m_arrowGameObject.SetActive(visible);
        }
    }
    
    // ===== 事件冒泡处理 (Controller只抛出事件，不直接处理UI逻辑) =====
    
    /// <summary>
    /// 感叹号标记鼠标悬停开始 - 内部调用，抛出事件给Tofu
    /// 说明: 由内部鼠标事件检测调用(如Button的onHover等)，然后冒泡到Tofu处理
    /// </summary>
    private void OnEventQuestTipHoverStart()
    {
        // 检查当前是否为"Tip"状态（新鲜度为0的任务鱼）
        if (m_questFishListItemStateController?.CurrStateName == QuestFishStateName4Tip)
        {
            // 抛出事件给Tofu，由Tofu统一控制气泡显示
            EventOnFishItemQuestTipHoverStart?.Invoke(this);
            Debug.Log($"FishItem [{ItemIndex}]: Hover start, event bubbled to Tofu");
        }
    }
    
    /// <summary>
    /// 感叹号标记鼠标悬停结束 - 内部调用，抛出事件给Tofu
    /// </summary>
    private void OnEventQuestTipHoverEnd()
    {
        // 抛出事件给Tofu，由Tofu统一控制气泡关闭
        EventOnFishItemQuestTipHoverEnd?.Invoke(this);
        Debug.Log($"FishItem [{ItemIndex}]: Hover end, event bubbled to Tofu");
    }
}
    }
    
    // ===== 事件冒泡处理 (Controller只抛出事件，不直接处理UI逻辑) =====
    
    /// <summary>
    /// 感叹号标记鼠标悬停开始 - 内部调用，抛出事件给Tofu
    /// 说明: 由内部鼠标事件检测调用(如Button的onHover等)，然后冒泡到Tofu处理
    /// </summary>
    private void OnEventQuestTipHoverStart()
    {
        // 检查当前是否为"Tip"状态（新鲜度为0的任务鱼）
        if (m_questFishListItemStateController?.CurrStateName == QuestFishStateName4Tip)
        {
            // 抛出事件给Tofu，由Tofu统一控制气泡显示
            EventOnFishItemQuestTipHoverStart?.Invoke(this);
            Debug.Log($"FishItem [{ItemIndex}]: Hover start, event bubbled to Tofu");
        }
    }
    
    /// <summary>
    /// 感叹号标记鼠标悬停结束 - 内部调用，抛出事件给Tofu
    /// </summary>
    private void OnEventQuestTipHoverEnd()
    {
        // 抛出事件给Tofu，由Tofu统一控制气泡关闭
        EventOnFishItemQuestTipHoverEnd?.Invoke(this);
        Debug.Log($"FishItem [{ItemIndex}]: Hover end, event bubbled to Tofu");
    }
}
}
```

**新增字段:**
```csharp
private GameObject m_arrowGameObject;  // Arrow对象引用
// 注意: 不需要在Controller中持有m_bubbleTipCtrl，由Tofu统一管理
```

**重要说明:** 
- **Controller层不直接处理Tip显示/关闭**，只抛出事件给Tofu
- 事件会冒泡到 `FishMarketUITaskCompKeeperTofu`，由Tofu统一控制 `m_bubbleTipCtrl`
- 这样符合BJFramework的 **Controller→Tofu 事件冒泡架构**

#### 4.2.3 FishMarketKeeperUIController.gen.cs (或自动生成文件)
**新增绑定:**
```csharp
// 在FishItem的prefab中查找Arrow对象
protected GameObject m_arrowGameObject;
// 在OnBindFiledsCompleted中添加绑定
m_arrowGameObject = transform.Find("QuestTips/HighlightTips_Dummy/Arrow").gameObject;
```

### 4.3 状态机更新

现有的`QuestFishMarkStateUpdate`方法保持不变，但需要新增悬浮事件处理：

```csharp
// 当前状态: "Tip" - 新鲜度为0的任务鱼
// 行为:
// - 显示置灰的限时热收标记
// - 显示感叹号(可交互区域)
// - 鼠标悬浮时触发TipBubble显示
```

---

## 5. 数据结构

### 5.1 无需变更的数据结构
- `FishMarketFishItemInfo` - 保持不变
- `FishMarketQuestData` - 保持不变
- `QuestState` - 保持不变

### 5.2 可能新增的配置
```csharp
// 提示文本配置 (建议放入配置表)
public const string FreshnessZeroTipContent = "新鲜度为0时，无法完成限时热收";

// 位置偏移配置
public const float TipBubbleMainOffset = 10f;  // 上方偏移量
public const float TipBubbleRelayOffset = 0f;  // 左右偏移量
```

---

## 6. 事件流

### 6.1 悬浮显示流程 (事件冒泡模式)
```
[用户操作] 鼠标移入感叹号区域
    ↓
触发内部鼠标悬停检测（如Button的onHover等）
    ↓
检查: 当前状态是否为"Tip"? (新鲜度为0的任务鱼)
    - 是:
        → 调用 OnEventQuestTipHoverStart()
        → 抛出 EventOnFishItemQuestTipHoverStart?.Invoke(this)
        ↓
[FishMarketKeeperUIController 接收事件]
    ↓
转发事件到 Tofu 层
        → EventOnFishItemQuestTipHoverStart?.Invoke(ctrl)
        ↓
[FishMarketUITaskCompKeeperTofu 处理事件]
    ↓
        → 调用 m_bubbleTipCtrl.PanelShow(payload, arrowRect)
        → 调用 itemCtrl.ArrowStateSet(true)
        → 记录 m_currentTipsFishIndex
    - 否: 不处理
```

### 6.2 移出关闭流程 (事件冒泡模式)
```
[用户操作] 鼠标移出感叹号区域
    ↓
触发内部鼠标悬停检测（如Button的onHover等）
    ↓
调用 OnEventQuestTipHoverEnd()
    → 抛出 EventOnFishItemQuestTipHoverEnd?.Invoke(this)
    ↓
[FishMarketKeeperUIController 接收事件]
    ↓
转发事件到 Tofu 层
    → EventOnFishItemQuestTipHoverEnd?.Invoke(ctrl)
    ↓
[FishMarketUITaskCompKeeperTofu 处理事件]
    ↓
    → 调用 m_bubbleTipCtrl.OnPanelClose()
    → 调用 itemCtrl.ArrowStateSet(false)
    → 重置 m_currentTipsFishIndex = -1
```

### 6.3 事件冒泡架构说明

**遵循 BJFramework Controller→Tofu 事件冒泡模式:**

| 层级 | 职责 | 实现 |
|------|------|------|
| **Controller** | 检测鼠标事件，抛出事件给上层 | `EventOnFishItemQuestTipHoverStart/End` |
| **KeeperController** | 转发事件到Tofu | 订阅Item事件，转发给Tofu |
| **Tofu** | 统一管理气泡显示/关闭 | 控制 `m_bubbleTipCtrl`，调用 `ArrowStateSet` |

**优势:**
1. **架构统一**: 符合BJFramework事件冒泡设计
2. **职责清晰**: Controller只负责检测和通知，Tofu负责业务逻辑
3. **易于管理**: Tofu统一管理所有Item的气泡状态，避免冲突
4. **UITask关闭时**: 只需在Tofu层关闭一次，无需遍历所有Item

---

## 7. 快捷键与滚轮处理

### 7.1 不拦截快捷键
在`TipBubbleUIController.Init()`中的第5个参数设置为`false`：
```csharp
m_bubbleTipCtrl.Init(
    m_mainLayer,              // UI Layer
    TipsPositionType.Up,      // 主方向: 上方
    TipsPositionType.LeftRight, // 依赖方向: 左右自适应
    false,                    // **不忽略边距**
    10,                       // 主偏移: 10像素
    0                         // 依赖偏移: 0像素
);
```

**注意**: 参数`ignoreMargin`设置为`false`确保不拦截底层输入。

### 7.2 不拦截滚轮
`TipBubbleUIController`默认不拦截滚轮事件，无需额外配置。
滚轮事件由`LoopVerticalScrollRect`正常处理。

---

## 8. 边界情况处理

### 8.1 鱼列表滚动时
- **场景**: 用户在气泡显示时滚动鱼护列表
- **处理**: 鱼项被回收时自动触发悬浮结束事件，关闭气泡
- **实现**: 在`OnDisable`或`OnDestroy`中确保抛出悬浮结束事件

### 8.2 切换排序时
- **场景**: 用户切换排序类型
- **处理**: 列表刷新，所有气泡自动关闭
- **实现**: `FishMarketKeeperUIController.GridDataRefresh()`时清理

### 8.3 任务状态变化时
- **场景**: 任务完成/刷新，任务鱼标记状态变化
- **处理**: 刷新后不再显示感叹号，气泡自然关闭
- **实现**: `QuestFishMarkStateUpdate()`中控制

### 8.4 鼠标快速移入移出
- **场景**: 用户快速滑过多个感叹号
- **处理**: 确保前一个气泡关闭后再显示新的
- **实现**: `TipBubbleUIController`内部管理单例显示

### 8.5 UITask关闭时 ⚠️ **重要**
- **场景**: 玩家关闭鱼市界面（ESC/点击关闭按钮/完成任务等）
- **风险**: 如果Tips弹窗未关闭，会残留在其他界面或场景上
- **处理**: 必须在UITask停止时强制关闭所有Tips弹窗
- **实现**: 在`FishMarketUITaskCompKeeperTofu.OnUITaskStop()`中关闭气泡

**代码实现:**
```csharp
public override void OnUITaskStop()
{
    // 关闭Tips气泡弹窗，防止残留在其他界面
    if (m_bubbleTipCtrl != null)
    {
        m_bubbleTipCtrl.OnPanelClose();
        Debug.Log("FishMarketKeeperTofu: Closed bubble tip on UITask stop");
    }
    
    // 清理当前记录的Tips状态
    m_currentTipsFishIndex = -1;
    
    // 注销事件（原有逻辑）
    if (m_keeperUICtrl != null)
    {
        // ... 原有注销逻辑
    }
    
    base.OnUITaskStop();
}
```

---

## 9. 实现步骤

### Step 1: UI资源准备
1. 确认`Pfb_UI_KeepnetFishListItem`中`HighlightTips_Dummy/Arrow`结构正确
2. 确认`Pfb_UI_Store_HightlightTips`预制体配置正确
3. 在`FishMarketKeeperUIController`的prefab中添加`TipBubbleUIController`组件

### Step 2: 代码修改 - Controller层
**文件**: `FishMarketFishItemUIController.cs`

参考 `FishingBagInventoryUIController` 事件冒泡模式:

1. 添加`EventOnFishItemQuestTipHoverStart`事件（悬浮开始，冒泡到Tofu）
2. 添加`EventOnFishItemQuestTipHoverEnd`事件（悬浮结束，冒泡到Tofu）
3. 添加`m_arrowGameObject`字段绑定（用于定位和显示箭头）
4. 添加`ArrowStateSet()`方法（供Tofu调用显示/隐藏箭头）
5. 添加`OnEventQuestTipHoverStart/End()`内部方法（检测状态并抛出事件）
6. **注意**: Controller不直接实现IPointerEnter/Exit接口，不直接控制气泡显示

### Step 3: 代码修改 - Keeper层
**文件**: `FishMarketKeeperUIController.cs`

1. 添加`m_bubbleTipCtrl`成员变量
2. 在`OnBindFiledsCompleted()`中初始化`m_bubbleTipCtrl`
3. 在`OnPoolObjectCreated()`中绑定Arrow对象给FishItemController
4. **订阅Item悬浮事件并转发到Tofu**（参考FishingBagInventoryUIController模式）
5. 在`GridDataRefresh()`中清理所有气泡

### Step 4: 代码修改 - Tofu层
**文件**: `FishMarketUITaskCompKeeperTofu.cs`

1. 确保`QuestFishMarkStateUpdate()`正确设置"Tip"状态
2. **重要**: 在`OnUITaskStop()`中添加Tips弹窗关闭逻辑，防止界面关闭后气泡残留
3. 添加`CloseAllBubbleTips()`辅助方法用于强制清理

**必须实现:**
```csharp
public override void OnUITaskStop()
{
    // 关闭Tips气泡弹窗，防止残留在其他界面
    CloseAllBubbleTips();
    
    // 原有注销逻辑...
    base.OnUITaskStop();
}

private void CloseAllBubbleTips()
{
    if (m_bubbleTipCtrl != null)
    {
        m_bubbleTipCtrl.OnPanelClose();
        m_currentTipsFishIndex = -1;
        Debug.Log("FishMarketKeeperTofu: All bubble tips closed");
    }
}
```

### Step 5: 测试验证
1. **功能测试**: 悬浮显示/移出关闭是否正常
2. **边界测试**: 快速滑动、列表滚动、排序切换
3. **快捷键测试**: 气泡显示时快捷键是否可用
4. **滚轮测试**: 气泡显示时滚轮是否正常
5. **状态测试**: 任务完成、新鲜度变化时状态是否正确
6. **UITask关闭测试**: 
   - 气泡显示时关闭鱼市，确认气泡不残留
   - ESC关闭、点击关闭按钮、任务完成自动关闭等场景

---

## 10. 代码示例

### 10.1 FishMarketFishItemUIController 新增代码

**注意: 采用事件冒泡模式，Controller不直接处理IPointerEnter/Exit接口，通过内部事件冒泡到Tofu处理**

```csharp
public partial class FishMarketFishItemUIController : ScrollItemBaseUIController
{
    // ===== 新增字段 =====
    private GameObject m_arrowGameObject;           // Arrow对象（由Tofu传入）
    
    // ===== 新增事件 (供Tofu订阅) =====
    
    /// <summary>
    /// 鱼Item感叹号标记鼠标悬停开始事件
    /// 由Tofu订阅，Tofu统一控制气泡显示
    /// </summary>
    public event Action<UIControllerBase> EventOnFishItemQuestTipHoverStart;
    
    /// <summary>
    /// 鱼Item感叹号标记鼠标悬停结束事件
    /// 由Tofu订阅，Tofu统一控制气泡关闭
    /// </summary>
    public event Action<UIControllerBase> EventOnFishItemQuestTipHoverEnd;
    
    // ===== 新增公共方法 =====
    
    /// <summary>
    /// 设置Arrow对象（由KeeperUIController在对象池创建时调用）
    /// </summary>
    public void ArrowGameObjectSet(GameObject arrowGo)
    {
        m_arrowGameObject = arrowGo;
        // 初始状态隐藏
        if (m_arrowGameObject != null)
        {
            m_arrowGameObject.SetActive(false);
        }
    }
    
    /// <summary>
    /// 设置Arrow显示状态
    /// </summary>
    public void ArrowStateSet(bool visible)
    {
        if (m_arrowGameObject != null)
        {
            m_arrowGameObject.SetActive(visible);
        }
    }
    
    // ===== 事件冒泡处理 (Controller只抛出事件，不直接处理UI逻辑) =====
    
    /// <summary>
    /// 感叹号标记鼠标悬停开始 - 内部调用，抛出事件给Tofu
    /// 说明: 由内部鼠标事件检测调用(如Button的onHover等)，然后冒泡到Tofu处理
    /// </summary>
    private void OnEventQuestTipHoverStart()
    {
        // 检查当前是否为"Tip"状态（新鲜度为0的任务鱼）
        if (m_questFishListItemStateController?.CurrStateName == QuestFishStateName4Tip)
        {
            // 抛出事件给Tofu，由Tofu统一控制气泡显示
            EventOnFishItemQuestTipHoverStart?.Invoke(this);
            Debug.Log($"FishItem [{ItemIndex}]: Hover start, event bubbled to Tofu");
        }
    }
    
    /// <summary>
    /// 感叹号标记鼠标悬停结束 - 内部调用，抛出事件给Tofu
    /// </summary>
    private void OnEventQuestTipHoverEnd()
    {
        // 抛出事件给Tofu，由Tofu统一控制气泡关闭
        EventOnFishItemQuestTipHoverEnd?.Invoke(this);
        Debug.Log($"FishItem [{ItemIndex}]: Hover end, event bubbled to Tofu");
    }
}
```

### 10.2 FishMarketKeeperUIController 修改代码

```csharp
public partial class FishMarketKeeperUIController
{
    // ===== 新增字段 =====
    private TipBubbleUIController m_bubbleTipCtrl;
    
    // ===== 修改 OnBindFiledsCompleted =====
    protected override void OnBindFiledsCompleted()
    {
        base.OnBindFiledsCompleted();
        
        // ... 原有代码 ...
        
        // 初始化气泡控制器
        m_bubbleTipCtrl = GetComponentInChildren<TipBubbleUIController>(true);
        if (m_bubbleTipCtrl == null)
        {
            Debug.LogError("FishMarketKeeperUIController: m_bubbleTipCtrl is null");
        }
        else
        {
            m_bubbleTipCtrl.Init(m_mainLayer, TipsPositionType.Up, TipsPositionType.LeftRight, false, 10, 0);
        }
    }
    
    // ===== 修改 OnPoolObjectCreated =====
    protected void OnPoolObjectCreated(string poolName, GameObject go)
    {
        if (poolName == FishItemPoolName || poolName == KeepnetItemPoolName)
        {
            var itemCtrl = go.GetComponent<FishMarketFishItemUIController>();
            if (itemCtrl != null)
            {
                itemCtrl.Init(itemCtrl);
                itemCtrl.EventOnUIItemNeedFill += OnItemNeedFill;
                itemCtrl.EventOnUIItemClick += OnItemClick;
                
                // 新增: 绑定Arrow对象
                var arrowGo = go.transform.Find("QuestTips/HighlightTips_Dummy/Arrow")?.gameObject;
                if (arrowGo != null)
                {
                    itemCtrl.ArrowGameObjectSet(arrowGo);
                }
                else
                {
                    Debug.LogWarning($"FishMarketKeeperUIController: Arrow not found in {go.name}");
                }
                
                // 新增: 订阅Item悬浮事件并转发到Tofu层
                // 参考FishingBagInventoryUIController事件冒泡模式
                itemCtrl.EventOnFishItemQuestTipHoverStart -= OnFishItemQuestTipHoverStart;
                itemCtrl.EventOnFishItemQuestTipHoverStart += OnFishItemQuestTipHoverStart;
                
                itemCtrl.EventOnFishItemQuestTipHoverEnd -= OnFishItemQuestTipHoverEnd;
                itemCtrl.EventOnFishItemQuestTipHoverEnd += OnFishItemQuestTipHoverEnd;
            }
        }
    }
    
    // ===== 新增: 转发Item悬浮事件到Tofu =====
    
    /// <summary>
    /// 转发Item悬浮开始事件到Tofu
    /// </summary>
    private void OnFishItemQuestTipHoverStart(UIControllerBase ctrl)
    {
        // 转发事件到Tofu层处理
        (m_owner as FishMarketUITaskCompKeeperTofu)?.OnFishItemQuestTipHoverStart(ctrl);
    }
    
    /// <summary>
    /// 转发Item悬浮结束事件到Tofu
    /// </summary>
    private void OnFishItemQuestTipHoverEnd(UIControllerBase ctrl)
    {
        // 转发事件到Tofu层处理
        (m_owner as FishMarketUITaskCompKeeperTofu)?.OnFishItemQuestTipHoverEnd(ctrl);
    }
}
```

### 10.3 FishMarketUITaskCompKeeperTofu 新增代码 (事件处理)

**订阅Item事件并控制气泡显示:**

```csharp
public partial class FishMarketUITaskCompKeeperTofu : EFUITaskCompMainTofuBase
{
    // ===== 新增字段 =====
    private TipBubbleUIController m_bubbleTipCtrl;
    private int m_currentTipsFishIndex = -1;  // 当前显示Tips的鱼索引
    
    // ===== 事件订阅 (在OnEventUIControllerLoadCompleted中) =====
    
    /// <summary>
    /// 注册鱼Item悬浮事件
    /// </summary>
    private void RegisterFishItemHoverEvents()
    {
        // 获取所有活跃的FishItemUIController
        var itemControllers = GetActiveFishItemControllers();
        foreach (var itemCtrl in itemControllers)
        {
            // 订阅Item的悬浮事件
            itemCtrl.EventOnFishItemQuestTipHoverStart -= OnFishItemQuestTipHoverStart;
            itemCtrl.EventOnFishItemQuestTipHoverStart += OnFishItemQuestTipHoverStart;
            
            itemCtrl.EventOnFishItemQuestTipHoverEnd -= OnFishItemQuestTipHoverEnd;
            itemCtrl.EventOnFishItemQuestTipHoverEnd += OnFishItemQuestTipHoverEnd;
        }
    }
    
    /// <summary>
    /// 鱼Item感叹号标记悬浮开始事件处理
    /// </summary>
    private void OnFishItemQuestTipHoverStart(UIControllerBase ctrl)
    {
        if (ctrl is not FishMarketFishItemUIController itemCtrl) return;
        
        int fishIndex = itemCtrl.ItemIndex;
        
        // 如果当前已有其他Item的Tips显示，先关闭
        if (m_currentTipsFishIndex != -1 && m_currentTipsFishIndex != fishIndex)
        {
            CloseCurrentTips();
        }
        
        // 显示Tips
        ShowFreshnessZeroTip(itemCtrl);
        m_currentTipsFishIndex = fishIndex;
    }
    
    /// <summary>
    /// 鱼Item感叹号标记悬浮结束事件处理
    /// </summary>
    private void OnFishItemQuestTipHoverEnd(UIControllerBase ctrl)
    {
        if (ctrl is not FishMarketFishItemUIController itemCtrl) return;
        
        int fishIndex = itemCtrl.ItemIndex;
        
        // 只关闭当前显示的Tips
        if (m_currentTipsFishIndex == fishIndex)
        {
            CloseCurrentTips();
        }
    }
    
    /// <summary>
    /// 显示新鲜度为0的提示气泡
    /// </summary>
    private void ShowFreshnessZeroTip(FishMarketFishItemUIController itemCtrl)
    {
        if (m_bubbleTipCtrl == null) return;
        
        var arrowRect = itemCtrl.GetArrowRectTransform();
        if (arrowRect == null) return;
        
        // 显示气泡
        var payload = new TipBubblePanelPayload("新鲜度为0时，无法完成限时热收");
        m_bubbleTipCtrl.PanelShow(payload, arrowRect);
        
        // 显示箭头
        itemCtrl.ArrowStateSet(true);
        
        Debug.Log($"FishMarketKeeperTofu: Show tip for fish [{itemCtrl.ItemIndex}]");
    }
    
    /// <summary>
    /// 关闭当前Tips
    /// </summary>
    private void CloseCurrentTips()
    {
        if (m_bubbleTipCtrl == null) return;
        
        // 关闭气泡
        m_bubbleTipCtrl.OnPanelClose();
        
        // 隐藏对应Item的Arrow
        if (m_currentTipsFishIndex != -1)
        {
            var itemCtrl = GetFishItemControllerByIndex(m_currentTipsFishIndex);
            itemCtrl?.ArrowStateSet(false);
        }
        
        m_currentTipsFishIndex = -1;
    }
    
    // ===== UITask停止时关闭气泡 =====
    
    public override void OnUITaskStop()
    {
        // **重要**: 关闭Tips气泡弹窗，防止残留在其他界面
        CloseAllBubbleTips();
        
        // 注销事件（原有逻辑）
        if (m_keeperUICtrl != null)
        {
            m_keeperUICtrl.EventOnItemClick -= EventOnItemClick;
            // ... 其他事件注销
        }
        
        base.OnUITaskStop();
    }
    
    /// <summary>
    /// 关闭所有气泡提示
    /// </summary>
    private void CloseAllBubbleTips()
    {
        CloseCurrentTips();
        Debug.Log("FishMarketKeeperTofu: All bubble tips closed");
    }
}
```

---

## 11. 关联文档

- **PRD**: `FishmarketUITask_PRD_标注版.md`
- **设计文档**: `FishMarketPhase2_数据流设计.md`
- **代码审核**: `FishMarketUITask_代码审核报告.md`
- **参考实现**: `FishingBagQuickAccessUITaskCompMainTofu.cs`

---

## 12. 附录

### 12.1 状态常量定义
```csharp
// 已存在于 FishMarketFishItemUIController.cs
private const string QuestFishStateName4Show = "Show";           // 正常显示
private const string QuestFishStateName4Hide = "Hide";           // 隐藏
private const string QuestFishStateName4Tip = "Tip";             // 新鲜度为0提示状态
private const string QuestFishStateName4TipSelected = "TipSelected"; // (原点击状态，现可能不需要)
```

### 12.2 预制体路径
```
Assets/GameProject/UI/Prefabs/FishMarket/
├── Pfb_UI_KeepnetFishListItem.prefab
│   └── QuestTips/HighlightTips_Dummy/Arrow
└── Pfb_UI_Store_HightlightTips.prefab
```

---

**文档结束**

**维护记录:**
- 2026.02.06: 初版创建 - 整合需求变更、参考实现、代码规格
