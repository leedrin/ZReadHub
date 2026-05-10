# 🧩 相机系统可扩展上下文与状态设计

## 版本信息
| 项目 | 值 |
|------|-----|
| **版本** | v1.0 |
| **日期** | 2026-01-30 |
| **状态** | 设计方案 |

---

## 1. 问题分析

### 1.1 当前设计的问题

```csharp
// ❌ 不好的设计：所有业务标记都在核心结构中
public readonly struct CameraModuleContext
{
    // 核心字段（合理）
    public readonly Camera m_mainCamera;
    public readonly ITargetProvider m_targetProvider;
    public readonly float m_deltaTime;
    public readonly IInputProvider m_inputProvider;

    // 业务标记（不合理：与特定业务模式耦合）
    public readonly bool m_resetRequested;      // OrbitView 需要
    public readonly bool m_autoFitRequested;    // OrbitView 需要
    public readonly bool m_autoReturnRequested; // Observation 需要
    public readonly bool m_closeupRequested;    // TackleObservation 需要
    // ... 未来会越来越多
}
```

### 1.2 Cinemachine 的解决方案

Cinemachine 通过以下机制实现扩展：

1. **CinemachineExtension** - 可挂载的扩展组件
2. **ComponentBase** - 每个组件有自己的配置
3. **PostPipelineStageCallback** - 管道阶段回调
4. **Blend Overrides** - 混合覆盖机制

---

## 2. 扩展架构设计

### 2.1 核心思想

```
┌─────────────────────────────────────────────────────────────────┐
│                    CameraModuleContext (Core)                    │
│  - Camera, Target, DeltaTime, InputProvider (不变的核心)         │
│  - IContextExtensionContainer (扩展容器)                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ OrbitContext  │   │ ObservContext │   │ TackleContext │
│ Extension     │   │ Extension     │   │ Extension     │
│ - autoFit     │   │ - autoReturn  │   │ - closeup     │
│ - resetReq    │   │ - idleTime    │   │ - trackIdx    │
└───────────────┘   └───────────────┘   └───────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CameraState (Core)                          │
│  - RawPosition, RawRotation, ReferenceLookAt (不变的核心)        │
│  - IStateExtensionContainer (扩展容器)                           │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 设计原则

| 原则 | 说明 |
|-----|------|
| **核心最小化** | Context/State 只包含所有模块都需要的基础字段 |
| **按需扩展** | 业务相关数据通过扩展容器存取 |
| **类型安全** | 扩展数据有强类型，避免字符串 Key |
| **零分配** | 扩展容器使用结构体和对象池，避免 GC |

---

## 3. 详细实现

### 3.1 扩展容器接口

```csharp
namespace BlackJack.ProjectEF.Runtime.CameraController
{
    /// <summary>
    /// 上下文扩展接口
    /// 业务模式定义自己的扩展数据结构
    /// </summary>
    public interface IContextExtension
    {
        /// <summary>
        /// 扩展类型标识（用于快速查找）
        /// </summary>
        int ExtensionTypeId { get; }
    }

    /// <summary>
    /// 状态扩展接口
    /// 模块间通信的自定义数据
    /// </summary>
    public interface IStateExtension
    {
        /// <summary>
        /// 扩展类型标识
        /// </summary>
        int ExtensionTypeId { get; }

        /// <summary>
        /// 重置扩展状态
        /// </summary>
        void Reset();
    }
}
```

### 3.2 扩展容器实现

```csharp
using System;
using System.Collections.Generic;
using UnityEngine;

namespace BlackJack.ProjectEF.Runtime.CameraController
{
    /// <summary>
    /// 扩展类型注册器
    /// 使用泛型静态字段实现 O(1) 类型查找
    /// </summary>
    public static class ExtensionTypeRegistry
    {
        private static int s_nextTypeId = 0;

        /// <summary>
        /// 获取类型的唯一 ID
        /// </summary>
        public static int GetTypeId<T>() where T : class
        {
            return TypeIdHolder<T>.Id;
        }

