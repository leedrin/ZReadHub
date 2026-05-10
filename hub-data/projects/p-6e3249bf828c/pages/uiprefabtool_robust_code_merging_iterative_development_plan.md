# UIPrefabTool 鲁棒代码合并 - 迭代式开发方案

## 1. 背景与目标

### 1.1 背景
当前的 `UIPrefabTool` 在生成 `UICtrlDesc.cs` 文件时采用完全覆盖模式，导致开发者手动编写的代码在每次重新生成时都会丢失。这严重阻碍了工具在复杂项目中的实用性。

### 1.2 核心目标
引入 **鲁棒代码合并** 机制，使得工具在重新生成代码时，能够：
1.  **识别并保留** 开发者手写的代码。
2.  **智能更新** 工具负责生成的代码部分。
3.  **确保最终文件** 的语法正确性和功能完整性。

### 1.3 迭代原则
*   **风险可控**：每个迭代都应是一个可独立交付、可回滚的功能增量。
*   **价值驱动**：优先解决最高频、最痛的问题。
*   **向后兼容**：新功能不应破坏现有工作流。

---

## 2. 技术选型与核心架构

### 2.1 技术选型
基于前期调研，我们选择 **Microsoft Roslyn (.NET Compiler Platform)** 作为核心技术。

*   **优势**：
    *   官方支持，与 C# 语言发展同步。
    *   能将源代码解析为丰富的语法树和语义模型。
    *   提供了精确的代码修改和重写 API。
    *   uNode 的成功案例证明了其在 Unity 编辑器中的可行性。
*   **用途**：
    *   **解析**：将现有的 `.cs` 文件解析为语法树。
    *   **分析**：识别用户手写区域、自动生成区域、以及它们之间的边界。
    *   **重写**：在语法树级别修改、添加、删除节点，生成新的代码。

### 2.2 核心架构设计

我们将引入一个新的核心模块：**`IncrementalGenerator`**，它将与现有的 `EnhancedCodeGenerator` 协同工作。

```
+-------------------------+      +--------------------------+      +----------------------+
|   UIPrefabToolWindow   |---->|    IncrementalGenerator   |---->|  Roslyn Analyzer    |
+-------------------------+      +--------------------------+      +----------------------+
            |                            |          ^                       |
            | (User triggers generate)      | (Merge) | (Analyze)             |
            v                            v          |                       v
+-------------------------+      +--------------------------+      +----------------------+
|   ComponentCollector    |---->|  EnhancedCodeGenerator   |---->|  Template Engine    |
+-------------------------+      +--------------------------+      +----------------------+
            |                            |                                  |
            | (Provides raw data)         | (Generates code strings)        |
            v                            v                                  v
       Prefab Data                   Code Fragments                    Final Merged .cs
```

**工作流程**：
1.  **触发**：用户在 `UIPrefabToolWindow` 点击生成。
2.  **数据收集**：`ComponentCollector` 从 Prefab 收集原始组件数据（不变）。
3.  **增量生成判断**：`IncrementalGenerator` 检查目标 `.cs` 文件是否存在。
    *   **如果不存在**：直接调用 `EnhancedCodeGenerator` 进行完整生成（当前模式）。
    *   **如果存在**：启动增量合并流程。
4.  **增量合并流程**：
    a. **解析**：使用 Roslyn 将现有文件解析为 `SyntaxTree` 和 `SemanticModel`。
    b. **区域识别**：通过特殊标记（如 `//region User Code`）或注释，识别用户区域和自动区域。
    c. **生成新片段**：调用 `EnhancedCodeGenerator` 和 `TemplateEngine`，生成最新的、纯工具生成的代码片段。
    d. **合并**：使用 Roslyn 的 `SyntaxRewriter`，将新生成的片段替换掉旧的自动区域，同时保留用户区域。
    e. **写入**：将合并后的新语法树格式化为代码字符串，并写入文件。
5.  **完成**：向用户报告生成成功，并高亮显示合并了哪些用户区域。

---

## 3. 迭代开发计划

我们将分为四个主要迭代（Phase）来实施此方案。

### Phase 1: 基础设施与区域标记 (1-2 周)

**目标**：搭建 Roslyn 环境，并实现最基础的区域识别和保留功能。

