export interface MediaMetadata {
  readonly uri: string
  readonly kind: 'video' | 'audio' | 'image' | 'other'
  readonly durationSeconds?: number
  readonly width?: number
  readonly height?: number
  readonly codec?: string
}

export interface MediaPreview {
  readonly uri: string
  readonly imagePath: string
  readonly imageDataUri?: string
}

export interface FilesystemEntry {
  readonly name: string
  readonly path: string
  readonly isDirectory: boolean
}

export interface WindowsDrive {
  readonly name: string
  readonly path: string
}

export const OpenTartFilesystemPath = '/services/opentart-filesystem'
export const OpenTartFilesystem = Symbol('OpenTartFilesystem')

export interface OpenTartFilesystem {
  /**
   * Get media-related metadata for a given resource.
   */
  getMediaMetadata(uri: string): Promise<MediaMetadata | undefined>

  /**
   * Generate one preview image for a media resource.
   */
  getPreviewImage(uri: string): Promise<MediaPreview | undefined>

  /**
   * List available Windows drive roots.
   */
  listWindowsDrives(): Promise<WindowsDrive[]>

  /**
   * List directory entries under the given path.
   */
  listDirectory(dirPath: string): Promise<FilesystemEntry[]>
}