        private static class TypeIdHolder<T> where T : class
        {
            public static readonly int Id = s_nextTypeId++;
        }
    }

    /// <summary>
    /// 扩展容器
    /// 高性能的类型化扩展存储
    /// </summary>
    public class ExtensionContainer
    {
        // 使用数组而非字典，利用 TypeId 作为索引实现 O(1) 访问
        private object[] m_extensions = new object[16];
        private int m_count = 0;

        /// <summary>
        /// 设置扩展
        /// </summary>
        public void Set<T>(T extension) where T : class
        {
            int typeId = ExtensionTypeRegistry.GetTypeId<T>();
            EnsureCapacity(typeId + 1);

            if (m_extensions[typeId] == null)
            {
                m_count++;
            }
            m_extensions[typeId] = extension;
        }

        /// <summary>
        /// 获取扩展
        /// </summary>
        public T Get<T>() where T : class
        {
            int typeId = ExtensionTypeRegistry.GetTypeId<T>();
            if (typeId < m_extensions.Length)
            {
                return m_extensions[typeId] as T;
            }
            return null;
        }

        /// <summary>
        /// 尝试获取扩展
        /// </summary>
        public bool TryGet<T>(out T extension) where T : class
        {
            extension = Get<T>();
            return extension != null;
        }

        /// <summary>
        /// 检查是否存在扩展
        /// </summary>
        public bool Has<T>() where T : class
        {
            int typeId = ExtensionTypeRegistry.GetTypeId<T>();
            return typeId < m_extensions.Length && m_extensions[typeId] != null;
        }

        /// <summary>
        /// 移除扩展
        /// </summary>
        public bool Remove<T>() where T : class
        {
            int typeId = ExtensionTypeRegistry.GetTypeId<T>();
            if (typeId < m_extensions.Length && m_extensions[typeId] != null)
            {
                m_extensions[typeId] = null;
                m_count--;
                return true;
            }
            return false;
        }

        /// <summary>
        /// 清空所有扩展
        /// </summary>
        public void Clear()
        {
            Array.Clear(m_extensions, 0, m_extensions.Length);
            m_count = 0;
        }

        /// <summary>
        /// 扩展数量
        /// </summary>
        public int Count => m_count;

        private void EnsureCapacity(int capacity)
        {
            if (capacity > m_extensions.Length)
            {
                int newSize = Math.Max(capacity, m_extensions.Length * 2);
                Array.Resize(ref m_extensions, newSize);
            }
        }
    }
}
```

### 3.3 精简的核心 Context

```csharp
namespace BlackJack.ProjectEF.Runtime.CameraController
{
    /// <summary>
    /// 相机模块执行上下文（精简核心版）
    /// 只包含所有模块都需要的基础字段
    /// </summary>
    public readonly struct CameraModuleContext
    {
        #region 核心字段（不变）

        /// <summary>
        /// 主相机
        /// </summary>
        public readonly Camera m_mainCamera;

        /// <summary>
        /// 目标提供者
        /// </summary>
        public readonly ITargetProvider m_targetProvider;

        /// <summary>
        /// 帧时间
        /// </summary>
        public readonly float m_deltaTime;

        /// <summary>
        /// 输入提供者
        /// </summary>
        public readonly IInputProvider m_inputProvider;

        #endregion

        #region 扩展容器

        /// <summary>
        /// 上下文扩展容器
        /// 业务模式可以存放自定义指令和配置
        /// </summary>
        public readonly ExtensionContainer m_extensions;

        #endregion

        #region 构造函数

        public CameraModuleContext(
            Camera mainCamera,
            ITargetProvider targetProvider,
            float deltaTime,
            IInputProvider inputProvider = null,
            ExtensionContainer extensions = null)
        {
            m_mainCamera = mainCamera;
            m_targetProvider = targetProvider;
            m_deltaTime = deltaTime;
            m_inputProvider = inputProvider;
            m_extensions = extensions;
        }

        #endregion

        #region 扩展访问便捷方法

        /// <summary>
        /// 获取扩展（便捷方法）
        /// </summary>
        public T GetExtension<T>() where T : class
        {
            return m_extensions?.Get<T>();
        }

        /// <summary>
        /// 尝试获取扩展（便捷方法）
        /// </summary>
        public bool TryGetExtension<T>(out T extension) where T : class
        {
            if (m_extensions != null)
            {
                return m_extensions.TryGet(out extension);
            }
            extension = null;
            return false;
        }

        /// <summary>
        /// 检查是否有扩展（便捷方法）
        /// </summary>
        public bool HasExtension<T>() where T : class
        {
            return m_extensions?.Has<T>() ?? false;
        }

        #endregion

        #region 兼容旧接口

        public ITargetProvider TargetProviderProvider => m_targetProvider;

        #endregion
    }
}
```

### 3.4 CameraState 扩展

```csharp
namespace BlackJack.ProjectEF.Runtime.CameraController
{
    /// <summary>
    /// 相机状态数据结构（支持扩展）
    /// </summary>
    [System.Serializable]
    public struct CameraState
    {
        #region 核心位姿数据（不变）

