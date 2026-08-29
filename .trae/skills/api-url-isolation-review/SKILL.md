---
name: "api-url-isolation-review"
description: "审查后端接口设计，重点检查不同消费方是否通过 URL 路径进行隔离。当用户要求对后端接口进行 code review、新增或修改 API 端点、或需要审查多消费方场景下的接口隔离策略时调用。"
---

# API URL Isolation Review

## 核心原则

**不同消费方（Consumer）必须通过独立的 URL 路径前缀进行接口隔离，禁止多个消费方共享同一套无区分的 API 路径。**

### 什么是"消费方"

消费方指调用后端 API 的独立客户端实体，典型包括：

| 消费方类型 | 说明 |
|-----------|------|
| `web` | Web 前端应用（浏览器端） |
| `mobile` | 移动端 App（iOS / Android） |
| `cli` | 命令行工具 |
| `admin` | 后台管理系统 |
| `internal` | 内部其他服务调用（Service-to-Service） |
| `partner` | 外部合作伙伴 / 第三方开放平台 |
| `public` | 公开匿名访问接口 |

---

## 触发场景

在以下情况 **必须** 调用本 skill 进行审查：

1. 新增后端 API Controller 或 `@RequestMapping` 路径
2. 修改现有 API 的 URL 映射结构
3. 项目引入新的消费方类型（如从仅 Web 扩展到同时支持 Mobile）
4. 出现同一资源被多个消费方以不同方式调用的情况
5. 用户明确要求进行接口设计 code review

---

## 审查检查清单

### 1. URL 路径隔离（Critical）

**检查规则：** 每个消费方必须拥有独立的 URL 路径前缀。

**合规模式：**
```
/api/web/todos        # Web 端专用
/api/mobile/todos     # Mobile 端专用
/api/cli/todos        # CLI 专用
/api/admin/todos      # 管理后台专用
/api/internal/todos   # 内部服务调用专用
```

**违规模式（必须禁止）：**
```
/api/todos            # ❌ 所有消费方共用，无隔离
/api/v1/todos         # ❌ 只有版本隔离，无消费方隔离
```

**证据定位方法：**
- 扫描所有 `@RestController` 类的 `@RequestMapping` 注解
- 检查 Controller 类命名是否按消费方区分（如 `WebTodoController` vs `AdminTodoController`）
- Grep 搜索 `@RequestMapping`、`@GetMapping`、`@PostMapping` 等注解的路径参数

**检查步骤：**
1. 使用 Grep 搜索所有 `@RequestMapping` 注解
2. 列出所有一级路径前缀
3. 确认每个前缀是否对应明确的消费方标识
4. 标记任何未带消费方前缀的 `/api/**` 路径

---

### 2. Controller 分层隔离（Important）

**检查规则：** 不同消费方的接口必须使用独立的 Controller 类，禁止在同一个 Controller 中混合服务多个消费方。

**合规模式：**
```java
// Web 端专用 Controller
@RestController
@RequestMapping("/api/web/todos")
public class WebTodoController { ... }

// 管理后台专用 Controller
@RestController
@RequestMapping("/api/admin/todos")
public class AdminTodoController { ... }
```

**违规模式：**
```java
// ❌ 同一个 Controller 服务多个消费方，通过参数区分
@RestController
@RequestMapping("/api/todos")
public class TodoController {
    @GetMapping(params = "consumer=web")
    public List<Todo> listForWeb() { ... }

    @GetMapping(params = "consumer=admin")
    public List<Todo> listForAdmin() { ... }
}
```

**证据定位方法：**
- 检查 Controller 的 package 结构是否按消费方分包（如 `controller.web`、`controller.admin`）
- 检查 Controller 类名是否包含消费方标识前缀
- 统计单个 Controller 中的 `@RequestMapping` 是否混合了多种消费方语义

---

### 3. DTO / 响应模型隔离（Important）

**检查规则：** 不同消费方的 Request DTO 和 Response DTO 必须独立定义，禁止跨消费方共用数据模型。

