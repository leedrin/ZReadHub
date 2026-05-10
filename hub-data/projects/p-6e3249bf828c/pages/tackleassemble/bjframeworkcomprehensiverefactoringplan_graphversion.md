# BJFramework 框架下 Actor 部件图组装与挂载重构方案 (综合版)

## 1. 引言

本报告旨在提出一个全面的重构方案，以解决当前 `TackleStageActorFactory.cs` 存在的“巨石类”风险，并应对日益增长的钓具和角色组装复杂性，特别是支持角色换装和 Actor 之间挂载的需求。本方案将引入**通用的 Actor 部件图 (ActorPartGraph) 概念和端口连接机制**，并严格遵循 BJFramework 的核心原则和最佳实践，确保系统的高可扩展性、可维护性和可测试性。

## 2. 问题背景与挑战

### 2.1. `TackleStageActorFactory` 的“巨石类”风险

原始的 [`TackleStageActorFactory.cs`](Assets/GameProject/Scripts/Runtime/GameView/UI/StageActorViewUITask/StageActor/TackleStageActorFactory.cs:19) 作为一个静态工厂类，承担了过多的职责，包括钓具各部件的配置读取、资源加载、GameObject 实例化、控制器初始化、导环设置、鱼线渲染模式选择及物理模拟设置等。这种设计导致：

*   **职责过度集中**: 单一类负责所有组装细节。
*   **紧密耦合**: 内部逻辑和外部依赖之间耦合度高。
*   **可维护性差**: 代码量庞大，修改困难，易引入 Bug。
*   **可扩展性受限**: 每次新增部件或逻辑都需修改现有代码，违反“开闭原则”。
*   **可测试性低**: 静态类难以进行单元测试。

### 2.2. 复杂 Actor 的通用组装与挂载需求

在游戏开发中，许多 Actor (如钓具、角色、载具、武器等) 都不是简单的单个 Prefab，而是由多个部件组成，这些部件之间存在复杂的连接关系（例如钓具的钓竿、渔轮、钓线、钓组；角色的身体、头部、服装、武器等）。这些部件可能需要：

*   **动态加载**: 根据配置动态选择不同的部件 Prefab。
*   **层级组装**: 将部件实例化后按照特定层级关系挂载。
*   **连接关系**: 部件之间通过“线”（如鱼线、子线）、“刚性连接”（如螺丝、插槽）等方式连接。
*   **挂载点**: 部件内部暴露供其他 Actor 或部件挂载的特定点。
*   **组合嵌套**: 一个复杂 Actor 本身也可以作为另一个 Actor 的部件被挂载。

原有的 `IStageActor.Assemble()` 方法和 `TackleStageActorFactory` 难以高效、通用地处理这种复杂性，尤其是在角色换装和 Actor 之间挂载的场景下。

## 3. 优化重构目标

*   **解耦职责**: 将 Actor 部件的组装逻辑与 `IStageActor` 的核心职责分离。
*   **通用化组装机制**: 引入通用的“部件图”概念，统一描述所有复杂 Actor 的组装结构和连接方式。
*   **模块化与可扩展性**: 使得新增部件类型、连接方式或复杂 Actor 类型时，无需修改核心组装服务。
*   **提升可测试性**: 方便对各组装模块进行单元测试。
*   **符合 BJFramework 规范**: 充分利用 BJFramework 的 `UITask`、Tofu 组件、`UpdatePipeline` 和依赖注入机制。
*   **支持复杂组合场景**: 能够优雅地处理 `IStageActor` 之间的组合和挂载关系。
*   **数据驱动**: 将配置信息与组装逻辑分离，通过数据配置驱动 Actor 的构建。

## 4. 新的架构模式与 BJFramework 集成方案

本方案将采用 **组合模式 (Composite Pattern)**、**构建器模式 (Builder Pattern)** 和 **依赖注入 (Dependency Injection)** 的思想，并引入通用的 **Actor 部件图 (ActorPartGraph)** 概念和**端口连接机制**，将其深度融入 BJFramework 的 `UITask` 和 Tofu 组件体系。

### 4.1. 核心组件与职责

1.  **`IStageActor` 接口**: 表示舞台上的通用实体。
    *   **职责**: 提供 `ActorId`、根 `GameObject`、`Transform`，支持资源路径收集、GameObject 层次的实例化与配置 (`Assemble`)，放置 (`Place`)，清理 (`Cleanup`)，并暴露可供外部挂载的 `AttachmentPoints`。
    *   **关键点**: `Assemble()` 方法在资源加载完成后，负责实例化其 `GameObject` 层次结构并完成内部组件的配置。
2.  **`TackleStageActor` 类**: `IStageActor` 的具体实现，代表一个钓具实体。
    *   **职责**: 封装钓具的 `ActorPartGraphConfig` ID，并在 `Assemble()` 方法中，委托给 `ActorPartGraphBuilderTofu` 完成实际的 `GameObject` 层次构建。
3.  **`CharacterStageActor` 类**: `IStageActor` 的具体实现，代表一个角色实体。
    *   **职责**: 封装角色的 `ActorPartGraphConfig` ID，并在 `Assemble()` 方法中，委托给 `ActorPartGraphBuilderTofu` 完成实际的 `GameObject` 层次构建（包括换装部件）。
4.  **`ActorPartGraphConfig` (ScriptableObject)**:
    *   **职责**: 通用配置，用节点和边描述任何复杂 Actor 的内部结构和连接关系。每个节点可以是 Prefab、组合节点 (引用另一个 `ActorPartGraphConfig`) 或 StageActor 节点 (引用 `IStageActor` 实例)。节点内部暴露“端口”用于连接。
5.  **`ActorPartGraph` (运行时数据结构)**:
    *   **职责**: 运行时表示已构建的 Actor 部件图，包含已实例化的节点 (`ActorPartNode`) 和边 (`ActorPartEdge`)。
6.  **`IActorPartGraphBuilder` 接口**: 定义构建 `ActorPartGraph` 的通用行为。
7.  **`ActorPartGraphBuilderTofu` (UITaskCompTofuBase)**: 负责构建通用的 `ActorPartGraph` (GameObject 层次)。
    *   **职责**: 根据 `ActorPartGraphConfig` 构建复杂的 `GameObject` 层次结构，处理节点实例化和边连接（包括挂载和物理连接）。
    *   **依赖注入**: 接收 `IAssetProvider`、`IConfigDataProvider`、`IAttachmentService` 等。
8.  **`AttachmentServiceTofu` (UITaskCompTofuBase)**: 负责 Actor 之间的通用挂载逻辑。
    *   **职责**: 提供 `AttachActor()` 和 `DetachActor()` 方法，将一个 `IStageActor` 实例挂载到另一个 `IStageActor` 实例的指定挂载点上。
9.  **`IAssetProvider` / `IConfigDataProvider` 接口**: 抽象资源加载和配置数据访问。
10. **`StageActorViewUITaskCompMainTofu` (UITaskCompTofuBase)**: `StageActorViewUITask` 的主 Tofu。
    *   **职责**: 作为协调者，负责创建 `IStageActor` 的逻辑实例，并在 `UpdatePipeline` 的 `ViewUpdate` 阶段协调这些 `IStageActor` 的 `Assemble()` 调用，以及利用 `AttachmentServiceTofu` 进行挂载。

### 4.2. BJFramework 流程集成

整个流程将通过 BJFramework 的 `UIIntent` 和 `UpdatePipeline` 机制驱动：

1.  **启动 `UITask`**: 主界面业务 `UITask` (如背包界面) 通过 `UIManager.StartUITask()` 启动 `StageActorViewUITask`，并通过 `UIIntent` 传递所有必要的配置信息，包括：
    *   主 Actor 的 ID (`mainActorId`) 和其**通用部件图配置 ID** (`characterPartGraphConfigId`)。
    *   要挂载的子 Actor 的**通用部件图配置 ID** (`tacklePartGraphConfigId`)。
    *   子 Actor 的挂载点名称 (`attachmentPointName`)。
    *   场景预设 (`scenePreset`)。
