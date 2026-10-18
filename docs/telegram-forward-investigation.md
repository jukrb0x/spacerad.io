# Telegram 转发分类核对（2026-10-18）

基线 `85f7b7a18ea90f3d247e147b923678e8a4163c78`，主工作区最初干净。
交接补丁已检查 diff，且 `git apply --check` 通过后才分阶段应用。
实现位于独立 worktree `telegram-forward-classification/spacerad.io`，未提交或发布。

## 真实 DOM 证据

本地于 2026-10-18 23:10 CST 抓取 `/channel` 与 `https://t.me/s/SpaceRad_io`，
均 HTTP 200。按完整 `article.post-card` 边界核对，未以整页文本相邻关系判断。
截图本身不在交接包中；以下按交接提示的正文、日期与预览标识定位，不能恢复截图当时的响应。

| SpaceRad_io 帖子 | 正文 / 日期 | 回复与预览 | 本次线上最新页徽标 |
| --- | --- | --- | --- |
| [1280](https://t.me/SpaceRad_io/1280) | 大家好，我给大家表演一个咬赛博打火机；2026-04-13T11:47:24Z | 无回复；React 带来的生死疲劳预览，链接 `https://roriri.one/2026/04/12/what-a-react` | Forwarded from 螺莉莉的黑板报；源 `https://t.me/im_RORIRI/31801` |
| [1279](https://t.me/SpaceRad_io/1279) | 新华社对 token 的理解；2026-04-08T09:53:55Z | 无回复、无预览 | Forwarded from Cat Ch.；源 `https://t.me/usr_bin_cat/3709` |
| [1281](https://t.me/SpaceRad_io/1281) | 虽然很累，但先前我能说服自己；2026-04-13T11:48:40Z | 普通回复，引用 1280；无链接预览 | Original（保留） |

关键差异：本次 Telegram 最新页中，1280/1279 都有
`.tgme_widget_message_forwarded_from`，但其中来源名称均为
`<span class="tgme_widget_message_forwarded_from_name"><span dir="auto"></span></span>`。
1279 另有 `.tgme_widget_message_forwarded_from_author` 签名，不等同于来源名称。
1281 没有转发标记。完整三条上游 message wrap 保存在
`tests/fixtures/telegram-forward-capture.html`；其中公开 CDN 链接仅作抓包证据，测试不访问网络。

另直接抓取 `/channel/before-1282` 后，完整 1280/1279 卡片均显示 Original，
1281 也显示 Original。同轮直接抓取 `t.me/s/SpaceRad_io?before=1282` 却能读到
1280/1279 的来源名。说明名称在不同公开请求中可用性不同；未确定由何种上游条件导致。

## 已复现的直接根因与修复

旧 parser 只保留非空 `forwardedFrom`；PostCard 又用其真假判断转发，
使“有转发头、来源名为空”落入 Original。用真实最新页抓包经 HEAD parser 和
真实 PostCard 编译/渲染，1280 确实输出 Original（渲染断言预期 Forwarded 而失败）。
这不再只是合成候选场景。无法证明截图当时每个响应的具体缓存/部署状态。

保留候选补丁的最小实现：独立 `isForwarded` 记录转发头/来源元素存在性，
名称与来源链接继续可选；空名称显示 Forwarded。普通帖子和回复保留 Original。
未改 Channel CSS、布局、形状、SVG 或客户端导航。

新增真实抓包回归，覆盖同一数据经 latest/before/after 解析；同时保留候选中的
有名称/无名称/空白名称/危险链接/无 wrapper/普通帖子/回复测试。
分页断言使用离线抓包与真实 parser，并非声称抓取了真实 after 页。

## 验证

- 基线已有 Telegram/description：9 项通过。
- 应用实现前：新增测试出现 6 项预期失败（7 项原有测试通过）；真实 PostCard
  渲染也出现 `Original != Forwarded` 的行为失败。
- 最终 `node --test tests/telegram.test.mjs tests/channel-description.test.mjs tests/rss.test.mjs tests/spa-lifecycle.test.mjs`：23 项通过。
- 真实 Astro compiler + AstroContainer 渲染 5 张卡片：抓包 1280/1279 Forwarded，
  1281 Original；合成有来源名 42 显示来源链接；普通 42 保留 Original。
  断言也核对正文、回复目标和 React 预览。编译辅助脚本跳过 CSS 导入，未做浏览器视觉验证。
- `node --check` 两个变动的 TS/MJS 文件、变动 TS/MJS 的 Biome check、
  `git diff --check` 通过。候选测试仅做 Biome 排版调整。
- 未跑全量测试、build、全库类型检查或 watch；未启动浏览器/访问任何 WebKit 会话。
- 最初 `pnpm exec biome` 触发 pnpm 的运行前依赖检查，因 worktree 的 node_modules
  当时是目录软链接而失败；未安装新依赖或改变 lockfile。已改用已有依赖的逐项软链接和
  直接 Biome 二进制，最终格式检查通过。运行时 Node 26.11.0 / pnpm 12.10.1。

## 缓存及并行工作兼容性

当前基线只有页面 HTML `max-age=300, stale-while-revalidate=30`；已打开文档不会
自动刷新。本次响应未提供 Age 或 CF-Cache-Status，不把最新/历史页差异确诊为缓存。
未来发布后须待缓存过期/重新验证；本任务未 purge、commit、push 或 deploy。

独立缓存 worktree 的 `createChannelDataCache<T>` 直接序列化完整数据，合并时可保留
`isForwarded`，但若已有不带该字段的缓存，应升级数据 cache key 版本或在边界规范化，
以免旧的有名称转发被新 renderer 误判 Original。无法从旧数据恢复无名称转发状态，
必须重新抓取。两任务均修改 `src/utils/telegram.ts` 与 `memory/architecture.md`，
整合者需保留抓取选项/AbortSignal/缓存逻辑和本任务转发字段，并更新架构文档中的缓存说明。
本任务未更改缓存 worktree。

## 与新鲜度缓存整合

上述缓存策略及“未提交”描述记录独立排查完成时的状态。后续整合在
`codex/telegram-freshness-and-forward-status` 分支进行，保留双方测试和实现。
真实抓包 fixture 补入同一次原始 Telegram 响应的频道标题节点，以通过已批准的
页面结构守卫；不放宽验证、不伪造空频道标记。缓存键升级为 `v2`，新增回归证明
旧版缺少 `isForwarded` 的成功快照不会被复用。当前实际缓存策略见
`memory/architecture.md` 与 `docs/superpowers/plans/2026-10-18-channel-freshness-cache.md`。
测试 fixture 中另移除了回复链接上的一个无关畸形引号属性，使全仓 HTML 解析检查通过；
正文、转发、回复与预览节点均保留，原始响应及 DOM 仍完整保存在下方证据包。

## 可复核附件

完整原始响应、独立 article/message DOM、headers、红绿日志、渲染脚本及最终补丁在
`[local path]`。
解压后 `render-cards.mjs` 可从本 worktree 用 `node /解压路径/render-cards.mjs` 运行；
脚本将渲染结果写入 `/tmp/spaceradio-handoff-evidence/`（需先创建该目录）。
该辅助验证不启动服务或 watch；Node 原生 TS stripping 会输出实验性警告。
