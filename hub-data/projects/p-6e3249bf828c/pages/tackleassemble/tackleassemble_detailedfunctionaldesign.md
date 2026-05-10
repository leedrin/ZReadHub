# 钓具组装界面交互优化 - 详细功能设计文档

## 1. 概述

本文档基于《钓具组装界面交互优化 - 功能需求文档》和《钓具组装界面交互优化 - 功能设计文档》，结合当前代码结构和BJFramework架构规范，提供详细的实现设计方案。

## 2. 状态机设计

### 2.1 状态枚举定义

```csharp
namespace BlackJack.ProjectEF.Runtime.UI
{
    /// <summary>
    /// 钓具组装界面视图状态枚举
    /// </summary>
    public enum ETackleAssembleViewState
    {
        /// <summary>
        /// 默认状态 - 显示完整UI（3D模型 + 放大镜 + Slot按钮）
        /// </summary>
        Default,

        /// <summary>
        /// 自由观察状态 - 隐藏放大镜，允许自由旋转观察
        /// </summary>
        FreeObservation,

        /// <summary>
        /// 配件槽特写状态 - 隐藏放大镜，聚焦特定配件槽
        /// </summary>
        SlotCloseup
    }
}
```

### 2.2 配件槽类型定义

```csharp
namespace BlackJack.ProjectEF.Runtime.UI
{
    /// <summary>
    /// 配件槽类型枚举
    /// </summary>
    public enum ESlotType
    {
        /// <summary>
        /// 钓具配件槽（主钓具的配件，如鱼轮、握把等）
        /// </summary>
        Tackle,

        /// <summary>
        /// 钓组配件槽（钓组的配件，如鱼钩、铅坠等）
        /// </summary>
        BaitGroup
    }
}
```

## 3. 核心架构设计

### 3.1 状态管理架构

采用状态机模式集中管理三种视图状态，确保状态转换的安全性和一致性。

#### 3.1.1 状态管理器设计

```csharp
/// <summary>
/// 钓具组装界面状态管理器
/// 负责管理视图状态转换和相关UI控制
/// </summary>
public class TackleAssembleViewStateManager
{
    private ETackleAssembleViewState m_currentState;
    private TackleAssembleUIController m_uiController;
    private ITackleAssembleTackleUITask m_tackleUITask;

    public ETackleAssembleViewState CurrentState => m_currentState;

    /// <summary>
    /// 状态改变事件
    /// </summary>
    public event Action<ETackleAssembleViewState, ETackleAssembleViewState> EventOnStateChanged;

    public void SetState(ETackleAssembleViewState newState);
    private void OnStateEnter(ETackleAssembleViewState state);
    private void OnStateExit(ETackleAssembleViewState state);
}
```

### 3.2 事件通信架构

基于Observer模式实现组件间解耦通信，避免直接引用依赖。

#### 3.2.1 事件定义

```csharp
/// <summary>
/// 钓具组装界面事件定义
/// </summary>
public static class TackleAssembleEvents
{
    /// <summary>
    /// 拖拽开始事件
    /// </summary>
    public static event Action EventOnDragStart;

    /// <summary>
    /// 拖拽结束事件
    /// </summary>
    public static event Action EventOnDragEnd;

    /// <summary>
    /// 配件槽点击事件
    /// </summary>
    public static event Action<string, ESlotType> EventOnSlotClick;

    /// <summary>
    /// 返回按钮点击事件
    /// </summary>
    public static event Action EventOnReturnButtonClick;

    /// <summary>
    /// 钓组特写返回事件
    /// </summary>
    public static event Action EventOnBaitGroupCloseupReturn;
}
```

## 4. 详细实现设计

### 4.1 TackleAssembleUITask 修改

#### 4.1.1 新增成员变量

```csharp
public class TackleAssembleUITask : UITaskBase, ITackleAssembleUITask, ITackleAssembleUITaskCompOwner
{
    /// <summary>
    /// 视图状态管理器
    /// </summary>
    private TackleAssembleViewStateManager m_viewStateManager;

    /// <summary>
    /// 钓具子UITask引用
    /// </summary>
    private TackleAssembleTackleUITask m_tackleUITask;

    /// <summary>
    /// 钓组子UITask引用
    /// </summary>
    private TackleAssembleBaitGroupUITask m_baitGroupUITask;
}
```

#### 4.1.2 状态管理方法

