# 相机能力系统设计与使用手册

> 适用对象：客户端程序
> 最后更新：2026-03-24
> 综合整理自：积木式组合系列设计文档 + AutoFit_Capability_vs_OrbitContext_Design.md

---

## 一、核心设计思想

### 1.1 积木式组合架构

相机系统采用 **"通用容器 + 原子积木"** 架构，三层分离：

| 层级 | 角色 | 职责 |
|------|------|------|
| **Mode（模式容器）** | Prefab 底座 | 仅定义业务参数，注入输入/指令到管道，不持有模块引用 |
| **Module（功能模块）** | 原子积木 | 承载单一数学逻辑，在 `Execute` 中自驱动，只对 CameraState 负责 |
| **CameraState** | 数据总线 | 唯一的物理真理，在管线中流动并被模块逐级修正 |

```
旧架构 (继承体系)                    新架构 (组合体系)
┌─────────────────────┐             ┌─────────────────────────────────┐
│   CameraModeBase    │             │   CameraModeComponent           │
│     (God Class)     │             │   (Prefab Container)            │
│  - HandleRotation   │             │                                 │
│  - HandlePosition   │             │   ┌─────────────────────────┐   │
│  - GetCameraPos     │             │   │   CameraModuleContext   │   │
│  - GetCameraRot     │     ──>     │   │   - IInputProvider      │   │
│  - 自动回正...       │             │   │   - ExtensionContainer  │   │
│  - 轨道计算...       │             │   └───────────┬─────────────┘   │
│  - 构图偏移...       │             │   ┌───────────▼─────────────┐   │
└─────────────────────┘             │   │    Module Pipeline      │   │
                                    │   │ Body→Aim→Noise→Finalize │   │
                                    │   └───────────┬─────────────┘   │
                                    │   ┌───────────▼─────────────┐   │
                                    │   │     CameraState         │   │
                                    │   │  (Physical Truth)       │   │
                                    │   └─────────────────────────┘   │
                                    └─────────────────────────────────┘
```

### 1.2 三大核心原则

1. **指令即数据**：业务操作（重置、适配等）转化为 Context 中的布尔标记位，Mode 只"插旗"，Module 在 Execute 中自检
2. **输入流标准化**：消除模块上的 HandleInput/HandleZoom 等公共方法，Mode 将输入存入 `IInputProvider` 缓冲区，Module 按需索取
3. **物理意图总线**：`ReferenceLookAt` + `RawPosition` 作为模块间通信的隐式契约

---

## 二、能力体系分层架构

### 2.1 三层职责模型

```
┌─────────────────────────────────────────────────────────┐
│  北向层 (Controller / API)                                │
│  - 接收外部业务请求 (AutoFit, VCSwitchTo, Reset...)      │
│  - 不感知具体 Mode / Module 类型                          │
│  - 入口：ICameraControllerV2                              │
├─────────────────────────────────────────────────────────┤
│  路由层 (Capability Router)                               │
│  - 在当前 Mode 内分发能力请求到命中模块                    │
│  - 负责作用域 (ActiveVC / AllVC) 与冲突策略                │
│  - Mode 级能力：直接在 Mode 上检查接口                     │
│  - Module 级能力：通过 CapabilityDispatch 遍历模块         │
├─────────────────────────────────────────────────────────┤
│  南向层 (Pipeline Data)                                   │
│  - Module 在 Execute 中读取 Context/Extension             │
│  - 输出修正后的 CameraState                               │
│  - 数据流驱动，无模块间直接调用                             │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Capability 与 ContextExtension 的关系

**核心结论：两者不互相替代，而是上下分层。**

| 维度 | ICameraCapability (能力路由) | ContextExtension (上下文扩展) |
|------|------------------------------|-------------------------------|
| **定位** | 外部统一入口 | 模式内部协同 |
| **调用方** | UI / 业务 / Controller | Mode ↔ Module |
| **感知范围** | 模式无关，模块可插拔 | 模式专属 |
| **数据流向** | 北向 → 路由 → Module | Mode 注入 → Module 消费 |
| **典型用例** | AutoFit、VCSwitchTo | OrbitResetRequested、TackleCloseup |

**数据流路径**：

```
UI/业务
  → ICameraControllerV2.AutoFitRequestApply(request)     [北向层]
    → CurrentMode.CapabilityDispatch<ICameraAutoFitCapability>  [路由层]
      → Module.AutoFitRequestApply(request)                   [路由层]
        → Module 更新内部请求态                                  [南向层]
          → Execute() 消费请求 → 修正 CameraState              [南向层]
