## OpenTart Navigator / Explorer 实现笔记

本文件记录在 OpenTart 中基于 Theia 架构实现自定义 Navigator / Explorer（项目资源浏览器 + 媒体浏览器）时的经验和参考点，方便后续扩展和复用。

---

### 1. 目标与整体结构

目标是实现一个类似 VS Code / Theia Explorer 的左侧容器视图：

- 容器视图：`OpenTart Explorer`
  - 包含两个可折叠的子视图（tab）：
    - **Media Browser**：媒体资源浏览器（未来列出视频/音频/图片等）。
    - **OpenTart Navigator**：项目资源浏览器（当前简单显示 Workspace roots，将来扩展成文件树）。

整体对应的包为：

- `@opentart/navigator`（`packages/navigator`）：
  - `OpenTartNavigatorWidget`：项目资源浏览器 widget。
  - `OpenTartMediaBrowserWidget`：媒体浏览器 widget。
  - `OpenTartExplorerWidgetFactory`：组合上述两个 widget 的容器工厂。
  - `OpenTartExplorerContribution`：视图贡献，负责在左侧打开 / 恢复该容器。
  - 命令：`opentart-navigator:toggle`，用于 toggle 整个 Explorer 容器。

---

### 2. 关键代码结构

#### 2.1 Navigator Widget（项目资源浏览器）

文件：`packages/navigator/src/browser/opentart-navigator-widget.tsx`

- 继承自 `ReactWidget`，使用 Inversify 注入 Theia 服务：
  - `WorkspaceService`：获取 workspace roots。
  - `LabelProvider`：根据 URI 生成显示名称。
- 构造函数中必须设置：
  - `this.id`：widget 唯一 ID（`opentart-navigator`）。
  - `this.title.label`：标签名（`OpenTart Navigator`）。
  - `this.title.iconClass`：图标（例如 `fa fa-folder-open`）。
  - `this.title.closable`：是否可关闭。
  - `this.addClass('opentart-Navigator')`：便于样式扩展。
- 示例（结构）：

```ts
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

    protected async updateRoots(): Promise<void> {
        const roots = await this.workspaceService.roots
        this.roots = roots.map(r => r.resource)
        this.update()
    }
}
```

> 注意：在 strict TS 下，`@inject` 属性需要开启 `experimentalDecorators`，已经在 `tsconfig.base.json` 中统一配置。

#### 2.2 Media Browser Widget（媒体浏览器）

文件：`packages/navigator/src/browser/opentart-media-browser-widget.tsx`

- 同样继承自 `ReactWidget`，目前只作为 UI 占位：
  - ID：`opentart-media-browser`
  - 标签：`Media Browser`
  - 图标：`fa fa-film`
- 将来会在这里实现媒体资源列表 / 分组 / 预览入口等。

---

### 3. Explorer 容器（ViewContainer）设计

参考 Theia 源码：

- 本地路径：`D:\git\github\theia\packages\navigator\src\browser\navigator-widget-factory.ts`
- 关键类型：
  - `ViewContainer` / `ViewContainer.Factory`
  - `ViewContainerTitleOptions`
  - `WidgetFactory`
  - `WidgetManager`

在 OpenTart 中对应实现为：

文件：`packages/navigator/src/browser/opentart-explorer-widget-factory.ts`

核心要点：

- 定义容器 ID 和标题选项：

```ts
export const OPENTART_EXPLORER_VIEW_CONTAINER_ID = 'opentart-explorer-view-container'

export const OPENTART_EXPLORER_TITLE_OPTIONS: ViewContainerTitleOptions = {
    label: 'OpenTart Explorer',
    iconClass: OpenTartNavigatorWidget.ICON,
    closeable: true
}
```

- 实现 `WidgetFactory`，在 `createWidget` 中：
  - 使用 `viewContainerFactory` 创建 `ViewContainer`。
  - 设置标题。
  - 通过 `WidgetManager.getOrCreateWidget` 获取两个子 widget。
  - 调用 `viewContainer.addWidget(widget, options)` 将子视图插入容器。

- 子视图的 `WidgetOptions` 控制折叠行为等：

```ts
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
```

---

### 4. 前端模块绑定（Frontend Module）

文件：`packages/navigator/src/browser/opentart-navigator-frontend-module.ts`

主要职责：

1. **绑定 Widgets 与其工厂**：
   - `OpenTartNavigatorWidget` / `OpenTartMediaBrowserWidget`。
   - Explorer 容器工厂 `OpenTartExplorerWidgetFactory`。
