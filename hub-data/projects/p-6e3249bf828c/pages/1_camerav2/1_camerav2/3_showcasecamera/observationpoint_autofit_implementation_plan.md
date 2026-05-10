# ObservationPoint AutoFit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add named observation point support to AutoFit camera capability, allowing cameras to focus on specific target points (head, weapon, reel) instead of the default geometric center.

**Architecture:** Extend ITargetProvider with observation point queries delegated to Actor-side IObservationPointProvider. ShowcaseAutoFitModuleComponent resolves observation points via priority chain (Request Override > VC preset > default) in Execute. Communication between Mode and Module uses ObservationPointExtension via ExtensionContainer.

**Tech Stack:** Unity C# / CameraControllerV2 framework / ExtensionContainer pattern

**Spec Document:** `Assets\Doc\10_Projects\Camera\1_CameraV2\ObservationPoint_AutoFit_Design.md`

---

### Task 1: Create ObservationPointTrackingMode Enum

**Files:**
- Create: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Core/ObservationPointTrackingMode.cs`

- [ ] **Step 1: Create the enum file**

```csharp
namespace BlackJack.ProjectEF.Runtime.CameraController
{
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
}
```

- [ ] **Step 2: Verify compilation**

Run: Open Unity or check for compile errors.
Expected: No errors — standalone enum with no dependencies.

- [ ] **Step 3: Commit**

```bash
git add Assets/GameProject/Scripts/Runtime/GameView/Camera/Core/ObservationPointTrackingMode.cs
git commit -m "feat(camera): add ObservationPointTrackingMode enum (Snapshot/Continuous)"
```

---

### Task 2: Create ObservationPointInfo Struct

**Files:**
- Create: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Providers/ObservationPointInfo.cs`

- [ ] **Step 1: Create the struct file**

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

- [ ] **Step 2: Verify compilation**

Expected: No errors — depends only on existing `ObservationSizeInfo` in same namespace.

- [ ] **Step 3: Commit**

```bash
git add Assets/GameProject/Scripts/Runtime/GameView/Camera/Providers/ObservationPointInfo.cs
git commit -m "feat(camera): add ObservationPointInfo struct"
```

---

### Task 3: Create IObservationPointProvider Interface

**Files:**
- Create: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Providers/IObservationPointProvider.cs`

- [ ] **Step 1: Create the interface file**

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

- [ ] **Step 2: Verify compilation**

Expected: No errors — depends only on `ObservationPointInfo` from Task 2.

- [ ] **Step 3: Commit**

```bash
git add Assets/GameProject/Scripts/Runtime/GameView/Camera/Providers/IObservationPointProvider.cs
git commit -m "feat(camera): add IObservationPointProvider interface"
```

---

### Task 4: Add ProjectedSizeGet to ObservationSizeInfo

**Files:**
- Modify: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Providers/ObservationSizeInfo.cs:86` (before ToString)

- [ ] **Step 1: Add ProjectedSizeGet method**

Add the following method before `ToString()` in `ObservationSizeInfo`:

```csharp
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

- [ ] **Step 2: Verify compilation**

Expected: No errors. The method uses existing fields (Width, Height, Depth, IsValid) and UnityEngine types already imported.

- [ ] **Step 3: Commit**

```bash
git add Assets/GameProject/Scripts/Runtime/GameView/Camera/Providers/ObservationSizeInfo.cs
git commit -m "feat(camera): add ProjectedSizeGet to ObservationSizeInfo for unified projection"
```

---

### Task 5: Extend ITargetProvider with Observation Point Methods

**Files:**
- Modify: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Providers/ITargetProvider.cs:98` (in "观察参数" region, after `ProjectedSizeGet`)
- Modify: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Providers/Adapters/FollowTargetProviderAdapter.cs`
- Modify: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Providers/Adapters/TransformTargetProvider.cs`

- [ ] **Step 5.1: Add methods to ITargetProvider**

