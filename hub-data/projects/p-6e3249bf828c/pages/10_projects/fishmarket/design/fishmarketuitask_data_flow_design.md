# BJF Data Flow Design - FishMarketUITask

## Phase 1: Semantic Deconstruction

### Noun Analysis

#### Business Data Entities (Logic Data)

##### Quest Data (Mapped to QuestTofu)
- **m_questInfoList**: `List<FishMarketQuestData>` - 8个任务栏位的任务数据缓存
  - Located in: `FishMarketUITaskCompQuestTofu`
  - Contains: 任务ID、目标条件、进度、状态、倒计时、奖励信息

##### Keeper Data (Mapped to KeeperTofu)
- **m_keeperFishList**: `List<FishMarketFishItemInfo>` - 鱼护中的鱼数据缓存
  - Located in: `FishMarketUITaskCompKeeperTofu`
  - Contains: 鱼ID、体型、重量、新鲜度、售卖价格、品质、捕获时间、任务鱼标记

##### SellConfirm Data (Mapped to SellConfirmTofu)
- **m_sellFishList**: `List<FishMarketFishItemInfo>` - 确认售卖的鱼列表
  - Located in: `FishMarketUITaskCompSellConfirmTofu`
  - Contains: 待售卖鱼的数据（用于二次确认）

##### Currency Data (Mapped to MainTofu)
- **m_goldCoin**: `long` - 金币数量
- **m_silverCoin**: `long` - 银币数量
  - Located in: `FishMarketUITaskCompMainTofu`
  - Source: `PlayerGameObjectGet().CurrencyValueGet()`

##### Data Provider Pattern
- **m_dataProvider**: `IKeeperDataProvider` - 鱼数据提供者接口
  - Implementations: `RealKeeperDataProvider`, `MockupKeeperDataProvider`
  - Located in: `FishMarketUITask/DataProviders/`
  - Purpose: 解耦数据源，支持测试和灵活切换

#### Display Data Models

##### QuestViewData (Passed to FishMarketQuestUIController)
- **m_questId**: 任务ID
- **m_questDescription**: 任务描述文本
- **m_requiredFishName**: 需要的鱼的名称
- **m_requiredFishIconPath**: 鱼图标路径（最小体型或成年体）
- **m_targetConditionText**: 目标条件显示文本（如"大于 40kg"）
- **m_targetValueText**: 目标数量显示文本
- **m_currentProgressText**: 当前进度显示文本（如"5/10"）
- **m_remainingSeconds**: 倒计时剩余秒数
- **m_remainingTimeDisplay**: 倒计时显示文本（天/小时、小时/分、分/秒）
- **m_isTimeRunningOut**: 是否最后30分钟（变红标记）
- **m_questRewardText**: 奖励文本显示
- **m_questState**: 任务状态（进行中/待领取/已领取/待解锁）

##### KeeperFishViewData (Passed to FishMarketKeeperUIController)
- **m_iconPath**: 鱼图标路径
- **m_fishName**: 鱼名称
- **m_qualityType**: 鱼品质类型
- **m_freshnessPercent**: 新鲜度百分比 (0-100)
- **m_freshnessPercentDisplay**: 新鲜度显示文本
- **m_sellPriceText**: 售卖价格文本（突出显示）
- **m_weightText**: 重量文本（如"45.2kg"）
- **m_lengthText**: 长度文本（如"65cm"）
- **m_isTaskFish**: 是否是任务所需的鱼
- **m_isTaskFishValid**: 任务鱼是否有效（新鲜度非0）
- **m_isFreshnessZero**: 新鲜度是否为0%
- **m_index**: 鱼在鱼护中的索引

##### SellConfirmViewData (Passed to FishMarketSellConfirmUIController)
- **m_fishName**: 鱼名称
- **m_fishSizeStateText**: 鱼大小状态文本
- **m_sellPriceText**: 售卖价格
- **m_totalPriceText**: 总价文本

##### SortFilterData (Passed to FishMarketKeeperUIController)
- **m_sortType**: 排序类型（时间/稀有度/重量/价格/任务）
- **m_selectedFishCount**: 选中的鱼数量

#### PipelineUpdateMask Enum (Flags)
Located in: `FishMarketUITask`

```csharp
[Flags]
public enum PipelineUpdateMask
{
    None = 0,

    // 鱼护相关
    RefreshKeepnetFishList = 1 << 0,     // 刷新鱼护列表
    RefreshQuestProgress = 1 << 1,      // 仅刷新任务进度（不重建列表）

    // 任务相关
    RefreshQuestList = 1 << 2,          // 刷新任务列表（包括排序）
    RefreshMain = 1 << 3,              // 刷新顶部货币

    // 动画相关
    PlayQuestCompleteAnim = 1 << 4,     // 播放任务完成动画
    PlayQuestClaimAnim = 1 << 5,         // 播放奖励领取动画
    PlayQuestRefreshAnim = 1 << 6,      // 播放任务刷新动画
    PlayConfirmSellUIProcess = 1 << 7,  // 播放确认售卖UIProcess
    SellFinish = 1 << 8,                // 售卖完成

    RefreshAll = RefreshKeepnetFishList | RefreshQuestList | RefreshMain
}
```

#### Mode Definitions
Located in: `FishMarketUITask`
- **UIHotKeyModeName4Default**: 默认模式
- **UIHotKeyModeName4SellConfirm**: 售卖确认模式
- **UIHotKeySwitchSellConfirmMode**: 售卖确认快捷键模式

#### Sort Type Enum
Located in: `FishMarketUITaskDataStructures.cs`
- `Time`: 按捕获时间排序（默认）
- `Rare`: 按稀有度排序
- `Weight`: 按重量排序
- `Price`: 按价格排序
- `Quest`: 任务排序（任务鱼优先，其余按时间）

### Verb Analysis

#### Business Logic Events (Mapped to Pipeline / NetTask)

##### Quest Events
- **EventOnQuestRefreshNtf**: `Action` - 服务器推送的任务刷新事件
  - Trigger: Server notification
  - Handler: `FishMarketUITaskCompQuestTofu`
  - Action: Set `RefreshQuestList` mask → StartPipeline