**功能点**：
1.  **引入 Roslyn 包**：通过 NuGet for Unity 或直接嵌入 DLL 的方式，将 `Microsoft.CodeAnalysis.CSharp` 等库引入项目。
2.  **创建 `IncrementalGenerator` 类**：作为新功能的核心入口。
3.  **实现区域识别逻辑**：
    *   定义明确的区域标记，例如：
        ```csharp
        //region UIPrefabTool Generated Fields
        // ... tool generated fields ...
        //endregion

        //region User Code
        // ... user written code ...
        //endregion
        ```
    *   实现 `ParseUserRegions(SyntaxTree root)` 方法，使用 Roslyn 遍历语法树，找到所有 `#region`/`#endregion` 对，并分类。
4.  **实现简单合并逻辑**：
    *   在生成新代码时，如果检测到用户区域，则完全跳过该部分的生成。
    *   将新生成的代码与旧的用户区域字符串进行简单拼接。
5.  **UI 适配**：
    *   在 `UIPrefabToolWindow` 中添加一个复选框：“启用增量生成（保留用户代码）”。
    *   默认关闭，确保向后兼容。

**交付物**：
*   一个能识别并保留 `//region User Code` 区域的版本。
*   用户区域内的代码不会被触碰，但自动区域会完全更新。
*   基础的错误处理（如果区域标记不匹配，则回退到完全覆盖模式）。

**风险**：低。此阶段不修改核心生成逻辑，只是在外部做字符串处理。

---

### Phase 2: 语法树级精确合并 (2-3 周)

**目标**：从字符串拼接升级为语法树级别的精确操作，解决格式丢失和注入错误的问题。

**功能点**：
1.  **实现 `RoslynSyntaxMerger` 类**：
    *   继承 Roslyn 的 `CSharpSyntaxRewriter`。
    *   重写 `VisitRegionDirectiveTrivia` 和 `VisitEndRegionDirectiveTrivia` 方法来定位区域。
    *   当进入一个“自动生成”区域时，记录其 `Span`（在语法树中的位置）。
2.  **实现替换逻辑**：
    *   将 `EnhancedCodeGenerator` 生成的代码片段也解析为一个 `SyntaxNode`。
    *   使用 `SyntaxNode.ReplaceNodes()` 或 `SyntaxRoot.ReplaceSpan()` 方法，用新的语法节点替换旧的自动区域。
3.  **保留格式和注释**：
    *   Roslyn 的操作能完美保留原始文件中的格式、空行、注释等，这是相比字符串拼接的最大优势。
4.  **增强错误处理**：
    *   如果用户区域内的代码存在语法错误，导致解析失败，应给出明确提示：“用户代码区域 [XXX] 存在语法错误，将跳过增量生成以防止数据丢失”，并回退到完全覆盖。

**交付物**：
*   一个基于 Roslyn 语法树的合并器，能精确替换代码片段而不影响其他部分。
*   生成的代码格式与用户手动编码风格保持一致。
*   更健壮的错误恢复机制。

**风险**：中等。需要深入理解 Roslyn API，可能遇到复杂的边界情况（如区域嵌套）。

---

### Phase 3: 智能差异与冲突解决 (3-4 周)

**目标**：解决最核心的冲突问题：当 Prefab 中的组件被删除或重命名时，如何处理用户代码中对应的引用。

**功能点**：
1.  **实现 `SemanticConflictResolver` 类**：
    *   利用 Roslyn 的 `SemanticModel`，分析用户代码中使用的符号（变量、字段等）。
    *   将这些符号与 `ComponentCollector` 提供的最新组件列表进行比对。
2.  **定义冲突解决策略**：
    *   **删除冲突**：用户代码引用了一个已从 Prefab 中删除的组件 `A`。
        *   **策略**：在用户代码中，将所有对 `A` 的引用注释掉，并在代码顶部生成一条 `#warning` 编译警告，提示开发者：“组件 'A' 已从 Prefab 中移除，相关代码已注释。”
    *   **重命名冲突**：组件 `A` 在 Prefab 中被重命名为 `B`。
        *   **策略**：在用户代码中，将对旧名称 `A` 的引用自动替换为 `B`。
