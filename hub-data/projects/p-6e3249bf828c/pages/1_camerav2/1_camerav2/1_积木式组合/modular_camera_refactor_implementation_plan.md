# 相机系统积木式重构详细实施方案

## 版本信息
| 项目 | 值 |
|------|-----|
| **版本** | v1.2 |
| **日期** | 2026-01-30 |
| **状态** | 方案审核 |
| **基于文档** | Deep_Pipeline_Decoupling_Design.md, 积木式重构迁移规划.md, Extensible_Context_Design.md |

---

## 1. 方案评估总结

### 1.1 设计思路评估

**核心设计思想是正确的**。参考 Cinemachine 的成熟设计，将业务模式（Mode）降级为纯粹的"积木容器"，通过 CameraState 作为数据总线实现模块间的完全解耦。

#### 设计优势
| 优势 | 说明 |
|-----|------|
| **真正的自由组合** | 模块可任意组合，不需要了解彼此的存在 |
| **零代码侵入** | 新功能只需编写 Module 并挂载 Prefab |
| **状态一致性** | 所有逻辑汇聚在 `Execute()` 入口 |
| **可测试性** | 单个模块可独立单元测试 |
| **调试友好** | 数据流动清晰，状态可追踪 |
| **扩展性** | 业务指令通过扩展容器管理，核心结构保持精简 |

#### 潜在风险
| 风险 | 缓解措施 |
|-----|---------|
| **复杂度转移** | TackleObservation 三轨道系统需要精心分解，考虑分步迁移 |
| **性能开销** | 管道化带来的额外计算，通过 Profile 监控并优化热点 |
| **学习曲线** | 编写详细文档和示例，降低上手难度 |
| **兼容性** | 提供适配层，支持新旧系统平滑过渡 |

### 1.2 架构对比

```
旧架构 (继承体系)                    新架构 (组合体系)
┌─────────────────────┐             ┌─────────────────────────────────┐
│   CameraModeBase    │             │   CameraModeComponent           │
│     (God Class)     │             │   (Prefab Container)            │
│  - HandleRotation   │             │                                 │
│  - HandlePosition   │             │   ┌─────────────────────────┐   │
│  - GetCameraPos     │             │   │   CameraModuleContext   │   │
│  - GetCameraRot     │             │   │   - IInputProvider      │   │
│  - 自动回正...       │     ──>     │   │   - ExtensionContainer  │   │
│  - 轨道计算...       │             │   │   - Target/Camera       │   │
│  - 构图偏移...       │             │   └───────────┬─────────────┘   │
└─────────────────────┘             │               │                 │
                                    │   ┌───────────▼─────────────┐   │
                                    │   │    Module Pipeline      │   │
                                    │   │ Body→Aim→Noise→Finalize │   │
                                    │   └───────────┬─────────────┘   │
                                    │               │                 │
                                    │   ┌───────────▼─────────────┐   │
                                    │   │     CameraState         │   │
                                    │   │  (Physical Truth)       │   │
                                    │   └─────────────────────────┘   │
                                    └─────────────────────────────────┘
```

---

## 2. 核心基础设施重构

### 2.1 扩展容器基础设施

