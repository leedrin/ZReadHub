# UI管线劫持与协作规范

## 1. 概述

本文档定义了在项目UI框架中实现“管线劫持”（Pipeline Hijacking）的设计模式与编码规范。

“管线劫持”是一种**协作式的UI流程重定向机制**。它旨在通过非侵入性的方式，将通用的、可复用的UI功能（如通用设置面板、确认对话框、加载提示等）动态地插入到主UI任务流程中，从而实现高度模块化、可复用和易于维护的UI架构。

此模式的核心思想是**分离关注点**：主UI任务（`UITask`）应专注于其核心业务逻辑，而所有跨领域的、通用的UI交互则应由专门的管线（`Pipeline`）和子任务（Sub-Task）来管理。

## 2. 核心概念

- **`UITask` (UI任务)**: UI功能的基本单元，负责管理一个独立的UI界面或一个完整的UI流程（例如，角色对话、背包管理）。
- **`UITaskUpdatePipeline` (UI任务更新管线)**: 伴随`UITask`存在的辅助逻辑单元。它可以在`UITask`的更新循环中获得执行机会，用于“干预”或“协作”主任务的流程。
- **管线劫持 (Pipeline Hijacking)**: 指`UITaskUpdatePipeline`暂停其所属`UITask`的主流程，并将UI控制权临时移交给一个或多个由它启动和管理的子任务的过程。
- **`Intent` (意图)**: 一个数据结构，用于描述启动一个新`UITask`的“意图”，包含了目标任务类型和需要传递的参数。
- **劫持宿主 (Redirect Pipeline Host)**: 在启动子任务时，将一个`UITaskUpdatePipeline`实例指定为“宿主”。这意味着该管线将全权负责这个子任务的生命周期，并且在子任务结束前，主`UITask`流程将保持暂停。

## 3. 实现机制

管线劫持的实现遵循一个标准流程，以确保其稳定性和可预测性。

### 3.1. 继承与重写

所有用于实现劫持功能的管线都必须继承自 `UITaskUpdatePipelineDefault` 或其子类，并重写其核心的 `CooperativeUITaskUpdate()` 方法。

```csharp
public class MyCustomPipeline : UITaskUpdatePipelineDefault
{
    // ... 构造函数 ...

    protected override void CooperativeUITaskUpdate()
    {
        // 劫持逻辑在这里实现
    }
}
```

`CooperativeUITaskUpdate()` 是管线与主任务协作的唯一入口点，框架会在每个UI更新周期自动调用。

### 3.2. 条件触发

劫持逻辑不应无条件执行。必须在 `CooperativeUITaskUpdate()` 方法内部设置明确的触发条件，以确保只在需要时才激活劫持流程。

**规范**: 触发条件应优先基于主任务的当前模式（`Mode`）或状态（`State`）。

```csharp
protected override void CooperativeUITaskUpdate()
{
    // 1. 获取主任务的当前模式
    string currentMode = m_owner.CompBasicInfoGet().CurrModeGet();

    // 2. 根据模式判断是否需要执行劫持
    if (currentMode == TargetModeForHijacking)
    {
        // 3. 执行劫持
    }
    // 在其他模式下，直接返回，不干预主流程
}
```

### 3.3. 启动子任务与指定宿主

当触发条件满足时，管线必须执行以下步骤来完成劫持：

1.  **创建意图 (`Intent`)**: 为要启动的子任务创建一个`Intent`对象，并填充所有必要的参数。
2.  **增加重定向计数**: 在启动子任务前，必须对 `m_redirectPipelineWaitingCount` 成员变量进行递增操作。这是一个关键的计数器，用于追踪当前活动的劫持子任务数量。
3.  **启动子任务**: 调用 `m_compSubUITaskManager.SubUITaskStart()` 方法，并**必须将当前管线实例 (`this`) 作为 `redirectPipelineHost` 参数传入**。

```csharp
// 示例：启动一个通用控制面板子任务
var controlPanelIntent = CommonControlPanelUITask.CreateIntent(...);

// 关键步骤：增加等待计数
++m_redirectPipelineWaitingCount;

// 关键步骤：启动子任务并指定当前管线为劫持宿主
m_compSubUITaskManager.SubUITaskStart(controlPanelIntent, redirectPipelineHost: this);
```

当 `redirectPipelineHost` 被指定后，框架将自动暂停主`UITask`的流程。当子任务结束后，框架会自动递减 `m_redirectPipelineWaitingCount` 计数。只有当此计数器归零时，主`UITask`的流程才会恢复。

## 4. 编码规范与最佳实践

- **职责单一**: 每个管线应只负责一类相关的劫持逻辑。避免创建一个庞大而臃肿的“万能”管线。
- **封装子任务**: 被劫持启动的UI功能应被封装成独立的、可复用的`UITask`，并通过静态的`CreateIntent`方法提供清晰的启动接口。
- **明确触发**: 劫持的触发条件必须明确、无歧义，以防止意外的流程中断。
- **状态隔离**: 子任务不应直接修改主任务的内部状态。所有必要的通信应通过`Intent`参数传递或`PlayerContext`等全局状态进行。

## 5. 示例分析: `DialogUITaskPipeline`

[`DialogUITaskPipeline`](Dialog/Pipeline/DialogUITaskPipeline.cs) 是本规范的一个典型实现。

-   它重写了 [`CooperativeUITaskUpdate()`](Dialog/Pipeline/DialogUITaskPipeline.cs:29)。
-   它在方法内部检查`DialogUITask`的模式是否为 `ModeNpcDialog` 作为触发条件。
-   当条件满足时，它创建 `CommonControlPanelUITask` 的`Intent`。
-   它在调用 `SubUITaskStart` 时，正确地增加了 `m_redirectPipelineWaitingCount` 并将 `this` 作为 `redirectPipelineHost` 传入，从而将通用的控制面板功能模块化地插入到了对话流程中。

此设计使得 `DialogUITask` 无需关心控制面板的存在，而 `CommonControlPanelUITask` 也可以被其他任何需要此功能的`UITask`通过相似的管线进行复用。