2.  **`StageActorViewUITask.UpdateContextSetup()`**:
    *   `StageActorViewUITaskCompMainTofu` 从 `UIIntent` 中解析这些参数。
    *   根据参数创建 `CharacterStageActor` 和 `TackleStageActor` 的**逻辑实例**（此时仅为数据对象，尚未实例化 `GameObject`），并传入其 `ActorPartGraphConfig` ID。
3.  **`DynamicResCollect4Load()`**:
    *   `StageActorViewUITaskCompMainTofu` 调用 `m_mainStageActor.CollectResourcePaths()` 和 `m_attachedStageActor.CollectResourcePaths()`。
    *   `CharacterStageActor.CollectResourcePaths()` 委托给 `ActorPartGraphBuilderTofu` 收集角色所有部件的资源路径。
    *   `TackleStageActor.CollectResourcePaths()` 委托给 `ActorPartGraphBuilderTofu` 收集钓具所有部件的资源路径。
    *   所有资源路径被添加到 `UITask` 的 `resPathList` 中，由 `UITaskCompDynamicResourceCacheManager` 统一管理加载。
4.  **`ResourceLoad()`**: `UpdatePipeline` 异步加载所有收集到的资源。
5.  **`ViewUpdate()`**:
    *   `StageActorViewUITaskCompMainTofu` 获取已加载的资源字典、`IAssetProvider` 和 `IConfigDataProvider`。
    *   **调用 `m_mainStageActor.Assemble(...)`**: 触发 `CharacterStageActor` 内部的 `Assemble()` 方法，该方法会调用 `ActorPartGraphBuilderTofu` 构建角色 `GameObject` 层次。
    *   **调用 `m_attachedStageActor.Assemble(...)`**: 如果存在挂载 Actor，触发 `TackleStageActor` 内部的 `Assemble()` 方法，该方法会调用 `ActorPartGraphBuilderTofu` 构建钓具 `GameObject` 层次。
    *   **展示主 Actor**: `m_mainUICtrl.StageActorDisplay(m_mainStageActor)` 将主 Actor 的 `GameObject` 注入舞台。
    *   **挂载子 Actor**: `m_attachmentServiceTofu.AttachActor(m_mainStageActor, m_attachedStageActor, attachmentPointName)` 将已组装好的子 Actor 挂载到主 Actor 的指定挂载点。

## 5. 详细组件设计与代码结构

### 5.1. `IAssetProvider` / `IConfigDataProvider` 接口与实现

为了抽象资源加载和配置数据访问，我们定义以下接口和默认实现。这些组件应该在 BJFramework 的启动阶段被实例化，并通过依赖注入提供给需要它们的 Tofu 组件。

```csharp
// Assets/GameProject/Scripts/Runtime/Common/IAssetProvider.cs
using System.Collections.Generic;
using UnityEngine;

public interface IAssetProvider
{
    T LoadAsset<T>(string path) where T : Object;
    GameObject InstantiatePrefab(string path);
    GameObject InstantiatePrefab(GameObject prefab);
}

// Assets/GameProject/Scripts/Runtime/Common/DefaultAssetProvider.cs
using System.Collections.Generic;
using UnityEngine;

public class DefaultAssetProvider : IAssetProvider
{
    private readonly IReadOnlyDictionary<string, Object> m_loadedResources;

    public DefaultAssetProvider(IReadOnlyDictionary<string, Object> loadedResources)
    {
        m_loadedResources = loadedResources;
    }

    public T LoadAsset<T>(string path) where T : Object
    {
        if (m_loadedResources.TryGetValue(path, out var asset) && asset is T typedAsset)
        {
            return typedAsset;
        }
        Debug.LogError($"AssetProvider: Failed to load asset of type {typeof(T).Name} from path: {path}");
        return null;
    }

    public GameObject InstantiatePrefab(string path)
    {
        var prefab = LoadAsset<GameObject>(path);
        if (prefab != null)
        {
            return Object.Instantiate(prefab);
        }
        return null;
    }

    public GameObject InstantiatePrefab(GameObject prefab)
    {
        if (prefab != null)
        {
            return Object.Instantiate(prefab);
        }
        Debug.LogError("AssetProvider: Cannot instantiate null prefab.");
        return null;
    }
}

// Assets/GameProject/Scripts/Runtime/Common/IConfigDataProvider.cs
public interface IConfigDataProvider
{
    ConfigDataRodInfo GetConfigDataRodInfo(int id);
    ConfigDataReelInfo GetConfigDataReelInfo(int id);
    ConfigDataLineInfo GetConfigDataLineInfo(int id);
    ConfigDataLureRigInfo GetConfigDataLureRigInfo(int id);
    ActorPartGraphConfig GetActorPartGraphConfig(string id); // 通用 ActorPartGraph 配置
    // ... 其他配置数据获取方法
}

// Assets/GameProject/Scripts/Runtime/Common/DefaultConfigDataProvider.cs
public class DefaultConfigDataProvider : IConfigDataProvider
{
    private readonly IConfigDataLoader m_configDataLoader;

    public DefaultConfigDataProvider(IConfigDataLoader configDataLoader)
    {
        m_configDataLoader = configDataLoader;
    }

    public ConfigDataRodInfo GetConfigDataRodInfo(int id) => m_configDataLoader.GetConfigDataRodInfo(id);
    public ConfigDataReelInfo GetConfigDataReelInfo(int id) => m_configDataLoader.GetConfigDataReelInfo(id);
    public ConfigDataLineInfo GetConfigDataLineInfo(int id) => m_configDataLoader.GetConfigDataLineInfo(id);
    public ConfigDataLureRigInfo GetConfigDataLureRigInfo(int id) => m_configDataLoader.GetConfigDataLureRigInfo(id);
    
    public ActorPartGraphConfig GetActorPartGraphConfig(string id) { /* 实现：从配置加载 ActorPartGraphConfig */ return null; }
}
```

### 5.2. `IStageActor` 接口定义

`IStageActor` 是一个通用接口，代表任何可以在 `StageActorViewUITask` 中展示的实体。

```csharp
// Assets/GameProject/Scripts/Runtime/StageActor/IStageActor.cs
using System.Collections.Generic;
using UnityEngine;

public interface IStageActor
{
    string ActorId { get; }
    GameObject GameObject { get; } // 舞台Actor的根GameObject
    Transform RootTransform { get; } // GameObject的Transform

    // 收集自身所需的资源路径，用于预加载
    void CollectResourcePaths(List<string> resPathList, IActorPartGraphBuilder actorPartGraphBuilder, IConfigDataProvider configDataProvider);

    // 组装方法：在资源加载完成后，负责实例化GameObject并进行内部配置
    // 此时传入 loadedResources 和必要的服务
    void Assemble(string actorPartGraphConfigId, IReadOnlyDictionary<string, Object> loadedResources, 
                  IAssetProvider assetProvider, IConfigDataProvider configDataProvider, 
                  IActorPartGraphBuilder actorPartGraphBuilder, IAttachmentService attachmentService);

    // 将Actor放置到指定父级Transform下，并进行必要的变换设置
    void Place(Transform parentTransform);

    // 清理Actor资源和状态
    void Cleanup();

    // 暴露Actor内部的挂载点
    IReadOnlyDictionary<string, Transform> GetAttachmentPoints();
}
```

### 5.3. `TackleStageActor` 实现方案

`TackleStageActor` 是 `IStageActor` 的一个具体实现，它会包装一个由 `TackleActorController` 管理的钓具 GameObject。

