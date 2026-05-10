# UI Prefab 自动化工具 - 更新总结

## 文档版本

- **V1 设计方案**: `UI_Prefab_Automation_Tool_Design.md` (基础版本)
- **V2 设计方案**: `UI_Prefab_Automation_Tool_Design_V2.md` (最新版本)
- **需求文档**: `UI_Prefab_Automation_Tool_Requirements.md`

---

## V2 版本核心功能

### 1. 双模式组件收集 ⭐⭐

#### 规范模式 (Strict Mode)
- 严格按照命名规范收集（仅收集带 `@` 前缀的节点）
- 示例: `@Btn_Confirm` → `m_ConfirmBtn`

#### 回退模式 (Fallback Mode)
- 按指定组件类型全局收集（适配非规范美术资源）
- 可配置收集类型列表：Button, Text, Image, Toggle 等
- 支持包含派生类型

#### 混合模式 (Hybrid Mode) - 推荐
- 优先规范模式，补充回退模式
- 同一 Prefab 同时支持规范命名和非规范命名
- 自动去重，避免重复收集

### 2. 智能命名策略 ⭐

回退模式支持 4 种命名策略：

| 策略 | 示例输入 | 输出变量名 |
|------|---------|-----------|
| **NodeName_TypeSuffix** | `ConfirmButton` (Button) | `m_ConfirmButtonBtn` |
| **NodeNameOnly** | `ConfirmButton` (Button) | `m_ConfirmButton` |
| **TypePrefix_NodeName** | `ConfirmButton` (Button) | `m_BtnConfirmButton` |
| **Smart** (推荐) | `ConfirmButton` (Button) | `m_ConfirmBtn` |

**Smart 策略**能识别节点名中的类型关键词，自动优化命名。

### 3. 批量操作功能 ⭐⭐ NEW

#### 基础操作
- **全选**: 选中所有组件导出
- **全不选**: 取消所有选择
- **反选**: 反转当前选择状态

#### 筛选操作
- **按类型筛选**: 只选择特定类型的组件（如只选 Button）
- **按模式筛选**: 只选择规范模式或回退模式的组件

#### 使用场景

**场景 1: 只导出交互组件**
```
操作: 全不选 → 按类型选择 "Button"
结果: 仅导出所有按钮组件
```

**场景 2: 只导出规范命名的组件**
```
操作: 全不选 → 按模式选择 "规范"
结果: 仅导出符合命名规范的组件
```

**场景 3: 排除少量不需要的组件**
```
操作: 保持全选 → 手动取消勾选 3 个调试组件
结果: 导出除调试组件外的所有组件
```

### 4. 增强的 UI 设计

```
┌─────────────────────────────────────────────┐
│  D. 批量操作工具栏                           │
│  [全选] [全不选] [反选]                      │
│  按类型: [All ▼]  按模式: [All ▼]            │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  E. 组件列表预览区                           │
│  ☑ Path         Type    Field Name   模式   │
│  ─────────────────────────────────────────  │
│  ☑ @Btn_Confirm ButtonEx m_ConfirmBtn 规范  │
│  ☐ CancelBtn    Button   m_CancelBtn  回退  │
│  ☑ @Text_Title  Text     m_TitleText  规范  │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  G. 状态栏                                   │
│  收集 15 个 | 导出 12 个 (规范:7, 回退:5)    │
└─────────────────────────────────────────────┘
```

### 5. 特殊组件额外字段导出 ⭐⭐⭐ NEW

#### 核心概念

对于特殊类型组件（如状态机、下拉框等），支持导出额外信息作为常量字段。

#### 示例：AdvanceUIStateController

**收集到的组件**:
```csharp
[Header("UI状态控制器")]
[AutoGenAliasName("Root/StateController")]
public AdvanceUIStateController m_catchFishUIStateController;
```

**自动导出状态列表**:
```csharp
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
```

#### 核心特性

1. **插件式处理器架构**
   - 通过 `ISpecialComponentProcessor` 接口扩展
   - 易于添加新的特殊组件类型

2. **自动提取数据**
   - 通过反射/SerializedObject 自动提取组件数据
   - 无需手动配置

3. **可配置**
   - 支持启用/禁用特定处理器
   - 支持自定义处理器参数

4. **可视化编辑**
   - UI 显示特殊组件标记（★）
   - 额外字段编辑器窗口
   - 实时预览额外字段值