        public Vector3 RawPosition;
        public Quaternion RawRotation;
        public Vector3 ReferenceLookAt;
        public Vector3 WorldPositionOffset;
        public Vector3 LocalPositionOffset;
        public Quaternion RotationOffset;

        #endregion

        #region 镜头参数（不变）

        public float FieldOfView;
        public Matrix4x4 ProjectionMatrix;
        public bool UseCustomProjection;

        #endregion

        #region 混合控制（不变）

        public float Weight;

        #endregion

        #region 扩展容器

        /// <summary>
        /// 状态扩展容器
        /// 模块可以存放自定义中间状态用于跨模块通信
        /// </summary>
        [System.NonSerialized]
        public ExtensionContainer Extensions;

        #endregion

        #region 扩展访问便捷方法

        /// <summary>
        /// 获取状态扩展
        /// </summary>
        public T GetExtension<T>() where T : class
        {
            return Extensions?.Get<T>();
        }

        /// <summary>
        /// 设置状态扩展
        /// </summary>
        public void SetExtension<T>(T extension) where T : class
        {
            if (Extensions == null)
            {
                Extensions = new ExtensionContainer();
            }
            Extensions.Set(extension);
        }

        /// <summary>
        /// 尝试获取状态扩展
        /// </summary>
        public bool TryGetExtension<T>(out T extension) where T : class
        {
            if (Extensions != null)
            {
                return Extensions.TryGet(out extension);
            }
            extension = null;
            return false;
        }

        #endregion

        #region 静态工厂（更新）

        public static CameraState Default => new CameraState
        {
            RawPosition = Vector3.zero,
            RawRotation = Quaternion.identity,
            ReferenceLookAt = Vector3.zero,
            WorldPositionOffset = Vector3.zero,
            LocalPositionOffset = Vector3.zero,
            RotationOffset = Quaternion.identity,
            FieldOfView = 60f,
            ProjectionMatrix = Matrix4x4.identity,
            UseCustomProjection = false,
            Weight = 1f,
            Extensions = null  // 按需创建
        };

        #endregion
    }
}
```

---

## 4. 业务扩展示例

### 4.1 OrbitView 扩展

```csharp
namespace BlackJack.ProjectEF.Runtime.CameraController
{
    /// <summary>
    /// OrbitView 模式的上下文扩展
    /// 只有 OrbitView 相关模块需要这些数据
    /// </summary>
    public class OrbitContextExtension
    {
        /// <summary>
        /// 是否请求重置
        /// </summary>
        public bool ResetRequested;

        /// <summary>
        /// 是否请求自动适配
        /// </summary>
        public bool AutoFitRequested;

        /// <summary>
        /// 自动适配模式
        /// </summary>
        public CameraAutoFitMode AutoFitMode;

        /// <summary>
        /// 是否调整中心到几何中心
        /// </summary>
        public bool AdjustCenterToGeometry;

        /// <summary>
        /// 重置扩展状态
        /// </summary>
        public void Clear()
        {
            ResetRequested = false;
            AutoFitRequested = false;
            AutoFitMode = CameraAutoFitMode.None;
            AdjustCenterToGeometry = false;
        }
    }

