# 风格驱动的电影级相机编辑器 - 详细设计方案

## 文档信息

- **项目名称**: ProjectEF 电影级相机编辑器
- **文档版本**: v1.0
- **创建日期**: 2025-10-31
- **设计基于**: 现有CameraController架构 + AI风格学习需求

---

## 一、架构分析与设计约束

### 1.1 现有架构概览

#### 1.1.1 核心相机系统

项目已实现完整的相机控制系统，采用**四柱架构**:

```
CameraController (Facade)
├── Command System (命令队列 + 优先级栈)
├── Mode System (状态模式)
├── Effect System (策略 + 组合模式)
└── Track System (数据驱动服务)
```

**关键特性**:
- **CineCameraMode**: 已存在电影模式，通过`PlayableDirector`控制相机
- **CameraTrack**: 支持贝塞尔曲线的相机轨道数据结构
- **CameraTrackManager**: 多轨道管理器
- **CameraTrackManagerEditor**: 完整的轨道编辑器(Scene + Inspector)

#### 1.1.2 编辑器基础设施

项目已有成熟的编辑器框架:
- `BaseAssetEditorWindow<T>`: 通用资产编辑器基类
- `CharacterMotionPresetEditorWindow`: 参考实现案例
- 完整的列表模式、卡片模式、搜索、排序功能

### 1.2 设计约束与架构契合点

**必须遵循的原则**:
1. **不破坏现有架构**: 在CameraController之上扩展，不修改核心代码
2. **复用现有组件**: 利用CameraTrack、CameraTrackManager等已有类
3. **符合BJFramework规范**: 遵循命名规范、层级分离、组件化设计
4. **编辑器风格统一**: 使用BaseAssetEditorWindow框架

---

## 二、需求功能分解

### 2.1 用户需求映射表

| 需求ID | 原始需求 | 技术分解 | 优先级 | 依赖关系 |
|--------|---------|---------|--------|---------|
| **UR-101** | Timeline分镜片段划分 | 创建`CinematicShotClip` + Timeline轨道绑定 | 🚀 高 | - |
| **UR-102** | Scene实时拖拽关键帧 | 扩展`CameraTrackManagerEditor` Scene绘制 | 🚀 高 | UR-101 |
| **UR-103** | 选择运镜风格生成轨迹 | `StylePresetSO` + Barracuda推理 | 🚀 高 | UR-101 |
| **UR-104** | 速度曲线调整 | `AnimationCurve` + 轨迹重采样 | 💡 中 | UR-101 |
| **UR-105** | 轨迹数据保存为资产 | `CinematicShotAsset` (ScriptableObject) | 🚀 高 | UR-101 |
| **UR-106** | 双轨道预览显示 | Timeline双轨道 + Scene Gizmos | 🚀 高 | UR-101 |

### 2.2 技术需求映射表

| 技术ID | 技术点 | 实现方案 | 对应需求 |
|--------|--------|---------|---------|
| **TR-201** | 关键帧+StyleCode插值 | `CinematicPathGenerator` + 贝塞尔算法 | UR-103 |
| **TR-202** | Unity Barracuda集成 | `CameraStylePredictionModel` 推理器 | UR-103 |
| **TR-203** | Time-to-Arrival编码 | `TTAEncoder` (sin-cos 距离编码) | UR-103 |
| **TR-204** | Toric Space工具 | Scene Gizmos辅助线 + 可见性计算 | UR-102 |

---

## 三、核心数据结构设计

### 3.1 数据层级关系

```
CinematicSequenceAsset (顶层容器 - ScriptableObject)
    ├── List<CinematicShotClip> (镜头片段列表)
    │   ├── startTime, endTime (时间范围)
    │   ├── CameraKeyframe startKeyframe (起始关键帧)
    │   ├── CameraKeyframe endKeyframe (结束关键帧)
    │   ├── StylePresetSO stylePreset (风格代码)
    │   ├── AnimationCurve speedCurve (速度曲线)
    │   ├── List<Transform> targetObjects (目标物体列表)
    │   └── CameraTrack generatedTrack (生成的轨迹)
    └── sequenceSettings (序列全局设置)
```

### 3.2 详细类设计

#### 3.2.1 CinematicSequenceAsset (主容器)

```csharp
/// <summary>
/// 电影级相机序列资产
/// 存储完整的相机镜头序列，包含多个镜头片段
/// </summary>
[CreateAssetMenu(fileName = "NewCinematicSequence", menuName = "ProjectEF/Cinematic/Cinematic Sequence")]
public class CinematicSequenceAsset : ScriptableObject
{
    #region 基础信息

    /// <summary>序列唯一ID</summary>
    [SerializeField, HideInInspector]
    private string m_sequenceId = System.Guid.NewGuid().ToString();

    /// <summary>序列总时长(秒)</summary>
    [SerializeField]
    private float m_totalDuration = 10f;

    /// <summary>序列描述</summary>
    [SerializeField, TextArea(3, 5)]
    private string m_description;

    #endregion

    #region 镜头片段

    /// <summary>镜头片段列表</summary>
    [SerializeField]
    private List<CinematicShotClip> m_shotClips = new List<CinematicShotClip>();

    #endregion

    #region 全局设置

    /// <summary>默认相机FOV</summary>
    [SerializeField, Range(10f, 120f)]
    private float m_defaultFOV = 60f;

    /// <summary>贝塞尔采样分辨率</summary>
    [SerializeField, Range(10, 100)]
    private int m_bezierSampleResolution = 50;

    #endregion

    #region 运行时状态

    /// <summary>当前播放的片段索引</summary>
    [System.NonSerialized]
    private int m_currentClipIndex = -1;

    #endregion

    #region 公共API

    /// <summary>添加镜头片段</summary>
    public void AddShotClip(CinematicShotClip clip) { /* ... */ }

    /// <summary>移除镜头片段</summary>
    public void RemoveShotClip(int index) { /* ... */ }

    /// <summary>获取指定时间的活跃片段</summary>
    public CinematicShotClip GetClipAtTime(float time) { /* ... */ }

    /// <summary>验证序列数据完整性</summary>
    public bool Validate(out string errorMessage) { /* ... */ }

    #endregion
}
```

#### 3.2.2 CinematicShotClip (单个镜头片段)

