# `TackleStageActorFactory.cs` 架构优化与重构方案

## 1. 引言

`TackleStageActorFactory.cs` 当前作为一个静态工厂类，承担了钓具（Tackle）在UI展示场景中从配置读取、资源加载到GameObject实例化、组件初始化等一系列复杂的组装职责。随着游戏内容的发展，特别是钓组（BaitRig）部分被定义为具有多种配置方案（路亚钓组、德州钓组、沉底钓组等）、由不同数量的饵、钩、铅坠等组件通过子线连接形成的图（Graph）结构，原有的静态工厂模式将迅速演变为一个难以管理和扩展的“巨石类”（God Object）。

本方案旨在解决这一问题，通过引入更细粒度的职责划分、模块化设计和灵活的构建机制，确保钓具组装系统的高可扩展性、可维护性和可测试性，尤其是在处理复杂的钓组结构时。

## 2. “巨石类”风险重申及其影响

`TackleStageActorFactory` 作为一个静态类，其内部包含了所有钓具部件的组装逻辑。当钓组的复杂性上升到图结构时，原有的 `AssembleBaitGroup` 方法将无法有效处理：

*   **职责过度膨胀**: `AssembleBaitGroup` 不仅要实例化钓组的根GameObject，还要负责解析钓组的图结构、实例化图中的每个节点（饵、钩、铅坠等）、创建连接它们的边（子线），并正确设置它们之间的物理连接和视觉表现。这将使得该方法过于庞大和复杂。
*   **难以应对变化**: 每次新增一种钓组类型、修改钓组的结构定义，或引入新的钓组组件时，都需要直接修改 `TackleStageActorFactory` 内部，这严重违反了“开闭原则”（Open/Closed Principle），增加了维护成本和引入bug的风险。
*   **可测试性极低**: 静态方法和紧密耦合的内部逻辑使得对特定钓组组装逻辑进行单元测试几乎不可能。
*   **数据结构与逻辑混杂**: 钓组的图结构定义（数据）将与图的构建逻辑（行为）混杂在一起，难以清晰管理。

## 3. 优化重构目标

*   **解耦钓具各部件组装逻辑**: 将钓竿、渔轮、钓线、钓组的组装职责进一步细化，使它们彼此独立。
*   **引入钓组专用构建机制**: 为复杂的钓组结构设计独立的配置数据、运行时数据结构和构建器，以支持多样化的钓组类型和组件组合。
*   **强化可扩展性**: 使得新增钓组类型或组件时，无需修改核心组装服务。
*   **提高可测试性**: 方便对每个部件的组装逻辑和钓组的图构建逻辑进行单元测试。
*   **抽象资源管理和配置**: 进一步解耦与具体资源加载和配置数据源的依赖。
*   **消除静态状态**: 避免静态成员带来的并发问题和测试难题。

## 4. 新的钓具组装架构模式提议

在原有“服务+部件组装器”架构的基础上，针对钓组部分引入 **组合模式 (Composite Pattern)** 和 **构建器模式 (Builder Pattern)** 的深度应用。

### 核心架构组件：

1.  **`TackleAssemblyService` (非静态)**: 核心协调服务，负责编排整个钓具的组装流程。它将不再直接处理钓组的细节，而是委托给专门的钓组组装器。
2.  **`IAssetProvider` 和 `IConfigDataProvider`**: 抽象资源加载和配置数据访问，保持与底层实现的解耦。
3.  **`ITacklePartAssembler` 接口**: 定义所有部件组装器必须实现的通用接口。
    *   `RodAssembler`
    *   `ReelAssembler`
    *   `LineAssembler` (主钓线)
    *   **`BaitRigAssembler` (新)**: 负责协调钓组的构建，它将依赖 `IBaitRigBuilder`。
    *   `FishingLineRendererAssembler`: 负责主鱼线和钓组内部子线的渲染。
4.  **`BaitRigConfig` (ScriptableObject)**: 钓组的配置数据，定义钓组的类型、组件（饵、钩、铅坠等）以及它们之间的连接关系（图结构）。
    *   包含 `BaitRigNodeType`（饵、钩、铅坠、子线连接点）、`BaitRigNodeConfig`（节点配置数据，如Prefab路径、物理属性）和 `BaitRigEdgeConfig`（边配置数据，如子线长度、材质）。
5.  **`BaitRigGraph` (运行时数据结构)**: 表示已构建的钓组的运行时图结构。
    *   包含 `BaitRigNode`（表示饵、钩、铅坠等组件的运行时实例，持有其GameObject和Transform）和 `BaitRigEdge`（表示子线，持有LineRenderer或物理模拟器）。
