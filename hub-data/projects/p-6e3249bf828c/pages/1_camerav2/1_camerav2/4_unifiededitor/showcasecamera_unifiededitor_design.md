# ShowcaseCamera 统一可视化编辑器设计方案

> 日期: 2026-03-26
> 状态: 设计中
> 关联: CameraControllerV2 架构、ShowcaseCamera、CameraFrameController

---

## 1. 背景与问题

### 1.1 现状分析

当前 ShowcaseCamera 的编辑能力**分散在 6 个文件**中，操作碎片化：

| 文件 | 职责 | 问题 |
|------|------|------|
| `ShowcaseModeEditor.cs` | Inspector VC 列表 + OnSceneGUI 位置/旋转 Handle | 选中 Mode 才能拖 Handle，但同时显示所有 VC 的 Handle 互相干扰 |
| `DirectPoseModuleEditor.cs` | 选中单个 VC 时显示位置/旋转 Handle | 与 ShowcaseModeEditor 的 Handle **功能重复**，选中 VC 时两套 Handle 叠加 |
| `ShowcaseVCGizmoDrawer.cs` | DrawGizmo 分发器 | 仅分发，无交互能力 |
| `DirectPoseModuleComponent.cs` (Editor区) | 胶囊体 + FOV 锥体 + 标签 Gizmo | 绘制信息有限，无距离/角度数值反馈 |
| `ShowcaseAutoFitModuleComponent.cs` (Editor区) | AutoFit 距离范围 Gizmo | 与 DirectPose 的 Gizmo 协作靠 GetComponent 检测，脆弱 |
| `CameraFrameControllerEditor.cs` | 蓝/绿球体编辑 + Showcase 双向同步 | 需要额外场景（EditorTackleStage），工作流繁琐 |

### 1.2 痛点总结

```
痛点 1 — 操作碎片：编辑一个机位需要在 Mode 节点、VC 节点、DirectPose Inspector 之间反复切换
痛点 2 — Handle 重叠：ShowcaseModeEditor 和 DirectPoseModuleEditor 各画一套 Handle，互相遮挡
痛点 3 — 无直觉操控：Unity 原生 PositionHandle + RotationHandle 是通用工具，
          缺乏相机编辑的语义（"拉远拉近"、"绕目标旋转"、"调整俯仰"）
痛点 4 — 无实时预览：编辑 DirectPose 字段后需要手动点 [预览] 才能在 Game View 看效果
痛点 5 — 无数值 HUD：Scene View 中看不到当前距离、角度、FOV 等关键数值
痛点 6 — CameraFrame 工作流割裂：球体编辑在独立场景，与 Showcase Prefab 需手动同步
```

### 1.3 目标

设计一个 **统一的可视化相机编辑器**（Unified Showcase Camera Editor），实现：

1. **单入口编辑**：选中 ShowcaseMode 或任意 VC 节点即可编辑所有机位
2. **语义化 Handle**：围绕目标的环形轨道 Handle（水平角度）、弧形 Handle（垂直角度）、射线 Handle（距离/Zoom），替代通用 Position/Rotation Handle
3. **实时 HUD**：Scene View 中常驻显示当前机位的距离、水平角、垂直角、FOV
4. **实时预览联动**：编辑时 Game View 自动同步，无需手动点 [预览]
5. **机位缩略图**：Inspector 中每个机位带小预览图
6. **向后兼容**：不修改运行时组件代码，纯 Editor 层改动

### 1.4 参考

参考 Image 2（Qwen Multiangle Camera）的交互范式：
- 围绕中心物体的**环形轨道**表示水平旋转
- 从赤道到极点的**弧形轨道**表示垂直俯仰
- 沿视线方向的**拖拽球**表示缩放/距离
- 底部 HUD 实时显示 HORIZONTAL / VERTICAL / ZOOM 数值

---

## 2. 核心设计

### 2.1 架构总览

