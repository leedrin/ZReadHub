
1.实现新的更新管线类型，重写CooperativeUITaskUpdate方法，启动其他Task的更新管线，增加等待重定向管线计数，重定向管线计数等于启动的需要协同的管线数量

示例代码
/// <summary>
/// 协同其他UITask更新
/// 例如，启动其他需要被劫持的UITask更新管线
/// </summary>
protected override void CooperativeUITaskUpdate()
{
    // 协议其他task启动管线做一些事情
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
2.实现新的管线创建工厂，根据目的创建相应的更新管线实例

示例代码
/// <summary>
/// UITask的更新管线工厂组件
/// </summary>
internal class CharacterMainInfoUITaskCompUpdatePipelineFactory : UITaskCompUpdatePipelineFactory
{
    ...
    #region Overrides of UITaskCompUpdatePipelineFactory
 
    /// <summary>
    /// 创建更新管线实例
    /// </summary>
    /// <param name="initInfo"></param>
    /// <param name="launchPurpose"></param>
    /// <returns></returns>
    protected override UITaskUpdatePipelineBase UpdatePipelineCreate(UITaskUpdatePipelineInitInfo initInfo, string launchPurpose)
    {
        switch (launchPurpose)
        {
            case Cooperative3DAndListShow:
                return new CharacterMainInfoUITaskUpdatePipeline(initInfo, m_owner);
            case OnlyUpdateSelf:
                return new UITaskUpdatePipelineDefault(initInfo, m_owner);
            default:
                throw new NotImplementedException();
        }
    }
 
    #endregion
    ...
}
3.重写UITask更新管线工厂创建方法

示例代码
/// <summary>
/// 创建更新管线工厂组件
/// </summary>
/// <returns></returns>
protected override UITaskCompUpdatePipelineFactory CompUpdatePipelineFactoryCreate()
{
    return new CharacterMainInfoUITaskCompUpdatePipelineFactory(this);
}