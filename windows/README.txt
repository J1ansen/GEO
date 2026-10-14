餐厅 GEO — Windows 10/11 开发交接包（2026-10-14）

请先读这里
这是带源码的内部开发试用包，不是免安装 EXE，也不是已完成 P0–P5 的产品。
当前 P1 门店、证据、确认版本和导出已在原开发机验证。新 GEO 功能有源码，
但新增数据库迁移尚未生成或应用；完整采集、比对、报告和复测闭环未验收。
本包没有在另一台全新 Windows 电脑上完成安装验收。

一、包里有什么
repos/Elmo：主工作台、P1、GEO 组件、已存在的 P1 数据库迁移、锁文件和许可证。
repos/geo-optimizer-skill：官网检查组件的固定版本源码及 MIT 许可证。
p0-browser：独立浏览器采集程序、测试、安装锁文件；不带账号和运行结果。
windows：同事电脑的配置及启动辅助脚本。本说明优先于原电脑的启动说明。
MANIFEST.json：源码版本、全部交付文件的 SHA-256 和交付边界。

不包含 node_modules、Python 环境、.env、API 密钥、数据库备份、登录 Cookie、
浏览器档案、截图、真实查询结果或个人测试账号。导入后的 Easy Joy 题库包含
原 Excel 的题目、历史观察及来源标识；不包含 Excel 原文件或原 GEO.rar。
GEO.rar 已适配的事实比较代码和来源说明在 Elmo 中；GEORank 改编代码和许可也在其中。
数据从同事的空数据库开始，不会连接原作者电脑，不会自动同步两台电脑的数据。

二、准备环境（需要能联网下载依赖）
解压到短路径，例如 C:\GEO-share，保持目录层级完整。
安装 Node.js 24、支持 packageManager 字段所指定版本的 pnpm、PostgreSQL 14、Microsoft Edge。
Elmo 固定 pnpm 12.4.1，P0 固定 pnpm 11.25.0；进入各目录后核对 pnpm --version。
保留各项目的 pnpm-workspace.yaml 和 pnpm-lock.yaml，不绕过安装安全检查。
官网检查另需 Python 3.9+。建议使用同事电脑的独立虚拟环境。

本交接入口使用 Windows 本机 PostgreSQL（127.0.0.1），不要求 WSL。
原项目 Start-P1.ps1 / scripts/start-restaurant.ps1 使用 WSL Ubuntu-22.04，
请不要用它们启动本说明中的原生 Windows PostgreSQL 配置。

三、创建独立数据库和配置
由同事或其数据库维护人通过 PostgreSQL 管理工具，在本机创建登录角色 geo_local，
设置自己的密码，并创建以该角色为所有者的空数据库 restaurant_p1。
不要选择已有业务数据库，不需要超级用户作为日常应用账号。

打开 PowerShell（以下以 C:\GEO-share 为解压目录）：
  Set-Location C:\GEO-share
  .\windows\Initialize-Config.ps1

脚本会隐藏输入数据库密码，随机生成本机认证和加密密钥，写入 Elmo 根目录
及 apps/web 下的 .env；不创建数据库、不运行 SQL，不覆盖已有配置。
角色名或端口不同可传 -DatabaseUser 和 -DatabasePort。
保留生成的配置，之后不要随意更换加密密钥。不要把配置文件再次打包转发。

四、安装依赖并初始化 P1
  Set-Location C:\GEO-share\repos\Elmo
  pnpm install --frozen-lockfile

数据库维护人先审核 packages/lib/src/db/migrations 中已存在的 SQL，确认 .env
指向刚创建的本机空库，再明确批准初始化。已有数据的库先备份。
本包不自动执行迁移，也不提供绕过新增 GEO 迁移审批的脚本。

只有完成上述审核并批准后，由同事在自己的机器上执行已有的 P1 迁移：
  Set-Location C:\GEO-share\repos\Elmo\packages\lib
  node --env-file=../../.env node_modules/drizzle-kit/bin.cjs migrate

这是应用已随包提供的 SQL（当前截至 0024），不是根据最新 TypeScript schema
生成新迁移。不要执行 drizzle-kit push 或 generate 来补齐未验收的 GEO 表。
这个步骤不在原开发机或打包过程中执行。

五、启动和使用 P1
  Set-Location C:\GEO-share
  .\windows\Start-Local.ps1

出现 Vite 就绪信息后，打开：
  http://localhost:3010/app/org/default/restaurants

首次创建自己的本地管理员账号，然后建品牌与门店、保存证据、确认资料及导出。
登录网页的密码与数据库密码分别设置。窗口保持开启，Ctrl+C 停止网页。
仅监听本机，不启动付费 AI worker；不要使用 pnpm dev 启动整个上游服务集合。
“GEO 试点”栏目在扩展表未安装时会提示错误，目前不能用于完整业务操作。

六、可选：独立 P0 浏览器程序
  Set-Location C:\GEO-share\p0-browser
  pnpm install --frozen-lockfile
  pnpm exec playwright install chromium
  node src/cli.mjs doctor
  node src/cli.mjs demo

demo 只验证本机模拟页面，不是 AI 平台测试结果。
真实测试要同事自己登录项目专用 ChatGPT / Gemini 账号，完成真实探针及人工复核。
参见 p0-browser/README.md。本包不带原机器的 runs 目录，需先新建计划：
  node src/cli.mjs init --batch easyjoy-pilot-001 --kind pilot

计划包含 166 条待运行样本。生成计划不发送问题，也不产生付费服务消耗。
真实页面适配与免费账号测试仍未验收，遇到验证或页面变化应暂停处理。

七、可选：官网 Python 组件
  Set-Location C:\GEO-share
  python -m venv .geo-python
  .\.geo-python\Scripts\python.exe -m pip install .\repos\geo-optimizer-skill
  $env:GEO_PYTHON = (Resolve-Path .\.geo-python\Scripts\python.exe).Path

Python 依赖有版本范围，尚未制作为完全离线且固定依赖的安装包。
设置环境变量只对当前终端及其子进程生效。
GEO worker 在扩展表安装且联调完成前保持关闭；不要启动上游付费模型队列。

八、版本范围和已知待办
Google 自动采集未通过，Yelp 返回 403；只有官网真实预检成功。
新 GEO 表安装、工作台数据库联调、真实 AI 166 条执行、人工发布与同条件复测、
完整报告验收、备份恢复/连续运行和正式服务器部署仍未完成。
详见 repos/Elmo/README-GEO-PILOT.md、README-P1.md、DATABASE-CHANGE-REVIEW.md。

配置错误排查：
- 端口 3010 被占用：关闭占用程序后重试；修改端口需要同时调整两个 .env 中的 URL。
- 数据库检查失败：检查 PostgreSQL 服务、角色密码、数据库名及已审核 P1 SQL 是否应用。
- PowerShell 禁止脚本：按单位的脚本签名/执行策略处理，不必全局降低执行策略。
- pnpm 安全策略阻止依赖安装：保留完整报错交给开发者，不取消保护配置。
- 缺少 GEO 扩展表：这是当前版本的已知未完成项，不能靠导入测试数据解决。
