# apps/web UI 视觉约定

本文只记录从样式数值和组件用法上看不出意图的视觉约定：Semi 组件库的取舍
原则、圆角与间距的档位规则、颜色取值边界、界面文案的归置位置。每条约定
给出理由和现有代码中的印证位置（路径相对 `apps/web` 模块根目录）。目录
意图、styling 总规则与本地命令见 `apps/web/AGENTS.md`，内部分层见
`apps/web/docs/architecture.md`，交互行为属于需求文档范围，本文不写。

## 1. Semi 组件库的取舍原则

**能用 Semi 现成能力表达的，不用自己写样式或自己造控件。** 现有所有交互
控件和结构组件都来自 Semi（Card、Button、Tag、Empty、Space、Skeleton、
Modal、Form、Popconfirm、Tooltip、Typography、Layout、Grid、Toast，见各
组件文件顶部的 `@douyinfe/semi-ui/lib/es/...` import）。

具体边界：

- **状态、反馈、行为类外观一律用 Semi props，不手写**：卡片悬浮阴影用
  `shadows="hover"`（`src/components/TodoCard.tsx:30`）而不是自定义阴影；
  语义文字颜色用 Typography 的 `type`（`type="danger"`，
  `src/pages/TodosBoardPage.tsx:76`；`type="tertiary"`，
  `TodoCard.tsx:39,45`）；按钮语义用 `theme="solid" type="primary"`
  （`src/components/BoardColumn.tsx:51-52`）；长文本截断用 Paragraph 的
  `ellipsis={{ rows: 2, showTooltip: true }}`（`TodoCard.tsx:47`）；
  加载态用 Skeleton（`src/components/TodoBoard.tsx:45-50`）；删除二次确认
  用 Popconfirm（`TodoCard.tsx:76-79`），不手写对话框。
  理由：这些外观是组件交互状态的一部分，Semi 已经处理了 hover、禁用、
  动画和主题一致性；手写会产生第二套需要维护的状态样式。
- **自己写样式只用于 Semi props 表达不了的三类东西**：
  1. 布局几何——flex 结构、`height: '100%'` / `minHeight: 0` /
     `overflow` 这套滚动容器约束（如
     `src/components/TodoBoard.tsx:36-41`、
     `src/components/BoardColumn.tsx:57-63`）；
  2. 容器层级背景——看板凹槽面板与列的底色（见第 3 节）；
  3. 深色表面上的配色——Semi 标签配色为浅色内容区设计，深色 header 上
     半透明标签色只能自定义（见第 3 节）。
- **inline style 无法表达的伪类（如 hover），用 co-located 的 `<style>`
  块，不新建 CSS 文件。** 唯一的例子是卡片操作图标 hover 时才显现
  （`TodoCard.tsx:101-110` 的 `<style>`，作用域用
  `todo-card-wrapper` 等类名限定在本组件内）。理由：hover 态必须依赖
  CSS 伪类，但为单个组件新建 CSS 文件会破坏“样式随组件走”的结构；
  co-located `<style>` 把范围限制在组件自己的 className 内。
- **全局 CSS 只放文档级样式。** `src/index.css` 全文只有字体声明、
  body 底色和 `#root` 高度（`src/index.css:1-17`），不承载任何组件内部
  样式。

## 2. 圆角档位：随容器嵌套向内递减

现有圆角只有两档，与容器层级严格对应：

| 档位 | 用在哪 | 印证 |
| --- | --- | --- |
| 12 | 看板最外面的板容器 | `src/components/TodoBoard.tsx:33` |
| 8 | 板内的一切表面：列卡片、空状态占位块、todo 卡片 | `src/components/BoardColumn.tsx:35,69`、`src/components/TodoCard.tsx:31` |

规则：新增元素时，属于看板这个外层容器的表面用 12；放在板/列/卡片内部的
表面用 8。Modal 等 Semi 自带弹层不显式设圆角，沿用 Semi 默认值
（`src/components/CreateTodoModal.tsx:103-115` 没有 borderRadius）。
理由：圆角向内递减表达“容器包含内容”的层级，内外一致或内大外小都会打破
这种包裹感。不要引入 12 与 8 之外的第三个圆角值。

## 3. 间距档位：按嵌套深度选档

现有间距数值收敛为五档，档位与元素的嵌套层级一一对应：

| 档位 | 层级含义 | 印证 |
| --- | --- | --- |
| 32 | 页面边缘内边距（内容区到视口/到 header） | `src/pages/TodosBoardPage.tsx:63`（Content padding）、`src/components/AppHeader.tsx:49`（header 左右 padding） |
| 16 | 彼此独立的区块之间 | `src/components/TodoBoard.tsx:52`（列与列的 gutter）、`TodosBoardPage.tsx:73`（错误横幅与看板的 marginBottom） |
| 12 | 同一组内的兄弟元素间距，以及卡片/列体的内边距 | `src/components/BoardColumn.tsx:61,65`（列体 padding、卡片间距）、`src/components/TodoCard.tsx:32,35`（卡体内边距、卡内左右两栏 gap）、`src/components/CreateTodoModal.tsx:142,151`（表单字段纵向间距） |
| 8 | 紧贴在一起的相关控件簇 | `src/components/TodoCard.tsx:54`（编辑/删除两个图标的 gap） |
| 4 | 同一卡片内的文字行间距 | `src/components/TodoCard.tsx:39,48`（标题与优先级、描述之间的 marginTop） |

