import { ContainerModule } from '@theia/core/shared/inversify'
import {
    WidgetFactory,
    FrontendApplicationContribution,
    ApplicationShell,
    AbstractViewContribution,
    bindViewContribution,
    ViewContainer,
    FrontendApplication
} from '@theia/core/lib/browser'
import {
    Command,
    CommandContribution,
    CommandRegistry
} from '@theia/core/lib/common'
import { WidgetManager } from '@theia/core/lib/browser/widget-manager'
import { OpenTartNavigatorWidget } from './opentart-navigator-widget'
import { OpenTartMediaBrowserWidget } from './opentart-media-browser-widget'
import { OpenTartExplorerWidgetFactory, OPENTART_EXPLORER_VIEW_CONTAINER_ID } from './opentart-explorer-widget-factory'
import { MediaSourceFactory } from './media-browser/source/media-source-factory'
import { WindowsLocalDriveSource } from './media-browser/source/windows-local-drive-source'
import { NetworkLocationPlaceholderSource } from './media-browser/source/network-location-placeholder-source'

export const OpenTartNavigatorCommands = {
    TOGGLE: <Command>{
        id: 'opentart-navigator:toggle',
        label: 'Toggle OpenTart Explorer'
    }
}

class OpenTartExplorerContribution extends AbstractViewContribution<ViewContainer> {
    constructor() {
        super({
            viewContainerId: OPENTART_EXPLORER_VIEW_CONTAINER_ID,
            widgetId: OPENTART_EXPLORER_VIEW_CONTAINER_ID,
            widgetName: 'OpenTart Explorer',
            defaultWidgetOptions: {
                area: 'left'
            }
        })
    }

    async initializeLayout(app: FrontendApplication): Promise<void> {
        // 启动时确保在左侧打开 OpenTart Explorer
        await this.openView()
    }
}

class OpenTartNavigatorCommandContribution implements CommandContribution {

    constructor(
        protected readonly widgetManager: WidgetManager,
        protected readonly shell: ApplicationShell
    ) { }

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(OpenTartNavigatorCommands.TOGGLE, {
            execute: async () => {
                const widget = await this.widgetManager.getOrCreateWidget(OPENTART_EXPLORER_VIEW_CONTAINER_ID)

                const area = this.shell.getAreaFor(widget)
                if (!area) {
                    this.shell.addWidget(widget, { area: 'left' })
                    this.shell.activateWidget(widget.id)
                    return
                }

                // 简单的 toggle：如果已经是激活的左侧视图，则折叠左侧面板，否则激活该视图
                if (this.shell.activeWidget === widget) {
                    this.shell.collapsePanel('left')
                } else {
                    this.shell.activateWidget(widget.id)
                }
            }
        })
    }
}

export default new ContainerModule(bind => {
    bind(OpenTartNavigatorWidget).toSelf().inSingletonScope()
    bind(OpenTartMediaBrowserWidget).toSelf().inSingletonScope()
    bind(MediaSourceFactory).toSelf().inSingletonScope()
    bind(WindowsLocalDriveSource).toSelf().inSingletonScope()
    bind(NetworkLocationPlaceholderSource).toSelf().inSingletonScope()

    // Explorer 容器本身的工厂
    bind(WidgetFactory).to(OpenTartExplorerWidgetFactory).inSingletonScope()

    // 子视图：项目资源浏览器
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: OpenTartNavigatorWidget.ID,
        createWidget: () => ctx.container.get(OpenTartNavigatorWidget)
    })).inSingletonScope()

    // 子视图：媒体浏览器
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: OpenTartMediaBrowserWidget.ID,
        createWidget: () => ctx.container.get(OpenTartMediaBrowserWidget)
    })).inSingletonScope()

    // 视图贡献：负责把 Explorer 放到左侧，并支持布局恢复
    bindViewContribution(bind, OpenTartExplorerContribution)
    bind(FrontendApplicationContribution).toService(OpenTartExplorerContribution)

    bind(CommandContribution).toDynamicValue(ctx =>
        new OpenTartNavigatorCommandContribution(
            ctx.container.get(WidgetManager),
            ctx.container.get(ApplicationShell)
        )
    ).inSingletonScope()
})