```csharp
/// <summary>
/// 单个电影镜头片段
/// 包含关键帧、风格、生成参数和最终轨迹
/// </summary>
[System.Serializable]
public class CinematicShotClip
{
    #region 基础信息

    /// <summary>片段唯一ID</summary>
    [SerializeField, HideInInspector]
    public string clipId = System.Guid.NewGuid().ToString();

    /// <summary>片段名称(用于识别)</summary>
    [SerializeField]
    public string clipName = "New Shot";

    /// <summary>起始时间(秒)</summary>
    [SerializeField]
    public float startTime = 0f;

    /// <summary>结束时间(秒)</summary>
    [SerializeField]
    public float endTime = 2f;

    #endregion

    #region 关键帧数据

    /// <summary>起始关键帧</summary>
    [SerializeField]
    public CameraKeyframe startKeyframe = new CameraKeyframe();

    /// <summary>结束关键帧</summary>
    [SerializeField]
    public CameraKeyframe endKeyframe = new CameraKeyframe();

    #endregion

    #region 目标物体

    /// <summary>主要目标对象(Target A)</summary>
    [SerializeField]
    public Transform targetA;

    /// <summary>次要目标对象(Target B，可选)</summary>
    [SerializeField]
    public Transform targetB;

    /// <summary>目标物体列表(支持多目标)</summary>
    [SerializeField]
    public List<Transform> additionalTargets = new List<Transform>();

    #endregion

    #region 风格与生成

    /// <summary>运镜风格预设</summary>
    [SerializeField]
    public StylePresetSO stylePreset;

    /// <summary>速度曲线(0-1映射)</summary>
    [SerializeField]
    public AnimationCurve speedCurve = AnimationCurve.EaseInOut(0, 0, 1, 1);

    /// <summary>是否启用AI生成</summary>
    [SerializeField]
    public bool enableAIGeneration = false;

    #endregion

    #region 生成结果

    /// <summary>生成的相机轨迹</summary>
    [SerializeField]
    public CameraTrack generatedTrack;

    /// <summary>生成时间戳</summary>
    [SerializeField, HideInInspector]
    public string generationTimestamp;

    /// <summary>生成状态</summary>
    [System.NonSerialized]
    public GenerationStatus status = GenerationStatus.NotGenerated;

    #endregion

    #region 辅助方法

    /// <summary>获取片段持续时间</summary>
    public float Duration => endTime - startTime;

    /// <summary>检查时间点是否在片段内</summary>
    public bool ContainsTime(float time) => time >= startTime && time <= endTime;

    /// <summary>获取归一化时间(0-1)</summary>
    public float GetNormalizedTime(float time) =>
        Mathf.Clamp01((time - startTime) / Duration);

    #endregion
}

/// <summary>生成状态枚举</summary>
public enum GenerationStatus
{
    NotGenerated,   // 未生成
    Generating,     // 生成中
    Generated,      // 已生成
    Failed          // 生成失败
}
```

#### 3.2.3 CameraKeyframe (相机关键帧)

```csharp
/// <summary>
/// 相机关键帧数据
/// 包含位置、旋转、FOV和贝塞尔切线
/// </summary>
[System.Serializable]
public class CameraKeyframe
{
    #region Transform数据

    /// <summary>相机位置(世界坐标或本地坐标)</summary>
    [SerializeField]
    public Vector3 position = Vector3.zero;

    /// <summary>相机旋转(欧拉角)</summary>
    [SerializeField]
    public Vector3 rotation = Vector3.zero;

    /// <summary>视野角(FOV)</summary>
    [SerializeField, Range(10f, 120f)]
    public float fieldOfView = 60f;

    #endregion

    #region 贝塞尔切线

    /// <summary>入切线(控制进入曲线的形状)</summary>
    [SerializeField]
    public Vector3 inTangent = Vector3.zero;

    /// <summary>出切线(控制离开曲线的形状)</summary>
    [SerializeField]
    public Vector3 outTangent = Vector3.zero;

    /// <summary>切线权重(0-1, 控制切线影响范围)</summary>
    [SerializeField, Range(0f, 1f)]
    public float tangentWeight = 0.33f;

    #endregion

    #region LookAt约束

    /// <summary>是否启用LookAt约束</summary>
    [SerializeField]
    public bool enableLookAtConstraint = false;

    /// <summary>LookAt目标位置(世界坐标)</summary>
    [SerializeField]
    public Vector3 lookAtTarget = Vector3.zero;

    #endregion

    #region 辅助方法

    /// <summary>从Transform设置关键帧</summary>
    public void SetFromTransform(Transform cameraTransform)
    {
        position = cameraTransform.position;
        rotation = cameraTransform.eulerAngles;
    }

    /// <summary>应用到Transform</summary>
    public void ApplyToTransform(Transform cameraTransform)
    {
        cameraTransform.position = position;
        cameraTransform.eulerAngles = rotation;
    }

    /// <summary>克隆关键帧</summary>
    public CameraKeyframe Clone() => (CameraKeyframe)MemberwiseClone();

    #endregion
}
```

#### 3.2.4 StylePresetSO (运镜风格预设)

```csharp
/// <summary>
/// 运镜风格预设(Style Code)
/// 存储从Gating Network提取的风格向量
/// </summary>
[CreateAssetMenu(fileName = "NewStylePreset", menuName = "ProjectEF/Cinematic/Style Preset")]
public class StylePresetSO : ScriptableObject
{
    #region 基础信息

    /// <summary>风格名称(例如: "推进", "环绕", "跟随")</summary>
    [SerializeField]
    public string styleName = "Unnamed Style";

    /// <summary>风格描述</summary>
    [SerializeField, TextArea(2, 4)]
    public string description;

    /// <summary>风格图标(用于编辑器显示)</summary>
    [SerializeField]
    public Texture2D styleIcon;

    #endregion

    #region 风格向量(z^c)

    /// <summary>
    /// 风格代码向量(从Gating Network提取)
    /// 维度通常为32、64或128
    /// </summary>
    [SerializeField]
    public float[] styleCodeVector;

    /// <summary>风格代码维度</summary>
    public int StyleCodeDimension => styleCodeVector?.Length ?? 0;

    #endregion

    #region 预设参数

    /// <summary>默认速度曲线</summary>
    [SerializeField]
    public AnimationCurve defaultSpeedCurve = AnimationCurve.Linear(0, 0, 1, 1);

    /// <summary>推荐相机距离范围</summary>
    [SerializeField]
    public Vector2 recommendedDistanceRange = new Vector2(3f, 10f);

    /// <summary>推荐FOV范围</summary>
    [SerializeField]
    public Vector2 recommendedFOVRange = new Vector2(40f, 80f);

    #endregion

    #region 验证与工具

    /// <summary>验证风格代码有效性</summary>
    public bool Validate()
    {
        return styleCodeVector != null && styleCodeVector.Length > 0;
    }

    /// <summary>从JSON加载风格代码</summary>
    public void LoadFromJSON(string jsonPath) { /* ... */ }

    /// <summary>导出为JSON</summary>
    public string ExportToJSON() { /* ... */ }

    #endregion
}
```

---

## 四、编辑器系统设计

### 4.1 编辑器架构层次

```
CinematicSequenceEditorWindow (主窗口)
    ├── PreviewPanel (预览面板)
    │   └── CinematicSequencePreview (Scene视图扩展)
    ├── TimelinePanel (时间轴面板)
    │   ├── ShotTrackRenderer (镜头轨道渲染器)
    │   └── TargetTrackRenderer (目标轨道渲染器)
    ├── InspectorPanel (属性面板)
    │   ├── KeyframeEditor (关键帧编辑器)
    │   ├── StyleSelector (风格选择器)
    │   └── SpeedCurveEditor (速度曲线编辑器)
    └── ToolbarPanel (工具栏)
        ├── PlaybackControls (播放控制)
        └── GenerationControls (生成控制)
```

### 4.2 CinematicSequenceEditorWindow (主编辑器窗口)

#### 4.2.1 类结构概览