**合规模式：**
```java
// dto.web 包 - Web 端专用
package com.example.dto.web;
public record WebTodoResponse(Long id, String title, WebUIExtra uiExtra) { }

// dto.admin 包 - 管理后台专用
package com.example.dto.admin;
public record AdminTodoResponse(Long id, String title, AuditLog auditLog, String createdBy) { }
```

**违规模式：**
```java
// ❌ 共用同一个 Response，通过可选字段"兼容"多消费方
public record TodoResponse(
    Long id,
    String title,
    WebUIExtra uiExtra,        // 只有 Web 端用
    AuditLog auditLog,         // 只有 Admin 端用
    String internalDebugInfo   // 只有 Internal 用
) { }
```

**证据定位方法：**
- 检查 `dto/` 目录下的 package 结构
- 追踪 Controller 方法的返回类型和 `@RequestBody` 参数类型
- 检查 DTO 中是否存在大量只在特定场景使用的可选字段

---

### 4. Service 层隔离边界（Minor）

**检查规则：** Controller 层按消费方隔离后，Service 层可以共享核心业务逻辑，但必须通过独立的 Facade Service 或方法重载来适配不同消费方的需求。

**合规模式：**
```java
// 核心业务 Service - 可被各消费方共用
@Service
public class TodoCoreService {
    public Todo create(Todo entity) { ... }
    public List<Todo> listAll() { ... }
}

// Web 端 Facade Service
@Service
public class WebTodoService {
    private final TodoCoreService coreService;
    public WebTodoResponse create(WebCreateTodoRequest req) {
        // Web 端特有校验、字段映射、响应组装
    }
}
```

**检查要点：**
- 各消费方特有的校验逻辑不应污染核心 Service
- 不同消费方的权限检查应在各自的 Facade 层完成
- 核心 Service 的方法签名不应包含消费方特定参数

---

### 5. 鉴权策略隔离（Critical）

**检查规则：** 不同消费方的鉴权机制（Authentication）和权限控制（Authorization）必须在路径层面即可区分，便于在 Gateway / Filter 层统一配置。

**合规模式 URL + 鉴权矩阵：**
| 路径前缀 | 鉴权方式 | 权限要求 |
|---------|---------|---------|
| `/api/web/**` | Session Cookie / OAuth2 | 登录用户 + 资源归属校验 |
| `/api/mobile/**` | JWT Token | App 用户 + 设备绑定校验 |
| `/api/admin/**` | SSO + 2FA | 管理员角色 |
| `/api/internal/**` | mTLS / Service Account | IP 白名单 + 服务签名 |
| `/api/public/**` | 无鉴权 / API Key | 限流 + 匿名访问策略 |

**检查要点：**
1. `WebConfig` 或 Security Config 中是否有针对路径前缀的独立鉴权规则
2. 禁止在 Controller 方法内部通过 `if (consumer == X)` 分支判断鉴权逻辑
3. CORS 配置是否按消费方路径前缀区分（Web 需要、Internal 不需要）

**证据定位方法：**
- 读取 `SecurityFilterChain` 或自定义 Filter 的配置
- 检查 `WebConfig.java` 中 CORS 的映射路径
- 搜索 `@PreAuthorize`、`@Secured` 注解的使用位置

---

### 6. 版本控制与隔离协同（Minor）

**检查规则：** 版本号（`v1`、`v2`）应位于消费方标识之后，格式为：`/api/{consumer}/v{version}/**`

**合规模式：**
```
/api/web/v1/todos
/api/web/v2/todos        # Web 端单独升级，不影响其他消费方
/api/mobile/v1/todos
```

**违规模式：**
```
/api/v1/web/todos        # ❌ 版本在前，消费方在后，跨消费方统一切版有风险
```

---

### 7. 文档与契约隔离（Minor）

**检查规则：** OpenAPI / Swagger 文档是否按消费方分组输出，而非生成一个包含所有消费方接口的巨大文档。

