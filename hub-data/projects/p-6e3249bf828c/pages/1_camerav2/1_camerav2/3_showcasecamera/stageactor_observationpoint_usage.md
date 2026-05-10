# StageActor ObservationPoint 使用手册

> 基于 Fishman Showcase 案例
> 日期：2026-03-23

---

## 1. 功能概述

StageActor 通过 `IObservationPointProvider` 接口向 ShowcaseCamera 提供**命名观察点**。
ShowcaseCamera 的每个 VisualCamera (VC) 节点可配置一个默认观察点名称，
切换 VC 时 AutoFit 模块自动查询对应观察点的中心和尺寸，完成相机对焦。

**数据流**：

```
StageActor (Provider)                    ShowcaseCamera (Consumer)
┌──────────────────────┐                 ┌────────────────────────────┐
│ ObservationPointRegister("Head", ...)  │  VC "Head" 节点             │
│ ObservationPointRegister("FullBody",..)│    └ DefaultObservationPoint│
│ ObservationPointRegister("HalfBody",..)│        = "Head"             │
└──────────┬───────────┘                 └──────────┬─────────────────┘
           │                                        │
           │   HasObservationPoint("Head") ← ───────┤
           │   ObservationPointGet("Head") ← ───────┤
           │──────→ ObservationPointInfo ──────────→ │
           │        { center, size }                 │ AutoFit 计算距离
           │                                         │ 输出相机位置
```

**职责划分**：Actor 提供"看哪里、多大"，Camera 决定"怎么拍、留多少边距"。

---

## 2. 完整接入步骤

### Step 1：Actor 侧 — 注册观察点

在 `StageActorBase` 子类中 override `ObservationPointsRegister()`，使用三种注册模式之一。

#### 2.1 三种注册模式

| 模式 | 方法签名 | 适用场景 |
|------|----------|----------|
| **LocalOffset** | `ObservationPointRegister(name, Vector3 offset, ObservationSizeInfo size)` | 基于 root 的固定偏移（全身、物品中心等） |
| **BonePath** | `ObservationPointRegister(name, string bonePath, ObservationSizeInfo size)` | 骨骼路径查找，有懒重试缓存 |
| **Dynamic** | `ObservationPointRegister(name, Func<ObservationPointInfo?> provider)` | 需要运行时计算的动态观察点 |

#### 2.2 代码示例（Fishman 案例）

```csharp
public override void ObservationPointsRegister()
{
    // ── FullBody：LocalOffset 模式 ──
    // 角色站立，重心在身高一半处，用固定偏移即可
    ObservationPointRegister("FullBody",
        new Vector3(0f, 0.9f, 0f),                          // root 上方 0.9m
        ObservationSizeInfo.FromSize(0.6f, 1.7f, 0.4f));    // 宽0.6 高1.7 深0.4

    // ── HalfBody：Dynamic 模式 ──
    // 需要实时读取 Spine 和 Head 骨骼位置计算范围
    ObservationPointRegister("HalfBody", () =>
    {
        if (m_fishmanActorController == null)
            return null;

        var spineBone = m_fishmanActorController.m_upperBodyBone;
        if (spineBone == null || !m_fishmanActorController.HasHeadTransform())
            return null;

        var spinePos = spineBone.position;
        var headPos  = m_fishmanActorController.HeadWorldPositionGet();
        var center   = (spinePos + headPos) * 0.5f;
        var height   = Vector3.Distance(spinePos, headPos) * 1.2f;

        return new ObservationPointInfo
        {
            m_center = center,
            m_size   = ObservationSizeInfo.FromSize(height * 0.6f, height, height * 0.4f)
        };
    });

    // ── Head：Dynamic 模式 ──
    // 跟踪头部骨骼世界坐标
    ObservationPointRegister("Head", () =>
    {
        if (m_fishmanActorController == null
            || !m_fishmanActorController.HasHeadTransform())
            return null;

        return new ObservationPointInfo
        {
            m_center = m_fishmanActorController.HeadWorldPositionGet(),
            m_size   = ObservationSizeInfo.FromSize(0.3f, 0.35f, 0.3f)
        };
    });
}
```

#### 2.3 在 ViewInit 中调用

```csharp
public override void ViewInit()
{
    FishmanActorControllerInit();   // 创建控制器 + 换装
    TackleViewInit();               // 钓具初始化
    ObservationPointsRegister();    // 注册观察点（在控制器初始化之后）
}
```

### Step 2：Camera 侧 — 配置 ShowcaseCamera Prefab

