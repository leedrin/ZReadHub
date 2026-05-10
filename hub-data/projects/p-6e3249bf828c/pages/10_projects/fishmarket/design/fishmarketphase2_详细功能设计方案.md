# 鱼市二期详细功能设计方案

**版本**: v1.0
**日期**: 2026-02-04
**项目**: Project EF - 鱼市任务系统二期
**文档类型**: 详细功能设计方案
**基于**: FishMarketPhase2_开发设计方案.md + FishmarketUITask_PRD_标注版.md

---

## 1. 文档概述

### 1.1 目标

本文档基于《鱼市二期开发设计方案》和《鱼市PRD》，结合鱼市一期已实现的代码基础，提供完整的实现级详细设计，确保开发人员能够直接依据本文档进行编码。

### 1.2 一期代码基础回顾

| 模块 | 文件 | 一期已完成功能 |
|------|------|----------------|
| **FishMarketUITask** | `FishMarketUITask.cs` | Task框架、4个Tofu构造、Layer/Controller配置 |
| **MainTofu** | `FishMarketUITaskCompMainTofu.cs` | 货币显示、组件协调、快捷键模式切换、出售流程编排 |
| **KeeperTofu** | `FishMarketUITaskCompKeeperTofu.cs` | 鱼护数据缓存、排序、选中状态、任务鱼标记(基础) |
| **QuestTofu** | `FishMarketUITaskCompQuestTofu.cs` | Mock数据生成、基础接口定义、事件框架 |
| **SellConfirmTofu** | `FishMarketUITaskCompSellConfirmTofu.cs` | 二次确认弹窗、出售动画、货币滚动效果 |
| **数据结构** | `FishMarketUITaskDataStructures.cs` | `FishMarketFishItemInfo`, `FishMarketQuestData`, `QuestState`, `FishSortType` |

### 1.3 二期开发范围

| 功能点 | 优先级 | 依赖 |
|--------|--------|------|
| 任务数据从逻辑层获取 | P0 | 逻辑层接口 |
| 任务刷新事件监听 | P0 | 服务器协议 |
| 倒计时显示(UIController.Update) | P0 | 服务器时间 |
| 奖励领取网络请求 | P0 | NetTask |
| 任务状态流转 | P0 | - |
| 任务鱼标记(含重量/巨物条件) | P1 | QuestTofu |
| 任务栏点击三场景处理 | P1 | KeeperTofu |
| 任务刷新/完成/领取动效 | P1 | UIProcess |
| 倒计时变红逻辑 | P1 | - |

---

## 2. 数据结构详细设计

### 2.1 扩展 FishMarketQuestData

```csharp
// 文件: FishMarketUITaskDataStructures.cs
// 在现有 FishMarketQuestData 类基础上扩展

public class FishMarketQuestData
{
    // ===== 已有字段 =====
    public int m_questId;                      // 任务ID
    public QuestState m_state;                 // 任务状态
    public int m_taskConfigId;                 // 任务配置ID (对应配置表ID)
    public int m_requiredFishId;               // 所需鱼的配置ID
    public string m_requiredFishName;          // 所需鱼名称
    public string m_requiredFishIconPath;      // 所需鱼图标路径
    public int m_requiredCount;                // 所需数量
    public int m_minWeightRequired;            // 最小重量要求(克,0=无要求)
    public int m_currentProgress;              // 当前进度
    public float m_remainingSeconds;           // [废弃] 改用 m_endTime
    public int m_rewardSilverCoin;             // 银币奖励

    // ===== 二期新增字段 =====

    /// <summary>
    /// 任务栏索引 (0-7，对应8个任务栏位)
    /// </summary>
    public int m_questIndex;

    /// <summary>
    /// 任务结束时间 (服务器绝对时间)
    /// 用于计算倒计时: m_endTime - GetCurrentGameTime()
    /// </summary>
    public DateTime m_endTime;

    /// <summary>
    /// 是否要求巨物 (与重量条件二选一)
    /// true: 检查 FishInvadeProtectType.Giant
    /// false: 检查重量 >= m_minWeightRequired
    /// </summary>
    public bool m_isGiantRequired;

    /// <summary>
    /// 任务所属关卡ID
    /// 用于跨关卡检测: 鱼的钓获关卡必须与任务关卡匹配
    /// </summary>
    public int m_fishingLevelConfId;

    /// <summary>
    /// 金币奖励 (可选)
    /// </summary>
    public int m_rewardGoldCoin;

    /// <summary>
    /// 是否已达成条件 (从逻辑层获取)
    /// </summary>
    public bool m_isReachCondition;
}
```

### 2.2 扩展 PipelineUpdateMask

```csharp
// 文件: FishMarketUITask.cs
// 在现有 PipelineUpdateMask 枚举基础上扩展

[Flags]
public enum PipelineUpdateMask
{
    None = 0,
    RefreshKeepnetFishList = 1 << 0,      // 刷新鱼护列表
    RefreshQuestList = 1 << 1,            // 刷新任务列表
    RefreshMain = 1 << 2,                 // 刷新货币显示
    PlayConfirmSellUIProcess = 1 << 3,    // 播放出售动画
    SellFinish = 1 << 4,                  // 出售完成

    // ===== 二期新增 =====
    RefreshQuestProgress = 1 << 5,        // 仅刷新任务进度(不重建列表)
    PlayQuestCompleteAnim = 1 << 6,       // 播放任务完成动效
    PlayQuestClaimAnim = 1 << 7,          // 播放奖励领取动效
    PlayQuestRefreshAnim = 1 << 8,        // 播放任务刷新动效

    RefreshAll = RefreshKeepnetFishList | RefreshQuestList | RefreshMain,
}
```

### 2.3 扩展 FishMarketFishItemInfo

