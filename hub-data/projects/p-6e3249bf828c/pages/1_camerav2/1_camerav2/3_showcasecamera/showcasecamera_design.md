# 多机位展示相机（ShowcaseCamera）设计文档

> 日期: 2026-03-18
> 状态: 已实现
> 关联: CameraControllerV2 架构（见 `Doc/10_Projects/Camera/1_CameraV2/`）

---

## 1. 背景与目标

### 1.1 问题

当前环绕相机（OrbitViewMode）用于人物和物品展示时存在以下问题：

| 问题 | 具体表现 |
|------|----------|
| 参数分散 | `distance/yaw/pitch` 分布在 OrbitInputModule、OrbitFollowModule、OrbitAutoFitModule 三个组件中，共 38 个序列化参数 |
| 参数冲突 | `maxDistance` 在 Follow 中为 15，在 AutoFit/Input 中为 20，行为不可预测 |
| 不直观 | 配置"正面半身特写"需要分别在多个模块中设置间接的球坐标参数 |
| 无预览 | 编辑器中无法直观看到相机位置和画面效果 |
| 单机位 | 不支持多机位预设，切换需要运行时动态修改多个模块参数 |

### 1.2 目标

设计一个基于 CameraControllerV2 现有 VisualCamera 架构的多机位展示相机，满足：

1. **每个机位 = 一个 VisualCamera 子节点**，位姿存储在 DirectPoseModule 的序列化字段中
2. **编辑器 Gizmo** — 每个 VC 渲染为竖直胶囊体 + FOV 锥体，通过 Handle 拖拽编辑
3. **实时预览** — Scene View + Game View（MainCamera）一键同步到机位视角
4. **Prefab 自包含** — 单个 Prefab 承载所有机位配置
5. **零改动现有代码** — 作为新 Mode 接入，不修改 V2 框架

---

## 2. 核心设计决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 机位位姿存储 | DirectPoseModule 自持 `m_position`/`m_rotation` 字段 | 与 Transform 层级解耦，避免父节点（MainCamera）移动导致机位漂移 |
| 多机位实现 | 多个 VisualCamera 子节点 | 复用 V2 架构的 VC 概念，每个 VC 独立管线 |
| 机位切换过渡 | 复用 CameraStateBlender + VC Weight Blend | 现有 Activate/Deactivate 机制，零新代码 |
| Module 层级 | DirectPose + AutoFit 与 VC 在同一 GameObject | 层级扁平，每个机位 = 一个节点 + 三个 Component |
| AutoFit 算法 | CameraAutoFitMode 枚举（Bounds/Capsule/ScreenRatio/None） | 与 OrbitAutoFitModule 对齐，按场景选择最合适的算法 |
| Gizmo 形态 | 竖直胶囊体（世界 Y 轴）+ FOV 锥体 | 胶囊体方向直觉清晰，锥体表示相机朝向 |
| 默认机位 | `m_defaultVCIndex` 序列化字段，运行时实时响应 | Inspector 拖滑条即可实时切换，无需代码 |
| 用户环绕交互 | 预留扩展点，首版不实现 | 需求待明确（受限环绕 or 自由环绕） |

---

## 3. Prefab 结构

```
Pfb_ShowcaseCamera                                    ← Prefab Root
│
└── ShowcaseModeComponent : CameraModeComponent       ← 新 Mode
    │
    ├── FrontFullBody                                 ← 机位 0（Hierarchy 第一个 = 索引 0）
    │   Components: VisualCameraComponent
    │               DirectPoseModuleComponent  [Body, Order: 0]
    │               ShowcaseAutoFitModuleComponent [Body, Order: 10]
    │               CompositionModuleComponent   [Finalize, Order: 0]
    │
    ├── SideHalfBody                                  ← 机位 1
    │   Components: VisualCameraComponent
    │               DirectPoseModuleComponent  [Body, Order: 0]
    │               ShowcaseAutoFitModuleComponent [Body, Order: 10]
    │               CompositionModuleComponent   [Finalize, Order: 0]
    │
    └── HeadCloseup                                   ← 机位 2
        Components: VisualCameraComponent
                    DirectPoseModuleComponent  [Body, Order: 0]
                    ShowcaseAutoFitModuleComponent [Body, Order: 10]
                    CompositionModuleComponent   [Finalize, Order: 0]
```

