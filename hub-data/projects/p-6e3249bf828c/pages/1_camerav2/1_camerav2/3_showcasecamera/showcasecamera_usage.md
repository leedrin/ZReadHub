# ShowcaseCamera 使用说明

> 适用对象：策划 / 美术 / 客户端程序
> 最后更新：2026-03-23

---

## 概念速览

ShowcaseCamera 是一个**多机位展示相机**，核心思路：

- 每个**机位 = 一个子节点**（VC），在编辑器中直接拖拽摆放
- **Inspector 滑条**控制当前机位，运行时实时生效
- **自动适配**（AutoFit）可让相机沿朝向自动拉远/拉近，确保目标完整入框

```
ShowcaseMode
├── FrontFullBody      ← 机位 0：正面全身
├── SideHalfBody       ← 机位 1：侧面半身
└── HeadCloseup        ← 机位 2：头部特写
```

---

## 一、快速创建（编辑器）

### 1. 创建 Prefab 结构

1. 在 **Hierarchy** 中选中要挂载的父节点（例如 `CameraRoot`）
2. 菜单 **Tools → Camera → Create Showcase Camera**
3. 自动生成包含 3 个默认机位的节点结构

> 生成的结构会在父节点下创建 `ShowcaseMode` 节点，含 3 个子 VC。

---

## 二、配置机位（编辑器）

### 2. 选中 ShowcaseMode 节点

Inspector 面板显示：

| 区域 | 说明 |
|------|------|
| **机位设置 → 默认机位索引** | 滑条，0 = 第一个机位 |
| **过渡设置 → 默认过渡时长** | 切换时的混合时长（秒） |
| **相机机位列表** | 所有机位，带 [预览] [选中] 按钮 |
| **+ 添加机位** | 在原点新建一个机位 |
| **从场景视角捕获新机位** | 以当前 Scene View 视角新建机位 |

### 3. 调整机位位置和朝向

**方法 A：Scene View 直接拖拽**

选中 `ShowcaseMode` 节点后，Scene View 中每个机位会显示：
- 竖直**胶囊体**（表示相机位置）
- **FOV 锥体**（表示相机朝向和视野范围）
- **Position Handle**（彩色箭头，可拖拽移动）
- **Rotation Handle**（彩色圆弧，可拖拽旋转）

直接拖拽 Handle 即可调整，支持 **Ctrl+Z 撤销**。

**方法 B：从场景视角对齐**

1. 在 Scene View 中把视角调整到想要的机位位置
2. Inspector 中找到对应机位，点击 **[预览]**
   - 此时 Scene View 和 Game View 都会跳到该机位
3. 若效果满意，将 Scene View 继续调整到目标位置后，点击 **[从场景视角捕获新机位]** 或手动在 `DirectPoseModule` 的 Inspector 中直接修改 `m_position`/`m_rotation` 字段

**方法 C：直接编辑 DirectPoseModule 字段**

选中某个 VC 节点，Inspector 中展开 `DirectPoseModuleComponent`，直接输入数值：
- **相机位置（m_position）**：世界坐标 XYZ
- **相机旋转（m_rotation）**：欧拉角 XYZ（Pitch/Yaw/Roll）

### 4. 预览效果

点击机位列表中的 **[预览]** 按钮：
- Scene View 跳转到该机位视角
- **MainCamera 同步**到该机位（Game View 实时预览）

> 预览操作支持 Ctrl+Z 撤销，不会永久影响 MainCamera。

### 5. 配置 AutoFit（可选）

选中某个 VC 节点，展开 `ShowcaseAutoFitModuleComponent`：

| 字段 | 说明 |
|------|------|
| **Auto Fit Mode** | 选择算法（见下表） |
| **Fit Padding** | 留白系数，1.0 = 刚好，1.2 = 留 20% 边距 |
| **Target In Frame Ratio** | 目标占屏比例（仅 ScreenRatio 模式） |
| **Min Distance** | 相机与目标最近距离 |
| **Max Distance** | 相机与目标最远距离 |

**AutoFit 算法选择**：

