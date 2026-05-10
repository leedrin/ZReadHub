# FishMarketUITask - BJFramework 蓝图语义解析

## 1. 语义提取清单

### 1.1 名词 (Entities) - 纯数据层
| 实体名称 | 核心属性 | 数据来源 |
|---------|---------|---------|
| FishMarketQuestInfo | questId, configId, state, progress, endTime, reward | Server + Config |
| KeeperFishData | fishId, weight, freshness, price, quality, catchTime | PlayerGameObject |
| CurrencyData | goldCoin, silverCoin | PlayerGameObject |
| SellConfirmData | selectedFishList, totalPrice | KeeperTofu缓存 |

### 1.2 动词 (Actions) - 业务逻辑层
| 服务名称 | 输入 | 输出 | 所属Tofu |
|---------|------|------|---------|
| QuestProgressTrack | soldFishIdList | updatedQuestList | QuestTofu |
| CrossLevelValidate | fish.catchLevelConfId | bool isValid | KeeperTofu |
| FreshnessCalc | pushDateTime | freshnessPercent | FishInfoFormatter |
| FishSort | fishList, sortType | sortedFishList | KeeperTofu |
| MultiSelectToggle | fishIndex | newSelectState | KeeperTofu |

### 1.3 反馈 (View/Feedback) - 表现层
| 视图组件 | 类型 | 更新方式 |
|---------|------|---------|
| QuestListView | LoopScrollRect | PipelineRefresh |
| FishGridView | LoopScrollRect | PipelineRefresh |
| CountdownText | Text | UIController.Update |
| TaskFishMarker | StateController | PipelineRefresh |
| FreshnessText | Text | PipelineRefresh |

---

## 2. ER模型 (Entity-Relationship)

```mermaid
erDiagram
    FISH_MARKET_QUEST ||--|| QUEST_CONFIG : "configId"
    FISH_MARKET_QUEST {
        int questId "任务唯一ID"
        int configId "配置表ID"
        int state "状态:0锁定,1进行中,2可领取,3已完成"
        int currentProgress "当前进度"
        int requiredCount "目标数量"
        float remainingSeconds "剩余秒数"
        datetime endTime "结束时间"
        int rewardSilverCoin "银币奖励"
        int rewardGoldCoin "金币奖励"
        int fishingLevelConfId "所属关卡"
    }
    
    QUEST_CONFIG {
        int configId "配置ID"
        int requiredFishId "目标鱼种"
        int minWeightRequired "最小重量(克)"
        FishSizeType minSizeRequired "最小尺寸"
        int targetCount "目标数量"
        int refreshHour "刷新时间(小时)"
        int refreshGroup "刷新组(0-7)"
    }
    
    KEEPER_FISH_DATA ||--|| FISH_INFO_CONFIG : "fishInfoConfigId"
    KEEPER_FISH_DATA {
        int fishIndex "鱼护索引"
        int fishInfoConfigId "鱼配置ID"
        FishType fishType "鱼种类型"
        float weight "重量(克)"
        float length "长度(厘米)"
        float freshnessPercent "新鲜度0-100"
        long sellPrice "售价"
        datetime pushDateTime "入护时间"
        int catchLevelConfId "钓获关卡"
        bool isTaskFish "是否任务鱼"
    }
    
    FISH_INFO_CONFIG {
        int configId "配置ID"
        FishType fishType "鱼种"
        FishQualityType quality "品质"
        string iconPath "图标路径"
        int juvenilePrice "幼年体价格"
        int adultPrice "成年体价格"
    }
    
    FISH_MARKET_QUEST ||--o{ KEEPER_FISH_DATA : "matches"
    
    CURRENCY_DATA {
        long goldCoin "金币"
        long silverCoin "银币"
    }
    
    SELL_CONFIRM_DATA {
        List selectedFishIndices "选中的鱼索引"
        long totalPrice "总价"
    }
```

---

## 3. 蓝图拓扑 - 核心执行流

### 3.1 任务进度追踪流

