# UI Prefab 自动化工具 - 特殊组件额外字段导出功能设计

## 需求背景

对于某些特殊类型的组件（如 `AdvanceUIStateController`），除了导出组件引用本身，还需要导出该组件的**额外信息**作为常量字段。

### 示例需求

**组件类型**: `AdvanceUIStateController`

**导出内容**:
1. 组件引用（常规）:
   ```csharp
   [Header("UI状态控制器")]
   [AutoGenAliasName("Root/StateController")]
   public AdvanceUIStateController m_catchFishUIStateController;
   ```

2. 状态名列表（额外字段）:
   ```csharp
   /// <summary>
   /// CatchFishUI 状态列表
   /// </summary>
   public static readonly List<string> m_catchFishUIStateList = new List<string>
   {
       "Close",
       "Show",
       "Fishing",
       "Result"
   };
   ```

---

## 设计方案

### 1. 核心概念

#### 1.1 特殊组件处理器

为每种特殊组件类型定义一个**处理器**，负责：
- 识别组件类型
- 提取额外数据
- 定义额外字段的生成规则

#### 1.2 额外字段信息

每个额外字段包含：
- 字段类型（如 `List<string>`, `string[]`, `Dictionary<string, int>`）
- 字段名称
- 字段值（数据）
- 访问修饰符（public/private）
- 是否 static/readonly

---

## 数据结构设计

### 2.1 ExtraFieldInfo (额外字段信息)

```csharp
/// <summary>
/// 额外字段信息 - 描述特殊组件需要导出的额外字段
/// </summary>
[Serializable]
public class ExtraFieldInfo
{
    /// <summary>
    /// 字段类型（完整类型名）
    /// 示例: "List<string>", "string[]", "Dictionary<string, int>"
    /// </summary>
    public string FieldType;

    /// <summary>
    /// 字段名称
    /// 示例: "m_catchFishUIStateList"
    /// </summary>
    public string FieldName;

    /// <summary>
    /// 字段值（序列化为 JSON 或字符串）
    /// 示例: ["Close", "Show", "Fishing"]
    /// </summary>
    public object FieldValue;

    /// <summary>
    /// 访问修饰符
    /// </summary>
    public AccessModifier AccessModifier = AccessModifier.Public;

    /// <summary>
    /// 是否 static
    /// </summary>
    public bool IsStatic = true;

    /// <summary>
    /// 是否 readonly
    /// </summary>
    public bool IsReadOnly = true;

    /// <summary>
    /// 字段注释（XML 文档注释）
    /// 示例: "CatchFishUI 状态列表"
    /// </summary>
    public string Comment;

    /// <summary>
    /// 值的初始化代码（自定义生成逻辑）
    /// 如果为空，则根据 FieldValue 自动生成
    /// </summary>
    public string CustomInitializer;
}

/// <summary>
/// 访问修饰符枚举
/// </summary>
public enum AccessModifier
{
    Public,
    Private,
    Protected,
    Internal
}
```

### 2.2 ComponentInfo 扩展

```csharp
/// <summary>
/// 组件信息 - 扩展支持额外字段
/// </summary>
[Serializable]
public class ComponentInfo
{
    // ... 原有字段 ...

    /// <summary>
    /// 额外字段列表（特殊组件专用）
    /// </summary>
    public List<ExtraFieldInfo> ExtraFields = new List<ExtraFieldInfo>();

    /// <summary>
    /// 是否为特殊组件（有额外字段）
    /// </summary>
    public bool IsSpecialComponent => ExtraFields.Count > 0;
}
```

### 2.3 ISpecialComponentProcessor (特殊组件处理器接口)

