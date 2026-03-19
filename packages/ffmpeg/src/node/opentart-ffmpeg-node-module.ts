import { ContainerModule } from '@theia/core/shared/inversify'
import { OpenTartFfmpeg } from '../common/opentart-ffmpeg-protocol'
import { OpenTartFfmpegNodeService } from './opentart-ffmpeg-node-service'

export default new ContainerModule(bind => {
  bind(OpenTartFfmpegNodeService).toSelf().inSingletonScope()
  bind(OpenTartFfmpeg).toService(OpenTartFfmpegNodeService)
})

