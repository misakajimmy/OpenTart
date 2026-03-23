import { ContainerModule } from '@theia/core/shared/inversify'
import { WebSocketConnectionProvider } from '@theia/core/lib/browser/messaging/ws-connection-provider'
import { OpenTartFilesystem, OpenTartFilesystemPath } from '../common/opentart-filesystem-protocol'
import { OpenTartFilesystemFrontendService } from './opentart-filesystem-frontend-service'

const OpenTartFilesystemProxy = Symbol('OpenTartFilesystemProxy')

export default new ContainerModule(bind => {
  bind(OpenTartFilesystemProxy).toDynamicValue(ctx => {
    const provider = ctx.container.get(WebSocketConnectionProvider)
    return provider.createProxy<OpenTartFilesystem>(OpenTartFilesystemPath)
  }).inSingletonScope()

  bind(OpenTartFilesystemFrontendService).toDynamicValue(ctx =>
    new OpenTartFilesystemFrontendService(ctx.container.get(OpenTartFilesystemProxy))
  ).inSingletonScope()

  bind(OpenTartFilesystem).toService(OpenTartFilesystemFrontendService)
})

