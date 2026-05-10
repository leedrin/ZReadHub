# 钓具组装UITask功能设计方案

## 1. 概述

本设计方案旨在详细阐述钓具组装界面的功能实现，遵循 BJFramework 的 `UITask` 模块架构规范，并结合 `Assets/Doc/TackleAssemble/fishassemble.md` (鱼具组装功能需求文档) 和现有代码 (`Assets/GameProject/Scripts/Runtime/GameView/UI/TackleAssembleUITask/`) 进行设计。核心目标是实现钓具配件的组装、方案管理、3D模型展示及UI交互，特别是配件槽点击后出现装配列表并进行状态切换。

## 2. 功能需求

根据 `Assets/Doc/TackleAssemble/fishassemble.md`，钓具组装界面需实现以下核心功能：

1.  **入口多样性**：支持从背包/仓库、局外主界面等多种方式进入。
2.  **核心数据展示**：
    *   **Slot区**：根据当前鱼竿和选择的钓组动态生成和显示配件槽位，并根据状态（未开放、必须组装、可组装、已组装、异常状态、缺失状态）展示不同视觉效果。
    *   **属性窗口**：展示钓具的基础信息、负载信息（5项进度条，含损耗计算）、钓组信息（名称、Tag、介绍、物理调整滑条）。
    *   **3D模型展示**：支持旋转、缩放，根据组装状态动态显示/隐藏部件。
3.  **UI交互**：
    *   **按钮**：手持、拆开、收藏。
    *   **Slot点击**：点击配件槽位后，弹出部件选择/替换列表。
4.  **钓组切换**：支持切换不同的钓组，并动态重构Slot ScrollView。
5.  **物品替换页**：
    *   **筛选与排序**：显示正在使用、近期装配、最常装配、已拥有物品，并进行排序和过滤（不可用项置灰）。
    *   **选中交互**：选中物品后预览属性变化，按钮状态（卸下、安装、加入购物车）动态变化。
6.  **方案系统**：管理自定义方案（保存、删除、分享、应用），支持一键加购缺失物品。
7.  **状态机切换**：界面需要在“配件槽列表”和“装配列表”之间进行状态切换。

## 3. 架构设计

### 3.1. 组件职责

`TackleAssembleUITask` 遵循 BJFramework 的 `UITask` 架构，将功能拆分为多个 Tofu 组件和 UIController。

*   **`TackleAssembleUITask`**:
    *   作为 `UITaskBase` 的子类，负责声明 `LayerDescArray` 和 `UIControllerDescArray`。
    *   通过 `AllCompTofuConstruct` 方法创建和组装业务相关的 Tofu 组件，如 `TackleAssembleUITaskCompMainTofu`。
    *   定义 `CustomParamKey4UIIntentDefineArray` 和 `CustomParamKey4UpdatePipelineDefineArray` 用于参数传递。
    *   定义 `ModeDefineList4Register`，用于注册不同的 UI 模式 (Default, FreeObservation, SlotCloseup)。

*   **`TackleAssembleUITaskCompMainTofu` (核心业务逻辑组件)**:
    *   实现 `ITackleAssembleUITaskCompMainTofu` 接口。
    *   **管理 `IStageActor`**：负责创建、管理和销毁 3D 钓具模型 `IStageActor`。
    *   **业务逻辑处理**：处理配件槽点击、返回、钓组修改等事件。
    *   **状态管理**：管理当前 UI 的模式 (Default, FreeObservation, SlotCloseup) 以及配件槽的特写状态。
    *   **数据流转**：从逻辑层接口 (`PlayerGameObjectCompRodAssembleBase`) 获取钓具组装信息，并转换为 UI 所需的 `SlotInfo` 列表和 `TackleConfig`。
    *   **UI 更新协调**：通过 `m_mainUICtrl` 更新 UI 视觉表现。
    *   **部件热替换**：处理配件槽的部件更换逻辑，包括更新 `TackleConfig` 并重启 `UITask` 的更新管线以刷新 3D 模型和 UI。
    *   **子任务事件订阅**：订阅 3D 视图子任务（如 `TackleAssembleTackleUITask`）的事件，例如 `EventOnActorReady`, `EventOnDragStart`, `EventOnDragEnd`。
    *   **部件选择面板的显示与隐藏**：管理部件选择面板的逻辑。