5. **内置处理器**
   - `AdvanceUIStateController` - 提取状态列表
   - `Dropdown` - 提取选项列表
   - 易于扩展更多处理器

#### 应用价值

- **减少硬编码** - 状态名等信息自动提取，避免手写常量
- **类型安全** - 通过常量字段引用，编译时检查
- **同步更新** - 组件修改后重新收集，自动更新常量
- **可追溯** - 额外字段注释清晰标注来源

#### 详细设计

完整设计文档: `UI_Prefab_Tool_Special_Component_Feature.md`

### 6. 详细的统计信息

状态栏显示：
- **收集总数**: 从 Prefab 收集到的组件总数
- **导出数量**: 用户勾选要导出的组件数量
- **模式分布**: 分别显示规范模式和回退模式的导出数量
- **特殊组件**: 显示包含额外字段的特殊组件数量

---

## 核心数据结构

### CollectionMode 枚举
```csharp
public enum CollectionMode
{
    Strict,    // 规范模式
    Fallback,  // 回退模式
    Hybrid     // 混合模式（推荐）
}
```

### FallbackNamingStrategy 枚举
```csharp
public enum FallbackNamingStrategy
{
    NodeName_TypeSuffix,  // 节点名+类型后缀
    NodeNameOnly,         // 仅节点名
    TypePrefix_NodeName,  // 类型前缀+节点名
    Smart                 // 智能识别（推荐）
}
```

### ComponentInfo 扩展
```csharp
public class ComponentInfo
{
    // ... 原有字段

    public bool IsExport;                 // 是否导出（支持用户勾选）
    public CollectionMode CollectionMode; // 收集模式标识

    // 特殊组件扩展 (NEW)
    public List<ExtraFieldInfo> ExtraFields = new List<ExtraFieldInfo>(); // 额外字段列表
    public bool IsSpecialComponent => ExtraFields.Count > 0;               // 是否为特殊组件
}
```

### ExtraFieldInfo (额外字段信息) - NEW

```csharp
[Serializable]
public class ExtraFieldInfo
{
    public string FieldType;              // 字段类型（如 "List<string>"）
    public string FieldName;              // 字段名称
    public object FieldValue;             // 字段值
    public AccessModifier AccessModifier; // 访问修饰符
    public bool IsStatic;                 // 是否 static
    public bool IsReadOnly;               // 是否 readonly
    public string Comment;                // XML 文档注释
    public string CustomInitializer;      // 自定义初始化代码
}
```

---

## 核心算法

### 1. 混合模式收集算法

```csharp
public List<ComponentInfo> CollectComponents(GameObject prefabRoot, ToolConfig config)
{
    switch (config.CollectionMode)
    {
        case CollectionMode.Hybrid:
            HashSet<string> collectedPaths = new HashSet<string>();

            // 第一步：收集规范命名的组件
            CollectByNamingConvention(prefabRoot, collectedPaths);

            // 第二步：收集剩余的指定类型组件（避免重复）
            CollectByComponentType(prefabRoot, collectedPaths);
            break;
    }
}
```

### 2. Smart 命名策略

```csharp
private string GenerateSmartFieldName(string nodeName, string typeAbbr)
{
    // 检测并移除节点名中的类型关键词
    // "ConfirmButton" → 识别 "Button" → "Confirm" + "Btn" → "m_ConfirmBtn"

    string[] typeNames = { "Button", "Text", "Image", "Toggle", "Slider" };

    foreach (string typeName in typeNames)
    {
        if (nodeName.EndsWith(typeName))
        {
            string baseDescription = nodeName.Substring(0, nodeName.Length - typeName.Length);
            return $"m_{baseDescription}{typeAbbr}";
        }
    }

    return $"m_{nodeName}{typeAbbr}";
}
```

### 3. 批量操作 API

```csharp
// 基础操作
void SelectAll()                          // 全选
void DeselectAll()                        // 全不选
void InvertSelection()                    // 反选

// 筛选操作
void SelectByType(string componentType)   // 按类型选择
void SelectByMode(CollectionMode mode)    // 按模式选择

// 辅助方法
List<string> GetAllComponentTypes()       // 获取所有组件类型列表
```

---

## 使用流程

### 流程 1: 规范团队使用

```
1. 拖入 Prefab
2. 选择"规范模式"
3. 点击"一键收集组件"
4. （可选）使用批量操作调整导出组件
5. 点击"生成/更新描述文件"
```

### 流程 2: 非规范美术资源

