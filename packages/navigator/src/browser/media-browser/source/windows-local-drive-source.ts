import { inject, injectable } from '@theia/core/shared/inversify'
import { OpenTartFilesystem } from '@opentart/filesystem/lib/common/opentart-filesystem-protocol'
import { MediaEntry } from '../model'
import { MediaSource } from './media-source'

@injectable()
export class WindowsLocalDriveSource implements MediaSource {
    readonly type = 'localDrive' as const
    readonly label = 'This PC'

    @inject(OpenTartFilesystem)
    protected readonly filesystem!: OpenTartFilesystem

    async listRoots(): Promise<MediaEntry[]> {
        const drives = await this.filesystem.listWindowsDrives()
        return drives.map(d => ({
            id: `drive-${d.path}`,
            name: d.name,
            path: d.path,
            type: 'drive' as const
        }))
    }

    async listDirectory(dirPath: string): Promise<MediaEntry[]> {
        const entries = await this.filesystem.listDirectory(dirPath)
        return entries.map(item => ({
            id: `${item.isDirectory ? 'dir' : 'file'}-${item.path}`,
            name: item.name,
            path: item.path,
            type: item.isDirectory ? 'directory' : 'file'
        }))
    }
}