```csharp
/// <summary>
/// 特殊组件处理器接口 - 用于提取特殊组件的额外数据
/// </summary>
public interface ISpecialComponentProcessor
{
    /// <summary>
    /// 组件类型名称（全类名）
    /// </summary>
    string ComponentTypeName { get; }

    /// <summary>
    /// 是否支持该组件
    /// </summary>
    bool CanProcess(Component component);

    /// <summary>
    /// 提取额外字段信息
    /// </summary>
    /// <param name="component">组件实例</param>
    /// <param name="componentInfo">组件基础信息</param>
    /// <returns>额外字段列表</returns>
    List<ExtraFieldInfo> ExtractExtraFields(Component component, ComponentInfo componentInfo);
}
```

---

## 内置特殊组件处理器实现

### 3.1 AdvanceUIStateController 处理器

```csharp
using UnityEngine;
using System.Collections.Generic;
using System.Linq;

namespace BlackJack.ProjectEF.Editor.Tools.SpecialProcessors
{
    /// <summary>
    /// AdvanceUIStateController 特殊组件处理器
    /// 提取状态名列表
    /// </summary>
    public class AdvanceUIStateControllerProcessor : ISpecialComponentProcessor
    {
        public string ComponentTypeName => "AdvanceUIStateController";

        public bool CanProcess(Component component)
        {
            if (component == null) return false;
            return component.GetType().Name == ComponentTypeName;
        }

        public List<ExtraFieldInfo> ExtractExtraFields(Component component, ComponentInfo componentInfo)
        {
            List<ExtraFieldInfo> extraFields = new List<ExtraFieldInfo>();

            // 通过反射获取状态名列表
            var stateNames = GetStateNames(component);

            if (stateNames.Count == 0)
            {
                Debug.LogWarning($"组件 {componentInfo.GameObjectName} 没有定义任何状态");
                return extraFields;
            }

            // 生成字段名：基于组件字段名
            // m_catchFishUIStateController → m_catchFishUIStateList
            string listFieldName = GenerateStateListFieldName(componentInfo.FieldName);

            // 生成注释
            string comment = $"{GetUIName(componentInfo.FieldName)} 状态列表";

            // 创建额外字段
            ExtraFieldInfo stateListField = new ExtraFieldInfo
            {
                FieldType = "List<string>",
                FieldName = listFieldName,
                FieldValue = stateNames,
                AccessModifier = AccessModifier.Public,
                IsStatic = true,
                IsReadOnly = true,
                Comment = comment
            };

            extraFields.Add(stateListField);

            return extraFields;
        }

        /// <summary>
        /// 通过反射获取状态名列表
        /// </summary>
        private List<string> GetStateNames(Component component)
        {
            List<string> stateNames = new List<string>();

            // 假设 AdvanceUIStateController 有一个 GetStateNames() 方法或 states 字段
            var type = component.GetType();

            // 方式 1: 尝试调用 GetStateNames() 方法
            var method = type.GetMethod("GetStateNames");
            if (method != null)
            {
                var result = method.Invoke(component, null);
                if (result is List<string> list)
                {
                    return list;
                }
                else if (result is string[] array)
                {
                    return array.ToList();
                }
            }

            // 方式 2: 尝试读取 states 字段
            var field = type.GetField("states") ?? type.GetField("m_states");
            if (field != null)
            {
                var value = field.GetValue(component);
                if (value is List<string> list)
                {
                    return list;
                }
                else if (value is string[] array)
                {
                    return array.ToList();
                }
            }

            // 方式 3: 尝试读取序列化字段（SerializedObject）
            var serializedObject = new UnityEditor.SerializedObject(component);
            var statesProperty = serializedObject.FindProperty("m_stateNames");

            if (statesProperty != null && statesProperty.isArray)
            {
                for (int i = 0; i < statesProperty.arraySize; i++)
                {
                    var element = statesProperty.GetArrayElementAtIndex(i);
                    stateNames.Add(element.stringValue);
                }
            }

            return stateNames;
        }

        /// <summary>
        /// 生成状态列表字段名
        /// m_catchFishUIStateController → m_catchFishUIStateList
        /// </summary>
        private string GenerateStateListFieldName(string componentFieldName)
        {
            // 移除 "Controller" 后缀，添加 "List" 后缀
            string baseName = componentFieldName.Replace("Controller", "")
                                                 .Replace("controller", "");

            return $"{baseName}List";
        }

        /// <summary>
        /// 从字段名提取 UI 名称
        /// m_catchFishUIStateController → CatchFishUI
        /// </summary>
        private string GetUIName(string fieldName)
        {
            // 移除前缀和后缀
            string cleaned = fieldName.Replace("m_", "")
                                      .Replace("StateController", "")
                                      .Replace("UIStateController", "");

            // 首字母大写
            if (!string.IsNullOrEmpty(cleaned))
            {
                cleaned = char.ToUpper(cleaned[0]) + cleaned.Substring(1);
            }

            return cleaned;
        }
    }
}
```

