# Unity UI Prefab 组件自动化工具 - 详细技术设计方案 V2

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

## 更新说明 (V2)

**核心改进**：

### 1. 支持非规范命名的美术资源

在实际项目中，美术资源可能没有按照 `@[类型缩写]_[描述]` 的命名规范。V2 版本新增：

#### 双模式支持
- **规范模式** (Strict Mode)：严格按照命名规范收集（仅收集带 `@` 前缀的节点）
- **回退模式** (Fallback Mode)：按指定组件类型全局收集
- **混合模式** (Hybrid Mode)：优先规范，补充回退

#### 智能命名
- 规范模式：`@Btn_Confirm` → `m_ConfirmBtn`
- 回退模式：`ConfirmButton` (Button组件) → `m_ConfirmButtonBtn`
- Smart 策略：`ConfirmButton` → `m_ConfirmBtn`（识别并移除类型关键词）

#### 灵活配置
- 用户可配置要收集的组件类型列表
- 支持模式混合使用（优先规范，补充回退）

### 2. 批量操作功能

支持灵活的导出选择：

- **全选/全不选/反选** - 快速批量操作
- **按类型筛选** - 只导出特定类型组件（如只要 Button）
- **按模式筛选** - 只导出规范/回退模式的组件

### 3. 特殊组件额外字段导出 ⭐ NEW

对于特殊类型组件（如状态机、下拉框等），支持导出额外信息作为常量字段。

#### 示例：AdvanceUIStateController

**收集到的组件**：
```csharp
public AdvanceUIStateController m_catchFishUIStateController;
```

**自动导出状态列表**：
```csharp
/// <summary>
/// CatchFishUI 状态列表
/// </summary>
public static readonly List<string> m_catchFishUIStateList = new List<string>
{
    "Close", "Show", "Fishing", "Result"
};
```

#### 核心特性
- **插件式架构** - 通过 `ISpecialComponentProcessor` 接口扩展
- **自动提取** - 通过反射/序列化自动提取组件数据
- **可配置** - 支持启用/禁用特定处理器
- **可编辑** - UI 支持手动编辑额外字段值

详细设计见: `UI_Prefab_Tool_Special_Component_Feature.md`

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
│  - CollectionModeSelector (NEW)                │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  Business Logic Layer                          │
│  - ComponentCollector (支持双模式)              │
│  - NameParser (支持双模式命名)                   │
│  - CodeGenerator                               │
│  - FileAnalyzer                                │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  Data Layer                                    │
│  - ComponentInfoDataModel                      │
│  - ToolConfigDataModel (新增模式配置)            │
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
- **向后兼容**: 规范模式和回退模式可混合使用

---

## 核心模块设计

### 2.1 模块划分

| 模块名称 | 职责 | 输入 | 输出 |
|---------|------|------|------|
| **ComponentCollector** | 扫描 Prefab，收集符合规范的组件（支持双模式） | GameObject (Prefab Root) + CollectionMode | List\<ComponentInfo\> |
| **NameParser** | 解析 GameObject 名称，生成字段信息（支持双模式） | GameObject.name + Component + Mode | FieldInfo |
| **FileAnalyzer** | 解析已存在的 C# 描述文件 | File Path | Dictionary\<AliasPath, FieldInfo\> |
| **DataMerger** | 合并 Prefab 数据与已存在文件数据 | CurrentList + ExistingDict | MergedList |
| **CodeGenerator** | 生成/更新 C# 描述文件 | MergedList + Config | C# File |
| **ValidationEngine** | 校验数据完整性与冲突 | MergedList | ValidationResult |
| **HierarchyDecorator** | 在 Hierarchy 中标记已引用对象 | Active Prefab + CtrlDesc Files | Visual Marks |

### 2.2 模块接口定义

#### 2.2.1 ComponentCollector (更新)

```csharp
/// <summary>
/// 组件收集器 - 负责从 Prefab 中提取组件（支持双模式）
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
    /// 判断 GameObject 是否符合收集规范（规范模式）
    /// </summary>
    bool ShouldCollectByNamingConvention(GameObject go, ToolConfig config);

    /// <summary>
    /// 判断 GameObject 上的组件是否符合收集条件（回退模式）
    /// </summary>
    bool ShouldCollectByComponentType(Component component, ToolConfig config);
}
```

#### 2.2.2 NameParser (更新)

```csharp
/// <summary>
/// 命名解析器 - 将 GameObject 名称解析为 C# 字段信息（支持双模式）
/// </summary>
public interface INameParser
{
    /// <summary>
    /// 解析 GameObject 名称，生成字段信息
    /// </summary>
    /// <param name="gameObjectName">GameObject 完整名称</param>
    /// <param name="component">组件实例</param>
    /// <param name="config">解析配置</param>
    /// <param name="mode">解析模式</param>
    /// <returns>字段信息</returns>
    FieldInfo ParseName(string gameObjectName, Component component,
                        ToolConfig config, CollectionMode mode);

    /// <summary>
    /// 从 GameObject 名称提取组件类型缩写（规范模式）
    /// </summary>
    string ExtractTypeAbbreviation(string gameObjectName, ToolConfig config);

    /// <summary>
    /// 从 GameObject 名称提取描述部分（规范模式）
    /// </summary>
    string ExtractDescription(string gameObjectName, ToolConfig config);

    /// <summary>
    /// 从节点名和组件类型生成变量名（回退模式）
    /// </summary>
    string GenerateFieldNameFromNodeAndType(string nodeName, string componentType,
                                             ToolConfig config);
}
```

#### 2.2.3 其他接口保持不变

FileAnalyzer, DataMerger, CodeGenerator, ValidationEngine 的接口保持不变。

---

## 数据结构设计

### 3.1 核心数据模型

#### 3.1.1 ComponentInfo (组件信息) - 更新

```csharp
/// <summary>
/// 组件信息 - 描述一个收集到的 UI 组件
/// </summary>
[Serializable]
public class ComponentInfo
{
    /// <summary>
    /// 组件在 Prefab 中的完整路径 (用于 AutoGenAliasName)
    /// 示例: "Root/Panel/@Btn_Confirm" 或 "Root/Panel/ConfirmButton"
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
    /// 示例: "@Btn_Confirm" 或 "ConfirmButton"
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

    /// <summary>
    /// 收集模式（新增）
    /// </summary>
    public CollectionMode CollectionMode;
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

#### 3.1.2 CollectionMode (收集模式) - 新增

```csharp
/// <summary>
/// 组件收集模式
/// </summary>
public enum CollectionMode
{
    /// <summary>
    /// 规范模式：仅收集符合命名规范的组件（带 @ 前缀）
    /// 示例: @Btn_Confirm, @Text_Title
    /// </summary>
    Strict,