- **EventOnQuestClaim**: `Action<int>` - 领取奖励事件
  - Trigger: UI Controller throw event
  - Handler: `FishMarketUITaskCompMainTofu`
  - Process: Check → NetTask `FishMarketQuestCompleteReq` → Set `PlayQuestClaimAnim` | `PlayQuestCompleteAnim` → Refresh

##### Keeper Events
- **EventOnSellFishRequest**: `Action<List<FishMarketFishItemInfo>, List<int>>` - 售卖鱼请求事件
  - Trigger: UI Controller throw event
  - Handler: `FishMarketUITaskCompMainTofu`
  - Process: Check condition → Collect task fish IDs → Launch `PlayConfirmSellUIProcess`
- **EventOnQuestFishSortRequest**: `Action<int>` - 任务鱼排序请求
  - Trigger: UI Controller throw event
  - Handler: `FishMarketUITaskCompKeeperTofu`
  - Action: Call `SortTypeSet(Quest)` → Set `RefreshKeepnetFishList` mask → StartPipeline

##### Sort Events
- **EventOnSortTypeChanged**: `Action<FishSortType>` - 排序类型改变事件
  - Trigger: UI Controller throw event
  - Handler: `FishMarketUITaskCompKeeperTofu`
  - Action: Update `m_sortType` → Set `RefreshKeepnetFishList` mask → StartPipeline
- **EventOnSelectAllClicked**: `Action` - 全选按钮点击事件
  - Trigger: UI Controller throw event
  - Handler: `FishMarketUITaskCompKeeperTofu`
  - Action: Toggle select all fish → Update UI

##### Main Events
- **EventOnPanelClose**: `Action` - 关闭面板事件
  - Trigger: Intent parameter callback trigger
  - Handler: `FishMarketUITaskCompMainTofu`
  - Action: Play close animation → Close UITask
- **EventOnSellConfirmClosed**: `Action` - 售卖确认关闭事件
  - Trigger: SellConfirm Tofu throw event
  - Handler: `FishMarketUITaskCompMainTofu`
  - Action: Switch to default hotkey mode
- **EventOnSellConfirmConfirmedBegin**: `Action` - 售卖动画开始
  - Trigger: SellConfirm Tofu throw event
  - Handler: `FishMarketUITaskCompMainTofu`
  - Action: Block hotkey response
- **EventOnSellConfirmConfirmed**: `Action` - 售卖动画结束
  - Trigger: SellConfirm Tofu throw event
  - Handler: `FishMarketUITaskCompMainTofu`
  - Action: Restore hotkey response → Refresh `SellFinish` mask → StartPipeline

#### Interaction Logic Events (UI Input → Event)

##### Quest Interaction Events (UIController → Tofu)
- **EventOnQuestItemClick(int questId)**: 点击任务栏触发
  - Thrown by: `FishMarketQuestUIController` or `FishMarketQuestItemUIController`
  - Handler: `FishMarketUITaskCompQuestTofu`
  - Action: Handle quest click (3 scenarios based on multi-select state)
    - Scenario 1: Not in multi-select mode → Enter multi-select mode → Auto-select quest fish → Sort by quest → Set `RefreshKeepnetFishList` mask → StartPipeline
    - Scenario 2: In multi-select mode + has selected fish → Sort by quest → Deselect non-quest fish → Select quest fish → Set `RefreshKeepnetFishList` mask → StartPipeline
    - Scenario 3: In multi-select mode + no matched quest fish → Do nothing

##### Fish Item Interaction Events (UIController → Tofu)
- **EventOnFishItemClicked(int fishIndex, bool isSelected)**: 点击鱼图标
  - Thrown by: `FishMarketKeeperUIController` via `FishMarketFishItemUIController`
  - Handler: `FishMarketUITaskCompKeeperTofu`
  - Action: Toggle selection state → Update UI
- **EventOnSortTypeChanged(FishSortType sortType)**: 切换排序类型
  - Thrown by: `FishMarketKeeperUIController` (dropdown)
  - Handler: `FishMarketUITaskCompKeeperTofu`
  - Action: Call `SortTypeSet(sortType)` → Set `RefreshKeepnetFishList` mask → StartPipeline
- **EventOnSelectAllClicked()**: 全选按钮点击
- Thrown by: `FishMarketKeeperUIController`
  - Handler: `FishMarketUITaskUITaskCompMainTofu` delegates to KeeperTofu
  - Action: Toggle select all fish → Update UI

##### Sell Confirmation Events (UIController → Tofu)
- **EventOnSellConfirmClosed()**: 确认弹窗关闭
  - Thrown by: `FishMarketSellConfirmUIController`
  - Handler: `FishMarketUITaskCompMainTofu`
  - Action: Switch to default hotkey mode
- **EventOnSellConfirmConfirmed()**: 确认动画结束
- Thrown by: `FishMarketSellConfirmUIController`
  - Handler: `FishMarketUITaskCompMainTofu`
  Action: Restore hotkey response → Refresh `SellFinish` mask → StartPipeline
- **EventOnSellConfirmConfirmedBegin()**: 确认动画开始
- Thrown by: `FishMarketSellConfirmUIController`
- Handler: `FishMarketUITaskCompMainTofu`
  Action: Block hotkey response
- **EventOnSellButtonClicked()**: 售卖按钮点击
- - Thrown by: `FishMarketSellConfirmUIController`
- Handler: `FishMarketUITaskCompSellConfirmTofu`
  - Action: Validate selection → If empty, show toast → Else launch confirm check NetTask

---

## Phase 2: Data Flow Architecture

### Data Input Sources

#### Initialization Input
- **UIIntent Parameters** (Parsed in `UpdateContextSetup`):
  - `PanelCloseCallbackKey`: `Action` - 关闭回调函数
  - `ParamKeyPipelineUpdateMask`: `PipelineUpdateMask` - 管线刷新掩码
  - `ParamKeySelectedFishList`: `List<FishMarketFishItemInfo>` - 选中的鱼列表（传递给确认弹窗）
  - `ParamKeySelectedFishIndicesList`: `List<int>` - 选中的鱼索引列表（传递给确认弹窗）

- **Data Provider Mode**:
  - Default: `RealKeeperDataProvider` - 从真实逻辑层获取数据
  - Test: `MockupKeeperDataProvider` - Mock 数据用于开发调试