```csharp
// 文件: FishMarketUITaskDataStructures.cs
// 在现有 FishMarketFishItemInfo 结构体基础上扩展

public struct FishMarketFishItemInfo
{
    // ===== 已有字段 =====
    public int m_fishIndex;
    public int m_fishInfoConfId;
    public FishType m_fishType;
    public string m_fishName;
    public FishQualityType m_quality;
    public FishSizeType m_fishSizeType;
    public DateTime m_pushDateTime;
    public long m_sellPrice;
    public float m_weight;
    public float m_length;
    public string m_iconPath;
    public bool m_isTaskFish;
    public long m_catchTimestamp;
    public float m_healthPercent;
    public FishInvadeProtectType m_fishInvadeProtectType;

    // ===== 二期新增字段 =====

    /// <summary>
    /// 鱼的钓获关卡ID
    /// 用于跨关卡售卖检测
    /// </summary>
    public int m_catchLevelConfId;

    /// <summary>
    /// 新鲜度百分比 (0-100)
    /// 从 m_pushDateTime 计算: 24小时从100%衰减到0%
    /// </summary>
    public float m_freshnessPercent;

    /// <summary>
    /// 匹配的任务ID列表 (一条鱼可能满足多个任务)
    /// </summary>
    public List<int> m_matchedQuestIds;
}
```

---

## 3. QuestTofu 详细实现

### 3.1 类结构扩展

```csharp
// 文件: FishMarketUITaskCompQuestTofu.cs

public partial class FishMarketUITaskCompQuestTofu : EFUITaskCompMainTofuBase, IFishMarketUITaskCompQuestTofu
{
    // ===== 新增字段 =====

    /// <summary>
    /// 当前关卡ID缓存
    /// </summary>
    private int m_currentFishingLevelConfId;

    /// <summary>
    /// 任务鱼ID与任务数据映射 (用于快速查找)
    /// Key: 鱼配置ID, Value: 匹配的任务数据列表
    /// </summary>
    private Dictionary<int, List<FishMarketQuestData>> m_fishIdToQuestMap = new Dictionary<int, List<FishMarketQuestData>>();

    /// <summary>
    /// 需要播放动画的任务索引队列 (完成/领取/刷新)
    /// </summary>
    private Queue<(int questIndex, AnimationType animType)> m_pendingAnimQueue = new Queue<(int, AnimationType)>();

    public enum AnimationType
    {
        Complete,    // 任务完成
        Claim,       // 领取奖励
        Refresh      // 任务刷新
    }
}
```

### 3.2 数据获取实现

```csharp
/// <summary>
/// 从逻辑层获取任务数据 (替换MockQuestDataCreate)
/// </summary>
private void QuestDataUpdate()
{
    m_questDataList.Clear();
    m_fishIdToQuestMap.Clear();

    var playerGO = PlayerCtx?.PlayerGameObjectGet();
    if (playerGO == null)
    {
        Debug.LogWarning("FishMarketQuestTofu: PlayerGameObject is null");
        return;
    }

    // 1. 获取当前关卡ID
    m_currentFishingLevelConfId = GetCurrentFishingLevelConfId();

    // 2. 从逻辑层获取任务列表
    var questProviders = playerGO.FishMarketQuestGetAll(m_currentFishingLevelConfId);
    if (questProviders == null || questProviders.Count == 0)
    {
        Debug.Log("FishMarketQuestTofu: No quests for current level");
        return;
    }

    // 3. 转换为UI数据结构
    foreach (var provider in questProviders)
    {
        var questData = ConvertProviderToQuestData(provider);
        if (questData != null)
        {
            m_questDataList.Add(questData);

            // 建立鱼ID到任务的映射
            if (!m_fishIdToQuestMap.ContainsKey(questData.m_requiredFishId))
            {
                m_fishIdToQuestMap[questData.m_requiredFishId] = new List<FishMarketQuestData>();
            }
            m_fishIdToQuestMap[questData.m_requiredFishId].Add(questData);
        }
    }

    Debug.Log($"FishMarketQuestTofu: Loaded {m_questDataList.Count} quests for level {m_currentFishingLevelConfId}");
}

/// <summary>
/// 转换逻辑层Provider到UI数据结构
/// </summary>
private FishMarketQuestData ConvertProviderToQuestData(IFishMarketQuestInfoProvider provider)
{
    if (provider == null) return null;

    var conf = provider.ConfGet();
    if (conf == null) return null;

    // 获取目标鱼信息
    var fishTypeConf = ConfigDataHelper.s_configDataLoader?.GetConfigDataFishTypeInfo(conf.FishTypeID);
    string fishName = fishTypeConf?.Name ?? "未知鱼种";

    // 根据重量要求选择图标
    string fishIconPath = GetFishIconPath(conf.FishTypeID, conf.MinWeight, conf.IsGiantRequired);

    // 确定任务状态
    QuestState state = DetermineQuestState(provider);

    // 获取结束时间
    DateTime endTime = GetQuestEndTime(provider);

    return new FishMarketQuestData
    {
        m_questId = provider.IndexGet(),           // 使用索引作为ID
        m_questIndex = provider.IndexGet(),
        m_state = state,
        m_taskConfigId = conf.ID,
        m_requiredFishId = conf.FishTypeID,
        m_requiredFishName = fishName,
        m_requiredFishIconPath = fishIconPath,
        m_requiredCount = conf.CountCond,
        m_minWeightRequired = conf.MinWeight,
        m_isGiantRequired = conf.IsGiantRequired,
        m_currentProgress = provider.CompletedCountGet(),
        m_isReachCondition = provider.IsReachCondition(),
        m_endTime = endTime,
        m_fishingLevelConfId = m_currentFishingLevelConfId,
        m_rewardSilverCoin = conf.SilverReward,
        m_rewardGoldCoin = conf.GoldReward
    };
}

/// <summary>
/// 确定任务状态
/// </summary>
private QuestState DetermineQuestState(IFishMarketQuestInfoProvider provider)
{
    // 1. 检查是否已领取
    if (provider.IsClaimedGet())
    {
        return QuestState.Completed;
    }

    // 2. 检查是否已完成待领取
    if (provider.IsReachCondition())
    {
        return QuestState.Claimable;
    }

    // 3. 检查是否已解锁
    // Alpha1不做Locked状态，直接返回InProgress
    return QuestState.InProgress;
}

/// <summary>
/// 获取任务结束时间
/// </summary>
private DateTime GetQuestEndTime(IFishMarketQuestInfoProvider provider)
{
    // 从DC获取任务信息中的结束时间
    var questInfo = provider.QuestInfoGet();
    if (questInfo != null)
    {
        return questInfo.m_endTime;
    }

    // 兜底: 使用配置的刷新小时数计算
    var conf = provider.ConfGet();
    var currentTime = GetCurrentGameTime();
    // 计算到下一个整点的时间
    return CalculateNextRefreshTime(currentTime, conf.RefreshHour);
}

/// <summary>
/// 计算下一次刷新时间 (必须是整点)
/// </summary>
private DateTime CalculateNextRefreshTime(DateTime currentTime, int refreshHours)
{
    // 先找到当前小时的整点
    var currentHour = new DateTime(currentTime.Year, currentTime.Month, currentTime.Day, currentTime.Hour, 0, 0);
    // 加上配置的刷新时间
    return currentHour.AddHours(refreshHours);
}

/// <summary>
/// 获取当前关卡ID
/// </summary>
private int GetCurrentFishingLevelConfId()
{
    // 从PlayerContext获取当前关卡
    var playerGO = PlayerCtx?.PlayerGameObjectGet();
    return playerGO?.CurrentFishingLevelConfIdGet() ?? 0;
}

/// <summary>
/// 根据重量要求选择鱼图标
/// </summary>
private string GetFishIconPath(int fishTypeId, int minWeight, bool isGiantRequired)
{
    var fishInfo = ConfigDataHelper.s_configDataLoader?.GetConfigDataFishInfo(fishTypeId);
    if (fishInfo == null)
    {
        return string.Empty;
    }

    if (isGiantRequired)
    {
        // 巨物要求: 使用巨型体图标
        return AssetPathHelper.AssetPathGet4UIIconFolder(fishInfo.GiantIconResPath ?? fishInfo.IconResPath);
    }
    else if (minWeight > 0)
    {
        // 有重量要求: 使用满足条件的最小体型图标
        return GetMinSizeIconForWeight(fishTypeId, minWeight);
    }
    else
    {
        // 无特殊要求: 使用成年体图标
        return AssetPathHelper.AssetPathGet4UIIconFolder(fishInfo.IconResPath);
    }
}

/// <summary>
/// 获取满足重量条件的最小体型图标
/// </summary>
private string GetMinSizeIconForWeight(int fishTypeId, int minWeight)
{
    var fishInfo = ConfigDataHelper.s_configDataLoader?.GetConfigDataFishInfo(fishTypeId);
    if (fishInfo == null)
    {
        return string.Empty;
    }

    // 根据重量区间选择体型图标
    // 假设配置表有 JuvenileMaxWeight, AdultMaxWeight 字段
    if (minWeight <= fishInfo.JuvenileMaxWeight)
    {
        return AssetPathHelper.AssetPathGet4UIIconFolder(fishInfo.JuvenileIconResPath ?? fishInfo.IconResPath);
    }
    else if (minWeight <= fishInfo.AdultMaxWeight)
    {
        return AssetPathHelper.AssetPathGet4UIIconFolder(fishInfo.IconResPath);
    }
    else
    {
        return AssetPathHelper.AssetPathGet4UIIconFolder(fishInfo.GiantIconResPath ?? fishInfo.IconResPath);
    }
}
```

