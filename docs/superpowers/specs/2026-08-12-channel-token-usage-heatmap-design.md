# 设计：User / Group 渠道维度 Token 用量热力图

日期：2026-08-12
分支：feat/my-custom

## 目标

在管理后台 Dashboard 的 **User Analytics** 区（admin-only），在「User Token Usage Ranking」与「Group Token Usage Ranking」两张排行卡片下方各新增一张热力图矩阵卡片：「每人 × 每渠道」与「每分组 × 每渠道」的 token 总用量，颜色深浅表示用量多少，直观呈现用量分布。

## 现状与背景

- `quota_data` 小时级预聚合表已有 `username`、`use_group`、`channel_id`、`token_used` 等字段；上一 feature 已实现渠道维度的排行过滤（`channelID` 参数）与渠道汇总（`/api/data/channels` + `ResolveChannelNames` 名称解析）。
- Dashboard users 区现有 `UserCharts`（VChart 图表，含 `topUserLimit` 5/10/20/50 选择器）与 `UsageSummaryTables` 两张排行卡，共享 `userChartsFilters.selectedRange` 时间预设。
- 仓库无热力图先例；`@visactor/vchart` 支持 heatmap，但用户已选「表格 + 色块」形态（见下方方案）。
- **缺口**：无法一眼看出「谁在哪个渠道用量高」的二维分布。

## 方案（已与用户确认）

- **图表形态**：纯 CSS 网格热力图（表格 + 背景色强度 + 单元格显示格式化数值），不引入 VChart heatmap。
- **位置**：各排行卡下方各一张热力图卡，复用 `selectedRange` 时间预设。
- **数据来源**：新增两个轻量聚合接口（扁平行 `{username, channel_id, channel_name, token_used}` / `{use_group, ...}`）。
- **规模控制**：行（用户/分组）按总用量降序取 Top N，**复用 `userChartsFilters.topUserLimit`（5/10/20/50）共享状态**，选择器仍在 UserCharts 中；列（渠道）全部展示，按渠道总用量降序。
- **不设渠道筛选**：跨渠道对比是热力图用途本身，全部渠道作列。

## 后端改动

### model/usedata.go

新增结构体与两个聚合函数（仿 `QuotaDataSummary` 双字段模式：按人填 `Username`，按组填 `UseGroup`）：

```go
// ChannelDimensionTokenUsage 渠道维度下的用量（按人 / 按分组，一次只填一个维度）
type ChannelDimensionTokenUsage struct {
	Username    string `json:"username"`
	UseGroup    string `json:"use_group"`
	ChannelID   int    `json:"channel_id"`
	ChannelName string `json:"channel_name"` // 名称由 controller 经 ResolveChannelNames 填充
	TokenUsed   int    `json:"token_used"`
}

// GetChannelTokenUsageByUser 按 username + channel_id 汇总 token 用量，排除无渠道(0)行，按 token_used 降序
func GetChannelTokenUsageByUser(startTime int64, endTime int64) ([]*ChannelDimensionTokenUsage, error)

// GetChannelTokenUsageByGroup 按 use_group + channel_id 汇总 token 用量，排除无渠道(0)行，按 token_used 降序
func GetChannelTokenUsageByGroup(startTime int64, endTime int64) ([]*ChannelDimensionTokenUsage, error)
```

- 查询：`Select("username, channel_id, sum(token_used) as token_used").Where(时间范围).Where("channel_id > 0").Group("username, channel_id").Order("token_used desc")`（分组版按 `use_group`）
- 全部 GORM 方法链，SQLite/MySQL/PostgreSQL 通用

### controller/usedata.go

新增两个 handler，与 `GetChannelUsageSummaries` 同模式：调 model → 收集 `ChannelID` → `model.ResolveChannelNames` 解析名称 → 名称缺失回退 `fmt.Sprintf("Channel %d", ...)` → 响应 `{success, message, data: 扁平行}`。`ChannelName` 由 controller 填充到结构体（需要 `ChannelName` 字段——在 model 结构体中加 `ChannelName string \`json:"channel_name"\``，仿 `ChannelUsageSummary`）。

### router/api-router.go

`dataRoute` 组内新增（`middleware.AdminAuth()`）：