#### Asynchronous Input
- **Server Push Events**:
  - `EventOnFishMarketQuestRefreshNtf(int fishingLevelConfId, int index, ProFishMarketQuestInfo questInfo)`
  - Handled by: `FishMarketUITaskCompQuestTofu`
  - Action: Parse quest info → Update `m_questInfoList` → Set `RefreshQuestList` mask → StartPipeline

- **Network Responses**:
  - `FishMarketQuestCompleteAck`: 奖励领取成功响应
  - Handled by: `FishMarketUITaskCompMainTofu`
  - Action: Update currency → Play animation → Refresh lists
  - `SellFishAck`: 卖鱼成功响应
  - Handled by: `FishMarketUITaskCompMainTofu` (via KeeperTofu)
  - Action: Update currency → Refresh lists with `SellFinish` mask

### Data Transformation Logic (DataCacheUpdate)

#### In DataCacheUpdate Stage (QuestTofu)

**Quest Data Transformation**:
```csharp
// Raw server data → Display data transformation
FishMarketQuestInfo questInfo → QuestViewData

// 1. Query config for task description
string taskDesc = ConfigData.GetQuestDescription(questInfo.m_taskConfigId);

// 2. Query config for fish name and icon
string fishName = ConfigData.GetFishName(questInfo.m_requiredFishId);
string iconPath = ConfigData.GetFishIcon(questInfo.m_requiredFishId, questInfo.m_minWeightRequired);

// 3. Calculate target condition display text
string conditionText = questInfo.m_minWeightRequired > 0
    ? $"> {questInfo.m_minWeightRequired}kg"
    : string.Empty;

// 4. Calculate progress display text
string progressText = $"{questInfo.m_currentProgress}/{questInfo.m_requiredCount}";

// 5. Calculate remaining time
float remainingSeconds = (float)(questInfo.m_endTime - GetCurrentGameTime());
TimeSpan remainingTime = TimeSpan.FromSeconds(remainingSeconds);

// 6. Format time display (天/小时, 小时/分, 分/秒)
string timeDisplay = FormatTimeDisplay(remainingTime);

// 7. Determine if time running out (last 30 minutes)
bool isTimeRunningOut = remainingSeconds < 30 * 60;

// 8. Parse reward
string rewardText = ParseRewardText(questInfo.m_rewardType, questInfo.m_rewardSilverCoin);

// 9. Determine quest state from logical state
QuestState state = DetermineQuestState(questInfo.m_isReachCondition,
                                       questInfo.m_hasClaimed);

// 10. Build QuestViewData
QuestViewData viewData = new QuestViewData
{
    m_questId = questInfo.m_questId,
    m_questDescription = taskDesc,
    m_requiredFishName = fishName,
    m_requiredFishIconPath = iconPath,
    m_targetConditionText = conditionText,
    m_targetValueText = questInfo.m_requiredCount.ToString(),
    m_currentProgressText = progressText,
    m_remainingSeconds = remainingSeconds,
    m_remainingTimeDisplay = timeDisplay,
    m_isTimeRunningOut = isTimeRunningOut,
    m_questRewardText = rewardText,
    m_questState = state
};
```

#### In DataCacheUpdate Stage (KeeperTofu)

**Fish Data Transformation**:
```csharp
// Raw fish data → Display data transformation
FishInfo fishInfo → KeeperFishViewData

// 1. Format freshness percentage
int freshnessPercent = (int)(m_freshnessPercent * 100);
string freshnessText = $"{freshnessPercent}%";

// 2. Calculate freshness display (red at 0%)
bool isFreshnessZero = fishInfo.m_freshnessPercent == 0;

// 3. Format price text (highlight sell price)
string sellPriceText = fishInfo.m_sellPrice.ToString();

// 4. Format weight text
string weightText = FormatWeight(fishInfo.m_weight); // Unit auto-progress: g/kg/t, max 4 significant digits

// 5. Format length text
string lengthText = FormatLength(fishInfo.m_length); // Unit auto-progress: cm/m

// 6. Format quality text
string qualityText = FormatQuality(fishInfo.m_quality);

// 7. Map quality type
FishQualityType qualityType = MapQualityType(fishInfo.m_quality);

// 8. Determine task fish status
bool isTaskFish = fishInfo.m_matchedQuestIds.Count > 0;
bool isTaskFishValid = isTaskFish && !isFreshnessZero;

// 9. Build KeeperFishViewData
KeeperFishViewData viewData = new KeeperFishViewData
{
    m_iconPath = fishInfo.m_iconPath,
    m_fishName = fishInfo.m_fishName,
    m_qualityType = qualityType,
    m_freshnessPercent = freshnessPercent,
    FishMarketFishItemFormatter.freshnessPercent = freshnessPercent,
    m_freshnessPercentDisplay = freshnessText,
    m_sellPriceText = sellPriceText,
    m_weightText = weightText,
    m_lengthText = lengthText,
    m_isTaskFish = isTaskFish,
    m_isTaskFishValid = isTaskFishValid,
    m_isFreshnessZero = isFreshnessZero,
    m_index = fishInfo.m_fishIndex
};
```

**Sorting Logic**:
```csharp
// Sort keeper fish list based on sort type
List<FishMarketFishItemInfo> sortedList = m_keeperFishList.Clone();

switch (m_sortType)
{
    case FishSortType.Time:
        sortedList.Sort((a, b) => b.m_catchTimestamp.CompareTo(a.m_catchTimestamp));
        break;

    case FishSortType.Rare:
        sortedList.Sort((a, b) => MapQualityToSortValue(b.m_quality).CompareTo(MapQualityToSortValue(a.m_quality)));
        break;

    case FishSortType.Weight:
        sortedList.Sort((a, b) => b.m_weight.CompareTo(a.m_weight));
        break;

    case FishSortType.Price:
        sortedList.Sort((a, b) => b.m_sellPrice.CompareTo(a.m_sellPrice));
        break;

    case FishSortType.Quest:
        // Priority: Task fish first (isTaskFish=true), others by time
        sortedList.Sort((a, b) =>
        {
            int priorityA = a.m_isTaskFish ? 1 : 0;
            int priorityB = b.m_isTaskFish ? 1 : 0;

            if (priorityA != priorityB)
                return priorityB.CompareTo(priorityA);

            return b.m_catchTimestamp.CompareTo(a.m_catchTimestamp);
        });
        break;
}
```

#### In DataCacheUpdate Stage (SellConfirmTofu)

