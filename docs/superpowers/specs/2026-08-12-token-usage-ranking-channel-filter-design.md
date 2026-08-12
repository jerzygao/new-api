# 设计：User / Group Token Usage Ranking 增加按渠道分组统计能力

日期：2026-08-12
分支：feat/my-custom

## 目标

在管理后台 Dashboard 的 **User Analytics（用户分析）** 区（admin-only），为「User Token Usage Ranking」（按人排行）和「Group Token Usage Ranking」（按分组排行）两张卡片增加按渠道分组统计的能力：每张卡片各带一个渠道筛选下拉框，选中某渠道后，该排行只统计该渠道的用量。

## 现状与背景

- `quota_data` 小时级预聚合表已有 `channel_id` 字段（`model/usedata.go` 的 `QuotaData` 结构体），每次消费日志写入时携带渠道 ID。
- 现有排行接口：`GET /api/data/users/summary`（按 `username` 分组）、`GET /api/data/groups`（按 `use_group` 分组），均由 `GetQuotaDataSummaryByUser` / `GetQuotaDataSummaryByGroup` 实现，无渠道维度。
- 渠道名解析已有成熟模式：`model/usedata_flow.go:133-165` 收集去重 `channel_id` 后经 `CacheGetChannel` + DB 回退解析名称。
- 前端 `usage-summary-tables.tsx` 渲染两张排行卡片，`UserSummaryTable` / `GroupSummaryTable` 各自独立请求、共用 `SummaryTableCard` 渲染。
- 上游 main 分支无渠道排行接口，此为全新设计。
- **缺口**：排行无法按渠道拆分，无法回答「某个渠道上谁用量最高」「某分组在某渠道上的用量」这类问题。

## 方案（已与用户确认）

每张卡片各带一个渠道下拉框（推荐方案），选项来自**当前时间范围内实际有用量的渠道**（排除 `channel_id = 0` 的历史无渠道数据；无渠道行仍计入「全部渠道」总量）。API 采用方案 A：新增独立选项接口 + 两个排行接口加可选 `channel_id` 参数。

## 后端改动

### model/usedata.go

**签名变更**（可选过滤，`channelID <= 0` 表示不过滤，已有调用传 0 不受影响）：

```go
func GetQuotaDataSummaryByUser(startTime int64, endTime int64, channelID int) ([]*QuotaDataSummary, error)
func GetQuotaDataSummaryByGroup(startTime int64, endTime int64, channelID int) ([]*QuotaDataSummary, error)
```

- `channelID > 0` 时在 `Where` 上追加 `"channel_id = ?"`。
- 新增渠道汇总结构体与查询：

```go
// ChannelUsageSummary 按渠道汇总的用量统计
type ChannelUsageSummary struct {
    ChannelID   int    `json:"channel_id"`
    ChannelName string `json:"channel_name"` // 由调用方解析填充
    TokenUsed   int    `json:"token_used"`
    Quota       int    `json:"quota"`
    Count       int    `json:"count"`
}

func GetChannelUsageSummaries(startTime int64, endTime int64) ([]*ChannelUsageSummary, error)
```

- 查询：`Select("channel_id, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used").Where("created_at >= ? and created_at <= ?", ...).Where("channel_id > 0").Group("channel_id").Order("token_used desc")` — 排除 `channel_id = 0` 的历史无渠道行。
- 渠道名解析辅助：将 `usedata_flow.go:133-165` 的「`CacheGetChannel` + DB 回退」模式抽为 `model` 内共享函数（两个调用方：flow 数据 + 新渠道汇总），签名如 `func resolveChannelNames(channelIDs []int) map[int]string`，解析失败的渠道名回退为空（由 controller 填 `Channel {{id}}`）。

### controller/usedata.go