### 3.2 Dropdown 处理器（选项列表）

```csharp
/// <summary>
/// Dropdown 特殊组件处理器
/// 提取选项文本列表
/// </summary>
public class DropdownProcessor : ISpecialComponentProcessor
{
    public string ComponentTypeName => "Dropdown";

    public bool CanProcess(Component component)
    {
        return component is UnityEngine.UI.Dropdown;
    }

    public List<ExtraFieldInfo> ExtractExtraFields(Component component, ComponentInfo componentInfo)
    {
        List<ExtraFieldInfo> extraFields = new List<ExtraFieldInfo>();

        var dropdown = component as UnityEngine.UI.Dropdown;
        if (dropdown == null || dropdown.options.Count == 0)
        {
            return extraFields;
        }

        // 提取选项文本
        List<string> optionTexts = dropdown.options.Select(o => o.text).ToList();

        // 生成字段名：m_difficultyDropdown → m_difficultyOptions
        string optionsFieldName = componentInfo.FieldName.Replace("Dropdown", "Options");

        ExtraFieldInfo optionsField = new ExtraFieldInfo
        {
            FieldType = "List<string>",
            FieldName = optionsFieldName,
            FieldValue = optionTexts,
            AccessModifier = AccessModifier.Public,
            IsStatic = true,
            IsReadOnly = true,
            Comment = "下拉框选项列表"
        };

        extraFields.Add(optionsField);

        return extraFields;
    }
}
```

---

## 配置系统扩展

### 4.1 ToolConfig 扩展

```csharp
/// <summary>
/// 工具配置 - 扩展支持特殊组件
/// </summary>
[Serializable]
public class ToolConfig
{
    // ... 原有配置 ...

    // ========== 特殊组件配置 (NEW) ==========

    /// <summary>
    /// 是否启用特殊组件处理
    /// </summary>
    public bool EnableSpecialComponentProcessing = true;

    /// <summary>
    /// 特殊组件配置列表
    /// </summary>
    public List<SpecialComponentConfig> SpecialComponentConfigs = new List<SpecialComponentConfig>
    {
        new SpecialComponentConfig
        {
            ComponentTypeName = "AdvanceUIStateController",
            ProcessorTypeName = "AdvanceUIStateControllerProcessor",
            IsEnabled = true
        },
        new SpecialComponentConfig
        {
            ComponentTypeName = "Dropdown",
            ProcessorTypeName = "DropdownProcessor",
            IsEnabled = false // 默认禁用
        }
    };
}

/// <summary>
/// 特殊组件配置
/// </summary>
[Serializable]
public class SpecialComponentConfig
{
    /// <summary>
    /// 组件类型名称
    /// </summary>
    public string ComponentTypeName;

    /// <summary>
    /// 处理器类型名称（完整类名）
    /// </summary>
    public string ProcessorTypeName;

    /// <summary>
    /// 是否启用
    /// </summary>
    public bool IsEnabled;

    /// <summary>
    /// 自定义参数（JSON 格式）
    /// </summary>
    public string CustomParameters;
}
```

---

## 组件收集算法扩展

### 5.1 ComponentCollector 扩展

