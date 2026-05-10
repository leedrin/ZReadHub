# BJF Data Flow Design - FishMarketUITask Phase 2

---

## Phase 1: Semantic Decomposition

### Noun Analysis

#### Business Data Entities (Logic Data)
- **FishMarketQuestInfo**: Mapped to `m_questInfoList` in `FishMarketUITaskCompQuestTofu`
  - 任务ID、目标条件、进度、状态、倒计时、奖励、所属关卡
- **KeeperFishData**: Mapped to `m_keeperFishList` in `FishMarketUITaskCompKeeperTofu`
  - 鱼ID、体型、重量、新鲜度、价格、品质、钓获时间、任务鱼标记
- **CurrencyData**: Mapped to `m_goldCoin`, `m_silverCoin` in `FishMarketUITaskCompMainTofu`
  - 玩家金币、银币数量
- **SellConfirmData**: Mapped to `m_sellFishList` in `FishMarketUITaskCompSellConfirmTofu`
  - 确认售卖的鱼列表、总价

#### Display Data Models (Display Data)
- **QuestViewData**: Transformed from quest config, passed to `FishMarketQuestUIController`
  - 任务描述、鱼图标路径（最小体型/成年体）、目标文本、进度文本、倒计时文本、状态标识、奖励预览
- **KeeperFishViewData**: Transformed from keeper fish, passed to `FishMarketKeeperUIController`
  - 图标路径、名称、品质、新鲜度百分比、售卖价格、重量文本、任务鱼标记状态
- **SellConfirmViewData**: Simple data type for UI binding
  - 鱼名称、大小状态、单价、总价

#### Verb Analysis

- **Business Logic Events**:
  - `EventOnFishMarketQuestRefreshNtf`: Triggered by server notification, handled in `FishMarketUITaskCompQuestTofu`
  - Triggers pipeline refresh to update task list
- `FishMarketQuestCompleteReq`: Processed through NetTask in `FishMarketUITaskCompMainTofu`
  - Check → NetTask → SetMask → StartPipeline flow
- `FishMarketSellReq`: Processed through NetTask in `FishMarketUITaskCompMainTofu`
  - Check: 跨关卡检测、新鲜度0%处理
  - NetTask: Send sell request
  - Refresh: After success, modify DataCache, set Mask bits

- **Interaction Logic Events**:
  - `EventOnQuestItemClick`: Thrown by `FishMarketQuestUIController`
  - Three scenarios based on multi-select state
  - `EventOnFishItemClicked`: Thrown by `FishMarketKeeperUIController`
  - Toggle selection state
  - `EventOnSortTypeChanged`: Thrown by `FishMarketKeeperUIController`
  - Switch sort type: Time, Quality, Weight, Price, Quest
  - `EventOnSelectAllClicked`: Thrown by `FishMarketKeeperUIController`
  - Select/deselect all fish
  - `EventOnSellClicked`: Thrown by `FishMarketKeeperUIController`
  - Trigger sell confirmation dialog
  - `EventOnSellConfirmed`: Thrown by `FishMarketSellConfirmUIController`
  - Confirm sell operation with fish list and total price

---

## Phase 2: Data Flow Architecture

### Data Input Sources

- **Initialization**: `FishMarketUITask.FishMarketPanelOpen()` → `FishMarketUITaskCompMainTofu.UpdateContextSetup()`
  - Parse parameters from UIIntent if any
- **Asynchronous**: Server responses → `FishMarketUITaskCompQuestTofu` or `FishMarketUITaskCompMainTofu`
  - Task refresh notification via `EventOnFishMarketQuestRefreshNtf`
  - Sell confirm dialog via `EventOnSellConfirmed`
- Player data access: `PlayerGameObject.FishMarketQuestListGet()`, `KeeperFishListGet()`

### Data Transformation Logic

#### In DataCacheUpdate Stage

**QuestTofu - Task Data Transformation**:
- `RawData (from PlayerContext + Config)` → `QuestViewData`:
  - `ProFishMarketQuestInfo[] questList` → Extract task config data
  - `quest.ConfigId` → Query `FishMarketQuestPoolConfig.ConfigGet()`
  - `quest.RequiredFishId` → Get fish name and icon from FishInfoConfig
  - `quest.WeightCondition` → Build condition text: "大于 X 公斤"
  - `quest.EndTime` → Calculate countdown text: 天/小时、小时/分、分/秒
  - `quest.RequiredCount` vs `quest.CurrentProgress` → Build progress text: "X/Y"
  - `quest.State` → Map to status identifier: InProgress, CompleteWaitClaim, Claimed
  - `quest.Reward` → Parse reward info: type, value, icon path
  - `quest.FishingLevelConfId` → Check for current level matching