### 3.3 任务刷新事件监听

```csharp
/// <summary>
/// 注册任务刷新事件 (在OnEventUIControllerLoadCompleted中调用)
/// </summary>
private void RegisterQuestRefreshEvent()
{
    var playerGO = PlayerCtx?.PlayerGameObjectGet();
    if (playerGO != null)
    {
        playerGO.EventOnFishMarketQuestRefreshNtf += OnQuestRefreshNtf;
        Debug.Log("FishMarketQuestTofu: Registered EventOnFishMarketQuestRefreshNtf");
    }
}

/// <summary>
/// 注销任务刷新事件 (在OnUITaskPause/Stop中调用)
/// </summary>
private void UnregisterQuestRefreshEvent()
{
    var playerGO = PlayerCtx?.PlayerGameObjectGet();
    if (playerGO != null)
    {
        playerGO.EventOnFishMarketQuestRefreshNtf -= OnQuestRefreshNtf;
        Debug.Log("FishMarketQuestTofu: Unregistered EventOnFishMarketQuestRefreshNtf");
    }
}

/// <summary>
/// 任务刷新事件处理
/// </summary>
private void OnQuestRefreshNtf(FishMarketQuestRefreshNtf ntf)
{
    if (ntf == null)
    {
        Debug.LogWarning("FishMarketQuestTofu: Received null ntf");
        return;
    }

    Debug.Log($"FishMarketQuestTofu: Quest refresh ntf received, level={ntf.FishingLevelConfId}, index={ntf.Index}");

    // 检查是否是当前关卡的任务
    if (ntf.FishingLevelConfId != m_currentFishingLevelConfId)
    {
        return;
    }

    // 记录需要播放刷新动画的任务
    m_pendingAnimQueue.Enqueue((ntf.Index, AnimationType.Refresh));

    // 触发管线刷新
    var pipelineInitInfo = m_owner.CompUpdatePipelineManagerGet().UpdatePipelineInitInfoAlloc();
    pipelineInitInfo.m_customParamDict.SetParam(
        FishMarketUITask.ParamKeyPipelineUpdateMask,
        FishMarketUITask.PipelineUpdateMask.RefreshQuestList | FishMarketUITask.PipelineUpdateMask.PlayQuestRefreshAnim);
    m_owner.CompUpdatePipelineManagerGet().UpdatePipelineLaunch(pipelineInitInfo);
}
```

### 3.4 奖励领取实现