```csharp
/// <summary>
/// 组件收集器 - 扩展支持特殊组件处理
/// </summary>
public class ComponentCollector : IComponentCollector
{
    private SpecialComponentProcessorManager m_processorManager;

    public ComponentCollector()
    {
        m_processorManager = new SpecialComponentProcessorManager();
        RegisterBuiltInProcessors();
    }

    private void RegisterBuiltInProcessors()
    {
        m_processorManager.RegisterProcessor(new AdvanceUIStateControllerProcessor());
        m_processorManager.RegisterProcessor(new DropdownProcessor());
        // 可以继续注册更多处理器...
    }

    public List<ComponentInfo> CollectComponents(GameObject prefabRoot, ToolConfig config)
    {
        List<ComponentInfo> result = new List<ComponentInfo>();

        // ... 原有收集逻辑 ...

        // 处理特殊组件
        if (config.EnableSpecialComponentProcessing)
        {
            ProcessSpecialComponents(result, config);
        }

        return result;
    }

    /// <summary>
    /// 处理特殊组件，提取额外字段
    /// </summary>
    private void ProcessSpecialComponents(List<ComponentInfo> componentList, ToolConfig config)
    {
        foreach (var componentInfo in componentList)
        {
            if (componentInfo.ComponentRef == null) continue;

            // 检查是否有对应的处理器
            var processor = m_processorManager.GetProcessor(
                componentInfo.ComponentRef, config);

            if (processor != null)
            {
                // 提取额外字段
                var extraFields = processor.ExtractExtraFields(
                    componentInfo.ComponentRef, componentInfo);

                componentInfo.ExtraFields.AddRange(extraFields);

                Debug.Log($"[特殊组件] {componentInfo.GameObjectName} " +
                         $"提取了 {extraFields.Count} 个额外字段");
            }
        }
    }
}
```

### 5.2 SpecialComponentProcessorManager

```csharp
/// <summary>
/// 特殊组件处理器管理器
/// </summary>
public class SpecialComponentProcessorManager
{
    private Dictionary<string, ISpecialComponentProcessor> m_processors =
        new Dictionary<string, ISpecialComponentProcessor>();

    /// <summary>
    /// 注册处理器
    /// </summary>
    public void RegisterProcessor(ISpecialComponentProcessor processor)
    {
        if (!m_processors.ContainsKey(processor.ComponentTypeName))
        {
            m_processors.Add(processor.ComponentTypeName, processor);
        }
    }

    /// <summary>
    /// 获取组件对应的处理器
    /// </summary>
    public ISpecialComponentProcessor GetProcessor(Component component, ToolConfig config)
    {
        if (component == null) return null;

        string typeName = component.GetType().Name;

        // 检查配置中是否启用
        var componentConfig = config.SpecialComponentConfigs
            .FirstOrDefault(c => c.ComponentTypeName == typeName);

        if (componentConfig != null && !componentConfig.IsEnabled)
        {
            return null; // 配置中禁用了该组件的处理
        }

        // 查找处理器
        if (m_processors.ContainsKey(typeName))
        {
            var processor = m_processors[typeName];

            if (processor.CanProcess(component))
            {
                return processor;
            }
        }

        return null;
    }

    /// <summary>
    /// 获取所有已注册的处理器
    /// </summary>
    public List<ISpecialComponentProcessor> GetAllProcessors()
    {
        return m_processors.Values.ToList();
    }
}
```

---

## 代码生成扩展

### 6.1 CodeGenerator 扩展