规则：新增元素先判断它处在哪个嵌套层级，再选对应档位——页面边缘 32、
独立区块之间 16、同组元素或组件体内边距 12、紧簇控件 8、文字行间 4。
理由：间距是表达“哪些元素属于一组”的主要视觉手段，固定档位让同类关系在
全界面读起来一致；自由取值会让分组关系失去信号。不要在这五档之外引入新
的间距数值。

## 4. 颜色取值：语义色走 Semi，自定义色只给容器层级和深色表面

- **浅色内容区里的语义颜色一律用 Semi props 或 Semi CSS 变量**：列标签
  用 Semi Tag 的 tone（`grey`/`blue`/`green`，
  `src/types/todoBoard.ts:7,11-13`，经 `Tag color={column.tone}` 渲染，
  `src/components/BoardColumn.tsx:44`）；危险色、次要文字色引用
  `var(--semi-color-danger)`、`var(--semi-color-danger-light-default)`、
  `var(--semi-color-text-2)`（`TodoCard.tsx:66,89`、
  `TodosBoardPage.tsx:71`）。理由：语义色随 Semi 主题切换，硬编码 hex
  会在主题变化时失效。
- **自定义颜色只出现在两种地方**：
  1. 容器三层背景——页面深底 `#111827`（`src/index.css:15`）、看板凹槽
     面板 `#d7deea`（`TodoBoard.tsx:31`）、浅色列面 `#f3f6fa`
     （`BoardColumn.tsx:34`）。这三层表达“深色页面上嵌一块凹进去的工作
     区、工作区里放浅色列”的空间关系，Semi 没有对应语义 token。
  2. 深色 header 上的标签色（`src/components/AppHeader.tsx:9-26`）：
     Semi 的标签配色在浅底上才可读，深底标签改用半透明白/半透明色相，
     但语义映射仍与列的 tone 对齐——grey/blue/green 三色与
     `todoBoardColumns` 的 tone 一一对应
     （`AppHeader.tsx:62-65`），另加一个紫色 total 标签。
  理由：header 统计标签与列标签表达的是同一组状态，颜色语义必须一致
  （`apps/web/AGENTS.md` 的视觉规则同样要求两者颜色保持一致），只是深底
  需要换一种呈现。
- 规则：新增语义色优先找 Semi props/token；确需自定义颜色时，先确认它
  属于“容器层级背景”还是“深色表面上的配色”，并与现有同语义元素保持映射，
  不要在浅色内容区里硬编码语义颜色。

## 5. 字号与图标尺寸

- **文字大小不写 `fontSize`，用 Typography 的字阶 props**：标题用
  `Title heading={4}`（`src/components/AppHeader.tsx:53`），辅助文字用
  `Text size="small"` / `Paragraph size="small"`（`TodoCard.tsx:39,46`）。
  全模块的文字样式中没有一处自定义 `fontSize`。理由：字阶交给 Semi 的
  排版体系，手写字号会脱离统一字阶。
- **操作图标统一 16px**（`TodoCard.tsx:65,88`，编辑与删除两个图标同一
  尺寸）。新增同类行内操作图标沿用此尺寸。

## 6. 界面文案的归置位置

- **所有运行时可见文案集中在 `src/i18n/zhCN.ts` 的单一 `as const` 对象
  里**，组件、页面、hook 只引用 `i18n.*`：按钮、标题、占位符、空状态、
  校验消息（`src/components/CreateTodoModal.tsx:131,133,139,148`）、
  Popconfirm 文案（`src/components/TodoCard.tsx:55,77`）、aria-label
  （`src/components/BoardColumn.tsx:48`、`CreateTodoModal.tsx:127,136,145`）、
  Toast 反馈（`src/hooks/useTodos.ts:27-28,72,75,88,91,125,128`）、列标签
  （`src/types/todoBoard.ts:11-13`）都来自该文件；品牌名与副标题也在其中
  （`zhCN.ts:2-3`，由 `src/components/AppHeader.tsx:54,56` 引用）。
- **带变量的文案用 `{占位符}` 模板，在调用点替换**：删除确认文案定义为
  `` `确定要删除「{title}」吗？此操作不可撤销。` ``（`zhCN.ts:24`），
  使用处做 `.replace('{title}', todo.title)`（`TodoCard.tsx:77`）。不要
  在组件里拼接中文片段。
- 理由：文案只有一个出处，改措辞、做语言切换时只需改一处；拼接或硬编码
  会让同一句话散落在多个组件里。`apps/web/AGENTS.md` 的 Code Review 规则
  明确要求标记 `zhCN.ts` 之外硬编码的 UI copy。
