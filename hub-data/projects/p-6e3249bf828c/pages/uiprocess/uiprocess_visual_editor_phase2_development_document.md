# UIProcess 可视化编辑器补充功能开发文档 (阶段二)

## 1. 概述
在阶段一中，我们完成了 `UIProcess` 可视化编辑器的基础框架、数据模型和动画信息提取系统。然而，核心的运行时 `UIProcess` 构建和播放逻辑仍存在大量占位符。本阶段的目标是利用 `AdvanceUIStateController` 及其模块化设计，将可视化编辑器与运行时 UI 动画系统深度集成，实现真正的数据驱动 UI 流程播放。

## 2. 核心目标
1.  **完善运行时 `UIProcess` 构建：** 实现 `UIProcessBuilder` 中 `StateClipData` 和 `LogicClipData` 的实际 `UIProcess` 生成逻辑。
2.  **集成 `AdvanceUIStateController`：** 使 `StateClip` 能够触发 `AdvanceUIStateController` 的状态切换，并正确处理其回调。
3.  **实现高级控制流：** 完善 `ControlClip` (Loop, Jump) 的运行时逻辑。
4.  **提升编辑器体验：** 增加 `Undo/Redo` 支持和更友好的参数编辑界面。

## 3. 详细设计

### 3.1 运行时 `UIProcess` 构建增强

#### 3.1.1 `StateClip` 与 `CommonUIStateEffectProcess` 的集成
-   **目标：** 当 `StateClipData` 被解析时，应生成一个能够调用 `AdvanceUIStateController.SetToUIState()` 的 `UIProcess`。
-   **实现方案：**
    1.  **创建 `UIStateEffectProcess` (新类或修改现有)：**
        -   该 `UIProcess` 子类需要持有 `AdvanceUIStateController` 的引用和目标 `StateName`。
        -   在 `OnStart()` 方法中，调用 `AdvanceUIStateController.SetToUIState(stateName, immediateComplete, ..., onEnterStateFinished)`。
        -   `onEnterStateFinished` 回调用于通知 `UIStateEffectProcess` 完成，进而驱动整个 `UIProcess` 树的进展。
        -   需要处理 `WaitForCompletion` 字段，如果为 `false`，则在调用 `SetToUIState` 后立即完成 `UIStateEffectProcess`。
    2.  **修改 [`UIProcessBuilder.BuildClip()`](Assets/BJFramework/Script/Runtime/UI/UIProcessVisual/UIProcessBuilder.cs:97)：**
        -   当 `clip is StateClipData stateClip` 时，不再返回 `DelayProcess`。
        -   而是创建 `UIStateEffectProcess` 实例，并传入 `stateClip.StateName`、`stateClip.WaitForCompletion` 以及从 `track.TargetControllerName` 解析得到的 `AdvanceUIStateController` 实例。

#### 3.1.2 `LogicClip` 与 `ExecutorProcess` 的集成
-   **目标：** `LogicClipData` 应能够调用指定的 C# 方法或脚本。
-   **实现方案：**
    1.  **创建 `UIExecutorProcess` (新类或修改现有)：**
        -   该 `UIProcess` 子类需要持有 `MethodName`、`TargetTypeName` 和 `SerializableDictionary Parameters`。
        -   在 `OnStart()` 方法中，通过反射或预注册机制查找并执行指定类型上的方法，并传入参数。
        -   方法执行完成后，通知 `UIExecutorProcess` 完成。
    2.  **修改 [`UIProcessBuilder.BuildClip()`](Assets/BJFramework/Script/Runtime/UI/UIProcessVisual/UIProcessBuilder.cs:109)：**
        -   当 `clip is LogicClipData logicClip` 时，不再返回 `DelayProcess`。
        -   而是创建 `UIExecutorProcess` 实例，并传入 `logicClip.MethodName`、`logicClip.TargetTypeName` 和 `logicClip.Parameters`。

#### 3.1.3 `AudioClip` 的集成
-   **目标：** `AudioClipData` 应能够播放音效。
-   **实现方案：**
    1.  **创建 `UIAudioProcess` (新类)：**
        -   该 `UIProcess` 子类需要持有 `AudioPath`、`Volume`、`Loop` 等信息。
        -   在 `OnStart()` 方法中，调用音频管理器播放音效。
        -   如果 `Loop` 为 `false`，则在音效播放完成后通知 `UIAudioProcess` 完成。
        -   如果 `Loop` 为 `true`，则 `UIAudioProcess` 持续播放，直到被 `Stop()`。
    2.  **修改 [`UIProcessBuilder.BuildClip()`](Assets/BJFramework/Script/Runtime/UI/UIProcessVisual/UIProcessBuilder.cs:114)：**
        -   当 `clip is AudioClipData audioClip` 时，创建 `UIAudioProcess` 实例。

