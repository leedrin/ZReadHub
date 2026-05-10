# OrbitViewCameraMode 迁移详细功能实现方案

## 版本信息
| 项目 | 值 |
|------|-----|
| **版本** | v1.1 |
| **日期** | 2026-01-28 |
| **状态** | 已实现 |
| **原文件** | `OrbitViewCameraMode.cs` (约1800行) |
| **目标架构** | CameraControllerV2 组件化架构 |

## 快速开始

### Unity 中创建 Prefab 结构

1. **使用编辑器工具（推荐）**:
   - 在 Hierarchy 中选择 `CameraModes_V2` 容器（或任意父对象）
   - 菜单: `Tools → Camera → Create OrbitViewMode Structure`
   - 工具会自动创建完整的节点层级和组件配置

2. **手动创建**:
   - 创建 GameObject 层级结构（见下方 Prefab 结构）
   - 添加对应的组件
   - 配置各模块的 Stage 和 Order

### 实现的文件清单

| 文件 | 路径 | 说明 |
|-----|------|------|
| `OrbitViewModeComponent.cs` | `Camera/Components/Modes/` | 模式控制器 |
| `OrbitInputModuleComponent.cs` | `Camera/Components/Modules/` | 输入处理模块 |
| `OrbitAutoFitModuleComponent.cs` | `Camera/Components/Modules/` | 自动适配模块 |
| `CompositionModuleComponent.cs` | `Camera/Components/Modules/` | 构图投影模块 |
| `OrbitFollowModuleComponent.cs` | `Camera/Components/Modules/` | 轨道跟随模块（已增强） |
| `OrbitViewModePrefabCreator.cs` | `Editor/Camera/` | Prefab 创建工具 |

---

## 1. 迁移概述

### 1.1 原有实现分析

`OrbitViewCameraMode` 是一个集成了多种功能的巨型类，主要功能模块：

| 功能模块 | 代码行数 | 核心方法 |
|---------|---------|---------|
| **输入处理** | ~50行 | `HandleRotation()`, `HandleZoom()` |
| **轨道计算** | ~80行 | `GetCameraPosition()`, `GetCameraRotation()` |
| **包围盒计算** | ~100行 | `CalculateTargetBounds()`, `GetBoundsCorners()` |
| **胶囊体计算** | ~80行 | `CalculateTargetCapsule()`, `CapsuleFitCamera()` |
| **AutoFit算法** | ~150行 | `AutoFitCamera()`, `FrameBoundsCalc()`, `FrameCapsuleCalc()` |
| **屏占比计算** | ~80行 | `CameraDistSetByScreenRatio()`, `CalculateProjectedBoundsSize()` |
| **构图投影** | ~100行 | `ApplyCompositionProjectionMatrix()`, `CreateOffCenterProjectionMatrix()` |
| **状态管理** | ~100行 | `SetOrbitTarget()`, `ResetCamera()`, `CacheInitialState()` |
| **Gizmos调试** | ~200行 | `DrawGizmos()` 相关方法 |
| **配置访问** | ~150行 | `GetDistanceRange()`, `GetAutoFitPadding()` 等 |

### 1.2 迁移目标

将上述功能拆解为符合 **CameraControllerV2** 架构的组件化结构：

```
OrbitViewModeComponent (CameraModeComponent)
└── MainVC (VisualCameraComponent)
    ├── OrbitAutoFitModuleComponent    [Stage: Body, Order: 0]
    ├── OrbitFollowModuleComponent     [Stage: Body, Order: 10] (复用现有)
    ├── OrbitInputModuleComponent      [Stage: Aim, Order: 0]
    └── CompositionModuleComponent     [Stage: Finalize, Order: 0]
```

---

## 2. 新增组件详细设计

### 2.1 OrbitViewModeComponent (模式控制器)

**文件路径**: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Components/Modes/OrbitViewModeComponent.cs`

**职责**:
- 作为业务逻辑的 Facade，提供 `SetOrbitTarget()` 接口
- 管理 AutoFit 模式切换
- 协调子模块的参数传递

```csharp
namespace BlackJack.ProjectEF.Runtime.Scene
{
    /// <summary>
    /// OrbitView 相机模式组件
    /// 环绕观察模式，支持自动适配、构图偏移等高级功能
    /// </summary>
    [AddComponentMenu("Camera/Modes/OrbitView Mode")]
    public class OrbitViewModeComponent : CameraModeComponent
    {
        #region 序列化字段

        [Header("OrbitView 配置")]
        [SerializeField]
        [Tooltip("默认自动适配模式")]
        private CameraAutoFitMode m_defaultAutoFitMode = CameraAutoFitMode.Bounds;

        [SerializeField]
        [Tooltip("是否将环绕中心调整到目标中央")]
        private bool m_adjustOrbitCenterToBoundsCenter = true;

        #endregion

        #region 运行时状态

        private CameraAutoFitMode m_currentAutoFitMode;
        private OrbitInputModuleComponent m_inputModule;
        private OrbitAutoFitModuleComponent m_autoFitModule;
        private OrbitFollowModuleComponent m_followModule;
        private CompositionModuleComponent m_compositionModule;

        #endregion

        #region 属性

        public override string ModeName => "OrbitView";

        public CameraAutoFitMode CurrentAutoFitMode => m_currentAutoFitMode;

        #endregion

        #region 公共接口

        /// <summary>
        /// 设置环绕目标（兼容旧接口）
        /// </summary>
        public void SetOrbitTarget(ICameraFollowTarget target, CameraAutoFitMode autoFitMode = CameraAutoFitMode.Bounds)
        {
            // 1. 更新基类的 FollowTarget
            SetFollowTarget(target);

            // 2. 记录当前适配模式
            m_currentAutoFitMode = autoFitMode;

            // 3. 通知 AutoFit 模块重新计算
            if (m_autoFitModule != null)
            {
                m_autoFitModule.TriggerAutoFit(autoFitMode, m_adjustOrbitCenterToBoundsCenter);
            }
        }

