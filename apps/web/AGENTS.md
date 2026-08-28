# apps/web Agents 指南

本文件记录只对 `apps/web` 模块成立的约定，供在本模块内改代码的 coding agents
使用。跨模块的仓库结构、产品契约、领域模型、API 契约、验证矩阵和全局实现规则
见根目录 `AGENTS.md`。

## 文档索引

本模块 `docs/` 下的专题文档，按任务类型先读：

- `docs/architecture.md`：模块内部分层约定——pages → hooks → services 的
  依赖流、归一化防御的位置、API 类型镜像边界。新增页面/hook/service、调整
  数据获取或状态编排前先读。
- `docs/ui-rules.md`：UI 视觉约定——Semi 组件取舍原则、圆角与间距档位、
  颜色取值边界、界面文案归置。新增界面元素、编写样式或组件、添加 UI 文案
  前先读。
- `docs/testing.md`：测试策略——当前真实存在的验证门禁及其拦截边界。改动后
  判断该跑哪些 checks、或考虑引入测试框架前先读。

## 模块说明

`apps/web` 是基于浏览器的 Todo Kanban UI，通过 HTTP 调用 `services/api`。

技术：

- React
- Vite
- TypeScript
- Semi Design
- pnpm

允许：

- 通过 HTTP 调用 `services/api`。
- 拥有 browser UI state、rendering 和 user interactions。
- 在镜像 API response shapes 时，拥有 web-specific TypeScript types。
- 使用本地 i18n constants 管理 UI copy。

不允许：

- 从 `apps/cli` import code。
- 直接读写 database。
- 在没有明确 architecture change 的情况下引入 shared package。

## 目录意图

源码在 `src/`：

- `pages/`: route-level page composition。
- `components/`: reusable presentational 或 page-local UI components。
- `hooks/`: React state/effect orchestration。
- `services/`: HTTP calls 和 backend integration。
- `types/`: web app 使用的 TypeScript domain/API types。
- `i18n/`: UI text constants。硬编码 user-facing text 前先在这里添加 copy。
- `index.css`: 只放 global document-level styles，例如 base font 和 page
  background。

## Styling 规则

- 使用 Semi Design components 作为 UI baseline。
- 相比 custom CSS，优先使用 Semi props 和 composition。
- 避免为了 one-off styling 创建 page-level component CSS files。
- 对小范围 layout constraints 和 visual tuning，可以使用 inline styles。
- 将宽泛的 global styles 保留在 `index.css`；不要用它大范围覆盖 component
  internals。
- 深色 header 区域必须使用浅色且可读的文字。
- 保持 board 视觉简单：只有 top navigation/header，没有 sidebar。

## 当前 Web 行为

- Header 显示品牌名 `Todos-Training` 和副标题 `Workshop Demo`；浏览器标签页
  标题由 `index.html` 定义。
- 除 brand/title strings 外，UI copy 使用中文。
- board 精确显示三个固定 columns：
  - `TODO` -> `待处理`
  - `DOING` -> `进行中`
  - `DONE` -> `已完成`
- Cards 按 API 返回的 `status` 分组。
- add button 只出现在 `待处理` column。
- 创建和编辑 todo 使用同一个 Semi Modal；Modal 包含一个必填 title input，以及
  非必填的描述多行输入和优先级下拉选择，编辑模式下表单预填当前 todo 的值。
- title input 没有可见 label，使用 placeholder `标题`。
- 空 title 或仅包含空白字符的 title 必须 validation 失败。
- 描述为非必填；提交时 trim，空白描述按未填写处理。
- 优先级为非必填，取值 `低/中/高`（对应 `LOW/MEDIUM/HIGH`），可以不选或清空。
- 创建的 todos 通过 `POST /api/todos` 发送给 backend；backend 将新 todos 分配
  到 `TODO`。
- 编辑保存通过 `PUT /api/todos/{id}` 提交；删除通过 `DELETE /api/todos/{id}`
  提交。
- 卡片 hover 时显示编辑（铅笔）和删除图标；编辑在 Modal 中完成，删除前弹出
  Popconfirm 二次确认。
- Cards 展示 title；当 todo 填写了优先级或描述时，以普通文本样式补充展示，不引入
  颜色标签。
- 长描述在卡片内截断展示，并可查看完整内容。
- Board columns 在 viewport 内固定高度；长 columns 应在 column body 内滚动，
  不能造成 page-level scrolling。
- Header stats 显示 total count 和 per-status counts。
- Header status tag colors 应与 lane tag colors 保持视觉一致，同时在深色 header
  background 上保持可读。

## 本地命令

在 `apps/web` 目录下运行：

```bash
pnpm install
pnpm dev
pnpm build
pnpm preview
pnpm lint
```

web changes 的 focused check 是 `pnpm build`。

配置：

```bash
VITE_API_BASE_URL=http://localhost:18080
```

launcher 启动 API 时会把 `CORS_ALLOWED_ORIGIN` 设置为
`http://localhost:${WEB_PORT}`。手动启动 API 时，如果 Web port 不是 `15173`，
请显式设置它。

## 已知 build tradeoff

- Vite 可能警告 main chunk 大于 500 kB。
- 当前原因是 Semi component dependency graph，尤其是 Semi Form。
- 除非用户明确要求 bundle optimization，否则这对 demo baseline 是可接受的。
- 除非用户接受该 tradeoff，否则不要只是为了消除 warning 而添加 lazy loading 或
  manual chunk splitting。

## 实现规则

- 将 user-facing web copy 保持在 `src/i18n/zhCN.ts`。

## Code Review 规则

review 本模块变更时：

- 标记在 `src/i18n/zhCN.ts` 外硬编码的 UI copy。
- 标记用于 component-level styling 的大型 custom CSS files，除非有明确理由说明
  Semi 无法表达该 layout。