#### 3.1.4 `ControlClip` (Loop, Jump) 的实现
-   **目标：** 实现 `ControlClipType.Loop` 和 `ControlClipType.Jump` 的运行时逻辑。
-   **实现方案：**
    1.  **`UIProcessDataAsset` 预处理：** 在 `UIProcessBuilder.Build()` 阶段，需要一个机制来解析 `SectionData`，并将其转换为运行时可寻址的“书签”或“时间点”。
    2.  **创建 `UILoopProcess` (新类)：**
        -   该 `UIProcess` 接收 `TargetSectionName` 和 `LoopCount`。
        -   在 `OnStart()` 中，根据 `LoopCount` 逻辑控制播放头的跳转。
    3.  **创建 `UIJumpProcess` (新类)：**
        -   该 `UIProcess` 接收 `TargetSectionName`。
        -   在 `OnStart()` 中，强制将播放头跳转到指定 `Section` 的开始时间。
    4.  **修改 [`UIProcessBuilder.BuildControlClip()`](Assets/BJFramework/Script/Runtime/UI/UIProcessVisual/UIProcessBuilder.cs:211)：**
        -   根据 `controlClip.ControlType` 返回对应的 `UILoopProcess` 或 `UIJumpProcess`。

### 3.2 `AdvanceUIStateController` 模块化能力的利用

`AdvanceUIStateController` 采用 `IUIStateModule` 的插件式设计，这与 `UIProcess` 的 `Clip` 概念高度契合。

1.  **`UIStateModuleTween` ([`UIStateModuleTween.cs`](Assets/BJFramework/Script/Runtime/UI/Extend/AdvanceUIStateController/UIStateModuleTween.cs:11))：**
    -   `StateClip` 的时长提取已由 `AnimationInfoExtractor` 处理。在运行时，`UIStateEffectProcess` 触发 `AdvanceUIStateController` 进入状态时，`UIStateModuleTween` 会自动播放其配置的 `TweenMain` 动画。
    -   **待完善：** 确保 `UIStateEffectProcess` 能够正确接收 `UIStateModuleTween` 的完成回调，以驱动 `UIProcess` 树的进展。

2.  **`UIStateModuleAnimator` ([`UIStateModuleAnimator.cs`](Assets/BJFramework/Script/Runtime/UI/Extend/AdvanceUIStateController/UIStateModuleAnimator.cs:12))：**
    -   同样，`StateClip` 触发状态后，`UIStateModuleAnimator` 会播放 `Animator` 动画。
    -   **待完善：** 确保 `UIStateEffectProcess` 能够正确接收 `UIStateModuleAnimator` 的完成回调 (通过 `OnAnimatorStateEnd`)。

3.  **`UIStateModuleAudio` ([`UIStateModuleAudio.cs`](Assets/BJFramework/Script/Runtime/UI/Extend/AdvanceUIStateController/UIStateModuleAudio.cs:10))：**
    -   目前 `UIStateModuleAudio` 是在 `StartState` 中立即完成的，不等待音效播放结束。
    -   **建议：** 如果 `AudioClip` 专门用于播放独立音效，可以考虑让 `UIAudioProcess` 直接调用音频管理器，而不是通过 `AdvanceUIStateController` 的 `UIStateModuleAudio`。如果 `AudioClip` 旨在与 `AdvanceUIStateController` 的状态同步，则需要修改 `UIStateModuleAudio` 以支持等待音效播放完成。

4.  **其他 `UIStateModule`s (如 `UIStateModuleGameObjectEnable`, `UIStateModuleGradientColor` 等)：**
    -   这些模块通常是即时生效的（如激活/禁用 GameObject，设置颜色），不需要等待动画完成。
    -   `UIStateEffectProcess` 在触发 `AdvanceUIStateController` 状态后，这些模块的效果将立即应用，无需额外处理。

## 3.3 编辑器功能增强

#### 3.3.1 `Undo/Redo` 支持
-   **目标：** 所有对 `UIProcessDataAsset` 的修改（添加/删除/移动 Clip/Track, 修改属性等）都应支持 `Undo/Redo`。
-   **实现方案：** 在 [`UIProcessEditorWindow.cs`](Assets/BJFramework/Script/Editor/UI/UIProcessVisual/UIProcessEditorWindow.cs:13) 中，每次修改数据后，调用 `UnityEditor.Undo.RecordObject(m_currentAsset, "Operation Name")` 记录操作。

