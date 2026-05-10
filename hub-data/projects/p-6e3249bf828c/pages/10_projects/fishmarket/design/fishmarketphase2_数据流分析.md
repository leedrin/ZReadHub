# BJF Data Flow Design - FishMarketUITask Phase 2 (鱼市任务系统)

---

## Phase 1: Semantic Decomposition

### Noun Analysis

#### Business Data Entities (Logic Data)
- **FishMarketQuestInfo**: Mapped to `m_questInfoList` in `FishMarketUITaskCompQuestTofu`
  - 任务ID、目标条件、进度、状态、倒计时、奖励、所属关卡
  - 数据来源：`PlayerGameObject.FishMarketQuestListGet()` + `FishMarketQuestPoolConfig.ConfigGet()`
  
- **KeeperFishData**: Mapped to `m_keeperFishList` in `FishMarketUITaskCompKeeperTofu`
  - 鱼ID、体型、重量、新鲜度、价格、品质、钓获时间、任务鱼标记
  - 数据来源：`PlayerGameObject.KeeperFishListGet()`
  
- **CurrencyData**: Mapped to `m_goldCoin`, `m_silverCoin` in `FishMarketUITaskCompMainTofu`
  - 玩家金币、银币数量
  - 数据来源：`PlayerGameObject.CurrencyValueGet(CurrencyType.GoldCoin)`, `CurrencyValueGet(CurrencyType.SilverCoin)`
  
- **SellConfirmData**: Mapped to `m_sellFishList` in `FishMarketUITaskCompSellConfirmTofu`
  - 确认售卖的鱼列表、总价
  - 数据来源：MainTofu selected fish list

#### Display Data Models (Display Data)
- **QuestViewData**: Transformed from quest config, passed to `FishMarketQuestUIController`
  - 任务描述、鱼图标路径（最小体型/成年体）、目标文本、进度文本、倒计时文本、状态标识、奖励预览
  - 数据来源：QuestTofu.DataCacheUpdate() 阶段构建
  
- **KeeperFishViewData**: Transformed from keeper fish, passed to `FishMarketKeeperUIController`
  - 图标路径、名称、品质、新鲜度百分比、售卖价格、重量文本、任务鱼标记状态
  - 数据来源：KeeperTofu.DataCacheUpdate() 阶段构建
  
- **SellConfirmViewData**: Simple data type for UI binding
  - 鱼名称、大小状态、单价、总价
  - 数据来源：SellConfirmTofu.DataCacheUpdate() 阶段构建

#### Verb Analysis

- **Business Logic Events**:
  - `EventOnFishMarketQuestRefreshNtf`: Triggered by server notification, handled in `FishMarketUITaskCompQuestTofu`
  - 触发管线刷新，获取任务列表
  - 数据源：服务器推送 `FishMarketQuestRefreshNtf` 协议
  
  - **FishMarketQuestCompleteReq**: Processed through NetTask in `FishMarketUITaskCompMainTofu`
  - Check → NetTask → SetMask → StartPipeline flow
  - 数据源：玩家点击任务领取按钮
  
  - **FishMarketSellReq**: Processed through NetTask in `FishMarketUITaskCompMainTofu`
  - Check: 跨关卡检测、新鲜度0%处理
  - NetTask: 发送售卖请求
  - Refresh: 成功后修改 DataCache, 设置 Mask bits

- **Interaction Logic Events**:
  - `EventOnQuestItemClick`: Thrown by `FishMarketQuestUIController`
  - 三种场景的处理：未多选态、已多选态+有选中、已多选态+无命中
  
  - `EventOnFishItemClicked`: Thrown by `FishMarketKeeperUIController`
  - 切换选中/取消选中状态
  
  - `EventOnSortTypeChanged`: Thrown by `FishMarketKeeperUIController`
  - 切换排序类型：时间、稀有度、重量、价格、任务
  
  - `EventOnSelectAllClicked`: Thrown by `FishMarketKeeperUIController`
  - 全选/取消全选所有鱼
  
  - `EventOnSellClicked`: Thrown by `FishMarketKeeperUIController`
  - 触发售卖确认界面
  
  - `EventOnSellConfirmed`: Thrown by `FishMarketSellConfirmUIController`
  - 确认售卖操作

---

## Phase 2: Data Flow Architecture

### Data Input Sources

- **Initialization**: `FishMarketUITask.FishMarketPanelOpen()` → `FishMarketUITaskCompMainTofu.UpdateContextSetup()`
  - 解析 Intent 参数，初始化管线上下文
  
