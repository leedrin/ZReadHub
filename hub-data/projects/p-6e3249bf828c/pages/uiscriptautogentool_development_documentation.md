## UIScriptAutoGenTool 开发文档

### 1. 总体架构概述

UIScriptAutoGenTool 是一个Unity编辑器扩展工具，专门用于自动生成UI脚本代码。该工具采用模块化设计，通过编辑器窗口界面实现UI Controller和UI Task脚本的自动化创建和绑定，大幅提升UI开发效率。

### 核心架构特点：
- **模块化设计**：基于抽象模块基类(`EditorAbstractModule`)实现功能扩展
- **模板驱动**：使用预定义模板生成代码，确保代码风格一致性
- **数据持久化**：通过JSON格式保存配置和绑定关系
- **可视化操作**：提供直观的编辑器界面，降低使用门槛

### 2. 目录结构分析

#### 2.1 主要目录划分

```
UIScriptAutoGenTool/
├── EditorWindowGather/     # 编辑器窗口主框架
│   ├── Config/             # 配置文件
│   ├── Function/           # 通用功能函数
│   ├── Gather/             # 主窗口和设置
│   └── Item/               # 各功能模块实现
└── UIScriptAutoGen/        # 代码生成核心
    ├── AutoGen/            # 自动生成逻辑
    ├── JsonData/           # 数据结构定义
    └── Template/           # 代码模板
```

#### 2.2 关键文件分布

- **主窗口**: [`EditorWindowGather.cs`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Gather/EditorWindowGather.cs:20)
- **基础类**: [`EditorAbstractModule.cs`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Gather/EditorAbstractModule.cs:15)
- **配置管理**: [`UIScriptAutoGenSettings.cs`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/AutoGen/UIScriptAutoGenSettings.cs:18)
- **代码生成**: [`UIScriptAutoGenFunction.cs`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/AutoGen/UIScriptAutoGenFunction.cs:20)

### 3. 核心模块详细分析

#### 3.1 编辑器窗口框架 (EditorWindowGather)

##### 3.1.1 主窗口类
- **文件**: [`EditorWindowGather.cs`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Gather/EditorWindowGather.cs:20)
- **功能**: 
  - 提供主编辑器窗口界面
  - 动态加载和管理各功能模块
  - 实现模块间的切换和通信
- **关键方法**:
  - [`SearchUnitUI()`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Gather/EditorWindowGather.cs:107): 自动发现并加载所有模块
  - [`SelectBtn()`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Gather/EditorWindowGather.cs:177): 模块切换逻辑

##### 3.1.2 抽象模块基类
- **文件**: [`EditorAbstractModule.cs`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Gather/EditorAbstractModule.cs:15)
- **作用**: 定义所有功能模块的通用接口
- **核心属性**:
  - [`UnitName`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Gather/EditorAbstractModule.cs:20): 模块显示名称
  - [`Index`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Gather/EditorAbstractModule.cs:28): 模块排序索引

#### 3.2 功能模块实现 (Item目录)

##### 3.2.1 基础模块
- **文件**: [`UIScriptAutoGenBase.cs`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Item/UIScriptAutoGenBase.cs:20)
- **功能**: 提供UI预制体选择和基础数据管理
- **核心功能**:
  - 预制体选择和验证
  - JSON数据加载和缓存
  - 界面层级管理

##### 3.2.2 Controller创建模块
- **文件**: [`UIScriptAutoGenController.cs`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Item/UIScriptAutoGenController.cs:19)
- **功能**: 创建和管理UI Controller脚本
- **主要流程**:
  1. 选择脚本挂载点
  2. 配置脚本名称和描述
  3. 基于模板生成Controller脚本
  4. 维护Controller列表

##### 3.2.3 组件绑定模块
- **文件**: [`UIScriptAutoGenControllerBinding.cs`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Item/UIScriptAutoGenControllerBinding.cs:26)
- **功能**: 管理UI组件与Controller的绑定关系
- **核心特性**:
  - 支持多种UI组件类型(Button, Image, Text等)
  - 自动生成组件访问路径
  - 按钮事件绑定配置
  - 组件路径变更检测

