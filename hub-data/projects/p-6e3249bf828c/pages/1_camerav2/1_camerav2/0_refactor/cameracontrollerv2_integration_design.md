# CameraControllerV2 集成与接口统一方案

## 版本信息
| 项目 | 值 |
|------|-----|
| **版本** | v1.1 |
| **日期** | 2026-01-29 |
| **状态** | 待审核 |

---

## 1. 问题背景

### 1.1 当前状态
- **StageActorViewUIController** 使用旧版 `CameraController`
- **派生类**（如 FishmanStageActorViewUIController）依赖旧版接口
- **CameraControllerV2** 已实现组件化架构，但接口与旧版不统一
- **相机 Prefab** 已替换为使用 OrbitViewMode，但未正确对准目标

### 1.2 核心问题

1. **接口不统一**: 旧版接口（`FollowActorBind`, `SetCameraTarget`）与新版接口不一致
2. **兼容性需求**: 派生类需要继续使用旧版 CameraController
3. **Provider 职责不清**: 胶囊体/包围盒计算逻辑在相机模块中，应由 Provider 提供
4. **业务耦合**: 接口名称如 `FollowActorBind` 包含业务语义（Actor）

---

## 2. 统一接口设计

### 2.1 设计原则

1. **业务无关**: 接口使用通用术语，不绑定特定业务概念（Actor/Tackle/Slot/Orbit/Focus）
2. **职责分离**: Provider 负责提供数据，相机模块只负责消费数据
3. **配置分离**: 模式相关参数（如 AutoFitMode、AdjustOrbitCenter）在 Prefab 中配置，运行时可修改
4. **统一目标概念**: 所有模式使用统一的 Target 概念，不同模式对 Target 有不同解释
5. **向后兼容**: 保持旧接口可用，内部转发到新接口

### 2.2 核心设计理念

```
Target（目标）是相机系统的核心概念：
├── FPS/TPS 模式: Target = 跟随目标
├── Orbit 模式: Target = 环绕目标
└── 所有模式: 相机围绕 Target + Offset 进行观察

观察位置 = Target.Position + TargetOffset（默认 Vector3.zero）
```

### 2.3 统一相机控制接口 (ICameraControllerV2)

```csharp
namespace BlackJack.ProjectEF.Runtime.CameraController
{
    /// <summary>
    /// 相机控制器 V2 接口
    /// 定义与业务无关的相机控制操作
    /// </summary>
    public interface ICameraControllerV2
    {
        #region 目标管理

        /// <summary>
        /// 设置相机目标
        /// 不同模式对目标的解释不同：FPS/TPS=跟随目标，Orbit=环绕目标
        /// </summary>
        /// <param name="target">目标提供者</param>
        void TargetSet(ITargetProvider target);

        /// <summary>
        /// 清除相机目标
        /// </summary>
        void TargetClear();

        /// <summary>
        /// 获取当前目标
        /// </summary>
        ITargetProvider TargetGet();

        /// <summary>
        /// 检查是否为当前目标
        /// </summary>
        bool IsCurrentTarget(ITargetProvider target);

        /// <summary>
        /// 设置目标偏移（相对于目标位置）
        /// 用于调整相机实际观察的中心点
        /// </summary>
        /// <param name="offset">相对偏移量，默认为 (0,0,0)</param>
        void TargetOffsetSet(Vector3 offset);

        /// <summary>
        /// 获取当前目标偏移
        /// </summary>
        Vector3 TargetOffsetGet();

        /// <summary>
        /// 重置目标偏移为零
        /// </summary>
        void TargetOffsetReset();

        #endregion

        #region 模式控制

        /// <summary>
        /// 切换相机模式
        /// </summary>
        /// <param name="modeType">目标模式类型</param>
        /// <returns>是否切换成功</returns>
        bool ModeSwitch(CameraModeType modeType);

        /// <summary>
        /// 获取当前模式类型
        /// </summary>
        CameraModeType CurrentModeTypeGet();

        /// <summary>
        /// 获取当前模式组件
        /// </summary>
        CameraModeComponent CurrentModeGet();

        /// <summary>
        /// 获取指定类型的模式组件
        /// </summary>
        T ModeGet<T>() where T : CameraModeComponent;

        #endregion

        #region 基础操作

        /// <summary>
        /// 重置相机到初始状态
        /// </summary>
        void Reset();

        /// <summary>
        /// 缩放操作
        /// </summary>
        /// <param name="delta">缩放增量（正=拉近，负=拉远）</param>
        void Zoom(float delta);

        /// <summary>
        /// 旋转操作
        /// </summary>
        /// <param name="delta">旋转增量 (x=yaw, y=pitch)</param>
        void Rotate(Vector2 delta);

        /// <summary>
        /// 设置初始状态
        /// </summary>
        /// <param name="rotation">初始旋转（可选）</param>
        /// <param name="distance">初始距离（可选）</param>
        void InitialStateSet(Vector3? rotation, float? distance);

        #endregion

        #region 事件

        /// <summary>
        /// 目标变更事件
        /// </summary>
        event System.Action<ITargetProvider, ITargetProvider> OnTargetChanged;

        /// <summary>
        /// 模式切换事件
        /// </summary>
        event System.Action<CameraModeComponent, CameraModeComponent> OnModeChanged;

        #endregion
    }
}
```

