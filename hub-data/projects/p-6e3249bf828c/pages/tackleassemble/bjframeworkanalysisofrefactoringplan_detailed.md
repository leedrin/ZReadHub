### BJFramework 框架下钓具组装重构方案分析报告 (结合 `IStageActor` 组合场景 - 最终修订版)

## 1. 引言

本报告是对之前钓具组装重构方案的进一步深化和修订，旨在解决 `IStageActor.Assemble()` 方法在处理复杂 Actor 组合（特别是 `CharacterStageActor` 挂载 `TackleActor` 以及 `CharacterStageActor` 自身的换装组装）时可能出现的职责重叠和扩展性问题。我们将结合 BJFramework 的核心原则、`StageActorViewUITask` 和 `TackleAssembleTackleUITask` 的上下文，提出一个更符合框架理念且能优雅处理组合场景的方案。

## 2. BJFramework 核心原则与 `StageActorViewUITask` 结构回顾

（此部分内容与之前的报告相同，不再赘述，参考 `Assets/Doc/TackleAssemble/BJFrameworkAnalysisOfRefactoringPlan_Detailed.md` 的第 2 节。）

### 2.1. `TackleAssembleTackleUITask` 的上下文分析

根据提供的 `TackleAssembleTackleUITask` 文件夹内容，我们注意到：

*   [`TackleAssembleTackleUITask`](Assets/GameProject/Scripts/Runtime/GameView/UI/TackleAssembleTackleUITask/TackleAssembleTackleUITask.cs:78) 继承自 `StageActorViewUITask`，专门用于钓具的 3D 展示。
*   它有自己的 `TackleAssembleTackleUITaskCompMainTofu` (`m_compTackleMainTofu`)，负责钓具展示的特有逻辑。
*   `TackleAssembleTackleUIController` 继承自 `StageActorViewUIController`，并增加了相机模式切换、钓具插槽初始化等功能。
*   `TackleAssembleUISettingsSO` 作为一个 ScriptableObject，用于配置钓具的相机设置、显示设置、鱼线物理和渲染参数。
*   `UIBaitGroupPhysicsFollower` 和 `UILinePhysicsSimulator` 作为独立的 MonoBehaviour 组件，负责鱼线和钓组的物理模拟。

这些信息进一步确认了 `TackleActor` 的组装和显示是一个复杂且高度配置化的过程，且 `TackleAssembleTackleUITask` 已经为此提供了专门的 `UITask` 和 `UIController` 层次。

## 3. `IStageActor.Assemble()` 方法的职责重审与修订

### 3.1. 现有 `IStageActor.Assemble()` 的局限性与用户反馈

之前的方案建议移除 `IStageActor` 的 `Assemble()` 方法，将其职责完全转移到工厂/构建器。然而，根据用户反馈，`IStageActor` 的创建流程是一个多步骤、跨 `UITask` 的过程，其 `Assemble()` 方法在流程的特定阶段是必需的：

1.  **对象创建 (主界面 `UITask`)**: `TackleAssembleUITask` (或类似的主界面业务 `UITask`) 创建一个 `IStageActor` 的**实例**。此时 `IStageActor` 是一个逻辑对象，其 `GameObject` 可能尚未被实例化。
2.  **通过 `UIIntent` 传递**: 这个“未组装”的 `IStageActor` 实例通过 `UIIntent` 传递给舞台 `UITask` (`StageActorViewUITask` 或 `TackleAssembleTackleUITask`)。
3.  **资源收集 (`DynamicResCollect4Load`)**: 舞台 `UITask` 的管线在 `DynamicResCollect4Load` 阶段调用 `IStageActor.CollectResourcePaths()` 收集所需资源。
4.  **资源加载 (`ResourceLoad`)**: 舞台 `UITask` 的管线在 `ResourceLoad` 阶段加载所有收集到的资源。
5.  **实际组装 (`ViewUpdate` 阶段)**: 在资源加载完成后，舞台 `UITask` 的 `ViewUpdate` 阶段（或其 Tofu 组件）会**调用 `IStageActor` 的 `Assemble()` 方法**，传入已加载的资源。此时 `IStageActor` 负责**实例化其 `GameObject` 层次结构，并完成内部组件的配置**。
6.  **注入舞台/挂载**: `StageActorViewUIController` 负责将这个已完全组装的 `IStageActor` 的 `GameObject` 注入到场景中并挂载到指定节点。