```csharp
/// <summary>
/// 设置视图状态
/// </summary>
/// <param name="newState">新状态</param>
public void SetViewState(ETackleAssembleViewState newState)
{
    m_viewStateManager?.SetState(newState);
}

/// <summary>
/// 获取当前视图状态
/// </summary>
/// <returns>当前状态</returns>
public ETackleAssembleViewState GetCurrentViewState()
{
    return m_viewStateManager?.CurrentState ?? ETackleAssembleViewState.Default;
}
```

#### 4.1.3 事件处理方法

```csharp
/// <summary>
/// 拖拽开始事件处理
/// </summary>
private void OnDragStart()
{
    SetViewState(ETackleAssembleViewState.FreeObservation);
}

/// <summary>
/// 拖拽结束事件处理
/// </summary>
private void OnDragEnd()
{
    SetViewState(ETackleAssembleViewState.Default);

    // 触发Actor旋转归位
    m_tackleUITask?.ActorRotationReset();
}

/// <summary>
/// 配件槽点击事件处理
/// </summary>
/// <param name="slotName">配件槽名称</param>
/// <param name="slotType">配件槽类型</param>
private void OnSlotClick(string slotName, ESlotType slotType)
{
    switch (slotType)
    {
        case ESlotType.Tackle:
            HandleTackleSlotClick(slotName);
            break;
        case ESlotType.BaitGroup:
            HandleBaitGroupSlotClick(slotName);
            break;
    }
}

/// <summary>
/// 钓具配件槽点击处理
/// </summary>
/// <param name="slotName">配件槽名称</param>
private void HandleTackleSlotClick(string slotName)
{
    SetViewState(ETackleAssembleViewState.SlotCloseup);

    // 执行3D场景特写
    FocusOnSlot(slotName);
}

/// <summary>
/// 钓组配件槽点击处理
/// </summary>
/// <param name="slotName">配件槽名称</param>
private void HandleBaitGroupSlotClick(string slotName)
{
    // 不改变主状态，只执行2D UI动画
    var uiController = m_compMainTofu?.GetUIController();
    uiController?.AnimateBaitGroupViewToCloseup(true);
}

/// <summary>
/// 返回按钮点击处理
/// </summary>
private void OnReturnButtonClick()
{
    SetViewState(ETackleAssembleViewState.Default);

    // 重置相机
    ReturnToOverview();
}

/// <summary>
/// 钓组特写返回处理
/// </summary>
private void OnBaitGroupCloseupReturn()
{
    var uiController = m_compMainTofu?.GetUIController();
    uiController?.AnimateBaitGroupViewToCloseup(false);
}
```

### 4.2 TackleAssembleUIController 修改

#### 4.2.1 新增接口方法

```csharp
/// <summary>
/// 设置钓组视图激活状态
/// </summary>
/// <param name="isActive">是否激活</param>
public void SetBaitGroupViewActive(bool isActive)
{
    if (m_rigRawImage != null)
    {
        m_rigRawImage.gameObject.SetActive(isActive);
    }
}

/// <summary>
/// 钓组视图特写动画
/// </summary>
/// <param name="toCloseup">是否切换到特写</param>
public void AnimateBaitGroupViewToCloseup(bool toCloseup)
{
    if (m_rigRawImage == null) return;

    var rectTransform = m_rigRawImage.rectTransform;

    if (toCloseup)
    {
        // 执行放大居中动画
        DOTween.Sequence()
            .Append(rectTransform.DOScale(Vector3.one * 2f, 0.3f))
            .Join(rectTransform.DOAnchorPos(Vector2.zero, 0.3f))
            .OnComplete(() => ShowBaitGroupCloseupReturnButton(true));
    }
    else
    {
        // 执行缩小归位动画
        DOTween.Sequence()
            .Append(rectTransform.DOScale(Vector3.one, 0.3f))
            .Join(rectTransform.DOAnchorPos(m_originalBaitGroupPosition, 0.3f))
            .OnComplete(() => ShowBaitGroupCloseupReturnButton(false));
    }
}

/// <summary>
/// 显示/隐藏钓组特写返回按钮
/// </summary>
/// <param name="show">是否显示</param>
private void ShowBaitGroupCloseupReturnButton(bool show)
{
    if (m_baitGroupCloseupReturnButton != null)
    {
        m_baitGroupCloseupReturnButton.gameObject.SetActive(show);
    }
}
```

#### 4.2.2 事件签名修改

```csharp
/// <summary>
/// 配件槽按钮点击事件（新增槽类型参数）
/// </summary>
public event Action<string, ESlotType> EventOnSlotButtonClick;

/// <summary>
/// 钓组特写返回按钮点击事件
/// </summary>
public event Action EventOnBaitGroupCloseupReturnButtonClick;
```

