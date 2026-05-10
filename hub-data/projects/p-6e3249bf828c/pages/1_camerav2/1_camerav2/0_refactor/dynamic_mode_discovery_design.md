# 动态模式发现与扩展设计方案 (Dynamic Mode Discovery)

## 1. 背景与痛点分析

目前相机系统使用 `CameraModeType` 枚举来标识不同的相机模式。这种方案在扩展时存在以下问题：
- **违反开闭原则**：新增一个模式需要修改枚举定义、工厂类（Switch-Case）和注册表逻辑。
- **编译依赖**：修改全局枚举会触发大量关联类的重新编译。
- **维护成本高**：随着模式数量增加，工厂类会变得臃肿且难以维护。

---

## 2. 核心设计思路

采用 **“配置驱动 + 反射实例化 + 字符串标识符”** 的方案，实现真正的插件式扩展：
1.  **标识符化**：使用 `string` 类型的 `ModeId` 取代 `enum`。
2.  **反射实例化**：工厂类根据配置中的类名通过反射创建实例，消除 `switch-case`。
3.  **配置驱动**：`CameraAssetConfig` 列表定义了运行时加载哪些模式。

---

## 3. 详细设计规范

### 3.1 配置层调整 ([`CameraModeConfig.cs`](Assets/GameProject/Scripts/Runtime/GameView/Camera/Config/Configs/CameraModeConfig.cs))

移除 `ModeType` 枚举，引入 `ModeId` 和 `FullClassName`。

```csharp
[Serializable]
public class CameraModeConfig
{
    [Tooltip("模式唯一标识符（如：SimpleFPS, OrbitView）")]
    public string ModeId;

    [Tooltip("对应的 C# 实现类全名（含命名空间）")]
    public string FullClassName;

    // ... 其他配置项 (VMConfigs, SharedSettings) 保持不变
}
```

### 3.2 工厂层重塑 ([`CameraModeFactory.cs`](Assets/GameProject/Scripts/Runtime/GameView/Camera/Config/Factory/CameraModeFactory.cs))

利用反射动态创建模式对象。

```csharp
public ICameraMode CreateMode(CameraModeConfig config, EFCameraController cameraController)
{
    // 1. 获取类型
    Type type = Type.GetType(config.FullClassName);
    if (type == null)
    {
        Debug.LogError($"[CameraModeFactory] 找不到类型: {config.FullClassName}");
        return null;
    }

    // 2. 实例化 (约定构造函数为 CameraController)
    try
    {
        var mode = Activator.CreateInstance(type, cameraController) as ICameraMode;
        // 3. 注入配置并初始化内部 VM 管线
        // ...
        return mode;
    }
    catch (Exception e)
    {
        Debug.LogError($"[CameraModeFactory] 实例化失败: {e.Message}");
        return null;
    }
}
```

### 3.3 注册表调整 ([`CameraModeRegistry.cs`](Assets/GameProject/Scripts/Runtime/GameView/Camera/Config/Registry/CameraModeRegistry.cs))

将索引容器从 `Dictionary<CameraModeType, ICameraMode>` 变更为 `Dictionary<string, ICameraMode>`。

```csharp
public class CameraModeRegistry : ICameraModeRegistry
{
    private readonly Dictionary<string, ICameraMode> m_modesById = new Dictionary<string, ICameraMode>();

    public ICameraMode TryGetMode(string modeId)
    {
        m_modesById.TryGetValue(modeId, out var mode);
        return mode;
    }
}
```

---

## 4. 交互契约 (Communication Contract)

### 4.1 业务层调用
业务层通过字符串指令切换模式，不再依赖枚举。

```csharp
// 重构前
cameraController.SwitchCameraModeCmd(CameraModeType.OrbitView);

// 重构后
cameraController.SendCameraCommand("SwitchMode", new Dictionary<string, object> { { "ModeId", "OrbitView" } });
```

### 4.2 内部状态查询
如果需要判断当前模式类型，使用接口或基类判定：

```csharp
if (currentMode is IOrbitCamera orbit)
{
    orbit.SetTarget(newTarget);
}
```

---

## 5. 进阶优化：编辑器下拉列表

为了避免手写字符串出错，在 `CameraModeConfig` 的 `ModeId` 字段上使用 `[CameraModeId]` 属性，并编写 `PropertyDrawer`：
- 自动扫描工程中所有实现了 `ICameraMode` 的非抽象类。
- 在 Inspector 中将其显示为可搜索的下拉列表。
- 自动填充 `FullClassName`。

---

## 6. 迁移计划

1.  **第一步**：在 `CameraModeConfig` 中增加 `ModeId` 和 `FullClassName` 字段，暂时保留 `ModeType` 以维持兼容。
2.  **第二步**：升级 `CameraModeFactory` 为反射驱动。
3.  **第三步**：批量更新 `CameraAssetConfig` 资源文件，填充字符串标识。
4.  **第四步**：清理旧的 `CameraModeType` 枚举及所有关联的 `switch-case`。

---

## 7. 结论

通过从“硬编码枚举”转向“动态标识符”，相机系统实现了真正的**松耦合**。核心框架不再感知具体的业务模式，新增模式只需遵循 `ICameraModule` 接口并在配置中注册即可，极大地提升了系统的可维护性和扩展性。