6.  **`IBaitRigBuilder` 接口**: 定义构建特定类型钓组的接口。
    *   `Build(BaitRigConfig config, TackleAssemblyContext context)`: 根据配置和上下文构建 `BaitRigGraph`。
7.  **具体 `BaitRigBuilder` 实现**:
    *   `LureRigBuilder` (路亚钓组构建器)
    *   `TexasRigBuilder` (德州钓组构建器)
    *   `BottomRigBuilder` (沉底钓组构建器)
    *   每个构建器负责解析其对应 `BaitRigConfig` 中的图结构，并实例化相应的组件和子线。

### 架构图示（概念性）

```mermaid
graph TD
    A[Client Request Assembly] --> B(TackleAssemblyService)
    B --> C{TackleAssemblyContext}
    C -- IAssetProvider --> D[Resource Loading System]
    C -- IConfigDataProvider --> E[Configuration System]

    B -- Uses --> F(RodAssembler)
    F -- Updates --> G[TackleActorController.Rod]
    B -- Uses --> H(ReelAssembler)
    H -- Updates --> I[TackleActorController.Reel]
    B -- Uses --> J(LineAssembler)
    J -- Updates --> K[TackleActorController.MainLine]
    B -- Uses --> L(BaitRigAssembler)
    L -- Uses --> M(IBaitRigBuilder)
    M -- Builds --> N[BaitRigGraph]
    N -- Contains --> O[BaitRigNode (GameObject)]
    N -- Contains --> P[BaitRigEdge (Sub-Lines)]
    L -- Updates --> Q[TackleActorController.BaitRig]

    B -- Uses --> R(FishingLineRendererAssembler)
    R -- Renders Main Line --> K
    R -- Renders Sub-Lines --> P
```

## 5. 具体重构步骤

### 5.1. 抽象资源加载和配置数据访问 (`IAssetProvider`, `IConfigDataProvider`)

保持原有 `IAssetProvider` 和 `IConfigDataProvider` 接口及实现不变。

```csharp
// IAssetProvider 接口 (保持不变)
public interface IAssetProvider
{
    T LoadAsset<T>(string path) where T : Object;
    GameObject InstantiatePrefab(string path);
    GameObject InstantiatePrefab(GameObject prefab);
}

// DefaultAssetProvider 实现 (保持不变)
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

// IConfigDataProvider 接口 (保持不变)
public interface IConfigDataProvider
{
    ConfigDataRodInfo GetConfigDataRodInfo(int id);
    ConfigDataReelInfo GetConfigDataReelInfo(int id);
    ConfigDataLineInfo GetConfigDataLineInfo(int id);
    ConfigDataLureRigInfo GetConfigDataLureRigInfo(int id);
    // ... 其他配置数据获取方法
}

// DefaultConfigDataProvider 实现 (保持不变)
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
}
```

### 5.2. 定义钓组数据结构 (`BaitRigConfig`, `BaitRigGraph`)

#### 5.2.1. `BaitRigConfig` (ScriptableObject for Configuration)

创建一个 `ScriptableObject` 来定义不同类型的钓组配置。这将允许设计师在 Unity 编辑器中创建和管理复杂的钓组结构。

```csharp
// Assets/GameProject/Scripts/ScriptableObjects/BaitRigConfig.cs
using System.Collections.Generic;
using UnityEngine;

[CreateAssetMenu(fileName = "NewBaitRigConfig", menuName = "Fishing/Bait Rig Config")]
public class BaitRigConfig : ScriptableObject
{
    public string BaitRigName;
    public BaitRigType RigType; // 例如：Lure, Texas, Bottom

    // 钓组中的节点（组件：饵、钩、铅坠、连接点等）
    public List<BaitRigNodeConfig> Nodes = new List<BaitRigNodeConfig>();
    // 钓组中的边（子线连接）
    public List<BaitRigEdgeConfig> Edges = new List<BaitRigEdgeConfig>();
}

[System.Serializable]
public class BaitRigNodeConfig
{
    public string NodeId; // 唯一标识符
    public BaitRigNodeType NodeType; // 饵、钩、铅坠、连接环等
    public string PrefabAssetPath; // 组件Prefab路径
    public Vector3 LocalPositionOffset; // 相对于父节点的本地位置偏移
    public Vector3 LocalRotationOffset; // 相对于父节点的本地旋转偏移
    public float Weight; // 物理模拟用
    // ... 其他组件特定属性
}

public enum BaitRigNodeType
{
    Bait,
    Hook,
    Sinker,
    Swivel, // 连接环
    LineAttachmentPoint, // 钓组内部的纯连接点
    MainLineConnectionPoint // 主线连接到钓组的入口点
}

[System.Serializable]
public class BaitRigEdgeConfig
{
    public string EdgeId; // 唯一标识符
    public string StartNodeId; // 子线起始节点ID
    public string EndNodeId; // 子线结束节点ID
    public float LineLength; // 子线长度
    public float LineRadius; // 子线半径
    public string LineMaterialPath; // 子线材质路径
    // ... 其他子线特定属性
}

public enum BaitRigType
{
    Lure,
    Texas,
    Bottom,
    // ... 更多钓组类型
}
```

