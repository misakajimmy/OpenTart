## OpenTart FFmpeg 设计与实现计划

本文描述 `@opentart/ffmpeg` 的整体设计思路，并给出按阶段实现的功能清单（带方框的 TODO 列表）。后续每完成一项功能，在此打勾即可。

---

### 一、目标与定位

- **统一抽象层**：为 OpenTart 提供一个与 FFmpeg 版本无关的统一接口，屏蔽 `ffmpeg` / `ffprobe` 的命令行细节与 6 / 7 版本差异。
- **职责边界清晰**：
  - `ffmpeg`：负责实际的媒体处理（转码、渲染、截图等）。
  - `ffprobe`：负责只读的媒体探测（元信息、流信息）。
- **服务其它包**：
  - `@opentart/filesystem`：用来获取媒体元信息、判断媒体特性。
  - 未来的「渲染/导出服务」：用来把时间线编译成 FFmpeg filter graph 并导出成最终视频。

---

### 二、包结构与接口设计

包：`@opentart/ffmpeg`（`packages/ffmpeg`）

- **结构**：
  - `src/common/opentart-ffmpeg-protocol.ts`：公共协议与类型定义。
  - `src/node/opentart-ffmpeg-node-service.ts`：Node 端实现，与 `ffmpeg/ffprobe` 进程交互。
  - `src/node/opentart-ffmpeg-node-module.ts`：Theia 扩展入口，将服务绑定到 DI 容器。

- **核心公共接口（示意）**：

```ts
export interface FfprobeStreamInfo {
  index: number
  codecType: 'video' | 'audio' | 'subtitle' | 'data' | 'attachment' | 'unknown'
  codecName?: string
  width?: number
  height?: number
  fps?: number
}

export interface FfprobeFormatInfo {
  formatName?: string
  durationSeconds?: number
  bitrate?: number
}

export interface FfprobeMetadata {
  uri: string
  format: FfprobeFormatInfo
  streams: FfprobeStreamInfo[]
}

export interface FfmpegVersionInfo {
  raw: string
  major: number
  minor: number
  patch: number
}

export interface OpenTartFfmpeg {
  getVersion(): Promise<FfmpegVersionInfo>
  probe(uri: string): Promise<FfprobeMetadata>
  screenshot(options: ScreenshotOptions): Promise<ScreenshotResult>
  // 未来扩展：
  // render(options: RenderOptions): Promise<RenderResult>
}

export const OpenTartFfmpeg = Symbol('OpenTartFfmpeg')
```

---

### 三、ffmpeg/ffprobe 路径与版本管理

#### 3.1 路径解析策略

统一通过一个「路径解析器」确定 `ffmpeg` / `ffprobe` 的可执行路径，优先级（从高到低）：

1. 显式配置（未来可来自配置文件 / Theia preferences / 环境变量）：
   - `FfmpegBinaryConfig.ffmpegPath`
   - `FfmpegBinaryConfig.ffprobePath`
2. 环境变量：
   - `OPENTART_FFMPEG_PATH`
   - `OPENTART_FFPROBE_PATH`
3. 系统 PATH 中的 `ffmpeg` / `ffprobe`（使用 `which` / `where` 等方式查找）。
4. （可选，未来）内置静态二进制，例如借助 `ffmpeg-static`。

解析结果将缓存为：

```ts
interface FfmpegResolvedPaths {
  ffmpeg: string
  ffprobe: string
}
```

所有后续调用都通过该结构获取路径，不直接写死 `ffmpeg` / `ffprobe` 字符串。

#### 3.2 版本检测与缓存

- 使用解析出的 `ffmpeg` 路径执行：
  - `<ffmpegPath> -version`
- 解析输出第一行中的版本号：

```text
ffmpeg version 7.0.1 ...
```

```ts
const m = output.match(/ffmpeg version\s+(\d+)\.(\d+)\.(\d+)/)
const [major, minor, patch] = m ? m.slice(1).map(Number) : [0, 0, 0]
```

- 在 `OpenTartFfmpegNodeService.getVersion()` 中：
  - 首次调用时执行检测并缓存结果。
  - 后续调用直接返回缓存，避免重复 spawn。
  - 在这里做最低版本检查，例如：
    - 如果 `major < 6`，则抛出「需要 FFmpeg ≥ 6」的错误，并附带 `raw` 输出，方便排查。

---

### 四、版本差异与策略模式（Strategy）

为了填平 FFmpeg 6 / 7 甚至未来版本的差异，在 `@opentart/ffmpeg` 内部使用策略模式：

```ts
interface FfmpegStrategy {
  supports(version: FfmpegVersionInfo): boolean
  probe(uri: string, paths: FfmpegResolvedPaths): Promise<FfprobeMetadata>
  // 未来：
  // render(...): Promise<...>
  // screenshot(...): Promise<...>
}
```

- 每个主版本系列可以有自己的策略实现：
  - `Ffmpeg6Strategy`：针对 6.x 的行为差异。
  - `Ffmpeg7Strategy`：针对 7.x 的行为差异。
  - `FfmpegFallbackStrategy`：用于低于 6 或未知版本，统一给出降级/错误信息。

