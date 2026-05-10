# 钓具组装UI：钓组放大镜模块重构方案 (修订版)

## 1. 概述

本文档旨在阐述将当前 `TackleAssembleBaitGroupUITask`（钓组放大镜）重构为 `Tofu` 组件的详细方案。根据最新的架构讨论，钓组放大镜功能将作为 `TackleAssembleTackleUITask` 的一个内部 `Tofu` 组件，共享主钓具的 3D Layer。此方案旨在优化架构合理性、性能和可维护性，使其更符合 BJFramework 的设计哲学。

## 2. 重构原因分析

### 2.1. `UITask` 规范不符

根据 `Assets/Doc/UITask_Architecture_Comprehensive_Guide_v2.md` 中关于 `UITask` 的规范，`UITask` 通常用于管理独立的、大型的 UI 场景或功能模块，拥有自己的完整生命周期和资源管线。而“钓组放大镜”功能是“钓具组装”界面的一个子功能视图，它依赖于主钓具 3D 场景的渲染结果，并且其生命周期与主钓具组装界面紧密耦合。将其作为一个独立的 `UITask` 引入了不必要的复杂性和资源管理开销。

### 2.2. 3D 场景资源共享的合理性

钓组放大镜是对主 3D 场景中钓组部分的“特写”。`TackleAssembleTackleUITask` 已经负责渲染主钓具的 3D 模型和场景。因此，将钓组放大镜的 `Tofu` 放在 `TackleAssembleTackleUITask` 内部，可以更直接地访问和控制主 3D 场景的资源（例如，直接获取主钓具的 `LureRigActorController` 实例），从而实现更高效的 3D Stage 和 Actor 共享。

## 3. 重构目标

*   **将钓组放大镜功能封装为 `TackleAssembleTackleUITask` 的一个内部 `Tofu` 组件**，命名为 `TackleAssembleBaitGroupTofu`。
*   **`TackleAssembleBaitGroupTofu` 将共享主钓具的 3D Layer**，不再拥有独立的场景加载逻辑。
*   `TackleAssembleBaitGroupTofu` 将负责管理钓组的 3D 模型渲染到 `RenderTexture`，并提供 `RenderTexture` 供主 UI 显示。
*   **简化 `TackleAssembleUITask` 和 `TackleAssembleTackleUITask`** 对钓组放大镜的引用和管理逻辑。
*   **提高代码的可维护性和模块化程度**，使钓组放大镜功能与主钓具组装界面的耦合度更低。

## 4. 详细重构方案

### 4.1. 删除现有 `TackleAssembleBaitGroupUITask`

删除以下文件和目录：
*   `Assets/GameProject/Scripts/Runtime/GameView/UI/TackleAssembleBaitGroupUITask/TackleAssembleBaitGroupUIController.cs`
*   `Assets/GameProject/Scripts/Runtime/GameView/UI/TackleAssembleBaitGroupUITask/TackleAssembleBaitGroupUIController.cs.meta`
*   `Assets/GameProject/Scripts/Runtime/GameView/UI/TackleAssembleBaitGroupUITask/TackleAssembleBaitGroupUITask.cs`
*   `Assets/GameProject/Scripts/Runtime/GameView/UI/TackleAssembleBaitGroupUITask/TackleAssembleBaitGroupUITask.cs.meta`
*   `Assets/GameProject/Scripts/Runtime/GameView/UI/TackleAssembleBaitGroupUITask/Comp/` 目录及其所有内容。
*   `Assets/GameProject/Scripts/Runtime/GameView/UI/TackleAssembleBaitGroupUITask/` 目录本身。

### 4.2. 创建新的 `Tofu` 组件：`TackleAssembleBaitGroupTofu`

#### 4.2.1. 定义接口 `ITackleAssembleBaitGroupTofu`

在 `Assets/GameProject/Scripts/Runtime/GameView/UI/TackleAssembleTackleUITask/Comp/` 目录下创建新文件 `ITackleAssembleBaitGroupTofu.cs`。