**Sell Data Transformation**:
```csharp
// Selected fish data → Display data transformation
List<FishMarketFishItemInfo> fishList → List<SellConfirmFishViewData>

foreach (var fish in fishList)
{
    SellConfirmFishViewData viewData = new SellConfirmFishViewData
    {
        m_fishName = fish.m_fishName,
        m_fishSizeStateText = FormatFishSizeState(fish.m_fishSizeType),
        m_sellPriceText = fish.m_sellPrice.ToString(),
        m_totalPriceText = totalPriceText // Calculated by MainTofu
    };
}
}
```

### Data Binding & Display (ViewUpdate)

#### PipelineUpdateMask-Driven Refresh

**MainTofu - ViewUpdate Stage**:
```csharp
public override void ViewUpdate(IUITaskUpdatePipelineController pipelineCtrl)
{
    // Only refresh when needed
    if (!IsUITaskUpdatePipelineInitOrResume() &&
        !m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshMain))
    {
        return;
    }

    // Refresh currency display
    CurrencyDisplayRefresh();

    // Quest list refresh
    if (m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshQuestList))
    {
        // Notify QuestTofu to refresh
        if (m_compQuestTofu != null)
        {
            // Use pipeline parameter for partial refresh
            var info = m_owner.CompUpdatePipelineManagerGet().UpdatePipelineInitInfoAlloc();
            info.m_customParamDict.SetParam(
                FishMarketUITask.ParamKeyPipelineUpdateMask,
                PipelineUpdateMask.RefreshQuestList);
            m_owner.CompUpdatePipelineManagerGet().UpdatePipelineLaunch(info);
        }
    }

    // Keeper list refresh
    if (m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshKeepnetFishList))
    {
        // Notify KeeperTofu to refresh
        if (m_compKeeperTofu != null)
        {
            var info = m_owner.CompUpdatePipelineManagerGet().UpdatePipelineInitInfoAlloc();
            info.m_customParamDict.SetParam(
                FishMarketUITask.ParamKeyPipelineUpdateMask,
                PipelineUpdateMask.RefreshKeepnetFishList);
            info.m_customParamDict.SetParam(
                FishMarketUITaskCompKeeperTofu.UpdateParamKey_KeeperTofu_SortByFishFilter,
                FishSortType.Time); // Default sort
            m_owner.CompUpdatePipelineManagerGet().UpdatePipelineLaunch(info);
        }
    }
}
```

**QuestTofu - ViewUpdate Stage**:
```csharp
public override void ViewUpdate(IUITaskUpdatePipelineController pipelineCtrl)
{
    if (!IsUITaskUpdatePipelineInitOrResume() &&
        !m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshQuestList))
    {
        return;
    }

    foreach (var questData in m_questInfoList)
    {
        var viewData = TransformQuestDataToViewData(questData);
        m_questUICtrl.QuestItemRefresh(viewData);
    }

    // Play quest complete animation if needed
    if (m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.PlayQuestCompleteAnim))
    {
        pipelineCtrl.UIProcessPlayInPipeline(m_questUICtrl.PlayQuestCompleteUIProcessGet());
    }

    // Play quest refresh animation if needed
    if (m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.PlayQuestRefreshAnim))
    {
        pipelineCtrl.UIProcessPlayInPipeline(m_questUICtrl.PlayQuestRefreshUIProcessGet());
    }
}
```

**KeeperTofu - ViewUpdate Stage**:
```csharp
public override void ViewUpdate(IUITaskUpdatePipelineController pipelineCtrl)
{
    if (!IsUITaskUpdatePipelineInitOrResume() &&
        !m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshKeepnetFishList))
    {
        return;
    }

    // Refresh fish list with sorting
    m_keeperUICtrl.ListViewRefresh(m_sortedFishViewDataList);

    // Update select all button state
    m_keeperUICtrl.SelectAllButtonStateUpdate(m_selectedCount == m_keeperFishList.Count);
}
```

### Dynamic Resource Collection (DynamicResCollect4Load)

```csharp
public override void DynamicResCollect4Load(ref List<string> resPathList)
{
    // Quest icons
    foreach (var questData in m_questInfoList)
    {
        if (!string.IsNullOrEmpty(questData.m_requiredFishIconPath))
        {
            resPathList.Add(questData.m_requiredFishIconPath);
        }
    }

    // Fish icons
    foreach (var fishViewData in m_sortedFishViewDataList)
    {
        if (!string.IsNullOrEmpty(fishViewData.m_iconPath))
        {
            resPathList.Add(fishViewData.m_iconPath);
        }
    }
}
```

---

## Phase 3: Event Handling Design

### UI Interaction Paths

#### Path 1: Quest Icon Click → Task Fish Auto-Select

**Scenario 1: Not in multi-select mode**
```
User clicks quest icon (event)
    ↓
FishMarketQuestUIController throws EventOnQuestItemClick(questId)
    ↓
FishMarketUITaskCompQuestTofu.HandleQuestClick(questId)
    ↓
Check current multi-select state: NOT in multi-select
    ↓
MainTofu.LaunchPipelineWithMask(
    PipelineUpdateMask.RefreshKeepnetFishList |
    PipelineUpdateMask.RefreshQuestList
)
    ↓
KeeperTofu receives quest fish condition list via pipeline
    ↓
KeeperTofu SortTypeSet(Quest) → Auto-select quest fish → Rebuild sorted list
    ↓
KeeperTofu.ListViewRefresh() → User sees quest fish prioritized and selected
```

**Scenario 2: Already in multi-select mode + has selected fish**
```
User clicks quest icon (event)
    ↓
FishMarketUITaskCompQuestTofu.HandleQuestClick(questId)
    ↓
Check current multi-select state: IN multi-select + has selected
    ↓
MainTofu.LaunchPipelineWithMask(
    PipelineUpdateMask.RefreshKeepnetFishList | PipelineUpdateMask.RefreshQuestList
)
    ↓
KeeperTofu SortTypeSet(Quest) → Sort by quest → Deselect non-quest fish
    ↓
KeeperTofu.ListViewRefresh() → User sees selection changed
```

**Scenario 3: In multi-select mode + no matched quest fish**
```
User clicks quest icon (event)
    ↓
FishMarketUITaskCompQuestTofu.HandleQuestClick(questId)
    ↓
Check current multi-select state: IN multi-select + no matched fish in current sort
    ↓
Do nothing (no UI change)
```

