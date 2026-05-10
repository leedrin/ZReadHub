# BJFramework UI 自动化中心 (BJFramework UI Automation Center) - UI 设计方案

## 1. 窗口总体布局

窗口分为三个主要区域：

- **顶部工具栏与全局配置区**: 处理通用设置、新建项目入口和全局刷新。
- **工作流状态流水线**: 核心设计亮点。这是一个横向的、可视化的状态栏，直观展示当前 UI 模块从 Prefab 到 Tofu 的四个关键节点的连接状态和健康度。
- **主要内容选项卡区域**: 承载具体的编辑、分析和生成操作。分为四个主要 Tab，对应 PRD 中的核心模块。

---

## 2. 详细区域设计

### 2.1 顶部工具栏与全局配置区

位于窗口最上方，提供最基础的操作入口。

- **[⚙️ Settings (ToolConfig)] 按钮**:
  - **行为**: 点击弹出独立的窗口或覆盖层，用于配置统一的 `ToolConfig.cs`。
  - **内容**: 包含所有模板路径、默认命名空间、BJFramework 基类名称设定、代码生成目录规则、命名规范校验规则（如 PascalCase, `m_` 前缀）等。

- **工作流入口按钮组**:
  - **[➕ 新建 UITask (逻辑驱动)]**: Top-Down 工作流入口。点击后弹窗输入 Task 名称，自动初始化一个只有 Task 和 Tofu 骨架的新模块，并跳转到 "UITask & Tofu" 选项卡。
  - **[📂 打开/分析 Prefab (资源驱动)]**: Bottom-Up 工作流入口。点击后高亮 "Prefab 分析" 选项卡，引导用户拖拽 Prefab。
  - **[🔄 Refresh All Status] 按钮**: 强制重新扫描当前加载模块的所有文件（Prefab, cs 文件），更新流水线状态栏的显示。

### 2.2 工作流状态流水线

这是整个窗口的“仪表盘”，位于工具栏下方。它由四个连接的节点图标组成，表示当前正在编辑的 UI 模块的完整链路。

- **视觉设计**: `[📦 Prefab] ➔ [📄 UICtrlDesc] ➔ [🎮 UIController] ➔ [🧠 UITask & Tofu]`

#### 状态指示与交互

- **节点颜色**:
  - 🆕 **灰色**: 文件尚未生成或关联。
  - ✅ **绿色**: 文件存在且与上下游同步（例如：Prefab 结构与 Desc 定义一致）。
  - ⚠️ **黄色**: 文件存在，但检测到不一致（例如：Prefab 新增了组件，但 Desc 尚未更新；或者 UICtrlDesc 新增了事件，但 Controller 尚未生成存根）。
  - ❌ **红色**: 存在严重错误（例如：命名冲突、文件丢失、编译错误）。

- **连接线**:
  - **实线**: 已建立明确关联（例如 UIController 代码中已指定了所属 Task）。
  - **虚线**: 尚未建立关联。

- **点击行为**: 点击任意节点，下方的主要内容区域会自动切换到对应的选项卡。

### 2.3 主要内容选项卡区域

这是实际操作的区域。根据流水线的四个节点分为四个 Tab。

---

#### Tab 1: Prefab 分析与 UICtrlDesc

此 Tab 继承并增强了原 UIPrefabTool 的功能。

**A. Prefab 输入区 (左侧或顶部)**

- **Target Prefab (Object Field)**: 拖拽 UI Prefab 到此处。
- **收集模式选择**: 下拉框选择 (严格/回退/混合模式)，沿用原工具逻辑。
- **[🔍 Analyze Prefab] 按钮**: 点击开始分析组件。

**B. 组件分析结果列表 (核心交互区)**

- 一个树形列表视图，展示 Prefab层级。
- **智能列显示**:
  - **Hierarchy**: Prefab 的层级结构。
  - **Component Type**: 识别到的组件类型 (Button, Text, Image, 或自定义高级控件)。
  - **Export Name (可编辑)**: 工具根据规范自动生成的字段名（支持 PascalCase/`m_` 自动修正）。用户可手动修改。
  - **Generate? (Checkbox)**: 是否生成到 Desc 中。
- **特殊组件处理提示**: 对于 Dropdown 或 AdvanceUIStateController 等，在列表旁显示额外的配置折叠页，用于查看将要生成的 `static readonly List<string>` 内容。

**C. UICtrlDesc 生成操作区 (底部)**

- **Target UICtrlDesc (Object Field)**: 显示当前关联的 `.cs` 文件。如果是新 Prefab，这里为空。
- **[📄 Generate/Update UICtrlDesc.cs] 按钮**:
  - **功能**: 应用代码合并机制生成文件。
  - **状态反馈**: 如果是更新，提示“将保留用户手动修改区域”。
- **关联操作 (新功能)**:
  - 一个下拉框或对象选择器: "Attach to UIController:"。允许用户选择一个现有的 UIController，或者选择“< Create New Stub >”。

---

#### Tab 2: UIController 管理

此 Tab 用于连接数据描述与业务逻辑，并管理视图交互事件。

**A. 输入与基本信息**

- **Current UIController (Object Field)**: 显示当前编辑的 Controller 脚本。
- **Source UICtrlDesc (Object Field, Read-only)**: 显示其依赖的 Desc 文件。如果缺失，流水线状态栏会报黄/红。

**B. 事件与字段预览区**

