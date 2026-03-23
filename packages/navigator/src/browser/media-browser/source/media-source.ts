import { MediaEntry, MediaSourceType } from '../model'

export interface MediaSource {
    readonly type: MediaSourceType
    readonly label: string
    listRoots(): Promise<MediaEntry[]>
    listDirectory(dirPath: string): Promise<MediaEntry[]>
}

