## Eclipse Theia 架构速览（基于本地 `theia` 仓库）

> 本文是对本地 `D:\git\github\theia` 仓库的架构梳理，方便在 OpenTart 中对照和学习。

---

### 1. 顶层 Monorepo 结构

Theia 自身就是一个 **monorepo**，根包名为 `@theia/monorepo`：

- **根 `package.json` 关键点**
  - `name`: `@theia/monorepo`
  - 使用 **npm + Lerna + workspaces** 管理子包：
    ```json
    "workspaces": [
      "dev-packages/*",
      "packages/*",
      "examples/*",
      "sample-plugins/*/*"
    ]
    ```
  - 常见脚本：
    - `npm run compile`：编译所有 TypeScript 包。
    - `npm run build:browser` / `build:electron`：构建示例应用。
    - `npm run start:browser` / `start:electron`：启动浏览器 / Electron 示例。
    - `lerna run <script>`：在各子包中并行执行脚本。

- **顶层目录职责**
  - `packages/`：**运行时包**（Theia core + 各种扩展），是真正组成 IDE 的部分。
  - `dev-packages/`：**开发时包**（CLI、共享脚本等，只在构建/开发时使用）。
  - `examples/`：示例应用（browser、electron、playwright 等）。
  - `doc/`：项目文档（开发指南、代码组织原则、测试、迁移等）。
  - `scripts/`：用于构建、生成文档、发布等的 Node 脚本。

在 OpenTart 中，当前的 `@opentart/monorepo + packages/* + examples/*` 就是对 Theia 这一层结构的简化版。

---

### 2. 包内部的「多平台目录」模型

Theia 在每个包内部，按「运行平台」来划分代码目录（见 `doc/code-organization.md`）：

- `common/*`
  - 只依赖基础 JS/TS API，可在任何环境运行。
  - 可被其它所有层引用。

- `browser/*`
  - 依赖浏览器 API（DOM 等），运行在浏览器前端。
  - 可以依赖：`common/*`

- `browser-only/*`
  - 也在浏览器运行，但不依赖 Node backend。
  - 可以依赖：`common/*`

- `node/*`
  - 依赖 Node.js API，运行在后端进程。
  - 可以依赖：`common/*`

- `electron-*/*`
  - `electron-node/*`、`electron-browser/*`、`electron-main/*` 等，分别对应 Electron 的不同进程。
  - 按层级向下依赖：例如 `electron-browser` 可以依赖 `browser` 和 `common`。

**核心思想**：

- **按运行环境分层，而不是按功能分层。**
- 上层可以引用下层（比如 `browser` 可以引用 `common`），反之不行。
- 这样可以在不同部署形态（纯 browser / browser+node / electron）之间复用绝大部分代码。

在 OpenTart 中，可以在 `@opentart/core`、未来扩展里仿照这一模式：`src/common` + `src/browser` + `src/node`。

---

### 3. Theia 的扩展模型（Extension Model）

Theia 本身就是一组扩展（extensions）堆起来的 IDE：

- **每个运行时包都是一个扩展包**
  - 例如：`@theia/core`、`@theia/filesystem`、`@theia/workspace`、`@theia/navigator` 等。
  - 每个包通常会暴露一个或多个 **前端 / 后端模块**（`ContainerModule`），用于在 DI 容器中注册服务。

- **依赖注入（DI）容器：Inversify**
  - 所有服务/贡献点都通过 Inversify 进行注册和获取。
  - 每个扩展会导出一个 `ContainerModule`，在 module 中调用 `bind()` 来注册：
    - 服务实现
    - 各种「贡献点」（Contribution）

- **典型的前端扩展入口结构**
  - 一个前端 `ContainerModule`：
    - 绑定 Widget / 命令 / 菜单 / 应用生命周期贡献等。
  - 一个或多个「Contribution」类，实现特定的扩展接口：
    - 如 `FrontendApplicationContribution`、`CommandContribution`、`MenuContribution` 等。

OpenTart 里 `@opentart/core` 的 `opentart-core-frontend-module.ts` 就是在模仿这一模式：导出一个 `ContainerModule`，在里面注册自己的贡献类。

---

### 4. 前后端分层与通信

Theia 应用通常是「**浏览器前端 + Node 后端**」两层架构：