### 3.2. 修订后的 `IStageActor.Assemble()` 职责定义

基于上述流程，`IStageActor.Assemble()` 方法的职责应定义为：

**`IStageActor.Assemble(IReadOnlyDictionary<string, Object> loadedResources, IAssetProvider assetProvider, IConfigDataProvider configDataProvider)`**:
*   **职责**:
    1.  利用 `loadedResources` (已预加载的资源字典)，实例化 `IStageActor` 自身的根 `GameObject`。
    2.  根据 `IStageActor` 的类型和内部配置，进一步实例化和配置其内部的子 `GameObject` 和组件（例如，`TackleActor` 会在此阶段调用 `TackleAssemblyTofu` 的逻辑来组装钓竿、渔轮、钓组等；`CharacterActor` 则会组装身体部件和换装配件）。
    3.  完成 `IStageActor` 内部所有必要的初始化工作，使其成为一个完整的、可在舞台上显示的实体。
*   **关键点**: `Assemble()` 方法应是**幂等**的（多次调用不会产生副作用），并且它应该能够处理 `GameObject` 已经存在的情况（例如，如果 `IStageActor` 实例被重用）。

## 4. 修订后的方案：组合式 `IStageActor` 与独立挂载服务 (保留 `Assemble` 方法)

该方案依然基于 **组合模式 (Composite Pattern)** 和 **依赖注入 (Dependency Injection)**，并引入一个专门的 **挂载服务 (Attachment Service)** 来处理 Actor 之间的挂载关系。与之前方案的主要区别在于 `IStageActor` 的 `Assemble()` 方法被保留并赋予了明确的职责，同时 `IAttachmentService` 将更好地融入 BJFramework 的 Tofu 组件体系。

### 4.1. 核心思想

1.  **`IStageActor` 接口**: 负责表示一个舞台实体，提供对其根 `GameObject`、挂载点的访问，并包含一个 `Assemble()` 方法用于在资源加载后构建其 `GameObject` 层次。
2.  **`TackleActor` 的构建**: 复杂的 `IStageActor` (如 `TackleActor`) 由其专属的工厂/构建器 (`TackleAssemblyTofu`) 负责**逻辑上的组装**（即确定需要哪些部件、它们的配置），但实际的 `GameObject` 实例化和配置是在 `TackleActor.Assemble()` 方法中完成，该方法会委托 `TackleAssemblyTofu` 的内部逻辑。
3.  **`CharacterActor` 的构建**: 类似的，`CharacterStageActor` 将由一个专门的 `CharacterAssemblyTofu` 负责逻辑上的组装，其 `Assemble()` 方法会委托 `CharacterAssemblyTofu` 的内部逻辑来构建角色身体和换装部件。
4.  **`AttachmentServiceTofu`**: 引入一个实现 `IAttachmentService` 接口的 Tofu 组件，专门负责将一个**已完全组装好**的 `IStageActor` 实例挂载到另一个**已完全组装好**的 `IStageActor` 实例的指定挂载点上。

### 4.2. 方案详情与 BJFramework 集成 (最终修订版)

#### 4.2.1. 重新定义 `IStageActor` 接口

（此部分内容与之前的报告相同，不再赘述，参考 `Assets/Doc/TackleAssemble/BJFrameworkAnalysisOfRefactoringPlan_Detailed.md` 的 4.2.1 节。）

#### 4.2.2. `TackleStageActor` 的实现

（此部分内容与之前的报告相同，不再赘述，参考 `Assets/Doc/TackleAssemble/BJFrameworkAnalysisOfRefactoringPlan_Detailed.md` 的 4.2.2 节。）

#### 4.2.3. `AttachmentServiceTofu` (实现 `IAttachmentService`)

