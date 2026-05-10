# 功能需求文档：通用 UI Prefab 预览工具 (v2)

## 1. 背景与目标

### 1.1. 项目背景
当前UI开发流程中，对于包含 `AdvanceUIStateController` 的复杂 `UIPrefab`，其状态和动画效果的调试与验证过程较为繁琐。开发人员需要通过运行完整的业务 `UITask` 才能预览和测试UI状态机的表现，效率较低。

### 1.2. 项目目标
为了提升UI开发和调试效率，我们计划开发一个**通用的UI Prefab预览工具**。该工具旨在提供一个轻量、独立的运行时环境，允许开发人员快速加载任何 `UIPrefab`，并实时交互式地预览其内部所有 `AdvanceUIStateController` 的状态和动画，而无需启动完整的业务流程。

## 2. 功能性需求

### FR-01: 专用预览窗口
- **需求描述**: 系统应提供一个专用的编辑器窗口，命名为 `PrefabDebugWindow`，作为所有UI Prefab预览功能的统一入口。
- **验收标准**:
    - Unity 编辑器顶部菜单栏出现 "BlackJack/UI工具/Prefab 状态预览工具" 菜单项。
    - 点击该菜单项能够成功打开一个独立的、可停靠的 `PrefabDebugWindow` 窗口。

### FR-02: Prefab 选择与加载
- **需求描述**: 用户应能在 `PrefabDebugWindow` 窗口中指定一个 `UIPrefab`作为预览目标。
- **验收标准**:
    - 窗口内提供一个 `ObjectField`，允许用户通过拖拽或选择器的方式指定一个 `GameObject` 类型的 `UIPrefab`。
    - 当 `Prefab` 被选中后，窗口应能正确显示其资源路径。

### FR-03: (已修订) Prefab 扫描与信息收集
- **需求描述**: 当用户选择一个 `Prefab` 后，工具应能智能地扫描该 `Prefab`，并根据不同情况进行处理。
- **验收标准**:
    - **情况A：存在已绑定的描述文件**:
        - 工具通过复用 `DescFileChecker` 逻辑，成功识别并列出 `Prefab` 上已附加的描述文件组件。
        - 窗口清晰地展示识别出的描述文件，并以此为基础进行后续预览。
    - **情况B：不存在描述文件**:
        - 窗口应明确提示“未找到描述文件”。
        - 工具将直接扫描 `Prefab` 的层级结构，通过 `GetComponentsInChildren` 搜集所有的 `AdvanceUIStateController` 和滚动视图组件（`ScrollRect`, `LoopScrollRect`）。
        - 搜集到的状态机和滚动视图信息将被展示在 `PrefabDebugWindow` 中，供用户直接进行预览。
        - 窗口应提供一个“生成临时描述文件”的按钮。点击后，工具会根据当前扫描到的组件，动态生成一个临时的预览用描述文件，并将其作为组件添加到 `Prefab` 的根节点上。

### FR-04: 通用预览 `UITask` 的动态启动
- **需求描述**: 工具需提供一个“启动预览”功能，该功能将启动一个通用的 `UIPrefabPreviewUITask` 来加载并显示目标 `Prefab`。
- **验收标准**:
    - `PrefabDebugWindow` 中提供一个“启动预览”按钮。
    - 点击按钮后，系统将创建一个 `UIIntent`，并将目标 `Prefab` 的资源路径作为参数传入。
    - 系统通过 `UIManager.Instance.StartUITask(intent)` 成功启动 `UIPrefabPreviewUITask`。
    - 游戏运行时，目标 `Prefab` 的界面被正确加载并显示在屏幕上。

### FR-05: 状态机的动态获取与展示
- **需求描述**: `UIPrefabPreviewUITask` 在成功加载 `Prefab` 后，必须能够扫描并获取其内部所有的 `AdvanceUIStateController` 实例及其状态列表。
- **验收标准**:
    - `UIPrefabPreviewUITask` 的 `MainTofu` 组件在 `OnEventUIControllerLoadCompleted` 回调中，通过 `GetComponentsInChildren` 成功获取所有 `AdvanceUIStateController` 实例。
    - 获取到的状态机列表通过静态方法回调，被成功传递回 `PrefabDebugWindow`。
    - `PrefabDebugWindow` 在接收到列表后，动态刷新UI，为每一个 `AdvanceUIStateController` 创建一个专属的控制区域。
    - 每个控制区域都应显示该状态机的 `GameObject` 名称，并包含一个下拉菜单，菜单项为该状态机的所有可用状态名（`m_stateName` 列表）。