**文件**: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Core/ExtensionContainer.cs`

```csharp
using System;
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
    /// 高性能的类型化扩展存储，O(1) 访问
    /// </summary>
    public class ExtensionContainer
    {
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

### 2.2 IInputProvider 接口

**文件**: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Core/IInputProvider.cs`

```csharp
using UnityEngine;

namespace BlackJack.ProjectEF.Runtime.CameraController
{
    /// <summary>
    /// 相机输入提供者接口
    /// 将离散的输入统一为可索取的数据流
    /// </summary>
    public interface IInputProvider
    {
        /// <summary>
        /// 获取视角旋转增量 (x=yaw, y=pitch)
        /// </summary>
        Vector2 LookDeltaGet();

        /// <summary>
        /// 获取缩放增量
        /// </summary>
        float ZoomDeltaGet();

        /// <summary>
        /// 获取位移增量
        /// </summary>
        Vector3 MoveDeltaGet();

        /// <summary>
        /// 是否有有效输入
        /// </summary>
        bool HasInput { get; }
    }
}
```

### 2.3 CameraModuleContext 重构（精简核心版）

**文件**: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Core/CameraModuleContext.cs`

```csharp
using UnityEngine;

namespace BlackJack.ProjectEF.Runtime.CameraController
{
    /// <summary>
    /// 相机模块执行上下文（精简核心版）
    /// 只包含所有模块都需要的基础字段
    /// 业务相关的指令通过 ExtensionContainer 传递
    /// </summary>
    public readonly struct CameraModuleContext
    {
        #region 核心字段

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

        /// <summary>
        /// 完整构造函数
        /// </summary>
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

        /// <summary>
        /// 兼容旧接口的简化构造函数
        /// </summary>
        public CameraModuleContext(
            Camera mainCamera,
            ITargetProvider targetProvider,
            float deltaTime)
            : this(mainCamera, targetProvider, deltaTime, null, null)
        {
        }

        #endregion

        #region 扩展访问便捷方法

        /// <summary>
        /// 获取扩展
        /// </summary>
        public T GetExtension<T>() where T : class
        {
            return m_extensions?.Get<T>();
        }

        /// <summary>
        /// 尝试获取扩展
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
        /// 检查是否有扩展
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

### 2.4 业务扩展定义

#### 2.4.1 通用指令扩展

**文件**: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Extensions/CommonCommandExtension.cs`

```csharp
namespace BlackJack.ProjectEF.Runtime.CameraController
{
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
}
```

#### 2.4.2 OrbitView 扩展

**文件**: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Extensions/OrbitContextExtension.cs`

```csharp
using UnityEngine;

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

#### 2.4.3 Observation 扩展

**文件**: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Extensions/ObservationContextExtension.cs`

```csharp
using UnityEngine;

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

#### 2.4.4 TackleObservation 扩展

**文件**: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Extensions/TackleContextExtension.cs`

```csharp
using UnityEngine;

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

### 2.5 InputBuffer 实现

**文件**: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Core/CameraInputBuffer.cs`

```csharp
using UnityEngine;

namespace BlackJack.ProjectEF.Runtime.CameraController
{
    /// <summary>
    /// 相机输入缓冲区
    /// 累积一帧内的所有输入，在下一帧构建 Context 时提供
    /// </summary>
    public class CameraInputBuffer : IInputProvider
    {
        #region 私有字段

        private Vector2 m_lookDelta;
        private float m_zoomDelta;
        private Vector3 m_moveDelta;

        #endregion

        #region 属性

        public bool HasInput =>
            m_lookDelta.sqrMagnitude > 0.0001f ||
            Mathf.Abs(m_zoomDelta) > 0.0001f ||
            m_moveDelta.sqrMagnitude > 0.0001f;

        #endregion

        #region 输入累积方法 (由 Mode 调用)

        /// <summary>
        /// 累积视角旋转输入
        /// </summary>
        public void AccumulateLook(Vector2 delta)
        {
            m_lookDelta += delta;
        }

        /// <summary>
        /// 累积视角旋转输入
        /// </summary>
        public void AccumulateLook(float yaw, float pitch)
        {
            m_lookDelta += new Vector2(yaw, pitch);
        }

        /// <summary>
        /// 累积缩放输入
        /// </summary>
        public void AccumulateZoom(float delta)
        {
            m_zoomDelta += delta;
        }

        /// <summary>
        /// 累积位移输入
        /// </summary>
        public void AccumulateMove(Vector3 delta)
        {
            m_moveDelta += delta;
        }

        #endregion

        #region IInputProvider 实现 (由 Module 调用)

        public Vector2 LookDeltaGet() => m_lookDelta;
        public float ZoomDeltaGet() => m_zoomDelta;
        public Vector3 MoveDeltaGet() => m_moveDelta;

        #endregion

        #region 帧结束清理

        /// <summary>
        /// 清空缓冲区（每帧 Context 构建后调用）
        /// </summary>
        public void Clear()
        {
            m_lookDelta = Vector2.zero;
            m_zoomDelta = 0f;
            m_moveDelta = Vector3.zero;
        }

        #endregion
    }
}
```

### 2.6 CameraModeComponent 基类增强

**修改文件**: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Components/Modes/CameraModeComponent.cs`

在现有基类中添加以下功能：

```csharp
// === 新增字段 ===

#region 输入缓冲与扩展容器

/// <summary>
/// 输入缓冲区
/// </summary>
protected CameraInputBuffer m_inputBuffer = new CameraInputBuffer();

/// <summary>
/// 扩展容器（复用，避免 GC）
/// </summary>
protected ExtensionContainer m_extensionContainer = new ExtensionContainer();

/// <summary>
/// 通用指令扩展（复用实例）
/// </summary>
protected CommonCommandExtension m_commonExtension = new CommonCommandExtension();

/// <summary>
/// 上一帧的目标提供者
/// </summary>
protected ITargetProvider m_lastTargetProvider;

#endregion

// === 新增方法 ===

/// <summary>
/// 初始化扩展
/// 子类可以重写添加业务特定的扩展
/// </summary>
protected virtual void InitializeExtensions()
{
    m_extensionContainer.Set(m_commonExtension);
}

/// <summary>
/// 处理旋转输入（新版：累积到缓冲区）
/// </summary>
public override void HandleRotation(Vector2 input, float deltaTime)
{
    m_inputBuffer.AccumulateLook(input);
}

/// <summary>
/// 处理位置输入（新版：累积到缓冲区）
/// </summary>
public override void HandlePosition(Vector3 input, float deltaTime)
{
    if (Mathf.Abs(input.z) > 0.001f)
    {
        m_inputBuffer.AccumulateZoom(input.z);
    }
    m_inputBuffer.AccumulateMove(input);
}

/// <summary>
/// 请求重置状态（指令式：设置标记，下帧生效）
/// </summary>
public virtual void RequestReset()
{
    m_commonExtension.ResetRequested = true;
}

/// <summary>
/// 构建模块执行上下文
/// 将缓冲区和扩展容器打包
/// </summary>
protected virtual CameraModuleContext BuildModuleContext(float deltaTime)
{
    // 检测目标变化
    bool targetChanged = m_targetProvider != m_lastTargetProvider;
    m_lastTargetProvider = m_targetProvider;
    if (targetChanged)
    {
        m_commonExtension.TargetChanged = true;
    }

    return new CameraModuleContext(
        m_mainCamera,
        m_targetProvider,
        deltaTime,
        m_inputBuffer,
        m_extensionContainer
    );
}

/// <summary>
/// 帧结束清理
/// </summary>
protected virtual void ClearFrameState()
{
    m_inputBuffer.Clear();
    m_commonExtension.Clear();
    // 子类重写时清理业务扩展
}
```

### 2.7 CameraState 扩展支持

**修改文件**: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Core/CameraState.cs`

```csharp
/// <summary>
/// 相机状态数据结构（支持扩展）
/// </summary>
[System.Serializable]
public struct CameraState
{
    #region 核心位姿数据

    public Vector3 RawPosition;
    public Quaternion RawRotation;
    public Vector3 ReferenceLookAt;
    public Vector3 WorldPositionOffset;
    public Vector3 LocalPositionOffset;
    public Quaternion RotationOffset;

    #endregion

    #region 镜头参数

    public float FieldOfView;
    public Matrix4x4 ProjectionMatrix;
    public bool UseCustomProjection;

    #endregion

    #region 混合控制

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

    #region 静态工厂

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
        Extensions = null
    };

    #endregion
}
```

---

## 3. 原子积木库设计

### 3.1 Body 阶段积木

#### 3.1.1 PositionFollowModule

**功能**: 简单位置跟随，支持平滑
**对应旧模式**: SimpleFPSMode, FollowTPSMode

```csharp
/// <summary>
/// 位置跟随模块
/// 将相机位置设置为目标位置 + 偏移
/// </summary>
[AddComponentMenu("Camera/Modules/Position Follow Module")]
public class PositionFollowModuleComponent : CameraModuleComponent
{
    [Header("跟随配置")]
    [SerializeField] private Vector3 m_offset = Vector3.zero;
    [SerializeField] private bool m_useTargetRotation = false;

    [Header("平滑")]
    [SerializeField] private bool m_enableSmoothing = true;
    [SerializeField] private float m_smoothTime = 0.1f;

    private Vector3 m_velocity;
    private Vector3 m_currentPosition;
    private bool m_initialized;

    public override string ModuleName => "PositionFollowModule";

