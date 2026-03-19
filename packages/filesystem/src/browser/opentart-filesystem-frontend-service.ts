import { injectable } from '@theia/core/shared/inversify'
import { MediaMetadata, OpenTartFilesystem } from '../common/opentart-filesystem-protocol'

@injectable()
export class OpenTartFilesystemFrontendService implements OpenTartFilesystem {
  async getMediaMetadata(uri: string): Promise<MediaMetadata | undefined> {
    // Phase 1: stub implementation, return fake metadata.
    return {
      uri,
      kind: 'video',
      durationSeconds: 10,
      width: 1920,
      height: 1080,
      codec: 'H.264'
    }
  }
}