```csharp
// Assets/GameProject/Scripts/Runtime/GameView/UI/TackleAssembleTackleUITask/Comp/ITackleAssembleBaitGroupTofu.cs
using BlackJack.BJFramework.Runtime.UI;
using UnityEngine;

namespace BlackJack.ProjectEF.Runtime.UI
{
    public interface ITackleAssembleBaitGroupTofu : IUITaskCompTofuBase
    {
        /// <summary>
        /// 显示钓组
        /// </summary>
        /// <param name="lureRigActor">钓组Actor</param>
        void BaitGroupDisplay(IStageActor lureRigActor);

        /// <summary>
        /// 获取钓组渲染的RenderTexture
        /// </summary>
        /// <returns>RenderTexture</returns>
        RenderTexture RenderTextureGet();
        
        /// <summary>
        /// 清理钓组显示
        /// </summary>
        void BaitGroupCleanup();
        
        /// <summary>
        /// 获取钓组的LureRigActorController
        /// </summary>
        LureRigActorController LureRigActorControllerGet();
    }
}
```

#### 4.2.2. 实现类 `TackleAssembleBaitGroupTofu`

在 `Assets/GameProject/Scripts/Runtime/GameView/UI/TackleAssembleTackleUITask/Comp/` 目录下创建新文件 `TackleAssembleBaitGroupTofu.cs`。

`TackleAssembleBaitGroupTofu` 将继承 `UITaskCompTofuBase`，并实现 `ITackleAssembleBaitGroupTofu` 接口。它将负责：
*   **管理一个独立的相机**：用于渲染钓组。
*   **管理一个 `RenderTexture`**：作为渲染目标的输出。
*   **管理 `LureRigActorController`**：通过 `IStageActor` 来控制钓组 3D 模型。
*   **提供方法**：用于显示/隐藏钓组、获取 `RenderTexture`、清理等。

```csharp
// Assets/GameProject/Scripts/Runtime/GameView/UI/TackleAssembleTackleUITask/Comp/TackleAssembleBaitGroupTofu.cs
using BlackJack.BJFramework.Runtime.UI;
using UnityEngine;
using BlackJack.BJFramework.Runtime.TaskNs;

namespace BlackJack.ProjectEF.Runtime.UI
{
    public class TackleAssembleBaitGroupTofu : UITaskCompTofuBase, ITackleAssembleBaitGroupTofu
    {
        private Camera m_baitGroupCamera;
        private RenderTexture m_baitGroupRenderTexture;
        private IStageActor m_lureRigActor;
        private LureRigActorController m_lureRigActorController;

        public TackleAssembleBaitGroupTofu(IUITaskCompOwnerBase owner) : base(owner) { }

        public override bool Initialize()
        {
            if (!base.Initialize()) return false;

            SetupBaitGroupCameraAndRenderTexture();
            return true;
        }

        public override void OnUITaskStop()
        {
            base.OnUITaskStop();
            BaitGroupCleanup();
            CleanupCameraAndRenderTexture();
        }

        public void BaitGroupDisplay(IStageActor lureRigActor)
        {
            if (lureRigActor == null)
            {
                Debug.LogWarning("TackleAssembleBaitGroupTofu: lureRigActor is null.");
                BaitGroupCleanup();
                return;
            }

            if (m_lureRigActor != null && m_lureRigActor != lureRigActor)
            {
                BaitGroupCleanup();
            }

            m_lureRigActor = lureRigActor;

            if (m_lureRigActor.Instance != null)
            {
                m_lureRigActorController = m_lureRigActor.Instance.GetComponent<LureRigActorController>();
                if (m_lureRigActorController == null)
                {
                    Debug.LogError("TackleAssembleBaitGroupTofu: LureRigActorController not found on lureRigActor instance.");
                    return;
                }
                m_lureRigActorController.Initialize(); 
                
                SetActorLayer(m_lureRigActor.Instance, "BaitGroupRenderLayer"); 
                
                if (m_baitGroupCamera != null)
                {
                    m_baitGroupCamera.targetTexture = m_baitGroupRenderTexture;
                    m_baitGroupCamera.enabled = true;
                    // TODO: 根据钓组模型调整相机位置和视角
                }
                Debug.Log($"TackleAssembleBaitGroupTofu: 钓组Actor显示成功 - {lureRigActor.ActorId}");
            }
        }

        public RenderTexture RenderTextureGet()
        {
            return m_baitGroupRenderTexture;
        }

        public void BaitGroupCleanup()
        {
            if (m_lureRigActor != null)
            {
                m_lureRigActor.Cleanup();
                m_lureRigActor = null;
                m_lureRigActorController = null;
            }
            if (m_baitGroupCamera != null)
            {
                m_baitGroupCamera.enabled = false;
            }
        }

        public LureRigActorController LureRigActorControllerGet()
        {
            return m_lureRigActorController;
        }

        private void SetupBaitGroupCameraAndRenderTexture()
        {
            GameObject cameraRoot = new GameObject("BaitGroupCameraRoot");
            Object.DontDestroyOnLoad(cameraRoot); 

            m_baitGroupCamera = cameraRoot.AddComponent<Camera>();
            m_baitGroupCamera.orthographic = false; 
            m_baitGroupCamera.cullingMask = LayerMask.GetMask("BaitGroupRenderLayer"); 
            m_baitGroupCamera.clearFlags = CameraClearFlags.SolidColor;
            m_baitGroupCamera.backgroundColor = Color.clear; 
            m_baitGroupCamera.depth = -1; 
            m_baitGroupCamera.enabled = false; 

            m_baitGroupRenderTexture = new RenderTexture(256, 256, 24, RenderTextureFormat.ARGB32); 
            m_baitGroupCamera.targetTexture = m_baitGroupRenderTexture;

            Debug.Log("TackleAssembleBaitGroupTofu: 钓组相机和RenderTexture设置完成。");
        }

        private void CleanupCameraAndRenderTexture()
        {
            if (m_baitGroupRenderTexture != null)
            {
                m_baitGroupRenderTexture.Release();
                Object.Destroy(m_baitGroupRenderTexture);
                m_baitGroupRenderTexture = null;
            }
            if (m_baitGroupCamera != null)
            {
                Object.Destroy(m_baitGroupCamera.gameObject);
                m_baitGroupCamera = null;
            }
        }

        private void SetActorLayer(GameObject actorInstance, string layerName)
        {
            int layer = LayerMask.NameToLayer(layerName);
            if (layer == -1)
            {
                Debug.LogWarning($"Layer '{layerName}' not found. Please add it to Project Settings -> Tags and Layers.");
                return;
            }
            actorInstance.layer = layer;
            foreach (Transform child in actorInstance.transform)
            {
                child.gameObject.layer = layer;
            }
        }
    }
}
```