（此部分内容与之前的报告相同，不再赘述，参考 `Assets/Doc/TackleAssemble/BJFrameworkAnalysisOfRefactoringPlan_Detailed.md` 的 4.2.3 节。）

#### 4.2.4. `CharacterStageActor` 的实现 (支持换装组装)

`CharacterStageActor` 将包含其内部配置信息（例如基础模型 ID 和换装部件 ID 列表），并在 `Assemble()` 方法中委托给一个专门的 `CharacterAssemblyTofu` 来完成实际的 `GameObject` 构造和换装部件挂载。

```csharp
public class CharacterStageActor : IStageActor
{
    private string _actorId;
    private GameObject _rootGameObject;
    private Dictionary<string, Transform> _attachmentPoints = new Dictionary<string, Transform>();
    
    // 角色配置ID (例如，一个包含基础模型和默认装备的配置ID)
    private string _characterConfigId; 

    // 引用 CharacterAssemblyTofu，通过构造函数注入
    private CharacterAssemblyTofu _characterAssemblyTofu;

    public string ActorId => _actorId;
    public GameObject GameObject => _rootGameObject;
    public Transform RootTransform => _rootGameObject?.transform;

    // 构造函数，接收角色配置ID和CharacterAssemblyTofu的引用
    public CharacterStageActor(string actorId, string characterConfigId, CharacterAssemblyTofu characterAssemblyTofu)
    {
        _actorId = actorId;
        _characterConfigId = characterConfigId;
        _characterAssemblyTofu = characterAssemblyTofu;
    }

    public void CollectResourcePaths(List<string> resPathList)
    {
        // 委托给 CharacterAssemblyTofu 收集资源
        _characterAssemblyTofu.CollectResourcePaths(resPathList, _characterConfigId);
    }

    public void Assemble(IReadOnlyDictionary<string, Object> loadedResources, IAssetProvider assetProvider, IConfigDataProvider configDataProvider)
    {
        if (_rootGameObject != null)
        {
            Debug.LogWarning($"CharacterStageActor: Actor '{ActorId}' already assembled. Skipping re-assembly.");
            return;
        }

        // 调用 CharacterAssemblyTofu 的核心逻辑来组装角色的GameObject层次
        _rootGameObject = _characterAssemblyTofu.AssembleCharacterInternal(
            _characterConfigId, loadedResources, assetProvider, configDataProvider);

        if (_rootGameObject != null)
        {
            _rootGameObject.name = $"CharacterActor_{ActorId}";
            // 在这里解析Character的GameObject，查找并缓存挂载点
            FindAttachmentPointsRecursive(_rootGameObject.transform);
        }
        else
        {
            Debug.LogError($"CharacterStageActor: Failed to assemble CharacterActor for '{ActorId}'.");
        }
    }
    
    private void FindAttachmentPointsRecursive(Transform parent)
    {
        if (parent.name.Contains("Mount")) // 约定：挂载点Transform的名称包含"Mount"
        {
            _attachmentPoints[parent.name] = parent;
        }
        foreach (Transform child in parent)
        {
            FindAttachmentPointsRecursive(child);
        }
    }

    public void Place(Transform parentTransform)
    {
        if (_rootGameObject != null)
        {
            _rootGameObject.transform.SetParent(parentTransform);
            _rootGameObject.transform.localPosition = Vector3.zero;
            _rootGameObject.transform.localRotation = Quaternion.identity;
            _rootGameObject.transform.localScale = Vector3.one;
        }
    }

    public void Cleanup()
    {
        if (_rootGameObject != null)
        {
            UnityEngine.Object.Destroy(_rootGameObject);
            _rootGameObject = null;
            _attachmentPoints.Clear();
        }
    }

    public IReadOnlyDictionary<string, Transform> GetAttachmentPoints()
    {
        return _attachmentPoints;
    }
}
```
*   **BJFramework 契合度**: `CharacterStageActor` 的 `Assemble` 方法现在也遵循了在 `ViewUpdate` 阶段进行复杂 GameObject 实例化的模式，并委托给专门的 Tofu。

