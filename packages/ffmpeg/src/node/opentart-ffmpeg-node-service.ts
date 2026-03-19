import { spawn } from 'child_process'
import { injectable } from '@theia/core/shared/inversify'
import {
  FfmpegVersionInfo,
  FfprobeMetadata,
  OpenTartFfmpeg
} from '../common/opentart-ffmpeg-protocol'

function parseVersion(output: string): FfmpegVersionInfo {
  // Very small heuristic: look for "ffmpeg version X.Y.Z"
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

@injectable()
export class OpenTartFfmpegNodeService implements OpenTartFfmpeg {

  protected cachedVersion: FfmpegVersionInfo | undefined

  async getVersion(): Promise<FfmpegVersionInfo> {
    if (this.cachedVersion) {
      return this.cachedVersion
    }
    const output = await this.execOnce(['-version'])
    this.cachedVersion = parseVersion(output)
    return this.cachedVersion
  }

  async probe(uri: string): Promise<FfprobeMetadata> {
    // Phase 1: stub implementation
    // 后续这里会调用 ffprobe 并解析真实 JSON。
    return {
      uri,
      format: {
        formatName: 'stub',
        durationSeconds: 10,
        bitrate: 800_000
      },
      streams: []
    }
  }

  protected execOnce(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] })
      let stdout = ''
      let stderr = ''
      proc.stdout.on('data', chunk => (stdout += chunk.toString()))
      proc.stderr.on('data', chunk => (stderr += chunk.toString()))
      proc.on('error', reject)
      proc.on('close', () => {
        const output = stdout || stderr
        if (!output) {
          reject(new Error('ffmpeg produced no output'))
        } else {
          resolve(output)
        }
      })
    })
  }
}

