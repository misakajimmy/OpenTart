import * as React from 'react'
import { injectable, inject } from '@theia/core/shared/inversify'
import { ReactWidget, Message } from '@theia/core/lib/browser'
import { OpenTartFilesystem, MediaMetadata, MediaPreview } from '@opentart/filesystem/lib/common/opentart-filesystem-protocol'
import { MediaEntry, MediaSourceType, MediaViewMode } from './media-browser/model'
import { MediaSourceFactory } from './media-browser/source/media-source-factory'
import { LabelProvider } from '@theia/core/lib/browser/label-provider'
import URI from '@theia/core/lib/common/uri'
import { FileDialogService } from '@theia/filesystem/lib/browser/file-dialog/file-dialog-service'
import { WorkspaceService } from '@theia/workspace/lib/browser'

@injectable()
export class OpenTartMediaBrowserWidget extends ReactWidget {
    @inject(OpenTartFilesystem)
    protected readonly filesystem!: OpenTartFilesystem
    @inject(MediaSourceFactory)
    protected readonly sourceFactory!: MediaSourceFactory
    @inject(LabelProvider)
    protected readonly labelProvider!: LabelProvider
    @inject(FileDialogService)
    protected readonly fileDialogService!: FileDialogService
    @inject(WorkspaceService)
    protected readonly workspaceService!: WorkspaceService

    protected selectedSourceType: MediaSourceType = 'localDrive'
    protected viewMode: MediaViewMode = 'list'
    protected currentPath = ''
    protected entries: MediaEntry[] = []
    protected sourceRoots: MediaEntry[] = []
    protected selectedEntry: MediaEntry | undefined

    protected currentUri = ''
    protected metadata: MediaMetadata | undefined
    protected preview: MediaPreview | undefined
    protected lastError: string | undefined
    protected isLoadingMetadata = false
    protected isGeneratingPreview = false
    protected isLoadingEntries = false
    protected previewPanelWidth = 320
    protected resizing: 'preview' | undefined

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

    protected onBeforeDetach(msg: Message): void {
        super.onBeforeDetach(msg)
        this.stopResize()
    }

    protected async onAfterAttach(msg: Message): Promise<void> {
        super.onAfterAttach(msg)
        await this.loadSourceRoots()
        const roots = await this.workspaceService.roots
        const firstWorkspaceRoot = roots[0]
        if (firstWorkspaceRoot) {
            await this.loadDirectory(firstWorkspaceRoot.resource.path.fsPath())
        } else {
            await this.openSourceRoot()
        }
        this.update()
    }

    protected async loadSourceRoots(): Promise<void> {
        const source = this.sourceFactory.create(this.selectedSourceType)
        this.sourceRoots = await source.listRoots()
    }

    protected async openSourceRoot(): Promise<void> {
        const source = this.sourceFactory.create(this.selectedSourceType)
        const firstRoot = this.sourceRoots[0]
        if (!firstRoot || firstRoot.type === 'placeholder') {
            this.entries = []
            return
        }
        this.currentPath = firstRoot.path
        await this.loadDirectory(this.currentPath, source)
    }

    protected async loadDirectory(dirPath: string, source = this.sourceFactory.create(this.selectedSourceType)): Promise<void> {
        this.isLoadingEntries = true
        this.lastError = undefined
        try {
            this.entries = await source.listDirectory(dirPath)
            this.currentPath = dirPath
            this.selectedEntry = undefined
            this.currentUri = ''
            this.metadata = undefined
            this.preview = undefined
        } catch (e) {
            this.lastError = (e as Error).message
        }
        this.isLoadingEntries = false
        this.update()
    }