#### 5.2.2. `BaitRigGraph` (Runtime Data Structure)

运行时表示已构建的钓组，持有所有实例化组件的引用及其连接关系。

```csharp
// Assets/GameProject/Scripts/Runtime/Tackle/BaitRigGraph.cs
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public class BaitRigGraph
{
    public Dictionary<string, BaitRigNode> Nodes { get; private set; } = new Dictionary<string, BaitRigNode>();
    public List<BaitRigEdge> Edges { get; private set; } = new List<BaitRigEdge>();

    // 获取主线连接点 (如果有)
    public BaitRigNode GetMainLineConnectionNode()
    {
        return Nodes.Values.FirstOrDefault(node => node.Config.NodeType == BaitRigNodeType.MainLineConnectionPoint);
    }
}

public class BaitRigNode
{
    public BaitRigNodeConfig Config { get; private set; }
    public GameObject GameObject { get; private set; }
    public Transform Transform { get; private set; }

    public BaitRigNode(BaitRigNodeConfig config, GameObject gameObject)
    {
        Config = config;
        GameObject = gameObject;
        Transform = gameObject.transform;
    }
}

public class BaitRigEdge
{
    public BaitRigEdgeConfig Config { get; private set; }
    public BaitRigNode StartNode { get; private set; }
    public BaitRigNode EndNode { get; private set; }
    public LineRenderer LineRenderer { get; private set; } // 或 UILinePhysicsSimulator

    public BaitRigEdge(BaitRigEdgeConfig config, BaitRigNode startNode, BaitRigNode endNode)
    {
        Config = config;
        StartNode = startNode;
        EndNode = endNode;
    }

    public void SetLineRenderer(LineRenderer lr)
    {
        LineRenderer = lr;
    }
}
```

### 5.3. 定义钓组构建器接口 (`IBaitRigBuilder`)

```csharp
// Assets/GameProject/Scripts/Runtime/Tackle/IBaitRigBuilder.cs
using System.Collections.Generic;

public interface IBaitRigBuilder
{
    BaitRigType SupportedRigType { get; }
    BaitRigGraph Build(BaitRigConfig config, TackleAssemblyContext context);
    List<string> CollectRequiredResources(BaitRigConfig config); // 用于预加载
}
```

### 5.4. 具体钓组构建器实现 (例如 `LureRigBuilder`)

每个具体的钓组构建器将负责解析其对应 `BaitRigConfig` 的图结构，并实例化组件、创建子线连接。