### 2.4 模式参数配置（Prefab 序列化）

模式相关的参数应该在 Prefab 的 Mode 组件上配置，而不是通过接口传递：

```csharp
/// <summary>
/// OrbitViewModeComponent 的 Prefab 可配置参数
/// </summary>
[AddComponentMenu("Camera/Modes/OrbitView Mode")]
public class OrbitViewModeComponent : CameraModeComponent
{
    [Header("自动适配配置")]
    [SerializeField]
    [Tooltip("默认自动适配模式")]
    private CameraAutoFitMode m_defaultAutoFitMode = CameraAutoFitMode.Bounds;

    [SerializeField]
    [Tooltip("是否将观察中心调整到目标几何中心")]
    private bool m_adjustCenterToGeometry = true;

    [SerializeField]
    [Tooltip("目标占屏幕比例（ScreenRatio 模式使用）")]
    [Range(0.1f, 1.0f)]
    private float m_targetScreenRatio = 0.5f;

    // 运行时可修改的属性
    public CameraAutoFitMode AutoFitMode
    {
        get => m_defaultAutoFitMode;
        set => m_defaultAutoFitMode = value;
    }

    public bool AdjustCenterToGeometry
    {
        get => m_adjustCenterToGeometry;
        set => m_adjustCenterToGeometry = value;
    }

    public float TargetScreenRatio
    {
        get => m_targetScreenRatio;
        set => m_targetScreenRatio = Mathf.Clamp(value, 0.1f, 1.0f);
    }
}
```

### 2.5 目标偏移机制

**核心思想**: 相机始终以 `Target.Position + TargetOffset` 为观察中心

```csharp
/// <summary>
/// 观察中心计算示例
/// </summary>
public Vector3 GetObservationCenter()
{
    if (m_target == null) return Vector3.zero;

    Vector3 basePosition = m_target.PositionGet();

    // 如果启用了几何中心调整，使用 Provider 提供的观察中心
    if (m_adjustCenterToGeometry)
    {
        basePosition = m_target.ObservationCenterGet();
    }

    // 叠加外部设置的偏移
    return basePosition + m_targetOffset;
}
```

**使用场景**:

| 场景 | TargetOffset 设置 | 说明 |
|-----|------------------|------|
| 正常展示人物 | (0, 0, 0) | 使用 Provider 返回的观察中心 |
| 聚焦人物头部 | (0, 1.5, 0) | 向上偏移 1.5 米 |
| 聚焦人物手部 | (0.5, 0.8, 0) | 向右上偏移 |
| 聚焦道具槽位 | slotPos - target.pos | 计算相对偏移 |

---

## 3. Provider 增强设计

### 3.1 设计目标

将胶囊体、包围盒等几何信息的计算职责从相机模块转移到 Provider，相机模块只需调用 Provider 获取统一的适配参数。

**核心原则**: Provider 自己判断应该提供什么信息（胶囊体 or 包围盒），相机模块不关心具体实现。