- **Asynchronous**: 服务器响应 → `FishMarketUITaskCompQuestTofu` 或 `FishMarketUITaskCompMainTofu`
  - 任务刷新通知：`EventOnFishMarketQuestRefreshNtf` 触发
  - 玩家数据访问：统一通过 `PlayerGameObject.FishMarketQuestListGet()`, `KeeperFishListGet()`, `CurrencyValueGet()`

### Data Transformation Logic (DataCacheUpdate)

#### QuestTofu - 任务数据转换

```csharp
// 原始数据 → 显示数据
PlayerGameObject.FishMarketQuestListGet()
    ↓
遍历每个任务，构建 QuestViewData:
    - quest.ConfigId → FishMarketQuestPoolConfig.ConfigGet(quest.ConfigId)
    - quest.RequiredFishId → FishInfoConfig.ConfigGet(quest.RequiredFishId)
    - quest.WeightCondition → 条件文本："大于 {weight}公斤" 或无（不显示）
    - quest.RequiredCount → 目标数量
    - quest.CurrentProgress → 当前进度（X/Y）
    - quest.EndTime → 服务器时间
    - quest.State → 状态枚举：InProgress/CompleteWaitClaim/Claimed/Locked
    - quest.Reward → 奖励配置解析
    ↓
Icon路径选择逻辑：
    - If WeightCondition > 0:
      - 获取满足重量的最小体型图标路径
    - Else:
      - 使用成年体图标路径
    ↓
倒计时计算（每帧在 UIController.Update 中更新，不走管线）:
    - remainingTime = quest.EndTime - GetCurrentGameTime()
    - 格式化：天/小时、小时/分、分/秒
    - 变红判断：remainingTime < 30分钟 → 红色
```

#### KeeperTofu - 鱼数据转换

```csharp
// 原始数据 → 显示数据
PlayerGameObject.KeeperFishListGet()
    ↓
遍历每条鱼，构建 KeeperFishViewData:
    - fish.FishInfoConfigId → FishInfoConfig.ConfigGet(configId) → 鱼名称
    - fish.Weight → 格式化显示："X kg" / "X g" / "X t"
      - 单位自动进位（cm/m/kg/t），最多4位有效数字
    - fish.Length → 格式化显示："X cm" / "X m"
    - fish.Quality → 获取品质图标/颜色映射
    - fish.PushDateTime → 新鲜度计算：
      - freshness = max(0, 1 - (当前时间 - 入护时间).TotalHours / 24)
      - freshnessPercent = (int)(freshness * 100)
    ↓
价格计算：
    - If 新鲜度 == 0%:
      - price = FishInfoConfig.GetJuvenileBodyPrice(configId)
    - Else:
      - price = FishInfoConfig.GetPriceByQualityAndSize(configId, quality, size)
    ↓
任务鱼匹配逻辑：
    - Check quest conditions via QuestTofu.GetQuestFishConditions()
    - 标记满足当前进行中任务条件的鱼
    - 新鲜度0%：标记为置灰 + 感叹号
    ↓
排序逻辑（仅在 DataCacheUpdate 阶段）：
    - 根据 SortType 对鱼列表排序：
      - SortType.Time: 按 CatchTime 降序
      - SortType.Quality: 按稀有度排序
      - SortType.Weight: 按重量排序
      - SortType.Price: 按价格排序
      - SortType.Quest: 任务鱼最前，其余按原排序类型
```

#### MainTofu - 货币数据转换

```csharp
// 从逻辑层获取货币数据
PlayerGameObject.CurrencyValueGet(CurrencyType.GoldCoin) → long m_goldCoin
PlayerGameObject.CurrencyValueGet(CurrencyType.SilverCoin) → long m_silverCoin
```

#### SellConfirmTofu - 售卖确认数据转换

```csharp
// 选中鱼列表 → 确认界面显示数据
m_sellFishList.Clear()
foreach (var fish in selectedFishList) {
    var confirmData = new SellConfirmViewData {
        Name = fish.Name,
        SizeStatus = GetSizeStatusText(fish.SizeType),  // "幼年体"/"成年体"/"巨物"
        Price = fish.Price,
        TotalPrice = fish.Price  // 单价=总价（总价由MainTofu计算）
    };
    m_sellFishList.Add(confirmData);
}
```

### Data Binding & Display (ViewUpdate)

- **PipelineUpdateMask 定义**:

```csharp
[Flags]
public enum PipelineUpdateMask
{
    None = 0,
    
    // 鱼护相关
    RefreshKeepnetFishList = 1 << 0,        // 刷新鱼护列表
    RefreshQuestProgress = 1 << 1,          // 仅刷新任务进度（不重建列表）
    
    // 任务相关
    RefreshQuestList = 1 << 2,             // 刷新任务列表
    PlayQuestCompleteAnim = 1 << 6,          // 播放任务完成动画
    PlayQuestClaimAnim = 1 << 7,            // 播放奖励领取动画
    PlayQuestRefreshAnim = 1 << 8,         // 播放任务刷新动画
    
    // 主面板相关
    RefreshMain = 1 << 3,                    // 刷新顶部货币
    
    // 售卖相关
    PlayConfirmSellUIProcess = 1 << 9,     // 播放确认售卖UIProcess
    SellFinish = 1 << 10,                   // 售卖完成（刷新所有数据）
    
    // 组合
    RefreshAll = RefreshKeepnetFishList | RefreshQuestList | RefreshMain,
}
```

- **执行流程**：
  1. Tofu 检查 Mask bits
  2. 根据 Mask 调用对应的 UIController 刷新方法
  3. UIController 接收简单数据，执行 `Text.text = data` 或状态机切换

---

## Phase 3: Event Handling Design

### UI Interaction Paths

#### 任务图标点击路径（三种场景）

**场景1：未进入多选态**
```
用户点击任务图标
    ↓
FishMarketQuestUIController.OnQuestItemClick(questId, questIndex)
    ↓
抛出事件: EventOnQuestItemClick(questId, questIndex)
    ↓
FishMarketUITaskCompMainTofu.HandleQuestItemClick(questId, questIndex)
    ↓
判断: 当前是否为多选态?
    - 否 → 
    设置 KeeperTofu 模式为 FishMarket
    获取满足该任务的鱼ID列表：QuestTofu.GetQuestFishIds()
    启动管线: RefreshKeepnetFishList (含自动选中任务鱼、任务鱼排到前列、切换为任务排序)
    - 是 → 跳到场景2
```

**场景2：已进入多选态 + 已选中某些鱼**
```
用户点击任务图标
    ↓
FishMarketQuestUIController.OnQuestItemClick(questId, questIndex)
    ↓
抛出事件: EventOnQuestItemClick(questId, questIndex)
    ↓
FishMarketUITaskCompMainTofu.HandleQuestItemClick(questId, questIndex)
    ↓
判断: 已在多选态且已选中某些鱼
    - 取消非任务鱼的选中状态
    - 选中对应点击的任务鱼
    启动管线: RefreshQuestProgress (仅刷新进度，不重排)
```

**场景3：已进入多选态 + 没有命中任务鱼**
```
用户点击任务图标
    ↓
FishMarketQuestUIController.OnQuestItemClick(questId, questIndex)
    ↓
抛出事件: EventOnQuestItemClick(questId, questIndex)
    ↓
FishMarketUITaskCompMainTofu.HandleQuestItemClick(questId, questIndex)
    ↓
判断: 已在多选态但当前鱼不满足任何任务
    - 不做任何操作
```

#### 鱼护点击路径

```
用户点击鱼项
    ↓
FishMarketKeeperUIController.OnFishItemClicked(fishId, fishIndex)
    ↓
抛出事件: EventOnFishItemClicked(fishId, fishIndex)
    ↓
FishMarketUITaskCompKeeperTofu.HandleFishItemClicked(fishId, fishIndex)
    ↓
判断当前选中状态
    - 如果已选中 → 取消选中
    - 如果未选中 → 选中
- 启动管线: RefreshQuestProgress (仅刷新任务进度标记)
```

#### 排序类型变更路径

```
用户切换排序下拉框
    ↓
FishMarketKeeperUIController.OnSortTypeChanged(FishSortType sortType)
    ↓
抛出事件: EventOnSortTypeChanged(sortType)
    ↓
FishMarketUITaskCompKeeperTofu.HandleSortTypeChanged(sortType)
    ↓
设置 KeeperTofu 排序类型
- 启动管线: RefreshKeepnetFishList (重新排序鱼列表)
```

#### 售卖流程路径

**点击售卖按钮**
```
用户点击售卖按钮
    ↓
FishMarketKeeperUIController.OnSellClicked()
    ↓
抛出事件: EventOnSellFishRequest(selectedFish, selectedIndices)
    ↓
FishMarketUITaskCompMainTofu.HandleSellFishRequest(selectedFish, selectedIndices)
    ↓
判断: 是否有选中的鱼
- 否 → 显示悬浮窗提示："您还没有选择需要售出的鱼"
- 是 → 
    判断是否有任务鱼被卖出（收集任务鱼ID）
    - 播放确认售卖 UIProcess
```