```csharp
// Assets/GameProject/Scripts/Runtime/Tackle/Builders/LureRigBuilder.cs
using System.Collections.Generic;
using UnityEngine;

public class LureRigBuilder : IBaitRigBuilder
{
    public BaitRigType SupportedRigType => BaitRigType.Lure;

    public BaitRigGraph Build(BaitRigConfig config, TackleAssemblyContext context)
    {
        if (config.RigType != SupportedRigType)
        {
            Debug.LogError($"LureRigBuilder: Mismatched rig type. Expected {SupportedRigType}, got {config.RigType}");
            return null;
        }

        var graph = new BaitRigGraph();
        var instantiatedNodes = new Dictionary<string, BaitRigNode>();

        // 1. 实例化所有节点（饵、钩、铅坠等）
        foreach (var nodeConfig in config.Nodes)
        {
            GameObject nodeGameObject = context.AssetProvider.InstantiatePrefab(nodeConfig.PrefabAssetPath);
            if (nodeGameObject == null)
            {
                Debug.LogError($"LureRigBuilder: Failed to instantiate node prefab: {nodeConfig.PrefabAssetPath}");
                return null; // 或抛出异常
            }
            // 设置初始位置和旋转 (相对于钓组根节点)
            nodeGameObject.transform.localPosition = nodeConfig.LocalPositionOffset;
            nodeGameObject.transform.localRotation = Quaternion.Euler(nodeConfig.LocalRotationOffset);

            var node = new BaitRigNode(nodeConfig, nodeGameObject);
            graph.Nodes.Add(nodeConfig.NodeId, node);
            instantiatedNodes.Add(nodeConfig.NodeId, node);
        }

        // 2. 创建所有边（子线）
        foreach (var edgeConfig in config.Edges)
        {
            if (!instantiatedNodes.TryGetValue(edgeConfig.StartNodeId, out var startNode) ||
                !instantiatedNodes.TryGetValue(edgeConfig.EndNodeId, out var endNode))
            {
                Debug.LogError($"LureRigBuilder: Missing start or end node for edge: {edgeConfig.EdgeId}");
                continue;
            }

            // 创建子线 GameObject 和 LineRenderer
            GameObject subLineObject = new GameObject($"SubLine_{edgeConfig.EdgeId}");
            subLineObject.transform.SetParent(startNode.Transform); // 子线可以挂载到起始节点
            LineRenderer lr = subLineObject.AddComponent<LineRenderer>();
            // 配置 LineRenderer 属性 (材质、颜色、宽度等)
            lr.material = context.AssetProvider.LoadAsset<Material>(edgeConfig.LineMaterialPath);
            lr.startColor = Color.gray; // 示例
            lr.endColor = Color.gray; // 示例
            lr.startWidth = edgeConfig.LineRadius * 2;
            lr.endWidth = edgeConfig.LineRadius * 2;
            lr.positionCount = 2;
            lr.useWorldSpace = false; // 使用本地坐标

            // 设置子线两端点 (需要根据实际连接逻辑来确定，这里简化为直接连接两个节点的世界坐标)
            lr.SetPosition(0, startNode.Transform.InverseTransformPoint(startNode.Transform.position));
            lr.SetPosition(1, startNode.Transform.InverseTransformPoint(endNode.Transform.position));


            var edge = new BaitRigEdge(edgeConfig, startNode, endNode);
            edge.SetLineRenderer(lr); // 存储LineRenderer引用
            graph.Edges.Add(edge);
        }

        // 3. 将所有节点 GameObject 的父级设置为钓组的根节点（由 BaitRigAssembler 提供）
        // 这部分逻辑将由 BaitRigAssembler 完成，因为 BaitRigBuilder 不知道根节点是谁。

        return graph;
    }

    public List<string> CollectRequiredResources(BaitRigConfig config)
    {
        var paths = new List<string>();
        foreach (var nodeConfig in config.Nodes)
        {
            if (!string.IsNullOrEmpty(nodeConfig.PrefabAssetPath))
            {
                paths.Add(nodeConfig.PrefabAssetPath);
            }
        }
        foreach (var edgeConfig in config.Edges)
        {
            if (!string.IsNullOrEmpty(edgeConfig.LineMaterialPath))
            {
                paths.Add(edgeConfig.LineMaterialPath);
            }
        }
        return paths;
    }
}
```

### 5.5. 更新 `TackleAssemblyContext`

`TackleAssemblyContext` 需要包含钓组配置ID和钓组的运行时图结构。

```csharp
// Assets/GameProject/Scripts/Runtime/Tackle/TackleAssemblyContext.cs
using System.Collections.Generic;
using UnityEngine;

public class TackleAssemblyContext
{
    public int RodConfigId { get; }
    public int ReelConfigId { get; }
    public int LineConfigId { get; }
    public int BaitRigConfigId { get; } // 新增钓组配置ID
    public TackleAssembleUISettingsSO Settings { get; }
    public IAssetProvider AssetProvider { get; }
    public IConfigDataProvider ConfigDataProvider { get; }
    public ProExportDataRodInfo RodExportInfo { get; set; }
    public ProExportDataReelInfo ReelExportInfo { get; set; }
    public GameObject BaitRigRootGameObject { get; set; } // 钓组的根GameObject
    public BaitRigGraph AssembledBaitRigGraph { get; set; } // 存储构建好的钓组图

    public TackleAssemblyContext(int rodId, int reelId, int lineId, int baitRigId, TackleAssembleUISettingsSO settings, IAssetProvider assetProvider, IConfigDataProvider configDataProvider)
    {
        RodConfigId = rodId;
        ReelConfigId = reelId;
        LineConfigId = lineId;
        BaitRigConfigId = baitRigId; // 初始化
        Settings = settings;
        AssetProvider = assetProvider;
        ConfigDataProvider = configDataProvider;
    }
}
```

