餐厅 GEO — macOS 源码交接包（2026-10-14）

这是内部开发试用包，不是免安装 .app，也不是 F1–F9 已全部完成的产品。
P1 主体已在原 Windows 开发环境验收；本包未在真实 Mac 上完成安装验收。
新增 GEO 数据库扩展尚未生成和安装，完整采集、比对、报告和复测尚未跑通。

一、交付内容与适用环境
repos/Elmo：工作台、P1、GEO 源码、已有 P1 SQL、锁文件、许可证。
repos/geo-optimizer-skill：官网检查组件的固定版本源码和许可证。
p0-browser：独立浏览器采集程序、测试和锁文件，不带运行批次或登录态。
mac：本机配置及启动脚本。MANIFEST.json：交付文件摘要和源码版本。
原 Excel 已导入的 Easy Joy 题库与历史观察包含在源码中；历史记录不算本轮实测。
不含原 Excel / GEO.rar、数据库备份、.env、密钥、Cookie、浏览器档案及 node_modules。
保留原目录结构；其他文档中的 Windows 路径和 .ps1 命令请以本说明替代。

运行环境：Node.js 24、项目指定的 pnpm、本机 PostgreSQL；官网采集另需 Python。
浏览器/PDF 使用 Playwright 自带 Chromium，不依赖 Windows Edge。
当前 Playwright 文档要求 macOS 14 或更高版本；旧系统需另行核验。
https://playwright.dev/docs/intro
源码包不带系统二进制。Apple Silicon / Intel 使用对应架构的 Node、数据库和依赖，
不要复制 Windows 的 node_modules；这不代表两种 Mac 都已经完成实机验收。

二、准备依赖
解压后建议将 GEO-share 文件夹放在个人目录，例如 ~/GEO-share。
安装 Node.js 24 和 pnpm；Elmo 的 packageManager 固定 pnpm 12.4.1，P0 为 11.25.0。
进入各自目录后核对版本；不要改锁文件或取消安装安全策略。
如果使用 Homebrew，可参考下列命令（由同事在其电脑上执行）：
  brew install node@24 pnpm postgresql@14
  export PATH="$(brew --prefix node@24)/bin:$(brew --prefix postgresql@14)/bin:$PATH"
  node --version
  brew services start postgresql@14

PATH 设置只影响当前终端；以后新开终端需重新设置或按自己的 shell 配置持久化。
这里沿用原开发环境的 PostgreSQL 14 便于首次复现。Homebrew 的该版本已有停用计划，
若安装源不再提供，先由开发者验证替代版本，不要把更换数据库版本当成已验收。
若同事已经安装本机 PostgreSQL，则复用其安装方式，另建专用数据库即可。
Homebrew 是否支持本机系统/架构，按其安装提示处理，不保证老款 Intel Mac 有预编译包。
安装来源与命令参考：
https://formulae.brew.sh/formula/node@24
https://formulae.brew.sh/formula/postgresql@14
https://pnpm.io/installation

三、创建同事自己的空数据库
以下由本机数据库维护人审核并执行；不连接原开发者电脑，也不导入原开发数据。
使用本机管理账号创建登录角色 geo_local（设置自己的密码），创建由它拥有的
空数据库 restaurant_p1。已有同名角色或库时先核查，不删除或重建已有业务库。
Homebrew 全新安装、当前 macOS 用户具备本机管理权限时，可参考：
  createuser --host=localhost --pwprompt geo_local
  createdb --host=localhost --owner=geo_local restaurant_p1

如果本机使用其他管理账号，按自己的数据库配置操作，不关闭密码验证来解决连接问题。
数据库只需监听本机，不需要开放到局域网或公网。

四、生成本机配置
  cd ~/GEO-share
  bash mac/configure.sh

按提示输入角色、端口和数据库密码，密码输入不回显，不放进命令行参数。
脚本创建 Elmo 根目录与 apps/web 下两份 .env，使用新生成的认证/加密密钥，
文件权限为仅当前用户读写，不覆盖已有配置，不运行数据库操作。
只支持本机 127.0.0.1、专用数据库 restaurant_p1；不要再次分享生成的 .env。

五、安装工作台依赖及已存在的 P1 数据库结构
  cd ~/GEO-share/repos/Elmo
  pnpm --version
  pnpm install --frozen-lockfile

