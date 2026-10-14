# 餐厅 GEO：P1 本地工作台

P1 在 Elmo 上实现“门店档案 → 证据 → 资料草稿 → 人工确认版本 → 标准资料导出”。它是 F1–F4 的数据基础。渠道自动采集、问题库执行、AI 推荐诊断、正式报告/PDF 和每周调度属于后续阶段。

## 这台电脑如何打开

在 PowerShell 运行：

```powershell
cd C:\Users\WZ\Desktop\GEO
.\Start-P1.ps1
```

出现启动地址后打开 `http://localhost:3010/app/org/default/restaurants`。首次打开请创建自己的本地管理员账号，然后进入组织的“门店资料”。本机网页账号与尚待准备的 ChatGPT/Gemini 免费测试账号没有关系。开发库 `restaurant_p1` 初始为空，不含模拟核实结论。默认仅监听本机，按 Ctrl+C 关闭。

启动脚本会保持本机 Ubuntu-22.04 在线并更新 WSL 数据库地址；只启动网页，不启动 Elmo 查询 worker，不发生模型 API 或采集服务消费。PostgreSQL 14 的专用账号只允许当前 Windows 主机密码认证访问 P1 两个库。若 WSL 网段发生变化，需要相应调整 `pg_hba.conf` 的该条专用规则，不能改成无密码认证。

## 第一家门店

1. 新建品牌 Easy Joy，门店标识可填写 Easy Joy · Mulberry St。同品牌其他地址另建门店；品牌可复用，官网可未知。
2. 在“证据记录”保存与负责人核实的摘录、来源链接、核实时间及可选附件。PNG/JPG/PDF 最大 2 MB，附件存储在私有数据库中。此入口是人工复核记录，不计作自动渠道采集。
3. 在“资料与确认”填写有依据的栏目，关联同一家门店的证据并保存草稿。支持自由填写餐厅类型、菜系，七天营业安排、多时段、跨午夜、节假日说明、套餐和最多 10 项重点菜品。空白栏目保持未知。
4. 管理员勾选本次核实的栏目，填写核实对象及说明，确认成 V1。名称与地址必须有证据且已确认；其余栏目可以保持待核实或未知。
5. 在“版本与导出”查看历史值、状态、核实人及证据关联，下载对应版本的 `store_data.vN.json`。后续修改先存草稿，再确认 V2，V1 不被覆盖。

当前沿用 Elmo 本地模式的单管理员首次注册流程。组织隔离与管理员确认权限已实现；多人邀请、自助注册及服务器部署需在部署阶段配置，不开放公共注册。

## 数据与接入边界

- 复用 Elmo 的 Organization → Brand，新增 Store。新餐厅品牌的旧品牌查询任务默认关闭；门店官网由事实资料独立管理，不创建虚构网址。
- 门店草稿采用乐观版本号和事务锁。过期写入被拒绝，不采用最后写入覆盖策略。
- 正在编辑的草稿不会因后台刷新而被替换；服务器有新版时提示主动载入。未保存时先保存或撤销再切换门店，离开页面有丢失修改提示。
- 事实版本、证据只追加；PostgreSQL 触发器阻止更新和删除。更正证据需新增记录，在下一版重新关联。
- 每个资料栏目有 `unknown / pending / confirmed` 状态。确认粒度为栏目；服务子项、部分日期等仍可保留明确的 unknown，后续诊断必须继续尊重这些未知值。
- 标准导出只包含已确认值、状态、门店/品牌标识及版本信息，不导出内部核实说明、账号或附件。它是内部组件数据接口，不是可直接公开挂官网的 JSON-LD。
- 本版 JSON 契约为 `schema_version=1.0.0`、`record_type=restaurant_location`、`facts` 和 `field_status`。**不是同事旧 schema 的原样实现**：旧 schema 强制官网、坐标等，无法表达本项目的未知状态。P2 适配该诊断组件时必须显式映射，禁止用虚构值凑齐必填项。
- P0 浏览器批次仍保存在 `../../p0-browser/runs`。P1 未自动导入 P0 回答，不将测试夹具当成餐厅事实。接入时按门店关联批次与尝试，验证 manifest/文件哈希，保留平台、账号等级、默认聊天、新会话、实际可核实模式和模拟标记；未经复核的模型回答只能作为观察证据，不能直接确认事实。
- F1/F4 采集器后续应另存渠道观察快照，引用 P1 事实版本进行比对；不得写入确认表来替代复核流程。平台无法采集时必须记录缺口。

## 开发与验证

Node 24、pnpm、PostgreSQL。依赖已经在本机安装；重新安装使用 `pnpm install --frozen-lockfile`。运行需要根目录及 `apps/web/.env`，不能提交密钥。迁移为 `0024_restaurant_foundation.sql`，包括三张业务表及不可变触发器。仅对已授权的目标库执行迁移；附带初始化脚本只接受本机专用 `restaurant_p1` / `restaurant_p1_test`，不支持生产库。

```powershell
# 在仓库根目录执行；先启动工作台以保持 WSL 在线
pnpm lint
pnpm --filter @workspace/lib check-types
pnpm --filter @workspace/web check-types
pnpm --filter @workspace/lib exec vitest run src/restaurants/facts.test.ts
node --env-file=.env.p1-test --import tsx --test scripts/restaurant-integration.mts
```

浏览器测试只针对隔离库：先关闭开发网页，再运行 `scripts/start-restaurant.ps1 -TestData`；另一终端依次运行 `node --env-file=.env.p1-test --import tsx scripts/restaurant-ui-seed.mts` 与 `node scripts/restaurant-browser.mjs`。测试会追加明确标注的软件验收数据，账号保存在被 Git 忽略的 `.restaurant-test/ui-account.json`，不打印密码。截图与导出证据保存在 `.restaurant-test/artifacts`。测试脚本使用本机 Edge。

迁移初始化命令（仅在确认专用目标库后）：`node --env-file=.env --import tsx scripts/restaurant-db.mts --apply-p1-local`。测试库改用 `.env.p1-test`。保留原始上游仓库 MIT 许可。

## 2026-10-13 验收结果

- `pnpm lint` 通过，后端及网页 TypeScript 检查通过。
- 共享逻辑 643 项、网页端 533 项单元测试通过。P1 数据库测试通过 8 个业务检查（Node 输出包含外层工作流，共 9 项）：并发、组织隔离、分店证据隔离、管理员确认、历史导出、不允许篡改记录等。
- 本机 Edge 浏览器通过 8 项检查：登录、建店、证据/附件保存、草稿确认、历史证据追溯、JSON 下载、未保存修改保护、手机无横向溢出。测试没有浏览器脚本错误。
- 网页生产构建及服务端依赖检查通过。本机生成的是 Windows 构建；服务器部署时在目标系统重新构建。
- 交付启动脚本已测试，空开发库正确进入首次注册页。没有替用户创建固定密码或预先确认任何真实门店资料。
- 修复两项上游 Windows 开发障碍：OG 字体依赖未声明，以及 API 契约测试未将反斜杠文件路径转换成 URL 路径。LF 检出规则与原有 Biome 要求对齐，原文件恢复为 Git 原文字节，没有无关代码改动。
- 当前尚未执行真实 ChatGPT/Gemini 查询、自动第三方渠道采集或正式餐厅诊断；外部付费服务消耗为 US$0。