```csharp
/// <summary>
/// 代码生成器 - 扩展支持额外字段
/// </summary>
public class CodeGenerator : ICodeGenerator
{
    public string GenerateCode(List<ComponentInfo> componentList, CodeGenConfig config)
    {
        StringBuilder sb = new StringBuilder();

        // 1. 生成文件头
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

        // 6. 生成常规字段
        GenerateFields(sb, componentList);

        // 7. 生成额外字段（特殊组件） - NEW
        GenerateExtraFields(sb, componentList);

        // 8. 关闭类和命名空间
        sb.AppendLine("    }");
        sb.AppendLine("}");

        return sb.ToString();
    }

    /// <summary>
    /// 生成额外字段（特殊组件）
    /// </summary>
    private void GenerateExtraFields(StringBuilder sb, List<ComponentInfo> componentList)
    {
        // 收集所有额外字段
        List<ExtraFieldInfo> allExtraFields = new List<ExtraFieldInfo>();

        foreach (var componentInfo in componentList)
        {
            if (componentInfo.IsExport && componentInfo.IsSpecialComponent)
            {
                allExtraFields.AddRange(componentInfo.ExtraFields);
            }
        }

        if (allExtraFields.Count == 0) return;

        // 添加分隔注释
        sb.AppendLine();
        sb.AppendLine("        // ========== 特殊组件额外字段 ==========");
        sb.AppendLine();

        // 生成每个额外字段
        for (int i = 0; i < allExtraFields.Count; i++)
        {
            ExtraFieldInfo extraField = allExtraFields[i];

            // 生成 XML 注释
            if (!string.IsNullOrEmpty(extraField.Comment))
            {
                sb.AppendLine("        /// <summary>");
                sb.AppendLine($"        /// {extraField.Comment}");
                sb.AppendLine("        /// </summary>");
            }

            // 生成字段声明
            string accessModifier = GetAccessModifierString(extraField.AccessModifier);
            string staticModifier = extraField.IsStatic ? "static " : "";
            string readonlyModifier = extraField.IsReadOnly ? "readonly " : "";

            sb.Append($"        {accessModifier} {staticModifier}{readonlyModifier}");
            sb.Append($"{extraField.FieldType} {extraField.FieldName}");

            // 生成初始化代码
            string initializer = GenerateFieldInitializer(extraField);
            if (!string.IsNullOrEmpty(initializer))
            {
                sb.Append($" = {initializer}");
            }

            sb.AppendLine(";");

            // 添加空行（最后一个字段除外）
            if (i < allExtraFields.Count - 1)
            {
                sb.AppendLine();
            }
        }
    }

    /// <summary>
    /// 生成字段初始化代码
    /// </summary>
    private string GenerateFieldInitializer(ExtraFieldInfo extraField)
    {
        // 如果有自定义初始化代码，直接使用
        if (!string.IsNullOrEmpty(extraField.CustomInitializer))
        {
            return extraField.CustomInitializer;
        }

        // 根据字段类型和值自动生成
        if (extraField.FieldValue == null)
        {
            return "";
        }

        // List<string> 类型
        if (extraField.FieldType == "List<string>")
        {
            List<string> list = extraField.FieldValue as List<string>;
            if (list != null && list.Count > 0)
            {
                StringBuilder sb = new StringBuilder();
                sb.AppendLine("new List<string>");
                sb.AppendLine("        {");

                for (int i = 0; i < list.Count; i++)
                {
                    string value = EscapeString(list[i]);
                    sb.Append($"            \"{value}\"");

                    if (i < list.Count - 1)
                    {
                        sb.AppendLine(",");
                    }
                    else
                    {
                        sb.AppendLine();
                    }
                }

                sb.Append("        }");
                return sb.ToString();
            }
        }

        // string[] 类型
        if (extraField.FieldType == "string[]")
        {
            List<string> list = extraField.FieldValue as List<string>;
            if (list != null && list.Count > 0)
            {
                StringBuilder sb = new StringBuilder();
                sb.Append("new string[] { ");

                for (int i = 0; i < list.Count; i++)
                {
                    string value = EscapeString(list[i]);
                    sb.Append($"\"{value}\"");

                    if (i < list.Count - 1)
                    {
                        sb.Append(", ");
                    }
                }

                sb.Append(" }");
                return sb.ToString();
            }
        }

        // Dictionary<string, string> 类型
        if (extraField.FieldType.StartsWith("Dictionary<"))
        {
            // 复杂类型，建议使用自定义初始化代码
            return "new Dictionary<string, string>()";
        }

        return "";
    }

    private string GetAccessModifierString(AccessModifier modifier)
    {
        switch (modifier)
        {
            case AccessModifier.Public: return "public";
            case AccessModifier.Private: return "private";
            case AccessModifier.Protected: return "protected";
            case AccessModifier.Internal: return "internal";
            default: return "public";
        }
    }

    private string EscapeString(string str)
    {
        return str.Replace("\\", "\\\\").Replace("\"", "\\\"");
    }
}
```