```csharp
/// <summary>
/// 电影级相机序列编辑器主窗口
/// 采用模块化面板设计，支持预览、时间轴、属性编辑
/// </summary>
public class CinematicSequenceEditorWindow : BaseAssetEditorWindow<CinematicSequenceAsset>
{
    #region 面板实例

    private TimelinePanel m_timelinePanel;
    private InspectorPanel m_inspectorPanel;
    private ToolbarPanel m_toolbarPanel;

    #endregion

    #region 编辑状态

    /// <summary>当前选中的片段</summary>
    private CinematicShotClip m_selectedClip;

    /// <summary>时间轴当前时间(秒)</summary>
    private float m_currentTime = 0f;

    /// <summary>是否正在播放</summary>
    private bool m_isPlaying = false;

    /// <summary>播放速度倍率</summary>
    private float m_playbackSpeed = 1f;

    #endregion

    #region BaseEditorWindow实现

    public override string WindowName => "Cinematic Sequence Editor";

    protected override void DrawAssetEditor(CinematicSequenceAsset asset)
    {
        DrawToolbar();

        EditorGUILayout.BeginHorizontal();
        {
            // 左侧：时间轴 + 预览
            EditorGUILayout.BeginVertical(GUILayout.Width(position.width * 0.7f));
            {
                DrawTimelineSection();
                DrawPreviewSection();
            }
            EditorGUILayout.EndVertical();

            // 右侧：属性面板
            EditorGUILayout.BeginVertical(GUILayout.Width(position.width * 0.3f));
            {
                DrawInspectorSection();
            }
            EditorGUILayout.EndVertical();
        }
        EditorGUILayout.EndHorizontal();
    }

    #endregion

    #region 工具栏

    private void DrawToolbar()
    {
        EditorGUILayout.BeginHorizontal(EditorStyles.toolbar, GUILayout.Height(25));

        // 播放控制
        if (GUILayout.Button("⏮", EditorStyles.toolbarButton, GUILayout.Width(30)))
            SeekToStart();

        string playIcon = m_isPlaying ? "⏸" : "▶";
        if (GUILayout.Button(playIcon, EditorStyles.toolbarButton, GUILayout.Width(30)))
            TogglePlayback();

        if (GUILayout.Button("⏭", EditorStyles.toolbarButton, GUILayout.Width(30)))
            SeekToEnd();

        GUILayout.Space(10);

        // 时间显示
        m_currentTime = EditorGUILayout.Slider(m_currentTime, 0f,
            m_selectedAsset.TotalDuration, GUILayout.MinWidth(200));

        EditorGUILayout.LabelField($"{m_currentTime:F2}s", GUILayout.Width(50));

        GUILayout.FlexibleSpace();

        // 生成控制
        if (GUILayout.Button("生成选中片段", EditorStyles.toolbarButton, GUILayout.Width(120)))
            GenerateSelectedClip();

        if (GUILayout.Button("生成全部", EditorStyles.toolbarButton, GUILayout.Width(80)))
            GenerateAllClips();

        EditorGUILayout.EndHorizontal();
    }

    #endregion

    #region 时间轴绘制

    private void DrawTimelineSection()
    {
        EditorGUILayout.LabelField("时间轴", EditorStyles.boldLabel);

        Rect timelineRect = GUILayoutUtility.GetRect(0, 200,
            GUILayout.ExpandWidth(true));

        m_timelinePanel.Draw(timelineRect, m_selectedAsset, m_currentTime);

        // 处理时间轴交互
        HandleTimelineInput(timelineRect);
    }

    private void HandleTimelineInput(Rect timelineRect)
    {
        Event e = Event.current;

        if (timelineRect.Contains(e.mousePosition))
        {
            if (e.type == EventType.MouseDown && e.button == 0)
            {
                // 点击选择片段或拖动时间滑块
                HandleTimelineClick(e.mousePosition, timelineRect);
                e.Use();
            }
            else if (e.type == EventType.MouseDrag && e.button == 0)
            {
                // 拖动调整片段长度或移动片段
                HandleTimelineDrag(e.mousePosition, e.delta);
                e.Use();
            }
        }
    }

    #endregion

    #region 预览绘制

    private void DrawPreviewSection()
    {
        EditorGUILayout.LabelField("Scene预览", EditorStyles.boldLabel);

        EditorGUILayout.BeginVertical(EditorStyles.helpBox);
        {
            EditorGUILayout.HelpBox(
                "在Scene视图中编辑关键帧和贝塞尔切线\n" +
                "使用工具栏切换到Move工具后可拖拽关键帧位置",
                MessageType.Info);

            if (GUILayout.Button("聚焦Scene视图到当前关键帧", GUILayout.Height(25)))
            {
                FocusSceneViewOnCurrentKeyframe();
            }
        }
        EditorGUILayout.EndVertical();
    }

    #endregion

    #region 属性面板

    private void DrawInspectorSection()
    {
        if (m_selectedClip == null)
        {
            EditorGUILayout.HelpBox("未选中镜头片段", MessageType.Info);
            return;
        }

        m_inspectorPanel.Draw(m_selectedClip);
    }

    #endregion
}
```

### 4.3 TimelinePanel (时间轴面板)

#### 4.3.1 双轨道设计