#### Path 2: Fish Item Click → Select/Deselect

```
User clicks fish icon
    ↓
FishMarketFishItemUIController toggles selection state
    ↓
FishMarketKeeperUIController throws EventOnFishItemClicked(fishIndex, isSelected)
    ↓
KeeperTofu updates m_keeperFishList[index].m_isSelected
    ↓
MainTofu updates m_selectedCount
```

#### Path 3: Sell Button Click → Confirmation Dialog

```
User clicks sell button
    ↓
FishMarketKeeperUIController throws EventOnSellFishRequest(selectedFish, selectedIndices)
    ↓
MainTofu.HandleSellFishRequest(selectedFish, selectedIndices)
    ↓
Check: selectedFish not empty
    ↓
MainTofu launches SellConfirmUITask with selected fish via Intent
    ↓
SellConfirmUITask displays confirmation dialog (via PipelinePlayConfirmSellUIProcess)
```

#### Path 4: Sell Confirmation → Network Request → Animation → Complete

```
User clicks confirm sell in SellConfirmUIController
    ↓
FishMarketSellConfirmUIController throws EventOnSellConfirmed()
    ↓
MainTofu.HandleSellConfirmConfirmed()
    ↓
Check: selected fish not empty
    ↓
MainTofu launches FishMarketSellReqNetTask
    ↓
MainTofu sets hotkey mode to SwitchSellConfirmMode (blocks ESC)
↓
FishMarketSellConfirmUIController plays sell animation
    ↓
After animation complete:
    ↓
FishMarketSellConfirmUIController throws EventOnSellConfirmConfirmedBegin()
    ↓
MainTofu FishMarketSellReqNetTask.EventOnStop += OnSellRequestCompleted
↓
NetTask completes successfully
    ↓
MainTofu.OnSellRequestCompleted(task)
    ↓
Update currency display → Play sell finish animation → Refresh lists with SellFinish mask
```

### Business Process Flows

#### Flow 1: Quest Progress Tracking
```
FishMarketQuestRefreshNtf received (server push)
    ↓
MainTofu.RefreshQuestList()
    ↓
QuestTofu parses quest info from server data
    ↓
QuestTofu checks quest conditions: IsFishMatchQuest(fish) for each fish
    ↓
QuestTofu updates quest progress → m_currentProgress
    ↓
When progress reaches target:
    ↓
QuestTofu checks m_isReachCondition from logic layer
    ↓
QuestTofu sets m_state to QuestState.Claimable
    ↓
Refresh UI with RefreshQuestProgress mask
    ↓
User sees "待领取" status with reward info
```

#### Flow 2: Quest Reward Claiming
```
User clicks claim button
    ↓
FishMarketQuestUIController throws EventOnQuestClaim(questId)
    ↓
MainTofu.HandleQuestClaim(questId)
    ↓
Check: quest is in Claimable state
    ↓
Launch FishMarketQuestCompleteReqNetTask(questId)
    ↓
NetTask completes successfully
    ↓
Play QuestClaimAnim → Play QuestCompleteAnim
↓
Update currency → Set quest state to Completed
↓
Refresh lists with RefreshQuestList mask
↓
User sees "已领取" status with reward received
```

#### Flow 3: Quest Refresh (Time-based)
```
Server time reaches quest m_endTime
    ↓
Server pushes FishMarketQuestRefreshNtf (new quest data)
    ↓
MainTofu.RefreshQuestList()
    ↓
QuestTofu replaces quest data in m_questInfoList
↓
Refresh UI with RefreshQuestList mask | PlayQuestRefreshAnim
↓
User sees new quest with refresh animation
```

#### Flow 4: Sell Fish with Task Fish Tracking

```
User sells fish (one or multiple)
    ↓
Check: Fish are from current level (跨关卡检测)
  - Check: fish.m_catchLevelConfId == current level
  - If NOT current level: Allow sell but don't count towards quest progress
    ↓
NetTask: FishMarketSellReqNetTask(fishList)
    ↓
NetTask completes successfully
    ↓
MainTofu identifies task fish in sold list
    ↓
Check: fish.m_matchedQuestIds.Count > 0
    ↓
MainTofu notifies QuestTofu: OnQuestFishSold(taskFishIds)
    ↓
QuestTofu identifies affected quests → Updates m_currentProgress
    ↓
MainTofu launches RefreshQuestList mask
    ↓
QuestTofu updates progress for affected quests
↓
KeeperTofu updates task fish markers (sell fish removed from quest fish)
↓
User sees updated quest progress and removed task fish markers
```

#### Flow 5: Countdown System

```
UIController.Update() runs every frame
    ↓
For each active quest:
    ↓
Calculate: remainingSeconds = m_endTime - GetCurrentGameTime()
    ↓
Calculate: isTimeRunningOut = remainingSeconds < 30 * 60
    ↓
Update time display text based on remainingSeconds:
    ↓
  - If remainingSeconds > 86400 (24 hours): Display as "X天X小时"
  - If remainingSeconds > 3600 (1 hour): Display as "X小时X分"
  - If remainingSeconds > 60 (1 minute): Display as "X分X秒"
  ↓
If isTimeRunningOut:
    ↓
Set time display text color to red
    ↓
User sees countdown turning red in last 30 minutes
```

#### Flow 6: Quest Fish Sort Request
```
MainTofu.HandleQuestFishSortRequest(questId)
    ↓
KeeperTofu.SortTypeSet(FishSortType.Quest)
    ↓
MainTofu.LaunchPipelineWithMask(
    PipelineUpdateMask.RefreshKeepnetFishList |
    PipelineUpdateMask.RefreshQuestProgress
)
    ↓
KeeperTofu performs Quest sort
    ↓
User sees quest fish moved to top of list, selected
```

---

## Phase 4: Pipeline Integration

### UpdatePipeline Steps Implementation

#### 1. PreProcessBeforePipelineStart (Not implemented for this UITask)
- MainTofu does not override this method

#### 2. DataCacheUpdate (Implemented in QuestTofu + KeeperTofu)