**检查要点：**
- SpringDoc / Swagger 的 `GroupedOpenApi` 是否按消费方分组
- 各分组的 packagesToScan 是否只包含对应消费方的 Controller
- 是否有独立的 API 契约文档（如 `api-contract-web.md`、`api-contract-admin.md`）

---

## 常见违规场景及判定

### 场景 A："现在只有 Web 一个消费方，先不分，以后再加"

**判定：Critical（必须修复）**

**理由：**
- 接口 URL 是公开契约，一旦对外发布后改动成本极高
- 消费方隔离是架构级决策，不应通过后期重构路径引入 Breaking Change
- 当前项目根目录 `AGENTS.md` 已明确 Web、CLI 两个消费方，即使 CLI 未完全对接也应提前预留路径

**修复方案：**
即使目前只有一个活跃消费方，也必须带上其标识前缀：
```
/api/todos     →     /api/web/todos
```

### 场景 B：通过请求参数或 Header 区分消费方

**判定：Critical（必须修复）**

**违规示例：**
```
GET /api/todos?consumer=admin
GET /api/todos  X-Consumer-Type: mobile
```

**理由：**
- Gateway 层无法基于 URL 做路由、限流、鉴权等策略
- 日志和监控无法按消费方快速聚合
- 违反"可验证的硬约束"原则——消费方归属在 URL 中不可见

### 场景 C：部分接口隔离，部分"通用接口"不隔离

**判定：Important（应修复）**

**违规示例：**
```
GET  /api/web/todos      # ✅ 已隔离
POST /api/todos          # ❌ 创建接口未隔离
```

**理由：**
- 同一资源的 CRUD 操作必须保持隔离策略一致
- "通用接口"往往成为后续快速堆砌消费方特定逻辑的垃圾场

### 场景 D：DTO 共用但"字段不多，先这样"

**判定：Important（应修复）**

**理由：**
- 字段数量随需求迭代只会增长，不会减少
- 消费方不该看到不属于自己的字段（信息泄露风险）
- 序列化 / 反序列化性能与无关字段正相关

---

## 审查执行流程

### Step 1：收集接口全貌

对 `services/api/src/main/java` 执行以下扫描：

```bash
# 1. 列出所有 Controller 文件
find services/api/src/main/java -name "*Controller.java"

# 2. 提取所有 @RequestMapping 路径
grep -rn "@RequestMapping\|@GetMapping\|@PostMapping\|@PutMapping\|@DeleteMapping\|@PatchMapping" \
  services/api/src/main/java/com/bytedance/todos/controller/
```

### Step 2：建立 URL - 消费方映射表

将扫描到的所有端点填入下表，标记合规状态：

| 完整 URL 路径 | HTTP 方法 | Controller 类 | 归属消费方 | 消费方标识在路径中 | 合规判定 |
|--------------|----------|--------------|-----------|------------------|---------|
| `/api/todos` | GET | TodoController | Web | ❌ | 违规 |

### Step 3：深度代码检查

对每个违规的 Controller 和相关 DTO 进行源码级细读：

1. **读取 Controller 类**：检查方法内部是否有消费方分支逻辑
2. **读取 DTO 类**：检查字段是否被所有消费方实际使用
3. **读取 Service 类**：检查是否有消费方特定参数混入核心逻辑
4. **读取 Config 类**：检查 Security / CORS 配置是否按路径前缀区分

### Step 4：生成审查报告

按"代码引用 + 问题描述 + 影响 + 修复建议"的格式输出，每个问题必须包含具体的文件行号链接。

---

## 审查报告输出格式