```csharp
/// <summary>
/// 时间轴面板 - 双轨道设计
/// 轨道1: 镜头片段轨道 (Shot Segment Track)
/// 轨道2: 目标物体轨道 (Target Track)
/// </summary>
public class TimelinePanel
{
    #region 常量定义

    private const float TRACK_HEIGHT = 60f;
    private const float TRACK_SPACING = 10f;
    private const float TIME_RULER_HEIGHT = 30f;
    private const float CLIP_MIN_WIDTH = 50f;

    #endregion

    #region 绘制主入口

    public void Draw(Rect rect, CinematicSequenceAsset asset, float currentTime)
    {
        // 背景
        EditorGUI.DrawRect(rect, new Color(0.15f, 0.15f, 0.15f));

        // 绘制时间标尺
        Rect rulerRect = new Rect(rect.x, rect.y, rect.width, TIME_RULER_HEIGHT);
        DrawTimeRuler(rulerRect, asset.TotalDuration, currentTime);

        // 绘制镜头轨道
        Rect shotTrackRect = new Rect(rect.x, rect.y + TIME_RULER_HEIGHT + TRACK_SPACING,
                                      rect.width, TRACK_HEIGHT);
        DrawShotTrack(shotTrackRect, asset);

        // 绘制目标轨道
        Rect targetTrackRect = new Rect(rect.x,
                                        shotTrackRect.y + TRACK_HEIGHT + TRACK_SPACING,
                                        rect.width, TRACK_HEIGHT);
        DrawTargetTrack(targetTrackRect, asset);

        // 绘制播放头
        DrawPlayhead(rect, currentTime, asset.TotalDuration);
    }

    #endregion

    #region 时间标尺绘制

    private void DrawTimeRuler(Rect rect, float totalDuration, float currentTime)
    {
        // 背景
        EditorGUI.DrawRect(rect, new Color(0.2f, 0.2f, 0.2f));

        // 计算时间刻度
        int majorTickCount = Mathf.CeilToInt(totalDuration);
        float pixelsPerSecond = rect.width / totalDuration;

        // 绘制主刻度
        for (int i = 0; i <= majorTickCount; i++)
        {
            float x = rect.x + i * pixelsPerSecond;

            // 刻度线
            Handles.color = Color.white;
            Handles.DrawLine(new Vector3(x, rect.yMax - 10, 0),
                           new Vector3(x, rect.yMax, 0));

            // 时间标签
            GUI.Label(new Rect(x - 15, rect.y, 30, rect.height - 10),
                     $"{i}s", EditorStyles.miniLabel);
        }

        // 绘制次刻度(0.5秒间隔)
        for (float t = 0.5f; t < totalDuration; t += 1f)
        {
            float x = rect.x + t * pixelsPerSecond;
            Handles.color = new Color(1f, 1f, 1f, 0.3f);
            Handles.DrawLine(new Vector3(x, rect.yMax - 5, 0),
                           new Vector3(x, rect.yMax, 0));
        }
    }

    #endregion

    #region 镜头轨道绘制

    private void DrawShotTrack(Rect trackRect, CinematicSequenceAsset asset)
    {
        // 轨道背景
        EditorGUI.DrawRect(trackRect, new Color(0.25f, 0.25f, 0.25f));

        // 轨道标签
        Rect labelRect = new Rect(trackRect.x + 5, trackRect.y + 5, 100, 20);
        GUI.Label(labelRect, "镜头片段", EditorStyles.boldLabel);

        // 绘制每个片段
        float pixelsPerSecond = trackRect.width / asset.TotalDuration;

        foreach (var clip in asset.ShotClips)
        {
            float clipX = trackRect.x + clip.startTime * pixelsPerSecond;
            float clipWidth = clip.Duration * pixelsPerSecond;

            Rect clipRect = new Rect(clipX, trackRect.y + 25, clipWidth,
                                    trackRect.height - 30);

            DrawShotClip(clipRect, clip);
        }
    }

    private void DrawShotClip(Rect rect, CinematicShotClip clip)
    {
        // 片段底色
        Color clipColor = GetClipColor(clip.status);
        EditorGUI.DrawRect(rect, clipColor);

        // 片段边框
        Handles.DrawSolidRectangleWithOutline(rect, Color.clear, Color.black);

        // 片段名称
        GUI.Label(new Rect(rect.x + 5, rect.y + 5, rect.width - 10, 20),
                 clip.clipName, EditorStyles.whiteLabel);

        // 状态图标
        DrawStatusIcon(new Rect(rect.xMax - 25, rect.y + 5, 20, 20), clip.status);

        // 风格标签
        if (clip.stylePreset != null)
        {
            GUI.Label(new Rect(rect.x + 5, rect.yMax - 20, rect.width - 10, 15),
                     clip.stylePreset.styleName, EditorStyles.miniLabel);
        }
    }

    private Color GetClipColor(GenerationStatus status)
    {
        return status switch
        {
            GenerationStatus.NotGenerated => new Color(0.4f, 0.4f, 0.4f),
            GenerationStatus.Generating => new Color(0.8f, 0.6f, 0.2f),
            GenerationStatus.Generated => new Color(0.3f, 0.6f, 0.3f),
            GenerationStatus.Failed => new Color(0.6f, 0.2f, 0.2f),
            _ => Color.gray
        };
    }

    #endregion

    #region 目标轨道绘制

    private void DrawTargetTrack(Rect trackRect, CinematicSequenceAsset asset)
    {
        // 轨道背景
        EditorGUI.DrawRect(trackRect, new Color(0.2f, 0.25f, 0.3f));

        // 轨道标签
        Rect labelRect = new Rect(trackRect.x + 5, trackRect.y + 5, 100, 20);
        GUI.Label(labelRect, "目标物体", EditorStyles.boldLabel);

        // 绘制目标标记
        float pixelsPerSecond = trackRect.width / asset.TotalDuration;

        foreach (var clip in asset.ShotClips)
        {
            DrawTargetMarkers(trackRect, clip, pixelsPerSecond);
        }
    }

    private void DrawTargetMarkers(Rect trackRect, CinematicShotClip clip,
                                   float pixelsPerSecond)
    {
        // Target A 标记
        if (clip.targetA != null)
        {
            float markerX = trackRect.x + clip.startTime * pixelsPerSecond;
            DrawTargetMarker(markerX, trackRect.y + 25, clip.targetA.name,
                           new Color(0.2f, 0.8f, 0.2f));
        }

        // Target B 标记
        if (clip.targetB != null)
        {
            float markerX = trackRect.x + clip.startTime * pixelsPerSecond + 30;
            DrawTargetMarker(markerX, trackRect.y + 25, clip.targetB.name,
                           new Color(0.2f, 0.6f, 0.8f));
        }
    }

    private void DrawTargetMarker(float x, float y, string targetName, Color color)
    {
        Rect markerRect = new Rect(x, y, 20, 20);
        EditorGUI.DrawRect(markerRect, color);

        // 绘制连接线到镜头轨道
        Handles.color = color;
        Handles.DrawLine(new Vector3(x + 10, y, 0),
                        new Vector3(x + 10, y - 35, 0));

        // 目标名称标签
        GUI.Label(new Rect(x + 25, y, 100, 20), targetName, EditorStyles.miniLabel);
    }

    #endregion

    #region 播放头绘制

    private void DrawPlayhead(Rect timelineRect, float currentTime, float totalDuration)
    {
        float pixelsPerSecond = timelineRect.width / totalDuration;
        float playheadX = timelineRect.x + currentTime * pixelsPerSecond;

        // 播放头线
        Handles.color = Color.red;
        Handles.DrawLine(new Vector3(playheadX, timelineRect.y, 0),
                        new Vector3(playheadX, timelineRect.yMax, 0));

        // 播放头三角
        Vector3[] triangle = new Vector3[]
        {
            new Vector3(playheadX - 5, timelineRect.y, 0),
            new Vector3(playheadX + 5, timelineRect.y, 0),
            new Vector3(playheadX, timelineRect.y + 10, 0)
        };
        Handles.DrawAAConvexPolygon(triangle);
    }

    #endregion
}
```

### 4.4 Scene视图扩展 (关键帧可视化)

