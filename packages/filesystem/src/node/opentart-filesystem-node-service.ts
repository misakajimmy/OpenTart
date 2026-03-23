import * as os from 'os'
import * as path from 'path'
import { injectable, inject } from '@theia/core/shared/inversify'
import { OpenTartFfmpeg } from '@opentart/ffmpeg/lib/common/opentart-ffmpeg-protocol'
import {
  MediaMetadata,
  MediaPreview,
  OpenTartFilesystem
} from '../common/opentart-filesystem-protocol'

@injectable()
export class OpenTartFilesystemNodeService implements OpenTartFilesystem {
  @inject(OpenTartFfmpeg)
  protected readonly ffmpeg!: OpenTartFfmpeg

  async getMediaMetadata(uri: string): Promise<MediaMetadata | undefined> {
    const metadata = await this.ffmpeg.probe(uri)
    const primaryVideo = metadata.streams.find(s => s.codecType === 'video')
    const primaryAudio = metadata.streams.find(s => s.codecType === 'audio')
    const kind = primaryVideo ? 'video' : primaryAudio ? 'audio' : 'other'

    return {
      uri,
      kind,
      durationSeconds: metadata.format.durationSeconds,
      width: primaryVideo?.width,
      height: primaryVideo?.height,
      codec: primaryVideo?.codecName || primaryAudio?.codecName
    }
  }

  async getPreviewImage(uri: string): Promise<MediaPreview | undefined> {
    const outputPath = path.join(os.tmpdir(), 'opentart-previews', `preview-${Date.now()}.jpg`)
    const result = await this.ffmpeg.screenshot({
      inputUri: uri,
      outputPath,
      seekSeconds: 1
    })
    return {
      uri,
      imagePath: result.outputPath
    }
  }
}

