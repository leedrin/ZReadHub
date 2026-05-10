# ShowcaseDebugUITask 设计方案

## 一、概述

### 1.1 目标

在 DebugMenu 中新增一个 **Showcase 调试入口**，用于在运行时快速调试各 Showcase 场景（Fish、Fishman、Item、Tackle），支持：

- 场景切换（StagePreset）
- 相机调试（多机位切换、观察点切换、AutoFit）
- StageActor 调试（创建/切换 Actor、观察点查看）
- 参数化配置（通过 DebugMenu 面板选择场景和调试参数）

### 1.2 设计原则

- 遵循 **EFUITask 项目规范**：UITask（Facade）→ MainTofu（业务逻辑）→ Controller（纯 UI）
- 复用现有 **StageActorViewUITask** 基础设施，不重复造轮子
- 通过 **DebugMenu 标准注册方式**（`s_debugUITaskConfigs` + `UITaskDebugParamConfig`）接入
- 相机调试通过 **ICameraControllerV2** 和 **IVCSwitchable** 能力接口统一操作

---

## 二、整体架构

```
┌─────────────────────────────────────────────────────────┐
│                  UITaskDebugWindow                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │  ShowcaseDebugParamConfig (Editor)                │  │
│  │  - 场景选择 (StagePreset Popup)                   │  │
│  │  - Actor 类型 / ConfigID 输入                     │  │
│  │  - 相机调试开关                                    │  │
│  └──────────────┬────────────────────────────────────┘  │
│                 │ ApplyParams → UIIntentCustom           │
└─────────────────┼───────────────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────────────┐
│            StageActorViewUITask (复用)                    │
│  ┌─────────────────────────────────────────────────┐    │
│  │  MainTofu                                       │    │
│  │  - 场景加载 (StagePreset)                        │    │
│  │  - Actor 创建/销毁                               │    │
│  │  - 相机初始化                                    │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Controller                                     │    │
│  │  - CameraSwitchTo(vcName/index)                 │    │
│  │  - Actor 旋转/拖拽                               │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 核心设计决策

**复用 StageActorViewUITask，不新建独立 UITask。** 理由：

1. StageActorViewUITask 已具备完整的场景加载、Actor 管理、相机控制能力
2. 通过 IntentParamKeys 可以灵活配置场景和 Actor 参数
3. 新建 UITask 会重复大量基础设施代码，违反 DRY 原则
4. Debug 功能的差异化需求通过 **自定义 UITaskDebugParamConfig** 在 Editor 面板侧实现

---

## 三、DebugMenu 注册

### 3.1 s_debugUITaskConfigs 入口

在 `UITaskDebugWindow.cs` 的 `s_debugUITaskConfigs` 数组中新增：

```csharp
new UITaskDebugEntry
{
    m_taskType = typeof(StageActorViewUITask),
    m_simpleParams = new[]
    {
        new DebugParamDescriptor
        {
            m_label = "StagePreset",
            m_intentKey = StageActorViewUITask.IntentParamKey4StagePreset,
            m_type = DebugParamType.String,
            m_value = StagePresets.FishStage,
        }
    }
}
```

### 3.2 s_uitaskDebugParamConfigDict 注册

```csharp
{ typeof(StageActorViewUITask), new ShowcaseDebugParamConfig() }
```

---

## 四、ShowcaseDebugParamConfig 设计

### 4.1 类定义

```
文件路径：Assets/GameProject/Scripts/Editor/DebugSettings/DebugMenu/ShowcaseDebugParamConfig.cs
命名空间：BlackJack.ProjectEF.Editor
```

```csharp
public class ShowcaseDebugParamConfig : UITaskDebugWindow.UITaskDebugParamConfig
{
    public override Type TaskType => typeof(StageActorViewUITask);

    // --- GUI 状态 ---
    private int m_selectedPresetIndex = 0;
    private string m_configId = "";
    private bool m_actorDragEnabled = true;
    private bool m_cameraControlEnabled = true;

    // --- 相机调试状态 ---
    private bool m_cameraFoldout = false;
    private int m_selectedVCIndex = 0;
    private string m_vcNameInput = "";

