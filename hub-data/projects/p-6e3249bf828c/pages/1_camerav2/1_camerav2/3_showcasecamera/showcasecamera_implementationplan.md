# ShowcaseCamera Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-slot showcase camera system where each camera position is a VisualCamera child node, editable via Transform in the editor with Gizmo visualization.

**Architecture:** New CameraMode (`ShowcaseModeComponent`) containing multiple `VisualCameraComponent` children, each with a `DirectPoseModuleComponent` (reads Transform) and optional `ShowcaseAutoFitModuleComponent` (adjusts distance by target size). Editor tools provide Gizmo visualization and Inspector controls. Zero modifications to existing files.

**Tech Stack:** Unity 2022.3.51f1, C#, BJFramework CameraControllerV2, Custom Editor (Handles, Gizmos, CustomEditor)

**Spec:** `Assets/Doc/10_Projects/Camera/1_CameraV2/3_ShowcaseCamera/ShowcaseCamera_Design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `Assets/GameProject/Scripts/Runtime/GameView/Camera/Components/Modules/DirectPoseModuleComponent.cs` | Create | Read VC Transform → CameraState |
| `Assets/GameProject/Scripts/Runtime/GameView/Camera/Components/Modules/ShowcaseAutoFitModuleComponent.cs` | Create | Distance auto-fit by target size |
| `Assets/GameProject/Scripts/Runtime/GameView/Camera/Components/Modes/ShowcaseModeComponent.cs` | Create | Mode: VC collection, slot switching, lifecycle |
| `Assets/GameProject/Scripts/Editor/Camera/ShowcaseModeEditor.cs` | Create | Custom Inspector for ShowcaseModeComponent |
| `Assets/GameProject/Scripts/Editor/Camera/ShowcaseVCGizmoDrawer.cs` | Create | Scene View capsule + FOV cone Gizmos |
| `Assets/GameProject/Scripts/Editor/Camera/ShowcasePrefabCreator.cs` | Create | Menu tool to create Prefab structure |

---

## Task 1: DirectPoseModuleComponent

**Files:**
- Create: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Components/Modules/DirectPoseModuleComponent.cs`

- [ ] **Step 1: Create DirectPoseModuleComponent**

```csharp
using UnityEngine;
using BlackJack.ProjectEF.Runtime.CameraController;

namespace BlackJack.ProjectEF.Runtime.Scene
{
    /// <summary>
    /// 直接位姿模块 - 将所属 VisualCamera 的 Transform 直接输出为 CameraState
    /// 用于 ShowcaseMode，每个 VC 的 Transform 即相机机位
    /// </summary>
    /// <remarks>
    /// 零序列化参数，所有信息来自 VC 节点的 Transform。
    /// Stage: Body, Order: 0
    /// </remarks>
    [AddComponentMenu("Camera/Modules/Direct Pose")]
    public class DirectPoseModuleComponent : CameraModuleComponent
    {
        #region 公共成员方法

        #region ICameraModule 实现

        public override string ModuleName => "DirectPose";

        public override void Execute(ref CameraState state, in CameraModuleContext context)
        {
            if (!IsEnabled || m_vcTransform == null)
            {
                return;
            }

            state.RawPosition = m_vcTransform.position;
            state.RawRotation = m_vcTransform.rotation;
        }

        #endregion

        #endregion

        #region 非公共方法

        #region 受保护的虚方法

        protected override void OnInitializeInternal()
        {
            // 通过 GetComponentInParent 获取 VC Transform
            // 比 transform.parent 更健壮，即使 Module 不是 VC 的直接子节点也能正确工作
            var vc = GetComponentInParent<VisualCameraComponent>();
            m_vcTransform = vc != null ? vc.transform : transform.parent;
        }

        #endregion

        #endregion

        #region 数据成员

        #region 内部成员

        /// <summary>
        /// 缓存所属 VC 的 Transform
        /// </summary>
        private Transform m_vcTransform;

        #endregion

        #endregion
    }
}
```

- [ ] **Step 2: Verify compilation**

Open Unity Editor, check Console for compile errors in `DirectPoseModuleComponent.cs`.
Expected: No errors. Class inherits from `CameraModuleComponent`, implements abstract `Execute` and `ModuleName`.

- [ ] **Step 3: Commit**

```bash
git add "Assets/GameProject/Scripts/Runtime/GameView/Camera/Components/Modules/DirectPoseModuleComponent.cs"
git commit -m "feat(camera): add DirectPoseModuleComponent for showcase camera"
```

---

## Task 2: ShowcaseAutoFitModuleComponent

**Files:**
- Create: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Components/Modules/ShowcaseAutoFitModuleComponent.cs`

- [ ] **Step 1: Create ShowcaseAutoFitModuleComponent**

```csharp
using UnityEngine;
using BlackJack.ProjectEF.Runtime.CameraController;

namespace BlackJack.ProjectEF.Runtime.Scene
{
    /// <summary>
    /// 展示相机自动适配模块 - 根据目标物体尺寸沿相机朝向调整距离（方向不变）
    /// </summary>
    /// <remarks>
    /// 在 DirectPoseModule 之后执行（Body, Order: 10）。
    /// 保持 state.RawRotation 不变，仅沿 -forward 方向调整 state.RawPosition。
    ///
    /// 算法：
    /// 1. 从 ITargetProvider 获取目标投影尺寸
    /// 2. 根据 FOV 和投影尺寸计算最优观察距离
    /// 3. 从目标中心沿 -forward 方向偏移 optimalDistance 得到新位置
    /// </remarks>
    [AddComponentMenu("Camera/Modules/Showcase AutoFit")]
    public class ShowcaseAutoFitModuleComponent : CameraModuleComponent
    {
        #region 公共成员方法