| 模式 | 适用场景 |
|------|----------|
| `None` | 固定机位，不自动调距，精确控制 |
| `Capsule` | **推荐**，角色展示，基于角色胶囊体计算，贴合体型 |
| `Bounds` | 物件展示，基于包围盒计算 |
| `ScreenRatio` | 精确控制目标占屏幕的比例（配合 `Target In Frame Ratio`） |

### 6. 添加 / 删除机位

- **添加**：Inspector 底部点击 **[+ 添加机位]** 或 **[从场景视角捕获新机位]**
- **也可用菜单**：选中 ShowcaseMode 节点后，**Tools → Camera → Add Showcase VC Slot to Selected**
- **删除**：在 Hierarchy 中删除对应的 VC 子节点
- **重排顺序**：在 Hierarchy 中拖拽 VC 子节点，顺序即索引

---

## 三、运行时调试（编辑器 Play 模式）

运行时选中 ShowcaseMode 节点，拖动 Inspector 中的**默认机位索引**滑条，即可实时切换机位（带过渡动画）。

> 无需写代码，直接在 Play 模式下验证效果。

---

## 四、程序接入

### 切换到 Showcase 模式

```csharp
// 1. 切换相机模式
m_cameraController.ModeSwitch<ShowcaseModeComponent>();

// 2. 获取 ShowcaseModeComponent 引用
var showcase = m_cameraController.CurrentMode as ShowcaseModeComponent;
```

### 切换机位

```csharp
// 按索引（Hierarchy 中从上到下 = 0, 1, 2, …）
showcase.SwitchTo(0);

// 按名称（VC 节点名）
showcase.SwitchTo("HeadCloseup");

// 翻页
showcase.Next();
showcase.Previous();
```

### 查询当前状态

```csharp
int current = showcase.ActiveIndex;          // 当前机位索引
VisualCameraComponent vc = showcase.ActiveVC; // 当前机位的 VC
int total = showcase.VCCount;                 // 机位总数
```

### 监听切换事件

```csharp
showcase.EventOnVCSwitched += (oldIdx, newIdx) =>
{
    // 机位从 oldIdx 切换到 newIdx 时触发
    Debug.Log($"机位切换: {oldIdx} → {newIdx}");
};
```

> **注意**：`EventOnVCSwitched` 在 `OnExitInternal` 时会被清空，无需手动解绑。

### 典型用例示例

```csharp
// 进入人物信息界面
private void OnEnterCharacterView()
{
    m_cameraController.ModeSwitch<ShowcaseModeComponent>();
    var showcase = m_cameraController.CurrentMode as ShowcaseModeComponent;

    // 默认显示正面全身
    showcase.SwitchTo("FrontFullBody");
}

// 点击"查看装备"
private void OnClickEquipment()
{
    var showcase = m_cameraController.CurrentMode as ShowcaseModeComponent;
    showcase?.SwitchTo("SideHalfBody");
}

// 点击"头像编辑"
private void OnClickAvatar()
{
    var showcase = m_cameraController.CurrentMode as ShowcaseModeComponent;
    showcase?.SwitchTo("HeadCloseup");
}

// 离开界面时切回默认相机
private void OnExitCharacterView()
{
    m_cameraController.ModeSwitch<OrbitViewModeComponent>();
}
```

---

## 五、常见问题

**Q：机位位置不对，感觉在跟着 MainCamera 漂移？**

A：确认 `DirectPoseModuleComponent` 中的 `m_position` 字段是否正确。机位坐标存储在 DirectPoseModule 的字段里，与节点 Transform 无关，不受父节点影响。

**Q：AutoFit 不生效，目标没有入框？**

A：检查以下几点：
1. `Auto Fit Mode` 不是 `None`
2. 目标场景中存在有效的 `ITargetProvider`（通常由 SceneTask 注入）
3. `Max Distance` 足够大，没有被 Clamp

**Q：点击预览后 MainCamera 位置变了，再切回 Scene View 位置异常？**

A：预览操作支持 Ctrl+Z 撤销。预览仅在编辑模式下移动 MainCamera 用于观察，不影响 Prefab 中的机位数据。

**Q：机位索引和 Hierarchy 顺序不一致？**

