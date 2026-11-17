# VOL.16《给 Agent 装一块驾驶舱》agent-cockpit

- 标本: hermes-agent-workbench（前端 7,811 行 jsx / Django 后端，179 个测试，作者 starry-sea-1412）
- 旁证: video-agent-lab gate 门禁 + cc-probe Timeline + ai-image-studio execution-trace
- 主题: 暗色航电座舱（从 VOL.15 程序化换皮，变量名不动）
- 深度配方: 同一条事件流贯穿全篇（一次带审批的真实 run，10 个事件，六章各看一遍）

## 章节 ↔ 互动 ↔ 证据
01 盲飞（聊天窗口不是驾驶舱）| 互动01 盲飞对照台 | ChatView 966 行、ToolApprovalPanel 193 行
02 事件流（数据从哪来）| 互动02 事件流总装台 | 9 事件 projects.js:115-124、tool_approval payload、3s/5s 双轮询
03 五块仪表（状态穷举）| 互动03 状态机探照灯 | ToolExecution 8 态、STATUS_LABELS、AgentRun 5 态 max_steps=8
04 手不离杆（审批闸门）| 互动04 审批闸门 | APPROVAL_TIMEOUT=120、POLL_INTERVAL=0.1、CAS、幂等 200/409、event.wait()
05 黑匣子（三条纪律）| 互动05 黑匣子重放台 | Timeline [  218ms]、_mask、TRACE_LIMIT=40 同阶段合并、redact
06 警戒线（看门狗降级费用闸）| 互动06 看门狗 | AI_FIRST_TOKEN_TIMEOUT=90、中性降级样式、IN-1 费用闸门按段记账

## 图
FIG.A hero SVG（座舱+六仪表+事件流）FIG.B hero GIF；ch1-ch6 各一张 WebP（C..H）；动图 1-2 条
STYLE 后缀: 深炭灰蓝驾驶舱内景，荧光青绿描线主色，琥珀色点缀，手绘工程插画，粗描线扁平化，无文字数字标识，暗色航电面板质感