        #region ICameraModule 实现

        public override string ModuleName => "ShowcaseAutoFit";

        public override void Execute(ref CameraState state, in CameraModuleContext context)
        {
            if (!IsEnabled || !m_enableAutoFit)
            {
                return;
            }

            var target = context.TargetGet(0);
            if (target == null || !target.IsActive())
            {
                return;
            }

            // 1. 获取目标投影尺寸
            Vector2 projectedSize = target.ProjectedSizeGet(state.RawRotation);
            if (projectedSize.x <= 0f || projectedSize.y <= 0f)
            {
                return;
            }

            // 2. 根据 FOV 计算最优距离
            float fov = state.FieldOfView;
            if (fov <= 0f && context.m_mainCamera != null)
            {
                fov = context.m_mainCamera.fieldOfView;
            }
            if (fov <= 0f)
            {
                return;
            }

            float vFOV = fov * Mathf.Deg2Rad;
            float aspect = context.m_mainCamera != null ? context.m_mainCamera.aspect : 16f / 9f;
            float hFOV = 2f * Mathf.Atan(Mathf.Tan(vFOV * 0.5f) * aspect);

            float distV = (projectedSize.y * 0.5f) / Mathf.Tan(vFOV * 0.5f);
            float distH = (projectedSize.x * 0.5f) / Mathf.Tan(hFOV * 0.5f);
            float optimalDist = Mathf.Max(distV, distH) * m_fitPadding;
            optimalDist = Mathf.Clamp(optimalDist, m_minDistance, m_maxDistance);

            // 3. 沿朝向调整位置（方向不变）
            Vector3 forward = state.RawRotation * Vector3.forward;
            Vector3 targetCenter = target.ObservationCenterGet();
            state.RawPosition = targetCenter - forward * optimalDist;
        }

        #endregion

        #endregion

        #region 数据成员

        #region 内部成员

        #region 序列化字段

        [Header("自动适配")]
        [SerializeField]
        [Tooltip("是否启用自动适配")]
        private bool m_enableAutoFit = true;

        [SerializeField]
        [Tooltip("留白系数（1.0 = 刚好填满，1.2 = 留 20% 边距）")]
        [Range(1f, 3f)]
        private float m_fitPadding = 1.2f;

        [SerializeField]
        [Tooltip("最小距离")]
        [Min(0.1f)]
        private float m_minDistance = 0.5f;

        [SerializeField]
        [Tooltip("最大距离")]
        private float m_maxDistance = 20f;

        #endregion

        #endregion

        #endregion
    }
}
```

- [ ] **Step 2: Verify compilation**

Open Unity Editor, check Console for compile errors.
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "Assets/GameProject/Scripts/Runtime/GameView/Camera/Components/Modules/ShowcaseAutoFitModuleComponent.cs"
git commit -m "feat(camera): add ShowcaseAutoFitModuleComponent for distance auto-fit"
```

---

## Task 3: ShowcaseModeComponent

**Files:**
- Create: `Assets/GameProject/Scripts/Runtime/GameView/Camera/Components/Modes/ShowcaseModeComponent.cs`

**Reference files (read-only, do not modify):**
- `Assets/GameProject/Scripts/Runtime/GameView/Camera/Components/CameraModeComponent.cs` — base class with exact method signatures
- `Assets/GameProject/Scripts/Runtime/GameView/Camera/Components/VisualCameraComponent.cs` — Activate/Deactivate API

- [ ] **Step 1: Create ShowcaseModeComponent**

