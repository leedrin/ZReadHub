---
description: 
globs: 
alwaysApply: true
---
# BJFramework Development Rules

## 架构原则 (Architecture Principles)

### 分层架构设计
- 严格遵循Scene Layer和UI Layer分离
- Scene Layer负责游戏逻辑和数据处理
- UI Layer负责界面显示和用户交互
- 通过Intent系统实现层间通信，避免直接引用

### Task驱动生命周期
- 所有功能模块必须继承自TaskBase类
- 使用Task统一管理生命周期：Initialize -> Start -> Update -> Stop
- Scene使用SceneTask，UI使用UITask
- Task之间通过TaskManager进行协调

### 管线化处理流程
- 复杂操作必须使用UpdatePipeline进行处理
- 管线流程：PreProcess -> DataCacheUpdate -> ResourceLoad -> ViewUpdate -> PostProcess
- 每个管线继承自UpdatePipelineBase并实现具体逻辑
- 使用Template Method模式定义标准流程

### 组件化设计
- 使用Component模式拆分功能模块
- UI组件继承自UITaskCompTofuBase（称为Tofu组件）
- Scene组件继承自SceneTaskCompBase
- 通过Owner接口访问其他组件，保持松耦合

## 命名规范 (Naming Conventions)

### 类命名规范
```csharp
// UITask命名：功能名 + UITask
public class FishingLevelUITask : UITaskBase

// SceneTask命名：功能名 + SceneTask  
public class FishingLevelSceneTask : SceneTaskBase

// Component命名：所属Task名 + Comp + 功能名
public class FishingLevelUITaskCompMainTofu : UITaskCompTofuBase

// UpdatePipeline命名：所属Task名 + UpdatePipeline4 + 具体功能
public class FishingLevelSceneTaskUpdatePipeline4FishSpawn : UpdatePipelineBase

// Controller命名：功能名 + Controller
public class FishingLevelUIController : UIControllerBase

// Interface命名：I + 对应类名
public interface IFishingLevelUITask
```

### 字段和属性命名
```csharp
// 私有字段使用m_前缀 + camelCase
private FishingLevelUIController m_mainUICtrl;
private bool m_isLureRigSwitchUIOpening;

// 常量使用PascalCase
public const string UILayerName = "FishingLevelUILayer";
public const string ModeName4Idle = "Idle";

// 参数Key使用特定后缀
public const string IntentParamKey4FishActor = "FishActor";
public const string UpdatePipelineParamKey4ReloadResources = "ReloadResources";

// 事件使用EventOn前缀
public event Action<float, float> EventOnFishManActorViewCtrlRotate;
```

### 方法命名规范
```csharp
// 获取方法使用Get后缀
public IFishmanActor FishmanActorGet()

// 设置方法使用Set后缀  
public void CurrModeSet(string newMode)

// 检查方法使用Check后缀
protected override bool DynamicResLoadIsNeededCheck()

// 事件处理使用On前缀
protected override void OnEventUIControllerLoadCompleted(string uiCtrlName)

// 管线阶段方法使用特定命名
protected override void PreProcessBeforePipelineStart()
protected override void DataCacheUpdate()
protected override void ViewUpdate()
```

## 设计模式使用规范

### Template Method Pattern - 管线基类
```csharp
// 所有UpdatePipeline必须继承基类并实现抽象方法
public class CustomUpdatePipeline : UpdatePipelineBase
{
    protected override void PreProcessBeforePipelineStart() { }
    protected override void DataCacheUpdate() { }
    protected override bool DynamicResLoadIsNeededCheck() { }
    protected override void ViewUpdate() { }
    protected override void PostOnPipelineCompleted() { }
}
```

### Component Pattern - 组件系统
```csharp
// 使用组合而非继承来扩展功能
protected override void AllCompTofuConstruct()
{
    m_compMainTofu = new FishingLevelUITaskCompMainTofu(this);
    m_compResourceManager = new ResourceManagerComp(this);
    m_compList.Add(m_compMainTofu);
    m_compList.Add(m_compResourceManager);
}
```