```csharp
// Assets/GameProject/Scripts/Runtime/StageActor/TackleStageActor.cs
using System.Collections.Generic;
using UnityEngine;

public class TackleStageActor : IStageActor
{
    private string _actorId;
    private GameObject _rootGameObject;
    private TackleActorController _tackleController; // 钓具控制器
    private string _tacklePartGraphConfigId; // 引用通用的 ActorPartGraphConfig ID

    public string ActorId => _actorId;
    public GameObject GameObject => _rootGameObject;
    public Transform RootTransform => _rootGameObject?.transform;

    public TackleStageActor(string actorId, string tacklePartGraphConfigId)
    {
        _actorId = actorId;
        _tacklePartGraphConfigId = tacklePartGraphConfigId;
    }

    public void CollectResourcePaths(List<string> resPathList, IActorPartGraphBuilder actorPartGraphBuilder, IConfigDataProvider configDataProvider)
    {
        ActorPartGraphConfig config = configDataProvider.GetActorPartGraphConfig(_tacklePartGraphConfigId);
        if (config != null)
        {
            resPathList.AddRange(actorPartGraphBuilder.CollectRequiredResources(config, configDataProvider));
        }
    }

    public void Assemble(string actorPartGraphConfigId, IReadOnlyDictionary<string, Object> loadedResources, 
                         IAssetProvider assetProvider, IConfigDataProvider configDataProvider, 
                         IActorPartGraphBuilder actorPartGraphBuilder, IAttachmentService attachmentService)
    {
        if (_rootGameObject != null)
        {
            Debug.LogWarning($"TackleStageActor: Actor '{ActorId}' already assembled. Skipping re-assembly.");
            return;
        }

        ActorPartGraphConfig config = configDataProvider.GetActorPartGraphConfig(actorPartGraphConfigId);
        if (config == null) { Debug.LogError($"TackleStageActor: ActorPartGraphConfig not found for ID '{actorPartGraphConfigId}'."); return; }

        ActorPartGraph graph = actorPartGraphBuilder.Build(config, loadedResources, assetProvider, configDataProvider, attachmentService);
        if (graph != null)
        {
            // 假设钓具的根节点是 graph 中的某个特定节点，例如 MainTackleBody
            // 或者简单地将 graph 中的所有节点都作为子对象
            _rootGameObject = new GameObject($"TackleActorRoot_{ActorId}");
            foreach (var node in graph.Nodes.Values)
            {
                if (node.InstantiatedGameObject != null)
                {
                    node.InstantiatedGameObject.transform.SetParent(_rootGameObject.transform);
                }
            }
            _rootGameObject.name = $"TackleActor_{ActorId}";
            // 可以在这里获取 TackleActorController，如果它被作为 ActorPartNode 附加到某个节点上
            _tackleController = _rootGameObject.GetComponentInChildren<TackleActorController>(); 
            if (_tackleController == null)
            {
                _tackleController = _rootGameObject.AddComponent<TackleActorController>(); // 如果没有，则添加
            }
            _tackleController.Init(); // 初始化控制器
            
            // 将 BaitRigGraph 存储到 TackleActorController 或其他地方
            // _tackleController.SetBaitRigGraph(graph); // 假设 TackleActorController 有此方法
        }
        else
        {
            Debug.LogError($"TackleStageActor: Failed to assemble tackle actor from config '{actorPartGraphConfigId}'.");
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
            _tackleController = null;
        }
    }

    public IReadOnlyDictionary<string, Transform> GetAttachmentPoints()
    {
        // 如果 TackleActor 有内部挂载点，可以在这里返回
        // 例如，如果 TackleActorControllerDesc 中定义了插槽 Transform
        // return _tackleController?.GetComponent<TackleActorControllerDesc>()?.GetSlotTransforms(); 
        return new Dictionary<string, Transform>();
    }
}
```

### 5.4. `CharacterStageActor` 实现方案 (支持换装)

`CharacterStageActor` 将包含其内部配置信息（例如基础模型 ID 和换装部件 ID 列表），并在 `Assemble()` 方法中委托给一个专门的 `ActorPartGraphBuilderTofu` 来完成实际的 `GameObject` 构造和换装部件挂载。

```csharp
// Assets/GameProject/Scripts/Runtime/StageActor/CharacterStageActor.cs
using System.Collections.Generic;
using System.Linq; // 引入 Linq
using UnityEngine;

public class CharacterStageActor : IStageActor
{
    private string _actorId;
    private GameObject _rootGameObject;
    private Dictionary<string, Transform> _attachmentPoints = new Dictionary<string, Transform>();
    
    private string _characterPartGraphConfigId; // 引用通用的 ActorPartGraphConfig ID

    public string ActorId => _actorId;
    public GameObject GameObject => _rootGameObject;
    public Transform RootTransform => _rootGameObject?.transform;

    public CharacterStageActor(string actorId, string characterPartGraphConfigId)
    {
        _actorId = actorId;
        _characterPartGraphConfigId = characterPartGraphConfigId;
    }

    public void CollectResourcePaths(List<string> resPathList, IActorPartGraphBuilder actorPartGraphBuilder, IConfigDataProvider configDataProvider)
    {
        ActorPartGraphConfig config = configDataProvider.GetActorPartGraphConfig(_characterPartGraphConfigId);
        if (config != null)
        {
            resPathList.AddRange(actorPartGraphBuilder.CollectRequiredResources(config, configDataProvider));
        }
    }

    public void Assemble(string actorPartGraphConfigId, IReadOnlyDictionary<string, Object> loadedResources, 
                         IAssetProvider assetProvider, IConfigDataProvider configDataProvider, 
                         IActorPartGraphBuilder actorPartGraphBuilder, IAttachmentService attachmentService)
    {
        if (_rootGameObject != null)
        {
            Debug.LogWarning($"CharacterStageActor: Actor '{ActorId}' already assembled. Skipping re-assembly.");
            return;
        }

        ActorPartGraphConfig config = configDataProvider.GetActorPartGraphConfig(actorPartGraphConfigId);
        if (config == null) { Debug.LogError($"CharacterStageActor: ActorPartGraphConfig not found for ID '{actorPartGraphConfigId}'."); return; }

        ActorPartGraph graph = actorPartGraphBuilder.Build(config, loadedResources, assetProvider, configDataProvider, attachmentService);
        if (graph != null)
        {
            // 假设角色身体是图中的根节点，或者有一个明确的 RootNode
            _rootGameObject = graph.Nodes.Values.FirstOrDefault(node => node.Config.NodeType == ActorPartNodeType.PrefabNode && node.Config.NodeId == "BaseCharacter")?.InstantiatedGameObject;
            if (_rootGameObject == null)
            {
                // 如果没有明确的根节点，选择图中的第一个 PrefabNode 作为根
                _rootGameObject = graph.Nodes.Values.FirstOrDefault(node => node.Config.NodeType == ActorPartNodeType.PrefabNode)?.InstantiatedGameObject;
            }

            if (_rootGameObject != null)
            {
                _rootGameObject.name = $"CharacterActor_{ActorId}";
                // 查找并缓存所有节点的挂载点
                foreach (var node in graph.Nodes.Values)
                {
                    if (node.RuntimePorts != null)
                    {
                        foreach (var port in node.RuntimePorts)
                        {
                            _attachmentPoints[port.Key] = port.Value;
                        }
                    }
                }
            }
            else
            {
                Debug.LogError($"CharacterStageActor: Could not determine root GameObject for character from ActorPartGraph.");
            }
        }
        else
        {
            Debug.LogError($"CharacterStageActor: Failed to assemble character actor from config '{actorPartGraphConfigId}'.");
        }
    }
    
    // FindAttachmentPointsRecursive 辅助方法可以移除，因为挂载点将通过 ActorPartGraph 节点提供
    // private void FindAttachmentPointsRecursive(Transform parent) { /* ... */ } // 移除或调整

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

### 5.5. 钓组 (BaitRig) 架构方案

钓组的组装是钓具中最为复杂的环节，涉及到多个组件（饵、钩、铅坠等）通过子线连接成图结构。本方案将钓组的结构抽象为通用的 `ActorPartGraphConfig`，并通过 `IActorPartGraphBuilder` 进行构建。

#### 5.5.1. `ActorPartGraphConfig` (ScriptableObject)

`ActorPartGraphConfig` 用于定义任何由部件组成的复杂 Actor 的结构，包括钓具、角色等。它包含了 Actor 的名称、类型，以及构成 Actor 的节点（组件）和边（连接）的配置信息。

```csharp
// Assets/GameProject/Scripts/ScriptableObjects/ActorPartGraphConfig.cs
using System.Collections.Generic;
using UnityEngine;

[CreateAssetMenu(fileName = "NewActorPartGraphConfig", menuName = "ProjectEF/Actor/Actor Part Graph Config")]
public class ActorPartGraphConfig : ScriptableObject
{
    public string GraphName;
    public ActorType Type; // 定义这个图是描述什么类型的Actor (例如 Tackle, Character)

    public List<ActorPartNodeConfig> Nodes = new List<ActorPartNodeConfig>();
    public List<ActorPartEdgeConfig> Edges = new List<ActorPartEdgeConfig>();
}

