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
import {
  FfmpegFallbackStrategy,
  FfmpegResolvedPaths,
  FfmpegStrategy,
  Ffmpeg6Strategy,
  Ffmpeg7Strategy
} from './ffmpeg-strategy'

export interface FfmpegBinaryConfig {
  ffmpegPath?: string
  ffprobePath?: string
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

async function resolvePaths(config?: FfmpegBinaryConfig): Promise<FfmpegResolvedPaths> {
  // 优先级：显式配置 > 环境变量 > 系统 PATH 命令名
  const ffmpeg = config?.ffmpegPath || process.env.OPENTART_FFMPEG_PATH || 'ffmpeg'
  const ffprobe = config?.ffprobePath || process.env.OPENTART_FFPROBE_PATH || 'ffprobe'
  return { ffmpeg, ffprobe }
}

@injectable()
export class OpenTartFfmpegNodeService implements OpenTartFfmpeg {

  protected cachedVersion: FfmpegVersionInfo | undefined
  protected resolvedPaths: FfmpegResolvedPaths | undefined
  protected strategy: FfmpegStrategy | undefined
  protected readonly binaryConfig: FfmpegBinaryConfig

  constructor(binaryConfig: FfmpegBinaryConfig = {}) {
    this.binaryConfig = binaryConfig
  }

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
    const version = await this.getVersion()
    const paths = await this.getPaths()
    const strategy = this.getStrategy(version)
    return strategy.probe(uri, paths, this.runReadOnly.bind(this))
  }

  protected getStrategy(version: FfmpegVersionInfo): FfmpegStrategy {
    if (!this.strategy) {
      const candidates: FfmpegStrategy[] = [
        new Ffmpeg7Strategy(),
        new Ffmpeg6Strategy(),
        new FfmpegFallbackStrategy()
      ]
      const selected = candidates.find(item => item.supports(version))
      if (!selected) {
        throw new Error(`No ffmpeg strategy matched version: ${version.raw}`)
      }
      this.strategy = selected
    }
    return this.strategy
  }

  async screenshot(options: ScreenshotOptions): Promise<ScreenshotResult> {
    const version = await this.getVersion()
    const paths = await this.getPaths()
    const strategy = this.getStrategy(version)
    const outputDir = path.dirname(options.outputPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
    const args = strategy.buildScreenshotArgs(options)
    await this.runWrite(paths.ffmpeg, args)
    return { outputPath: options.outputPath }
  }

  protected async getPaths(): Promise<FfmpegResolvedPaths> {
    if (!this.resolvedPaths) {
      this.resolvedPaths = await resolvePaths(this.binaryConfig)
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

  /**
   * Read-only command execution path.
   * Used for ffprobe-style operations that do not create/modify files.
   */
  protected runReadOnly(cmd: string, args: string[]): Promise<string> {
    return this.execOnce(cmd, args)
  }

  /**
   * Write operation command path.
   * We keep all file-generating/modifying ffmpeg operations through this method.
   */
  protected runWrite(cmd: string, args: string[]): Promise<string> {
    return this.execOnce(cmd, args)
  }
}