> **关键**：每个机位是一个 GameObject，所有 Component 平铺在同一节点上。索引 = Hierarchy 中的兄弟顺序（从上到下为 0, 1, 2, …）。命名约定不使用 `VC_*` 前缀（如 `HeadCloseup`）。

### 添加/删除机位

- **添加**：Inspector 点击"+ 添加机位"或"从场景视角捕获新机位"
- **删除**：在 Hierarchy 中删除 VC 子节点
- **重排**：在 Hierarchy 中拖拽调整顺序（索引由子节点顺序决定）

---

## 4. 组件设计

### 4.1 ShowcaseModeComponent

**职责**：管理机位列表、处理切换逻辑、生命周期桥接

**序列化字段**：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `m_defaultVCIndex` | int | 0 | 默认/初始机位索引。运行时修改可实时切换 |
| `m_defaultBlendDuration` | float | 0.5 | 机位切换过渡时长（秒） |

**公共 API**：

```csharp
public void SwitchTo(int index);       // 按索引切换
public void SwitchTo(string vcName);   // 按 VC 名称切换
public void Next();                    // 切换到下一个机位
public void Previous();                // 切换到上一个机位

public int ActiveIndex { get; }
public VisualCameraComponent ActiveVC { get; }
public int VCCount { get; }

public event Action<int, int> EventOnVCSwitched;  // (oldIndex, newIndex)
```

**生命周期**：

| 方法 | 行为 |
|------|------|
| `OnEnterInternal()` | 收集 VC 列表（按兄弟顺序），全部 Deactivate，激活 `m_defaultVCIndex` 对应的 VC |
| `OnUpdateInternal(dt)` | 检测 `m_defaultVCIndex` 变化，有变化则调用 `SwitchToInternal` |
| `OnExitInternal()` | 清空 `EventOnVCSwitched` |

**切换流程**：

```
SwitchTo(newIndex):
    oldVC.Deactivate(m_defaultBlendDuration)   // Weight 1 → 0（带过渡）
    newVC.Activate(m_defaultBlendDuration)     // Weight 0 → 1（带过渡）
    m_activeIndex = newIndex
    EventOnVCSwitched?.Invoke(oldIndex, newIndex)
```

**VC 收集排序**：重写 `CollectVisualCameraComponents()`，按 `transform.GetSiblingIndex()` 升序排列（而非基类的 Priority 降序）。

---

### 4.2 DirectPoseModuleComponent

**职责**：将自持的位置/旋转字段直接输出为 CameraState，不依赖 Transform

**设计要点**：位姿存在自己的序列化字段中，与 Transform 层级完全解耦，避免父节点（MainCamera）移动导致机位坐标漂移。

**序列化字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `m_position` | Vector3 | 相机世界坐标位置 |
| `m_rotation` | Vector3 | 相机旋转（欧拉角，Inspector 友好） |

**公共属性**（供 Editor/Gizmo 读写）：

```csharp
public Vector3 Position { get; set; }
public Quaternion Rotation { get; }         // Euler → Quaternion
public Vector3 RotationEuler { get; set; }
```

**Execute 逻辑**：

```csharp
state.RawPosition = m_position;
state.RawRotation = Quaternion.Euler(m_rotation);
```

Stage: Body, Order: 0

---

### 4.3 ShowcaseAutoFitModuleComponent

**职责**：根据目标物体尺寸，沿相机朝向调整距离（方向不变）

Stage: Body, Order: 10（在 DirectPose 之后执行）

