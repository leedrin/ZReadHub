# BJFramework UI 自动化中心 - GraphView 产品需求文档 (PRD)

## 1. 产品愿景

创建一个结合了强大底层代码生成能力、清晰 Tab 式细节编辑界面，以及直观 GraphView 全局依赖可视化视图的 BJFramework UI 自动化中心。

**核心策略**: 以 GraphView 作为全局导航和架构蓝图，以侧边栏 Inspector（复用现有 Tab UI 设计）作为具体节点的详细操作台。

## 2. 核心概念

### 2.1 图视图与检查器的协同

*   **GraphView (主视图)**: 提供宏观视角。
    *   **节点**: 代表资产或脚本，类型包括：`UI Prefab`, `UICtrlDesc`, `UIController`, `UITask`, `Tofu`。
    *   **连线**: 代表它们之间的引用和归属关系。
    *   **状态颜色**: 直观反映流水线的健康状态。
        *   🆕 **灰色**: 文件尚未生成或关联。
        *   ✅ **绿色**: 文件存在且与上下游同步。
        *   ⚠️ **黄色**: 文件存在，但检测到不一致（如 Prefab 新增组件，Desc 未更新）。
        *   ❌ **红色**: 存在严重错误（如命名冲突、文件丢失、编译错误）。

*   **Side Inspector (侧边栏检查器)**:
    *   **触发**: 在 GraphView 中选中某个节点时，侧边栏会动态切换显示该节点的详细信息和操作面板。
    *   **内容复用**: 面板的内容结构直接复用之前设计的 Tab 页面的功能模块（Prefab 分析、Controller 管理、Task 编排等）。

## 3. 功能需求

### 3.1 前置准备

| ID | 功能模块 | 功能描述 | 优先级 |
|-----|----------|----------|--------|
| P0 | 全局配置 | 提供统一的配置入口，用于设置代码模板路径、生成根目录、默认命名空间、BJFramework 基类名称、命名规范等。 | 高 |

**用户流程**:
1.  用户点击工具栏的 "Settings" 按钮。
2.  弹出配置窗口（复用现有 Settings Tab UI 设计）。
3.  用户进行配置并保存。
4.  工具将配置序列化到 `ToolConfig` ScriptableObject 中。

### 3.2 工作流 A：资源驱动

**适用场景**: 美术先提供了 UI Prefab，程序需要据此生成配套代码。

| ID | 功能模块 | 功能描述 | 优先级 |
|-----|----------|----------|--------|
| A1 | 导入 Prefab 节点 | 支持将 Project 窗口中的 UI Prefab 文件拖拽到 GraphView 画布上，创建对应的节点。 | 高 |
| A2 | 分析并生成 UICtrlDesc | 选中 Prefab 节点后，侧边栏显示 Prefab 分析面板，用户可配置并生成/更新关联的 `UICtrlDesc.cs`。 | 高 |
| A3 | 生成 UIController 存根 | 选中 `UICtrlDesc` 节点后，侧边栏显示 Controller 管理面板，用户可生成关联的 `UIController.cs` 骨架。 | 高 |
| A4 | 创建或归属到 UITask | 选中 `UIController` 节点后，侧边栏显示关联区域，用户可将其归属到现有 Task 或创建新 Task。 | 高 |

**用户流程**:
1.  **A1**: 用户将 Prefab 拖入 GraphView，创建一个橙色的 `[UI Prefab Node]`。
2.  **A2**: 选中该节点，在侧边栏分析 Prefab，点击 `[Generate/Update UICtrlDesc.cs]`。工具生成 `UICtrlDesc.cs`，并在图上创建蓝色的 `[UICtrlDesc Node]`，同时创建从 Prefab 指向 Desc 的连线。节点状态变为绿色。
3.  **A3**: 选中 `[UICtrlDesc Node]`，在侧边栏点击 `[Generate Controller Stub]`。工具生成 `UIController.cs`，并在图上创建绿色的 `[UIController Node]`，创建从 Desc 指向 Controller 的连线。
4.  **A4**: 选中 `[UIController Node]`，在侧边栏选择或创建一个 UITask。工具生成 `UITask.cs` 和 `Tofu.cs`，并在图上创建紫色的 `[UITask Node]` 和灰色的 `[Tofu Node]`，建立 `Task -> Tofu` 和 `Task -> Controller` 的连线。整个依赖链路完成，所有节点显示为绿色。

### 3.3 工作流 B：逻辑驱动

**适用场景**: 先进行系统架构设计，定义需要的模块，稍后由他人填充 UI 资源。

