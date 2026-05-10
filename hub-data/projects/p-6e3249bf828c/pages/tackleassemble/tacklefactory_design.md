# TackleFactory.Create() - 方法设计文档

## 1. 目标

基于对 `TackleActorController` 和 `LureRigActorController` 的分析，设计一个静态工厂方法 `TackleFactory.Create(tackleConfig)`。该方法负责根据给定的配置，完整地创建、组装并返回一个功能齐全的钓具 `GameObject` 实例。

## 2. 设计原则

-   **单一入口**: `TackleFactory` 是创建完整钓具的唯一入口，封装了所有复杂的组装步骤。
-   **数据驱动**: 整个创建过程由一个 `TackleConfig` 数据对象驱动。
-   **分层组装**: 工厂方法遵循系统的分层架构。它首先组装子系统（如`LureRig`），然后将完成的子系统作为部件组装到主系统（`TackleActor`）中。

## 3. 核心依赖假设

-   存在一个 `TackleConfig` 数据类，至少包含各部件的ID或资源路径，如 `RodId`, `ReelId`, `LureId`, `HookId`, `LineId`。
-   存在一个 `ResourceManager` 类（或类似的服务），能够根据ID/路径加载资源 Prefab。
-   存在一个基础的 "TackleActor" Prefab，其根节点挂载了 `TackleActorController` 和 `TackleActorControllerDesc`。
-   存在一个基础的 "LureRig" Prefab，其根节点挂载了 `LureRigActorController` 和 `LureRigActorControllerDesc`。

## 4. `TackleFactory.Create()` 伪代码设计

```csharp
public static class TackleFactory
{
    /// <summary>
    /// 根据配置创建一个完整的钓具实例
    /// </summary>
    /// <param name="tackleConfig">钓具配置</param>
    /// <returns>组装完成的钓具根GameObject</returns>
    public static GameObject Create(TackleConfig tackleConfig)
    {
        // 步骤 1: 实例化基础的 TackleActor，它包含 TackleActorController
        GameObject tackleActorInstance = ResourceManager.LoadAndInstantiate("Prefabs/TackleActorBase");
        TackleActorController tackleController = tackleActorInstance.GetComponent<TackleActorController>();
        
        if (tackleController == null)
        {
            Debug.LogError("TackleFactory: 基础TackleActor Prefab上缺少TackleActorController组件!");
            return null;
        }

        // 步骤 2: 加载并设置鱼竿 (Rod)
        GameObject rodPrefab = ResourceManager.Load("Prefabs/Rods/" + tackleConfig.RodId);
        tackleController.RodWithHandleSet(rodPrefab);

        // 步骤 3: 加载并设置渔轮 (Reel)
        GameObject reelPrefab = ResourceManager.Load("Prefabs/Reels/" + tackleConfig.ReelId);
        tackleController.ReelSet(reelPrefab);

        // 步骤 4: 组装并设置钓组 (LureRig) - 这是一个子装配过程
        // 4a. 实例化基础的 LureRigActor, 它包含 LureRigActorController
        GameObject lureRigInstance = ResourceManager.LoadAndInstantiate("Prefabs/LureRigBase");
        LureRigActorController lureRigController = lureRigInstance.GetComponent<LureRigActorController>();

        if (lureRigController != null)
        {
            // 4b. 加载具体的假饵(Lure)和鱼钩(Hook)模型
            GameObject lurePrefab = ResourceManager.Load("Prefabs/Lures/" + tackleConfig.LureId);
            GameObject hookPrefab = ResourceManager.Load("Prefabs/Hooks/" + tackleConfig.HookId);

            // 4c. 调用 LureRigActorController 的接口来组装假饵和鱼钩
            lureRigController.LureRigSet(hookPrefab, lurePrefab);
            
            // 4d. 将组装完成的 LureRig 实例设置到主 TackleActor 上
            tackleController.LureRigSet(lureRigInstance);
        }

        // 步骤 5: 配置鱼线 (Line) - 假设鱼线是数据驱动的
        LineConfig lineConfig = GetLineConfigFromId(tackleConfig.LineId); // 伪代码
        tackleController.LineSet(lineConfig);

        // 步骤 6: 返回完全组装好的 TackleActor 实例
        return tackleActorInstance;
    }
}
```

## 5. 与UI系统的集成

-   `TackleAssembleUITask` 在启动时，将调用 `TackleFactory.Create(tackleConfig)` 来获取钓具模型。
-   当用户在UI中选择更换部件（如更换渔轮）时，`TackleAssembleUITaskCompMainTofu` 将：
    1.  从玩家库存中获取新部件的`ConfigId`。
    2.  加载新部件的 Prefab。
    3.  调用已缓存的 `TackleActorController` 引用上的相应 `Set` 方法（如 `ReelSet(newReelPrefab)`）来完成热替换。

这个设计确保了UI层和模型层之间的清晰分离，所有模型操作都通过`TackleActorController`这一聚合根完成。