    /// <summary>
    /// OrbitView 的状态扩展
    /// 模块间共享的 Orbit 相关中间数据
    /// </summary>
    public class OrbitStateExtension
    {
        /// <summary>
        /// AutoFit 计算的最佳距离
        /// </summary>
        public float OptimalDistance;

        /// <summary>
        /// 中心偏移
        /// </summary>
        public Vector3 CenterOffset;

        /// <summary>
        /// 是否有有效的 AutoFit 结果
        /// </summary>
        public bool HasAutoFitResult;

        public void Clear()
        {
            OptimalDistance = 0f;
            CenterOffset = Vector3.zero;
            HasAutoFitResult = false;
        }
    }
}
```

### 4.2 Observation 扩展

```csharp
namespace BlackJack.ProjectEF.Runtime.CameraController
{
    /// <summary>
    /// Observation 模式的上下文扩展
    /// </summary>
    public class ObservationContextExtension
    {
        /// <summary>
        /// 是否请求自动回正
        /// </summary>
        public bool AutoReturnRequested;

        /// <summary>
        /// LookAt 过渡目标点
        /// </summary>
        public Vector3? TransitionTargetLookAt;

        /// <summary>
        /// 过渡持续时间
        /// </summary>
        public float TransitionDuration;

        public void Clear()
        {
            AutoReturnRequested = false;
            TransitionTargetLookAt = null;
            TransitionDuration = 0f;
        }
    }

    /// <summary>
    /// Observation 状态扩展
    /// </summary>
    public class ObservationStateExtension
    {
        /// <summary>
        /// 当前观察状态
        /// </summary>
        public ObservationState CurrentState;

        /// <summary>
        /// 空闲计时器
        /// </summary>
        public float IdleTimer;

        /// <summary>
        /// 过渡进度
        /// </summary>
        public float TransitionProgress;
    }
}
```

### 4.3 TackleObservation 扩展

```csharp
namespace BlackJack.ProjectEF.Runtime.CameraController
{
    /// <summary>
    /// TackleObservation 模式的上下文扩展
    /// </summary>
    public class TackleContextExtension
    {
        /// <summary>
        /// 是否请求进入特写
        /// </summary>
        public bool CloseupRequested;

        /// <summary>
        /// 特写目标位置
        /// </summary>
        public Vector3 CloseupTargetPosition;

        /// <summary>
        /// 特写槽位索引
        /// </summary>
        public int CloseupSlotIndex;

        /// <summary>
        /// 是否请求退出特写
        /// </summary>
        public bool ExitCloseupRequested;

        public void Clear()
        {
            CloseupRequested = false;
            CloseupTargetPosition = Vector3.zero;
            CloseupSlotIndex = -1;
            ExitCloseupRequested = false;
        }
    }

    /// <summary>
    /// TackleObservation 状态扩展
    /// </summary>
    public class TackleStateExtension
    {
        /// <summary>
        /// 是否在特写模式
        /// </summary>
        public bool IsInCloseup;

        /// <summary>
        /// 当前轨道百分比
        /// </summary>
        public float CurrentPercentage;

        /// <summary>
        /// 当前缩放比例
        /// </summary>
        public float CurrentZoomRatio;

        /// <summary>
        /// 特写环绕角度
        /// </summary>
        public float CloseupOrbitYaw;
        public float CloseupOrbitPitch;
    }
}
```

---

## 5. 使用示例

### 5.1 Mode 中注入扩展

```csharp
public class OrbitViewModeComponent : CameraModeComponent
{
    // 扩展实例（复用，避免 GC）
    private readonly OrbitContextExtension m_orbitExtension = new OrbitContextExtension();
    private readonly ExtensionContainer m_extensionContainer = new ExtensionContainer();

    protected override void OnInitializeInternal()
    {
        // 注册扩展到容器
        m_extensionContainer.Set(m_orbitExtension);
    }