*   **`TackleAssembleUIController` (UI 视图与交互组件)**:
    *   作为 `UIControllerBase` 的子类，负责 UI 元素的绑定、事件注册和视觉更新。
    *   **UI 元素管理**：管理返回按钮、钓组修改按钮、配件槽按钮容器、钓组特写返回按钮等。
    *   **配件槽按钮动态生成**：根据 `TackleAssembleUITaskCompMainTofu` 提供的 `SlotInfo` 列表动态创建和初始化配件槽按钮。
    *   **视觉效果更新**：根据 `SlotStatus` 更新配件槽按钮的颜色和交互状态。
    *   **事件触发**：将 UI 交互事件（如 `EventOnSlotButtonClick`, `EventOnReturnButtonClick`）通过委托暴露给 `Tofu` 组件处理。
    *   **动画控制**：处理钓组视图的特写动画 (`AnimateBaitGroupViewToCloseup`)。
    *   **模式变化处理**：根据 `Tofu` 传递的模式变化，调整 UI 元素的显示/隐藏状态 (`HandleCloseupModeChange`)。

*   **`TackleSlotList` (Prefab 槽点配置)**:
    *   `MonoBehaviour` 脚本，挂载在钓具 3D Prefab 的根节点上。
    *   包含 `List<SlotData>`，用于在 Unity 编辑器中配置所有可交互的槽点信息，包括 `SlotName`, `SlotType`, `UIPosition` (UI 锚点), `SlotTransform` (3D 场景中的对应 Transform), `CameraPosition` (特写相机位置)。
    *   为 `TackleAssembleUITaskCompMainTofu` 提供 3D 模型与 UI 交互的桥梁数据。

*   **`SlotInfo` & `SlotInfoExtensions`**:
    *   `SlotInfo` 存储配件槽的基本信息（名称、类型、UI位置、3D Transform）。
    *   `SlotInfoExtensions` 提供扩展方法，为 `SlotInfo` 增加业务状态，如 `CurrentPartConfigId` (当前装配部件ID), `SlotStatus` (配件槽状态), `SupportedPartTypes` (支持的部件类型列表)。通过字典 `s_extendedDataDict` 存储扩展数据，实现对 `SlotInfo` 的无侵入扩展。

### 3.2. 状态管理

界面状态将通过 `UITask` 的 `Mode` 机制和 `UIController` 内部状态进行管理。

*   **`UITask` 模式 (`Mode`)**:
    *   **`ModeName4Default`**: 默认模式。显示完整的 UI (3D 模型)。
    *   **`ModeName4FreeObservation`**: 自由观察模式。允许玩家自由旋转观察 3D 钓具模型 并显示返回X按钮。
    *   **`ModeName4SlotCloseup`**: 配件槽特写模式。玩家点击Slot按钮 相机聚焦特定配件槽。

*   **`UIController` 内部状态**:
    *   `SlotStatus` 枚举 (`MustEquip`, `CanEquip`, `NotAvailable`, `Equipped`) 管理每个配件槽按钮的视觉状态和交互性。
    *   `m_isInCloseupView` 布尔值指示当前是否处于特写视图状态。

### 3.3. UI 交互流程 (状态机)

根据需求，核心的状态切换发生在点击 Slot 按钮后，出现装配列表，并能在 Slot Scrollview 和 Assembly Scrollview 之间切换。这可以通过在 `TackleAssembleUIController` 中引入一个 UI 状态机或者通过管理两个 ScrollView 的激活状态来实现。

**方案：通过 UI 状态机（推荐，更清晰）**

在 `TackleAssembleUIController` 中引入一个 `AdvanceUIStateController` (如图片 `image-6.png` 所示)，或者自定义一个简单的 UI 状态机来管理不同 UI 面板的显示。

**状态定义**:

