# 观察点（Observation Point）AutoFit 详细功能设计

> 日期：2026-03-19
> 适用范围：CameraControllerV2 / ShowcaseModeComponent / ShowcaseAutoFitModuleComponent / ITargetProvider
> 前置文档：`AutoFit_Capability_vs_OrbitContext_Design.md`
> 目的：为 AutoFit 能力增加"策略型目标"支持，允许相机对焦到目标的命名观察点（如头部、武器挂点、鱼线轮等），而非固定的几何中心

---

## 1. 业务场景

### 1.1 角色展示界面

- 切换角色时自动对焦到上半身/头部（如换发型时聚焦头部，换武器时聚焦手部）
- 利用 ShowcaseCamera 的多机位，每个 VC 预配置不同的观察点

### 1.2 钓具观察

- 观察钓竿/鱼线轮/钩子等不同部件时，需要聚焦到特定挂点
- 不同机位聚焦不同部件，切换 VC 即切换观察部位

---

## 2. 设计决策摘要

| 决策项 | 结论 |
|---|---|
| 配置方式 | 混合：VC 级别预配置 + 请求 Runtime Override |
| 观察点尺寸 | 策略目标自带尺寸（`ObservationSizeInfo`）+ `TargetInFrameRatio` 微调 |
| Override 生命周期 | Persistent，切换 VC / Target / 显式清除时清除 |
| 优先级 | Request Override > VC 预配置 > TargetProvider 默认值 |
| 目标来源 | Actor 实现 `IObservationPointProvider` 接口，通过 `ITargetProvider` 委托查询 |
| 解析层级 | 南向层（Module 在 Execute 中通过 Provider 查询） |
| 跟踪模式 | Snapshot（一次性采样）/ Continuous（实时跟踪），默认 Snapshot |
| 优先实现 | ShowcaseAutoFitModuleComponent / ShowcaseModeComponent |

---

## 3. Actor 侧接口 — IObservationPointProvider

### 3.1 ObservationPointInfo

```csharp
using UnityEngine;

namespace BlackJack.ProjectEF.Runtime.CameraController
{
    /// <summary>
    /// 观察点信息
    /// </summary>
    public struct ObservationPointInfo
    {
        /// <summary>
        /// 观察中心（世界坐标）
        /// </summary>
        public Vector3 Center;

        /// <summary>
        /// 观察尺寸（用于 AutoFit 距离计算）
        /// </summary>
        public ObservationSizeInfo Size;
    }
}
```

### 3.2 IObservationPointProvider

```csharp
namespace BlackJack.ProjectEF.Runtime.CameraController
{
    /// <summary>
    /// 观察点提供者
    /// 由业务实体（如 StageActor）实现，提供命名观察点
    /// </summary>
    public interface IObservationPointProvider
    {
        /// <summary>
        /// 获取指定名称的观察点信息
        /// </summary>
        /// <param name="pointName">观察点名称（如 "Head", "Weapon", "Reel"）</param>
        /// <returns>观察点信息</returns>
        ObservationPointInfo ObservationPointGet(string pointName);

        /// <summary>
        /// 查询是否支持指定观察点
        /// </summary>
        bool HasObservationPoint(string pointName);
    }
}
```

### 3.3 设计考量

- `ObservationPointInfo` 是 struct，零分配，与现有 `ObservationSizeInfo` 风格一致
- Actor 内部如何实现（骨骼路径查找/挂点表/硬编码）完全是 Actor 自己的事
- 不定义标准挂点名枚举——不同 Actor 类型的挂点各异，用 string 保持灵活
- 每帧调用 `ObservationPointGet` 返回实时世界坐标，适应动画中骨骼位置变化

### 3.4 ObservationSizeInfo 扩展方法

为消除投影尺寸计算的代码重复（当前在 `FollowTargetProviderAdapter.ProjectedSizeGet` 和 `TransformTargetProvider.ProjectedSizeGet` 中各有一份），在 `ObservationSizeInfo` 上新增投影方法：