```csharp
/// <summary>
/// Scene视图扩展 - 绘制关键帧和贝塞尔切线
/// 支持实时拖拽编辑
/// </summary>
[InitializeOnLoad]
public static class CinematicSequenceSceneExtension
{
    static CinematicSequenceSceneExtension()
    {
        SceneView.duringSceneGui += OnSceneGUI;
    }

    private static void OnSceneGUI(SceneView sceneView)
    {
        // 获取当前编辑的序列
        var window = EditorWindow.GetWindow<CinematicSequenceEditorWindow>(false, null, false);
        if (window == null || window.SelectedAsset == null || window.SelectedClip == null)
            return;

        var clip = window.SelectedClip;

        // 绘制起始关键帧
        DrawKeyframeHandle(clip.startKeyframe, "Start", Color.green);

        // 绘制结束关键帧
        DrawKeyframeHandle(clip.endKeyframe, "End", Color.red);

        // 绘制贝塞尔曲线预览
        if (clip.generatedTrack != null)
        {
            DrawBezierPath(clip.generatedTrack);
        }

        // 绘制目标物体辅助线 (Toric Space)
        DrawToricSpaceHelper(clip);
    }

    private static void DrawKeyframeHandle(CameraKeyframe keyframe,
                                          string label, Color color)
    {
        Handles.color = color;

        // 位置控制柄
        EditorGUI.BeginChangeCheck();
        Vector3 newPos = Handles.PositionHandle(keyframe.position,
                                               Quaternion.Euler(keyframe.rotation));
        if (EditorGUI.EndChangeCheck())
        {
            Undo.RecordObject(/* ... */, "Move Camera Keyframe");
            keyframe.position = newPos;
        }

        // 旋转控制柄 (可选)
        Quaternion newRot = Handles.RotationHandle(
            Quaternion.Euler(keyframe.rotation), keyframe.position);
        if (EditorGUI.EndChangeCheck())
        {
            keyframe.rotation = newRot.eulerAngles;
        }

        // 绘制FOV视锥体
        DrawFOVFrustum(keyframe.position, keyframe.rotation, keyframe.fieldOfView);

        // 绘制贝塞尔切线控制柄
        DrawTangentHandles(keyframe);

        // 标签
        Handles.Label(keyframe.position + Vector3.up * 0.5f, label);
    }

    private static void DrawTangentHandles(CameraKeyframe keyframe)
    {
        Handles.color = Color.yellow;

        // 入切线控制点
        Vector3 inControlPoint = keyframe.position + keyframe.inTangent;
        Handles.DrawDottedLine(keyframe.position, inControlPoint, 2f);

        EditorGUI.BeginChangeCheck();
        Vector3 newInControl = Handles.FreeMoveHandle(inControlPoint,
            Quaternion.identity, 0.1f, Vector3.zero, Handles.SphereHandleCap);
        if (EditorGUI.EndChangeCheck())
        {
            keyframe.inTangent = newInControl - keyframe.position;
        }

        // 出切线控制点
        Vector3 outControlPoint = keyframe.position + keyframe.outTangent;
        Handles.DrawDottedLine(keyframe.position, outControlPoint, 2f);

        EditorGUI.BeginChangeCheck();
        Vector3 newOutControl = Handles.FreeMoveHandle(outControlPoint,
            Quaternion.identity, 0.1f, Vector3.zero, Handles.SphereHandleCap);
        if (EditorGUI.EndChangeCheck())
        {
            keyframe.outTangent = newOutControl - keyframe.position;
        }
    }

    private static void DrawFOVFrustum(Vector3 position, Vector3 rotation, float fov)
    {
        Matrix4x4 matrix = Matrix4x4.TRS(position, Quaternion.Euler(rotation),
                                        Vector3.one);
        using (new Handles.DrawingScope(matrix))
        {
            Handles.color = new Color(1f, 1f, 1f, 0.3f);
            Handles.DrawFrustum(Vector3.zero, fov, 2f, 0.1f, 1.33f);
        }
    }

    private static void DrawBezierPath(CameraTrack track)
    {
        var sortedPoints = track.GetSortedTrackPoints();
        if (sortedPoints == null || sortedPoints.Length < 2)
            return;

        track.GetBezierControlPoints(out var ctrl1, out var ctrl2);

        Handles.color = Color.cyan;

        for (int i = 0; i < sortedPoints.Length - 1; i++)
        {
            Vector3 p0 = sortedPoints[i].positionOffset;
            Vector3 p1 = ctrl1[i];
            Vector3 p2 = ctrl2[i];
            Vector3 p3 = sortedPoints[i + 1].positionOffset;

            Handles.DrawBezier(p0, p3, p1, p2, Color.cyan, null, 2f);
        }
    }

    private static void DrawToricSpaceHelper(CinematicShotClip clip)
    {
        if (clip.targetA == null)
            return;

        // 绘制从相机到目标的连线
        Handles.color = new Color(1f, 0.5f, 0f, 0.5f);
        Handles.DrawLine(clip.startKeyframe.position, clip.targetA.position);

        if (clip.targetB != null)
        {
            Handles.DrawLine(clip.startKeyframe.position, clip.targetB.position);
        }

        // 绘制目标可见性辅助圆环 (基于FOV)
        DrawVisibilityCircle(clip.startKeyframe, clip.targetA.position);
    }

    private static void DrawVisibilityCircle(CameraKeyframe keyframe, Vector3 targetPos)
    {
        Vector3 cameraForward = Quaternion.Euler(keyframe.rotation) * Vector3.forward;
        float distance = Vector3.Distance(keyframe.position, targetPos);
        float radius = Mathf.Tan(keyframe.fieldOfView * 0.5f * Mathf.Deg2Rad) * distance;

        Handles.color = new Color(1f, 1f, 0f, 0.2f);
        Handles.DrawWireDisc(keyframe.position + cameraForward * distance,
                            cameraForward, radius);
    }
}
```

---

## 五、AI智能生成系统设计

### 5.1 系统架构

```
CameraPathGenerationSystem
    ├── CameraStylePredictionModel (Barracuda推理)
    │   ├── ONNXModel (ONNX模型文件)
    │   └── IWorker (Barracuda Worker)
    ├── TTAEncoder (Time-to-Arrival编码器)
    ├── CinematicPathGenerator (轨迹生成器)
    │   ├── InputPreprocessor (输入预处理)
    │   ├── BezierControlPointSolver (贝塞尔控制点求解器)
    │   └── PathSampler (路径采样器)
    └── GenerationQueue (异步生成队列)
```

### 5.2 核心组件实现

#### 5.2.1 CameraStylePredictionModel (Barracuda推理器)

```csharp
/// <summary>
/// 相机风格预测模型 - Unity Barracuda推理
/// 输入: 关键帧 + StyleCode + TTA编码
/// 输出: 贝塞尔控制点坐标
/// </summary>
public class CameraStylePredictionModel : IDisposable
{
    #region 模型资源

    /// <summary>ONNX模型资产</summary>
    private NNModel m_onnxModel;

    /// <summary>Barracuda运行时模型</summary>
    private Model m_runtimeModel;

    /// <summary>推理Worker</summary>
    private IWorker m_worker;

    #endregion

    #region 初始化

    /// <summary>
    /// 初始化模型
    /// </summary>
    /// <param name="modelAsset">ONNX模型资产</param>
    /// <param name="workerType">Worker类型(GPU/CPU)</param>
    public void Initialize(NNModel modelAsset, WorkerFactory.Type workerType)
    {
        m_onnxModel = modelAsset;
        m_runtimeModel = ModelLoader.Load(m_onnxModel);
        m_worker = WorkerFactory.CreateWorker(workerType, m_runtimeModel);

        Debug.Log($"[CameraStylePredictionModel] Initialized with {workerType}");
    }

    #endregion

    #region 推理接口

    /// <summary>
    /// 预测贝塞尔控制点
    /// </summary>
    /// <param name="input">输入数据</param>
    /// <returns>预测结果</returns>
    public PredictionResult Predict(PredictionInput input)
    {
        // 1. 构建输入Tensor
        Tensor inputTensor = CreateInputTensor(input);

        // 2. 执行推理
        m_worker.Execute(inputTensor);

        // 3. 获取输出
        Tensor outputTensor = m_worker.PeekOutput();

        // 4. 解析结果
        PredictionResult result = ParseOutput(outputTensor);

        // 5. 清理资源
        inputTensor.Dispose();
        outputTensor.Dispose();

        return result;
    }

    #endregion

    #region 输入处理

    private Tensor CreateInputTensor(PredictionInput input)
    {
        // 计算输入维度:
        // 起始关键帧(7) + 结束关键帧(7) + 风格代码(N) + TTA编码(2)
        // 关键帧: position(3) + rotation(3) + fov(1)

        int styleCodeDim = input.styleCode.Length;
        int totalDim = 7 + 7 + styleCodeDim + 2;

        float[] inputData = new float[totalDim];
        int index = 0;

        // 起始关键帧
        CopyKeyframeToArray(input.startKeyframe, inputData, ref index);

        // 结束关键帧
        CopyKeyframeToArray(input.endKeyframe, inputData, ref index);

        // 风格代码
        System.Array.Copy(input.styleCode, 0, inputData, index, styleCodeDim);
        index += styleCodeDim;

        // TTA编码
        inputData[index++] = input.ttaEncoding.x; // sin(z_tta)
        inputData[index++] = input.ttaEncoding.y; // cos(z_tta)

        return new Tensor(1, totalDim, inputData);
    }

    private void CopyKeyframeToArray(CameraKeyframe keyframe, float[] array,
                                     ref int startIndex)
    {
        // Position
        array[startIndex++] = keyframe.position.x;
        array[startIndex++] = keyframe.position.y;
        array[startIndex++] = keyframe.position.z;

        // Rotation (normalized euler angles)
        array[startIndex++] = keyframe.rotation.x / 360f;
        array[startIndex++] = keyframe.rotation.y / 360f;
        array[startIndex++] = keyframe.rotation.z / 360f;

        // FOV (normalized)
        array[startIndex++] = keyframe.fieldOfView / 120f;
    }

    #endregion

    #region 输出处理

    private PredictionResult ParseOutput(Tensor outputTensor)
    {
        // 输出格式:
        // controlPoint1(3) + controlPoint2(3) + confidence(1)

        float[] outputData = outputTensor.ToReadOnlyArray();

        return new PredictionResult
        {
            controlPoint1 = new Vector3(outputData[0], outputData[1], outputData[2]),
            controlPoint2 = new Vector3(outputData[3], outputData[4], outputData[5]),
            confidence = outputData.Length > 6 ? outputData[6] : 1.0f,
            isValid = true
        };
    }

    #endregion

    #region 资源释放

    public void Dispose()
    {
        m_worker?.Dispose();
        m_worker = null;

        Debug.Log("[CameraStylePredictionModel] Disposed");
    }

    #endregion
}

/// <summary>预测输入数据</summary>
public struct PredictionInput
{
    public CameraKeyframe startKeyframe;
    public CameraKeyframe endKeyframe;
    public float[] styleCode;
    public Vector2 ttaEncoding;  // (sin, cos)
}

/// <summary>预测结果</summary>
public struct PredictionResult
{
    public Vector3 controlPoint1;
    public Vector3 controlPoint2;
    public float confidence;
    public bool isValid;
}
```