*   **`SlotScrollViewState`**: 显示配件槽列表 (`m_slotButtonContainer`)。
*   **`AssemblyScrollViewState`**: 显示装配列表（即部件选择面板）。
*   **`BaitGroupTemplateScrollViewState`**: 显示钓组模板列表。

**切换逻辑**:

1.  **初始状态**：`SlotScrollViewState`。
2.  **点击配件槽按钮** (`OnSlotButtonClick`)：
    *   `TackleAssembleUITaskCompMainTofu.HandleSlotClick` 接收事件。
    *   根据 `SlotType` (Tackle 或 BaitGroup) 进行处理。
    *   如果需要显示部件选择面板：
        *   调用 `m_mainUICtrl.ShowPartSelectionPanel(slotType, slotName, currentPartId)`。
        *   `ShowPartSelectionPanel` 内部触发 UI 状态机从 `SlotScrollViewState` 切换到 `AssemblyScrollViewState`，并激活装配列表的 GameObject。
3.  **点击钓组模板修改按钮** (`OnBaitGroupModifyButtonClicked`)：
    *   `TackleAssembleUITaskCompMainTofu.OnBaitGroupModifyButtonClicked` 接收事件。
    *   触发 UI 状态机从 `SlotScrollViewState` 切换到 `BaitGroupTemplateScrollViewState`，并激活钓组模板列表的 GameObject。
4.  **点击钓组模板的切换按钮**：
    *   触发 `TackleAssembleUITaskCompMainTofu` 中的钓组切换逻辑。
    *   动态重构 `Slot ScrollView`。
    *   触发 UI 状态机从 `BaitGroupTemplateScrollViewState` 切换回 `SlotScrollViewState`。
5.  **从装配列表或钓组模板列表返回** (例如点击“返回”按钮或选择部件后)：
    *   `TackleAssembleUITaskCompMainTofu.HidePartSelectionPanel` 被调用（或类似的返回方法）。
    *   `HidePartSelectionPanel` 内部触发 UI 状态机从 `AssemblyScrollViewState` 或 `BaitGroupTemplateScrollViewState` 切换回 `SlotScrollViewState`，并隐藏对应的 GameObject。

**UI Prefab 分析 (根据图1-8)**

*   **Pfb_UI_TackleAssembleUITask** (主 UI Prefab):
    *   包含顶部的页签切换 ("装配" / "方案")。
    *   `AssemblePanelRoot`: 对应装配主界面。
        *   `Scroll View` (Slot Scrollview): 包含 `TackleAssembleItemRoot`，动态生成 `Pfb_UI_TackleAssembleItem`。
        *   `AssemblyScrollView` (Assembly Scrollview): 预留用于显示装配列表（部件选择面板）。
        *   `BaitGroupTemplateScrollView` : 用于显示钓组模板列表。
    *   `Pfb_UI_TackleAssembleItem`: 单个配件槽位的 Prefab。
        *   根据图片描述，需要添加两个按钮，用于不同的交互或状态显示。
    *   `Advance UI State Controller`: (如 `image-6.png` 所示) 已存在一个 UI 状态机组件，可以利用其 `State Name` 进行状态管理，例如 `SlotScrollView`、`AssemblyScrollView` 和 `BaitGroupTemplateScrollView`。

### 3.4. 数据流