```
┌────────────────────────────────────────────────────────────────────┐
│                    统一编辑器入口层                                  │
│                                                                    │
│  ShowcaseCameraUnifiedEditor : CustomEditor                        │
│    触发条件：选中 ShowcaseModeComponent 或其子 VC 节点               │
│    职责：                                                          │
│      1. Inspector GUI（机位列表 + 快捷操作 + 参数面板）              │
│      2. OnSceneGUI 分发 → 活跃 VC 的语义化 Handle                  │
│      3. 实时预览联动（MainCamera 同步）                              │
│      4. 键盘快捷键（Tab 切换机位、F 聚焦、G 切换 Gizmo 模式）       │
└────────────────────────┬───────────────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
┌─────────────────────────┐  ┌──────────────────────────┐
│  Scene View Handle 层    │  │  Scene View HUD 层       │
│                         │  │                          │
│  ShowcaseOrbitHandle    │  │  ShowcaseSceneHUD        │
│    水平环形 Handle       │  │    距离 / 角度 / FOV 数值 │
│    垂直弧形 Handle       │  │    当前机位名称           │
│    距离拉杆 Handle       │  │    AutoFit 状态           │
│    FOV 扇形 Handle       │  │    操作提示               │
│    LookAt 球体 Handle    │  │                          │
└─────────────────────────┘  └──────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│  Gizmo 层（保持现有架构，增强可视化）                      │
│                                                         │
│  ShowcaseVCGizmoDrawer → VC.DrawSceneGizmos → Module    │
│    DirectPoseModule:  胶囊体 + FOV 锥体 + 标签          │
│    AutoFitModule:     距离范围 + 刻度                    │
│    [新增] 环形轨道线 + 目标连线 + 角度标注               │
│                                                         │
│  * Gizmo 层仅负责"看"，不处理交互                        │
│  * Handle 层负责"改"，读写 DirectPoseModule 字段          │
└─────────────────────────────────────────────────────────┘
```

### 2.2 核心概念：相机球坐标参数化

关键设计决策：编辑器在**语义层**将 DirectPose 的 `(position, rotation)` 转换为围绕目标的**球坐标参数**进行编辑，编辑完成后写回 `(position, rotation)`。

```
球坐标参数（编辑器临时计算，不持久化）：
  - pivotPoint   : 目标中心点（从 ITargetProvider 或手动指定）
  - distance     : 相机到目标的距离
  - yaw          : 水平角度（0° = 正前方，顺时针为正）
  - pitch        : 垂直角度（0° = 水平，正值向上）
  - roll         : 滚转角度（通常为 0）
  - fov          : 视野角度

编辑时：
  Handle 拖拽 → 修改 (distance, yaw, pitch) → 换算 → 写入 DirectPose (position, rotation)

读取时：
  DirectPose (position, rotation) + pivotPoint → 换算 → (distance, yaw, pitch)
```

**为什么不持久化球坐标？**
- `DirectPoseModuleComponent` 的 `(m_position, m_rotation)` 是运行时的 source of truth
- 球坐标仅是编辑器的"视角"，不增加运行时复杂度
- 当 AutoFit 改变了实际距离时，球坐标自动反映最新状态
- 保持与现有架构（CameraFrameController 同步、Prefab 序列化）完全兼容

### 2.3 Pivot 策略

编辑器需要一个"目标中心点"作为球坐标的原点：

| 优先级 | 来源 | 条件 |
|--------|------|------|
| 1 | `ITargetProvider.PositionGet()` | 运行时有活跃目标 |
| 2 | VC 的 `DefaultObservationPointName` 对应的观察点中心 | 有配置且可解析 |
| 3 | 相机前方 `distance` 处的点 | 编辑器计算（`position + forward * distance`） |
| 4 | `Vector3.zero`（世界原点） | 兜底 |

编辑器 Inspector 中提供 **Pivot Override** 字段，策划可手动指定或锁定 pivot。

---

## 3. Scene View 语义化 Handle 设计

### 3.1 Handle 总览