```markdown
### API URL 隔离审查报告

**审查范围：** services/api 模块
**审查时间：** YYYY-MM-DD

---

#### 合规性总览

| 检查项 | 通过数 / 总数 | 合规率 |
|-------|--------------|-------|
| 1. URL 路径隔离 | X / Y | Z% |
| 2. Controller 分层隔离 | X / Y | Z% |
| 3. DTO 隔离 | X / Y | Z% |
| 4. 鉴权策略隔离 | X / Y | Z% |

---

### Critical 问题（必须修复）

#### 1. 所有接口未带消费方路径前缀
- **文件：** [TodoController.java](file:///Users/bytedance/workspace/bytedance/todos-training/services/api/src/main/java/com/bytedance/todos/controller/TodoController.java#L22-L22)
- **问题：** `@RequestMapping("/api/todos")` 缺少消费方标识（如 `/web/`、`/cli/`）
- **影响：**
  - 当前项目存在 Web 和 CLI 两个消费方，共用路径无法分别做鉴权和限流
  - 未来新增 Mobile 或 Admin 消费方时将产生 Breaking Change
- **修复建议：**
  - Web 端接口迁移至 `/api/web/todos`
  - CLI 端接口迁移至 `/api/cli/todos`
  - 同步更新 `WebConfig.java` 中 CORS 映射路径

---

### Important 问题（应修复）

#### 1. DTO 未按消费方拆分
- **文件：** [CreateTodoRequest.java](file:///...)
- **问题：** Web 和 CLI 共用同一个 Create Request DTO
- **影响：** CLI 后续需要 `--json` 批量导入字段时，会污染 Web 端 DTO
- **修复建议：**
  - 创建 `dto.web.WebCreateTodoRequest`
  - 创建 `dto.cli.CliCreateTodoRequest`
  - 各自保留消费方实际需要的字段子集

---

### Minor 建议（Nice to Have）

#### 1. Controller package 建议按消费方分包
- **现状：** 所有 Controller 都在 `controller/` 平铺
- **建议：** 调整为 `controller.web.WebTodoController`、`controller.cli.CliTodoController`
- **收益：** 新成员一眼识别文件归属，避免 package 膨胀

---

### 最终判定

**结论：** ❌ 暂不通过 / ⚠️ 有条件通过 / ✅ 通过

**遗留项清单：**
- [ ] 修复 Critical #1
- [ ] 修复 Important #1
```

---

## 当前项目基线对照

基于当前 `services/api` 实际代码，以下是已知的基线状态，审查时需以此为起点判断回归或改进：

### 当前 Controller 清单

| Controller | 路径前缀 | 消费方隔离 | 状态 |
|-----------|---------|-----------|------|
| [TodoController.java](file:///Users/bytedance/workspace/bytedance/todos-training/services/api/src/main/java/com/bytedance/todos/controller/TodoController.java#L22-L56) | `/api/todos` | ❌ 未隔离 | 待整改 |

### 当前消费方清单

| 消费方 | 实际存在 | 独立 URL 前缀 | 独立 Controller | 独立 DTO |
|-------|---------|--------------|----------------|---------|
| Web (`apps/web`) | ✅ | ❌ | ❌ | ❌ |
| CLI (`apps/cli`) | ✅ | ❌ | ❌ | ❌ |
| Admin | ❌ | N/A | N/A | N/A |
| Internal | ❌ | N/A | N/A | N/A |

---

## 检查项速查表（自动化 grep 命令）

审查时可直接运行以下命令收集证据：

```bash
# 1. 检查所有 URL 路径前缀（找出不带消费方标识的 /api/*）
grep -rn "RequestMapping\|GetMapping\|PostMapping\|PutMapping\|DeleteMapping\|PatchMapping" \
  services/api/src/main/java/*/controller/ \
  | grep -oE '"/api[^"]*"' \
  | sort -u

# 2. 检查 Controller 类名是否包含消费方标识
find services/api/src/main/java -name "*Controller.java" -exec basename {} \; | sort

# 3. 检查 DTO package 结构
find services/api/src/main/java/*/dto -type f -name "*.java" | awk -F'dto/' '{print $2}' | cut -d'/' -f1 | sort -u

# 4. 检查 Security / CORS 配置中的路径映射
grep -n "antMatchers\|requestMatchers\|addCorsMappings\|addMapping" \
  services/api/src/main/java/*/config/*.java
```
