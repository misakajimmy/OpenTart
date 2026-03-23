import { injectable } from '@theia/core/shared/inversify'
import { MediaMetadata, MediaPreview, OpenTartFilesystem } from '../common/opentart-filesystem-protocol'

@injectable()
export class OpenTartFilesystemFrontendService implements OpenTartFilesystem {
  constructor(protected readonly delegate: OpenTartFilesystem) {}

  getMediaMetadata(uri: string): Promise<MediaMetadata | undefined> {
    return this.delegate.getMediaMetadata(uri)
  }

  getPreviewImage(uri: string): Promise<MediaPreview | undefined> {
    return this.delegate.getPreviewImage(uri)
  }
}

