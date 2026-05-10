# StageActor 命名观察点（ObservationPoint）功能设计文档

> 版本：v2.2
> 日期：2026-03-20
> 范围：Phase 1 — 基础能力实现，不含子类具体注册和钓具迁移

---

## 1. 概述

### 1.1 背景

ShowcaseCameraMode 的 AutoFit 机制支持通过 `IObservationPointProvider` 接口获取命名观察点（如 "Head"、"Weapon"），使不同 VisualCamera (VM) 能自动对准目标特定部位。但现有 StageActor 体系尚未实现该接口。

旧版 `TackleStageActor` 通过 `CameraCloseUpPointTryGet(TackleStageActorCameraCloseUpPointType)` 枚举方法提供钓竿、渔轮、导环、饵组等特写点数据（center + radius），具备类似能力，但采用硬编码枚举而非字符串命名，无法与 ShowcaseCamera 的 VM 名称驱动机制对接。

### 1.2 目标

在 StageActor 基类中实现 `IObservationPointProvider`，使任意 StageActor 能够存储 `{名称, ObservationPointInfo}` 字典，其中名称与 ShowcaseCameraMode Prefab 上 VisualCamera 节点名称直接一致（如 VM 名为 "Head"，Actor 提供 "Head" 的 ObservationPointInfo）。

### 1.3 核心收益

- **ShowcaseCamera 联动**：VM 切换时 AutoFit 自动获取对应观察点，无需额外代码
- **旧版兼容**：TackleStageActor 的 CameraCloseUpPoint 数据通过 override 映射到新接口
- **迁移预留**：TackleAssembleTackleUIController 未来可直接使用 ShowcaseCamera + ObservationPoint 替换 SlotFocus 方案

### 1.4 职责划分

| 角色                               | 职责                                               |
| -------------------------------- | ------------------------------------------------ |
| **Actor**                        | 提供"看哪里、多大"（Center + Size）                        |
| **VM / AutoFitModule**           | 决定"怎么拍、留多少边距"（FitMode、Padding、MinMax Distance）   |
| **VM Preset / Request Override** | 决定 TrackingMode（Snapshot / Continuous），Actor 不参与 |

---

## 2. 现有架构分析

### 2.1 ShowcaseCamera AutoFit 数据流（已实现）

```
ShowcaseModeComponent.OnUpdate()
  → BuildModuleContext()
    → ObservationPointExtension.DefaultPointName = activeVC.DefaultObservationPointName
  → ShowcaseAutoFitModuleComponent.Execute()
    → ResolveObservationPoint(target, effectivePointName, trackingMode)
      → ITargetProvider.ObservationPointGet(pointName)
        → FollowTargetProviderAdapter.ObservationPointGet(pointName)
          → IObservationPointProvider.ObservationPointGet(pointName)  ← 需要 Actor 实现
```

### 2.2 FollowTargetProviderAdapter 自动适配（已实现）

```csharp
// FollowTargetProviderAdapter.cs 构造函数（已有代码）
public FollowTargetProviderAdapter(ICameraFollowTarget target)
{
    m_target = target;
    m_observationProvider = target as IObservationInfoProvider;
    m_observationPointProvider = target as IObservationPointProvider;  // ← 自动检测
}
```

**关键洞察**：`IStageActor : ICameraFollowTarget`，`FollowTargetProviderAdapter` 构造时自动尝试将 target 转为 `IObservationPointProvider`。因此只要 StageActor 基类实现该接口，整条链路自动生效，**相机侧零修改**。

**契约补充（v2.2）**：
- 保持 `ObservationPointGet` miss 返回 `default`。
- `FollowTargetProviderAdapter` 在 `Has + Get` 之后增加有效性校验（`Size.IsValid` + `Center` 数值合法），无效则返回 null，触发 AutoFit fallback 到默认中心。

### 2.3 旧版 TackleStageActor 特写点机制

```csharp
public enum TackleStageActorCameraCloseUpPointType
{
    RodCloseUpPoint,              // 钓竿整体
    ReelCloseUpPoint,             // 渔轮
    GuideAtEndOfRodCloseUpPoint,  // 竿尖导环
    BaitGroupPartCloseUpPoint     // 饵组
}

public bool CameraCloseUpPointTryGet(
    TackleStageActorCameraCloseUpPointType closeUpPointType,
    out Vector3 centerPosition, out float radius)
```