```
1. 拖入 Prefab
2. 选择"回退模式"
3. 配置要收集的组件类型（Button, Text, Image...）
4. 选择命名策略（推荐 Smart）
5. 点击"一键收集组件"
6. 使用批量操作：
   - 按类型筛选：只导出 Button 和 Toggle
   - 手动调整字段名和中文描述
7. 点击"生成/更新描述文件"
```

### 流程 3: 混合场景（推荐）

```
1. 拖入 Prefab
2. 选择"混合模式"
3. 配置回退模式的类型和策略
4. 点击"一键收集组件"
   → 自动收集：规范命名组件（8个）+ 非规范组件（7个）
5. 使用批量操作：
   - 查看"规范"模式组件 → 确认命名正确
   - 查看"回退"模式组件 → 调整中文描述
   - 按类型查看"Image"组件 → 取消不需要的背景图片
6. 状态栏显示：收集 15 个 | 导出 12 个 (规范:7, 回退:5)
7. 点击"生成/更新描述文件"
```

### 流程 4: 包含特殊组件（NEW）

```
1. 拖入包含 AdvanceUIStateController 的 Prefab
2. 选择"混合模式"
3. 启用特殊组件处理
4. 点击"一键收集组件"
   → 自动识别特殊组件（标记 ★）
   → 自动提取状态列表
5. 在"特殊组件额外字段"面板：
   - 查看提取的状态列表
   - 点击"编辑"调整状态名称
   - 可以添加/删除状态
6. 使用批量操作：
   - 确认要导出的组件
7. 点击"生成/更新描述文件"
   → 生成组件引用 + 状态列表常量
8. 在代码中使用：
   ```csharp
   // 直接引用常量，类型安全
   m_stateController.ChangeState(CatchFishUICtrlDesc.m_catchFishUIStateList[0]);
   ```
```

---

## 配置示例

### ToolConfig 关键配置

```csharp
// 收集模式
config.CollectionMode = CollectionMode.Hybrid;

// 回退模式配置
config.FallbackComponentTypes = new List<string>
{
    "Button", "Text", "Image", "Toggle",
    "Slider", "InputField", "Dropdown"
};

config.FallbackNaming = FallbackNamingStrategy.Smart;
config.IncludeDerivedTypes = true;

// 规范模式配置
config.CollectPrefix = "@";
config.NameSeparator = "_";
config.VariablePrefix = "m_";
config.AppendTypeSuffix = true;

// 特殊组件配置 (NEW)
config.EnableSpecialComponentProcessing = true;
config.SpecialComponentConfigs = new List<SpecialComponentConfig>
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
        IsEnabled = false
    }
};
```

---

## 生成代码对比

### 规范模式生成

```csharp
[Header("确认按钮")]
[AutoGenAliasName("Root/@Btn_Confirm")]
public ButtonEx m_ConfirmBtn;
```

### 回退模式生成 (Smart 策略)

```csharp
[Header("Confirm按钮")]
[AutoGenAliasName("Root/ConfirmButton")]
public Button m_ConfirmBtn;
```

### 混合模式生成

```csharp
// 规范模式组件
[Header("确认按钮")]
[AutoGenAliasName("Root/@Btn_Confirm")]
public ButtonEx m_ConfirmBtn;

// 回退模式组件
[Header("Cancel按钮")]
[AutoGenAliasName("Root/CancelButton")]
public Button m_CancelBtn;
```

### 包含特殊组件 (NEW)

```csharp
// 组件引用
[Header("UI状态控制器")]
[AutoGenAliasName("Root/StateController")]
public AdvanceUIStateController m_catchFishUIStateController;

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
```

---

## 优势总结

### ✅ 适配性
- **100% 兼容美术资源** - 不需要美术改名也能使用
- **向后兼容** - 规范模式保持原有工作流

### ✅ 灵活性
- **智能命名** - Smart 策略生成最优变量名
- **批量操作** - 快速选择/排除组件
- **按需配置** - 可根据项目需求调整规则

### ✅ 效率提升
- **一键收集** - 混合模式自动处理两种命名
- **智能去重** - 避免重复收集
- **实时预览** - 所见即所得

### ✅ 清晰可控
- **模式标识** - 清晰区分规范/回退组件
- **详细统计** - 实时显示导出数量和分布
- **手动调整** - 支持用户精细控制

