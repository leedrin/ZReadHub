# UITask 系统说明与使用指南

## 1. 概述

`UITask` 系统是 `BJFramework.Runtime.UI` 模块的核心组成部分，它提供了一套高度模块化、组件化和可扩展的 UI 管理框架。该系统旨在解决复杂 UI 场景下的生命周期管理、资源加载、状态维护和流程控制等问题，确保 UI 系统的健壮性、灵活性和可维护性。

其核心思想是将每一个独立的 UI 界面或功能模块封装为一个 `UITask`，并通过一套精密的组件和管线机制来管理其从创建到销毁的整个生命周期。

## 2. 核心概念

*   **`UITaskBase`**: 所有 UI 任务的抽象基类。它定义了 UI 任务的生命周期（`OnCreate`, `OnStart`, `OnResume`, `OnPause`, `OnDestroy`），并作为各种 `UITaskCompXxx` 组件的宿主。
*   **`UIManager`**: UI 系统的中枢。负责 `UITask` 的创建、销毁、任务栈管理、生命周期调度和 UI 层级协调。
*   **`UIIntent`**: UI 任务的启动参数封装。类似于 Android 的 `Intent`，它包含了启动一个 `UITask` 所需的所有信息，如目标 `UITask` 的 ID、传递的数据、启动模式等。
*   **`UIProcess`**: UI 操作的原子性步骤或阶段。它封装了 UI 任务在特定阶段需要执行的具体操作，如资源加载、UI 实例化、动画播放等。`UIProcess` 由更新管线调度执行。
*   **`Tofu` (通过 `UITaskCompTofuBase` 实现)**: `UITaskBase` 内部的可插拔、可扩展的功能模块。它是一个高度抽象的概念，代表了 `UITask` 内部的“功能单元”或“行为单元”，能够深度参与到 `UITask` 的更新管线和生命周期管理中。

## 3. 组件化设计 (`UITaskCompXxx`)

`UITaskBase` 采用**组合模式**，通过一系列 `UITaskCompXxx` 组件来扩展其功能。每个组件都职责单一，共同构建了 `UITaskBase` 的完整功能。

*   **`UITaskCompBasicInfo`**: 管理 `UITask` 的基本元数据，如标签（Tag）和显示模式（Mode），便于 `UIManager` 进行查询和过滤。
*   **`UITaskCompLifecycleManager`**: `UITask` 生命周期的协调者。它不直接实现 UI 逻辑，而是负责在 `UITask` 的不同生命周期阶段协调和调用其他相关组件的方法，并驱动更新管线的启动。
*   **`UITaskCompUpdatePipelineManager`**: `UITask` 更新管线的管理者。负责创建、启动和管理更新管线实例，处理管线启动队列，确保 UI 更新的顺序性和健壮性。
*   **`UITaskCompDynamicResourceCacheManager`**: 管理 `UITask` 实例特有的动态资源的加载和缓存。它与全局 `ResourceManager` 协同，但专注于 `UITask` 级别的资源生命周期。
*   **`UITaskCompUIControllerManager`**: 管理 `UITask` 内部的所有 `UIControllerBase` 实例。它根据预定义的描述来创建、初始化和管理这些控制器，实现 UI 逻辑与视图的解耦。
*   **`UITaskCompLayerManager`**: 管理 `UITask` 所拥有的所有 UI 层级（Layer）。它根据预定义的 `LayerDesc` 来加载、管理和操作这些层级，控制 UI 的显示顺序和层级关系。
*   **`UITaskCompSnapshotManager`**: 负责 `UITask` 的状态快照管理。它允许 `UITask` 在被暂停或切换时保存当前状态，并在需要时恢复，支持可返回的 UI 流程。
*   **`UITaskCompSubUITaskManager`**: 管理 `UITask` 内部的子 `UITask`。它允许一个 `UITask` 启动并管理其他 `UITask`，形成父子关系，并在父 `UITask` 暂停或停止时，自动暂停或停止其子 `UITask`。
*   **`UITaskCompTofuManager`**: 管理 `UITask` 内部的所有 `UITaskCompTofuBase` 实例。它是 `UITask` 与其内部 Tofu 组件之间的桥梁，负责 Tofu 组件的注册、查询和生命周期事件分发。
*   **`UITaskCompCoroutine`**: 负责管理 `UITask` 内部的协程，使得 `UITask` 可以方便地启动和停止异步操作。
*   **`UITaskCompUIInputManager`**: 负责处理 `UITask` 相关的输入事件，并管理全局 UI 输入的阻塞。
*   **`UITaskCompUIIntentInfo`**: 存储和管理 `UITask` 启动时接收到的 `UIIntent` 信息。