```csharp
using System;
using System.Collections.Generic;
using UnityEngine;
using BlackJack.ProjectEF.Runtime.CameraController;

namespace BlackJack.ProjectEF.Runtime.Scene
{
    /// <summary>
    /// 多机位展示相机模式
    /// 每个 VisualCamera 子节点 = 一个相机机位，Transform 即相机位姿
    /// </summary>
    /// <remarks>
    /// Prefab 层级：
    /// ShowcaseModeComponent
    /// ├── FrontFullBody (VisualCameraComponent)
    /// │   ├── DirectPoseModule  [Body, Order: 0]
    /// │   └── AutoFitModule    [Body, Order: 10]
    /// ├── SideHalfBody (VisualCameraComponent)
    /// │   ├── DirectPoseModule  [Body, Order: 0]
    /// │   └── AutoFitModule    [Body, Order: 10]
    /// └── HeadCloseup (VisualCameraComponent)
    ///     ├── DirectPoseModule  [Body, Order: 0]
    ///     └── AutoFitModule    [Body, Order: 10]
    ///
    /// 切换机位时复用 VisualCameraComponent 的 Activate/Deactivate + CameraStateBlender 做平滑过渡。
    /// </remarks>
    [AddComponentMenu("Camera/Modes/Showcase Mode")]
    public class ShowcaseModeComponent : CameraModeComponent
    {
        #region 公共成员方法

        #region 机位切换 API

        /// <summary>
        /// 按索引切换机位
        /// </summary>
        public void SwitchTo(int index)
        {
            if (m_visualCameras == null || m_visualCameras.Count == 0)
            {
                Debug.LogWarning("[ShowcaseMode] 没有可用的机位");
                return;
            }

            if (index < 0 || index >= m_visualCameras.Count)
            {
                Debug.LogWarning($"[ShowcaseMode] 机位索引越界: {index}, 有效范围: 0-{m_visualCameras.Count - 1}");
                return;
            }

            if (index == m_activeIndex)
            {
                return;
            }

            SwitchToInternal(index);
        }

        /// <summary>
        /// 按名称切换机位
        /// </summary>
        public void SwitchTo(string vcName)
        {
            if (m_visualCameras == null)
            {
                return;
            }

            for (int i = 0; i < m_visualCameras.Count; i++)
            {
                if (m_visualCameras[i].Name == vcName)
                {
                    SwitchTo(i);
                    return;
                }
            }

            Debug.LogWarning($"[ShowcaseMode] 未找到名为 '{vcName}' 的机位");
        }

        /// <summary>
        /// 切换到下一个机位
        /// </summary>
        public void Next()
        {
            if (m_visualCameras == null || m_visualCameras.Count <= 1)
            {
                return;
            }

            int nextIndex = (m_activeIndex + 1) % m_visualCameras.Count;
            SwitchTo(nextIndex);
        }

        /// <summary>
        /// 切换到上一个机位
        /// </summary>
        public void Previous()
        {
            if (m_visualCameras == null || m_visualCameras.Count <= 1)
            {
                return;
            }

            int prevIndex = (m_activeIndex - 1 + m_visualCameras.Count) % m_visualCameras.Count;
            SwitchTo(prevIndex);
        }

        #endregion

        #region 相机控制（基类抽象方法实现）

        /// <summary>
        /// 处理旋转输入 — 首版为空实现（无用户环绕交互）
        /// </summary>
        public override void HandleRotation(Vector2 input, float deltaTime)
        {
            // 首版不实现用户环绕交互，预留扩展点
        }

        /// <summary>
        /// 处理位置输入 — 首版为空实现
        /// </summary>
        public override void HandlePosition(Vector3 input, float deltaTime)
        {
            // 首版不实现
        }

        #endregion

        #endregion

        #region 属性

        /// <summary>
        /// 模式名称
        /// </summary>
        public override string ModeName => "Showcase";

        /// <summary>
        /// 当前活跃机位索引
        /// </summary>
        public int ActiveIndex => m_activeIndex;

        /// <summary>
        /// 当前活跃的 VisualCamera
        /// </summary>
        public VisualCameraComponent ActiveVC
        {
            get
            {
                if (m_visualCameras != null && m_activeIndex >= 0 && m_activeIndex < m_visualCameras.Count)
                {
                    return m_visualCameras[m_activeIndex];
                }
                return null;
            }
        }

        /// <summary>
        /// 机位数量
        /// </summary>
        public int VCCount => m_visualCameras?.Count ?? 0;

        #endregion

        #region 事件

        /// <summary>
        /// 机位切换事件 (oldIndex, newIndex)
        /// </summary>
        public event Action<int, int> EventOnVCSwitched;

        #endregion

        #region 非公共方法

        #region 受保护的虚方法

        /// <summary>
        /// 重写 VC 收集，按 Hierarchy 子节点顺序排序
        /// 基类 CollectVisualCameraComponents() 按 Priority 降序排序，
        /// 但 Showcase 模式的索引语义 = Hierarchy 子节点顺序（策划直觉）
        /// </summary>
        protected override void CollectVisualCameraComponents()
        {
            m_visualCameras.Clear();

            // 先添加手动指定的虚拟相机（与基类保持一致）
            foreach (var vc in m_visualCameraComponents)
            {
                if (vc != null && !m_visualCameras.Contains(vc))
                {
                    m_visualCameras.Add(vc);
                }
            }

            // 自动收集子对象上的虚拟相机
            if (m_autoCollectVisualCameras)
            {
                var childVCs = GetComponentsInChildren<VisualCameraComponent>(true);
                foreach (var vc in childVCs)
                {
                    if (!m_visualCameras.Contains(vc))
                    {
                        m_visualCameras.Add(vc);
                    }
                }
            }

            // 按 Hierarchy 子节点顺序排序（而不是 Priority）
            m_visualCameras.Sort((a, b) =>
                a.transform.GetSiblingIndex().CompareTo(b.transform.GetSiblingIndex()));
        }

        protected override void OnEnterInternal()
        {
            // 全部 Deactivate
            foreach (var vc in m_visualCameras)
            {
                vc.IsActive = false;
                vc.SetWeightImmediate(0f);
            }

            // 从参数获取初始机位索引，默认 0
            m_activeIndex = GetParameter("initialIndex", 0);
            if (m_activeIndex < 0 || m_activeIndex >= m_visualCameras.Count)
            {
                m_activeIndex = 0;
            }

            // 激活初始机位（立即，不过渡）
            if (m_visualCameras.Count > 0)
            {
                var activeVC = m_visualCameras[m_activeIndex];
                activeVC.IsActive = true;
                activeVC.SetWeightImmediate(1f);
            }
        }

        protected override void OnExitInternal()
        {
            EventOnVCSwitched = null;
        }

        #endregion

        #region 私有方法

        /// <summary>
        /// 内部机位切换逻辑
        /// </summary>
        private void SwitchToInternal(int newIndex)
        {
            int oldIndex = m_activeIndex;
            var oldVC = m_visualCameras[oldIndex];
            var newVC = m_visualCameras[newIndex];

            // 旧 VC 混合退出
            oldVC.Deactivate(m_defaultBlendDuration);

            // 新 VC 混合进入
            newVC.Activate(m_defaultBlendDuration);

            m_activeIndex = newIndex;
            EventOnVCSwitched?.Invoke(oldIndex, newIndex);
        }

        #endregion

        #endregion

        #region 数据成员

        #region 内部成员

        #region 序列化字段

        [Header("展示相机 - 过渡设置")]
        [SerializeField]
        [Tooltip("机位切换默认过渡时长（秒）")]
        private float m_defaultBlendDuration = 0.5f;

        // 注意：过渡曲线由每个 VisualCameraComponent 自身的 m_blendCurve 控制，
        // 无需在 Mode 层重复定义。如果未来需要 Mode 级统一曲线覆盖，再添加此字段。

        #endregion

        #region 运行时字段

        /// <summary>
        /// 当前活跃机位索引
        /// </summary>
        private int m_activeIndex;

        #endregion

        #endregion

        #endregion
    }
}
```

