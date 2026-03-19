import * as React from 'react'
import { injectable } from '@theia/core/shared/inversify'
import { ReactWidget, Message } from '@theia/core/lib/browser'

@injectable()
export class OpenTartMediaBrowserWidget extends ReactWidget {
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

    protected render(): React.ReactNode {
        return (
            <div className='opentart-MediaBrowser'>
                <div className='theia-header'>Media Browser (WIP)</div>
                <div>这里后续会列出媒体资源（视频 / 音频 / 图片）。</div>
            </div>
        )
    }
}