```

---

## 三、能力接口设计

### 3.1 接口继承体系

```
ICameraCapability                     ← 能力标记基接口（空接口）
├── ICameraAutoFitCapability          ← Module 级能力：自动适配
│     实现者：ShowcaseAutoFitModuleComponent, OrbitAutoFitModuleComponent
└── IVCSwitchable                     ← Mode 级能力：机位切换
      实现者：ShowcaseModeComponent
```

### 3.2 ICameraCapability（基接口）

```csharp
// 文件：Camera/Core/CameraCapabilities.cs
namespace BlackJack.ProjectEF.Runtime.CameraController
{
    /// <summary>
    /// 相机能力标记接口
    /// 所有可分发能力接口应继承该接口
    /// </summary>
    public interface ICameraCapability { }
}
```

### 3.3 ICameraAutoFitCapability（Module 级能力）

```csharp
/// <summary>
/// AutoFit 能力接口
/// 由具备 AutoFit 能力的 CameraModule 实现
/// </summary>
public interface ICameraAutoFitCapability : ICameraCapability
{
    void AutoFitRequestApply(in CameraAutoFitRequest request);
}
```

**请求参数**：

```csharp
public struct CameraAutoFitRequest
{
    public CameraAutoFitMode? m_autoFitMode;        // 适配算法
    public bool? m_adjustCenterToGeometry;           // 是否调整到几何中心
    public float? m_targetInFrameRatio;              // 目标占屏比例
    public CameraCapabilityApplyScope m_applyScope;  // 作用域
    public string m_observationPointName;            // 命名观察点
    public ObservationPointTrackingMode? m_trackingMode; // 跟踪模式
}
```

**分发机制**：通过 `CameraModeComponent.CapabilityDispatch<T>` 遍历 VC 内的 Module：

```csharp
// CameraControllerV2 中的分发
public int AutoFitRequestApply(CameraAutoFitRequest request)
{
    bool activeVCOnly = request.m_applyScope != CameraCapabilityApplyScope.AllVisualCameras;
    return CurrentMode.CapabilityDispatch<ICameraAutoFitCapability>(
        capability => capability.AutoFitRequestApply(request),
        activeVCOnly);
}
```

### 3.4 IVCSwitchable（Mode 级能力）

```csharp
// 文件：Camera/Components/IVCSwitchable.cs
namespace BlackJack.ProjectEF.Runtime.Scene
{
    /// <summary>
    /// VisualCamera 机位切换能力接口
    /// 继承 ICameraCapability，属于 Mode 级别的相机能力
    /// </summary>
    public interface IVCSwitchable : ICameraCapability
    {
        void SwitchTo(string vcName);
        void SwitchTo(int index);
    }
}
```

**分发机制**：直接在 Mode 上检查接口（非 CapabilityDispatch）：

```csharp
// CameraControllerV2 中的分发
public bool VCSwitchTo(string vcName)
{
    var switchable = CurrentMode as IVCSwitchable;
    if (switchable == null) return false;
    switchable.SwitchTo(vcName);
    return true;
}
```

### 3.5 两种能力的分发差异

| 维度 | Module 级能力 | Mode 级能力 |
|------|---------------|-------------|
| **检查位置** | VC 内的 CameraModuleComponent | CameraModeComponent 本身 |
| **分发方法** | `CapabilityDispatch<T>` 遍历 Module | `CurrentMode as T` 直接检查 |
| **作用域** | 支持 ActiveVC / AllVC | 无作用域概念 |
| **多命中** | 允许多个 Module 同时响应 | 只有当前 Mode 一个实现 |
| **典型例子** | AutoFit（多个 VC 的 Module 都能响应） | VCSwitchTo（只有 Mode 管理 VC 列表） |

---

## 四、上下文扩展设计（ContextExtension）

### 4.1 核心思想

`CameraModuleContext` 只包含所有模块都需要的基础字段。业务相关数据通过 `ExtensionContainer` 按需存取。

```
CameraModuleContext (Core)
  - Camera, Target, DeltaTime, InputProvider (不变的核心)
  - ExtensionContainer (扩展容器)
        │
        ├── OrbitContextExtension     ← Orbit 专用
        │     ResetRequested, AutoFitRequested, AutoFitMode...
        ├── ObservationContextExtension ← Observation 专用
        │     AutoReturnRequested, IdleTime...
        └── TackleContextExtension    ← Tackle 专用
              CloseupRequested, TrackIdx...