- [ ] **Step 2: Verify compilation**

Open Unity Editor, check Console for compile errors.
Expected: No errors. Key checks:
- `ModeName` abstract property implemented
- `HandleRotation` / `HandlePosition` abstract methods implemented
- `CollectVisualCameraComponents` override compiles (virtual in base)
- `OnEnterInternal` / `OnExitInternal` overrides compile (virtual in base)
- `GetParameter<T>` accessible (protected in base)

- [ ] **Step 3: Commit**

```bash
git add "Assets/GameProject/Scripts/Runtime/GameView/Camera/Components/Modes/ShowcaseModeComponent.cs"
git commit -m "feat(camera): add ShowcaseModeComponent for multi-slot showcase camera"
```

---

## Task 4: ShowcasePrefabCreator (Editor Tool)

**Files:**
- Create: `Assets/GameProject/Scripts/Editor/Camera/ShowcasePrefabCreator.cs`

**Reference:**
- `Assets/GameProject/Scripts/Editor/Camera/OrbitViewModePrefabCreator.cs` — existing pattern

- [ ] **Step 1: Create ShowcasePrefabCreator**

```csharp
#if UNITY_EDITOR
using UnityEngine;
using UnityEditor;
using BlackJack.ProjectEF.Runtime.Scene;
using BlackJack.ProjectEF.Runtime.CameraController;

namespace BlackJack.ProjectEF.Editor
{
    /// <summary>
    /// Showcase Camera Prefab 创建工具
    /// 一键创建符合架构规范的多机位展示相机 Prefab 节点结构
    /// </summary>
    public static class ShowcasePrefabCreator
    {
        [MenuItem("Tools/Camera/Create Showcase Camera Structure", false, 102)]
        public static void CreateShowcaseCameraStructure()
        {
            GameObject parent = Selection.activeGameObject;

            if (parent == null)
            {
                EditorUtility.DisplayDialog(
                    "创建 Showcase Camera",
                    "请先在 Hierarchy 中选择一个父对象",
                    "确定"
                );
                return;
            }

            // 创建 ShowcaseMode 根节点
            GameObject showcaseMode = new GameObject("ShowcaseMode");
            showcaseMode.transform.SetParent(parent.transform);
            showcaseMode.transform.localPosition = Vector3.zero;
            showcaseMode.transform.localRotation = Quaternion.identity;
            showcaseMode.transform.localScale = Vector3.one;

            showcaseMode.AddComponent<ShowcaseModeComponent>();

            // 创建 3 个默认 VC 机位
            CreateVCSlot(showcaseMode.transform, "FrontFullBody",
                new Vector3(0f, 1.2f, -3f), Quaternion.Euler(5f, 0f, 0f));

            CreateVCSlot(showcaseMode.transform, "SideHalfBody",
                new Vector3(2f, 1.3f, -2f), Quaternion.Euler(8f, -30f, 0f));

            CreateVCSlot(showcaseMode.transform, "HeadCloseup",
                new Vector3(0.3f, 1.6f, -1.2f), Quaternion.Euler(3f, -10f, 0f));

            // 选中根节点
            Selection.activeGameObject = showcaseMode;
            EditorUtility.SetDirty(showcaseMode);

            Debug.Log("[ShowcasePrefabCreator] Showcase Camera 结构创建完成！\n" +
                     "层级结构:\n" +
                     "ShowcaseMode (ShowcaseModeComponent)\n" +
                     "├── FrontFullBody (VisualCameraComponent)\n" +
                     "│   ├── DirectPoseModule [Body, Order: 0]\n" +
                     "│   └── AutoFitModule [Body, Order: 10]\n" +
                     "├── SideHalfBody\n" +
                     "│   ├── DirectPoseModule\n" +
                     "│   └── AutoFitModule\n" +
                     "└── HeadCloseup\n" +
                     "    ├── DirectPoseModule\n" +
                     "    └── AutoFitModule");

            EditorUtility.DisplayDialog(
                "创建成功",
                "Showcase Camera 结构已创建完成。\n\n" +
                "下一步：\n" +
                "1. 调整每个 VC 子节点的 Transform（Position/Rotation）来设置机位\n" +
                "2. 在 Scene View 中拖拽 VC 节点到想要的相机位置\n" +
                "3. 保存为 Prefab",
                "确定"
            );
        }

        /// <summary>
        /// 创建一个 VC 机位节点（含 DirectPoseModule + AutoFitModule）
        /// </summary>
        private static void CreateVCSlot(Transform parent, string name,
            Vector3 position, Quaternion rotation)
        {
            // VC 节点
            GameObject vcObj = new GameObject(name);
            vcObj.transform.SetParent(parent);
            vcObj.transform.localPosition = position;
            vcObj.transform.localRotation = rotation;
            vcObj.transform.localScale = Vector3.one;

            var vcComp = vcObj.AddComponent<VisualCameraComponent>();
            // 设置 VC 名称
            var vcSO = new SerializedObject(vcComp);
            var nameProp = vcSO.FindProperty("m_vcName");
            if (nameProp != null)
            {
                nameProp.stringValue = name;
            }
            // 默认不激活（由 ShowcaseMode 在 OnEnter 时控制）
            var activeProp = vcSO.FindProperty("m_isActive");
            if (activeProp != null)
            {
                activeProp.boolValue = false;
            }
            vcSO.ApplyModifiedPropertiesWithoutUndo();

            // DirectPoseModule [Body, Order: 0]
            GameObject directPoseObj = new GameObject("DirectPoseModule");
            directPoseObj.transform.SetParent(vcObj.transform);
            directPoseObj.transform.localPosition = Vector3.zero;
            var directPose = directPoseObj.AddComponent<DirectPoseModuleComponent>();
            SetModuleStageAndOrder(directPose, CameraModuleStage.Body, 0);

            // AutoFitModule [Body, Order: 10]
            GameObject autoFitObj = new GameObject("AutoFitModule");
            autoFitObj.transform.SetParent(vcObj.transform);
            autoFitObj.transform.localPosition = Vector3.zero;
            var autoFit = autoFitObj.AddComponent<ShowcaseAutoFitModuleComponent>();
            SetModuleStageAndOrder(autoFit, CameraModuleStage.Body, 10);
        }

        /// <summary>
        /// 设置模块的 Stage 和 Order
        /// </summary>
        private static void SetModuleStageAndOrder(CameraModuleComponent module,
            CameraModuleStage stage, int order)
        {
            var so = new SerializedObject(module);

            var stageProp = so.FindProperty("m_stage");
            if (stageProp != null)
            {
                stageProp.enumValueIndex = (int)stage;
            }

            var orderProp = so.FindProperty("m_order");
            if (orderProp != null)
            {
                orderProp.intValue = order;
            }

            so.ApplyModifiedPropertiesWithoutUndo();
        }

        [MenuItem("Tools/Camera/Create Showcase Camera Structure", true)]
        public static bool CreateShowcaseCameraStructureValidate()
        {
            return Selection.activeGameObject != null;
        }

        /// <summary>
        /// 向已有 ShowcaseMode 添加新机位
        /// </summary>
        [MenuItem("Tools/Camera/Add Showcase VC Slot to Selected", false, 103)]
        public static void AddVCSlotToSelected()
        {
            GameObject selected = Selection.activeGameObject;
            if (selected == null)
            {
                return;
            }

            // 检查是否是 ShowcaseMode 或其子节点
            var mode = selected.GetComponent<ShowcaseModeComponent>();
            if (mode == null)
            {
                mode = selected.GetComponentInParent<ShowcaseModeComponent>();
            }
            if (mode == null)
            {
                EditorUtility.DisplayDialog("添加机位", "请选择 ShowcaseModeComponent 或其子节点", "确定");
                return;
            }

            // 从 Scene Camera 获取位置
            Vector3 pos = Vector3.zero;
            Quaternion rot = Quaternion.identity;
            var sceneView = SceneView.lastActiveSceneView;
            if (sceneView != null)
            {
                pos = sceneView.camera.transform.position;
                rot = sceneView.camera.transform.rotation;
            }

            int existingCount = mode.GetComponentsInChildren<VisualCameraComponent>(true).Length;
            string vcName = $"Slot{existingCount}";

            CreateVCSlot(mode.transform, vcName, pos, rot);

            EditorUtility.SetDirty(mode.gameObject);
            Debug.Log($"[ShowcasePrefabCreator] 已添加机位: {vcName}");
        }

        [MenuItem("Tools/Camera/Add Showcase VC Slot to Selected", true)]
        public static bool AddVCSlotToSelectedValidate()
        {
            if (Selection.activeGameObject == null) return false;
            return Selection.activeGameObject.GetComponent<ShowcaseModeComponent>() != null
                || Selection.activeGameObject.GetComponentInParent<ShowcaseModeComponent>() != null;
        }
    }
}
#endif
```