**序列化字段**：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `m_autoFitMode` | CameraAutoFitMode | Capsule | 适配算法选择 |
| `m_fitPadding` | float | 1.2 | 留白系数（1.0 = 刚好填满，1.2 = 留 20% 边距） |
| `m_targetInFrameRatio` | float | 0.5 | 目标占屏比例（仅 ScreenRatio 模式） |
| `m_minDistance` | float | 0.5 | 最小距离限制 |
| `m_maxDistance` | float | 20 | 最大距离限制 |

**适配模式（CameraAutoFitMode）**：

| 模式 | 算法 | 适用场景 |
|------|------|----------|
| `None` | 不做适配，保持 DirectPose 输出的原始位置 | 精确固定机位，不需要自适应 |
| `Bounds` | 基于目标包围盒投影尺寸 + FOV 计算最优距离 | 通用物体展示 |
| `Capsule` | 基于胶囊体投影尺寸（通过 Provider 获取） | 角色展示，比 Bounds 更贴合体型 |
| `ScreenRatio` | 基于目标占屏比例（`m_targetInFrameRatio`）计算距离 | 精确控制目标在画面中的大小比例 |

**Execute 逻辑**：

```
if (mode == None) return;
projectedSize = target.ProjectedSizeGet(state.RawRotation);
optimalDist = CalculateBy(mode, projectedSize, FOV, aspect);
optimalDist = Clamp(optimalDist, min, max);
state.RawPosition = target.ObservationCenterGet() - forward * optimalDist;
```

---

## 5. 编辑器工具

### 5.1 Scene View Gizmo（ShowcaseVCGizmoDrawer）

**触发条件**：选中 ShowcaseModeComponent 或其任意 VC 子节点时绘制

**绘制元素**：

| 元素 | 选中 VC | 未选中 VC |
|------|---------|-----------|
| 胶囊体 | 青色 | 灰色半透明 |
| FOV 锥体 | 青色（高亮） | 灰色半透明（常显） |
| 名称标签 | 加粗青色 | 普通灰色 |

**胶囊体**：
- 长轴 = 世界空间 Y 轴（竖直），不跟随相机朝向
- 位置 = DirectPoseModule.Position（不读 VC Transform）
- 长度 ~0.24m，半径 ~0.08m

**FOV 锥体**：
- 从 DirectPoseModule.Position 出发，沿 DirectPoseModule.Rotation 的 forward 方向
- 所有 VC 常显，选中的 VC 更亮
- 锥体长度 0.8m，按默认 60° FOV + 16:9 展开

> 位置和朝向均从 `DirectPoseModuleComponent` 字段读取，不读 VC Transform，与运行时行为一致。

### 5.2 Inspector 面板（ShowcaseModeEditor）

**选中 ShowcaseModeComponent 时**：

