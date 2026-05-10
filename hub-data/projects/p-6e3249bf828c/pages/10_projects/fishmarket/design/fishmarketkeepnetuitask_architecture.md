# FishMarketUITask & KeepnetUITask 架构文档

## 概述

本文档描述 `FishMarketUITask`（鱼市界面）和 `KeepnetUITask`（鱼护界面）的架构设计。两个 UITask 共享 `FishMarketUITaskCompKeeperTofu` 组件，通过部分刷新机制实现复用。

---

## 1. UITask 组件结构

### 1.1 FishMarketUITask

```
FishMarketUITask
├── Tofu 组件
│   ├── FishMarketUITaskCompMainTofu      (主协调者)
│   ├── FishMarketUITaskCompKeeperTofu    (鱼护列表 - 共享组件)
│   ├── FishMarketUITaskCompQuestTofu     (任务列表)
│   └── FishMarketUITaskCompSellConfirmTofu (出售确认)
│
├── Layer
│   ├── FishMarketMainLayer               (主界面)
│   └── FishMarketSellConfirmLayer        (出售确认弹窗 - LazyLoad)
│
└── UIController
    ├── FishMarketMainUIController        (主控制器)
    ├── FishMarketKeeperUIController      (鱼护列表控制器)
    ├── FishMarketQuestUIController       (任务列表控制器)
    └── FishMarketSellConfirmUIController (出售确认控制器)
```

### 1.2 KeepnetUITask

```
KeepnetUITask
├── Tofu 组件
│   ├── KeepnetUITaskCompMainTofu              (主协调者)
│   ├── FishMarketUITaskCompKeeperTofu         (鱼护列表 - 共享组件)
│   └── CommonUITaskTofuSceneStateControl      (场景状态控制)
│
├── Layer
│   └── KeepnetMainLayer                       (主界面)
│
└── UIController
    ├── KeepnetUIMainController                (主控制器)
    └── FishMarketKeeperUIController           (鱼护列表控制器 - 共享)
```

---

## 2. 共享组件设计

### 2.1 FishMarketUITaskCompKeeperTofu

该组件在两个 UITask 中被复用，通过 `KeeperMode` 切换不同行为：

| 模式 | 常量 | 行为 |
|------|------|------|
| FishMarket | `KeeperModeName4FishMarket` | 下半屏显示，支持多选和出售 |
| Keepnet | `KeeperModeName4Keepnet` | 全屏显示，点击查看鱼详情 |

### 2.2 部分刷新 ParamKey

为避免不同 UITask 间的刷新冲突，采用类名前缀命名：

```csharp
// 定义在 FishMarketUITaskCompKeeperTofu 中
public const string UpdateParamKey_KeeperTofu_RefreshFishList = "KeeperTofu_RefreshFishList";
```

---

## 3. 数据流

### 3.1 FishMarketUITask 数据流

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FishMarketUITask                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    EventOnSellFishRequest    ┌──────────────────┐ │
│  │  KeeperTofu  │ ─────────────────────────────▶│    MainTofu      │ │
│  │  (鱼护列表)   │                               │   (协调者)       │ │
│  └──────────────┘                               └────────┬─────────┘ │
│         ▲                                                │           │
│         │                                                ▼           │
│         │                                       ┌──────────────────┐ │
│         │                                       │ SellConfirmTofu  │ │
│         │                                       │  (出售确认)       │ │
│         │                                       └────────┬─────────┘ │
│         │                                                │           │
│         │   EventOnQuestFishSortRequest                  │           │
│  ┌──────┴───────┐◀───────────────────────────────────────┘           │
│  │  QuestTofu   │                                                    │
│  │  (任务列表)   │                                                    │
│  └──────────────┘                                                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 KeepnetUITask 数据流

