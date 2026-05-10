# Unity UI Prefab 组件自动化收集与描述文件导出工具需求方案

## 一、 产品功能需求方案

1.  **核心目标**

*   **自动化绑定**： 拖入 UI Prefab 资源后，自动扫描其下的指定类型组件。
*   **描述文件生成/更新**： 根据收集到的组件信息，自动生成或更新程序绑定所需的 C# 描述文件（如 [`CatchFishUICtrlDesc.cs`](Assets/GameProject/Scripts/Runtime/GameView/UI/CatchFish/CatchFishUICtrlDesc.cs)）。
*   **高效用户体验**： 提供便捷的 Editor 工具界面，支持拖拽、预览、一键导出等功能。
*   **规范化支持**： 结合 [`GameObject`](https://docs.unity3d.com/ScriptReference/GameObject.html) 命名规范（如参考文章中的 `@_btn_xxx`）来自动生成 C# 变量名、别名和注释。

2.  **功能需求列表**

| ID  | 功能模块       | 功能描述                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 优先级 |
| --- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| F1  | Prefab 拖拽与加载 | 在 Editor 窗口中设置一个区域，允许用户将 UI Prefab 资源 拖入以加载和解析。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 高   |
| F2  | 组件自动收集     | 扫描加载的 Prefab 及其所有子节点，收集指定类型（如 [`Text`](https://docs.unity3d.com/ScriptReference/UI.Text.html), [`Image`](https://docs.unity3d.com/ScriptReference/UI.Image.html), [`Button`](https://docs.unity3d.com/ScriptReference/UI.Button.html) 等）的组件。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 高   |
| F3  | 组件过滤与命名解析 | 根据 [`GameObject`](https://docs.unity3d.com/ScriptReference/GameObject.html) 的命名规范（例如：`[前缀]_[类型缩写]_[自定义名]`）筛选需要收集的组件，并解析出 C# 变量名、[`AutoGenAliasName`](Unknown) 属性值（组件在 Prefab 中的路径或唯一别名）和 [`Header`](https://docs.unity3d.com/ScriptReference/HeaderAttribute.html) 属性值（中文描述）。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 高   |
| F4  | 收集结果预览与编辑 | 在 Editor 窗口中列出收集到的组件信息：[`GameObject`](https://docs.unity3d.com/ScriptReference/GameObject.html) 路径、组件类型、自动生成的变量名、中文描述、是否导出（可勾选）。允许用户手动修改变量名和中文描述。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 高   |
| F5  | C# 描述文件生成/更新 | 一键操作：根据预览列表中的信息，生成或更新目标 C# 描述文件（继承自 [`PrefabControllerDescBase`](Unknown)）。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 高   |
| F6  | 导出路径配置       | 配置生成/更新 C# 文件的默认保存路径，以及命名空间和类名的生成规则。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 中   |
| F7  | 组件引用状态提醒     | 在 Hierarchy 视图中，为 Prefab 中已被收集和引用的 [`GameObject`](https://docs.unity3d.com/ScriptReference/GameObject.html) 增加醒目的视觉标识（如黄星），提示用户该对象已被绑定。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 中   |
| F8  | 空引用/命名冲突检测   | 在生成文件前或 Prefab 保存时，检测组件路径是否有效、变量名是否重复，并进行警告提示。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 中   |

## 二、 功能设计方案

1.  **命名规范与解析（F3 核心）**

为了自动化生成 C# 描述文件中的字段，我们需要一套清晰的命名规范。

*   [`GameObject`](https://docs.unity3d.com/ScriptReference/GameObject.html) 命名规范：`[前缀][组件缩写]_[描述/变量名]`
    *   示例： `@Text_FishTypeName`
*   符号约定：
    *   `@`: 标记该 [`GameObject`](https://docs.unity3d.com/ScriptReference/GameObject.html) 上的组件需要被收集。
    *   `Text`: 组件类型缩写（如 [`Text`](https://docs.unity3d.com/ScriptReference/UI.Text.html) 对应 [`UnityEngine.UI.Text`](https://docs.unity3d.com/ScriptReference/UI.Text.html)）。
    *   `FishTypeName`: 用于生成 C# 变量名 (`m_FishTypeNameText`) 和 中文描述 (鱼种名) 的基础。
*   解析规则：
    *   C# 变量名 (Field Name)： 采用驼峰命名，通常添加前缀 `m_`，并以组件类型结尾。
        *   示例： `@Text_FishTypeName` $\rightarrow$ `public Text m_FishTypeNameText;`
    *   [`AutoGenAliasName`](Unknown) 值： 组件在 Prefab 中的路径。这确保了运行时能根据这个路径精确找到组件。
        *   示例： `@Text_FishTypeName` 所在路径 $\rightarrow$ `[AutoGenAliasName(".../Root/@Text_FishTypeName")]`
    *   [`Header`](https://docs.unity3d.com/ScriptReference/HeaderAttribute.html) 值 (中文描述)： 使用 描述/变量名 部分的中文翻译或原始字符串。工具应提供一个配置文件或简单的翻译映射表来生成中文描述。
        *   示例： `FishTypeName` $\rightarrow$ `[Header("鱼种名")]`

2.  **Editor 窗口设计（F1, F4, F5）**

设计一个 Unity Editor 扩展窗口，实现工具的核心操作。

| 区域名称      | 功能/交互                                                                                                                                                                 | 对应功能需求 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| A Prefab 拖入区 | 监听拖拽事件，接收并加载 UI Prefab 资源。显示当前解析的 Prefab 名称。                                                                                                                             | F1       |
| B 控制台     | 包含 “一键收集”、“生成/更新描述文件” 两个主要按钮。用于执行核心操作。                                                                                                                                 | F2, F5   |
| C 组件列表预览区 | 以 [`ReorderableList`](https://docs.unity3d.com/ScriptReference/ReorderableList.html) 形式展示收集到的组件信息，列出字段：组件路径、组件类型、C# 变量名（可编辑）、中文描述（可编辑）、是否导出（CheckBox）。                                                                                                                               | F4       |
| D 配置区      | 用于配置文件导出目录、命名空间、基类（如 [`PrefabControllerDescBase`](Unknown)）、[`GameObject`](https://docs.unity3d.com/ScriptReference/GameObject.html) 命名解析规则等。                                                                                                                                                                                                                                | F6       |

*   操作流程：
    1.  用户将目标 UI Prefab 拖入 A 区。
    2.  点击 B 区 的 “一键收集”，工具执行 F2 和 F3，并在 C 区 展示结果。
    3.  用户在 C 区 检查和微调变量名和中文描述。
    4.  点击 B 区 的 “生成/更新描述文件”，工具根据配置（D 区）和列表（C 区）生成目标 C# 文件。

3.  **C# 文件代码生成（F5 关键）**

使用 [`System.IO`](https://docs.microsoft.com/en-us/dotnet/api/system.io) 进行文件操作，结合 [`System.Text.StringBuilder`](https://docs.microsoft.com/en-us/dotnet/api/system.text.stringbuilder) 拼接代码字符串，遵循以下结构：

*   导入必要的命名空间：

```csharp
using UnityEngine;
using UnityEngine.UI;
// ... 其他必要的命名空间
```

*   定义命名空间和类：

```csharp
namespace [配置的命名空间]
{
    [AutoGenAliasName("Assets/GameProject/Scripts/Runtime/GameView/UI/...", "", "[Controller类名]")]
    public class [Prefab名]UICtrlDesc : PrefabControllerDescBase
    {
        // 组件字段将生成在此处
    }
}
```

*   遍历列表生成字段： 针对 C 区列表中的每一个组件，生成带有三个属性的公共字段：

```csharp
// 遍历列表
foreach (var componentInfo in collectedList)
{
    // 1. Header (中文描述)
    stringBuilder.AppendLine($"       [Header(\"{componentInfo.ChineseDescription}\")]");
    // 2. AutoGenAliasName (组件路径/唯一别名)
    stringBuilder.AppendLine($"       [AutoGenAliasName(\"{componentInfo.AliasPath}\")]");
    // 3. C# 字段 (类型 + 变量名)
    stringBuilder.AppendLine($"       public {componentInfo.ComponentType} {componentInfo.FieldName};");
}
```

4.  **交互友好性设计（F7, F8）**

*   引用提醒 (F7)： 借鉴参考文章，在 Editor 模式下，使用 [`EditorApplication.hierarchyWindowItemOnGUI`](https://docs.unity3d.com/ScriptReference/EditorApplication-hierarchyWindowItemOnGUI.html) 钩子函数，检测 Hierarchy 中的 [`GameObject`](https://docs.unity3d.com/ScriptReference/GameObject.html) 是否是当前所有 [`UICtrlDesc`](Unknown) 文件中引用的组件（通过路径或别名判断），如果是，则在 [`GameObject`](https://docs.unity3d.com/ScriptReference/GameObject.html) 名称旁绘制 “★” 等醒目符号。
*   校验与警告 (F8)： 在“生成/更新”前，运行以下检查：
    *   变量名冲突： 检查列表中的 FieldName 是否在 C# 文件中重复。
    *   路径有效性： 检查 AliasPath 对应的组件是否仍然存在于 Prefab 中。
*   提示处理： 如果发现错误，通过 [`EditorUtility.DisplayDialog`](https://docs.unity3d.com/ScriptReference/EditorUtility.DisplayDialog.html) 或 [`Debug.LogError`](https://docs.unity3d.com/ScriptReference/Debug.LogError.html) 提示用户，并阻止文件生成，直到错误解决。

## 总结与下一步

这个方案覆盖了从 组件收集 $\rightarrow$ 数据解析/编辑 $\rightarrow$ C# 文件生成 的完整工作流，并结合了业界优秀实践（如网易雷火的引用标记、错误检测）以提高工具的实用性和稳定性。

考虑到程序可能已经手动修改了导出的描述文件中的 C# 变量名，工具必须具备 “读取回现” 和 “以已存在文件为准” 的能力，以避免覆盖已有的代码更改。下面是针对“命名解析规范”和“已存在文件处理”的优化设计方案。

## 命名解析与文件回现设计方案

1.  **命名解析规范（可配置）**

首先，定义一个可配置的规则集，用于将 [`GameObject`](https://docs.unity3d.com/ScriptReference/GameObject.html) 的名称转换为 C# 变量名、中文描述和组件类型。

| 元素规范/默认值 | 作用                                                                                                                                                                                                                                                                   | 对应配置项      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 收集前缀        | `@` 标记需要被收集的 [`GameObject`](https://docs.unity3d.com/ScriptReference/GameObject.html)。                                                                                                                                                                                                                                           | CollectPrefix |
| 名称分隔符        | `_` 用于分隔组件类型缩写和自定义描述/变量名。                                                                                                                                                                                                                                                                                             | NameSeparator |
| C# 变量名前缀     | `m_` 所有生成的 C# 变量名都添加该前缀。                                                                                                                                                                                                                                                                                                   | VariablePrefix  |
| 组件类型缩写映射    | `Btn` $\rightarrow$ [`ButtonEx`](Unknown) 将名称中的缩写映射到完整的 C# 组件类型。                                                                                                                                                                                                                                                                                        | TypeMapping (Dictionary) |
| 默认类型        | [`GameObject`](https://docs.unity3d.com/ScriptReference/GameObject.html) 如果组件上没有匹配到任何缩写，则默认收集 [`GameObject`](https://docs.unity3d.com/ScriptReference/GameObject.html)。                                                                                                                                                                                                                                                                | DefaultType |

*   示例解析流程（基于 [`GameObject`](https://docs.unity3d.com/ScriptReference/GameObject.html) 名称：`@Btn_PutInKeepnet`）：
    1.  检查前缀： 确认名称以 `@` 开头（`@Btn_PutInKeepnet`）。
    2.  获取缩写和描述： 使用分隔符 `_` 分割：
        *   缩写： `Btn`
        *   描述/基础变量名： `PutInKeepnet`
    3.  确定组件类型： 在 `TypeMapping` 查找到 `Btn` 对应 [`ButtonEx`](Unknown)。
    4.  生成 C# 变量名：`VariablePrefix` (`m_`) + `PutInKeepnet` + 组件类型后缀 (`Btn`) $\rightarrow$ `m_PutInKeepnetBtn`（注：组件类型后缀是可选的，用于确保名称唯一性）
    5.  生成中文描述： 查找预设的翻译表或直接使用 `PutInKeepnet`（程序会在预览时手动修改）。

2.  **已存在描述文件处理（核心）**

如果目标 C# 描述文件（例如 [`CatchFishUICtrlDesc.cs`](Assets/GameProject/Scripts/Runtime/GameView/UI/CatchFish/CatchFishUICtrlDesc.cs)）已存在，工具应优先从中提取信息，而不是完全依赖命名规范重新生成。

*   步骤 2.1：C# 文件内容解析（回现）

工具在开始收集前，首先检查目标描述文件是否存在。如果存在，则使用 正则表达式 (Regex) 或 C# 语法解析库（如 Roslyn，但正则更轻量高效）来解析文件中的关键信息。

    *   解析目标： 提取文件中所有字段的 [`AutoGenAliasName`](Unknown) 值和 C# 变量名。
    *   正则表达式示例： (提取 `[AutoGenAliasName("...")]` 和 `public [Type] [FieldName];`)

```csharp
Code snippet
[Header("(?<ChineseDescription>.*?)")]\s*[AutoGenAliasName("(?<AliasPath>.*?)")]\s*public\s+(?<ComponentType>.*?)\s+(?<FieldName>.*?);
```

| 匹配组名            | 提取内容                                                                                                                                                                                                                                                                    | 作用                                                                                                                                                                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AliasPath         | `m_PutInKeepnetBtn`                                                                                                                                                                                                                                                         | 唯一标识符。 这是组件在 Prefab 中的路径或别名。                                                                                                                                                                                                       |
| FieldName         | `m_PutInKeepnetBtn`                                                                                                                                                                                                                                                         | 程序已修改的 C# 变量名。                                                                                                                                                                                                                         |
| ComponentType     | [`ButtonEx`](Unknown)                                                                                                                                                                                                                                                        | 字段类型。                                                                                                                                                                                                                                          |
| ChineseDescription | 入户按钮                                                                                                                                                                                                                                                                    | 字段的中文描述。                                                                                                                                                                                                                                      |

*   步骤 2.2：数据合并与匹配
    1.  加载 Prefab： 遍历 Prefab，收集所有符合命名规范的 [`GameObject`](https://docs.unity3d.com/ScriptReference/GameObject.html)/组件，生成 “当前组件列表”。
    2.  加载 C# 文件： 解析已存在的 C# 描述文件，生成 “已存在字段列表” (Key: `AliasPath`, Value: `FieldName`/`Type`/`Desc`)。
    3.  匹配与合并：
        *   遍历 `当前组件列表` 中的每个组件，计算其 `AliasPath`。
        *   用该 `AliasPath` 去 `已存在字段列表` 中进行匹配。
            *   匹配成功： 优先使用 C# 文件中提取的 `FieldName`、`ComponentType` 和 `ChineseDescription`。
            *   匹配失败： 说明这是一个新增的组件。使用 步骤 1 中的命名规范自动生成 `FieldName` 等信息。

*   步骤 2.3：列表展示与更新

在 Editor 预览列表 (F4) 中，展示合并后的数据。`已存在字段` 的 C# 变量名将显示为文件中的值，确保程序手动修改的命名得到保留。

    *   旧的未匹配字段： 如果 `已存在字段列表` 中有某些 `AliasPath` 在 `当前组件列表` 中找不到（例如组件被删除），则在预览列表中标记为 “待移除” 或 “引用丢失”，提醒用户。

3.  **工作流程概览**

| 阶段     | 动作                               | 数据来源                      | 关键决策点           |
| -------- | ---------------------------------- | ------------------------- | -------------- |
| 加载与解析 | 检查描述文件是否存在。                       | 文件系统                      | 是/否：文件是否存在？    |
| 数据回现   | 如果文件存在，解析并生成 “已存在字段列表”。          | 描述文件内容（正则）              | 提取 `AliasPath` 和 `FieldName`。 |
| 组件收集   | 遍历 Prefab，根据命名规范生成 “当前组件列表”。 | Prefab 结构与 [`GameObject`](https://docs.unity3d.com/ScriptReference/GameObject.html) 名称 | 生成 `AliasPath`。   |
| 数据合并   | 使用 `AliasPath` 匹配两个列表，合并生成 “预览列表”。 | 已存在字段列表                  | 优先变量名以已存在文件为准。 |
| 用户编辑   | 用户在 Editor 窗口调整 `FieldName` 和 `ChineseDescription`。 | Editor 窗口                 | 确认最终要导出的数据。      |
| 代码生成   | 导出最终的 C# 文件。                         | 预览列表                      | 移除标记为“待移除”的字段。 |

这个设计确保了工具在提供自动化能力的同时，充分尊重了人工修改的代码，实现了对现有项目友好、可迭代的工具链。