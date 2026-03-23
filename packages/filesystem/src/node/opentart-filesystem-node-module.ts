import { ContainerModule } from '@theia/core/shared/inversify'
import { ConnectionHandler } from '@theia/core/lib/common/messaging'
import { JsonRpcConnectionHandler } from '@theia/core/lib/common/messaging/proxy-factory'
import { OpenTartFilesystem, OpenTartFilesystemPath } from '../common/opentart-filesystem-protocol'
import { OpenTartFilesystemNodeService } from './opentart-filesystem-node-service'

export default new ContainerModule(bind => {
  bind(OpenTartFilesystemNodeService).toSelf().inSingletonScope()
  bind(OpenTartFilesystem).toService(OpenTartFilesystemNodeService)
  bind(ConnectionHandler).toDynamicValue(ctx =>
    new JsonRpcConnectionHandler<OpenTartFilesystem>(
      OpenTartFilesystemPath,
      () => ctx.container.get(OpenTartFilesystemNodeService)
    )
  ).inSingletonScope()
})