旧版返回 `(center, radius)`，新版需要 `ObservationPointInfo { Center, Size }`，映射关系：
- `center` → `ObservationPointInfo.Center`
- `radius` → `ObservationSizeInfo.FromSize(radius * 2, radius * 2, radius * 2)`

旧版 API 仅在 `TackleAssembleUITaskCompMainTofu.cs` 中被调用（1处），兼容影响范围小。

---

## 3. 设计方案

### 3.1 方案选型

经评估三种方案，选定 **方案 A：基类内置字典**：

| 方案 | 描述 | 结论 |
|------|------|------|
| **A 基类内置字典** | StageActorBase 直接实现 IObservationPointProvider | **选定**。相机侧零修改，FollowTargetProviderAdapter 的 as 检测自动对接 |
| B 独立 Mixin | 创建独立 Provider 类，Actor 持有可选实例 | 否决。as 检测失效，需改适配器 |
| C MonoBehaviour 挂载 | Prefab 挂载配置组件 | 否决。大量物品不可能逐个挂脚本 |

### 3.2 接口设计决策

**`IStageActor` 不继承 `IObservationPointProvider`**（通过基类实现 + `as` 运行时转换检测）：
1. `FollowTargetProviderAdapter` 通过 `target as IObservationPointProvider` 运行时检测，不需要编译期约束
2. 不是所有 Actor 都需要观察点，强制接口增加无意义的实现负担
3. 基类提供默认空字典实现，子类按需注册

---

## 4. 详细设计

### 4.1 ObservationPointEntry 数据结构

支持三种数据来源模式：

```csharp
/// <summary>
/// 观察点条目（StageActorBase 内部类）
/// 支持三种数据来源：局部偏移、骨骼路径、动态委托
/// 注意：使用 class 而非 struct，因为 BonePath 模式需要缓存 Transform 引用，
/// struct 从字典取出是副本，缓存修改不会写回。
/// </summary>
private class ObservationPointEntry
{
    public enum SourceMode
    {
        LocalOffset,    // 基于 Actor root 的局部坐标偏移
        BonePath,       // 骨骼路径查找
        Dynamic         // 委托计算
    }

    public SourceMode Mode;
    public Vector3 LocalOffset;           // LocalOffset 模式：相对 root 的偏移
    public string BonePath;               // BonePath 模式：骨骼路径
    public ObservationSizeInfo StaticSize; // LocalOffset / BonePath 模式共用
    public Func<ObservationPointInfo?> DynamicProvider; // Dynamic 模式

    // ---- 内部缓存 ----
    private const int BoneResolveRetryIntervalFrames = 10;
    private Transform m_cachedRoot;
    private Transform m_cachedTransform;
    private uint m_cachedVersion;
    private int m_nextResolveFrame;

    /// <summary>
    /// 解析观察点信息
    /// 返回 null 表示无法提供有效数据，AutoFit 将 fallback 到默认中心
    /// </summary>
    public ObservationPointInfo? Resolve(StageActorBase actor, uint cacheVersion)
    {
        switch (Mode)
        {
            case SourceMode.Dynamic:
                return DynamicProvider?.Invoke();

            case SourceMode.BonePath:
                if (actor.GameObject == null || string.IsNullOrEmpty(BonePath) || !StaticSize.IsValid)
                {
                    return null;
                }

                var root = actor.GameObject.transform;
                bool rootChanged = m_cachedRoot != root;
                bool versionChanged = m_cachedVersion != cacheVersion;
                bool cacheInvalid = m_cachedTransform == null || !m_cachedTransform.IsChildOf(root);

                if ((rootChanged || versionChanged || cacheInvalid)
                    && Time.frameCount >= m_nextResolveFrame)
                {
                    m_cachedRoot = root;
                    m_cachedVersion = cacheVersion;
                    m_cachedTransform = root.Find(BonePath);
                    m_nextResolveFrame = m_cachedTransform == null
                        ? Time.frameCount + BoneResolveRetryIntervalFrames
                        : Time.frameCount;
                }

                return m_cachedTransform != null
                    ? new ObservationPointInfo { Center = m_cachedTransform.position, Size = StaticSize }
                    : (ObservationPointInfo?)null;

            case SourceMode.LocalOffset:
                if (actor.GameObject != null)
                    return new ObservationPointInfo
                    {
                        Center = actor.GameObject.transform.TransformPoint(LocalOffset),
                        Size = StaticSize
                    };
                return null;

            default:
                return null;
        }
    }
}
```