### 3.2 增强的 ITargetProvider 接口

```csharp
namespace BlackJack.ProjectEF.Runtime.CameraController
{
    public interface ITargetProvider
    {
        // ... 现有接口保持不变 ...

        #region 增强：观察参数

        /// <summary>
        /// 获取推荐的观察中心点
        /// Provider 根据自身特性（如胶囊体中心、包围盒中心）返回最佳观察点
        /// 相机模块直接使用此点作为基准，无需关心内部实现
        /// </summary>
        /// <returns>推荐的世界空间观察中心</returns>
        Vector3 ObservationCenterGet();

        /// <summary>
        /// 获取推荐的观察尺寸参数
        /// Provider 根据自身特性（胶囊体/包围盒/自定义）返回最佳尺寸信息
        /// 相机模块用于计算适配距离
        /// </summary>
        /// <returns>观察尺寸参数</returns>
        ObservationSizeInfo ObservationSizeGet();

        /// <summary>
        /// 获取当前视角下的投影尺寸
        /// Provider 根据自身几何形状和视角计算投影尺寸
        /// </summary>
        /// <param name="viewRotation">相机朝向</param>
        /// <returns>投影尺寸 (width, height)</returns>
        Vector2 ProjectedSizeGet(Quaternion viewRotation);

        #endregion
    }
}
```

### 3.3 观察尺寸信息结构

```csharp
namespace BlackJack.ProjectEF.Runtime.CameraController
{
    /// <summary>
    /// 观察尺寸信息
    /// 由 Provider 根据自身特性（胶囊体/包围盒/自定义）计算并提供
    /// 相机模块只消费此结构，不关心来源
    /// </summary>
    public struct ObservationSizeInfo
    {
        /// <summary>
        /// 宽度（水平方向尺寸）
        /// </summary>
        public float Width;

        /// <summary>
        /// 高度（垂直方向尺寸）
        /// </summary>
        public float Height;

        /// <summary>
        /// 深度（前后方向尺寸）
        /// </summary>
        public float Depth;

        /// <summary>
        /// 信息是否有效
        /// </summary>
        public bool IsValid;

        public static ObservationSizeInfo Invalid => new ObservationSizeInfo { IsValid = false };

        public static ObservationSizeInfo FromBounds(Bounds bounds)
        {
            return new ObservationSizeInfo
            {
                Width = bounds.size.x,
                Height = bounds.size.y,
                Depth = bounds.size.z,
                IsValid = bounds.size.sqrMagnitude > 0
            };
        }

        public float MaxDimension => Mathf.Max(Width, Height, Depth);
    }
}
```

### 3.4 TargetProviderAdapter 增强

Provider 内部自动检测并选择最佳几何信息源：