```csharp
/// <summary>
/// 领取任务奖励 (完整实现)
/// </summary>
public void ClaimQuestReward(int questIndex)
{
    // 1. 前置检查
    var questData = m_questDataList.Find(q => q.m_questIndex == questIndex);
    if (questData == null)
    {
        Debug.LogWarning($"FishMarketQuestTofu: Quest {questIndex} not found");
        return;
    }

    if (questData.m_state != QuestState.Claimable)
    {
        Debug.LogWarning($"FishMarketQuestTofu: Quest {questIndex} state is {questData.m_state}, cannot claim");
        ShowTips("任务状态异常，无法领取");
        return;
    }

    // 2. 发送网络请求
    var netTask = new FishMarketQuestCompleteReqNetTask(
        fishingLevelConfId: m_currentFishingLevelConfId,
        index: questIndex
    );

    netTask.EventOnStop += OnClaimNetTaskComplete;
    netTask.Start();

    Debug.Log($"FishMarketQuestTofu: Sent claim request for quest {questIndex}");
}

/// <summary>
/// 领取网络请求完成回调
/// </summary>
private void OnClaimNetTaskComplete(BJFramework.Runtime.Task.TaskBase task)
{
    var netTask = task as FishMarketQuestCompleteReqNetTask;
    if (netTask == null)
    {
        Debug.LogError("FishMarketQuestTofu: Invalid net task type");
        return;
    }

    // 检查网络错误
    if (netTask.IsNetworkError)
    {
        Debug.LogError("FishMarketQuestTofu: Network error during claim");
        ShowTips("网络异常，请稍后重试");
        return;
    }

    // 检查业务错误
    if (netTask.Result != 0)
    {
        Debug.LogError($"FishMarketQuestTofu: Claim failed, result={netTask.Result}");
        ShowTips($"领取失败: {GetErrorMessage(netTask.Result)}");
        return;
    }

    int questIndex = netTask.Index;

    // 3. 更新逻辑层数据
    var playerGO = PlayerCtx?.PlayerGameObjectGet();
    if (playerGO != null)
    {
        playerGO.FishMarketQuestComplete(
            m_currentFishingLevelConfId,
            questIndex,
            netTask.CurrencyUpdateCtxInfo,
            out var errCode
        );

        if (errCode != 0)
        {
            Debug.LogWarning($"FishMarketQuestTofu: Logic layer update error, code={errCode}");
        }
    }

    // 4. 更新UI数据
    var questData = m_questDataList.Find(q => q.m_questIndex == questIndex);
    if (questData != null)
    {
        questData.m_state = QuestState.Completed;
    }

    // 5. 记录待播放动画
    m_pendingAnimQueue.Enqueue((questIndex, AnimationType.Claim));

    // 6. 触发管线刷新 + 动画
    var pipelineInitInfo = m_owner.CompUpdatePipelineManagerGet().UpdatePipelineInitInfoAlloc();
    pipelineInitInfo.m_customParamDict.SetParam(
        FishMarketUITask.ParamKeyPipelineUpdateMask,
        FishMarketUITask.PipelineUpdateMask.RefreshQuestList |
        FishMarketUITask.PipelineUpdateMask.RefreshMain |
        FishMarketUITask.PipelineUpdateMask.PlayQuestClaimAnim);
    m_owner.CompUpdatePipelineManagerGet().UpdatePipelineLaunch(pipelineInitInfo);

    Debug.Log($"FishMarketQuestTofu: Quest {questIndex} claimed successfully");
}
```

### 3.5 任务鱼标记扩展

```csharp
/// <summary>
/// 获取活跃任务鱼ID集合 (扩展: 包含条件信息)
/// </summary>
public HashSet<int> GetQuestFishIds()
{
    var questFishIds = new HashSet<int>();

    if (m_questDataList == null) return questFishIds;

    foreach (var questData in m_questDataList)
    {
        if (questData.m_state == QuestState.InProgress)
        {
            questFishIds.Add(questData.m_requiredFishId);
        }
    }

    return questFishIds;
}

/// <summary>
/// 获取任务鱼详细条件 (供KeeperTofu使用)
/// </summary>
/// <returns>Key: 鱼ID, Value: (最小重量, 是否要求巨物, 关卡ID)</returns>
public Dictionary<int, (int minWeight, bool isGiant, int levelId)> GetQuestFishConditions()
{
    var conditions = new Dictionary<int, (int, bool, int)>();

    if (m_questDataList == null) return conditions;

    foreach (var questData in m_questDataList)
    {
        if (questData.m_state == QuestState.InProgress)
        {
            // 如果同一鱼ID有多个任务，取最低条件
            if (!conditions.ContainsKey(questData.m_requiredFishId))
            {
                conditions[questData.m_requiredFishId] = (
                    questData.m_minWeightRequired,
                    questData.m_isGiantRequired,
                    questData.m_fishingLevelConfId
                );
            }
            else
            {
                var existing = conditions[questData.m_requiredFishId];
                // 如果新任务的重量要求更低，或者不要求巨物，使用更宽松的条件
                if (!questData.m_isGiantRequired && existing.isGiant)
                {
                    conditions[questData.m_requiredFishId] = (
                        questData.m_minWeightRequired,
                        false,
                        questData.m_fishingLevelConfId
                    );
                }
                else if (!existing.isGiant && questData.m_minWeightRequired < existing.minWeight)
                {
                    conditions[questData.m_requiredFishId] = (
                        questData.m_minWeightRequired,
                        false,
                        questData.m_fishingLevelConfId
                    );
                }
            }
        }
    }

    return conditions;
}

/// <summary>
/// 检查鱼是否满足任务条件
/// </summary>
public bool IsFishMatchQuest(FishMarketFishItemInfo fishInfo, FishMarketQuestData questData)
{
    // 1. 品种匹配
    if (fishInfo.m_fishInfoConfId != questData.m_requiredFishId)
    {
        return false;
    }

    // 2. 关卡匹配 (跨关卡检测)
    if (fishInfo.m_catchLevelConfId != questData.m_fishingLevelConfId)
    {
        return false;
    }

    // 3. 新鲜度检测 (新鲜度为0不能完成任务)
    if (fishInfo.m_freshnessPercent <= 0)
    {
        return false;
    }

    // 4. 条件检测 (巨物/重量二选一)
    if (questData.m_isGiantRequired)
    {
        // 巨物条件
        return fishInfo.m_fishInvadeProtectType == FishInvadeProtectType.Giant;
    }
    else if (questData.m_minWeightRequired > 0)
    {
        // 重量条件 (注意: 显示"大于"实际是"大于等于")
        return fishInfo.m_weight * 1000 >= questData.m_minWeightRequired; // m_weight单位是kg, 条件单位是g
    }

    // 无特殊条件
    return true;
}

/// <summary>
/// 获取鱼匹配的所有任务ID
/// </summary>
public List<int> GetMatchedQuestIds(FishMarketFishItemInfo fishInfo)
{
    var matchedIds = new List<int>();

    if (!m_fishIdToQuestMap.ContainsKey(fishInfo.m_fishInfoConfId))
    {
        return matchedIds;
    }

    foreach (var questData in m_fishIdToQuestMap[fishInfo.m_fishInfoConfId])
    {
        if (questData.m_state == QuestState.InProgress && IsFishMatchQuest(fishInfo, questData))
        {
            matchedIds.Add(questData.m_questId);
        }
    }

    return matchedIds;
}
```