### Observer Pattern - 事件系统
```csharp
// 使用事件进行组件间通信
public event Action<bool> EventOnTaskComplete;

// 事件注册和触发
private void RegisterEvents()
{
    m_component.EventOnDataChanged += OnDataChanged;
}

private void OnDataChanged(object data)
{
    // 处理数据变化
}
```

### Strategy Pattern - 不同策略
```csharp
// 通过继承实现不同的处理策略
public class FishSpawnPipeline : UpdatePipelineBase { }
public class FishDestroyPipeline : UpdatePipelineBase { }
public class LureRigSwitchPipeline : UpdatePipelineBase { }
```

## 核心类使用规范

### UITask使用规范
```csharp
public class CustomUITask : UITaskBase, ICustomUITaskCompOwner
{
    // 必须实现的基类方法
    protected override void AllCompTofuConstruct() { }
    protected override LayerDesc[] LayerDescArray { get; }
    protected override UIControllerDesc[] UIControllerDescArray { get; }
    protected override string[] CustomParamKey4UIIntentDefineArray { get; }
    protected override HashSet<string> ModeDefineList4Register { get; }
    
    // 静态工厂方法用于启动UITask
    public static CustomUITask StartCustomUI(Action<bool> onComplete = null)
    {
        var intent = new UIIntentCustom(nameof(CustomUITask));
        return UIManager.Instance.StartUITask(intent, onComplete) as CustomUITask;
    }
}
```

### UITask动态Layer加载规范

当UITask需要根据Intent参数动态加载不同的Layer资源时，应遵循以下模式：

#### 1. 静态Layer vs 动态Layer

**静态Layer**: UITask始终加载固定的Layer，在LayerDescArray中直接定义
```csharp
protected override LayerDesc[] LayerDescArray
{
    get
    {
        return new[]
        {
            new LayerDesc
            {
                m_layerName = "FixedUILayer",
                m_layerResPath = "Assets/UI/FixedUI.unity",
                m_isUILayer = true
            }
        };
    }
}
```

**动态Layer**: UITask根据Intent参数动态决定加载哪些Layer，LayerDescArray应预留占位符

**单Layer模式**（简单场景切换）：
```csharp
protected override LayerDesc[] LayerDescArray
{
    get
    {
        return new[]
        {
            new LayerDesc
            {
                m_layerName = "DynamicLayer",
                m_layerResPath = "", // 空路径，将在运行时动态设置
                m_isUILayer = false,
                m_isLazyLoad = true // 标记为延迟加载，由MainTofu控制
            }
        };
    }
}
```

**A/B切换模式**（推荐用于频繁场景切换）：
```csharp
protected override LayerDesc[] LayerDescArray
{
    get
    {
        // 预留2个Layer占位符，支持无缝场景切换
        return new[]
        {
            new LayerDesc
            {
                m_layerName = "DynamicLayer_A",
                m_layerResPath = "", // 空路径，将在运行时动态设置
                m_isUILayer = false,
                m_isLazyLoad = true // 标记为延迟加载，由MainTofu控制
            },
            new LayerDesc
            {
                m_layerName = "DynamicLayer_B",
                m_layerResPath = "", // 空路径，将在运行时动态设置
                m_isUILayer = false,
                m_isLazyLoad = true // 标记为延迟加载，由MainTofu控制
            }
        };
    }
}
```

#### 2. 在MainTofu中实现动态Layer加载

当使用动态Layer模式时，必须在MainTofu中重写以下两个方法：