        /// <summary>
        /// 重置相机到初始状态
        /// </summary>
        public void ResetCamera()
        {
            m_inputModule?.ResetToInitial();
            m_autoFitModule?.Reset();
        }

        /// <summary>
        /// 设置初始状态（兼容 ICameraInitialState）
        /// </summary>
        public void SetInitialState(Vector3? rotation, float? distance)
        {
            if (m_inputModule != null)
            {
                if (rotation.HasValue)
                {
                    m_inputModule.SetInitialRotation(rotation.Value.y, rotation.Value.x);
                }
                if (distance.HasValue)
                {
                    m_inputModule.SetInitialDistance(distance.Value);
                }
                m_inputModule.ResetToInitial();
            }
        }

        /// <summary>
        /// 设置目标占构图框比例
        /// </summary>
        public void TargetInFrameRatioSet(float ratio)
        {
            if (m_autoFitModule != null)
            {
                m_autoFitModule.TargetInFrameRatio = ratio;
            }
        }

        #endregion

        #region 生命周期

        protected override void OnInitializeInternal()
        {
            // 缓存子模块引用
            m_inputModule = GetModule<OrbitInputModuleComponent>();
            m_autoFitModule = GetModule<OrbitAutoFitModuleComponent>();
            m_followModule = GetModule<OrbitFollowModuleComponent>();
            m_compositionModule = GetModule<CompositionModuleComponent>();

            m_currentAutoFitMode = m_defaultAutoFitMode;
        }

        protected override void OnEnterInternal()
        {
            // 进入模式时触发自动适配
            if (m_followTarget != null && m_autoFitModule != null)
            {
                m_autoFitModule.TriggerAutoFit(m_currentAutoFitMode, m_adjustOrbitCenterToBoundsCenter);
            }
        }

        public override void HandleRotation(Vector2 input, float deltaTime)
        {
            // 输入由 OrbitInputModuleComponent 在 Execute 中处理
            // 这里仅转发给输入模块
            m_inputModule?.HandleInput(input, 0f, deltaTime);
        }

        public override void HandlePosition(Vector3 input, float deltaTime)
        {
            // 处理缩放（Z轴输入）
            if (Mathf.Abs(input.z) > 0.001f)
            {
                m_inputModule?.HandleZoom(input.z, deltaTime);
            }
        }

        #endregion
    }
}
```

---

### 2.2 OrbitInputModuleComponent (输入模块)

**文件路径**: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Components/Modules/OrbitInputModuleComponent.cs`

**职责**:
- 处理 Yaw/Pitch 旋转输入
- 处理 Distance (Zoom) 输入
- 维护惯性和平滑阻尼
- 输出旋转和距离给后续模块

**迁移代码映射**:

| 原方法 | 新位置 | 说明 |
|-------|-------|------|
| `HandleRotation()` | `Execute()` + `HandleInput()` | 旋转输入处理 |
| `HandleZoom()` | `HandleZoom()` | 缩放输入处理 |
| `m_yaw`, `m_pitch`, `m_distance` | 模块内部状态 | 状态维护 |