```
                        垂直弧形 Handle（Pitch）
                              ╭─────╮
                           ╭──┤     ├──╮
                          │   │  ●  │   │    ● = 相机位置球
                          │   ╰──┬──╯   │
                          │      │      │
     ──────────────────── ╰──────┼──────╯ ──── 水平环形 Handle（Yaw）
                                 │
                      距离拉杆 Handle（Zoom）
                                 │
                                 ▼
                            ◆ 目标中心
```

### 3.2 各 Handle 详细规格

#### 3.2.1 水平环形 Handle（Yaw Ring）

```csharp
// 视觉：围绕 pivot 的水平圆环，半径 = distance 的投影
// 颜色：品红色 (Magenta)，选中时高亮
// 交互：拖拽圆环上的球体手柄，沿环旋转
// 效果：修改相机 yaw 角度，保持 distance 和 pitch 不变
// 数值：拖拽时在手柄旁显示 "H: 54°"
```

| 属性 | 值 |
|------|------|
| 颜色 | `new Color(1f, 0.2f, 0.6f, 0.8f)` (品红) |
| 环半径 | `distance * cos(pitch)` |
| 手柄球半径 | `HandleUtility.GetHandleSize() * 0.08` |
| 吸附 | 按住 Ctrl 时 5° 步进 |

#### 3.2.2 垂直弧形 Handle（Pitch Arc）

```csharp
// 视觉：通过相机位置和 pivot 的垂直平面上的弧线（-80° ~ +80°）
// 颜色：青色 (Cyan)
// 交互：拖拽弧线上的球体手柄，沿弧旋转
// 效果：修改相机 pitch 角度，保持 distance 和 yaw 不变
// 数值：拖拽时在手柄旁显示 "V: 29°"
// 限制：pitch 被 Clamp 在 [-85°, +85°] 范围内，避免万向锁
```

| 属性 | 值 |
|------|------|
| 颜色 | `new Color(0f, 1f, 1f, 0.8f)` (青色) |
| 弧半径 | `distance` |
| 弧范围 | -85° ~ +85° |
| 手柄球半径 | `HandleUtility.GetHandleSize() * 0.08` |
| 吸附 | 按住 Ctrl 时 5° 步进 |

#### 3.2.3 距离拉杆 Handle（Zoom/Distance）

```csharp
// 视觉：从 pivot 到相机位置的射线上的滑块
// 颜色：黄色 (Yellow)
// 交互：沿射线方向拖拽球体手柄，改变距离
// 效果：修改相机 distance（position 沿视线方向移动），rotation 不变
// 数值：拖拽时在手柄旁显示 "D: 2.1m"
// 限制：Clamp 在 AutoFit 的 [minDistance, maxDistance] 范围内
```

| 属性 | 值 |
|------|------|
| 颜色 | `new Color(1f, 0.9f, 0f, 0.9f)` (黄色) |
| 手柄球半径 | `HandleUtility.GetHandleSize() * 0.06` |
| 最小距离 | `0.1` 或 AutoFit.minDistance |
| 最大距离 | `50` 或 AutoFit.maxDistance |

#### 3.2.4 LookAt 球体 Handle（Pivot Point）

```csharp
// 视觉：目标中心位置的实心球体（与 CameraFrameController 的绿色球类似）
// 颜色：绿色 (Green)，锁定时灰色
// 交互：自由拖拽可移动 pivot，相机跟随旋转保持球坐标参数不变
// 效果：移动目标中心，相机位置自动调整
// 锁定：当有活跃 ITargetProvider 时自动锁定（不可拖拽），显示灰色
```

#### 3.2.5 FOV 扇形 Handle（可选，高级模式）

```csharp
// 视觉：在 FOV 锥体的左右边缘显示两个可拖拽的点
// 交互：水平拖拽改变 FOV 角度
// 默认隐藏，通过 Inspector 或快捷键开启
```

### 3.3 Handle 交互模式