```csharp
public class CustomUITaskCompMainTofu : UITaskCompTofuBase
{
    private string m_scenePreset; // 从Intent获取的场景预设参数
    
    public override void UpdateContextSetup(ICustomParamDictionaryReadOnly paramDict, 
        UITaskUpdatePipelineStartType pipelineStartType, params object[] extraParamArr)
    {
        base.UpdateContextSetup(paramDict, pipelineStartType, extraParamArr);
        
        // 从Intent参数中获取动态配置
        m_scenePreset = paramDict.GetClassParam<string>(IntentParamKey4ScenePreset);
    }
    
    /// <summary>
    /// 检查是否需要加载layer
    /// 根据Intent参数动态决定是否需要加载场景Layer
    /// </summary>
    public override bool LayerLoadIsNeededCheck()
    {
        // 检查是否有有效的动态配置参数
        return !string.IsNullOrEmpty(m_scenePreset) && 
               ConfigHelper.IsValidConfig(m_scenePreset);
    }
    
    /// <summary>
    /// 收集需要加载的layer描述列表
    /// 根据Intent参数动态设置LayerDesc的路径
    /// </summary>
    public override void LayerDescCollect4Load(ref HashSet<UITaskBase.LayerDesc> layerDescList)
    {
        if (string.IsNullOrEmpty(m_scenePreset))
        {
            Debug.LogWarning("MainTofu: 配置参数为空，无法加载动态Layer");
            return;
        }
        
        var layerPath = ConfigHelper.GetLayerPath(m_scenePreset);
        if (string.IsNullOrEmpty(layerPath))
        {
            Debug.LogError($"MainTofu: 未找到配置 '{m_scenePreset}' 对应的Layer路径");
            return;
        }
        
        // 获取现有的LayerDesc（来自UITask的LayerDescArray），动态设置其路径
        var allLayerDescs = m_owner.CompLayerManagerGet().AllLayerDescGet();
        foreach (var layerDesc in allLayerDescs)
        {
            if (layerDesc.m_layerName == "DynamicLayer")
            {
                // 动态设置层级路径
                layerDesc.m_layerResPath = layerPath;
                layerDescList.Add(layerDesc);
                
                Debug.Log($"MainTofu: 设置动态Layer路径 - 配置: {m_scenePreset}, 路径: {layerPath}");
                break;
            }
        }
    }
}
```

#### 3. 配置映射管理

为了便于维护，建议使用静态类管理配置与资源路径的映射：

```csharp
/// <summary>
/// 场景预设定义
/// </summary>
public static class ScenePresets
{
    public const string FishShowcase = "FishShowcase";
    public const string CharacterView = "CharacterView";
    public const string ItemPreview = "ItemPreview";
}

/// <summary>
/// 场景预设与实际资源路径的映射
/// </summary>
public static class ScenePresetPaths
{
    private static readonly Dictionary<string, string> s_presetPathMap = 
        new Dictionary<string, string>
        {
            { ScenePresets.FishShowcase, "Assets/Scenes/FishShowcase.unity" },
            { ScenePresets.CharacterView, "Assets/Scenes/CharacterView.unity" },
            { ScenePresets.ItemPreview, "Assets/Scenes/ItemPreview.unity" }
        };
    
    /// <summary>
    /// 根据预设名称获取实际的资源路径
    /// </summary>
    public static string GetScenePath(string preset)
    {
        return s_presetPathMap.TryGetValue(preset, out string path) ? path : null;
    }
}
```

#### 4. 适用场景

**使用动态Layer加载的场景**：
- 通用的展示器UITask（如Actor展示器、模型预览器）
- 根据不同模式加载不同场景的UITask
- 需要支持多种配置的可复用UITask

**使用静态Layer加载的场景**：
- 功能单一、场景固定的UITask
- 性能要求高、不需要动态切换的UITask
- 简单的UI界面

#### 5. 注意事项

1. **Layer名称一致性**: 确保占位符LayerDesc中的layerName与UIControllerDesc中的attachLayerName保持一致
2. **占位符设置**: LayerDescArray中必须预留占位符（m_layerResPath为空，m_isLazyLoad为true）
3. **索引管理**: 使用占位符方式可以避免索引越界问题，框架会自动管理LayerDesc的索引
4. **错误处理**: 在动态加载失败时提供合理的错误提示和降级方案
5. **性能考虑**: 动态Layer加载会增加一定的运行时开销，仅在必要时使用
6. **调试支持**: 添加充分的日志信息，便于调试和问题定位