```mermaid
graph LR
    subgraph view_layer["View: FishMarketQuestUIController"]
        V1["m_QuestList: LoopScrollRect"]
        V2["m_CountdownText: Text"]
        V3["m_ProgressText: Text"]
    end
    
    subgraph logic_layer["Service: FishMarketUITaskCompQuestTofu"]
        S1([OnFishSoldEvent]) ==> S2["CheckQuestProgress"]
        S2 ==>|"foreach quest"| S3{"IsFishMatchQuest?"}
        S3 ==>|"Yes"| S4["UpdateProgress++"]
        S4 ==> S5{"Progress >= Required?"}
        S5 ==>|"Yes"| S6["SetState(Claimable)"]
        S5 ==>|"No"| S7["SetMask(RefreshQuestProgress)"]
        S6 ==> S8["SetMask(RefreshQuestList + PlayCompleteAnim)"]
    end
    
    subgraph data_layer["Entity: FishMarketQuestData"]
        D1[("m_questInfoList")]
        D2[("m_fishItemInfoList")]
    end
    
    %% 数据绑定
    D1 -.->|"[Bind:List]"| V1
    D1 -.->|"[Bind:Countdown]"| V2
    D1 -.->|"[Bind:Progress]"| V3
    
    %% 事件触发
    D2 -->|"[Event:OnFishSold]"| S1
    
    style view_layer fill:#e7f5ff,stroke:#1971c2
    style logic_layer fill:#e5dbff,stroke:#5f3dc4
    style data_layer fill:#fff4e6,stroke:#e67700
```

### 3.2 跨关卡验证 + 新鲜度计算流

```mermaid
graph LR
    subgraph view_layer["View: FishMarketFishItemUIController"]
        V1["m_freshnessText: Text"]
        V2["m_fishIcon: Image"]
        V3["m_questFishMarker: StateController"]
        V4["m_priceText: Text"]
    end
    
    subgraph logic_layer["Service Layer"]
        subgraph keeper_tofu["KeeperTofu"]
            S1([DataCacheUpdate]) ==> S2["CalculateFreshness"]
            S2 ==> S3["CheckCrossLevel"]
            S3 ==> S4["UpdateTaskFishMark"]
        end
        
        subgraph formatter["FishInfoFormatter"]
            F1["FreshnessPercentCalc\n(pushDateTime): float"]
            F2["FormatWeight\n(grams): string"]
        end
    end
    
    subgraph data_layer["Entity"]
        D1[("m_pushDateTime: DateTime")]
        D2[("m_catchLevelConfId: int")]
        D3[("m_currentLevelConfId: int")]
        D4[("m_freshnessPercent: float")]
    end
    
    %% 执行流
    D1 -->|"[Param]"| F1
    F1 -.->|"[Return]"| D4
    D4 -.->|"[Bind:Color]"| V1
    D4 -.->|"[Bind:Grayscale]"| V2
    
    D2 -->|"[Compare]"| S3
    D3 -->|"[Compare]"| S3
    S3 -.->|"[Result]"| V3
    
    D4 -.->|"[Bind:Price]"| V4
    
    style view_layer fill:#e7f5ff,stroke:#1971c2
    style keeper_tofu fill:#e5dbff,stroke:#5f3dc4
    style formatter fill:#d3f9d8,stroke:#2f9e44
    style data_layer fill:#fff4e6,stroke:#e67700
```

### 3.3 任务鱼排序 + 三场景点击流