---

## 4. KeeperTofu 扩展实现

### 4.1 任务鱼标记增强

```csharp
// 文件: FishMarketUITaskCompKeeperTofu.cs

/// <summary>
/// 更新任务鱼标记 (增强版: 支持重量/巨物/新鲜度条件)
/// </summary>
private void QuestFishMarkUpdate()
{
    if (m_currentKeeperMode != KeeperModeName4FishMarket)
    {
        return;
    }

    if (m_fishItemInfoList == null || m_fishItemInfoList.Count == 0)
    {
        return;
    }

    // 获取QuestTofu
    var questTofu = (m_owner as IFishMarketUITaskCompOwner)?.CompQuestTofuGet() as FishMarketUITaskCompQuestTofu;
    if (questTofu == null)
    {
        return;
    }

    // 获取任务条件
    var questConditions = questTofu.GetQuestFishConditions();
    var questDataList = questTofu.QuestDataListGet();

    // 标记每条鱼
    for (int i = 0; i < m_fishItemInfoList.Count; i++)
    {
        var fishInfo = m_fishItemInfoList[i];

        // 清除旧的匹配信息
        fishInfo.m_isTaskFish = false;
        fishInfo.m_matchedQuestIds = new List<int>();

        // 检查是否有匹配的任务
        if (questConditions.ContainsKey(fishInfo.m_fishInfoConfId))
        {
            // 获取所有匹配的任务ID
            fishInfo.m_matchedQuestIds = questTofu.GetMatchedQuestIds(fishInfo);
            fishInfo.m_isTaskFish = fishInfo.m_matchedQuestIds.Count > 0;
        }

        m_fishItemInfoList[i] = fishInfo;
    }
}

/// <summary>
/// 计算鱼的新鲜度 (在KeepnetDataCacheUpdate中调用)
/// </summary>
private float CalculateFreshness(DateTime pushDateTime, DateTime currentTime)
{
    // 24小时从100%衰减到0%
    const float TotalDecayHours = 24f;

    var elapsed = currentTime - pushDateTime;
    float elapsedHours = (float)elapsed.TotalHours;

    if (elapsedHours >= TotalDecayHours)
    {
        return 0f;
    }

    return (TotalDecayHours - elapsedHours) / TotalDecayHours * 100f;
}
```

### 4.2 任务栏点击三场景实现

```csharp
/// <summary>
/// 处理任务栏点击的三种场景 (新增方法)
/// 由MainTofu通过事件调用
/// </summary>
public void HandleQuestClickScenario(int questId, FishMarketQuestData questData)
{
    if (questData == null || questData.m_state != QuestState.InProgress)
    {
        return;
    }

    // 获取当前选中状态
    bool hasSelectedFish = HasAnySelectedFish();

    if (!hasSelectedFish)
    {
        // 场景1: 未进入多选态(无选中)
        HandleScenario1_EnterMultiSelect(questData);
    }
    else
    {
        // 场景2/3: 已进入多选态
        HandleScenario2Or3_InMultiSelectMode(questData);
    }
}

/// <summary>
/// 场景1: 未进入多选态
/// - 自动进入多选状态
/// - 切换到任务排序
/// - 自动选中满足条件的鱼
/// </summary>
private void HandleScenario1_EnterMultiSelect(FishMarketQuestData questData)
{
    Debug.Log($"KeeperTofu: Scenario 1 - Enter multi-select for quest {questData.m_questId}");

    // 1. 切换到任务排序 (这会触发刷新管线)
    m_currentSortType = FishSortType.Quest;

    // 2. 自动选中满足条件的鱼
    AutoSelectQuestFish(questData);

    // 3. 启动管线刷新
    KeeperPipelineLaunch();
}

/// <summary>
/// 场景2/3: 已进入多选态
/// </summary>
private void HandleScenario2Or3_InMultiSelectMode(FishMarketQuestData questData)
{
    // 检查选中的鱼是否有匹配任务的
    bool hasQuestFishSelected = HasQuestFishSelected(questData);

    if (hasQuestFishSelected)
    {
        // 场景2: 有命中任务鱼
        Debug.Log($"KeeperTofu: Scenario 2 - Has quest fish selected");
        HandleScenario2_HasQuestFish(questData);
    }
    else
    {
        // 场景3: 没有命中任务鱼
        Debug.Log($"KeeperTofu: Scenario 3 - No quest fish selected, do nothing");
        // 不做任何操作
    }
}

/// <summary>
/// 场景2: 已选中某些鱼 + 有命中任务鱼
/// - 切换到任务排序
/// - 取消非任务鱼的选中
/// - 选中对应任务的鱼
/// </summary>
private void HandleScenario2_HasQuestFish(FishMarketQuestData questData)
{
    // 1. 切换到任务排序
    m_currentSortType = FishSortType.Quest;

    // 2. 取消非任务鱼的选中
    ClearNonQuestFishSelection(questData);

    // 3. 选中对应任务的鱼
    SelectQuestFish(questData);

    // 4. 启动管线刷新
    KeeperPipelineLaunch();
}

/// <summary>
/// 自动选中满足条件的鱼
/// </summary>
private void AutoSelectQuestFish(FishMarketQuestData questData)
{
    var questTofu = (m_owner as IFishMarketUITaskCompOwner)?.CompQuestTofuGet() as FishMarketUITaskCompQuestTofu;
    if (questTofu == null) return;

    for (int i = 0; i < m_fishItemInfoList.Count; i++)
    {
        var fishInfo = m_fishItemInfoList[i];

        if (questTofu.IsFishMatchQuest(fishInfo, questData))
        {
            m_selectedStateList[i] = true;
        }
        else
        {
            m_selectedStateList[i] = false;
        }
    }
}

/// <summary>
/// 检查是否有任意鱼被选中
/// </summary>
private bool HasAnySelectedFish()
{
    foreach (var selected in m_selectedStateList)
    {
        if (selected) return true;
    }
    return false;
}

/// <summary>
/// 检查选中的鱼中是否有匹配任务的
/// </summary>
private bool HasQuestFishSelected(FishMarketQuestData questData)
{
    var questTofu = (m_owner as IFishMarketUITaskCompOwner)?.CompQuestTofuGet() as FishMarketUITaskCompQuestTofu;
    if (questTofu == null) return false;

    for (int i = 0; i < m_selectedStateList.Count; i++)
    {
        if (m_selectedStateList[i])
        {
            if (questTofu.IsFishMatchQuest(m_fishItemInfoList[i], questData))
            {
                return true;
            }
        }
    }
    return false;
}

/// <summary>
/// 取消非任务鱼的选中
/// </summary>
private void ClearNonQuestFishSelection(FishMarketQuestData questData)
{
    var questTofu = (m_owner as IFishMarketUITaskCompOwner)?.CompQuestTofuGet() as FishMarketUITaskCompQuestTofu;
    if (questTofu == null) return;

    for (int i = 0; i < m_selectedStateList.Count; i++)
    {
        if (m_selectedStateList[i])
        {
            if (!questTofu.IsFishMatchQuest(m_fishItemInfoList[i], questData))
            {
                m_selectedStateList[i] = false;
            }
        }
    }
}

/// <summary>
/// 选中对应任务的鱼
/// </summary>
private void SelectQuestFish(FishMarketQuestData questData)
{
    var questTofu = (m_owner as IFishMarketUITaskCompOwner)?.CompQuestTofuGet() as FishMarketUITaskCompQuestTofu;
    if (questTofu == null) return;

    for (int i = 0; i < m_fishItemInfoList.Count; i++)
    {
        if (questTofu.IsFishMatchQuest(m_fishItemInfoList[i], questData))
        {
            m_selectedStateList[i] = true;
        }
    }
}
```