## 4. 生命周期管理

`UITask` 的生命周期由 `UITaskCompLifecycleManager` 协调，并通过 `UITaskCompUpdatePipelineManager` 驱动更新管线来完成具体操作。

*   **`OnCreate()`**: `UITask` 实例被创建时调用，进行基本初始化。
*   **`PrepareForStartOrResume()`**: 在 `UITask` 真正启动或恢复前执行的异步准备阶段（例如，网络请求）。如果准备失败，`UITask` 不会启动。
*   **`OnStart()`**: `UITask` 启动时调用。`UITaskCompLifecycleManager` 会在此阶段启动更新管线，驱动 UI 的加载、初始化和显示。
*   **`OnPause()`**: `UITask` 被暂停时调用（例如，被其他 UI 覆盖）。会暂停子 `UITask`，清理输入阻塞，取消协程和 `UIProcess`，并隐藏视图。
*   **`OnResume()`**: `UITask` 从暂停状态恢复时调用。会启动更新管线，驱动 UI 的恢复和显示。
*   **`OnNewIntent()`**: 运行中的 `UITask` 接收到新的 `UIIntent` 时调用。会启动更新管线，驱动 UI 根据新 `Intent` 更新。
*   **`OnDestroy()`**: `UITask` 被彻底销毁时调用。会停止所有子 `UITask`，清理所有资源（Layer、动态资源、`UIController`），并释放相关句柄。

## 5. 更新管线 (Update Pipeline)

更新管线是驱动 `UITask` 状态变化的核心机制，由 `UITaskCompUpdatePipelineManager` 管理，并由 `UITaskUpdatePipelineBase` 实例执行。

*   **启动**: `UITaskCompLifecycleManager` 在 `OnStart`, `OnResume`, `OnNewIntent` 等生命周期方法中，会调用 `UITaskCompUpdatePipelineManager.UpdatePipelineLaunch()` 来启动更新管线。
*   **`UITaskUpdatePipelineInitInfo`**: 封装了管线启动所需的所有信息，包括 `UIIntent` 中的数据、快照、启动类型等。
*   **管线排队**: `UITaskCompUpdatePipelineManager` 支持管线启动队列。如果当前有管线正在运行，新的管线请求会被加入队列，等待当前管线执行完毕后按序执行，避免并发冲突。
*   **异步执行**: 更新管线本身是一个协程，可以异步执行，确保 UI 流程的流畅性。
*   **阶段**: 更新管线通常包含以下阶段（由 `UITaskCompTofuBase` 的 `IUITaskTofu4Pipeline` 接口参与）：
    *   **上下文设置**: `UpdateContextSetup()`
    *   **数据缓存更新**: `DataCacheUpdateIsNeededCheck()`, `DataCacheUpdate()`
    *   **Layer 加载**: `LayerLoadIsNeededCheck()`, `LayerDescCollect4Load()` (通过 `UITaskCompLayerManager` 执行)
    *   **动态资源加载**: `DynamicResLoadIsNeededCheck()`, `DynamicResCollect4Load()` (通过 `UITaskCompDynamicResourceCacheManager` 执行)
    *   **视图更新**: `ViewUpdate()` (UI 实例化、控件绑定等，通过 `UITaskCompUIControllerManager` 协助)
    *   **后续处理**: `PostViewUpdate()`, `PostUpdatePipelineCompleted()`

## 6. 资源管理

*   **全局 `ResourceManager`**: 负责整个项目的通用资源加载。
*   **`UITaskCompDynamicResourceCacheManager`**: 负责 `UITask` 实例特有的动态资源的加载和缓存。它会调用全局 `ResourceManager` 进行实际加载，并管理 `UITask` 内部资源的生命周期，在 `UITask` 销毁时进行清理。

