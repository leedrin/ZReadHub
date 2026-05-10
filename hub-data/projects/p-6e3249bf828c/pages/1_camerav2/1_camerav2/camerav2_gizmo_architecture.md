# Camera V2 Scene View Gizmo 可视化架构

## 概述

Camera V2 的 Scene View Gizmo 采用**模块自绘制架构**，每个 `CameraModuleComponent` 子类负责绘制自己在 Scene View 中的可视化信息。这与运行时的模块管线设计保持一致——模块自治、职责单一、可独立扩展。

---

## 架构分层

```
┌─────────────────────────────────────────────────────┐
│              触发层（何时绘制）                        │
│                                                     │
│  运行期: CameraControllerV2.OnDrawGizmos()          │
│  编辑期: ShowcaseVCGizmoDrawer [DrawGizmo] attribute │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              分发层（VisualCameraComponent）          │
│                                                     │
│  DrawSceneGizmos(bool isSelected)                   │
│    1. 从 DirectPoseModule 读取 position/rotation/fov│
│    2. 构建 GizmoContext                             │
│    3. 遍历所有 CameraModuleComponent → DrawSceneGizmo│
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              绘制层（各 Module 子类）                  │
│                                                     │
│  DirectPoseModuleComponent.DrawSceneGizmo            │
│    → 胶囊体 + 名称标签 + FOV 锥体                    │
│                                                     │
│  ShowcaseAutoFitModuleComponent.DrawSceneGizmo       │
│    → 距离范围虚线 + min/max 刻度 + 双 FOV 锥体       │
│                                                     │
│  （未来新模块只需 override DrawSceneGizmo）            │
└─────────────────────────────────────────────────────┘
```

---

## 核心接口

### GizmoContext（绘制上下文）

定义在 `CameraModuleComponent` 内部，编辑期由 `VisualCameraComponent` 构建后传递给各模块：

```csharp
public struct GizmoContext
{
    public Vector3    m_position;    // 相机世界坐标（来自 DirectPoseModule）
    public Quaternion m_rotation;    // 相机旋转（来自 DirectPoseModule）
    public float      m_fov;        // FOV（DirectPoseModule > MainCamera > 60°）
    public string     m_vcName;     // VisualCamera 名称
    public bool       m_isSelected; // 当前 VC 是否被选中
}
```

### DrawSceneGizmo 虚方法

```csharp
// CameraModuleComponent（基类，空实现）
public virtual void DrawSceneGizmo(in GizmoContext ctx) { }
```

子类按需覆写，无绘制需求的模块无需处理。

---

## 各模块绘制职责

### DirectPoseModuleComponent

**基础绘制**——所有使用 DirectPose 的 VC 都会有此模块：

| 元素 | 说明 |
|---|---|
| 竖直胶囊体 | 标识相机位置，选中时青色，未选中时灰色半透明 |
| FOV 视锥体 | 固定长度 0.8m 的四棱锥线框，表示视野范围 |
| 名称标签 | 显示 VC 名称，选中时加粗放大 |

**协作规则**：当同级存在启用的 `ShowcaseAutoFitModuleComponent` 时，跳过默认 FOV 锥体和标签绘制，由 AutoFit 模块接管。

### ShowcaseAutoFitModuleComponent

**AutoFit 距离范围可视化**——仅在 AutoFit 启用且模式非 None 时绘制：

| 元素 | 颜色 | 说明 |
|---|---|---|
| 距离范围虚线 | 黄色半透明 | 从相机位置沿朝向延伸到 maxDistance |
| min 距离刻度 | 绿色 | 十字标记，标识最近距离位置 |
| max 距离刻度 | 橙色 | 十字标记，标识最远距离位置 |
| min FOV 锥体 | 绿色半透明 | 较小锥体，表示最近距离时的视野 |
| max FOV 锥体 | 青色/灰色 | 较大锥体，表示最远距离时的视野 |
| AutoFit 标签 | 青色/灰色 | `VC名称 + [AutoFit: 模式  min~max m]` |

---

## 触发机制