---

## 5. UIController 倒计时实现

### 5.1 FishMarketQuestItemUIController 倒计时

```csharp
// 文件: Controller/FishMarketQuestItemUIController.cs

public partial class FishMarketQuestItemUIController : UIControllerBase
{
    // ===== 倒计时相关字段 =====
    private DateTime m_endTime;
    private bool m_isCountdownRed = false;
    private Color m_normalTextColor = Color.white;
    private const float WarningThresholdMinutes = 30f; // 最后30分钟变红

    /// <summary>
    /// 初始化时设置结束时间
    /// </summary>
    public void Initialize(FishMarketQuestData questData, Dictionary<string, object> resourceCache)
    {
        m_questData = questData;
        m_endTime = questData.m_endTime;
        m_isCountdownRed = false;

        // ... 其他初始化代码
    }

    /// <summary>
    /// Unity Update - 每帧更新倒计时显示
    /// </summary>
    protected override void Update()
    {
        base.Update();

        // 只有进行中和待领取状态需要显示倒计时
        if (m_questData == null ||
            (m_questData.m_state != QuestState.InProgress && m_questData.m_state != QuestState.Claimable))
        {
            return;
        }

        UpdateCountdownDisplay();
    }

    /// <summary>
    /// 更新倒计时显示
    /// </summary>
    private void UpdateCountdownDisplay()
    {
        // 获取服务器时间
        var currentTime = GetCurrentGameTime();
        var remaining = m_endTime - currentTime;
        int remainingSec = (int)remaining.TotalSeconds;

        // 更新文本
        string timeText = FormatCountdownText(remainingSec);
        if (m_countdownText != null)
        {
            m_countdownText.text = timeText;
        }

        // 检查是否需要变红
        bool shouldBeRed = remainingSec > 0 && remainingSec <= WarningThresholdMinutes * 60;
        if (shouldBeRed != m_isCountdownRed)
        {
            m_isCountdownRed = shouldBeRed;
            SetCountdownColor(shouldBeRed);
        }
    }

    /// <summary>
    /// 格式化倒计时文本
    /// 规则: 天/小时, 小时/分, 分/秒 (保留2个单位)
    /// </summary>
    private string FormatCountdownText(int remainingSec)
    {
        if (remainingSec < 0)
        {
            return "已结束";
        }

        if (remainingSec < 60)
        {
            // 小于1分钟: 显示秒
            return $"{remainingSec}秒";
        }
        else if (remainingSec < 3600)
        {
            // 小于1小时: 显示分/秒
            int min = remainingSec / 60;
            int sec = remainingSec % 60;
            return $"{min}分{sec}秒";
        }
        else if (remainingSec < 86400)
        {
            // 小于1天: 显示小时/分
            int hour = remainingSec / 3600;
            int min = (remainingSec % 3600) / 60;
            return $"{hour}小时{min}分";
        }
        else
        {
            // 超过1天: 显示天/小时
            int day = remainingSec / 86400;
            int hour = (remainingSec % 86400) / 3600;
            return $"{day}天{hour}小时";
        }
    }

    /// <summary>
    /// 设置倒计时文本颜色
    /// </summary>
    private void SetCountdownColor(bool isRed)
    {
        if (m_countdownText != null)
        {
            m_countdownText.color = isRed ? Color.red : m_normalTextColor;
        }
    }

    /// <summary>
    /// 获取服务器时间
    /// </summary>
    private DateTime GetCurrentGameTime()
    {
        return (GameManager.Instance?.PlayerContext as ProjectEFPlayerContext)
            ?.PlayerGameObjectGet()
            ?.ServerTimeAsDateTimeGet()
            ?? Timer.s_currTime;
    }
}
```

---

## 6. MainTofu 协调扩展

### 6.1 任务点击场景协调