```
默认模式（Orbit Mode）：
  - 显示 Yaw Ring + Pitch Arc + Distance Slider + LookAt 球
  - 适合"围绕目标摆机位"的场景
  - 快捷键 [1] 切换

自由模式（Free Mode）：
  - 显示传统 PositionHandle + RotationHandle
  - 与当前 ShowcaseModeEditor 行为一致
  - 适合精确调整或不围绕目标的场景
  - 快捷键 [2] 切换

混合模式（Hybrid Mode）：
  - 同时显示两种 Handle（Orbit Handle 在外圈，Free Handle 在内圈）
  - 快捷键 [3] 切换
```

### 3.4 多机位同时显示

```
选中 ShowcaseMode 节点时：
  - 活跃机位（ActiveVC）：显示完整的语义化 Handle（环 + 弧 + 拉杆）
  - 非活跃机位：仅显示半透明胶囊体 + FOV 锥体 + 名称标签
  - 点击非活跃机位的胶囊体 → 切换活跃编辑目标
  - Tab 键循环切换活跃机位

选中单个 VC 节点时：
  - 仅该 VC 显示完整 Handle
  - 其他 VC 仍显示简化 Gizmo（通过 ShowcaseVCGizmoDrawer）
```

---

## 4. Scene View HUD 设计

### 4.1 底部信息栏（SceneView Overlay）

使用 Unity 2022+ 的 `Overlay` API 创建持久化 HUD：

```
┌──────────────────────────────────────────────────────────────┐
│  🎬 ShowcaseCamera: ItemShowCase                             │
│                                                              │
│  HORIZONTAL    VERTICAL     ZOOM       FOV                   │
│    96.8°         15.3°      2.93m      90°                   │
│                                                              │
│  [◀ Prev]  ● FrontFullBody (0/3)  [Next ▶]                 │
│  [Orbit ●] [Free ○] [Hybrid ○]     [👁 Preview: ON]        │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 手柄旁浮动标签

拖拽 Handle 时在鼠标附近显示实时数值：

```csharp
// 拖拽 Yaw Ring 时
Handles.Label(handlePos + offset, "H: 96.8°", s_hudStyle);

// 拖拽 Pitch Arc 时
Handles.Label(handlePos + offset, "V: 15.3°", s_hudStyle);

// 拖拽 Distance 时
Handles.Label(handlePos + offset, "D: 2.93m", s_hudStyle);
```

### 4.3 HUD 样式规范

| 元素 | 字体 | 颜色 | 背景 |
|------|------|------|------|
| 参数名（HORIZONTAL 等） | 10pt, Regular | 灰白 #AAAAAA | 无 |
| 参数值（96.8° 等） | 14pt, Bold | 对应 Handle 颜色 | 半透明黑色圆角矩形 |
| 机位名称 | 12pt, Bold | 白色 | 无 |
| 操作提示 | 10pt, Regular | 灰色 #888888 | 无 |

---

## 5. Inspector 统一面板设计

### 5.1 布局

```
┌──────────────────────────────────────────────────────┐
│  ■ Showcase Camera Editor                    [?][≡]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  [编辑模式]                                           │
│  (●) Orbit    (○) Free    (○) Hybrid                 │
│                                                      │
│  [活跃机位参数]                    ┌──────────┐       │
│  名称:  ItemShowCase               │ 预览缩略图 │      │
│  位置:  [-2.93, 0.88, 0.38]       │  (128x72) │      │
│  旋转:  [15.3, 96.8, 0.0]        └──────────┘       │
│  FOV:   [═══════●═══] 90                             │
│                                                      │
│  [球坐标参数] (只读 / Orbit 模式可编辑)                │
│  水平角度: [═══════════●] 96.8°                       │
│  垂直角度: [════●═══════] 15.3°                       │
│  距离:     [═══●════════] 2.93m                       │
│                                                      │
│  [Pivot 设置]                                         │
│  (●) 自动（从目标）  (○) 手动指定                      │
│  Pivot: [0.00, 0.90, 0.00]        [拾取场景点]        │
│                                                      │
│  [AutoFit]                                           │
│  模式: [Bounds  ▼]                                    │
│  留白: [1.2]   距离: [0.2 ════ 50.0]                 │
│                                                      │
├──────────────────────────────────────────────────────┤
│  [相机机位列表]  (3 个机位)                            │
│  ┌────────────────────────────────────────────┐      │
│  │ ● 0: ItemShowCase    [预览][对齐][选中][×] │      │
│  │   1: VC_Slot1        [预览][对齐][选中][×] │      │
│  │   2: VC_Slot2        [预览][对齐][选中][×] │      │
│  └────────────────────────────────────────────┘      │
│                                                      │
│  [+ 添加机位]  [从场景视角捕获]  [从 CameraFrame 导入] │
│                                                      │
├──────────────────────────────────────────────────────┤
│  [全局设置]                                           │
│  默认机位索引: [══●══] 0  (0~2)                       │
│  过渡时长:     [0.5] s                                │
│  实时预览:     [✓]                                    │
│  Gizmo 显示:   [✓] 胶囊体  [✓] FOV锥  [✓] 轨道      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 5.2 新增功能说明