### 编辑期（非运行时）

通过 `ShowcaseVCGizmoDrawer`（Editor 静态类）使用 `[DrawGizmo]` attribute 触发：

| 触发条件 | 行为 |
|---|---|
| 选中 `ShowcaseModeComponent` 或其父节点 | 遍历所有子 VC，绘制全部 Gizmo |
| 选中某个 `VisualCameraComponent` | 仅绘制该 VC 的 Gizmo（高亮） |

`ShowcaseVCGizmoDrawer` 仅负责判断选中状态和遍历 VC，实际绘制委托给 `VC.DrawSceneGizmos(isSelected)`。

### 运行期

通过 `CameraControllerV2.OnDrawGizmos()` → `CameraModeComponent.DrawGizmos()` → `VisualCameraComponent.DrawGizmos()` 调用。运行期使用实际的 `CameraState` 绘制相机射线。

---

## 绘制工具方法

`DirectPoseModuleComponent` 提供 `public static` 绘制工具方法，供其他模块复用：

| 方法 | 用途 |
|---|---|
| `DrawVerticalCapsule(center, color)` | 绘制竖直胶囊体线框 |
| `DrawFOVCone(origin, rotation, fov, length, color)` | 绘制 FOV 视锥体线框 |
| `DrawVCLabel(pos, text, color, isSelected)` | 绘制富文本标签 |
| `DrawDashedLine(from, to, color, dashLength)` | 绘制虚线 |

---

## 扩展指南

### 为新模块添加 Gizmo

1. 在新的 `CameraModuleComponent` 子类中，`#if UNITY_EDITOR` 内覆写 `DrawSceneGizmo`：

```csharp
#if UNITY_EDITOR
public override void DrawSceneGizmo(in GizmoContext ctx)
{
    if (!IsEnabled) return;

    // 使用 ctx.m_position, ctx.m_rotation, ctx.m_fov 等绘制
    // 可复用 DirectPoseModuleComponent 的静态工具方法
    DirectPoseModuleComponent.DrawFOVCone(
        ctx.m_position, ctx.m_rotation, ctx.m_fov, 1.0f, Color.yellow);
}
#endif
```

2. 无需修改 `ShowcaseVCGizmoDrawer` 或 `VisualCameraComponent`——新模块的 Gizmo 会自动被收集和绘制。

### 模块间协作（避免重复绘制）

当多个模块会绘制同类元素（如 FOV 锥体）时，使用 `GetComponent<T>()` 检测同级模块，决定是否跳过：

```csharp
// DirectPoseModuleComponent 中的协作示例
var autoFit = GetComponent<ShowcaseAutoFitModuleComponent>();
bool autoFitHandlesCone = autoFit != null
                          && autoFit.IsEnabled
                          && autoFit.EditorAutoFitMode != CameraAutoFitMode.None;
if (!autoFitHandlesCone)
{
    // 绘制默认 FOV 锥体
}
```

---

## 涉及文件清单

| 文件 | 角色 |
|---|---|
| `CameraModuleComponent.cs` | 定义 `GizmoContext` 和 `virtual DrawSceneGizmo()` |
| `VisualCameraComponent.cs` | `DrawSceneGizmos(bool)` — 构建 context 并分发 |
| `DirectPoseModuleComponent.cs` | 基础 Gizmo 绘制 + 静态工具方法 |
| `ShowcaseAutoFitModuleComponent.cs` | AutoFit 距离范围 Gizmo |
| `ShowcaseVCGizmoDrawer.cs`（Editor） | 编辑期 `[DrawGizmo]` thin dispatcher |

---

## 设计原则

1. **模块自治**：每个模块负责绘制自己的可视化，与运行时管线的 `Execute` 模式一致
2. **职责单一**：Editor dispatcher 只做触发和选中判断，不包含绘制逻辑
3. **零侵入扩展**：新增模块 Gizmo 无需修改任何外部文件
4. **编辑/运行分离**：所有 Gizmo 相关代码包裹在 `#if UNITY_EDITOR` 内，不影响运行时性能