### 4.3 TackleAssembleTackleUIController 修改

#### 4.3.1 新增拖拽事件

```csharp
/// <summary>
/// 拖拽开始事件
/// </summary>
public event Action EventOnDragStart;

/// <summary>
/// 拖拽结束事件
/// </summary>
public event Action EventOnDragEnd;
```

#### 4.3.2 修改输入处理逻辑

```csharp
/// <summary>
/// 处理旋转输入
/// </summary>
private void RotationInputHandle()
{
    // 检测拖拽开始
    if (InputManager.GetButtonDown(InputCmdId4PrimaryAction))
    {
        m_isDragging = true;
        m_lastMousePosition = Input.mousePosition;

        // 触发拖拽开始事件
        EventOnDragStart?.Invoke();
    }

    // 检测拖拽结束
    if (InputManager.GetButtonUp(InputCmdId4PrimaryAction))
    {
        if (m_isDragging)
        {
            m_isDragging = false;

            // 触发拖拽结束事件
            EventOnDragEnd?.Invoke();
        }
    }

    // 处理拖拽中的旋转
    if (m_isDragging)
    {
        DragRotationHandle();
    }
}

/// <summary>
/// 处理拖拽旋转（分离水平和垂直输入）
/// </summary>
private void DragRotationHandle()
{
    var currentMousePosition = Input.mousePosition;
    var mouseDelta = currentMousePosition - m_lastMousePosition;

    if (mouseDelta.sqrMagnitude > float.Epsilon)
    {
        // FR-FO2: 水平拖拽旋转Actor，垂直拖拽旋转相机
        float horizontalDelta = mouseDelta.x * m_rotationSensitivity;
        float verticalDelta = -mouseDelta.y * m_rotationSensitivity;

        // 水平旋转Actor（添加角度限制）
        ActorHorizontalRotate(horizontalDelta);

        // 垂直旋转相机
        CameraVerticalRotate(verticalDelta);

        m_lastMousePosition = currentMousePosition;
    }
}

/// <summary>
/// Actor水平旋转（带角度限制）
/// </summary>
/// <param name="deltaAngle">旋转角度增量</param>
private void ActorHorizontalRotate(float deltaAngle)
{
    if (m_currentTackleActor == null) return;

    // FR-FO3: 应用角度限制（左右各不超过90度）
    m_currentActorYRotation += deltaAngle;
    m_currentActorYRotation = Mathf.Clamp(m_currentActorYRotation, -90f, 90f);

    var targetRotation = Quaternion.Euler(0, m_currentActorYRotation, 0);
    m_currentTackleActor.FollowTransformGet().rotation = targetRotation;
}

/// <summary>
/// 相机垂直旋转
/// </summary>
/// <param name="deltaAngle">旋转角度增量</param>
private void CameraVerticalRotate(float deltaAngle)
{
    if (m_cameraController != null)
    {
        var observationMode = m_cameraController.GetObservationCameraMode();
        observationMode?.CameraRotate(new Vector2(0, deltaAngle));
    }
}

/// <summary>
/// Actor旋转归位（FR-FO5）
/// </summary>
public void ActorRotationReset()
{
    if (m_currentTackleActor == null) return;

    // 平滑回归初始角度
    var targetRotation = Quaternion.identity;
    StartCoroutine(SmoothRotateActor(targetRotation, 0.5f));
}

/// <summary>
/// 平滑旋转Actor协程
/// </summary>
private IEnumerator SmoothRotateActor(Quaternion targetRotation, float duration)
{
    var startRotation = m_currentTackleActor.FollowTransformGet().rotation;
    float elapsed = 0f;

    while (elapsed < duration)
    {
        elapsed += Time.deltaTime;
        float t = elapsed / duration;

        var currentRotation = Quaternion.Slerp(startRotation, targetRotation, t);
        m_currentTackleActor.FollowTransformGet().rotation = currentRotation;

        yield return null;
    }

    // 确保最终角度精确
    m_currentTackleActor.FollowTransformGet().rotation = targetRotation;
    m_currentActorYRotation = 0f;
}
```

### 4.4 TackleSlotList 数据结构修改

#### 4.4.1 SlotData扩展