### 4.3. 修改 `TackleAssembleTackleUITaskCompMainTofu`

*   **文件**：`Assets/GameProject/Scripts/Runtime/GameView/UI/TackleAssembleTackleUITask/Comp/TackleAssembleTackleUITaskCompMainTofu.cs`
*   **修改内容**：
    1.  **移除旧引用**：删除 `private TackleAssembleBaitGroupUITask m_baitGroupUITask;`
    2.  **添加新 Tofu 引用**：`private ITackleAssembleBaitGroupTofu m_tackleAssembleBaitGroupTofu;`
    3.  **在 `AllCompTofuConstruct` 中实例化 Tofu**：
        ```csharp
        // 在 TackleAssembleTackleUITaskCompMainTofu 的 AllCompTofuConstruct 方法中
        public override void AllCompTofuConstruct()
        {
            base.AllCompTofuConstruct();
            m_tackleAssembleBaitGroupTofu = new TackleAssembleBaitGroupTofu(m_owner);
            m_compList.Add(m_tackleAssembleBaitGroupTofu);
        }
        ```
    4.  **删除 `StartBaitGroupSubTask` 方法**：该方法不再需要。
    5.  **调整 `ViewUpdate`**：
        *   移除启动子任务 `TackleAssembleBaitGroupUITask` 的逻辑。
        *   确保在适当的时机调用 `m_tackleAssembleBaitGroupTofu.BaitGroupDisplay(lureRigActor)` 来更新钓组放大镜的显示。`lureRigActor` 可以从主钓具的 `LureRigActorController` 中获取。
    6.  **调整 `OnUITaskStop`**：移除 `m_baitGroupUITask` 相关的停止逻辑。
    7.  **新增公共方法**：`public ITackleAssembleBaitGroupTofu BaitGroupTofuGet() { return m_tackleAssembleBaitGroupTofu; }` 用于向外部提供 `Tofu` 实例。

### 4.4. 修改 `TackleAssembleUITaskCompMainTofu`

