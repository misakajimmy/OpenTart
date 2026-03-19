## OpenTart 开发范式与工作流

本仓库是基于 **Yarn Workspaces + Lerna 9 + Theia CLI** 的 monorepo。下面整理当前约定的开发范式，方便后续统一维护。

---

### 1. 仓库结构与命名约定

- **根包**
  - `name`: `@opentart/monorepo`
  - 负责统一配置、脚本和开发依赖（`@theia/cli`、`lerna`、`typescript`、`rimraf` 等）。

- **子包命名约定**
  - 扩展 / 业务包：`@opentart/<feature>`（例如：`@opentart/video-editor`）
  - 应用壳 / 示例：`@opentart/app-<target>`（例如：`@opentart/app-browser`）
  - 将来如有工具库，可约定为：`@opentart/lib-<name>`（尚未使用）。

- **Workspaces & Lerna**
  - `package.json`：
    ```json
    "workspaces": [
      "packages/*",
      "examples/*"
    ]
    ```
  - `lerna.json`：
    ```json
    {
      "packages": [
        "packages/*",
        "examples/*"
      ],
      "version": "0.0.1"
    }
    ```
  - **原则**：包发现由 Yarn Workspaces / Lerna 的 `packages` 统一管理，新增包时放到 `packages/` 或 `examples/` 下即可被自动识别。

---

### 2. 包管理与根脚本

- **包管理器：统一使用 Yarn v1**
  - 不再使用 `lerna bootstrap`，安装和链接全部由 Yarn Workspaces 负责。

- **根目录脚本（`package.json`）**
  ```json
  "scripts": {
    "bootstrap": "yarn install",
    "build": "lerna run build",
    "clean": "rimraf packages/*/lib examples/*/lib",
    "start:browser": "lerna run start --scope @opentart/app-browser"
  }
  ```

- **常用命令**
  - 初始化 / 安装依赖：
    ```bash
    yarn bootstrap   # 等价于 yarn install，使用 workspaces
    ```
  - 构建所有包（含应用）：
    ```bash
    yarn build       # lerna run build
    ```
  - 清理所有构建产物（输出到 lib）：
    ```bash
    yarn clean       # 删除 packages/*/lib 和 examples/*/lib
    ```
  - 启动浏览器示例应用：
    ```bash
    yarn start:browser
    ```

---

### 3. Theia CLI 使用方式

- **安装方式**
  - 在 monorepo 根作为开发依赖安装 `@theia/cli`（已配置）：
    ```bash
    yarn add -D @theia/cli -W
    ```
  - Yarn Workspaces 会在根 `node_modules/.bin` 中提供 `theia` 命令，所有 workspace 包在执行脚本时都会自动继承该 PATH。

- **使用原则**
  - 只在脚本中使用 `theia` 命令（不依赖全局安装），由根的 `@theia/cli` 提供实际可执行文件。
  - Theia 应用壳和扩展的构建 / 启动都通过 `theia` CLI 完成。

---

### 4. 包（packages）开发约定（以 `@opentart/core` / `@opentart/video-editor` 为例）

- **目录结构（通用）**
  - 源码：`src/**`
  - 编译输出：`lib/**`
  - 前端扩展入口示例：
    - 核心扩展：`src/browser/opentart-core-frontend-module.ts`（包名 `@opentart/core`）
    - 视频编辑扩展：`src/browser/opentart-video-editor-frontend-module.ts`（包名 `@opentart/video-editor`）

- **包内 tsconfig 示例（`packages/core/tsconfig.json` / `packages/video-editor/tsconfig.json`）**
  ```json
  {
    "extends": "../../tsconfig.base.json",
    "compilerOptions": {
      "rootDir": "src",
      "outDir": "lib"
    },
    "include": [
      "src"
    ]
  }
  ```

- **包内 package.json 关键字段示例（以 `@opentart/video-editor` 为例）**
  ```json
  {
    "name": "@opentart/video-editor",
    "version": "0.0.1",
    "private": true,
    "main": "lib/browser/opentart-video-editor-frontend-module",
    "scripts": {
      "clean": "rimraf lib",
      "build": "yarn clean && tsc -p ."
    },
    "theiaExtensions": [
      {
        "frontend": "lib/browser/opentart-video-editor-frontend-module"
      }
    ]
  }
  ```

- **开发 / 构建流程**
  - 在包目录内：
    ```bash
    cd packages/video-editor
    yarn build   # 清理 lib 并根据 tsconfig 编译到 lib
    ```
  - 从根目录触发构建（推荐）：
    ```bash
    yarn build   # 通过 lerna 调用各包自己的 build 脚本
    ```

- **清理规范**
  - 包内仅清理 `lib` 目录，不删除 `src` 和配置文件。
  - 全局清理通过根脚本统一处理（`yarn clean`）。

---

### 5. 示例应用（examples）开发约定（`@opentart/app-browser`）

- **依赖与扩展加载**
  - `examples/opentart-app-browser/package.json`：
    ```json
    "dependencies": {
      "@theia/core": "latest",
      "@theia/filesystem": "latest",
      "@theia/workspace": "latest",
      "@theia/navigator": "latest",
      "@theia/monaco": "latest",
      "@theia/messages": "latest",
      "@theia/preferences": "latest",
      "@opentart/video-editor": "0.0.1"
    },
    "theiaExtensions": [
      "@theia/core",
      "@theia/filesystem",
      "@theia/workspace",
      "@theia/navigator",
      "@theia/monaco",
      "@theia/messages",
      "@theia/preferences",
      "@opentart/video-editor"
    ]
    ```
  - **原则**：Theia 应用壳通过 `theiaExtensions` 数组挂载所有需要的扩展（官方 + 自定义）。

- **应用脚本（开发 / 构建）**
  ```json
  "scripts": {
    "start": "theia start --port 3000",
    "dev": "theia start --port 3000 --host 0.0.0.0",
    "build": "theia build --mode production",
    "build:dev": "theia build --mode development"
  }
  ```

- **常用命令**
  - 开发模式启动（本地调试）：
    ```bash
    cd examples/opentart-app-browser
    yarn dev
    ```
  - 生产构建：
    ```bash
    yarn build      # production 模式
    ```
  - 开发构建：
    ```bash
    yarn build:dev  # development 模式
    ```

---

### 6. 推荐日常开发流程（总结）

1. **首次拉仓库 / 切分支后**：
   ```bash
   yarn bootstrap   # 安装依赖 + 建立 workspaces 链接
   ```

2. **开发扩展（如视频编辑器）**：
   - 在 `packages/video-editor` 中改动 `src/**`
   - 构建：
     ```bash
     yarn build           # 当前包
     # 或在根目录统一：
     yarn build
     ```

3. **运行示例应用验证**：
   ```bash
   yarn start:browser     # 根目录，启动 @opentart/app-browser
   # 或进入 examples/opentart-app-browser 后：
   yarn dev
   ```

4. **清理构建产物**：
   ```bash
   yarn clean             # 删除所有 lib 输出
   ```

如后续引入更多 packages / apps，建议沿用相同模式（`src` → `lib`、`build` + `clean`、通过 workspaces + lerna 统一管理）。任何对开发范式的更新，也建议在本文件中同步维护。