```
┌─────────────────────────────────────────────────────────┐
│  Showcase Camera Mode                                   │
├─────────────────────────────────────────────────────────┤
│  [机位设置]                                              │
│  默认机位索引: [══════●══] 0  (0-2)                     │
│                                                         │
│  [过渡设置]                                              │
│  默认过渡时长: [0.5] s                                   │
│                                                         │
│  [相机机位列表]  (3 个机位)                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ● 0: FrontFullBody     [预览] [选中]            │   │
│  │   1: SideHalfBody      [预览] [选中]            │   │
│  │   2: HeadCloseup       [预览] [选中]            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [+ 添加机位]  [从场景视角捕获新机位]                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**按钮 / 控件功能**：

| 控件 | 操作 |
|------|------|
| 默认机位索引（IntSlider） | 设置初始机位；运行时拖动可实时切换 |
| [预览] | Scene View 对齐到该机位视角，同时设置 MainCamera（Game View 预览） |
| [选中] | `Selection.activeGameObject = vc.gameObject`，在 Hierarchy 中定位 |
| [+ 添加机位] | 新建 VC 节点（位于原点），挂载三个 Component |
| [从场景视角捕获] | 同上，位置/旋转取自当前 Scene Camera |

**Scene View Handle**（选中 ShowcaseModeComponent 时）：
- 所有 VC 同时显示 PositionHandle + RotationHandle
- 拖拽 Handle 直接修改 `DirectPoseModuleComponent.Position/RotationEuler`（支持 Undo）

### 5.3 Prefab 创建工具（ShowcasePrefabCreator）

菜单路径：`Tools/Camera/Create Showcase Camera`

功能：一键在选中对象下创建完整结构，包含：
- Root：ShowcaseModeComponent（`m_defaultVCIndex=0`, `m_defaultBlendDuration=0.5`）
- 默认 3 个机位（正面全身 / 侧面半身 / 头部特写），DirectPose 位置已预设
- 每个 VC 节点：VisualCamera + DirectPose + AutoFit + Composition，Stage/Order 自动设置

附加菜单：`Tools/Camera/Add Showcase VC Slot to Selected`（选中 ShowcaseMode 或其子节点时可用）

---

## 6. 运行时数据流

### 6.1 每帧执行流程

```
CameraControllerV2.LateUpdate()
│
└─ ShowcaseModeComponent.OnUpdateInternal(deltaTime)
    │
    ├─ [检测 m_defaultVCIndex 变化] → SwitchToInternal()（如有）
    │
    ├─ 遍历所有 VC（Weight > 0 的才执行模块管线）
    │   │
    │   └─ VC 模块管线（Body → Finalize）
    │       ├─ DirectPoseModule.Execute()
    │       │   state.RawPosition = m_position
    │       │   state.RawRotation = Quaternion.Euler(m_rotation)
    │       │
    │       ├─ AutoFitModule.Execute()  [若 mode != None]
    │       │   计算最优距离 → 沿 -forward 调整 state.RawPosition
    │       │
    │       └─ CompositionModule.Execute()  [Finalize]
    │           构图调整
    │
    ├─ CameraStateBlender.Blend(vcStates[], deltaTime)
    │   加权平均 Position + Slerp Rotation + Lerp FOV
    │
    └─ ApplyCameraTransform()
        Unity Camera ← FinalPosition, FinalRotation, FOV
```

### 6.2 机位切换时序

```
SwitchTo(2)
    │
    │  t=0.0s  VC[0].Weight = 1.0  →  Deactivate(0.5s) 开始渐出
    │           VC[2].Weight = 0.0  →  Activate(0.5s)   开始渐入
    │
    │  t=0.25s VC[0].Weight ≈ 0.5
    │           VC[2].Weight ≈ 0.5  ← Blender 混合两个 CameraState
    │
    │  t=0.5s  VC[0].Weight = 0.0  ← 过渡完成，VC[0] 标记为不活跃
    │           VC[2].Weight = 1.0
```

---

## 7. 外部调用示例

```csharp
// 切换到 Showcase 模式
m_cameraController.ModeSwitch<ShowcaseModeComponent>();
var showcase = m_cameraController.CurrentMode as ShowcaseModeComponent;

// 按索引切换
showcase.SwitchTo(0);                   // 正面全身
showcase.SwitchTo("HeadCloseup");       // 按名称切换

// 翻页
showcase.Next();
showcase.Previous();

