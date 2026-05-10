# 相机系统重构快速参考指南

> 📅 版本：v2.1 | 📅 更新：2026-01-31
> 🎯 用途：开发过程中快速查阅核心概念

---

## 🎯 核心概念速查

### 三大设计哲学

| 概念           | 一句话解释                                     |
| ------------ | ----------------------------------------- |
| **配置-状态-分发** | Mode 配置参数 → CameraState 唯一真理 → Module 自驱动 |
| **指令即数据**    | Mode 不调用模块，而是设置 Context 中的标记位             |
| **架构即配置**    | 所有逻辑通过 Prefab 组合，Inspector 可视化调整          |

### CameraState 结构

```csharp
public struct CameraState {
    // 核心位姿
    public Vector3 RawPosition;        // 逻辑位置
    public Quaternion RawRotation;     // 逻辑旋转
    public Vector3 ReferenceLookAt;    // 注视焦点

    // 表现偏移（分离逻辑与表现）
    public Vector3 WorldPositionOffset;
    public Vector3 LocalPositionOffset;
    public Quaternion RotationOffset;

    // 镜头参数
    public float FieldOfView;
    public Matrix4x4 ProjectionMatrix;

    // 混合权重
    public float Weight;

    // 扩展容器
    public ExtensionContainer Extensions;
}
```

### CameraModuleContext 结构

```csharp
public readonly struct CameraModuleContext {
    public readonly Camera MainCamera;
    public readonly ITargetProvider TargetProvider;
    public readonly float DeltaTime;
    public readonly IInputProvider InputProvider;
    public readonly ExtensionContainer Extensions;  // 业务扩展
}
```

---

## 🧩 模块开发模板

### 创建新 Module

```csharp
[AddComponentMenu("Camera/Modules/Your Module")]
public class YourModuleComponent : CameraModuleComponent
{
    [Header("配置参数")]
    [SerializeField] private float m_parameter = 1f;

    // 内部状态（有状态）
    private float m_internalState;

    public override string ModuleName => "YourModule";

    public override void Execute(ref CameraState state, in CameraModuleContext context)
    {
        // 1. 检查扩展（可选）
        if (context.TryGetExtension<YourExtension>(out var ext)) {
            // 使用扩展数据
        }

        // 2. 处理输入（可选）
        if (context.InputProvider != null) {
            var delta = context.InputProvider.LookDeltaGet();
        }

        // 3. 修改状态（必须通过 ref）
        state.RawPosition += Vector3.forward * m_parameter;
        state.RawRotation = Quaternion.Euler(0, m_internalState, 0);

        // 4. 存储中间结果（可选）
        state.SetExtension(new YourStateExtension { ... });
    }

    protected override void OnResetInternal()
    {
        m_internalState = 0f;
    }
}
```

### 创建新 Mode

```csharp
public class YourModeComponent : CameraModeComponent
{
    // 扩展实例（复用，避免 GC）
    private readonly YourExtension m_extension = new();

    protected override void InitializeExtensions()
    {
        m_extensionContainer.Set(m_extension);
    }

    // 业务方法：设置指令
    public void TriggerAction()
    {
        m_extension.ActionRequested = true;
    }

    protected override void ClearFrameState()
    {
        m_extension.Clear();
    }
}
```

### 创建业务扩展

```csharp
// 1. 定义上下文扩展（指令）
public class YourExtension
{
    public bool ActionRequested;
    public float TargetValue;

    public void Clear()
    {
        ActionRequested = false;
        TargetValue = 0f;
    }
}

// 2. 定义状态扩展（中间数据）
public class YourStateExtension
{
    public float CalculatedValue;
    public Vector3 IntermediateResult;
}
```

---

## 🔄 四阶段管线参考

### 各阶段职责

| 阶段 | 职责 | 典型操作 | 禁止事项 |
|------|------|----------|----------|
| **Body** | 计算基础位置 | 设置 RawPosition, ReferenceLookAt | 不要修改 Rotation |
| **Aim** | 计算旋转朝向 | 设置 RawRotation | 不要修改 Position |
| **Noise** | 叠加表现修正 | 修改各种 Offset，添加抖动 | 不要改变核心位姿 |
| **Finalize** | 最终修正 | 碰撞检测、阻尼、构图 | 不要添加新的噪声 |

### 执行顺序保证

```csharp
// VisualCamera 内部自动排序
1. 收集所有 Module
2. 按 Stage 分组
3. 同 Stage 内按 Order 排序
4. 依次调用 Execute(ref state, context)
```

---

## 🎨 颜色编码速查

在思维导图和文档中使用的颜色编码：

| 颜色 | 含义 | 示例 |
|------|------|------|
| 🔴 **1** | 旧架构/问题 | God Class, 代码重复 |
| 🟠 **2** | 时间线/流程 | 演化阶段, 实施路径 |
| 🟡 **3** | 阶段/步骤 | 设计阶段, 管线阶段 |
| 🟢 **4** | 核心概念 | 设计哲学, 收益 |
| 🔵 **5** | 模块/组件 | 7大模块 |
| 🟣 **6** | 数据结构 | CameraState, Context |