```csharp
namespace BlackJack.ProjectEF.Runtime.Scene
{
    /// <summary>
    /// 轨道输入模块组件
    /// 处理环绕观察的旋转和缩放输入
    /// </summary>
    [AddComponentMenu("Camera/Modules/Orbit Input Module")]
    public class OrbitInputModuleComponent : CameraModuleComponent
    {
        #region 序列化字段

        [Header("默认参数")]
        [SerializeField] private float m_defaultDistance = 1.5f;
        [SerializeField] private float m_defaultYaw = 225f;
        [SerializeField] private float m_defaultPitch = 10f;

        [Header("距离限制")]
        [SerializeField] private float m_minDistance = 0.5f;
        [SerializeField] private float m_maxDistance = 20f;

        [Header("俯仰角限制")]
        [SerializeField] private float m_minPitch = -30f;
        [SerializeField] private float m_maxPitch = 80f;

        [Header("敏感度")]
        [SerializeField] private float m_rotationSensitivity = 2f;
        [SerializeField] private float m_zoomSensitivity = 1f;

        [Header("平滑")]
        [SerializeField] private bool m_enableSmoothing = true;
        [SerializeField] private float m_rotationSmoothTime = 0.1f;
        [SerializeField] private float m_distanceSmoothTime = 0.15f;

        [Header("惯性")]
        [SerializeField] private bool m_enableInertia = true;
        [SerializeField] private float m_inertiaDamping = 5f;

        #endregion

        #region 运行时状态

        // 当前值
        private float m_currentYaw;
        private float m_currentPitch;
        private float m_currentDistance;

        // 目标值（用于平滑）
        private float m_targetYaw;
        private float m_targetPitch;
        private float m_targetDistance;

        // 初始值（用于重置）
        private float m_initialYaw;
        private float m_initialPitch;
        private float m_initialDistance;
        private bool m_hasCustomInitialState;

        // 惯性速度
        private float m_yawVelocity;
        private float m_pitchVelocity;

        // 输入缓冲
        private Vector2 m_pendingRotationInput;
        private float m_pendingZoomInput;

        #endregion

        #region 属性

        public override string ModuleName => "OrbitInputModule";

        public float CurrentYaw => m_currentYaw;
        public float CurrentPitch => m_currentPitch;
        public float CurrentDistance => m_currentDistance;

        public Vector2 DistanceRange => new Vector2(m_minDistance, m_maxDistance);

        #endregion

        #region 公共方法

        /// <summary>
        /// 处理旋转和缩放输入（由 Mode 调用）
        /// </summary>
        public void HandleInput(Vector2 rotationInput, float zoomInput, float deltaTime)
        {
            m_pendingRotationInput += rotationInput;
            m_pendingZoomInput += zoomInput;
        }

        /// <summary>
        /// 处理缩放输入
        /// </summary>
        public void HandleZoom(float zoomDelta, float deltaTime)
        {
            m_pendingZoomInput += zoomDelta;
        }

        /// <summary>
        /// 设置初始旋转
        /// </summary>
        public void SetInitialRotation(float yaw, float pitch)
        {
            m_initialYaw = yaw;
            m_initialPitch = pitch;
            m_hasCustomInitialState = true;
        }

        /// <summary>
        /// 设置初始距离
        /// </summary>
        public void SetInitialDistance(float distance)
        {
            m_initialDistance = distance;
            m_hasCustomInitialState = true;
        }

        /// <summary>
        /// 设置目标距离（由 AutoFit 模块调用）
        /// </summary>
        public void SetTargetDistance(float distance)
        {
            m_targetDistance = Mathf.Clamp(distance, m_minDistance, m_maxDistance);
        }

        /// <summary>
        /// 重置到初始状态
        /// </summary>
        public void ResetToInitial()
        {
            if (m_hasCustomInitialState)
            {
                m_currentYaw = m_targetYaw = m_initialYaw;
                m_currentPitch = m_targetPitch = m_initialPitch;
                m_currentDistance = m_targetDistance = m_initialDistance;
            }
            else
            {
                m_currentYaw = m_targetYaw = m_defaultYaw;
                m_currentPitch = m_targetPitch = m_defaultPitch;
                m_currentDistance = m_targetDistance = m_defaultDistance;
            }

            m_yawVelocity = 0f;
            m_pitchVelocity = 0f;
        }

        #endregion

        #region 模块实现

        protected override void OnInitializeInternal()
        {
            m_initialYaw = m_defaultYaw;
            m_initialPitch = m_defaultPitch;
            m_initialDistance = m_defaultDistance;
            ResetToInitial();
        }

        protected override void OnResetInternal()
        {
            ResetToInitial();
        }

        public override void Execute(ref CameraState state, in CameraModuleContext context)
        {
            float deltaTime = context.m_deltaTime;

            // 1. 处理旋转输入
            ProcessRotationInput(deltaTime);

            // 2. 处理缩放输入
            ProcessZoomInput(deltaTime);

            // 3. 应用平滑
            if (m_enableSmoothing)
            {
                ApplySmoothing(deltaTime);
            }
            else
            {
                m_currentYaw = m_targetYaw;
                m_currentPitch = m_targetPitch;
                m_currentDistance = m_targetDistance;
            }

            // 4. 计算旋转并写入状态
            state.RawRotation = Quaternion.Euler(m_currentPitch, m_currentYaw, 0f);

            // 清空输入缓冲
            m_pendingRotationInput = Vector2.zero;
            m_pendingZoomInput = 0f;
        }

        private void ProcessRotationInput(float deltaTime)
        {
            if (m_pendingRotationInput.sqrMagnitude > 0.0001f)
            {
                // 应用旋转输入
                m_targetYaw += m_pendingRotationInput.x * m_rotationSensitivity * deltaTime;
                m_targetPitch -= m_pendingRotationInput.y * m_rotationSensitivity * deltaTime;

                // 限制俯仰角
                m_targetPitch = Mathf.Clamp(m_targetPitch, m_minPitch, m_maxPitch);

                // 规范化偏航角
                m_targetYaw = m_targetYaw % 360f;
                if (m_targetYaw < 0f) m_targetYaw += 360f;

                // 更新惯性速度
                if (m_enableInertia)
                {
                    m_yawVelocity = m_pendingRotationInput.x * m_rotationSensitivity;
                    m_pitchVelocity = -m_pendingRotationInput.y * m_rotationSensitivity;
                }
            }
            else if (m_enableInertia)
            {
                // 应用惯性
                m_targetYaw += m_yawVelocity * deltaTime;
                m_targetPitch += m_pitchVelocity * deltaTime;
                m_targetPitch = Mathf.Clamp(m_targetPitch, m_minPitch, m_maxPitch);

                // 衰减惯性
                m_yawVelocity = Mathf.Lerp(m_yawVelocity, 0f, m_inertiaDamping * deltaTime);
                m_pitchVelocity = Mathf.Lerp(m_pitchVelocity, 0f, m_inertiaDamping * deltaTime);
            }
        }

        private void ProcessZoomInput(float deltaTime)
        {
            if (Mathf.Abs(m_pendingZoomInput) > 0.0001f)
            {
                m_targetDistance -= m_pendingZoomInput * m_zoomSensitivity;
                m_targetDistance = Mathf.Clamp(m_targetDistance, m_minDistance, m_maxDistance);
            }
        }

        private void ApplySmoothing(float deltaTime)
        {
            m_currentYaw = Mathf.Lerp(m_currentYaw, m_targetYaw, deltaTime / m_rotationSmoothTime);
            m_currentPitch = Mathf.Lerp(m_currentPitch, m_targetPitch, deltaTime / m_rotationSmoothTime);
            m_currentDistance = Mathf.Lerp(m_currentDistance, m_targetDistance, deltaTime / m_distanceSmoothTime);
        }

        #endregion
    }
}
```

---

### 2.3 OrbitAutoFitModuleComponent (自动适配模块)

**文件路径**: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Components/Modules/OrbitAutoFitModuleComponent.cs`

**职责**:
- 计算目标的包围盒 (Bounds) 或胶囊体 (Capsule)
- 根据适配模式计算最佳观察距离
- 计算目标中心偏移 (Orbit Center Adjustment)
- 输出到 OrbitInputModuleComponent 的 Distance 和 OrbitFollowModuleComponent 的 CenterOffset

**迁移代码映射**:

| 原方法 | 新位置 | 说明 |
|-------|-------|------|
| `CalculateTargetBounds()` | `CalculateTargetBounds()` | 包围盒计算 |
| `CalculateTargetCapsule()` | `CalculateTargetCapsule()` | 胶囊体计算 |
| `AutoFitCamera()` | `Execute()` | 自动适配入口 |
| `FrameBoundsCalc()` | `CalculateBoundsDistance()` | 包围盒距离计算 |
| `FrameCapsuleCalc()` | `CalculateCapsuleDistance()` | 胶囊体距离计算 |
| `CameraDistSetByScreenRatio()` | `CalculateScreenRatioDistance()` | 屏占比距离计算 |

```csharp
namespace BlackJack.ProjectEF.Runtime.Scene
{
    /// <summary>
    /// 轨道自动适配模块组件
    /// 计算最佳观察距离和中心点偏移
    /// </summary>
    [AddComponentMenu("Camera/Modules/Orbit AutoFit Module")]
    public class OrbitAutoFitModuleComponent : CameraModuleComponent
    {
        #region 序列化字段