    public override void Execute(ref CameraState state, in CameraModuleContext context)
    {
        if (context.m_targetProvider == null || !context.m_targetProvider.IsActive())
            return;

        // 检查重置指令
        if (context.TryGetExtension<CommonCommandExtension>(out var cmd) && cmd.ResetRequested)
        {
            m_initialized = false;
            m_velocity = Vector3.zero;
        }

        // 计算目标位置
        Vector3 targetPos = context.m_targetProvider.PositionGet();
        Vector3 offset = m_offset;

        if (m_useTargetRotation)
        {
            Transform t = context.m_targetProvider.TransformGet();
            if (t != null)
            {
                offset = t.rotation * m_offset;
            }
        }

        Vector3 desiredPos = targetPos + offset;

        // 设置 ReferenceLookAt（焦点就是目标位置）
        state.ReferenceLookAt = targetPos;

        // 平滑
        if (m_enableSmoothing && m_initialized)
        {
            m_currentPosition = Vector3.SmoothDamp(
                m_currentPosition, desiredPos,
                ref m_velocity, m_smoothTime,
                Mathf.Infinity, context.m_deltaTime);
        }
        else
        {
            m_currentPosition = desiredPos;
            m_initialized = true;
        }

        state.RawPosition = m_currentPosition;
    }

    protected override void OnResetInternal()
    {
        m_velocity = Vector3.zero;
        m_initialized = false;
    }
}
```

#### 3.1.2 OrbitTrackModule

**功能**: 基于 ReferenceLookAt 的球面坐标环绕
**对应旧模式**: OrbitViewCameraMode, ObservationCameraMode

```csharp
/// <summary>
/// 轨道跟踪模块
/// 基于 ReferenceLookAt 的球面坐标系计算相机位置
/// </summary>
[AddComponentMenu("Camera/Modules/Orbit Track Module")]
public class OrbitTrackModuleComponent : CameraModuleComponent
{
    [Header("轨道参数")]
    [SerializeField] private float m_defaultDistance = 5f;
    [SerializeField] private float m_defaultYaw = 0f;
    [SerializeField] private float m_defaultPitch = 20f;

    [Header("限制")]
    [SerializeField] private Vector2 m_distanceRange = new Vector2(2f, 15f);
    [SerializeField] private Vector2 m_pitchRange = new Vector2(-30f, 80f);

    [Header("平滑")]
    [SerializeField] private float m_rotationSmoothTime = 0.1f;
    [SerializeField] private float m_distanceSmoothTime = 0.15f;

    // 状态
    private float m_currentYaw, m_targetYaw;
    private float m_currentPitch, m_targetPitch;
    private float m_currentDistance, m_targetDistance;

    public override string ModuleName => "OrbitTrackModule";

    public override void Execute(ref CameraState state, in CameraModuleContext context)
    {
        // 1. 检查重置指令（通用或 Orbit 特定）
        bool resetRequested = false;
        if (context.TryGetExtension<CommonCommandExtension>(out var cmd))
        {
            resetRequested = cmd.ResetRequested;
        }
        if (!resetRequested && context.TryGetExtension<OrbitContextExtension>(out var orbitCtx))
        {
            resetRequested = orbitCtx.ResetRequested;
        }

        if (resetRequested)
        {
            m_targetYaw = m_defaultYaw;
            m_targetPitch = m_defaultPitch;
            m_targetDistance = m_defaultDistance;
        }

        // 2. 处理输入
        if (context.m_inputProvider != null && context.m_inputProvider.HasInput)
        {
            var lookDelta = context.m_inputProvider.LookDeltaGet();
            var zoomDelta = context.m_inputProvider.ZoomDeltaGet();

            m_targetYaw += lookDelta.x;
            m_targetPitch = Mathf.Clamp(m_targetPitch - lookDelta.y, m_pitchRange.x, m_pitchRange.y);
            m_targetDistance = Mathf.Clamp(m_targetDistance - zoomDelta, m_distanceRange.x, m_distanceRange.y);
        }

        // 3. 平滑
        float dt = context.m_deltaTime;
        float rotT = 1f - Mathf.Exp(-dt / Mathf.Max(m_rotationSmoothTime, 0.001f));
        float distT = 1f - Mathf.Exp(-dt / Mathf.Max(m_distanceSmoothTime, 0.001f));

        m_currentYaw = Mathf.LerpAngle(m_currentYaw, m_targetYaw, rotT);
        m_currentPitch = Mathf.Lerp(m_currentPitch, m_targetPitch, rotT);
        m_currentDistance = Mathf.Lerp(m_currentDistance, m_targetDistance, distT);

        // 4. 计算球面坐标位置
        float yawRad = m_currentYaw * Mathf.Deg2Rad;
        float pitchRad = m_currentPitch * Mathf.Deg2Rad;

        Vector3 offset = new Vector3(
            m_currentDistance * Mathf.Cos(pitchRad) * Mathf.Sin(yawRad),
            m_currentDistance * Mathf.Sin(pitchRad),
            m_currentDistance * Mathf.Cos(pitchRad) * Mathf.Cos(yawRad)
        );

        // 5. 输出到 state
        state.RawPosition = state.ReferenceLookAt + offset;
        state.RawRotation = Quaternion.Euler(m_currentPitch, m_currentYaw, 0f);
    }

    protected override void OnInitializeInternal()
    {
        m_currentYaw = m_targetYaw = m_defaultYaw;
        m_currentPitch = m_targetPitch = m_defaultPitch;
        m_currentDistance = m_targetDistance = m_defaultDistance;
    }
}
```

#### 3.1.3 PathTrackModule

**功能**: 根据 Pitch 角度在自定义轨道上插值位置
**对应旧模式**: PitchTrackFPSMode, PitchTrackTPSMode

```csharp
/// <summary>
/// 路径轨道模块
/// 根据俯仰角在预设轨道点间插值计算位置偏移
/// </summary>
[AddComponentMenu("Camera/Modules/Path Track Module")]
public class PathTrackModuleComponent : CameraModuleComponent
{
    [Header("轨道配置")]
    [SerializeField] private int m_trackIndex = 0;
    [SerializeField] private TrackCoordinateSpace m_coordinateSpace = TrackCoordinateSpace.LocalWithOffset;

    private CameraTrackManager m_trackManager;

    public override string ModuleName => "PathTrackModule";

