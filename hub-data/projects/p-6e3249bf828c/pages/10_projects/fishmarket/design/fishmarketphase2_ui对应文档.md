# 鱼市二期 - UI Prefab 对应文档

## 文档概述

本文档详细分析了鱼市二期 UI Prefab 的结构、功能、开发优先级以及与一期 Prefab 的差异对比。

**文档版本**: 1.0  
**创建日期**: 2026-02-03  
**对应 PRD**: FishmarketUITask_PRD_标注版  
**对应设计方案**: FishMarketPhase2_开发设计方案

---

## 一、Prefab 分类总览

### 1.1 Prefab 列表

| Prefab 类型 | 文件名 | 版本 | 说明 |
|-----------|--------|------|------|
| **二期新 Prefab** | Pfb_UI_FishMarket_A1.prefab | Phase 2 | 完整的二期鱼市 UI Prefab |
| | | Pfb_UI_KeepnetFishListltem_A1.prefab | Phase 2 | 鱼护列表项 Prefab（二期） |
| | | Pfb_UI_FishMarketQuestGroup_A1.prefab | Phase 2 | 任务组 Prefab（二期） |
| | | Pfb_UI_FishMarketQuestltem_A1.prefab | Phase 2 | 任务列表项 Prefab（二期） |
| **一期 Prefab** | Pfb_UI_FishMarketQuestGroup.prefab | Phase 1 | 任务组 Prefab（一期） |
| | | Pfb_UI_FishMarketQuestltem.prefab | Phase 1 | 任务列表项 Prefab（一期） |
| | | Pfb_UI_KeepnetFishListltem.prefab | Phase 1 | 鱼护列表项 Prefab（一期） |
| | | Pfb_UI_KeepnetFishList.prefab | Phase 1 | 鱼护列表 Prefab（一期） |
| | | Pfb_UI_KeepnetItem.prefab | Phase 1 | 鱼护项 Prefab（一期） |
| | | Pfb_UI_FishMarket_Sell.prefab | Phase 1 | 售卖确认界面 Prefab（一期） |
| | | Pfb_UI_FishMarket_Sell_PriceItem.prefab | Phase 1 | 售卖价格项 Prefab（一期） |
| | | Pfb_UI_FishMarketQuest.prefab | Phase 1 | 任务整体 Prefab（一期） |
| | | Pfb_UI_FishMarket.prefab | Phase 1 | 鱼市主界面 Prefab（一期） |

---

## 二、二期新 Prefab 详细分析

### 2.1 Pfb_UI_FishMarket_A1.prefab

**功能**: 完整的二期鱼市主界面

**核心组件结构**：
```
Root (FishMarketUI)
├── BGGroup
│   ├── TopBG (顶部背景）
│   │   ├── Text_FishMarket ("鱼市"标题)
│   │   ├── IconImg_FishMarket (鱼市图标)
│   │   ├── Line01 (分割线)
│   │   ├── Anjiao01 (暗角装饰)
│   │   ├── Anjiao02 (按钮装饰)
│   │   ├── IconImg_TimeLimit (倒计时图标，二期新增)
│   │   └── Water01-05 (水动画图)
│   ├── KeepnetFishListRoot (鱼护列表根节点，一期已有）
├── FishMarketQuestGroupRoot (任务组根节点，二期新增)
└── CoinGroup (货币组)
│   ├── GoldCoin (金币图标)
│   ├── SilverCoin (银币图标)
└── BottomBG (底部背景)
```

**二期新增元素**：
1. **QuestGroupRoot**: 任务组根节点，用于容纳任务组
2. **倒计时图标**: 显示任务剩余时间（IconImg_TimeLimit）
3. **水动画**: Water01-05，用于任务刷新或任务完成的视觉反馈

**与一期 Pfb_UI_FishMarket.prefab 的对比**：
| 特性 | 一期 | 二期 (_A1) | 变更说明 |
|------|------|---------|---------|---------|
| 任务组支持 | X | O | 二期新增任务组区域 |
| 倒计时图标 | X | O | 二期新增倒计时显示元素 |
| 任务刷新动画 | X | O | 二期新增刷新时的动效支持 |

**关键实现要点**：

#### 主界面初始化流程

```csharp
// FishMarketUITask 主 Tofu 中的初始化
public override void ViewUpdate(IUITaskUpdatePipelineController pipelineCtrl)
{
    if (IsUITaskUpdatePipelineInitOrResume())
    {
        // 初始化任务控制器
        m_questUICtrl?.Initialize(m_compQuestTofu.QuestDataListGet(), 
            m_compDynamicResourceCacheManager.DynamicResCacheDictGet());
        
        // 初始化鱼护控制器
        m_keeperUICtrl?.Initialize(m_compKeeperTofu.FishListGet(), 
            m_compDynamicResourceCacheManager.DynamicResCacheDictGet());
    }
}
```

#### 主界面组件对应关系

| Prefab 节点 | 对应 UIController | 对应 Tofu | 关键方法 |
|------------|----------------|-------------|---------|
| FishMarketQuestGroupRoot | FishMarketQuestUIController | QuestTofu | Initialize, RefreshQuestList |
| KeepnetFishListRoot | FishMarketKeeperUIController | KeeperTofu | Initialize, RefreshFishList |

---

### 2.2 Pfb_UI_KeepnetFishListltem_A1.prefab

**功能**: 鱼护列表项 Prefab（二期版本）

**预期组件结构**：
```
KeepnetFishltem (鱼护列表项)
├── IconImg (鱼图标)
├── Text_FishName (鱼名称)
├── Text_FishWeight (鱼重量)
├── Text_FishPrice (鱼价格)
├── Text_FishFreshness (新鲜度)
├── IconImg_QuestMark (任务标记，二期新增)
```

**与一期 Pfb_UI_KeepnetFishListltem.prefab 的对比**：
| 特性 | 一期 | 二期 (_A1) | 变更说明 |
|------|------|---------|---------|---------|
| 鱼图标 | O | O | 基础鱼图标保持不变 |
| 鱼名称 | O | O | 鱼名称显示 |
| 鱼重量 | O | O | 鱼重量显示 |
| 鱼价格 | O | O | 鱼价格显示 |
| 新鲜度 | O | O | 新鲜度显示 |
| **任务标记** | X | O | **二期新增**：限时热收图标 |
| 任务图标选择 | X | O | **二期优化**：根据重量条件显示不同体型图标 |

**二期开发重点**：
- 添加 `IconImg_QuestMark` 显示限时热收图标
- 支持图标选择逻辑：有重量条件→最小体型，无重量→成年体
- 新鲜度0%时，任务标记置灰并显示感叹号提示

**关键实现要点**：

#### 任务鱼标记更新逻辑

```csharp
// KeeperTofu 中的任务鱼标记更新
public void QuestFishMarkUpdate()
{
    // 获取当前任务需要的鱼ID集合
    var questFishIds = m_compQuestTofu?.GetQuestFishIds() ?? new HashSet<int>();
    
    // 遍历所有鱼护项
    foreach (var fishItem in m_fishItemControllers)
    {
        var fishData = fishItem.FishDataGet();
        if (fishData == null) continue;
        
        // 检查是否是任务鱼
        bool isQuestFish = questFishIds.Contains(fishData.m_fishId);
        
        // 检查新鲜度是否为0%
        bool isFreshnessZero = fishData.m_freshness <= 0;
        
        // 更新任务标记显示
        fishItem.QuestMarkVisibleSet(isQuestFish);
        
        // 新鲜度为0%时，标记置灰并禁用交互
        if (isQuestFish && isFreshnessZero)
        {
            fishItem.QuestMarkGraySet(true);
        }
        else
        {
            fishItem.QuestMarkGraySet(false);
        }
    }
}
```

#### 任务鱼图标选择逻辑

```csharp
// 获取任务鱼图标路径（根据重量条件）
private string GetQuestFishIconPath(int fishId, int minWeightRequired)
{
    var fishConf = ConfigDataManager.Instance.ConfigDataFishInfoGetById(fishId);
    if (fishConf == null) return string.Empty;
    
    // 有重量条件使用最小体型图标，无重量使用成年体图标
    if (minWeightRequired > 0)
    {
        return fishConf.IconPathForMinWeight; // 最小体型
    }
    else
    {
        return fishConf.IconPathForAdult; // 成年体
    }
}
```

#### 新鲜度0%提示

```csharp
// UIController 中的任务标记点击事件
private void OnQuestMarkClicked()
{
    var fishData = m_currentFishData;
    if (fishData != null && fishData.m_freshness <= 0)
    {
        // 弹出提示：新鲜度为0%时，无法完成限时热收
        ShowTips("新鲜度为0%时，无法完成限时热收");
        return;
    }
    
    // 正常选中逻辑
    ToggleFishSelection();
}
```

---

### 2.3 Pfb_UI_FishMarketQuestGroup_A1.prefab

**功能**: 任务组 Prefab（二期新增）

**核心组件结构**：
```
FishMarketQuestGroupRoot (任务组根节点)
├── LeftPanel (左侧面板)
│   ├── Pfb_UIl_FishMarketQuest (内部任务列表容器)
│   │   ├── Content (内容区域)
│   │   │   └── Pfb_UI_KeepnetFishList (鱼护列表容器)
│   │   │       ├── Pfb_UI_KeepnetFishListltem (鱼护列表项)
│   │   │       └── Pfb_UI_KeepnetFishListltem_A1 (二期任务列表项)
│   │   │       └── ...
│   │   │   └── Pfb_UI_KeepnetFishList (分隔线)
│   │   │   └── QuestltemRoot (任务列表根节点)
│   │   │       ├── Pfb_UI_FishMarketQuestltem (一期任务项）
│   │   │       ├── Pfb_UI_FishMarketQuestltem_A1 (二期任务项)
│   │   │       └── ...
│   │   ├── Scroll View (滚动视图)
│   │   ├── IconImg_TimeLimit (倒计时图标，二期新增)
│   │   ├── QuestTips (任务提示)
│   │   ├── Line01 (分割线)
│   ├── Line01 (左侧分割线)
│   ├── BottomBG (底部背景)
│   └── QuestTips (任务提示)
```

**与一期 Pfb_UI_FishMarketQuestGroup.prefab 的对比**：
| 特性 | 一期 | 二期 (_A1) | 变更说明 |
|------|------|---------|---------|---------|
| 任务列表容器 | O (QuestltemRoot) | O (QuestltemRoot) | 结构保持一致 |
| 任务项 | Pfb_UI_FishMarketQuestltem | Pfb_UI_FishMarketQuestltem_A1 | 二期优化版本 |
| 鱼护列表 | X | O | 二期新增鱼护列表功能（任务排序、自动选中） |
| **倒计时图标** | X | O | **二期新增**：任务剩余时间显示 |
| 滚动视图 | O | O | 保持一致的滚动功能 |
| 任务提示 | X | O | 任务提示功能 |

**二期开发重点**：
- 集成 LoopScrollRect 和 EasyObjectPool 实现任务列表滚动
- 实现倒计时图标的实时更新（在 Update 中计算）
- 支持任务点击后的鱼护列表联动（自动排序、自动选中）
- 实现 8个任务栏位的显示和刷新

**关键实现要点**：

#### 任务列表对象池初始化