[System.Serializable]
public class ActorPartNodeConfig
{
    public string NodeId; // 节点唯一标识符
    public ActorPartNodeType NodeType; // PrefabNode, CompositeNode, StageActorNode
    public string PrefabPath; // 如果是 PrefabNode，则为 Prefab 路径
    public string ConfigId; // 如果是 CompositeNode 或 StageActorNode，则引用其自身的配置 ID (例如另一个 ActorPartGraphConfig 的 ID)
    public Vector3 LocalPositionOffset; // 相对于父节点的本地位置偏移
    public Vector3 LocalRotationOffset; // 相对于父节点的本地旋转偏移
    public float Weight; // 物理模拟用
    public List<ActorPartPortConfig> Ports = new List<ActorPartPortConfig>(); // 节点内部暴露的连接端口
}

public enum ActorPartNodeType
{
    PrefabNode,       // 实例化一个Prefab
    CompositeNode,    // 引用另一个 ActorPartGraphConfig (例如一个钓组Config)
    StageActorNode    // 引用一个 IStageActor (例如一个渔轮Actor)
}

[System.Serializable]
public class ActorPartPortConfig
{
    public string PortId; // 端口的唯一标识符（例如“手部挂载点”、“鱼线连接槽”）
    public string PortTransformName; // 端口在节点 Prefab 内部的 Transform 名称（例如 Hand_R_Mount）
    public ActorPartPortType PortType; // 端口类型
}

public enum ActorPartPortType
{
    AttachmentSlot,     // 用于挂载其他 Actor 或部件
    LineConnection,     // 用于连接线段 (如钓线、子线)
    RigidConnection,    // 刚性连接点
    // ... 其他端口类型
}

[System.Serializable]
public class ActorPartEdgeConfig
{
    public string EdgeId; // 唯一标识符
    public string StartNodeId; // 起始节点ID
    public string StartPortId; // 起始节点上的端口ID
    public string EndNodeId; // 结束节点ID
    public string EndPortId; // 结束节点上的端口ID
    public ActorPartConnectionType ConnectionType; // Line, Rigid

    public LinePropertiesConfig LineProperties; // 如果是 Line 类型，则包含线段属性
}

public enum ActorPartConnectionType
{
    Line,   // 线段连接 (例如鱼线、子线)
    Rigid   // 刚性连接 (例如螺丝固定)
}

[System.Serializable]
public class LinePropertiesConfig
{
    public float Length;
    public float Radius;
    public string MaterialPath;
}

public enum ActorType { Generic, Tackle, Character } // 用于 ActorPartGraphConfig 的 Type字段
```

#### 5.5.2. `ActorPartGraph` (运行时数据结构)

`ActorPartGraph` 表示已构建的 Actor 部件的运行时图结构，持有所有实例化节点（GameObject 或 IStageActor）的引用及其连接关系。它提供了对 Actor 内部节点和边的访问，以及获取特定端口的方法。

```csharp
// Assets/GameProject/Scripts/Runtime/Actor/ActorPartGraph.cs
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public class ActorPartGraph
{
    public Dictionary<string, ActorPartNode> Nodes { get; private set; } = new Dictionary<string, ActorPartNode>();
    public List<ActorPartEdge> Edges { get; private set; } = new List<ActorPartEdge>();

    // 获取特定类型的节点，例如获取根节点
    public ActorPartNode GetRootNode()
    {
        // 假设约定有一个 NodeId 为 "Root" 的节点作为根
        return Nodes.TryGetValue("Root", out var root) ? root : Nodes.Values.FirstOrDefault();
    }
}

public class ActorPartNode
{
    public ActorPartNodeConfig Config { get; private set; }
    public GameObject InstantiatedGameObject { get; private set; } // 节点实例化出的 GameObject
    public IStageActor InstantiatedStageActor { get; private set; } // 如果 NodeType 是 StageActorNode
    public Dictionary<string, Transform> RuntimePorts { get; private set; } = new Dictionary<string, Transform>(); // 运行时解析出的端口 Transform

    public ActorPartNode(ActorPartNodeConfig config)
    {
        Config = config;
    }

    public void SetInstantiatedObject(GameObject go)
    {
        InstantiatedGameObject = go;
        // 在这里解析 GameObject 内部的 PortTransformName，填充 RuntimePorts
        foreach (var portConfig in Config.Ports)
        {
            Transform portTransform = go.transform.Find(portConfig.PortTransformName); // 假设通过 Find 查找
            if (portTransform != null)
            {
                RuntimePorts[portConfig.PortId] = portTransform;
            }
            else
            {
                Debug.LogWarning($"ActorPartNode: Port Transform '{portConfig.PortTransformName}' not found for Node '{Config.NodeId}'.");
            }
        }
    }

    public void SetInstantiatedStageActor(IStageActor actor)
    {
        InstantiatedStageActor = actor;
        InstantiatedGameObject = actor.GameObject; // 引用 StageActor 的 GameObject
        // 从 StageActor 接口获取挂载点，作为 RuntimePorts
        foreach (var entry in actor.GetAttachmentPoints())
        {
            RuntimePorts[entry.Key] = entry.Value;
        }
    }
}

public class ActorPartEdge
{
    public ActorPartEdgeConfig Config { get; private set; }
    public ActorPartNode StartNode { get; private set; }
    public Transform StartPort { get; private set; } // 运行时起始端口 Transform
    public ActorPartNode EndNode { get; private set; }
    public Transform EndPort { get; private set; } // 运行时结束端口 Transform
    public GameObject ConnectionObject { get; private set; } // 如果是 Line 类型，则为 LineRenderer 的 GameObject

    public ActorPartEdge(ActorPartEdgeConfig config, ActorPartNode startNode, Transform startPort, ActorPartNode endNode, Transform endPort)
    {
        Config = config;
        StartNode = startNode;
        StartPort = startPort;
        EndNode = endNode;
        EndPort = endPort;
    }

    public void SetConnectionObject(GameObject go)
    {
        ConnectionObject = go;
    }
}
```

#### 5.5.3. `IActorPartGraphBuilder` 接口与实现

`IActorPartGraphBuilder` 接口定义了构建通用 Actor 部件图的通用行为。它将负责遍历 `ActorPartGraphConfig`，实例化节点，建立连接。

```csharp
// Assets/GameProject/Scripts/Runtime/Actor/IActorPartGraphBuilder.cs
using System.Collections.Generic;
using UnityEngine;

public interface IActorPartGraphBuilder
{
    ActorPartGraph Build(ActorPartGraphConfig config, IReadOnlyDictionary<string, Object> loadedResources, 
                         IAssetProvider assetProvider, IConfigDataProvider configDataProvider, 
                         IAttachmentService attachmentService);
    List<string> CollectRequiredResources(ActorPartGraphConfig config, IConfigDataProvider configDataProvider);
}