```csharp
namespace BlackJack.ProjectEF.Runtime.CameraController
{
    /// <summary>
    /// 目标提供者适配器（增强版）
    /// 将 ICameraFollowTarget 适配为 ITargetProvider
    /// 内部处理胶囊体/包围盒的自动检测和计算
    /// </summary>
    public class TargetProviderAdapter : ITargetProvider
    {
        private readonly ICameraFollowTarget m_target;

        // 缓存的几何信息
        private CapsuleCollider m_cachedCapsule;
        private bool m_hasCapsule;
        private bool m_geometryCached;

        public TargetProviderAdapter(ICameraFollowTarget target)
        {
            m_target = target;
        }

        /// <summary>
        /// 获取推荐的观察中心点
        /// 自动优先使用胶囊体中心，否则使用包围盒中心
        /// </summary>
        public Vector3 ObservationCenterGet()
        {
            EnsureGeometryCached();

            // 优先级: 胶囊体中心 > 包围盒中心 > 基础位置
            if (m_hasCapsule && m_cachedCapsule != null)
            {
                return m_cachedCapsule.transform.TransformPoint(m_cachedCapsule.center);
            }

            var bounds = WorldBoundsGet();
            if (bounds.size.sqrMagnitude > 0)
            {
                return bounds.center;
            }

            return PositionGet();
        }

        /// <summary>
        /// 获取推荐的观察尺寸参数
        /// 自动优先使用胶囊体尺寸，否则使用包围盒尺寸
        /// </summary>
        public ObservationSizeInfo ObservationSizeGet()
        {
            EnsureGeometryCached();

            // 优先级: 胶囊体尺寸 > 包围盒尺寸
            if (m_hasCapsule && m_cachedCapsule != null)
            {
                return CalculateCapsuleSize();
            }

            var bounds = WorldBoundsGet();
            return ObservationSizeInfo.FromBounds(bounds);
        }

        /// <summary>
        /// 获取当前视角下的投影尺寸
        /// </summary>
        public Vector2 ProjectedSizeGet(Quaternion viewRotation)
        {
            var sizeInfo = ObservationSizeGet();
            if (!sizeInfo.IsValid)
            {
                return Vector2.one;
            }

            // 根据视角计算投影尺寸
            Vector3 euler = viewRotation.eulerAngles;
            float pitchRad = euler.x * Mathf.Deg2Rad;

            float projectedHeight = Mathf.Abs(Mathf.Cos(pitchRad)) * sizeInfo.Height +
                                   Mathf.Abs(Mathf.Sin(pitchRad)) * sizeInfo.Depth;
            float projectedWidth = sizeInfo.Width;

            return new Vector2(projectedWidth, projectedHeight);
        }

        private void EnsureGeometryCached()
        {
            if (m_geometryCached) return;

            var transform = TransformGet();
            if (transform != null)
            {
                m_cachedCapsule = transform.GetComponentInChildren<CapsuleCollider>();
                m_hasCapsule = m_cachedCapsule != null;
            }

            m_geometryCached = true;
        }

        private ObservationSizeInfo CalculateCapsuleSize()
        {
            if (m_cachedCapsule == null)
            {
                return ObservationSizeInfo.Invalid;
            }

            var capsuleTransform = m_cachedCapsule.transform;
            float worldRadius = m_cachedCapsule.radius * Mathf.Max(
                Mathf.Abs(capsuleTransform.lossyScale.x),
                Mathf.Abs(capsuleTransform.lossyScale.z));
            float worldHeight = m_cachedCapsule.height * Mathf.Abs(capsuleTransform.lossyScale.y);

            float width, height;
            switch (m_cachedCapsule.direction)
            {
                case 0: width = worldHeight; height = worldRadius * 2f; break;
                case 2: width = worldRadius * 2f; height = worldHeight; break;
                default: width = worldRadius * 2f; height = worldHeight; break;
            }

            return new ObservationSizeInfo
            {
                Width = width,
                Height = height,
                Depth = width,
                IsValid = true
            };
        }

        /// <summary>
        /// 使几何缓存失效（目标变化时调用）
        /// </summary>
        public void InvalidateGeometryCache()
        {
            m_geometryCached = false;
            m_cachedCapsule = null;
            m_hasCapsule = false;
        }
    }
}
```

---

## 4. StageActorViewUIController 兼容性方案

### 4.1 双控制器模式

```
StageActorViewUIController
├── m_cameraController (旧版 CameraController) - 派生类使用
└── m_cameraControllerV2 (新版 CameraControllerV2) - 基类优先使用
```

### 4.2 实现策略