    public override void Execute(ref CameraState state, in CameraModuleContext context)
    {
        if (context.m_targetProvider == null) return;

        // 从旋转提取 pitch
        Vector3 euler = state.RawRotation.eulerAngles;
        float pitch = euler.x > 180f ? euler.x - 360f : euler.x;

        // 计算轨道偏移
        Vector3 trackOffset = CalculateTrackOffset(pitch);

        // 转换到世界坐标
        Transform targetTransform = context.m_targetProvider.TransformGet();
        if (targetTransform != null && m_coordinateSpace == TrackCoordinateSpace.LocalWithOffset)
        {
            trackOffset = targetTransform.TransformDirection(trackOffset);
        }

        // 应用偏移
        Vector3 basePos = context.m_targetProvider.PositionGet();
        state.RawPosition = basePos + trackOffset;
        state.ReferenceLookAt = basePos;
    }

    private Vector3 CalculateTrackOffset(float pitch)
    {
        // 实现轨道插值逻辑（从 PitchTrackFPSMode 迁移）
        // ... 具体实现省略
        return Vector3.zero;
    }
}
```

#### 3.1.4 TackleInterpolationModule

**功能**: 三轨道（ZoomIn/Default/ZoomOut）插值系统，用于主轨道相机的位置计算
**对应旧模式**: TackleObservationCameraMode（主轨道部分）

> **架构说明**: TackleObservation 采用多 VM 组合架构：
> - **主轨道 VM**：使用 TackleInterpolationModule 实现三轨道插值
> - **特写 VM**：每个槽位对应一个独立的 OrbitView 相机，观察特定目标
> - 特写相机复用 OrbitView 的模块组合（OrbitAutoFit + OrbitInput + OrbitFollow）
>
> **注意**: 这是最复杂的模块，建议在第四阶段实现，需要深入分析原有实现并分步迁移。

### 3.2 Aim 阶段积木

#### 3.2.1 LookAtTargetModule

**功能**: 使相机始终朝向 ReferenceLookAt
**对应旧模式**: FollowTPSMode, PitchTrackTPSMode, ObservationCameraMode

```csharp
/// <summary>
/// 注视目标模块
/// 计算朝向 ReferenceLookAt 的旋转
/// </summary>
[AddComponentMenu("Camera/Modules/LookAt Target Module")]
public class LookAtTargetModuleComponent : CameraModuleComponent
{
    [Header("配置")]
    [SerializeField] private Vector3 m_lookAtOffset = Vector3.zero;
    [SerializeField] private bool m_enableSmoothing = true;
    [SerializeField] private float m_smoothTime = 0.1f;

    private Quaternion m_currentRotation;
    private bool m_initialized;

    public override string ModuleName => "LookAtTargetModule";

    public override void Execute(ref CameraState state, in CameraModuleContext context)
    {
        // 计算朝向目标的旋转
        Vector3 lookAtPos = state.ReferenceLookAt + m_lookAtOffset;
        Vector3 direction = (lookAtPos - state.RawPosition).normalized;

        if (direction.sqrMagnitude < 0.001f)
        {
            return;
        }

        Quaternion targetRotation = Quaternion.LookRotation(direction);

        // 平滑
        if (m_enableSmoothing && m_initialized)
        {
            float t = 1f - Mathf.Exp(-context.m_deltaTime / Mathf.Max(m_smoothTime, 0.001f));
            m_currentRotation = Quaternion.Slerp(m_currentRotation, targetRotation, t);
        }
        else
        {
            m_currentRotation = targetRotation;
            m_initialized = true;
        }

        state.RawRotation = m_currentRotation;
    }
}
```

#### 3.2.2 InputRotationModule

**功能**: 将玩家 Look 输入转化为 RawRotation
**对应旧模式**: SimpleFPSMode, OrbitViewCameraMode

```csharp
/// <summary>
/// 输入旋转模块
/// 将输入增量转化为相机旋转
/// </summary>
[AddComponentMenu("Camera/Modules/Input Rotation Module")]
public class InputRotationModuleComponent : CameraModuleComponent
{
    [Header("配置")]
    [SerializeField] private float m_sensitivity = 2f;
    [SerializeField] private Vector2 m_pitchRange = new Vector2(-89f, 89f);

    [Header("平滑")]
    [SerializeField] private bool m_enableSmoothing = true;
    [SerializeField] private float m_smoothTime = 0.05f;

    private float m_yaw, m_pitch;
    private float m_targetYaw, m_targetPitch;

    public override string ModuleName => "InputRotationModule";

    public override void Execute(ref CameraState state, in CameraModuleContext context)
    {
        // 检查重置指令
        if (context.TryGetExtension<CommonCommandExtension>(out var cmd) && cmd.ResetRequested)
        {
            m_targetYaw = 0f;
            m_targetPitch = 0f;
        }

        // 处理输入
        if (context.m_inputProvider != null)
        {
            var lookDelta = context.m_inputProvider.LookDeltaGet();
            m_targetYaw += lookDelta.x * m_sensitivity;
            m_targetPitch = Mathf.Clamp(m_targetPitch - lookDelta.y * m_sensitivity, m_pitchRange.x, m_pitchRange.y);
        }

        // 平滑
        if (m_enableSmoothing)
        {
            float t = 1f - Mathf.Exp(-context.m_deltaTime / Mathf.Max(m_smoothTime, 0.001f));
            m_yaw = Mathf.LerpAngle(m_yaw, m_targetYaw, t);
            m_pitch = Mathf.Lerp(m_pitch, m_targetPitch, t);
        }
        else
        {
            m_yaw = m_targetYaw;
            m_pitch = m_targetPitch;
        }

        state.RawRotation = Quaternion.Euler(m_pitch, m_yaw, 0f);
    }
}
```

#### 3.2.3 PitchCurveModifier

**功能**: 使用 AnimationCurve 根据 Pitch 修正旋转
**对应旧模式**: PitchTrackFPSMode

```csharp
/// <summary>
/// 俯仰曲线修正模块
/// 使用 AnimationCurve 对俯仰角进行非线性映射
/// </summary>
[AddComponentMenu("Camera/Modules/Pitch Curve Modifier")]
public class PitchCurveModifierComponent : CameraModuleComponent
{
    [SerializeField] private AnimationCurve m_pitchCurve = AnimationCurve.Linear(0, 0, 1, 1);

    public override string ModuleName => "PitchCurveModifier";