### 5.6. 重构 `BaitRigAssembler`

`BaitRigAssembler` 不再直接构建钓组，而是根据 `BaitRigConfigId` 获取配置，然后选择合适的 `IBaitRigBuilder` 来构建 `BaitRigGraph`。

```csharp
// Assets/GameProject/Scripts/Runtime/Tackle/Assemblers/BaitRigAssembler.cs
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public class BaitRigAssembler : ITacklePartAssembler
{
    private readonly IEnumerable<IBaitRigBuilder> _baitRigBuilders;

    // 通过构造函数注入所有 IBaitRigBuilder 实现
    public BaitRigAssembler(IEnumerable<IBaitRigBuilder> baitRigBuilders)
    {
        _baitRigBuilders = baitRigBuilders;
    }

    public void Assemble(TackleActorController tackleActorController, TackleAssemblyContext context)
    {
        // 1. 获取钓组配置
        var baitRigConf = context.ConfigDataProvider.GetConfigDataLureRigInfo(context.BaitRigConfigId);
        if (baitRigConf == null) { Debug.LogError($"BaitRigAssembler: Failed to get bait rig config for ID {context.BaitRigConfigId}"); return; }

        // 假设 BaitRigConfig 存储在 LureRigInfo 的某个字段中
        // 需要根据实际情况修改 ConfigDataLureRigInfo 结构以引用 BaitRigConfig ScriptableObject
        BaitRigConfig actualBaitRigConfig = context.AssetProvider.LoadAsset<BaitRigConfig>(baitRigConf.BaitRigConfigAssetPath);
        if (actualBaitRigConfig == null) { Debug.LogError($"BaitRigAssembler: Failed to load BaitRigConfig asset from path: {baitRigConf.BaitRigConfigAssetPath}"); return; }


        // 2. 实例化钓组根节点 Prefab
        // 硬编码路径应配置化，例如从 TackleAssembleUISettingsSO 获取
        string baitGroupRootPrefabPath = "Assets/GameProject/RuntimeAssets/UI/UIStageActorView/Prefab/TackleStagePrefab_ABS/BaitGroupRoot.prefab";
        var baitRigRootGameObject = context.AssetProvider.InstantiatePrefab(baitGroupRootPrefabPath);
        if (baitRigRootGameObject == null)
        {
            Debug.LogError($"BaitRigAssembler: Failed to instantiate bait group root prefab: {baitGroupRootPrefabPath}");
            return;
        }

        // 设置钓组根节点到控制器和上下文
        baitRigRootGameObject.transform.SetParent(tackleActorController.GetComponent<TackleActorControllerDesc>().m_lineTransformRoot);
        baitRigRootGameObject.transform.localPosition = Vector3.zero;
        baitRigRootGameObject.transform.localRotation = Quaternion.identity;
        baitRigRootGameObject.transform.localScale = Vector3.one;
        context.BaitRigRootGameObject = baitRigRootGameObject; // 存储根GameObject到上下文

        // 3. 查找对应的 IBaitRigBuilder
        IBaitRigBuilder builder = _baitRigBuilders.FirstOrDefault(b => b.SupportedRigType == actualBaitRigConfig.RigType);
        if (builder == null)
        {
            Debug.LogError($"BaitRigAssembler: No builder found for BaitRigType: {actualBaitRigConfig.RigType}");
            return;
        }

        // 4. 使用 Builder 构建 BaitRigGraph
        BaitRigGraph baitRigGraph = builder.Build(actualBaitRigConfig, context);
        if (baitRigGraph == null)
        {
            Debug.LogError($"BaitRigAssembler: Failed to build BaitRigGraph for config ID {context.BaitRigConfigId}");
            return;
        }
        context.AssembledBaitRigGraph = baitRigGraph; // 存储构建好的图到上下文

        // 5. 将 BaitRigGraph 中的所有节点 GameObject 挂载到 baitRigRootGameObject 下
        foreach (var node in baitRigGraph.Nodes.Values)
        {
            node.GameObject.transform.SetParent(baitRigRootGameObject.transform);
        }

        // 6. （可选）将 BaitRigGraph 中的所有子线 GameObject 挂载到 baitRigRootGameObject 下
        foreach (var edge in baitRigGraph.Edges)
        {
            if (edge.LineRenderer != null)
            {
                edge.LineRenderer.gameObject.transform.SetParent(baitRigRootGameObject.transform);
            }
        }

        // tackleActorController.BaitRigSet(baitRigRootGameObject, baitRigGraph); // 如果 TackleActorController 需要直接引用 BaitRigGraph
    }
}
```