```csharp
public partial class StageActorViewUIController
{
    #region 相机控制器

    /// <summary>
    /// 旧版相机控制器（供派生类使用）
    /// </summary>
    protected Scene.CameraController m_cameraController;

    /// <summary>
    /// 新版相机控制器（优先使用）
    /// </summary>
    protected CameraController.CameraControllerV2 m_cameraControllerV2;

    /// <summary>
    /// 是否使用 V2 控制器
    /// </summary>
    protected bool m_useV2Controller = false;

    /// <summary>
    /// 当前目标 Provider（V2 使用）
    /// </summary>
    private ITargetProvider m_currentTargetProvider;

    #endregion

    #region 初始化

    protected override void OnBindFiledsCompleted()
    {
        base.OnBindFiledsCompleted();

        if (m_camera != null)
        {
            // 检测是否已有 CameraControllerV2
            m_cameraControllerV2 = m_camera.GetComponent<CameraControllerV2>();

            if (m_cameraControllerV2 != null)
            {
                m_useV2Controller = true;
                Debug.Log("StageActorViewUIController: 使用 CameraControllerV2");
            }
            else
            {
                // 回退到旧版
                m_cameraController = m_camera.gameObject.ComponentGetOrAdd<Scene.CameraController>();
                m_cameraController.SetInitialState(m_camera.transform.rotation.eulerAngles, null);
                m_useV2Controller = false;
                Debug.Log("StageActorViewUIController: 使用旧版 CameraController");
            }
        }

        // ... 其余初始化代码 ...
    }

    #endregion

    #region 统一接口实现

    /// <summary>
    /// 设置相机目标（统一接口）
    /// V2: 使用 TargetSet + ModeSwitch
    /// 旧版: 使用 FollowActorBind + SetCameraTarget
    /// </summary>
    protected void CameraTargetSet(IStageActor stageActor)
    {
        if (m_useV2Controller && m_cameraControllerV2 != null)
        {
            // 创建或更新 Provider
            m_currentTargetProvider = CreateTargetProvider(stageActor);
            m_cameraControllerV2.TargetSet(m_currentTargetProvider);
        }
        else if (m_cameraController != null)
        {
            m_cameraController.FollowActorBind(stageActor);
        }
    }

    /// <summary>
    /// 清除相机目标（统一接口）
    /// </summary>
    protected void CameraTargetClear()
    {
        if (m_useV2Controller && m_cameraControllerV2 != null)
        {
            m_cameraControllerV2.TargetClear();
            m_currentTargetProvider = null;
        }
        else if (m_cameraController != null)
        {
            m_cameraController.FollowActorUnbind();
        }
    }

    /// <summary>
    /// 设置相机目标偏移（统一接口）
    /// 用于聚焦到目标的特定部位
    /// </summary>
    protected void CameraTargetOffsetSet(Vector3 offset)
    {
        if (m_useV2Controller && m_cameraControllerV2 != null)
        {
            m_cameraControllerV2.TargetOffsetSet(offset);
        }
        // 旧版不支持，忽略
    }

    /// <summary>
    /// 设置环绕目标（兼容接口 - 供外部调用）
    /// </summary>
    public void SetOrbitTarget(IStageActor stageActor, CameraAutoFitMode autoFitMode = CameraAutoFitMode.Bounds)
    {
        if (m_useV2Controller && m_cameraControllerV2 != null)
        {
            // V2: 设置目标 + 切换模式
            // AutoFitMode 已在 Prefab 中配置，这里可选择性覆盖
            m_currentTargetProvider = CreateTargetProvider(stageActor);
            m_cameraControllerV2.TargetSet(m_currentTargetProvider);
            m_cameraControllerV2.ModeSwitch(CameraModeType.OrbitView);

            // 如果需要覆盖 AutoFitMode，通过 Mode 属性设置
            var orbitMode = m_cameraControllerV2.ModeGet<OrbitViewModeComponent>();
            if (orbitMode != null)
            {
                orbitMode.AutoFitMode = autoFitMode;
                orbitMode.TriggerAutoFit(); // 触发重新计算
            }
        }
        else if (m_cameraController != null)
        {
            m_cameraController.FollowActorBind(stageActor);
            m_cameraController.SetCameraTarget(stageActor, autoFitMode);
            m_cameraController.SetAdjustOrbitCenter(true);
        }

        m_currentAutoFitMode = autoFitMode;
    }

    /// <summary>
    /// 重置相机（统一接口）
    /// </summary>
    public virtual void CameraReset()
    {
        if (m_useV2Controller && m_cameraControllerV2 != null)
        {
            m_cameraControllerV2.Reset();
        }
        else
        {
            m_cameraController?.CameraReset();
        }
    }

    /// <summary>
    /// 缩放相机（统一接口）
    /// </summary>
    public void CameraZoom(float zoom)
    {
        if (m_useV2Controller && m_cameraControllerV2 != null)
        {
            m_cameraControllerV2.Zoom(zoom);
        }
        else
        {
            m_cameraController?.CameraZoom(zoom);
        }
    }

    /// <summary>
    /// 旋转相机（统一接口）
    /// </summary>
    public void CameraRotate(Vector3 rot)
    {
        if (m_useV2Controller && m_cameraControllerV2 != null)
        {
            m_cameraControllerV2.Rotate(new Vector2(rot.x, rot.y));
        }
        else
        {
            m_cameraController?.CameraRotate(new Vector2(rot.x, rot.y));
        }
    }

    /// <summary>
    /// 创建目标提供者
    /// </summary>
    private ITargetProvider CreateTargetProvider(IStageActor stageActor)
    {
        return new TargetProviderAdapter(stageActor);
    }

    #endregion

    #region 派生类兼容

    /// <summary>
    /// 获取旧版相机控制器（供派生类使用）
    /// </summary>
    protected Scene.CameraController LegacyCameraControllerGet()
    {
        return m_cameraController;
    }

    /// <summary>
    /// 强制使用旧版控制器（派生类调用）
    /// </summary>
    protected void ForceUseLegacyController()
    {
        if (m_cameraController == null && m_camera != null)
        {
            m_cameraController = m_camera.gameObject.ComponentGetOrAdd<Scene.CameraController>();
            m_cameraController.SetInitialState(m_camera.transform.rotation.eulerAngles, null);
        }
        m_useV2Controller = false;
    }

    #endregion
}
```