```csharp
// FishMarketQuestUIController 中的对象池初始化
protected void PoolCreate(string poolName)
{
    if (m_isPoolInit || m_easyObjectPool == null)
    {
        return;
    }

    // 绑定预制体控制器
    var poolInfoList = m_easyObjectPool.poolInfo;
    if (poolInfoList == null || poolInfoList.Length == 0)
    {
        Debug.LogError("FishMarketQuestUIController: Pool info is empty");
        return;
    }

    // 从资源容器获取预制体
    var asset = poolInfoList[0].prefab;
    var template = Instantiate(asset, transform, false);
    PrefabControllerCreater.CreateAllControllers(template);
    FrameworkUnityUtil.SetGameObjectActive(template, false);

    // 设置对象池预制体
    var poolInfo = m_easyObjectPool.GetPoolInfoByName(poolName);
    if (poolInfo != null)
    {
        poolInfo.prefab = template;
    }

    // 监听对象创建事件
    m_easyObjectPool.EventOnPoolObjectCreated += OnPoolObjectCreated;

    // 创建对象池（poolSize=12，可显示8个任务栏位）
    m_easyObjectPool.CreatePools();

    m_isPoolInit = true;
}
```

#### 任务列表刷新实现

```csharp
// FishMarketQuestUIController 中的刷新实现
public void RefreshQuestList()
{
    if (m_loopScrollRect == null)
    {
        Debug.LogWarning("FishMarketQuestUIController: LoopScrollRect is null");
        return;
    }

    // 使用保持位置的刷新方法
    m_loopScrollRect.RefillCellsWithKeepingContentAnchoredPosition(
        m_loopScrollRect.StartItemIndex);
     
    // 刷新完成后，如果是首次加载，立即完成Fade动画
    if (m_isFirstLoad)
    {
        Fade(0, true); // FadeIn，立即完成
        m_isFirstLoad = false;
    }
}
```

#### 任务点击事件处理

```csharp
// FishMarketQuestUIController 中的任务点击事件
protected void OnQuestItemClick(UIControllerBase ctrl)
{
    var itemCtrl = ctrl as FishMarketQuestItemUIController;
    if (itemCtrl != null)
    {
        Debug.Log($"FishMarketQuestUIController: Quest item {itemCtrl.ItemIndex} clicked");
        // 抛出事件给 Tofu 处理
        EventOnQuestClick?.Invoke(itemCtrl.ItemIndex);
    }
}
```

#### LoopScrollRect 配置参数

| 参数 | 值 | 说明 |
|------|-----|------|
| Cell Size | (440, 180) | 单个任务项尺寸 |
| Spacing | (40, 24) | 任务项间距 |
| Padding | (62, 28, 30) | 内边距 |
| Constraint | 1 | 固定列数 |
| poolSize | 12 | 对象池大小（可显示8个任务栏位） |

---

### 2.4 Pfb_UI_FishMarketQuestltem_A1.prefab

**功能**: 任务列表项 Prefab（二期版本）

**预期组件结构**：
```
Questltem (任务项)
├── QuestltemRoot (任务项根节点)
│   ├── IconImg_Fish (任务鱼图标)
│   ├── Text_FishName (鱼名称)
│   ├── Text_FishWeight (鱼重量)
│   ├── Text_FishPrice (鱼价格)
│   ├── Text_FishFreshness (新鲜度)
│   ├── Text_Progress (进度文本："当前/目标"）
│   ├── Text_Countdown (倒计时文本："天/小时"）
│   ├── Button_Claim (领取按钮)
│   ├── IconImg_TimeLimit (倒计时图标，变红时显示)
│   ├── QuestTips (任务提示)
└── Text_Description (任务描述)
```

**与一期 Pfb_UI_FishMarketQuestltem.prefab 的对比**：
| 特性 | 一期 | 二期 (_A1) | 变更说明 |
|------|------|---------|---------|---------|
| 鱼图标 | O | O | 基础鱼图标，二期根据重量显示不同体型 |
| 鱼名称 | O | O | 鱼名称显示 |
| 鱼重量 | O | O | 鱼重量显示 |
| 鱼价格 | O | O | 鱼价格显示 |
| 新鲜度 | O | O | 新鲜度显示 |
| **进度文本** | X | O | **二期新增**：进度显示（当前/目标） |
| **倒计时文本** | X | O | **二期新增**：倒计时显示（天/小时） |
| **倒计时图标** | X | O | **二期新增**：倒计时图标，最后30分钟变红 |
| **领取按钮** | O | O | 领取奖励按钮（状态切换） |
| **任务描述** | X | O | **二期新增**：任务描述文本（如"售卖10条大于40kg的鲈鱼"） |
| **任务提示** | X | O | 任务提示信息（如"限时热收"） |
| 状态切换 | O | O | 进行中 → 待领取 → 已领取 |

**二期开发重点**：
- 实现四种任务状态切换：InProgress、CompleteWaitClaim、Claimed、Locked
- 实现倒计时实时更新和30分钟变红逻辑
- 实现任务进度更新（售卖时增加进度）
- 实现任务描述的动态显示（根据配置生成）
- 实现任务提示的显示和隐藏逻辑

**关键实现要点**：

#### 任务显示更新

```csharp
// FishMarketQuestItemUIController 中的任务显示更新
public void UpdateShow(FishMarketQuestData questData, 
    IReadOnlyDictionary<string, UnityEngine.Object> resDictionary = null)
{
    if (questData == null)
    {
        return;
    }

    m_currentQuestData = questData;

    // 更新鱼名称
    if (m_fishNameText != null)
    {
        m_fishNameText.text = questData.m_requiredFishName;
    }

    // 更新鱼图标
    if (m_fishIcon != null && resDictionary != null && !string.IsNullOrEmpty(questData.m_requiredFishIconPath))
    {
        if (resDictionary.TryGetValue(questData.m_requiredFishIconPath, out var iconObj))
        {
            var sprite = iconObj as UnityEngine.Sprite;
            if (sprite != null)
            {
                m_fishIcon.sprite = sprite;
            }
        }
    }
     
    // 更新任务条件描述
    if (m_questDescText != null)
    {
        string conditionText = $"出售 {questData.m_requiredCount} 条";
         
        // 如果有重量要求，添加重量条件
        if (questData.m_minWeightRequired > 0)
        {
            float weightInKg = questData.m_minWeightRequired / 1000f;
            conditionText += $"（≥{weightInKg:F2}kg）";
        }
         
        m_questDescText.text = conditionText;
    }

    // 更新进度显示
    if (m_questProgressText != null)
    {
        m_questProgressText.text = $"{questData.m_currentProgress}/{questData.m_requiredCount}";
    }

    // 更新倒计时显示
    if (m_countdownText != null)
    {
        UpdateCountdownDisplay(questData.m_remainingSeconds);
    }

    // 更新奖励显示（银币）
    if (m_rewardText != null)
    {
        m_rewardText.text = $"{questData.m_rewardSilverCoin}";
    }

    // 根据任务状态更新按钮显示
    UpdateButtonsState(questData.m_state);
}
```

#### 倒计时显示更新

```csharp
// FishMarketQuestItemUIController 中的倒计时更新
public void UpdateCountdownDisplay(float remainingSeconds)
{
    if (m_countdownText == null)
    {
        return;
    }

    // 倒计时归0或过期
    if (remainingSeconds <= 0)
    {
        m_countdownText.text = "已过期";
        m_countdownText.color = Color.red;
        return;
    }

    // 转换为时分秒
    int hours = Mathf.FloorToInt(remainingSeconds / 3600f);
    int minutes = Mathf.FloorToInt((remainingSeconds % 3600f) / 60f);
    int seconds = Mathf.FloorToInt(remainingSeconds % 60f);

    // 显示格式：小时:分钟:秒
    m_countdownText.text = $"{hours:D2}:{minutes:D2}:{seconds:D2}";

    // 最后30分钟变红
    if (remainingSeconds <= 30 * 60)
    {
        m_countdownText.color = Color.red;
    }
    else
    {
        m_countdownText.color = Color.white;
    }
}
```

#### 任务状态按钮更新

```csharp
// FishMarketQuestItemUIController 中的按钮状态更新
protected void UpdateButtonsState(QuestState state)
{
    switch (state)
    {
        case QuestState.Locked:
            // 显示解锁按钮
            m_questStatusStateController.SetToUIState("Lock");
            break;

        case QuestState.InProgress:
            // 进行中状态
            m_questStatusStateController.SetToUIState("Normal");
            break;

        case QuestState.Claimable:
            // 显示领取按钮
            m_questStatusStateController.SetToUIState("Award");
            break;

        case QuestState.Completed:
            // 已完成显示
            m_questStatusStateController.SetToUIState("Finish");
            break;
    }
}
```

#### 淡入淡出动画

```csharp
// FishMarketQuestItemUIController 中的 Fade 动画
public void Fade(int fadeType, bool immediateComplete = false)
{
    if (m_fadeStateController == null)
    {
        Debug.LogWarning("FishMarketQuestItemUIController.Fade: m_fadeStateController is null");
        return;
    }

    if (fadeType == 0)
    {
        // FadeIn
        if (immediateComplete)
        {
            m_fadeStateController.SetToUIState("FadeIn", true);
            UpdateButtonsState(m_currentQuestData.m_state);
            m_questQualityStateController.SetToUIState("Blue");
        }
        else
        {
            m_fadeStateController.SetToUIState("FadeIn");
            UpdateButtonsState(m_currentQuestData.m_state);
            m_questQualityStateController.SetToUIState("Blue");
        }
    }
    else
    {
        // FadeOut
        if (immediateComplete)
        {
            m_fadeStateController.SetToUIState("FadeOut", true);
        }
        else
        {
            m_fadeStateController.SetToUIState("FadeOut");
        }
    }
}
```

---

## 三、功能对应关系与开发优先级

### 3.1 核心功能模块对应表

| 功能模块 | 涉及 Prefab | 对应 PRD 章节 | 对应设计文档章节 | 开发优先级 |
|---------|---------|-----------|------------------|------------|
| **主界面** | Pfb_UI_FishMarket_A1.prefab | Sheet: 界面逻辑 | 第6章 UI设计 | P0 |
| **鱼护功能** | Pfb_UI_KeepnetFishList_A1.prefab<br>Pfb_UI_KeepnetFishListltem_A1.prefab | Sheet: 界面逻辑 - 鱼护部分 | 第6.1 节点，第6.3节鱼护 | P0 |
| **任务组功能** | Pfb_UI_FishMarketQuestGroup_A1.prefab<br>Pfb_UI_FishMarketQuestltem_A1.prefab | Sheet: 界面逻辑 - 右侧任务 | 第6.2 节点，第6.4节任务组 | P0 |
| **任务列表项** | Pfb_UI_FishMarketQuestltem_A1.prefab | Sheet: 界面逻辑 - 任务列表项 | 第6.1.1 节点 | P0 |
| **任务数据接入** | Pfb_UI_FishMarket_A1.prefab | Sheet: 数据结构 | 第3章 数据设计 | P0 |
| **倒计时系统** | Pfb_UI_FishMarketQuestltem_A1.prefab<br>Pfb_UI_FishMarketQuestGroup_A1.prefab | Sheet: 倒计时系统设计 | 第5章 倒计时系统 | P0 |
| **任务状态切换** | Pfb_UI_FishMarketQuestltem_A1.prefab | Sheet: 界面逻辑 - 任务状态 | 第4.1 节点 | P0 |
| **奖励领取** | Pfb_UI_FishMarketQuestltem_A1.prefab | Sheet: 界面逻辑 - 奖励领取 | 第4.2 节点 | P0 |

### 3.2 开发优先级说明

#### P0 - 核心功能（必须完成）