##### 3.2.4 Task创建模块
- **文件**: [`UIScriptAutoGenTask.cs`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Item/UIScriptAutoGenTask.cs:21)
- **功能**: 创建和管理UI Task脚本
- **主要流程**:
  1. 配置Task基本信息
  2. 基于模板生成Task脚本
  3. 维护Task列表和关联数据

##### 3.2.5 Task绑定模块
- **文件**: [`UIScriptAutoGenTaskBinding.cs`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Item/UIScriptAutoGenTaskBinding.cs:20)
- **功能**: 管理Task与Controller/Prefab的关联
- **核心特性**:
  - Prefab与Task的关联管理
  - Controller与Task的绑定
  - 自动生成Task初始化代码

##### 3.2.6 设置模块
- **文件**: [`UIScriptAutoGenSettingsItem.cs`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Item/UIScriptAutoGenSettingsItem.cs:21)
- **功能**: 管理工具配置
- **主要配置项**:
  - 模板文件路径
  - 脚本命名规则
  - 输出目录设置

#### 3.3 代码生成核心 (UIScriptAutoGen目录)

##### 3.3.1 代码生成器
- **文件**: [`UIScriptAutoGenEditor.cs`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/AutoGen/UIScriptAutoGenEditor.cs:21)
- **功能**: 基于模板生成脚本文件
- **核心方法**:
  - [`CreateControllerFile()`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/AutoGen/UIScriptAutoGenEditor.cs:57): 生成Controller脚本
  - [`CreateTaskFile()`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/AutoGen/UIScriptAutoGenEditor.cs:77): 生成Task脚本
  - [`ReplaceText()`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/AutoGen/UIScriptAutoGenEditor.cs:120): 模板变量替换

##### 3.3.2 代码写入逻辑
- **文件**: [`UIScriptAutoGenFunction.cs`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/AutoGen/UIScriptAutoGenFunction.cs:20)
- **功能**: 将绑定数据写入现有脚本
- **核心功能**:
  - Controller组件绑定代码生成
  - Task初始化代码生成
  - 按钮事件处理代码生成
  - 基于标记的代码插入

##### 3.3.3 数据结构定义
- **文件**: [`UIScriptAutoGenData.cs`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/AutoGen/UIScriptAutoGenData.cs:20)
- **功能**: 定义代码生成所需的数据结构
- **核心结构**:
  - [`ControllerBindingData`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/AutoGen/UIScriptAutoGenData.cs:25): Controller组件绑定数据
  - [`TaskBindingData`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/AutoGen/UIScriptAutoGenData.cs:68): Task绑定数据
  - [`TaskBindingData_ControllerData_ButtonData`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/AutoGen/UIScriptAutoGenData.cs:276): 按钮事件数据

#### 3.4 JSON数据管理

##### 3.4.1 Controller数据
- **文件**: [`UIScriptAutoGenControllerJsonData.cs`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/JsonData/UIScriptAutoGenControllerJsonData.cs:31)
- **功能**: 管理Controller相关JSON数据
- **核心特性**:
  - GUID关联管理
  - 脚本路径跟踪
  - 组件路径计算

##### 3.4.2 JSON操作工具
- **文件**: [`EditorWindowFunction_Json.cs`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Function/EditorWindowFunction_Json.cs:21)
- **功能**: 提供JSON读写和格式化功能
- **核心方法**:
  - [`GetJson()`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Function/EditorWindowFunction_Json.cs:30): JSON数据读取
  - [`SetJson()`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Function/EditorWindowFunction_Json.cs:55): JSON数据写入
  - [`JsonFormat()`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Function/EditorWindowFunction_Json.cs:85): JSON格式化

#### 3.5 代码模板

##### 3.5.1 Controller模板
- **文件**: [`UIControllerTemplate.cs`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/Template/UIControllerTemplate.cs:1)
- **功能**: 定义UI Controller脚本模板结构
- **模板标记**:
  - `_NAMESPACE_`: 命名空间占位符
  - `_CONTROLLER_`: Controller类名占位符
  - `_DESC_`: 描述信息占位符