---

## Editor UI 扩展

### 7.1 组件列表显示额外字段

```csharp
private void DrawListElement(Rect rect, int index, bool isActive, bool isFocused)
{
    if (index >= m_componentList.Count) return;

    ComponentInfo info = m_componentList[index];
    float x = rect.x;
    float y = rect.y;

    // ... 原有字段绘制 ...

    // 如果是特殊组件，显示额外字段指示
    if (info.IsSpecialComponent)
    {
        x += 10;

        // 绘制特殊组件标记
        Color originalColor = GUI.color;
        GUI.color = Color.cyan;
        EditorGUI.LabelField(new Rect(x, y, 20, EditorGUIUtility.singleLineHeight), "★");
        GUI.color = originalColor;

        // 工具提示
        Rect specialRect = new Rect(x, y, 20, EditorGUIUtility.singleLineHeight);
        GUI.tooltip = $"特殊组件，包含 {info.ExtraFields.Count} 个额外字段";
    }
}
```

### 7.2 额外字段编辑面板

```csharp
/// <summary>
/// 绘制额外字段编辑面板
/// </summary>
private void DrawExtraFieldsPanel()
{
    if (m_componentList.Count == 0) return;

    // 检查是否有特殊组件
    var specialComponents = m_componentList.FindAll(c => c.IsSpecialComponent);
    if (specialComponents.Count == 0) return;

    EditorGUILayout.Space(10);
    EditorGUILayout.LabelField("H. 特殊组件额外字段", EditorStyles.boldLabel);

    foreach (var componentInfo in specialComponents)
    {
        if (!componentInfo.IsExport) continue;

        EditorGUILayout.BeginVertical(EditorStyles.helpBox);

        // 组件标题
        EditorGUILayout.LabelField($"{componentInfo.FieldName} ({componentInfo.ComponentType})",
                                   EditorStyles.boldLabel);

        // 遍历额外字段
        for (int i = 0; i < componentInfo.ExtraFields.Count; i++)
        {
            ExtraFieldInfo extraField = componentInfo.ExtraFields[i];

            EditorGUILayout.BeginHorizontal();

            // 字段名
            EditorGUILayout.LabelField(extraField.FieldName, GUILayout.Width(200));

            // 字段类型
            EditorGUILayout.LabelField(extraField.FieldType, GUILayout.Width(150));

            // 编辑按钮
            if (GUILayout.Button("编辑", GUILayout.Width(60)))
            {
                OpenExtraFieldEditor(componentInfo, extraField);
            }

            EditorGUILayout.EndHorizontal();

            // 显示字段值预览
            string valuePreview = GetFieldValuePreview(extraField);
            EditorGUILayout.LabelField($"  → {valuePreview}",
                                       EditorStyles.wordWrappedMiniLabel);
        }

        EditorGUILayout.EndVertical();
    }
}

/// <summary>
/// 获取字段值预览字符串
/// </summary>
private string GetFieldValuePreview(ExtraFieldInfo extraField)
{
    if (extraField.FieldValue == null) return "(null)";

    if (extraField.FieldValue is List<string> list)
    {
        if (list.Count == 0) return "[ ]";
        if (list.Count <= 3)
        {
            return $"[ {string.Join(", ", list.Select(s => $"\"{s}\""))} ]";
        }
        else
        {
            return $"[ \"{list[0]}\", \"{list[1]}\", ... ({list.Count} 项) ]";
        }
    }

    return extraField.FieldValue.ToString();
}

/// <summary>
/// 打开额外字段编辑器
/// </summary>
private void OpenExtraFieldEditor(ComponentInfo componentInfo, ExtraFieldInfo extraField)
{
    ExtraFieldEditorWindow.ShowWindow(componentInfo, extraField, OnExtraFieldEdited);
}

/// <summary>
/// 额外字段编辑完成回调
/// </summary>
private void OnExtraFieldEdited(ComponentInfo componentInfo, ExtraFieldInfo extraField)
{
    // 刷新显示
    Repaint();

    Debug.Log($"额外字段已更新: {extraField.FieldName}");
}
```