    public override void Execute(ref CameraState state, in CameraModuleContext context)
    {
        if (m_pitchCurve == null || m_pitchCurve.keys.Length == 0)
            return;

        Vector3 euler = state.RawRotation.eulerAngles;
        float pitch = euler.x > 180f ? euler.x - 360f : euler.x;

        // 应用曲线
        float modifier = m_pitchCurve.Evaluate(pitch);
        float modifiedPitch = pitch * modifier;

        state.RawRotation = Quaternion.Euler(modifiedPitch, euler.y, euler.z);
    }
}
```

### 3.3 Noise/Offset 阶段积木

#### 3.3.1 HeadCompensationModule

**功能**: 模拟头部运动的物理补偿偏移
**对应旧模式**: PitchTrackFPSMode

```csharp
/// <summary>
/// 头部补偿模块
/// 根据角色头部位置变化添加相机补偿偏移
/// </summary>
[AddComponentMenu("Camera/Modules/Head Compensation Module")]
public class HeadCompensationModuleComponent : CameraModuleComponent
{
    [Header("配置")]
    [SerializeField] private bool m_enabled = true;
    [SerializeField] private float m_strength = 0.7f;
    [SerializeField] private float m_smoothSpeed = 8f;
    [SerializeField] private float m_maxDistance = 0.5f;
    [SerializeField] private float m_verticalWeight = 1f;
    [SerializeField] private float m_horizontalWeight = 0.3f;

    private Vector3 m_lastHeadPosition;
    private Vector3 m_currentOffset;
    private bool m_initialized;

    public override string ModuleName => "HeadCompensationModule";

    public override void Execute(ref CameraState state, in CameraModuleContext context)
    {
        if (!m_enabled) return;

        var target = context.m_targetProvider as ICameraFollowTarget;
        if (target == null || !target.HasHeadTransform())
        {
            return;
        }

        Vector3 headPos = target.HeadWorldPositionGet();
        Vector3 followPos = target.FollowTransformGet().position;

        if (!m_initialized)
        {
            m_lastHeadPosition = headPos;
            m_initialized = true;
            return;
        }

        // 计算头部偏移变化
        Vector3 headOffset = headPos - followPos;
        Vector3 lastHeadOffset = m_lastHeadPosition - followPos;
        Vector3 delta = headOffset - lastHeadOffset;

        // 应用权重
        Vector3 weighted = new Vector3(
            delta.x * m_horizontalWeight,
            delta.y * m_verticalWeight,
            delta.z * m_horizontalWeight
        );

        // 限制距离
        if (weighted.magnitude > m_maxDistance)
        {
            weighted = weighted.normalized * m_maxDistance;
        }

        // 平滑
        Vector3 targetOffset = weighted * m_strength;
        m_currentOffset = Vector3.Lerp(m_currentOffset, targetOffset, context.m_deltaTime * m_smoothSpeed);

        // 应用到世界偏移
        state.WorldPositionOffset += m_currentOffset;

        m_lastHeadPosition = headPos;
    }
}
```

#### 3.3.2 CollisionModule

**功能**: 射线检测并修正 RawPosition 防止穿墙
**对应旧模式**: OrbitViewCameraMode, FollowTPSMode

```csharp
/// <summary>
/// 碰撞检测模块
/// 防止相机穿透障碍物
/// </summary>
[AddComponentMenu("Camera/Modules/Collision Module")]
public class CollisionModuleComponent : CameraModuleComponent
{
    [Header("配置")]
    [SerializeField] private bool m_enabled = true;
    [SerializeField] private LayerMask m_collisionLayers = ~0;
    [SerializeField] private float m_collisionOffset = 0.2f;
    [SerializeField] private float m_minDistance = 0.5f;

    public override string ModuleName => "CollisionModule";

    public override void Execute(ref CameraState state, in CameraModuleContext context)
    {
        if (!m_enabled) return;

        Vector3 lookAt = state.ReferenceLookAt;
        Vector3 rawPos = state.RawPosition;

        if ((rawPos - lookAt).sqrMagnitude < 0.001f)
            return;

        Vector3 direction = (rawPos - lookAt).normalized;
        float distance = Vector3.Distance(rawPos, lookAt);

        if (Physics.Raycast(lookAt, direction, out RaycastHit hit, distance, m_collisionLayers))
        {
            float safeDistance = Mathf.Max(hit.distance - m_collisionOffset, m_minDistance);
            state.RawPosition = lookAt + direction * safeDistance;
        }
    }
}
```

### 3.4 Finalize 阶段积木

#### 3.4.1 AutoReturnModule

**功能**: 空闲超时后自动回正到初始状态
**对应旧模式**: ObservationCameraMode

```csharp
/// <summary>
/// 自动回正模块
/// 在用户无输入一段时间后，自动回正到初始状态
/// </summary>
[AddComponentMenu("Camera/Modules/Auto Return Module")]
public class AutoReturnModuleComponent : CameraModuleComponent
{
    [Header("配置")]
    [SerializeField] private bool m_enabled = true;
    [SerializeField] private float m_idleTime = 3f;
    [SerializeField] private float m_returnDuration = 1.2f;
    [SerializeField] private Vector2 m_deadZone = new Vector2(5f, 3f);
    [SerializeField] private AnimationCurve m_returnCurve = AnimationCurve.EaseInOut(0, 0, 1, 1);

    [Header("初始状态")]
    [SerializeField] private float m_initialYaw = 0f;
    [SerializeField] private float m_initialPitch = 20f;
    [SerializeField] private float m_initialDistance = 5f;

    private float m_idleTimer;
    private bool m_isReturning;
    private float m_returnTimer;
    private Vector3 m_returnStartPos;
    private Quaternion m_returnStartRot;

    public override string ModuleName => "AutoReturnModule";

    public override void Execute(ref CameraState state, in CameraModuleContext context)
    {
        if (!m_enabled) return;

        // 检查自动回正扩展
        if (context.TryGetExtension<ObservationContextExtension>(out var obsCtx) && obsCtx.AutoReturnRequested)
        {
            StartReturn(state);
            return;
        }

        // 检查是否有输入
        bool hasInput = context.m_inputProvider != null && context.m_inputProvider.HasInput;

        if (hasInput)
        {
            m_idleTimer = 0f;
            m_isReturning = false;
            return;
        }

        // 累计空闲时间
        m_idleTimer += context.m_deltaTime;

        // 检查是否需要开始回正
        if (!m_isReturning && m_idleTimer >= m_idleTime)
        {
            if (ShouldReturn(state))
            {
                StartReturn(state);
            }
        }

        // 执行回正
        if (m_isReturning)
        {
            UpdateReturn(ref state, context.m_deltaTime);
        }
    }