- **Managed Fields (Fold-out)**: 只读列表，展示从 UICtrlDesc 自动同步过来的组件字段。
- **Interaction Events (List View)**:
  - 列出所有在 UICtrlDesc 中识别到的可交互组件 (ButtonEx, Toggle 等)。
  - 显示将要生成的事件处理方法名 (如 `OnCloseBtnClick()`)，遵循 BJFramework 命名规范。
  - **状态图标**: 显示该方法在 `.cs` 文件中是否已经存在。

**C. 生成操作与关联**

- **[🎮 Generate/Update UIController.cs] 按钮**:
  - **功能**: 基于 Desc 生成字段定义；基于交互组件生成事件绑定代码 (`AddListener`) 和事件方法存根 (`protected void On...`). 强调代码合并，不覆盖用户在存根中编写的逻辑。
- **所属 Task 关联 (核心)**:
  - "Owner UITask:" 下拉列表: 列出项目中所有的 UITask。选择一个将此 Controller 归属到该 Task 下。
  - **提示**: "切换归属 Task 将自动更新目标 Task 的 `UIControllerDescArray`。"

---

#### Tab 3: UITask & Tofu 编排

此 Tab 是逻辑驱动工作流的核心，用于管理宏观的 UI 业务。

**A. UITask 基本信息**

- **Current UITask (Object Field)**: 显示当前编辑的 Task 脚本。
- **Task Name & Namespace (Text Fields)**: 创建新 Task 时可编辑，遵循 BJFramework 规范 (功能名 + UITask)。

**B. Tofu 组件管理区**

- 显示该 Task 关联的 Tofu 组件列表。
- **Main Tofu 状态**: 显示 `*UITaskCompMainTofu.cs` 和 `I*UITaskCompOwner.cs` 接口文件的存在状态。
- **[🧠 Generate/Update Tofu & Interfaces] 按钮**: 生成或修复 Tofu 及其接口文件，确保实现了 `IUITaskTofu4Pipeline` 等必要接口。

**C. 子控制器管理**

- 一个列表显示当前 Task 管理的所有 UIController (`UIControllerDescArray` 的可视化)。
- **列表项功能**: 显示 Controller 名称，提供一个 `[Jump to Tab]` 按钮快速跳转到 "UIController 管理" 选项卡编辑该控制器。
- **[➕ Create New Controller Stub] 按钮**: Top-Down 流程的关键。点击后，弹窗输入新 Controller 名称，自动生成一个空 Controller 脚本，并将其添加到当前 Task 的列表中。随后引导用户去 Tab 2 和 Tab 1 完善其 Desc 和 Prefab 绑定。

**D. Layer 管理**

- 显示当前 Task 所属的 UI Layer。工具应能根据关联的 Controller 所在的 Prefab 信息自动推断 Layer 配置。

---

## 3. 工作流交互示例

### 场景：Top-Down 创建一个新的“背包”界面

1.  **启动**: 用户点击顶部工具栏的 `[➕ 新建 UITask]`。
2.  **命名**: 弹窗输入 "Inventory"。
3.  **自动跳转**: 窗口自动切换到 Tab 3 (UITask & Tofu)。
    - **状态栏**: `[📦]灰色 -> [📄]灰色 -> [🎮]灰色 -> [✅ 🧠]绿色` (Task 已生成)。
    - **Tab 3 内容**: 显示 `InventoryUITask.cs` 和 `InventoryUITaskCompMainTofu.cs` 已创建。子控制器列表为空。
4.  **创建控制器**: 用户在 Tab 3 点击 `[➕ Create New Controller Stub]`。
    - **输入名称** "InventoryGridController"。
    - 工具生成存根脚本，并将其加入 Task 的列表。
    - **状态栏**: `[📦]灰色 -> [📄]灰色 -> [⚠️ 🎮]黄色 -> [✅ 🧠]绿色` (Controller 有了，但缺 Desc)。
5.  **定义控制器**: 用户点击列表中的 "InventoryGridController"，跳转到 Tab 2 (UIController)。
    - **Tab 2 提示** "Missing Source UICtrlDesc"。
    - 用户点击页面上的 `[Create New UICtrlDesc]` 按钮。
    - **状态栏**: `[📦]灰色 -> [⚠️ 📄]黄色 -> [✅ 🎮]绿色 -> [✅ 🧠]绿色` (Desc 有了，但没绑 Prefab)。
6.  **绑定 Prefab**: 用户跳转到 Tab 1 (Prefab 分析)。
    - **界面提示** "Please assign a Prefab for InventoryGridCtrlDesc"。
    - 用户在 Project 窗口创建一个 Prefab，拖入 Tab 1 的目标区域。
    - 点击 `[🔍 Analyze Prefab]`, 然后点击 `[📄 Update UICtrlDesc]`。
    - **状态栏**: `[✅ 📦]绿色 -> [✅ 📄]绿色 -> [✅ 🎮]绿色 -> [✅ 🧠]绿色`。
7.  **完成**: 整个链路打通，所有基础代码框架符合 BJFramework 规范，用户可以开始填写真正的业务逻辑。

---

## 4. 总结

这个设计通过一个始终可见的“流水线状态栏”解决了复杂依赖关系可视化的难题，利用四个功能明确的选项卡承载具体操作，完美支持了从任意一点切入的正向或反向工作流，并严格遵循了 BJFramework 的规范要求。它将提供一个直观、高效且不易出错的 UI 自动化开发体验。