### 7.3 额外字段编辑器窗口

```csharp
/// <summary>
/// 额外字段编辑器窗口
/// </summary>
public class ExtraFieldEditorWindow : EditorWindow
{
    private ComponentInfo m_componentInfo;
    private ExtraFieldInfo m_extraField;
    private Action<ComponentInfo, ExtraFieldInfo> m_onComplete;

    private Vector2 m_scrollPosition;
    private List<string> m_stringListValue;

    public static void ShowWindow(ComponentInfo componentInfo, ExtraFieldInfo extraField,
                                   Action<ComponentInfo, ExtraFieldInfo> onComplete)
    {
        var window = GetWindow<ExtraFieldEditorWindow>("额外字段编辑器");
        window.m_componentInfo = componentInfo;
        window.m_extraField = extraField;
        window.m_onComplete = onComplete;
        window.minSize = new Vector2(400, 300);

        // 初始化编辑数据
        if (extraField.FieldValue is List<string> list)
        {
            window.m_stringListValue = new List<string>(list);
        }
        else
        {
            window.m_stringListValue = new List<string>();
        }

        window.Show();
    }

    private void OnGUI()
    {
        EditorGUILayout.LabelField("额外字段编辑", EditorStyles.boldLabel);
        EditorGUILayout.Space();

        // 显示组件信息
        EditorGUI.BeginDisabledGroup(true);
        EditorGUILayout.TextField("组件", m_componentInfo.FieldName);
        EditorGUILayout.TextField("字段名", m_extraField.FieldName);
        EditorGUILayout.TextField("字段类型", m_extraField.FieldType);
        EditorGUI.EndDisabledGroup();

        EditorGUILayout.Space();

        // 编辑字段值
        if (m_extraField.FieldType == "List<string>")
        {
            DrawStringListEditor();
        }

        EditorGUILayout.Space();

        // 操作按钮
        EditorGUILayout.BeginHorizontal();

        if (GUILayout.Button("保存", GUILayout.Height(30)))
        {
            SaveChanges();
            Close();
        }

        if (GUILayout.Button("取消", GUILayout.Height(30)))
        {
            Close();
        }

        EditorGUILayout.EndHorizontal();
    }

    private void DrawStringListEditor()
    {
        EditorGUILayout.LabelField("列表值:", EditorStyles.boldLabel);

        m_scrollPosition = EditorGUILayout.BeginScrollView(m_scrollPosition,
                                                            GUILayout.Height(200));

        for (int i = 0; i < m_stringListValue.Count; i++)
        {
            EditorGUILayout.BeginHorizontal();

            EditorGUILayout.LabelField($"[{i}]", GUILayout.Width(40));

            m_stringListValue[i] = EditorGUILayout.TextField(m_stringListValue[i]);

            if (GUILayout.Button("-", GUILayout.Width(30)))
            {
                m_stringListValue.RemoveAt(i);
                break;
            }

            EditorGUILayout.EndHorizontal();
        }

        EditorGUILayout.EndScrollView();

        if (GUILayout.Button("+ 添加项"))
        {
            m_stringListValue.Add("");
        }
    }

    private void SaveChanges()
    {
        // 更新字段值
        m_extraField.FieldValue = m_stringListValue;

        // 触发回调
        m_onComplete?.Invoke(m_componentInfo, m_extraField);
    }
}
```