```csharp
// ObservationSizeInfo 新增方法
/// <summary>
/// 计算当前视角下的投影尺寸
/// 统一投影算法，避免在 Provider 和 Module 中重复
/// </summary>
public Vector2 ProjectedSizeGet(Quaternion viewRotation)
{
    if (!IsValid)
        return Vector2.one;

    Vector3 euler = viewRotation.eulerAngles;
    float pitchRad = euler.x * Mathf.Deg2Rad;
    float projectedHeight = Mathf.Abs(Mathf.Cos(pitchRad)) * Height
                          + Mathf.Abs(Mathf.Sin(pitchRad)) * Depth;
    return new Vector2(Width, projectedHeight);
}
```

后续 `FollowTargetProviderAdapter.ProjectedSizeGet` 和 `TransformTargetProvider.ProjectedSizeGet` 可重构为调用 `ObservationSizeGet().ProjectedSizeGet(viewRotation)`，消除重复代码。本期仅在 `ShowcaseAutoFitModuleComponent` 中使用此方法。

---

## 4. ITargetProvider 扩展

### 4.1 接口新增方法

在 `ITargetProvider` 的"观察参数"region 内新增：

```csharp
/// <summary>
/// 获取指定命名观察点的信息
/// 返回 null 表示不支持该观察点，应回退到默认行为
/// </summary>
ObservationPointInfo? ObservationPointGet(string pointName);

/// <summary>
/// 查询是否支持指定观察点
/// </summary>
bool HasObservationPoint(string pointName);
```

### 4.2 FollowTargetProviderAdapter 实现

```csharp
// 新增字段
private readonly IObservationPointProvider m_observationPointProvider;

// 构造函数中增加检测（与现有 IObservationInfoProvider 检测方式一致）
m_observationPointProvider = target as IObservationPointProvider;

public ObservationPointInfo? ObservationPointGet(string pointName)
{
    if (string.IsNullOrEmpty(pointName) || m_observationPointProvider == null)
        return null;
    if (!m_observationPointProvider.HasObservationPoint(pointName))
        return null;
    return m_observationPointProvider.ObservationPointGet(pointName);
}

public bool HasObservationPoint(string pointName)
{
    if (string.IsNullOrEmpty(pointName) || m_observationPointProvider == null)
        return false;
    return m_observationPointProvider.HasObservationPoint(pointName);
}
```

### 4.3 TransformTargetProvider 实现

不支持命名观察点，直接返回 null / false：

```csharp
public ObservationPointInfo? ObservationPointGet(string pointName) => null;
public bool HasObservationPoint(string pointName) => false;
```

### 4.4 设计考量

- 返回 `ObservationPointInfo?`（nullable struct）：null 表示不支持，调用方回退到默认的 `ObservationCenterGet()` + `ProjectedSizeGet()`
- 与 `IObservationInfoProvider` 返回 `Vector3?` / `ObservationSizeInfo?` 的模式一致
- 不强制所有 `ITargetProvider` 实现者都支持，不支持的直接返回 null 即可

---

## 5. CameraAutoFitRequest 扩展

### 5.1 新增字段

```csharp
public struct CameraAutoFitRequest
{
    // --- 现有字段保持不变 ---
    public CameraAutoFitMode? m_autoFitMode;
    public bool? m_adjustCenterToGeometry;
    public float? m_targetInFrameRatio;
    public CameraCapabilityApplyScope m_applyScope;

    // --- 新增 ---
    /// <summary>
    /// 命名观察点（null/空 = 使用 VC 预配置或 TargetProvider 默认值）
    /// 由调用方指定，如 "Head", "Weapon", "Reel"
    /// </summary>
    public string m_observationPointName;

    /// <summary>
    /// 观察点跟踪模式（null = 使用 VC 预配置或默认 Snapshot）
    /// </summary>
    public ObservationPointTrackingMode? m_trackingMode;

    // DefaultGet() 不变，新增字段默认为 null
}
```

### 5.2 ObservationPointTrackingMode

