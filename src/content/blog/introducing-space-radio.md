---
title: "Space Radio: 我对数字营地的终极幻想"
published: 2026-02-03
tags: ["Astro", "Vibe Coding", "Web", "Blog"]
lang: zh
---



又搭建了一个新的网站。

上一次更新是在 23 年的 5 月份。等我重新想起来要翻新这个自留地的时候，我发现 everything is broken。React 大升级，Next.js 大升级，我选用的 Nextra（这个网站的基础框架）也做了非常多破坏性的升级。

这导致我之前的许多计划受到了影响。直白地说，当我准备继续开发那些尚未完成的功能时，发现自己被各种版本升级带来的问题困住了。与其在原有的~~史山代码~~基础上艰难前行，倒不如彻底推倒重来。

这个网站也是我用 Vibe Coding 构建一个完整项目的一次试验。我会介绍一下我是如何使用 AI 帮助我完成了这个网站 90% 的编码工作。

## 选型

从上一个博客中学到的最大教训，就是不要过度依赖外部框架。Nextra 是我的上一个博客系统的基础框架，它是一套基于Next.js 的静态站点生成系统。由于 React 的历史包袱太重，导致整套系统在后续的更新迭代中都非常难以维护。虽然有些问题在后续版本中可能已经不存在了，但做这些 patch 和升级的过程是非常让人心力交瘁的。我想要专注于内容，而不是在内容之外的技术框架上花费过多精力。

我重新调研了一波目前市面上比较成熟的静态站点生成方案。我用过很多SSG，像 Hexo、Hugo、VitePress 等，但我最后选择了 Astro：

1. 自定义程度高、实现上比较干净 (Vanilla)，现代化，架构成熟且没有什么技术债。
2. 适合静态站点，默认 Zero JavaScript shipped.
3. Astro Islands 架构，可以混用 React / Vue / Svelte, 可以 scale up.
4. 内容优先，Content Collections 对 Markdown/MDX 的内容工作流有天然支持。

如果使用 Vue、React 或者 Svelte 这些框架，需要花很多时间去实现各种基础功能，并且做大量的优化，才能打造一个性能优秀的静态站点，而 Astro 给开发者和内容创作者提供了一个非常优秀、非常干净的基建环境。

以下是技术选型清单：


| 类别     | 技术栈/内容                                             |
| :------- | :------------------------------------------------------ |
| Template | Astro                                                   |
| 构建工具 | Vite (Astro)                                            |
| 脚本语言 | TypeScript                                              |
| 样式处理 | UnoCSS + SCSS                                           |
| 交互组件 | Vanilla + Vue (大概率)                                  |
| 状态管理 | Nano Stores (遵循 Astro 官方建议，利于构建快速静态站点) |
| 评论系统 | Remark42 (需要从 Cusdis 做数据迁移)                     |

同时要满足如下标准：

1. 响应式、无障碍
2. 适合阅读、支持 RSS
3. 好看

## 风格

**Space Radio**, 我想到几个名字，但不太知道该怎么去翻译它 —— 太空电台、宇宙频道、天外来客、靡靡之音、卫星上天？

*这就是为啥你把鼠标放在导航栏的标题上，会出现不同的文字，因为我也没有想好应该怎么叫它。*

我想要的风格是简单简直接（minimal、linear），但不要过于“性冷淡”，有一点 Retro，但不能过于“废土”。

内容优先，一切内容都属于信息的快速获取以及我个人的表达。

## 内容

网站内容主要有如下两大构成：

1. **文章 (Blog)** - 应该成为这个静态站点 60% 的组份
2. **Memo (现在的 Channel 页)** - 快速想法、记忆片段、转载分享，它必须是动态的

## Vibe Coding

全站 90% 的编码基本由 AI 贡献，故本博客也算是个 V 博了。

> Vibe Coding 最核心的要点就是：你知道你真正要的是什么。你是整个系统的评估函数。

### 构建骨架