#### 5.2.2 TTAEncoder (Time-to-Arrival编码器)

```csharp
/// <summary>
/// Time-to-Arrival编码器
/// 将距离值编码为sin-cos形式，提供连续的位置表示
/// </summary>
public static class TTAEncoder
{
    /// <summary>
    /// 编码归一化进度(0-1)为TTA向量
    /// </summary>
    /// <param name="normalizedProgress">归一化进度 [0, 1]</param>
    /// <param name="frequency">频率系数(控制周期性)</param>
    /// <returns>TTA编码向量 (sin, cos)</returns>
    public static Vector2 Encode(float normalizedProgress, float frequency = 1.0f)
    {
        float angle = normalizedProgress * frequency * 2 * Mathf.PI;
        return new Vector2(Mathf.Sin(angle), Mathf.Cos(angle));
    }

    /// <summary>
    /// 编码实际距离(米)为TTA向量
    /// </summary>
    /// <param name="distance">距离(米)</param>
    /// <param name="maxDistance">最大距离(米)</param>
    /// <param name="frequency">频率系数</param>
    /// <returns>TTA编码向量</returns>
    public static Vector2 EncodeDistance(float distance, float maxDistance,
                                        float frequency = 1.0f)
    {
        float normalized = Mathf.Clamp01(distance / maxDistance);
        return Encode(normalized, frequency);
    }

    /// <summary>
    /// 批量编码(用于生成中间插值点)
    /// </summary>
    public static Vector2[] EncodeBatch(int sampleCount, float frequency = 1.0f)
    {
        Vector2[] encodings = new Vector2[sampleCount];
        for (int i = 0; i < sampleCount; i++)
        {
            float t = (float)i / (sampleCount - 1);
            encodings[i] = Encode(t, frequency);
        }
        return encodings;
    }
}
```

#### 5.2.3 CinematicPathGenerator (轨迹生成器)

