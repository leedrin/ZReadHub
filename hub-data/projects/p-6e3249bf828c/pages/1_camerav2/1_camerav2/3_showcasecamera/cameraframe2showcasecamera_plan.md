# CameraFrame → ShowcaseCamera 机位保存 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 扩展 CameraFrameControllerEditor，使其能将编辑器中的 CameraFrame 机位数据直接保存到同场景 ShowcaseCamera 的 VisualCamera 子节点上。

**Architecture:** 在现有 CameraFrameController 上新增 `m_showcaseModeRoot` 引用字段指向 ShowcaseMode 父节点。Editor 新增 `Save2ShowcaseCamera()` 方法，按 FrameName 匹配 VC 子节点，将 cameraPosition 写入 DirectPoseModuleComponent.Position、将 LookRotation 写入 RotationEuler。现有 TackleAssemble 保存流程完全不变。

**Tech Stack:** Unity 2022.3 Editor API, SerializedObject, EditorSceneManager, DirectPoseModuleComponent

---

## 数据流

```
EditorTackleStage (编辑器场景)                    RuntimeStage (运行时场景)
┌──────────────────────────────┐                 ┌────────────────────────────┐
│ CameraFrameController        │                 │ MainCamera                 │
│  └ CameraFrameData[]         │   Save2Showcase │  └ Pfb_ShowcaseMode        │
│    ├ "FullBody"              │ ──────────────→ │    ├ FullBody (VC)          │
│    │  cameraPos + lookAtPos  │                 │    │  └ DirectPoseModule    │
│    ├ "HalfBody"              │                 │    │     position, rotation │
│    └ "Head"                  │                 │    ├ HalfBody (VC)          │
│                              │                 │    └ Head (VC)              │
│  └ m_showcaseModeRoot ───────┼─── 引用 ──────→ │       Pfb_ShowcaseMode     │
└──────────────────────────────┘                 └────────────────────────────┘
```

**转换公式：**
- `DirectPoseModule.Position = frameData.m_cameraPosition`
- `DirectPoseModule.RotationEuler = Quaternion.LookRotation(lookAtPos - cameraPos).eulerAngles`

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `Runtime4EditorOnly/EditorCameraFrame/CameraFrameController.cs` | 修改 | 新增 `m_showcaseModeRoot` 字段 |
| `Editor/CameraEditor/CameraFrameControllerEditor.cs` | 修改 | 新增 `Save2ShowcaseCamera()` + UI 按钮 |

---

## Task 1: CameraFrameController 新增 ShowcaseMode 引用字段

**Files:**
- Modify: `Assets/GameProject/Scripts/Runtime4EditorOnly/EditorCameraFrame/CameraFrameController.cs:49`

- [ ] **Step 1: 在 m_cameraRoot 下方添加 m_showcaseModeRoot 字段**

```csharp
public Transform m_cameraRoot;
public Transform m_showcaseModeRoot;   // ← 新增：ShowcaseCamera 的 ShowcaseMode 父节点
public Transform m_frameRoot;
public GameObject m_templateGo;
```

字段含义：引用 RuntimeStage 场景中 `Pfb_ShowcaseMode` 节点（包含 FullBody/HalfBody/Head 等 VC 子节点的父 Transform）。

- [ ] **Step 2: 验证编译通过**

Unity Editor 中确认无编译错误。

---

## Task 2: CameraFrameControllerEditor 新增 Save2ShowcaseCamera 方法

**Files:**
- Modify: `Assets/GameProject/Scripts/Editor/CameraEditor/CameraFrameControllerEditor.cs:780`（在 Save2TackleSettings 方法后）

- [ ] **Step 1: 添加 using**

文件头部已有 `using BlackJack.ProjectEF.Runtime.Scene;`（DirectPoseModuleComponent 所在命名空间），无需额外 using。

- [ ] **Step 2: 在 Save2TackleSettings() 方法后添加 Save2ShowcaseCamera()**