```
┌─────────────────────────────────────────────────────────────────────┐
│                         KeepnetUITask                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐  OnFishInfoShow   ┌──────────────────────────┐│
│  │   KeeperTofu     │ ─────────────────▶│      MainTofu            ││
│  │ (鱼护列表-共享)   │                   │     (协调者)             ││
│  └──────────────────┘                   └───────────┬──────────────┘│
│                                                     │               │
│                                                     ▼               │
│                                          ┌─────────────────────────┐│
│                                          │  CatchFishUITask        ││
│                                          │   (鱼详情界面)           ││
│                                          └─────────────────────────┘│
│                                                                      │
│  ┌──────────────────────────┐                                       │
│  │ SceneStateControlTofu    │                                       │
│  │   (场景状态控制)          │                                       │
│  └──────────────────────────┘                                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Pipeline 更新流程

### 4.1 标准 Pipeline 阶段

```
UpdateContextSetup
       │
       ▼
DataCacheUpdateIsNeededCheck ──▶ DataCacheUpdate
       │
       ▼
DynamicResLoadIsNeededCheck ──▶ DynamicResCollect4Load
       │
       ▼
LayerLoadIsNeededCheck ──▶ LayerDescCollect4Load
       │
       ▼
    ViewUpdate
       │
       ▼
  Pipeline 完成
```

### 4.2 部分刷新机制

当 `m_isUpdateAllTofu = false` 时，系统调用每个 Tofu 的 `NeedUpdateInThisPipeline` 方法判断是否参与本次刷新。

#### 发起部分刷新示例

```csharp
// KeeperTofu 内部发起刷新
private void KeeperPipelineLaunch()
{
    var pipelineInitInfo = m_owner.CompUpdatePipelineManagerGet().UpdatePipelineInitInfoAlloc();
    pipelineInitInfo.m_isUpdateAllTofu = false;  // 启用部分刷新
    pipelineInitInfo.m_customParamDict.SetParam(UpdateParamKey_KeeperTofu_RefreshFishList, true);
    m_owner.CompUpdatePipelineManagerGet().UpdatePipelineLaunch(pipelineInitInfo);
}
```

#### KeeperTofu 刷新判断

```csharp
public override void UpdateContextSetup(ICustomParamDictionaryReadOnly paramDict, ...)
{
    // 使用自己定义的 ParamKey 检查是否需要刷新
    m_needRefreshFishList = paramDict.GetStructParam<bool>(UpdateParamKey_KeeperTofu_RefreshFishList);
}

public override bool DataCacheUpdateIsNeededCheck()
{
    return (IsUITaskUpdatePipelineInitOrResume() || m_needRefreshFishList);
}
```

---

## 5. ParamKey 配置

### 5.1 FishMarketUITask

```csharp
protected override string[] CustomParamKey4UpdatePipelineDefineArray
{
    get
    {
        return new string[]
        {
            ParamKeySelectedFishList,
            ParamKeySelectedFishIndicesList,
            FishMarketUITaskCompKeeperTofu.UpdateParamKey_KeeperTofu_RefreshFishList
        };
    }
}
```

### 5.2 KeepnetUITask

```csharp
protected override string[] CustomParamKey4UpdatePipelineDefineArray
{
    get
    {
        return new string[]
        {
            ParamKeyPipelineUpdateMask,
            FishMarketUITaskCompKeeperTofu.UpdateParamKey_KeeperTofu_RefreshFishList
        };
    }
}
```

---

## 6. 关键设计原则

1. **ParamKey 命名规范**：使用 `类名_功能名` 格式避免冲突
2. **单一数据源**：ParamKey 常量定义在 Tofu 内部，UITask 引用
3. **部分刷新优先**：非必要不刷新全部 Tofu，提升性能
4. **模式切换解耦**：通过 `KeeperMode` 实现同一组件的不同行为

---

## 7. 文件清单

| 文件 | 描述 |
|------|------|
| `FishMarketUITask.cs` | 鱼市 UITask 定义 |
| `KeepnetUITask.cs` | 鱼护 UITask 定义 |
| `FishMarketUITaskCompMainTofu.cs` | 鱼市主 Tofu |
| `FishMarketUITaskCompKeeperTofu.cs` | 鱼护列表 Tofu (共享) |
| `FishMarketUITaskCompQuestTofu.cs` | 任务列表 Tofu |
| `FishMarketUITaskCompSellConfirmTofu.cs` | 出售确认 Tofu |
| `KeepnetUITaskCompMainTofu.cs` | 鱼护主 Tofu |