After line 98 (`Vector2 ProjectedSizeGet(Quaternion viewRotation);`), add:

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

- [ ] **Step 5.2: Implement in FollowTargetProviderAdapter**

Add field in the `#region 字段` section (after `m_observationProvider`):

```csharp
// 可选的命名观察点提供者
private readonly IObservationPointProvider m_observationPointProvider;
```

Add to constructor (after `m_observationProvider = target as IObservationInfoProvider;`):

```csharp
m_observationPointProvider = target as IObservationPointProvider;
```

Add methods in the `#region 观察参数实现` section (after `ProjectedSizeGet`):

```csharp
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

- [ ] **Step 5.3: Implement in TransformTargetProvider**

Add methods in the `#region ITargetProvider 实现` section (after `ProjectedSizeGet`):

```csharp
public ObservationPointInfo? ObservationPointGet(string pointName) => null;
public bool HasObservationPoint(string pointName) => false;
```

- [ ] **Step 5.4: Verify compilation**

Expected: No errors. All `ITargetProvider` implementations now have the new methods.

- [ ] **Step 5.5: Check for other ITargetProvider implementations**

Run: `grep -r "ITargetProvider" --include="*.cs" | grep " : ITargetProvider"` to find any other implementations that need updating.

Expected: Only `FollowTargetProviderAdapter` and `TransformTargetProvider`. If others exist, add stub implementations (`=> null` / `=> false`).

- [ ] **Step 5.6: Commit**

```bash
git add Assets/GameProject/Scripts/Runtime/GameView/Camera/Providers/ITargetProvider.cs
git add Assets/GameProject/Scripts/Runtime/GameView/Camera/Providers/Adapters/FollowTargetProviderAdapter.cs
git add Assets/GameProject/Scripts/Runtime/GameView/Camera/Providers/Adapters/TransformTargetProvider.cs
git commit -m "feat(camera): extend ITargetProvider with ObservationPointGet/HasObservationPoint"
```

---

### Task 6: Extend CameraAutoFitRequest with Observation Point Fields

**Files:**
- Modify: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Core/CameraCapabilities.cs:44` (inside `CameraAutoFitRequest` struct, before `DefaultGet`)

- [ ] **Step 1: Add new fields**

After `m_applyScope` field (line 44), add:

```csharp
/// <summary>
/// 命名观察点（null/空 = 使用 VC 预配置或 TargetProvider 默认值）
/// 由调用方指定，如 "Head", "Weapon", "Reel"
/// </summary>
public string m_observationPointName;

/// <summary>
/// 观察点跟踪模式（null = 使用 VC 预配置或默认 Snapshot）
/// </summary>
public ObservationPointTrackingMode? m_trackingMode;
```

- [ ] **Step 2: Verify compilation**

Expected: No errors. `DefaultGet()` returns a new struct with these fields defaulting to null.

- [ ] **Step 3: Commit**

```bash
git add Assets/GameProject/Scripts/Runtime/GameView/Camera/Core/CameraCapabilities.cs
git commit -m "feat(camera): add observation point fields to CameraAutoFitRequest"
```

---

### Task 7: Add VC Preset Fields to VisualCameraComponent

**Files:**
- Modify: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Components/VisualCameraComponent.cs`

- [ ] **Step 1: Add serialized fields**

In `#region 序列化字段`, after the "混合配置" section (after `m_blendCurve` field, line 563), add:

```csharp
[Header("观察点配置")]
[SerializeField]
[Tooltip("默认观察点名称（空 = 使用 TargetProvider 默认观察中心）")]
private string m_defaultObservationPointName;

[SerializeField]
[Tooltip("默认跟踪模式")]
private ObservationPointTrackingMode m_defaultTrackingMode = ObservationPointTrackingMode.Snapshot;
```

- [ ] **Step 2: Add public getters**

In the `#region IVisualCamera 属性实现` section (after `CurrentBlendWeight` property), add:

```csharp
/// <summary>
/// 默认观察点名称（Prefab 预配置）
/// </summary>
public string DefaultObservationPointName
{
    get { return m_defaultObservationPointName; }
}

/// <summary>
/// 默认跟踪模式（Prefab 预配置）
/// </summary>
public ObservationPointTrackingMode DefaultTrackingMode
{
    get { return m_defaultTrackingMode; }
}
```

- [ ] **Step 3: Verify compilation**

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add Assets/GameProject/Scripts/Runtime/GameView/Camera/Components/VisualCameraComponent.cs
git commit -m "feat(camera): add observation point preset fields to VisualCameraComponent"
```

---

### Task 8: Create ObservationPointExtension

**Files:**
- Create: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Extensions/ObservationPointExtension.cs`

- [ ] **Step 1: Create the extension class**

```csharp
namespace BlackJack.ProjectEF.Runtime.CameraController
{
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
}
```

- [ ] **Step 2: Verify compilation**

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add Assets/GameProject/Scripts/Runtime/GameView/Camera/Extensions/ObservationPointExtension.cs
git commit -m "feat(camera): add ObservationPointExtension for Mode-Module communication"
```

---

### Task 9: Refactor ShowcaseAutoFitModuleComponent

**Files:**
- Modify: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Components/Modules/ShowcaseAutoFitModuleComponent.cs`

This is the core task. We need to:
1. Add observation point override state fields
2. Modify `AutoFitRequestApply` to handle new request fields
3. Add `ObservationPointOverrideClear` public method
4. Add `OnResetInternal` override
5. Refactor `Execute` to use observation point resolution
6. Add `ResolveObservationPoint`, `CalculateDistance`, and `GetVCDefaultPointName` helper methods

- [ ] **Step 9.1: Add runtime state fields**

In `#region 序列化字段`, after the existing fields, add a new section:

```csharp
#endregion

#region 运行时字段

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

Note: The existing code has `#region 序列化字段` and `#endregion` wrapping all fields. Add a new `#region 运行时字段` between the end of `#region 序列化字段` and the containing `#endregion` blocks.

- [ ] **Step 9.2: Modify AutoFitRequestApply**

After existing lines in `AutoFitRequestApply`:

```csharp
public void AutoFitRequestApply(in CameraAutoFitRequest request)
{
    if (request.m_autoFitMode.HasValue)
    {
        m_autoFitMode = request.m_autoFitMode.Value;
    }

    if (request.m_targetInFrameRatio.HasValue)
    {
        m_targetInFrameRatio = Mathf.Clamp(request.m_targetInFrameRatio.Value, 0.01f, 1.0f);
    }

    // 观察点 Override
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

- [ ] **Step 9.3: Add ObservationPointOverrideClear method**

Add in `#region 公共成员方法`, after `AutoFitRequestApply`:

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

- [ ] **Step 9.4: Add OnResetInternal override**

Add in `#region 受保护的虚方法`:

```csharp
protected override void OnResetInternal()
{
    m_observationPointNameOverride = null;
    m_trackingMode = ObservationPointTrackingMode.Snapshot;
    m_hasTrackingModeOverride = false;
    m_hasSnapshotCache = false;
}
```

- [ ] **Step 9.5: Refactor Execute method**

Replace the entire `Execute` method body:

```csharp
public override void Execute(ref CameraState state, in CameraModuleContext context)
{
    if (!IsEnabled || m_autoFitMode == CameraAutoFitMode.None)
    {
        return;
    }

    var target = context.TargetGet(0);
    if (target == null || !target.IsActive())
    {
        return;
    }

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
    {
        return;
    }

    // === Step 4: 输出 CameraState ===
    var forward = state.RawRotation * Vector3.forward;
    state.RawPosition = targetCenter - forward * optimalDist;
}
```

- [ ] **Step 9.6: Add private helper methods**