**QuestTofu.DataCacheUpdate()**:
```csharp
public override void DataCacheUpdate()
{
    base.DataCacheUpdate();

    // Only participate if RefreshQuestList mask is set
    if (!IsUITaskUpdatePipelineInitOrResume() &&
        !m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshQuestList))
    {
        return;
    }

    // Fetch fresh quest data from logic layer
    var questDataList = PlayerGameObjectGet().GetFishMarketQuestList();

    // Update cached data
    m_questInfoList.Clear();
    foreach (var questData in questDataList)
    {
        m_questInfoList.Add(ParseQuestData(questData));
    }

    // Build quest fish condition list for KeeperTofu
    QuestFishConditionList conditionList = QuestFishConditionList.CreateFromQuestDataList(m_questInfoList);

    // Pass condition list to KeeperTofu via pipeline parameter
    if (m_compKeeperTofu != null)
    {
        // Trigger KeeperTofu refresh pipeline with condition list
        var keeperInfo = m_owner.CompUpdatePipelineManagerGet().UpdatePipelineInitInfoAlloc();
        keeperInfo.m_customParamDict.SetParam(
            FishMarketUITaskCompKeeperTofu.UpdateParamKey_KeeperTofu_QuestFishConditions,
            conditionList);
        m_owner.CompUpdatePipelineManagerGet().UpdatePipelineLaunch(keeperInfo);
    }
    }
}
```

**KeeperTofu.DataCacheUpdate()**:
```csharp
public override void DataCacheUpdate()
{
    base.DataCacheUpdate();

    // Check if need to refresh fish list
    bool needRefresh = IsUITaskUpdatePipelineInitOrResume() ||
                      m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshKeepnetFishList);

    if (!needRefresh)
    {
        return;
    }

    // Get quest fish conditions from pipeline parameter
    var conditionList = paramDict.GetClassParam<QuestFishConditionList>(
        FishMarketUITaskCompKeeperTofu.UpdateParamKey_KeeperTofu_QuestFishConditions);

    // Fetch fish data from data provider
    var fishList = m_dataProvider.GetFishList();

    // Build m_keeperFishList from fish data and quest conditions
    m_keeperFishList.Clear();

    foreach (var fishInfo in fishList)
    {
        var keeperFishInfo = new FishMarketFishItemInfo
        {
            m_fishIndex = fishInfo.m_fishIndex,
            m_fishInfoConfId = fishInfo.m_fishInfoConfId,
            m_fishType = (FishType)fishInfo.m_fishType,
            m_fishName = fishInfo.m_fishName,
            m_quality = fishInfo.m_quality,
            m_fishSizeType = fishInfo.m_fishSizeType,
            m_pushDateTime = fishInfo.m_pushDateTime,
            m_sellPrice = fishInfo.m_sellPrice,
            m_weight = fishInfo.m_weight,
            m_length = fishInfo.m_length,
            m_iconPath = GetIconPath(fishInfo.m_fishInfoConfId),
            m_freshnessPercent = CalculateFreshnessPercent(fishInfo.m_pushDateTime),
            // Build matched quest IDs list
            m_matchedQuestIds = BuildMatchedQuestIds(fishInfo, conditionList)
        };

        m_keeperFishList.Add(keeperFishInfo);
    }

    // Apply sorting
    ApplySortingLogic(m_keeperFishList);
}
```

#### 3. DynamicResLoadIsNeededCheck

**QuestTofu**:
```csharp
public override bool DynamicResLoadIsNeededCheck()
{
    return IsUITaskUpdatePipelineInitOrResume() ||
           m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshQuestList);
}
```

**KeeperTofu**:
```csharp
public override bool DynamicResLoadIsNeededCheck()
{
    return IsUITaskUpdatePipelineInitOrResume() ||
           m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshKeepnetFishList);
}
```

**MainTofu**:
```csharp
public override bool DynamicResLoadIsNeededCheck()
{
    return false; // MainTofu delegates to child Tofus for resource management
}
```

#### 4. DynamicResCollect4Load

**QuestTofu**:
```csharp
public override void DynamicResCollect4Load(ref List<string> resPathList)
{
    base.DynamicResCollect4Load(ref resPathList);

    // Collect fish icons for quest items
    foreach (var questData in m_questInfoList)
    {
        if (!string.IsNullOrEmpty(questData.m_requiredFishIconPath))
        {
            resPathList.Add(questData.m_requiredFishIconPath);
        }
    }
}
```

**KeeperTofu**:
```csharp
public override void DynamicResCollect4Load(ref List<string> resPathList)
{
    base.DynamicResCollect4Load(ref resPathList);

    // Collect fish icons for all fish in keeper
    foreach (var fishViewData in m_sortedFishViewDataList)
    {
        if (!string.IsNullOrEmpty(fishViewData.m_iconPath))
        {
            resPathList.Add(fishViewData.m_iconPath);
        }
    }
}
```

#### 5. ViewUpdate (Implemented in All Tofus + Controller Callers)

**QuestTofu.ViewUpdate()**:
```csharp
public override void ViewUpdate(IUITaskUpdatePipelineController pipelineCtrl)
{
    if (!IsUITaskUpdatePipelineInitOrResume() &&
        !m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshQuestList))
    {
        return;
    }

    // Refresh quest list items
    foreach (var questData in m_questInfoList)
    {
        var viewData = TransformQuestDataToViewData(questData);
        m_questUICtrl.QuestItemRefresh(viewData);
    }

    // Play animations if needed
    if (m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.PlayQuestCompleteAnim))
    {
        pipelineCtrl.UIProcessPlayInPipeline(m_questUICtrl.PlayQuestCompleteUIProcessGet());
    }

    if (m_currPipelineUpdateMask.HasFlag(PuestRefreshAnim))
    {
        pipelineCtrl.UIProcessPlayInPipeline(m_questUICtrl.QuestRefreshUIProcessGet());
    }
}
```

**KeeperTofu.ViewUpdate()**:
```csharp
public override void ViewUpdate(IUITaskUpdatePipelineController pipelineCtrl)
{
    if (!IsUITUpdatePipelineInitOrResume() ||
        !m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshKeepnetFishList))
    {
        return;
    }

    // Refresh fish list
    m_keeperUICtrl.ListViewRefresh(m_sortedFishViewDataList);

    // Update select all button state
    m_keeperUICtrl.SelectAllButtonStateUpdate(m_selectedCount == m_keeperFishList.Count);
}
```