- `GetQuotaDataSummaryByUser` / `GetQuotaDataSummaryByGroup`：解析可选 `channel_id` query 参数（`strconv.ParseInt`，失败默认 0），透传给 model。
- 新增 `GetChannelUsageSummaries(c *gin.Context)`：解析时间范围 → 调 model → 对每个渠道解析名称，名称为空时回退 `Channel {{id}}` → 返回 `data: []*ChannelUsageSummary`。错误时 `common.ApiError(c, err)`。

### router/api-router.go

在 `dataRoute` 组内新增（`middleware.AdminAuth()`）：

```go
dataRoute.GET("/channels", middleware.AdminAuth(), controller.GetChannelUsageSummaries)
```

## 前端改动

### web/src/features/dashboard/api.ts

- `getUserQuotaSummary` / `getGroupQuotaSummary` 增加可选 `channel_id?: number` 参数。
- 新增 `getChannelUsageSummaries(params: { start_timestamp: number; end_timestamp: number })` → `GET /api/data/channels`，返回 `ChannelUsageSummary[]`。

### web/src/features/dashboard/types.ts

新增：

```ts
export interface ChannelUsageSummary {
  channel_id?: number
  channel_name?: string
  token_used?: number
  quota?: number
  count?: number
}
```

### usage-summary-tables.tsx

- `SummaryTableCard` 增加可选 `filter?: ReactNode` 插槽，渲染在卡片标题行右侧。
- `UserSummaryTable` / `GroupSummaryTable` 各自：
  - 用 `useQuery` 拉取 `getChannelUsageSummaries(timeRange)`（`queryKey: ['dashboard', 'channel-summary', timeRange]`，`staleTime: 60_000`），派生下拉选项；组件内 `useState<number>(0)` 保存选中渠道，0 = 全部渠道。
  - 下拉框使用 `@/components/ui/select`（与 `models-filter-dialog.tsx` 同款），选项为 `All Channels` + 各渠道名（`channel_name`）。
  - summary 查询的 `queryKey` 与 `queryFn` 均携带选中渠道，切换渠道自动重新请求；切换时间范围时渠道选项自动随范围重建。
  - 渠道列表为空（时间范围内无渠道数据）时下拉框仍渲染，仅显示「All Channels」一个选项，无额外隐藏逻辑。

### i18n

`web/src/i18n/locales/en.json` 新增英文源 key `All Channels`，运行 `bun run i18n:sync` 同步其他语言。

## 测试

### 后端：model/usedata_test.go

- 现有 `TestGetQuotaDataSummaryByUser` / `TestGetQuotaDataSummaryByGroup` 调用改为传 `0`，断言不变（回归保护）。
- 新增：`channelID` 过滤用例——测试数据含 2 个渠道（如 channel 1 / channel 2），按单渠道过滤后行数与数值正确。
- 新增 `GetChannelUsageSummaries` 用例：聚合数值正确、按 token_used 降序、排除 `channel_id = 0` 行、空表返回空数组。
- 使用 `require`（setup/致命错误）与 `assert`（值断言），复用 `truncateTables` 基建。

### 前端

按 `web/AGENTS.md` 约定，扩展 `usage-summary-tables.test.tsx`：
- 渠道下拉框渲染选项（All Channels + 渠道名）
- 选中渠道后请求携带 `channel_id`（mock api 断言 query 参数）
- 渠道列表为空时下拉框行为正常
- 现有排行渲染断言保持通过

## 口径与注意事项

- 数据源为 `quota_data` 预聚合表，仅当「数据看板」（`DataExportEnabled`）开启时有数据；与现有排行同源同口径。
- 「全部渠道」= 不过滤，与现行为完全一致；选中具体渠道后只统计该渠道行。
- `channel_id = 0` 的历史无渠道数据不进下拉选项，但仍计入「全部渠道」总量（保持不变）。
- 该区块本就 admin-only，无需额外权限改动。
- 不做分页；前端仍取 Top 100 展示，超出部分在卡片内滚动。
- 渠道名解析失败的选项回退显示 `Channel {{id}}`，避免选项无标签。