```

### 4.2 ExtensionContainer

基于泛型静态 TypeId + 数组的 O(1) 存取，零 GC：

```csharp
// 类型注册：每种扩展类型自动分配唯一 int ID
public static class ExtensionTypeRegistry
{
    private static class TypeIdHolder<T> where T : class
    {
        public static readonly int Id = s_nextTypeId++;
    }
}

// 容器：用 TypeId 作为数组下标，O(1) 访问
public class ExtensionContainer
{
    private object[] m_extensions = new object[16];

    public void Set<T>(T extension) where T : class { ... }
    public T Get<T>() where T : class { ... }
    public bool TryGet<T>(out T extension) where T : class { ... }
    public bool Has<T>() where T : class { ... }
}
```

### 4.3 输入缓冲（IInputProvider / CameraInputBuffer）

```csharp
public interface IInputProvider
{
    Vector2 LookDeltaGet();   // 视角旋转增量
    float ZoomDeltaGet();     // 缩放增量
    Vector3 MoveDeltaGet();   // 位移增量
    bool HasInput { get; }    // 是否有有效输入
}

public class CameraInputBuffer : IInputProvider
{
    // Mode 调用：累积一帧内的输入
    public void AccumulateLook(Vector2 delta) { m_lookDelta += delta; }
    public void AccumulateZoom(float delta) { m_zoomDelta += delta; }

    // Module 调用：读取并消费
    public Vector2 LookDeltaGet() => m_lookDelta;
    public float ZoomDeltaGet() => m_zoomDelta;

    // 帧结束清理
    public void Clear() { m_lookDelta = Vector2.zero; m_zoomDelta = 0f; ... }
}
```

### 4.4 CameraState 扩展

Module 间可通过 State Extension 传递中间计算结果：

```csharp
// 上游模块写入
var stateExt = new OrbitStateExtension { OptimalDistance = dist };
state.SetExtension(stateExt);