在场景的 CameraControllerV2 下创建 ShowcaseModeComponent，添加 VC 子节点：

```
Pfb_ShowcaseMode
  ├── FullBody      ← VisualCameraComponent
  ├── HalfBody      ← VisualCameraComponent
  └── Head           ← VisualCameraComponent
```

#### 2.4 VC 节点 Inspector 配置

每个 VC 节点的 `VisualCameraComponent` 需要配置：

| 字段 | 说明 | 示例值 |
|------|------|--------|
| **Vc Name** | VC 标识名 | `Head` |
| **Default Observation Point** | 对应 Actor 侧注册的观察点名称 | `Head` |
| **Default Tracking Mode** | `Snapshot`(一次采样) / `Continuous`(每帧跟踪) | `Snapshot` |

**命名规则**：VC 节点名 = 观察点名称 = `DefaultObservationPointName`。三者保持一致。

每个 VC 节点还需挂载 Module 组件：

| Module | 配置项 | 说明 |
|--------|--------|------|
| **Direct Pose Module** | — | 提供初始姿态 |
| **Showcase AutoFit** | Auto Fit Mode = `Capsule` 或 `Bounds` | 自动计算相机距离 |
|  | Fit Padding | 边距系数，1.2 表示留 20% 余量 |

### Step 3：连接 Actor 与 Camera

在 `StageActorViewUIController`（或 Tofu）中设置目标：

```csharp
// SetAutoFitTargetV2 内部自动完成：
// 1. new FollowTargetProviderAdapter(stageActor)
//    → 自动检测 IObservationPointProvider 接口
// 2. CameraControllerV2.TargetSet(adapter)
// 3. AutoFitRequestApply(defaultRequest)
SetAutoFitTargetV2(fishmanStageActor);
```

**无需额外代码**——适配器自动发现 `IObservationPointProvider`，VC 预配置的观察点名称自动生效。

---

## 3. 跟踪模式详解

| 模式 | 行为 | 适用场景 |
|------|------|----------|
| **Snapshot** | 首次查询时采样一次观察点，缓存结果，后续不再查询 | 展示类场景（进入特写后相机稳定） |
| **Continuous** | 每帧从 Provider 获取最新位置 | 目标持续运动（如钓鱼动作中的头部跟踪） |

**切换 VC 时**：每个 VC 有独立的 Snapshot 缓存，切换到新 VC 会执行新的首次查询。

---

## 4. 观察点名称优先级

AutoFit 模块解析观察点名称的优先级：

```
1. CameraAutoFitRequest.m_observationPointName   ← 代码动态 Override（最高）
2. VisualCameraComponent.DefaultObservationPointName  ← Prefab 预配置
3. null（无观察点，使用默认 ObservationCenterGet 回退）
```

**代码动态 Override 示例**：
```csharp
var request = CameraAutoFitRequest.DefaultGet();
request.m_observationPointName = "Head";               // 强制使用 Head 观察点
request.m_trackingMode = ObservationPointTrackingMode.Continuous;
m_cameraControllerV2.AutoFitRequestApply(request);
```

清除 Override（回退到 VC 预配置）：
```csharp
var request = CameraAutoFitRequest.DefaultGet();
request.m_observationPointName = "";   // 空字符串 = 显式清除
m_cameraControllerV2.AutoFitRequestApply(request);
```

---

## 5. ObservationSizeInfo 使用说明

`ObservationSizeInfo` 描述观察目标的三维尺寸，AutoFit 根据它和 FOV 计算最优距离。

```csharp
// 从显式尺寸创建（宽、高、深）
var size = ObservationSizeInfo.FromSize(0.6f, 1.7f, 0.4f);

// 从 Bounds 创建
var size = ObservationSizeInfo.FromBounds(renderer.bounds);
```

**AutoFit 距离计算原理**：
```
optimalDist = max(
    projectedHeight / (2 * tan(vFOV/2)),
    projectedWidth  / (2 * tan(hFOV/2))
) * fitPadding
```

尺寸越大 → 距离越远 → 画面中目标越小。`Fit Padding` 控制额外边距。

---

## 6. 常见坑点与排查

### 6.1 观察点位置在脚底 (0,0,0)

**原因 A**：骨骼引用错误
- `FishmanActorControllerDesc.m_headBone` 引用了 `MeshRoot/Head`（网格节点，始终在原点）
- 而非骨架中的 Head 骨骼（如 `TransformRoot/.../Head`）