#### 3.3.2 运行时预览与 `AdvanceUIStateController` 联动
-   **目标：** `UIProcessEditorWindow` 的播放功能应能驱动场景中的 `AdvanceUIStateController` 实例进行实时预览。
-   **实现方案：**
    1.  **`UIProcessRuntimePlayer` 改造：**
        -   在 `Play()` 方法中，不再构建抽象的 `UIProcess` 树，而是直接根据 `m_asset` 中的 `ClipData` 模拟播放。
        -   当遇到 `StateClipData` 时，通过 `EditorUtility.FindObjectOfType<AdvanceUIStateController>()` 找到对应的 Controller，并调用其 `SetToUIState()` 方法。
        -   需要处理 `AdvanceUIStateController` 的回调，以模拟 `UIProcess` 的完成逻辑。
    2.  **编辑器模式下的 `AdvanceUIStateController`：** `AdvanceUIStateController` 已经有 `InitStateCtrl4EditorPreview()` 方法，这为编辑器预览提供了很好的基础。

#### 3.3.3 `LogicClip` 参数编辑器
-   **目标：** 在 `Inspector` 面板中为 `LogicClipData.Parameters` 提供一个可编辑的字典 UI。
-   **实现方案：**
    -   在 [`UIProcessEditorWindow.RefreshInspector()`](Assets/BJFramework/Script/Editor/UI/UIProcessVisual/UIProcessEditorWindow.cs:483) 中，为 `LogicClipData` 增加一个自定义的参数列表编辑器。
    -   可以使用 `UIElements` 的 `ListView` 或自定义 `VisualElement` 来显示和编辑键值对。

#### 3.3.4 资源引用优化
-   **目标：** 提高 `TargetControllerName` 引用的健壮性。
-   **实现方案：**
    -   在 `TrackData` 中，除了 `string TargetControllerName` 外，可以增加一个 `ObjectField` (仅 Editor 序列化) 来直接引用 `AdvanceUIStateController` 或 `CommonUIStateController`，并在保存时转换为 `string` 名称或 GUID。
    -   在加载时，优先尝试通过 GUID 或直接引用恢复，其次再使用名称查找。

#### 3.3.5 动画信息硬化 (Bake)
-   **目标：** 减少运行时对 `AnimationInfoExtractor` 的依赖，提高性能。
-   **实现方案：**
    -   在 `UIProcessDataAsset` 保存时，遍历所有 `StateClipData`，将 `AnimationInfo` 中提取出的 `Duration`、`Delay`、`IsLoop` 等关键信息直接序列化到 `StateClipData` 中，而不是只存储 `AnimationInfo` 引用。
    -   在运行时，优先使用硬化的数据。

## 4. 阶段二开发计划 (里程碑)

| 里程碑 | 任务 | 预计时间 | 负责人 |
|---|---|---|---|
| **M1: 运行时核心逻辑** | 1. 实现 `UIStateEffectProcess`，集成 `AdvanceUIStateController` | 2周 | 开发者 A |
| | 2. 实现 `UIExecutorProcess`，支持 `LogicClip` 方法调用 | 1周 | 开发者 B |
| | 3. 实现 `UIAudioProcess`，支持 `AudioClip` 播放 | 1周 | 开发者 C |
| **M2: 高级控制流** | 1. 实现 `UILoopProcess` 和 `UIJumpProcess` | 2周 | 开发者 A |
| | 2. `UIProcessBuilder` 完善 Section 数据解析与跳转逻辑 | 1周 | 开发者 B |
| **M3: 编辑器优化** | 1. `UIProcessEditorWindow` 添加 `Undo/Redo` 支持 | 1周 | 开发者 C |
| | 2. `LogicClip` 参数字典编辑 UI | 1周 | 开发者 A |
| | 3. 资源引用优化 (Asset 字段引用) | 0.5周 | 开发者 B |
| **M4: 性能与健壮性** | 1. 动画信息硬化 (Bake) 机制 | 0.5周 | 开发者 C |
| | 2. `UIProcessBuilder.BuildSerialMode` 处理并发 Clip | 0.5周 | 开发者 A |
| **M5: 集成测试** | 复杂 UI 流程（撕卡包、鱼市等）集成测试 | 2周 | QA 团队 |

## 5. 总结
阶段二的开发将把 `UIProcess` 可视化编辑器从一个“骨架”提升为具备完整运行时能力的系统。通过与 `AdvanceUIStateController` 的深度集成，我们将能够充分利用其现有模块化优势，为美术和策划提供一个强大且灵活的 UI 流程编排工具。