**Icon Path Selection**:
  - `If has weight condition`: Get minimum body size icon path from FishInfoConfig
  - `If no weight condition`: Use adult body icon path from FishInfoConfig

**KeeperTofu - Fish Data Transformation**:
- `RawData (from PlayerContext)` → `KeeperFishViewData`:
  - `fish.FishInfoConfigId` → Get fish name from FishInfoConfig
  - `fish.Weight` → Format weight text: 自动进位（cm/m/kg/t），最多4位有效数字
  - `fish.Length` → Format length text: 自动进位（cm/m），最多4位有效数字
  - `fish.FishQuality` → Get quality icon/color mapping from FishInfoConfig
  - `fish.PushDateTime` → Calculate freshness: 24h decay from 100% to 0%
  - `freshness = max(0, 1 - (DateTime.Now - fish.PushDateTime).TotalHours / 24f)`
  - `fish.CatchLevelConfId` → For cross-level detection
  - `fish.IsTaskFish` → Match against quest conditions
- **Price Calculation**:
  - `If freshness == 0%`: Use juvenile body price
  - `Else`: Use configured price based on quality and size

**MainTofu - Currency Data Transformation**:
- `RawData (from PlayerContext)` → `long goldCoin, long silverCoin`:
  - `PlayerGameObject.CurrencyValueGet(CurrencyType.GoldCoin)` → `goldCoin`
  - `PlayerGameObject.CurrencyValueGet(CurrencyType.SilverCoin)` → `silverCoin`

**MainTofu - Sell Confirm Data Transformation**:
- `SelectedFishData` → `SellConfirmViewData`:
  - `List<FishMarketFishItemInfo> selectedFish` → Extract fish name, size status
  - Price calculation: Sum all selected fish prices
- `Size Status`:
  - `If fish.IsJuvenile`: "幼年体"
  - `If fish.IsAdult`: "成年体"
  - `If fish.IsMature`: "巨物"

#### Data Binding & Display

- **PipelineUpdateMask**:

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

- **Execution Process**:
   1. Tofu checks Mask bits in `ViewUpdate()`
  2. Tofu calls `m_uiCtrl.RefreshXxx(data)` based on Mask
  3. UIController receives simple data, executes `Text.text = data` or state machine switches

---

## Phase 3: Event Handling Design

### UI Interaction Paths

#### Quest Item Click Paths

**Scene 1: Not in multi-select state**:
```
[User Action] Click task icon
    ↓
[FishMarketQuestUIController.OnQuestItemClick]
    ↓
Throw EventOnQuestItemClick(questId, questIndex)
    ↓
[FishMarketUITaskCompMainTofu.HandleQuestItemClick(questId, questIndex)]
    ↓
Check: Is currently in multi-select mode?
    - NO: 
    → Set KeeperTofu mode to FishMarket (from Keepnet)
    → Get quest fish IDs from QuestTofu.GetQuestFishIds()
    → Set KeeperTofu sort type to FishSortType.Quest
    → Auto-select quest fish by indices
    → Launch pipeline with Mask: RefreshKeepnetFishList
    - YES:
    → Set KeeperTofu sort type to FishSortType.Quest
    → Deselect non-quest fish
    → Select quest fish by indices
    → Launch pipeline with Mask: RefreshQuestProgress
```

**Scene 2: In multi-select state + some fish already selected**:
```
[User Action] Click task icon
    ↓
[FishMarketQuestUIController.OnQuestItemClick]
    ↓
Throw EventOnQuestItemClick(questId, questIndex)
    ↓
[FishMarketUITaskCompMainTofu.HandleQuestItemClick(questId, questIndex)]
    ↓
Check: Already in multi-select state?
    - YES:
    → Get selected fish list
    → Deselect fish that don't match this quest
    → Select quest fish that matches this quest
    → Launch pipeline with Mask: RefreshQuestProgress
```

**Scene 3: In multi-select state + no quest fish matched**:
```
[User Action] Click task icon
    ↓
[FishMarketQuestUIController.OnQuestItemClick]
    ↓
Throw EventOnQuestItemClick(questId, questIndex)
    ↓
[FishMarketUITaskCompMainTofu.HandleQuestItemClick(questId, questIndex)]
    ↓
Check: Already in multi-select state?
    - YES:
    → Check if clicked quest has matching fish
    - NO MATCHING fish:
        → Do nothing, return
```

