import * as React from 'react'
import { injectable, inject } from '@theia/core/shared/inversify'
import { ReactWidget, Message } from '@theia/core/lib/browser'
import { LabelProvider } from '@theia/core/lib/browser/label-provider'
import { WorkspaceService } from '@theia/workspace/lib/browser'
import URI from '@theia/core/lib/common/uri'

@injectable()
export class OpenTartNavigatorWidget extends ReactWidget {
    static readonly ID = 'opentart-navigator'
    static readonly LABEL = 'OpenTart Navigator'
    static readonly ICON = 'fa fa-folder-open'

    @inject(WorkspaceService)
    protected readonly workspaceService!: WorkspaceService

    @inject(LabelProvider)
    protected readonly labelProvider!: LabelProvider

    protected roots: URI[] = []

    constructor() {
        super()
        this.id = OpenTartNavigatorWidget.ID
        this.title.label = OpenTartNavigatorWidget.LABEL
        this.title.iconClass = OpenTartNavigatorWidget.ICON
        this.title.closable = true
        this.addClass('opentart-Navigator')
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg)
        this.node.focus()
    }

    protected async onAfterAttach(msg: Message): Promise<void> {
        super.onAfterAttach(msg)
        await this.updateRoots()
    }

    protected async updateRoots(): Promise<void> {
        const roots = await this.workspaceService.roots
        // FileStat 中提供 resource(URI)，不同版本不保证有 uri:string
        this.roots = roots.map(r => r.resource)
        this.update()
    }

    protected render(): React.ReactNode {
        return (
            <div className='opentart-Navigator'>
                <div className='theia-header'>Workspace Roots</div>
                <ul>
                    {this.roots.map(uri => (
                        <li key={uri.toString()}>
                            {this.labelProvider.getName(uri)} ({uri.path.toString()})
                        </li>
                    ))}
                </ul>
            </div>
        )
    }
}