### ✅ 减少硬编码 (NEW - 特殊组件)
- **自动提取常量** - 状态名、选项等自动导出
- **类型安全** - 编译时检查，避免拼写错误
- **同步更新** - 组件修改后重新收集，自动同步
- **可追溯** - 清晰的注释标明来源

---

## 开发计划更新

### 新增任务

| 阶段 | 任务 | 预估时间 |
|------|------|---------|
| **批量操作功能** | | |
| | 批量操作工具栏 UI | 0.5 天 |
| | 批量操作逻辑实现 | 0.5 天 |
| | 按类型/模式筛选 | 0.5 天 |
| | 状态栏导出统计 | 0.5 天 |
| **特殊组件功能** (NEW) | | |
| | ExtraFieldInfo 数据结构 | 0.5 天 |
| | ISpecialComponentProcessor 接口 | 0.5 天 |
| | SpecialComponentProcessorManager | 1 天 |
| | AdvanceUIStateController 处理器 | 1 天 |
| | Dropdown 处理器 | 0.5 天 |
| | ComponentCollector 扩展 | 1 天 |
| | CodeGenerator 扩展 | 1.5 天 |
| | 额外字段编辑 UI | 1.5 天 |
| | ExtraFieldEditorWindow | 1 天 |
| | 特殊组件配置面板 | 0.5 天 |
| **测试** | | |
| | 批量操作单元测试 | 0.5 天 |
| | 特殊组件单元测试 | 1 天 |

**批量操作新增**: 2 天
**特殊组件新增**: 9.5 天
**总新增时间**: 11.5 天

**V2 总计**: 约 32.5 天 (约 6.5 周)

---

## 下一步行动

1. ✅ **设计方案已完成**
   - `UI_Prefab_Automation_Tool_Design_V2.md` (主设计方案)
   - `UI_Prefab_Tool_Special_Component_Feature.md` (特殊组件详细设计)
   - `UI_Prefab_Tool_Updates_Summary.md` (更新总结)

2. ⏭ **Phase 1: 核心功能实现**
   - 数据结构定义（包括 ExtraFieldInfo）
   - ComponentCollector 双模式实现
   - NameParser 双模式实现
   - 特殊组件处理器接口和管理器

3. ⏭ **Phase 2: Editor UI 实现**
   - 模式选择器
   - 批量操作工具栏
   - 增强的组件列表（特殊组件标记）
   - 额外字段编辑器窗口

4. ⏭ **Phase 3: 内置处理器实现**
   - AdvanceUIStateController 处理器
   - Dropdown 处理器
   - 代码生成器扩展

5. ⏭ **Phase 4: 测试与优化**
   - 单元测试（双模式 + 特殊组件）
   - 集成测试
   - 性能优化

---

## 技术栈

- **Unity 2022.3.44f1**
- **C# (.NET Framework)**
- **UnityEditor API**
- **ReorderableList**
- **正则表达式 (Regex)**
- **ScriptableObject (配置持久化)**

---

## 文档位置

所有文档位于: `H:\Work\U3D_EF\ProjectEF\Assets\Doc\`

- `UI_Prefab_Automation_Tool_Requirements.md` - 需求文档
- `UI_Prefab_Automation_Tool_Design.md` - V1 设计方案
- `UI_Prefab_Automation_Tool_Design_V2.md` - **V2 主设计方案（最新）**
- `UI_Prefab_Tool_Special_Component_Feature.md` - **特殊组件详细设计（NEW）**
- `UI_Prefab_Tool_Updates_Summary.md` - 本文档（更新总结）

---

## 功能特性总览

### 已实现（V1）
- ✅ 规范模式组件收集
- ✅ C# 描述文件生成
- ✅ 已存在文件智能合并

### 新增（V2）
- ⭐⭐ 双模式支持（规范/回退/混合）
- ⭐⭐ 智能命名策略（Smart 策略）
- ⭐⭐ 批量操作功能（全选/按类型/按模式）
- ⭐⭐⭐ **特殊组件额外字段导出**

### 核心价值
- **适配性** - 100% 兼容非规范美术资源
- **效率** - 批量操作 + 智能命名，大幅减少手动工作
- **类型安全** - 特殊组件常量字段，编译时检查
- **可扩展** - 插件式处理器架构，易于添加新类型

---

**最后更新时间**: 2025-11-01
**版本**: V2.1 (添加特殊组件功能)
**状态**: 设计完成，待实现
**预估开发时间**: 32.5 天 (约 6.5 周)