#### 6. 实现原理

动态Layer加载的核心原理是：
- 在UITask的LayerDescArray中预留占位符（空路径 + 延迟加载标记）
- 框架在初始化时为所有LayerDesc分配正确的索引
- MainTofu在LayerDescCollect4Load中修改占位符的路径，使其指向实际资源
- 框架使用已分配的索引正确地将Layer存储到数组中

### UITaskCompTofuBase使用规范
```csharp
public class CustomUITaskCompMainTofu : UITaskCompTofuBase
{
    public CustomUITaskCompMainTofu(IUITaskCompOwnerBase owner) : base(owner) { }
    
    // 生命周期方法
    public override bool Initialize() { }
    public override void UpdateContextSetup(ICustomParamDictionaryReadOnly paramDict, 
        UITaskUpdatePipelineStartType pipelineStartType, params object[] extraParamArr) { }
    public override bool DynamicResLoadIsNeededCheck() { }
    public override void DynamicResCollect4Load(ref List<string> resPathList) { }
    public override void ViewUpdate(IUITaskUpdatePipelineController pipelineCtrl) { }
    
    // UI事件注册
    protected override void OnEventUIControllerLoadCompleted(string uiCtrlName) { }
}
```

### Intent处理标准流程
#### 1. Intent获取模式

```csharp
// 获取当前Intent并准备返回
var currentIntent = m_compUIIntentInfo.UIIntentGetAndRefill4ReturnSelf();

// 启动子UITask时传递Intent
var subTask = SubUITask.Start(currentIntent, onComplete);
```

#### 2. Intent参数传递规范
```csharp
// 启动UITask时传递参数
public static UITaskBase StartWithParams(object param1, Action callback)
{
    var intent = new UIIntentCustom(nameof(CustomUITask));
    intent.SetParam(IntentParamKey4Param1, param1);
    intent.SetParam(IntentParamKey4Callback, callback);
    return UIManager.Instance.StartUITask(intent);
}

// 在UpdateContextSetup中获取Intent参数
```csharp
public override void UpdateContextSetup(ICustomParamDictionaryReadOnly paramDict, ...)
{
    m_param1 = paramDict.GetClassParam<SomeType>(IntentParamKey4Param1);
    m_callback = paramDict.GetClassParam<Action>(IntentParamKey4Callback);
}
```

#### 3. Intent参数常量定义

```csharp
public static class IntentParamKey
{
    public const string FishActor = "FishActor";
    public const string Callback = "Callback";
    public const string Config = "Config";
}
```

### UpdatePipeline参数传递规范
```csharp
// 启动管线时传递参数
private void StartUpdatePipeline()
{
    var pipelineInitInfo = m_owner.CompUpdatePipelineManagerGet().UpdatePipelineInitInfoAlloc();
    pipelineInitInfo.m_customParamDict.SetParam(UpdatePipelineParamKey4SomeData, someData);
    m_owner.CompUpdatePipelineManagerGet().UpdatePipelineLaunch(pipelineInitInfo);
}
```

### UpdatePipeline劫持规范

#### 1. 实现协同管线 (Implementing the Coordination Pipeline)
通过重写 `CooperativeUITaskUpdate` 方法，可以启动其他Task的更新管线，实现管线间的协同工作。

- **`m_redirectPipelineWaitingCount`**: 设置需要等待的协同管线数量。
- **`redirectPipelineHost`**: 在启动子Task时将当前管线实例作为宿主传入，用于完成后的回调。

```csharp
/// <summary>
/// 协同其他UITask更新
/// 例如，启动其他需要被劫持的UITask更新管线
/// </summary>
protected override void CooperativeUITaskUpdate()
{
    // 协同其他task启动管线做一些事情
    if (m_initInfo.m_pipelineStartType == UITaskUpdatePipelineStartType.Init || m_initInfo.m_pipelineStartType == UITaskUpdatePipelineStartType.Resume)
    {
        // 增加等待协同的管线数量
        m_redirectPipelineWaitingCount = 2;
 
        // 启动角色3D展示界面的更新管线
        var character3DTaskIntent = new UIIntentCustom(nameof(Character3dDisplayUITask));
        character3DTaskIntent.TargetMode = Character3dDisplayUITask.ModeName43DView;       
        m_compSubUITaskManager.SubUITaskStart(character3DTaskIntent, redirectPipelineHost: this);
 
        // 启动角色列表界面的更新管线
        var characterListUITaskIntent = new UIIntentCustom(nameof(CharacterListUITask));
        m_compSubUITaskManager.SubUITaskStart(characterListUITaskIntent, redirectPipelineHost: this);
    }
}
```

#### 2. 实现管线工厂 (Implementing the Pipeline Factory)
创建 `UITaskCompUpdatePipelineFactory` 的子类，根据不同的 `launchPurpose` 创建对应的管线实例。这允许一个 `UITask` 根据需要启动不同类型的更新管线（如默认管线或协同管线）。

```csharp
/// <summary>
/// UITask的更新管线工厂组件
/// </summary>
internal class CharacterMainInfoUITaskCompUpdatePipelineFactory : UITaskCompUpdatePipelineFactory
{
    // ...
    #region Overrides of UITaskCompUpdatePipelineFactory
 
