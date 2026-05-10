# 鱼市任务系统 - 思维导图

```mermaid
mindmap
  root((鱼市任务系统\nFishMarketUITask))
    数据结构
      鱼市任务池表
      配置ID、鱼种ID
      重量条件、目标值
      奖励、刷新时间
      刷新组8个
    任务状态
      任务进行中
        达成条件
        完成待领取
      完成待领取
        点击领取
        已领取完成
      待解锁
        Alpha1不做
    UI布局
      顶部区域
        标题栏
        货币显示
      左侧-鱼护
        鱼列表
        排序按钮
        全选多选
        出售按钮
      右侧-任务
        8个任务栏位
        任务图标
        进度显示
        倒计时
        状态标识
    核心功能
      8个任务栏位
      任务状态切换
      倒计时系统
      进度追踪
      奖励领取
      任务显示流程
        服务器数据获取
          监听刷新事件
          获取任务列表
        数据转换
          配置ID查配置表
          获取任务描述
          获取鱼名称和图标
        UI显示更新
          管线刷新
          UIController显示
      任务条件
        巨物判定
        重量条件
        二选一逻辑
      特殊规则
        同鱼可多任务
        新鲜度0%无效
        跨关卡不计
    倒计时系统
      显示规则
        天小时小时分
        最后30分钟变红
      刷新机制
        倒计时归0刷新
        不重复当前8个
        未领取邮件补发
        整点刷新时间
        服务器事件通知
      技术实现
        监听EventOnFishMarketQuestRefreshNtf
        事件触发管线刷新
        获取m_endTime计算倒计时
        使用GetCurrentGameTime获取服务器时间
        UIController.Update中更新显示
    排序规则
      获得时间默认
      稀有度
      重量
      价格
      任务排序
        任务鱼最前
        其余按时间
        点击场景1
          未多选进入多选
          自动选中任务鱼
          自动切换排序
        点击场景2
          已多选有选中鱼
          取消非任务鱼
          选中对应任务鱼
        点击场景3
          已多选无命中
          不做任何操作
    任务鱼标记
      限时热收图标
      左上角显示
      新鲜度0%置灰
      点击提示弹窗
      完成后隐藏
    售卖流程
      多选售卖
        选择鱼
        点击出售
        二次确认
        动画表现
        重置到顶部
      快捷键
        ESC返回
        Space确认
    重量规则
      显示大于
      逻辑大于等于
      图标选择
        有重量最小体型
        无重量成年体
    开发任务
      P0核心功能
        任务数据接入
        8任务栏位
        状态切换
        倒计时
        奖励领取
      P1体验优化
        悬浮态排序
        完成动效
        刷新动效
        任务鱼标记
      P2边界处理
        跨关卡检测
        新鲜度处理
        邮件补发
    架构设计
      UI Layer
      UITask层
        FishMarketUITask
      Tofu层
        MainTofu协调
        QuestTofu任务
        KeeperTofu鱼护
      Logic层
        FishMarketQuestClient
    开发注意事项
      暂时不做-待解锁
      Alpha1不做-目标显示
      任务点击三种场景
      自动接取任务
      整点刷新时间
      任务显示流程
        服务器事件驱动
        配置表查询
        UI层显示更新
      阶段1已完成功能
        鱼护数据管理
        任务列表获取接口
        任务进度检查
      邮件补发奖励
      跨关卡检测
      新鲜度0%处理
```

---

## 快速导航

### 核心开发文档
- [[FishMarketPhase2_开发设计方案]] - 完整技术设计方案
- [[FishmarketUITask_PRD_标注版]] - 标注版PRD文档

### 关键实现模块
1. [[FishMarketPhase2_开发设计方案#6. 鱼市任务显示流程|任务显示流程]]
2. [[FishMarketPhase2_开发设计方案#6.3 配置表查询与信息获取|配置表查询与信息获取]]
3. [[FishMarketPhase2_开发设计方案#4.1 任务状态流转|任务状态机实现]]
4. [[FishMarketPhase2_开发设计方案#5. 倒计时系统设计|倒计时系统]]
5. [[FishMarketPhase2_开发设计方案#4.2 奖励领取流程|奖励领取流程]]
6. [[FishMarketPhase2_开发设计方案#4.5 任务刷新流程|任务刷新机制]]
7. [[FishMarketPhase2_开发设计方案#4.4 任务鱼排序|任务鱼排序]]
8. [[FishMarketPhase2_开发设计方案#6.5 阶段1已完成功能回顾|阶段1已完成功能]]

### 相关代码文件
- `FishMarketUITaskCompQuestTofu.cs` - 任务Tofu组件
- `FishMarketUITaskCompKeeperTofu.cs` - 鱼护Tofu组件
- `FishMarketUITaskCompMainTofu.cs` - 主Tofu组件
- `PlayerGameObjectCompFishMarketQuestClient.cs` - 逻辑层接口

---

*此思维导图对应文件: [[FishmarketUITask_PRD_思维导图.canvas]]*