// 下游模块读取
if (state.TryGetExtension<OrbitStateExtension>(out var ext) && ext.HasAutoFitResult)
{
    float baseDistance = ext.OptimalDistance;
}
```

---

## 五、Module Pipeline（模块管线）

### 5.1 四阶段执行顺序

```csharp
public enum CameraModuleStage
{
    Body     = 0,     // 位置与轨道
    Aim      = 100,   // 旋转与对齐
    Noise    = 200,   // 噪声/抖动
    Finalize = 300    // 最终修正（构图、碰撞）
}
```

同阶段内按 `m_order` 排序（数值越小越先执行）。

### 5.2 原子积木库

#### Body 阶段

| 积木 | 核心逻辑 |
|------|----------|
| PositionFollowModule | 简单位置跟随，支持平滑 |
| OrbitTrackModule | 基于 ReferenceLookAt 的球面坐标计算 |
| DirectPoseModule | 直接写入固定 Position/Rotation |
| ShowcaseAutoFitModule | 基于观察点的自动适配距离计算 |

#### Aim 阶段

| 积木 | 核心逻辑 |
|------|----------|
| LookAtTargetModule | 使相机朝向 ReferenceLookAt |
| InputRotationModule | 将玩家输入转化为 RawRotation |

#### Finalize 阶段

| 积木 | 核心逻辑 |
|------|----------|
| CompositionModule | 修改 ProjectionMatrix 实现非中心构图 |
| CollisionModule | 射线检测防穿墙 |

### 5.3 积木组合示例

| 目标效果 | 积木组合 |
|----------|----------|
| **Showcase 展示** | DirectPose (Body) + ShowcaseAutoFit (Body) + Composition (Finalize) |
| **标准环绕** | OrbitAutoFit + OrbitInput + OrbitFollow + Collision |
| **固定观察** | OrbitAutoFit + OrbitFollow（移除 Input 即停止响应输入） |
| **FPS 视角** | PositionFollow + InputRotation + PitchCurveModifier |

---

## 六、边界限定、冲突策略与命中策略

### 6.1 参数生命周期分类

| 类别 | 说明 | 示例 | 清理时机 |
|------|------|------|----------|
| **一次性请求 (One-shot)** | 仅影响当前/下一帧 | ResetRequested, AutoFitRequested | 帧末 ClearFrameState |
| **持久参数 (Persistent)** | 持续生效直到被覆盖 | AutoFitMode, TargetInFrameRatio | 下次请求覆盖或显式重置 |

### 6.2 参数优先级（高 → 低）

1. **同帧 Capability Request**（外部能力请求）
2. **Mode 内部 Extension 状态**（OrbitContextExtension 等）
3. **Module 序列化默认值**（Prefab Inspector 配置）

### 6.3 多模块命中策略

- 默认允许多模块命中（组合能力叠加）
- 对"单写语义能力"（如 AutoFit 写位姿），通过以下方式约束：
  - 限定 `ApplyScope = ActiveVisualCamera` 只命中活跃 VC 的模块
  - 按 Module Stage/Order 确定最终写入者（后执行者覆盖先执行者）

### 6.4 AutoFit 字段单一事实来源

| 语义字段 | 外部权威入口 | Mode 内部落点 | 生命周期 |
|----------|-------------|---------------|----------|
| AutoFit 触发 | `CameraAutoFitRequest` | `OrbitContextExtension.AutoFitRequested` | One-shot |
| AutoFitMode | `CameraAutoFitRequest.m_autoFitMode` | `OrbitContextExtension.AutoFitMode` | Persistent |
| AdjustCenter | `CameraAutoFitRequest.m_adjustCenterToGeometry` | Extension 镜像 | Persistent |
| ResetRequested | 独立 Reset 能力入口 | `CommonCommandExtension.ResetRequested` | One-shot |

**统一映射约束**：

1. 上层只调用 Capability，不直接写任意 Extension
2. Mode 负责把 Capability 参数翻译成本模式可识别的 Extension
3. Module 只读 Context/State Extension，不反向依赖上层调用方

### 6.5 观测性要求

| 层级 | 日志内容 |
|------|----------|
| Controller 层 | 请求参数、作用域、命中数 |
| Mode 层 (debug) | 命中模块名列表 |
| Module 层 (异常) | 参数非法、目标不可用、请求被忽略原因 |

---

## 七、ICameraControllerV2 能力接口一览

```csharp
public interface ICameraControllerV2
{
    // === 能力分发 ===

    /// AutoFit 能力请求（Module 级，通过 CapabilityDispatch 路由）
    int AutoFitRequestApply(CameraAutoFitRequest request);

