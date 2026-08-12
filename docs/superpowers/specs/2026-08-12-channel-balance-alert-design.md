# 设计：渠道余额不足阈值告警

日期：2026-08-12
分支：feat/my-custom

## 目标

为渠道提供**余量不足告警**：当渠道（可能是外部订阅的 token plan）剩余额度低于配置阈值时，通知管理员（root 用户），避免"余额耗尽渠道被静默禁用后才发现"的被动局面。

## 现状与背景

- **余额查询已存在**：`controller/channel-billing.go` 的 `updateChannelBalance(channel)` 支持 OpenAI/CloseAI/AIProxy/API2GPT/2DGPT/SiliconFlow/DeepSeek/OpenRouter/Moonshot 等渠道类型，查询结果写入 `channel.Balance`（USD）+ `BalanceUpdatedTime`。
- **定时循环已存在**：`AutomaticallyUpdateChannels(frequency)`（由环境变量 `CHANNEL_UPDATE_FREQUENCY`（分钟）控制，main.go:118-123 启动），遍历启用中的非多密钥渠道调用 `updateAllChannelsBalance()`；`balance <= 0` 时调用 `service.DisableChannel(..., "余额不足")`。
- **禁用时已有通知**：`DisableChannel` 会 `NotifyRootUser`（"通道「X」（#Y）已被禁用，原因：余额不足"），通知方式为 root 用户配置的 Email/Webhook/Bark/Gotify（`service/user_notify.go`），带按类型限流（`service/notify-limit.go`）。
- **缺口**：耗尽前（`0 < balance < 阈值`）没有任何告警。
- 渠道模型有 `Setting` 字段（`dto.ChannelSettings` JSON，`GetSetting()`/`SetSetting()` 辅助方法），可用于每渠道配置；`dto.ChannelSettings` 定义在 **relaykit 模块**（修改后必须验证 relaykit 独立构建）。

## 方案

复用现有余额更新循环，在 `updateAllChannelsBalance()` 中增加阈值告警状态机。阈值 = 渠道 `Setting.BalanceAlertThreshold` 覆盖，否则用全局设置项 `BalanceAlertThreshold`。

## 后端改动

### relaykit/dto/channel_settings.go

新增字段（`omitempty`，向后兼容）：

```go
// BalanceAlertThreshold 余额告警阈值（USD）。nil=用全局默认；0=该渠道关闭告警；>0=覆盖全局阈值
BalanceAlertThreshold *float64 `json:"balance_alert_threshold,omitempty"`
```

### relaykit/dto/notify.go

新增通知类型常量：

```go
NotifyTypeBalanceAlert = "balance_alert"
```

限流桶格式：`balance_alert_{channelId}`（每渠道独立限流，参考 `service/channel.go` 的 `formatNotifyType` 模式）。

### model/channel.go

新增字段（API 不可见，纯后端状态）：

```go
BalanceAlerted bool `json:"-"` // 余额告警已发送标记，用于"跨过阈值只通知一次，恢复后重新计数"
```

GORM `AutoMigrate` 自动在 SQLite/MySQL/PostgreSQL 添加列，三库兼容。

### setting/operation_setting

新增全局设置项 `BalanceAlertThreshold`（float64，USD，默认 10，0 = 全局关闭告警），含 env 覆盖（`BALANCE_ALERT_THRESHOLD`）与默认值，遵循现有 `monitor_setting.go` 模式。

### controller/channel-billing.go

新增可测函数（纯逻辑，不依赖 gin）：

```go
// checkChannelBalanceAlert 判断渠道余额是否需要告警/恢复。
// 返回 true 表示本次检查需要发送告警（跨过阈值且未告警过）。
func checkChannelBalanceAlert(channel *model.Channel, balance float64, threshold float64) bool
```

状态机（在 `updateAllChannelsBalance()` 每渠道循环中，禁用判断之后）：