| 功能 | 说明 |
|------|------|
| **预览缩略图** | 使用 `Camera.Render()` 到 RenderTexture，在 Inspector 中显示 128x72 缩略图 |
| **球坐标参数滑条** | 直接拖动滑条编辑 yaw/pitch/distance，自动换算写入 DirectPose |
| **Pivot 拾取** | 点击 [拾取场景点] 后在 Scene View 点击一个位置作为 pivot |
| **对齐按钮** | 将 Scene View Camera 对齐到该机位（替代原有的 [预览]） |
| **从 CameraFrame 导入** | 直接从 CameraFrameController 读取数据，无需切换场景 |
| **Gizmo 显示开关** | 控制各类 Gizmo 的可见性 |

---

## 6. 增强 Gizmo 设计

### 6.1 新增 Gizmo 元素

在现有 Gizmo 基础上，为活跃机位增加以下可视化：

| 元素 | 说明 | 颜色 | 条件 |
|------|------|------|------|
| **Yaw 环** | Pivot 为中心的水平圆环 | 品红半透明 | Orbit 模式 |
| **Pitch 弧** | 通过相机和 Pivot 的垂直半圆弧 | 青色半透明 | Orbit 模式 |
| **Pivot → Camera 连线** | 虚线，标注距离 | 白色半透明 | 始终 |
| **Pivot 十字** | Pivot 位置的 3D 十字标记 | 绿色 | 始终 |
| **角度标注弧** | 在 Yaw 环和 Pitch 弧上标注当前角度的扇形 | 对应颜色（填充半透明） | 拖拽时 |
| **地面投影线** | 相机位置到地面的垂直虚线 | 灰色 | 可选 |

### 6.2 非活跃机位的简化 Gizmo

```
非活跃机位：
  - 胶囊体: 灰色半透明（不变）
  - FOV 锥体: 灰色半透明（不变）
  - 名称标签: 灰色小字（不变）
  - [新增] 可点击的胶囊体区域：点击切换活跃机位
```

### 6.3 Gizmo 与 Handle 的职责分离

```
                        ┌──────────────┐
                        │   Gizmo 层    │
                        │  "只看不改"   │
                        │  OnDrawGizmos │
                        │  DrawGizmo    │
                        └──────┬───────┘
                               │
        现有 Module.DrawSceneGizmo 不变，新增环/弧 Gizmo
                               │
                        ┌──────┴───────┐
                        │  Handle 层    │
                        │  "看了就改"   │
                        │  OnSceneGUI   │
                        └──────────────┘

原则：
  - Gizmo 层（DrawGizmo / OnDrawGizmos）：仅视觉展示，无交互
  - Handle 层（OnSceneGUI）：交互操作，读写数据
  - 两层共享球坐标计算工具类（ShowcaseCameraEditorUtils）
```