##### 3.5.2 Task模板
- **文件**: [`UITaskTemplate.cs`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/Template/UITaskTemplate.cs:1)
- **功能**: 定义UI Task脚本模板结构
- **模板标记**:
  - `_TASK_`: Task类名占位符
  - 其他与Controller模板相同

### 4. Prefab 组件读取原理

1.  **用户选择 Prefab 实例**: 通过 `EditorGUILayout.ObjectField` 选择场景中的 UI Prefab 实例。
2.  **获取原始 Prefab Asset**: 使用 `PrefabUtility.GetPrefabParent()` 从实例获取原始 Prefab Asset。
3.  **用户选择 Prefab 内部组件**: 用户在编辑器中选择 Prefab 实例内部的某个 GameObject 或其上的组件。
4.  **获取组件在原始 Prefab 中的唯一 ID**: 使用反射和 `SerializedObject` 将 Unity 内部的 `m_LocalIdentfierInFile` 获取出来，作为组件在 Prefab 中的唯一标识。
    -   [`GetGuidByPrefabTransform(Transform transPrefab)`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Function/EditorWindowFunction_Transform.cs:145)
    -   [`GetGuidByTransform(Transform layerTransform, Transform bindingTransform)`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Function/EditorWindowFunction_Transform.cs:177)
5.  **计算组件相对路径**: 根据组件在原始 Prefab 中的层级关系，计算出它相对于 Controller GameObject 的路径。
    -   [`FindParentsPath(Transform trans, Transform target)`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Function/EditorWindowFunction_Transform.cs:85)
6.  **持久化数据**: 将组件的唯一 ID、类型、相对路径等信息序列化为 JSON 格式保存。
7.  **代码生成**: 在生成 Controller 脚本时，根据保存的组件信息，利用模板和 `[AutoBind("路径")]` 属性代码，实现组件的自动绑定。

### 5. 搜集、绑定和变量命名原理

#### 5.1 组件的搜集

-   **用户交互**: 在 [`UIScriptAutoGenControllerBinding.cs`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Item/UIScriptAutoGenControllerBinding.cs:26) 的 [`BindingComponent()`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Item/UIScriptAutoGenControllerBinding.cs:131) 方法中，用户通过 `EditorGUILayout.ObjectField` 选择场景中的 `Transform`。
-   **类型获取**: [`EditorWindowFunction.GetTypeList(m_bindingTransform)`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Function/EditorWindowFunction_Transform.cs:117) 获取 `Transform` 上挂载的所有组件类型。
-   **唯一标识符获取**: [`EditorWindowFunction.GetGuidByTransform(s_layerTransform, m_bindingTransform)`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Function/EditorWindowFunction_Transform.cs:177) 获取组件在原始 Prefab 中的唯一标识符（GUID）。
-   **数据存储**: 搜集到的信息被封装成 `UIScriptAutoGenLayerJsonData` 对象，并序列化成 JSON 文件进行持久化。

#### 5.2 代码绑定

##### 5.2.1 Controller 脚本的绑定

-   **触发**: 用户点击 "生成代码到脚本" 按钮，调用 [`UIScriptAutoGenControllerBinding.cs::GenerateScript()`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Item/UIScriptAutoGenControllerBinding.cs:457)。
-   **数据准备**: 遍历 `UIScriptAutoGenLayerJsonData`，获取组件相对于 Controller 的相对路径，组织成 `UIScriptAutoGenData.ControllerBindingData`。
-   **代码写入**: [`UIScriptAutoGenFunction.ControllerCodesWriter()`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/AutoGen/UIScriptAutoGenFunction.cs:29) 读取 Controller 脚本，查找 `自动化控件路径开始` 和 `自动化控件路径结束` 标记，并插入 `[AutoBind("{相对路径}")] public {组件类型} {变量名};` 格式的代码。

##### 5.2.2 Task 脚本的绑定