        [Header("适配参数")]
        [SerializeField]
        [Tooltip("包围盒适配填充系数（数值越大，目标在屏幕上越小）")]
        private float m_boundsFitPadding = 1.2f;

        [SerializeField]
        [Tooltip("胶囊体适配填充系数（数值越小，目标在屏幕上越大）")]
        private float m_capsuleFitPadding = 0.9f;

        [SerializeField]
        [Tooltip("目标占构图框比例")]
        [Range(0.01f, 1.0f)]
        private float m_targetInFrameRatio = 0.5f;

        [Header("距离限制")]
        [SerializeField] private float m_minDistance = 0.5f;
        [SerializeField] private float m_maxDistance = 20f;

        #endregion

        #region 运行时状态

        private bool m_triggerAutoFit;
        private CameraAutoFitMode m_autoFitMode;
        private bool m_adjustOrbitCenter;

        // 计算结果缓存
        private Bounds m_targetBounds;
        private CapsuleInfo m_targetCapsuleInfo;
        private Vector3 m_centerOffset;
        private float m_optimalDistance;

        // 兄弟模块引用
        private OrbitInputModuleComponent m_inputModule;

        #endregion

        #region 属性

        public override string ModuleName => "OrbitAutoFitModule";

        public float TargetInFrameRatio
        {
            get => m_targetInFrameRatio;
            set => m_targetInFrameRatio = Mathf.Clamp(value, 0.01f, 1.0f);
        }

        public Bounds TargetBounds => m_targetBounds;
        public Vector3 CenterOffset => m_centerOffset;

        #endregion

        #region 公共方法

        /// <summary>
        /// 触发自动适配计算
        /// </summary>
        public void TriggerAutoFit(CameraAutoFitMode mode, bool adjustOrbitCenter)
        {
            m_triggerAutoFit = true;
            m_autoFitMode = mode;
            m_adjustOrbitCenter = adjustOrbitCenter;
        }

        #endregion

        #region 模块实现

        protected override void OnInitializeInternal()
        {
            // 获取兄弟模块引用
            var parent = transform.parent;
            if (parent != null)
            {
                m_inputModule = parent.GetComponentInChildren<OrbitInputModuleComponent>();
            }
        }

        public override void Execute(ref CameraState state, in CameraModuleContext context)
        {
            if (!m_triggerAutoFit) return;
            if (context.m_targetProvider == null || !context.m_targetProvider.IsActive()) return;

            // 根据适配模式执行计算
            switch (m_autoFitMode)
            {
                case CameraAutoFitMode.Bounds:
                    CalculateTargetBounds(context);
                    m_optimalDistance = CalculateBoundsDistance(context, state.RawRotation);
                    break;

                case CameraAutoFitMode.Capsule:
                    CalculateTargetCapsule(context);
                    m_optimalDistance = CalculateCapsuleDistance(context, state.RawRotation);
                    break;

                case CameraAutoFitMode.ScreenRatio:
                    CalculateTargetBounds(context);
                    m_optimalDistance = CalculateScreenRatioDistance(context, state.RawRotation);
                    break;

                case CameraAutoFitMode.None:
                default:
                    m_triggerAutoFit = false;
                    return;
            }

            // 计算中心偏移
            if (m_adjustOrbitCenter)
            {
                CalculateCenterOffset(context);
            }
            else
            {
                m_centerOffset = Vector3.zero;
            }

            // 应用结果到兄弟模块
            if (m_inputModule != null)
            {
                m_inputModule.SetTargetDistance(m_optimalDistance);
            }

            m_triggerAutoFit = false;
        }

        #endregion

        #region 核心算法

        /// <summary>
        /// 计算目标的包围盒
        /// </summary>
        private void CalculateTargetBounds(in CameraModuleContext context)
        {
            Transform targetTransform = context.m_targetProvider.TransformGet();
            if (targetTransform == null)
            {
                m_targetBounds = new Bounds(context.m_targetProvider.PositionGet(), Vector3.one);
                return;
            }

            Renderer[] renderers = targetTransform.GetComponentsInChildren<Renderer>();
            if (renderers.Length == 0)
            {
                m_targetBounds = new Bounds(targetTransform.position, Vector3.one);
                return;
            }

            m_targetBounds = renderers[0].bounds;
            for (int i = 1; i < renderers.Length; i++)
            {
                m_targetBounds.Encapsulate(renderers[i].bounds);
            }
        }