    // --- 常量 ---
    private static readonly string[] s_presetNames =
    {
        "FishStage",
        "FishmanStage",
        "ItemStage",
        "TackleStage",
        "FishmanHeadIconStage",
        "FishmanPlayerInformationStage"
    };

    private static readonly string[] s_presetValues =
    {
        StagePresets.FishStage,
        StagePresets.FishmanStage,
        StagePresets.ItemStage,
        StagePresets.TackleStage,
        StagePresets.FishmanHeadIconStage,
        StagePresets.FishmanPlayerInformationStage
    };
}
```

### 4.2 OnGUI 面板布局

```
┌─ Showcase Debug ──────────────────────────┐
│                                           │
│  场景选择: [FishStage        ▼]           │
│  ConfigID: [__1001__________]             │
│  ☑ 拖拽旋转    ☑ 相机控制                 │
│                                           │
│  ▶ 相机调试 ─────────────────             │
│  │  机位名称: [VC_Default____]            │
│  │  [按名称切换]  [按索引切换]             │
│  │  索引: [0]                             │
│  │  [触发 AutoFit]                        │
│  │                                        │
│  ▶ Actor 调试 ────────────────            │
│  │  [刷新 Actor]                          │
│  │  [打印观察点列表]                       │
│                                           │
└───────────────────────────────────────────┘
```

### 4.3 OnGUI 实现要点

```csharp
public override void OnGUI()
{
    EditorGUILayout.LabelField("Showcase Debug", EditorStyles.boldLabel);

    // 1. 场景选择
    m_selectedPresetIndex = EditorGUILayout.Popup("场景选择", m_selectedPresetIndex, s_presetNames);

    // 2. ConfigID 输入
    m_configId = EditorGUILayout.TextField("ConfigID", m_configId);

    // 3. 交互开关
    m_actorDragEnabled = EditorGUILayout.Toggle("拖拽旋转", m_actorDragEnabled);
    m_cameraControlEnabled = EditorGUILayout.Toggle("相机控制", m_cameraControlEnabled);

    // 4. 相机调试折叠区
    m_cameraFoldout = EditorGUILayout.Foldout(m_cameraFoldout, "相机调试");
    if (m_cameraFoldout)
    {
        EditorGUI.indentLevel++;
        DrawCameraDebugSection();
        EditorGUI.indentLevel--;
    }

    // 5. Actor 调试折叠区
    m_actorFoldout = EditorGUILayout.Foldout(m_actorFoldout, "Actor 调试");
    if (m_actorFoldout)
    {
        EditorGUI.indentLevel++;
        DrawActorDebugSection();
        EditorGUI.indentLevel--;
    }
}
```

### 4.4 ApplyParams 实现

```csharp
public override void ApplyParams(UIIntentCustom intent)
{
    intent.SetParam(StageActorViewUITask.IntentParamKey4StagePreset,
                    s_presetValues[m_selectedPresetIndex]);
    intent.SetParam(StageActorViewUITask.IntentParamKey4ActorDragEnabled,
                    m_actorDragEnabled);
    intent.SetParam(StageActorViewUITask.IntentParamKey4CameraControlEnabled,
                    m_cameraControlEnabled);
}
```

### 4.5 相机调试方法

```csharp
private void DrawCameraDebugSection()
{
    m_vcNameInput = EditorGUILayout.TextField("机位名称", m_vcNameInput);

    EditorGUILayout.BeginHorizontal();
    if (GUILayout.Button("按名称切换"))
    {
        // 获取运行时 Controller，调用 CameraSwitchTo(vcName)
        var ctrl = FindRunningController();
        ctrl?.CameraSwitchTo(m_vcNameInput);
    }

    m_selectedVCIndex = EditorGUILayout.IntField("索引", m_selectedVCIndex);
    if (GUILayout.Button("按索引切换"))
    {
        var ctrl = FindRunningController();
        ctrl?.CameraSwitchTo(m_selectedVCIndex);
    }
    EditorGUILayout.EndHorizontal();

    if (GUILayout.Button("触发 AutoFit"))
    {
        // 通过 CameraControllerV2 发起 AutoFitRequest
        var ctrl = FindRunningController();
        // ctrl.AutoFitRequest(...)
    }
}
```

### 4.6 Actor 调试方法

```csharp
private void DrawActorDebugSection()
{
    if (GUILayout.Button("刷新 Actor"))
    {
        // 重新启动 StageActorViewUITask 以刷新 Actor
    }

    if (GUILayout.Button("打印观察点列表"))
    {
        // 获取当前 StageActor 的 ObservationPoints
        // 输出到 Console
    }
}
```

### 4.7 运行时 Controller 获取

```csharp
private StageActorViewUIController FindRunningController()
{
    // 通过 UIManager 获取正在运行的 StageActorViewUITask
    // 从 Task 获取 Controller 引用
    // 返回 Controller 用于调用 CameraSwitchTo 等接口
    var task = UIManager.Instance.FindTask<StageActorViewUITask>();
    return task?.Controller as StageActorViewUIController;
}
```

---

## 五、数据流

### 5.1 启动流程

```
DebugMenu 点击 "启动"
    → ShowcaseDebugParamConfig.ApplyParams(intent)
        → intent.SetParam(StagePreset, "FishStage")
        → intent.SetParam(ActorDragEnabled, true)
        → intent.SetParam(CameraControlEnabled, true)
    → UIManager.StartUITask<StageActorViewUITask>(intent)
        → MainTofu.OnStart()
            → 加载 StagePreset 对应场景
            → 初始化 CameraControllerV2
            → 创建 StageActor（如需要）