    /// <summary>
    /// 回退模式：收集所有指定类型的组件（忽略命名规范）
    /// 示例: 所有 Button, Text, Image 组件
    /// </summary>
    Fallback,

    /// <summary>
    /// 混合模式：优先规范模式，补充回退模式（推荐）
    /// 先收集带 @ 前缀的组件，再收集剩余的指定类型组件
    /// </summary>
    Hybrid
}
```

#### 3.1.3 ToolConfig (工具配置) - 更新

```csharp
/// <summary>
/// 工具配置 - 定义命名规范和解析规则
/// </summary>
[Serializable]
public class ToolConfig
{
    // ========== 收集模式配置 (NEW) ==========

    /// <summary>
    /// 组件收集模式
    /// </summary>
    public CollectionMode CollectionMode = CollectionMode.Hybrid;

    /// <summary>
    /// 回退模式下要收集的组件类型列表
    /// </summary>
    public List<string> FallbackComponentTypes = new List<string>
    {
        "Button",
        "Text",
        "Image",
        "RawImage",
        "Toggle",
        "Slider",
        "InputField",
        "Dropdown",
        "ScrollRect"
    };

    /// <summary>
    /// 回退模式下是否包含子类组件
    /// 例如：收集 Button 时，也收集 ButtonEx (如果 ButtonEx 继承自 Button)
    /// </summary>
    public bool IncludeDerivedTypes = true;

    /// <summary>
    /// 回退模式下的命名策略
    /// </summary>
    public FallbackNamingStrategy FallbackNaming = FallbackNamingStrategy.NodeName_TypeSuffix;

    // ========== 命名规范配置 ==========

    /// <summary>
    /// 收集前缀 (标记需要收集的 GameObject) - 仅用于规范模式
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
    /// 组件类型缩写映射表（用于规范模式）
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
    /// 组件类型到缩写的反向映射（用于回退模式生成变量名）
    /// Key: C# 类型 (如 "Button"), Value: 缩写 (如 "Btn")
    /// </summary>
    public Dictionary<string, string> TypeToAbbreviationMapping = new Dictionary<string, string>
    {
        { "Button", "Btn" },
        { "ButtonEx", "Btn" },
        { "Text", "Text" },
        { "Image", "Img" },
        { "RawImage", "RawImg" },
        { "Toggle", "Toggle" },
        { "Slider", "Slider" },
        { "InputField", "InputField" },
        { "Dropdown", "Dropdown" },
        { "ScrollRect", "ScrollRect" },
        { "GridLayoutGroup", "Grid" },
        { "HorizontalLayoutGroup", "Horizontal" },
        { "VerticalLayoutGroup", "Vertical" },
        { "GameObject", "GO" }
    };

    /// <summary>
    /// 默认组件类型 (当没有匹配到任何缩写时)
    /// </summary>
    public string DefaultType = "GameObject";

    // ========== 翻译配置 ==========

    /// <summary>
    /// 英文到中文的翻译映射表
    /// </summary>
    public Dictionary<string, string> TranslationMapping = new Dictionary<string, string>
    {
        { "Confirm", "确认" },
        { "Cancel", "取消" },
        { "Close", "关闭" },
        { "Title", "标题" },
        { "Content", "内容" },
        { "Icon", "图标" },
        { "Button", "按钮" },
        { "Text", "文本" },
        { "Image", "图片" }
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
    /// </summary>
    public string ClassNameSuffix = "UICtrlDesc";

    /// <summary>
    /// 必需命名空间列表
    /// </summary>
    public List<string> RequiredNamespaces = new List<string>
    {
        "UnityEngine",
        "UnityEngine.UI",
        "BlackJack.BJFramework.Runtime"
    };
}
```

#### 3.1.4 FallbackNamingStrategy (回退模式命名策略) - 新增

```csharp
/// <summary>
/// 回退模式下的命名策略
/// </summary>
public enum FallbackNamingStrategy
{
    /// <summary>
    /// 节点名 + 类型后缀
    /// 示例: "ConfirmButton" (Button) -> m_ConfirmButtonBtn
    /// </summary>
    NodeName_TypeSuffix,

    /// <summary>
    /// 仅节点名
    /// 示例: "ConfirmButton" (Button) -> m_ConfirmButton
    /// </summary>
    NodeNameOnly,

    /// <summary>
    /// 类型前缀 + 节点名
    /// 示例: "ConfirmButton" (Button) -> m_BtnConfirmButton
    /// </summary>
    TypePrefix_NodeName,

    /// <summary>
    /// 智能模式：尝试从节点名中识别类型
    /// 示例: "ConfirmButton" -> m_ConfirmBtn (识别到 "Button")
    ///       "TitleText" -> m_TitleText (识别到 "Text")
    /// </summary>
    Smart
}
```

### 3.2 其他数据模型

MergeResult, ValidationResult, CodeGenConfig 等数据模型保持不变。

---

## 核心算法设计

### 4.1 组件收集算法 (双模式支持)

```csharp
/// <summary>
/// 组件收集算法实现（支持双模式）
/// </summary>
public class ComponentCollector : IComponentCollector
{
    public List<ComponentInfo> CollectComponents(GameObject prefabRoot, ToolConfig config)
    {
        List<ComponentInfo> result = new List<ComponentInfo>();

        switch (config.CollectionMode)
        {
            case CollectionMode.Strict:
                CollectByNamingConvention(prefabRoot.transform, "", result, config);
                break;

            case CollectionMode.Fallback:
                CollectByComponentType(prefabRoot.transform, "", result, config);
                break;

            case CollectionMode.Hybrid:
                // 先收集规范命名的组件
                HashSet<string> collectedPaths = new HashSet<string>();
                CollectByNamingConvention(prefabRoot.transform, "", result, config, collectedPaths);

                // 再收集剩余的指定类型组件
                CollectByComponentType(prefabRoot.transform, "", result, config, collectedPaths);
                break;
        }

        return result;
    }

    #region 规范模式收集

    /// <summary>
    /// 按命名规范收集（规范模式）
    /// </summary>
    private void CollectByNamingConvention(Transform current, string parentPath,
                                           List<ComponentInfo> result, ToolConfig config,
                                           HashSet<string> collectedPaths = null)
    {
        // 构建当前节点的完整路径
        string currentPath = string.IsNullOrEmpty(parentPath)
            ? current.name
            : $"{parentPath}/{current.name}";

        // 检查是否符合命名规范
        if (ShouldCollectByNamingConvention(current.gameObject, config))
        {
            ComponentInfo info = ParseComponentByNamingConvention(current.gameObject,
                                                                  currentPath, config);
            if (info != null)
            {
                result.Add(info);
                collectedPaths?.Add(currentPath);
            }
        }

        // 递归处理子节点
        for (int i = 0; i < current.childCount; i++)
        {
            CollectByNamingConvention(current.GetChild(i), currentPath, result,
                                      config, collectedPaths);
        }
    }