**确认售卖路径**
```
用户点击确认按钮
    ↓
FishMarketSellConfirmUIController.OnConfirmClicked()
    ↓
抛出事件: EventOnSellConfirmed(fishList, totalPrice)
    ↓
FishMarketUITaskCompMainTofu.HandleSellConfirmed(fishList, totalPrice)
    ↓
Check 售卖条件:
    - 跨关卡检测：鱼.CatchLevelConfId != 当前关卡 → 可售卖但不计入任务进度
    - 新鲜度检测：fish.FreshnessPercent == 0 → 可售卖但不计入任务进度
- ↓
发送网络请求：FishMarketSellReqNetTask(fishList)
    ↓
网络请求成功回调 EventOnStop:
- 判断: Result == 0 且无网络错误
- 是：
  - 更新玩家货币（服务器已更新）
  - 更新任务进度：QuestTofu.OnQuestFishSold(任务鱼ID列表)
  - 设置 Mask: SellFinish (刷新所有数据 + 播放售卖动画)
  - 启动管线
- 否:
  - 显示错误提示
```

### Business Process Flows

#### 流程1: 任务进度追踪

```
玩家售卖鱼
    ↓
Check: 鱼是否满足任务条件（QuestTofu.CheckQuestProgress）
    - 任务ID、鱼种ID、重量条件、关卡匹配、新鲜度检查
    ↓
满足条件:
    更新任务进度: quest.CurrentProgress++
    检查: quest.CurrentProgress >= quest.RequiredCount
    - 是 → 任务完成 → 切换状态为 CompleteWaitClaim
  - 否 → 保持 InProgress 状态
    ↓
设置 Mask: RefreshQuestProgress (触发进度更新显示)
```

#### 流程2: 任务领取奖励

```
玩家点击领取按钮（任务状态为 CompleteWaitClaim）
    ↓
FishMarketUITaskCompMainTofu.HandleQuestClaimRequest(questId, questIndex)
    ↓
检查: 任务状态是否为 CompleteWaitClaim
    - 否 → 返回
- 是 → 发送网络请求: FishMarketQuestCompleteReqNetTask(questId, questIndex)
    ↓
网络请求成功回调 EventOnStop:
- 判断: Result == 0 且无网络错误
- 是:
  - 更新货币: 从响应中解析奖励
  - 切换任务状态为 Claimed
  - 检查: 未领取奖励的倒计时是否到期
    - 是 → 服务器自动刷新，奖励通过邮件补发（已记录在 PRD 中）
    - 否 → 正常流程
  - 设置 Mask: PlayQuestClaimAnim | RefreshQuestProgress
- 否:
  - 显示错误提示
```

#### 流程3: 任务刷新机制

```
服务器任务倒计时归零
    ↓
服务器推送 EventOnFishMarketQuestRefreshNtf
    ↓
FishMarketUITaskCompQuestTofu.HandleQuestRefreshNtf()
    ↓
从服务器获取新任务列表
↓
数据转换:
    - 清空并重建 m_questInfoList
    - 对于每个任务:
      - 从任务池配置表查询完整信息
      - 构建显示数据（图标、描述、进度、倒计时、状态等）
      - 判断倒计时是否 < 30 分钟
    ↓
设置 Mask: RefreshQuestList | PlayQuestRefreshAnim (播放刷新动画)
    ↓
启动管线刷新任务列表
```

#### 流程4: 任务鱼排序

```
用户点击任务栏（三种场景）
    ↓
场景1: 未进入多选态
- 自动进入多选模式
- 自动选中满足任务的鱼
- 满足任务的鱼自动排到鱼护前列
- 排序自动切换为任务排序
- 
场景2: 已进入多选态 + 已选中某些鱼
- 排序自动切换为任务排序
- 取消非任务鱼的选中状态
- 选中对应点击的任务鱼
- 
场景3: 已进入多选态 + 没有命中任务鱼
- 不做任何操作
```

---

## Phase 4: Pipeline Integration

### UpdatePipeline Steps Implementation

#### 1. Preprocess（预处理）
```csharp
protected override void PreProcessBeforePipelineStart()
{
    base.PreProcessBeforePipelineStart();
    
    // 锁定 UI 操作，启用加载
    // 显示 Loading 动画
}
```

#### 2. DatacacheUpdate（数据缓存更新）