```csharp
[Serializable]
public class SlotData
{
    [Tooltip("槽点的唯一标识名称")]
    public string SlotName;

    [Tooltip("槽点类型：Tackle（钓具）或 BaitGroup（钓组）")]
    public ESlotType SlotType = ESlotType.Tackle;

    [Tooltip("UI锚点X位置 (0-1)")]
    [Range(0f, 1f)]
    public float UIPositionX = 0.5f;

    [Tooltip("UI锚点Y位置 (0-1)")]
    [Range(0f, 1f)]
    public float UIPositionY = 0.5f;

    [Tooltip("槽点对应的场景内节点")]
    public Transform SlotTransform;

    [Tooltip("特写相机的位置")]
    public Vector3 CameraPosition;

    public Vector2 GetUIPosition()
    {
        return new Vector2(UIPositionX, UIPositionY);
    }
}
```

### 4.5 SlotInfo 数据结构修改

```csharp
/// <summary>
/// 配件槽信息
/// </summary>
public class SlotInfo
{
    /// <summary>
    /// 配件槽名称
    /// </summary>
    public string m_slotName;

    /// <summary>
    /// 配件槽类型
    /// </summary>
    public ESlotType m_slotType;

    /// <summary>
    /// UI位置
    /// </summary>
    public Vector2 m_uiPosition;

    /// <summary>
    /// 配件槽Transform
    /// </summary>
    public Transform m_slotTransform;
}
```

## 5. 实现流程

### 5.1 初始化流程

1. **TackleAssembleUITask 启动**
   - 创建 TackleAssembleViewStateManager
   - 启动钓具和钓组子UITask
   - 注册所有事件监听

2. **子UITask 初始化**
   - TackleAssembleTackleUITask：初始化3D场景和输入控制
   - TackleAssembleBaitGroupUITask：创建RenderTexture

3. **UI控制器设置**
   - 绑定RenderTexture到RawImage
   - 初始化配件槽按钮
   - 设置初始状态为Default

### 5.2 状态转换流程

#### 5.2.1 Default → FreeObservation

1. 用户开始拖拽鼠标
2. TackleAssembleTackleUIController 触发 EventOnDragStart
3. TackleAssembleUITask 接收事件，调用 SetViewState(FreeObservation)
4. 状态管理器执行状态转换：
   - 隐藏钓组放大镜 (SetBaitGroupViewActive(false))
   - 启用自由观察模式

#### 5.2.2 FreeObservation → Default

1. 用户释放鼠标
2. TackleAssembleTackleUIController 触发 EventOnDragEnd
3. TackleAssembleUITask 接收事件，调用 SetViewState(Default)
4. 状态管理器执行状态转换：
   - 显示钓组放大镜 (SetBaitGroupViewActive(true))
   - 执行Actor旋转归位动画

#### 5.2.3 Default → SlotCloseup

1. 用户点击配件槽按钮
2. TackleAssembleUIController 触发 EventOnSlotButtonClick
3. TackleAssembleUITask 根据槽类型处理：
   - Tackle类型：SetViewState(SlotCloseup) + 3D场景特写
   - BaitGroup类型：执行2D UI放大动画

## 6. 技术规范遵循

### 6.1 BJFramework 架构规范

- **组件化设计**：使用Tofu组件拆分功能模块
- **事件驱动**：通过事件实现组件间解耦通信
- **生命周期管理**：严格遵循Task生命周期
- **接口定义**：为每个Task定义清晰的对外接口

### 6.2 命名规范

- 枚举类型使用E前缀：`ETackleAssembleViewState`
- 事件使用EventOn前缀：`EventOnDragStart`
- 私有字段使用m_前缀：`m_viewStateManager`
- 常量使用Pascal Case：`DefaultAnimationDuration`

### 6.3 错误处理

- 所有公共方法进行空指针检查
- 状态转换前验证当前状态合法性
- 动画执行前检查UI元素存在性
- 事件注册和注销成对出现

## 7. 扩展性考虑

### 7.1 新增状态支持

状态机设计支持轻松添加新的视图状态，只需：
1. 在枚举中添加新状态
2. 在状态管理器中添加对应处理逻辑
3. 实现状态进入/退出方法

### 7.2 动画系统扩展

当前动画使用DOTween实现，可扩展支持：
- 更复杂的动画序列
- 动画事件回调
- 动画中断和恢复

### 7.3 输入系统扩展

输入处理模块化设计，可支持：
- 触控设备适配
- 手柄输入支持
- 自定义输入映射

---

*文档版本: 1.0*
*创建日期: 2025-09-28*
*基于: 钓具组装界面交互优化需求文档 v1.2 + BJFramework架构规范*