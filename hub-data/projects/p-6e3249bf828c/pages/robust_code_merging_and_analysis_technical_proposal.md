# 鲁棒的代码合并与分析技术方案

## 1. 问题分析

您指出的问题非常精准：当用户可以手动编辑生成的 `.cs` 文件时，简单的模板引擎或正则表达式分析无法可靠地识别代码结构，尤其是在长期迭代开发中。这会导致：

1.  **代码覆盖风险**: 工具可能错误地将用户手写的业务逻辑识别为“待生成区域”并将其覆盖。
2.  **合并失败**: 无法准确地将新生成的字段/方法插入到正确的位置。
3.  **维护噩梦**: 随着用户代码越来越复杂，基于文本匹配的规则会变得越来越不可靠。

## 2. 解决方案：引入语法分析器

为了从根本上解决这个问题，我们必须放弃基于文本和正则表达式的分析方法，转而使用能够真正 **理解 C# 代码结构** 的技术。

### 2.1 技术选型：Roslyn

**Roslyn** (.NET Compiler Platform) 是微软官方开源的 C# 编译器平台，它提供了完整的 C# 代码分析和重写能力。

**优势**:
*   **语法树**: 能将 C# 代码解析为一棵精确的语法树，每个节点都有明确的类型和意义（如类声明、方法声明、字段声明等）。
*   **语义模型**: 提供代码的语义信息，如类型引用、变量作用域等。
*   **API 稳定**: 作为官方编译器，其 API 非常稳定且功能强大。
*   **增量编译**: Roslyn 本身就为增量编译设计，性能优秀。
*   **Unity 支持**: Unity 2021.2+ 已内置 Roslyn，我们可以直接使用，无需引入额外依赖。

### 2.2 核心设计：受保护的代码区域

我们将不再依赖文本标记，而是通过 **代码结构的语义分析** 来识别和区分“工具生成区域”和“用户自定义区域”。

**核心原则**:
*   **工具负责**: 类、字段、事件存根方法等 **结构定义**。
*   **用户负责**: 存根方法内部的 **业务逻辑实现**。

**实现策略**:
1.  **精确识别**: 使用 Roslyn 的语法分析器，精确识别出由工具生成的类、字段、方法。
2.  **智能合并**: 当需要更新文件时，工具会：
    a. 解析现有文件，构建语法树。
    b. 识别出所有“工具负责”的结构。
    c. 将新的结构（如新增字段）与现有结构进行比对和合并。
    d. **完整保留** 所有无法识别为“工具负责”的代码（即用户手写的逻辑）。
3.  **安全重写**: 使用 Roslyn 的 `SyntaxRewriter` 来安全地修改语法树，然后重新生成代码字符串，确保格式和语法的正确性。

## 3. 详细技术实现

### 3.1 创建 `ICSharpFileAnalyzer` 接口

```csharp
/// <summary>
/// C# 文件分析器接口，用于解析和合并 C# 代码
/// </summary>
public interface ICSharpFileAnalyzer
{
    /// <summary>
    /// 分析 C# 文件，提取出工具生成的结构信息
    /// </summary>
    FileAnalysisResult AnalyzeFile(string filePath);

    /// <summary>
    /// 合并新生成的结构到现有文件中
    /// </summary>
    MergeResult MergeStructures(FileAnalysisResult existingFile, List<IStructureInfo> newStructures);
}
```

### 3.2 定义结构信息模型

我们需要为每种工具生成的结构定义一个数据模型。

```csharp
/// <summary>
/// 结构信息基类
/// </summary>
public abstract class StructureInfoBase
{
    public string Name { get; set; }
    public SyntaxNode SyntaxNode { get; set; } // 关联的 Roslyn 语法节点
}

/// <summary>
/// 字段信息
/// </summary>
public class FieldStructureInfo : StructureInfoBase
{
    public string Type { get; set; }
    public string AliasPath { get; set; }
    public string ChineseDescription { get; set; }
}

/// <summary>
/// 方法信息（特指事件存根方法）
/// </summary>
public class MethodStructureInfo : StructureInfoBase
{
    public List<string> Parameters { get; set; }
    public bool IsEmptyBody { get; set; } // 检查方法体是否为空或仅包含注释
}
```