### 5.7. 鱼线集成 (主线与子线)

#### 5.7.1. `FishingLineRendererAssembler` 的更新

该组装器将负责渲染主线（从渔轮到最后一个导环，再到钓组的主线连接点），以及协调钓组内部子线的渲染。

```csharp
// Assets/GameProject/Scripts/Runtime/Tackle/Assemblers/FishingLineRendererAssembler.cs
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public class FishingLineRendererAssembler : ITacklePartAssembler
{
    public void Assemble(TackleActorController tackleActorController, TackleAssemblyContext context)
    {
        // ... (获取 reelSpoolPoint, guideLinePoints 逻辑不变)
        var reelSpoolPoint = FindReelSpoolPoint(tackleActorController); // 辅助方法
        var guideLinePoints = CollectGuideLinePoints(tackleActorController, context.RodExportInfo); // 辅助方法

        if (reelSpoolPoint == null || guideLinePoints.Count < 1 || context.AssembledBaitRigGraph == null)
        {
            Debug.LogWarning("FishingLineRendererAssembler: Missing essential components for line setup.");
            return;
        }

        // 获取钓组的主线连接点
        BaitRigNode mainLineConnectionNode = context.AssembledBaitRigGraph.GetMainLineConnectionNode();
        if (mainLineConnectionNode == null)
        {
            Debug.LogError("FishingLineRendererAssembler: BaitRigGraph does not have a MainLineConnectionPoint.");
            return;
        }

        // 1. 构建主线路径点列表：鱼轮 -> 所有导环LinePoint -> 钓组主线连接点
        var allMainLinePoints = new List<Transform>();
        allMainLinePoints.Add(reelSpoolPoint);
        allMainLinePoints.AddRange(guideLinePoints);
        allMainLinePoints.Add(mainLineConnectionNode.Transform); // 连接到钓组的入口点

        // 2. 根据 LineMode 创建主线渲染
        FishingLineMode lineMode = context.Settings?.LineMode ?? FishingLineMode.PhysicsBased;
        switch (lineMode)
        {
            case FishingLineMode.Legacy:
                CreateLegacyLineRenderer(tackleActorController.TackleRodGet(), "FishingLine_Main_Legacy", allMainLinePoints, context.Settings);
                break;
            case FishingLineMode.PhysicsBased:
                UILinePhysicsSimulator mainLineSimulator = CreatePhysicsBasedFishingLine(tackleActorController.TackleRodGet(), allMainLinePoints, context.Settings);
                // 如果需要，可以将钓组的根GameObject作为物理跟随者，跟随主线末端粒子
                if (mainLineSimulator != null && context.BaitRigRootGameObject != null)
                {
                    AttachBaitGroupPhysicsFollower(context.BaitRigRootGameObject, mainLineSimulator);
                }
                break;
            case FishingLineMode.Hybrid:
                // Hybrid 模式需要更复杂的处理，可能需要分成两段 LineRenderer
                // 鱼轮到最后一个导环 (Legacy)
                var legacySegmentPoints = new List<Transform>();
                legacySegmentPoints.Add(reelSpoolPoint);
                legacySegmentPoints.AddRange(guideLinePoints);
                CreateLegacyLineRenderer(tackleActorController.TackleRodGet(), "FishingLine_Hybrid_LegacySegment", legacySegmentPoints, context.Settings);

                // 最后一个导环到钓组主线连接点 (Physics)
                var physicsSegmentPoints = new List<Transform>();
                physicsSegmentPoints.Add(guideLinePoints.Last()); // 最后一个导环
                physicsSegmentPoints.Add(mainLineConnectionNode.Transform); // 钓组入口点
                UILinePhysicsSimulator physicsSegmentSimulator = CreatePhysicsBasedFishingLine(tackleActorController.TackleRodGet(), physicsSegmentPoints, context.Settings);
                 if (physicsSegmentSimulator != null && context.BaitRigRootGameObject != null)
                {
                    AttachBaitGroupPhysicsFollower(context.BaitRigRootGameObject, physicsSegmentSimulator);
                }
                break;
            default:
                Debug.LogError($"FishingLineRendererAssembler: Unknown fishing line mode: {lineMode}");
                break;
        }

        // 3. 协调钓组内部子线的渲染
        // BaitRigBuilder 在构建时已经为子线创建了 LineRenderer，这里只需确保它们是激活的并正确更新
        foreach (var edge in context.AssembledBaitRigGraph.Edges)
        {
            if (edge.LineRenderer != null)
            {
                edge.LineRenderer.enabled = true;
                // 更新子线两端点位置（如果它们是动态的）
                // edge.LineRenderer.SetPosition(0, edge.StartNode.Transform.localPosition);
                // edge.LineRenderer.SetPosition(1, edge.EndNode.Transform.localPosition);
            }
        }
    }

    // FindReelSpoolPoint, CollectGuideLinePoints, CreateLegacyLineRenderer, CreatePhysicsBasedFishingLine, AttachBaitGroupPhysicsFollower
    // 这些辅助方法应从原 TackleStageActorFactory 移动到 FishingLineRendererAssembler 内部或单独的辅助类中。
    // 假设这些方法已存在于此处或一个共享辅助类中。
    private Transform FindReelSpoolPoint(TackleActorController tackleActorController) { /* ... */ return null; }
    private List<Transform> CollectGuideLinePoints(TackleActorController tackleActorController, ProExportDataRodInfo rodExportInfo) { /* ... */ return new List<Transform>(); }
    private LineRenderer CreateLegacyLineRenderer(GameObject rodGameObject, string objectName, List<Transform> linePoints, TackleAssembleUISettingsSO settings) { /* ... */ return null; }
    private UILinePhysicsSimulator CreatePhysicsBasedFishingLine(GameObject rodGameObject, List<Transform> linePoints, TackleAssembleUISettingsSO settings) { /* ... */ return null; }
    private void AttachBaitGroupPhysicsFollower(GameObject baitGroupGameObject, UILinePhysicsSimulator lineSimulator) { /* ... */ }
}
```

