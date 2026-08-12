# 设计：User Analytics 区新增「按人 / 按分组」Token 用量统计

日期：2026-08-12
分支：feat/my-custom

## 目标

在管理后台 Dashboard 的 **User Analytics（用户分析）** 区（admin-only）新增统计功能：按「人」（用户名）和按「用户分组」（`use_group`）统计 token 用量，以排行榜表格形式展示。

## 现状与背景

- 后端已有 `quota_data` 小时级预聚合表（字段含 `user_id`、`username`、`use_group`、`token_used`、`quota`、`count`），由 `model/usedata.go` 的 `LogQuotaData` 在消费日志产生时写入内存缓存，`SaveQuotaDataCache` 定期落库。
- 该表仅在系统设置「数据看板」（`common.DataExportEnabled`）开启时才有数据（`model/log.go` 中 `LogQuotaData` 的调用受此开关控制）。
- 现有接口：`/api/data/`（按模型）、`/api/data/users`（按人，按小时序列）、`/api/data/self`、`/api/data/flow`、`/api/data/flow/self`。
- 前端 Dashboard「用户分析」区已有 `UserCharts`（用户消费排行 / 趋势图表，基于 `/api/data/users`），使用时间预设筛选（`userChartsFilters.selectedRange`）。
- **缺口**：没有按用户分组的聚合；没有每人 / 每组的汇总统计表。

## 方案

复用 `quota_data` 聚合表，新增两个按维度汇总的接口与两张排行榜表格。与现有用户分析图表同源同口径（均为 quota_data），性能好、改动最小。

## 后端改动

### model/usedata.go

新增结构体：

```go
// QuotaDataSummary 按人 / 按分组的用量汇总统计
type QuotaDataSummary struct {
    Username  string `json:"username"`
    UseGroup  string `json:"use_group"`
    TokenUsed int    `json:"token_used"`
    Quota     int    `json:"quota"`
    Count     int    `json:"count"`
    UserCount int    `json:"user_count"` // 仅按分组统计时返回
}
```

新增查询函数（全部使用 GORM 方法，SQLite/MySQL/PostgreSQL 通用）：

```go
// GetQuotaDataSummaryByUser 按用户名汇总 token/quota/请求数，按 token_used 降序
func GetQuotaDataSummaryByUser(startTime int64, endTime int64) ([]*QuotaDataSummary, error)

// GetQuotaDataSummaryByGroup 按 use_group 汇总，另统计 distinct user 数，按 token_used 降序
func GetQuotaDataSummaryByGroup(startTime int64, endTime int64) ([]*QuotaDataSummary, error)
```

- 按人：`DB.Table("quota_data").Select("username, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used").Where("created_at >= ? and created_at <= ?", ...).Group("username").Order("token_used desc")`
- 按分组：同上，select 加 `count(distinct user_id) as user_count`，按 `use_group` 分组
- 时间范围沿用现有模式：`startTime`/`endTime` 为 unix 秒，0 表示不限（由调用方保证非负）
- `count(distinct user_id)` 在三种数据库均支持

### controller/usedata.go

新增两个 handler，与现有 `/api/data` 端点一致的 lenient 参数解析（`strconv.ParseInt`，失败默认 0）：

- `GetQuotaDataSummaryByUser(c *gin.Context)` → 响应 `data: []*QuotaDataSummary`
- `GetQuotaDataSummaryByGroup(c *gin.Context)` → 响应 `data: []*QuotaDataSummary`

错误时 `common.ApiError(c, err)`，与现有 handler 一致。

### router/api-router.go

在 `dataRoute` 组内新增（均 `middleware.AdminAuth()`）：

```go
dataRoute.GET("/users/summary", middleware.AdminAuth(), controller.GetQuotaDataSummaryByUser)
dataRoute.GET("/groups", middleware.AdminAuth(), controller.GetQuotaDataSummaryByGroup)
```

## 前端改动

### web/src/features/dashboard/api.ts

新增两个查询函数，复用现有 `getUserQuotaDataByUsers` 的参数模式（`{ start_timestamp, end_timestamp }`）：

- `getUserQuotaSummary(params)` → `GET /api/data/users/summary`
- `getGroupQuotaSummary(params)` → `GET /api/data/groups`

### 新组件

`web/src/features/dashboard/components/users/` 下新增：

- `user-summary-table.tsx` — 按人排行表格：用户名、Token 用量、Quota、请求数
- `group-summary-table.tsx` — 按分组排行表格：分组名、Token 用量、Quota、请求数、用户数

两张表格共用列配置与渲染逻辑，卡片可滚动，**默认展示 Top 100**；空数据显示空态提示。样式复用现有 `IconBadge`、`Skeleton` 等 UI 组件与卡片风格（参考 `user-charts.tsx`）。

### 接入 dashboard/index.tsx

在 users section 的 `UserCharts` 下方渲染两张统计卡片，**复用 `userChartsFilters.selectedRange`** 派生时间范围，与图表切换时间预设保持同步。

### i18n

`web/src/i18n/locales/en.json` 新增英文源 key（如 `User Token Usage Ranking`、`Group Token Usage Ranking`、`Token Used`、`Requests`、`Users` 等），然后运行 `bun run i18n:sync` 同步其他语言。

## 测试

### 后端：model/usedata_test.go

- 复用现有 `DB` / `truncateTables` 测试基建（sqlite 内存库）
- 插入多条不同用户、不同分组、不同小时的 `quota_data` 记录
- 精确断言：
  - `GetQuotaDataSummaryByUser`：每用户的 `token_used`/`quota`/`count` 合计正确、按 token_used 降序
  - `GetQuotaDataSummaryByGroup`：每组的合计正确、`user_count`（distinct）正确、按 token_used 降序
  - 空表返回空数组
- 使用 `require`（setup/致命错误）与 `assert`（值断言）

### 前端

按 `web/AGENTS.md` 约定，在 `web/src/features/dashboard/components/users/__tests__/` 下新增 Vitest 测试（如 `summary-tables.test.tsx`）：
- 表格按 token_used 降序渲染
- 空数据显示空态

## 口径与注意事项

- 数据源为 `quota_data` 预聚合表，仅当「数据看板」（`DataExportEnabled`）开启时有数据；与现有 User Analytics 图表同源，数字口径一致
- 空数据返回空数组，前端显示空态
- 该区块本就 admin-only，无需额外权限改动
- 不做分页；前端取 Top 100 展示，超出部分在卡片内滚动
