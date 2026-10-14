# 餐厅 GEO：P0 浏览器采集器

这是一套可以本机运行的 P0 命令行程序，用来验证免费账号、默认聊天模式下的自动采集。它是未来 Elmo 后台任务的独立采集组件，目前还不是 F1—F4 完整工作台。

**当前状态：真实平台账号待准备；ChatGPT / Gemini 的页面选择器尚未经登录后的真实页面验证。** 本地测试页面只验证程序流程，不能作为真实 AI 查询、成功率或推荐效果的证据。

## 已确定的采集条件

- 项目专用普通免费账号；人工登录、处理验证并确认套餐。
- 英文问题明确写纽约地名；不模拟设备定位，实际网络位置标为未验证。
- 每条问题打开新会话，不点击搜索、深度研究或模型切换按钮。产品自行搜索不受禁止。
- 测试账号关闭记忆／历史个性化和自定义指令，以减少跨问题影响；状态由账号维护人确认并留证。
- 账号证据使用人工确认和本地套餐截图，不声称由程序自动识别订阅资格。
- 主要套餐及最多 10 项菜品、重点复核后出正式报告等约定属于后续 F1—F4；本 P0 仅采集并生成采集草稿。

## 本机启动

需要 Node 24、Playwright 1.63.0 和浏览器。Windows 优先使用已安装的 Microsoft Edge；其他环境使用配套 Chromium。本机已有的 Playwright 会从 `../sources/Elmo/node_modules` 加载，不读取该项目的环境文件。

在 PowerShell 中进入此目录：

```powershell
Set-Location 'C:\Users\WZ\Desktop\GEO\p0-browser'
node src/cli.mjs doctor
node src/cli.mjs demo
```

在其他电脑部署时，使用正常依赖安装：

```powershell
pnpm install
pnpm exec playwright install chromium
```

可通过 `GEO_PLAYWRIGHT_MODULE` 指定 Playwright 的绝对模块路径，或通过 `GEO_BROWSER_EXECUTABLE` 指定兼容的浏览器可执行文件。正式运行采用可见浏览器；本地模拟测试使用无界面浏览器，且使用单独的 `profiles-fixture` 档案。不使用个人主浏览器档案，不添加规避验证的插件或参数。

## 账号就绪后

分别执行以下命令。程序打开专用浏览器，由你完成登录和套餐／个性化设置确认。终端不会索要或保存密码。

```powershell
node src/cli.mjs login --platform chatgpt
node src/cli.mjs login --platform gemini
```

登录状态保存在 `private/profiles/`，套餐截图和确认记录保存在 `private/accounts/`。这些内容不进入报告和源码版本管理；不要把 `private` 目录作为交付附件。账号确认有效期为 7 天，过期需复核。

先建立 4 条小样本（2 道问题 × 2 平台），验证输入、完成判断、引用与截图：

```powershell
node src/cli.mjs init --batch easyjoy-probe-001 --kind probe
node src/cli.mjs run --batch easyjoy-probe-001 --day 1
node src/cli.mjs report --batch easyjoy-probe-001
```

检查 4 条真实结果：账号为免费档，进入默认新会话，没有点击搜索按钮，回答完整，原始页面与抽取链接对应。复核后记录：

```powershell
node src/cli.mjs approve-probe --batch easyjoy-probe-001 --reason '已核对免费账号、默认新会话、完整回答和可见链接'
```

此命令验证探针及证据文件，保留人工复核记录；它不替代你的页面核对。本地模拟不能放行正式 P0。账号确认记录或适配器版本改变后需重新做探针。

页面变化、登录/验证、额度限制或会话不干净会暂停相应平台。适配器通过首轮真实页面验证后，才启动正式 40 条计划：

```powershell
node src/cli.mjs init --batch easyjoy-p0-001 --kind p0
node src/cli.mjs run --batch easyjoy-p0-001 --day 1
```

第 2 天按纽约日期判断，必须晚于第 1 天；上海日期显示只用于阅读。

```powershell
node src/cli.mjs run --batch easyjoy-p0-001 --day 2
node src/cli.mjs status --batch easyjoy-p0-001
node src/cli.mjs report --batch easyjoy-p0-001
```

P0：5 道固定问题 × 2 平台 × 2 次重复 × 2 日期 = 40 个逻辑样本。探针计划与正式计划分开；问题包含 3 道无目标店名的自然发现题、2 道门店核验题。门店身份仍需业务确认，P0 不判断事实正确性。

## 暂停、恢复与重试

正常暂停后维护账号，再运行相同 `run` 命令；已经成功的样本不会再次提交。每个样本最多两次可能提交的尝试，重试不增加统计分母。不同计划共享进程锁，防止同一账号并发运行。