### FR-06: 状态实时切换与预览
- **需求描述**: 用户应能通过 `PrefabDebugWindow` 窗口的UI控件，实时控制运行时 `Prefab` 的状态切换。
- **验收标准**:
    - 当用户在 `PrefabDebugWindow` 的任一状态机下拉菜单中选择一个新状态时，对应的 `AdvanceUIStateController` 实例的 `SetToUIState()` 方法被正确调用。
    - 游戏画面中的 `Prefab` 能够立即响应，并播放对应的状态动画。
    - 支持在多个不同的 `AdvanceUIStateController` 之间独立、无冲突地切换状态。

### FR-07: (新增) 滚动视图预览支持
- **需求描述**: 工具需要支持对 `Prefab` 内的 `ScrollRect` 和 `LoopScrollRect` 组件进行预览，允许用户动态填充内容。
- **验收标准**:
    - `PrefabDebugWindow` 在扫描 `Prefab` 后，应能识别并列出所有的 `ScrollRect` 和 `LoopScrollRect` 组件。
    - 对于每一个识别出的滚动视图，窗口提供一个 `ObjectField`，允许用户拖入一个 `Item Prefab`。
    - 窗口提供一个输入框和一个“填充”按钮，用户可以指定要生成的 `Item` 数量。
    - 点击“填充”按钮后，预览中的滚动视图将被动态地填充指定数量的 `Item` 实例。
    - `LoopScrollRect` 的填充应能正确工作，支持循环滚动。

## 3. 非功能性需求

### NFR-01: 易用性
- **需求描述**: 工具界面应直观、简洁，操作流程符合Unity开发者的使用习惯。
- **验收标准**:
    - 主要功能（选择Prefab、启动预览、切换状态、填充列表）应在无需阅读文档的情况下即可完成。
    - 窗口提供必要的提示信息，引导用户操作。

### NFR-02: 性能
- **需求描述**: 预览工具的运行不应对Unity编辑器的性能产生显著影响。`UITask` 的加载和状态切换应保持流畅。
- **验收标准**:
    - `PrefabDebugWindow` 在非活动状态下不应占用额外CPU资源。
    - 启动预览 `UITask` 的过程应在合理的时间内完成。
    - 切换状态和填充大量列表项的响应时间应在可接受范围内。

### NFR-03: 健壮性
- **需求描述**: 工具应能妥善处理各种异常情况，如选择无效的 `Prefab`、`Item Prefab` 格式不正确、运行时错误等。
- **验收标准**:
    - 当用户选择无效对象时，系统给出友好提示。
    - 当 `Prefab` 启动或状态切换失败时，在控制台和窗口中打印清晰、有意义的错误日志。
    - 工具的异常不应导致Unity编辑器崩溃。

### NFR-04: 可维护性与扩展性
- **需求描述**: 新增的代码应遵循项目现有的 `BJFramework` 架构规范，易于理解和后续扩展。
- **验收标准**:
    - `UIPrefabPreviewUITask` 的实现严格遵循 `UITaskBase` 和 `UITaskCompTofuBase` 的设计模式。
    - 复用现有的 `DescFileChecker` 和 `ComponentCollector` 模块，避免重复造轮子。
    - 代码风格与项目现有代码保持一致。

## 4. 技术实现方案概要

- **创建新窗口**: `PrefabDebugWindow.cs`
- **创建通用 `UITask`**: `UIPrefabPreviewUITask.cs`
- **创建核心逻辑组件**: `UIPrefabPreviewMainTofu.cs`
- **复用现有模块**:
    - `DescFileChecker.cs` (用于识别已绑定的描述文件)
    - `ComponentCollector.cs` (用于在无描述文件时扫描组件)
    - `CodeGenerator.cs` (用于生成临时的预览用描述文件)
- **核心交互接口**:
    - `AdvanceUIStateController.SetToUIState()`
    - `ScrollRect.content.AddChild()` (伪代码，用于填充)
    - `LoopScrollRect.SetItemCount()` (伪代码，用于填充)