---

## 7. 球坐标工具类

### 7.1 ShowcaseCameraEditorUtils

```csharp
/// <summary>
/// 球坐标 ↔ 笛卡尔坐标 转换工具
/// 编辑器专用，不进入运行时
/// </summary>
public static class ShowcaseCameraEditorUtils
{
    /// <summary>
    /// 从 DirectPose 位姿 + Pivot 计算球坐标参数
    /// </summary>
    public static SphericalParams CartesianToSpherical(
        Vector3 cameraPosition, Quaternion cameraRotation, Vector3 pivotPoint)
    {
        Vector3 offset = cameraPosition - pivotPoint;
        float distance = offset.magnitude;

        // 水平角（Yaw）：XZ 平面上的角度，0° = +Z（正前方）
        float yaw = Mathf.Atan2(offset.x, offset.z) * Mathf.Rad2Deg;

        // 垂直角（Pitch）：仰角
        float pitch = Mathf.Asin(Mathf.Clamp(offset.y / distance, -1f, 1f)) * Mathf.Rad2Deg;

        return new SphericalParams
        {
            Distance = distance,
            Yaw = yaw,
            Pitch = pitch,
            PivotPoint = pivotPoint
        };
    }

    /// <summary>
    /// 从球坐标参数计算 DirectPose 位姿
    /// 相机始终朝向 Pivot
    /// </summary>
    public static (Vector3 position, Vector3 rotationEuler) SphericalToCartesian(
        in SphericalParams spherical)
    {
        float yawRad = spherical.Yaw * Mathf.Deg2Rad;
        float pitchRad = spherical.Pitch * Mathf.Deg2Rad;

        Vector3 offset = new Vector3(
            spherical.Distance * Mathf.Cos(pitchRad) * Mathf.Sin(yawRad),
            spherical.Distance * Mathf.Sin(pitchRad),
            spherical.Distance * Mathf.Cos(pitchRad) * Mathf.Cos(yawRad)
        );

        Vector3 position = spherical.PivotPoint + offset;
        Quaternion rotation = Quaternion.LookRotation(
            (spherical.PivotPoint - position).normalized, Vector3.up);

        return (position, rotation.eulerAngles);
    }
}

public struct SphericalParams
{
    public float Distance;      // 距离 (m)
    public float Yaw;           // 水平角 (°)
    public float Pitch;         // 垂直角 (°)
    public Vector3 PivotPoint;  // 目标中心
}
```

---

## 8. 实时预览联动

### 8.1 自动同步机制

```csharp
// ShowcaseCameraUnifiedEditor 中
private bool m_livePreview = true;  // Inspector 中的开关

private void SyncMainCameraToActiveVC()
{
    if (!m_livePreview) return;

    var directPose = m_activeVC.GetComponent<DirectPoseModuleComponent>();
    var mainCam = Camera.main;
    if (directPose == null || mainCam == null) return;

    // 不记录 Undo（避免 Undo 栈膨胀），仅临时修改
    mainCam.transform.position = directPose.Position;
    mainCam.transform.rotation = directPose.Rotation;

    // FOV 同步
    if (directPose.Fov > 0)
        mainCam.fieldOfView = directPose.Fov;
}
```

### 8.2 触发时机

| 事件 | 行为 |
|------|------|
| Handle 拖拽中 | 每帧同步 MainCamera |
| Inspector 滑条拖拽中 | 每帧同步 MainCamera |
| 切换活跃机位 | 立即同步 MainCamera |
| 关闭实时预览 | 恢复 MainCamera 到上次同步前的位姿 |

---

## 9. 快捷键设计