异常退出后先执行：

```powershell
node src/cli.mjs recover --batch easyjoy-p0-001
```

运行中的尝试会标为中断待复核。因为无法确定请求是否已经送达，系统不自动盲目补发；复核后可使用以下命令，再运行该批次：

```powershell
node src/cli.mjs retry --batch easyjoy-p0-001 --sample d1-chatgpt-discover-budget-r1 --reason '已检查中断记录，允许在尝试上限内补采'
```

决定保留失败时：

```powershell
node src/cli.mjs close --batch easyjoy-p0-001 --sample d1-chatgpt-discover-budget-r1 --reason '平台持续不可用，本批保留失败'
```

绑定日期后不能跨日补采同一天的样本。错过时段需保留本批结果并建立新批次。

## 证据与报告

每个批次位于 `runs/<batch>/`：

| 文件 | 作用 |
|---|---|
| `manifest.json` | 冻结问题、条件、40 个计划样本及内容校验值 |
| `state.json` | 所有计划样本的状态，含失败、中断、重试和处理记录 |
| `attempts/<sample>/<attempt>/request.json` | 本次实际问题、账号确认依据、操作记录与时间 |
| `before-submit.png`、`page.png` | 提交前与结果／故障页面截图 |
| `answer.txt`、`answer.fragment.html.txt` | 回答文本及 DOM 片段；HTML 作为文本保存，避免执行 |
| `response.json` | 可见引用、模型标签、完成判据与未知项 |
| `evidence.json` | 证据文件 SHA-256，便于校验 |
| `report.html`、`summary.json` | 人可读采集草稿和机器可读统计 |

P0 不实施正式报告发布或推荐判断。界面上的模型标签是观察值，不保证揭示后台型号；当前只提取回答中的可见外链，折叠来源面板未展开，不能声称已取得完整引用清单，也不能用引用数证明搜索是否发生。自动完成判断依赖回答稳定、无可见停止按钮，仍需真实小样本人工核验。找不到选择器时暂停，不猜测发送位置。

外部服务消耗上限为 US$20。当前程序只操作浏览器，没有付费 API 接口，登记的外部 API 消耗为 0；不包含网络、设备、人工等成本。未来接入付费服务必须在调用前增加预算预留和实际扣费核对，不能只复用这里的静态 0 成本记录。

## 验证

```powershell
pnpm lint
pnpm test
```

测试覆盖真实 Chromium 对本机模拟页面的流式回答采集、登录／验证码／额度暂停、旧会话拒绝、超时重试上限、证据完整性、恢复不重复提交、跨日限制、报告转义以及测试与真实数据隔离。不会调用 ChatGPT、Gemini 或付费接口。

## 后续接入 Elmo

保持 `Organization → Brand → Store`，由后台任务调用采集器。`manifest` 映射检测批次，逻辑样本映射 `test_samples`，每次尝试映射 `execution_attempts`；成功回答再映射 `prompt_runs`。证据路径和摘要进入数据库，浏览器认证档案留在采集机。P0 不启动或迁移 Elmo 数据库。

## Easy Joy 166 条试点（2026-10-14）

已建立 `easyjoy-pilot-001`，当前全部待运行。新试点使用 Excel 原有 8 道题（6 英文、2 中文），每平台重复 10 次，分两个纽约自然日、每日 5 次；第一日另做 3 道门店核验题 × 2 平台。历史 Excel 观察不进入此批次。原 40 条 P0 技术验收计划仍保留。

```powershell
# 仅当需要建立新的批次时运行；已有批次不会覆盖
node src/cli.mjs init --batch easyjoy-pilot-002 --kind pilot

# 先完成 login、真实 probe 和 approve-probe，再运行；每次可以用 --limit 控制派发数量
node src/cli.mjs run --batch easyjoy-pilot-001 --day 1 --limit 10
node src/cli.mjs run --batch easyjoy-pilot-001 --day 2 --limit 10

# 实际修正发布并重采验证后，建立同题、同条件的新复测批次
node src/cli.mjs retest --baseline easyjoy-pilot-001 --batch easyjoy-retest-001
```

默认题库来自 `../repos/Elmo/packages/lib/src/restaurants/geo/easyjoy-bank.json`；其他部署可用 `--bank` 指定同一导出文件。复测复制冻结条件并保存原计划指纹，不能保证产品背后的模型版本不发生变化。

Elmo 新增的 GEO 试点页可读取本机批次，逐份验证原始证据后导入并复核推荐与分店判断。扩展数据库表尚待授权安装，不能把代码接入当作运行验收通过。