A：ShowcaseMode 按 Hierarchy 中的**兄弟节点顺序**（从上到下 = 0, 1, 2, …）收集机位。拖拽调整 Hierarchy 顺序即可改变索引。

**Q：切换动画太突兀 / 太慢？**

A：在 ShowcaseMode 节点的 Inspector 中调整**默认过渡时长**（`m_defaultBlendDuration`）。设为 0 表示立即切换，无过渡。

---

## 六、节点结构速查

```
[ShowcaseMode 节点]
  Component: ShowcaseModeComponent
    m_defaultVCIndex    ← 默认/运行时切换机位
    m_defaultBlendDuration ← 切换过渡时长

  [FrontFullBody 子节点]
    Component: VisualCameraComponent
    Component: DirectPoseModuleComponent
      m_position          ← 相机世界坐标
      m_rotation          ← 相机朝向（欧拉角）
    Component: ShowcaseAutoFitModuleComponent
      m_autoFitMode       ← None / Capsule / Bounds / ScreenRatio
      m_fitPadding        ← 留白系数
      m_minDistance / m_maxDistance
    Component: CompositionModuleComponent

  [SideHalfBody 子节点]      ← 同上结构
  [HeadCloseup 子节点]       ← 同上结构
```

---

## 七、CameraFrameController 多机位编辑工具（Editor）

### 概述

`CameraFrameController` 是一个 **Editor-Only** 的辅助工具组件，提供可视化的相机机位编辑能力。在 Showcase 场景中，它与 ShowcaseCamera 的 VC 节点**双向同步**，让美术/策划可以通过拖拽球体 Handle 的方式直观编辑多个相机机位，再一键写入到 ShowcaseCamera。

**核心价值**：
- 每个 CameraFrame 由**相机位置球**（CameraPosition）和**看向位置球**（LookAt）组成，在 Scene View 中直接拖拽
- 与 ShowcaseCamera VC 节点**双向同步**：读取 VC 机位 → 编辑 → 写回 VC 机位
- 支持增删改：新增 Frame 自动创建 VC 节点，删除 Frame 自动删除 VC 节点

### 场景结构

CameraFrameController 组件挂载在 **EditorTackleStage** 场景中，与 **RuntimeStage** 场景（包含 ShowcaseCamera）以 Additive 方式同时加载，共享 Hierarchy。

```
EditorTackleStage（编辑器场景）
  └── CameraFrameController       ← 编辑工具组件
        ├── CameraFrameTemplateRoot
        │     └── CameraFrameTemplate   ← 球体模板（不可见）
        └── FrameRoot                    ← 编辑用球体的父节点

RuntimeStage（运行时场景，Additive 加载）
  └── Pfb_ShowcaseCamera
        └── ShowcaseMode               ← ShowcaseModeComponent
              ├── VC_FullBody           ← VisualCamera 节点
              ├── VC_HalfBody
              └── VC_HeadCloseup
```

### 操作流程

#### 1. 开启编辑器

1. 打开 EditorTackleStage 场景
2. 确保 RuntimeStage 场景已 **Additive 加载**（包含 ShowcaseCamera）
3. 在 Hierarchy 中选中 `CameraFrameController` 节点
4. Inspector 中点击 **"开始监听"** 按钮

#### 2. 从 ShowcaseCamera 读取机位

点击 **"Showcase → Frame（读取机位）"** 按钮：

- 工具自动扫描 ShowcaseMode 下所有 VC 子节点
- 读取每个 VC 的 `DirectPoseModuleComponent` 中的 Position 和 RotationEuler
- 为每个 VC 生成一组编辑球体（CameraPosition + LookAt）
- **覆盖**当前 CameraFrame 列表（会弹出确认对话框）

#### 3. 编辑机位

在 Scene View 中：
- **蓝色球体** = 相机位置（CameraPosition），拖拽移动相机
- **绿色球体** = 看向位置（LookAt），拖拽调整相机朝向
- 两球之间有连线，直观显示相机视线方向

