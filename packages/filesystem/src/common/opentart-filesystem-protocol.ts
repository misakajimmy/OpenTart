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
}