    /// <summary>
    /// 请求自动适配（指令式）
    /// </summary>
    public void RequestAutoFit(CameraAutoFitMode mode, bool adjustCenter = true)
    {
        m_orbitExtension.AutoFitRequested = true;
        m_orbitExtension.AutoFitMode = mode;
        m_orbitExtension.AdjustCenterToGeometry = adjustCenter;
    }

    /// <summary>
    /// 请求重置
    /// </summary>
    public void RequestReset()
    {
        m_orbitExtension.ResetRequested = true;
    }

    protected override CameraModuleContext BuildModuleContext(float deltaTime)
    {
        return new CameraModuleContext(
            m_mainCamera,
            m_targetProvider,
            deltaTime,
            m_inputBuffer,
            m_extensionContainer  // 传入扩展容器
        );
    }

    protected override void ClearFrameState()
    {
        base.ClearFrameState();
        // 清理一次性指令
        m_orbitExtension.Clear();
    }
}
```

### 5.2 Module 中使用扩展

```csharp
public class OrbitAutoFitModuleComponent : CameraModuleComponent
{
    public override void Execute(ref CameraState state, in CameraModuleContext context)
    {
        // 尝试获取 Orbit 扩展
        if (!context.TryGetExtension<OrbitContextExtension>(out var orbitCtx))
        {
            // 没有扩展，说明不是 OrbitView 模式，跳过
            return;
        }

        // 检查是否需要自动适配
        if (!orbitCtx.AutoFitRequested)
        {
            return;
        }

        // 执行适配计算...
        float optimalDistance = CalculateOptimalDistance(context, state.RawRotation);
        Vector3 centerOffset = CalculateCenterOffset(context);

        // 将结果存入状态扩展，供下游模块使用
        var stateExt = state.GetExtension<OrbitStateExtension>();
        if (stateExt == null)
        {
            stateExt = new OrbitStateExtension();
            state.SetExtension(stateExt);
        }

        stateExt.OptimalDistance = optimalDistance;
        stateExt.CenterOffset = centerOffset;
        stateExt.HasAutoFitResult = true;

        // 设置 ReferenceLookAt
        Vector3 targetPos = context.m_targetProvider.PositionGet();
        state.ReferenceLookAt = targetPos + centerOffset;

        // 计算初始位置
        Vector3 direction = state.RawRotation * Vector3.forward;
        state.RawPosition = state.ReferenceLookAt + direction * optimalDistance;
    }
}
```

### 5.3 下游 Module 读取上游结果

```csharp
public class OrbitInputModuleComponent : CameraModuleComponent
{
    public override void Execute(ref CameraState state, in CameraModuleContext context)
    {
        // 处理输入...
        ProcessInput(context);

        // 从状态扩展读取上游模块的计算结果
        if (state.TryGetExtension<OrbitStateExtension>(out var stateExt) && stateExt.HasAutoFitResult)
        {
            // AutoFit 模块已计算距离，使用它作为基准
            float baseDistance = stateExt.OptimalDistance;
            // ...
        }
        else
        {
            // 没有 AutoFit 结果，使用隐式距离
            float baseDistance = Vector3.Distance(state.RawPosition, state.ReferenceLookAt);
            // ...
        }
    }
}
```

---

## 6. 通用扩展（可选）

对于一些跨模式通用的功能，可以定义通用扩展：

### 6.1 通用指令扩展

```csharp
/// <summary>
/// 通用指令扩展
/// 适用于多种模式的基础指令
/// </summary>
public class CommonCommandExtension
{
    /// <summary>
    /// 是否请求重置到初始状态
    /// </summary>
    public bool ResetRequested;

    /// <summary>
    /// 是否目标发生变化
    /// </summary>
    public bool TargetChanged;

    /// <summary>
    /// 是否请求立即同步（跳过平滑）
    /// </summary>
    public bool ImmediateSyncRequested;

    public void Clear()
    {
        ResetRequested = false;
        TargetChanged = false;
        ImmediateSyncRequested = false;
    }
}
```

### 6.2 构图扩展

```csharp
/// <summary>
/// 构图扩展
/// 所有支持构图的模式都可以使用
/// </summary>
public class CompositionExtension
{
    /// <summary>
    /// 是否启用构图
    /// </summary>
    public bool Enabled;