```csharp
/// <summary>
/// 电影级路径生成器
/// 协调AI推理和贝塞尔曲线生成
/// </summary>
public class CinematicPathGenerator
{
    #region 依赖组件

    private CameraStylePredictionModel m_predictionModel;

    #endregion

    #region 构造函数

    public CinematicPathGenerator(CameraStylePredictionModel predictionModel)
    {
        m_predictionModel = predictionModel;
    }

    #endregion

    #region 生成接口

    /// <summary>
    /// 生成完整的相机轨迹
    /// </summary>
    /// <param name="clip">镜头片段</param>
    /// <param name="settings">生成设置</param>
    /// <returns>生成的相机轨迹</returns>
    public CameraTrack Generate(CinematicShotClip clip,
                               GenerationSettings settings)
    {
        // 1. 验证输入
        if (!ValidateInput(clip, out string error))
        {
            Debug.LogError($"[PathGenerator] Invalid input: {error}");
            return null;
        }

        // 2. 准备输入数据
        PredictionInput input = PrepareInput(clip, settings);

        // 3. AI推理
        PredictionResult prediction = m_predictionModel.Predict(input);

        if (!prediction.isValid || prediction.confidence < settings.minConfidence)
        {
            Debug.LogWarning($"[PathGenerator] Low confidence: {prediction.confidence}");
            // 降级到默认生成
            return GenerateDefaultPath(clip, settings);
        }

        // 4. 构建CameraTrack
        CameraTrack track = BuildTrack(clip, prediction, settings);

        // 5. 应用速度曲线重采样(可选)
        if (clip.speedCurve != null)
        {
            ApplySpeedCurve(track, clip.speedCurve);
        }

        return track;
    }

    #endregion

    #region 输入准备

    private PredictionInput PrepareInput(CinematicShotClip clip,
                                        GenerationSettings settings)
    {
        // 计算TTA编码
        float duration = clip.Duration;
        Vector2 ttaEncoding = TTAEncoder.EncodeDistance(duration,
            settings.maxShotDuration, settings.ttaFrequency);

        return new PredictionInput
        {
            startKeyframe = clip.startKeyframe,
            endKeyframe = clip.endKeyframe,
            styleCode = clip.stylePreset.styleCodeVector,
            ttaEncoding = ttaEncoding
        };
    }

    #endregion

    #region 轨迹构建

    private CameraTrack BuildTrack(CinematicShotClip clip,
                                  PredictionResult prediction,
                                  GenerationSettings settings)
    {
        CameraTrack track = new CameraTrack(clip.clipName, Color.cyan);

        // 添加起始点
        CameraTrackPoint startPoint = new CameraTrackPoint(
            pitchAngle: CalculatePitch(clip.startKeyframe.rotation),
            posOffset: clip.startKeyframe.position,
            rotOffset: Vector3.zero
        );
        track.AddTrackPoint(startPoint);

        // 添加中间控制点(基于AI预测)
        AddIntermediatePoints(track, clip, prediction, settings);

        // 添加结束点
        CameraTrackPoint endPoint = new CameraTrackPoint(
            pitchAngle: CalculatePitch(clip.endKeyframe.rotation),
            posOffset: clip.endKeyframe.position,
            rotOffset: Vector3.zero
        );
        track.AddTrackPoint(endPoint);

        // 设置插值类型
        track.interpolationType = TrackInterpolationType.Bezier;

        // 缓存控制点(用于贝塞尔插值)
        track.InvalidateCache();

        return track;
    }

    private void AddIntermediatePoints(CameraTrack track,
                                      CinematicShotClip clip,
                                      PredictionResult prediction,
                                      GenerationSettings settings)
    {
        // 根据片段时长决定中间点数量
        int intermediateCount = CalculateIntermediatePointCount(
            clip.Duration, settings.minIntermediatePoints,
            settings.maxIntermediatePoints);

        for (int i = 1; i <= intermediateCount; i++)
        {
            float t = (float)i / (intermediateCount + 1);

            // 使用AI预测的控制点进行贝塞尔插值
            Vector3 interpPos = CalculateBezierPosition(
                clip.startKeyframe.position,
                prediction.controlPoint1,
                prediction.controlPoint2,
                clip.endKeyframe.position,
                t
            );

            // 插值Pitch
            float pitch = Mathf.Lerp(
                CalculatePitch(clip.startKeyframe.rotation),
                CalculatePitch(clip.endKeyframe.rotation),
                t
            );

            CameraTrackPoint point = new CameraTrackPoint(pitch, interpPos);
            track.AddTrackPoint(point);
        }
    }

    private Vector3 CalculateBezierPosition(Vector3 p0, Vector3 p1,
                                           Vector3 p2, Vector3 p3, float t)
    {
        float u = 1 - t;
        float tt = t * t;
        float uu = u * u;
        float uuu = uu * u;
        float ttt = tt * t;

        Vector3 p = uuu * p0;
        p += 3 * uu * t * p1;
        p += 3 * u * tt * p2;
        p += ttt * p3;

        return p;
    }

    private float CalculatePitch(Vector3 eulerRotation)
    {
        return -eulerRotation.x; // Unity的Pitch是负X轴
    }

    #endregion

    #region 速度曲线应用

    private void ApplySpeedCurve(CameraTrack track, AnimationCurve speedCurve)
    {
        // 重新采样轨迹点，根据速度曲线调整点的分布密度
        var sortedPoints = track.GetSortedTrackPoints();
        if (sortedPoints.Length < 2)
            return;

        List<CameraTrackPoint> newPoints = new List<CameraTrackPoint>();

        // 保留起始点
        newPoints.Add(sortedPoints[0]);

        // 根据速度曲线重新分布中间点
        int targetCount = sortedPoints.Length;
        for (int i = 1; i < targetCount - 1; i++)
        {
            float linearT = (float)i / (targetCount - 1);
            float curvedT = speedCurve.Evaluate(linearT);

            // 根据调整后的t值插值
            CameraTrackPoint interpPoint = InterpolateTrackPoint(
                sortedPoints, curvedT);

            newPoints.Add(interpPoint);
        }

        // 保留结束点
        newPoints.Add(sortedPoints[sortedPoints.Length - 1]);

        // 替换轨迹点
        track.trackPoints.Clear();
        track.trackPoints.AddRange(newPoints);
        track.InvalidateCache();
    }

    private CameraTrackPoint InterpolateTrackPoint(
        CameraTrackPoint[] points, float t)
    {
        // 在整个轨迹上进行插值
        int segmentCount = points.Length - 1;
        float segmentT = t * segmentCount;
        int segmentIndex = Mathf.FloorToInt(segmentT);
        float localT = segmentT - segmentIndex;

        segmentIndex = Mathf.Clamp(segmentIndex, 0, segmentCount - 1);

        return points[segmentIndex].Lerp(points[segmentIndex + 1], localT);
    }

    #endregion

    #region 默认生成(降级方案)

    private CameraTrack GenerateDefaultPath(CinematicShotClip clip,
                                           GenerationSettings settings)
    {
        // 简单的线性插值作为降级方案
        CameraTrack track = new CameraTrack(clip.clipName + " (Default)",
                                           Color.gray);

        // 起始点
        track.AddTrackPoint(new CameraTrackPoint(
            CalculatePitch(clip.startKeyframe.rotation),
            clip.startKeyframe.position
        ));

        // 结束点
        track.AddTrackPoint(new CameraTrackPoint(
            CalculatePitch(clip.endKeyframe.rotation),
            clip.endKeyframe.position
        ));

        track.interpolationType = TrackInterpolationType.Linear;
        return track;
    }

    #endregion

    #region 验证

    private bool ValidateInput(CinematicShotClip clip, out string error)
    {
        if (clip == null)
        {
            error = "Clip is null";
            return false;
        }

        if (clip.stylePreset == null || !clip.stylePreset.Validate())
        {
            error = "Invalid style preset";
            return false;
        }

        if (clip.startKeyframe == null || clip.endKeyframe == null)
        {
            error = "Missing keyframes";
            return false;
        }

        error = null;
        return true;
    }

    private int CalculateIntermediatePointCount(float duration,
                                                int min, int max)
    {
        // 根据时长动态计算: 1秒1个中间点
        int count = Mathf.RoundToInt(duration);
        return Mathf.Clamp(count, min, max);
    }

    #endregion
}

/// <summary>生成设置</summary>
[System.Serializable]
public class GenerationSettings
{
    [Tooltip("最小置信度阈值(0-1)")]
    public float minConfidence = 0.5f;

    [Tooltip("最大镜头时长(用于TTA编码归一化)")]
    public float maxShotDuration = 30f;

    [Tooltip("TTA编码频率")]
    public float ttaFrequency = 1.0f;

    [Tooltip("最小中间点数量")]
    public int minIntermediatePoints = 2;

    [Tooltip("最大中间点数量")]
    public int maxIntermediatePoints = 10;
}
```

---

## 六、Runtime播放系统设计

### 6.1 Timeline集成方案

```csharp
/// <summary>
/// Cinematic相机Timeline轨道
/// 用于Timeline系统播放CinematicSequenceAsset
/// </summary>
[TrackColor(0.2f, 0.8f, 1f)]
[TrackClipType(typeof(CinematicShotPlayableAsset))]
[TrackBindingType(typeof(CameraController))]
public class CinematicCameraTrack : TrackAsset
{
    public override Playable CreateTrackMixer(PlayableGraph graph,
                                             GameObject go, int inputCount)
    {
        return ScriptPlayable<CinematicCameraMixerBehaviour>.Create(
            graph, inputCount);
    }
}

/// <summary>
/// Cinematic镜头Playable资产
/// </summary>
public class CinematicShotPlayableAsset : PlayableAsset, ITimelineClipAsset
{
    public CinematicShotClip shotClip;

    public ClipCaps clipCaps => ClipCaps.Blending | ClipCaps.Extrapolation;

    public override Playable CreatePlayable(PlayableGraph graph, GameObject owner)
    {
        var playable = ScriptPlayable<CinematicShotBehaviour>.Create(graph);
        var behaviour = playable.GetBehaviour();
        behaviour.shotClip = shotClip;
        return playable;
    }
}

/// <summary>
/// Cinematic镜头行为
/// </summary>
public class CinematicShotBehaviour : PlayableBehaviour
{
    public CinematicShotClip shotClip;

    private CameraController m_cameraController;
    private CameraTrack m_activeTrack;

    public override void OnPlayableCreate(Playable playable)
    {
        // 从生成的轨迹创建CameraTrack
        m_activeTrack = shotClip.generatedTrack;
    }

    public override void ProcessFrame(Playable playable, FrameData info, object playerData)
    {
        m_cameraController = playerData as CameraController;
        if (m_cameraController == null || m_activeTrack == null)
            return;

        // 计算归一化时间
        float normalizedTime = (float)(playable.GetTime() / playable.GetDuration());

        // 应用速度曲线
        if (shotClip.speedCurve != null)
        {
            normalizedTime = shotClip.speedCurve.Evaluate(normalizedTime);
        }

        // 计算相机位置和旋转
        Vector3 cameraPos = CalculateCameraPosition(normalizedTime);
        Quaternion cameraRot = CalculateCameraRotation(normalizedTime);

        // 应用到相机
        m_cameraController.MainCamera.transform.position = cameraPos;
        m_cameraController.MainCamera.transform.rotation = cameraRot;
    }

    private Vector3 CalculateCameraPosition(float t)
    {
        var sortedPoints = m_activeTrack.GetSortedTrackPoints();

        // 在轨迹上插值
        float segmentT = t * (sortedPoints.Length - 1);
        int segmentIndex = Mathf.FloorToInt(segmentT);
        float localT = segmentT - segmentIndex;

        segmentIndex = Mathf.Clamp(segmentIndex, 0, sortedPoints.Length - 2);

        // 贝塞尔插值
        m_activeTrack.GetBezierControlPoints(out var ctrl1, out var ctrl2);

        Vector3 p0 = sortedPoints[segmentIndex].positionOffset;
        Vector3 p1 = ctrl1[segmentIndex];
        Vector3 p2 = ctrl2[segmentIndex];
        Vector3 p3 = sortedPoints[segmentIndex + 1].positionOffset;

        return CalculateBezier(p0, p1, p2, p3, localT);
    }

    private Quaternion CalculateCameraRotation(float t)
    {
        // 线性插值关键帧旋转
        Quaternion startRot = Quaternion.Euler(shotClip.startKeyframe.rotation);
        Quaternion endRot = Quaternion.Euler(shotClip.endKeyframe.rotation);

        return Quaternion.Slerp(startRot, endRot, t);
    }

    private Vector3 CalculateBezier(Vector3 p0, Vector3 p1,
                                   Vector3 p2, Vector3 p3, float t)
    {
        float u = 1 - t;
        return u * u * u * p0 + 3 * u * u * t * p1 +
               3 * u * t * t * p2 + t * t * t * p3;
    }
}
```