Inspector CameraFrame 列表中可以：
- 修改 **机位名称**（m_frameName），名称即 VC 节点名
- 修改 **描述**（m_desc）
- 点击 **"+"** 新增 CameraFrame
- 点击 **"-"** 删除 CameraFrame

#### 4. 写入到 ShowcaseCamera

点击 **"Frame → Showcase（写入机位）"** 按钮，执行完整同步：

| 操作 | 条件 | 行为 |
|------|------|------|
| **新增** | Frame 中有，VC 中无 | 自动创建 VC 节点（含 VisualCameraComponent + DirectPoseModule + ShowcaseAutoFitModule + CompositionModule） |
| **更新** | 名称匹配 | 更新 DirectPoseModule 的 Position 和 RotationEuler |
| **删除** | VC 中有，Frame 中无 | 删除 VC 节点（支持 Ctrl+Z 撤销） |

> **注意**：写入后需要 **Ctrl+S 保存场景**，否则修改不会持久化到 Prefab。

#### 5. 按钮显示规则

CameraFrameController Inspector 根据场景类型**自动切换**按钮：

| 场景类型 | 检测条件 | 显示按钮 |
|----------|----------|----------|
| Showcase 场景 | `FindObjectOfType<ShowcaseModeComponent>()` 找到 | **读取机位** + **写入机位** |
| 钓具组装场景 | 未找到 ShowcaseModeComponent | **保存数据**（导出到 TackleAssembleUISettingsSO） |

### CameraFrame 与 VC 节点的对应关系

```
CameraFrameController                     ShowcaseMode
┌──────────────────────┐                   ┌──────────────────────────┐
│ CameraFrame[0]       │   ←  同步  →     │ VC 子节点 "VC_FullBody"  │
│   m_frameName        │   ←  名称匹配 →  │   VisualCameraComponent  │
│   m_cameraPosition   │   →  写入  →     │   DirectPoseModule       │
│   m_lookAtPosition   │   →  计算旋转 →  │     .Position            │
│                      │                   │     .RotationEuler       │
├──────────────────────┤                   ├──────────────────────────┤
│ CameraFrame[1]       │   ←  同步  →     │ VC 子节点 "VC_HalfBody"  │
└──────────────────────┘                   └──────────────────────────┘
```

---

## 八、StageActor 观察点配置

ShowcaseCamera 的 AutoFit 模块可以根据 StageActor 提供的**命名观察点**自动计算相机距离。详细说明参见 [StageActor ObservationPoint 使用手册](StageActor_ObservationPoint_Usage.md)，此处为快速概要。

### 观察点注册

StageActor 通过继承 `StageActorBase`（实现 `IObservationPointProvider` 接口）注册观察点，在 `ObservationPointsRegister()` 中完成：

```csharp
public override void ObservationPointsRegister()
{
    // 固定偏移模式：位置和尺寸在注册时确定
    ObservationPointRegister("FullBody", StageActorObservationPointMode.LocalOffset,
        localCenter: new Vector3(0, 0.9f, 0),
        localSize: new Vector3(0.5f, 1.8f, 0.5f));

    // 动态模式：每次查询时实时计算
    ObservationPointRegister("Head", StageActorObservationPointMode.Dynamic,
        dynamicResolver: () =>
        {
            var headPos = m_controller.HeadWorldPositionGet();
            return new ObservationPointInfo(headPos, new Vector3(0.3f, 0.3f, 0.3f));
        });
}
```

### 三种注册模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| `LocalOffset` | 固定本地坐标偏移 | 全身/半身等不依赖骨骼的区域 |
| `BonePath` | 通过骨骼路径查找（带缓存） | 需要跟随骨骼但无直接引用时 |
| `Dynamic` | 运行时 `Func` 动态计算 | 需要实时计算的部位（头部、手部等） |

### VC 与观察点的关联

每个 VC 节点的 `VisualCameraComponent` 上有一个 `DefaultObservationPointName` 字段，填入观察点名称即可关联：

```
VC "HeadCloseup" 节点
  VisualCameraComponent
    m_defaultObservationPointName = "Head"   ← 关联到 StageActor 的 "Head" 观察点
  ShowcaseAutoFitModuleComponent
    m_autoFitMode = Capsule                  ← 基于观察点尺寸自动调距
```