-   **触发**: 用户点击 "生成代码到脚本" 按钮，调用 [`UIScriptAutoGenTaskBinding.cs::GenerateScript()`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Item/UIScriptAutoGenTaskBinding.cs:411)。
-   **数据准备**: 遍历 `UIScriptAutoGenTaskJsonData`，构建 `UIScriptAutoGenData.TaskBindingData`，包含 `PrefabList` 和 `ControllerList`。
-   **代码写入**: [`UIScriptAutoGenFunction.TaskCodesWriter()`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/AutoGen/UIScriptAutoGenFunction.cs:114) 查找 Task 脚本中的特定标记，并生成 Layer 描述、Controller 描述、Controller 变量、初始化代码和按钮事件函数等。

#### 5.3 变量命名

-   **用户自定义**: 在 [`UIScriptAutoGenControllerBinding.cs::BindingComponent()`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Item/UIScriptAutoGenControllerBinding.cs:131) 中，用户可以输入“自定义变量名” (`s_uiScriptAutoGenLayerJsonData.m_customName`)。
-   **默认命名规则**: 如果未自定义，工具会根据 GameObject 名称和组件类型自动生成默认名称。例如，[`UIScriptAutoGenLayerJsonData.GetDefaultName()`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/JsonData/UIScriptAutoGenLayerJsonData.cs:175) 用于生成组件变量名。
-   **Controller 变量命名**: [`UIScriptAutoGenData.TaskBindingData_ControllerData.GetCtrlVariateName()`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/AutoGen/UIScriptAutoGenData.cs:249) 将 Controller 变量名格式化为 `m_` 开头、首字母小写。
-   **冲突检测**: [`UIScriptAutoGenControllerBinding.cs::AddBindingComponentToList()`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/EditorWindowGather/Item/UIScriptAutoGenControllerBinding.cs:347) 会检查变量名冲突。

### 6. 代码生成相关部分

#### 6.1 模板文件

-   **[`UIControllerTemplate.cs`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/Template/UIControllerTemplate.cs:1)** 和 **[`UITaskTemplate.cs`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/Template/UITaskTemplate.cs:1)**: 定义了生成 C# 文件的基本结构和占位符（如 `_NAMESPACE_`, `_AUTHOR_`, `_DATE_`, `_DESC_`, `_CONTROLLER_`, `_TASK_` 等）以及代码注入标记。

#### 6.2 脚本文件创建与模板替换

-   **[`CreateControllerFile()`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/AutoGen/UIScriptAutoGenEditor.cs:57)** 和 **[`CreateTaskFile()`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/AutoGen/UIScriptAutoGenEditor.cs:77)**: 调用 [`CreateFileFromTemplate()`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/AutoGen/UIScriptAutoGenEditor.cs:101) 来创建新文件。
-   **[`ReplaceText()`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/AutoGen/UIScriptAutoGenEditor.cs:120)**: 使用 `Regex.Replace` 将模板中的占位符替换为实际内容。

#### 6.3 现有脚本的代码注入

-   **[`ControllerCodesWriter()`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/AutoGen/UIScriptAutoGenFunction.cs:29)** 和 **[`TaskCodesWriter()`](Assets/BJFramework/Script/Editor/UI/UIScriptAutoGenTool/UIScriptAutoGen/AutoGen/UIScriptAutoGenFunction.cs:114)**: 读取现有脚本内容，通过查找 `beginMark` 和 `endMark`（例如 `自动化控件路径开始`）来定位插入点，并将生成的代码块（例如 `[AutoBind]` 属性、事件注册、变量声明等）注入到文件中。

#### 6.4 配置管理

-   作为 `ScriptableObject`，存储了模板路径、命名空间、作者信息、文件后缀、输出路径等所有代码生成相关的配置，方便在 Unity 编辑器中进行管理。

### 7. 技术特点与优势

#### 7.1 自动化程度高
-   自动生成标准化的UI脚本代码
-   智能组件路径计算和更新
-   模板驱动的代码生成确保一致性

#### 7.2 可扩展性强
-   基于抽象模块的插件式架构
-   支持自定义组件类型处理
-   模板系统支持代码风格定制

#### 7.3 数据持久化
-   JSON格式保存所有配置和绑定关系
-   支持跨会话的数据恢复
-   版本控制友好的文本格式

#### 7.4 错误检测与恢复
-   组件路径变更检测
-   脚本丢失检测和提示
-   GUID关联确保数据完整性