    private bool ShouldReturn(in CameraState state)
    {
        Vector3 euler = state.RawRotation.eulerAngles;
        float yaw = euler.y > 180f ? euler.y - 360f : euler.y;
        float pitch = euler.x > 180f ? euler.x - 360f : euler.x;

        float yawDiff = Mathf.Abs(Mathf.DeltaAngle(yaw, m_initialYaw));
        float pitchDiff = Mathf.Abs(pitch - m_initialPitch);

        return yawDiff > m_deadZone.x || pitchDiff > m_deadZone.y;
    }

    private void StartReturn(in CameraState state)
    {
        m_isReturning = true;
        m_returnTimer = 0f;
        m_returnStartPos = state.RawPosition;
        m_returnStartRot = state.RawRotation;
    }

    private void UpdateReturn(ref CameraState state, float deltaTime)
    {
        m_returnTimer += deltaTime;
        float t = m_returnTimer / m_returnDuration;

        if (t >= 1f)
        {
            m_isReturning = false;
            m_idleTimer = 0f;
            t = 1f;
        }

        float eased = m_returnCurve.Evaluate(t);

        // 计算目标状态
        Vector3 targetPos = CalculateTargetPosition(state.ReferenceLookAt);
        Quaternion targetRot = Quaternion.Euler(m_initialPitch, m_initialYaw, 0f);

        state.RawPosition = Vector3.Lerp(m_returnStartPos, targetPos, eased);
        state.RawRotation = Quaternion.Slerp(m_returnStartRot, targetRot, eased);
    }

    private Vector3 CalculateTargetPosition(Vector3 lookAt)
    {
        float yawRad = m_initialYaw * Mathf.Deg2Rad;
        float pitchRad = m_initialPitch * Mathf.Deg2Rad;

        Vector3 offset = new Vector3(
            m_initialDistance * Mathf.Cos(pitchRad) * Mathf.Sin(yawRad),
            m_initialDistance * Mathf.Sin(pitchRad),
            m_initialDistance * Mathf.Cos(pitchRad) * Mathf.Cos(yawRad)
        );

        return lookAt + offset;
    }
}
```

#### 3.4.2 CineDirectorOverride

**功能**: 完全接管状态，强制应用 PlayableDirector 输出
**对应旧模式**: CineCameraMode

```csharp
/// <summary>
/// Cinemachine 接管模块
/// 当 PlayableDirector 激活时，完全接管相机状态
/// </summary>
[AddComponentMenu("Camera/Modules/Cine Director Override")]
public class CineDirectorOverrideComponent : CameraModuleComponent
{
    [SerializeField] private Cinemachine.CinemachineBrain m_brain;

    public override string ModuleName => "CineDirectorOverride";

    public override void Execute(ref CameraState state, in CameraModuleContext context)
    {
        if (m_brain == null || !m_brain.isActiveAndEnabled)
            return;

        var vcam = m_brain.ActiveVirtualCamera;
        if (vcam == null)
            return;

        // 完全接管
        var vcamTrans = vcam.VirtualCameraGameObject.transform;
        state.RawPosition = vcamTrans.position;
        state.RawRotation = vcamTrans.rotation;

        // 清除所有偏移
        state.WorldPositionOffset = Vector3.zero;
        state.LocalPositionOffset = Vector3.zero;
        state.RotationOffset = Quaternion.identity;
    }
}
```

---

## 4. 旧模式迁移路径

### 4.1 迁移映射表

| 旧模式 | 新 Prefab 组合 | 复杂度 |
|-------|---------------|-------|
| **SimpleFPSMode** | PositionFollow + InputRotation | 低 |
| **FollowTPSMode** | PositionFollow + LookAtTarget + Collision | 中 |
| **PitchTrackFPSMode** | PathTrack + InputRotation + PitchCurveModifier + HeadCompensation | 中高 |
| **PitchTrackTPSMode** | PathTrack + LookAtTarget + Collision | 中高 |
| **OrbitViewCameraMode** | OrbitAutoFit + OrbitInput + OrbitFollow + Collision + Composition | 中高 |
| **ObservationCameraMode** | OrbitTrack + AutoReturn + Collision + Composition | 高 |
| **TackleObservationCameraMode** | 多 VM 组合：主轨道 VM (TackleInterpolation) + 多个特写 VM (OrbitView 变体) | 极高 |
| **CineCameraMode** | CineDirectorOverride | 低 |

### 4.2 示例 Prefab 结构

#### SimpleFPS Prefab
```
SimpleFPSMode (SimpleFPSModeComponent)
└── MainVC (VisualCameraComponent)
    ├── PositionFollow (PositionFollowModuleComponent)  [Body, Order: 0]
    └── InputRotation (InputRotationModuleComponent)    [Aim, Order: 0]
```

#### OrbitView Prefab
```
OrbitViewMode (OrbitViewModeComponent)
└── MainVC (VisualCameraComponent)
    ├── OrbitAutoFit (OrbitAutoFitModuleComponent)      [Body, Order: 0]
    ├── OrbitInput (OrbitInputModuleComponent)          [Body, Order: 5]
    ├── OrbitFollow (OrbitFollowModuleComponent)        [Body, Order: 10]
    ├── Collision (CollisionModuleComponent)            [Noise, Order: 0]
    └── Composition (CompositionModuleComponent)        [Finalize, Order: 0]
```

#### Observation Prefab
```
ObservationMode (ObservationModeComponent)
└── MainVC (VisualCameraComponent)
    ├── OrbitTrack (OrbitTrackModuleComponent)          [Body, Order: 0]
    ├── Collision (CollisionModuleComponent)            [Noise, Order: 0]
    ├── AutoReturn (AutoReturnModuleComponent)          [Finalize, Order: 0]
    └── Composition (CompositionModuleComponent)        [Finalize, Order: 10]