---

## 七、开发计划与里程碑

### 7.1 阶段划分

#### Phase 1: 数据结构与基础框架 (1周)
- [ ] 实现`CinematicSequenceAsset`、`CinematicShotClip`、`CameraKeyframe`
- [ ] 实现`StylePresetSO`
- [ ] 创建基础编辑器窗口`CinematicSequenceEditorWindow`
- [ ] 集成`BaseAssetEditorWindow`框架

**验收标准**:
- 可以创建和保存CinematicSequenceAsset资产
- 编辑器窗口可以打开并显示基本UI

#### Phase 2: 时间轴系统 (1周)
- [ ] 实现`TimelinePanel`双轨道绘制
- [ ] 实现镜头片段的添加、删除、拖动
- [ ] 实现播放控制(播放/暂停/拖动)
- [ ] 实现目标物体轨道显示

**验收标准**:
- 可以在时间轴上创建和编辑镜头片段
- 播放头可以正确显示当前时间

#### Phase 3: Scene视图编辑 (1周)
- [ ] 实现`CinematicSequenceSceneExtension`
- [ ] 实现关键帧位置控制柄
- [ ] 实现贝塞尔切线控制柄
- [ ] 实现FOV视锥体可视化
- [ ] 实现Toric Space辅助线

**验收标准**:
- 可以在Scene视图中拖拽编辑关键帧
- 贝塞尔切线可以实时调整并更新预览

#### Phase 4: AI生成系统 (2周)
- [ ] 实现`CameraStylePredictionModel` (Barracuda集成)
- [ ] 实现`TTAEncoder`
- [ ] 实现`CinematicPathGenerator`
- [ ] 测试并调优推理性能
- [ ] 实现降级策略(手动模式)

**验收标准**:
- AI模型可以成功加载和推理
- 生成的轨迹符合风格预期
- 性能满足实时编辑要求(<500ms)

#### Phase 5: Runtime播放与Timeline集成 (1周)
- [ ] 实现`CinematicCameraTrack` (Timeline轨道)
- [ ] 实现`CinematicShotBehaviour`
- [ ] 实现速度曲线应用
- [ ] 测试Timeline播放流畅度

**验收标准**:
- 可以在Timeline中播放Cinematic序列
- 速度曲线正确影响播放节奏

#### Phase 6: 优化与完善 (1周)
- [ ] 性能优化(批处理、缓存)
- [ ] Undo/Redo完善
- [ ] 快捷键支持
- [ ] 文档和示例场景

**总计**: 7周

### 7.2 技术风险与缓解策略

| 风险项 | 影响 | 概率 | 缓解策略 |
|--------|------|------|---------|
| Barracuda推理性能不足 | 高 | 中 | 提供纯手动模式降级方案 |
| ONNX模型格式不兼容 | 中 | 低 | 预先验证模型兼容性 |
| Scene编辑体验不流畅 | 中 | 中 | 优化绘制频率,使用缓存 |
| Timeline集成复杂度高 | 中 | 中 | 参考Unity官方Timeline示例 |

---

## 八、测试计划

### 8.1 单元测试

- [ ] `CameraKeyframe` 数据序列化/反序列化
- [ ] `CameraTrack` 贝塞尔插值计算
- [ ] `TTAEncoder` 编码正确性
- [ ] `CinematicPathGenerator` 边界情况处理

### 8.2 集成测试

- [ ] 编辑器窗口 + Scene视图联动
- [ ] Timeline播放 + 速度曲线应用
- [ ] AI生成 + 手动微调流程

### 8.3 性能测试

- [ ] AI推理延迟 (目标: <500ms)
- [ ] Scene绘制帧率 (目标: >30fps)
- [ ] 大序列加载时间 (目标: <2s for 100 clips)

---

## 九、参考资料

### 9.1 现有代码参考

- `CameraController.cs`: 相机系统核心
- `CameraTrack.cs`: 轨道数据结构
- `CameraTrackManagerEditor.cs`: Scene编辑器实现
- `CharacterMotionPresetEditorWindow.cs`: 编辑器窗口框架

### 9.2 Unity官方文档

- [Unity Barracuda Manual](https://docs.unity3d.com/Packages/com.unity.barracuda@latest)
- [Timeline Scripting API](https://docs.unity3d.com/Packages/com.unity.timeline@latest/manual/index.html)
- [Custom Editor Windows](https://docs.unity3d.com/Manual/editor-CustomEditors.html)

### 9.3 学术参考

- **Time-to-Arrival Encoding**: "Fourier Features Let Networks Learn High Frequency Functions"
- **Toric Space Camera Control**: 相关游戏摄影学论文 [1]

---

## 十、附录

### 10.1 命名规范速查

| 类型 | 格式 | 示例 |
|------|------|------|
| ScriptableObject资产 | PascalCase + Asset | `CinematicSequenceAsset` |
| 编辑器窗口 | PascalCase + EditorWindow | `CinematicSequenceEditorWindow` |
| Timeline组件 | PascalCase + Track/Behaviour | `CinematicCameraTrack` |
| 私有字段 | m_ + camelCase | `m_selectedClip` |
| 常量 | UPPER_SNAKE_CASE | `TRACK_HEIGHT` |

### 10.2 关键路径

```
# 资产路径
Assets/GameProject/Scripts/Runtime/GameView/Cinematic/
    ├── Data/
    │   ├── CinematicSequenceAsset.cs
    │   ├── CinematicShotClip.cs
    │   └── StylePresetSO.cs
    └── AI/
        ├── CameraStylePredictionModel.cs
        └── CinematicPathGenerator.cs

Assets/GameProject/Scripts/Editor/CinematicEditor/
    ├── CinematicSequenceEditorWindow.cs
    ├── TimelinePanel.cs
    └── CinematicSequenceSceneExtension.cs

Assets/StreamingAssets/CinematicModels/
    └── camera_style_prediction.onnx
```

---

**文档结束**

*本设计方案在现有CameraController架构基础上进行扩展,确保不破坏现有功能的同时,提供完整的电影级相机编辑能力。所有设计遵循BJFramework规范和Unity最佳实践。*