数据库维护人先审核 packages/lib/src/db/migrations 下已存在的 SQL，确认 .env
指向刚创建的本机空库，明确批准后才能初始化；有数据的库先备份。
批准后，在同事自己的机器上手动执行：
  cd ~/GEO-share/repos/Elmo
  node --env-file=.env --import tsx scripts/restaurant-db.mts --apply-p1-local

这是仓库已有的本机 P1 初始化脚本，应用随包提供的既有 SQL（截至 0024），
不是根据最新 schema 生成新迁移。本次打包不执行这个命令、不修改任何数据库。
不要执行 drizzle-kit push / generate 来补齐尚未验收的新 GEO 表。

六、启动 P1
  cd ~/GEO-share
  bash mac/start-local.sh

出现 Vite 就绪提示后打开 http://localhost:3010/app/org/default/restaurants。
首次创建自己的网页管理员账号，随后管理品牌、门店、证据、确认版本和导出。
网页账号与数据库账号是两套账号。终端保持开启，Ctrl+C 停止网页。
仅监听本机；脚本只启动网页，不启动 AI worker，也不调用付费模型。
不要用 pnpm dev 启动整个上游服务集合；不要运行 Windows 的 .ps1 脚本。
“GEO 试点”栏目在新增表未安装时不可完整使用，这是本版本已知限制。

七、可选：P0 采集器和 Chromium
  cd ~/GEO-share/p0-browser
  pnpm --version
  pnpm install --frozen-lockfile
  pnpm exec playwright install chromium
  node src/cli.mjs doctor
  node src/cli.mjs demo

demo 仅访问本机模拟页面，不代表真实 AI 查询。
同事需自己登录项目专用 ChatGPT / Gemini 账号，完成真实探针和人工复核，
再运行正式批次。细节参见 p0-browser/README.md，将其中 Windows 路径改为本机路径。
本包没有 runs 目录，先新建计划：
  node src/cli.mjs init --batch easyjoy-pilot-001 --kind pilot
这只生成 166 条待运行计划，不发送问题。

PDF 所用 Playwright 由工作台依赖提供，另在其目录安装对应 Chromium：
  cd ~/GEO-share/repos/Elmo/apps/web
  pnpm exec playwright install chromium
报告流程仍待 GEO 数据库联调，装好浏览器不代表完整报告已验收。

八、可选：Python 官网检查组件
安装 Python 3.9+（例如本机 Python 3.12），在独立虚拟环境安装：
  cd ~/GEO-share
  python3 -m venv .geo-python
  .geo-python/bin/python -m pip install ./repos/geo-optimizer-skill
  export GEO_PYTHON="$PWD/.geo-python/bin/python"

Python 依赖目前是版本范围，不是完全离线的固定依赖安装包。
环境变量只影响当前终端及子进程；未装 GEO 表前保持 worker 关闭。
之后完成扩展数据库安装和验收，才在 Elmo 根目录通过独立入口启动：
  node --env-file=.env --import tsx apps/worker/src/geo-index.ts
该命令当前不是首次安装步骤，不要提前执行；它运行后会初始化 GEO 队列。

九、验收边界与排错
目前可先试用 P1；P0 有代码但真实账号及页面适配尚待验收。
官网真实预检成功，Google/Yelp 自动采集未通过；166 条真实执行、实际发布复测、
费用记账、飞书对接、连续运行、备份恢复及正式服务器部署未完成。
详细状态见 repos/Elmo/README-GEO-PILOT.md 与 DATABASE-CHANGE-REVIEW.md。

端口 3010 已占用：先结束占用它的程序，再启动。
数据库检查失败：检查服务、端口、密码、数据库所有者和 P1 是否初始化。
缺 Chromium：在对应项目目录执行上面的 playwright install chromium。
依赖安装被安全策略拦截：保留报错给开发者，不取消 minimumReleaseAge 等保护。
新开终端找不到 node/psql：重新设置第二节的 PATH。
macOS 版本太旧或二进制架构不一致：先核查系统及安装架构，不承诺强行兼容。

本包已进行源码/文件完整性及辅助脚本检查，未声称完成 Mac 实机运行验收。