```csharp
/// <summary>
/// 观察点跟踪模式
/// </summary>
public enum ObservationPointTrackingMode
{
    /// <summary>
    /// 一次性：AutoFit 触发时采样一次观察点位置，之后固定不变
    /// 适合展示类场景（进入特写后相机稳定）
    /// </summary>
    Snapshot = 0,

    /// <summary>
    /// 实时跟踪：每帧从观察点获取最新位置
    /// 适合目标持续运动的场景
    /// </summary>
    Continuous = 1,
}
```

### 5.3 设计考量

- 只加 `string` + `enum?`，不加已解析的 `Vector3`/`ObservationSizeInfo`——解析由模块在 Execute 中通过 Provider 完成
- 请求只携带"意图"（看哪个点），不携带"数据"（具体坐标）
- null/空字符串 = 不 Override，回退到 VC 预配置或默认行为

---

## 6. VC 级别预配置

### 6.1 VisualCameraComponent 新增字段

```csharp
[Header("观察点配置")]
[SerializeField]
[Tooltip("默认观察点名称（空 = 使用 TargetProvider 默认观察中心）")]
private string m_defaultObservationPointName;

[SerializeField]
[Tooltip("默认跟踪模式")]
private ObservationPointTrackingMode m_defaultTrackingMode = ObservationPointTrackingMode.Snapshot;

public string DefaultObservationPointName => m_defaultObservationPointName;
public ObservationPointTrackingMode DefaultTrackingMode => m_defaultTrackingMode;
```

### 6.2 使用场景示例

- 全身展示 VC：`m_defaultObservationPointName = ""`（空，使用默认几何中心）
- 头部特写 VC：`m_defaultObservationPointName = "Head"`
- 武器特写 VC：`m_defaultObservationPointName = "Weapon"`
- 鱼线轮特写 VC：`m_defaultObservationPointName = "Reel"`

### 6.3 优先级解析

```
string pointName = 模块持久化的 Override（来自请求）
                 ?? 当前 VC 的 DefaultObservationPointName（来自 Extension）
                 ?? null（回退到默认行为）
```

---

## 7. ObservationPointExtension

由 Mode 写入当前 VC 的观察点预配置，Module 在 Execute 中消费。避免模块直接引用 VC 组件。

```csharp
/// <summary>
/// 观察点上下文扩展
/// 由 Mode 写入当前 VC 的默认观察点配置，Module 消费
/// </summary>
public class ObservationPointExtension
{
    /// <summary>
    /// 当前 VC 的默认观察点名称
    /// </summary>
    public string DefaultPointName;

    /// <summary>
    /// 当前 VC 的默认跟踪模式
    /// </summary>
    public ObservationPointTrackingMode DefaultTrackingMode;

    public void Clear()
    {
        DefaultPointName = null;
        DefaultTrackingMode = ObservationPointTrackingMode.Snapshot;
    }
}
```

---

## 8. ShowcaseAutoFitModuleComponent 改造

### 8.1 新增运行时状态

```csharp
// 观察点名称 Override（Persistent，来自请求）
private string m_observationPointNameOverride;

// 跟踪模式（Persistent）
private ObservationPointTrackingMode m_trackingMode = ObservationPointTrackingMode.Snapshot;
private bool m_hasTrackingModeOverride;

// Snapshot 模式缓存
private bool m_hasSnapshotCache;
private Vector3 m_snapshotCenter;
private ObservationSizeInfo m_snapshotSize;
```

### 8.2 AutoFitRequestApply 改造

```csharp
public void AutoFitRequestApply(in CameraAutoFitRequest request)
{
    // --- 现有逻辑 ---
    if (request.m_autoFitMode.HasValue)
        m_autoFitMode = request.m_autoFitMode.Value;
    if (request.m_targetInFrameRatio.HasValue)
        m_targetInFrameRatio = Mathf.Clamp(request.m_targetInFrameRatio.Value, 0.01f, 1.0f);

    // --- 新增 ---
    if (request.m_observationPointName != null)
    {
        m_observationPointNameOverride = request.m_observationPointName;
        m_hasSnapshotCache = false; // 切换观察点，清除快照缓存
    }
    if (request.m_trackingMode.HasValue)
    {
        m_trackingMode = request.m_trackingMode.Value;
        m_hasTrackingModeOverride = true;
    }
}
```