    public bool ShouldCollectByNamingConvention(GameObject go, ToolConfig config)
    {
        // 检查名称是否以收集前缀开头
        return go.name.StartsWith(config.CollectPrefix);
    }

    private ComponentInfo ParseComponentByNamingConvention(GameObject go, string fullPath,
                                                           ToolConfig config)
    {
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
        FieldInfo fieldInfo = parser.ParseName(go.name, component, config, CollectionMode.Strict);

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
            IsManuallyEdited = false,
            CollectionMode = CollectionMode.Strict
        };
    }

    #endregion

    #region 回退模式收集

    /// <summary>
    /// 按组件类型收集（回退模式）
    /// </summary>
    private void CollectByComponentType(Transform current, string parentPath,
                                        List<ComponentInfo> result, ToolConfig config,
                                        HashSet<string> excludePaths = null)
    {
        // 构建当前节点的完整路径
        string currentPath = string.IsNullOrEmpty(parentPath)
            ? current.name
            : $"{parentPath}/{current.name}";

        // 如果该路径已被规范模式收集，跳过
        if (excludePaths != null && excludePaths.Contains(currentPath))
        {
            // 仍需递归子节点
            for (int i = 0; i < current.childCount; i++)
            {
                CollectByComponentType(current.GetChild(i), currentPath, result,
                                       config, excludePaths);
            }
            return;
        }

        // 收集当前节点上的指定类型组件
        foreach (string typeName in config.FallbackComponentTypes)
        {
            Type componentType = GetTypeByName(typeName);
            if (componentType == null) continue;

            // 获取组件
            Component component = current.GetComponent(componentType);

            // 如果配置了包含派生类型，使用 GetComponents
            if (config.IncludeDerivedTypes)
            {
                Component[] components = current.GetComponents(componentType);
                foreach (Component comp in components)
                {
                    if (comp != null)
                    {
                        ComponentInfo info = ParseComponentByType(current.gameObject,
                                                                  currentPath, comp, config);
                        if (info != null)
                        {
                            result.Add(info);
                            // 每个 GameObject 只收集一次（第一个匹配的组件）
                            break;
                        }
                    }
                }
            }
            else
            {
                if (component != null)
                {
                    ComponentInfo info = ParseComponentByType(current.gameObject,
                                                              currentPath, component, config);
                    if (info != null)
                    {
                        result.Add(info);
                        // 每个 GameObject 只收集一次（第一个匹配的组件）
                        break;
                    }
                }
            }
        }

        // 递归处理子节点
        for (int i = 0; i < current.childCount; i++)
        {
            CollectByComponentType(current.GetChild(i), currentPath, result,
                                   config, excludePaths);
        }
    }

    public bool ShouldCollectByComponentType(Component component, ToolConfig config)
    {
        if (component == null) return false;

        string typeName = component.GetType().Name;

        // 检查是否在收集列表中
        if (config.FallbackComponentTypes.Contains(typeName))
        {
            return true;
        }

        // 如果包含派生类型，检查基类
        if (config.IncludeDerivedTypes)
        {
            Type baseType = component.GetType().BaseType;
            while (baseType != null && baseType != typeof(object))
            {
                if (config.FallbackComponentTypes.Contains(baseType.Name))
                {
                    return true;
                }
                baseType = baseType.BaseType;
            }
        }

        return false;
    }

    private ComponentInfo ParseComponentByType(GameObject go, string fullPath,
                                               Component component, ToolConfig config)
    {
        INameParser parser = new NameParser();

        // 使用组件类型作为类型名
        string componentTypeName = component.GetType().Name;

        // 生成字段信息（回退模式）
        FieldInfo fieldInfo = parser.ParseName(go.name, component, config, CollectionMode.Fallback);

        return new ComponentInfo
        {
            AliasPath = fullPath,
            ComponentType = componentTypeName,
            FieldName = fieldInfo.FieldName,
            ChineseDescription = fieldInfo.ChineseDescription,
            GameObjectName = go.name,
            ComponentRef = component,
            IsExport = true,
            Source = DataSource.NewlyCollected,
            IsManuallyEdited = false,
            CollectionMode = CollectionMode.Fallback
        };
    }

    #endregion

    #region 辅助方法

    private Component GetComponentByType(GameObject go, string typeName)
    {
        Type type = GetTypeByName(typeName);
        if (type == null) return null;

        return go.GetComponent(type);
    }

    private Type GetTypeByName(string typeName)
    {
        // 常见 UI 组件类型映射
        Dictionary<string, Type> typeMap = new Dictionary<string, Type>
        {
            { "Button", typeof(UnityEngine.UI.Button) },
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

        if (typeMap.ContainsKey(typeName))
        {
            return typeMap[typeName];
        }

        // 尝试通过反射查找类型
        Type type = Type.GetType($"UnityEngine.UI.{typeName}, UnityEngine.UI");
        if (type != null) return type;

        type = Type.GetType($"UnityEngine.{typeName}, UnityEngine");
        return type;
    }

    #endregion
}
```

### 4.2 命名解析算法 (双模式支持)

```csharp
/// <summary>
/// 命名解析算法实现（支持双模式）
/// </summary>
public class NameParser : INameParser
{
    public FieldInfo ParseName(string gameObjectName, Component component,
                                ToolConfig config, CollectionMode mode)
    {
        switch (mode)
        {
            case CollectionMode.Strict:
                return ParseNameByConvention(gameObjectName, component, config);

            case CollectionMode.Fallback:
                return ParseNameByComponentType(gameObjectName, component, config);

            default:
                return ParseNameByConvention(gameObjectName, component, config);
        }
    }

    #region 规范模式解析

    private FieldInfo ParseNameByConvention(string gameObjectName, Component component,
                                            ToolConfig config)
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

    #endregion

    #region 回退模式解析

    private FieldInfo ParseNameByComponentType(string gameObjectName, Component component,
                                                ToolConfig config)
    {
        string componentTypeName = component.GetType().Name;

        // 根据配置的命名策略生成字段名
        string fieldName = GenerateFieldNameFromNodeAndType(gameObjectName,
                                                            componentTypeName, config);

        // 生成中文描述
        string chineseDesc = GenerateChineseDescriptionForFallback(gameObjectName,
                                                                    componentTypeName, config);

        return new FieldInfo
        {
            FieldName = fieldName,
            ChineseDescription = chineseDesc
        };
    }