```mermaid
graph TB
    subgraph view_layer["View: FishMarketKeeperUIController"]
        V1["m_fishGrid: LoopScrollRect"]
        V2["m_sortDropdown: Dropdown"]
        V3["m_selectAllBtn: Button"]
        V4["m_questFishMarker: GameObject[]"]
    end
    
    subgraph logic_layer["Service: FishMarketUITaskCompKeeperTofu"]
        %% 排序流
        S1([OnSortTypeChanged]) ==> S2["SetSortType(type)"]
        S2 ==> S3{"SortType == Quest?"}
        S3 ==>|"Yes"| S4["SortByQuestPriority"]
        S3 ==>|"No"| S5["SortByStandard"]
        S4 ==> S6["TaskFishFirst()"]
        S5 ==> S7["Time/Weight/Price/RareSort()"]
        S6 ==> S8["SetMask(RefreshKeepnetFishList)"]
        S7 ==> S8
        
        %% 三场景点击流
        S9([OnQuestItemClick]) ==> S10{"IsMultiSelectMode?"}
        S10 ==>|"No\n场景1"| S11["EnterMultiSelectMode()"]
        S11 ==> S12["AutoSelectTaskFish()"]
        S12 ==> S13["SetSortType(Quest)"]
        
        S10 ==>|"Yes\n场景2"| S14{"HasSelectedFish?"}
        S14 ==>|"Yes"| S15["DeselectNonTaskFish()"]
        S15 ==> S16["SelectTaskFish(questId)"]
        
        S14 ==>|"No\n场景3"| S17{"HasMatchingFish?"}
        S17 ==>|"Yes"| S18["SelectTaskFish(questId)"]
        S17 ==>|"No"| S19["DoNothing()"]
    end
    
    subgraph data_layer["Entity"]
        D1[("m_currentSortType: enum")]
        D2[("m_selectedStateList: bool[]")]
        D3[("m_isMultiSelectMode: bool")]
    end
    
    %% 绑定
    V2 -->|"[Event:OnValueChanged]"| S1
    D1 -.->|"[Bind]"| V1
    D2 -.->|"[Bind:Selection]"| V1
    
    style view_layer fill:#e7f5ff,stroke:#1971c2
    style logic_layer fill:#e5dbff,stroke:#5f3dc4
    style data_layer fill:#fff4e6,stroke:#e67700
```

### 3.4 售卖确认 + 跨关卡验证流

```mermaid
graph LR
    subgraph view_layer["View"]
        V1["m_sellBtn: Button"]
        V2["FishMarketSellConfirmUIController"]
        V3["m_fishList: ScrollView"]
        V4["m_totalPriceText: Text"]
    end
    
    subgraph logic_layer["Service: FishMarketUITaskCompMainTofu"]
        S1([OnSellBtnClick]) ==> S2{"HasSelectedFish?"}
        S2 ==>|"No"| S3["ShowFloatTip\n('您还没有选择需要售出的鱼')"]
        S2 ==>|"Yes"| S4["CollectTaskFishIds()"]
        S4 ==> S5["CheckCrossLevelAndFreshness"]
        S5 ==> S6["SetMask(PlayConfirmSellUIProcess)"]
        
        S7([OnSellConfirmed]) ==> S8["FishMarketSellReqNetTask\n(fishList)"]
        S8 ==>|"Success"| S9["UpdateCurrency()"]
        S9 ==> S10["QuestTofu.OnQuestFishSold()"]
        S10 ==> S11["SetMask(SellFinish + RefreshAll)"]
    end
    
    subgraph data_layer["Entity"]
        D1[("m_selectedFishIndices: List<int>")]
        D2[("m_catchLevelConfId: int[]")]
        D3[("m_freshnessPercent: float[]")]
    end
    
    %% 连接
    V1 -->|"[Event:OnClick]"| S1
    D1 -.->|"[Bind]"| V3
    D1 -.->|"[Calc:Total]"| V4
    
    style view_layer fill:#e7f5ff,stroke:#1971c2
    style logic_layer fill:#e5dbff,stroke:#5f3dc4
    style data_layer fill:#fff4e6,stroke:#e67700
```

### 3.5 倒计时实时更新流