**三种模式适用场景**：
| 模式 | 适用场景 | 示例 |
|------|---------|------|
| `LocalOffset` | 无骨骼的简单物品，基于 root 偏移 | 物品顶部 `("Top", Vector3.up * 0.5, size)` |
| `BonePath` | 有骨骼的角色/鱼类 | 角色头部 `("Head", "Root/Hips/Spine/Head", size)` |
| `Dynamic` | 尺寸/位置动态变化 | 饵组包围盒多子物体聚合 |

### 4.2 StageActorBase 实现 IObservationPointProvider

```csharp
public abstract class StageActorBase : IStageActor, IObservationPointProvider
{
    // ===== 新增字段 =====
    private Dictionary<string, ObservationPointEntry> m_observationPoints;
    private uint m_observationPointCacheVersion;

    // ===== IObservationPointProvider 实现 =====

    // 统一入口：仅当观察点可证明有效时返回 true
    protected bool ObservationPointTryGet(string pointName, out ObservationPointInfo pointInfo)
    {
        // 字典查找 + Entry.Resolve + 有效性校验（size有效、center合法）
    }

    public virtual ObservationPointInfo ObservationPointGet(string pointName)
    {
        return ObservationPointTryGet(pointName, out var pointInfo) ? pointInfo : default;
    }

    public virtual bool HasObservationPoint(string pointName)
    {
        return ObservationPointTryGet(pointName, out _);
    }

    // ===== 子类注册 API（protected） =====

    /// <summary>
    /// 注册偏移观察点（基于 Actor root 的局部坐标偏移）
    /// 适用于无骨骼的简单物品
    /// </summary>
    protected void ObservationPointRegister(string pointName,
        Vector3 localOffset, ObservationSizeInfo size)
    {
        m_observationPoints ??= new Dictionary<string, ObservationPointEntry>();
        m_observationPoints[pointName] = new ObservationPointEntry
        {
            Mode = ObservationPointEntry.SourceMode.LocalOffset,
            LocalOffset = localOffset,
            StaticSize = size
        };
        ObservationPointCacheInvalidate();
    }

    /// <summary>
    /// 注册骨骼观察点（通过骨骼路径查找 Transform）
    /// 适用于有骨骼的角色/鱼类
    /// </summary>
    protected void ObservationPointRegister(string pointName,
        string bonePath, ObservationSizeInfo size)
    {
        m_observationPoints ??= new Dictionary<string, ObservationPointEntry>();
        m_observationPoints[pointName] = new ObservationPointEntry
        {
            Mode = ObservationPointEntry.SourceMode.BonePath,
            BonePath = bonePath,
            StaticSize = size
        };
        ObservationPointCacheInvalidate();
    }

    /// <summary>
    /// 注册动态观察点（委托每次调用时计算）
    /// 适用于尺寸/位置动态变化的场景
    /// </summary>
    protected void ObservationPointRegister(string pointName,
        Func<ObservationPointInfo?> dynamicProvider)
    {
        m_observationPoints ??= new Dictionary<string, ObservationPointEntry>();
        m_observationPoints[pointName] = new ObservationPointEntry
        {
            Mode = ObservationPointEntry.SourceMode.Dynamic,
            DynamicProvider = dynamicProvider
        };
        ObservationPointCacheInvalidate();
    }

    /// <summary>
    /// 注销观察点
    /// </summary>
    protected void ObservationPointUnregister(string pointName)
    {
        m_observationPoints?.Remove(pointName);
        ObservationPointCacheInvalidate();
    }

    /// <summary>
    /// 清空所有观察点
    /// </summary>
    protected void ObservationPointClearAll()
    {
        m_observationPoints?.Clear();
        ObservationPointCacheInvalidate();
    }

    protected void ObservationPointCacheInvalidate()
    {
        m_observationPointCacheVersion++;
    }
}
```