// Assets/GameProject/Scripts/Runtime/Actor/DefaultActorPartGraphBuilder.cs
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public class DefaultActorPartGraphBuilder : IActorPartGraphBuilder
{
    public ActorPartGraph Build(ActorPartGraphConfig config, IReadOnlyDictionary<string, Object> loadedResources, 
                                 IAssetProvider assetProvider, IConfigDataProvider configDataProvider, 
                                 IAttachmentService attachmentService)
    {
        var graph = new ActorPartGraph();
        var instantiatedNodes = new Dictionary<string, ActorPartNode>();

        // 1. 实例化所有节点
        foreach (var nodeConfig in config.Nodes)
        {
            ActorPartNode node = new ActorPartNode(nodeConfig);
            graph.Nodes.Add(nodeConfig.NodeId, node);
            instantiatedNodes.Add(nodeConfig.NodeId, node);

            switch (nodeConfig.NodeType)
            {
                case ActorPartNodeType.PrefabNode:
                    GameObject go = assetProvider.InstantiatePrefab(nodeConfig.PrefabPath);
                    if (go != null)
                    {
                        go.transform.localPosition = nodeConfig.LocalPositionOffset;
                        go.transform.localRotation = Quaternion.Euler(nodeConfig.LocalRotationOffset);
                        node.SetInstantiatedObject(go); // 设置 GameObject 并解析 RuntimePorts
                    }
                    else
                    {
                        Debug.LogError($"ActorPartGraphBuilder: Failed to instantiate PrefabNode: {nodeConfig.PrefabPath}");
                    }
                    break;
                case ActorPartNodeType.CompositeNode:
                    // 递归构建子图
                    ActorPartGraphConfig subGraphConfig = configDataProvider.GetActorPartGraphConfig(nodeConfig.ConfigId);
                    if (subGraphConfig != null)
                    {
                        ActorPartGraph subGraph = Build(subGraphConfig, loadedResources, assetProvider, configDataProvider, attachmentService);
                        if (subGraph != null)
                        {
                            // 将子图的根节点作为当前 CompositeNode 的 GameObject
                            GameObject subGraphRoot = new GameObject($"CompositeNode_{nodeConfig.NodeId}");
                            foreach (var subNode in subGraph.Nodes.Values)
                            {
                                if (subNode.InstantiatedGameObject != null)
                                {
                                    subNode.InstantiatedGameObject.transform.SetParent(subGraphRoot.transform);
                                }
                            }
                            subGraphRoot.transform.localPosition = nodeConfig.LocalPositionOffset;
                            subGraphRoot.transform.localRotation = Quaternion.Euler(nodeConfig.LocalRotationOffset);
                            node.SetInstantiatedObject(subGraphRoot); // 设置 GameObject 并解析 RuntimePorts
                            // 将子图的 RuntimePorts 合并到当前节点的 RuntimePorts
                            foreach (var port in subGraph.Nodes.Values.SelectMany(n => n.RuntimePorts))
                            {
                                node.RuntimePorts[port.Key] = port.Value;
                            }
                        }
                    }
                    break;
                case ActorPartNodeType.StageActorNode:
                    // 假设这里直接创建 IStageActor 实例，并传入其 configId
                    // 这里需要一个机制来根据 ConfigId 创建正确的 IStageActor 实例
                    // 可以通过工厂模式或 ServiceLocator 获取 IStageActor 实例
                    // 简化示例：
                    IStageActor stageActor = null; // = StageActorFactory.Create(nodeConfig.ConfigId);
                    if (stageActor != null)
                    {
                        // 组装 StageActor
                        stageActor.Assemble(nodeConfig.ConfigId, loadedResources, assetProvider, configDataProvider, this, attachmentService);
                        node.SetInstantiatedStageActor(stageActor); // 设置 StageActor 并解析 RuntimePorts
                    }
                    break;
            }
        }

        // 2. 建立所有边连接
        foreach (var edgeConfig in config.Edges)
        {
            if (!instantiatedNodes.TryGetValue(edgeConfig.StartNodeId, out var startNode) ||
                !instantiatedNodes.TryGetValue(edgeConfig.EndNodeId, out var endNode))
            {
                Debug.LogError($"ActorPartGraphBuilder: Missing start or end node for edge: {edgeConfig.EdgeId}");
                continue;
            }

            // 获取起始端口和结束端口的 Transform
            Transform startPortTransform = startNode.RuntimePorts.TryGetValue(edgeConfig.StartPortId, out var sp) ? sp : null;
            Transform endPortTransform = endNode.RuntimePorts.TryGetValue(edgeConfig.EndPortId, out var ep) ? ep : null;

            if (startPortTransform == null)
            {
                Debug.LogError($"ActorPartGraphBuilder: Missing start port Transform '{edgeConfig.StartPortId}' on node '{edgeConfig.StartNodeId}' for edge: {edgeConfig.EdgeId}");
                continue;
            }
            if (endPortTransform == null)
            {
                Debug.LogError($"ActorPartGraphBuilder: Missing end port Transform '{edgeConfig.EndPortId}' on node '{edgeConfig.EndNodeId}' for edge: {edgeConfig.EdgeId}");
                continue;
            }

            switch (edgeConfig.ConnectionType)
            {
                case ActorPartConnectionType.Line:
                    // 创建 LineRenderer 或 UILinePhysicsSimulator
                    GameObject lineGo = new GameObject($"ConnectionLine_{edgeConfig.EdgeId}");
                    lineGo.transform.SetParent(startPortTransform); // 挂载到起始端口下
                    LineRenderer lr = lineGo.AddComponent<LineRenderer>();
                    lr.material = assetProvider.LoadAsset<Material>(edgeConfig.LineProperties.MaterialPath);
                    lr.startWidth = edgeConfig.LineProperties.Radius * 2;
                    lr.endWidth = edgeConfig.LineProperties.Radius * 2;
                    lr.positionCount = 2;
                    lr.useWorldSpace = false;
                    lr.SetPosition(0, lineGo.transform.InverseTransformPoint(startPortTransform.position));
                    lr.SetPosition(1, lineGo.transform.InverseTransformPoint(endPortTransform.position));
                    
                    ActorPartEdge lineEdge = new ActorPartEdge(edgeConfig, startNode, startPortTransform, endNode, endPortTransform);
                    lineEdge.SetConnectionObject(lineGo);
                    graph.Edges.Add(lineEdge);
                    break;
                case ActorPartConnectionType.Rigid:
                    // 刚性连接：直接设置父子关系
                    endPortTransform.SetParent(startPortTransform);
                    endPortTransform.localPosition = Vector3.zero;
                    endPortTransform.localRotation = Quaternion.identity;
                    ActorPartEdge rigidEdge = new ActorPartEdge(edgeConfig, startNode, startPortTransform, endNode, endPortTransform);
                    graph.Edges.Add(rigidEdge); // 记录连接关系
                    break;
            }
        }
        return graph;
    }

    public List<string> CollectRequiredResources(ActorPartGraphConfig config, IConfigDataProvider configDataProvider)
    {
        var paths = new List<string>();
        foreach (var nodeConfig in config.Nodes)
        {
            switch (nodeConfig.NodeType)
            {
                case ActorPartNodeType.PrefabNode:
                    if (!string.IsNullOrEmpty(nodeConfig.PrefabPath)) paths.Add(nodeConfig.PrefabPath);
                    break;
                case ActorPartNodeType.CompositeNode:
                    // 递归收集子图资源
                    ActorPartGraphConfig subGraphConfig = configDataProvider.GetActorPartGraphConfig(nodeConfig.ConfigId);
                    if (subGraphConfig != null) paths.AddRange(CollectRequiredResources(subGraphConfig, configDataProvider));
                    break;
                case ActorPartNodeType.StageActorNode:
                    // 假设 IStageActor 的 CollectResourcePaths 方法能够被调用
                    // 这里需要根据 configId 获取对应的 IStageActor 实例，并调用其 CollectResourcePaths
                    // 例如：IStageActor tempActor = configDataProvider.GetStageActorInstance(nodeConfig.ConfigId); tempActor?.CollectResourcePaths(paths, this, configDataProvider);
                    break;
            }
        }
        foreach (var edgeConfig in config.Edges)
        {
            if (edgeConfig.ConnectionType == ActorPartConnectionType.Line && edgeConfig.LineProperties != null && !string.IsNullOrEmpty(edgeConfig.LineProperties.MaterialPath))
            {
                paths.Add(edgeConfig.LineProperties.MaterialPath);
            }
        }
        return paths.Distinct().ToList();
    }
}
```

### 5.6. `ActorPartGraphBuilderTofu` 实现方案

`ActorPartGraphBuilderTofu` 将作为 `IActorPartGraphBuilder` 的实现，并作为 `UITask` 的 Tofu 组件。

```csharp
// Assets/GameProject/Scripts/Runtime/Actor/ActorPartGraphBuilderTofu.cs
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using BlackJack.BJFramework.Runtime.UI;

public class ActorPartGraphBuilderTofu : UITaskCompTofuBase, IActorPartGraphBuilder
{
    private readonly IAssetProvider _assetProvider;
    private readonly IConfigDataProvider _configDataProvider;
    private readonly IAttachmentService _attachmentService;

    public ActorPartGraphBuilderTofu(IUITaskCompOwnerBase owner, IAssetProvider assetProvider, IConfigDataProvider configDataProvider, IAttachmentService attachmentService) : base(owner)
    {
        _assetProvider = assetProvider;
        _configDataProvider = configDataProvider;
        _attachmentService = attachmentService;
    }

