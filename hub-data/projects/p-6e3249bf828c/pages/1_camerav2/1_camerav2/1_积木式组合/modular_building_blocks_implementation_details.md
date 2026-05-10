# 🧱 相机系统：积木式组合重构具体方案 (Final TDD)

## 1. 核心目标
将业务 Mode（如 `OrbitViewMode`）彻底降级为**“指令注入器”**，将所有逻辑下沉到原子模块中。Mode 不再持有具体模块的 C# 引用。

## 2. 具体细节重构 (Detailed Refactoring)

### 2.1 Mode 层的“去逻辑化”
以 `OrbitViewModeComponent` 为例，重构后的结构应如下：

```csharp
public class OrbitViewModeComponent : CameraModeComponent
{
    // 1. 彻底删除 m_inputModule, m_autoFitModule 等字段
    // 2. 彻底删除 CacheModuleReferences()

    // 3. 将方法调用改为指令设置
    public void ResetCamera() {
        m_orbitExtension.ResetRequested = true; 
    }

    public void SetInitialState(Vector3? rotation, float? distance) {
        m_orbitExtension.InitialStateRequested = true;
        m_orbitExtension.InitialYaw = rotation?.y ?? 0;
        // ... 仅设置数据，不调用模块
    }

    // 4. 调试数据从最终状态读取
    public OrbitViewState GetCurrentState() {
        var stateExt = m_lastCameraState.GetExtension<OrbitStateExtension>();
        return new OrbitViewState {
            m_distance = stateExt?.CurrentDistance ?? 0,
            // ...
        };
    }
}
```

### 2.2 模块层的“自驱动化”
模块必须在 `Execute` 中根据 `Context` 的标记位自发工作。

*   **OrbitInputModule**:
    *   检查 `context.m_inputProvider` 获取本帧增量。
    *   检查 `orbitExt.ResetRequested` 执行内部状态清理。
*   **OrbitAutoFitModule**:
    *   检查 `orbitExt.AutoFitRequested` 执行计算。
    *   检查 `commonExt.TargetChanged` 自动触发适配。

### 2.3 TackleObservation 的拆解规划
目前的巨型类将拆解为以下积木：
1.  **TacklePathModule**: 核心积木。持有三组 `CameraTrack` 引用，负责根据 `ZoomRatio` 在轨道间插值。
2.  **CloseupModule**: 状态积木。负责在主轨道和特写位姿之间进行平滑插值。
3.  **AutoReturnModule**: 通用积木。监听 `IInputProvider.HasInput`，超时后突变 `CameraState` 回到初始值。

## 3. 积木组合示例 (Building Blocks Examples)

| 目标效果 | 积木组合 (Modules in Prefab) |
| :--- | :--- |
| **标准环绕** | OrbitAutoFit + OrbitInput + OrbitFollow + Collision |
| **固定观察** | OrbitAutoFit + OrbitFollow (移除 Input 积木即可) |
| **FPS 视角** | PointFollow + InputRotation + PitchCurveModifier |
| **电影镜头** | CineDirectorOverride (接管所有状态) |

## 4. 迁移验证标准
1.  **无引用运行**: 在 `OrbitViewMode` 的 C# 代码中搜索 `OrbitInputModuleComponent`，结果应为 0。
2.  **动态拔插**: 在运行时 Disable 掉 `OrbitInput` 节点，相机应立即停止响应输入但保持位置，且不抛出 NullReferenceException。