**设计要点**：
- 字典延迟初始化（`??=`），不使用观察点的 Actor 零内存开销
- `ObservationPointGet` 和 `HasObservationPoint` 都是 `virtual`，TackleStageActor 可 override
- **统一入口契约**：`Has` 与 `Get` 都通过 `ObservationPointTryGet`，避免双路径语义漂移
- **default miss 约定**：`ObservationPointGet` miss 必须返回 `default`（不抛错）
- **适配层兜底**：`FollowTargetProviderAdapter` 对 `Get` 结果做有效性校验，不合法即返回 null，保证 AutoFit fallback 生效
- `StageActor` 和 `StageActorBase` 都定义在同一文件 `StageActorBase.cs` 中，两个类都需要添加 `IObservationPointProvider` 实现。注意 `StageActor` 实现 `ICameraFollowTarget`（非 `IStageActor`），但 `as` 检测同样适用
- 子类在 `Destroy()` 中应调用 `ObservationPointClearAll()` 释放缓存的 Transform 引用，避免持有已销毁 GameObject 的引用
- `using BlackJack.ProjectEF.Runtime.CameraController;` 需要添加到 `StageActorBase.cs` 的 using 声明中

**BonePath 缓存失效策略（v2.2）**：
- **懒重查**：当缓存 Transform 为空、失效、root 变化时，按节流间隔重查 `Transform.Find(BonePath)`
- **主动失效**：提供 `ObservationPointCacheInvalidate()`，目标重建/换装事件触发时可主动刷新缓存版本
- **销毁清理**：`Destroy()` 时调用 `ObservationPointClearAll()`

**线程安全 / 初始化时序说明**：
- 字典延迟初始化和 `actor.GameObject` null 检查保证了在 `ViewInit()` 完成前调用 `ObservationPointGet` 的安全性（返回 default，触发 fallback）

### 4.3 TackleStageActor 兼容映射

通过 override 将旧版 CloseUpPoint 枚举桥接到新接口，旧代码完全不动。

#### 4.3.1 名称映射约定

| 旧枚举值 | 新观察点名称 / VM 名称 | 备注 |
|---------|---------------------|------|
| `RodCloseUpPoint` | `Rod` | 注意：旧版实现与 Reel 共享同一数据源 `ReelBoundsCenterWorldPosAndSizeRadiusGet()`，Phase 2 可考虑独立数据源 |
| `ReelCloseUpPoint` | `Reel` | — |
| `GuideAtEndOfRodCloseUpPoint` | `RodTip` | — |
| `BaitGroupPartCloseUpPoint` | `BaitGroup` | — |

#### 4.3.2 实现代码

```csharp
public class TackleStageActor : StageActorBase
{
    // 旧枚举 → 新名称 映射表
    private static readonly Dictionary<TackleStageActorCameraCloseUpPointType, string>
        s_closeUpPointNameMap = new()
    {
        { TackleStageActorCameraCloseUpPointType.RodCloseUpPoint, "Rod" },
        { TackleStageActorCameraCloseUpPointType.ReelCloseUpPoint, "Reel" },
        { TackleStageActorCameraCloseUpPointType.GuideAtEndOfRodCloseUpPoint, "RodTip" },
        { TackleStageActorCameraCloseUpPointType.BaitGroupPartCloseUpPoint, "BaitGroup" },
    };

    public override ObservationPointInfo ObservationPointGet(string pointName)
    {
        // 1. 优先走基类注册观察点（统一 TryGet 入口）
        if (ObservationPointTryGet(pointName, out var registeredPoint))
            return registeredPoint;

        // 2. 兼容：名称反查旧枚举，委托旧方法
        var closeUpType = CloseUpPointTypeFromName(pointName);
        if (closeUpType.HasValue
            && CameraCloseUpPointTryGet(closeUpType.Value, out var center, out var radius)
            && radius > 0f)
        {
            return new ObservationPointInfo
            {
                Center = center,
                Size = ObservationSizeInfo.FromSize(radius * 2f, radius * 2f, radius * 2f)
            };
        }

        return default;
    }

    public override bool HasObservationPoint(string pointName)
    {
        if (ObservationPointTryGet(pointName, out _))
            return true;

        var closeUpType = CloseUpPointTypeFromName(pointName);
        return closeUpType.HasValue
            && CameraCloseUpPointTryGet(closeUpType.Value, out _, out var radius)
            && radius > 0f;
    }

    private static TackleStageActorCameraCloseUpPointType? CloseUpPointTypeFromName(string name)
    {
        foreach (var kvp in s_closeUpPointNameMap)
        {
            if (kvp.Value == name)
                return kvp.Key;
        }
        return null;
    }
}
```