#### Fish Item Click Paths

```
[User Action] Click fish item in keeper list
    ↓
[FishMarketKeeperUIController.OnFishItemClicked(fishId, fishIndex)]
    ↓
Throw EventOnFishItemClicked(fishId, fishIndex)
    ↓
[FishMarketUITaskCompKeeperTofu.HandleFishItemClicked(fishId, fishIndex)]
    ↓
Check: Is fish already selected?
- YES: Deselect it
- NO: Select it
→ Launch pipeline with Mask: RefreshQuestProgress
```

#### Sort Type Changed Paths

```
[User Action] Change sort type dropdown
    ↓
[FishMarketKeeperUIController.OnSortTypeChanged(FishSortType sortType)]
    ↓
Throw EventOnSortTypeChanged(sortType)
    ↓
[FishMarketUITaskCompKeeperTofu.HandleSortTypeChanged(sortType)]
    ↓
Check: Does sort type affect quest fish?
- YES:
  → Update KeeperTofu sort type
  → Sort fish list: quest fish first, others by current sort type
  → Launch pipeline with Mask: RefreshKeepnetFishList
- NO:
  → Sort fish list by current sort type
  → Launch pipeline with Mask: RefreshKeepnetFishList
```

#### Sell Flow Paths

```
[User Action] Click sell button
    ↓
[FishMarketKeeperUIController.OnSellClicked]
    ↓
Throw EventOnSellFishRequest(selectedFish, selectedIndices)
    ↓
[FishMarketUITaskCompMainTofu.HandleSellFishRequest(selectedFish, selectedIndices)]
    ↓
Check: Any fish selected?
- NO:
  → Show floating tooltip: "您还没有选择需要售出的鱼"
  - YES:
    → Collect task fish IDs from selected fish
    → Check if any task fish being sold:
    - If YES: Trigger QuestTofu event
  → Launch pipeline with Mask: PlayConfirmSellUIProcess
```

```
Sell Confirmation Flow:
[User Action] Click confirm in sell dialog
    ↓
[FishMarketSellConfirmUIController.OnConfirmClicked]
    ↓
Throw EventOnSellConfirmed(fishList, totalPrice)
    ↓
[FishMarketUITaskCompMainTofu.HandleSellConfirmed(fishList, totalPrice)]
    ↓
Check: Sell conditions
- Cross-level check: fish.CatchLevelConfId != CurrentFishingLevelConfId → Can sell but no quest progress
- Freshness 0%: Can sell but no quest progress
→ NetTask: FishMarketSellReq(fishList)
↓
EventOnStop in FishMarketUITaskCompMainTofu:
↓
Check: Result == 0 && !IsNetworkError?
- YES:
  → Update player currencies (already done by server)
  → Update TaskTofu: mark sold fish as completed (if matching tasks)
  → Update DataCache: remove sold fish from keeper list
  → Set Mask: SellFinish
  → Launch pipeline
```

#### Claim Reward Flow Paths

```
[User Action] Click claim button on completed task
    ↓
[FishMarketQuestUIController.OnClaimButtonClicked(questId, questIndex)]
    ↓
[FishMarketUITaskCompMainTofu.HandleQuestClaimRequest(questId, questIndex)]
    ↓
Check: Task status is CompleteWaitClaim?
- NO:
  → Return
- YES:
  → NetTask: FishMarketQuestCompleteReq(FishingLevelConfId, Index)
  ↓
EventOnStop in FishMarketUITaskCompMainTofu:
↓
Check: Result == 0 && !IsNetworkError?
- YES:
  - Update player currencies
  - Update TaskTofu: mark task as Claimed
  - Set Mask: RefreshQuestProgress | PlayQuestClaimAnim
  - Launch pipeline
```

#### Refresh Quest Flow Paths

```
[Server Event] EventOnFishMarketQuestRefreshNtf(FishingLevelConfId, Index, FishMarketQuestInfo)
    ↓
[FishMarketUITaskCompQuestTofu.HandleQuestRefreshNtf(questIndex, questInfo)]
    ↓
Action:
  - Get current time: GetCurrentGameTime()
  - Calculate remaining time: questInfo.EndTime - CurrentTime
  - Update quest state based on remaining time:
    - If remaining time <= 0:
      - Update state to CompleteWaitClaim (if conditions met)
    - If claim countdown expired: Send reward by mail (documented requirement)
  - If remaining time > 0:
      - Keep as InProgress
  - Update DataCache: refresh quest list
  - Set Mask: RefreshQuestList | PlayQuestRefreshAnim
  - Launch pipeline
```