本站的骨架构建参考了许多 [Niracler 的博物志](https://niracler.com/design-primitives/)（也是通过 Vibe Coding 搭建的一个站点）里的实现：如 Telegram channel 作为动态分享卡片、文章内容页的交互分享组件和 TOC Drawer

但存在许多问题，在我搭建这个网站过程中逐一解决了，如：

- FOUC (Flash of unstyled content)
- 糟糕的状态管理
- CSS animation 的计算不稳定
- 100vh 问题 - iOS Safari 的动态高度地址栏的底部变成纯色
- 只有 Astro 模板做了文件结构的组件化，其余代码均存在较严重的耦合以及重复

虽然 Niracler 的网站存在诸多问题（大概率是由 Vibe Coding 带来的），但给我带来了许多很棒的 idea，在此表示致谢。

### 评论系统迁移

先前的博客使用 [Cusdis](https://github.com/djyde/cusdis) 作为评论系统。这是一个基于 Next.js、Postgres 和 SQLite 的轻量化评论系统，但是它的拓展性不够强。经过一番调研，我决定使用 [Remark42](https://github.com/umputun/remark42) 作为评论系统。同时我想保留我的评论数据，于是我需要一个数据库之间的迁移工具。

这个工具同样是使用 AI 对两套系统之间进行研究后匹配差异，使用 Go 写的从 Cusdis (Postgres-based) 到 Remark42 (BoltDB) 的迁移工具，代码库现已公开：https://github.com/jukrb0x/cusdis-to-remark42-migrator

### 布局和样式

基于 Astro 作为内容模板框架，网站的样式编写使用 UnoCSS + SCSS 完成，为提升阅读体验并减少页面跳转的不适感，我采用了 SPA 路由架构。

其余就是想要什么样的东西，就设计出什么样的东西，并按设计施工即可。

### 代码质量

我总结出以下几点，在 Vibe Coding 的过程中确保 AI 生成的代码质量符合预期。如前面所说：你是整个系统的评估函数。

1. 作为人类必须要有良好的代码品味。

2. 让 AI 去理解全局的代码和架构设计，并及时地去重构不好的代码。

3. 维护记忆文件，减少对话次数和由多次对话引起的上下文膨胀。我在仓库下维护了一个 `memory` 文件夹，这个目录下放有整个网站的架构设计、Design System 还有索引文件。

4. 告诉 AI 一些基本原则，参考 [AGENTS.md](https://github.com/jukrb0x/spacerad.io/blob/main/AGENTS.md)

   ```markdown
   ## Principles
   - Be excellent to others even there is only me
   - Write clean, maintainable, reusable code
   - Optimize for performance and accessibility
   - Use modern web standards and best practices
   - Prefer simplicity and minimalism over complexity
   - Document decisions and architecture for future reference
   - Automate repetitive tasks where possible
   - Update the memory docs as the project evolves
   ```

5. 使用优秀的模型，而不是能力平平的模型 —— 不要为了省钱而投入更多无效时间

6. 用合适的模型做合适的事：一般问题，如翻译、整合、迁移内容，使用 GLM 4.7；复杂问题，如代码理解、系统设计、编码，使用 Claude Opus/Sonnet

### 对模型的评价

经过这段时间的使用，我对 AI Model 的拟人化能力评价是这样的：

- **GLM-4.7** - 一个会写一点代码的大学生，有很强的学习能力，但是容易误入歧途（指的是被代码库里的代码污染），同时有点自大，会理直气壮地认为自己做的就是对的。

- **Opus/Sonnet** - 资深工程师，有自己的代码品味，很清楚复杂系统应该如何实现，同时不会为了垃圾代码迁就自己的实现，它无法说服自己在已经就很糟糕的💩山上的通过写一个更糟糕的代码来修复问题。

## 最后

虽然没有什么存活的文章，但从 2017 年起这个网站就存在了，期间也换过几次域名。

所以我想回归一下这个网站存在的初衷：
1. 定时 Dump 出我大脑中的想法、笔记和分享
2. 这不是一个技术型博客，而是对这个世界有不同视角的观察的一个记录
3. 什么是不会做的：时事评论、对立、宗教话题

从 2026 年起，我打算尽可能多地以文字形式，无论是短文还是长文，以稍长篇幅的文字去聊一件事情。

## 致谢

- https://tonsky.me
- [Niracler 的网站](https://niracler.com/design-primitives/)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines)
- [Anthony Fu](https://antfu.me)
- 全站使用的默认无衬线字体是 [MiSans](https://hyperos.mi.com/font/)