### 4.4 ShowcaseCamera Prefab 命名约定

VisualCamera 名称建议与观察点名一致，且**不使用 `VC_*` 前缀**，便于 UI/策划直接按名称切换与对齐。

#### 人物展示 Prefab

```
ShowcaseModeComponent (root)
├── FullBody       (DefaultObservationPointName = "FullBody")
├── Head           (DefaultObservationPointName = "Head")
├── Weapon         (DefaultObservationPointName = "Weapon")
└── Back           (DefaultObservationPointName = "Back")
```

#### 钓具展示 Prefab

```
ShowcaseModeComponent (root)
├── FullTackle     (DefaultObservationPointName = "FullTackle")
├── Rod            (DefaultObservationPointName = "Rod")
├── Reel           (DefaultObservationPointName = "Reel")
├── RodTip         (DefaultObservationPointName = "RodTip")
└── BaitGroup      (DefaultObservationPointName = "BaitGroup")
```

约定规则：
- 名称为空或 null → AutoFit 使用 `ObservationCenterGet()` 默认行为
- 名称非空但 Actor 不支持 / 返回 default / 结果无效 → 适配层返回 null，AutoFit fallback 到默认中心
- 名称大小写敏感，统一 PascalCase

### 4.5 配置策略分层

不依赖逐 Prefab 挂脚本，按 Actor 类型分层配置：

| Actor 类型 | 配置方式 | 示例 |
|-----------|---------|------|
| 简单物品 (Item) | 子类按 ActorType 统一默认值注册 LocalOffset | `("Center", Vector3.zero, size)` |
| 同类不同尺寸物品 | 子类 `ViewInit()` 时从 ConfigData 读取尺寸计算 offset | 不同鱼种不同尺寸 |
| 骨骼角色 (Fishman) | 子类 `ViewInit()` 时注册 BonePath | `("Head", "Root/Hips/Spine/Head", size)` |
| 钓具 (Tackle) | override + 旧枚举兼容 + 可选动态委托 | 饵组包围盒聚合 |

---

## 5. 端到端数据流

### 5.1 标准流程（以角色 Head 特写为例）

```
1. ShowcaseModeComponent.SwitchTo("Head")
   ↓
2. activeVC = Head (DefaultObservationPointName = "Head")
   ↓
3. BuildModuleContext()
   → ObservationPointExtension.DefaultPointName = "Head"
   ↓
4. ShowcaseAutoFitModuleComponent.Execute()
   → effectivePointName = "Head"（无 override 时取 Extension 默认值）
   ↓
5. ResolveObservationPoint(target, "Head", trackingMode)
   → ITargetProvider.ObservationPointGet("Head")
   ↓
6. FollowTargetProviderAdapter.ObservationPointGet("Head")
   → m_observationPointProvider.ObservationPointGet("Head")
   ↓
7. FishmanStageActor.ObservationPointGet("Head")
   → 查字典 m_observationPoints["Head"]
   → ObservationPointEntry.Resolve() [BonePath 模式]
   → Transform.Find("Root/Hips/Spine/Head")
   → 返回 ObservationPointInfo { Center = headWorldPos, Size = (0.3, 0.35, 0.3) }
   ↓
8. AutoFit 根据 Size 和 FOV 计算距离
   → state.RawPosition = Center - forward * calculatedDistance
```

### 5.2 兼容流程（钓具 Reel 特写）