    public string GenerateFieldNameFromNodeAndType(string nodeName, string componentType,
                                                    ToolConfig config)
    {
        // 清理节点名（移除特殊字符，保留字母数字）
        string cleanedNodeName = CleanNodeName(nodeName);

        // 获取类型缩写
        string typeAbbr = GetTypeAbbreviation(componentType, config);

        // 根据命名策略生成字段名
        switch (config.FallbackNaming)
        {
            case FallbackNamingStrategy.NodeName_TypeSuffix:
                // 节点名 + 类型后缀
                return $"{config.VariablePrefix}{cleanedNodeName}{typeAbbr}";

            case FallbackNamingStrategy.NodeNameOnly:
                // 仅节点名
                return $"{config.VariablePrefix}{cleanedNodeName}";

            case FallbackNamingStrategy.TypePrefix_NodeName:
                // 类型前缀 + 节点名
                return $"{config.VariablePrefix}{typeAbbr}{cleanedNodeName}";

            case FallbackNamingStrategy.Smart:
                // 智能模式：检测节点名是否已包含类型信息
                return GenerateSmartFieldName(cleanedNodeName, typeAbbr, config);

            default:
                return $"{config.VariablePrefix}{cleanedNodeName}{typeAbbr}";
        }
    }

    private string GenerateSmartFieldName(string nodeName, string typeAbbr, ToolConfig config)
    {
        // 检查节点名是否以类型名结尾
        // 例如: "ConfirmButton" -> 识别到 "Button"，生成 m_ConfirmBtn

        // 尝试匹配常见类型名
        string[] typeNames = { "Button", "Text", "Image", "Toggle", "Slider",
                              "Input", "Dropdown", "Scroll" };

        foreach (string typeName in typeNames)
        {
            if (nodeName.EndsWith(typeName, StringComparison.OrdinalIgnoreCase))
            {
                // 移除类型名，添加缩写
                string baseDescription = nodeName.Substring(0,
                                          nodeName.Length - typeName.Length);

                // 如果移除后为空，使用原名
                if (string.IsNullOrEmpty(baseDescription))
                {
                    return $"{config.VariablePrefix}{nodeName}{typeAbbr}";
                }

                return $"{config.VariablePrefix}{baseDescription}{typeAbbr}";
            }
        }

        // 没有识别到类型，使用默认策略
        return $"{config.VariablePrefix}{nodeName}{typeAbbr}";
    }

    private string CleanNodeName(string nodeName)
    {
        // 移除空格、特殊字符，仅保留字母、数字、下划线
        StringBuilder sb = new StringBuilder();

        foreach (char c in nodeName)
        {
            if (char.IsLetterOrDigit(c) || c == '_')
            {
                sb.Append(c);
            }
        }

        string cleaned = sb.ToString();

        // 确保首字母大写
        if (!string.IsNullOrEmpty(cleaned))
        {
            cleaned = char.ToUpper(cleaned[0]) + cleaned.Substring(1);
        }

        return cleaned;
    }

    private string GetTypeAbbreviation(string componentType, ToolConfig config)
    {
        // 从反向映射表中查找缩写
        if (config.TypeToAbbreviationMapping.ContainsKey(componentType))
        {
            return config.TypeToAbbreviationMapping[componentType];
        }

        // 如果没有找到，使用类型名本身
        return componentType;
    }

    private string GenerateChineseDescriptionForFallback(string nodeName,
                                                          string componentType,
                                                          ToolConfig config)
    {
        // 清理节点名
        string cleanedName = CleanNodeName(nodeName);

        // 尝试翻译节点名
        if (config.AutoTranslate && config.TranslationMapping.ContainsKey(cleanedName))
        {
            string translatedName = config.TranslationMapping[cleanedName];

            // 添加组件类型描述
            if (config.TranslationMapping.ContainsKey(componentType))
            {
                return $"{translatedName}{config.TranslationMapping[componentType]}";
            }

            return translatedName;
        }

        // 如果没有翻译，返回原节点名
        return cleanedName;
    }

    #endregion

    #region 共用方法

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

    #endregion
}

/// <summary>
/// 字段信息 (中间数据结构)
/// </summary>
public class FieldInfo
{
    public string FieldName;
    public string ChineseDescription;
    public string AliasPath; // FileAnalyzer 使用
    public string ComponentType; // FileAnalyzer 使用
}
```

### 4.3 其他算法保持不变

FileAnalyzer, DataMerger, CodeGenerator, ValidationEngine 的算法实现保持不变。

---

## Editor UI 设计

### 5.1 窗口布局 (更新)

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
│  B. 收集模式选择                                          │
│  ○ 规范模式  ○ 回退模式  ● 混合模式                       │
│  [配置回退类型: Button, Text, Image, Toggle...]          │
│                                                          │
│  C. 控制台                                                │
│  [一键收集组件]  [生成/更新描述文件]  [校验]  [清空]       │
│                                                          │
│  D. 批量操作工具栏 (NEW)                                  │
│  [全选] [全不选] [反选] | 按类型: [All ▼] 按模式: [All ▼] │
│                                                          │
│  E. 组件列表预览区                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │  ☑ Path             Type    Field Name   描述   模式 │ │
│  │  ────────────────────────────────────────────────  │ │
│  │  ☑ @Btn_Confirm     ButtonEx m_ConfirmBtn 确认 规范 │ │
│  │  ☑ ConfirmButton    Button   m_ConfirmButtonBtn 确认 回退 │ │
│  │  ☐ @Text_Title      Text     m_TitleText  标题 规范 │ │
│  │  ☑ @Img_Icon        Image    m_IconImg    图标 规范 │ │
│  │  ... (ReorderableList)                              │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  F. 配置区 (可折叠)                                       │
│  ┌────────────────────────────────────────────────────┐ │
│  │  [规范模式配置]                                      │ │
│  │  收集前缀: [@]  分隔符: [_]  变量前缀: [m_]          │ │
│  │                                                    │ │
│  │  [回退模式配置]                                      │ │
│  │  命名策略: [节点名+类型后缀 ▼]                        │ │
│  │  ☑ 包含派生类型                                      │ │
│  │  收集类型: [编辑列表...]                              │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  G. 状态栏                                                │
│  ┌────────────────────────────────────────────────────┐ │
│  │  收集 15 个 | 导出 12 个 (规范: 7, 回退: 5) | 准备就绪  │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 5.2 Editor Window 代码更新

```csharp
using UnityEngine;
using UnityEditor;
using UnityEditorInternal;
using System.Collections.Generic;

namespace BlackJack.ProjectEF.Editor.Tools
{
    /// <summary>
    /// UI Prefab 自动化工具主窗口（V2 - 支持双模式）
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
        private Vector2 m_fallbackTypesScroll;
        private bool m_showConfig = true;
        private bool m_showStrictConfig = true;
        private bool m_showFallbackConfig = true;

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
            var window = GetWindow<UIPrefabToolEditorWindow>("UI Prefab Tool V2");
            window.minSize = new Vector2(900, 700);
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
            m_config = new ToolConfig();
            // TODO: 从 ScriptableObject 加载配置
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
            DrawCollectionModeSelector();
            DrawControlPanel();
            DrawBatchOperationToolbar(); // NEW - 批量操作工具栏
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