#### Countdown Update Flow Paths

```
Every Frame (QuestUIController.Update):
    ↓
Get server time: GetCurrentGameTime()
    ↓
For each quest:
    - Calculate: remainingTime = quest.EndTime - currentTime
    - Format countdown text:
    - If > 24h: "X天 X小时"
    - If > 1h: "X小时 X分"
    - Else: "X分 X秒"
  ↓
Check: Is < 30 minutes remaining?
- YES: Set time text color to red
- NO: Use normal color
↓
Update UI display directly (no pipeline refresh)
```

---

### Business Process Flows

#### Flow 1: Task Progress Tracking

**Check**: Check fish sold matches quest condition
```
EventOnQuestFishSold(List<int> fishIds) in FishMarketUITaskCompQuestTofu
↓
For each active quest:
  - Check quest fish IDs match any sold fish IDs
  - Calculate sold count: min(sold count, required count)
  - Update quest progress: currentProgress += sold count
  - Check: Is progress >= requiredCount?
    - YES: Update state to CompleteWaitClaim
      - Launch pipeline with Mask: RefreshQuestProgress | PlayQuestCompleteAnim
    - NO: Update progress only
      - Launch pipeline with Mask: RefreshQuestProgress
```

#### Flow 2: Quest Completion & Reward Claim

```
Player completes all task requirements
→ TaskTofu.CheckQuestProgress() returns true
→ Task state: InProgress → CompleteWaitClaim
→ Player clicks claim button
→ HandleQuestClaimRequest() flow:
  - Check state: CompleteWaitClaim?
  - NetTask: FishMarketQuestCompleteReq()
  - EventOnStop:
    - Check: Result == 0 && !IsNetworkError
    - YES:
      - Update currencies
      - Update task state: CompleteWaitClaim → Claimed
      - Launch pipeline: RefreshQuestProgress | PlayQuestClaimAnim
```

#### Flow 3: Task Refresh (Countdown expired)

```
Server countdown reaches 0
→ Server triggers EventOnFishMarketQuestRefreshNtf()
→ HandleQuestRefreshNtf() flow:
  - Check claim status
  - If not claimed AND countdown expired:
    - Send reward by mail system (documented requirement)
  - Get new quest from pool (matching level and group, excluding current 8)
  - Update DataCache with new quest
  - Set Mask: RefreshQuestList | PlayQuestRefreshAnim
```

#### Flow 4: Multi-select & Task Fish Sorting

```
User clicks task icon (not yet in multi-select)
→ HandleQuestItemClick() flow:
  - Set KeeperTofu mode: FishMarket
  - Set sort type: FishSortType.Quest
  - Auto-select quest fish from QuestTofu.GetQuestFishIds()
  - Launch pipeline: RefreshKeepnetFishList
→ Quest fish sorted to top, others keep original order
```

```
User clicks task icon (already in multi-select, has selected fish)
→ HandleQuestItemClick() flow:
  - Keep mode as FishMarket
  - Set sort type: FishSortType.Quest
  - Deselect fish that don't match current quest
  - Select quest fish
  - Launch pipeline: RefreshQuestProgress
```

#### Flow 5: Cross-level Detection & Freshness Handling

```
Player tries to sell fish in KeeperTofu
→ OnSellFishRequest() flow:
  - For each fish:
    - Check fish.CatchLevelConfId vs CurrentFishingLevelConfId
      - If NOT match: Skip quest progress update for this fish
    - Check fish.Freshness == 0%:
      - If YES: Allow selling (but no quest progress)
      - UI shows grayed task fish icon + tooltip
  - Pass filtered fish list to NetTask: FishMarketSellReq()
```

### Phase 4: Pipeline Integration

#### UpdatePipeline Steps Implementation

1. **Preprocess**: Lock UI operations, enable loading
   - In `FishMarketUITaskCompMainTofu.UpdateContextSetup()`:
     - If `IsUITaskUpdatePipelineInitOrResume()`:
       - Set `TofuShouldRespondHotKey = false`
   - When refreshing quest list:
     - QuestTofu mode is already FishMarket
     - Skip mode setting

