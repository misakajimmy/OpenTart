import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { injectable } from '@theia/core/shared/inversify'
import {
  FfmpegVersionInfo,
  FfprobeMetadata,
  OpenTartFfmpeg,
  ScreenshotOptions,
  ScreenshotResult
} from '../common/opentart-ffmpeg-protocol'

export interface FfmpegResolvedPaths {
  ffmpeg: string
  ffprobe: string
}

function parseVersion(output: string): FfmpegVersionInfo {
  const match = output.match(/ffmpeg version\s+(\d+)\.(\d+)\.(\d+)/)
  if (!match) {
    return { raw: output, major: 0, minor: 0, patch: 0 }
  }
  const [, major, minor, patch] = match
  return {
    raw: output,
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch)
  }
}

async function resolvePaths(): Promise<FfmpegResolvedPaths> {
  // Phase 1: 环境变量优先，其次依赖系统 PATH
  const ffmpeg = process.env.OPENTART_FFMPEG_PATH || 'ffmpeg'
  const ffprobe = process.env.OPENTART_FFPROBE_PATH || 'ffprobe'
  return { ffmpeg, ffprobe }
}

@injectable()
export class OpenTartFfmpegNodeService implements OpenTartFfmpeg {

  protected cachedVersion: FfmpegVersionInfo | undefined
  protected resolvedPaths: FfmpegResolvedPaths | undefined

  async getVersion(): Promise<FfmpegVersionInfo> {
    if (!this.cachedVersion) {
      const paths = await this.getPaths()
      const output = await this.execOnce(paths.ffmpeg, ['-version'])
      const version = parseVersion(output)
      if (version.major < 6) {
        throw new Error(
          `Detected FFmpeg version "${version.raw}". OpenTart requires FFmpeg >= 6.`
        )
      }
      this.cachedVersion = version
    }
    return this.cachedVersion
  }

  async probe(uri: string): Promise<FfprobeMetadata> {
    // Phase 1: 调用 ffprobe 并返回最小化数据结构
    const paths = await this.getPaths()
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      uri
    ]
    const output = await this.execOnce(paths.ffprobe, args)
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
        codecType: (s.codec_type || 'unknown') as any,
        codecName: s.codec_name,
        width: s.width,
        height: s.height,
        fps: s.avg_frame_rate && s.avg_frame_rate.includes('/')
          ? (() => {
              const [num, den] = s.avg_frame_rate.split('/').map((v: string) => Number(v))
              return den ? num / den : undefined
            })()
          : undefined
      }))
    }
  }

  async screenshot(options: ScreenshotOptions): Promise<ScreenshotResult> {
    const paths = await this.getPaths()
    const outputDir = path.dirname(options.outputPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
    const seek = options.seekSeconds ?? 0
    const args = [
      '-y',
      '-ss', String(seek),
      '-i', options.inputUri,
      '-frames:v', '1',
      '-q:v', '2',
      options.outputPath
    ]
    await this.execOnce(paths.ffmpeg, args)
    return { outputPath: options.outputPath }
  }

  protected async getPaths(): Promise<FfmpegResolvedPaths> {
    if (!this.resolvedPaths) {
      this.resolvedPaths = await resolvePaths()
    }
    return this.resolvedPaths
  }

  protected execOnce(cmd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
      let stdout = ''
      let stderr = ''
      proc.stdout.on('data', chunk => (stdout += chunk.toString()))
      proc.stderr.on('data', chunk => (stderr += chunk.toString()))
      proc.on('error', reject)
      proc.on('close', () => {
        const output = stdout || stderr
        if (!output) {
          reject(new Error(`${cmd} produced no output`))
        } else {
          resolve(output)
        }
      })
    })
  }
}