    /// VC 机位切换（Mode 级，通过 IVCSwitchable 接口路由）
    bool VCSwitchTo(string vcName);
    bool VCSwitchTo(int index);

    // === 模式控制 ===
    bool ModeSwitch<T>() where T : CameraModeComponent;
    bool ModeSwitch(string modeName);
    CameraModeComponent CurrentModeGet();
    T ModeGet<T>() where T : CameraModeComponent;

    // === 目标管理 ===
    void TargetSet(ITargetProvider target);
    void TargetClear();
    void TargetOffsetSet(Vector3 offset);

    // === 基础操作 ===
    void Reset();
    void Zoom(float delta);
    void Rotate(Vector2 delta);
}
```

---

## 八、使用方法

### 8.1 调用 AutoFit（Module 级能力）

```csharp
// 上层调用 — 模式无关
var request = CameraAutoFitRequest.DefaultGet();
request.m_autoFitMode = CameraAutoFitMode.Capsule;
request.m_adjustCenterToGeometry = true;
request.m_applyScope = CameraCapabilityApplyScope.ActiveVisualCamera;
int hitCount = cameraControllerV2.AutoFitRequestApply(request);
```

### 8.2 调用 VCSwitchTo（Mode 级能力）

```csharp
// 直接通过 CameraControllerV2
cameraControllerV2.VCSwitchTo("VC_HeadCloseup");
cameraControllerV2.VCSwitchTo(0);

// 或通过 StageActorViewUIController 封装
stageActorViewUICtrl.CameraSwitchTo("VC_HeadCloseup");
```

### 8.3 实现新的 Module 级能力

```csharp
// 1. 定义能力接口
public interface ICameraShakeCapability : ICameraCapability
{
    void ShakeRequestApply(in CameraShakeRequest request);
}

// 2. Module 实现能力
public class ShakeModuleComponent : CameraModuleComponent, ICameraShakeCapability
{
    private CameraShakeRequest? m_pendingRequest;

    public void ShakeRequestApply(in CameraShakeRequest request)
    {
        m_pendingRequest = request; // 仅记录，Execute 中消费
    }

    public override void Execute(ref CameraState state, in CameraModuleContext context)
    {
        if (m_pendingRequest == null) return;
        // 执行震屏逻辑...
        m_pendingRequest = null;
    }
}

// 3. CameraControllerV2 添加分发入口
public int ShakeRequestApply(CameraShakeRequest request)
{
    return CurrentMode.CapabilityDispatch<ICameraShakeCapability>(
        cap => cap.ShakeRequestApply(request), activeVCOnly: true);
}
```

### 8.4 实现新的 Mode 级能力

```csharp
// 1. 定义能力接口
public interface ICameraReframeable : ICameraCapability
{
    void ReframeTo(Vector3 worldPosition, float duration);
}

// 2. Mode 实现能力
public class CinematicModeComponent : CameraModeComponent, ICameraReframeable
{
    public void ReframeTo(Vector3 worldPosition, float duration) { ... }
}

// 3. CameraControllerV2 添加分发入口
public bool ReframeTo(Vector3 worldPosition, float duration)
{
    var reframeable = CurrentMode as ICameraReframeable;
    if (reframeable == null) return false;
    reframeable.ReframeTo(worldPosition, duration);
    return true;
}
```

---

## 九、扩展新 Mode 时的 ContextExtension 使用

### 9.1 Mode 中注入扩展

```csharp
public class OrbitViewModeComponent : CameraModeComponent
{
    // 扩展实例（Init 时创建，复用避免 GC）
    private readonly OrbitContextExtension m_orbitExtension = new();
    private readonly ExtensionContainer m_extensionContainer = new();

    protected override void OnInitializeInternal()
    {
        m_extensionContainer.Set(m_orbitExtension);
    }

    // Capability 请求翻译为内部 Extension
    // （由 ICameraAutoFitCapability 实现模块内部消费）