1. **任务数据接入**
   - **对应 Prefab**: `Pfb_UI_FishMarket_A1.prefab`
   - **开发内容**:
     - 从逻辑层获取任务列表数据
     - 通过配置ID查询配置表获取任务描述、鱼图标等信息
     - 转换为 UI 层数据结构
   - **涉及文件**:
     - `FishMarketUITaskCompQuestTofu.cs`
     - `PlayerGameObjectCompFishMarketQuestClient.cs` (已存在）
     - `FishMarketQuestInfo` (数据结构）
     - `ConfigDataFishMarketQuestInfo` (配置表）
   - **相关文档**:
     - [[FishMarketPhase2_开发设计方案#6. 鱼市任务显示流程]]

2. **8个任务栏位显示**
   - **对应 Prefab**: `Pfb_UI_FishMarketQuestGroup_A1.prefab`
   - **开发内容**:
     - 实现任务组的 UI 布局（左右布局）
     - 实现任务列表的滚动显示（LoopScrollRect + EasyObjectPool）
     - 支持对象池复用（12个任务栏位）
   - **涉及文件**:
     - `FishMarketQuestGroupUIController.cs`
     - `FishMarketQuestItemUIController.cs` (Pfb_UI_FishMarketQuestltem_A1.prefab)
   - `Pfb_UI_FishMarketQuestltem.cs` (一期已有)
   - **相关文档**:
     - [[FishMarketPhase2_开发设计方案#6. UI设计]]

3. **任务状态切换**
   - **对应 Prefab**: `Pfb_UI_FishMarketQuestltem_A1.prefab`
   - **开发内容**:
     - 实现四种任务状态：InProgress、CompleteWaitClaim、Claimed、Locked
     - 实现状态切换逻辑（售卖增加进度、时间到期刷新、点击领取）
     - 实现完成和领取的动画表现
   - **涉及文件**:
     - `FishMarketQuestItemUIController.cs`
   - `FishMarketQuestState.cs` (枚举)
   - **相关文档**:
     - [[FishMarketPhase2_开发设计方案#4.1 任务状态流转]]

4. **倒计时系统**
   - **对应 Prefab**: `Pfb_UI_FishMarketQuestltem_A1.prefab`<br>`Pfb_UI_FishMarketQuestGroup_A1.prefab`
   - **开发内容**:
     - 在 `QuestItemUIController.Update` 中实现倒计时计算
     - 使用 `GetCurrentGameTime()` 获取服务器时间
     - 实现最后30分钟变红逻辑
     - 显示格式：天/小时、小时/分、分/秒
   - **涉及文件**:
     - `FishMarketQuestItemUIController.cs`
     - `QuestTofu.cs` (事件处理)
   - **相关文档**:
     - [[FishMarketPhase2_开发设计方案#5. 倒计时系统设计]]

5. **奖励领取流程**
   - **对应 Prefab**: `Pfb_UI_FishMarketQuestltem_A1.prefab`
   - **开发内容**:
     - 实现点击领取按钮的逻辑
     - 发送 `FishMarketQuestCompleteReqNetTask` 请求
     - 处理奖励发放
     - 播放奖励领取动画
   - **涉及文件**:
     - `FishMarketUITaskCompMainTofu.cs`
     - `FishMarketQuestCompleteReqNetTask.cs`
     - `FishMarketQuestCompleteAck.cs`
   - **相关文档**:
     - [[FishMarketPhase2_开发设计方案#4.2 奖励领取流程]]

#### P1 - 体验优化（建议完成）

1. **任务悬浮态排序**
   - **对应 Prefab**: `Pfb_UI_FishMarketQuestGroup_A1.prefab`
   - **开发内容**:
     - 点击任务栏时自动进入多选模式
     - 自动选中满足任务条件的鱼
     - 满足任务的鱼自动排到鱼护最前
     - 排序自动切换为任务排序
   - **涉及文件**:
     - `FishMarketUITaskCompQuestTofu.cs`
     - `FishMarketUITaskCompKeeperTofu.cs`
   - **相关文档**:
     - [[FishMarketPhase2_开发设计方案#4.4 任务鱼排序]]

2. **任务完成动效**
   - **对应 Prefab**: `Pfb_UI_FishMarketQuestltem_A1.prefab`
   - **任务描述**: "进度达成时播放完成动画"
   - **开发内容**:
     - 任务进度达成时播放完成动画
     - 切换任务状态到"完成待领取"
     - 播放动画效果
   - **涉及文件**:
     - `FishMarketQuestItemUIController.cs`
     - `FishMarketQuestItemUIProcess.cs` (UIProcess)
   - **相关文档**:
     - [[FishMarketPhase2_开发设计方案#7. PipelineUpdateMask设计]]

3. **刷新动效**
   - **对应 Prefab**: `Pfb_UI_FishMarketQuestGroup_A1.prefab`
   - **任务描述**: "新任务刷新时的动效表现"
   - **开发内容**:
     - 任务刷新时播放刷新动效
     - 使用 `PlayQuestRefreshAnim` Mask 控制
     - **涉及文件**:
     - `FishMarketQuestUIController.cs`
     - `FishMarketQuestGroupUIController.cs`
     - `FishMarketQuestGroupUIProcess.cs` (UIProcess)
   - **相关文档**:
     - [[FishMarketPhase2_开发设计方案#4.5 任务刷新流程]]

4. **任务鱼标记**
   - **对应 Prefab**: `Pfb_UI_KeepnetFishListltem_A1.prefab`
   - **任务描述**: "鱼护中标记满足条件的鱼"
   - **开发内容**:
     - 在鱼护列表项中显示限时热收图标
     - 根据任务条件（鱼种ID、重量）筛选显示
     - 新鲜度0%时，标记置灰并显示感叹号提示
     - 任务完成后隐藏标记
   - **涉及文件**:
     - `FishMarketUITaskCompKeeperTofu.cs`
     - `KeepnetFishItemUIController.cs`
     - `FishMarketUITaskCompQuestTofu.cs` (提供任务鱼ID列表）
     - **相关文档**:
     - [[FishMarketPhase2_开发设计方案#9.1 任务鱼标记逻辑]]

#### P2 - 边界处理（需要处理）

1. **跨关卡检测**
   - **对应 Prefab**: `Pfb_UI_KeepnetFishListltem_A1.prefab`
   - **任务描述**: "仅当前关卡钓获有效"
   - **开发内容**:
     - 检查鱼的钓获关卡 ID
     - 只计算当前关卡任务钓获的鱼
     - 跨关卡的鱼不计入任务进度
   - **涉及文件**:
     - `PlayerGameObjectCompFishMarketQuestClient.cs` (已有)
     - `FishMarketUITaskCompQuestTofu.cs`
     - `KeepnetFishItemUIController.cs`
     - **相关文档**:
     - [[FishMarketPhase2_开发设计方案#9.2 条件判定逻辑]]

2. **新鲜度处理**
   - **对应 Prefab**: `Pfb_UI_KeepnetFishListltem_A1.prefab`
   - **任务描述**: "新鲜度0%可售卖但不计任务"
   - **开发内容**:
     - 新鲜度到达 0% 时显示为红色
     - 任务标记置灰（如果满足任务条件）
     - 点击任务标记弹出提示：新鲜度为0%时，无法完成限时热收
   - **涉及文件**:
     - `KeepnetFishItemUIController.cs`
     - `FishMarketUITaskCompKeeperTofu.cs`
     - **相关文档**:
     - [[FishMarketPhase2_开发设计方案#9.3 新鲜度处理]]

3. **邮件补发奖励**
   - **对应 Prefab**: `Pfb_UI_FishMarketQuestltem_A1.prefab`
   - **任务描述**: "未领取奖励通过邮件补发"
   - **开发内容**:
     - 任务到期时奖励未领取
     - 通过邮件系统发送奖励
     - 刷新任务后，未领取奖励标记清除
   - **涉及文件**:
     - `FishMarketUITaskCompQuestTofu.cs`
     - `MailSystemController.cs`
     - **相关文档**:
     - [[FishMarketPhase2_开发设计方案#4.5 任务刷新流程]]

---

## 四、关键技术实现要点

### 4.1 阶层交互设计

#### 4.1.1 QuestTofu 与 KeeperTofu 的协作

```
QuestTofu (任务Tofu)
├── GetQuestDataList(): 从逻辑层获取任务列表
├── OnQuestClick(): 处理任务点击事件
│   ├── NotifyKeeperTofu(): 通知 KeeperTofu 切换排序
│   │   └── FishMarketQuestSortType: 任务排序
│   │   └── SortFishList(): 按任务排序重新排序列表
│   │   └── AutoSelectQuestFish(): 自动选中满足条件的鱼
└── OnQuestRefreshNtf(): 监听服务器刷新事件
│   └── QuestDataCacheUpdate(): 刷新任务数据
│   ├── GetQuestFishIds(): 获取任务鱼ID列表（供 KeeperTofu 标记）
│   └── OnQuestFishSold(fishIds): 卖出任务鱼，更新任务进度
```

#### 4.1.2 KeeperTofu 鱼护列表处理

```
KeeperTofu (鱼护Tofu)
├── UpdateContextSetup(): 从 paramDict 读取任务信息
├── FishListSort(): 根据当前排序类型排序列表
├── AutoSelectQuestFish(): 自动选中任务鱼
├── QuestFishMarkUpdate(): 更新任务鱼标记
└── OnQuestClick(questIndex): 点击任务栏时的处理
```

#### 4.1.3 任务点击与鱼护排序联动实现

```csharp
// QuestTofu 中处理任务点击事件
private void OnQuestClick(int questIndex)
{
    // 获取任务数据
    var questData = m_questDataList[questIndex];
    if (questData.m_state != QuestState.InProgress)
    {
        return;
    }

    // 检查当前鱼护是否已进入多选态
    bool isInMultiSelectMode = m_compKeeperTofu?.IsInMultiSelectMode() ?? false;

    if (!isInMultiSelectMode)
    {
        // 场景1：未进入多选态
        // 1. 自动进入多选状态
        m_compKeeperTofu?.MultiSelectModeEnter();

        // 2. 切换到任务排序
        m_compKeeperTofu?.SortTypeSet(FishSortType.Quest);

        // 3. 自动选中满足条件的鱼
        AutoSelectQuestFish(questData);
    }
    else
    {
        // 已进入多选态的处理逻辑
        OnQuestClickInMultiSelectMode(questIndex, questData);
    }
}

// 自动选中任务鱼
private void AutoSelectQuestFish(int questIndex)
{
    var questData = m_questDataList[questIndex];
    if (questData == null) return;

    // 从 KeeperTofu 获取鱼列表
    var fishList = m_compKeeperTofu?.FishListGet();
    if (fishList == null) return;

    // 遍历鱼列表，选中满足任务条件的鱼
    foreach (var fish in fishList)
    {
        if (IsQuestFishConditionMet(fish, questData))
        {
            m_compKeeperTofu?.FishSelectionToggle(fish, true);
        }
    }
}

// 检查鱼是否满足任务条件
private bool IsQuestFishConditionMet(FishingBagItemInfo fish, FishMarketQuestData questData)
{
    // 检查鱼种ID
    if (fish.m_fishId != questData.m_requiredFishId)
    {
        return false;
    }

    // 检查重量条件（如果有）
    if (questData.m_minWeightRequired > 0)
    {
        if (fish.m_weight < questData.m_minWeightRequired)
        {
            return false;
        }
    }

    // 检查新鲜度（0%不可用于完成任务）
    if (fish.m_freshness <= 0)
    {
        return false;
    }

    return true;
}
```

### 4.2 管线刷新策略

| 场景 | Mask | 说明 | 触发时机 |
|------|------|------|---------|
| 进入鱼市 | RefreshAll | 初始化所有数据 | UITask 初始化 |
| 任务数据刷新 | RefreshQuestList | 刷新任务列表 | 服务器事件通知 |
| 售卖完成 | RefreshQuestProgress | 更新任务进度 | 售卖请求成功回调 |
| 任务完成 | RefreshQuestList | 刷新任务状态 | 任务进度达成 |
| 任务到期 | RefreshQuestList | 刷新任务列表 | 倒计时归0 |
| 点击任务排序 | RefreshKeepnetFishList | 重新排序鱼护 | 任务栏点击 |

#### 4.2.1 PipelineUpdateMask 定义

```csharp
[Flags]
public enum PipelineUpdateMask
{
    None = 0,
    RefreshKeepnetFishList = 1 << 0,      // 刷新鱼护列表
    RefreshQuestList = 1 << 1,             // 刷新任务列表
    RefreshQuestProgress = 1 << 2,         // 仅刷新进度
    RefreshMain = 1 << 3,                  // 刷新顶部货币
    PlayQuestCompleteAnim = 1 << 4,        // 播放完成动画
    PlayQuestClaimAnim = 1 << 5,           // 播放领取动画
    PlayConfirmSellUIProcess = 1 << 6,     // 播放确认售卖UIProcess
    PlayQuestRefreshAnim = 1 << 7,         // 播放任务刷新动画
    SellFinish = 1 << 8,                  // 售卖完成
    RefreshAll = ~0,                        // 刷新所有
}
```

#### 4.2.2 启动管线的标准写法

```csharp
// 启动管线的标准写法
private void LaunchPipelineWithMask(PipelineUpdateMask mask)
{
    var pipelineInitInfo = m_owner.CompUpdatePipelineManagerGet().UpdatePipelineInitInfoAlloc();
    pipelineInitInfo.m_customParamDict.SetParam(
        FishMarketUITask.ParamKeyPipelineUpdateMask,
        mask);
    m_owner.CompUpdatePipelineManagerGet().UpdatePipelineLaunch(pipelineInitInfo);
}
```

#### 4.2.3 Tofu 中参与管线的流程

```csharp
// QuestTofu 中参与管线
public override void UpdateContextSetup(ICustomParamDictionaryReadOnly paramDict,
    UITaskUpdatePipelineStartType pipelineStartType,
    params object[] extraParamArr)
{
    base.UpdateContextSetup(paramDict, pipelineStartType, extraParamArr);

    // 获取本次管线行为
    m_currPipelineUpdateMask = paramDict.GetStructParam<PipelineUpdateMask>(
        FishMarketUITask.ParamKeyPipelineUpdateMask);
}

public override bool DataCacheUpdateIsNeededCheck()
{
    return IsUITaskUpdatePipelineInitOrResume() ||
           m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshQuestList);
}

public override void DataCacheUpdate()
{
    base.DataCacheUpdate();

    if (IsUITaskUpdatePipelineInitOrResume() ||
        m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshQuestList))
    {
        QuestDataUpdate();
    }
}

public override bool DynamicResLoadIsNeededCheck()
{
    return IsUITaskUpdatePipelineInitOrResume() ||
           m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshQuestList);
}

public override void DynamicResCollect4Load(ref List<string> resPathList)
{
    base.DynamicResCollect4Load(ref resPathList);

    if (IsUITaskUpdatePipelineInitOrResume() ||
        m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshQuestList))
    {
        // 收集所有任务鱼的图标资源路径
        if (m_questDataList != null)
        {
            foreach (var questData in m_questDataList)
            {
                if (!string.IsNullOrEmpty(questData.m_requiredFishIconPath))
                {
                    if (!resPathList.Contains(questData.m_requiredFishIconPath))
                    {
                        resPathList.Add(questData.m_requiredFishIconPath);
                    }
                }
            }
        }
    }
}

public override void ViewUpdate(IUITaskUpdatePipelineController pipelineCtrl)
{
    if (IsUITaskUpdatePipelineInitOrResume() ||
        m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshQuestList))
    {
        m_questUICtrl?.RefreshQuestList();
    }
}
```

### 4.3 资源池管理

| Prefab | 对象池名称 | 池数量 | 说明 |
|-------|---------|--------|------|
| Pfb_UI_FishMarketQuestltem_A1.prefab | QuestItemPool | 12 | 8个任务栏位，每栏显示1个任务 |
| Pfb_UI_FishMarketQuestltem.prefab | QuestItemPool | - | 一期任务项（参考） |
| Pfb_UI_KeepnetFishListltem_A1.prefab | - | - | 二期任务列表项（待开发） |

#### 4.3.1 对象池初始化配置

```csharp
// FishMarketQuestUIController 中的对象池初始化
protected void PoolCreate(string poolName)
{
    if (m_isPoolInit || m_easyObjectPool == null)
    {
        return;
    }

    // 绑定预制体控制器
    var poolInfoList = m_easyObjectPool.poolInfo;
    if (poolInfoList == null || poolInfoList.Length == 0)
    {
        Debug.LogError("FishMarketQuestUIController: Pool info is empty");
        return;
    }

    // 从资源容器获取预制体
    var asset = poolInfoList[0].prefab;
    var template = Instantiate(asset, transform, false);
    PrefabControllerCreater.CreateAllControllers(template);
    FrameworkUnityUtil.SetGameObjectActive(template, false);

    // 设置对象池预制体
    var poolInfo = m_easyObjectPool.GetPoolInfoByName(poolName);
    if (poolInfo != null)
    {
        poolInfo.prefab = template;
    }

    // 监听对象创建事件
    m_easyObjectPool.EventOnPoolObjectCreated += OnPoolObjectCreated;

    // 创建对象池
    m_easyObjectPool.CreatePools();

    m_isPoolInit = true;
}
```

#### 4.3.2 对象创建回调

```csharp
// 对象池创建对象回调
protected void OnPoolObjectCreated(string poolName, GameObject go)
{
    if (poolName == QuestItemPoolName)
    {
        var itemCtrl = go.GetComponent<FishMarketQuestItemUIController>();
        if (itemCtrl != null)
        {
            // 初始化Item
            itemCtrl.Init(itemCtrl);
            // 注册Item事件
            itemCtrl.EventOnUIItemNeedFill += OnItemNeedFill;
            itemCtrl.EventOnUIItemClick += OnQuestItemClick;
        }
        else
        {
            Debug.LogError($"FishMarketQuestUIController: 无法获取FishMarketQuestItemUIController - {go.name}");
        }
    }
}
```

### 4.4 倒计时系统实现

#### 4.4.1 倒计时显示更新

```csharp
// FishMarketQuestItemUIController 中的倒计时更新
public void UpdateCountdownDisplay(float remainingSeconds)
{
    if (m_countdownText == null)
    {
        return;
    }

    // 倒计时归0或过期
    if (remainingSeconds <= 0)
    {
        m_countdownText.text = "已过期";
        m_countdownText.color = Color.red;
        return;
    }

    // 转换为时分秒
    int hours = Mathf.FloorToInt(remainingSeconds / 3600f);
    int minutes = Mathf.FloorToInt((remainingSeconds % 3600f) / 60f);
    int seconds = Mathf.FloorToInt(remainingSeconds % 60f);

    // 显示格式：小时:分钟:秒
    m_countdownText.text = $"{hours:D2}:{minutes:D2}:{seconds:D2}";

    // 最后30分钟变红
    if (remainingSeconds <= 30 * 60)
    {
        m_countdownText.color = Color.red;
    }
    else
    {
        m_countdownText.color = Color.white;
    }
}
```

#### 4.4.2 倒计时更新策略

根据开发设计方案和速查表，倒计时的实现策略如下：

| 规则 | 说明 |
|------|------|
| 显示格式 | 天/小时、小时/分、分/秒 |
| 变红条件 | 最后30分钟变红 |
| 刷新时机 | 倒计时归0后自动刷新 |
| 整点对齐 | 与现实世界整点对齐 |
| 刷新机制 | UI层监听 `EventOnFishMarketQuestRefreshNtf` 事件，服务器通知后触发管线刷新 |
| 显示更新 | 从 `FishMarketQuestInfo.m_endTime` 计算，在 `UIController.Update` 中更新 |
| 时间获取 | 使用 `GetCurrentGameTime()` 获取服务器时间 |

**重要注意事项**：
- 倒计时显示不再使用 PipelineUpdateMask，在 `UIController.Update` 中直接更新
- 刷新机制由服务器推送事件触发，不再在 UITask.Tick 中每分钟主动刷新

### 4.5 任务刷新流程

#### 4.5.1 服务器推送事件监听

```csharp
// QuestTofu 中监听任务刷新事件
public override void OnEventUIControllerLoadCompleted(string uiCtrlName)
{
    base.OnEventUIControllerLoadCompleted(uiCtrlName);

    if (uiCtrlName == nameof(FishMarketQuestUIController))
    {
        // 注册任务刷新事件
        PlayerCtx.EventOnFishMarketQuestRefreshNtf += OnFishMarketQuestRefreshNtf;
    }
}

private void OnFishMarketQuestRefreshNtf(FishMarketQuestRefreshNtf ntf)
{
    Debug.Log($"QuestTofu: 收到任务刷新通知 - 关卡ID={ntf.FishingLevelConfId}, 索引={ntf.Index}");

    // 启动管线刷新任务列表
    LaunchPipelineWithMask(PipelineUpdateMask.RefreshQuestList | PipelineUpdateMask.PlayQuestRefreshAnim);
}
```

#### 4.5.2 任务数据更新

```csharp
// QuestTofu 中更新任务数据
private void QuestDataUpdate()
{
    m_questDataList.Clear();

    var playerGO = PlayerCtx?.PlayerGameObjectGet();
    if (playerGO == null) return;

    // 获取当前关卡ID
    int fishingLevelConfId = GetCurrentFishingLevelConfId();

    // 从逻辑层获取所有任务
    var questProviders = playerGO.FishMarketQuestGetAll(fishingLevelConfId);

    foreach (var provider in questProviders)
    {
        var questData = ConvertProviderToQuestData(provider);
        m_questDataList.Add(questData);
    }
}
```

### 4.6 任务数据获取与转换

#### 4.6.1 数据提供者转换

```csharp
// 将逻辑层的数据提供者转换为UI层数据结构
private FishMarketQuestData ConvertProviderToQuestData(IFishMarketQuestInfoProvider provider)
{
    var conf = provider.ConfGet();
    var questInfo = GetQuestInfoFromDC(provider);

    return new FishMarketQuestData
    {
        m_questId = provider.IndexGet(),
        m_confId = conf.ID,
        m_state = DetermineQuestState(provider),
        m_requiredFishId = conf.FishTypeID,
        m_requiredFishName = GetFishName(conf.FishTypeID),
        m_requiredFishIconPath = GetFishIconPath(conf.FishTypeID, conf.MinWeight),
        m_requiredCount = conf.CountCond,
        m_minWeightRequired = conf.MinWeight,
        m_currentProgress = provider.CompletedCountGet(),
        m_isReachCondition = provider.IsReachCondition(),
        m_endTime = questInfo.m_endTime,
        m_remainingSeconds = provider.LeftTimeGet().TotalSeconds,
        m_rewardSilverCoin = conf.SilverReward,
        m_rewardGoldCoin = conf.GoldReward
    };
}
```

#### 4.6.2 任务状态判定

```csharp
// 判定任务状态
private QuestState DetermineQuestState(IFishMarketQuestInfoProvider provider)
{
    if (provider.IsCompletedGet())
    {
        return QuestState.Completed;
    }

    if (provider.IsReachCondition())
    {
        return QuestState.Claimable;
    }

    return QuestState.InProgress;
}
```

---

## 五、开发任务清单

### Phase 2 开发任务清单

| ID | 任务名称 | 对应 Prefab | 优先级 | 预计工期 | 状态 |
|----|---------|---------|---------|---------|------|------|
| 1 | 实现任务数据获取流程 | Pfb_UI_FishMarket_A1 | P0 | 2天 | 待开发 |
| 2 | 实现任务组 UIController | Pfb_UI_FishMarketQuestGroup_A1 | P0 | 2天 | 待开发 |
| 3 | 实现任务列表项 UIController | Pfb_UI_FishMarketQuestltem_A1 | P0 | 2天 | 待开发 |
|  | | Pfb_UI_FishMarketQuestltem | - | 一期已有，可复用 |
| 4 | 实现倒计时系统 | Pfb_UI_FishMarketQuestltem_A1 | P0 | 1天 | 待开发 |
| | | Pfb_UI_FishMarketQuestGroup | - | 一期已有，可复用 |
| 5 | 实现任务状态切换 | Pfb_UI_FishMarketQuestltem_A1 | P0 | 1天 | 待开发 |
| 6 | 实现奖励领取流程 | Pfb_UI_FishMarketQuestltem_A1 | P0 | 1天 | 待开发 |
| 7 | 实现任务刷新动效 | Pfb_UI_FishMarketQuestGroup_A1 | P1 | 1天 | 待开发 |
| 8 | 实现任务鱼标记 | Pfb_UI_KeepnetFishListltem_A1 | P1 | 2天 | 待开发 |
| 9 | 实现跨关卡检测 | Pfb_UI_KeepnetFishListltem_A1 | P2 | 1天 | 待开发 |
| 10 | 实现新鲜度处理 | Pfb_UI_KeepnetFishListltem_A1 | P2 | 1天 | 待开发 |
| 11 | 实现邮件补发奖励 | Pfb_UI_FishMarketQuestltem_A1 | P2 | 1天 | 待开发 |

### 任务详细说明

#### 任务1：实现任务数据获取流程

**涉及 Prefab**: `Pfb_UI_FishMarket_A1`

**开发内容**:
- 从逻辑层获取任务列表数据
- 通过配置ID查询配置表获取任务描述、鱼图标等信息
- 转换为 UI 层数据结构

**涉及文件**:
- `FishMarketUITaskCompQuestTofu.cs`
- `PlayerGameObjectCompFishMarketQuestClient.cs` (已存在）
- `FishMarketQuestInfo` (数据结构）
- `ConfigDataFishMarketQuestInfo` (配置表）

**关键实现**:
```csharp
// QuestTofu 中实现任务数据获取
private void QuestDataUpdate()
{
    m_questDataList.Clear();

    var playerGO = PlayerCtx?.PlayerGameObjectGet();
    if (playerGO == null) return;

    // 获取当前关卡ID
    int fishingLevelConfId = GetCurrentFishingLevelConfId();

    // 从逻辑层获取所有任务
    var questProviders = playerGO.FishMarketQuestGetAll(fishingLevelConfId);

    foreach (var provider in questProviders)
    {
        var questData = ConvertProviderToQuestData(provider);
        m_questDataList.Add(questData);
    }
}
```

---

#### 任务2：实现任务组 UIController

**涉及 Prefab**: `Pfb_UI_FishMarketQuestGroup_A1`

**开发内容**:
- 实现任务组的 UI 布局（左右布局）
- 实现任务列表的滚动显示（LoopScrollRect + EasyObjectPool）
- 支持对象池复用（12个任务栏位）

**涉及文件**:
- `FishMarketQuestUIController.cs`
- `FishMarketQuestItemUIController.cs` (Pfb_UI_FishMarketQuestltem_A1.prefab)
- `Pfb_UI_FishMarketQuestltem.cs` (一期已有）

**关键实现**:
```csharp
// FishMarketQuestUIController 中实现任务组初始化
public void Initialize(List<FishMarketQuestData> questDataList, 
    IReadOnlyDictionary<string, UnityEngine.Object> resDictionary = null)
{
    m_questDataList = questDataList;
    m_resDictionary = resDictionary;
    m_isFirstLoad = true;

    // 初始化对象池
    PoolCreate(QuestItemPoolName);

    // 设置滚动条总数量
    if (m_loopScrollRect != null)
    {
        m_loopScrollRect.totalCount = m_questDataList != null ? m_questDataList.Count : 0;
    }
}
```

---

#### 任务3：实现任务列表项 UIController

**涉及 Prefab**: `Pfb_UI_FishMarketQuestltem_A1`

**开发内容**:
- 实现任务项的显示（鱼图标、鱼名称、重量、价格、新鲜度）
- 实现任务进度显示（当前/目标）
- 实现倒计时显示（天/小时）
- 实现领取按钮和任务描述
- 实现任务提示

**涉及文件**:
- `FishMarketQuestItemUIController.cs`

**关键实现**:
```csharp
// FishMarketQuestItemUIController 中实现任务显示更新
public void UpdateShow(FishMarketQuestData questData, 
    IReadOnlyDictionary<string, UnityEngine.Object> resDictionary = null)
{
    if (questData == null)
    {
        return;
    }

    m_currentQuestData = questData;

    // 更新鱼名称
    if (m_fishNameText != null)
    {
        m_fishNameText.text = questData.m_requiredFishName;
    }

    // 更新鱼图标
    if (m_fishIcon != null && resDictionary != null && !string.IsNullOrEmpty(questData.m_requiredFishIconPath))
    {
        if (resDictionary.TryGetValue(questData.m_requiredFishIconPath, out var iconObj))
        {
            var sprite = iconObj as UnityEngine.Sprite;
            if (sprite != null)
            {
                m_fishIcon.sprite = sprite;
            }
        }
    }

    // 更新任务条件描述
    if (m_questDescText != null)
    {
        string conditionText = $"出售 {questData.m_requiredCount} 条";

        // 如果有重量要求，添加重量条件
        if (questData.m_minWeightRequired > 0)
        {
            float weightInKg = questData.m_minWeightRequired / 1000f;
            conditionText += $"（≥{weightInKg:F2}kg）";
        }

        m_questDescText.text = conditionText;
    }

    // 更新进度显示
    if (m_questProgressText != null)
    {
        m_questProgressText.text = $"{questData.m_currentProgress}/{questData.m_requiredCount}";
    }

    // 更新倒计时显示
    if (m_countdownText != null)
    {
        UpdateCountdownDisplay(questData.m_remainingSeconds);
    }

    // 更新奖励显示（银币）
    if (m_rewardText != null)
    {
        m_rewardText.text = $"{questData.m_rewardSilverCoin}";
    }

    // 根据任务状态更新按钮显示
    UpdateButtonsState(questData.m_state);
}
```

---

#### 任务4：实现倒计时系统

**涉及 Prefab**: `Pfb_UI_FishMarketQuestltem_A1`, `Pfb_UI_FishMarketQuestGroup`

**开发内容**:
- 在 `QuestItemUIController.Update` 中实现倒计时计算
- 使用 `GetCurrentGameTime()` 获取服务器时间
- 实现最后30分钟变红逻辑
- 显示格式：天/小时、小时/分、分/秒

**涉及文件**:
- `FishMarketQuestItemUIController.cs`
- `QuestTofu.cs` (事件处理）

**关键实现**:
```csharp
// FishMarketQuestItemUIController 中的倒计时更新
public void UpdateCountdownDisplay(float remainingSeconds)
{
    if (m_countdownText == null)
    {
        return;
    }

    // 倒计时归0或过期
    if (remainingSeconds <= 0)
    {
        m_countdownText.text = "已过期";
        m_countdownText.color = Color.red;
        return;
    }

    // 转换为时分秒
    int hours = Mathf.FloorToInt(remainingSeconds / 3600f);
    int minutes = Mathf.FloorToInt((remainingSeconds % 3600f) / 60f);
    int seconds = Mathf.FloorToInt(remainingSeconds % 60f);

    // 显示格式：小时:分钟:秒
    m_countdownText.text = $"{hours:D2}:{minutes:D2}:{seconds:D2}";

    // 最后30分钟变红
    if (remainingSeconds <= 30 * 60)
    {
        m_countdownText.color = Color.red;
    }
    else
    {
        m_countdownText.color = Color.white;
    }
}
```

---

#### 任务5：实现任务状态切换

**涉及 Prefab**: `Pfb_UI_FishMarketQuestltem_A1`

**开发内容**:
- 实现四种任务状态：InProgress、CompleteWaitClaim、Claimed、Locked
- 实现状态切换逻辑（售卖增加进度、时间到期刷新、点击领取）
- 实现完成和领取的动画表现

**涉及文件**:
- `FishMarketQuestItemUIController.cs`
- `FishMarketQuestState.cs` (枚举）

**关键实现**:
```csharp
// FishMarketQuestItemUIController 中的按钮状态更新
protected void UpdateButtonsState(QuestState state)
{
    switch (state)
    {
        case QuestState.Locked:
            // 显示解锁按钮
            m_questStatusStateController.SetToUIState("Lock");
            break;

        case QuestState.InProgress:
            // 进行中状态
            m_questStatusStateController.SetToUIState("Normal");
            break;

        case QuestState.Claimable:
            // 显示领取按钮
            m_questStatusStateController.SetToUIState("Award");
            break;

        case QuestState.Completed:
            // 已完成显示
            m_questStatusStateController.SetToUIState("Finish");
            break;
    }
}
```

---

#### 任务6：实现奖励领取流程

**涉及 Prefab**: `Pfb_UI_FishMarketQuestltem_A1`

**开发内容**:
- 实现点击领取按钮的逻辑
- 发送 `FishMarketQuestCompleteReqNetTask` 请求
- 处理奖励发放
- 播放奖励领取动画

**涉及文件**:
- `FishMarketUITaskCompMainTofu.cs`
- `FishMarketQuestCompleteReqNetTask.cs`
- `FishMarketQuestCompleteAck.cs`

**关键实现**:
```csharp
// QuestTofu 中实现奖励领取
private void OnClaimButtonClick(int questIndex)
{
    // 1. 前置检查
    var questData = GetQuestData(questIndex);
    if (questData == null || questData.m_state != QuestState.Claimable)
    {
        ShowError("任务状态异常，无法领取");
        return;
    }

    // 2. 发送网络请求
    var netTask = new FishMarketQuestCompleteReqNetTask(
        fishingLevelConfId: GetCurrentLevelId(),
        index: questIndex
    );

    netTask.EventOnStop += task =>
    {
        var ackTask = task as FishMarketQuestCompleteReqNetTask;
        if (ackTask == null || ackTask.IsNetworkError || ackTask.Result != 0)
        {
            ShowError($"领取失败: {ackTask?.Result}");
            return;
        }

        // 3. 逻辑层更新
        var playerGO = PlayerCtx?.PlayerGameObjectGet();
        if (playerGO != null)
        {
            playerGO.FishMarketQuestComplete(
                GetCurrentLevelId(),
                questIndex,
                ackTask.CurrencyUpdateCtxInfo,
                out var errCode
            );
        }

        // 4. 启动管线刷新
        LaunchPipelineWithMask(PipelineUpdateMask.RefreshQuestList);

        // 5. 播放领取动画
        PlayClaimRewardAnimation(questIndex, questData.m_rewardSilverCoin);
    };

    netTask.Start();
}
```

---

#### 任务7：实现任务刷新动效

**涉及 Prefab**: `Pfb_UI_FishMarketQuestGroup_A1`

**开发内容**:
- 任务刷新时播放刷新动效
- 使用 `PlayQuestRefreshAnim` Mask 控制

**涉及文件**:
- `FishMarketQuestUIController.cs`
- `FishMarketQuestGroupUIController.cs`
- `FishMarketQuestGroupUIProcess.cs` (UIProcess）

**关键实现**:
```csharp
// FishMarketQuestUIController 中实现刷新动画
public void PlayRefreshAnimation()
{
    // 对所有Item执行FadeOut
    var activeItems = m_loopScrollRect.GetActiveGameObjectListInContext();
    if (activeItems != null && activeItems.Count > 0)
    {
        foreach (var itemGo in activeItems)
        {
            var itemCtrl = itemGo.GetComponent<FishMarketQuestItemUIController>();
            if (itemCtrl != null)
            {
                itemCtrl.Fade(1, false); // FadeOut
            }
        }
    }
}
```

---

#### 任务8：实现任务鱼标记

**涉及 Prefab**: `Pfb_UI_KeepnetFishListltem_A1`

**开发内容**:
- 在鱼护列表项中显示限时热收图标
- 根据任务条件（鱼种ID、重量）筛选显示
- 新鲜度0%时，标记置灰并显示感叹号提示
- 任务完成后隐藏标记

**涉及文件**:
- `FishMarketUITaskCompKeeperTofu.cs`
- `KeepnetFishItemUIController.cs`
- `FishMarketUITaskCompQuestTofu.cs` (提供任务鱼ID列表）

**关键实现**:
```csharp
// KeeperTofu 中的任务鱼标记更新
public void QuestFishMarkUpdate()
{
    // 获取当前任务需要的鱼ID集合
    var questFishIds = m_compQuestTofu?.GetQuestFishIds() ?? new HashSet<int>();

    // 遍历所有鱼护项
    foreach (var fishItem in m_fishItemControllers)
    {
        var fishData = fishItem.FishDataGet();
        if (fishData == null) continue;

        // 检查是否是任务鱼
        bool isQuestFish = questFishIds.Contains(fishData.m_fishId);

        // 检查新鲜度是否为0%
        bool isFreshnessZero = fishData.m_freshness <= 0;

        // 更新任务标记显示
        fishItem.QuestMarkVisibleSet(isQuestFish);

        // 新鲜度为0%时，标记置灰并禁用交互
        if (isQuestFish && isFreshnessZero)
        {
            fishItem.QuestMarkGraySet(true);
        }
        else
        {
            fishItem.QuestMarkGraySet(false);
        }
    }
}
```

---

#### 任务9：实现跨关卡检测

**涉及 Prefab**: `Pfb_UI_KeepnetFishListltem_A1`

**开发内容**:
- 检查鱼的钓获关卡 ID
- 只计算当前关卡任务钓获的鱼
- 跨关卡的鱼不计入任务进度

**涉及文件**:
- `PlayerGameObjectCompFishMarketQuestClient.cs` (已有)
- `FishMarketUITaskCompQuestTofu.cs`
- `KeepnetFishItemUIController.cs`

---

#### 任务10：实现新鲜度处理

**涉及 Prefab**: `Pfb_UI_KeepnetFishListltem_A1`

**开发内容**:
- 新鲜度到达 0% 时显示为红色
- 任务标记置灰（如果满足任务条件）
- 点击任务标记弹出提示：新鲜度为0%时，无法完成限时热收

**涉及文件**:
- `KeepnetFishItemUIController.cs`
- `FishMarketUITaskCompKeeperTofu.cs`

**关键实现**:
```csharp
// KeepnetFishItemUIController 中的新鲜度处理
private void OnQuestMarkClicked()
{
    var fishData = m_currentFishData;
    if (fishData != null && fishData.m_freshness <= 0)
    {
        // 弹出提示：新鲜度为0%时，无法完成限时热收
        ShowTips("新鲜度为0%时，无法完成限时热收");
        return;
    }

    // 正常选中逻辑
    ToggleFishSelection();
}
```

---

#### 任务11：实现邮件补发奖励

**涉及 Prefab**: `Pfb_UI_FishMarketQuestltem_A1`

**开发内容**:
- 任务到期时奖励未领取
- 通过邮件系统发送奖励
- 刷新任务后，未领取奖励标记清除

**涉及文件**:
- `FishMarketUITaskCompQuestTofu.cs`
- `MailSystemController.cs`

---

### 开发顺序建议

| 阶段 | 任务 | 依赖关系 | 说明 |
|------|------|---------|------|
| 第一阶段 | 任务1、2、3 | - | 基础框架搭建 |
| 第二阶段 | 任务4、5 | 依赖任务3 | 倒计时和状态切换 |
| 第三阶段 | 任务6 | 依赖任务5 | 奖励领取流程 |
| 第四阶段 | 任务7、8 | 依赖任务3 | 体验优化功能 |
| 第五阶段 | 任务9、10、11 | 依赖任务8 | 边界处理 |

---

## 六、UICtrlDesc 文件更新说明

本章节详细说明二期对一期的 UICtrlDesc 文件的更新内容，包括新增的字段、需要绑定的 Prefab 元素以及对应的 UI 控制器。

### 6.1 FishMarketFishItemUICtrlDesc.cs（鱼护列表项）

#### 文件路径
```
Assets/GameProject/Scripts/Runtime/GameView/UI/FishMarketUITask/Controller/FishMarketFishItemUICtrlDesc.cs
```

#### 二期新增字段

| Header | 字段名 | 类型 | 说明 | Prefab 节点 | 二期状态 |
|--------|--------|------|------|------------|----------|
| 任务标记 | `m_questMarkIcon` | Image | 限时热收图标 | `IconImg_QuestMark` | **新增** |
| 任务标记状态控制器 | `m_questMarkStateController` | AdvanceUIStateController | 控制任务标记的显示/隐藏/置灰 | `IconImg_QuestMark` 的状态机 | **新增** |

#### 对应 Prefab 节点
```
KeepnetFishltem (鱼护列表项)
├── IconImg (鱼图标，一期已有）
├── Text_FishName (鱼名称，一期已有）
├── Text_FishWeight (鱼重量，一期已有）
├── Text_FishPrice (鱼价格，一期已有）
├── Text_FishFreshness (新鲜度，一期已有）
├── IconImg_QuestMark (任务标记，二期新增）
│   └── QuestMarkStateController (状态控制器，二期新增）
```

#### 更新后的完整代码
```csharp
using BlackJack.BJFramework.Runtime.Prefab;
using BlackJack.BJFramework.Runtime.UI;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace BlackJack.ProjectEF.Runtime.UI
{
    [AutoGenAliasName("",
        " BlackJack.ProjectEF.Runtime.UI", nameof(FishMarketFishItemUIController))]
    public class FishMarketFishItemUICtrlDesc: PrefabControllerDescBase
    {
        [Header("图标")]
        [AutoGenAliasName("m_fishIcon")]
        public Image m_fishIcon;

        [Header("名称")]
        [AutoGenAliasName("m_fishNameText")]
        public TextMeshProUGUI m_fishNameText;
        
        [Header("重量")]
        [AutoGenAliasName("m_massText")]
        public TextMeshProUGUI m_massText;
        
        [Header("鱼护重量")]
        [AutoGenAliasName("m_keepnetMassText")]
        public TextMeshProUGUI m_keepnetMassText;
        
        [Header("新鲜度")]
        [AutoGenAliasName("m_freshnessText")]
        public TextMeshProUGUI m_freshnessText;
        
        [Header("新鲜度颜色状态控制器")]
        [AutoGenAliasName("m_freshnessStateController")]
        public AdvanceUIStateController m_freshnessStateController;
        
        [Header("价格")]
        [AutoGenAliasName("m_sellPriceText")]
        public TextMeshProUGUI m_sellPriceText;
        
        [Header("鱼品质状态控制器")]
        [AutoGenAliasName("m_bgQualityStateController")]
        public AdvanceUIStateController m_bgQualityStateController;
        
        [Header("鱼Size状态控制器")]
        [AutoGenAliasName("m_fishSizeTypeStateController")]
        public AdvanceUIStateController m_fishSizeTypeStateController;
        
        [Header("鱼市选中状态控制器")]
        [AutoGenAliasName("m_fishMarketSelectedStateController")]
        public AdvanceUIStateController m_fishMarketSelectedStateController;
        
        [Header("鱼护选中状态控制器")]
        [AutoGenAliasName("m_keepnetSelectedStateController")]
        public AdvanceUIStateController m_keepnetSelectedStateController;
                 
        [Header("鱼市/鱼护状态控制器")]
        [AutoGenAliasName("m_fishListItemStateController")]
        public AdvanceUIStateController m_fishListItemStateController;

        // 二期新增：任务标记相关字段
        [Header("任务标记")]
        [AutoGenAliasName("m_questMarkIcon")]
        public Image m_questMarkIcon;

        [Header("任务标记状态控制器")]
        [AutoGenAliasName("m_questMarkStateController")]
        public AdvanceUIStateController m_questMarkStateController;
        
        [Header("点击按钮")]
        [AutoGenAliasName("Root")]
        public Button m_button;
        
    }
}
```

#### 绑定说明
- 在 Prefab `Pfb_UI_KeepnetFishListltem_A1.prefab` 中：
  - 添加 `IconImg_QuestMark` 节点（Image 组件）
  - 为 `IconImg_QuestMark` 添加 `AdvanceUIStateController` 组件
  - 配置状态机的状态：
    - `Hidden`: 隐藏任务标记
    - `Show`: 显示任务标记（正常状态）
    - `Gray`: 显示任务标记（置灰状态，新鲜度为0%时）

---

### 6.2 FishMarketKeeperUICtrlDesc.cs（鱼护控制器）

#### 文件路径
```
Assets/GameProject/Scripts/Runtime/GameView/UI/FishMarketUITask/Controller/FishMarketKeeperUICtrlDesc.cs
```

#### 一期已有字段（二期使用）

| Header | 字段名 | 类型 | 说明 | 二期用途 |
|--------|--------|------|------|----------|
| 鱼市任务排序按钮 | `m_fishMarketSortByQuestBtn` | ButtonEx | 鱼市任务排序按钮 | 二期任务排序功能 |

#### 二期字段状态

所有一期的字段在二期仍然有效，二期新增的功能已经在一期的字段中预留。

#### 重要字段说明
```csharp
// 一期已有，二期核心使用的字段
[Header("鱼市任务排序按钮")]
[AutoGenAliasName("m_fishMarketSortByQuestBtn")]
public ButtonEx m_fishMarketSortByQuestBtn;
```

#### 二期功能说明
- **任务排序按钮**：点击后切换到任务排序模式
- 任务排序规则：满足条件的鱼排在最前；同为任务鱼时按时间倒序

#### 代码更新（保持不变）
该文件在二期无需修改，所有一期字段继续使用。

---

### 6.3 FishMarketQuestItemUICtrlDesc.cs（任务列表项）

#### 文件路径
```
Assets/GameProject/Scripts/Runtime/GameView/UI/FishMarketUITask/Controller/FishMarketQuestItemUICtrlDesc.cs
```

#### 二期字段状态

该文件已经包含二期需要的所有字段，无需新增。以下字段均为一期已有但二期使用的：

| Header | 字段名 | 类型 | 说明 | 二期用途 |
|--------|--------|------|------|----------|
| 鱼种名称 | `m_fishNameText` | TextMeshProUGUI | 鱼名称文本 | 显示任务目标鱼名称 |
| 鱼图标 | `m_fishIcon` | Image | 鱼图标 | 显示任务目标鱼图标（根据重量显示不同体型） |
| 任务描述 | `m_questDescText` | TextMeshProUGUI | 任务描述文本 | 显示任务条件（如"出售10条大于40kg的鲈鱼"） |
| 任务进度 | `m_questProgressText` | TextMeshProUGUI | 任务进度文本 | 显示进度（当前/目标） |
| 倒计时文本 | `m_countdownText` | TextMeshProUGUI | 倒计时文本 | 显示剩余时间（天/小时、小时/分、分/秒） |
| 奖励 | `m_rewardText` | TextMeshProUGUI | 奖励文本 | 显示银币奖励 |
| 解锁按钮 | `m_unlockButton` | ButtonEx | 解锁按钮 | 待解锁任务使用（Alpha1暂不做） |
| 任务按钮 | `m_questButton` | ButtonEx | 任务按钮 | 点击任务进行交互 |
| Fade状态控制器 | `m_fadeStateController` | AdvanceUIStateController | 淡入淡出状态控制器 | 控制任务项的显示/隐藏动画 |
| 任务Status状态控制器 | `m_questStatusStateController` | AdvanceUIStateController | 任务状态控制器 | 控制任务状态（进行中/待领取/已完成/锁定） |
| 任务Quality状态控制器 | `m_questQualityStateController` | AdvanceUIStateController | 任务品质控制器 | 控制任务品质颜色 |

#### 二期可能需要补充的字段

| Header | 字段名 | 类型 | 说明 | 二期状态 |
|--------|--------|------|------|----------|
| 倒计时图标 | `m_timeLimitIcon` | Image | 倒计时图标 | **可能新增**，需确认 Prefab |

#### 对应 Prefab 节点结构
```
Questltem (任务项)
├── QuestltemRoot (任务项根节点)
│   ├── IconImg_Fish (任务鱼图标，对应 m_fishIcon)
│   ├── Text_FishName (鱼名称，对应 m_fishNameText)
│   ├── Text_Progress (进度文本，对应 m_questProgressText)
│   ├── Text_Countdown (倒计时文本，对应 m_countdownText)
│   ├── Button_Claim (领取按钮，对应 m_questButton)
│   ├── IconImg_TimeLimit (倒计时图标，可能对应 m_timeLimitIcon)
│   ├── QuestTips (任务提示)
│   └── Text_Description (任务描述，对应 m_questDescText)
├── Fade状态控制器 (对应 m_fadeStateController)
├── 任务Status状态控制器 (对应 m_questStatusStateController)
└── 任务Quality状态控制器 (对应 m_questQualityStateController)
```

#### 现有完整代码（无需修改）
```csharp
using BlackJack.BJFramework.Runtime.Prefab;
using BlackJack.BJFramework.Runtime.UI;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace BlackJack.ProjectEF.Runtime.UI
{
    /// <summary>
    /// 任务Item UI控制器描述符
    /// </summary>
    [AutoGenAliasName("", "", nameof(FishMarketQuestItemUIController))]
    public class FishMarketQuestItemUICtrlDesc : PrefabControllerDescBase
    {
        [Header("鱼种名称")]
        [AutoGenAliasName("m_fishNameText")]
        public TextMeshProUGUI m_fishNameText;
 
        [Header("鱼图标")]
        [AutoGenAliasName("m_fishIcon")]
        public Image m_fishIcon;
 
        [Header("任务描述")]
        [AutoGenAliasName("m_questDescText")]
        public TextMeshProUGUI m_questDescText;
        
        [Header("任务进度")]
        [AutoGenAliasName("m_questProgressText")]
        public TextMeshProUGUI m_questProgressText;
        
        [Header("倒计时文本")]
        [AutoGenAliasName("m_countdownText")]
        public TextMeshProUGUI m_countdownText;
        
        [Header("奖励")]
        [AutoGenAliasName("m_rewardText")]
        public TextMeshProUGUI m_rewardText;
        
        [Header("解锁按钮")]
        [AutoGenAliasName("m_unlockButton")]
        public ButtonEx m_unlockButton;
        
        [Header("任务按钮")]
        [AutoGenAliasName("m_questButton")]
        public ButtonEx m_questButton;
        
        [Header("Fade状态控制器")]
        [AutoGenAliasName("m_fadeStateController")]
        public AdvanceUIStateController m_fadeStateController;
        
        [Header("任务Status状态控制器")]
        [AutoGenAliasName("m_questStatusStateController")]
        public AdvanceUIStateController m_questStatusStateController;
        
        [Header("任务Quality状态控制器")]
        [AutoGenAliasName("m_questQualityStateController")]
        public AdvanceUIStateController m_questQualityStateController;
    }
}
```

#### 状态机配置说明

**任务Status状态控制器** 需要配置以下状态：
| 状态名 | 说明 | 显示内容 |
|--------|------|----------|
| `Locked` | 锁定状态 | 显示解锁按钮（Alpha1暂不做） |
| `Normal` | 进行中状态 | 正常显示，无特殊按钮 |
| `Award` | 待领取状态 | 显示领取按钮 |
| `Finish` | 已完成状态 | 已完成标识 |

**任务Quality状态控制器** 需要配置以下状态：
| 状态名 | 说明 | 颜色 |
|--------|------|------|
| `Blue` | 普通任务 | 蓝色 |
| `Purple` | 稀有任务 | 紫色（可选） |
| `Orange` | 史诗任务 | 橙色（可选） |

**Fade状态控制器** 需要配置以下状态：
| 状态名 | 说明 | 动效 |
|--------|------|------|
| `FadeIn` | 淡入 | Alpha 从 0 到 1 |
| `FadeOut` | 淡出 | Alpha 从 1 到 0 |

---

### 6.4 FishMarketQuestUICtrlDesc.cs（任务组）

#### 文件路径
```
Assets/GameProject/Scripts/Runtime/GameView/UI/FishMarketUITask/Controller/FishMarketQuestUICtrlDesc.cs
```

#### 一期已有字段（二期使用）

| Header | 字段名 | 类型 | 说明 | 二期用途 |
|--------|--------|------|------|----------|
| 对象池 | `m_easyObjectPool` | EasyObjectPool | 任务列表对象池 | 管理任务列表项的对象池 |
| 滚动控件 | `m_loopScrollRect` | LoopHorizontalScrollRect | 滚动控件 | 任务列表滚动显示 |

#### 二期可能需要补充的字段

| Header | 字段名 | 类型 | 说明 | 二期状态 |
|--------|--------|------|------|----------|
| 倒计时图标 | `m_timeLimitIcon` | Image | 倒计时图标 | **可能新增**，需确认 Prefab |
| 任务提示文本 | `m_questTipsText` | TextMeshProUGUI | 任务提示文本 | **可能新增**，需确认 Prefab |
| 面板状态控制器 | `m_panelStateController` | AdvanceUIStateController | 面板显示/隐藏控制器 | **可能新增**，需确认 Prefab |

#### 对应 Prefab 节点结构
```
FishMarketQuestGroupRoot (任务组根节点)
├── LeftPanel (左侧面板)
│   ├── Pfb_UIl_FishMarketQuest (内部任务列表容器)
│   │   ├── Content (内容区域)
│   │   │   └── QuestltemRoot (任务列表根节点)
│   │   ├── Scroll View (滚动视图，对应 m_loopScrollRect)
│   │   ├── IconImg_TimeLimit (倒计时图标，可能对应 m_timeLimitIcon)
│   │   ├── QuestTips (任务提示，可能对应 m_questTipsText)
│   │   └── Line01 (分割线)
│   ├── Line01 (左侧分割线)
│   ├── BottomBG (底部背景)
│   └── QuestTips (任务提示)
└── EasyObjectPool (对象池，对应 m_easyObjectPool)
```

#### 现有完整代码
```csharp
using BlackJack.BJFramework.Runtime.Prefab;
using MarchingBytes;
using UnityEngine;
using UnityEngine.UI;

namespace BlackJack.ProjectEF.Runtime.UI
{
    [AutoGenAliasName("", "", nameof(FishMarketQuestUIController))]
    public class FishMarketQuestUICtrlDesc: PrefabControllerDescBase
    {
        [Header("对象池")]
        [AutoGenAliasName("m_easyObjectPool")]
        public EasyObjectPool m_easyObjectPool;
        
        [Header("滚动控件")]
        [AutoGenAliasName("m_loopScrollRect")]
        public LoopHorizontalScrollRect m_loopScrollRect;
        
    }
}
```

#### 对象池配置说明

**EasyObjectPool 需要配置**：
| 配置项 | 值 | 说明 |
|--------|-----|------|
| poolName | `QuestItemPool` | 对象池名称 |
| prefab | `Pfb_UI_FishMarketQuestltem_A1` | 任务列表项 Prefab |
| poolSize | 12 | 对象池大小（可显示8个任务栏位） |

**LoopHorizontalScrollRect 需要配置**：
| 配置项 | 值 | 说明 |
|--------|-----|------|
| Cell Size | (440, 180) | 单个任务项尺寸 |
| Spacing | (40, 24) | 任务项间距 |
| Padding | (62, 28, 30) | 内边距 |
| Constraint | 1 | 固定列数 |

---

### 6.5 绑定检查清单

#### FishMarketFishItemUICtrlDesc.cs

| 检查项 | Prefab 节点 | Controller 字段 | 状态 |
|--------|------------|----------------|------|
| 添加任务标记图标 | `IconImg_QuestMark` | `m_questMarkIcon` | 待绑定 |
| 添加任务标记状态控制器 | `IconImg_QuestMark` 的 AdvanceUIStateController | `m_questMarkStateController` | 待绑定 |
| 配置状态机状态 | Hidden/Show/Gray | - | 待配置 |
| 一期字段 | IconImg, Text_FishName 等 | m_fishIcon, m_fishNameText 等 | 已有 |

#### FishMarketKeeperUICtrlDesc.cs

| 检查项 | Prefab 节点 | Controller 字段 | 状态 |
|--------|------------|----------------|------|
| 任务排序按钮 | 鱼市任务排序按钮 | `m_fishMarketSortByQuestBtn` | 已有 |
| 一期其他字段 | 各种排序按钮、滚动控件等 | 对应字段 | 已有 |

#### FishMarketQuestItemUICtrlDesc.cs

| 检查项 | Prefab 节点 | Controller 字段 | 状态 |
|--------|------------|----------------|------|
| 鱼种名称 | Text_FishName | `m_fishNameText` | 已有 |
| 鱼图标 | IconImg_Fish | `m_fishIcon` | 已有 |
| 任务描述 | Text_Description | `m_questDescText` | 已有 |
| 任务进度 | Text_Progress | `m_questProgressText` | 已有 |
| 倒计时文本 | Text_Countdown | `m_countdownText` | 已有 |
| 奖励 | Text_Reward | `m_rewardText` | 已有 |
| 任务按钮 | Button_Claim | `m_questButton` | 已有 |
| Fade状态控制器 | - | `m_fadeStateController` | 已有 |
| 任务Status状态控制器 | - | `m_questStatusStateController` | 已有 |
| 任务Quality状态控制器 | - | `m_questQualityStateController` | 已有 |

#### FishMarketQuestUICtrlDesc.cs

| 检查项 | Prefab 节点 | Controller 字段 | 状态 |
|--------|------------|----------------|------|
| 对象池 | EasyObjectPool | `m_easyObjectPool` | 已有 |
| 滚动控件 | Scroll View | `m_loopScrollRect` | 已有 |

---

### 6.6 总结

#### 文件更新汇总

| 文件 | 更新状态 | 主要变更 |
|------|---------|----------|
| FishMarketFishItemUICtrlDesc.cs | 需要更新 | 新增 `m_questMarkIcon` 和 `m_questMarkStateController` |
| FishMarketKeeperUICtrlDesc.cs | 无需更新 | 所有一期字段继续使用 |
| FishMarketQuestItemUICtrlDesc.cs | 无需更新 | 所有一期字段继续使用 |
| FishMarketQuestUICtrlDesc.cs | 无需更新 | 所有一期字段继续使用 |

#### 开发注意事项

1. **AdvanceUIStateController 配置**：所有新增的状态控制器都需要在 Prefab 中配置状态机的状态
2. **Prefab 绑定**：所有新增的字段都需要在 Prefab 中正确绑定对应的 UI 组件
3. **复用一期字段**：尽量复用一期的字段和组件，避免重复开发

#### 验收标准

- [ ] FishMarketFishItemUICtrlDesc.cs 中的新增字段已在 Prefab 中正确绑定
- [ ] 任务标记状态控制器已配置 Hidden/Show/Gray 三个状态
- [ ] 所有 UICtrlDesc 文件与 Prefab 节点一一对应
- [ ] 所有 AdvanceUIStateController 已正确配置状态机
- [ ] 所有 ButtonEx 已正确绑定点击事件

---

## 七、配置表对应关系

### 7.1 任务数据配置表

| 配置表名 | 说明 | 对应字段 |
|-----------|------|---------|
| ConfigDataFishMarketQuestInfo | 任务配置信息 | ConfID, FishTypeID, CountCond, MinWeight, SilverReward, GoldReward, RefreshHour, QuestGroup |
| ConfigDataFishInfo | 鱼种配置信息 | FishName, IconPathForAdult, IconPathForMinWeight |

### 7.2 网络协议对应表

| 协议 | 对应文件 | 说明 |
|------|---------|------|
| FishMarketQuestRefreshNtf | `FishMarketQuestProtocol.cs` | 服务器任务刷新通知 |
| FishMarketQuestCompleteReq | `FishMarketQuestProtocol.cs` | 任务完成请求 |
| FishMarketQuestCompleteAck | `FishMarketQuestProtocol.cs` | 任务完成响应 |
| FishMarketQuestRefreshNtf | `FishMarketQuestProtocol.cs` | 任务刷新通知 |

---

## 八、代码文件对应关系

### 8.1 Controller 层文件

| 文件名 | 对应 Prefab | 说明 | 开发状态 |
|---------|---------|------|------------|
| FishMarketQuestItemUIController.cs | Pfb_UI_FishMarketQuestltem_A1 | 二期任务列表项 Controller | 待开发 |
| FishMarketQuestGroupUIController.cs | Pfb_UI_FishMarketQuestGroup_A1 | 二期任务组 Controller | 待开发 |
| KeepnetFishItemUIController.cs | Pfb_UI_KeepnetFishListltem_A1 | 二期鱼护列表项 Controller | 待开发 |
| FishMarketQuestItemUIController.cs | Pfb_UI_FishMarketQuestltem | 一期任务项 Controller（参考） | 已有 |

### 8.2 Tofu 层文件

| 文件名 | 说明 | 开发状态 |
|---------|------|------------|
| FishMarketUITaskCompMainTofu.cs | 主 Tofu，负责整体协调 | 需要更新 |
| FishMarketUITaskCompQuestTofu.cs | 任务 Tofu，负责任务业务逻辑 | 待开发 |
| FishMarketUITaskCompKeeperTofu.cs | 鱼护 Tofu，负责鱼护业务逻辑 | 需要更新 |

### 8.3 逻辑层文件

| 文件名 | 说明 | 开发状态 |
|---------|------|------------|
| PlayerGameObjectCompFishMarketQuestClient.cs | 任务逻辑层接口 | 已存在，需要对接 |
| FishMarketQuestInfo.cs | 任务数据结构 | 已存在 |
| ConfigDataFishMarketQuestInfo.cs | 任务配置表 | 已存在 |

---

## 九、接口与数据结构对应

### 9.1 数据流向

```
配置表 (ConfigDataFishMarketQuestInfo + ConfigDataFishInfo)
    ↓
服务器数据 (FishMarketQuestInfo → FishMarketQuestRefreshNtf)
    ↓
逻辑层 (IPlayerGameObjectFishMarketQuestClient)
    ↓
Tofu层 (QuestTofu + KeeperTofu)
    ↓
UI 层 (UIController)
```

### 9.2 接口定义

```csharp
// QuestTofu 对外接口
public interface IFishMarketUITaskCompQuestTofu
{
    void ClaimQuestReward(int questIndex);
    List<FishMarketQuestData> QuestDataListGet();
    HashSet<int> GetQuestFishIds();
    void OnQuestFishSold(List<int> fishIds);
    event Action<int> EventOnQuestFishSortRequest;
}

// 任务数据结构
public class FishMarketQuestData
{
    public int m_questIndex;
    public int m_confId;
    public QuestState m_state;
    public int m_targetFishId;
    public string m_targetFishName;
    public string m_targetFishIconPath;
    public int m_targetCount;
    public int m_minWeightRequired;
    public int m_currentProgress;
    public bool m_isReachCondition;
    public DateTime m_endTime;
    public int m_rewardSilverCoin;
    public int m_rewardGoldCoin;
}
```

---

## 十、验收标准

### 9.1 功能验收

- [ ] 8个任务栏位正确显示，支持任务切换
- [ ] 任务状态切换正确（进行中→待领取→已完成）
- [ ] 倒计时显示准确，最后30分钟变红
- [ ] 任务数据正确接入，配置信息完整显示
- [ ] 任务进度正确更新（售卖时增加）
- [ ] 奖励领取流程正常，网络请求和发放正确
- [ ] 任务刷新时正确播放动效
- [ ] 任务鱼标记正确显示（满足条件的鱼显示标记）
- [ ] 跨关卡检测正常，非当前关卡鱼不计入任务
- [ ] 新鲜度0%处理正常，任务标记置灰并提示

### 9.2 性能验收

- [ ] 任务列表滚动流畅，对象池正常工作
- [ ] 倒计时更新无性能问题（Update 中计算）
- [ ] 任务刷新无卡顿，动画播放流畅

### 9.3 代码质量验收

- [ ] 遵循 BJFramework 开发规范（分层架构、Tofu/Controller 分离）
- [ ] 使用 PipelineUpdateMask 控制 UI 刷新
- * - 事件冒泡正确（UI → Tofu → Logic/Network）
- * - 代码结构清晰，注释完整
- * - 无硬编码，使用配置表

---

## 十一、快速开发检查表

### 10.1 Prefab 检查表

| Prefab | 检查项 | 说明 | 结果 |
|--------|--------|------|------|
| Pfb_UI_FishMarket_A1 | 文件完整性 | 检查 Prefab 是否能正常加载 | O |
| Pfb_UI_KeepnetFishListltem_A1 | 文件完整性 | 检查 Prefab 是否能正常加载 | O |
| Pfb_UI_FishMarketQuestGroup_A1 | 组件结构 | 检查所有必需组件是否存在 | O |
| Pfb_UI_FishMarketQuestltem_A1 | 组件结构 | 检查所有必需组件是否存在 | O |
| | Pfb_UI_FishMarketQuestltem | 参考对象 | 与二期 Prefab 对比，确认可复用 | O |

### 10.2 文件检查表

| 文件名 | 检查项 | 说明 | 结果 |
|---------|--------|------|------|
| FishMarketUITaskCompQuestTofu.cs | 类定义 | 检查类定义是否完整 | 待开发 |
| FishMarketUITaskCompKeeperTofu.cs | 接口实现 | 检查接口实现是否完整 | 需要更新 |
| FishMarketQuestGroupUIController.cs | 控制器实现 | 检查控制器是否满足接口要求 | 待开发 |
| FishMarketQuestItemUIController.cs | 控制器实现 | 检查控制器是否满足接口要求 | 待开发 |
| PlayerGameObjectCompFishMarketQuestClient.cs | 逻辑层接口 | 检查接口是否已存在 | 已有，可对接 |
| ConfigDataFishMarketQuestInfo | 配置表 | 检查配置表字段是否完整 | 已有，可查询 |
| ConfigDataFishInfo | 鱼种配置表 | 检查配置表字段是否完整 | 已有，可查询 |

---

## 十二、常见问题解答

### Q1: 二期 Prefab 是否需要复用一期的代码？

**A**: 部分复用，部分新增：
- O **可复用**：`Pfb_UI_FishMarketQuestltem`（任务列表项参考）
- X **需要新增**：`Pfb_UI_FishMarketQuestltem_A1`（二期任务列表项）
- O **可复用**：`Pfb_UI_FishMarketQuestGroup`（任务组参考，二期增强）
- X **需要新增**：`Pfb_UI_FishMarketQuestGroup_A1`（二期任务组，增加了任务功能）

### Q2: 二期 Prefab 的命名规范是什么？

**A**:
- 所有二期 Prefab 都以 `_A1` 后缀标识
- 对应的一期 Prefab 文件名不带 `_A1`
- 示例：
  - `Pfb_UI_FishMarketQuestltem_A1` (二期任务项)
  - `Pfb_UI_FishMarketQuestltem` (一期任务项)

### Q3: 如何使用一期已有的代码？

**A**: 可以参考但不能直接复制：
- 可以参考 `Pfb_UI_FishMarketQuestltem` 的代码结构
- 需要根据二期需求添加新功能（如倒计时、任务进度、状态切换）
- 需要重构部分逻辑以支持二期的新增功能

### Q4: 对象池的使用规范？

**A**:
- 使用 `EasyObjectPool` 管理任务列表（12个任务栏位，每栏1个任务）
- 使用 `EasyObjectPool` 管理鱼护列表
- 对象池配置在 Prefab 的 `EasyObjectPool` 组件中设置

### Q5: 如何实现任务刷新动画？

**A**:
- 使用 `UIProcess` 封装动画逻辑
- 通过 `PlayQuestRefreshAnim` Mask 控制动画播放
- 在 `QuestUIController` 中实现 `ShowAnimation` 方法
- 支持淡入淡出效果

---

## 附录：技术参考

### 参考文档
- [[FishmarketUITask_PRD_标注版]] - 原始PRD文档
- [[FishMarketPhase2_开发设计方案]] - 二期技术设计方案
- [[FishmarketUITask_开发速查表]] - 开发速查表

### 参考代码
- `Pfb_UI_FishMarketQuestltem.cs` - 一期任务列表项 Controller（参考）
- `Pfb_UI_FishMarketQuestGroup.cs` - 一期任务组 Controller（参考）
- `FishMarketUITaskCompQuestTofu.cs` - 一期任务 Tofu（参考）

---

*文档结束*

**最后更新**: 2026-02-03