### 观察点优先级链

```
请求 Override（运行时动态指定）
  ↓ 无则
VC 预配置（m_defaultObservationPointName）
  ↓ 无则
ObservationCenterGet()（Actor 几何中心兜底）
```

### 常见陷阱

- **骨骼引用指向 Mesh 节点而非骨骼节点**：骨骼动画下 Mesh 节点坐标始终为 (0,0,0)，必须指向 Skeleton 的骨骼节点
- **换装后骨骼位置归零**：`AvatarPartApply()` 后需调用 `ForceUpdateAnimator()` 重新评估动画，否则骨骼坐标为初始绑定姿态的零位

---

## 九、StageActorViewUIController 接口

`StageActorViewUIController` 提供了封装好的高层接口，UITask / Tofu 层通过这些接口控制 ShowcaseCamera，无需直接操作底层 `CameraControllerV2` 或 `ShowcaseModeComponent`。

### 机位切换

```csharp
// 按名称切换（推荐）
bool success = stageActorViewUICtrl.CameraSwitchTo("VC_HeadCloseup");

// 按索引切换
bool success = stageActorViewUICtrl.CameraSwitchTo(0);
```

**内部逻辑**：
1. 检查 V2 控制器是否已启用
2. 获取当前 Mode，检查是否实现 `IVCSwitchable` 接口
3. 调用 `IVCSwitchable.SwitchTo()` 执行切换
4. 返回 `false` 并输出 Warning 日志，若 V2 未启用或当前 Mode 不支持切换

> `IVCSwitchable` 是通用接口，当前由 `ShowcaseModeComponent` 实现。未来其他 Mode 实现该接口后，`CameraSwitchTo` 无需修改即可支持。

### 相机控制接口一览

| 方法                                                    | 说明                   |
| ----------------------------------------------------- | -------------------- |
| `CameraSwitchTo(string vcName)`                       | 按名称切换 VC 机位          |
| `CameraSwitchTo(int index)`                           | 按索引切换 VC 机位          |
| `CameraReset()`                                       | 重置相机到初始状态            |
| `CameraResetAndReinitializeTarget()`                  | 重置并重新初始化目标（使用当前适配模式） |
| `CameraResetAndReinitializeTarget(CameraAutoFitMode)` | 重置并以指定适配模式初始化目标      |
| `CameraZoom(float zoom)`                              | 缩放相机（正值拉近，负值拉远）      |
| `CameraRotate(Vector3 rot)`                           | 旋转相机                 |
| `EnableV2Controller(GameObject modesPrefab)`          | 启用 V2 相机控制器          |
| `DisableV2Controller()`                               | 禁用 V2 控制器，回退旧版       |
| `GetV2Controller()`                                   | 获取 V2 控制器接口（高级用法）    |
| `StageActorDisplay(IStageActor)`                      | 展示 Actor 并绑定相机目标     |
| `StageActorCleanup(IStageActor)`                      | 清理 Actor 并解绑相机       |

### 典型用例：Showcase 场景中切换机位

```csharp
// Tofu 中切换机位
private void OnHeadCloseupBtnClick()
{
    // 通过 Controller 接口切换，无需关心底层 Mode 类型
    m_stageActorViewUICtrl.CameraSwitchTo("VC_HeadCloseup");
}

private void OnFullBodyBtnClick()
{
    m_stageActorViewUICtrl.CameraSwitchTo("VC_FullBody");
}
```

---

## 十、相关文档

| 文档 | 说明 |
|------|------|
| [StageActor ObservationPoint 使用手册](StageActor_ObservationPoint_Usage.md) | 观察点注册/配置的完整说明 |
| [ShowcaseCamera 设计文档](ShowcaseCamera_Design.md) | ShowcaseCamera 架构设计 |
| [ObservationPoint AutoFit 设计](ObservationPoint_AutoFit_Design.md) | AutoFit 与观察点联动的设计方案 |
| [CameraFrame → ShowcaseCamera 方案](CameraFrame2ShowcaseCamera_Plan.md) | CameraFrameController 同步功能的实现方案 |
