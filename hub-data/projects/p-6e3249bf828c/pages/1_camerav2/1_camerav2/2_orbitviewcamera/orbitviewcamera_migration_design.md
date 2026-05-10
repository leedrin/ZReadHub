# 相机模式迁移方案：OrbitViewCameraMode 重构设计

## 1. 迁移概述

原 `OrbitViewCameraMode` 是一个集成了输入处理、轨道计算、包围盒自适应 (AutoFit)、构图修正 (Composition) 的巨型逻辑类。
迁移的目标是将其拆解为符合 **CameraControllerV2** 架构的 **"Mode + VM + Modules"** 结构。

### 核心映射关系

| 原功能 | 新架构位置 | 说明 |
| :--- | :--- | :--- |
| **OrbitViewCameraMode** (入口/管理) | **OrbitViewModeComponent** | 负责对外接口 (`SetOrbitTarget`) 和 Prefab 管理 |
| **HandleRotation / HandleZoom** (输入) | **OrbitInputModuleComponent** | 负责 Yaw/Pitch/Distance 的输入与平滑 |
| **GetCameraPosition** (位姿计算) | **OrbitFollowModuleComponent** | 负责基于球坐标计算相机位置 (复用现有模块) |
| **AutoFit / BoundsCalc** (自适应) | **OrbitAutoFitModuleComponent** | **(新增)** 负责计算最佳距离和中心点偏移 |
| **Composition** (构图矩阵) | **CompositionModuleComponent** | **(新增)** 负责计算非中心投影矩阵 |

---

## 2. 详细设计方案

### 2.1 架构层级 (Prefab Structure)

在 `CameraModes_V2` Prefab 下新增 `OrbitView` 节点：

```text
OrbitViewMode (OrbitViewModeComponent)
└── MainVC (VisualCameraComponent)
    ├── OrbitInputModule (OrbitInputModuleComponent) [Stage: Aim, Order: 0]
    ├── OrbitAutoFitModule (OrbitAutoFitModuleComponent) [Stage: Body, Order: -10]
    ├── OrbitFollowModule (OrbitFollowModuleComponent) [Stage: Body, Order: 0]
    └── CompositionModule (CompositionModuleComponent) [Stage: Finalize, Order: 100]
```

---

### 2.2 新增/修改组件设计

#### A. OrbitViewModeComponent (模式控制器)

继承自 `CameraModeComponent`，作为业务逻辑的Facade。

**职责**：
1.  提供 `SetOrbitTarget(ICameraFollowTarget target, ...)` 接口，兼容旧代码调用。
2.  将 Target 包装为 `ITargetProvider` 并注入给下层的 VisualCamera。
3.  协调 AutoFit 的触发（例如切换目标时强制重算）。

```csharp
public class OrbitViewModeComponent : CameraModeComponent
{
    // ... 序列化配置 ...
    
    // 对外接口：设置观察目标
    public void SetOrbitTarget(ICameraFollowTarget target, CameraAutoFitMode autoFitMode)
    {
        // 1. 更新基类的 FollowTarget
        SetFollowTarget(target);
        
        // 2. 通知 AutoFit 模块重新计算
        var autoFitModule = GetModule<OrbitAutoFitModuleComponent>();
        if (autoFitModule != null)
        {
            autoFitModule.TriggerAutoFit(autoFitMode);
        }
    }
    
    // 兼容接口：重置
    public void ResetCamera()
    {
        var inputModule = GetModule<OrbitInputModuleComponent>();
        inputModule?.ResetToInitial();
    }
}
```

#### B. OrbitInputModuleComponent (输入模块)

**职责**：处理 Yaw, Pitch 旋转以及 **Distance (Zoom)** 的输入。

**迁移点**：
*   移植 `HandleZoom` 逻辑。
*   移植 `m_yaw`, `m_pitch`, `m_distance` 的状态维护。
*   实现惯性 (Inertia) 和平滑 (Damping)。

**关键逻辑**：
该模块不直接修改 Transform，而是将计算好的 `Yaw/Pitch/Distance` 数据提供给 `OrbitFollowModule` 使用 (或者直接修改 State 的 Rotation，并暴露 Distance 属性供后续模块读取)。

#### C. OrbitAutoFitModuleComponent (核心算法模块)

这是本次迁移最复杂的部分，需移植原 `FrameBoundsCalc`, `CalculateTargetBounds`, `CapsuleFitCamera` 等逻辑。

**职责**：
1.  计算目标的包围盒 (Bounds) 或胶囊体 (Capsule)。
2.  根据 `TargetInFrameRatio` 计算最佳观察距离。
3.  计算目标中心偏移 (Orbit Center Adjustment)。
4.  **输出**：修改 `OrbitFollowModule` 的 `Distance` 和 `TargetOffset` 参数。