#### 4.2.5. 新增 `CharacterAssemblyTofu` (提供角色换装组装核心逻辑)

类似于 `TackleAssemblyTofu`，`CharacterAssemblyTofu` 将封装角色基础模型和换装部件的组装逻辑。

```csharp
public class CharacterAssemblyTofu : UITaskCompTofuBase
{
    // ... 依赖注入 IAssetProvider, IConfigDataProvider, ICharacterPartAssembler 等

    public CharacterAssemblyTofu(IUITaskCompOwnerBase owner, /* 注入依赖 */) : base(owner)
    {
        // ...
    }

    public GameObject AssembleCharacterInternal(
        string characterConfigId, // 角色配置ID
        IReadOnlyDictionary<string, Object> loadedResources, IAssetProvider assetProviderForAssemble, IConfigDataProvider configDataProviderForAssemble)
    {
        // 核心逻辑：
        // 1. 根据 characterConfigId 从配置中获取基础模型 ID 和所有换装部件 ID 列表
        // 2. 根据基础模型 ID 加载基础角色 Prefab 并实例化
        // 3. 遍历换装部件 ID 列表，加载每个换装部件 Prefab 并实例化
        // 4. 使用 IAttachmentServiceTofu (或其内部逻辑) 将换装部件挂载到基础角色的相应挂载点
        // 5. 返回组装好的角色根 GameObject
        
        // 示例：
        // CharacterConfig characterConfig = configDataProviderForAssemble.GetCharacterConfig(characterConfigId);
        // GameObject baseCharacterGo = assetProviderForAssemble.InstantiatePrefab(characterConfig.BaseModelPrefabPath);
        // ... 挂载换装部件
        return new GameObject("AssembledCharacter"); // 示例
    }

    public List<string> CollectResourcePaths(List<string> resPathList, string characterConfigId)
    {
        // 核心逻辑：
        // 1. 根据 characterConfigId 从配置中获取基础模型 ID 和所有换装部件 ID 列表
        // 2. 收集基础角色Prefab路径
        // 3. 收集所有换装部件Prefab路径
        return resPathList;
    }
}
```
*   **BJFramework 契合度**: `CharacterAssemblyTofu` 作为一个 `UITaskCompTofuBase`，专注于角色组装业务逻辑，符合 BJFramework 对 Tofu 组件的职责定义。

#### 4.2.6. `TackleAssemblyTofu` (保持不变)

（此部分内容与之前的报告相同，不再赘述，参考 `Assets/Doc/TackleAssemble/BJFrameworkAnalysisOfRefactoringPlan_Detailed.md` 的 4.2.5 节。）

#### 4.2.7. `StageActorViewUITaskCompMainTofu` 的修改 (协调者)

`StageActorViewUITaskCompMainTofu` 将负责创建 `IStageActor` 实例（数据部分），并协调其 `Assemble()` 调用，以及 `AttachmentServiceTofu` 的挂载。