| 快捷键 | 功能 | 条件 |
|--------|------|------|
| `Tab` | 切换到下一个机位 | 选中 ShowcaseMode 或 VC |
| `Shift+Tab` | 切换到上一个机位 | 同上 |
| `1` | Orbit 编辑模式 | 同上 |
| `2` | Free 编辑模式 | 同上 |
| `3` | Hybrid 编辑模式 | 同上 |
| `F` | 聚焦活跃机位（Scene View 飞到机位附近） | 同上 |
| `Shift+F` | 聚焦 Pivot 点 | 同上 |
| `P` | 切换实时预览开/关 | 同上 |
| `Ctrl+拖拽` | 吸附模式（5° / 0.1m 步进） | 拖拽 Handle 时 |

---

## 10. 文件结构

### 10.1 新增文件

```
Assets/GameProject/Scripts/Editor/CameraV2Editor/
├── ShowcaseCameraUnifiedEditor.cs          # 统一入口 CustomEditor（替代 ShowcaseModeEditor）
├── ShowcaseCameraUnifiedEditor_Inspector.cs # partial: Inspector GUI 部分
├── ShowcaseCameraUnifiedEditor_SceneView.cs # partial: OnSceneGUI Handle 部分
├── ShowcaseCameraUnifiedEditor_HUD.cs       # partial: Scene View HUD/Overlay
├── ShowcaseCameraEditorUtils.cs            # 球坐标工具类 + 通用绘制工具
├── ShowcaseOrbitHandle.cs                  # 语义化 Handle 封装（Yaw/Pitch/Distance/LookAt）
└── ShowcaseCameraSceneOverlay.cs           # SceneView Overlay（底部 HUD 面板）
```

### 10.2 修改文件

| 文件 | 修改内容 |
|------|---------|
| `ShowcaseModeEditor.cs` | **替换**为 `ShowcaseCameraUnifiedEditor.cs`（旧文件可保留但标记 Obsolete） |
| `DirectPoseModuleEditor.cs` | **移除 OnSceneGUI**（Handle 统一由 UnifiedEditor 管理，避免重复） |
| `ShowcaseVCGizmoDrawer.cs` | **增强**：增加环形轨道和弧形轨道的 Gizmo 绘制，由 UnifiedEditor 控制可见性 |
| `DirectPoseModuleComponent.cs` (Editor区) | **增强**：新增环/弧 Gizmo 绘制方法（静态工具方法） |

### 10.3 不修改的文件

| 文件 | 原因 |
|------|------|
| 所有 Runtime 代码 | 编辑器改动不影响运行时 |
| `ShowcasePrefabCreator.cs` | 创建逻辑不变，仅被新 Inspector 调用 |
| `CameraFrameControllerEditor.cs` | 保留现有工作流，新增导入接口 |
| `ShowcaseAutoFitModuleComponent.cs` (Editor区) | 现有 Gizmo 保持不变 |

---

## 11. 实现分阶段计划

### Phase 1: 基础统一（消除碎片化）

**目标**：单入口 + 消除重复 + 实时预览

- [ ] 创建 `ShowcaseCameraUnifiedEditor.cs`，替代 `ShowcaseModeEditor` 的 `[CustomEditor]`
- [ ] 统一 Inspector GUI（合并机位列表 + DirectPose 参数 + AutoFit 参数）
- [ ] 移除 `DirectPoseModuleEditor.OnSceneGUI` 的 Handle（由 UnifiedEditor 统一管理）
- [ ] 实现活跃机位切换（点击胶囊体 / Tab 键 / Inspector 列表）
- [ ] 实现 MainCamera 实时同步预览
- [ ] 球坐标工具类 `ShowcaseCameraEditorUtils`

### Phase 2: 语义化 Handle

**目标**：Orbit 模式 Handle 替代通用 Handle

- [ ] 实现 `ShowcaseOrbitHandle`（Yaw Ring + Pitch Arc + Distance Slider）
- [ ] 实现 Handle 拖拽 → 球坐标修改 → DirectPose 写入
- [ ] 实现 Ctrl 吸附模式
- [ ] 实现拖拽时的浮动数值标签
- [ ] 支持 Free / Orbit / Hybrid 三种编辑模式切换

### Phase 3: Scene View HUD