*   **文件**：`Assets/GameProject/Scripts/Runtime/GameView/UI/TackleAssembleUITask/Comp/TackleAssembleUITaskCompMainTofu.cs`
*   **修改内容**：
    1.  **移除旧引用**：删除 `private TackleAssembleBaitGroupUITask m_tackleAssembleBaitGroupUITask;`
    2.  **通过 `m_tackleAssembleTackleUITask` 间接访问 `TackleAssembleBaitGroupTofu`**。
    3.  **调整 `RefreshBaitGroupView`**：
        ```csharp
        public void RefreshBaitGroupView()
        {
            if (m_tackleAssembleTackleUITask != null)
            {
                // 从主钓具任务获取LureRigActorController
                var lureRigActorController = m_tackleAssembleTackleUITask.BaitGroupTofuGet()?.LureRigActorControllerGet();
                if (lureRigActorController != null)
                {
                    // 创建一个IStageActor包装器
                    var lureRigActor = new LureRigStageActorWrapper(lureRigActorController.gameObject);
                    m_tackleAssembleTackleUITask.BaitGroupTofuGet().BaitGroupDisplay(lureRigActor);
                }
            }
        }
        ```
    4.  **调整 `UpdateSubTaskReferences`**：
        *   移除 `m_tackleAssembleBaitGroupUITask` 相关的查找和 `RenderTexture` 设置逻辑。
        *   修改为从 `m_tackleAssembleTackleUITask.BaitGroupTofuGet().RenderTextureGet()` 获取 `RenderTexture` 并传递给 `m_mainUICtrl`.
    5.  **调整 `HandleBaitGroupSlotClick` 和 `HandleBaitGroupCloseupReturn`**：这些方法将直接通过 `m_mainUICtrl` 触发 UI 动画，不再需要 `m_tackleAssembleBaitGroupUITask`。

### 4.5. 修改 `TackleAssembleUIController`

*   **文件**：`Assets/GameProject/Scripts/Runtime/GameView/UI/TackleAssembleUIController.cs`
*   **修改内容**：
    1.  **调整 `SetBaitGroupRenderTexture` 方法**：确保它能接收来自 `TackleAssembleTackleUITask` (通过 `TackleAssembleBaitGroupTofu`) 的 `RenderTexture`。
    2.  `AnimateBaitGroupViewToCloseup` 方法仍然由 `TackleAssembleUIController` 自己实现，但触发机制需要从 `TackleAssembleUITaskCompMainTofu` 调整。

### 4.6. 调整 `LureRigActorController` 接口 (如果需要)

*   **文件**：`Assets/GameProject/Scripts/Runtime/GameView/UI/LureRigActorController.cs` (或其他相关文件)
*   **修改内容**：
    *   确保 `LureRigActorController` 提供了足够的方法（例如，设置钓组部件、获取根 GameObject 等），以便 `TackleAssembleBaitGroupTofu` 能够有效地控制钓组模型。如果当前接口不足以支持 `Tofu` 的需求，则需要进行扩展。

## 5. 影响范围

*   `Assets/GameProject/Scripts/Runtime/GameView/UI/TackleAssembleBaitGroupUITask/` 目录及其所有内容 (删除)
*   `Assets/GameProject/Scripts/Runtime/GameView/UI/TackleAssembleTackleUITask/Comp/ITackleAssembleBaitGroupTofu.cs` (新增)
*   `Assets/GameProject/Scripts/Runtime/GameView/UI/TackleAssembleTackleUITask/Comp/TackleAssembleBaitGroupTofu.cs` (新增)
*   `Assets/GameProject/Scripts/Runtime/GameView/UI/TackleAssembleTackleUITask/Comp/TackleAssembleTackleUITaskCompMainTofu.cs` (修改)
*   `Assets/GameProject/Scripts/Runtime/GameView/UI/TackleAssembleUITask/Comp/TackleAssembleUITaskCompMainTofu.cs` (修改)
*   `Assets/GameProject/Scripts/Runtime/GameView/UI/TackleAssembleUIController.cs` (修改，如果存在)
*   相关的 `StageActorViewUITask` 和 `StagePresetPaths` 等文件（之前的修改，需要确保与新架构兼容）。

## 6. 验证方法

1.  **编译检查**：确保所有代码修改后项目能够成功编译，无任何错误或警告。
2.  **功能测试**：
    *   **进入钓具组装界面**：确保主钓具 3D 模型正常显示。
    *   **钓组放大镜功能**：
        *   验证钓组放大镜的 UI 显示和隐藏是否正常。
        *   点击钓组槽位时，放大镜是否能正确执行放大动画。
        *   点击返回后的缩小动画。
        *   更换钓组部件后，放大镜中的钓组模型是否能实时更新。
    *   **主钓具交互**：确保主钓具的旋转、特写等功能不受影响。
    *   **错误日志检查**：运行过程中，密切关注 Unity Console，确保没有出现新的 `NullReferenceException` 或其他运行时错误。
3.  **性能分析**：对比重构前后，检查钓具组装界面的加载时间、帧率和内存使用情况，确认重构是否带来了性能提升。

---
**文档版本: 1.1**
**创建日期: 2025-10-05**
**基于: 用户反馈及BJFramework架构规范**