// 监听切换事件
showcase.EventOnVCSwitched += (oldIdx, newIdx) =>
{
    Debug.Log($"机位切换: {oldIdx} → {newIdx}");
};
```

---

## 8. 文件清单

### 新增文件（6 个）

| 文件 | 位置 | 职责 |
|------|------|------|
| `ShowcaseModeComponent.cs` | Runtime/.../Camera/Components/Modes/ | Mode：VC 收集、机位切换、生命周期 |
| `DirectPoseModuleComponent.cs` | Runtime/.../Camera/Components/Modules/ | Module：自持位姿字段 → CameraState |
| `ShowcaseAutoFitModuleComponent.cs` | Runtime/.../Camera/Components/Modules/ | Module：多算法距离自适应 |
| `ShowcaseModeEditor.cs` | Editor/Camera/ | Inspector：机位列表、Handle、预览/捕获 |
| `ShowcaseVCGizmoDrawer.cs` | Editor/Camera/ | Gizmo：竖直胶囊体 + FOV 锥体 |
| `ShowcasePrefabCreator.cs` | Editor/Camera/ | 菜单工具：一键创建 Prefab |

### 不修改的文件

- `CameraControllerV2.cs`、`VisualCameraComponent.cs`、`CameraModeComponent.cs`
- `CameraModuleComponent.cs`、`CameraStateBlender.cs`
- 所有 OrbitView 相关文件（并行共存）

---

## 9. 实现注意事项

### 9.1 位姿与 Transform 解耦

`DirectPoseModuleComponent` 的位姿存在自身序列化字段中（`m_position`/`m_rotation`），不读 VC 节点的 `Transform`。原因：VC 是 MainCamera 的子节点，若通过 Transform 读取世界坐标，在编辑器预览时移动 MainCamera 会导致所有机位偏移累积。

所有 Editor 工具（Gizmo、Handle、预览）均从 `DirectPoseModuleComponent` 的属性读写，保持与运行时逻辑一致。

### 9.2 VC 排序

基类 `CollectVisualCameraComponents()` 按 `Priority` 降序排序。ShowcaseModeComponent 重写此方法，改为按 `transform.GetSiblingIndex()` 升序排列，使索引 = Hierarchy 顺序（策划直觉）。

### 9.3 Deactivate 行为

`VisualCameraComponent.Deactivate(duration)` 不会立即将 `IsActive` 设为 false，而是启动 Weight 的渐出过渡。过渡期间 VC 仍然活跃（模块继续执行），直到 Weight 降为 0 后才标记为不活跃。这保证混合期间两个 VC 都在输出 CameraState。

### 9.4 运行时实时切换

`OnUpdateInternal` 每帧检测 `m_defaultVCIndex != m_activeIndex`，若不同则调用 `SwitchToInternal`。这使 Inspector 的滑条在运行时直接生效，无需额外代码触发。

### 9.5 AutoFit 无目标时的降级

当 `ITargetProvider` 不可用或 `IsActive() == false` 时，AutoFitModule 直接 return，相机保持在 `DirectPoseModule.m_position` 的原始位置。

---

## 10. 扩展预留

### 用户环绕交互（未来）

需求明确后，可在 `ShowcaseModeComponent.HandleRotation/HandlePosition` 中实现，叠加到当前活跃 VC 的基础位姿上，无需改动 Module 层。

### 每 VC 独立 FOV

可新增一个轻量 `OverrideFOVModuleComponent`，在 Finalize 阶段写入 `state.FieldOfView`。AutoFit 的距离计算会自动使用修改后的 FOV。

---

## 11. 对比总结

| 维度 | 现有 OrbitView | 新 ShowcaseCamera |
|------|---------------|-------------------|
| 描述一个机位 | 38 参数 / 5 组件 | Position + Rotation + 5 参数 / 3 组件 |
| 多机位 | 不支持 | VC 子节点列表 |
| 编辑方式 | 改间接球坐标参数 | Scene Handle 拖拽或 [预览]+[捕获] |
| 编辑器预览 | 无 | 竖直胶囊体 + FOV 锥体 + Game View 同步 |
| 机位切换 | 运行时改多个模块参数 | `SwitchTo(index)` 一行代码 |
| 运行时调试 | 无 | Inspector 滑条实时切换 |
| 新增代码 | — | 6 个文件 |
| 修改现有代码 | — | 0 |
| 架构兼容 | — | 完全复用 V2 的 Mode/VC/Module/Blender |