```csharp
public class StageActorViewUITaskCompMainTofu : UITaskCompTofuBase, IStageActorViewUITaskCompMainTofu
{
    // ... 现有成员

    protected IStageActor m_mainStageActor; // 主Actor (例如 Character)
    protected IStageActor m_attachedStageActor; // 挂载的Actor (例如 Tackle)

    protected TackleAssemblyTofu m_compTackleAssemblyTofu; // 钓具组装Tofu引用
    protected CharacterAssemblyTofu m_compCharacterAssemblyTofu; // 新增角色组装Tofu引用
    protected AttachmentServiceTofu m_attachmentServiceTofu; // 挂载服务Tofu引用

    // 在 Initialize() 中获取Tofu引用
    public override bool Initialize()
    {
        if (!base.Initialize()) return false;
        
        m_compTackleAssemblyTofu = (m_owner as IStageActorViewUITaskCompOwner)?.CompTackleAssemblyTofuGet(); // 假设 UITaskOwner 接口扩展了此方法
        m_compCharacterAssemblyTofu = (m_owner as IStageActorViewUITaskCompOwner)?.CompCharacterAssemblyTofuGet(); // 假设 UITaskOwner 接口扩展了此方法
        m_attachmentServiceTofu = (m_owner as IStageActorViewUITaskCompOwner)?.CompAttachmentServiceTofuGet(); // 假设 UITaskOwner 接口扩展了此方法

        return true;
    }

    public override void UpdateContextSetup(ICustomParamDictionaryReadOnly paramDict, UITaskUpdatePipelineStartType pipelineStartType, params object[] extraParamArr)
    {
        base.UpdateContextSetup(paramDict, pipelineStartType, extraParamArr);

        // 获取主StageActor (Character) 的配置信息
        string mainActorId = paramDict.GetStringParam(StageActorViewUITask.IntentParamKey4MainActorId);
        string characterConfigId = paramDict.GetStringParam(StageActorViewUITask.IntentParamKey4CharacterConfigId); // 使用新的角色配置ID参数
        
        // 创建主Actor实例 (此时仅为逻辑对象，未组装GameObject)
        if (m_mainStageActor != null && m_mainStageActor.ActorId != mainActorId)
        {
            m_mainStageActor.Cleanup();
            m_mainStageActor = null;
        }
        if (m_mainStageActor == null)
        {
            // 根据 Intent 参数创建 CharacterStageActor，传入 CharacterAssemblyTofu 引用
            m_mainStageActor = new CharacterStageActor(mainActorId, characterConfigId, m_compCharacterAssemblyTofu); 
        }

        // 获取钓具配置ID和挂载点名称
        int tackleConfigId = paramDict.GetIntParam(StageActorViewUITask.IntentParamKey4TackleConfigID, -1);
        string attachmentPointName = paramDict.GetStringParam(StageActorViewUITask.IntentParamKey4AttachmentPointName);

        // 如果存在钓具配置，则创建钓具Actor实例 (此时仅为逻辑对象，未组装GameObject)
        if (tackleConfigId != -1 && m_compTackleAssemblyTofu != null)
        {
            if (m_attachedStageActor != null) { m_attachedStageActor.Cleanup(); m_attachedStageActor = null; }
            m_attachedStageActor = new TackleStageActor(
                $"AttachedTackle_{tackleConfigId}", tackleConfigId, /* reelId */ 1, /* lineId */ 1, /* baitRigId */ 1, /* settings */ null, m_compTackleAssemblyTofu); // 传入Tofu引用
        } else {
            if (m_attachedStageActor != null) { m_attachedStageActor.Cleanup(); m_attachedStageActor = null; }
        }
        
        // ... 其他现有逻辑
    }

    public override void DynamicResCollect4Load(ref List<string> resPathList)
    {
        // 收集主Actor的资源 (委托给 CharacterStageActor，它会再委托给 CharacterAssemblyTofu)
        m_mainStageActor?.CollectResourcePaths(resPathList);
        // 收集挂载Actor的资源 (委托给 TackleStageActor，它会再委托给 TackleAssemblyTofu)
        m_attachedStageActor?.CollectResourcePaths(resPathList);
    }

    public override void ViewUpdate(IUITaskUpdatePipelineController pipelineCtrl)
    {
        if (m_mainStageActor == null || m_mainUICtrl == null)
        {
            Debug.LogError("MainStageActor or MainUICtrl is null, cannot display.");
            return;
        }

        var loadedResources = m_owner.CompDynamicResourceCacheManagerGet().DynamicResCacheDictGet();
        var assetProvider = new DefaultAssetProvider(loadedResources); // 临时创建或从DI获取
        var configDataProvider = (m_owner as IConfigDataProvider); // 假设 UITask 实现了 IConfigDataProvider

        // 1. 组装主Actor (实例化GameObject)
        m_mainStageActor.Assemble(loadedResources, assetProvider, configDataProvider);

        // 2. 展示主Actor到舞台 (由 UIController 负责挂载到其内部的 ActorAnchor)
        m_mainUICtrl.StageActorDisplay(m_mainStageActor);
        
        // 3. 组装挂载Actor (实例化GameObject)
        if (m_attachedStageActor != null)
        {
            m_attachedStageActor.Assemble(loadedResources, assetProvider, configDataProvider);
        }

        // 4. 挂载子Actor (如果存在)
        if (m_attachedStageActor != null && m_attachmentServiceTofu != null)
        {
            string attachmentPointName = m_owner.CompUIIntentInfoGet().UIIntentGet().GetStringParam(StageActorViewUITask.IntentParamKey4AttachmentPointName);
            if (!string.IsNullOrEmpty(attachmentPointName))
            {
                m_attachmentServiceTofu.AttachActor(m_mainStageActor, m_attachedStageActor, attachmentPointName);
            }
            else
            {
                Debug.LogWarning("Attachment point name not provided for attached actor. Defaulting to main actor root.");
                m_attachedStageActor.Place(m_mainStageActor.RootTransform); // 默认挂载到主Actor的根节点
            }
        }

        // ... 触发Actor准备就绪事件
        (m_owner as StageActorViewUITask)?.OnEventActorReady(m_mainStageActor);
    }
}
```
*   **BJFramework 契合度**: `StageActorViewUITaskCompMainTofu` 保持其协调者角色，现在能够处理更复杂的 `CharacterStageActor` 和 `TackleStageActor` 的组合。