- 在 `OpenTartFfmpegNodeService` 内：
  - 基于 `getVersion()` 得到版本信息。
  - 在 `[v7, v6, fallback]` 列表中选出第一个 `supports(version) === true` 的策略。
  - 将 `probe`/`render` 等高层函数委托给该策略。

> 当未来 FFmpeg 8 出现时，只需新增 `Ffmpeg8Strategy` 并加入列表即可，不需要改上层业务代码。

---

### 五、ffmpeg 与 ffprobe 的功能区分

在 `OpenTartFfmpeg` 内部明确区分：

- **ffprobe（只读探测）**：
  - 用于实现 `probe(uri)` 以及未来的 `getCapabilities()` 等。
  - 命令形式类似：
    - `<ffprobePath> -v quiet -print_format json -show_format -show_streams <uri>`
  - 返回 JSON，再转换为统一的 `FfprobeMetadata`。

- **ffmpeg（实际处理）**：
  - 用于未来实现：
    - 导出 / 渲染时间线。
    - 生成截图/缩略图。
    - 格式转换 / 预处理。
  - 内部只暴露函数式 API（如 `render(options)`），不让业务层直接拼命令字符串。

---

### 六、阶段性实现计划（带方框 TODO 列表）

> 说明：  
> - `[ ]` 表示 **尚未实现**。  
> - `[x]` 表示 **已实现**。  
> 当前所有项都按「TODO」状态记录，等真正完成后可以在此文件中手动打勾。

#### 6.1 基础架构与协议

- [x] 在 `packages/ffmpeg` 中完善 `package.json` / `tsconfig` 配置，并确保能独立 `yarn build`。
- [x] 定义公共协议接口：
  - [x] `FfmpegVersionInfo`
  - [x] `FfprobeMetadata` / `FfprobeFormatInfo` / `FfprobeStreamInfo`
  - [x] `OpenTartFfmpeg` 与 token `OpenTartFfmpeg`。

#### 6.2 路径解析与版本检测

- [x] 实现 `resolveFfmpegPaths(config?: FfmpegBinaryConfig): Promise<FfmpegResolvedPaths>`（当前为内部 `resolvePaths` 实现）：
  - [ ] 支持从配置结构解析路径。
  - [x] 支持从环境变量 `OPENTART_FFMPEG_PATH` / `OPENTART_FFPROBE_PATH` 解析路径。
  - [x] 支持从系统 PATH 中查找 `ffmpeg` / `ffprobe`（通过命令名依赖 PATH，后续可加入显式查找逻辑）。
- [x] 在 `OpenTartFfmpegNodeService.getVersion()` 中：
  - [x] 调用解析后的 `ffmpegPath` 运行 `-version`。
  - [x] 解析出 `FfmpegVersionInfo` 并缓存。
  - [x] 对 `major < 6` 的版本给出清晰错误（并在错误消息中附带 `raw` 字符串）。

#### 6.3 Version Strategy（填平 6 / 7 等差异）

- [ ] 定义 `FfmpegStrategy` 接口：
  - [ ] `supports(version: FfmpegVersionInfo): boolean`
  - [ ] `probe(uri: string, paths: FfmpegResolvedPaths): Promise<FfprobeMetadata>`
- [ ] 实现基础策略：
  - [ ] `Ffmpeg6Strategy`：按 6.x 的行为解析 ffprobe 输出。
  - [ ] `Ffmpeg7Strategy`：按 7.x 的行为解析 ffprobe 输出。
  - [ ] `FfmpegFallbackStrategy`：用于不满足要求的版本（给出统一降级/错误信息）。
- [ ] 在 `OpenTartFfmpegNodeService` 中接入策略选择逻辑，并对外暴露统一的 `probe`。

#### 6.4 probe 功能（ffprobe 封装）

- [x] 使用 `ffprobe` 实现真实的 `probe(uri: string): Promise<FfprobeMetadata>`：
  - [x] 调用 `ffprobe -v quiet -print_format json -show_format -show_streams`。
  - [x] 解析 JSON 为统一的 `FfprobeMetadata`。
  - [ ] 在不同策略中处理版本字段差异（如某些字段命名不一致的情况）。

#### 6.5 对上游包的集成（未来阶段）

- [ ] 在 `@opentart/filesystem` 的 node 端依赖 `OpenTartFfmpeg`：
  - [ ] 使用 `probe` 结果构造 `MediaMetadata`。
  - [ ] 提供给前端（Media Browser / Navigator）使用。
- [ ] 设计基础的 `render(options)` / `screenshot(options)` 接口：
  - [x] 定义 `screenshot(options)` 接口并提供 Node 端基础实现（单帧截图）。
  - [ ] 明确只用 `ffmpeg` 负责「改文件 / 生成资源」操作。
  - [ ] 将时间线 / 操作描述转换为命令行参数，并在策略内部处理版本差异。

---

### 七、后续扩展方向（非必做，但建议）

- 更细粒度的能力探测 API，如：
  - `getCapabilities(): Promise<{ hasFilter(name: string): boolean; canEncode(codec: string): boolean; ... }>`
- 集成硬件加速（NVENC / VAAPI / QSV 等）的能力检测与参数封装。
- 为错误和日志定义统一结构，方便在 OpenTart 中展示「渲染进度 / 错误详情」。