Add in `#region 私有方法`:

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
            return CalculateOptimalDistance(projectedSize, state, context);
        case CameraAutoFitMode.ScreenRatio:
            return CalculateScreenRatioDistance(projectedSize, state, context);
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

- [ ] **Step 9.7: Refactor existing distance calculation methods**

The existing `CalculateOptimalDistance` and `CalculateScreenRatioDistance` take `ITargetProvider` as first parameter and call `target.ProjectedSizeGet()` internally. Since we now pre-compute `projectedSize` in `Execute`, change these methods to accept `Vector2 projectedSize` instead:

**CalculateOptimalDistance** — change signature and remove internal `ProjectedSizeGet` call:

```csharp
private float CalculateOptimalDistance(Vector2 projectedSize,
    in CameraState state, in CameraModuleContext context)
{
    // projectedSize validity already checked by caller

    float fov = GetFOV(state, context);
    if (fov <= 0f)
    {
        return -1f;
    }

    float vFOV = fov * Mathf.Deg2Rad;
    float aspect = context.m_mainCamera != null ? context.m_mainCamera.aspect : 16f / 9f;
    float hFOV = 2f * Mathf.Atan(Mathf.Tan(vFOV * 0.5f) * aspect);

    float distV = (projectedSize.y * 0.5f) / Mathf.Tan(vFOV * 0.5f);
    float distH = (projectedSize.x * 0.5f) / Mathf.Tan(hFOV * 0.5f);
    float optimalDist = Mathf.Max(distV, distH) * m_fitPadding;

    return Mathf.Clamp(optimalDist, m_minDistance, m_maxDistance);
}
```

**CalculateScreenRatioDistance** — change signature similarly:

```csharp
private float CalculateScreenRatioDistance(Vector2 projectedSize,
    in CameraState state, in CameraModuleContext context)
{
    // projectedSize validity already checked by caller

    float fov = GetFOV(state, context);
    if (fov <= 0f)
    {
        return -1f;
    }

    float aspect = context.m_mainCamera != null ? context.m_mainCamera.aspect : 16f / 9f;
    float targetScreenRatio = Mathf.Clamp(m_targetInFrameRatio, 0.01f, 1.0f);

    float vFovRad = fov * Mathf.Deg2Rad;
    float hFovRad = 2f * Mathf.Atan(Mathf.Tan(vFovRad * 0.5f) * aspect);

    float projectedAspect = projectedSize.x / Mathf.Max(projectedSize.y, 0.001f);
    bool isWidthDominant = projectedAspect > aspect;

    float requiredDistance;
    if (isWidthDominant)
    {
        float baseDistance = (projectedSize.x * 0.5f) / Mathf.Tan(hFovRad * 0.5f);
        requiredDistance = baseDistance / targetScreenRatio;
    }
    else
    {
        float baseDistance = (projectedSize.y * 0.5f) / Mathf.Tan(vFovRad * 0.5f);
        requiredDistance = baseDistance / targetScreenRatio;
    }

    return Mathf.Clamp(requiredDistance, m_minDistance, m_maxDistance);
}
```

- [ ] **Step 9.8: Add using directive**

Add at top of file:

```csharp
using BlackJack.ProjectEF.Runtime.CameraController;
```

Verify this using already exists (it does — line 2). If not, add it.

- [ ] **Step 9.9: Verify compilation**

Expected: No errors. All methods use types from previous tasks.

- [ ] **Step 9.10: Commit**

```bash
git add Assets/GameProject/Scripts/Runtime/GameView/Camera/Components/Modules/ShowcaseAutoFitModuleComponent.cs
git commit -m "feat(camera): add observation point resolution to ShowcaseAutoFitModuleComponent"
```

---

### Task 10: Integrate ShowcaseModeComponent with ObservationPointExtension

**Files:**
- Modify: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Components/Modes/ShowcaseModeComponent.cs`

- [ ] **Step 10.1: Add runtime field**

In `#region 运行时字段` (after `m_activeIndex`), add:

```csharp
private ObservationPointExtension m_observationPointExtension;
```

- [ ] **Step 10.2: Override InitializeExtensions**

Add in `#region 受保护的虚方法` section:

```csharp
protected override void InitializeExtensions()
{
    base.InitializeExtensions();
    m_observationPointExtension = new ObservationPointExtension();
    m_extensionContainer.Set(m_observationPointExtension);
}
```

- [ ] **Step 10.3: Override BuildModuleContext**

Add in `#region 受保护的虚方法` section:

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

- [ ] **Step 10.4: Override OnTargetProviderChanged**

Add in `#region 受保护的虚方法` section:

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

- [ ] **Step 10.5: Modify SwitchToInternal to clear overrides**

Replace the existing `SwitchToInternal` method:

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
```

- [ ] **Step 10.6: Add ClearAutoFitObservationPointOverride helper**

Add in `#region 私有方法`:

```csharp
private void ClearAutoFitObservationPointOverride(VisualCameraComponent vc)
{
    var autoFitModule = vc.CameraModuleGet<ShowcaseAutoFitModuleComponent>();
    autoFitModule?.ObservationPointOverrideClear();
}
```

- [ ] **Step 10.7: Add using directive if needed**

Check that `using BlackJack.ProjectEF.Runtime.CameraController;` is present at the top. It is (line 4).

Also need `using BlackJack.ProjectEF.Runtime.Scene;` for `ShowcaseAutoFitModuleComponent` — check if it's in the same namespace. `ShowcaseAutoFitModuleComponent` is in `BlackJack.ProjectEF.Runtime.Scene` (same namespace as `ShowcaseModeComponent`), so no additional using needed.

- [ ] **Step 10.8: Verify compilation**

Expected: No errors.

- [ ] **Step 10.9: Commit**

```bash
git add Assets/GameProject/Scripts/Runtime/GameView/Camera/Components/Modes/ShowcaseModeComponent.cs
git commit -m "feat(camera): integrate ShowcaseModeComponent with ObservationPointExtension"
```

---

### Task 11: Final Verification & Integration Commit

- [ ] **Step 1: Full compilation check**

Open Unity and verify the entire project compiles without errors.

- [ ] **Step 2: Verify file count**

New files (4):
- `ObservationPointTrackingMode.cs`
- `ObservationPointInfo.cs`
- `IObservationPointProvider.cs`
- `ObservationPointExtension.cs`

Modified files (8):
- `ObservationSizeInfo.cs` — `ProjectedSizeGet(Quaternion)`
- `ITargetProvider.cs` — 2 new methods
- `FollowTargetProviderAdapter.cs` — implementation + field
- `TransformTargetProvider.cs` — stub implementation
- `CameraCapabilities.cs` — 2 new fields in request
- `VisualCameraComponent.cs` — 2 serialized fields + getters
- `ShowcaseAutoFitModuleComponent.cs` — Execute refactor + override management
- `ShowcaseModeComponent.cs` — Extension init + BuildModuleContext + VC switch cleanup

- [ ] **Step 3: Verify no existing behavior is broken**

The only behavioral change is in `ShowcaseAutoFitModuleComponent.Execute`:
- Without observation points (default), the code path is functionally identical
- `CalculateOptimalDistance` and `CalculateScreenRatioDistance` now take `Vector2` instead of `ITargetProvider`, but the projection is pre-computed identically in `Execute`
- No existing API signatures are broken (only additions)

- [ ] **Step 4: Manual testing checklist**

1. Enter a scene with ShowcaseMode active — camera behaves as before
2. Switch between VCs — camera adjusts correctly, no stale state
3. (When Actor implements `IObservationPointProvider`) Set request with `m_observationPointName = "Head"` — camera focuses on head
4. Switch VC — override is cleared, new VC's preset takes effect
5. Switch Target — all overrides cleared across all VCs
