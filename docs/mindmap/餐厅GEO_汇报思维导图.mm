<?xml version='1.0' encoding='utf-8'?>
<map version="1.0.1">
  <node TEXT="餐厅 GEO｜第一版建设方案" ID="ROOT" BACKGROUND_COLOR="#173249" COLOR="#ffffff">
    <font NAME="Microsoft YaHei" SIZE="24" BOLD="true" />
    <node TEXT="01 为什么做" ID="why" POSITION="left" COLOR="#137B78" FOLDED="false">
      <font NAME="Microsoft YaHei" SIZE="18" BOLD="true" />
      <edge COLOR="#137B78" WIDTH="3" />
      <node TEXT="顾客如何找餐厅｜附近地点 ＋ 预算 ＋ 用餐需求" ID="why-1" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="意义：AI 搜索可以围绕地点、预算、菜系和聚餐需求组织回答，餐厅需要了解自己何时被列入候选。" ID="why-1-detail-1" />
      </node>
      <node TEXT="信息影响当次选择｜菜单、价格与营业时间必须准确" ID="why-2" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="意义：餐饮信息具有时效性，错误营业时间、过期价格和失效订位链接会影响顾客行动。" ID="why-2-detail-1" />
      </node>
      <node TEXT="避免错认或遗漏｜区分品牌、分店与同名餐厅" ID="why-3" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="意义：推荐到错误分店、引用过期资料或遗漏本店，都需要保留证据后核查。" ID="why-3-detail-1" />
      </node>
      <node TEXT="把表现变成可管理的工作｜发现问题 → 修改 → 复测" ID="why-4" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="意义：投入由试点结果决定，不预设所有餐厅都应投入相同预算，也不承诺必然提高营收。" ID="why-4-detail-1" />
      </node>
    </node>
    <node TEXT="02 实现什么目标" ID="goals" POSITION="left" COLOR="#2B65AA" FOLDED="false">
      <font NAME="Microsoft YaHei" SIZE="18" BOLD="true" />
      <edge COLOR="#2B65AA" WIDTH="3" />
      <node TEXT="被准确识别｜名称、分店、地址和事实一致" ID="goals-1" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="观察：已确认资料覆盖率、跨渠道冲突、事实错误。" ID="goals-1-detail-1" />
      </node>
      <node TEXT="获得相关场景的正向推荐｜固定问题 × 地点 × 渠道持续采样" ID="goals-2" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="观察：分别记录提及、正向推荐、官网引用，同时显示有效样本和待复核数量。" ID="goals-2-detail-1" />
      </node>
      <node TEXT="承接顾客行动｜菜单、电话、订位、下单入口" ID="goals-3" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="观察：具备数据权限时记录点击、预约及订单入口访问；按钮点击不等于实际到店。" ID="goals-3-detail-1" />
      </node>
      <node TEXT="持续改进且成本可控｜证据可查，修改可复测，费用可核对" ID="goals-4" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="观察：任务完成情况、同条件复测、失败率与有效样本成本；经营变化不直接归因于 GEO。" ID="goals-4-detail-1" />
      </node>
    </node>
    <node TEXT="03 第一版功能" ID="features" POSITION="right" COLOR="#6552B5" FOLDED="false">
      <font NAME="Microsoft YaHei" SIZE="18" BOLD="true" />
      <edge COLOR="#6552B5" WIDTH="3" />
      <node TEXT="F1 门店资料与事实库｜地址／菜单／营业时间／来源版本" ID="features-1" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="为何需要：没有可信基准，无法判断 AI 回答是否准确；还必须区分品牌与分店。" ID="features-1-detail-1" />
        <node TEXT="具体工作：管理菜单规格、币种、餐次、节假日营业、来源、生效时间和商家确认；冲突进入待确认。" ID="features-1-detail-2" />
        <node TEXT="复用与自研：复用 Elmo 组织和品牌基础；自研门店层级、餐饮字段、资料来源与版本。" ID="features-1-detail-3" />
        <node TEXT="验收：同名门店不混淆，旧价格可追溯，未知信息不补造；没有官网也能监测。" ID="features-1-detail-4" />
      </node>
      <node TEXT="F2 餐饮场景问题库｜问题来源／场景分类／固定基线" ID="features-2" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="为何需要：临时生成的问题难以代表业务需求，也无法公平比较不同月份。" ID="features-2-detail-1" />
        <node TEXT="具体工作：按菜系、价位、场景分类；自然发现与品牌核实分开；支持批量导入、去重和版本。" ID="features-2-detail-2" />
        <node TEXT="复用与自研：复用 Elmo 问题管理与批量解析；自研餐饮模板、来源和基线版本。" ID="features-2-detail-3" />
        <node TEXT="验收：问题修改留新版本；品牌核实题不混入自然发现推荐率。" ID="features-2-detail-4" />
      </node>
      <node TEXT="F3 地点附近与查询场景｜位置参数／支持粒度／实际验证" ID="features-3" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="为何需要：把地名写进问题，只证明输入了文字，不能证明平台采用了该位置。" ID="features-3-detail-1" />
        <node TEXT="具体工作：记录渠道支持的国家或城市、实际请求参数、语言和时间；标记文本地点、参数已传、已抽查或不支持。" ID="features-3-detail-2" />
        <node TEXT="复用与自研：复用适配器结构；自研地点能力验证、参数透传、场景配置与版本。" ID="features-3-detail-3" />
        <node TEXT="验收：不支持的城市明确报错；城市级结果不标成街区精准定位；不静默退回国家级。" ID="features-3-detail-4" />
      </node>
      <node TEXT="F4 官网与渠道资料诊断｜可访问性／菜单／结构化数据／冲突" ID="features-4" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="为何需要：首页评分不足以覆盖菜单过期、错误营业时间和失效订位入口。" ID="features-4-detail-1" />
        <node TEXT="具体工作：检查官网、菜单和联系页面，核对已接入渠道；错误项记录原文、页面和时间。" ID="features-4-detail-2" />
        <node TEXT="复用与自研：复用 geo-optimizer-skill 网页检查；自研餐厅规则、菜单有效期和跨渠道比对。" ID="features-4-detail-3" />
        <node TEXT="验收：访问失败与字段缺失分开；没有官网显示不适用；llms.txt 不作为上线门槛。" ID="features-4-detail-4" />
      </node>
      <node TEXT="F5 多平台回答采集｜回答原文／引用／请求条件／错误" ID="features-5" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="为何需要：保留原始回答才能解释指标、复核判断和比较历史。" ID="features-5-detail-1" />
        <node TEXT="具体工作：按独立会话采样，记录服务商、查询方式、位置、模型标识、时间和引用。" ID="features-5-detail-2" />
        <node TEXT="复用与自研：复用 Elmo Provider 与回答采集框架；自研统一证据结构、场景传递和错误分类。" ID="features-5-detail-3" />
        <node TEXT="验收：模型 API、带搜索 API 与消费者网页分开统计；失败不记成未推荐。" ID="features-5-detail-4" />
      </node>
      <node TEXT="F6 推荐识别与事实核对｜正负推荐／分店匹配／人工复核" ID="features-6" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="为何需要：提到店名可能是中性或否定表述；同品牌另一分店不能算作本店推荐。" ID="features-6-detail-1" />
        <node TEXT="具体工作：区分正向、中性、负向、未提及与待复核；核对地址、营业时间和菜单事实。" ID="features-6-detail-2" />
        <node TEXT="复用与自研：复用店名匹配和引用解析作初筛；自研语义分类、分店识别与事实核对。" ID="features-6-detail-3" />
        <node TEXT="验收：人工样本覆盖否定、同名、分店混淆和错误事实；不确定结果可复核。" ID="features-6-detail-4" />
      </node>
      <node TEXT="F7 优化任务与同条件复测｜责任人／修改证据／发布／复测" ID="features-7" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="为何需要：检查结果必须转成实际修改，才能形成持续改善。" ID="features-7-detail-1" />
        <node TEXT="具体工作：从 F4、F6 创建任务，优先修正错误事实和失效入口；商家确认后发布并记录变更。" ID="features-7-detail-2" />
        <node TEXT="复用与自研：复用 geo 部分修复建议作草稿；自研任务状态、发布记录、回退材料和复测关联。" ID="features-7-detail-3" />
        <node TEXT="验收：至少一项真实问题完成确认、修改、发布登记与相同条件复测。" ID="features-7-detail-4" />
      </node>
      <node TEXT="F8 接口调度与费用控制｜批次／月度计划／重试／预算" ID="features-8" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="为何需要：批量、多渠道和每月自动运行，需要持久队列及统一成本管理。" ID="features-8-detail-1" />
        <node TEXT="具体工作：限速、超时、有限重试、去重、预算预留；每次调用尝试独立留痕。" ID="features-8-detail-2" />
        <node TEXT="复用与自研：复用 Elmo Worker 和 pg-boss；自研餐饮批次、预算、月度计划与成本对账。" ID="features-8-detail-3" />
        <node TEXT="验收：重启可恢复；重复触发不重复计样本；超时可能已收费，需核对账单。" ID="features-8-detail-4" />
      </node>
      <node TEXT="F9 看板与飞书报告｜分项指标／证据入口／任务协作" ID="features-9" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="为何需要：让运营与商家看懂变化、查到依据并明确下一步。" ID="features-9-detail-1" />
        <node TEXT="具体工作：展示提及、推荐、引用、事实错误、有效样本、费用和修改任务；同步飞书关联表。" ID="features-9-detail-2" />
        <node TEXT="复用与自研：复用 Elmo 基础报表和飞书 API；自研餐厅口径、业务映射与更新去重。" ID="features-9-detail-3" />
        <node TEXT="验收：飞书真实写入与更新成功；重复同步不增行；主库结果不因同步失败而丢失。" ID="features-9-detail-4" />
      </node>
    </node>
    <node TEXT="04 功能如何协作" ID="flow" POSITION="right" COLOR="#198098" FOLDED="false">
      <font NAME="Microsoft YaHei" SIZE="18" BOLD="true" />
      <edge COLOR="#198098" WIDTH="3" />
      <node TEXT="资料诊断流程｜F1 → F4 → F7 → 重新检查" ID="flow-1" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="说明：确认门店事实，检查官网及渠道，生成修改任务，再核验修改是否实际生效。" ID="flow-1-detail-1" />
      </node>
      <node TEXT="回答监测流程｜F2＋F3 → F8 → F5 → F6" ID="flow-2" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="说明：用固定问题和位置条件组织采样，保留回答后进行推荐识别与事实核对。" ID="flow-2-detail-1" />
      </node>
      <node TEXT="持续改进流程｜F6 → F7 → 同条件复测" ID="flow-3" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="说明：发现回答问题后，确认来源和修改；按原问题、渠道、地点与版本条件复测。" ID="flow-3-detail-1" />
      </node>
      <node TEXT="全流程支撑｜F8 统一调度与费用 · F9 汇总报告" ID="flow-4" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="说明：共用客户权限、原始证据和版本；自然发现查询不额外注入目标餐厅宣传资料。" ID="flow-4-detail-1" />
      </node>
    </node>
    <node TEXT="05 开源与自研" ID="build" POSITION="left" COLOR="#A66B20" FOLDED="false">
      <font NAME="Microsoft YaHei" SIZE="18" BOLD="true" />
      <edge COLOR="#A66B20" WIDTH="3" />
      <node TEXT="复用 geo-optimizer-skill｜网页检查与部分修复建议" ID="build-1" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="定位：作为网站诊断组件，接入后台检查任务并输出分项结果。" ID="build-1-detail-1" />
        <node TEXT="边界：网站规则分不是实际推荐率，餐厅专属规则和渠道核对需要开发。" ID="build-1-detail-2" />
      </node>
      <node TEXT="优先验证 Elmo｜问题管理、采集适配、任务与报表" ID="build-2" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="定位：作为候选监测基础，真实查询、定位与账单验证通过后再进入批量试点。" ID="build-2-detail-1" />
        <node TEXT="边界：现有店名匹配仅作初筛，不能直接代表正向推荐。" ID="build-2-detail-2" />
      </node>
      <node TEXT="重点自研：餐厅核心能力｜事实版本、定位验证、推荐与分店判断" ID="build-3" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="范围：F1 餐厅事实、F3 位置条件、F6 推荐与事实判断，以及 F7 修改复测流程。" ID="build-3-detail-1" />
      </node>
      <node TEXT="重点自研：自动化与协作｜业务批次、预算、飞书更新与去重" ID="build-4" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="范围：F8 的持久计划和成本控制，F9 的餐厅统计、飞书业务映射和经营记录。" ID="build-4-detail-1" />
      </node>
      <node TEXT="其他项目的角色｜GetCito 备选 · GEORank 工作流参考" ID="build-5" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="说明：第一版先选一个监测基础；GetCito 固定版本说明衍生自 Elmo，避免同时维护两个相近系统。" ID="build-5-detail-1" />
      </node>
      <node TEXT="当前验证边界｜网页审计已跑通；真实模型查询待补测" ID="build-6" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="已知：EasyJoy 网页审计有用户截图；Elmo 有源码和离线测试证据。" ID="build-6-detail-1" />
        <node TEXT="待验证：真实附近请求、单次账单、真实飞书写入和服务器月度自动运行。" ID="build-6-detail-2" />
      </node>
    </node>
    <node TEXT="06 实施与验收" ID="delivery" POSITION="right" COLOR="#3B7B4B" FOLDED="false">
      <font NAME="Microsoft YaHei" SIZE="18" BOLD="true" />
      <edge COLOR="#3B7B4B" WIDTH="3" />
      <node TEXT="A 验证外部依赖｜真实查询、位置、计费、飞书权限" ID="delivery-1" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="交付：确认门店资料与账号，运行少量真实请求；不支持的功能明确记录。" ID="delivery-1-detail-1" />
      </node>
      <node TEXT="B 单店流程 → C 批量自动化｜再接月度计划、预算和飞书协作" ID="delivery-2" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="交付：单店完成采集、判断、报告；随后加入去重、恢复、费用上限与修改复测。" ID="delivery-2-detail-1" />
        <node TEXT="环境：后台服务需持续在线，不能依赖休眠的个人电脑。" ID="delivery-2-detail-2" />
      </node>
      <node TEXT="D 两店试点：240 个计划样本｜示例规模，尚未执行完整批次" ID="delivery-3" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="计算：2 家店 × 10 题 × 2 渠道 × 2 地点场景 × 3 次重复 × 1 语言 = 240；均以实际支持的条件为准。" ID="delivery-3-detail-1" />
        <node TEXT="费用：增加语言组、辅助判断和重试另计；真实账单核对后再确定单次成本。" ID="delivery-3-detail-2" />
      </node>
      <node TEXT="完成标准：有证据的业务流程｜采集可查、判断可复核、修改有复测" ID="delivery-4" FOLDED="true" COLOR="#20384d">
        <font NAME="Microsoft YaHei" SIZE="14" />
        <node TEXT="验收：原文和条件可追溯；同名、分店及否定样本可正确处理；任务可恢复、同步无重复。" ID="delivery-4-detail-1" />
        <node TEXT="统计：网站分数、提及、推荐和经营结果分开；三次采样不足以证明小幅变化有效。" ID="delivery-4-detail-2" />
      </node>
    </node>
  </node>
</map>