3.  **实现差异报告**：
    *   生成后，在 Unity Console 中输出一份清晰的报告：
        ```
        [UIPrefabTool] Incremental Generation Complete:
        - Added: newButton (Transform)
        - Removed: oldPanel (GameObject) -> Code commented out in line 25.
        - Renamed: 'btn' -> 'submitButton' -> Code refactored in user region.
        ```
4.  **UI 增强**：
    *   在工具窗口中开辟一个“增量报告”区域，持久化显示最近一次生成的差异和警告。

**交付物**：
*   一个能智能处理组件增、删、改的合并器。
*   非侵入式的冲突解决机制（注释而非删除）。
*   清晰的变更报告，提升开发者体验。

**风险**：高。语义分析非常复杂，可能误判或遗漏。需要大量测试用例覆盖。

---

### Phase 4: 高级功能与性能优化 (2-3 周)

**目标**：完善细节，提升性能，并考虑未来扩展。

**功能点**：
1.  **支持更复杂的用户区域**：
    *   允许用户在自动生成的函数内部插入自定义逻辑，例如：
        ```csharp
        // Auto-generated function
        public void BindComponents() {
            //region User Custom Logic Before Bind
            // ... user code ...
            //endregion

            button_ok = transform.Find("button_ok");
            label_title = transform.Find("label_title");

            //region User Custom Logic After Bind
            // ... user code ...
            //endregion
        }
        ```
2.  **性能优化**：
    *   Roslyn 解析和编译是 CPU 密集型操作。对于大型文件，可以实现增量解析缓存。
    *   如果只有一小部分区域发生变化，只重新解析和合并该部分。
3.  **配置化**：
    *   在 `ToolConfig` 中添加更多选项，如：
        *   `incrementalGenerationMode`: `Disabled` / `SimpleRegion` / `SemanticMerge`
        *   `conflictResolutionStrategy`: `CommentOut` / `TryRename` / `Error`
4.  **为未来 GraphView 做准备**：
    *   将 `IncrementalGenerator` 的核心逻辑（解析、分析、合并）设计为与 UI 无关的纯服务层。
    *   这使得未来无论是用当前 Tab 界面还是 GraphView 界面调用，底层都是同一套可靠的逻辑。

**交付物**：
*   一个功能完善、性能优化、配置灵活的鲁棒代码合并系统。
*   一套与 UI 解耦的核心服务，为后续架构演进奠定基础。

**风险**：中等。主要是性能优化和复杂场景的测试工作量。

---

## 4. 总体时间线与资源评估

| Phase | 时间（周） | 主要风险 | 关键依赖 |
|---|---|---|---|
| Phase 1 | 1-2 | 低 | Roslyn 库集成 |
| Phase 2 | 2-3 | 中 | Roslyn API 熟练度 |
| Phase 3 | 3-4 | 高 | 复杂的语义分析逻辑 |
| Phase 4 | 2-3 | 中 | 性能测试 |
| **总计** | **8-12** | | |

**资源需求**：
*   **1名高级开发工程师**：熟悉 C# 和 Unity 编辑器开发，有编译原理或 Roslyn 使用经验者优先。
*   **测试支持**：需要提供各种复杂度的 Prefab 和手写代码组合进行测试。

---

## 5. 成功标准

*   **Phase 1 成功**：在勾选新选项后，重新生成一个已有用户代码的 `UICtrlDesc.cs` 文件，用户代码区域内容保持不变。
*   **Phase 2 成功**：生成的文件与手动修改和格式化后的版本在视觉上和语法上完全一致，无多余空格或格式错乱。
*   **Phase 3 成功**：删除 Prefab 中的一个按钮后，重新生成，原用户代码中对该按钮的引用被安全地注释掉，并给出明确的编译警告。
*   **Phase 4 成功**：工具在处理包含上千个组件的大型 UI Prefab 时，生成时间在可接受范围内（如 < 3s），且 Unity Editor 无卡顿。

---

## 6. 回滚计划

每个 Phase 都应在一个独立的分支上进行开发。如果某个 Phase 引入不可控的问题，可以轻松回滚到上一个稳定版本，同时不影响其他功能的开发。例如，如果 Phase 3 的语义分析过于复杂，可以暂时发布一个只包含 Phase 1 和 2 功能的“简化版”，将 Phase 3 的优化留到后续大版本。

---
**方案结束**