            if (m_currentPrefab != null)
            {
                EditorGUI.BeginDisabledGroup(true);
                EditorGUILayout.ObjectField("Current Prefab", m_currentPrefab,
                                           typeof(GameObject), false);
                EditorGUI.EndDisabledGroup();
            }

            HandleDragAndDrop(dropArea);
        }

        private void DrawCollectionModeSelector()
        {
            EditorGUILayout.Space(10);
            EditorGUILayout.LabelField("B. 收集模式选择", EditorStyles.boldLabel);

            EditorGUILayout.BeginHorizontal();

            // 模式选择
            CollectionMode newMode = (CollectionMode)GUILayout.SelectionGrid(
                (int)m_config.CollectionMode,
                new string[] { "规范模式", "回退模式", "混合模式" },
                3,
                GUILayout.Height(30)
            );

            if (newMode != m_config.CollectionMode)
            {
                m_config.CollectionMode = newMode;
                // 模式改变时，清空已收集的组件
                m_componentList.Clear();
                m_reorderableList.list = m_componentList;
            }

            EditorGUILayout.EndHorizontal();

            // 显示模式说明
            string modeDescription = "";
            switch (m_config.CollectionMode)
            {
                case CollectionMode.Strict:
                    modeDescription = "仅收集符合命名规范的组件（带 @ 前缀）";
                    break;
                case CollectionMode.Fallback:
                    modeDescription = "收集所有指定类型的组件（忽略命名规范）";
                    break;
                case CollectionMode.Hybrid:
                    modeDescription = "优先规范模式，补充回退模式（推荐）";
                    break;
            }

            EditorGUILayout.HelpBox(modeDescription, MessageType.Info);

            // 回退模式或混合模式下，显示类型配置
            if (m_config.CollectionMode == CollectionMode.Fallback ||
                m_config.CollectionMode == CollectionMode.Hybrid)
            {
                DrawFallbackTypeConfig();
            }
        }

        private void DrawFallbackTypeConfig()
        {
            EditorGUILayout.BeginVertical(EditorStyles.helpBox);
            EditorGUILayout.LabelField("回退模式配置", EditorStyles.boldLabel);

            // 命名策略
            m_config.FallbackNaming = (FallbackNamingStrategy)EditorGUILayout.EnumPopup(
                "命名策略", m_config.FallbackNaming);

            // 包含派生类型
            m_config.IncludeDerivedTypes = EditorGUILayout.Toggle(
                "包含派生类型", m_config.IncludeDerivedTypes);

            // 收集类型列表
            EditorGUILayout.LabelField("收集组件类型:", EditorStyles.boldLabel);

            m_fallbackTypesScroll = EditorGUILayout.BeginScrollView(
                m_fallbackTypesScroll, GUILayout.Height(100));

            for (int i = 0; i < m_config.FallbackComponentTypes.Count; i++)
            {
                EditorGUILayout.BeginHorizontal();

                m_config.FallbackComponentTypes[i] = EditorGUILayout.TextField(
                    m_config.FallbackComponentTypes[i]);

                if (GUILayout.Button("-", GUILayout.Width(30)))
                {
                    m_config.FallbackComponentTypes.RemoveAt(i);
                    break;
                }

                EditorGUILayout.EndHorizontal();
            }

            EditorGUILayout.EndScrollView();

            if (GUILayout.Button("+ 添加类型"))
            {
                m_config.FallbackComponentTypes.Add("NewType");
            }

            EditorGUILayout.EndVertical();
        }