    /// <summary>
    /// 创建更新管线实例
    /// </summary>
    protected override UITaskUpdatePipelineBase UpdatePipelineCreate(UITaskUpdatePipelineInitInfo initInfo, string launchPurpose)
    {
        switch (launchPurpose)
        {
            case Cooperative3DAndListShow:
                // 创建协同管线
                return new CharacterMainInfoUITaskUpdatePipeline(initInfo, m_owner);
            case OnlyUpdateSelf:
                // 创建默认管线
                return new UITaskUpdatePipelineDefault(initInfo, m_owner);
            default:
                throw new NotImplementedException();
        }
    }
 
    #endregion
    // ...
}
```

#### 3. 注册管线工厂 (Registering the Pipeline Factory)
在 `UITask` 中重写 `CompUpdatePipelineFactoryCreate` 方法，返回自定义的管线工厂实例。

```csharp
/// <summary>
/// 创建更新管线工厂组件
/// </summary>
/// <returns></returns>
protected override UITaskCompUpdatePipelineFactory CompUpdatePipelineFactoryCreate()
{
    return new CharacterMainInfoUITaskCompUpdatePipelineFactory(this);
}
```

#### 4. 劫持流程详解 (管线A/Host 劫持 管线B/Client)
本节详细描述实现管线劫持的具体步骤。

管线A (Host/宿主) 的职责:
宿主是劫持的发起者和流程的协调者。

重写 CooperativeUITaskUpdate: 在宿主管线A的自定义实现中（如 MyPipelineA 继承自 UITaskUpdatePipelineDefault），重写此方法。
```csharp
protected override void CooperativeUITaskUpdate()
{
    // 1. 创建用于启动管线B的 Intent
    UIIntentCustom intent = new UIIntentCustom(typeof(TaskB).Name, null);

    // 2. 分配管线初始化信息
    var initInfo = m_owner.CompUpdatePipelineManagerGet().UpdatePipelineInitInfoAllocByUIIntent(intent);

    // 3. 【关键】将自己(this)设置为管线B的劫持宿主
    initInfo.m_redirectPipelineHost = this;

    // 4. 记录正在等待的被劫持管线数量
    m_redirectPipelineWaitingCount++;

    // 5. 启动管线B (通常通过一个子Task管理器或全局管理器)
    SubTaskManager.Instance.StartSubTask(intent, initInfo);
}
```


实现 OnRedirectPipelineAllResReady: 当被劫持的管线B资源加载就绪时，此方法会被回调。
```csharp
protected override void OnRedirectPipelineAllResReady(IRedirectPipelineContinueHandle handle)
{
    // 1. 调用基类方法，它会递减等待计数器，并保存句柄
    base.OnRedirectPipelineAllResReady(handle);

    // 2. 此时可以认为“过渡”条件已满足，管线A可以开始播放自己的过渡动画了。
    //    例如，在 ViewUpdate() 中播放淡出动画。
}