- [ ] **Step 2: Verify compilation and test menu**

Open Unity Editor → Tools → Camera menu. Verify:
- "Create Showcase Camera Structure" appears
- "Add Showcase VC Slot to Selected" appears
- Create an empty GameObject, select it, run "Create Showcase Camera Structure"
- Verify hierarchy: ShowcaseMode → 3 VC children, each with 2 module children

- [ ] **Step 3: Commit**

```bash
git add "Assets/GameProject/Scripts/Editor/Camera/ShowcasePrefabCreator.cs"
git commit -m "feat(camera): add ShowcasePrefabCreator editor tool"
```

---

## Task 5: ShowcaseVCGizmoDrawer (Scene Gizmos)

**Files:**
- Create: `Assets/GameProject/Scripts/Editor/Camera/ShowcaseVCGizmoDrawer.cs`

- [ ] **Step 1: Create ShowcaseVCGizmoDrawer**

```csharp
#if UNITY_EDITOR
using UnityEngine;
using UnityEditor;
using BlackJack.ProjectEF.Runtime.Scene;

namespace BlackJack.ProjectEF.Editor
{
    /// <summary>
    /// Showcase 相机机位 Scene View Gizmo 绘制器
    /// 为每个 VC 绘制胶囊体 + 简化 FOV 锥体
    /// </summary>
    public static class ShowcaseVCGizmoDrawer
    {
        private static readonly Color s_activeColor = Color.cyan;
        private static readonly Color s_inactiveColor = new Color(0.5f, 0.5f, 0.5f, 0.5f);
        private static readonly Color s_lineColor = new Color(0f, 1f, 1f, 0.4f);

        private const float k_capsuleRadius = 0.08f;
        private const float k_capsuleLength = 0.25f;
        private const float k_coneLength = 0.8f;
        private const float k_defaultFOV = 60f;

        [DrawGizmo(GizmoType.Selected | GizmoType.InSelectionHierarchy)]
        static void DrawShowcaseModeGizmos(ShowcaseModeComponent mode, GizmoType gizmoType)
        {
            var vcs = mode.GetComponentsInChildren<VisualCameraComponent>(true);
            if (vcs == null || vcs.Length == 0)
            {
                return;
            }

            // 判断哪个 VC 是当前选中的
            GameObject selectedObj = Selection.activeGameObject;
            VisualCameraComponent selectedVC = null;
            if (selectedObj != null)
            {
                selectedVC = selectedObj.GetComponent<VisualCameraComponent>();
            }

            foreach (var vc in vcs)
            {
                bool isSelected = (vc == selectedVC);
                DrawVCGizmo(vc, isSelected);
            }
        }

        /// <summary>
        /// 绘制单个 VC 的 Gizmo
        /// </summary>
        private static void DrawVCGizmo(VisualCameraComponent vc, bool isSelected)
        {
            Transform t = vc.transform;
            Vector3 pos = t.position;
            Quaternion rot = t.rotation;
            Vector3 forward = rot * Vector3.forward;
            Vector3 up = rot * Vector3.up;

            Color color = isSelected ? s_activeColor : s_inactiveColor;

            // 1. 绘制胶囊体
            DrawCapsule(pos, rot, color);

            // 2. 绘制名称标签
            GUIStyle style = new GUIStyle();
            style.normal.textColor = color;
            style.fontSize = isSelected ? 12 : 10;
            style.fontStyle = isSelected ? FontStyle.Bold : FontStyle.Normal;
            Handles.Label(pos + up * 0.2f, vc.Name, style);

            // 3. 选中的 VC 绘制 FOV 锥体和到目标的连线
            if (isSelected)
            {
                DrawFOVCone(pos, rot, k_defaultFOV);

                // 绘制到 LookAt 点的虚线（沿 forward 方向延伸）
                Vector3 lookAtPoint = pos + forward * k_coneLength * 2f;
                Handles.color = s_lineColor;
                Handles.DrawDottedLine(pos, lookAtPoint, 4f);
            }
        }

        /// <summary>
        /// 绘制胶囊体（长轴 = forward 方向）
        /// </summary>
        private static void DrawCapsule(Vector3 center, Quaternion rotation, Color color)
        {
            Gizmos.color = color;
            Vector3 forward = rotation * Vector3.forward;
            Vector3 up = rotation * Vector3.up;
            Vector3 right = rotation * Vector3.right;

            float halfLen = k_capsuleLength * 0.5f;
            Vector3 top = center + forward * halfLen;
            Vector3 bottom = center - forward * halfLen;

            // 绘制两端球体
            Gizmos.DrawWireSphere(top, k_capsuleRadius);
            Gizmos.DrawWireSphere(bottom, k_capsuleRadius);

            // 绘制连接线
            Gizmos.DrawLine(top + up * k_capsuleRadius, bottom + up * k_capsuleRadius);
            Gizmos.DrawLine(top - up * k_capsuleRadius, bottom - up * k_capsuleRadius);
            Gizmos.DrawLine(top + right * k_capsuleRadius, bottom + right * k_capsuleRadius);
            Gizmos.DrawLine(top - right * k_capsuleRadius, bottom - right * k_capsuleRadius);
        }

        /// <summary>
        /// 绘制简化 FOV 锥体
        /// </summary>
        private static void DrawFOVCone(Vector3 origin, Quaternion rotation, float fov)
        {
            Gizmos.color = s_lineColor;

            float halfFovRad = fov * 0.5f * Mathf.Deg2Rad;
            float tanHalf = Mathf.Tan(halfFovRad);
            float halfHeight = k_coneLength * tanHalf;
            float aspect = 16f / 9f;
            float halfWidth = halfHeight * aspect;

            Vector3 forward = rotation * Vector3.forward;
            Vector3 up = rotation * Vector3.up;
            Vector3 right = rotation * Vector3.right;

            Vector3 farCenter = origin + forward * k_coneLength;

            // 锥体四角
            Vector3 tl = farCenter + up * halfHeight - right * halfWidth;
            Vector3 tr = farCenter + up * halfHeight + right * halfWidth;
            Vector3 bl = farCenter - up * halfHeight - right * halfWidth;
            Vector3 br = farCenter - up * halfHeight + right * halfWidth;

            // 从相机位置到四角的线
            Gizmos.DrawLine(origin, tl);
            Gizmos.DrawLine(origin, tr);
            Gizmos.DrawLine(origin, bl);
            Gizmos.DrawLine(origin, br);

            // 远平面矩形
            Gizmos.DrawLine(tl, tr);
            Gizmos.DrawLine(tr, br);
            Gizmos.DrawLine(br, bl);
            Gizmos.DrawLine(bl, tl);
        }
    }
}
#endif
```