### 8.3 公共方法——清除 Override

```csharp
/// <summary>
/// 清除观察点 Override（切换 VC 时由 Mode 调用）
/// </summary>
public void ObservationPointOverrideClear()
{
    m_observationPointNameOverride = null;
    m_trackingMode = ObservationPointTrackingMode.Snapshot;
    m_hasTrackingModeOverride = false;
    m_hasSnapshotCache = false;
}
```

### 8.4 Execute 改造

```csharp
public override void Execute(ref CameraState state, in CameraModuleContext context)
{
    if (!IsEnabled || m_autoFitMode == CameraAutoFitMode.None)
        return;

    var target = context.TargetGet(0);
    if (target == null || !target.IsActive())
        return;

    // === Step 1: 解析生效的观察点名称 ===
    // 优先级：Request Override > VC 预配置 > null（默认）
    string effectivePointName = m_observationPointNameOverride;
    if (string.IsNullOrEmpty(effectivePointName))
        effectivePointName = GetVCDefaultPointName(context);

    // === Step 1.5: 解析生效的跟踪模式 ===
    // 优先级：Request Override > VC 预配置 > 默认 Snapshot
    var effectiveTrackingMode = m_trackingMode;
    if (!m_hasTrackingModeOverride)
    {
        var ext = context.GetExtension<ObservationPointExtension>();
        if (ext != null)
            effectiveTrackingMode = ext.DefaultTrackingMode;
    }

    // === Step 2: 获取观察中心和尺寸 ===
    Vector3 targetCenter;
    Vector2 projectedSize;

    if (!string.IsNullOrEmpty(effectivePointName))
    {
        var pointInfo = ResolveObservationPoint(target, effectivePointName, effectiveTrackingMode);
        if (pointInfo.HasValue)
        {
            targetCenter = pointInfo.Value.Center;

            // 使用观察点自带尺寸做投影
            // 注意：当有命名观察点时，m_adjustCenterToGeometry 被忽略——
            // 观察点本身已经是精确的观察中心，不需要几何中心调整
            var sizeInfo = pointInfo.Value.Size;
            if (sizeInfo.IsValid)
                projectedSize = sizeInfo.ProjectedSizeGet(state.RawRotation);
            else
                projectedSize = target.ProjectedSizeGet(state.RawRotation);
        }
        else
        {
            // 观察点不存在，回退默认
            targetCenter = target.ObservationCenterGet();
            projectedSize = target.ProjectedSizeGet(state.RawRotation);
        }
    }
    else
    {
        // 无命名观察点，走原有逻辑
        targetCenter = target.ObservationCenterGet();
        projectedSize = target.ProjectedSizeGet(state.RawRotation);
    }

    // === Step 3: 计算距离 ===
    float optimalDist = CalculateDistance(projectedSize, state, context);
    if (optimalDist <= 0f)
        return;

    // === Step 4: 输出 CameraState ===
    var forward = state.RawRotation * Vector3.forward;
    state.RawPosition = targetCenter - forward * optimalDist;
}
```

### 8.5 私有辅助方法

