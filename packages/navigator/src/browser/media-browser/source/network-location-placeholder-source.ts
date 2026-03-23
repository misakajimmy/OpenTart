import { injectable } from '@theia/core/shared/inversify'
import { MediaEntry } from '../model'
import { MediaSource } from './media-source'

@injectable()
export class NetworkLocationPlaceholderSource implements MediaSource {
    readonly type = 'networkPlaceholder' as const
    readonly label = 'Network Locations'

    async listRoots(): Promise<MediaEntry[]> {
        return [{
            id: 'network-placeholder',
            name: 'Network Locations (Coming Soon)',
            path: 'network://',
            type: 'placeholder'
        }]
    }

    async listDirectory(_dirPath: string): Promise<MediaEntry[]> {
        return []
    }
}