1.  **启动**：`TackleAssembleUITaskStart` 传入 `tackleConfigId`。
2.  **`Tofu` 初始化**：`TackleAssembleUITaskCompMainTofu` 接收 `tackleConfigId`，并初始化 `m_currentTackleConfig`。
3.  **3D 模型创建**：`TackleCreate` 方法根据 `m_currentTackleConfig` 创建 `IStageActor` (3D 钓具模型)。
4.  **配件槽信息获取**：`OnActorReady` 事件触发后，`TackleAssembleUITaskCompMainTofu` 从 `m_currentTackleActor` 获取 `SlotInfo` 列表，并可能通过 `SlotInfoExtensions` 丰富其业务状态。
5.  **UI 初始化**：`TackleAssembleUIController.InitializeTackleAssembleUI` 接收 `SlotInfo` 列表和动态资源，动态生成配件槽按钮。
6.  **UI 交互**：
    *   **点击配件槽**：`TackleAssembleUIController.OnSlotButtonClick` 触发 `EventOnSlotButtonClick`。
    *   `TackleAssembleUITaskCompMainTofu.OnSlotButtonClicked` 接收事件，并调用 `HandleSlotClick`。
    *   `HandleSlotClick` 根据 `SlotType` 决定显示部件选择面板 (`ShowPartSelectionPanel`)。
    *   部件选择面板显示，用户选择部件。
    *   **点击钓组修改按钮**：`TackleAssembleUIController.EventOnBaitGroupModifyButtonClick` 触发。
    *   `TackleAssembleUITaskCompMainTofu.OnBaitGroupModifyButtonClicked` 接收事件，并触发显示钓组模板列表。
    *   **部件选择**：用户在部件选择面板选择新部件后，触发回调 `OnPartSelectedFromPanel`。
    *   `OnPartSelectedFromPanel` 调用 `PartHotSwap`。
    *   `PartHotSwap` 更新 `m_currentTackleConfig`，并重启 `UITask` 更新管线 (`RestartTackleAssembleTackleUITask`)。
7.  **管线更新**：新的更新管线重新加载 3D 模型和相关资源，并触发 `OnActorReady`。
8.  **UI 刷新**：`OnActorReady` 再次初始化 UI，更新配件槽按钮状态和 3D 模型显示。

### 3.5. 事件机制

*   **UI -> Tofu**: `UIController` 通过 `Action` 委托 (`EventOnSlotButtonClick` 等) 向 `Tofu` 传递用户交互事件。
*   **Tofu -> UI**: `Tofu` 直接调用 `UIController` 的公共方法 (`ShowReturnButton`, `UpdateSlotButtonStatus` 等) 更新 UI 视觉表现。
*   **Tofu -> 3D SubTask**: `Tofu` 通过 `ITackleAssembleUITask` 接口与 3D 视图子任务进行通信，例如 `SlotFocus`, `ReturnToOverview`。
*   **3D SubTask -> Tofu**: 3D 视图子任务通过事件 (`EventOnActorReady`, `EventOnDragStart`, `EventOnDragEnd`) 通知 `Tofu` 状态变化。

### 3.6. 3D 模型集成

*   `TackleAssembleUITaskCompMainTofu` 负责 `IStageActor` 的生命周期管理。
*   `IStageActor` 负责加载 3D 模型 Prefab，并根据 `TackleConfig` 组装各个部件的 3D 模型。
*   `TackleSlotList` 脚本挂载在 3D 模型 Prefab 上，提供 3D 场景中的槽点位置 (`SlotTransform`) 和 UI 锚点 (`UIPosition`)。
*   相机控制：`TackleAssembleTackleUITask` (3D 视图子任务) 提供相机特写 (`SlotFocus`) 和重置 (`CameraReset`) 功能。

### 3.7. UI 状态机 (针对 Slot、Assembly 和 BaitGroupTemplate Scrollview 切换)

如 3.3 节所述，可以利用 `Advance UI State Controller` 组件来管理 `Slot Scrollview`、`Assembly Scrollview` 和 `BaitGroupTemplate Scrollview` 的切换。

*   **状态节点**:
    *   `SlotView`: 对应显示配件槽列表的状态。
    *   `AssemblyView`: 对应显示部件装配列表（即部件选择面板）的状态。
    *   `BaitGroupTemplateView`: 对应显示钓组模板列表的状态。
*   **过渡**:
    *   `SlotView` -> `AssemblyView`: 当点击任何一个配件槽按钮时触发。
    *   `SlotView` -> `BaitGroupTemplateView`: 当点击钓组修改按钮时触发。
    *   `AssemblyView` -> `SlotView`: 当在部件选择面板中选择部件或点击返回按钮时触发。
    *   `BaitGroupTemplateView` -> `SlotView`: 当在钓组模板列表选择模板或点击返回按钮时触发。