```

#### TackleObservation Prefab (多 VM 组合)

TackleObservation 采用多 VM 架构，由一个主轨道相机和多个特写相机组成：

```
TackleObservationMode (TackleObservationModeComponent)
│
├── MainTrackVC (VisualCameraComponent)                 [主轨道相机 - 三轨道插值]
│   ├── TackleInterpolation (TackleInterpolationModuleComponent)  [Body, Order: 0]
│   │   - 负责 ZoomIn/Default/ZoomOut 三轨道插值
│   │   - 根据缩放比例在轨道间插值计算位置
│   ├── LookAtTarget (LookAtTargetModuleComponent)      [Aim, Order: 0]
│   └── Composition (CompositionModuleComponent)        [Finalize, Order: 0]
│
├── CloseupVC_Slot0 (VisualCameraComponent)             [特写相机 0 - 观察槽位 0 目标]
│   ├── OrbitAutoFit (OrbitAutoFitModuleComponent)      [Body, Order: 0]
│   ├── OrbitInput (OrbitInputModuleComponent)          [Body, Order: 5]
│   ├── OrbitFollow (OrbitFollowModuleComponent)        [Body, Order: 10]
│   ├── Collision (CollisionModuleComponent)            [Noise, Order: 0]
│   └── Composition (CompositionModuleComponent)        [Finalize, Order: 0]
│
├── CloseupVC_Slot1 (VisualCameraComponent)             [特写相机 1 - 观察槽位 1 目标]
│   └── ... (同 CloseupVC_Slot0 结构)
│
├── CloseupVC_Slot2 (VisualCameraComponent)             [特写相机 2 - 观察槽位 2 目标]
│   └── ... (同 CloseupVC_Slot0 结构)
│
└── ... (更多特写相机，按槽位数量配置)
```

**设计说明**：
- **主轨道相机 (MainTrackVC)**：负责默认的钓具观察视角，使用三轨道插值系统
- **特写相机 (CloseupVC_SlotN)**：每个特写相机是一个独立的 OrbitView 变体，观察特定槽位的目标
- **VM 切换**：通过 Mode 控制 VM 权重实现主轨道与特写之间的平滑过渡
- **Target 绑定**：每个 CloseupVC 绑定到对应槽位的 ITargetProvider

### 4.3 Mode 使用扩展示例

**OrbitViewModeComponent 使用扩展**:

```csharp
public class OrbitViewModeComponent : CameraModeComponent
{
    // 扩展实例（复用，避免 GC）
    private readonly OrbitContextExtension m_orbitExtension = new OrbitContextExtension();

