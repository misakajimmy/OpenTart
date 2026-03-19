import { ContainerModule } from '@theia/core/shared/inversify'
import { FrontendApplicationContribution } from '@theia/core/lib/browser'

export class OpenTartCoreContribution implements FrontendApplicationContribution {
    // 这里先留空，后续可以在 initialize / onStart 等生命周期里挂载全局逻辑
}

export default new ContainerModule(bind => {
    bind(OpenTartCoreContribution).toSelf().inSingletonScope()
    bind(FrontendApplicationContribution).toService(OpenTartCoreContribution)
})