2. **DatacacheUpdate**: Core conversion from business entities to display data
   - In `FishMarketUITaskCompQuestTofu.DataCacheUpdate()`:
     - Only if `IsUITaskUpdatePipelineInitOrResume()` OR `m_currPipelineUpdateMask.HasFlag(RefreshQuestList)`
     - Get quest list from `PlayerGameObject.FishMarketQuestListGet()`
     - For each quest:
       - Query config: `FishMarketQuestPoolConfig.ConfigGet(quest.ConfigId)`
       - Build QuestViewData with all display fields
       - Add to `m_questInfoList`
     - Update quest progress for sold fish if `RefreshQuestProgress` flag is set
   
   - In `FishMarketUITaskCompKeeperTofu.DataCacheUpdate()`:
     - Only if `IsUITUpdatePipelineInitOrResume()` OR `m_currPipelineUpdateMask.HasFlag(RefreshKeepnetFishList)`
     - Get fish list from `PlayerGameObject.KeeperFishListGet()`
     - For each fish:
       - Query config: `FishInfoConfig.ConfigGet(fish.FishInfoConfigId)`
       - Build KeeperFishViewData:
         - Calculate freshness percentage
         - Format price based on freshness and quality
         - Format weight and length
         - Check task fish conditions via QuestTofu.GetQuestFishConditions()
         - Add to `m_keeperFishList`
     - Sort fish list based on current sort type
     - Calculate task fish IDs for highlighting

   - In `FishMarketUITaskCompMainTofu.DataCacheUpdate()`:
     - Only if `IsUITaskUpdatePipelineInitOrResume()` OR `m_currPipelineUpdateMask.HasFlag(RefreshMain)`
     - Get currencies from `PlayerGameObject.CurrencyValueGet()`

3. **ResourceLoad**: Load dynamic resources like images/models
   - In `FishMarketUITaskCompQuestTofu.DynamicResLoadIsNeededCheck()`:
     - Icons are loaded via resource container, not dynamically
     - `return false;`
   
   - In `FishMarketUITaskCompQuestTofu.DynamicResCollect4Load()`:
     - `return;`