## 7. UI 控制

*   **`UIControllerBase`**: 负责管理 UI 界面上的特定区域或一组控件的逻辑。它通常不继承 `MonoBehaviour`，而是通过 `UITaskCompUIControllerManager` 附加到 UI `GameObject` 上。
*   **`UITaskCompUIControllerManager`**: 根据预定义的 `UIControllerDesc` 来创建、初始化和管理 `UIControllerBase` 实例，并负责将 `UIController` 与 UI 控件进行绑定。

## 8. 层级管理

*   **`UITaskCompLayerManager`**: 管理 `UITask` 所拥有的所有 UI Layer。它负责 Layer 的加载、获取、设置到场景 Layer Stack 中，以及 Layer 的清理和隐藏。
*   **`SceneLayerBase`**: 实际的 UI Layer 对象，通过 `SceneManager` 创建和管理。

## 9. 状态管理

*   **`UITaskCompSnapshotManager`**: 提供 `UITask` 状态的保存和恢复功能。
*   **`IUITaskSnapshotItemSource`**: 接口，允许 `UITask` 内部的组件（如 `UITaskCompTofuBase`）贡献自己的状态到快照中，并在恢复时应用。

## 10. 嵌套 UI

*   **`UITaskCompSubUITaskManager`**: 允许一个 `UITask` 启动并管理其他 `UITask` 作为其子任务。它维护父子 `UITask` 之间的生命周期关联，并在父 `UITask` 暂停或停止时，自动暂停或停止子 `UITask`。

## 11. 使用方法 (高层级工作流)

1.  **定义 `UITask`**: 创建一个继承自 `UITaskBase` 的类，实现其生命周期方法。
2.  **定义 `UIController`**: 创建继承自 `UIControllerBase` 的类，管理 UI 视图的逻辑和控件绑定。
3.  **配置 `LayerDesc` 和 `UIControllerDesc`**: 在 `UITask` 的构造函数或初始化阶段，提供 `LayerDesc` 和 `UIControllerDesc` 数组，描述 `UITask` 需要哪些 Layer 和 `UIController`。
4.  **注册 `UITask`**: 在游戏启动时，通过 `ProjectGoUITaskRegister` 将 `UITaskId` 与 `UITask` 类型进行关联，注册到 `UIManager`。
5.  **启动 `UITask`**: 通过 `UIManager.Instance.StartUITask(new UIIntent(...))` 启动一个 `UITask`。
6.  **处理生命周期**: `UITaskCompLifecycleManager` 会自动协调 `UITask` 的生命周期，并驱动更新管线。
7.  **定制更新行为**: 如果需要更精细的控制，可以创建继承自 `UITaskCompTofuBase` 的组件，并实现 `IUITaskTofu4Pipeline` 和 `IUITaskTofu4Lifecycle` 接口，参与到更新管线和生命周期中。
8.  **管理子 `UITask`**: 如果 `UITask` 需要管理其他 `UITask`，可以使用 `UITaskCompSubUITaskManager`。

## 12. 主要优势

*   **高内聚，低耦合**: 每个 `UITask` 封装了独立的 UI 逻辑，组件化设计进一步降低了模块间的耦合。
*   **精细的生命周期管理**: 通过 `UITaskCompLifecycleManager` 和 `UITaskCompTofuBase`，实现了对 UI 任务生命周期的精确控制。
*   **强大的流程控制**: 更新管线和 `UIProcess` 机制确保了 UI 操作的顺序性、可控性和健壮性，尤其是在异步加载和复杂状态转换时。
*   **高效的资源管理**: `UITaskCompDynamicResourceCacheManager` 实现了 `UITask` 级别的资源缓存和清理，优化了内存使用。
*   **灵活的 UI 结构**: 支持多 Layer、多 `UIController` 以及父子 `UITask` 嵌套，能够构建复杂的 UI 层次结构。
*   **可扩展性**: 组件化和接口驱动的设计使得系统易于扩展，可以轻松添加新的功能或替换现有实现。
*   **健壮性**: 考虑了并发、状态保存和恢复等复杂场景，提供了相应的解决方案。

---