---

## 5. OrbitAutoFitModule 简化

### 5.1 重构后的 OrbitAutoFitModuleComponent

移除胶囊体/包围盒的判断和计算逻辑，统一使用 Provider 提供的数据：

```csharp
public class OrbitAutoFitModuleComponent : CameraModuleComponent
{
    #region 序列化字段（Prefab 配置）

    [Header("适配参数")]
    [SerializeField]
    [Tooltip("适配填充系数（数值越大，目标在屏幕上越小）")]
    private float m_fitPadding = 1.2f;

    [SerializeField]
    [Tooltip("目标占构图框比例（ScreenRatio 模式使用）")]
    [Range(0.01f, 1.0f)]
    private float m_targetInFrameRatio = 0.5f;

    [Header("距离限制")]
    [SerializeField] private float m_minDistance = 0.5f;
    [SerializeField] private float m_maxDistance = 20f;

    #endregion

    #region 运行时状态

    private bool m_triggerAutoFit;
    private Vector3 m_centerOffset;
    private float m_optimalDistance;
    private OrbitInputModuleComponent m_inputModule;

    #endregion

    public override void Execute(ref CameraState state, in CameraModuleContext context)
    {
        if (!m_triggerAutoFit) return;
        if (context.m_targetProvider == null || !context.m_targetProvider.IsActive()) return;

        // 直接从 Provider 获取观察中心（Provider 内部决定使用胶囊还是包围盒）
        Vector3 observationCenter = context.m_targetProvider.ObservationCenterGet();
        m_centerOffset = observationCenter - context.m_targetProvider.PositionGet();

        // 使用 Provider 提供的投影尺寸计算距离
        m_optimalDistance = CalculateDistanceFromProvider(context, state.RawRotation);

        // 应用结果到兄弟模块
        if (m_inputModule != null)
        {
            m_inputModule.SetTargetDistance(m_optimalDistance);
        }

        m_triggerAutoFit = false;
    }

    /// <summary>
    /// 使用 Provider 提供的尺寸计算距离
    /// 相机模块不关心 Provider 内部是用胶囊体还是包围盒计算的
    /// </summary>
    private float CalculateDistanceFromProvider(in CameraModuleContext context, Quaternion viewRotation)
    {
        if (context.m_mainCamera == null) return m_minDistance;

        // 从 Provider 获取投影尺寸（Provider 自己决定用什么方式计算）
        Vector2 projectedSize = context.m_targetProvider.ProjectedSizeGet(viewRotation);

        if (projectedSize.sqrMagnitude < 0.001f)
        {
            return m_minDistance;
        }

        // 计算距离
        float vFov = context.m_mainCamera.fieldOfView * Mathf.Deg2Rad;
        float distanceV = (projectedSize.y * 0.5f) / Mathf.Tan(vFov * 0.5f);

        float hFov = 2f * Mathf.Atan(Mathf.Tan(vFov * 0.5f) * context.m_mainCamera.aspect);
        float distanceH = (projectedSize.x * 0.5f) / Mathf.Tan(hFov * 0.5f);

        float finalDistance = Mathf.Max(distanceV, distanceH) * m_fitPadding;
        return Mathf.Clamp(finalDistance, m_minDistance, m_maxDistance);
    }

    /// <summary>
    /// 触发自动适配计算
    /// </summary>
    public void TriggerAutoFit()
    {
        m_triggerAutoFit = true;
    }
}
```

