# GEO 扩展表变更待审

本轮尚未生成或执行迁移。自动审批拒绝了 `drizzle-kit generate`，认为目前的实施授权未明确覆盖具体 schema migration。本文件及 `packages/lib/src/db/schema.ts` 的 `restaurantGeoRecords` 定义是本次待批准变更范围。

## 目标

仅限本机专用 `restaurant_p1_test` 和 `restaurant_p1`。先备份，再对隔离测试库验证；测试通过后才对本地开发库执行。正式服务器/其他数据库不在此次范围。

## 新增业务表

`restaurant_geo_records` 只追加保存问题库、渠道快照、诊断、批次导入、人工判断、修改稿、发布登记、验证、调度设置及任务请求/结果。

| 字段 | 内容 |
| --- | --- |
| id | UUID 主键 |
| store_id | 外键，引用现有 restaurant_stores；不级联删除 |
| kind / key | 记录类型与幂等标识 |
| payload | JSONB 内容 |
| sha256 | 稳定序列化内容的 SHA-256 |
| created_by / created_at | 操作者与时间 |

索引：`store_id + kind + key` 唯一；`store_id + created_at` 查询索引。开启与 P1 相同的 RLS 设置，应用层所有入口仍通过 Organization → Brand → Store 核验权限；写入限组织管理员。迁移需增加禁止 UPDATE/DELETE 的触发器，复用 P1 的 `restaurant_reject_mutation()`。

不删除现有表，不更改已有事实、证据或账号，不写入虚构的门店确认事实。确认记录更正使用新增记录，不覆盖旧数据。

## 任务运行时

GEO 检查使用现有 pg-boss，可在本机库创建/更新其任务元数据 schema 并增加 `restaurant-geo-dispatch`、`restaurant-geo-collect` 队列。专用 GEO worker 不运行其他 Elmo 模型任务；本轮采集不连接付费 API。

## 执行前后检查

1. 核实目标库及备份可读；记录备份文件路径与指纹。
2. 生成迁移并检查差异必须只涉及上述新表、索引、触发器及迁移元数据；发现额外变更停止。
3. 对隔离库迁移，验证组织/分店隔离、管理员限制、幂等写入、不可变记录、完整修正闭环及 P1 回归。
4. 对本地开发库应用相同迁移，验证旧 P1 档案可读写和新增页面可用。
5. 启动仅 GEO 检查队列，验证中断重启不重复保存逻辑结果；失败记录可见。

风险为本地数据库结构与任务元数据发生持久变更。保留迁移前备份；不自动执行删表回退。生产上线、真实平台登录和公开渠道发布不包含在数据库授权中。
