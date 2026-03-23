import { FfmpegVersionInfo, FfprobeMetadata, ScreenshotOptions } from '../common/opentart-ffmpeg-protocol'

export interface FfmpegResolvedPaths {
  ffmpeg: string
  ffprobe: string
}

export interface FfmpegStrategy {
  supports(version: FfmpegVersionInfo): boolean
  probe(uri: string, paths: FfmpegResolvedPaths, execOnce: (cmd: string, args: string[]) => Promise<string>): Promise<FfprobeMetadata>
  buildScreenshotArgs(options: ScreenshotOptions): string[]
}

function normalizeCodecType(value: unknown): 'video' | 'audio' | 'subtitle' | 'data' | 'attachment' | 'unknown' {
  const raw = String(value || '').toLowerCase()
  if (raw === 'video' || raw === 'audio' || raw === 'subtitle' || raw === 'data' || raw === 'attachment') {
    return raw
  }
  return 'unknown'
}

function parseFps(rateText: string | undefined): number | undefined {
  if (!rateText || !rateText.includes('/')) {
    return undefined
  }
  const [num, den] = rateText.split('/').map(v => Number(v))
  return den ? num / den : undefined
}

interface ProbeParserOptions {
  fpsFieldOrder: string[]
}

async function probeWithFfprobe(
  uri: string,
  paths: FfmpegResolvedPaths,
  execOnce: (cmd: string, args: string[]) => Promise<string>,
  options: ProbeParserOptions
): Promise<FfprobeMetadata> {
  const output = await execOnce(paths.ffprobe, [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    uri
  ])

  let json: any
  try {
    json = JSON.parse(output)
  } catch (e) {
    throw new Error(`Failed to parse ffprobe output for "${uri}": ${(e as Error).message}`)
  }

  const format = json.format || {}
  const streams = Array.isArray(json.streams) ? json.streams : []

  return {
    uri,
    format: {
      formatName: format.format_name,
      durationSeconds: format.duration ? Number(format.duration) : undefined,
      bitrate: format.bit_rate ? Number(format.bit_rate) : undefined
    },
    streams: streams.map((s: any) => ({
      index: typeof s.index === 'number' ? s.index : 0,
      codecType: normalizeCodecType(s.codec_type),
      codecName: s.codec_name,
      width: s.width,
      height: s.height,
      fps: (() => {
        for (const field of options.fpsFieldOrder) {
          const parsed = parseFps(s[field])
          if (parsed !== undefined) {
            return parsed
          }
        }
        return undefined
      })()
    }))
  }
}

export class Ffmpeg6Strategy implements FfmpegStrategy {
  supports(version: FfmpegVersionInfo): boolean {
    return version.major === 6
  }

  probe(uri: string, paths: FfmpegResolvedPaths, execOnce: (cmd: string, args: string[]) => Promise<string>): Promise<FfprobeMetadata> {
    // FFmpeg 6 on some builds has more reliable r_frame_rate.
    return probeWithFfprobe(uri, paths, execOnce, { fpsFieldOrder: ['r_frame_rate', 'avg_frame_rate'] })
  }

  buildScreenshotArgs(options: ScreenshotOptions): string[] {
    const seek = options.seekSeconds ?? 0
    return [
      '-y',
      '-ss', String(seek),
      '-i', options.inputUri,
      '-frames:v', '1',
      '-q:v', '2',
      options.outputPath
    ]
  }
}

export class Ffmpeg7Strategy implements FfmpegStrategy {
  supports(version: FfmpegVersionInfo): boolean {
    return version.major >= 7
  }

  probe(uri: string, paths: FfmpegResolvedPaths, execOnce: (cmd: string, args: string[]) => Promise<string>): Promise<FfprobeMetadata> {
    // FFmpeg 7 tends to report avg_frame_rate consistently for CFR/VFR probes.
    return probeWithFfprobe(uri, paths, execOnce, { fpsFieldOrder: ['avg_frame_rate', 'r_frame_rate'] })
  }

  buildScreenshotArgs(options: ScreenshotOptions): string[] {
    const seek = options.seekSeconds ?? 0
    return [
      '-y',
      '-ss', String(seek),
      '-i', options.inputUri,
      '-frames:v', '1',
      '-q:v', '2',
      options.outputPath
    ]
  }
}

export class FfmpegFallbackStrategy implements FfmpegStrategy {
  supports(_version: FfmpegVersionInfo): boolean {
    return true
  }

  async probe(uri: string, paths: FfmpegResolvedPaths, execOnce: (cmd: string, args: string[]) => Promise<string>): Promise<FfprobeMetadata> {
    // Fallback still attempts to probe, useful for dev/nightly builds.
    return probeWithFfprobe(uri, paths, execOnce, { fpsFieldOrder: ['avg_frame_rate', 'r_frame_rate'] })
  }

  buildScreenshotArgs(options: ScreenshotOptions): string[] {
    const seek = options.seekSeconds ?? 0
    return [
      '-y',
      '-ss', String(seek),
      '-i', options.inputUri,
      '-frames:v', '1',
      '-q:v', '2',
      options.outputPath
    ]
  }
}