4. **ViewUpdate**: Core refresh driven by mask
   - In `FishMarketUITaskCompMainTofu.ViewUpdate()`:
     - If `m_currPipelineUpdateMask.HasFlag(RefreshQuestList)`:
       - `m_questUICtrl.QuestListRefresh(m_questInfoList)`
       - Register click events for quest items
     - If `m_currPipelineUpdateMask.HasFlag(RefreshKeepnetFishList)`:
       - `m_keeperUICtrl.ListViewRefresh(m_keeperFishList, m_currentSortType, forceReset: false)`
       - Register click events for fish items
     - If `m_currPipelineUpdateMask.HasFlag(RefreshMain)`:
       - `m_mainUICtrl.CurrencyDisplayUpdate(m_goldCoin, m_silverCoin)`
     - If `m_currPipelineUpdateMask.HasFlag(PlayQuestCompleteAnim)`:
       - `m_questUICtrl.PlayCompleteAnim(questIndex)`
     - If `m_currPipelineUpdateMask.HasFlag(PlayQuestClaimAnim)`:
       - m_questUICtrl.PlayClaimAnim(questIndex)`
     - If `m_currPipelineUpdateMask.HasFlag(PlayQuestRefreshAnim)`:
       - `m_questUICtrl.PlayRefreshAnim()`

5. **PostProcess**: Disable loading, drive UI process animation
   - In `FishMarketUITaskCompMainTofu.UpdateContextClear4PipelineEnd()`:
     - Reset pipeline mask: `m_currPipelineUpdateMask = PipelineUpdateMask.None`
     - If sell confirmation was open:
       - `TofuShouldRespondHotKey = true`
     - Else:
       - `TofuShouldRespondHotKey = false`

### Design Checklist Verification

- [x] All nouns mapped to appropriate data storage locations
  - Quest data → `FishMarketUITaskCompQuestTofu.m_questInfoList`
  - Fish data → `FishMarketUITaskCompKeeperTofu.m_keeperFishList`
  - Currency data → `FishMarketUITaskCompMainTofu.m_goldCoin`, `m_silverCoin`
  - Sell confirm data → `FishMarketUITaskCompSellConfirmTofu.m_sellFishList`

- [x] Data transformations happen in DataCacheUpdate stage only
  - Quest config → QuestViewData transformation in `QuestTofu.DataCacheUpdate()`
  - Fish data → KeeperFishViewData transformation in `KeeperTofu.DataCacheUpdate()`
  - Currency data → View data transformation in `MainTofu.DataCacheUpdate()`

- [x] Proper PipelineUpdateMask usage for UI refreshes
  - Separate masks for different UI regions
  - Masks can be combined: `RefreshAll = RefreshKeepnetFishList | RefreshQuestList | RefreshMain`
  - Fine-grained control: `RefreshQuestProgress` for progress-only updates

- [x] Controller follows event-only pattern (no business logic)
  - UIControllers throw events only: `EventOnQuestItemClick`, `EventOnFishItemClicked`, `EventOnSortTypeChanged`, etc.
  - All business logic handled in Tofu layers

- [x] All interaction flows follow View→Controller→Tofu pattern
  - Quest clicks → QuestUIController event → MainTofu handles business logic
  - Fish clicks → KeeperUIController event → KeeperTofu/MainTofu handles business logic
  - Sort type changes → KeeperUIController event → KeeperTofu handles sorting logic
  - Sell confirm events → SellConfirmUIController event → MainTofu handles sell flow

- [x] All Check → NetTask → Mask → StartPipeline pattern followed
  - Sell flow: Check → NetTask(FishMarketSellReq) → EventOnStop → Set Mask → Launch pipeline
  - Claim flow: Check → NetTask(FishMarketQuestCompleteReq) → EventOnStop → Set Mask → Launch pipeline
  - Task refresh: EventOnFishMarketQuestRefreshNtf → Update DataCache → Set Mask → Launch pipeline

- [x] Mode-aware data flow considerations
  - Current implementation uses empty ModeDefineList4Register
  - KeeperTofu supports mode switching: FishMarket vs Keepnet modes via `KeeperModeSet()`
- - SellConfirmTofu has dedicated mode: UIHotKeySwitchSellConfirmMode
  - HotKey mode changes in MainTofu based on sell confirmation dialog state

---

## Appendix: Key Data Structure Definitions

```csharp
// Data structures used in MainTofu components
public class FishMarketQuestData
{
    public int m_questId;                    // 任务ID
    public QuestState m_state;                // 任务状态
    public int m_taskConfigId;               // 任务配置ID
    public int m_requiredFishId;               // 所需鱼的ID
    public string m_requiredFishName;           // 所需鱼名称
    public string m_requiredFishIconPath;       // 所需鱼图标路径
    public int m_minWeightRequired;              // 最小重量要求（克），0表示无要求
    public int m_requiredCount;                // 所需数量
    public int m_currentProgress;              // 当前进度
    public float m_remainingSeconds;            // 剩余时间（秒）
    public int m_rewardSilverCoin;               // 银币奖励
    public int m_rewardGoldCoin;                 // 金币奖励
    public DateTime m_endTime;                  // 任务结束时间（服务器时间）
    public int m_fishingLevelConfId;           // 关卡ID
    public FishSizeType? m_minSizeRequired;   // 最小尺寸要求
    public bool m_isReachCondition;            // 是否达成条件
}

public class FishMarketFishItemInfo
{
    public int m_fishIndex;                  // 鱼在鱼护中的索引
    public int m_fishInfoConfigId;          // 鱼配置ID
    public FishType m_fishType;              // 鱼种类型
    public string m_fishName;                // 鱼名称
    public FishQualityType m_quality;           // 品质
    public FishSizeType m_fishSizeType;        // 鱼尺寸类型
    public DateTime m_pushDateTime;           // 入护时间
    public float m_freshnessPercent;         // 新鲜度百分比（0-1）
    public float m_weight;                  // 重量（克）
    public float m_length;                  // 长度（厘米）
    public long m_sellPrice;                // 售卖价格（银币）
    public int m_catchLevelConfId;           // 钓获关卡ID
    public List<int> m_matchedQuestIds;       // 匹配的任务ID列表
    public bool m_isTaskFish;               // 是否是任务鱼
    public FishInvadeProtectType m_fishInvadeProtectType; // 鱼种入侵保护类型
}

public class QuestFishCondition
{
    public int m_conditionId;               // 条件ID
    public FishType m_fishType;            // 鱼类型
    public FishSizeType? m_minSizeRequired; // 最小尺寸要求
    public int m_minWeightRequired;          // 最小重量要求
    public int m_levelConfId;               // 关卡ID限制
    public bool IsFishMatch(FishMarketFishItemInfo fishInfo);
}
```

---

**Summary**: This data flow design maps the FishMarketUITask PRD requirements to BJFramework architecture, implementing a clean separation between data transformation (Tofu) and UI display (Controller), with proper pipeline-based refresh mechanism and event-driven interaction flows.