        /// <summary>
        /// 计算目标的胶囊体参数
        /// </summary>
        private void CalculateTargetCapsule(in CameraModuleContext context)
        {
            Transform targetTransform = context.m_targetProvider.TransformGet();
            if (targetTransform == null)
            {
                m_targetCapsuleInfo = CapsuleInfo.Invalid;
                CalculateTargetBounds(context);
                return;
            }

            CapsuleCollider capsuleCollider = targetTransform.GetComponentInChildren<CapsuleCollider>();
            if (capsuleCollider == null)
            {
                m_targetCapsuleInfo = CapsuleInfo.Invalid;
                CalculateTargetBounds(context);
                return;
            }

            Transform capsuleTransform = capsuleCollider.transform;
            Vector3 worldCenter = capsuleTransform.TransformPoint(capsuleCollider.center);
            float worldRadius = capsuleCollider.radius * Mathf.Max(
                Mathf.Abs(capsuleTransform.lossyScale.x),
                Mathf.Abs(capsuleTransform.lossyScale.z));
            float worldHeight = capsuleCollider.height * Mathf.Abs(capsuleTransform.lossyScale.y);

            float width, height;
            switch (capsuleCollider.direction)
            {
                case 0: // X-axis
                    width = worldHeight;
                    height = worldRadius * 2f;
                    break;
                case 2: // Z-axis
                    width = worldRadius * 2f;
                    height = worldHeight;
                    break;
                case 1: // Y-axis (默认)
                default:
                    width = worldRadius * 2f;
                    height = worldHeight;
                    break;
            }

            m_targetCapsuleInfo = new CapsuleInfo
            {
                m_center = worldCenter,
                m_radius = worldRadius,
                m_height = worldHeight,
                m_width = width,
                m_viewHeight = height,
                m_direction = capsuleCollider.direction,
                m_isValid = true
            };

            m_targetBounds = new Bounds(worldCenter, new Vector3(width, height, width));
        }

        /// <summary>
        /// 基于包围盒计算最佳距离
        /// </summary>
        private float CalculateBoundsDistance(in CameraModuleContext context, Quaternion viewRotation)
        {
            if (context.m_mainCamera == null || m_targetBounds.size == Vector3.zero)
            {
                return m_minDistance;
            }

            // 将包围盒顶点转换到视图空间
            Vector3[] corners = new Vector3[8];
            GetBoundsCorners(m_targetBounds, corners);

            float minX = float.MaxValue, maxX = float.MinValue;
            float minY = float.MaxValue, maxY = float.MinValue;

            Quaternion inverseRotation = Quaternion.Inverse(viewRotation);
            Vector3 center = m_targetBounds.center;

            for (int i = 0; i < 8; i++)
            {
                Vector3 localPoint = inverseRotation * (corners[i] - center);
                minX = Mathf.Min(minX, localPoint.x);
                maxX = Mathf.Max(maxX, localPoint.x);
                minY = Mathf.Min(minY, localPoint.y);
                maxY = Mathf.Max(maxY, localPoint.y);
            }

            float projectedWidth = maxX - minX;
            float projectedHeight = maxY - minY;

            // 利用三角函数计算距离
            float vFov = context.m_mainCamera.fieldOfView * Mathf.Deg2Rad;
            float distanceV = (projectedHeight * 0.5f) / Mathf.Tan(vFov * 0.5f);

            float hFov = 2f * Mathf.Atan(Mathf.Tan(vFov * 0.5f) * context.m_mainCamera.aspect);
            float distanceH = (projectedWidth * 0.5f) / Mathf.Tan(hFov * 0.5f);

            float finalDistance = Mathf.Max(distanceV, distanceH) * m_boundsFitPadding;
            return Mathf.Clamp(finalDistance, m_minDistance, m_maxDistance);
        }

        /// <summary>
        /// 基于胶囊体计算最佳距离
        /// </summary>
        private float CalculateCapsuleDistance(in CameraModuleContext context, Quaternion viewRotation)
        {
            if (!m_targetCapsuleInfo.m_isValid)
            {
                return CalculateBoundsDistance(context, viewRotation);
            }

            if (context.m_mainCamera == null)
            {
                return m_minDistance;
            }

            float capsuleWidth = m_targetCapsuleInfo.m_width;
            float capsuleHeight = m_targetCapsuleInfo.m_viewHeight;

            // 获取俯仰角
            Vector3 euler = viewRotation.eulerAngles;
            float pitchRad = euler.x * Mathf.Deg2Rad;

            // 计算投影尺寸
            float projectedHeight = Mathf.Abs(Mathf.Cos(pitchRad)) * capsuleHeight +
                                   Mathf.Abs(Mathf.Sin(pitchRad)) * capsuleWidth;
            float projectedWidth = capsuleWidth;

            // 利用三角函数计算距离
            float vFov = context.m_mainCamera.fieldOfView * Mathf.Deg2Rad;
            float distanceV = (projectedHeight * 0.5f) / Mathf.Tan(vFov * 0.5f);

            float hFov = 2f * Mathf.Atan(Mathf.Tan(vFov * 0.5f) * context.m_mainCamera.aspect);
            float distanceH = (projectedWidth * 0.5f) / Mathf.Tan(hFov * 0.5f);

            float finalDistance = Mathf.Max(distanceV, distanceH) * m_capsuleFitPadding;
            return Mathf.Clamp(finalDistance, m_minDistance, m_maxDistance);
        }

        /// <summary>
        /// 基于屏占比计算最佳距离
        /// </summary>
        private float CalculateScreenRatioDistance(in CameraModuleContext context, Quaternion viewRotation)
        {
            if (context.m_mainCamera == null || m_targetBounds.size == Vector3.zero)
            {
                return m_minDistance;
            }

            float targetScreenRatio = Mathf.Clamp(m_targetInFrameRatio, 0.01f, 1.0f);

            // 计算投影尺寸
            CalculateProjectedBoundsSize(viewRotation, out float projectedWidth, out float projectedHeight);

            // 获取相机参数
            float cameraFov = context.m_mainCamera.fieldOfView;
            float cameraAspect = context.m_mainCamera.aspect;

            float verticalFovRad = cameraFov * Mathf.Deg2Rad;
            float horizontalFovRad = 2f * Mathf.Atan(Mathf.Tan(verticalFovRad * 0.5f) * cameraAspect);
            float horizontalFov = horizontalFovRad * Mathf.Rad2Deg;

            float projectedAspect = projectedWidth / projectedHeight;
            bool isWidthDominant = projectedAspect > cameraAspect;

            float requiredDistance;
            if (isWidthDominant)
            {
                float halfFov = horizontalFov * 0.5f;
                float baseDistance = (projectedWidth * 0.5f) / Mathf.Tan(halfFov * Mathf.Deg2Rad);
                requiredDistance = baseDistance / targetScreenRatio;
            }
            else
            {
                float halfFov = cameraFov * 0.5f;
                float baseDistance = (projectedHeight * 0.5f) / Mathf.Tan(halfFov * Mathf.Deg2Rad);
                requiredDistance = baseDistance / targetScreenRatio;
            }

            return Mathf.Clamp(requiredDistance, m_minDistance, m_maxDistance);
        }