- [ ] **Step 2: Verify Gizmo rendering**

In Unity Editor:
1. Use "Tools/Camera/Create Showcase Camera Structure" to create a test structure
2. Select the ShowcaseMode node → all 3 VCs should show gray capsule Gizmos
3. Select a specific VC child → that VC should turn cyan with FOV cone visible

- [ ] **Step 3: Commit**

```bash
git add "Assets/GameProject/Scripts/Editor/Camera/ShowcaseVCGizmoDrawer.cs"
git commit -m "feat(camera): add ShowcaseVCGizmoDrawer for scene gizmo visualization"
```

---

## Task 6: ShowcaseModeEditor (Custom Inspector)

**Files:**
- Create: `Assets/GameProject/Scripts/Editor/Camera/ShowcaseModeEditor.cs`

- [ ] **Step 1: Create ShowcaseModeEditor**

```csharp
#if UNITY_EDITOR
using UnityEngine;
using UnityEditor;
using BlackJack.ProjectEF.Runtime.Scene;

namespace BlackJack.ProjectEF.Editor
{
    /// <summary>
    /// ShowcaseModeComponent 自定义 Inspector
    /// 显示机位列表，提供预览、对齐、选中、添加等功能
    /// </summary>
    [CustomEditor(typeof(ShowcaseModeComponent))]
    public class ShowcaseModeEditor : UnityEditor.Editor
    {
        #region 公共方法

        public override void OnInspectorGUI()
        {
            serializedObject.Update();

            var mode = (ShowcaseModeComponent)target;

            // 标题
            EditorGUILayout.Space();
            EditorGUILayout.LabelField("Showcase Camera Mode", EditorStyles.boldLabel);
            EditorGUILayout.Space();

            // 过渡设置
            DrawTransitionSettings();

            EditorGUILayout.Space();

            // 机位列表
            DrawVCList(mode);

            EditorGUILayout.Space();

            // 添加按钮
            DrawAddButtons(mode);

            if (serializedObject.hasModifiedProperties)
            {
                serializedObject.ApplyModifiedProperties();
            }
        }

        #endregion

        #region 非公共方法

        private void DrawTransitionSettings()
        {
            EditorGUILayout.LabelField("过渡设置", EditorStyles.boldLabel);
            EditorGUI.indentLevel++;

            EditorGUILayout.PropertyField(
                serializedObject.FindProperty("m_defaultBlendDuration"),
                new GUIContent("默认过渡时长 (s)"));

            EditorGUILayout.PropertyField(
                serializedObject.FindProperty("m_defaultBlendCurve"),
                new GUIContent("过渡曲线"));

            EditorGUI.indentLevel--;
        }

        private void DrawVCList(ShowcaseModeComponent mode)
        {
            var vcs = mode.GetComponentsInChildren<VisualCameraComponent>(true);

            EditorGUILayout.LabelField($"相机机位列表 ({vcs.Length} 个)", EditorStyles.boldLabel);

            if (vcs.Length == 0)
            {
                EditorGUILayout.HelpBox("没有机位。点击下方按钮添加。", MessageType.Info);
                return;
            }

            EditorGUILayout.BeginVertical(EditorStyles.helpBox);

            for (int i = 0; i < vcs.Length; i++)
            {
                var vc = vcs[i];
                bool isSelected = Selection.activeGameObject == vc.gameObject;

                EditorGUILayout.BeginHorizontal();

                // 索引和名称
                string prefix = isSelected ? "\u25cf" : "  ";
                EditorGUILayout.LabelField($"{prefix} {i}: {vc.Name}", GUILayout.Width(200));

                // 预览按钮
                if (GUILayout.Button("预览", GUILayout.Width(50)))
                {
                    PreviewVC(vc);
                }

                // 对齐按钮（从 Scene Camera 写入 VC Transform）
                if (GUILayout.Button("对齐", GUILayout.Width(50)))
                {
                    AlignVCToSceneView(vc);
                }

                // 选中按钮
                if (GUILayout.Button("选中", GUILayout.Width(50)))
                {
                    Selection.activeGameObject = vc.gameObject;
                }

                EditorGUILayout.EndHorizontal();
            }

            EditorGUILayout.EndVertical();
        }

        private void DrawAddButtons(ShowcaseModeComponent mode)
        {
            EditorGUILayout.BeginHorizontal();

            if (GUILayout.Button("+ 添加机位"))
            {
                AddVCSlot(mode, false);
            }

            if (GUILayout.Button("从场景视角捕获新机位"))
            {
                AddVCSlot(mode, true);
            }

            EditorGUILayout.EndHorizontal();
        }

        /// <summary>
        /// 将 Scene View 对齐到 VC 的 Transform（预览）
        /// </summary>
        private void PreviewVC(VisualCameraComponent vc)
        {
            var sceneView = SceneView.lastActiveSceneView;
            if (sceneView == null)
            {
                return;
            }

            sceneView.AlignViewToObject(vc.transform);
            sceneView.Repaint();
        }

        /// <summary>
        /// 将 Scene Camera 的位置/旋转写入 VC 的 Transform
        /// </summary>
        private void AlignVCToSceneView(VisualCameraComponent vc)
        {
            var sceneView = SceneView.lastActiveSceneView;
            if (sceneView == null)
            {
                return;
            }

            Undo.RecordObject(vc.transform, "Align VC to Scene View");
            vc.transform.position = sceneView.camera.transform.position;
            vc.transform.rotation = sceneView.camera.transform.rotation;
            EditorUtility.SetDirty(vc.transform);
        }

        /// <summary>
        /// 添加新 VC 机位
        /// </summary>
        private void AddVCSlot(ShowcaseModeComponent mode, bool fromSceneView)
        {
            Vector3 pos = Vector3.zero;
            Quaternion rot = Quaternion.identity;

            if (fromSceneView)
            {
                var sceneView = SceneView.lastActiveSceneView;
                if (sceneView != null)
                {
                    pos = sceneView.camera.transform.position;
                    rot = sceneView.camera.transform.rotation;
                }
            }

            int existingCount = mode.GetComponentsInChildren<VisualCameraComponent>(true).Length;
            string vcName = $"Slot{existingCount}";

            // 创建 VC 节点
            GameObject vcObj = new GameObject(vcName);
            Undo.RegisterCreatedObjectUndo(vcObj, "Add Showcase VC Slot");
            vcObj.transform.SetParent(mode.transform);
            vcObj.transform.position = pos;
            vcObj.transform.rotation = rot;
            vcObj.transform.localScale = Vector3.one;

            var vcComp = vcObj.AddComponent<VisualCameraComponent>();
            var vcSO = new SerializedObject(vcComp);
            var nameProp = vcSO.FindProperty("m_vcName");
            if (nameProp != null)
            {
                nameProp.stringValue = vcName;
            }
            var activeProp = vcSO.FindProperty("m_isActive");
            if (activeProp != null)
            {
                activeProp.boolValue = false;
            }
            vcSO.ApplyModifiedPropertiesWithoutUndo();

            // DirectPoseModule
            GameObject dpObj = new GameObject("DirectPoseModule");
            dpObj.transform.SetParent(vcObj.transform);
            dpObj.transform.localPosition = Vector3.zero;
            var dp = dpObj.AddComponent<DirectPoseModuleComponent>();
            SetModuleStageAndOrder(dp, CameraModuleStage.Body, 0);

            // AutoFitModule
            GameObject afObj = new GameObject("AutoFitModule");
            afObj.transform.SetParent(vcObj.transform);
            afObj.transform.localPosition = Vector3.zero;
            var af = afObj.AddComponent<ShowcaseAutoFitModuleComponent>();
            SetModuleStageAndOrder(af, CameraModuleStage.Body, 10);

            EditorUtility.SetDirty(mode.gameObject);
            Selection.activeGameObject = vcObj;
        }

        private static void SetModuleStageAndOrder(CameraModuleComponent module,
            CameraModuleStage stage, int order)
        {
            var so = new SerializedObject(module);
            var stageProp = so.FindProperty("m_stage");
            if (stageProp != null) stageProp.enumValueIndex = (int)stage;
            var orderProp = so.FindProperty("m_order");
            if (orderProp != null) orderProp.intValue = order;
            so.ApplyModifiedPropertiesWithoutUndo();
        }

        #endregion
    }
}
#endif
```