```

### 5.2 相机调试流程

```
DebugMenu 面板点击 "按名称切换"
    → FindRunningController()
    → ctrl.CameraSwitchTo("VC_HeadCloseup")
        → m_cameraControllerV2.VCSwitchTo("VC_HeadCloseup")
            → CurrentMode as IVCSwitchable
            → switchable.SwitchTo("VC_HeadCloseup")
                → ShowcaseModeComponent 切换 VisualCamera
```

### 5.3 场景切换流程

```
DebugMenu 面板切换 StagePreset
    → 重新 ApplyParams + 重启 StageActorViewUITask
    → MainTofu 卸载旧场景 → 加载新场景
    → 重新初始化相机和 Actor
```

---

## 六、文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `ShowcaseDebugParamConfig.cs` | **新建** | DebugMenu 参数配置面板 |
| `UITaskDebugWindow.cs` | **修改** | 添加注册入口（s_debugUITaskConfigs + s_uitaskDebugParamConfigDict） |

> 不需要新建 UITask / Tofu / Controller，完全复用 StageActorViewUITask 现有体系。

---

## 七、功能矩阵

| 功能 | 实现方式 | 依赖 |
|------|----------|------|
| 场景切换 | IntentParamKey4StagePreset → MainTofu 加载场景 | StagePresets, StagePresetPaths |
| 多机位切换（名称） | Controller.CameraSwitchTo(string) | ICameraControllerV2.VCSwitchTo, IVCSwitchable |
| 多机位切换（索引） | Controller.CameraSwitchTo(int) | ICameraControllerV2.VCSwitchTo, IVCSwitchable |
| 观察点查看 | 读取 StageActor.ObservationPoints | StageActor 子类实现 |
| AutoFit 触发 | Controller → CameraControllerV2.AutoFitRequestApply | ICameraAutoFitCapability |
| Actor 拖拽旋转 | IntentParamKey4ActorDragEnabled | StageActorViewUIController |
| Actor 刷新 | 重启 Task 或 MainTofu 重建 Actor | MainTofu 生命周期 |
| ConfigID 输入 | 自定义参数传递给 StageActor 创建 | StageActor InfoProvider |

---

## 八、扩展点

### 8.1 后续可扩展方向

1. **观察点可视化**：在 DebugMenu 面板列出当前 Actor 所有观察点名称，点击即切换
2. **相机参数实时调整**：在面板中暴露 rotation、distance 滑块，实时修改 InitialState
3. **Actor 批量对比**：同时加载多个 ConfigID 的 Actor 进行对比
4. **截图保存**：一键截取当前相机画面用于资产审核

### 8.2 与现有系统的关系

- **StageActorViewUITask**：作为承载 Task 被复用，不做修改
- **CameraControllerV2**：通过公开 API（VCSwitchTo, AutoFitRequestApply）被调用
- **DebugMenu 系统**：标准接入，遵循 UITaskDebugParamConfig 模式
- **StagePresets**：直接使用现有常量，不新增 Preset