    protected override void InitializeExtensions()
    {
        base.InitializeExtensions();
        // 注册业务特定扩展
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
    public override void RequestReset()
    {
        base.RequestReset();
        m_orbitExtension.ResetRequested = true;
    }

    protected override void ClearFrameState()
    {
        base.ClearFrameState();
        // 清理业务扩展的一次性指令
        m_orbitExtension.Clear();
    }
}
```

**Module 使用扩展**:

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

    private float CalculateOptimalDistance(in CameraModuleContext context, Quaternion rotation)
    {
        // ... 实现
        return 5f;
    }

    private Vector3 CalculateCenterOffset(in CameraModuleContext context)
    {
        // ... 实现
        return Vector3.zero;
    }
}
```

---

## 5. 实施路线图

### 5.1 阶段划分

```
Phase 1 (Core Foundation)     Phase 2 (Basic Blocks)      Phase 3 (Orbit Blocks)
┌──────────────────────┐      ┌──────────────────────┐    ┌──────────────────────┐
│ - ExtensionContainer │      │ - PositionFollowModule│   │ - OrbitTrackModule   │
│ - ExtensionTypeRegistry│    │ - InputRotationModule │   │ - AutoReturnModule   │
│ - IInputProvider     │      │ - LookAtTargetModule  │   │ - 重构 OrbitInput    │
│ - CameraInputBuffer  │      │ - CollisionModule     │   │ - 重构 OrbitFollow   │
│ - Mode 基类增强      │      └──────────────────────┘    └──────────────────────┘
│ - CameraModuleContext│
│ - 业务扩展类         │
└──────────────────────┘

Phase 4 (Complex Blocks)      Phase 5 (Migration)
┌──────────────────────┐      ┌──────────────────────┐
│ - PathTrackModule    │      │ - 迁移 SimpleFPS     │
│ - HeadCompensation   │      │ - 迁移 FollowTPS     │
│ - PitchCurveModifier │      │ - 迁移 Observation   │
│ - TackleInterpolation│      │ - 迁移 PitchTrack    │
│ - CineDirectorOverride│     │ - 验证 & 调优        │
└──────────────────────┘      └──────────────────────┘
```

### 5.2 详细任务列表

#### Phase 1: Core Foundation

| 任务 | 文件 | 说明 |
|-----|------|-----|
| 1.1 | `ExtensionTypeRegistry.cs` | 类型 ID 注册器 |
| 1.2 | `ExtensionContainer.cs` | 扩展容器实现 |
| 1.3 | `IInputProvider.cs` | 定义输入提供者接口 |
| 1.4 | `CameraInputBuffer.cs` | 实现输入缓冲区 |
| 1.5 | `CameraModuleContext.cs` | 重构为精简核心版 |
| 1.6 | `CameraModeComponent.cs` | 增强基类，添加输入缓冲和扩展容器 |
| 1.7 | `CameraState.cs` | 添加扩展容器支持 |
| 1.8 | `CommonCommandExtension.cs` | 通用指令扩展 |
| 1.9 | `OrbitContextExtension.cs` | OrbitView 扩展 |
| 1.10 | `ObservationContextExtension.cs` | Observation 扩展 |
| 1.11 | `TackleContextExtension.cs` | TackleObservation 扩展 |
| 1.12 | 单元测试 | 验证扩展容器和输入流 |

#### Phase 2: Basic Blocks

| 任务 | 文件 | 说明 |
|-----|------|-----|
| 2.1 | `PositionFollowModuleComponent.cs` | 位置跟随模块 |
| 2.2 | `InputRotationModuleComponent.cs` | 输入旋转模块 |
| 2.3 | `LookAtTargetModuleComponent.cs` | 注视目标模块 |
| 2.4 | `CollisionModuleComponent.cs` | 碰撞检测模块 |
| 2.5 | SimpleFPS Prefab | 组装验证 |
| 2.6 | FollowTPS Prefab | 组装验证 |

#### Phase 3: Orbit Blocks

| 任务 | 文件 | 说明 |
|-----|------|-----|
| 3.1 | `OrbitTrackModuleComponent.cs` | 轨道跟踪模块 |
| 3.2 | `AutoReturnModuleComponent.cs` | 自动回正模块 |
| 3.3 | 重构 OrbitInputModule | 改为数据驱动，使用扩展 |
| 3.4 | 重构 OrbitFollowModule | 移除兄弟引用，使用扩展 |
| 3.5 | Observation Prefab | 组装验证 |

#### Phase 4: Complex Blocks

| 任务 | 文件 | 说明 |
|-----|------|-----|
| 4.1 | `PathTrackModuleComponent.cs` | 路径轨道模块 |
| 4.2 | `HeadCompensationModuleComponent.cs` | 头部补偿模块 |
| 4.3 | `PitchCurveModifierComponent.cs` | 俯仰曲线修正模块 |
| 4.4 | `TackleInterpolationModuleComponent.cs` | 钓具三轨道插值模块 |
| 4.5 | `CineDirectorOverrideComponent.cs` | Cinemachine 接管模块 |

#### Phase 5: Migration

| 任务 | 说明 |
|-----|------|
| 5.1 | 创建所有业务模式 Prefab |
| 5.2 | 更新 CameraController 注册逻辑 |
| 5.3 | 功能还原验证（逐模式对比） |
| 5.4 | 性能 Profile 和优化 |
| 5.5 | 文档更新 |

---

## 6. 验收标准

### 6.1 功能验收

- [ ] 所有旧模式功能在新架构下正确还原
- [ ] 输入响应延迟无明显变化
- [ ] 平滑效果与原实现一致
- [ ] 自动回正逻辑正确
- [ ] 碰撞检测无穿透
- [ ] 构图偏移正确

### 6.2 代码验收

- [ ] 模块间无直接引用（通过 CameraState 通信）
- [ ] Mode 不包含任何模块类型引用
- [ ] 单个模块可独立测试
- [ ] Prefab 可任意组合模块
- [ ] 核心结构（Context/State）不包含业务特定字段
- [ ] 业务指令通过扩展容器传递

### 6.3 性能验收

- [ ] GC Alloc 无明显增加（扩展实例复用）
- [ ] CPU 开销无明显增加（< 5%）
- [ ] 内存占用无明显增加
- [ ] ExtensionContainer 访问为 O(1)

---

## 7. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| TackleObservation 分解过于复杂 | 阻塞进度 | 允许该模块保留部分内部耦合，分步重构 |
| 旧代码依赖新接口 | 兼容性问题 | 提供适配层，旧 Mode 可继续使用 |
| 性能回退 | 用户体验下降 | 每阶段 Profile，及时优化 |
| 调试困难 | 问题定位耗时 | 增加日志、Gizmo 可视化 |
| 扩展类型过多 | 管理混乱 | 建立扩展命名规范，按业务模式分目录 |

---

## 8. 附录

### 8.1 文件清单

| 分类 | 文件 | 操作 |
|-----|------|-----|
| **Core/Extension** | `ExtensionTypeRegistry.cs` | 新增 |
| **Core/Extension** | `ExtensionContainer.cs` | 新增 |
| **Core** | `IInputProvider.cs` | 新增 |
| **Core** | `CameraInputBuffer.cs` | 新增 |
| **Core** | `CameraModuleContext.cs` | 修改 |
| **Core** | `CameraState.cs` | 修改 |
| **Mode** | `CameraModeComponent.cs` | 修改 |
| **Extensions** | `CommonCommandExtension.cs` | 新增 |
| **Extensions** | `OrbitContextExtension.cs` | 新增 |
| **Extensions** | `OrbitStateExtension.cs` | 新增 |
| **Extensions** | `ObservationContextExtension.cs` | 新增 |
| **Extensions** | `ObservationStateExtension.cs` | 新增 |
| **Extensions** | `TackleContextExtension.cs` | 新增 |
| **Extensions** | `TackleStateExtension.cs` | 新增 |
| **Module/Body** | `PositionFollowModuleComponent.cs` | 新增 |
| **Module/Body** | `OrbitTrackModuleComponent.cs` | 新增 |
| **Module/Body** | `PathTrackModuleComponent.cs` | 新增 |
| **Module/Body** | `TackleInterpolationModuleComponent.cs` | 新增 |
| **Module/Aim** | `InputRotationModuleComponent.cs` | 新增 |
| **Module/Aim** | `LookAtTargetModuleComponent.cs` | 新增 |
| **Module/Aim** | `PitchCurveModifierComponent.cs` | 新增 |
| **Module/Noise** | `HeadCompensationModuleComponent.cs` | 新增 |
| **Module/Noise** | `CollisionModuleComponent.cs` | 新增 |
| **Module/Finalize** | `AutoReturnModuleComponent.cs` | 新增 |
| **Module/Finalize** | `CineDirectorOverrideComponent.cs` | 新增 |
| **Prefabs** | 各业务模式 Prefab | 新增 |

### 8.2 命名规范

- **Module**: `XxxModuleComponent` (e.g., `PositionFollowModuleComponent`)
- **Mode**: `XxxModeComponent` (e.g., `SimpleFPSModeComponent`)
- **Interface**: `IXxx` (e.g., `IInputProvider`)
- **Context Extension**: `XxxContextExtension` (e.g., `OrbitContextExtension`)
- **State Extension**: `XxxStateExtension` (e.g., `OrbitStateExtension`)
- **Prefab**: `XxxMode.prefab` (e.g., `SimpleFPSMode.prefab`)

### 8.3 目录结构

```
Assets/GameProject/Scripts/Runtime/GameView/Camera/
├── Core/
│   ├── CameraModuleContext.cs
│   ├── CameraState.cs
│   ├── IInputProvider.cs
│   ├── CameraInputBuffer.cs
│   ├── ExtensionTypeRegistry.cs
│   └── ExtensionContainer.cs
├── Extensions/
│   ├── CommonCommandExtension.cs
│   ├── OrbitContextExtension.cs
│   ├── OrbitStateExtension.cs
│   ├── ObservationContextExtension.cs
│   ├── ObservationStateExtension.cs
│   ├── TackleContextExtension.cs
│   └── TackleStateExtension.cs
├── Components/
│   ├── Modes/
│   │   └── CameraModeComponent.cs
│   └── Modules/
│       ├── Body/
│       ├── Aim/
│       ├── Noise/
│       └── Finalize/
└── Prefabs/
    └── ...
```

### 8.4 参考资料

- Cinemachine 源码分析
- `Deep_Pipeline_Decoupling_Design.md`
- `积木式重构迁移规划.md`
- `OrbitViewCamera_Migration_Implementation.md`
- `OrbitView_Decoupling_Design.md`
- `Extensible_Context_Design.md`