**MainTofu.ViewUpdate()**:
```csharp
public override void ViewUpdate(IUITaskUpdatePipelineController pipelineCtrl)
{
    if (!IsUITaskUpdatePipelineInitOrResume() &&
        !m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshMain))
    {
        return;
    }

    // Refresh currency display
    CurrencyDisplayRefresh();

    // Trigger child Tofu refreshes via PipelineUpdateMask
    if (m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshQuestList))
    {
        if (m_compQuestTofu != null)
        {
            var info = m_owner.CompUpdatePipelineManagerGet().UpdatePipelineInitInfoAlloc();
            info.m_customParamDict.SetParam(
                FishMarketUITask.ParamKeyPipelineUpdateMask,
                PipelineUpdateMask.RefreshQuestList);
            m_owner.CompUpdatePipelineManagerGet().UpdatePipelineLaunch(info);
        }
    }

    if (m_currPipelineUpdateMask.HasFlag(PipelineUpdateMask.RefreshKeepnetFishList))
    {
        if (m_compKeeperTofu != null)
        {
            var info = m_owner.CompUpdatePipelineManagerGet().UpdatePipelineInitInfoAlloc();
            info.m_customParamDict.SetParam(
                FishMarketUITask.ParamKeyPipelineUpdateMask,
                PipelineUpdateMask.RefreshKeepnetFishList);
            m_owner.CompUpdateManagerGet().UpdatePipelineLaunch(info);
        }
    }
}
```

#### 6. PostOnPipelineCompleted (Not explicitly overridden)

### Special Considerations

##### Countdown Update (Not Pipeline-Driven)
- **Location**: `QuestUIController.Update()` method
- **Reason**: Real-time countdown doesn't need pipeline overhead
- **Data Source**: `m_questInfoList[index].m_remainingSeconds` calculated in DataCacheUpdate
- **Logic**:
  ```csharp
  // In QuestUIController.Update():
  DateTime serverTime = GetCurrentGameTime();
  foreach (var questData in m_questInfoList)
  {
      if (questData.m_state == QuestState.InProgress)
      {
          float remaining = (float)(questData.m_endTime - serverTime);
          questData.m_remainingSeconds = Math.Max(0, remaining);

          bool isTimeRunningOut = remaining < 30 * 60;
          questData.m_isTimeRunningOut = isTimeRunningOut;

          QuestItemUIController itemCtrl = m_questUICtrl.GetQuestItemController(questData.m_questIndex);
          if (itemCtrl != null)
          {
              itemCtrl.UpdateTimeDisplay(questData.m_remainingSeconds, isTimeRunningOut);
          }
      }
  }
  ```
- **Server Time Access**:
  ```csharp
  protected DateTime GetCurrentGameTime()
  {
      return (GameManager.Instance?.PlayerContext as ProjectEFPlayerContext)?
             .PlayerGameObjectGet()?.ServerTimeAsDateTimeGet() ??
             Timer.s_currTime;
  }
  ```

##### Task Fish Marking Logic
**Condition Check in KeeperTofu.DataCacheUpdate()**:
```csharp
foreach (var fishInfo in fishList)
{
    bool isTaskFish = fishInfo.m_isTaskFish;
    bool isFreshnessZero = fishInfo.m_freshnessPercent == 0;

    // New freshness format: 0%, 100% (red at 0%)
    fishInfo.FishMarketFishItemFormatter.freshnessPercent = (int)(fishInfo.m_freshnessPercent * 100);
    fishInfo.FishMarketFishItemFormatter.freshnessPercentDisplay = $"{fishInfo.FishMarketFishItemFormatter.freshnessPercent}%";

    // Only show task fish icon for active InProgress quests
    if (!isTaskFish)
    {
        fishInfo.m_matchedQuestIds.Clear();
    }
}
```

##### Sorting with Task Priority
**In KeeperTofu.DataCacheUpdate()**:
```csharp
private void ApplySortingLogic(List<FishMarketFishItemInfo> fishList)
{
    m_sortedFishViewDataList.Clear();

    List<FishMarketFishItemInfo> taskFishList = new List<FishMarketFishItemInfo>();
    List<FishMarketFishItemInfo> otherFishList = new List<FishMarketFishItemInfo>();

    foreach (var fish in fishList)
    {
        if (fish.m_isTaskFish)
        {
            taskFishList.Add(fish);
        }
        else
        {
            otherFishList.Add(fish);
        }
    }

    // Sort task fish by catch time (newest first for quest fish)
    taskFishList.Sort((a, b) => b.m_catchTimestamp.CompareTo(a.m_catchTimestamp));

    // Sort other fish by current sort type
    ApplySortTypeToFishList(otherFishList, m_sortType);

    // Task fish first, then sorted other fish
    m_sortedFishViewDataList.AddRange(taskFishList);
    m_sortedFishViewDataList.AddRange(otherFishList);
}
```

---

## Design Checklist Verification

### Phase 1: Semantic Decomposition Checklist
- [x] All nouns mapped to appropriate data storage locations
  - [x] Quest data → `m_questInfoList` in QuestTofu
  - [x] Keeper data → `m_keeperFishList` in KeeperTofu
  - [x] Currency data → `m_goldCoin`, `m_silverCoin` in MainTofu
  - [x] QuestViewData passed to Controller via method call
  - [x] KeeperFishViewData passed to Controller via method call
- [ ] Display data models use simple types for UI binding

- [x] Business Logic Events mapped:
  - [x] EventOnQuestRefreshNtf → Pipeline refresh
  - [x] EventOnQuestClaim → NetTask → Mask refresh
  - [x] EventOnSellFishRequest → NetTask → Mask refresh
  - [x] EventOnQuestFishSortRequest → Sort → List refresh
  - [ ] Interaction Logic Events map UI input to events

### Phase 2: Data Flow Architecture Checklist
- [x] Data Input Sources identified:
  - [x] UIIntent parameters in `UpdateContextSetup`
  - [x] Server push events for quest refresh
  - [ ] Network responses for sell and claim
- [ ] Data Provider pattern for testability

- [x] Data Transformation Logic in DataCacheUpdate:
  - [x] Quest config query → Display data transformation
  - [x] Fish data → Display data transformation with formatting
  - [x] Sorting logic based on sort type
  - [x] Task fish priority sorting (task fish first)

