import { injectable } from '@theia/core/shared/inversify'
import {
  FilesystemEntry,
  MediaMetadata,
  MediaPreview,
  OpenTartFilesystem,
  WindowsDrive
} from '../common/opentart-filesystem-protocol'

@injectable()
export class OpenTartFilesystemFrontendService implements OpenTartFilesystem {
  constructor(protected readonly delegate: OpenTartFilesystem) {}

  getMediaMetadata(uri: string): Promise<MediaMetadata | undefined> {
    return this.delegate.getMediaMetadata(uri)
  }

  getPreviewImage(uri: string): Promise<MediaPreview | undefined> {
    return this.delegate.getPreviewImage(uri)
  }

  listWindowsDrives(): Promise<WindowsDrive[]> {
    return this.delegate.listWindowsDrives()
  }

  listDirectory(dirPath: string): Promise<FilesystemEntry[]> {
    return this.delegate.listDirectory(dirPath)
  }
}