**代码逻辑流**：
```csharp
public class OrbitAutoFitModuleComponent : CameraModuleComponent
{
    // 引用兄弟组件
    private OrbitFollowModuleComponent m_followModule;
    private OrbitInputModuleComponent m_inputModule;

    public override void Execute(ref CameraState state, in CameraModuleContext context)
    {
        if (m_triggerAutoFit)
        {
            // 1. 获取目标 Bounds/Capsule (移植 CalculateTargetBounds)
            // 2. 计算最佳距离 (移植 FrameBoundsCalc / FrameCapsuleCalc)
            float optimalDist = CalculateOptimalDistance(...);
            
            // 3. 计算中心偏移 (移植 AdjustOrbitCenterToBoundsCenter)
            Vector3 centerOffset = CalculateCenterOffset(...);

            // 4. 应用结果到兄弟组件
            if(m_inputModule) m_inputModule.SetTargetDistance(optimalDist);
            if(m_followModule) m_followModule.SetCenterOffset(centerOffset);
            
            m_triggerAutoFit = false;
        }
    }
}
```

#### D. CompositionModuleComponent (构图模块)

**职责**：移植 `ApplyCompositionProjectionMatrix` 逻辑。

**Stage**: `Finalize`

**实现**：
```csharp
public class CompositionModuleComponent : CameraModuleComponent
{
    [SerializeField] private CompositionSettings m_settings;

    public override void Execute(ref CameraState state, in CameraModuleContext context)
    {
        if (!m_settings.enableComposition) return;

        // 移植 CreateOffCenterProjectionMatrix 逻辑
        Matrix4x4 projection = CalculateProjection(...);
        
        state.ProjectionMatrix = projection;
        state.UseCustomProjection = true;
    }
}
```

---

## 3. 现有模块复用与增强

**OrbitFollowModuleComponent** 需要进行少量增强以支持 OrbitView 的特性：

1.  **支持中心偏移 (Center Offset)**:
    *   原 `OrbitViewCameraMode` 支持将观察点从 `Target.position` 偏移到 `Target.bounds.center`。
    *   **修改方案**: 在 `OrbitFollowModuleComponent` 中增加 `public Vector3 CenterOffset { get; set; }` 属性，在计算 Pivot 时加上这个偏移。

---

## 4. 迁移步骤

1.  **创建基础脚本**:
    *   创建 `OrbitViewModeComponent.cs`。
    *   创建 `OrbitInputModuleComponent.cs` (集成 Zoom 功能)。
    *   创建 `OrbitAutoFitModuleComponent.cs` (移植核心算法)。
    *   创建 `CompositionModuleComponent.cs`。

2.  **移植核心算法**:
    *   将 `OrbitViewCameraMode` 中的 `CalculateTargetBounds`, `FrameBoundsCalc`, `CapsuleFitCamera` 等私有纯计算方法提取出来，放入 `OrbitAutoFitModuleComponent` 或一个静态工具类 `CameraAlgoUtils` 中（推荐工具类，方便测试）。

3.  **Prefab 组装**:
    *   在 `CameraModes_V2` Prefab 中创建节点结构。
    *   配置默认参数（参考原代码 `DefaultDistance = 1.5f`, `MinPitch = -30f` 等）。

4.  **接口对接**:
    *   修改 `CameraControllerV2.cs` 或 `CameraController.cs` 中的 `GetCameraModeByEnumType(OrbitView)`，使其返回新的 `OrbitViewModeComponent` (如果已完全切换)。
    *   或者保持 `OrbitViewCameraMode` (Legacy) 不变，新建一个 `OrbitViewMode_V2` 类型供新业务使用。

---

## 5. 数据结构迁移对照

| 原变量 | 迁移后位置 |
| :--- | :--- |
| `m_distance` | `OrbitInputModuleComponent.CurrentDistance` |
| `m_yaw`, `m_pitch` | `OrbitInputModuleComponent` |
| `m_orbitCenter` | `CameraModuleContext.Target` + `OrbitFollowModule.CenterOffset` |
| `m_targetBounds` | `OrbitAutoFitModuleComponent` (内部缓存) |
| `CompositionSettings` | `CompositionModuleComponent` (序列化字段) |
| `OrbitViewModeSettings` | 分散到各 `ModuleComponent` 的 Inspector 参数中 |

## 6. 关键功能还原检查表

- [ ] **基础控制**: 鼠标/触屏旋转灵敏度、阻尼感是否一致？
- [ ] **Zoom**: 滚轮缩放范围 `GetDistanceRange` 是否生效？
- [ ] **AutoFit**:
    - [ ] 切换目标时是否自动适配了距离？
    - [ ] 针对胶囊体（Capsule）和普通包围盒（Bounds）的计算是否准确？
    - [ ] `TargetInFrameRatio` 参数调节是否生效？
- [ ] **Orbit Center**: 勾选 `AdjustOrbitCenterToBoundsCenter` 后，相机旋转中心是否位于物体几何中心而非脚底？
- [ ] **Composition**: 开启构图模式后，物体是否按预期偏移（如黄金分割点）？
- [ ] **Gizmos**: 是否移植了 `DrawOrbitCircle`, `DrawCompositionGuide` 等调试绘图？

这个方案能够确保原 `OrbitViewCameraMode` 的所有高级特性在新的组件化架构中得到保留，同时解耦了输入、计算和构图逻辑。