2. **注册 WidgetFactory**：
   - 容器自身（通过类绑定）。
   - 子视图（用 `toDynamicValue` 形式注册 id → createWidget）。
3. **注册视图贡献（ViewContribution）**：
   - 让 Explorer 自动出现在左侧，并支持布局恢复。
4. **注册 Toggle 命令**：
   - `opentart-navigator:toggle` 控制整个 Explorer 容器。

示例绑定片段：

```ts
export default new ContainerModule(bind => {
    bind(OpenTartNavigatorWidget).toSelf().inSingletonScope()
    bind(OpenTartMediaBrowserWidget).toSelf().inSingletonScope()

    // Explorer 容器工厂
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

    // ViewContribution：布局与恢复
    bindViewContribution(bind, OpenTartExplorerContribution)
    bind(FrontendApplicationContribution).toService(OpenTartExplorerContribution)

    // 命令贡献（Toggle Explorer）
    bind(CommandContribution).toDynamicValue(ctx =>
        new OpenTartNavigatorCommandContribution(
            ctx.container.get(WidgetManager),
            ctx.container.get(ApplicationShell)
        )
    ).inSingletonScope()
})
```

---

### 5. 自动打开与布局恢复的经验

问题现象：

- 一开始只通过命令 `getOrCreateWidget` + `shell.addWidget({ area: 'left' })` 打开 Navigator。
- 刷新浏览器后，视图不会自动恢复，需要再次执行命令才出现。

对比 Theia 源码：

- `FileNavigatorContribution` 继承自 `AbstractViewContribution`，并被绑定为 `FrontendApplicationContribution`。
- 布局初始化时，会根据偏好 / LayoutState 决定是否打开该视图。

在 OpenTart 中的解决方案：

1. 引入 `AbstractViewContribution<ViewContainer>`，实现 `OpenTartExplorerContribution`：

```ts
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
        // 当前策略：每次启动都确保左侧打开 Explorer
        await this.openView()
    }
}
```

2. 把该贡献绑定为 `FrontendApplicationContribution`：

```ts
bindViewContribution(bind, OpenTartExplorerContribution)
bind(FrontendApplicationContribution).toService(OpenTartExplorerContribution)
```

这样：

- 应用启动时会在左侧自动打开 `OpenTart Explorer`。
- 未来如需更智能的布局恢复，可以在 `initializeLayout` 中检查已有 layout 状态 / 用户偏好后，再决定是否 `openView`。

---

### 6. Toggle 命令的实现方式

命令 ID：`opentart-navigator:toggle`  
文件：`opentart-navigator-frontend-module.ts`

逻辑：

1. 通过 `WidgetManager` 获取 / 创建 Explorer 容器 widget。
2. 如果还不在任一区域，添加到左侧并激活。
3. 如果已经在左侧：
   - 当前激活 widget 即 Explorer 时，折叠左侧面板。
   - 否则，激活 Explorer。

大致实现：

```ts
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

                if (this.shell.activeWidget === widget) {
                    this.shell.collapsePanel('left')
                } else {
                    this.shell.activateWidget(widget.id)
                }
            }
        })
    }
}
```

---

### 7. 与 Theia 官方 Navigator 的参考关系

主要对照文件（在本地 `D:\git\github\theia` 仓库中）：

- `packages/navigator/src/browser/navigator-frontend-module.ts`
  - 使用 `bindViewContribution` + `FrontendApplicationContribution` 绑定 `FileNavigatorContribution`。
  - 绑定 `NavigatorWidgetFactory` 为容器工厂。
- `packages/navigator/src/browser/navigator-widget-factory.ts`
  - 使用 `ViewContainer.Factory` 创建 `Explorer` 容器。
  - 加入 `FileNavigatorWidget` + `OpenEditorsWidget` 两个子视图。

OpenTart 当前实现基本遵循同一模式，只是简化了许多功能（过滤器、装饰器、偏好等），适合用来学习和逐步扩展。

---

### 8. 后续可以扩展的方向

- **Navigator（项目资源浏览器）**
  - 从 Workspace roots 发展为完整的文件树（参考 `FileNavigatorWidget`）。
  - 支持右键菜单、重命名 / 删除 / 新建文件夹等操作。

- **Media Browser（媒体浏览器）**
  - 集成项目媒体库模型（视频/音频/图片索引）。
  - 支持缩略图、过滤、搜索、拖拽到时间线。

- **Explorer 容器体验**
  - 加 toolbar 按钮（导入媒体、新建项目、过滤等）。
  - 更精细控制折叠 / 记忆上次展开状态。

这些都可以继续参考 Theia 官方 navigator / open-editors 等扩展的实现方式来演进。