    /// <summary>
    /// 屏幕位置 (0-1)
    /// </summary>
    public Vector2 ScreenPosition;

    /// <summary>
    /// 引导框尺寸
    /// </summary>
    public Vector2 ZoneSize;

    /// <summary>
    /// 是否自动适配到引导框
    /// </summary>
    public bool AutoFitToZone;
}
```

---

## 7. 性能考虑

### 7.1 零分配策略

```csharp
public class OrbitViewModeComponent : CameraModeComponent
{
    // ✅ 扩展实例在初始化时创建，后续复用
    private readonly OrbitContextExtension m_orbitExtension = new OrbitContextExtension();
    private readonly ExtensionContainer m_extensionContainer = new ExtensionContainer();

    // ✅ 状态扩展使用对象池
    private static readonly ObjectPool<OrbitStateExtension> s_stateExtPool =
        new ObjectPool<OrbitStateExtension>(() => new OrbitStateExtension());
}
```

### 7.2 类型 ID 缓存

```csharp
// 泛型静态字段实现 O(1) 类型查找
public static class ExtensionTypeRegistry
{
    private static class TypeIdHolder<T> where T : class
    {
        // 每种类型只分配一次 ID
        public static readonly int Id = Interlocked.Increment(ref s_nextTypeId);
    }
}
```

### 7.3 数组 vs 字典

```csharp
// ✅ 使用数组 + TypeId 索引，O(1) 访问
private object[] m_extensions = new object[16];

// ❌ 避免使用字典（哈希计算开销）
// private Dictionary<Type, object> m_extensions;
```

---

## 8. 优势总结

| 方面 | 旧设计 | 新设计 |
|-----|-------|-------|
| **核心结构** | 包含所有业务字段，臃肿 | 只有基础字段，精简 |
| **扩展性** | 新业务需修改核心代码 | 新业务只需定义自己的扩展类 |
| **耦合度** | 核心与业务耦合 | 核心与业务解耦 |
| **类型安全** | N/A | 强类型，编译期检查 |
| **性能** | N/A | O(1) 访问，零 GC（复用实例） |
| **可测试性** | 难以隔离测试 | 扩展可独立测试 |

---

## 9. 迁移策略

### 9.1 逐步迁移

1. **Phase 1**: 实现扩展容器基础设施
2. **Phase 2**: 将现有 OrbitView 的指令标记迁移到 `OrbitContextExtension`
3. **Phase 3**: 新模式（Observation, Tackle）直接使用扩展机制
4. **Phase 4**: 清理核心结构中的业务字段

### 9.2 兼容性

保留旧的便捷属性作为过渡：

```csharp
public readonly struct CameraModuleContext
{
    // 核心字段...

    // 扩展容器
    public readonly ExtensionContainer m_extensions;

    // 兼容旧接口（标记为过时，逐步移除）
    [Obsolete("Use GetExtension<OrbitContextExtension>().ResetRequested instead")]
    public bool ResetRequested =>
        m_extensions?.Get<OrbitContextExtension>()?.ResetRequested ??
        m_extensions?.Get<CommonCommandExtension>()?.ResetRequested ??
        false;
}
```

---

## 10. 文件清单

| 文件 | 说明 |
|-----|------|
| `ExtensionTypeRegistry.cs` | 类型 ID 注册器 |
| `ExtensionContainer.cs` | 扩展容器实现 |
| `CameraModuleContext.cs` | 精简核心上下文 |
| `CameraState.cs` | 添加扩展支持 |
| `CommonCommandExtension.cs` | 通用指令扩展 |
| `OrbitContextExtension.cs` | OrbitView 上下文扩展 |
| `OrbitStateExtension.cs` | OrbitView 状态扩展 |
| `ObservationContextExtension.cs` | Observation 扩展 |
| `TackleContextExtension.cs` | TackleObservation 扩展 |
| `CompositionExtension.cs` | 构图扩展 |
