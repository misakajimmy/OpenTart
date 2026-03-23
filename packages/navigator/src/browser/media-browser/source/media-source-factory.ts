import { inject, injectable } from '@theia/core/shared/inversify'
import { MediaSourceType } from '../model'
import { MediaSource } from './media-source'
import { NetworkLocationPlaceholderSource } from './network-location-placeholder-source'
import { WindowsLocalDriveSource } from './windows-local-drive-source'

@injectable()
export class MediaSourceFactory {
    @inject(WindowsLocalDriveSource)
    protected readonly windowsLocalDriveSource!: WindowsLocalDriveSource

    @inject(NetworkLocationPlaceholderSource)
    protected readonly networkLocationPlaceholderSource!: NetworkLocationPlaceholderSource

    create(type: MediaSourceType): MediaSource {
        switch (type) {
            case 'localDrive':
                return this.windowsLocalDriveSource
            case 'networkPlaceholder':
                return this.networkLocationPlaceholderSource
            default:
                throw new Error(`Unknown media source type: ${String(type)}`)
        }
    }
}