    public ActorPartGraph Build(ActorPartGraphConfig config, IReadOnlyDictionary<string, Object> loadedResources, 
                                 IAssetProvider assetProvider, IConfigDataProvider configDataProvider, 
                                 IAttachmentService attachmentService)
    {
        // 委托给 DefaultActorPartGraphBuilder 实际构建逻辑
        // 这里可以根据需要，传入 Tofu 内部的依赖或传入 Assemble 方法的参数
        DefaultActorPartGraphBuilder builder = new DefaultActorPartGraphBuilder(); // 示例：直接实例化
        return builder.Build(config, loadedResources, assetProvider, configDataProvider, attachmentService);
    }

    public List<string> CollectRequiredResources(ActorPartGraphConfig config, IConfigDataProvider configDataProvider)
    {
        DefaultActorPartGraphBuilder builder = new DefaultActorPartGraphBuilder(); // 示例：直接实例化
        return builder.CollectRequiredResources(config, configDataProvider);
    }
}
```

### 5.7. `AttachmentServiceTofu` 实现方案

`AttachmentServiceTofu` 是一个 `UITaskCompTofuBase`，封装了 Actor 之间的通用挂载逻辑，并实现了 `IAttachmentService` 接口。

```csharp
// Assets/GameProject/Scripts/Runtime/Attachment/AttachmentServiceTofu.cs
using System.Collections.Generic;
using UnityEngine;
using BlackJack.BJFramework.Runtime.UI;

public interface IAttachmentService 
{
    bool AttachActor(IStageActor parentActor, IStageActor childActor, string attachmentPointName);
    bool DetachActor(IStageActor parentActor, IStageActor childActor);
}

public class AttachmentServiceTofu : UITaskCompTofuBase, IAttachmentService
{
    public AttachmentServiceTofu(IUITaskCompOwnerBase owner) : base(owner) { }

    public bool AttachActor(IStageActor parentActor, IStageActor childActor, string attachmentPointName)
    {
        if (parentActor == null || childActor == null || string.IsNullOrEmpty(attachmentPointName))
        {
            Debug.LogError("AttachmentServiceTofu: Parent, child actor or attachment point name is null/empty.");
            return false;
        }

        var attachmentPoints = parentActor.GetAttachmentPoints();
        if (!attachmentPoints.TryGetValue(attachmentPointName, out Transform mountPoint))
        {
            Debug.LogError($"AttachmentServiceTofu: Attachment point '{attachmentPointName}' not found on parent actor '{parentActor.ActorId}'.");
            return false;
        }

        if (childActor.GameObject == null)
        {
            Debug.LogError($"AttachmentServiceTofu: Child actor '{childActor.ActorId}' GameObject is null, cannot attach.");
            return false;
        }

        childActor.GameObject.transform.SetParent(mountPoint);
        childActor.GameObject.transform.localPosition = Vector3.zero;
        childActor.GameObject.transform.localRotation = Quaternion.identity;
        childActor.GameObject.transform.localScale = Vector3.one;

        Debug.Log($"AttachmentServiceTofu: Successfully attached child actor '{childActor.ActorId}' to '{parentActor.ActorId}' at '{attachmentPointName}'.");
        return true;
    }

    public bool DetachActor(IStageActor parentActor, IStageActor childActor)
    {
        if (childActor == null || childActor.GameObject == null)
        {
            Debug.LogWarning("AttachmentServiceTofu: Child actor or its GameObject is null, nothing to detach.");
            return false;
        }

        childActor.GameObject.transform.SetParent(null);
        Debug.Log($"AttachmentServiceTofu: Detached child actor '{childActor.ActorId}'.");
        return true;
    }
}
```

### 5.8. `StageActorViewUITaskCompMainTofu` (协调者)

`StageActorViewUITaskCompMainTofu` 作为一个 `UITaskCompTofuBase`，负责创建 `IStageActor` 实例（数据部分），并协调其 `Assemble()` 调用，以及 `AttachmentServiceTofu` 的挂载。

```csharp
// Assets/GameProject/Scripts/Runtime/GameView/UI/StageActorViewUITask/Comp/StageActorViewUITaskCompMainTofu.cs
using System.Collections.Generic;
using UnityEngine;
using BlackJack.BJFramework.Runtime;
using BlackJack.BJFramework.Runtime.UI;

public class StageActorViewUITaskCompMainTofu : UITaskCompTofuBase, IStageActorViewUITaskCompMainTofu
{
    // ... 现有成员

    protected IStageActor m_mainStageActor; // 主Actor (例如 Character)
    protected IStageActor m_attachedStageActor; // 挂载的Actor (例如 Tackle)

    protected ActorPartGraphBuilderTofu m_compActorPartGraphBuilderTofu; // 新增通用构建器Tofu引用
    protected AttachmentServiceTofu m_attachmentServiceTofu; 

    public StageActorViewUITaskCompMainTofu(IUITaskCompOwnerBase owner) : base(owner) { }

    public override bool Initialize()
    {
        if (!base.Initialize()) return false;
        
        // 假设 UITaskOwner 接口扩展了这些方法
        m_compActorPartGraphBuilderTofu = (m_owner as IStageActorViewUITaskCompOwner)?.CompActorPartGraphBuilderGet();
        m_attachmentServiceTofu = (m_owner as IStageActorViewUITaskCompOwner)?.CompAttachmentServiceGet();

        return true;
    }

    public override void UpdateContextSetup(ICustomParamDictionaryReadOnly paramDict, UITaskUpdatePipelineStartType pipelineStartType, params object[] extraParamArr)
    {
        base.UpdateContextSetup(paramDict, pipelineStartType, extraParamArr);

        string mainActorId = paramDict.GetStringParam(StageActorViewUITask.IntentParamKey4MainActorId);
        string characterPartGraphConfigId = paramDict.GetStringParam(StageActorViewUITask.IntentParamKey4CharacterPartGraphConfigId); 
        
        // 创建主Actor实例 (此时仅为逻辑对象，未组装GameObject)
        if (m_mainStageActor != null && m_mainStageActor.ActorId != mainActorId)
        {
            m_mainStageActor.Cleanup();
            m_mainStageActor = null;
        }
        if (m_mainStageActor == null)
        {
            m_mainStageActor = new CharacterStageActor(mainActorId, characterPartGraphConfigId); 
        }

        int tackleConfigId = paramDict.GetIntParam(StageActorViewUITask.IntentParamKey4TackleConfigID, -1); // 旧的钓具配置ID，可以废弃
        string tacklePartGraphConfigId = paramDict.GetStringParam(StageActorViewUITask.IntentParamKey4TacklePartGraphConfigId); // 新增钓具的通用部件图配置ID
        string attachmentPointName = paramDict.GetStringParam(StageActorViewUITask.IntentParamKey4AttachmentPointName);

        // 如果存在钓具配置，则创建钓具Actor实例 (此时仅为逻辑对象，未组装GameObject)
        if (!string.IsNullOrEmpty(tacklePartGraphConfigId)) // 使用新的配置ID判断
        {
            if (m_attachedStageActor != null) { m_attachedStageActor.Cleanup(); m_attachedStageActor = null; }
            m_attachedStageActor = new TackleStageActor($"AttachedTackle_{tacklePartGraphConfigId}", tacklePartGraphConfigId); 
        } else {
            if (m_attachedStageActor != null) { m_attachedStageActor.Cleanup(); m_attachedStageActor = null; }
        }
    }

    public override void DynamicResCollect4Load(ref List<string> resPathList)
    {
        var configDataProvider = (m_owner as IConfigDataProvider); // 假设 UITask 实现了 IConfigDataProvider
        m_mainStageActor?.CollectResourcePaths(resPathList, m_compActorPartGraphBuilderTofu, configDataProvider);
        m_attachedStageActor?.CollectResourcePaths(resPathList, m_compActorPartGraphBuilderTofu, configDataProvider);
    }