```csharp
/// <summary>
/// 解析观察点（处理 Snapshot/Continuous 模式）
/// </summary>
private ObservationPointInfo? ResolveObservationPoint(
    ITargetProvider target, string pointName, ObservationPointTrackingMode trackingMode)
{
    // Snapshot 模式：有缓存直接返回
    if (trackingMode == ObservationPointTrackingMode.Snapshot && m_hasSnapshotCache)
    {
        return new ObservationPointInfo { Center = m_snapshotCenter, Size = m_snapshotSize };
    }

    // 查询 Provider
    var pointInfo = target.ObservationPointGet(pointName);
    if (!pointInfo.HasValue)
        return null;

    // Snapshot 模式：缓存结果
    if (trackingMode == ObservationPointTrackingMode.Snapshot)
    {
        m_snapshotCenter = pointInfo.Value.Center;
        m_snapshotSize = pointInfo.Value.Size;
        m_hasSnapshotCache = true;
    }

    return pointInfo;
}

/// <summary>
/// 统一的距离计算入口
/// </summary>
private float CalculateDistance(Vector2 projectedSize, in CameraState state, in CameraModuleContext context)
{
    if (projectedSize.x <= 0f || projectedSize.y <= 0f)
        return -1f;

    switch (m_autoFitMode)
    {
        case CameraAutoFitMode.Bounds:
        case CameraAutoFitMode.Capsule:
            return CalculateOptimalDistanceFromProjection(projectedSize, state, context);
        case CameraAutoFitMode.ScreenRatio:
            return CalculateScreenRatioDistanceFromProjection(projectedSize, state, context);
        default:
            return -1f;
    }
}

/// <summary>
/// 从上下文扩展获取当前 VC 的默认观察点名称
/// </summary>
private string GetVCDefaultPointName(in CameraModuleContext context)
{
    var ext = context.GetExtension<ObservationPointExtension>();
    return ext?.DefaultPointName;
}
```

### 8.6 Reset 改造

```csharp
protected override void OnResetInternal()
{
    m_observationPointNameOverride = null;
    m_trackingMode = ObservationPointTrackingMode.Snapshot;
    m_hasTrackingModeOverride = false;
    m_hasSnapshotCache = false;
}
```

---

## 9. ShowcaseModeComponent 改造

### 9.1 扩展初始化

```csharp
private ObservationPointExtension m_observationPointExtension;

protected override void InitializeExtensions()
{
    base.InitializeExtensions();
    m_observationPointExtension = new ObservationPointExtension();
    m_extensionContainer.Set(m_observationPointExtension);
}
```

### 9.2 OnTargetProviderChanged 重写

切换 Target 时清除所有 VC 的 AutoFit 模块观察点 Override。
注意：`CameraModeComponent.SetTargetProvider` 调用 `OnTargetProviderChanged`（虚方法），
但不会触发模块的 `OnResetInternal`，因此需要 Mode 主动清除。

```csharp
protected override void OnTargetProviderChanged(ITargetProvider newProvider)
{
    // 切换目标时，所有 VC 的观察点 Override 失效
    for (int i = 0; i < m_visualCameras.Count; i++)
    {
        ClearAutoFitObservationPointOverride(m_visualCameras[i]);
    }
}
```

### 9.3 BuildModuleContext 重写

```csharp
protected override void BuildModuleContext(float deltaTime)
{
    // 将当前活跃 VC 的默认观察点信息写入 Extension
    var activeVC = ActiveVC;
    if (activeVC != null && m_observationPointExtension != null)
    {
        m_observationPointExtension.DefaultPointName = activeVC.DefaultObservationPointName;
        m_observationPointExtension.DefaultTrackingMode = activeVC.DefaultTrackingMode;
    }

    base.BuildModuleContext(deltaTime);
}
```

### 9.4 SwitchToInternal 改造

```csharp
private void SwitchToInternal(int newIndex)
{
    int oldIndex = m_activeIndex;
    var oldVC = m_visualCameras[oldIndex];
    var newVC = m_visualCameras[newIndex];

    // 旧 VC 混合退出
    oldVC.Deactivate(m_defaultBlendDuration);

    // 新 VC 混合进入
    newVC.Activate(m_defaultBlendDuration);

    m_activeIndex = newIndex;
    m_defaultVCIndex = newIndex;

    // 切换 VC 时清除新旧 VC 的 AutoFit 模块观察点 Override
    // 旧 VC：防止重新激活时残留过期 Override
    // 新 VC：让新 VC 的 Prefab 预配置干净生效
    ClearAutoFitObservationPointOverride(oldVC);
    ClearAutoFitObservationPointOverride(newVC);

    EventOnVCSwitched?.Invoke(oldIndex, newIndex);
}

private void ClearAutoFitObservationPointOverride(VisualCameraComponent vc)
{
    var autoFitModule = vc.CameraModuleGet<ShowcaseAutoFitModuleComponent>();
    autoFitModule?.ObservationPointOverrideClear();
}
```

