# Unity UI Prefab 组件自动化工具 - 详细技术设计方案

## 目录
1. [总体架构设计](#总体架构设计)
2. [核心模块设计](#核心模块设计)
3. [数据结构设计](#数据结构设计)
4. [核心算法设计](#核心算法设计)
5. [Editor UI 设计](#editor-ui-设计)
6. [配置系统设计](#配置系统设计)
7. [文件解析与生成策略](#文件解析与生成策略)
8. [测试策略](#测试策略)
9. [开发计划](#开发计划)

---

## 总体架构设计

### 1.1 架构分层

遵循 BJFramework 的分层设计理念，工具采用以下分层架构：

```
┌─────────────────────────────────────────────────┐
│  Presentation Layer (Editor Window)            │
│  - UIPrefabToolEditorWindow                    │
│  - ComponentListView (ReorderableList)         │
│  - ConfigurationPanel                          │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  Business Logic Layer                          │
│  - ComponentCollector                          │
│  - NameParser                                  │
│  - CodeGenerator                               │
│  - FileAnalyzer                                │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  Data Layer                                    │
│  - ComponentInfoDataModel                      │
│  - ToolConfigDataModel                         │
│  - CSharpFileDataModel                         │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  Infrastructure Layer                          │
│  - PrefabUtility                               │
│  - RegexParser                                 │
│  - FileIO                                      │
└─────────────────────────────────────────────────┘
```

### 1.2 设计原则

- **单一职责原则**: 每个模块只负责一项核心功能
- **开闭原则**: 通过配置系统支持扩展，无需修改核心代码
- **依赖倒置原则**: 核心逻辑依赖抽象接口，不依赖具体实现
- **可测试性**: 所有业务逻辑可独立于 Unity Editor 进行单元测试

---

## 核心模块设计

### 2.1 模块划分

| 模块名称 | 职责 | 输入 | 输出 |
|---------|------|------|------|
| **ComponentCollector** | 扫描 Prefab，收集符合规范的组件 | GameObject (Prefab Root) | List\<ComponentInfo\> |
| **NameParser** | 解析 GameObject 名称，生成字段信息 | GameObject.name + Config | FieldInfo |
| **FileAnalyzer** | 解析已存在的 C# 描述文件 | File Path | Dictionary\<AliasPath, FieldInfo\> |
| **DataMerger** | 合并 Prefab 数据与已存在文件数据 | CurrentList + ExistingDict | MergedList |
| **CodeGenerator** | 生成/更新 C# 描述文件 | MergedList + Config | C# File |
| **ValidationEngine** | 校验数据完整性与冲突 | MergedList | ValidationResult |
| **HierarchyDecorator** | 在 Hierarchy 中标记已引用对象 | Active Prefab + CtrlDesc Files | Visual Marks |

### 2.2 模块接口定义

#### 2.2.1 ComponentCollector

```csharp
/// <summary>
/// 组件收集器 - 负责从 Prefab 中提取符合命名规范的组件
/// </summary>
public interface IComponentCollector
{
    /// <summary>
    /// 从 Prefab 根节点收集所有符合规范的组件
    /// </summary>
    /// <param name="prefabRoot">Prefab 根节点</param>
    /// <param name="config">收集配置</param>
    /// <returns>收集到的组件信息列表</returns>
    List<ComponentInfo> CollectComponents(GameObject prefabRoot, ToolConfig config);

    /// <summary>
    /// 判断 GameObject 是否符合收集规范
    /// </summary>
    bool ShouldCollect(GameObject go, ToolConfig config);
}
```

#### 2.2.2 NameParser

```csharp
/// <summary>
/// 命名解析器 - 将 GameObject 名称解析为 C# 字段信息
/// </summary>
public interface INameParser
{
    /// <summary>
    /// 解析 GameObject 名称，生成字段信息
    /// </summary>
    /// <param name="gameObjectName">GameObject 完整名称 (如 @Btn_Confirm)</param>
    /// <param name="component">组件实例</param>
    /// <param name="config">解析配置</param>
    /// <returns>字段信息</returns>
    FieldInfo ParseName(string gameObjectName, Component component, ToolConfig config);

    /// <summary>
    /// 从 GameObject 名称提取组件类型缩写
    /// </summary>
    string ExtractTypeAbbreviation(string gameObjectName, ToolConfig config);

    /// <summary>
    /// 从 GameObject 名称提取描述部分
    /// </summary>
    string ExtractDescription(string gameObjectName, ToolConfig config);
}
```

#### 2.2.3 FileAnalyzer

```csharp
/// <summary>
/// 文件分析器 - 解析已存在的 C# 描述文件
/// </summary>
public interface IFileAnalyzer
{
    /// <summary>
    /// 解析 C# 描述文件，提取所有字段信息
    /// </summary>
    /// <param name="filePath">文件路径</param>
    /// <returns>Key: AliasPath, Value: FieldInfo</returns>
    Dictionary<string, FieldInfo> AnalyzeFile(string filePath);

    /// <summary>
    /// 提取文件中的命名空间
    /// </summary>
    string ExtractNamespace(string filePath);

    /// <summary>
    /// 提取文件中的类名
    /// </summary>
    string ExtractClassName(string filePath);

    /// <summary>
    /// 检查文件是否存在
    /// </summary>
    bool FileExists(string filePath);
}
```

#### 2.2.4 DataMerger

```csharp
/// <summary>
/// 数据合并器 - 合并当前 Prefab 数据与已存在文件数据
/// </summary>
public interface IDataMerger
{
    /// <summary>
    /// 合并数据
    /// </summary>
    /// <param name="currentList">从 Prefab 收集的当前组件列表</param>
    /// <param name="existingDict">从已存在文件解析的字段字典</param>
    /// <returns>合并后的组件信息列表</returns>
    MergeResult Merge(List<ComponentInfo> currentList, Dictionary<string, FieldInfo> existingDict);
}
```

#### 2.2.5 CodeGenerator

```csharp
/// <summary>
/// 代码生成器 - 生成 C# 描述文件
/// </summary>
public interface ICodeGenerator
{
    /// <summary>
    /// 生成完整的 C# 描述文件代码
    /// </summary>
    /// <param name="componentList">组件信息列表</param>
    /// <param name="config">生成配置</param>
    /// <returns>生成的 C# 代码字符串</returns>
    string GenerateCode(List<ComponentInfo> componentList, CodeGenConfig config);

    /// <summary>
    /// 写入文件
    /// </summary>
    void WriteToFile(string code, string filePath);
}
```

#### 2.2.6 ValidationEngine

```csharp
/// <summary>
/// 校验引擎 - 检测数据完整性与冲突
/// </summary>
public interface IValidationEngine
{
    /// <summary>
    /// 校验组件列表
    /// </summary>
    ValidationResult Validate(List<ComponentInfo> componentList, GameObject prefabRoot);

    /// <summary>
    /// 检测变量名冲突
    /// </summary>
    List<FieldNameConflict> DetectNameConflicts(List<ComponentInfo> componentList);

    /// <summary>
    /// 检测路径有效性
    /// </summary>
    List<InvalidPathError> ValidatePaths(List<ComponentInfo> componentList, GameObject prefabRoot);
}
```

---

## 数据结构设计

### 3.1 核心数据模型

#### 3.1.1 ComponentInfo (组件信息)

```csharp
/// <summary>
/// 组件信息 - 描述一个收集到的 UI 组件
/// </summary>
[Serializable]
public class ComponentInfo
{
    /// <summary>
    /// 组件在 Prefab 中的完整路径 (用于 AutoGenAliasName)
    /// 示例: "Root/Panel/@Btn_Confirm"
    /// </summary>
    public string AliasPath;

    /// <summary>
    /// 组件类型 (C# 类型名)
    /// 示例: "ButtonEx", "Text", "Image"
    /// </summary>
    public string ComponentType;

    /// <summary>
    /// C# 字段名 (变量名)
    /// 示例: "m_ConfirmBtn"
    /// </summary>
    public string FieldName;

    /// <summary>
    /// 中文描述 (用于 Header 特性)
    /// 示例: "确认按钮"
    /// </summary>
    public string ChineseDescription;

    /// <summary>
    /// GameObject 名称
    /// 示例: "@Btn_Confirm"
    /// </summary>
    public string GameObjectName;

    /// <summary>
    /// 组件实例引用 (用于预览和验证)
    /// </summary>
    public Component ComponentRef;

    /// <summary>
    /// 是否导出到描述文件
    /// </summary>
    public bool IsExport;

    /// <summary>
    /// 数据来源
    /// </summary>
    public DataSource Source;

    /// <summary>
    /// 是否已被用户手动编辑
    /// </summary>
    public bool IsManuallyEdited;
}

/// <summary>
/// 数据来源枚举
/// </summary>
public enum DataSource
{
    /// <summary>
    /// 新收集的组件 (从 Prefab 解析)
    /// </summary>
    NewlyCollected,

    /// <summary>
    /// 从已存在文件回现
    /// </summary>
    ExistingFile,

    /// <summary>
    /// 合并后的数据 (优先使用已存在文件的命名)
    /// </summary>
    Merged
}
```

#### 3.1.2 ToolConfig (工具配置)

```csharp
/// <summary>
/// 工具配置 - 定义命名规范和解析规则
/// </summary>
[Serializable]
public class ToolConfig
{
    // ========== 命名规范配置 ==========

    /// <summary>
    /// 收集前缀 (标记需要收集的 GameObject)
    /// 默认: "@"
    /// </summary>
    public string CollectPrefix = "@";

    /// <summary>
    /// 名称分隔符 (分隔组件类型缩写和描述)
    /// 默认: "_"
    /// </summary>
    public string NameSeparator = "_";

    /// <summary>
    /// C# 变量名前缀
    /// 默认: "m_"
    /// </summary>
    public string VariablePrefix = "m_";

    /// <summary>
    /// 是否在变量名末尾添加类型后缀
    /// 示例: true -> m_ConfirmBtn, false -> m_Confirm
    /// </summary>
    public bool AppendTypeSuffix = true;

    /// <summary>
    /// 组件类型缩写映射表
    /// Key: 缩写 (如 "Btn"), Value: C# 类型 (如 "ButtonEx")
    /// </summary>
    public Dictionary<string, string> TypeMapping = new Dictionary<string, string>
    {
        { "Btn", "ButtonEx" },
        { "Text", "Text" },
        { "Img", "Image" },
        { "RawImg", "RawImage" },
        { "Toggle", "Toggle" },
        { "Slider", "Slider" },
        { "InputField", "InputField" },
        { "Dropdown", "Dropdown" },
        { "ScrollRect", "ScrollRect" },
        { "Grid", "GridLayoutGroup" },
        { "Horizontal", "HorizontalLayoutGroup" },
        { "Vertical", "VerticalLayoutGroup" },
        { "GO", "GameObject" }
    };

    /// <summary>
    /// 默认组件类型 (当没有匹配到任何缩写时)
    /// </summary>
    public string DefaultType = "GameObject";

    // ========== 翻译配置 ==========

    /// <summary>
    /// 英文到中文的翻译映射表
    /// Key: 英文描述, Value: 中文描述
    /// </summary>
    public Dictionary<string, string> TranslationMapping = new Dictionary<string, string>
    {
        { "Confirm", "确认" },
        { "Cancel", "取消" },
        { "Close", "关闭" },
        { "Title", "标题" },
        { "Content", "内容" },
        { "Icon", "图标" }
        // ... 更多翻译
    };

    /// <summary>
    /// 是否自动翻译
    /// </summary>
    public bool AutoTranslate = true;

    // ========== 文件生成配置 ==========

    /// <summary>
    /// 默认命名空间
    /// </summary>
    public string DefaultNamespace = "BlackJack.ProjectEF.Runtime.GameView.UI";

    /// <summary>
    /// 基类名称
    /// </summary>
    public string BaseClassName = "PrefabControllerDescBase";

    /// <summary>
    /// 默认导出路径
    /// </summary>
    public string DefaultExportPath = "Assets/GameProject/Scripts/Runtime/GameView/UI/";

    /// <summary>
    /// 类名后缀
    /// 示例: Prefab 名为 "CatchFish", 生成类名为 "CatchFishUICtrlDesc"
    /// </summary>
    public string ClassNameSuffix = "UICtrlDesc";

    // ========== 必需命名空间 ==========

    /// <summary>
    /// 代码生成时必需的命名空间列表
    /// </summary>
    public List<string> RequiredNamespaces = new List<string>
    {
        "UnityEngine",
        "UnityEngine.UI",
        "BlackJack.BJFramework.Runtime"
    };
}
```

#### 3.1.3 MergeResult (合并结果)

```csharp
/// <summary>
/// 合并结果 - 包含合并后的数据和元信息
/// </summary>
public class MergeResult
{
    /// <summary>
    /// 合并后的组件列表 (主要数据)
    /// </summary>
    public List<ComponentInfo> MergedList;

    /// <summary>
    /// 新增的组件 (在 Prefab 中新增，但文件中不存在)
    /// </summary>
    public List<ComponentInfo> NewComponents;

    /// <summary>
    /// 已移除的字段 (在文件中存在，但 Prefab 中已删除)
    /// </summary>
    public List<FieldInfo> RemovedFields;

    /// <summary>
    /// 未改变的字段 (完全匹配)
    /// </summary>
    public List<ComponentInfo> UnchangedComponents;
}
```

#### 3.1.4 ValidationResult (校验结果)

```csharp
/// <summary>
/// 校验结果 - 包含所有校验错误和警告
/// </summary>
public class ValidationResult
{
    /// <summary>
    /// 是否通过校验
    /// </summary>
    public bool IsValid => Errors.Count == 0;

    /// <summary>
    /// 错误列表 (阻止生成)
    /// </summary>
    public List<ValidationError> Errors = new List<ValidationError>();

    /// <summary>
    /// 警告列表 (不阻止生成，但需提醒)
    /// </summary>
    public List<ValidationWarning> Warnings = new List<ValidationWarning>();
}

/// <summary>
/// 校验错误基类
/// </summary>
public abstract class ValidationError
{
    public string Message;
    public ComponentInfo RelatedComponent;
}

/// <summary>
/// 字段名冲突错误
/// </summary>
public class FieldNameConflict : ValidationError
{
    public List<ComponentInfo> ConflictingComponents;
}

/// <summary>
/// 无效路径错误
/// </summary>
public class InvalidPathError : ValidationError
{
    public string InvalidPath;
}
```

#### 3.1.5 CodeGenConfig (代码生成配置)

```csharp
/// <summary>
/// 代码生成配置
/// </summary>
public class CodeGenConfig
{
    /// <summary>
    /// 命名空间
    /// </summary>
    public string Namespace;

    /// <summary>
    /// 类名
    /// </summary>
    public string ClassName;

    /// <summary>
    /// 基类名
    /// </summary>
    public string BaseClassName;

    /// <summary>
    /// 必需命名空间列表
    /// </summary>
    public List<string> RequiredNamespaces;

    /// <summary>
    /// Prefab 资源路径 (用于 AutoGenAliasName 类特性)
    /// </summary>
    public string PrefabAssetPath;

    /// <summary>
    /// 控制器名称 (用于 AutoGenAliasName 类特性的第三个参数)
    /// </summary>
    public string ControllerName;
}
```

---

## 核心算法设计

### 4.1 组件收集算法

```csharp
/// <summary>
/// 组件收集算法实现
/// </summary>
public class ComponentCollector : IComponentCollector
{
    public List<ComponentInfo> CollectComponents(GameObject prefabRoot, ToolConfig config)
    {
        List<ComponentInfo> result = new List<ComponentInfo>();

        // 递归遍历所有子节点
        CollectRecursive(prefabRoot.transform, "", result, config);

        return result;
    }

    private void CollectRecursive(Transform current, string parentPath,
                                   List<ComponentInfo> result, ToolConfig config)
    {
        // 构建当前节点的完整路径
        string currentPath = string.IsNullOrEmpty(parentPath)
            ? current.name
            : $"{parentPath}/{current.name}";

        // 检查是否符合收集规范
        if (ShouldCollect(current.gameObject, config))
        {
            // 解析组件信息
            ComponentInfo info = ParseComponent(current.gameObject, currentPath, config);
            if (info != null)
            {
                result.Add(info);
            }
        }

        // 递归处理子节点
        for (int i = 0; i < current.childCount; i++)
        {
            CollectRecursive(current.GetChild(i), currentPath, result, config);
        }
    }

    public bool ShouldCollect(GameObject go, ToolConfig config)
    {
        // 检查名称是否以收集前缀开头
        return go.name.StartsWith(config.CollectPrefix);
    }

    private ComponentInfo ParseComponent(GameObject go, string fullPath, ToolConfig config)
    {
        // 使用 NameParser 解析名称
        INameParser parser = new NameParser();

        // 确定组件类型
        string typeAbbr = parser.ExtractTypeAbbreviation(go.name, config);
        string componentType = config.TypeMapping.ContainsKey(typeAbbr)
            ? config.TypeMapping[typeAbbr]
            : config.DefaultType;

        // 获取组件实例
        Component component = GetComponentByType(go, componentType);
        if (component == null && componentType != "GameObject")
        {
            Debug.LogWarning($"在 {go.name} 上未找到组件类型 {componentType}，将使用 GameObject");
            componentType = "GameObject";
        }

        // 解析字段信息
        FieldInfo fieldInfo = parser.ParseName(go.name, component, config);

        // 构建 ComponentInfo
        return new ComponentInfo
        {
            AliasPath = fullPath,
            ComponentType = componentType,
            FieldName = fieldInfo.FieldName,
            ChineseDescription = fieldInfo.ChineseDescription,
            GameObjectName = go.name,
            ComponentRef = component,
            IsExport = true,
            Source = DataSource.NewlyCollected,
            IsManuallyEdited = false
        };
    }

    private Component GetComponentByType(GameObject go, string typeName)
    {
        // 通过类型名称获取组件
        Type type = GetTypeByName(typeName);
        if (type == null) return null;

        return go.GetComponent(type);
    }

    private Type GetTypeByName(string typeName)
    {
        // 常见 UI 组件类型映射
        Dictionary<string, Type> typeMap = new Dictionary<string, Type>
        {
            { "ButtonEx", typeof(UnityEngine.UI.Button) }, // 假设 ButtonEx 继承自 Button
            { "Text", typeof(UnityEngine.UI.Text) },
            { "Image", typeof(UnityEngine.UI.Image) },
            { "RawImage", typeof(UnityEngine.UI.RawImage) },
            { "Toggle", typeof(UnityEngine.UI.Toggle) },
            { "Slider", typeof(UnityEngine.UI.Slider) },
            { "InputField", typeof(UnityEngine.UI.InputField) },
            { "Dropdown", typeof(UnityEngine.UI.Dropdown) },
            { "ScrollRect", typeof(UnityEngine.UI.ScrollRect) },
            { "GridLayoutGroup", typeof(UnityEngine.UI.GridLayoutGroup) },
            { "HorizontalLayoutGroup", typeof(UnityEngine.UI.HorizontalLayoutGroup) },
            { "VerticalLayoutGroup", typeof(UnityEngine.UI.VerticalLayoutGroup) },
            { "GameObject", typeof(GameObject) }
        };

        return typeMap.ContainsKey(typeName) ? typeMap[typeName] : null;
    }
}
```

### 4.2 命名解析算法

```csharp
/// <summary>
/// 命名解析算法实现
/// </summary>
public class NameParser : INameParser
{
    public FieldInfo ParseName(string gameObjectName, Component component, ToolConfig config)
    {
        // 移除收集前缀
        string nameWithoutPrefix = gameObjectName.TrimStart(config.CollectPrefix.ToCharArray());

        // 提取类型缩写和描述
        string typeAbbr = ExtractTypeAbbreviation(nameWithoutPrefix, config);
        string description = ExtractDescription(nameWithoutPrefix, config);

        // 生成 C# 变量名
        string fieldName = GenerateFieldName(description, typeAbbr, config);

        // 生成中文描述
        string chineseDesc = GenerateChineseDescription(description, config);

        return new FieldInfo
        {
            FieldName = fieldName,
            ChineseDescription = chineseDesc
        };
    }

    public string ExtractTypeAbbreviation(string gameObjectName, ToolConfig config)
    {
        // 移除前缀
        string nameWithoutPrefix = gameObjectName.TrimStart(config.CollectPrefix.ToCharArray());

        // 按分隔符分割
        string[] parts = nameWithoutPrefix.Split(new[] { config.NameSeparator },
                                                  StringSplitOptions.RemoveEmptyEntries);

        // 第一部分是类型缩写
        return parts.Length > 0 ? parts[0] : config.DefaultType;
    }

    public string ExtractDescription(string gameObjectName, ToolConfig config)
    {
        // 移除前缀
        string nameWithoutPrefix = gameObjectName.TrimStart(config.CollectPrefix.ToCharArray());

        // 按分隔符分割
        string[] parts = nameWithoutPrefix.Split(new[] { config.NameSeparator },
                                                  StringSplitOptions.RemoveEmptyEntries);

        // 第二部分及之后是描述
        if (parts.Length > 1)
        {
            return string.Join(config.NameSeparator, parts, 1, parts.Length - 1);
        }

        return parts.Length > 0 ? parts[0] : "";
    }

    private string GenerateFieldName(string description, string typeAbbr, ToolConfig config)
    {
        // 构建字段名: 前缀 + 描述 + 类型后缀
        StringBuilder sb = new StringBuilder();

        // 添加前缀
        sb.Append(config.VariablePrefix);

        // 添加描述 (首字母大写)
        sb.Append(CapitalizeFirstLetter(description));

        // 添加类型后缀
        if (config.AppendTypeSuffix)
        {
            sb.Append(typeAbbr);
        }

        return sb.ToString();
    }

    private string GenerateChineseDescription(string description, ToolConfig config)
    {
        if (!config.AutoTranslate)
        {
            return description;
        }

        // 尝试从翻译映射表中查找
        if (config.TranslationMapping.ContainsKey(description))
        {
            return config.TranslationMapping[description];
        }

        // 如果没有找到翻译，返回原始描述
        return description;
    }

    private string CapitalizeFirstLetter(string str)
    {
        if (string.IsNullOrEmpty(str)) return str;
        return char.ToUpper(str[0]) + str.Substring(1);
    }
}

/// <summary>
/// 字段信息 (中间数据结构)
/// </summary>
public class FieldInfo
{
    public string FieldName;
    public string ChineseDescription;
}
```

### 4.3 文件解析算法

```csharp
/// <summary>
/// 文件解析算法实现
/// </summary>
public class FileAnalyzer : IFileAnalyzer
{
    // 正则表达式模式: 匹配字段声明
    // [Header("中文描述")]
    // [AutoGenAliasName("路径")]
    // public ComponentType FieldName;
    private const string FieldPattern =
        @"\[Header\(""(?<ChineseDescription>.*?)""\)\]\s*" +
        @"\[AutoGenAliasName\(""(?<AliasPath>.*?)""\)\]\s*" +
        @"public\s+(?<ComponentType>\S+)\s+(?<FieldName>\w+)\s*;";

    private const string NamespacePattern = @"namespace\s+(?<Namespace>[\w\.]+)";

    private const string ClassPattern = @"public\s+class\s+(?<ClassName>\w+)\s*:";

    public Dictionary<string, FieldInfo> AnalyzeFile(string filePath)
    {
        if (!File.Exists(filePath))
        {
            return new Dictionary<string, FieldInfo>();
        }

        string fileContent = File.ReadAllText(filePath);
        Dictionary<string, FieldInfo> result = new Dictionary<string, FieldInfo>();

        // 使用正则表达式提取所有字段
        Regex regex = new Regex(FieldPattern, RegexOptions.Multiline);
        MatchCollection matches = regex.Matches(fileContent);

        foreach (Match match in matches)
        {
            string aliasPath = match.Groups["AliasPath"].Value;
            string fieldName = match.Groups["FieldName"].Value;
            string componentType = match.Groups["ComponentType"].Value;
            string chineseDesc = match.Groups["ChineseDescription"].Value;

            FieldInfo info = new FieldInfo
            {
                FieldName = fieldName,
                ComponentType = componentType,
                ChineseDescription = chineseDesc,
                AliasPath = aliasPath
            };

            // 使用 AliasPath 作为 Key
            if (!result.ContainsKey(aliasPath))
            {
                result.Add(aliasPath, info);
            }
        }

        return result;
    }

    public string ExtractNamespace(string filePath)
    {
        if (!File.Exists(filePath)) return "";

        string fileContent = File.ReadAllText(filePath);
        Regex regex = new Regex(NamespacePattern);
        Match match = regex.Match(fileContent);

        return match.Success ? match.Groups["Namespace"].Value : "";
    }

    public string ExtractClassName(string filePath)
    {
        if (!File.Exists(filePath)) return "";

        string fileContent = File.ReadAllText(filePath);
        Regex regex = new Regex(ClassPattern);
        Match match = regex.Match(fileContent);

        return match.Success ? match.Groups["ClassName"].Value : "";
    }

    public bool FileExists(string filePath)
    {
        return File.Exists(filePath);
    }
}

/// <summary>
/// 扩展的字段信息 (包含 AliasPath)
/// </summary>
public class FieldInfo
{
    public string FieldName;
    public string ComponentType;
    public string ChineseDescription;
    public string AliasPath;
}
```

### 4.4 数据合并算法

```csharp
/// <summary>
/// 数据合并算法实现
/// </summary>
public class DataMerger : IDataMerger
{
    public MergeResult Merge(List<ComponentInfo> currentList,
                             Dictionary<string, FieldInfo> existingDict)
    {
        MergeResult result = new MergeResult
        {
            MergedList = new List<ComponentInfo>(),
            NewComponents = new List<ComponentInfo>(),
            RemovedFields = new List<FieldInfo>(),
            UnchangedComponents = new List<ComponentInfo>()
        };

        // Step 1: 遍历当前组件列表
        foreach (ComponentInfo current in currentList)
        {
            if (existingDict.ContainsKey(current.AliasPath))
            {
                // 匹配成功: 使用已存在文件的字段信息
                FieldInfo existing = existingDict[current.AliasPath];

                ComponentInfo merged = new ComponentInfo
                {
                    AliasPath = current.AliasPath,
                    ComponentType = existing.ComponentType,  // 优先使用文件中的类型
                    FieldName = existing.FieldName,          // 优先使用文件中的变量名
                    ChineseDescription = existing.ChineseDescription,
                    GameObjectName = current.GameObjectName,
                    ComponentRef = current.ComponentRef,
                    IsExport = true,
                    Source = DataSource.Merged,
                    IsManuallyEdited = false
                };

                result.MergedList.Add(merged);
                result.UnchangedComponents.Add(merged);

                // 从字典中移除已处理的项
                existingDict.Remove(current.AliasPath);
            }
            else
            {
                // 匹配失败: 新增的组件
                current.Source = DataSource.NewlyCollected;
                result.MergedList.Add(current);
                result.NewComponents.Add(current);
            }
        }

        // Step 2: 处理已删除的字段
        foreach (var kvp in existingDict)
        {
            result.RemovedFields.Add(kvp.Value);
        }

        return result;
    }
}
```

### 4.5 代码生成算法

```csharp
/// <summary>
/// 代码生成算法实现
/// </summary>
public class CodeGenerator : ICodeGenerator
{
    public string GenerateCode(List<ComponentInfo> componentList, CodeGenConfig config)
    {
        StringBuilder sb = new StringBuilder();

        // 1. 生成文件头注释
        GenerateFileHeader(sb);

        // 2. 生成 using 语句
        GenerateUsingStatements(sb, config.RequiredNamespaces);

        // 3. 生成命名空间和类定义
        sb.AppendLine();
        sb.AppendLine($"namespace {config.Namespace}");
        sb.AppendLine("{");

        // 4. 生成类特性
        GenerateClassAttributes(sb, config);

        // 5. 生成类声明
        sb.AppendLine($"    public class {config.ClassName} : {config.BaseClassName}");
        sb.AppendLine("    {");

        // 6. 生成字段
        GenerateFields(sb, componentList);

        // 7. 关闭类和命名空间
        sb.AppendLine("    }");
        sb.AppendLine("}");

        return sb.ToString();
    }

    private void GenerateFileHeader(StringBuilder sb)
    {
        sb.AppendLine("// ========================================");
        sb.AppendLine("// Auto-generated by UI Prefab Automation Tool");
        sb.AppendLine($"// Generated at: {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
        sb.AppendLine("// DO NOT MODIFY THIS FILE MANUALLY!");
        sb.AppendLine("// ========================================");
        sb.AppendLine();
    }

    private void GenerateUsingStatements(StringBuilder sb, List<string> namespaces)
    {
        foreach (string ns in namespaces)
        {
            sb.AppendLine($"using {ns};");
        }
    }

    private void GenerateClassAttributes(StringBuilder sb, CodeGenConfig config)
    {
        sb.AppendLine($"    [AutoGenAliasName(\"{config.PrefabAssetPath}\", \"\", \"{config.ControllerName}\")]");
    }

    private void GenerateFields(StringBuilder sb, List<ComponentInfo> componentList)
    {
        // 过滤出需要导出的组件
        var exportList = componentList.Where(c => c.IsExport).ToList();

        for (int i = 0; i < exportList.Count; i++)
        {
            ComponentInfo info = exportList[i];

            // 生成 Header 特性
            sb.AppendLine($"        [Header(\"{info.ChineseDescription}\")]");

            // 生成 AutoGenAliasName 特性
            sb.AppendLine($"        [AutoGenAliasName(\"{info.AliasPath}\")]");

            // 生成字段声明
            sb.AppendLine($"        public {info.ComponentType} {info.FieldName};");

            // 添加空行 (最后一个字段除外)
            if (i < exportList.Count - 1)
            {
                sb.AppendLine();
            }
        }
    }

    public void WriteToFile(string code, string filePath)
    {
        // 确保目录存在
        string directory = Path.GetDirectoryName(filePath);
        if (!Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
        }

        // 写入文件
        File.WriteAllText(filePath, code, Encoding.UTF8);

        // 刷新 Unity 资源数据库
        AssetDatabase.Refresh();
    }
}
```

### 4.6 校验算法

```csharp
/// <summary>
/// 校验算法实现
/// </summary>
public class ValidationEngine : IValidationEngine
{
    public ValidationResult Validate(List<ComponentInfo> componentList, GameObject prefabRoot)
    {
        ValidationResult result = new ValidationResult();

        // 1. 检测变量名冲突
        var nameConflicts = DetectNameConflicts(componentList);
        result.Errors.AddRange(nameConflicts);

        // 2. 检测路径有效性
        var invalidPaths = ValidatePaths(componentList, prefabRoot);
        result.Errors.AddRange(invalidPaths);

        // 3. 检测空字段名
        var emptyFields = componentList.Where(c => string.IsNullOrWhiteSpace(c.FieldName)).ToList();
        foreach (var info in emptyFields)
        {
            result.Errors.Add(new ValidationError
            {
                Message = $"字段名为空: {info.GameObjectName}",
                RelatedComponent = info
            });
        }

        // 4. 检测空中文描述 (警告)
        var emptyDescriptions = componentList.Where(c => string.IsNullOrWhiteSpace(c.ChineseDescription)).ToList();
        foreach (var info in emptyDescriptions)
        {
            result.Warnings.Add(new ValidationWarning
            {
                Message = $"中文描述为空: {info.FieldName}",
                RelatedComponent = info
            });
        }

        return result;
    }

    public List<FieldNameConflict> DetectNameConflicts(List<ComponentInfo> componentList)
    {
        List<FieldNameConflict> conflicts = new List<FieldNameConflict>();

        // 按字段名分组
        var groups = componentList
            .Where(c => c.IsExport)
            .GroupBy(c => c.FieldName)
            .Where(g => g.Count() > 1);

        foreach (var group in groups)
        {
            conflicts.Add(new FieldNameConflict
            {
                Message = $"字段名冲突: {group.Key}",
                ConflictingComponents = group.ToList()
            });
        }

        return conflicts;
    }

    public List<InvalidPathError> ValidatePaths(List<ComponentInfo> componentList, GameObject prefabRoot)
    {
        List<InvalidPathError> errors = new List<InvalidPathError>();

        foreach (ComponentInfo info in componentList)
        {
            if (!IsPathValid(info.AliasPath, prefabRoot))
            {
                errors.Add(new InvalidPathError
                {
                    Message = $"路径无效: {info.AliasPath}",
                    InvalidPath = info.AliasPath,
                    RelatedComponent = info
                });
            }
        }

        return errors;
    }

    private bool IsPathValid(string path, GameObject prefabRoot)
    {
        // 移除根节点名称
        string relativePath = path.Replace(prefabRoot.name + "/", "");

        // 通过路径查找 GameObject
        Transform target = prefabRoot.transform.Find(relativePath);

        return target != null;
    }
}

public class ValidationWarning
{
    public string Message;
    public ComponentInfo RelatedComponent;
}
```

---

## Editor UI 设计

### 5.1 窗口布局

```
┌──────────────────────────────────────────────────────────┐
│  UI Prefab Automation Tool                               │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  A. Prefab 拖入区                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Drag & Drop Prefab Here                           │ │
│  │  Current: CatchFishUI.prefab                       │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  B. 控制台                                                │
│  [一键收集组件]  [生成/更新描述文件]  [校验]  [清空]       │
│                                                          │
│  C. 组件列表预览区                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │  ☑ GameObject Path    Type    Field Name   中文描述  │ │
│  │  ────────────────────────────────────────────────  │ │
│  │  ☑ Root/@Btn_Confirm  ButtonEx m_ConfirmBtn 确认按钮 │ │
│  │  ☑ Root/@Text_Title   Text     m_TitleText  标题文本 │ │
│  │  ☐ Root/@Img_Icon     Image    m_IconImg    图标    │ │
│  │  ... (ReorderableList)                              │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  D. 配置区 (可折叠)                                       │
│  ┌────────────────────────────────────────────────────┐ │
│  │  导出路径: [Assets/GameProject/Scripts/.../]        │ │
│  │  命名空间: [BlackJack.ProjectEF.Runtime.GameView.UI]│ │
│  │  类名前缀: [CatchFish]                              │ │
│  │  基类名:   [PrefabControllerDescBase]               │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  E. 状态栏                                                │
│  ┌────────────────────────────────────────────────────┐ │
│  │  收集到 15 个组件 | 新增 3 个 | 移除 1 个 | 准备就绪    │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 5.2 Editor Window 代码框架

```csharp
using UnityEngine;
using UnityEditor;
using UnityEditorInternal;
using System.Collections.Generic;

namespace BlackJack.ProjectEF.Editor.Tools
{
    /// <summary>
    /// UI Prefab 自动化工具主窗口
    /// </summary>
    public class UIPrefabToolEditorWindow : EditorWindow
    {
        // ========== 数据模型 ==========
        private GameObject m_currentPrefab;
        private List<ComponentInfo> m_componentList = new List<ComponentInfo>();
        private ToolConfig m_config;
        private MergeResult m_mergeResult;
        private ValidationResult m_validationResult;

        // ========== UI 组件 ==========
        private ReorderableList m_reorderableList;
        private Vector2 m_scrollPosition;
        private bool m_showConfig = true;

        // ========== 业务逻辑模块 ==========
        private IComponentCollector m_collector;
        private INameParser m_parser;
        private IFileAnalyzer m_fileAnalyzer;
        private IDataMerger m_dataMerger;
        private ICodeGenerator m_codeGenerator;
        private IValidationEngine m_validationEngine;

        // ========== 窗口初始化 ==========

        [MenuItem("Tools/UI Prefab Automation Tool")]
        public static void ShowWindow()
        {
            var window = GetWindow<UIPrefabToolEditorWindow>("UI Prefab Tool");
            window.minSize = new Vector2(800, 600);
            window.Show();
        }

        private void OnEnable()
        {
            InitializeModules();
            LoadConfig();
            InitializeReorderableList();
        }

        private void InitializeModules()
        {
            m_collector = new ComponentCollector();
            m_parser = new NameParser();
            m_fileAnalyzer = new FileAnalyzer();
            m_dataMerger = new DataMerger();
            m_codeGenerator = new CodeGenerator();
            m_validationEngine = new ValidationEngine();
        }

        private void LoadConfig()
        {
            // 从 EditorPrefs 或配置文件加载
            m_config = new ToolConfig();
            // TODO: 实现配置加载逻辑
        }

        private void InitializeReorderableList()
        {
            m_reorderableList = new ReorderableList(m_componentList, typeof(ComponentInfo),
                                                     true, true, false, true);

            m_reorderableList.drawHeaderCallback = DrawListHeader;
            m_reorderableList.drawElementCallback = DrawListElement;
            m_reorderableList.onRemoveCallback = OnRemoveElement;
        }

        // ========== GUI 绘制 ==========

        private void OnGUI()
        {
            EditorGUILayout.BeginVertical();

            DrawPrefabDropArea();
            DrawControlPanel();
            DrawComponentList();
            DrawConfigArea();
            DrawStatusBar();

            EditorGUILayout.EndVertical();
        }

        private void DrawPrefabDropArea()
        {
            EditorGUILayout.Space(10);
            EditorGUILayout.LabelField("A. Prefab 拖入区", EditorStyles.boldLabel);

            Rect dropArea = GUILayoutUtility.GetRect(0, 60, GUILayout.ExpandWidth(true));
            GUI.Box(dropArea, "Drag & Drop Prefab Here");

            // 显示当前 Prefab
            if (m_currentPrefab != null)
            {
                EditorGUI.BeginDisabledGroup(true);
                EditorGUILayout.ObjectField("Current Prefab", m_currentPrefab,
                                           typeof(GameObject), false);
                EditorGUI.EndDisabledGroup();
            }

            // 处理拖拽事件
            HandleDragAndDrop(dropArea);
        }

        private void HandleDragAndDrop(Rect dropArea)
        {
            Event evt = Event.current;

            if (dropArea.Contains(evt.mousePosition))
            {
                if (evt.type == EventType.DragUpdated)
                {
                    DragAndDrop.visualMode = DragAndDropVisualMode.Copy;
                    evt.Use();
                }
                else if (evt.type == EventType.DragPerform)
                {
                    DragAndDrop.AcceptDrag();

                    foreach (Object obj in DragAndDrop.objectReferences)
                    {
                        if (obj is GameObject go)
                        {
                            LoadPrefab(go);
                            break;
                        }
                    }

                    evt.Use();
                }
            }
        }

        private void DrawControlPanel()
        {
            EditorGUILayout.Space(10);
            EditorGUILayout.LabelField("B. 控制台", EditorStyles.boldLabel);

            EditorGUILayout.BeginHorizontal();

            if (GUILayout.Button("一键收集组件", GUILayout.Height(30)))
            {
                CollectComponents();
            }

            if (GUILayout.Button("生成/更新描述文件", GUILayout.Height(30)))
            {
                GenerateDescriptionFile();
            }

            if (GUILayout.Button("校验", GUILayout.Height(30)))
            {
                ValidateComponents();
            }

            if (GUILayout.Button("清空", GUILayout.Height(30)))
            {
                ClearAll();
            }

            EditorGUILayout.EndHorizontal();
        }

        private void DrawComponentList()
        {
            EditorGUILayout.Space(10);
            EditorGUILayout.LabelField("C. 组件列表预览区", EditorStyles.boldLabel);

            if (m_reorderableList != null)
            {
                m_scrollPosition = EditorGUILayout.BeginScrollView(m_scrollPosition,
                                                                    GUILayout.Height(300));
                m_reorderableList.DoLayoutList();
                EditorGUILayout.EndScrollView();
            }
        }

        private void DrawListHeader(Rect rect)
        {
            float x = rect.x;
            EditorGUI.LabelField(new Rect(x, rect.y, 30, rect.height), "导出");
            x += 35;
            EditorGUI.LabelField(new Rect(x, rect.y, 200, rect.height), "GameObject Path");
            x += 205;
            EditorGUI.LabelField(new Rect(x, rect.y, 100, rect.height), "Type");
            x += 105;
            EditorGUI.LabelField(new Rect(x, rect.y, 150, rect.height), "Field Name");
            x += 155;
            EditorGUI.LabelField(new Rect(x, rect.y, 150, rect.height), "中文描述");
        }

        private void DrawListElement(Rect rect, int index, bool isActive, bool isFocused)
        {
            if (index >= m_componentList.Count) return;

            ComponentInfo info = m_componentList[index];
            float x = rect.x;

            // 导出复选框
            info.IsExport = EditorGUI.Toggle(new Rect(x, rect.y, 30, rect.height), info.IsExport);
            x += 35;

            // GameObject Path
            EditorGUI.LabelField(new Rect(x, rect.y, 200, rect.height), info.AliasPath);
            x += 205;

            // Component Type
            EditorGUI.LabelField(new Rect(x, rect.y, 100, rect.height), info.ComponentType);
            x += 105;

            // Field Name (可编辑)
            string newFieldName = EditorGUI.TextField(new Rect(x, rect.y, 150, rect.height),
                                                       info.FieldName);
            if (newFieldName != info.FieldName)
            {
                info.FieldName = newFieldName;
                info.IsManuallyEdited = true;
            }
            x += 155;

            // 中文描述 (可编辑)
            string newDesc = EditorGUI.TextField(new Rect(x, rect.y, 150, rect.height),
                                                  info.ChineseDescription);
            if (newDesc != info.ChineseDescription)
            {
                info.ChineseDescription = newDesc;
                info.IsManuallyEdited = true;
            }
        }

        private void OnRemoveElement(ReorderableList list)
        {
            if (EditorUtility.DisplayDialog("确认删除",
                "确定要删除选中的组件吗?", "删除", "取消"))
            {
                m_componentList.RemoveAt(list.index);
            }
        }

        private void DrawConfigArea()
        {
            EditorGUILayout.Space(10);
            m_showConfig = EditorGUILayout.Foldout(m_showConfig, "D. 配置区", true);

            if (m_showConfig)
            {
                EditorGUI.indentLevel++;

                m_config.DefaultExportPath = EditorGUILayout.TextField("导出路径",
                                                                       m_config.DefaultExportPath);
                m_config.DefaultNamespace = EditorGUILayout.TextField("命名空间",
                                                                      m_config.DefaultNamespace);
                m_config.BaseClassName = EditorGUILayout.TextField("基类名",
                                                                   m_config.BaseClassName);
                m_config.CollectPrefix = EditorGUILayout.TextField("收集前缀",
                                                                   m_config.CollectPrefix);
                m_config.NameSeparator = EditorGUILayout.TextField("名称分隔符",
                                                                   m_config.NameSeparator);
                m_config.VariablePrefix = EditorGUILayout.TextField("变量名前缀",
                                                                    m_config.VariablePrefix);
                m_config.AppendTypeSuffix = EditorGUILayout.Toggle("添加类型后缀",
                                                                   m_config.AppendTypeSuffix);

                EditorGUI.indentLevel--;
            }
        }

        private void DrawStatusBar()
        {
            EditorGUILayout.Space(10);
            EditorGUILayout.LabelField("E. 状态栏", EditorStyles.boldLabel);

            string statusText = $"收集到 {m_componentList.Count} 个组件";

            if (m_mergeResult != null)
            {
                statusText += $" | 新增 {m_mergeResult.NewComponents.Count} 个";
                statusText += $" | 移除 {m_mergeResult.RemovedFields.Count} 个";
            }

            if (m_validationResult != null)
            {
                if (m_validationResult.IsValid)
                {
                    statusText += " | 准备就绪";
                }
                else
                {
                    statusText += $" | 错误 {m_validationResult.Errors.Count} 个";
                }
            }

            EditorGUILayout.HelpBox(statusText, MessageType.Info);
        }

        // ========== 业务逻辑 ==========

        private void LoadPrefab(GameObject prefab)
        {
            m_currentPrefab = prefab;
            m_componentList.Clear();
            m_mergeResult = null;
            m_validationResult = null;

            Repaint();
        }

        private void CollectComponents()
        {
            if (m_currentPrefab == null)
            {
                EditorUtility.DisplayDialog("错误", "请先拖入 Prefab!", "确定");
                return;
            }

            // 收集组件
            List<ComponentInfo> currentList = m_collector.CollectComponents(m_currentPrefab, m_config);

            // 检查已存在文件
            string fileName = m_currentPrefab.name + m_config.ClassNameSuffix + ".cs";
            string filePath = m_config.DefaultExportPath + fileName;

            if (m_fileAnalyzer.FileExists(filePath))
            {
                // 解析已存在文件
                Dictionary<string, FieldInfo> existingDict = m_fileAnalyzer.AnalyzeFile(filePath);

                // 合并数据
                m_mergeResult = m_dataMerger.Merge(currentList, existingDict);
                m_componentList = m_mergeResult.MergedList;

                // 显示合并报告
                ShowMergeReport();
            }
            else
            {
                // 直接使用收集到的数据
                m_componentList = currentList;
            }

            // 刷新列表
            m_reorderableList.list = m_componentList;
            Repaint();
        }

        private void ValidateComponents()
        {
            if (m_componentList.Count == 0)
            {
                EditorUtility.DisplayDialog("提示", "组件列表为空!", "确定");
                return;
            }

            m_validationResult = m_validationEngine.Validate(m_componentList, m_currentPrefab);

            if (m_validationResult.IsValid)
            {
                EditorUtility.DisplayDialog("校验通过", "所有数据校验通过!", "确定");
            }
            else
            {
                ShowValidationErrors();
            }

            Repaint();
        }

        private void GenerateDescriptionFile()
        {
            // 先校验
            ValidateComponents();

            if (!m_validationResult.IsValid)
            {
                EditorUtility.DisplayDialog("错误",
                    $"数据校验失败,存在 {m_validationResult.Errors.Count} 个错误!", "确定");
                return;
            }

            // 构建代码生成配置
            string prefabAssetPath = AssetDatabase.GetAssetPath(m_currentPrefab);
            string className = m_currentPrefab.name + m_config.ClassNameSuffix;
            string controllerName = m_currentPrefab.name + "UIController";

            CodeGenConfig genConfig = new CodeGenConfig
            {
                Namespace = m_config.DefaultNamespace,
                ClassName = className,
                BaseClassName = m_config.BaseClassName,
                RequiredNamespaces = m_config.RequiredNamespaces,
                PrefabAssetPath = prefabAssetPath,
                ControllerName = controllerName
            };

            // 生成代码
            string code = m_codeGenerator.GenerateCode(m_componentList, genConfig);

            // 写入文件
            string fileName = className + ".cs";
            string filePath = m_config.DefaultExportPath + fileName;

            m_codeGenerator.WriteToFile(code, filePath);

            EditorUtility.DisplayDialog("成功", $"描述文件已生成:\n{filePath}", "确定");
        }

        private void ClearAll()
        {
            m_currentPrefab = null;
            m_componentList.Clear();
            m_mergeResult = null;
            m_validationResult = null;

            Repaint();
        }

        private void ShowMergeReport()
        {
            string report = "合并报告:\n\n";
            report += $"新增组件: {m_mergeResult.NewComponents.Count} 个\n";
            report += $"未改变组件: {m_mergeResult.UnchangedComponents.Count} 个\n";
            report += $"已移除字段: {m_mergeResult.RemovedFields.Count} 个\n";

            if (m_mergeResult.RemovedFields.Count > 0)
            {
                report += "\n已移除字段列表:\n";
                foreach (var field in m_mergeResult.RemovedFields)
                {
                    report += $"  - {field.FieldName} ({field.AliasPath})\n";
                }
            }

            EditorUtility.DisplayDialog("合并完成", report, "确定");
        }

        private void ShowValidationErrors()
        {
            string errors = "校验错误:\n\n";

            foreach (var error in m_validationResult.Errors)
            {
                errors += $"- {error.Message}\n";
            }

            EditorUtility.DisplayDialog("校验失败", errors, "确定");
        }
    }
}
```

---

## 配置系统设计

### 6.1 配置持久化

使用 `EditorPrefs` 或 `ScriptableObject` 保存配置。

#### 方案 1: EditorPrefs (简单)

```csharp
public class ToolConfigManager
{
    private const string CONFIG_KEY = "UIPrefabTool_Config";

    public static void SaveConfig(ToolConfig config)
    {
        string json = JsonUtility.ToJson(config);
        EditorPrefs.SetString(CONFIG_KEY, json);
    }

    public static ToolConfig LoadConfig()
    {
        if (EditorPrefs.HasKey(CONFIG_KEY))
        {
            string json = EditorPrefs.GetString(CONFIG_KEY);
            return JsonUtility.FromJson<ToolConfig>(json);
        }

        return new ToolConfig(); // 返回默认配置
    }
}
```

#### 方案 2: ScriptableObject (推荐)

```csharp
/// <summary>
/// 工具配置资源
/// </summary>
[CreateAssetMenu(fileName = "UIPrefabToolConfig",
                 menuName = "Tools/UI Prefab Tool Config")]
public class ToolConfigAsset : ScriptableObject
{
    public ToolConfig Config = new ToolConfig();
}
```

在 Editor Window 中加载:

```csharp
private ToolConfigAsset m_configAsset;

private void LoadConfig()
{
    string[] guids = AssetDatabase.FindAssets("t:ToolConfigAsset");
    if (guids.Length > 0)
    {
        string path = AssetDatabase.GUIDToAssetPath(guids[0]);
        m_configAsset = AssetDatabase.LoadAssetAtPath<ToolConfigAsset>(path);
        m_config = m_configAsset.Config;
    }
    else
    {
        m_config = new ToolConfig();
    }
}
```

### 6.2 类型映射配置

支持用户自定义组件类型映射:

```csharp
/// <summary>
/// 组件类型映射配置
/// </summary>
[Serializable]
public class ComponentTypeMapping
{
    public string Abbreviation; // 缩写
    public string FullTypeName; // 完整类型名
    public string AssemblyName; // 程序集名称 (可选)
}

// 在 ToolConfig 中使用
public List<ComponentTypeMapping> CustomTypeMappings = new List<ComponentTypeMapping>();
```

---

## 文件解析与生成策略

### 7.1 正则表达式优化

针对不同的代码格式,提供多个正则表达式模式:

```csharp
public class RegexPatterns
{
    // 标准格式: 单行特性
    public const string PATTERN_SINGLE_LINE =
        @"\[Header\(""(?<ChineseDescription>.*?)""\)\]\s*" +
        @"\[AutoGenAliasName\(""(?<AliasPath>.*?)""\)\]\s*" +
        @"public\s+(?<ComponentType>\S+)\s+(?<FieldName>\w+)\s*;";

    // 多行格式
    public const string PATTERN_MULTI_LINE =
        @"\[Header\(""(?<ChineseDescription>.*?)""\)\]\s*" +
        @"\[AutoGenAliasName\(""(?<AliasPath>.*?)""\)\]\s*" +
        @"public\s+(?<ComponentType>\S+)\s+(?<FieldName>\w+)\s*;";

    // 命名空间提取
    public const string PATTERN_NAMESPACE =
        @"namespace\s+(?<Namespace>[\w\.]+)";

    // 类名提取
    public const string PATTERN_CLASS =
        @"public\s+class\s+(?<ClassName>\w+)\s*:\s*(?<BaseClass>\w+)";
}
```

### 7.2 增量更新策略

当文件已存在时,采用增量更新策略:

1. **保留已存在字段**: 不修改已有字段的顺序和内容
2. **追加新字段**: 将新增字段添加到末尾
3. **标记已删除字段**: 用注释标记 (可选)

```csharp
public class IncrementalCodeGenerator : ICodeGenerator
{
    public string GenerateCode(List<ComponentInfo> componentList, CodeGenConfig config)
    {
        // 检查文件是否存在
        string filePath = config.OutputPath;

        if (File.Exists(filePath))
        {
            // 增量更新
            return UpdateExistingFile(filePath, componentList, config);
        }
        else
        {
            // 完整生成
            return GenerateNewFile(componentList, config);
        }
    }

    private string UpdateExistingFile(string filePath, List<ComponentInfo> componentList,
                                       CodeGenConfig config)
    {
        // 读取现有文件
        string existingCode = File.ReadAllText(filePath);

        // 提取现有字段区域
        int fieldsStart = existingCode.IndexOf("public class");
        int fieldsEnd = existingCode.LastIndexOf("}");

        // 生成新字段代码
        StringBuilder newFields = new StringBuilder();
        GenerateFields(newFields, componentList);

        // 替换字段区域
        string updatedCode = existingCode.Substring(0, fieldsStart);
        updatedCode += GenerateClassHeader(config);
        updatedCode += newFields.ToString();
        updatedCode += "    }\n}";

        return updatedCode;
    }

    private string GenerateNewFile(List<ComponentInfo> componentList, CodeGenConfig config)
    {
        // 完整生成逻辑 (同之前的 CodeGenerator)
        // ...
    }
}
```

---

## 测试策略

### 8.1 单元测试

针对核心模块编写单元测试:

```csharp
using NUnit.Framework;
using UnityEngine;

namespace BlackJack.ProjectEF.Editor.Tools.Tests
{
    [TestFixture]
    public class NameParserTests
    {
        private NameParser m_parser;
        private ToolConfig m_config;

        [SetUp]
        public void Setup()
        {
            m_parser = new NameParser();
            m_config = new ToolConfig();
        }

        [Test]
        public void ParseName_StandardFormat_ReturnsCorrectFieldName()
        {
            // Arrange
            string gameObjectName = "@Btn_Confirm";

            // Act
            string typeAbbr = m_parser.ExtractTypeAbbreviation(gameObjectName, m_config);
            string description = m_parser.ExtractDescription(gameObjectName, m_config);

            // Assert
            Assert.AreEqual("Btn", typeAbbr);
            Assert.AreEqual("Confirm", description);
        }

        [Test]
        public void ParseName_MultiPartDescription_ReturnsCorrectFieldName()
        {
            // Arrange
            string gameObjectName = "@Text_Fish_Type_Name";

            // Act
            string description = m_parser.ExtractDescription(gameObjectName, m_config);

            // Assert
            Assert.AreEqual("Fish_Type_Name", description);
        }

        [Test]
        public void GenerateFieldName_WithTypeSuffix_ReturnsCorrectName()
        {
            // Arrange
            m_config.AppendTypeSuffix = true;
            string description = "Confirm";
            string typeAbbr = "Btn";

            // Act
            string fieldName = GenerateFieldName(description, typeAbbr, m_config);

            // Assert
            Assert.AreEqual("m_ConfirmBtn", fieldName);
        }
    }

    [TestFixture]
    public class ComponentCollectorTests
    {
        [Test]
        public void CollectComponents_ValidPrefab_ReturnsCorrectCount()
        {
            // TODO: 创建测试 Prefab,验证收集逻辑
        }
    }

    [TestFixture]
    public class DataMergerTests
    {
        [Test]
        public void Merge_NewComponent_AddsToNewList()
        {
            // TODO: 测试合并逻辑
        }
    }
}
```

### 8.2 集成测试

创建测试 Prefab 和预期输出文件,进行端到端测试:

```csharp
[TestFixture]
public class IntegrationTests
{
    [Test]
    public void EndToEnd_GenerateDescriptionFile_MatchesExpectedOutput()
    {
        // Arrange
        GameObject testPrefab = AssetDatabase.LoadAssetAtPath<GameObject>(
            "Assets/Tests/TestPrefabs/SampleUI.prefab");

        ToolConfig config = new ToolConfig();

        // Act
        ComponentCollector collector = new ComponentCollector();
        List<ComponentInfo> components = collector.CollectComponents(testPrefab, config);

        CodeGenConfig genConfig = new CodeGenConfig
        {
            Namespace = "Test",
            ClassName = "SampleUICtrlDesc",
            BaseClassName = "PrefabControllerDescBase",
            RequiredNamespaces = new List<string> { "UnityEngine", "UnityEngine.UI" },
            PrefabAssetPath = "Assets/Tests/TestPrefabs/SampleUI.prefab",
            ControllerName = "SampleUIController"
        };

        CodeGenerator generator = new CodeGenerator();
        string generatedCode = generator.GenerateCode(components, genConfig);

        // Assert
        string expectedCode = File.ReadAllText("Assets/Tests/ExpectedOutput/SampleUICtrlDesc.cs");

        Assert.AreEqual(NormalizeCode(expectedCode), NormalizeCode(generatedCode));
    }

    private string NormalizeCode(string code)
    {
        // 移除空白字符差异
        return code.Replace("\r\n", "\n").Replace("\t", "    ").Trim();
    }
}
```

---

## 开发计划

### 9.1 开发阶段

| 阶段 | 任务 | 优先级 | 预估时间 |
|------|------|--------|---------|
| **Phase 1: 核心功能** | | | |
| 1.1 | 数据结构定义 | 高 | 0.5 天 |
| 1.2 | ComponentCollector 实现 | 高 | 1 天 |
| 1.3 | NameParser 实现 | 高 | 1 天 |
| 1.4 | FileAnalyzer 实现 | 高 | 1.5 天 |
| 1.5 | DataMerger 实现 | 高 | 1 天 |
| 1.6 | CodeGenerator 实现 | 高 | 1.5 天 |
| 1.7 | ValidationEngine 实现 | 高 | 1 天 |
| **Phase 2: Editor UI** | | | |
| 2.1 | 基础窗口框架 | 高 | 1 天 |
| 2.2 | Prefab 拖拽区实现 | 高 | 0.5 天 |
| 2.3 | ReorderableList 实现 | 高 | 1 天 |
| 2.4 | 配置面板实现 | 中 | 0.5 天 |
| 2.5 | 状态栏实现 | 低 | 0.5 天 |
| **Phase 3: 配置系统** | | | |
| 3.1 | ToolConfig ScriptableObject | 中 | 0.5 天 |
| 3.2 | 配置加载/保存 | 中 | 0.5 天 |
| 3.3 | 自定义类型映射 | 中 | 1 天 |
| **Phase 4: 高级功能** | | | |
| 4.1 | Hierarchy 标记功能 (F7) | 中 | 1.5 天 |
| 4.2 | 增量更新策略 | 中 | 1 天 |
| 4.3 | 批量处理功能 | 低 | 1 天 |
| **Phase 5: 测试与优化** | | | |
| 5.1 | 单元测试 | 高 | 2 天 |
| 5.2 | 集成测试 | 中 | 1 天 |
| 5.3 | 性能优化 | 中 | 1 天 |
| 5.4 | 文档编写 | 中 | 1 天 |

**总计**: 约 20 天 (假设每天 6 小时有效开发时间)

### 9.2 里程碑

- **Milestone 1** (Day 7): 核心功能完成,可以收集组件并生成基础描述文件
- **Milestone 2** (Day 12): Editor UI 完成,可以通过窗口操作
- **Milestone 3** (Day 15): 配置系统完成,支持自定义规则
- **Milestone 4** (Day 18): 高级功能完成,支持增量更新和 Hierarchy 标记
- **Milestone 5** (Day 20): 测试完成,工具可发布

### 9.3 风险管理

| 风险 | 概率 | 影响 | 应对策略 |
|------|------|------|---------|
| 正则表达式解析失败 | 中 | 高 | 使用 Roslyn 语法分析器备选方案 |
| Unity API 变更 | 低 | 中 | 使用稳定的 Unity API,做版本兼容 |
| 性能问题 (大型 Prefab) | 中 | 中 | 异步处理 + 进度条 |
| 用户配置冲突 | 低 | 低 | 提供配置导入/导出功能 |

---

## 附录

### A. 命名规范示例

| GameObject 名称 | 组件类型 | 生成的字段名 | 中文描述 |
|----------------|---------|------------|---------|
| @Btn_Confirm | ButtonEx | m_ConfirmBtn | 确认按钮 |
| @Text_Title | Text | m_TitleText | 标题文本 |
| @Img_Icon | Image | m_IconImg | 图标图片 |
| @Toggle_Sound | Toggle | m_SoundToggle | 声音开关 |
| @InputField_Name | InputField | m_NameInputField | 姓名输入框 |
| @GO_Container | GameObject | m_ContainerGO | 容器对象 |

### B. 生成的代码示例

```csharp
// ========================================
// Auto-generated by UI Prefab Automation Tool
// Generated at: 2025-11-01 14:30:00
// DO NOT MODIFY THIS FILE MANUALLY!
// ========================================

using UnityEngine;
using UnityEngine.UI;
using BlackJack.BJFramework.Runtime;

namespace BlackJack.ProjectEF.Runtime.GameView.UI.CatchFish
{
    [AutoGenAliasName("Assets/GameProject/Resources/UI/CatchFishUI.prefab", "", "CatchFishUIController")]
    public class CatchFishUICtrlDesc : PrefabControllerDescBase
    {
        [Header("确认按钮")]
        [AutoGenAliasName("Root/Panel/@Btn_Confirm")]
        public ButtonEx m_ConfirmBtn;

        [Header("标题文本")]
        [AutoGenAliasName("Root/Panel/@Text_Title")]
        public Text m_TitleText;

        [Header("图标图片")]
        [AutoGenAliasName("Root/Panel/@Img_Icon")]
        public Image m_IconImg;
    }
}
```

### C. 配置文件示例 (JSON)

```json
{
    "CollectPrefix": "@",
    "NameSeparator": "_",
    "VariablePrefix": "m_",
    "AppendTypeSuffix": true,
    "DefaultType": "GameObject",
    "DefaultNamespace": "BlackJack.ProjectEF.Runtime.GameView.UI",
    "BaseClassName": "PrefabControllerDescBase",
    "DefaultExportPath": "Assets/GameProject/Scripts/Runtime/GameView/UI/",
    "ClassNameSuffix": "UICtrlDesc",
    "TypeMapping": {
        "Btn": "ButtonEx",
        "Text": "Text",
        "Img": "Image",
        "RawImg": "RawImage",
        "Toggle": "Toggle",
        "Slider": "Slider",
        "InputField": "InputField",
        "Dropdown": "Dropdown",
        "ScrollRect": "ScrollRect",
        "Grid": "GridLayoutGroup",
        "Horizontal": "HorizontalLayoutGroup",
        "Vertical": "VerticalLayoutGroup",
        "GO": "GameObject"
    },
    "TranslationMapping": {
        "Confirm": "确认",
        "Cancel": "取消",
        "Close": "关闭",
        "Title": "标题",
        "Content": "内容",
        "Icon": "图标"
    },
    "AutoTranslate": true,
    "RequiredNamespaces": [
        "UnityEngine",
        "UnityEngine.UI",
        "BlackJack.BJFramework.Runtime"
    ]
}
```

---

## 总结

本设计方案基于 BJFramework 的架构理念,采用分层设计和模块化思想,实现了一个完整的 UI Prefab 自动化工具。核心特点:

1. **清晰的职责划分**: 每个模块单一职责,易于维护和扩展
2. **灵活的配置系统**: 支持自定义命名规范和类型映射
3. **智能的数据合并**: 尊重手动修改,支持增量更新
4. **完善的校验机制**: 防止生成错误的代码
5. **友好的用户界面**: 直观的操作流程,提高效率

通过该工具,可以大幅提升 UI 开发效率,减少手动编写描述文件的工作量,同时保证代码的一致性和规范性。