---

## 配置 UI 扩展

### 8.1 特殊组件配置面板

```csharp
private void DrawSpecialComponentConfig()
{
    EditorGUILayout.Space(10);
    EditorGUILayout.LabelField("特殊组件配置", EditorStyles.boldLabel);

    EditorGUILayout.BeginVertical(EditorStyles.helpBox);

    // 启用开关
    m_config.EnableSpecialComponentProcessing = EditorGUILayout.Toggle(
        "启用特殊组件处理", m_config.EnableSpecialComponentProcessing);

    if (m_config.EnableSpecialComponentProcessing)
    {
        EditorGUILayout.Space(5);
        EditorGUILayout.LabelField("已注册的特殊组件处理器:", EditorStyles.boldLabel);

        // 显示处理器列表
        foreach (var config in m_config.SpecialComponentConfigs)
        {
            EditorGUILayout.BeginHorizontal();

            config.IsEnabled = EditorGUILayout.Toggle(config.IsEnabled, GUILayout.Width(20));
            EditorGUILayout.LabelField(config.ComponentTypeName, GUILayout.Width(200));
            EditorGUILayout.LabelField($"({config.ProcessorTypeName})",
                                       EditorStyles.miniLabel);

            EditorGUILayout.EndHorizontal();
        }

        if (GUILayout.Button("+ 添加自定义处理器"))
        {
            // 打开自定义处理器配置窗口
            // TODO: 实现
        }
    }

    EditorGUILayout.EndVertical();
}
```

---

## 生成代码示例

### 9.1 完整示例输出

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

---

## 使用流程

### 场景 1: 使用内置处理器

```
1. 拖入包含 AdvanceUIStateController 的 Prefab
2. 点击"一键收集组件"
   → 自动识别特殊组件
   → 提取状态列表
3. 在"特殊组件额外字段"面板查看/编辑状态
4. 点击"生成/更新描述文件"
   → 自动生成状态列表常量
```

### 场景 2: 自定义处理器

```
1. 创建自定义处理器类（实现 ISpecialComponentProcessor）
2. 在配置中注册处理器
3. 启用该处理器
4. 收集组件时自动应用
```

---

## 扩展性设计

### 自定义处理器示例

```csharp
/// <summary>
/// 自定义组件处理器示例
/// </summary>
public class MyCustomComponentProcessor : ISpecialComponentProcessor
{
    public string ComponentTypeName => "MyCustomComponent";

    public bool CanProcess(Component component)
    {
        return component.GetType().Name == ComponentTypeName;
    }

    public List<ExtraFieldInfo> ExtractExtraFields(Component component,
                                                    ComponentInfo componentInfo)
    {
        List<ExtraFieldInfo> extraFields = new List<ExtraFieldInfo>();

        // 自定义提取逻辑
        // ...

        return extraFields;
    }
}
```

---

## 总结

### 核心优势

1. **灵活扩展** - 插件式处理器架构，易于添加新的特殊组件类型
2. **自动提取** - 通过反射/序列化自动提取组件数据
3. **可配置** - 支持启用/禁用特定处理器
4. **可编辑** - UI 支持手动编辑额外字段值
5. **代码生成** - 自动生成常量字段，提升代码可维护性

### 应用价值

- **减少硬编码** - 状态名等信息自动提取，避免手写常量
- **类型安全** - 通过常量字段引用，编译时检查
- **同步更新** - 组件修改后重新收集，自动更新常量
- **可追溯** - 额外字段注释清晰标注来源

### 下一步优化

1. 支持更多字段类型（int[], Dictionary 等）
2. 支持自定义代码生成模板
3. 支持处理器热重载
4. 提供处理器开发模板和向导