    protected override CameraModuleContext BuildModuleContext(float deltaTime)
    {
        return new CameraModuleContext(m_mainCamera, m_targetProvider, deltaTime,
            m_inputBuffer, m_extensionContainer);
    }

    protected override void ClearFrameState()
    {
        base.ClearFrameState();
        m_orbitExtension.Clear(); // 清理一次性指令
    }
}
```

### 9.2 Module 中消费扩展

```csharp
public class OrbitAutoFitModuleComponent : CameraModuleComponent
{
    public override void Execute(ref CameraState state, in CameraModuleContext context)
    {
        // 尝试获取 Orbit 扩展，不存在则跳过（可能不在 Orbit 模式）
        if (!context.TryGetExtension<OrbitContextExtension>(out var orbitCtx))
            return;

        if (!orbitCtx.AutoFitRequested)
            return;

        // 执行适配计算，结果写入 State Extension 供下游模块读取
        var stateExt = new OrbitStateExtension { OptimalDistance = dist, HasAutoFitResult = true };
        state.SetExtension(stateExt);
    }
}
```

---

## 十、演进路线

### M1（已落地）

- 引入 `ICameraAutoFitCapability` + `CameraAutoFitRequest`
- 引入 `IVCSwitchable` + `CameraControllerV2.VCSwitchTo`
- `StageActorViewUIController` 不再依赖 `ModeGet<具体Mode类型>()`
- Orbit / Showcase 模块均支持能力请求

### M2（短期建议）

- 固化参数优先级常量与冲突日志模板
- 为 AutoFit 增加统一"请求态容器"（复用 ExtensionContainer 强类型扩展）
- 补充回归验证：模式切换后 TargetSet、不同 Scope 行为

### M3（中期建议）

- 清理 OrbitContext 中重复的外部入口字段
- OrbitContext 聚焦于 Orbit 专有内部状态（Reset/InitialState/调试态）

### M4（长期展望）

- 能力发现机制接入配置驱动
- 编辑器可视化展示当前模式支持的能力清单
- 运行时能力支持矩阵查询，服务于业务降级策略

---

## 十一、设计验收标准

1. **无引用运行**：Mode 的 C# 代码中搜索具体 Module 类名，结果应为 0
2. **动态拔插**：运行时 Disable 任何 Module 节点，相机保持位置不抛异常
3. **模式无关**：上层调用代码不出现 `ModeGet<具体ModeType>()` 硬编码
4. **能力降级**：请求命中数为 0 时只输出 Warning，不中断执行

---

## 十二、相关文档索引

| 文档 | 内容 |
|------|------|
| [Deep_Pipeline_Decoupling_Design.md](Deep_Pipeline_Decoupling_Design.md) | 管道化去耦合方案：指令即数据、输入流标准化 |
| [积木式重构迁移规划.md](积木式重构迁移规划.md) | 原子积木库设计、旧模式迁移路径 |
| [Extensible_Context_Design.md](Extensible_Context_Design.md) | 可扩展上下文与状态、ExtensionContainer 实现 |
| [Modular_Building_Blocks_Implementation_Details.md](Modular_Building_Blocks_Implementation_Details.md) | Mode 去逻辑化、Module 自驱动化具体方案 |
| [Modular_Camera_Refactor_Implementation_Plan.md](Modular_Camera_Refactor_Implementation_Plan.md) | 详细实施方案：代码模板、扩展定义、迁移计划 |
| [AutoFit_Capability_vs_OrbitContext_Design.md](../3_ShowcaseCamera/AutoFit_Capability_vs_OrbitContext_Design.md) | Capability 与 ContextExtension 分层设计、冲突策略 |
| [ShowcaseCamera_Usage.md](../3_ShowcaseCamera/ShowcaseCamera_Usage.md) | ShowcaseCamera 使用说明（含 VCSwitchTo 接口） |
