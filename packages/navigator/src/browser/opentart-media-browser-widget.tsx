import * as React from 'react'
import { injectable, inject } from '@theia/core/shared/inversify'
import { ReactWidget, Message } from '@theia/core/lib/browser'
import { OpenTartFilesystem, MediaMetadata, MediaPreview } from '@opentart/filesystem/lib/common/opentart-filesystem-protocol'

@injectable()
export class OpenTartMediaBrowserWidget extends ReactWidget {
    @inject(OpenTartFilesystem)
    protected readonly filesystem!: OpenTartFilesystem

    protected currentUri = ''
    protected metadata: MediaMetadata | undefined
    protected preview: MediaPreview | undefined
    protected lastError: string | undefined
    protected isLoadingMetadata = false
    protected isGeneratingPreview = false

    static readonly ID = 'opentart-media-browser'
    static readonly LABEL = 'Media Browser'
    static readonly ICON = 'fa fa-film'

    constructor() {
        super()
        this.id = OpenTartMediaBrowserWidget.ID
        this.title.label = OpenTartMediaBrowserWidget.LABEL
        this.title.iconClass = OpenTartMediaBrowserWidget.ICON
        this.title.closable = true
        this.addClass('opentart-MediaBrowser')
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg)
        this.node.focus()
    }

    protected async onAfterAttach(msg: Message): Promise<void> {
        super.onAfterAttach(msg)
        // Ensure first render happens immediately when view opens.
        this.update()
    }

    protected onUriChange(value: string): void {
        this.currentUri = value
        this.update()
    }

    protected async loadMetadata(): Promise<void> {
        if (!this.currentUri.trim()) {
            this.lastError = 'Please input a media file path first.'
            this.update()
            return
        }
        this.isLoadingMetadata = true
        this.lastError = undefined
        this.metadata = undefined
        try {
            this.metadata = await this.filesystem.getMediaMetadata(this.currentUri.trim())
        } catch (e) {
            this.lastError = (e as Error).message
        }
        this.isLoadingMetadata = false
        this.update()
    }

    protected async generatePreview(): Promise<void> {
        if (!this.currentUri.trim()) {
            this.lastError = 'Please input a media file path first.'
            this.update()
            return
        }
        this.isGeneratingPreview = true
        this.lastError = undefined
        this.preview = undefined
        try {
            this.preview = await this.filesystem.getPreviewImage(this.currentUri.trim())
        } catch (e) {
            this.lastError = (e as Error).message
        }
        this.isGeneratingPreview = false
        this.update()
    }

    protected render(): React.ReactNode {
        return (
            <div className='opentart-MediaBrowser'>
                <div className='theia-header'>Media Browser (WIP)</div>
                <div style={{ marginBottom: '0.5rem' }}>输入本地媒体路径后测试元信息和缩略图：</div>
                <input
                    style={{ width: '100%', marginBottom: '0.5rem' }}
                    type='text'
                    value={this.currentUri}
                    placeholder='e:/Blender/out/0001-0250.avi'
                    onChange={e => this.onUriChange(e.currentTarget.value)}
                />
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <button className='theia-button secondary' onClick={() => this.loadMetadata()}>
                        {this.isLoadingMetadata ? 'Loading...' : 'Load Metadata'}
                    </button>
                    <button className='theia-button secondary' onClick={() => this.generatePreview()}>
                        {this.isGeneratingPreview ? 'Generating...' : 'Generate Preview'}
                    </button>
                </div>
                {this.lastError && (
                    <div style={{ color: '#d73a49', marginBottom: '0.5rem' }}>{this.lastError}</div>
                )}
                {this.metadata && (
                    <div style={{ marginBottom: '0.5rem' }}>
                        <div><b>Kind:</b> {this.metadata.kind}</div>
                        <div><b>Duration:</b> {this.metadata.durationSeconds ?? '-'} s</div>
                        <div><b>Resolution:</b> {this.metadata.width ?? '-'}x{this.metadata.height ?? '-'}</div>
                        <div><b>Codec:</b> {this.metadata.codec ?? '-'}</div>
                    </div>
                )}
                {this.preview && (
                    <div>
                        <div><b>Preview Path:</b> {this.preview.imagePath}</div>
                    </div>
                )}
            </div>
        )
    }
}