- [ ] **Step 2: Verify Inspector rendering**

In Unity Editor:
1. Select ShowcaseMode node → Custom Inspector should show
2. Verify 3 VC entries listed with [预览] [对齐] [选中] buttons
3. Click [预览] → Scene Camera should jump to VC position
4. Click [选中] → Selection should change to VC GameObject
5. Click [从场景视角捕获新机位] → new VC child should appear

- [ ] **Step 3: Commit**

```bash
git add "Assets/GameProject/Scripts/Editor/Camera/ShowcaseModeEditor.cs"
git commit -m "feat(camera): add ShowcaseModeEditor custom inspector"
```

---

## Task 7: Integration Verification

- [ ] **Step 1: End-to-end test in Unity Editor**

1. Create empty scene
2. Tools → Camera → Create Showcase Camera Structure
3. Verify Prefab hierarchy:
   ```
   ShowcaseMode (ShowcaseModeComponent)
   ├── FrontFullBody (VisualCameraComponent)
   │   ├── DirectPoseModule (DirectPoseModuleComponent) [Body, 0]
   │   └── AutoFitModule (ShowcaseAutoFitModuleComponent) [Body, 10]
   ├── SideHalfBody
   │   ├── DirectPoseModule
   │   └── AutoFitModule
   └── HeadCloseup
       ├── DirectPoseModule
       └── AutoFitModule
   ```
4. Select ShowcaseMode → Custom Inspector shows 3 slots with buttons
5. Select any VC child → Gizmo shows cyan capsule + FOV cone
6. Click [预览] on each slot → Scene Camera jumps to position
7. Move Scene Camera → click [对齐] → VC Transform updates
8. Click [从场景视角捕获新机位] → 4th VC appears
9. Drag VC nodes in Scene View → Transform updates, Gizmo follows

- [ ] **Step 2: Save as Prefab**

Drag ShowcaseMode to Project folder → save as `Pfb_ShowcaseCamera.prefab`
Verify: Prefab retains all VC positions, module settings, and hierarchy.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(camera): complete ShowcaseCamera multi-slot camera system"
```