### 5.2 移除的代码

从 OrbitAutoFitModuleComponent 中移除以下内容：
- `CalculateTargetBounds()` 方法
- `CalculateTargetCapsule()` 方法
- `CapsuleInfo` 结构
- `m_targetBounds`, `m_targetCapsuleInfo` 字段
- `CameraAutoFitMode` 的 Bounds/Capsule 分支判断

这些职责已转移到 `TargetProviderAdapter`。

---

## 6. 实施计划

### Phase 1: 接口定义（优先级：高）
1. 创建 `ICameraControllerV2.cs` 接口
2. 创建 `ObservationSizeInfo.cs` 结构

### Phase 2: Provider 增强（优先级：高）
1. 扩展 `ITargetProvider` 接口（增加 ObservationCenterGet, ObservationSizeGet, ProjectedSizeGet）
2. 更新 `TargetProviderAdapter` 实现
3. 简化 `OrbitAutoFitModuleComponent`，移除胶囊体/包围盒计算逻辑

### Phase 3: CameraControllerV2 实现接口（优先级：高）
1. 实现 `ICameraControllerV2` 接口
2. 添加 `TargetOffset` 机制
3. 更新 `OrbitViewModeComponent` 属性暴露

### Phase 4: StageActorViewUIController 集成（优先级：中）
1. 添加双控制器支持
2. 实现统一接口转发
3. 添加派生类兼容方法

### Phase 5: 验证测试（优先级：高）
1. 验证新版控制器功能
2. 验证派生类旧版控制器兼容性
3. 验证目标偏移功能
4. 性能对比测试

---

## 7. 接口映射表

### 7.1 旧接口到新接口映射

| 旧接口 (CameraController) | 新接口 (ICameraControllerV2) | 说明 |
|--------------------------|------------------------------|------|
| `FollowActorBind(actor)` | `TargetSet(provider)` | 统一为 Target 概念 |
| `FollowActorUnbind()` | `TargetClear()` | 统一为 Target 概念 |
| `SetCameraTarget(actor, mode)` | `TargetSet(provider)` + `ModeSwitch()` | 分离目标设置和模式切换 |
| `SetAdjustOrbitCenter(bool)` | `Mode.AdjustCenterToGeometry` | 移至 Mode 属性 |
| `CameraReset()` | `Reset()` | 简化命名 |
| `CameraZoom(delta)` | `Zoom(delta)` | 简化命名 |
| `CameraRotate(delta)` | `Rotate(delta)` | 简化命名 |
| `FocusOnSlot(pos)` | `TargetOffsetSet(offset)` | 改为相对偏移 |
| `SetInitialState(rot, dist)` | `InitialStateSet(rot, dist)` | 保持功能 |

### 7.2 CameraAutoFitMode 处理

| CameraAutoFitMode (旧) | 新方案 | 说明 |
|------------------------|--------|------|
| `None` | Prefab 配置 | 默认值在 Prefab 中设置 |
| `Bounds` | Provider 自动选择 | Provider 返回最佳尺寸 |
| `Capsule` | Provider 自动选择 | Provider 优先使用胶囊体 |
| `ScreenRatio` | Prefab 配置 + 运行时属性 | `TargetScreenRatio` 属性 |

**说明**: `CameraAutoFitMode` 枚举仍可保留用于兼容，但内部实现统一由 Provider 提供几何信息。

---