        /// <summary>
        /// 计算包围盒在视角下的投影尺寸
        /// </summary>
        private void CalculateProjectedBoundsSize(Quaternion viewRotation, out float width, out float height)
        {
            Vector3[] corners = new Vector3[8];
            GetBoundsCorners(m_targetBounds, corners);

            float minX = float.MaxValue, maxX = float.MinValue;
            float minY = float.MaxValue, maxY = float.MinValue;

            Quaternion inverseRotation = Quaternion.Inverse(viewRotation);
            Vector3 center = m_targetBounds.center;

            foreach (Vector3 corner in corners)
            {
                Vector3 localPoint = inverseRotation * (corner - center);
                minX = Mathf.Min(minX, localPoint.x);
                maxX = Mathf.Max(maxX, localPoint.x);
                minY = Mathf.Min(minY, localPoint.y);
                maxY = Mathf.Max(maxY, localPoint.y);
            }

            width = maxX - minX;
            height = maxY - minY;
        }

        /// <summary>
        /// 计算中心偏移
        /// </summary>
        private void CalculateCenterOffset(in CameraModuleContext context)
        {
            Vector3 targetPos = context.m_targetProvider.PositionGet();

            if (m_autoFitMode == CameraAutoFitMode.Capsule && m_targetCapsuleInfo.m_isValid)
            {
                m_centerOffset = m_targetCapsuleInfo.m_center - targetPos;
            }
            else if (m_targetBounds.size != Vector3.zero)
            {
                m_centerOffset = m_targetBounds.center - targetPos;
            }
            else
            {
                m_centerOffset = Vector3.zero;
            }
        }

        /// <summary>
        /// 获取包围盒的8个顶点
        /// </summary>
        private static void GetBoundsCorners(Bounds b, Vector3[] corners)
        {
            Vector3 center = b.center;
            Vector3 extents = b.extents;

            corners[0] = new Vector3(center.x - extents.x, center.y - extents.y, center.z - extents.z);
            corners[1] = new Vector3(center.x + extents.x, center.y - extents.y, center.z - extents.z);
            corners[2] = new Vector3(center.x - extents.x, center.y - extents.y, center.z + extents.z);
            corners[3] = new Vector3(center.x + extents.x, center.y - extents.y, center.z + extents.z);
            corners[4] = new Vector3(center.x - extents.x, center.y + extents.y, center.z - extents.z);
            corners[5] = new Vector3(center.x + extents.x, center.y + extents.y, center.z - extents.z);
            corners[6] = new Vector3(center.x - extents.x, center.y + extents.y, center.z + extents.z);
            corners[7] = new Vector3(center.x + extents.x, center.y + extents.y, center.z + extents.z);
        }

        #endregion

        #region 数据结构

        /// <summary>
        /// 胶囊体信息
        /// </summary>
        public struct CapsuleInfo
        {
            public Vector3 m_center;
            public float m_radius;
            public float m_height;
            public float m_width;
            public float m_viewHeight;
            public int m_direction;
            public bool m_isValid;

            public static CapsuleInfo Invalid => new CapsuleInfo { m_isValid = false };
        }

        #endregion
    }
}
```

---

### 2.4 CompositionModuleComponent (构图模块)

**文件路径**: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Components/Modules/CompositionModuleComponent.cs`

**职责**:
- 计算非中心投影矩阵
- 实现构图偏移和缩放效果

**迁移代码映射**:

| 原方法 | 新位置 | 说明 |
|-------|-------|------|
| `ApplyCompositionProjectionMatrix()` | `Execute()` | 应用投影矩阵 |
| `CreateOffCenterProjectionMatrix()` | `CreateOffCenterProjectionMatrix()` | 投影矩阵计算 |