        private void DrawControlPanel()
        {
            EditorGUILayout.Space(10);
            EditorGUILayout.LabelField("C. 控制台", EditorStyles.boldLabel);

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

        private void DrawBatchOperationToolbar()
        {
            if (m_componentList.Count == 0) return;

            EditorGUILayout.Space(10);
            EditorGUILayout.LabelField("D. 批量操作工具栏", EditorStyles.boldLabel);

            EditorGUILayout.BeginHorizontal();

            // 基础批量操作
            if (GUILayout.Button("全选", GUILayout.Height(25)))
            {
                SelectAll();
            }

            if (GUILayout.Button("全不选", GUILayout.Height(25)))
            {
                DeselectAll();
            }

            if (GUILayout.Button("反选", GUILayout.Height(25)))
            {
                InvertSelection();
            }

            GUILayout.Space(20);

            // 按类型筛选
            EditorGUILayout.LabelField("按类型:", GUILayout.Width(50));

            // 获取所有组件类型
            List<string> componentTypes = GetAllComponentTypes();
            componentTypes.Insert(0, "All");

            int selectedTypeIndex = EditorGUILayout.Popup(0, componentTypes.ToArray(),
                                                          GUILayout.Width(120));

            if (selectedTypeIndex > 0)
            {
                string selectedType = componentTypes[selectedTypeIndex];
                SelectByType(selectedType);
            }

            GUILayout.Space(10);

            // 按模式筛选
            EditorGUILayout.LabelField("按模式:", GUILayout.Width(50));

            string[] modeOptions = { "All", "规范", "回退" };
            int selectedModeIndex = EditorGUILayout.Popup(0, modeOptions,
                                                          GUILayout.Width(80));

            if (selectedModeIndex > 0)
            {
                CollectionMode selectedMode = selectedModeIndex == 1
                    ? CollectionMode.Strict
                    : CollectionMode.Fallback;
                SelectByMode(selectedMode);
            }

            EditorGUILayout.EndHorizontal();
        }

        private void DrawComponentList()
        {
            EditorGUILayout.Space(10);
            EditorGUILayout.LabelField("E. 组件列表预览区", EditorStyles.boldLabel);

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
            EditorGUI.LabelField(new Rect(x, rect.y, 150, rect.height), "Path");
            x += 155;
            EditorGUI.LabelField(new Rect(x, rect.y, 80, rect.height), "Type");
            x += 85;
            EditorGUI.LabelField(new Rect(x, rect.y, 150, rect.height), "Field Name");
            x += 155;
            EditorGUI.LabelField(new Rect(x, rect.y, 100, rect.height), "中文描述");
            x += 105;
            EditorGUI.LabelField(new Rect(x, rect.y, 50, rect.height), "模式");
        }

        private void DrawListElement(Rect rect, int index, bool isActive, bool isFocused)
        {
            if (index >= m_componentList.Count) return;

            ComponentInfo info = m_componentList[index];
            float x = rect.x;

            // 导出复选框
            info.IsExport = EditorGUI.Toggle(new Rect(x, rect.y, 30, rect.height), info.IsExport);
            x += 35;

            // Path (缩短显示)
            string shortPath = info.AliasPath.Length > 25
                ? "..." + info.AliasPath.Substring(info.AliasPath.Length - 22)
                : info.AliasPath;
            EditorGUI.LabelField(new Rect(x, rect.y, 150, rect.height), shortPath);
            x += 155;

            // Component Type
            EditorGUI.LabelField(new Rect(x, rect.y, 80, rect.height), info.ComponentType);
            x += 85;

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
            string newDesc = EditorGUI.TextField(new Rect(x, rect.y, 100, rect.height),
                                                  info.ChineseDescription);
            if (newDesc != info.ChineseDescription)
            {
                info.ChineseDescription = newDesc;
                info.IsManuallyEdited = true;
            }
            x += 105;

            // 模式标识
            string modeLabel = info.CollectionMode == CollectionMode.Strict ? "规范" : "回退";
            Color originalColor = GUI.color;
            GUI.color = info.CollectionMode == CollectionMode.Strict
                ? Color.green : new Color(1f, 0.7f, 0f);
            EditorGUI.LabelField(new Rect(x, rect.y, 50, rect.height), modeLabel);
            GUI.color = originalColor;
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
            m_showConfig = EditorGUILayout.Foldout(m_showConfig, "F. 配置区", true);

            if (m_showConfig)
            {
                EditorGUI.indentLevel++;

                // 规范模式配置
                m_showStrictConfig = EditorGUILayout.Foldout(m_showStrictConfig, "规范模式配置", true);
                if (m_showStrictConfig)
                {
                    EditorGUI.indentLevel++;

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

                // 回退模式配置（已在 DrawFallbackTypeConfig 中显示）

                // 通用配置
                EditorGUILayout.Space(5);
                m_config.DefaultExportPath = EditorGUILayout.TextField("导出路径",
                                                                       m_config.DefaultExportPath);
                m_config.DefaultNamespace = EditorGUILayout.TextField("命名空间",
                                                                      m_config.DefaultNamespace);
                m_config.BaseClassName = EditorGUILayout.TextField("基类名",
                                                                   m_config.BaseClassName);

                EditorGUI.indentLevel--;
            }
        }

        private void DrawStatusBar()
        {
            EditorGUILayout.Space(10);
            EditorGUILayout.LabelField("G. 状态栏", EditorStyles.boldLabel);

            // 统计导出数量
            int exportCount = m_componentList.FindAll(c => c.IsExport).Count;

            string statusText = $"收集 {m_componentList.Count} 个 | 导出 {exportCount} 个";

            // 统计不同模式的导出数量
            int strictExportCount = m_componentList.FindAll(
                c => c.CollectionMode == CollectionMode.Strict && c.IsExport).Count;
            int fallbackExportCount = m_componentList.FindAll(
                c => c.CollectionMode == CollectionMode.Fallback && c.IsExport).Count;

            if (strictExportCount > 0 || fallbackExportCount > 0)
            {
                statusText += $" (规范: {strictExportCount}, 回退: {fallbackExportCount})";
            }

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

        // ========== 批量操作方法 (NEW) ==========

        /// <summary>
        /// 全选所有组件
        /// </summary>
        private void SelectAll()
        {
            foreach (var component in m_componentList)
            {
                component.IsExport = true;
            }
            Repaint();
        }

        /// <summary>
        /// 取消选择所有组件
        /// </summary>
        private void DeselectAll()
        {
            foreach (var component in m_componentList)
            {
                component.IsExport = false;
            }
            Repaint();
        }

        /// <summary>
        /// 反选所有组件
        /// </summary>
        private void InvertSelection()
        {
            foreach (var component in m_componentList)
            {
                component.IsExport = !component.IsExport;
            }
            Repaint();
        }

        /// <summary>
        /// 按组件类型选择
        /// </summary>
        /// <param name="componentType">组件类型名称</param>
        private void SelectByType(string componentType)
        {
            // 先取消所有选择
            DeselectAll();

            // 选择指定类型
            foreach (var component in m_componentList)
            {
                if (component.ComponentType == componentType)
                {
                    component.IsExport = true;
                }
            }

            Repaint();
        }

        /// <summary>
        /// 按收集模式选择
        /// </summary>
        /// <param name="mode">收集模式</param>
        private void SelectByMode(CollectionMode mode)
        {
            // 先取消所有选择
            DeselectAll();

            // 选择指定模式
            foreach (var component in m_componentList)
            {
                if (component.CollectionMode == mode)
                {
                    component.IsExport = true;
                }
            }

            Repaint();
        }

        /// <summary>
        /// 获取所有组件类型列表（去重）
        /// </summary>
        /// <returns>组件类型列表</returns>
        private List<string> GetAllComponentTypes()
        {
            HashSet<string> types = new HashSet<string>();

            foreach (var component in m_componentList)
            {
                types.Add(component.ComponentType);
            }

            List<string> result = new List<string>(types);
            result.Sort();

            return result;
        }
    }
}
```

---

## 配置系统设计

配置系统保持不变，但 ToolConfig 已更新为支持双模式的版本（见 3.1.3 节）。

---

## 文件解析与生成策略

保持不变，继续使用正则表达式解析和 StringBuilder 生成代码。

---

## 测试策略

### 8.1 单元测试（新增测试用例）

```csharp
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

    // 规范模式测试
    [Test]
    public void ParseName_StrictMode_ReturnsCorrectFieldName()
    {
        string gameObjectName = "@Btn_Confirm";
        FieldInfo info = m_parser.ParseName(gameObjectName, null,
                                             m_config, CollectionMode.Strict);

        Assert.AreEqual("m_ConfirmBtn", info.FieldName);
    }

    // 回退模式测试
    [Test]
    public void ParseName_FallbackMode_NodeNameTypeSuffix_ReturnsCorrectName()
    {
        m_config.FallbackNaming = FallbackNamingStrategy.NodeName_TypeSuffix;
        string gameObjectName = "ConfirmButton";
        Component mockButton = CreateMockButtonComponent();

        FieldInfo info = m_parser.ParseName(gameObjectName, mockButton,
                                             m_config, CollectionMode.Fallback);

        Assert.AreEqual("m_ConfirmButtonBtn", info.FieldName);
    }

    [Test]
    public void ParseName_FallbackMode_SmartStrategy_RecognizesType()
    {
        m_config.FallbackNaming = FallbackNamingStrategy.Smart;
        string gameObjectName = "ConfirmButton";
        Component mockButton = CreateMockButtonComponent();

        FieldInfo info = m_parser.ParseName(gameObjectName, mockButton,
                                             m_config, CollectionMode.Fallback);

        Assert.AreEqual("m_ConfirmBtn", info.FieldName);
    }
}

[TestFixture]
public class ComponentCollectorTests
{
    [Test]
    public void CollectComponents_StrictMode_OnlyCollectsMarkedNodes()
    {
        // TODO: 创建测试 Prefab，验证规范模式
    }