- **前端**
  - 加载来自各个扩展的前端模块（`browser/*`）。
  - 通过 DI 容器拿到前端服务（比如 UI 组件、命令、视图、状态管理等）。

- **后端**
  - 加载各扩展的后端模块（`node/*`），提供文件系统、工作区、进程等服务。

- **前后端通信**
  - 使用 JSON-RPC / WebSocket。
  - 通常在 `common` 定义共享接口和 DTO：
    - 前后端都依赖 `common` 中的协议。
  - `browser` 端通过注入的服务代理调用 `node` 端实现。

对 OpenTart 来说：

- 目前你只实现了前端模块（`@opentart/core` 的 `browser` 部分），后续可以参考 Theia 的做法：
  - 在 `src/common` 定义共用模型 / 接口。
  - 在 `src/node` 实现真正的业务逻辑（如项目存储、未来视频处理后台）。
  - 在前端通过 Theia 的 RPC 通道调用后端。

---

### 5. 应用壳（Application Shell）与组合

Theia 的「IDE」本身其实只是一个 **应用壳 + 一组扩展**：

- 仓库中的 `examples/browser`、`examples/electron` 等就是不同形态的应用壳。
- 每个应用壳的 `package.json` 会：
  - 声明依赖的扩展包（如 `@theia/core`, `@theia/filesystem` 等）。
  - 提供一个 `theiaExtensions` 列表，告诉 Theia CLI 要加载哪些扩展。

例如（简化）：

```json
"dependencies": {
  "@theia/core": "latest",
  "@theia/filesystem": "latest",
  "@theia/workspace": "latest"
},
"theiaExtensions": [
  "@theia/core",
  "@theia/filesystem",
  "@theia/workspace"
]
```

在 OpenTart 中：

- `examples/opentart-app-browser` 已经完全沿用这一模式：
  - 依赖 `@theia/*` 官方扩展。
  - 依赖 `@opentart/core` 自定义扩展。
  - 通过 `theiaExtensions` 加载它们。

**总结**：Theia 应用只是「把一堆扩展拼在一起」的组合层，几乎不包含业务逻辑。

---

### 6. 构建与开发工作流

根据 `doc/Developing.md`，Theia 的典型工作流是：

1. **安装依赖并编译所有包**
   ```sh
   npm install
   npm run compile          # 通过 lerna 编译所有 packages
   ```

2. **构建示例应用**
   ```sh
   npm run build:browser
   npm run build:electron
   # 或一次性：
   npm run build:applications
   ```

3. **运行示例应用**
   ```sh
   npm run start:browser
   npm run start:electron
   ```

4. **开发辅助**
   - `watch:*`：监听源码变更。
   - `test:*`、`lint`：质量控制。

OpenTart 已用更简化的方式对齐了这套流程：

- 根目录：
  ```sh
  yarn bootstrap   # 安装依赖 + 建立 workspaces
  yarn build       # lerna run build -> 构建所有包（含 @opentart/core）
  yarn start:browser
  ```
- 示例应用：
  ```sh
  cd examples/opentart-app-browser
  yarn dev         # 开发模式启动
  yarn build       # production 构建
  yarn build:dev   # development 构建
  ```

---

### 7. 在 OpenTart 中如何「仿照 Theia 学架构」

结合本地 `theia` 仓库，可以按下面路线学习并迁移实践到 OpenTart：

1. **包结构与多平台目录**
   - 在 `packages/core` 中逐步引入 `src/common`、`src/browser`、`src/node`。
   - 对应 Theia 各包的目录结构，练习前后端分层。

2. **扩展模型**
   - 在 `@opentart/core` 中增加：
     - 命令（`CommandContribution`）
     - 菜单（`MenuContribution`）
     - 视图 / Widget（`Widget` + `WidgetFactory`）
   - 对照本地 `packages/@theia/*` 里的实现。

3. **前后端通信**
   - 参照 Theia 官方扩展（如 `filesystem`、`workspace`），为 OpenTart 设计简单的后端服务。
   - 在 `src/common` 定义接口，在 `src/node` 实现，在 `src/browser` 调用。

4. **更多应用壳**
   - 在 `examples/` 下增加新的应用壳（如 `@opentart/app-electron`），对照 Theia 的 `examples/electron`。

后续如果你在某一块（比如命令系统、视图系统、前后端 RPC）想看「更像源码级的讲解」，可以从这里的章节出发，让我们一起深入某个具体包来对照分析。