    protected async onSelectSource(sourceType: MediaSourceType): Promise<void> {
        this.selectedSourceType = sourceType
        this.currentPath = ''
        this.entries = []
        this.sourceRoots = []
        this.selectedEntry = undefined
        this.currentUri = ''
        this.metadata = undefined
        this.preview = undefined
        this.lastError = undefined
        await this.loadSourceRoots()
        if (sourceType === 'networkPlaceholder') {
            this.lastError = 'Network locations are not implemented yet.'
            this.update()
            return
        }
        await this.openSourceRoot()
    }

    protected async onSelectRoot(root: MediaEntry): Promise<void> {
        if (root.type === 'placeholder') {
            this.lastError = 'Network locations are not implemented yet.'
            this.update()
            return
        }
        await this.loadDirectory(root.path)
    }

    protected async goToParentDirectory(): Promise<void> {
        if (!this.currentPath) {
            return
        }
        const parent = this.currentPath.endsWith(':\\')
            ? this.currentPath
            : this.currentPath.substring(0, this.currentPath.lastIndexOf('\\')) || this.currentPath
        if (parent === this.currentPath) {
            return
        }
        await this.loadDirectory(parent)
    }

    protected async onOpenEntry(entry: MediaEntry): Promise<void> {
        if (entry.type === 'directory' || entry.type === 'drive') {
            await this.loadDirectory(entry.path)
            return
        }
        if (entry.type === 'placeholder') {
            this.lastError = 'Network locations are not implemented yet.'
            this.update()
            return
        }
        if (!this.isMediaFile(entry.path)) {
            this.lastError = 'Selected file is not a supported media type.'
            this.selectedEntry = entry
            this.currentUri = entry.path
            this.metadata = undefined
            this.preview = undefined
            this.update()
            return
        }
        this.selectedEntry = entry
        this.currentUri = entry.path
        await this.loadMetadata()
        await this.generatePreview()
    }

    protected async openWithTheiaFileDialog(): Promise<void> {
        this.lastError = undefined
        const selected = await this.fileDialogService.showOpenDialog({
            title: 'Select Media File',
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false
        })
        if (!selected) {
            return
        }
        const entry: MediaEntry = {
            id: `file-${selected.toString()}`,
            name: this.labelProvider.getName(selected),
            path: selected.path.fsPath(),
            type: 'file'
        }
        await this.onOpenEntry(entry)
    }

    protected async openFolderWithTheiaFileDialog(): Promise<void> {
        this.lastError = undefined
        const selected = await this.fileDialogService.showOpenDialog({
            title: 'Select Folder',
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false
        })
        if (!selected) {
            return
        }
        await this.loadDirectory(selected.path.fsPath())
    }

    protected isMediaFile(filePath: string): boolean {
        const lower = filePath.toLowerCase()
        const exts = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.mp3', '.wav', '.flac', '.m4a', '.jpg', '.jpeg', '.png', '.webp']
        return exts.some(ext => lower.endsWith(ext))
    }