```csharp
namespace BlackJack.ProjectEF.Runtime.Scene
{
    /// <summary>
    /// 构图模块组件
    /// 通过修改投影矩阵实现构图偏移和缩放
    /// </summary>
    [AddComponentMenu("Camera/Modules/Composition Module")]
    public class CompositionModuleComponent : CameraModuleComponent
    {
        #region 序列化字段

        [Header("构图配置")]
        [SerializeField]
        [Tooltip("是否启用构图")]
        private bool m_enableComposition = false;

        [SerializeField]
        [Tooltip("目标在屏幕上的X位置 (0-1)")]
        [Range(0f, 1f)]
        private float m_screenX = 0.5f;

        [SerializeField]
        [Tooltip("目标在屏幕上的Y位置 (0-1)")]
        [Range(0f, 1f)]
        private float m_screenY = 0.5f;

        [SerializeField]
        [Tooltip("引导框宽度")]
        [Range(0.1f, 1f)]
        private float m_zoneWidth = 0.8f;

        [SerializeField]
        [Tooltip("引导框高度")]
        [Range(0.1f, 1f)]
        private float m_zoneHeight = 0.8f;

        [SerializeField]
        [Tooltip("是否自动适配到引导框")]
        private bool m_autoFitToZone = false;

        #endregion

        #region 属性

        public override string ModuleName => "CompositionModule";

        public bool EnableComposition
        {
            get => m_enableComposition;
            set => m_enableComposition = value;
        }

        public Vector2 ScreenPosition
        {
            get => new Vector2(m_screenX, m_screenY);
            set
            {
                m_screenX = Mathf.Clamp01(value.x);
                m_screenY = Mathf.Clamp01(value.y);
            }
        }

        public Vector2 ZoneSize
        {
            get => new Vector2(m_zoneWidth, m_zoneHeight);
            set
            {
                m_zoneWidth = Mathf.Clamp(value.x, 0.1f, 1f);
                m_zoneHeight = Mathf.Clamp(value.y, 0.1f, 1f);
            }
        }

        #endregion

        #region 模块实现

        public override void Execute(ref CameraState state, in CameraModuleContext context)
        {
            if (!m_enableComposition || context.m_mainCamera == null)
            {
                state.UseCustomProjection = false;
                return;
            }

            // 计算构图偏移
            float offsetX = -(m_screenX - 0.5f);
            float offsetY = -(m_screenY - 0.5f);

            // 创建投影矩阵
            Matrix4x4 projectionMatrix = CreateOffCenterProjectionMatrix(
                context.m_mainCamera.fieldOfView,
                context.m_mainCamera.aspect,
                context.m_mainCamera.nearClipPlane,
                context.m_mainCamera.farClipPlane,
                offsetX,
                offsetY,
                m_zoneWidth,
                m_zoneHeight
            );

            state.ProjectionMatrix = projectionMatrix;
            state.UseCustomProjection = true;
        }

        /// <summary>
        /// 创建off-center投影矩阵
        /// </summary>
        private Matrix4x4 CreateOffCenterProjectionMatrix(
            float fov, float aspect, float near, float far,
            float offsetX, float offsetY, float scaleX, float scaleY)
        {
            // 计算near平面的尺寸
            float halfHeight = near * Mathf.Tan(fov * 0.5f * Mathf.Deg2Rad);
            float halfWidth = halfHeight * aspect;

            // 应用缩放
            halfWidth /= scaleX;
            halfHeight /= scaleY;

            // 应用偏移
            float left = -halfWidth + (offsetX * halfWidth * 2f);
            float right = halfWidth + (offsetX * halfWidth * 2f);
            float bottom = -halfHeight + (offsetY * halfHeight * 2f);
            float top = halfHeight + (offsetY * halfHeight * 2f);

            // 创建off-center投影矩阵
            Matrix4x4 matrix = new Matrix4x4();

            matrix[0, 0] = 2f * near / (right - left);
            matrix[0, 1] = 0f;
            matrix[0, 2] = (right + left) / (right - left);
            matrix[0, 3] = 0f;

            matrix[1, 0] = 0f;
            matrix[1, 1] = 2f * near / (top - bottom);
            matrix[1, 2] = (top + bottom) / (top - bottom);
            matrix[1, 3] = 0f;

            matrix[2, 0] = 0f;
            matrix[2, 1] = 0f;
            matrix[2, 2] = -(far + near) / (far - near);
            matrix[2, 3] = -(2f * far * near) / (far - near);

            matrix[3, 0] = 0f;
            matrix[3, 1] = 0f;
            matrix[3, 2] = -1f;
            matrix[3, 3] = 0f;

            return matrix;
        }

        #endregion
    }
}
```

---

### 2.5 OrbitFollowModuleComponent 增强

**修改现有文件**: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Components/Modules/OrbitFollowModuleComponent.cs`

**增强内容**:
- 添加 `CenterOffset` 属性支持
- 从 OrbitInputModuleComponent 读取 Distance
- 支持 AutoFit 模块的输出

```csharp
// 在现有 OrbitFollowModuleComponent 中增加以下内容

#region 新增字段

[Header("中心偏移")]
[SerializeField]
[Tooltip("是否使用外部中心偏移")]
private bool m_useCenterOffset = false;

// 运行时状态
private Vector3 m_centerOffset;
private OrbitInputModuleComponent m_inputModule;
private OrbitAutoFitModuleComponent m_autoFitModule;

#endregion

#region 新增属性

/// <summary>
/// 中心偏移（由 AutoFit 模块设置）
/// </summary>
public Vector3 CenterOffset
{
    get => m_centerOffset;
    set => m_centerOffset = value;
}

#endregion

#region 修改 Execute 方法

public override void Execute(ref CameraState state, in CameraModuleContext context)
{
    if (context.TargetProviderProvider == null || !context.TargetProviderProvider.IsActive())
    {
        return;
    }

    // 获取目标位置
    Vector3 targetPosition = context.TargetProviderProvider.PositionGet();

    // 应用中心偏移
    if (m_useCenterOffset && m_autoFitModule != null)
    {
        targetPosition += m_autoFitModule.CenterOffset;
    }

    // 从 InputModule 获取距离（如果存在）
    float effectiveDistance = m_distance;
    if (m_inputModule != null)
    {
        effectiveDistance = m_inputModule.CurrentDistance;
    }

    // 使用当前旋转计算轨道位置
    Quaternion rotation = state.RawRotation;
    Vector3 direction = rotation * Vector3.back;

    // 计算期望距离
    float desiredDistance = effectiveDistance;

    // 碰撞检测
    if (m_enableCollision)
    {
        desiredDistance = CalculateCollisionDistance(targetPosition, direction, effectiveDistance);
    }

    // 计算目标相机位置
    Vector3 pivotPosition = targetPosition + Vector3.up * m_heightOffset;
    Vector3 targetCameraPosition = pivotPosition + direction * desiredDistance;

    // 应用平滑
    if (m_enableSmoothing && m_isInitialized)
    {
        m_currentPosition = Vector3.SmoothDamp(
            m_currentPosition,
            targetCameraPosition,
            ref m_velocityRef,
            m_smoothTime,
            m_maxSpeed,
            context.m_deltaTime
        );
    }
    else
    {
        m_currentPosition = targetCameraPosition;
        m_isInitialized = true;
    }

    m_currentDistance = desiredDistance;
    state.RawPosition = m_currentPosition;
}

protected override void OnInitializeInternal()
{
    base.OnInitializeInternal();

    // 获取兄弟模块引用
    var parent = transform.parent;
    if (parent != null)
    {
        m_inputModule = parent.GetComponentInChildren<OrbitInputModuleComponent>();
        m_autoFitModule = parent.GetComponentInChildren<OrbitAutoFitModuleComponent>();
    }
}