### 5.8. 更新资源收集 (`CollectResourcePaths`)

`TackleAssemblyService` 的 `CollectResourcePaths` 方法需要更新以调用 `IBaitRigBuilder` 的 `CollectRequiredResources` 方法。

```csharp
// Assets/GameProject/Scripts/Runtime/Tackle/TackleAssemblyService.cs
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public class TackleAssemblyService
{
    private readonly IAssetProvider _assetProvider;
    private readonly IConfigDataProvider _configDataProvider;
    private readonly List<ITacklePartAssembler> _assemblers;
    private readonly IEnumerable<IBaitRigBuilder> _baitRigBuilders; // 注入 BaitRig Builders

    // 构造函数注入所有依赖
    public TackleAssemblyService(
        IAssetProvider assetProvider,
        IConfigDataProvider configDataProvider,
        IEnumerable<ITacklePartAssembler> assemblers,
        IEnumerable<IBaitRigBuilder> baitRigBuilders) // 接收所有 BaitRig Builders
    {
        _assetProvider = assetProvider;
        _configDataProvider = configDataProvider;
        _assemblers = new List<ITacklePartAssembler>(assemblers);
        _baitRigBuilders = baitRigBuilders;
    }

    /// <summary>
    /// 组装钓具控制器（为UI展示场景）
    /// </summary>
    public TackleActorController AssembleTackleController(
        TackleActorController tackleActorController,
        int rodConfigId,
        int reelConfigId,
        int lineConfigId,
        int baitRigConfigId, // 新增钓组ID
        TackleAssembleUISettingsSO settings = null)
    {
        if (tackleActorController == null) { Debug.LogError("TackleAssemblyService: tackleActorController is null"); return null; }

        tackleActorController.Init();

        // 创建上下文，传递共享数据和依赖
        var context = new TackleAssemblyContext(rodConfigId, reelConfigId, lineConfigId, baitRigConfigId, settings, _assetProvider, _configDataProvider);

        // 依次调用各个部件组装器
        foreach (var assembler in _assemblers)
        {
            assembler.Assemble(tackleActorController, context);
        }

        return tackleActorController;
    }

    /// <summary>
    /// 收集钓具组装所需的所有资源路径
    /// </summary>
    public List<string> CollectResourcePaths(
        int rodConfigId, int reelConfigId, int lineConfigId, int baitRigConfigId)
    {
        var paths = new List<string>();

        // 1. 钓具模板 Prefab
        paths.Add(FishingLevelSceneTaskUtil.TackleActorResPathGet());

        // 2. 钓竿 Prefab
        var rodConf = _configDataProvider.GetConfigDataRodInfo(rodConfigId);
        if (rodConf != null && !string.IsNullOrEmpty(rodConf.PrefabAssetPath))
        {
            paths.Add(rodConf.PrefabAssetPath);
        }

        // 3. 渔轮 Prefab
        var reelConf = _configDataProvider.GetConfigDataReelInfo(reelConfigId);
        if (reelConf != null && !string.IsNullOrEmpty(reelConf.PrefabAssetPath))
        {
            paths.Add(reelConf.PrefabAssetPath);
        }

        // 4. 钓线 Prefab
        paths.Add(FishingLevelSceneTaskUtil.TackleLineResPathGet());

        // 5. 钓组根节点 Prefab (硬编码路径应配置化)
        paths.Add("Assets/GameProject/RuntimeAssets/UI/UIStageActorView/Prefab/TackleStagePrefab_ABS/BaitGroupRoot.prefab");

        // 6. 钓组自身的所有资源 (通过 BaitRigBuilder 收集)
        var baitRigConf = _configDataProvider.GetConfigDataLureRigInfo(baitRigConfigId);
        if (baitRigConf != null)
        {
            // 假设 ConfigDataLureRigInfo 包含 BaitRigConfig 的 Asset Path
            // 如果 BaitRigConfig 无法直接通过 ID 获取，可能需要 IConfigDataProvider 提供专门的方法
            BaitRigConfig actualBaitRigConfig = _assetProvider.LoadAsset<BaitRigConfig>(baitRigConf.BaitRigConfigAssetPath);
            if (actualBaitRigConfig != null)
            {
                IBaitRigBuilder builder = _baitRigBuilders.FirstOrDefault(b => b.SupportedRigType == actualBaitRigConfig.RigType);
                if (builder != null)
                {
                    paths.AddRange(builder.CollectRequiredResources(actualBaitRigConfig));
                }
            }
        }

        return paths.Distinct().ToList(); // 确保路径唯一
    }
}
```