*   **行为**:
    *   进入 `SlotView` 状态时，激活 `Slot Scrollview` GameObject，隐藏 `Assembly Scrollview` 和 `BaitGroupTemplate Scrollview` GameObject。
    *   进入 `AssemblyView` 状态时，隐藏 `Slot Scrollview` 和 `BaitGroupTemplate Scrollview` GameObject，激活 `Assembly Scrollview` GameObject，并根据 `SlotType` 和 `slotName` 加载相应的部件列表。
    *   进入 `BaitGroupTemplateView` 状态时，隐藏 `Slot Scrollview` 和 `Assembly Scrollview` GameObject，激活 `BaitGroupTemplate Scrollview` GameObject，并加载钓组模板列表。

## 4. 技术实现细节

### 4.1. 部件选择面板

*   **数据源**：部件选择面板需要从服务器端获取玩家已拥有的、可用于当前槽位的部件列表。这可能需要调用 `PlayerGameObjectCompRodAssembleBase` 中的筛选检查方法 (`ReelCanAssembleCheck`, `RodLineCanAssembleCheck` 等)。
*   **筛选与排序**：根据 `fishassemble.md` 中的要求，实现物品的筛选（类型匹配、是否可用）和排序（收藏、近期装配、属性高低等）。
*   **UI 渲染**：部件选择面板可能是一个可复用的 `ScrollRect`，动态加载 `Pfb_UI_TackleAssembleItem` 或类似的部件项 Prefab。

### 4.2. 钓组模板选择面板

*   **数据源**：钓组模板选择面板需要获取所有可用的钓组模板配置。
*   **UI 渲染**：可能是一个可复用的 `ScrollRect`，动态加载钓组模板项 Prefab。每个模板项应包含钓组名称、描述和“切换”按钮。
*   **动态重构 Slot ScrollView**：当选择新的钓组模板后，`TackleAssembleUITaskCompMainTofu` 需要根据新的钓组配置，重新生成 `SlotInfo` 列表，并通知 `TackleAssembleUIController` 重新初始化配件槽按钮。

### 4.3. 动态资源加载

*   `TackleAssembleUITaskCompMainTofu.DynamicResCollect4Load` 方法中，需要收集配件槽按钮预制件 (`SlotButtonPrefabPath`) 和当前 3D 钓具模型所有部件的资源路径。
*   利用 `m_owner.CompDynamicResourceCacheManagerGet().DynamicResCacheDictGet()` 获取已加载的动态资源。

### 4.4. 性能考量

*   **3D 模型实例化/销毁**：考虑到配件数量可能较多，应使用对象池或异步加载机制 (`Addressables`) 来管理 3D 部件模型，避免频繁的实例化和销毁导致的性能开销。
*   **UI 列表优化**：部件选择面板和钓组模板选择面板中的列表应采用 `UI Virtualization` 或 `Object Pooling` 技术，只渲染当前可见的列表项，减少 UI 元素的创建和更新开销。

## 5. 风险与挑战

*   **数据同步**：确保客户端 `TackleConfig` 与服务器端 `RodAssembleInfo` 的严格同步，避免数据不一致。
*   **复杂依赖**：钓具部件之间存在复杂的依赖关系（如未装主线无法装子线），需要在 UI 逻辑和服务器检查中都进行正确处理。
*   **性能优化**：3D 模型和 UI 列表的动态加载和更新可能带来性能挑战，需要仔细优化。
*   **配置管理**：大量的静态配置表（`ItemConfig`, `RodConfig`, `BaitGroupConfig` 等）需要清晰的结构和严格的校验，以支持复杂的功能逻辑。
*   **UI/UX 体验**：配件槽的动态生成、状态显示、特写动画、部件选择面板的交互等都需要良好的用户体验设计。

## 6. 优化与扩展

*   **动画平滑过渡**：利用 DOTween 或其他动画库，实现 UI 状态切换和 3D 模型相机移动的平滑过渡。
*   **配置驱动**：将更多 UI 布局和逻辑配置化，减少硬编码，提高可维护性和迭代效率。
*   **错误提示**：提供清晰的用户错误提示，例如部件不兼容、背包无物品等。
*   **方案预览**：在方案选择界面，提供方案的 3D 预览功能。
*   **多语言支持**：确保所有 UI 文本和配置数据都支持多语言。