---

## 10. 三层职责模型对齐

### 10.1 层级职责

| 层级 | 职责 | 观察点相关行为 |
|---|---|---|
| **北向层**（UI/业务代码） | 构造请求，不感知 Mode/Module | 构造 `CameraAutoFitRequest`，设置 `m_observationPointName`（意图），不解析坐标 |
| **路由层**（Mode + Capability Router） | 分发请求到模块，传递 VC 预配置 | `ShowcaseModeComponent` 将 VC 的 `DefaultObservationPointName` 写入 `ObservationPointExtension`；`CapabilityDispatch` 将请求路由到模块 |
| **南向层**（Module + Pipeline） | Execute 中消费数据，输出 CameraState | 模块解析优先级链，调用 `ITargetProvider.ObservationPointGet()` 查询 Actor，计算距离并写入 `CameraState` |

### 10.2 完整数据流

```
UI 设置 pointName
→ CameraAutoFitRequest
→ CameraControllerV2.AutoFitRequestApply()
→ ShowcaseModeComponent.CapabilityDispatch<ICameraAutoFitCapability>()
→ ShowcaseAutoFitModuleComponent.AutoFitRequestApply() [存储 Override]
→ Execute() 中:
    解析 pointName (Override > Extension.DefaultPointName > null)
    → ITargetProvider.ObservationPointGet(pointName)
    → Actor(IObservationPointProvider) 返回 ObservationPointInfo
    → 计算距离 → 写入 CameraState
```

---

## 11. 冲突策略与优先级

### 11.1 参数优先级（固化）

| 优先级 | 来源 | 生命周期 | 清除时机 |
|---|---|---|---|
| 1（最高） | `CameraAutoFitRequest.m_observationPointName` | Persistent | 显式清除 / 切换 VC / 切换 Target |
| 2 | `VisualCameraComponent.DefaultObservationPointName` | Prefab 配置 | 切换 VC 时自然切换 |
| 3（最低） | `ITargetProvider.ObservationCenterGet()` | 运行时默认 | 无需清除 |

### 11.2 多模块命中策略

`CameraCapabilityApplyScope.ActiveVisualCamera` 下，只有当前活跃 VC 的 AutoFit 模块被命中。不存在多模块写同一 `CameraState` 的冲突。

### 11.3 降级策略

```
ObservationPointGet(pointName) 返回 null
→ 回退到 ObservationCenterGet()（原有默认行为）
→ 距离计算使用 ProjectedSizeGet()（原有默认行为）
```

静默降级，不报错中断，符合原文档 §7.1 "无能力即忽略"原则。

---

## 12. 边界细化——字段生命周期

### 12.1 总表

| 字段 | 生命周期 | 归属 | 清除方式 |
|---|---|---|---|
| `m_observationPointNameOverride` | Persistent | Module | 显式清除 / VC 切换 / Target 切换 / Reset |
| `m_trackingMode` / `m_hasTrackingModeOverride` | Persistent | Module | 同上 |
| `m_hasSnapshotCache` / 缓存数据 | Persistent（随 Override） | Module | 同上 + 新请求到来 |
| `ObservationPointExtension.DefaultPointName` | 每帧由 Mode 从 VC 写入 | Extension | BuildModuleContext 每帧覆写 |
| `ObservationPointExtension.DefaultTrackingMode` | 同上 | Extension | 同上 |
| AutoFit 触发信号 | One-shot | 现有机制不变 | Execute 后清除 |

### 12.2 清除时机汇总

- **切换 VC**：`SwitchToInternal` 中对新旧 VC 调用 `ObservationPointOverrideClear()`
- **切换 Target**：`ShowcaseModeComponent.OnTargetProviderChanged` 遍历所有 VC 调用 `ObservationPointOverrideClear()`
- **显式清除**：业务代码发送 `m_observationPointName = ""` 的请求
- **Reset**：`OnResetInternal()` 清除所有 Override 和缓存