## 8. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| 派生类依赖旧接口 | 功能中断 | 提供 `ForceUseLegacyController()` 方法 |
| Provider 接口不完整 | 适配失败 | 提供默认实现和回退逻辑 |
| 双控制器性能开销 | 内存增加 | 延迟初始化，按需创建 |
| 接口语义变化 | 调用方困惑 | 提供详细文档和映射表 |
| Provider 几何缓存失效 | 目标变化后适配不准 | 提供 `InvalidateGeometryCache()` 方法 |

---

## 9. 待确认事项

1. **CameraAutoFitMode 枚举是否保留**: 保留用于兼容旧接口，还是完全移除？
2. **Provider 的几何缓存策略**: 每帧更新 vs 按需更新 vs 目标变化时更新？
3. **旧版 CameraController 的移除时间点**: 所有派生类迁移完成后移除？
4. **TargetOffset 的应用层级**: 在 CameraControllerV2 层面还是 Mode 层面处理？

---

## 附录 A: 文件清单

| 文件 | 操作 | 说明 |
|-----|------|------|
| `ICameraControllerV2.cs` | 新增 | 统一接口定义 |
| `ObservationSizeInfo.cs` | 新增 | 观察尺寸结构 |
| `ITargetProvider.cs` | 修改 | 增加 ObservationCenterGet, ObservationSizeGet, ProjectedSizeGet |
| `TargetProviderAdapter.cs` | 修改 | 实现新接口，内部处理胶囊体/包围盒检测 |
| `OrbitAutoFitModuleComponent.cs` | 修改 | 简化，移除胶囊体/包围盒计算 |
| `OrbitViewModeComponent.cs` | 修改 | 暴露 AutoFitMode, AdjustCenterToGeometry 等属性 |
| `CameraControllerV2.cs` | 修改 | 实现 ICameraControllerV2 接口，添加 TargetOffset 机制 |
| `StageActorViewUIController.cs` | 修改 | 添加双控制器支持和统一接口转发 |

---

## 附录 B: 调用示例

### B.1 基本使用

```csharp
// 设置相机目标
var provider = new TargetProviderAdapter(stageActor);
cameraControllerV2.TargetSet(provider);

// 切换到环绕观察模式
cameraControllerV2.ModeSwitch(CameraModeType.OrbitView);

// 旋转和缩放
cameraControllerV2.Rotate(new Vector2(10f, 5f));
cameraControllerV2.Zoom(0.5f);

// 重置
cameraControllerV2.Reset();
```

### B.2 聚焦到特定位置（使用偏移）

```csharp
// 聚焦到人物头部（假设头部在目标位置上方 1.5 米）
cameraControllerV2.TargetOffsetSet(new Vector3(0, 1.5f, 0));

// 聚焦到道具槽位
Vector3 slotWorldPos = ...;
Vector3 targetPos = cameraControllerV2.TargetGet().PositionGet();
Vector3 offset = slotWorldPos - targetPos;
cameraControllerV2.TargetOffsetSet(offset);

// 恢复默认（观察目标中心）
cameraControllerV2.TargetOffsetReset();
```

### B.3 运行时修改模式参数

```csharp
// 获取 OrbitView 模式
var orbitMode = cameraControllerV2.ModeGet<OrbitViewModeComponent>();

// 修改适配参数
orbitMode.AutoFitMode = CameraAutoFitMode.ScreenRatio;
orbitMode.TargetScreenRatio = 0.6f;
orbitMode.AdjustCenterToGeometry = true;

// 触发重新适配
orbitMode.TriggerAutoFit();
```

### B.4 StageActorViewUIController 中的使用

```csharp
public bool StageActorDisplay(IStageActor stageActor)
{
    // ...

    // 使用统一接口设置目标
    CameraTargetSet(stageActor);

    // 如果是 V2 控制器，切换到 OrbitView 模式
    if (m_useV2Controller)
    {
        m_cameraControllerV2.ModeSwitch(CameraModeType.OrbitView);
    }
    else
    {
        // 旧版接口
        SetOrbitTarget(stageActor, m_currentAutoFitMode);
    }

    // ...
}
```
