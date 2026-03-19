export interface FfprobeStreamInfo {
  index: number
  codecType: 'video' | 'audio' | 'subtitle' | 'data' | 'attachment' | 'unknown'
  codecName?: string
  width?: number
  height?: number
  fps?: number
}

export interface FfprobeFormatInfo {
  formatName?: string
  durationSeconds?: number
  bitrate?: number
}

export interface FfprobeMetadata {
  uri: string
  format: FfprobeFormatInfo
  streams: FfprobeStreamInfo[]
}

export interface FfmpegVersionInfo {
  raw: string
  major: number
  minor: number
  patch: number
}

export interface OpenTartFfmpeg {
  /**
   * Return parsed `ffmpeg -version` information.
   */
  getVersion(): Promise<FfmpegVersionInfo>

  /**
   * Probe a given media resource and return normalized metadata
   * (version-independent view over ffprobe output).
   */
  probe(uri: string): Promise<FfprobeMetadata>
}

export const OpenTartFfmpeg = Symbol('OpenTartFfmpeg')