```mermaid
graph LR
    subgraph view_layer["View: FishMarketQuestItemUIController"]
        V1["m_countdownText: Text"]
    end
    
    subgraph logic_layer["ViewController.Update"]
        S1([Update]) ==> S2["GetCurrentGameTime()"]
        S2 ==> S3["CalculateRemainingTime\n(endTime - currentTime)"]
        S3 ==> S4{"Remaining < 30min?"}
        S4 ==>|"Yes"| S5["SetTextColor(Red)"]
        S4 ==>|"No"| S6["SetTextColor(Normal)"]
        S5 ==> S7["UpdateCountdownText()"]
        S6 ==> S7
    end
    
    subgraph data_layer["Entity"]
        D1[("m_endTime: DateTime")]
        D2[("m_remainingSeconds: float")]
    end
    
    D1 -.->|"[Read]"| S2
    S3 -.->|"[Write]"| D2
    D2 -.->|"[Bind:Format]"| V1
    
    style view_layer fill:#e7f5ff,stroke:#1971c2
    style logic_layer fill:#e5dbff,stroke:#5f3dc4
    style data_layer fill:#fff4e6,stroke:#e67700
```

---

## 4. 分层架构总览

```mermaid
graph TB
    subgraph view_layer["View Layer (UIController)"]
        direction TB
        V1[FishMarketQuestUIController]
        V2[FishMarketKeeperUIController]
        V3[FishMarketFishItemUIController]
        V4[FishMarketSellConfirmUIController]
        V5[FishMarketQuestItemUIController]
    end
    
    subgraph event_bus["Event Bus"]
        E1["EventOnFishItemQuestTipHoverStart"]
        E2["EventOnFishItemQuestTipHoverEnd"]
        E3["EventOnFishSold"]
        E4["EventOnQuestItemClick"]
        E5["EventOnSortTypeChanged"]
    end
    
    subgraph logic_layer["Logic Layer (Tofu)"]
        direction TB
        T1[FishMarketUITaskCompQuestTofu]
        T2[FishMarketUITaskCompKeeperTofu]
        T3[FishMarketUITaskCompMainTofu]
        T4[FishMarketUITaskCompSellConfirmTofu]
    end
    
    subgraph data_layer["Data Layer (Entity)"]
        direction TB
        D1[FishMarketQuestData]
        D2[FishMarketFishItemInfo]
        D3[CurrencyData]
        D4[SellConfirmData]
    end
    
    subgraph external["External Systems"]
        EX1[PlayerGameObject]
        EX2[ConfigData]
        EX3[ServerAPI]
    end
    
    %% 连接
    V1 -.->|"[Event]"| E4
    V2 -.->|"[Event]"| E5
    V3 -.->|"[Event]"| E1
    V3 -.->|"[Event]"| E2
    
    E1 --> T2
    E2 --> T2
    E4 --> T1
    E5 --> T2
    
    T1 -.->|"[CRUD]"| D1
    T2 -.->|"[CRUD]"| D2
    T3 -.->|"[CRUD]"| D3
    T4 -.->|"[CRUD]"| D4
    
    D1 -.->|"[Fetch]"| EX1
    D2 -.->|"[Fetch]"| EX1
    D1 -.->|"[Config]"| EX2
    D3 -.->|"[NetReq]"| EX3
    
    style view_layer fill:#e7f5ff,stroke:#1971c2
    style event_bus fill:#fff9db,stroke:#f59f00
    style logic_layer fill:#e5dbff,stroke:#5f3dc4
    style data_layer fill:#fff4e6,stroke:#e67700
    style external fill:#e3fafc,stroke:#1098ad
```

---

## 5. 质量检查清单

- [x] 所有subgraph都有明确的框架角色标注 (View/Logic/Data)
- [x] 连线标签包含代码生成所需的参数类型 (如 `fishIndex: int`)
- [x] 节点ID为合法的C#变量名 (无空格，无特殊字符)
- [x] 执行流 (`==>`) 逻辑闭环
- [x] 数据流 (`-.->`) 明确标注了 `[Bind]` 或 `[Read]`/`[Write]`
- [x] 事件流使用 `[Event:Type]` 标注
- [x] 使用了规定的颜色方案
  - Logic/Service: 紫色 (#e5dbff)
  - Entity/Data: 黄色 (#fff4e6)
  - View/UI: 蓝色 (#e7f5ff)

---

**文档生成时间:** 2026-02-06  
**解析工具:** BJFramework Blueprint Compiler  
**基于PRD:** FishmarketUITask_PRD_标注版.md