---

## 📝 Prefab 结构示例

### 简单 FPS 模式

```
SimpleFPSMode (SimpleFPSModeComponent)
└── MainVC (VisualCameraComponent)
    ├── PositionFollow (PositionFollowModuleComponent)
    │   └─ Stage: Body, Order: 0
    └── InputRotation (InputRotationModuleComponent)
        └─ Stage: Aim, Order: 0
```

### 复杂 OrbitView 模式

```
OrbitViewMode (OrbitViewModeComponent)
├── MainVC (VisualCameraComponent)        [Weight: 1.0]
│   ├── OrbitAutoFit (Module)             [Body, Order: 0]
│   ├── OrbitInput (Module)               [Body, Order: 5]
│   ├── OrbitFollow (Module)              [Body, Order: 10]
│   ├── Collision (Module)                [Noise, Order: 0]
│   └── Composition (Module)              [Finalize, Order: 0]
│
└── TransitionVC (VisualCameraComponent)  [Weight: 0 → 1]
    └── LookAtTransition (Module)         [Aim, Order: 0]
```

---

## 🐛 常见问题排查

### 模块不执行

- ✅ 检查 Module 是否挂载到 VisualCamera 下
- ✅ 检查 VisualCamera 是否被 Mode 激活
- ✅ 检查 Module 的 `enabled` 是否为 true

### 状态不生效

- ✅ 确保使用 `ref` 传递 CameraState
- ✅ 检查 Module 的 Stage 设置是否正确
- ✅ 确认没有后续 Module 覆盖了你的修改

### 扩展获取失败

- ✅ 确保 Mode 在 `InitializeExtensions` 中注册了扩展
- ✅ 检查扩展类型是否正确
- ✅ 确认扩展没有被提前清理

### 性能问题

- ✅ 使用 Profiler 检查 GC Alloc
- ✅ 确保 Module 复用扩展实例
- ✅ 检查是否有频繁的 `new` 操作

---

## 🔧 调试技巧

### Gizmos 可视化

```csharp
#if UNITY_EDITOR
private void OnDrawGizmos()
{
    if (!Application.isPlaying) return;

    // 绘制 ReferenceLookAt
    Gizmos.color = Color.red;
    Gizmos.DrawWireSphere(state.ReferenceLookAt, 0.2f);

    // 绘制 RawPosition
    Gizmos.color = Color.green;
    Gizmos.DrawWireCube(state.RawPosition, Vector3.one * 0.2f);
}
#endif
```

### 日志输出

```csharp
public override void Execute(ref CameraState state, in CameraModuleContext context)
{
#if UNITY_EDITOR
    if (Debug.isDebugBuild) {
        Debug.Log($"[{ModuleName}] Position: {state.RawPosition}");
    }
#endif
}
```

---

## 📊 数据流图

```
┌─────────────────────────────────────────────────────────────┐
│                        Mode (容器)                          │
│  - 收集输入                                                   │
│  - 设置扩展指令                                               │
│  - 构建 Context                                              │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ Input Buffer  │   │ Extensions    │   │   Target      │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
                    ┌───────────────┐
                    │    Context    │
                    │  (只读数据)    │
                    └───────┬───────┘
                            │
        ┌───────────────────┴───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  VM (管线)    │   │ Module Pipeline│   │  CameraState  │
│               │   │ Body→Aim→Noise │◄──│  (可变状态)    │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                   │
        └───────────────────┴───────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  Unity Camera │
                    │   (硬件)      │
                    └───────────────┘
```

---

## 🎓 学习路径

### 新手入门

1. 阅读 `[[CameraRefactoring_Analysis_Report.md]]` 了解整体思路
2. 查看 `[[CameraRefactoring_Architecture.canvas]]` 理解架构
3. 学习 `[[Modular_Camera_Refactor_Implementation_Plan.md]]` 了解实施计划

### 进阶开发

1. 深入 `[[Deep_Pipeline_Decoupling_Design.md]]` 理解解耦思想
2. 研究 `[[Extensible_Context_Design.md]]` 掌握扩展机制
3. 参考 `[[1.CameraRefactoring_Module.md]]` 理解模块边界

### 高级优化

1. 研究各模块文档 (1-7) 深入理解每个模块
2. 查看 `[[Modular_Building_Blocks_Implementation_Details.md]]` 学习实现细节
3. 阅读 `[[CameraRefactoring_Review.md]]` 了解潜在问题和优化建议

---

## 📞 支持

遇到问题时：
1. 先查阅本文档的"常见问题排查"章节
2. 查看相关模块的设计文档
3. 搜索代码中的示例实现
4. 联系架构团队

---

*快速参考指南 v2.1*
*维护者：Claudian AI Assistant*