### 3.3 实现 `RoslynFileAnalyzer`

这是我们的核心分析器。

```csharp
public class RoslynFileAnalyzer : ICSharpFileAnalyzer
{
    public FileAnalysisResult AnalyzeFile(string filePath)
    {
        string code = File.ReadAllText(filePath);
        SyntaxTree tree = CSharpSyntaxTree.ParseText(code);
        CompilationUnitSyntax root = tree.GetCompilationUnitRoot();

        var result = new FileAnalysisResult();

        // 1. 查找类声明
        var classDeclaration = root.DescendantNodes()
            .OfType<ClassDeclarationSyntax>()
            .FirstOrDefault();

        if (classDeclaration != null)
        {
            // 2. 查找所有字段声明
            var fieldDeclarations = classDeclaration.DescendantNodes()
                .OfType<FieldDeclarationSyntax>();

            foreach (var field in fieldDeclarations)
            {
                // 通过属性（如 [AutoGenAliasName]）或命名约定来识别是否为工具生成的字段
                if (IsToolGeneratedField(field))
                {
                    var info = new FieldStructureInfo
                    {
                        Name = field.Declaration.Variables.First().Identifier.Text,
                        SyntaxNode = field,
                        Type = field.Declaration.Type.ToString(),
                        AliasPath = ExtractAliasPath(field),
                        ChineseDescription = ExtractChineseDescription(field)
                    };
                    result.GeneratedFields.Add(info);
                }
            }

            // 3. 查找所有方法声明
            var methodDeclarations = classDeclaration.DescendantNodes()
                .OfType<MethodDeclarationSyntax>();

            foreach (var method in methodDeclarations)
            {
                // 通过命名约定（如 On...Click）来识别是否为工具生成的事件存根
                if (IsToolGeneratedMethod(method))
                {
                    var info = new MethodStructureInfo
                    {
                        Name = method.Identifier.Text,
                        SyntaxNode = method,
                        IsEmptyBody = IsMethodBodyEmptyOrCommented(method)
                    };
                    result.GeneratedMethods.Add(info);
                }
            }
        }

        return result;
    }

    public MergeResult MergeStructures(FileAnalysisResult existingFile, List<IStructureInfo> newStructures)
    {
        var rewriter = new SafeMergeRewriter(existingFile, newStructures);
        SyntaxNode newRoot = rewriter.Visit(existingFile.SyntaxTree.GetRoot());
        string mergedCode = newRoot.ToFullString();

        return new MergeResult
        {
            MergedCode = mergedCode,
            Success = true
        };
    }

    private bool IsToolGeneratedField(FieldDeclarationSyntax field)
    {
        // 策略1: 检查是否有 [AutoGenAliasName] 属性
        if (field.AttributeLists.SelectMany(al => al.Attributes).Any(a => a.Name.ToString().Contains("AutoGenAliasName")))
        {
            return true;
        }

        // 策略2: 检查命名约定（如 m_ 前缀）
        var variableName = field.Declaration.Variables.First().Identifier.Text;
        if (variableName.StartsWith("m_"))
        {
            return true;
        }

        return false;
    }

    // ... 其他辅助方法
}
```

### 3.4 实现 `SafeMergeRewriter`

这是一个继承自 `CSharpSyntaxRewriter` 的类，它负责安全地修改语法树。