---

## 13. 观测性要求

- **Controller 层日志**：`AutoFitRequestApply` 记录 `pointName`、`trackingMode`、`applyScope`、命中数
- **Module 层日志（仅异常）**：观察点不存在时 `Debug.LogWarning`，记录 `pointName` 和 Target 名称

---

## 14. 与现有设计文档的一致性

| 文档原则 | 本设计是否符合 |
|---|---|
| §9.1 命令数据化，模块在 Execute 自驱动 | 符合。请求只带 pointName 意图，模块在 Execute 中查询并计算 |
| §9.2 模块间通过 CameraState 协作 | 符合。观察点结果写入 `CameraState.RawPosition`，不直接引用兄弟模块 |
| §9.3 避免硬编码模式类型 | 符合。上层通过 `ICameraAutoFitCapability` 路由，不依赖 `ShowcaseModeComponent` 类型 |
| §9.4 核心最小化，业务参数走 Extension | 符合。`ObservationPointExtension` 是 Mode 级业务扩展，不污染核心 `CameraModuleContext` |
| §16.1 统一映射点 | 符合。`Capability Request → Mode 写 Extension → Module Execute 消费` |

---

## 15. 影响范围与改动文件清单

### 15.1 新增文件

| 文件 | 说明 |
|---|---|
| `ObservationPointInfo.cs` | `ObservationPointInfo` struct |
| `IObservationPointProvider.cs` | Actor 侧接口 |
| `ObservationPointTrackingMode.cs` | 跟踪模式枚举 |
| `ObservationPointExtension.cs` | Mode→Module 通信扩展 |

### 15.2 修改文件

| 文件 | 改动内容 |
|---|---|
| `ITargetProvider.cs` | 新增 `ObservationPointGet` / `HasObservationPoint` 方法 |
| `FollowTargetProviderAdapter.cs` | 实现新增方法，委托到 `IObservationPointProvider` |
| `TransformTargetProvider.cs` | 实现新增方法，返回 null/false |
| `CameraCapabilities.cs` | `CameraAutoFitRequest` 新增 `m_observationPointName` / `m_trackingMode` 字段 |
| `ObservationSizeInfo.cs` | 新增 `ProjectedSizeGet(Quaternion)` 方法 |
| `ShowcaseAutoFitModuleComponent.cs` | Execute 改造、新增 Override 管理、Snapshot 缓存 |
| `ShowcaseModeComponent.cs` | `InitializeExtensions` / `BuildModuleContext` 重写、`SwitchToInternal` 清除 Override |
| `VisualCameraComponent.cs` | 新增 `m_defaultObservationPointName` / `m_defaultTrackingMode` 序列化字段 |

### 15.3 不受影响

| 文件 | 原因 |
|---|---|
| `OrbitAutoFitModuleComponent.cs` | 本期不改造，后续可复用相同模式 |
| `OrbitViewModeComponent.cs` | 同上 |
| `CameraControllerV2.cs` | `AutoFitRequestApply` 路由逻辑无需变更 |
| `ICameraControllerV2.cs` | 接口签名不变 |
| `CameraModuleContext.cs` | 核心结构不变，通过 Extension 传递 |

---

## 16. 后续演进

### 16.1 Orbit 模式支持（中期）

`OrbitAutoFitModuleComponent` 可复用相同的 `IObservationPointProvider` 查询机制和 `ObservationPointExtension`。`OrbitViewModeComponent` 需增加类似的 `BuildModuleContext` 逻辑。

### 16.2 开放问题（原文档 §14 状态更新）

| 问题 | 状态 |
|---|---|
| 1. AutoFit 是否支持策略型目标 | **已解决**：本文档完整设计 |
| 2. Scope=AllVisualCameras 下差异化覆盖 | 待定 |
| 3. 能力请求事务语义 | 待定 |
| 4. CapabilitySupportQuery 接口 | 待定 |