- [x] Data Binding & Display:
  - [x] PipelineUpdateMask-driven refresh strategy
  - [x] Controller receives simple ViewData via method calls
  - [ ] No direct logic layer access from Controllers

### Phase 3: Event Handling Design Checklist
- [x] UI Interaction Paths defined:
  - [x] Quest icon click (3 scenarios)
  - [x] Fish item select/deselect
  - [x] Sell flow: button → confirmation → animation → complete
  - [x] Countdown system (Update-based, not pipeline)
  - [x] Quest fish sort request flow

- [x] Business Process Flows defined:
  - [x] Quest progress tracking
  - [x] Quest reward claiming
  - [x] Time-based quest refresh
  - [x] Sell fish with task fish tracking
  - [ ] Cross-level detection for quest fish

- [ ] Event bubbling pattern established:
  - [x] UIController → SubTofu → Event → MainTofu coordination
  - [x] MainTofu launches child Tofu via PipelineUpdateMask
  - [ ] Child Tofu throws events back up via Action delegates

### Phase 4: Pipeline Integration Checklist
- [x] UpdatePipeline steps implemented:
  - [x] DataCacheUpdate in all Tofus
  - [x] DynamicResLoadIsNeededCheck in QuestTofu + KeeperTofu
  - [x] DynamicResCollect4Load in QuestTofu + KeeperTofu
  - [x] ViewUpdate in all Tofus

- [ ] Mask-driven refresh strategy:
  - [x] `RefreshKeepnetFishList` - Refresh keeper list
  - [x] `RefreshQuestList` - Refresh quest list
  - [x] `RefreshQuestProgress` - Partial progress update
  - [x] `RefreshMain` - Currency display
  - [x] `PlayQuestCompleteAnim` - Animation trigger
  - [x] `PlayQuestClaimAnim` - Animation trigger
  - [x] `PlayQuestRefreshAnim` - Animation trigger
  - [x] `PlayConfirmSellUIProcess` - Animation trigger
  - [x] `SellFinish` - Post-animation refresh

- [ ] Countdown system (NOT pipeline-driven):
  - [x] Implemented in QuestUIController.Update()
  - [x] Server time access via GetCurrentGameTime()
  - [x] Last 30 minutes red color warning

### Additional Considerations

#### Mode Management
- [ ] Mode definitions established for hotkey handling
- [ ] SwitchSellConfirmMode blocks ESC during sell animation
- [ ] Default mode for normal operation

#### Task Fish Marking
- [ ] Task fish icon only shown for InProgress quests
- [ ] Grayed when freshness 0%
- [ ] Click tooltip for freshness 0% fish

#### Cross-Level Detection
- [ ] Check: `fish.m_catchLevelConfId == currentLevel` in sell Check
- [ ] Non-current level fish can be sold but don't count towards quest progress

#### Data Provider Pattern
- [ ] Interface-based design for testability
- [ ] RealKeeperDataProvider for production
- [ ] MockupKeeperDataProvider for development/debugging
- [ ] Factory pattern for provider instantiation

---

## Architecture Compliance Summary

### Separation of Concerns

| Layer | Responsibility | Pattern |
|-------|-------------|---------|
| **UITask** | Facade, component registration, Intent parameter definitions | FishMarketUITask |
| **MainTofu** | High-level orchestration, currency refresh, sell coordination | FishMarketUITaskCompMainTofu |
| **QuestTofu** | Quest data cache, config query, state management, progress tracking | FishMarketUITaskCompQuestTofu |
| **KeeperTofu** | Fish list cache, sorting logic, selection state management | FishMarketUITaskCompKeeperTofu |
| **SellConfirmTofu** | Confirm dialog coordination, sell completion | FishMarketUITaskCompSellConfirmTofu |
| **UIControllers** | UI display, animation, input → event conversion | No business logic |

### Data Flow Rules

1. **All transformations in DataCacheUpdate stage**
   - ✅ Quest config queries → QuestViewData
   - ✅ Fish raw data → KeeperFishViewData
   - ✅ Sorting based on sort type

2. **Controller receives simple ViewData via method calls**
   - ✅ No direct logic layer access
   - ✅ No direct network calls

3. **PipelineUpdateMask-driven refresh strategy**
   - ✅ Mask bits control refresh scope
   - ✅ Partial refresh possible (`RefreshQuestProgress`, `RefreshQuestList`)
   - ✅ Animation triggers via separate mask bits

4. **Event bubbling through delegates**
   - ✅ UIController → SubTofu → MainTofu
   - ✓ MainTofu coordinates via PipelineUpdateMask

### Key Design Decisions

1. **Countdown in Update, not Pipeline**
   - Rationale: Real-time countdown needs frequent updates
   - Location: `QuestUIController.Update()`
   - Data Source: Pre-calculated in DataCacheUpdate

2. **Data Provider Pattern**
   - Rationale: Testability and flexibility
   - Implementation: Interface + Factory pattern
   - Switching between Real/Mock providers at runtime for testing

3. **Task Fish Priority Sorting**
   - Rationale: Task fish should be easily accessible
   - Implementation: Separate task fish list, sort by time, concatenate with other fish

4. **Quest Fish Condition List**
   - Rationale: Decouple QuestTofu from quest config knowledge
   - Implementation: Parsed in QuestTofu, passed to KeeperTofu via pipeline

5. **Hotkey Mode Switching for SellConfirm**
   - Rationale: Prevent accidental ESC during sell animation
   - Implementation: MainTofu sets `TofuShouldRespondHotKey = false` during animation

6. **Partial Refresh Support**
   - Rationale: Optimize refresh performance
   - Implementation: `RefreshQuestProgress` for progress updates without full list rebuild

---

## Summary

This data flow design transforms the PRD requirements into a clean, BJF-compliant architecture that:

1. **Separates concerns** across Quest/Keeper/Main/SellConfirm domains
2. **Leverages PipelineUpdateMask** for fine-grained UI refresh control
3. **Implements event bubbling** through Action delegates
4. **Uses data provider pattern** for testability
5. **Handles real-time countdown** efficiently via UIController.Update
6. **Supports complex sorting logic** with task fish priority
7. **Manages cross-level validation** for quest fish
8. **Provides flexible animation triggers** via separate mask bits

All business logic is encapsulated in Tofus, Controllers remain pure display/input conversion layers, and the UITask acts as a clean facade coordinating all components through the standard BJF pipeline architecture.