**QuestTofu.DataCacheUpdate()**:
```csharp
public override void DataCacheUpdate()
{
    base.DataCacheUpdate();
    
    if (IsUITaskUpdatePipelineInitOrResume() ||
        m_currPipelineUpdateMask.HasFlag(RefreshQuestList))
    {
        // 清空并重建任务列表
        m_questInfoList.Clear();
        
        // 从逻辑层获取任务数据
        var playerGO = PlayerGameObjectGet();
        var questList = playerGO.FishMarketQuestListGet();
        
        // 获取当前关卡 ID
        int currentLevelId = CurrentFishingLevelConfIdGet();
        
        foreach (var quest in questList)
        {
            // 从配置表查询任务详情
            var poolConfig = FishMarketQuestPoolConfig.ConfigGet(quest.ConfigId);
            
            // 构建显示数据
            var viewData = new QuestViewData
            {
                m_questId = quest.ConfigId,
                m_index = quest.Index,
                m_fishIconPath = GetQuestFishIconPath(poolConfig),
                m_description = poolConfig.Description,
                m_targetText = BuildTargetText(poolConfig),
                m_progressText = BuildProgressText(quest),
                m_countdownText = BuildCountdownText(quest.EndTime),
                m_isRedTimeRed = IsCountdownRed(quest.EndTime),
                m_status = QuestStatusMap(quest.Status),
                m_rewardInfo = ParseRewardInfo(poolConfig.Reward)
            };
            
            m_questInfoList.Add(viewData);
        }
    }
}

private string BuildTargetText(FishMarketQuestPoolConfig poolConfig)
{
    if (poolConfig.WeightCondition > 0)
    {
        return $"大于 {poolConfig.WeightCondition} 公斤";
    }
    return ""; // 无重量条件不显示
}

private string BuildProgressText(FishMarketQuestInfo quest)
{
    return $"{quest.CurrentProgress}/{quest.RequiredCount}";
}

private string BuildCountdownText(DateTime endTime)
{
    var remaining = endTime - GetCurrentGameTime();
    
    if (remaining.TotalDays > 0)
        return $"{(int)remaining.TotalDays}天 {(int)remaining.Hours}小时";
    else if (remaining.TotalHours > 0)
        return $"{(int)remaining.Hours}小时{(int)remaining.Minutes}分";
    else if (remaining.TotalMinutes > 0)
        return $"{(int)remaining.Minutes}分{(int)remaining.Seconds}秒";
    else
        return "0秒";
}

private bool IsCountdownRed(DateTime endTime)
{
    return (endTime - GetCurrentGameTime()).TotalMinutes < 30;
}

private QuestStatus QuestStatusMap(QuestState state)
{
    return state switch
    {
        QuestState.InProgress => QuestViewData.QuestStatus.InProgress,
        QuestState.CompleteWaitClaim => QuestViewData.QuestStatus.CompleteWaitClaim,
        QuestState.Claimed => QuestViewData.QuestStatus.Claimed,
        QuestState.Locked => QuestViewData.QuestStatus.Locked,
        _ => throw new ArgumentException($"Unknown quest state: {state}")
    };
}
```

