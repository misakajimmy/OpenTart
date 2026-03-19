import { inject, injectable } from '@theia/core/shared/inversify'
import {
    ViewContainer,
    ViewContainerTitleOptions,
    WidgetFactory,
    WidgetManager
} from '@theia/core/lib/browser'
import { OpenTartNavigatorWidget } from './opentart-navigator-widget'
import { OpenTartMediaBrowserWidget } from './opentart-media-browser-widget'

export const OPENTART_EXPLORER_VIEW_CONTAINER_ID = 'opentart-explorer-view-container'

export const OPENTART_EXPLORER_TITLE_OPTIONS: ViewContainerTitleOptions = {
    label: 'OpenTart Explorer',
    iconClass: OpenTartNavigatorWidget.ICON,
    closeable: true
}

@injectable()
export class OpenTartExplorerWidgetFactory implements WidgetFactory {

    static ID = OPENTART_EXPLORER_VIEW_CONTAINER_ID

    readonly id = OpenTartExplorerWidgetFactory.ID

    protected readonly mediaWidgetOptions: ViewContainer.Factory.WidgetOptions = {
        order: 0,
        canHide: true,
        initiallyCollapsed: false,
        weight: 50
    }

    protected readonly projectWidgetOptions: ViewContainer.Factory.WidgetOptions = {
        order: 1,
        canHide: true,
        initiallyCollapsed: false,
        weight: 50
    }

    @inject(ViewContainer.Factory)
    protected readonly viewContainerFactory!: ViewContainer.Factory

    @inject(WidgetManager)
    protected readonly widgetManager!: WidgetManager

    async createWidget(): Promise<ViewContainer> {
        const viewContainer = this.viewContainerFactory({
            id: OPENTART_EXPLORER_VIEW_CONTAINER_ID,
            progressLocationId: 'opentart-explorer'
        })
        viewContainer.setTitleOptions(OPENTART_EXPLORER_TITLE_OPTIONS)

        const mediaWidget = await this.widgetManager.getOrCreateWidget(OpenTartMediaBrowserWidget.ID)
        const projectWidget = await this.widgetManager.getOrCreateWidget(OpenTartNavigatorWidget.ID)

        viewContainer.addWidget(mediaWidget, this.mediaWidgetOptions)
        viewContainer.addWidget(projectWidget, this.projectWidgetOptions)

        return viewContainer
    }
}