#### 4.2.8. `StageActorViewUITask` 的 `UIIntent` 更新 (支持角色换装)

`UIIntent` 需要新增参数来传递主 Actor 的配置信息（基础角色 ID 和换装部件 ID 列表）。

```csharp
public class StageActorViewUITask : UITaskBase, IStageActorViewUITask, IStageActorViewUITaskCompOwner
{
    // ... 现有代码

    /// <summary>
    /// 3D场景Actor通用展示UI Intent创建
    /// </summary>
    /// <param name="mainActorId">要展示的主Actor ID</param>
    /// <param name="characterConfigId">角色配置ID (包含基础模型和换装部件信息)</param>
    /// <param name="scenePreset">场景预设</param>
    /// <param name="tackleConfigID">要挂载的钓具配置ID</param>
    /// <param name="attachmentPointName">钓具挂载点名称</param>
    /// <param name="actorDragEnabled">是否允许拖拽Actor（默认为true）</param>
    /// <param name="cameraControlEnabled">是否允许Camera控制（默认为true）</param>
    /// <returns>创建的UIIntent</returns>
    public static UIIntentCustom StageActorViewUIIntentCreate(
        string mainActorId, 
        string characterConfigId, // 使用新的角色配置ID参数
        string scenePreset,
        int tackleConfigID = -1,
        string attachmentPointName = null,
        bool actorDragEnabled = true,
        bool cameraControlEnabled = true)
    {
        var uiIntent = new UIIntentCustom(nameof(StageActorViewUITask));
        uiIntent.SetParam(IntentParamKey4MainActorId, mainActorId);
        uiIntent.SetParam(IntentParamKey4CharacterConfigId, characterConfigId); // 传递角色配置ID
        uiIntent.SetParam(IntentParamKey4StagePreset, scenePreset);
        uiIntent.SetParam(IntentParamKey4TackleConfigID, tackleConfigID);
        uiIntent.SetParam(IntentParamKey4AttachmentPointName, attachmentPointName);
        uiIntent.SetParam(IntentParamKey4ActorDragEnabled, actorDragEnabled);
        uiIntent.SetParam(IntentParamKey4CameraControlEnabled, cameraControlEnabled);
        return uiIntent;
    }

    // ... 现有代码

    #region static和常量

    // ... 现有常量
    
    /// <summary>
    /// UIIntent参数Key - 主Actor ID
    /// </summary>
    public const string IntentParamKey4MainActorId = "MainActorId";

    /// <summary>
    /// UIIntent参数Key - 角色配置ID (包含基础模型和换装部件信息)
    /// </summary>
    public const string IntentParamKey4CharacterConfigId = "CharacterConfigId";
    
    /// <summary>
    /// UIIntent参数Key - 钓具配置ID
    /// </summary>
    public const string IntentParamKey4TackleConfigID = "TackleConfigID";
    
    /// <summary>
    /// UIIntent参数Key - 挂载点名称
    /// </summary>
    public const string IntentParamKey4AttachmentPointName = "AttachmentPointName";

    // ... 其他常量
    #endregion
}
```
*   **BJFramework 契合度**: 通过 `UIIntent` 传递所有必要的配置信息，使得 `StageActorViewUITask` 能够根据这些信息动态构建复杂的角色和挂载物。