**KeeperTofu.DataCacheUpdate()**:
```csharp
public override void DataCacheUpdate()
{
    base.DataCacheUpdate();
    
    if (IsUITaskUpdatePipelineInitOrResume() ||
        m_currPipelineUpdateMask.HasFlag(RefreshKeepnetFishList))
    {
        // 清空并重建鱼列表
        m_keeperFishList.Clear();
        
        // 从逻辑层获取鱼护数据
        var playerGO = PlayerGameObjectGet();
        var fishDataList = playerGO.KeeperFishListGet();
        var currentLevelId = CurrentFishingLevelConfIdGet();
        
        foreach (var fishData in fishDataList)
        {
            // 构建显示数据
            var viewData = BuildKeeperFishViewData(fishData, currentLevelId);
            m_keeperFishList.Add(viewData);
        }
        
        // 根据当前排序类型排序
        SortFishListByType(m_currentSortType);
        
        // 检查任务鱼条件
        var questConditions = QuestTofu.GetQuestFishConditions();
        CheckTaskFishConditions(questConditions);
    }
}

private KeeperFishViewData BuildKeeperFishViewData(FishMarketFishData fishData, int currentLevelId)
{
    var fishInfo = FishInfoConfig.ConfigGet(fishData.FishInfoConfigId);
    
    // 计算新鲜度
    var freshnessPercent = CalculateFreshnessPercent(fishData.PushDateTime);
    
    // 计算价格
    long price;
    if (freshnessPercent == 0)
    {
        price = FishInfoConfig.GetJuvenileBodyPrice(fishData.FishInfoConfigId);
    }
    else
    {
        price = FishInfoConfig.GetPriceByQualityAndSize(
            fishData.FishInfoConfigId,
            fishData.Quality,
            fishData.SizeType
        );
    }
    
    // 获取任务鱼匹配状态
    var isTaskFish = QuestTofu.IsFishMatchTaskFish(fishData);
    
    return new KeeperFishViewData
    {
        m_fishIndex = fishData.FishIndex,
        m_fishName = fishInfo.Name,
        m_iconPath = FishInfoConfig.GetIconPath(fishData.FishInfoConfigId),
        m_qualityIconPath = FishInfoConfig.GetQualityIconPath(fishData.Quality),
        m_qualityName = FishInfoConfig.GetQualityName(fishData.Quality),
        m_freshnessPercent = freshnessPercent,
        m_sellPrice = price,
        m_weight = fishData.Weight,
        m_length = fishData.Length,
        m_sizeTypeText = GetSizeTypeText(fishData.SizeType),
        m_isTaskFish = isTaskFish,
        m_freshness0Percent = freshnessPercent == 0,
        m_matchedQuestIds = fishData.MatchedQuestIds
    };
}

private float CalculateFreshnessPercent(DateTime pushDateTime)
{
    var freshness = max(0f, 1f - (DateTime.Now - pushDateTime).TotalHours / 24f);
    return freshness * 100f;
}

private bool IsTaskFishMatchFish(FishMarketFishItemInfo fishData)
{
    // 检查鱼是否满足当前进行中任务的任一条件
    var questConditions = m_questInfoList
        .Where(q => q.State == QuestState.InProgress)
        .Select(q => new
        {
            FishType = q.RequiredFishId,
            WeightCondition = q.MinWeightRequired,
            LevelConfId = q.FishingLevelConfId,
            MinSize = q.MinSizeRequired
        });
    
    foreach (var condition in questConditions)
    {
        if (fishData.FishType == condition.FishType &&
            fishData.CatchLevelConfId == condition.LevelConfId &&
            (!condition.WeightCondition.HasValue || fishData.Weight >= condition.WeightCondition.Value) &&
            (!condition.MinSize.HasValue || fishData.SizeType >= condition.MinSize.Value))
        {
            return true;
        }
    }
    
    return false;
}
```

**MainTofu.DataCacheUpdate()**:
```csharp
public override void DataCacheUpdate()
{
    base.DataCacheUpdate();
    
    if (IsUITaskUpdatePipelineInitOrResume() ||
        m_currPipelineUpdateMask.HasFlag(RefreshMain))
    {
        // 从逻辑层获取货币数据
        var playerGO = PlayerGameObjectGet();
        m_goldCoin = playerGO.CurrencyValueGet(CurrencyType.GoldCoin);
        m_silverCoin = playerGO.CurrencyValueGet(CurrencyType.SilverCoin);
    }
}
```

**SellConfirmTofu.DataCacheUpdate()**:
```csharp
public override void DataCacheUpdate()
{
    base.DataCacheUpdate();
    
    if (IsUITaskUpdatePipelineInitOrResume())
    {
        // 构建确认界面数据
        m_sellFishList.Clear();
        
        foreach (var fish in m_selectedFishList)
        {
            var confirmData = new SellConfirmViewData
            {
                Name = fish.Name,
                SizeStatus = GetSizeStatusText(fish.SizeType),
                Price = fish.Price,
                TotalPrice = fish.Price  // 单价=总价（总价值在管线启动前计算）
            };
            m_sellFishList.Add(confirmData);
        }
        
        // 计算总价
        m_totalPrice = m_sellFishList.Sum(f => f.Price);
    }
}
```

#### 3. DynamicResLoadIsNeededCheck（动态资源加载检查）

```csharp
// QuestTofu: 图标通过资源容器加载，不需要动态加载
public override bool DynamicResLoadIsNeededCheck()
{
    return false;
}

// KeeperTofu: 图标通过资源容器加载，不需要动态加载
public override bool DynamicResLoadIsNeededCheck()
{
    return false;
}

// SellConfirmTofu: 不需要动态资源
public override bool DynamicResLoadIsNeededCheck()
{
    return false;
}
```

#### 4. DynamicResCollect4Load（动态资源收集）

```csharp
// QuestTofu: 不需要收集资源
public override void DynamicResCollect4Load(ref List<string> resPathList)
{
    // Empty implementation
}

// KeeperTofu: 不需要收集资源
public override void DynamicResCollect4Load(ref List<string> resPathList)
{
    // Empty implementation
}

// SellConfirmTofu: 不需要收集资源
public override void DynamicResCollect4Load(ref List<string> resPathList)
{
    // Empty implementation
}
```

#### 5. ViewUpdate（视图更新）