```csharp
// 文件: FishMarketUITaskCompMainTofu.cs

/// <summary>
/// QuestTofu任务鱼排序请求事件处理 (扩展)
/// </summary>
protected void OnQuestTofuSortRequest(int questId)
{
    Debug.Log($"FishMarketMainTofu: Handling quest click for quest {questId}");

    // 获取任务数据
    var questTofu = m_compQuestTofu as FishMarketUITaskCompQuestTofu;
    if (questTofu == null) return;

    var questDataList = questTofu.QuestDataListGet();
    var questData = questDataList?.Find(q => q.m_questId == questId);

    if (questData == null || questData.m_state != QuestState.InProgress)
    {
        Debug.Log($"FishMarketMainTofu: Quest {questId} is not in progress, ignoring click");
        return;
    }

    // 委托给KeeperTofu处理三种场景
    m_compKeeperTofu?.HandleQuestClickScenario(questId, questData);
}

/// <summary>
/// 出售完成后通知QuestTofu更新进度
/// </summary>
private void OnSellFishComplete(List<int> soldFishIds)
{
    if (soldFishIds == null || soldFishIds.Count == 0) return;

    // 通知QuestTofu检查任务进度
    m_compQuestTofu?.OnQuestFishSold(soldFishIds);
}
```

---

## 7. NetTask 实现

### 7.1 FishMarketQuestCompleteReqNetTask

```csharp
// 文件: NetTask/FishMarketQuestCompleteReqNetTask.cs (新增)

using BlackJack.BJFramework.Runtime;
using BlackJack.BJFramework.Runtime.Task;
using BlackJack.ProjectEF.Protocol;
using Google.Protobuf;

namespace BlackJack.ProjectEF.Runtime.Net
{
    /// <summary>
    /// 鱼市任务完成领取网络请求
    /// </summary>
    public class FishMarketQuestCompleteReqNetTask : NetTaskBase
    {
        #region 构造函数

        public FishMarketQuestCompleteReqNetTask(int fishingLevelConfId, int index)
        {
            m_fishingLevelConfId = fishingLevelConfId;
            m_index = index;
        }

        #endregion

        #region 公共属性

        /// <summary>
        /// 请求结果码 (0=成功)
        /// </summary>
        public int Result { get; private set; }

        /// <summary>
        /// 货币更新信息
        /// </summary>
        public ProCurrencyUpdateCtxInfo CurrencyUpdateCtxInfo { get; private set; }

        /// <summary>
        /// 请求的任务索引
        /// </summary>
        public int Index => m_index;

        /// <summary>
        /// 请求的关卡ID
        /// </summary>
        public int FishingLevelConfId => m_fishingLevelConfId;

        #endregion

        #region 基类实现

        protected override void OnStart()
        {
            var req = new FishMarketQuestCompleteReq
            {
                FishingLevelConfId = m_fishingLevelConfId,
                Index = m_index
            };

            SendMessage(req, typeof(FishMarketQuestCompleteAck));
        }

        protected override void OnReceiveAckMessage(IMessage ackMsg)
        {
            var ack = ackMsg as FishMarketQuestCompleteAck;
            if (ack == null)
            {
                Result = -1;
                return;
            }

            Result = ack.Result;
            CurrencyUpdateCtxInfo = ack.CurrencyUpdateCtxInfo;
        }

        #endregion

        #region 私有字段

        private int m_fishingLevelConfId;
        private int m_index;

        #endregion
    }
}
```

---

## 8. 接口扩展定义

### 8.1 IFishMarketUITaskCompQuestTofu 扩展

```csharp
// 文件: FishMarketUITaskCompQuestTofu.cs

public interface IFishMarketUITaskCompQuestTofu : IEFUITaskCompMainTofuBase
{
    // ===== 已有方法 =====
    void ClaimQuestReward(int questId);
    void JumpToUnlockUI(int questId);
    List<FishMarketQuestData> QuestDataListGet();
    HashSet<int> GetQuestFishIds();
    void OnQuestFishSold(List<int> fishIds);
    event Action<int> EventOnQuestFishSortRequest;

    // ===== 二期新增方法 =====

    /// <summary>
    /// 获取任务鱼详细条件
    /// </summary>
    Dictionary<int, (int minWeight, bool isGiant, int levelId)> GetQuestFishConditions();

    /// <summary>
    /// 检查鱼是否满足任务条件
    /// </summary>
    bool IsFishMatchQuest(FishMarketFishItemInfo fishInfo, FishMarketQuestData questData);

    /// <summary>
    /// 获取鱼匹配的所有任务ID
    /// </summary>
    List<int> GetMatchedQuestIds(FishMarketFishItemInfo fishInfo);
}
```

### 8.2 IFishMarketUITaskCompKeeperTofu 扩展

```csharp
// 文件: FishMarketUITaskCompKeeperTofu.cs

public interface IFishMarketUITaskCompKeeperTofu : IEFUITaskCompMainTofuBase
{
    // ===== 已有方法 =====
    void KeeperModeSet(string mode);
    void SortTypeSet(FishSortType sortType);
    List<FishMarketFishItemInfo> FishItemInfoListGet();
    void KeepnetEventCallbacksRegister(Action<int> onFishInfoShow);
    event Action<List<FishMarketFishItemInfo>, List<int>> EventOnSellFishRequest;
    event Action<List<int>> EventOnQuestFishSold;

    // ===== 二期新增方法 =====

    /// <summary>
    /// 处理任务栏点击的三种场景
    /// </summary>
    void HandleQuestClickScenario(int questId, FishMarketQuestData questData);
}
```

---

## 9. 动效设计

### 9.1 任务完成动效

```csharp
/// <summary>
/// 播放任务完成动效
/// </summary>
public UIProcess PlayQuestCompleteAnimation(int questIndex)
{
    var process = new UIProcess();

    // 1. 进度条填满动画 (0.3s)
    // 2. 进度文本切换到"已完成" (0.1s)
    // 3. 状态切换到"待领取"闪烁效果 (0.5s)
    // 4. 按钮变为可点击状态

    return process;
}
```

### 9.2 奖励领取动效