## 5. 综合优势

这个修订后的方案，通过保留 `IStageActor.Assemble()` 方法并明确其职责，引入 **组合式 `IStageActor`** (支持复杂换装的 `CharacterStageActor` 和复杂钓具的 `TackleStageActor`) 和 **`AttachmentServiceTofu`**，并将其与 BJFramework 的组件化和管线机制深度融合，能优雅地处理 `CharacterStageActor` 挂载 `TackleActor` 这种复杂的组合场景，以及 `CharacterStageActor` 自身的换装组装：

1.  **清晰的职责分离**:
    *   **主界面 `UITask`**: 负责创建 `IStageActor` 的**逻辑实例**。
    *   **舞台 `UITask` 的管线**: 负责**资源加载**和协调 `IStageActor.Assemble()` 的**实际 GameObject 实例化和配置**。
    *   `TackleAssemblyTofu`: 专注于钓具（包括复杂钓组）的**核心构建逻辑**，供 `TackleStageActor.Assemble()` 调用。
    *   `CharacterAssemblyTofu`: 专注于角色（包括基础模型和换装部件）的**核心构建逻辑**，供 `CharacterStageActor.Assemble()` 调用。
    *   `CharacterStageActor` (或其他 `IStageActor`): 专注于自身的 **GameObject 实例化**和**挂载点暴露**。
    *   `AttachmentServiceTofu`: 专注于**通用挂载逻辑**，解耦了 Actor 内部的挂载细节，并融入 `UITask` 的生命周期管理。
    *   `StageActorViewUITaskCompMainTofu`: 专注于**编排**主 Actor 和子 Actor 的显示与挂载流程，并协调 Tofu 之间的工作。
2.  **高度模块化和可扩展**:
    *   任何 `IStageActor` 只要实现了 `GetAttachmentPoints()` 就可以成为挂载的“父级”。
    *   任何由 `TackleAssemblyTofu` 组装出的 `TackleActorController` 包装成的 `TackleStageActor` 都可以被挂载到其他 Actor 上。
    *   `CharacterAssemblyTofu` 的引入使得角色换装系统可以独立于钓具组装系统进行扩展和维护。
    *   新增其他类型的可挂载道具 (如帽子、饰品) 同样只需实现 `IStageActor` 接口，并由其对应的工厂 Tofu 组装，然后通过 `AttachmentServiceTofu` 挂载。
3.  **完全符合 BJFramework 理念**:
    *   充分利用 `UITask` 和 `UITaskCompTofuBase` 进行功能模块的封装和生命周期管理。
    *   通过 `UIIntent` 传递参数，驱动 `UpdatePipeline` 的执行。
    *   强调接口和依赖注入，降低模块间的耦合。
    *   资源管理通过 `DynamicResCollect4Load` 与 `IAssetProvider` 结合。
4.  **易于测试**: 各个服务和组件职责单一，更易于进行单元测试。

## 6. 结论

通过上述再次修订和调整，钓具组装重构方案与 BJFramework 的集成将更加紧密和高效，并能够应对更复杂的组合场景。新的架构不仅解决了 `TackleStageActorFactory` 的“巨石类”风险和钓组的复杂性问题，更提供了一个健壮、灵活的框架，能够处理 `IStageActor` 之间复杂的组合和挂载关系，以及 `IStageActor` 自身的复杂组装需求（如角色换装），为游戏内容的高度可定制性和未来扩展奠定了坚实的基础，同时完全遵循了 BJFramework 的现有工作流和设计模式。

---