```


恢复 Client 管线: 在宿主管线A的逻辑执行完毕后（例如过渡动画播放完毕），恢复管线B的执行。
```csharp
protected override void PostViewUpdate()
{
    // 动画播放完毕后，恢复所有被劫持的管线
    foreach (var handler in m_redirectPipelineContinueHandlerList)
    {
        handler.RedirectPipelineContinueFormHost();
    }
    m_redirectPipelineContinueHandlerList.Clear();
}
```


管线B (Client/被劫持方) 的职责:
被劫持方通常不需要做任何特殊处理，框架的 UITaskUpdatePipelineBase 已经处理了所有被劫持的逻辑。

当管线B的 Start() 协程执行到管线劫持协作时，它会自动检查 m_initInfo.m_redirectPipelineHost 是否存在。
如果存在，它会自动调用 m_redirectPipelineHost.RedirectPipelineAllResReady(this)，然后暂停（yield break + while 循环等待）。
当宿主管线A调用 RedirectPipelineContinueFormHost() 时，m_redirectPipelineContinueFromHost 标记被设为 true，循环结束，管线B自动从暂停中恢复，继续执行后续的 ViewUpdate 等流程。

### Mode管理规范

#### 1. Mode设置统一入口

```csharp
/// <summary>
/// BasicInfo组件
/// </summary>
private FishActorCompBasicInfo m_compBasicInfo;

public override bool Initialize()
{
    if (!base.Initialize())
    {
        return false;
    }

    m_compBasicInfo = m_owner.CompBasicInfoGet();
    
    return true;
}
```

```csharp
public void CurrModeSet(string newMode)
{
    m_currentPhase = newMode;
    if (m_compBasicInfo.CurrModeGet() != m_currentPhase)
    {
        // 更新BasicInfo组件
        m_compBasicInfo.CurrModeSet(m_currentPhase);
        
        // 通知UI控制器
        m_mainUICtrl?.PhaseSet(m_currentPhase);
        
        Debug.Log($"Mode切换至: {newMode}");
    }
}
```

#### 2. Mode常量定义

```csharp
public static class ModeName
{
    public const string Idle = "Idle";
    public const string Loading = "Loading";
    public const string Playing = "Playing";
    public const string Paused = "Paused";
}
```

#### 3. Mode切换时机

```csharp
private void StartSubUITask()
{
    // 1. 主UI退场
    m_mainUICtrl.SetToUIState("Close");
    
    // 2. 设置新Mode
    CurrModeSet(ModeName.SubTask);
    
    // 3. 启动子UITask
    var subTask = SubUITask.Start(intent, OnSubTaskEnd);
    
    // 4. 设置返回回调
    subTask.EventOnStop += _ => {
        CurrModeSet(ModeName.Idle);
        m_mainUICtrl.SetToUIState("Show");
    };
}
```

## 代码组织规范
编辑器代码放在Scripts/Editor目录下
运行期代码放在Scripts/Runtime目录下

### 文件夹结构
Scripts/
├──Editor/
Scripts/Runtime/GameView/
├── Scene/
│ ├── SceneName/
│ │ ├── SceneNameSceneTask.cs
│ │ ├── Comp/
│ │ │ ├── SceneNameSceneTaskComp.cs
│ │ ├── UpdatePipeline/
│ │ │ ├── SceneNameSceneTaskUpdatePipeline4.cs
│ │ └── Controllers/
│ │ ├── Controller/
└── UI/
├── UIName/
│ ├── UINameUITask.cs
│ ├── Comp/
│ │ ├── UINameUITaskComp.cs
│ └── Controllers/
│ ├── UINameUIController.cs


### 接口定义规范
```csharp
// 每个UITask都要定义对外接口和组件Owner接口
public interface ICustomUITask
{
    void DoSomething();
}

