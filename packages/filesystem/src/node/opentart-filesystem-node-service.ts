import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import { injectable, inject } from '@theia/core/shared/inversify'
import { OpenTartFfmpeg } from '@opentart/ffmpeg/lib/common/opentart-ffmpeg-protocol'
import {
  FilesystemEntry,
  MediaMetadata,
  MediaPreview,
  OpenTartFilesystem,
  WindowsDrive
} from '../common/opentart-filesystem-protocol'

@injectable()
export class OpenTartFilesystemNodeService implements OpenTartFilesystem {
  @inject(OpenTartFfmpeg)
  protected readonly ffmpeg!: OpenTartFfmpeg

  async getMediaMetadata(uri: string): Promise<MediaMetadata | undefined> {
    const metadata = await this.ffmpeg.probe(uri)
    const primaryVideo = metadata.streams.find(s => s.codecType === 'video')
    const primaryAudio = metadata.streams.find(s => s.codecType === 'audio')
    const kind = primaryVideo ? 'video' : primaryAudio ? 'audio' : 'other'

    return {
      uri,
      kind,
      durationSeconds: metadata.format.durationSeconds,
      width: primaryVideo?.width,
      height: primaryVideo?.height,
      codec: primaryVideo?.codecName || primaryAudio?.codecName
    }
  }

  async getPreviewImage(uri: string): Promise<MediaPreview | undefined> {
    const outputPath = path.join(os.tmpdir(), 'opentart-previews', `preview-${Date.now()}.jpg`)
    const result = await this.ffmpeg.screenshot({
      inputUri: uri,
      outputPath,
      seekSeconds: 1
    })
    const imageBuffer = fs.readFileSync(result.outputPath)
    const imageDataUri = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`
    return {
      uri,
      imagePath: result.outputPath,
      imageDataUri
    }
  }

  async listWindowsDrives(): Promise<WindowsDrive[]> {
    const drives: WindowsDrive[] = []
    for (let code = 65; code <= 90; code++) {
      const letter = String.fromCharCode(code)
      const drivePath = `${letter}:\\`
      if (fs.existsSync(drivePath)) {
        drives.push({
          name: `${letter}:`,
          path: drivePath
        })
      }
    }
    return drives
  }

  async listDirectory(dirPath: string): Promise<FilesystemEntry[]> {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    return entries.map(entry => ({
      name: entry.name,
      path: path.join(dirPath, entry.name),
      isDirectory: entry.isDirectory()
    }))
  }
}

