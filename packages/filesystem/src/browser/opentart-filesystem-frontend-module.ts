import { ContainerModule } from '@theia/core/shared/inversify'
import { OpenTartFilesystem } from '../common/opentart-filesystem-protocol'
import { OpenTartFilesystemFrontendService } from './opentart-filesystem-frontend-service'

export default new ContainerModule(bind => {
  bind(OpenTartFilesystemFrontendService).toSelf().inSingletonScope()
  bind(OpenTartFilesystem).toService(OpenTartFilesystemFrontendService)
})