    [Test]
    public void CollectComponents_FallbackMode_CollectsAllTypedComponents()
    {
        // TODO: 验证回退模式
    }

    [Test]
    public void CollectComponents_HybridMode_CombinesBothModes()
    {
        // TODO: 验证混合模式
    }
}
```

---

## 开发计划

### 9.1 开发阶段（更新）

| 阶段 | 任务 | 优先级 | 预估时间 |
|------|------|--------|---------|
| **Phase 1: 核心功能** | | | |
| 1.1 | 数据结构定义（增加模式枚举） | 高 | 0.5 天 |
| 1.2 | ComponentCollector 实现（双模式） | 高 | 2 天 |
| 1.3 | NameParser 实现（双模式） | 高 | 1.5 天 |
| 1.4 | FileAnalyzer 实现 | 高 | 1.5 天 |
| 1.5 | DataMerger 实现 | 高 | 1 天 |
| 1.6 | CodeGenerator 实现 | 高 | 1.5 天 |
| 1.7 | ValidationEngine 实现 | 高 | 1 天 |
| **Phase 2: Editor UI** | | | |
| 2.1 | 基础窗口框架 | 高 | 1 天 |
| 2.2 | Prefab 拖拽区实现 | 高 | 0.5 天 |
| 2.3 | 模式选择器实现（NEW） | 高 | 1 天 |
| 2.4 | ReorderableList 实现（增加模式列） | 高 | 1 天 |
| 2.5 | 配置面板实现（双模式配置） | 中 | 1 天 |
| 2.6 | 状态栏实现 | 低 | 0.5 天 |
| **Phase 3: 配置系统** | | | |
| 3.1 | ToolConfig ScriptableObject | 中 | 0.5 天 |
| 3.2 | 配置加载/保存 | 中 | 0.5 天 |
| 3.3 | 自定义类型映射 | 中 | 1 天 |
| **Phase 4: 批量操作功能** | | | |
| 4.1 | 批量操作工具栏 UI | 中 | 0.5 天 |
| 4.2 | 批量操作逻辑实现 | 中 | 0.5 天 |
| 4.3 | 按类型/模式筛选 | 中 | 0.5 天 |
| 4.4 | 状态栏导出统计 | 低 | 0.5 天 |
| **Phase 5: 特殊组件功能** (NEW) | | | |
| 5.1 | ExtraFieldInfo 数据结构 | 高 | 0.5 天 |
| 5.2 | ISpecialComponentProcessor 接口 | 高 | 0.5 天 |
| 5.3 | SpecialComponentProcessorManager | 高 | 1 天 |
| 5.4 | AdvanceUIStateController 处理器 | 高 | 1 天 |
| 5.5 | Dropdown 处理器（示例） | 低 | 0.5 天 |
| 5.6 | ComponentCollector 扩展（特殊组件处理） | 高 | 1 天 |
| 5.7 | CodeGenerator 扩展（额外字段生成） | 高 | 1.5 天 |
| 5.8 | 额外字段编辑 UI | 中 | 1.5 天 |
| 5.9 | ExtraFieldEditorWindow 实现 | 中 | 1 天 |
| 5.10 | 特殊组件配置面板 | 低 | 0.5 天 |
| **Phase 6: 高级功能** | | | |
| 6.1 | Hierarchy 标记功能 (F7) | 中 | 1.5 天 |
| 6.2 | 增量更新策略 | 中 | 1 天 |
| 6.3 | 批量处理功能 | 低 | 1 天 |
| **Phase 7: 测试与优化** | | | |
| 7.1 | 单元测试（双模式 + 特殊组件） | 高 | 3 天 |
| 7.2 | 集成测试 | 中 | 1.5 天 |
| 7.3 | 性能优化 | 中 | 1 天 |
| 7.4 | 文档编写 | 中 | 1 天 |

**总计**: 约 32.5 天 (约 6.5 周)

---

## 附录

### A. 命名规范示例（双模式对比）

#### 规范模式示例

| GameObject 名称 | 组件类型 | 生成的字段名 | 中文描述 |
|----------------|---------|------------|---------|
| @Btn_Confirm | ButtonEx | m_ConfirmBtn | 确认按钮 |
| @Text_Title | Text | m_TitleText | 标题文本 |
| @Img_Icon | Image | m_IconImg | 图标图片 |

#### 回退模式示例（NodeName_TypeSuffix 策略）

| GameObject 名称 | 组件类型 | 生成的字段名 | 中文描述 |
|----------------|---------|------------|---------|
| ConfirmButton | Button | m_ConfirmButtonBtn | ConfirmButton |
| TitleText | Text | m_TitleTextText | TitleText |
| IconImage | Image | m_IconImageImg | IconImage |

#### 回退模式示例（Smart 策略）

| GameObject 名称 | 组件类型 | 生成的字段名 | 中文描述 |
|----------------|---------|------------|---------|
| ConfirmButton | Button | m_ConfirmBtn | Confirm按钮 |
| TitleText | Text | m_TitleText | Title文本 |
| IconImage | Image | m_IconImg | Icon图片 |

### B. 混合模式收集示例

假设 Prefab 结构如下:

```
Root
  ├── @Btn_Confirm         (规范命名，Button 组件)
  ├── @Text_Title          (规范命名，Text 组件)
  ├── CancelButton         (非规范命名，Button 组件)
  └── Panel
      ├── @Img_Icon        (规范命名，Image 组件)
      └── DescriptionText  (非规范命名，Text 组件)
```

**混合模式收集结果**:

| Path | 组件类型 | 字段名 | 模式 |
|------|---------|--------|------|
| Root/@Btn_Confirm | Button | m_ConfirmBtn | 规范 |
| Root/@Text_Title | Text | m_TitleText | 规范 |
| Root/CancelButton | Button | m_CancelButtonBtn | 回退 |
| Root/Panel/@Img_Icon | Image | m_IconImg | 规范 |
| Root/Panel/DescriptionText | Text | m_DescriptionTextText | 回退 |

### C. 生成的代码示例（混合模式）

```csharp
// ========================================
// Auto-generated by UI Prefab Automation Tool
// Generated at: 2025-11-01 15:30:00
// DO NOT MODIFY THIS FILE MANUALLY!
// ========================================

using UnityEngine;
using UnityEngine.UI;
using BlackJack.BJFramework.Runtime;

namespace BlackJack.ProjectEF.Runtime.GameView.UI.Sample
{
    [AutoGenAliasName("Assets/GameProject/Resources/UI/SampleUI.prefab", "", "SampleUIController")]
    public class SampleUICtrlDesc : PrefabControllerDescBase
    {
        [Header("确认按钮")]
        [AutoGenAliasName("Root/@Btn_Confirm")]
        public Button m_ConfirmBtn;