    public override void ViewUpdate(IUITaskUpdatePipelineController pipelineCtrl)
    {
        if (m_mainStageActor == null || m_mainUICtrl == null)
        {
            Debug.LogError("MainStageActor or MainUICtrl is null, cannot display.");
            return;
        }

        var loadedResources = m_owner.CompDynamicResourceCacheManagerGet().DynamicResCacheDictGet();
        var assetProvider = new DefaultAssetProvider(loadedResources); 
        var configDataProvider = (m_owner as IConfigDataProvider); 

        // 1. 组装主Actor (实例化GameObject)
        string mainActorPartGraphConfigId = m_owner.CompUIIntentInfoGet().UIIntentGet().GetStringParam(StageActorViewUITask.IntentParamKey4CharacterPartGraphConfigId);
        m_mainStageActor.Assemble(mainActorPartGraphConfigId, loadedResources, assetProvider, configDataProvider, m_compActorPartGraphBuilderTofu, m_attachmentServiceTofu);

        // 2. 展示主Actor到舞台 (由 UIController 负责挂载到其内部的 ActorAnchor)
        m_mainUICtrl.StageActorDisplay(m_mainStageActor);
        
        // 3. 组装挂载Actor (实例化GameObject)
        if (m_attachedStageActor != null)
        {
            string tacklePartGraphConfigId = m_owner.CompUIIntentInfoGet().UIIntentGet().GetStringParam(StageActorViewUITask.IntentParamKey4TacklePartGraphConfigId);
            m_attachedStageActor.Assemble(tacklePartGraphConfigId, loadedResources, assetProvider, configDataProvider, m_compActorPartGraphBuilderTofu, m_attachmentServiceTofu);
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
                m_attachedStageActor.Place(m_mainStageActor.RootTransform);
            }
        }
        (m_owner as StageActorViewUITask)?.OnEventActorReady(m_mainStageActor);
    }
}
```

### 5.10. `StageActorViewUITask` 的 `UIIntent` 更新

`UIIntent` 需要新增参数来传递主 Actor 的通用部件图配置 ID、钓具的通用部件图配置 ID 和挂载点名称。

```csharp
// Assets/GameProject/Scripts/Runtime/GameView/UI/StageActorViewUITask/StageActorViewUITask.cs
public class StageActorViewUITask : UITaskBase, IStageActorViewUITask, IStageActorViewUITaskCompOwner
{
    // ... 现有代码

    public static UIIntentCustom StageActorViewUIIntentCreate(
        string mainActorId, 
        string characterPartGraphConfigId, // 使用通用的部件图配置ID
        string scenePreset,
        string tacklePartGraphConfigId = null, // 新增钓具的通用部件图配置ID
        string attachmentPointName = null,
        bool actorDragEnabled = true,
        bool cameraControlEnabled = true)
    {
        var uiIntent = new UIIntentCustom(nameof(StageActorViewUITask));
        uiIntent.SetParam(IntentParamKey4MainActorId, mainActorId);
        uiIntent.SetParam(IntentParamKey4CharacterPartGraphConfigId, characterPartGraphConfigId); 
        uiIntent.SetParam(IntentParamKey4StagePreset, scenePreset);
        uiIntent.SetParam(IntentParamKey4TacklePartGraphConfigId, tacklePartGraphConfigId); // 传递钓具的通用部件图配置ID
        uiIntent.SetParam(IntentParamKey4AttachmentPointName, attachmentPointName);
        uiIntent.SetParam(IntentParamKeyKey4ActorDragEnabled, actorDragEnabled);
        uiIntent.SetParam(IntentParamKey4CameraControlEnabled, cameraControlEnabled);
        return uiIntent;
    }

    #region static和常量
    public const string IntentParamKey4MainActorId = "MainActorId";
    public const string IntentParamKey4CharacterPartGraphConfigId = "CharacterPartGraphConfigId"; // 更改为通用部件图配置ID
    public const string IntentParamKey4TacklePartGraphConfigId = "TacklePartGraphConfigId"; // 新增
    public const string IntentParamKey4AttachmentPointName = "AttachmentPointName";
    public const string IntentParamKeyKey4ActorDragEnabled = "ActorDragEnabled"; // 确保存在
    // ... 其他常量
    #endregion