| ID | 功能模块 | 功能描述 | 优先级 |
|-----|----------|----------|--------|
| B1 | 创建 UITask 骨架 | 提供工具栏按钮，允许用户直接输入名称创建 `UITask`、`Tofu` 和接口的骨架代码，并在图上生成对应节点。 | 高 |
| B2 | 定义子控制器存根 | 选中 `UITask Node` 后，侧边栏允许用户为该 Task 创建多个空的 `UIController` 存根。 | 高 |
| B3 | 补充数据描述 | 选中缺少 `UICtrlDesc` 的 `UIController Node` 时，侧边栏提供创建空的 `UICtrlDesc.cs` 的功能。 | 高 |
| B4 | 绑定与同步 Prefab | 支持将 Prefab 拖入图，并手动将其连接到已有的 `UICtrlDesc Node`，然后执行分析同步操作。 | 高 |

**用户流程**:
1.  **B1**: 用户点击 GraphView 工具栏的 `[+] New UITask` 按钮，输入名称（如 "GuildSystem"）。工具生成骨架代码，并在图上创建紫色的 `[UITask Node]` 和相连的灰色的 `[Tofu Node]`。
2.  **B2**: 选中 `[UITask Node]`，在侧边栏的 "Sub-Controllers" 区域点击 `[+] Create Controller Stub]`，输入名称（如 "GuildInfoPanel"）。工具生成 `UIController.cs` 存根并注册到 Task，图上出现绿色的 `[UIController Node]` 并连接到 Task。此时 Controller 节点带有黄色警告。
3.  **B3**: 选中带警告的 `[UIController Node]`，侧边栏提示缺少源 `UICtrlDesc`。用户点击 `[Create Desc Stub]`。工具生成空的 `UICtrlDesc.cs`，图上出现蓝色的 `[UICtrlDesc Node]` 并连接。此时 Desc 节点带黄色警告。
4.  **B4**: 用户在 Project 窗口创建 Prefab，拖入 GraphView，形成 `[UI Prefab Node]`。用户手动从 `[UI Prefab Node]` 拉线连接到 `[UICtrlDesc Node]`。选中 Prefab 节点，在侧边栏点击 `[Analyze]` 和 `[Update linked UICtrlDesc]`。工具分析 Prefab 并更新 Desc 文件。所有相关节点变为绿色。

### 3.4 工作流 C：日常迭代与维护

**适用场景**: UI Prefab 修改了，或者手动修改了代码，需要同步。

| ID | 功能模块 | 功能描述 | 优先级 |
|-----|----------|----------|--------|
| C1 | 可视化检查 | 工具在后台自动扫描所有节点文件的修改时间和内容摘要，当发现不一致时，在图上通过节点颜色或连线颜色进行警告提示。 | 高 |
| C2 | 执行同步 | 选中显示警告的节点时，侧边栏顶部出现醒目的同步提示和按钮。点击后，工具执行鲁棒的代码合并，更新相关文件。 | 高 |
| C3 | Tofu 接口更新 | 当 Task 的逻辑发生变化时，提供一键更新其关联的 `I*Owner` 接口的功能。 | 中 |

**用户流程**:
1.  **C1**: 用户打开 GraphView，工具自动扫描并发现 Prefab 结构与 Desc 定义不匹配。图上 Prefab 和 Desc 节点之间的连线变为黄色，或节点本身变黄。
2.  **C2**: 用户选中显示警告的 Prefab 节点。侧边栏顶部出现警告：“Prefab structure changed. Click sync to update Desc.”。用户点击同步按钮。工具执行代码合并，更新 Desc 文件，节点颜色恢复为绿色。
3.  **C3**: 用户在 Task 中添加了新的逻辑需要 Tofu 配合。选中 `[UITask Node]`，在侧边栏点击 `[Update Tofu Interfaces]`。工具自动补充 `I*Owner` 接口定义。

## 4. 非功能性需求

| 类别 | 需求描述 |
|------|----------|
| **性能** | GraphView 应能流畅渲染至少 100 个节点而无明显卡顿。后台状态检查应异步执行，不阻塞 UI。 |
| **易用性** | 核心操作（创建节点、连接、同步）应直观易懂。提供清晰的视觉反馈和工具提示。 |
| **数据持久化** | 图的节点布局、连接关系、窗口状态等应能被保存和恢复。 |
| **健壮性** | 代码合并机制必须可靠，确保用户手写的代码在任何情况下都不会丢失。 |
| **可扩展性** | 节点类型和检查器面板的设计应易于扩展，以支持未来可能的新资产类型。 |

## 5. 未来扩展方向

*   **多项目管理**: 支持在同一个 GraphView 中管理多个 UI 模块或子系统，并提供分组或层级视图。
*   **布局算法**: 提供自动布局功能（如树状布局、力导向布局），帮助用户快速整理复杂的依赖图。
*   **实时协作**: 支持多人同时编辑同一个 UI 架构图（技术挑战较大）。
*   **版本历史**: 可视化显示 UI 架构的演变历史，支持回滚到某个历史版本。