**QuestTofu.ViewUpdate()**:
```csharp
public override void ViewUpdate(IUITaskUpdatePipelineController pipelineCtrl)
{
    if (m_currPipelineUpdateMask.HasFlag(RefreshQuestList))
    {
        // 全量刷新任务列表
        m_questUICtrl.QuestListRefresh(m_questInfoList);
        
        // 注册任务项点击事件
        // 事件注册已在 OnEventUIControllerLoadCompleted 中完成
    }
    
    if (m_currPipelineUpdateMask.HasFlag(RefreshQuestProgress))
    {
        // 仅刷新任务进度
        var questViewData = m_questInfoList[m_currentQuestIndex];
        m_questUICtrl.QuestProgressUpdate(m_currentQuestIndex, questViewData);
    }
    
    if (m_currPipelineUpdateMask.HasFlag(PlayQuestCompleteAnim))
    {
        // 播放任务完成动画
        m_questUICtrl.PlayCompleteAnim(m_currentQuestIndex);
    }
    
    if (m_currPipelineUpdateMask.HasFlag(PlayQuestClaimAnim))
    {
        // 播放奖励领取动画
        m_questUICtrl.PlayClaimAnim(m_currentQuestIndex);
    }
    
    if (m_currPipelineUpdateMask.HasFlag(PlayQuestRefreshAnim))
    {
        // 播放任务刷新动画
        m_questUICtrl.PlayRefreshAnim();
    }
}
```

**KeeperTofu.ViewUpdate()**:
```csharp
public override void ViewUpdate(IUITaskUpdatePipelineController pipelineCtrl)
{
    if (IsUITaskUpdatePipelineInitOrResume() ||
        m_currPipelineUpdateMask.HasFlag(RefreshKeepnetFishList))
    {
        // 全量刷新鱼护列表
        m_keeperUICtrl.ListViewRefresh(m_keeperFishList, m_currentSortType);
        
        // 注册鱼项点击事件
        // 事件注册已在 OnEventUIControllerLoadCompleted 中完成
    }
}
```

**MainTofu.ViewUpdate()**:
```csharp
public override void ViewUpdate(IUITaskUpdatePipelineController pipelineCtrl)
{
    if (IsUITaskUpdatePipelineInitOrResume() ||
        m_currPipelineUpdateMask.HasFlag(RefreshMain))
    {
        // 刷新货币显示
        m_mainUICtrl.CurrencyDisplayUpdate(m_goldCoin, m_silverCoin);
    }
    
    if (m_currPipelineUpdateMask.HasFlag(PlayConfirmSellUIProcess))
    {
        // 播放确认售卖 UIProcess
        var confirmUIProcess = m_sellConfirmUICtrl.PanelShowUIProcessCreate();
        pipelineCtrl.UIProcessPlayInPipeline(confirmUIProcess);
    }
    
    if (m_currPipelineUpdateMask.HasFlag(SellFinish))
    {
        // 售卖完成，刷新所有数据
        RefreshAllData();
        
        // 滚动到鱼护顶部
        m_keeperUICtrl.ScrollToTop();
    }
}
```

#### 6. PostProcess（后处理）

```csharp
protected override void PostOnPipelineCompleted()
{
    base.PostOnPipelineCompleted();
    
    // 清理管线状态
    m_currPipelineUpdateMask = PipelineUpdateMask.None;
}
```

---

## Phase 4: Pipeline Update Mask 设计总结

| Mask | 值 | 用途 | 触发时机 |
|------|-----|------|-------------|
| RefreshKeepnetFishList | 1 << 0 | 刷新鱼护列表 | 售卖成功、任务排序、全选/单选、任务鱼筛选条件变更 |
| RefreshQuestProgress | 1 << 1 | 仅刷新任务进度 | 卖出满足任务条件的鱼 |
| RefreshQuestList | 1 << 2 | 刷新任务列表 | 任务刷新事件、初始化 |
| PlayQuestCompleteAnim | 1 << 6 | 播放任务完成动画 | 任务进度达到目标值 |
| PlayQuestClaimAnim | 1 << 7 | 播放奖励领取动画 | 点击领取奖励按钮成功 |
| PlayQuestRefreshAnim | 1 << 8 | 播放任务刷新动画 | 服务器推送新任务 |
| RefreshMain | 1 << 3 | 刷新顶部货币 | 初始化、售出成功后更新 |
| PlayConfirmSellUIProcess | 1 << 9 | 播放确认售卖 UIProcess | 点击售卖按钮 |
| SellFinish | 1 << 10 | 售卖完成 | 售卖网络请求成功 | RefreshAll | RefreshAll 的组合 |