    // 假设 UITaskOwner 接口扩展了 CompActorPartGraphBuilderGet(), CompAttachmentServiceGet()
    public IActorPartGraphBuilder CompActorPartGraphBuilderGet()
    {
        return m_compActorPartGraphBuilderTofu; 
    }
    public IAttachmentService CompAttachmentServiceGet()
    {
        return m_attachmentServiceTofu; 
    }
}
```

## 6. UML 类图 (关键类与继承/依赖关系)

```mermaid
classDiagram
    direction LR

    class TaskManager {
        +Tick()
        +RegisterTask(Task)
        +UnregisterTask(Task)
    }

    class Task {
        <<abstract>>
        +Start()
        +Stop()
        +Pause()
        +Resume()
        +Tick()
    }

    class UITaskBase {
        <<abstract>>
        +AllCompTofuConstruct()
        +LayerDescArray
        +UIControllerDescArray
        +CustomParamKey4UIIntentDefineArray
        +CustomParamKey4UpdatePipelineDefineArray
        +ModeDefineList4Register
        +CompTofuManagerGet()
        +CompDynamicResourceCacheManagerGet()
        +CompUIIntentInfoGet()
    }

    class UITaskCompTofuBase {
        <<abstract>>
        +Initialize()
        +UpdateContextSetup()
        +DynamicResCollect4Load()
        +ViewUpdate()
        +OnUITaskStop()
    }

    class IUITaskCompOwnerBase {
        <<interface>>
        +CompDynamicResourceCacheManagerGet()
        +CompUIIntentInfoGet()
        +CompTofuManagerGet()
        +CompLayerManagerGet()
        +CompUIControllerManagerGet()
        +CompActorPartGraphBuilderGet(): IActorPartGraphBuilder
        +CompAttachmentServiceGet(): IAttachmentService
    }
    
    class IAssetProvider {
        <<interface>>
        +LoadAsset<T>(path)
        +InstantiatePrefab(path)
    }

    class IConfigDataProvider {
        <<interface>>
        +GetConfigDataRodInfo(id)
        +GetConfigDataReelInfo(id)
        +GetConfigDataLineInfo(id)
        +GetConfigDataLureRigInfo(id)
        +GetActorPartGraphConfig(id): ActorPartGraphConfig
    }

    class IStageActor {
        <<interface>>
        +ActorId: string
        +GameObject: GameObject
        +RootTransform: Transform
        +CollectResourcePaths(List<string>, IActorPartGraphBuilder, IConfigDataProvider)
        +Assemble(string actorPartGraphConfigId, IReadOnlyDictionary<string, Object>, IAssetProvider, IConfigDataProvider, IActorPartGraphBuilder, IAttachmentService)
        +Place(Transform)
        +Cleanup()
        +GetAttachmentPoints(): IReadOnlyDictionary<string, Transform>
    }

    class IAttachmentService {
        <<interface>>
        +AttachActor(IStageActor, IStageActor, string)
        +DetachActor(IStageActor, IStageActor)
    }

    class TackleActorController {
        +Init()
        +RodWithHandleSet(GameObject)
        +ReelSet(GameObject)
        +LineSet(GameObject)
        +GetComponent<TackleActorControllerDesc>()
    }

    class TackleActorControllerDesc {
        +m_lineTransformRoot: Transform
    }

    class ActorPartGraphConfig {
        +GraphName: string
        +Type: ActorType
        +Nodes: List<ActorPartNodeConfig>
        +Edges: List<ActorPartEdgeConfig>
    }

    class ActorPartNodeConfig {
        +NodeId: string
        +NodeType: ActorPartNodeType
        +PrefabPath: string
        +ConfigId: string
        +LocalPositionOffset: Vector3
        +LocalRotationOffset: Vector3
        +Weight: float
        +Ports: List<ActorPartPortConfig>
    }

    enum ActorPartNodeType { PrefabNode, CompositeNode, StageActorNode }

    class ActorPartPortConfig {
        +PortId: string
        +PortTransformName: string
        +PortType: ActorPartPortType
    }

    enum ActorPartPortType { AttachmentSlot, LineConnection, RigidConnection }

    class ActorPartEdgeConfig {
        +EdgeId: string
        +StartNodeId: string
        +StartPortId: string
        +EndNodeId: string
        +EndPortId: string
        +ConnectionType: ActorPartConnectionType
        +LineProperties: LinePropertiesConfig
    }

    enum ActorPartConnectionType { Line, Rigid }

    class LinePropertiesConfig {
        +Length: float
        +Radius: float
        +MaterialPath: string
    }

    class ActorPartGraph {
        +Nodes: Dictionary<string, ActorPartNode>
        +Edges: List<ActorPartEdge>
    }

    class ActorPartNode {
        +Config: ActorPartNodeConfig
        +InstantiatedGameObject: GameObject
        +InstantiatedStageActor: IStageActor
        +RuntimePorts: Dictionary<string, Transform>
    }

    class ActorPartEdge {
        +Config: ActorPartEdgeConfig
        +StartNode: ActorPartNode
        +StartPort: Transform
        +EndNode: ActorPartNode
        +EndPort: Transform
        +ConnectionObject: GameObject
    }

    class IActorPartGraphBuilder {
        <<interface>>
        +Build(ActorPartGraphConfig, IReadOnlyDictionary<string, Object>, IAssetProvider, IConfigDataProvider, IAttachmentService): ActorPartGraph
        +CollectRequiredResources(ActorPartGraphConfig, IConfigDataProvider): List<string>
    }


    TaskManager <.. Task
    Task <|-- UITaskBase
    UITaskBase <|-- StageActorViewUITask
    UITaskBase <|-- TackleAssembleTackleUITask

    UITaskCompTofuBase <|-- StageActorViewUITaskCompMainTofu
    UITaskCompTofuBase <|-- ActorPartGraphBuilderTofu
    UITaskCompTofuBase <|-- AttachmentServiceTofu

    IUITaskCompOwnerBase <|-- StageActorViewUITask
    IUITaskCompOwnerBase <|-- ITackleAssembleTackleUITaskCompOwner
    ITackleAssembleTackleUITaskCompOwner <|-- TackleAssembleTackleUITask

    IStageActor <|-- TackleStageActor
    IStageActor <|-- CharacterStageActor

    IAttachmentService <|-- AttachmentServiceTofu

    IActorPartGraphBuilder <|-- DefaultActorPartGraphBuilder // Example implementation

    StageActorViewUITask ..> StageActorViewUITaskCompMainTofu : owns m_compMainTofu
    StageActorViewUITask ..> ActorPartGraphBuilderTofu : owns m_compActorPartGraphBuilderTofu
    StageActorViewUITask ..> AttachmentServiceTofu : owns m_attachmentServiceTofu

    StageActorViewUITaskCompMainTofu --> ActorPartGraphBuilderTofu : uses
    StageActorViewUITaskCompMainTofu --> AttachmentServiceTofu : uses

    TackleStageActor --> IActorPartGraphBuilder : uses in Assemble
    CharacterStageActor --> IActorPartGraphBuilder : uses in Assemble

    ActorPartGraphBuilderTofu --> IAssetProvider
    ActorPartGraphBuilderTofu --> IConfigDataProvider
    ActorPartGraphBuilderTofu --> IAttachmentService

    AttachmentServiceTofu --> IStageActor
    AttachmentServiceTofu --> GameObject

    StageActorViewUITaskCompMainTofu ..> IStageActor : manages m_mainStageActor, m_attachedStageActor

    TackleActorController "1" o-- "1" TackleActorControllerDesc
    TackleActorControllerDesc "1" *-- "1" Transform : m_lineTransformRoot

    ActorPartGraphConfig "1" *-- "*" ActorPartNodeConfig
    ActorPartGraphConfig "1" *-- "*" ActorPartEdgeConfig
    ActorPartNodeConfig "1" *-- "*" ActorPartPortConfig
    ActorPartGraph "1" *-- "*" ActorPartNode
    ActorPartGraph "1" *-- "*" ActorPartEdge
    ActorPartEdge "1" *-- "2" ActorPartNode


    note for StageActorViewUITask "Inherits from UITaskBase, manages specialized Tofus"
    note for StageActorViewUITaskCompMainTofu "Coordinates StageActor lifecycle, assembly, and attachment"
    note for ActorPartGraphBuilderTofu "Builds generic ActorPartGraph (GameObject hierarchy) based on config"
    note for AttachmentServiceTofu "Provides generic actor attachment/detachment functionality, managed as a Tofu"
    note for IStageActor "Abstracts any entity displayable on stage, responsible for its own GameObject assembly using IActorPartGraphBuilder"
    note for IAssetProvider "Abstracts resource loading from cache/Addressables"
    note for IConfigDataProvider "Abstracts configuration data access"
    note for ActorPartGraphConfig "ScriptableObject defining generic Actor part graph structure"
    note for ActorPartGraph "Runtime representation of assembled Actor parts"
    note for IActorPartGraphBuilder "Interface for building ActorPartGraph"
    note for TackleAssemblyContext "Context object for TackleAssemblyTofu (deprecated in new universal scheme)"
    note for ITacklePartAssembler "Interface for assembling individual tackle parts (deprecated in new universal scheme)"
    note for ICharacterPartAssembler "Interface for assembling individual character parts (deprecated in new universal scheme)"
```

## 7. 综合优势

这个全面修订的方案，通过引入**通用的 `ActorPartGraph` 概念和“端口”连接机制**，并将其与 BJFramework 的组件化和管线机制深度融合，能优雅地处理 `CharacterStageActor` 挂载 `TackleActor` 这种复杂的组合场景，以及 `CharacterStageActor` 和 `TackleActor` 自身的复杂组装：

1.  **极高的通用性和扩展性**:
    *   `ActorPartGraphConfig` 可以描述任何由多个 Prefab、组合部件或 `IStageActor` 组成的复杂实体，无论是钓具、角色、载具还是其他可组装对象。
    *   **“端口”机制**使得节点间的连接更加明确和灵活，能够支持物理连接（刚性）、线缆连接（钓线、子线）和逻辑插槽连接（挂载点）。
    *   `IActorPartGraphBuilder` 提供统一的构建接口，使得新增不同类型的复杂 Actor 组装逻辑时，只需实现新的 Builder，无需修改核心框架代码。
    *   `IStageActor` 接口现在更加通用，其 `Assemble()` 方法通过委托给 `IActorPartGraphBuilder` 来处理内部复杂结构的构建。
2.  **清晰的职责分离**:
    *   `UIIntent`: 传递 Actor 的配置 ID。
    *   `IStageActor` (逻辑实例): 负责持有配置 ID，并在 `Assemble()` 阶段协调其内部结构的构建。
    *   `ActorPartGraphBuilderTofu`: 专注于根据配置构建通用的 `ActorPartGraph` (GameObject 层次)。
    *   `AttachmentServiceTofu`: 专注于通用的 Actor 间挂载逻辑。
    *   `StageActorViewUITaskCompMainTofu`: 专注于编排 `IStageActor` 的生命周期和展示。
3.  **完全符合 BJFramework 理念**:
    *   充分利用 `UITask` 和 `UITaskCompTofuBase` 进行功能模块的封装和生命周期管理。
    *   通过 `UIIntent` 传递参数，驱动 `UpdatePipeline` 的执行。
    *   强调接口和依赖注入，降低模块间的耦合。
    *   资源管理通过 `DynamicResCollect4Load` 与 `IAssetProvider` 结合。
4.  **易于测试**: 各个服务和组件职责单一，更易于进行单元测试。

## 8. 潜在的权衡

1.  **初始设置复杂性增加**: 引入了更抽象的通用部件图概念和端口机制，需要更详细的配置设计和 Builder 实现。
2.  **学习曲线**: 团队成员需要理解新的 `ActorPartGraph` 概念、端口机制和其构建流程。
3.  **配置管理**: `ActorPartGraphConfig` 作为 ScriptableObject 需要良好的管理流程，以确保数据的一致性和正确性。

## 9. 结论

通过引入通用的 `ActorPartGraph` 概念和构建器，并**强化“端口”连接机制**，本方案为 BJFramework 框架下构建高度可定制、可组合的复杂 Actor 提供了一个强大且灵活的架构。它不仅解决了 `TackleStageActorFactory` 的“巨石类”风险，更将钓具和角色组装等复杂需求统一到一个通用且可扩展的框架中，为游戏内容的高度可定制性和未来扩展奠定了坚实的基础，同时完全遵循了 BJFramework 的现有工作流和设计模式。

---