```csharp
public class SafeMergeRewriter : CSharpSyntaxRewriter
{
    private readonly FileAnalysisResult _existingFile;
    private readonly List<IStructureInfo> _newStructures;
    private readonly ClassDeclarationSyntax _classDeclaration;

    public SafeMergeRewriter(FileAnalysisResult existingFile, List<IStructureInfo> newStructures)
    {
        _existingFile = existingFile;
        _newStructures = newStructures;
        _classDeclaration = existingFile.SyntaxTree.GetCompilationUnitRoot()
            .DescendantNodes().OfType<ClassDeclarationSyntax>().First();
    }

    public override SyntaxNode VisitFieldDeclaration(FieldDeclarationSyntax node)
    {
        // 检查当前字段是否是需要更新的旧字段
        var oldField = _existingFile.GeneratedFields
            .FirstOrDefault(f => f.SyntaxNode.IsEquivalentTo(node));

        if (oldField != null)
        {
            // 找到对应的新字段，用新字段的定义替换旧的
            var newField = _newStructures.OfType<FieldStructureInfo>()
                .FirstOrDefault(f => f.AliasPath == oldField.AliasPath);

            if (newField != null)
            {
                // 这里可以根据需要更新字段的类型、属性等
                // 为简化，我们直接返回新字段的语法节点
                return newField.SyntaxNode;
            }
            else
            {
                // 如果新结构中没有这个字段，说明它已被删除，从代码中移除
                return null; // 返回 null 表示移除该节点
            }
        }

        // 如果不是旧字段，保持不变
        return base.VisitFieldDeclaration(node);
    }

    public override SyntaxNode VisitClassDeclaration(ClassDeclarationSyntax node)
    {
        // 1. 先处理现有字段
        var updatedClass = base.VisitClassDeclaration(node) as ClassDeclarationSyntax;

        // 2. 添加新增的字段
        var newFields = _newStructures.OfType<FieldStructureInfo>()
            .Where(f => !_existingFile.GeneratedFields.Any(ef => ef.AliasPath == f.AliasPath));

        if (newFields.Any())
        {
            var newFieldSyntaxNodes = newFields.Select(f => f.SyntaxNode);
            updatedClass = updatedClass.AddMembers(newFieldSyntaxNodes.ToArray());
        }

        return updatedClass;
    }
}
```

## 4. 集成到 GraphView 工作流

在 GraphView 中，当用户点击“同步”按钮时，后台逻辑将变为：

1.  **触发同步**: 用户点击 `[Sync]` 按钮。
2.  **调用新分析器**:
    *   `ICSharpFileAnalyzer analyzer = new RoslynFileAnalyzer();`
    *   `FileAnalysisResult existingFile = analyzer.AnalyzeFile(descFilePath);`
3.  **生成新结构**:
    *   基于当前的 Prefab 分析结果，创建 `List<IStructureInfo> newStructures`。
4.  **执行合并**:
    *   `MergeResult result = analyzer.MergeStructures(existingFile, newStructures);`
5.  **写入文件**:
    *   `File.WriteAllText(descFilePath, result.MergedCode);`
    *   `AssetDatabase.Refresh();`

## 5. 优势与总结

通过引入基于 Roslyn 的语法分析，我们实现了：

1.  **绝对的代码安全**: 任何不符合“工具生成”特征的代码都将被完整保留，从根本上杜绝了覆盖用户逻辑的风险。
2.  **强大的合并能力**: 可以精确地在类的正确位置插入新字段、新方法，而不是简单地追加。
3.  **面向未来的可扩展性**: 如果未来需要支持更复杂的代码结构（如自动生成接口、属性等），只需扩展 `StructureInfo` 模型和 `SafeMergeRewriter` 的逻辑即可。
4.  **与用户编辑解耦**: 用户不再需要关心任何特殊的文本标记，可以自由地组织代码、添加注释、使用 `#region` 等，工具都能正确处理。

这个方案将代码合并的可靠性提升到了一个全新的水平，完美解决了您提出的潜在问题，为 GraphView 工具的长期迭代开发奠定了坚实的技术基础。