**目标**：完整的 HUD 信息展示

- [ ] 实现 `ShowcaseCameraSceneOverlay`（Overlay API）
- [ ] 底部 HUD 面板（距离、角度、FOV、机位名、模式切换按钮）
- [ ] 增强 Gizmo（环形轨道线、Pivot 十字、角度标注弧）
- [ ] 手柄旁浮动标签

### Phase 4: 高级功能

**目标**：缩略图 + CameraFrame 导入 + FOV Handle

- [ ] Inspector 中每个机位的预览缩略图（RenderTexture 方案）
- [ ] 从 CameraFrameController 直接导入机位数据
- [ ] FOV 扇形 Handle
- [ ] LookAt 球体 Handle（可拖拽 Pivot）
- [ ] Pivot 场景拾取功能

---

## 12. 技术决策汇总

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 球坐标参数持久化 | 不持久化，每帧从 DirectPose 计算 | 与运行时 source of truth 一致，避免数据冗余 |
| Handle 实现方式 | `Handles.FreeMoveHandle` + 自定义约束 | Unity 内置 Handle 可自定义约束函数，比全手写射线检测更稳定 |
| HUD 实现方式 | SceneView `Overlay` API (2022+) | 项目使用 Unity 2022.3，原生支持 Overlay |
| Editor 入口 | `[CustomEditor(typeof(ShowcaseModeComponent))]` | 选中 Mode 节点自动激活，零额外操作 |
| 多文件 Partial Class | Inspector / SceneView / HUD 分文件 | 参照 `CameraTrackManagerEditor` 的分文件实践，每个文件 < 400 行 |
| Handle 与 Gizmo 分层 | OnSceneGUI 画 Handle，DrawGizmo 画 Gizmo | 保持现有架构的"模块自绘制"原则 |
| 缩略图方案 | 编辑器临时 Camera + RenderTexture | 不影响运行时，按需渲染 |
| 旧 Editor 处理 | ShowcaseModeEditor 标记 Obsolete 但保留 | 渐进迁移，避免一次性破坏 |

---

## 13. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Orbit Handle 拖拽精度 | 大角度拖拽时手感不顺 | 使用 `HandleUtility.ProjectPointLine` 约束到环/弧上，小角度增量计算 |
| 球坐标 ↔ 笛卡尔转换的万向锁 | pitch 接近 ±90° 时 yaw 不稳定 | Clamp pitch 在 [-85°, +85°]，极端角度切换到 Free 模式提示 |
| 性能（多机位 Gizmo + Handle） | 20+ 机位时 Scene View 卡顿 | 非活跃机位仅绘制简化 Gizmo，LOD 策略 |
| Undo 栈膨胀 | 拖拽产生大量 Undo 记录 | 使用 `Undo.SetCurrentGroupName` 合并连续拖拽为单次 Undo |
| MainCamera 实时同步的副作用 | 预览修改了 MainCamera Transform | 关闭预览时恢复原始位姿，且不记录 Undo |

---

## 14. 对比总结

| 维度 | 当前（散落 6 文件） | 统一编辑器（本方案） |
|------|-------------------|---------------------|
| 编辑入口 | 需在 Mode/VC/DirectPose 之间切换 | 选中 Mode 即可编辑所有 |
| Handle 交互 | 通用 Position + Rotation，无语义 | Yaw 环 + Pitch 弧 + Distance 拉杆 |
| 数值反馈 | 无（需看 Inspector 数字） | Scene View HUD 常驻显示 |
| 实时预览 | 手动点 [预览] 按钮 | 自动同步 Game View |
| 机位切换 | 点击 [选中] → Hierarchy 跳转 → Inspector 变化 | Tab 键 / 点击胶囊体 / Inspector 列表 |
| CameraFrame 同步 | 需切换到独立场景操作 | Inspector 一键导入 |
| Handle 冲突 | ShowcaseModeEditor + DirectPoseModuleEditor 双重 Handle | 统一管理，零冲突 |
