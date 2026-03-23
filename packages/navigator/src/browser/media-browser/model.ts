export type MediaSourceType = 'localDrive' | 'networkPlaceholder'

export type MediaEntryType = 'drive' | 'directory' | 'file' | 'placeholder'

export type MediaViewMode = 'list' | 'grid'

export interface MediaEntry {
    readonly id: string
    readonly name: string
    readonly path: string
    readonly type: MediaEntryType
}