public interface ICustomUITaskCompOwner : IUITaskCompOwnerBase, ICustomUITask
{
    ICustomUITaskCompMainTofu CompMainTofuGet();
}

// UITask类实现两个接口
public class CustomUITask : UITaskBase, ICustomUITaskCompOwner, ICustomUITask
```

### 常量定义规范
```csharp
#region 常量定义

#region Layer
public const string UILayerName = "CustomUILayer";
#endregion

#region Mode  
public const string ModeName4Default = "Default";
public const string ModeName4Special = "Special";
#endregion

#region ParamKey
public const string IntentParamKey4SomeParam = "SomeParam";
public const string UpdatePipelineParamKey4SomeData = "SomeData";
#endregion

#endregion
```

## 组件职责分离指南

### 1. UIController职责

- **职责**：UI展示、动画控制、用户交互
- **不负责**：业务逻辑、数据处理、流程控制

```csharp
public class FishRewardShowUIController : UIControllerBase
{
    // ✅ 应该做的
    public void PrepareStage() { }
    public void PlayAnimation() { }
    public void UpdateDisplay(data) { }
    
    // ❌ 不应该做的  
    // public void ProcessBusinessLogic() { }
    // public void ManageTimeline() { }
}
```

### 2. MainTofu职责

- **职责**：流程编排、组件协调、生命周期管理
- **不负责**：具体的UI操作、复杂的业务逻辑

```csharp
public class MainTofu : UITaskCompTofuBase
{
    // ✅ 应该做的
    public void StartSubProcess() { }
    public void CoordinateComponents() { }
    public void ManageLifecycle() { }
    
    // ❌ 不应该做的
    // public void DirectlyManipulateUI() { }
    // public void HandleDetailedLogic() { }
}
```

### 3. Process职责

- **职责**：流程执行、资源加载、状态管理
- **不负责**：UI展示、用户交互

---

## 依赖注入和封装原则

### 1. 构造函数注入

```csharp
// 通过构造函数注入依赖
public class TimelineSetupProcess : UIProcess
{
    public TimelineSetupProcess(GameObject prefab, 
        Action<TimelineController> onCreated)
    {
        m_prefab = prefab;
        m_onCreated = onCreated;
    }
}
```

### 2. 回调注入

```csharp
// 通过回调传递创建的对象
protected override void OnStart()
{
    var controller = CreateTimelineController();
    
    // 通过回调传递给调用方
    m_onCreated?.Invoke(controller);
}
```

### 3. 接口封装

```csharp
// 提供高级接口，隐藏实现细节
public interface ITimelineController
{
    void Play();
    void Pause();
    void Resume();
    void Stop();
    // 不暴露内部的Director等细节
}
```

## 最佳实践

### 错误处理
- 在Initialize和PostInitialize方法中进行空指针检查
- 使用bool返回值指示操作是否成功
- 在关键操作前进行状态检查

### 性能优化
- 在DynamicResLoadIsNeededCheck中进行精确的资源加载检查
- 使用对象池模式管理频繁创建的对象
- 在管线完成后及时清理资源

### 调试支持
- 在关键操作处添加Debug.Log
- 使用meaningful的错误信息
- 在管线流程中添加进度跟踪

## MCP Interactive Feedback 规则

1. 在任何流程、任务、对话进行时，无论是询问、回复、或完成阶段性任务，皆必须调用 MCP mcp-feedback-enhanced。
2. 每当收到用户反馈，若反馈内容非空，必须再次调用 MCP mcp-feedback-enhanced，并根据反馈内容调整行为。
3. 仅当用户明确表示「结束」或「不再需要交互」时，才可停止调用 MCP mcp-feedback-enhanced，流程才算结束。
4. 除非收到结束指令，否则所有步骤都必须重复调用 MCP mcp-feedback-enhanced。