        [Header("标题文本")]
        [AutoGenAliasName("Root/@Text_Title")]
        public Text m_TitleText;

        [Header("CancelButton")]
        [AutoGenAliasName("Root/CancelButton")]
        public Button m_CancelButtonBtn;

        [Header("图标图片")]
        [AutoGenAliasName("Root/Panel/@Img_Icon")]
        public Image m_IconImg;

        [Header("DescriptionText")]
        [AutoGenAliasName("Root/Panel/DescriptionText")]
        public Text m_DescriptionTextText;
    }
}
```

### C2. 生成的代码示例（包含特殊组件） - NEW

```csharp
// ========================================
// Auto-generated by UI Prefab Automation Tool
// Generated at: 2025-11-01 16:00:00
// DO NOT MODIFY THIS FILE MANUALLY!
// ========================================

using UnityEngine;
using UnityEngine.UI;
using BlackJack.BJFramework.Runtime;
using System.Collections.Generic;

namespace BlackJack.ProjectEF.Runtime.GameView.UI.CatchFish
{
    [AutoGenAliasName("Assets/GameProject/Resources/UI/CatchFishUI.prefab", "", "CatchFishUIController")]
    public class CatchFishUICtrlDesc : PrefabControllerDescBase
    {
        [Header("确认按钮")]
        [AutoGenAliasName("Root/Panel/@Btn_Confirm")]
        public ButtonEx m_ConfirmBtn;

        [Header("UI状态控制器")]
        [AutoGenAliasName("Root/StateController")]
        public AdvanceUIStateController m_catchFishUIStateController;

        [Header("难度选择")]
        [AutoGenAliasName("Root/Panel/DifficultyDropdown")]
        public Dropdown m_difficultyDropdown;

        // ========== 特殊组件额外字段 ==========

        /// <summary>
        /// CatchFishUI 状态列表
        /// </summary>
        public static readonly List<string> m_catchFishUIStateList = new List<string>
        {
            "Close",
            "Show",
            "Fishing",
            "CatchSuccess",
            "CatchFail",
            "Result"
        };

        /// <summary>
        /// 下拉框选项列表
        /// </summary>
        public static readonly List<string> m_difficultyOptions = new List<string>
        {
            "简单",
            "普通",
            "困难",
            "专家"
        };
    }
}
```

### D. 批量操作功能使用示例

#### 场景 1: 只导出 Button 组件

假设收集到以下组件：

| 组件 | 类型 | 默认选择 |
|------|------|---------|
| m_ConfirmBtn | Button | ☑ |
| m_CancelBtn | Button | ☑ |
| m_TitleText | Text | ☑ |
| m_DescText | Text | ☑ |
| m_IconImg | Image | ☑ |

**操作步骤**：
1. 点击 "全不选" 按钮
2. 在 "按类型" 下拉框中选择 "Button"

**结果**：只有 m_ConfirmBtn 和 m_CancelBtn 被选中导出。

#### 场景 2: 只导出规范模式的组件

假设收集到以下组件（混合模式）：

| 组件 | 类型 | 模式 | 默认选择 |
|------|------|------|---------|
| m_ConfirmBtn | Button | 规范 | ☑ |
| m_CancelButtonBtn | Button | 回退 | ☑ |
| m_TitleText | Text | 规范 | ☑ |
| m_DescTextText | Text | 回退 | ☑ |

**操作步骤**：
1. 点击 "全不选" 按钮
2. 在 "按模式" 下拉框中选择 "规范"

**结果**：只有规范模式的组件（m_ConfirmBtn, m_TitleText）被选中导出。

#### 场景 3: 排除某些不需要的组件

假设收集到 20 个组件，但只有 3 个调试用的 Text 不需要导出。

**操作步骤**：
1. 保持默认 "全选" 状态
2. 手动取消勾选那 3 个不需要的组件

或者：
1. 点击 "反选" 按钮（所有组件变为未选中）
2. 再次点击 "反选" 按钮（恢复全选）
3. 手动取消勾选不需要的组件

#### 场景 4: 快速切换选择方案

**快捷操作**：
- **全选** → 导出所有组件
- **全不选** → 不导出任何组件（用于自定义选择）
- **反选** → 快速切换选择状态（已选变未选，未选变已选）

#### 批量操作 API 总结

| 方法 | 功能 | 使用场景 |
|------|------|---------|
| `SelectAll()` | 选中所有组件 | 默认导出全部 |
| `DeselectAll()` | 取消所有选择 | 从零开始选择 |
| `InvertSelection()` | 反转选择状态 | 快速切换或排除少量组件 |
| `SelectByType(type)` | 按类型选择 | 只导出特定类型（如只要 Button） |
| `SelectByMode(mode)` | 按模式选择 | 只导出规范/回退模式的组件 |

---

## 总结

V2 版本的核心改进：

1. **双模式支持**：完美兼容规范命名和非规范命名的 Prefab
   - 规范模式、回退模式、混合模式
   - Smart 智能命名策略，自动优化变量名

2. **批量操作功能**：灵活的导出选择控制
   - 全选/全不选/反选基础操作
   - 按类型筛选（只导出 Button、Text 等）
   - 按模式筛选（只导出规范/回退组件）
   - 实时统计导出数量

3. **特殊组件额外字段导出** ⭐ NEW
   - 插件式处理器架构，易于扩展
   - 自动提取组件额外数据（如状态列表、选项列表）
   - 生成 static readonly 常量字段
   - UI 支持可视化编辑额外字段
   - 内置 AdvanceUIStateController、Dropdown 处理器

4. **增强的用户体验**
   - 清晰的模式标识（规范 vs 回退）
   - 特殊组件可视化标记（★）
   - 详细的状态栏统计
   - 直观的额外字段编辑器

5. **灵活配置**：可自定义收集的组件类型、命名策略等

6. **向后兼容**：规范模式保持原有功能，不影响已有工作流

### 应用价值

- **减少手写常量** - 状态名、选项等自动提取，避免硬编码
- **类型安全** - 通过常量字段引用，编译时检查
- **同步更新** - 组件修改后重新收集，自动更新常量
- **提升效率** - 批量操作 + 智能命名，大幅减少手动工作

### 完整文档

- **主设计方案**: `UI_Prefab_Automation_Tool_Design_V2.md` (本文档)
- **特殊组件详细设计**: `UI_Prefab_Tool_Special_Component_Feature.md`
- **更新总结**: `UI_Prefab_Tool_Updates_Summary.md`
- **需求文档**: `UI_Prefab_Automation_Tool_Requirements.md`

这个设计方案既保留了规范命名的优势，又为实际项目中非规范美术资源提供了完整的解决方案，并通过批量操作和特殊组件功能大幅提升了实用性和开发效率。