**排查**：
```csharp
var bone = controller.HeadTransformGet();
Debug.Log($"path: {GetTransformPath(bone)}, worldPos: {bone.position}");
```
如果路径含 `MeshRoot`，说明引用了网格节点。应改为骨架节点。

**原因 B**：换装后未重新评估动画
- `AvatarPartApply()` 后骨骼位置被重置为 0
- 需要在换装后再次调用 `ForceUpdateAnimator()`

**修复**：
```csharp
m_fishmanActorController.AvatarPartApply(avatarPartList);
m_fishmanActorController.ForceUpdateAnimator();  // ← 必须补上
```

### 6.2 Dynamic Provider 返回 null

当 Dynamic Provider 返回 null 时，`HasObservationPoint` 返回 false，AutoFit 回退到默认中心（通常是 root 位置）。

**常见原因**：
- Controller 尚未初始化（`m_fishmanActorController == null`）
- 骨骼引用无效（`HasHeadTransform()` 返回 false）
- 观察点注册在 Controller 初始化之前

**正确顺序**：
```
FishmanActorControllerInit()    ← 先创建控制器
    ↓
AvatarPartApply(...)            ← 换装
    ↓
ForceUpdateAnimator()           ← 骨骼位置刷新
    ↓
ObservationPointsRegister()     ← 最后注册观察点
```

### 6.3 VC 的 Default Observation Point 字段为空

如果 VC 节点的 `Default Observation Point` 未填写，AutoFit 不会查询任何观察点，
直接使用 `ObservationCenterGet()` 回退逻辑（Capsule 中心 → Bounds 中心 → root 位置）。

**检查**：Inspector 中确认每个 VC 的 `Default Observation Point` 字段已填入正确的观察点名称。

### 6.4 世界坐标 vs 本地坐标

- `Transform.position` = **世界坐标**（正确）
- `Transform.localPosition` = 本地坐标（不要用于观察点中心）

`ObservationPointInfo.m_center` 必须是**世界坐标**。

---

## 7. 新增 StageActor 类型的接入清单

| # | 步骤 | 说明 |
|---|------|------|
| 1 | 继承 `StageActorBase` | 自动获得 `IObservationPointProvider` 实现 |
| 2 | Override `ObservationPointsRegister()` | 注册该类型 Actor 的观察点 |
| 3 | 在 `ViewInit()` 中调用 `ObservationPointsRegister()` | 确保在控制器初始化和换装之后 |
| 4 | 确保骨骼引用正确 | 引用骨架骨骼，不要引用 MeshRoot 下的网格节点 |
| 5 | 换装后调用 `ForceUpdateAnimator()` | 确保骨骼位置在观察点查询前正确 |
| 6 | 创建 ShowcaseCamera Prefab VC 节点 | 节点名 = 观察点名 |
| 7 | 配置 VC 的 `Default Observation Point` | 填入观察点名称 |
| 8 | 配置 VC 的 `Default Tracking Mode` | Snapshot 或 Continuous |
| 9 | 调用 `SetAutoFitTargetV2(actor)` | 适配器自动发现 Provider |

---

## 8. API 速查

### StageActorBase 注册方法

```csharp
// LocalOffset：固定偏移 + 固定尺寸
ObservationPointRegister(string name, Vector3 localOffset, ObservationSizeInfo size)

// BonePath：骨骼路径查找 + 固定尺寸（有缓存 + 懒重试）
ObservationPointRegister(string name, string bonePath, ObservationSizeInfo size)

// Dynamic：完全自定义（返回 null 表示暂不可用）
ObservationPointRegister(string name, Func<ObservationPointInfo?> provider)

// 注销
ObservationPointUnregister(string name)

// 清除全部（Destroy 时自动调用）
ObservationPointClearAll()

// 手动使缓存失效
ObservationPointCacheInvalidate()
```

### ObservationSizeInfo 创建

```csharp
ObservationSizeInfo.FromSize(float width, float height, float depth)  // 显式尺寸
ObservationSizeInfo.FromBounds(Bounds bounds)                          // 从包围盒
ObservationSizeInfo.Invalid                                            // 无效标记
```

### CameraAutoFitRequest 观察点 Override

```csharp
var request = CameraAutoFitRequest.DefaultGet();
request.m_observationPointName = "Head";                    // 设置 Override
request.m_trackingMode = ObservationPointTrackingMode.Continuous;
m_cameraControllerV2.AutoFitRequestApply(request);

request.m_observationPointName = "";                        // 清除 Override
m_cameraControllerV2.AutoFitRequestApply(request);
```