```
1. ShowcaseModeComponent.SwitchTo("Reel")
   ↓
2. ObservationPointExtension.DefaultPointName = "Reel"
   ↓
3. TackleStageActor.ObservationPointGet("Reel")
   → ObservationPointTryGet("Reel", out _) = false（字典未注册）
   → CloseUpPointTypeFromName("Reel") = ReelCloseUpPoint
   → CameraCloseUpPointTryGet(ReelCloseUpPoint, out center, out radius)
   → 返回 ObservationPointInfo { Center = reelCenter, Size = FromSize(r*2, r*2, r*2) }
```

### 5.3 Fallback 流程（Actor 无对应观察点）

```
1. ShowcaseModeComponent.SwitchTo("Weapon")
   ↓
2. ItemStageActor.HasObservationPoint("Weapon") = false
   ↓
3. ObservationPointGet("Weapon") 返回 default
   ↓
4. AutoFit fallback → 使用 ObservationCenterGet() + ProjectedSizeGet()（默认行为）
```

---

## 6. TackleAssembleTackleUIController 迁移路径（设计预留）

### 6.1 当前方案（不动）

```
TackleAssembleTackleUIController
  → SlotFocusAtPositionWithRadius(center, radius, slotKey)
    → CameraController (V1 TackleObservationCameraMode)
```

### 6.2 未来迁移方案（Phase 2，不在本次范围）

```
TackleAssembleTackleUIController (迁移后)
  → ShowcaseModeComponent.SwitchTo("Reel")
    → AutoFit 自动从 TackleStageActor 获取 "Reel" 的 ObservationPointInfo
```

### 6.3 迁移阶段

| 阶段 | 内容 | 时机 |
|------|------|------|
| **Phase 1（本次）** | StageActorBase 实现 IObservationPointProvider + TackleStageActor 兼容映射 | 立即 |
| Phase 2（预留） | 创建钓具 ShowcaseCamera Prefab，UIController 改用 SwitchTo(vcName) | 待定 |
| Phase 3（预留） | 确认无其他调用者后可选清理旧枚举 API | 待定 |

### 6.4 兼容性保证

| 方面 | 保证 |
|------|------|
| 旧版 `CameraCloseUpPointTryGet` | 不修改、不删除 |
| 旧版枚举 `TackleStageActorCameraCloseUpPointType` | 保留 |
| `TackleAssembleUITaskCompMainTofu` 的调用 | 不受影响 |
| `TackleAssembleUISettingsSO` | 不变 |

---

## 7. 修改文件清单（Phase 1）

| 文件 | 操作 | 内容 |
|------|------|------|
| `StageActorBase.cs` | 修改 | 文件内含 `StageActor` 和 `StageActorBase` 两个类，都需添加 `IObservationPointProvider` 实现 + `ObservationPointEntry` + 注册 API + `using BlackJack.ProjectEF.Runtime.CameraController` |
| `TackleStageActor.cs` | 修改 | Override `ObservationPointGet` / `HasObservationPoint`，桥接旧枚举 |

**不修改的文件**：
| 文件 | 原因 |
|------|------|
| `IStageActor.cs` | 不继承 IObservationPointProvider，通过 as 检测 |
| 相机侧所有代码 | FollowTargetProviderAdapter 已有自动适配 |
| `TackleAssembleUITaskCompMainTofu.cs` | Phase 2 才迁移 |

---

## 8. 影响范围评估

| 系统 | 影响 | 说明 |
|------|------|------|
| CameraControllerV2 | **无修改** | 已有完整的 IObservationPointProvider 消费链路 |
| FollowTargetProviderAdapter | **无修改** | 已有 `as` 转换检测 |
| ShowcaseAutoFitModuleComponent | **无修改** | 已有 ResolveObservationPoint 逻辑 |
| ShowcaseModeComponent | **无修改** | 已有 ObservationPointExtension 通信 |
| StageActorViewUITask | **无修改** | Actor 生命周期不变 |
| TackleAssembleTackleUITask | **无修改**（Phase 1） | Phase 2 迁移时才修改 |
| 其他 StageActor 子类 | **可选** | 按需注册观察点 |