```csharp
/// <summary>
/// 播放奖励领取动效
/// </summary>
public UIProcess PlayClaimRewardAnimation(int questIndex, int silverReward, int goldReward)
{
    var process = new UIProcess();

    // 1. 按钮点击反馈 (0.1s)
    // 2. 货币飞向顶部货币栏 (0.5s)
    // 3. 顶部货币数字滚动 (0.3s)
    // 4. 任务卡片状态切换到"已领取" (0.2s)
    // 5. 任务卡片置灰效果 (0.2s)

    return process;
}
```

### 9.3 任务刷新动效

```csharp
/// <summary>
/// 播放任务刷新动效
/// </summary>
public UIProcess PlayQuestRefreshAnimation(int questIndex)
{
    var process = new UIProcess();

    // 1. 旧任务卡片淡出 (0.2s)
    // 2. 刷新图标旋转 (0.3s)
    // 3. 新任务卡片淡入 (0.2s)
    // 4. 新任务高亮提示 (0.5s)

    return process;
}
```

---

## 10. 错误处理

### 10.1 错误码定义

```csharp
public static class FishMarketQuestErrorCode
{
    public const int Success = 0;
    public const int QuestNotFound = 1001;
    public const int QuestNotInProgress = 1002;
    public const int QuestNotCompleted = 1003;
    public const int QuestAlreadyClaimed = 1004;
    public const int QuestExpired = 1005;
    public const int InvalidLevel = 1006;
    public const int ServerError = 9999;
}
```

### 10.2 错误提示

```csharp
private string GetErrorMessage(int errorCode)
{
    switch (errorCode)
    {
        case FishMarketQuestErrorCode.QuestNotFound:
            return "任务不存在";
        case FishMarketQuestErrorCode.QuestNotInProgress:
            return "任务未在进行中";
        case FishMarketQuestErrorCode.QuestNotCompleted:
            return "任务未完成";
        case FishMarketQuestErrorCode.QuestAlreadyClaimed:
            return "奖励已领取";
        case FishMarketQuestErrorCode.QuestExpired:
            return "任务已过期";
        case FishMarketQuestErrorCode.InvalidLevel:
            return "关卡不匹配";
        default:
            return "未知错误";
    }
}
```

---

## 11. 文件修改清单

### 11.1 需要修改的文件

| 文件 | 修改内容 | 优先级 |
|------|----------|--------|
| `FishMarketUITaskDataStructures.cs` | 扩展 FishMarketQuestData, FishMarketFishItemInfo | P0 |
| `FishMarketUITask.cs` | 扩展 PipelineUpdateMask | P0 |
| `FishMarketUITaskCompQuestTofu.cs` | 实现真实数据加载、事件监听、奖励领取 | P0 |
| `FishMarketUITaskCompKeeperTofu.cs` | 增强任务鱼标记、实现三场景处理 | P1 |
| `FishMarketUITaskCompMainTofu.cs` | 扩展任务点击协调、出售后通知 | P1 |
| `FishMarketQuestItemUIController.cs` | 实现 Update 倒计时显示 | P0 |
| `FishMarketQuestUIController.cs` | 扩展刷新、动效接口 | P1 |

### 11.2 需要新增的文件

| 文件 | 说明 | 优先级 |
|------|------|--------|
| `NetTask/FishMarketQuestCompleteReqNetTask.cs` | 任务完成领取网络请求 | P0 |

### 11.3 已有基础(无需修改)

| 文件 | 说明 |
|------|------|
| `PlayerGameObjectCompFishMarketQuestClient.cs` | 逻辑层接口已实现 |
| `FishMarketQuestProtocol.cs` | 网络协议已定义 |

---

## 12. 开发顺序建议

### Phase 1: 数据层 (2天)
1. 扩展数据结构
2. 实现 QuestTofu 真实数据获取
3. 实现服务器时间获取

### Phase 2: 网络层 (1天)
1. 实现 FishMarketQuestCompleteReqNetTask
2. 实现奖励领取流程

### Phase 3: 倒计时 (1天)
1. 实现 QuestItemUIController.Update 倒计时
2. 实现倒计时变红逻辑

### Phase 4: 事件监听 (1天)
1. 实现任务刷新事件监听
2. 实现刷新后管线触发

### Phase 5: 任务鱼标记 (1天)
1. 增强 KeeperTofu 任务鱼标记
2. 实现重量/巨物/新鲜度条件判断

### Phase 6: 三场景处理 (1天)
1. 实现任务栏点击三场景逻辑
2. MainTofu 协调

### Phase 7: 动效 (1天)
1. 任务完成动效
2. 奖励领取动效
3. 任务刷新动效

### Phase 8: 联调测试 (2天)
1. 与服务器联调
2. 边界条件测试
3. 性能优化

---

## 13. 验收检查清单

### 13.1 功能验收

- [ ] 8个任务栏位正确显示服务器数据
- [ ] 任务状态(进行中/待领取/已领取)切换正确
- [ ] 倒计时显示准确，最后30分钟变红
- [ ] 倒计时在 UIController.Update 中更新，不闪烁
- [ ] 任务鱼标记正确(品种+重量/巨物+关卡+新鲜度)
- [ ] 新鲜度为0的鱼不显示任务鱼标记
- [ ] 任务栏点击三场景处理正确
- [ ] 售卖任务鱼后进度正确更新
- [ ] 任务完成后可领取奖励
- [ ] 领取奖励后货币正确增加
- [ ] 任务到期后自动刷新(收到服务器通知)
- [ ] 未领取奖励时任务刷新，能通过邮件补发

### 13.2 性能验收

- [ ] 8个倒计时同时运行帧率>50fps
- [ ] 任务列表刷新<100ms
- [ ] 内存无泄漏(事件注销成对)

### 13.3 代码质量验收

- [ ] 符合BJFramework架构规范
- [ ] 无直接访问其他UITask内部组件
- [ ] 所有网络请求走Check->NetTask->Mask->Pipeline流程
- [ ] 事件订阅与注销成对出现
- [ ] 倒计时在UIController层更新，不在Tofu层驱动

---

**文档结束**

*本文档为鱼市二期详细功能设计方案，所有实现必须遵循本文档定义。*