```go
dataRoute.GET("/users/channel-tokens", middleware.AdminAuth(), controller.GetChannelTokenUsageByUser)
dataRoute.GET("/groups/channel-tokens", middleware.AdminAuth(), controller.GetChannelTokenUsageByGroup)
```

## 前端改动

### types.ts / api.ts

```ts
export interface ChannelDimensionTokenUsage {
  username?: string
  use_group?: string
  channel_id?: number
  channel_name?: string
  token_used?: number
}
```

- `getUserChannelTokenUsage(params: { start_timestamp; end_timestamp })` → `GET /api/data/users/channel-tokens`
- `getGroupChannelTokenUsage(params: { start_timestamp; end_timestamp })` → `GET /api/data/groups/channel-tokens`

### 纯函数 `buildChannelHeatmap`（features/dashboard/lib/）

输入扁平行与 topLimit，输出矩阵：

```ts
export interface ChannelHeatmapMatrix {
  rowLabels: string[]        // 行标签，按总用量降序，截取前 topLimit
  columnLabels: string[]     // 渠道名，按渠道总用量降序
  cells: number[][]          // cells[r][c] = token_used（0 表示无用量）
  maxValue: number           // 用于颜色归一化
}
```

- 行排序：按该用户/分组跨渠道总 token_used 降序，取前 `topLimit`
- 列排序：按该渠道跨行总 token_used 降序
- 行列名冲突时（如渠道名重复）以 channel_id 去重——列以 channel_id 为键

### 新组件 `channel-usage-heatmap.tsx`（features/dashboard/components/users/）

- props：`titleKey`、`icon`、`rows: ChannelDimensionTokenUsage[]`、`topLimit`、`isLoading`、`emptyText`
- 渲染：卡片骨架与 `SummaryTableCard` 同风格（标题 + IconBadge）；表头 = 渠道名，行首 = 用户名/分组名，单元格 = `formatTokens` 数值 + 背景色（`rgba` 按 `value/maxValue` 归一化，0 用空色）
- 复用 `Skeleton`、空态（`No data`）

### 接入 `usage-summary-tables.tsx`

- `UsageSummaryTables` props 变为 `{ selectedRange, topUserLimit }`（dashboard 父组件从 `userChartsFilters` 传入）
- 渲染顺序：`UserSummaryTable` → `UserChannelUsageHeatmap` → `GroupSummaryTable` → `GroupChannelUsageHeatmap`（各排行卡下方紧跟对应热力图）

### i18n

新英文源 key（en.json，字母序插入后 `bun run i18n:sync`）：

- `User Channel Token Usage`
- `Group Channel Token Usage`

zh.json 手工补译：`用户渠道 Token 用量` / `分组渠道 Token 用量`（与上次 feature 的 zh 翻译惯例一致，i18n:sync 后人工补）。

## 测试

### 后端：model/usedata_test.go

- `TestGetChannelTokenUsageByUser`：复用 `createQuotaDataTestRows` fixture（alice/bob 在 channel 1，carol 在 channel 2）——精确断言每组 (username, channel_id) 的 token_used、按 token_used 降序、channel_id=0 行被排除（局部插入 0 渠道行，同上次做法）、空范围返回空
- `TestGetChannelTokenUsageByGroup`：同样按 (use_group, channel_id) 断言

### 前端

- `buildChannelHeatmap` 纯函数单测（`features/dashboard/lib/__tests__/`）：行按总量降序 + Top-N 截断、列按渠道总量降序、0 值单元格、maxValue 归一化、空输入
- 组件测试（`__tests__/channel-usage-heatmap.test.tsx`，happy-dom + node:test）：行/列标题渲染、单元格数值与颜色、空态、loading 骨架

## 口径与注意事项

- 数据源为 `quota_data`，与排行同源同口径；`channel_id = 0` 历史行不进热力图（同 `GetChannelUsageSummaries`）
- 热力图行数受 `topUserLimit` 控制（默认 10，来自 `userChartsFilters` 初始值），列数 = 时间范围内有用量渠道数（无上限，渠道通常有限）
- 该区块本就 admin-only，无需额外权限改动
- 不做交互（无 tooltip——单元格直接显示数值；无点击下钻）
