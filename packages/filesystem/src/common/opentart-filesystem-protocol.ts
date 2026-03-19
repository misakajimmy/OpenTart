export interface MediaMetadata {
  readonly uri: string
  readonly kind: 'video' | 'audio' | 'image' | 'other'
  readonly durationSeconds?: number
  readonly width?: number
  readonly height?: number
  readonly codec?: string
}

export const OpenTartFilesystem = Symbol('OpenTartFilesystem')

export interface OpenTartFilesystem {
  /**
   * Get media-related metadata for a given resource.
   * First phase: this is a stub that can return fake data.
   */
  getMediaMetadata(uri: string): Promise<MediaMetadata | undefined>
}