**设计原则**：
- **刷新颗粒度**：不同的 Mask 控制不同的刷新范围，避免全量刷新
- **进度优化**：RefreshQuestProgress 允许仅更新进度，不重建列表
- **动画驱动**：动画相关的 Mask 通过 pipelineCtrl.UIProcessPlayInPipeline() 播放
- **组合使用**：RefreshAll = RefreshKeepnetFishList | RefreshQuestList | RefreshMain

---

## Design Checklist Verification

- [x] All nouns mapped to appropriate data storage locations
  - ✓ 任务数据 → `FishMarketUITaskCompQuestTofu.m_questInfoList`
  - ✓ 鱼护数据 → `FishMarketUITaskCompKeeperTofu.m_keeperFishList`
  - ✓ 货币数据 → `FishMarketUITaskCompMainTofu.m_goldCoin`, `m_silverCoin`
  - ✓ 售卖确认数据 → `FishMarketUITaskCompSellConfirmTofu.m_sellFishList`

- [x] Data transformations happen in DataCacheUpdate stage only
  - ✓ 任务数据转换：QuestTofu.DataCacheUpdate()
  - ✓ 鱼护数据转换：KeeperTofu.DataCacheUpdate()
  - ✓ 货币数据转换：MainTofu.DataCacheUpdate()
  - ✓ 售卖确认数据转换：SellConfirmTofu.DataCacheUpdate()

- [x] Proper PipelineUpdateMask usage for UI refreshes
  - ✓ RefreshKeepnetFishList: 刷新鱼护列表
  - ✓ RefreshQuestProgress: 仅刷新任务进度
  - ✓ RefreshQuestList: 刷新任务列表
  - ✓ RefreshMain: 刷新顶部货币
  - ✓ PlayQuestCompleteAnim: 播放任务完成动画
  - ✓ PlayQuestClaimAnim: 播放奖励领取动画
  - ✓ PlayQuestRefreshAnim: 播放任务刷新动画
  - ✓ PlayConfirmSellUIProcess: 播放确认售卖 UIProcess
  - ✓ SellFinish: 售卖完成

- [x] Controller follows event-only pattern (no business logic)
  - ✓ UIController 只负责 UI 展示和输入事件
  - ✓ QuestUIController 抛出 `EventOnQuestItemClick` 事件
  - ✓ KeeperUIController 抛出 `EventOnFishItemClicked` 事件
  - ✓ QuestUIController 抛出 `EventOnSortTypeChanged` 事件
  - ✓ KeeperUIController 抛出 `EventOnSelectAllClicked` 事件
  ✓ KeeperUIController 抛出 `EventOnSellClicked` 事件
  - ✓ SellConfirmUIController 抛出 `EventOnConfirmClicked` 事件
  - ✓ SellConfirmUIController 抛出 `EventOnSellConfirmed` 事件

- [x] All interaction flows follow View→Controller→Tofu pattern
  - ✓ 任务图标点击：QuestUIController → EventOnQuestItemClick → MainTofu.HandleQuestItemClick
  - ✓ 鱼项点击：KeeperUIController → EventOnFishItemClicked → MainTofu.HandleSellFishRequest
  - ✓ 排序切换：KeeperUIController → EventOnSortTypeChanged → MainTofu.HandleSortTypeChanged
  - ✓ 全选/单选：KeeperUIController → EventOnSelectAllClicked → MainTofu.HandleSelectAll
  - ✓ 售卖流程：KeeperUIController → EventOnSellClicked → MainTofu.HandleSellFishRequest → NetTask → EventOnStop → 管线刷新

- [x] All Check → NetTask → Mask → StartPipeline pattern followed
  - ✓ 领取奖励: Check → NetTask(FishMarketQuestCompleteReq) → EventOnStop → SetMask → StartPipeline
  - ✓ 售卖鱼: Check → NetTask(FishMarketSellReq) → EventOnStop → SetMask → StartPipeline
  - ✓ 任务刷新： 服务器事件 → QuestTofu.HandleQuestRefreshNtf → SetMask → StartPipeline

- [x] ModeDefine considerations for different operational modes
  - ✓ QuestTofu: 仅 FishMarket 模式（未定义其他模式）
  - ✓ KeeperTofu: 支持多模式切换（FishMarket / Keepnet）
  - ✓ MainTofu: 处理顶层协调

---

**Summary**: 本数据流设计遵循 BJFramework 架构规范，实现了从 PRD 需求到代码实现的完整映射，包括语义分解、数据流架构、事件处理设计和管线集成。