```csharp
/// <summary>
/// 保存机位到 ShowcaseCamera 的 VisualCamera 子节点
/// 按 FrameName 匹配 VC 子节点名称，将 cameraPosition 和 lookAt 方向
/// 写入对应 DirectPoseModuleComponent 的 Position 和 RotationEuler
/// </summary>
private void Save2ShowcaseCamera()
{
    var showcaseRoot = CameraFrameController.m_showcaseModeRoot;
    if (showcaseRoot == null)
    {
        EditorUtility.DisplayDialog("错误",
            "ShowcaseMode Root 未设置。\n请将 Showcase Mode Root 字段指向 RuntimeStage 的 ShowcaseMode 节点（如 Pfb_ShowcaseMode）。",
            "确定");
        return;
    }

    int savedCount = 0;
    int skippedCount = 0;

    for (int i = 0; i < CameraFrameController.m_cameraFrames.Count; i++)
    {
        var frameData = CameraFrameController.m_cameraFrames[i];

        // 按名称查找 VC 子节点
        var vcTransform = showcaseRoot.Find(frameData.m_frameName);
        if (vcTransform == null)
        {
            Debug.LogWarning($"[Save2ShowcaseCamera] 未找到名为 '{frameData.m_frameName}' 的 VisualCamera 子节点，已跳过");
            skippedCount++;
            continue;
        }

        // 获取 DirectPoseModuleComponent
        var directPose = vcTransform.GetComponentInChildren<DirectPoseModuleComponent>();
        if (directPose == null)
        {
            Debug.LogWarning($"[Save2ShowcaseCamera] VC '{frameData.m_frameName}' 上未找到 DirectPoseModuleComponent，已跳过");
            skippedCount++;
            continue;
        }

        // 写入 Position
        directPose.Position = frameData.m_cameraPosition;

        // 计算并写入 Rotation（从 camera 看向 lookAt 的方向）
        var lookDirection = frameData.m_lookAtPosition - frameData.m_cameraPosition;
        if (lookDirection.sqrMagnitude > 0.0001f)
        {
            directPose.RotationEuler = Quaternion.LookRotation(lookDirection).eulerAngles;
        }

        EditorUtility.SetDirty(directPose);
        savedCount++;
    }

    // 标记场景为脏，确保保存
    if (savedCount > 0)
    {
        EditorSceneManager.MarkSceneDirty(showcaseRoot.gameObject.scene);
    }

    string msg = $"ShowcaseCamera 保存完成：成功 {savedCount} 个";
    if (skippedCount > 0)
    {
        msg += $"，跳过 {skippedCount} 个（未找到匹配 VC 或 DirectPoseModule）";
    }
    Debug.Log($"[Save2ShowcaseCamera] {msg}");
}
```

- [ ] **Step 3: 验证编译通过**

---

## Task 3: 修改 CameraFrameDataSave 和 UI，支持双目标保存

**Files:**
- Modify: `Assets/GameProject/Scripts/Editor/CameraEditor/CameraFrameControllerEditor.cs`

- [ ] **Step 1: 修改 CameraFrameDataSave，同时保存两个目标**

将 `CameraFrameDataSave()` 方法修改为：

```csharp
private void CameraFrameDataSave()
{
    if (CameraFrameController.m_cameraFrames.Count == 0)
    {
        return;
    }

    Save2TackleSettings();

    // 如果配置了 ShowcaseMode Root，同时保存到 ShowcaseCamera
    if (CameraFrameController.m_showcaseModeRoot != null)
    {
        Save2ShowcaseCamera();
    }
}
```

- [ ] **Step 2: 在 OnInspectorGUI 中添加独立的 ShowcaseCamera 保存按钮**

在 `EditorGUILayout.EndHorizontal();`（第 549 行）后、`// 应用修改` 注释前，添加：

```csharp
// ShowcaseCamera 独立保存按钮
bool doSaveShowcase = false;
if (CameraFrameControllerMonitor.MonitorStarted && CameraFrameController.m_showcaseModeRoot != null)
{
    EditorGUILayout.Space(5);
    if (GUILayout.Button("保存到 ShowcaseCamera"))
    {
        doSaveShowcase = true;
    }
}
```

在 `if(doLoad)` 块后添加：

```csharp
if (doSaveShowcase)
{
    EditorApplication.delayCall += Save2ShowcaseCamera;
}
```

- [ ] **Step 3: 验证编译通过**

---

## Task 4: 场景配置与验证

- [ ] **Step 1: 打开编辑器场景**

打开 `Assets/GameProject/EditorAsset/StageEditorScene/EditorTackleStage.unity`

- [ ] **Step 2: 配置 CameraFrameController**

在 EditorTackleStage 的 `CameraController` GameObject 上：
1. 将 `Showcase Mode Root` 字段拖入 RuntimeStage 的 `Pfb_ShowcaseMode` 节点

- [ ] **Step 3: 测试保存流程**

1. 点击"开始编辑"
2. 添加/编辑 Frame（如 "FullBody"、"HalfBody"、"Head"）
3. 拖动 CameraPosition 和 LookAt 球到理想位置
4. 点击"保存到 ShowcaseCamera"
5. 验证对应 VC 子节点的 DirectPoseModuleComponent 上 Position 和 Rotation 已更新
6. 保存场景，运行验证相机机位正确

---

## 注意事项

- **命名一致性**：CameraFrameData 的 `m_frameName` 必须与 VC 子节点的 GameObject 名称完全一致（如 "FullBody" 不能写成 "Fullbody"）
- **Prefab Override**：如果 Pfb_ShowcaseMode 是 Prefab 实例，修改后会产生 Override，需要 Apply 到 Prefab 或保持场景 Override
- **现有功能不变**："保存数据"按钮仍会保存到 TackleSettings SO，同时如果配置了 ShowcaseModeRoot 也会保存到 ShowcaseCamera