    protected async loadMetadata(): Promise<void> {
        if (!this.currentUri.trim()) {
            this.lastError = 'Please select a media file first.'
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
            this.lastError = 'Please select a media file first.'
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

    protected onChangeViewMode(mode: MediaViewMode): void {
        this.viewMode = mode
        this.update()
    }

    protected fullWidthButtonStyle(selected = false): React.CSSProperties {
        return {
            width: '100%',
            boxSizing: 'border-box',
            marginLeft: 0,
            textAlign: 'left',
            marginBottom: '0.25rem',
            opacity: selected ? 1 : 0.85
        }
    }

    protected iconButtonStyle(active = false): React.CSSProperties {
        return {
            marginLeft: 0,
            minWidth: '28px',
            width: '28px',
            height: '28px',
            padding: '4px',
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            opacity: active ? 1 : 0.75
        }
    }

    protected getEntryIconClass(entry: MediaEntry): string {
        if (entry.type === 'directory' || entry.type === 'drive') {
            return 'codicon codicon-folder'
        }
        if (entry.type === 'placeholder') {
            return 'codicon codicon-cloud'
        }
        const uri = new URI(entry.path)
        const iconClass = this.labelProvider.getIcon(uri)
        return iconClass || 'codicon codicon-file'
    }

    protected startResize(which: 'preview', e: React.MouseEvent): void {
        e.preventDefault()
        this.resizing = which
        window.addEventListener('mousemove', this.handleResizeMove)
        window.addEventListener('mouseup', this.handleResizeEnd)
    }

    protected readonly handleResizeMove = (event: MouseEvent): void => {
        if (!this.resizing) {
            return
        }
        const rect = this.node.getBoundingClientRect()
        const minBrowserWidth = 120
        const maxPreviewWidth = Math.max(220, rect.width - minBrowserWidth)
        const width = Math.min(Math.max(rect.right - event.clientX, 220), maxPreviewWidth)
        this.previewPanelWidth = width
        this.update()
    }

    protected readonly handleResizeEnd = (): void => {
        this.stopResize()
    }

    protected stopResize(): void {
        this.resizing = undefined
        window.removeEventListener('mousemove', this.handleResizeMove)
        window.removeEventListener('mouseup', this.handleResizeEnd)
    }

    protected renderRootSelector(): React.ReactNode {
        if (this.selectedSourceType !== 'localDrive' || this.sourceRoots.length === 0) {
            return null
        }
        const current = this.sourceRoots.find(root => this.currentPath.startsWith(root.path))
        return (
            <select
                className='theia-select theia-LocationList'
                value={current?.path || ''}
                onChange={async e => {
                    const root = this.sourceRoots.find(item => item.path === e.currentTarget.value)
                    if (root) {
                        await this.onSelectRoot(root)
                    }
                }}
                style={{ width: '72px', height: '24px' }}
            >
                {this.sourceRoots.map(root => (
                    <option key={root.id} value={root.path}>{root.name}</option>
                ))}
            </select>
        )
    }

    protected renderBrowserPanel(): React.ReactNode {
        return (
            <div style={{ flex: 1, minWidth: 0 }}>
                <div className='theia-header' style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, overflow: 'hidden' }}>
                        <button
                            className='theia-button secondary'
                            title='Open file with Theia FileDialog'
                            style={this.iconButtonStyle(false)}
                            onClick={() => this.openWithTheiaFileDialog()}
                        >
                            <i className='fa fa-file-video-o' />
                        </button>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                        <button
                            className='theia-button secondary'
                            title='List view'
                            style={{ ...this.iconButtonStyle(this.viewMode === 'list'), marginRight: '0.25rem' }}
                            onClick={() => this.onChangeViewMode('list')}
                        >
                            <i className='fa fa-list' />
                        </button>
                        <button
                            className='theia-button secondary'
                            title='Grid view'
                            style={this.iconButtonStyle(this.viewMode === 'grid')}
                            onClick={() => this.onChangeViewMode('grid')}
                        >
                            <i className='fa fa-th-large' />
                        </button>
                    </span>
                </div>
                <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center' }}>
                    <button
                        className='theia-button secondary'
                        title='Up'
                        style={this.iconButtonStyle(false)}
                        onClick={() => this.goToParentDirectory()}
                    >
                        <i className='fa fa-level-up' />
                    </button>
                    <span
                        title={this.currentPath || '-'}
                        style={{
                            marginLeft: '0.5rem',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            flex: 1,
                            minWidth: 0
                        }}
                    >
                        {this.currentPath || '-'}
                    </span>
                </div>
                {(this.isLoadingMetadata || this.isGeneratingPreview) && (
                    <div style={{ marginBottom: '0.5rem' }}>
                        {this.isLoadingMetadata && <span style={{ marginRight: '0.5rem' }}>Loading metadata...</span>}
                        {this.isGeneratingPreview && <span>Generating preview...</span>}
                    </div>
                )}
                {this.isLoadingEntries && <div>Loading entries...</div>}
                {!this.isLoadingEntries && this.viewMode === 'list' && (
                    <div>
                        {this.entries.map(entry => (
                            <div
                                key={entry.id}
                                style={{
                                    padding: '0.25rem 0.5rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    background: this.selectedEntry?.id === entry.id
                                        ? 'var(--theia-list-activeSelectionBackground)'
                                        : 'transparent'
                                }}
                                onDoubleClick={() => this.onOpenEntry(entry)}
                                onClick={() => {
                                    this.selectedEntry = entry
                                    this.update()
                                }}
                            >
                                <span className={this.getEntryIconClass(entry)} style={{ marginRight: '0.4rem' }} />
                                <span
                                    title={entry.name}
                                    style={{
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: 'inline-block',
                                        maxWidth: 'calc(100% - 24px)',
                                        verticalAlign: 'bottom'
                                    }}
                                >
                                    {entry.name}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
                {!this.isLoadingEntries && this.viewMode === 'grid' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(100px, 1fr))', gap: '0.5rem' }}>
                        {this.entries.map(entry => (
                            <div
                                key={entry.id}
                                style={{
                                    border: '1px solid var(--theia-editorGroup-border)',
                                    padding: '0.5rem',
                                    cursor: 'pointer',
                                    background: this.selectedEntry?.id === entry.id
                                        ? 'var(--theia-list-activeSelectionBackground)'
                                        : 'transparent'
                                }}
                                onDoubleClick={() => this.onOpenEntry(entry)}
                                onClick={() => {
                                    this.selectedEntry = entry
                                    this.update()
                                }}
                            >
                                <div style={{ fontSize: '0.8em', opacity: 0.8 }}>
                                    <span className={this.getEntryIconClass(entry)} style={{ marginRight: '0.35rem' }} />
                                    {entry.type}
                                </div>
                                <div
                                    title={entry.name}
                                    style={{
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}
                                >
                                    {entry.name}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    protected renderPreviewPanel(): React.ReactNode {
        return (
            <div style={{ width: `${this.previewPanelWidth}px`, minWidth: `${this.previewPanelWidth}px`, paddingLeft: '0.75rem' }}>
                <div className='theia-header'>Preview</div>
                {this.selectedEntry && (
                    <div style={{ marginBottom: '0.5rem', display: 'flex', minWidth: 0 }}>
                        <b style={{ marginRight: '0.35rem' }}>File:</b>
                        <span
                            title={this.selectedEntry.name}
                            style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        >
                            {this.selectedEntry.name}
                        </span>
                    </div>
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
                        <div style={{ fontSize: '0.8em', opacity: 0.85, marginBottom: '0.25rem' }}>{this.preview.imagePath}</div>
                        {this.preview.imageDataUri && (
                            <img
                                src={this.preview.imageDataUri}
                                alt='Preview'
                                style={{ maxWidth: '100%', border: '1px solid #ccc' }}
                            />
                        )}
                    </div>
                )}
            </div>
        )
    }

    protected render(): React.ReactNode {
        return (
            <div className='opentart-MediaBrowser'>
                {/* <div className='theia-header'>Media Browser (WIP)</div>
                <div style={{ marginBottom: '0.5rem' }}>双击文件夹进入，双击文件进行预览。</div> */}
                {this.lastError && (
                    <div style={{ color: '#d73a49', marginBottom: '0.5rem' }}>{this.lastError}</div>
                )}
                <div style={{ display: 'flex' }}>
                    {this.renderBrowserPanel()}
                    <div
                        style={{
                            width: '4px',
                            cursor: 'col-resize',
                            borderLeft: '1px solid var(--theia-editorGroup-border)',
                            borderRight: '1px solid var(--theia-editorGroup-border)'
                        }}
                        onMouseDown={e => this.startResize('preview', e)}
                    />
                    {this.renderPreviewPanel()}
                </div>
            </div>
        )
    }
}

