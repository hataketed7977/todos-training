## 1. <!-- Affected Module Name --> — Test-First: RED Phase

- [ ] 1.1 在具体测试文件 `<!-- /absolute/path/to/test-file.ext -->` 中新增失败测试用例，覆盖目标行为的全部 scenario
- [ ] 1.2 运行 focused test 命令 `<!-- concrete focused command, e.g. cd services/api && ./gradlew test --tests "TodoControllerTest.updatesExistingTodo" --rerun-tasks -->`，确认上述测试全部为 RED（断言失败或测试未通过），记录失败的断言信息

<!-- 如果本模块本次变更确实不需要测试，显式写清原因：
  跳过原因：<例如：本模块本次仅修改 i18n 文案常量，不涉及逻辑分支，且文案正确性由人工 UI 验收覆盖，无法以自动化测试获得增量信心>
-->

## 2. <!-- Affected Module Name --> — Minimal Implementation: GREEN Phase

- [ ] 2.1 在具体实现文件 `<!-- /absolute/path/to/impl-file.ext -->` 中编写最小化实现代码，仅够让 1.1 的测试通过，不做额外优化
- [ ] 2.2 重跑 1.2 中的同一 focused test 命令，确认全部转 GREEN
- [ ] 2.3 运行模块级 regression 命令 `<!-- concrete module command, e.g. cd services/api && ./gradlew test -->`，确认未引入回归

## 3. <!-- Affected Module Name --> — Refactor Phase (Optional but Recommended)

- [ ] 3.1 在保持 2.2 focused test 全绿的前提下，对实现代码进行重构（命名、拆分、去重）
- [ ] 3.2 对测试代码本身进行重构（去重、提取 helper、改善断言可读性）
- [ ] 3.3 重跑 2.3 的模块级 regression 命令，确认仍全绿

## 4. <!-- Next Affected Module Name — Test-First: RED Phase -->

（按 1–3 的相同结构为下一个受影响模块重复 TDD 循环）

## N. 文档更新（与代码任务并列，不合并）

- [ ] N.1 更新具体文档 `<!-- /absolute/path/to/doc-file.ext -->` 的具体章节 `<!-- §X.X -->`，记录契约/约束变更
- [ ] N.2 运行 `git diff --check`，确认文档无空白/换行错误