| 条件 | 行为 |
|---|---|
| `balance <= 0` | 维持现有自动禁用逻辑（不变，禁用通知已存在） |
| `0 < balance < threshold` 且 `!channel.BalanceAlerted` | `NotifyRootUser(NotifyTypeBalanceAlert, ...)` 发告警；置 `channel.BalanceAlerted = true` 并落库 |
| `0 < balance < threshold` 且 `channel.BalanceAlerted` | 已告警过，跳过（不刷屏） |
| `balance >= threshold` | 清 `BalanceAlerted`（恢复；再次跨过阈值会重新告警） |

threshold 解析优先级：渠道 `Setting.BalanceAlertThreshold != nil` → 用之（0 表示该渠道关闭告警）；否则全局 `BalanceAlertThreshold`（0 表示全局关闭）。

告警内容：
- subject：`渠道余额不足告警：通道「{Name}」（#{Id}）`
- content：`通道「{Name}」（#{Id}）剩余额度 ${balance} 低于告警阈值 ${threshold}（渠道类型 {Type}，余额查询时间 {BalanceUpdatedTime}），请及时充值。`

落库方式：告警置位/恢复通过 `channel.UpdateBalanceAlerted(alerted bool)` 落库，采用与 `model/channel.go` 的 `UpdateBalance`（`DB.Model(channel).Select(...).Updates(Channel{...})`）相同的显式 Select + Updates 模式，单独更新 `balance_alerted` 列。

## 前端改动

### 渠道编辑（web/src/features/channels/）

- `types.ts` 的 `ChannelSettings` 接口：新增 `balance_alert_threshold?: number`
- `lib/channel-form.ts`：zod schema 新增可选数字字段（`z.number().min(0).optional()` 或字符串转数字，遵循表单现有风格）；默认值映射
- 编辑抽屉（`channel-mutate-drawer.tsx` 或对应设置区块）：新增"余额告警阈值（美元）"输入框，placeholder 提示"留空使用全局默认，0 关闭告警"

### 系统设置 → 运营设置（web/src/features/system-settings/operations/）

- `OperationsSettings` 类型新增 `BalanceAlertThreshold` 字段
- 页面表单新增"渠道余额告警阈值（美元）"输入

### i18n

`en.json` 新增 key（如 `Balance Alert Threshold`、`Balance alert threshold (USD). Leave empty to use the global default, 0 to disable.` 等），运行 `bun run i18n:sync`。提交时**不**包含 `_reports/*.untranslated.json` 瞬态文件。

## 测试

### 后端：controller/channel-billing 相关测试

- `checkChannelBalanceAlert` 状态机三态：
  - 未告警 + 低于阈值 → true（需告警）
  - 已告警 + 低于阈值 → false（不重复）
  - 任意状态 + 达到阈值 → 恢复（清标记，不告警）
- 阈值解析优先级：渠道覆盖 > 全局；渠道 0 = 关闭；全局 0 = 关闭
- 测试直接调用纯函数 + 内存 channel 结构体，不依赖 gin/DB（若函数需要 DB 落库则拆分：判断逻辑纯函数 + 落库在调用方）

### 前端

- 渠道表单 schema 测试（`__tests__/`，按 web/AGENTS.md 惯例）：阈值字段接受数字、拒绝负数
- 若运营设置页有既有测试模式则补充，否则 typecheck + 手工验证

## 注意事项

- **relaykit 模块独立构建**：修改 relaykit 后必须 `cd relaykit && GOWORK=off go build ./...` 验证
- 依赖 `CHANNEL_UPDATE_FREQUENCY` 环境变量循环（与现有余额自动禁用同一依赖）；未设置则既不更新余额也不告警
- 多节点部署：`BalanceAlerted` 存 DB，避免多节点重复通知（存在极小竞态窗口，可接受）
- 阈值单位 USD，与 `channel.Balance` 一致
- 仅对支持余额查询的渠道类型生效（同现有 `updateChannelBalance` 支持范围）；多密钥渠道跳过（同现有逻辑）