## 6. 拟议解决方案的优势

1.  **极高的可扩展性**: 新增一种钓组类型（如“浮钓组”）时，只需：
    *   创建新的 `BaitRigType` 枚举值。
    *   创建对应的 `BaitRigConfig` ScriptableObject。
    *   实现新的 `IBaitRigBuilder` (例如 `FloatRigBuilder`)。
    *   将新的 `Builder` 注册到 `TackleAssemblyService` 的依赖注入容器中。
    无需修改 `TackleAssemblyService` 或 `BaitRigAssembler` 的核心逻辑。
2.  **职责明确，代码清晰**: `TackleAssemblyService` 负责编排，`BaitRigAssembler` 负责协调钓组构建，`IBaitRigBuilder` 负责具体钓组图的构建，`BaitRigConfig` 负责数据定义，`BaitRigGraph` 负责运行时表示。每个类都有单一职责。
3.  **强大的数据驱动能力**: 复杂的钓组结构完全由 `BaitRigConfig` ScriptableObject 定义，设计师可以在编辑器中灵活配置，无需代码修改。
4.  **增强可测试性**: 每个 `ITacklePartAssembler` 和 `IBaitRigBuilder` 都是独立的非静态类，可以轻松进行单元测试和模拟依赖。
5.  **减少维护成本**: 局部修改不会影响全局，降低了代码的复杂性和出错概率。
6.  **优化资源加载**: `CollectResourcePaths` 能够准确收集所有钓组组件所需的资源，便于统一预加载，提升加载效率。

## 7. 潜在的权衡

1.  **初始设置复杂性增加**: 引入了更多的接口、抽象和类，增加了项目的概念复杂度和文件数量。
2.  **学习曲线**: 团队成员需要熟悉依赖注入、ScriptableObject 管理图结构等新的模式和技术。
3.  **配置管理**: `BaitRigConfig` 作为 ScriptableObject 需要良好的管理流程，以确保数据的一致性和正确性。
4.  **运行时开销**: 实例化更多对象和层级可能会带来微小的性能开销，但对于UI展示场景的组装逻辑而言，通常可以忽略不计。

## 8. 结论

通过将钓组的复杂构建逻辑从 `TackleStageActorFactory` 中完全解耦，并引入专门的钓组配置数据结构、构建器接口和运行时图表示，我们可以有效地应对钓具系统日益增长的复杂性。这份重构方案不仅解决了“巨石类”的风险，更构建了一个高度可扩展、可维护和可测试的钓具组装系统，为未来游戏内容的快速迭代和功能扩展奠定了坚实的基础。