#endregion
```

---

## 3. Prefab 结构配置

### 3.1 节点层级

```
CameraModes_V2 (Prefab Root)
├── ... (其他模式)
└── OrbitViewMode (OrbitViewModeComponent)
    └── MainVC (VisualCameraComponent)
        ├── OrbitAutoFit (OrbitAutoFitModuleComponent)
        │   └── Stage: Body, Order: 0
        ├── OrbitFollow (OrbitFollowModuleComponent)
        │   └── Stage: Body, Order: 10
        ├── OrbitInput (OrbitInputModuleComponent)
        │   └── Stage: Aim, Order: 0
        └── Composition (CompositionModuleComponent)
            └── Stage: Finalize, Order: 0
```

### 3.2 模块执行顺序

| 顺序 | Stage | Order | Module | 职责 |
|-----|-------|-------|--------|------|
| 1 | Body | 0 | OrbitAutoFitModule | 计算最佳距离和中心偏移 |
| 2 | Body | 10 | OrbitFollowModule | 计算相机位置 |
| 3 | Aim | 0 | OrbitInputModule | 处理输入，计算旋转 |
| 4 | Finalize | 0 | CompositionModule | 应用构图投影矩阵 |

---

## 4. 功能还原检查表

### 4.1 基础控制
- [ ] 鼠标/触屏旋转敏感度一致
- [ ] 阻尼/平滑效果一致
- [ ] 惯性效果一致

### 4.2 缩放控制
- [ ] 滚轮缩放响应正确
- [ ] 距离范围 `GetDistanceRange` 生效
- [ ] 缩放敏感度一致

### 4.3 AutoFit
- [ ] 切换目标时自动适配距离
- [ ] 包围盒模式 (Bounds) 计算准确
- [ ] 胶囊体模式 (Capsule) 计算准确
- [ ] 屏占比模式 (ScreenRatio) 计算准确
- [ ] `TargetInFrameRatio` 参数调节生效

### 4.4 Orbit Center
- [ ] `AdjustOrbitCenterToBoundsCenter` 功能正常
- [ ] 相机旋转中心位于物体几何中心

### 4.5 Composition
- [ ] 开启构图模式后投影矩阵正确
- [ ] 目标按预期偏移（如黄金分割点）
- [ ] 引导框尺寸调节生效

### 4.6 初始状态
- [ ] `SetInitialState` 接口正常
- [ ] `ResetCamera` 重置正确

### 4.7 Gizmos 调试
- [ ] 绘制环绕中心点
- [ ] 绘制环绕球体和轨道
- [ ] 绘制目标包围盒
- [ ] 绘制构图引导框

---

## 5. 迁移实施步骤

### Phase 1: 创建基础脚本
1. 创建 `OrbitViewModeComponent.cs`
2. 创建 `OrbitInputModuleComponent.cs`
3. 创建 `OrbitAutoFitModuleComponent.cs`
4. 创建 `CompositionModuleComponent.cs`

### Phase 2: 增强现有模块
1. 修改 `OrbitFollowModuleComponent.cs` 添加 CenterOffset 支持

### Phase 3: Prefab 组装
1. 在 `CameraModes_V2` Prefab 中创建 OrbitViewMode 节点
2. 添加 VisualCameraComponent
3. 添加各模块组件
4. 配置默认参数

### Phase 4: 接口对接
1. 在 `CameraControllerV2` 中注册新模式
2. 修改业务层调用代码

### Phase 5: 验证测试
1. 逐项验证功能还原检查表
2. 性能对比测试
3. 边界条件测试

---

## 6. 兼容性说明

### 6.1 保留的原有接口

| 接口 | 迁移后位置 | 调用方式 |
|-----|----------|---------|
| `SetOrbitTarget()` | `OrbitViewModeComponent` | 直接调用 |
| `ResetCamera()` | `OrbitViewModeComponent` | 直接调用 |
| `SetInitialState()` | `OrbitViewModeComponent` | 直接调用 |
| `HandleZoom()` | `OrbitInputModuleComponent` | 通过 Mode 转发 |
| `TargetInFrameRatioSet()` | `OrbitViewModeComponent` | 直接调用 |

### 6.2 废弃的内部方法

以下方法在迁移后成为各模块的内部实现，不再对外暴露：
- `CalculateTargetBounds()` → `OrbitAutoFitModuleComponent` 内部
- `CalculateTargetCapsule()` → `OrbitAutoFitModuleComponent` 内部
- `AutoFitCamera()` → `OrbitAutoFitModuleComponent.Execute()`
- `ApplyCompositionProjectionMatrix()` → `CompositionModuleComponent.Execute()`

---

## 7. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| 模块间数据依赖复杂 | 执行顺序错误导致结果不一致 | 严格按 Stage/Order 排序，增加单元测试 |
| 浮点精度差异 | 视觉效果微小差异 | 对比测试，调整阈值 |
| 初始化时序问题 | 首帧闪烁或跳变 | 增加 SyncFrom 逻辑 |
| 性能回退 | GC 或计算开销增加 | Profile 对比，优化热点 |

---

## 8. 附录

### 8.1 CameraAutoFitMode 枚举（保持不变）

```csharp
public enum CameraAutoFitMode
{
    None = 0,
    Bounds = 1,
    Capsule = 2,
    ScreenRatio = 3,
}
```

### 8.2 文件清单

| 文件 | 操作 | 说明 |
|-----|------|------|
| `OrbitViewModeComponent.cs` | 新增 | 模式控制器 |
| `OrbitInputModuleComponent.cs` | 新增 | 输入处理模块 |
| `OrbitAutoFitModuleComponent.cs` | 新增 | 自动适配模块 |
| `CompositionModuleComponent.cs` | 新增 | 构图模块 |
| `OrbitFollowModuleComponent.cs` | 修改 | 增强现有模块 |
| `CameraModes_V2.prefab` | 修改 | 添加 OrbitViewMode 节点 |
