---
id: note_tools_winbeau_026
slug: node-pnpm-install
title: "node-pnpm 安装"
summary: 👉 强烈推荐用 nvm（Node Version Manager），以后切换 Node 版本非常方便，不会把系统搞乱。
category: tools
tags: [pnpm, Node.js, 前端]
author: winbeau
createdAt: 2026-03-02T06:44:58Z
readMinutes: 4
notionUuid: 831fed6a-f36f-82c9-aecb-8111a973a3e5
---

## pnpm 管理host、port


```bash
pnpm exec vite --host 0.0.0.0 --port 8888
```


### 一、先装 Node.js（推荐用 nvm，最稳妥）

👉 **强烈推荐用 nvm**（Node Version Manager），以后切换 Node 版本非常方便，不会把系统搞乱。


#### 1️⃣ 安装 nvm

在终端里直接执行：


```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

装完后 **一定要重新加载环境**（或者关掉终端重开）：


```bash
source ~/.zshrc
```

检查是否成功：


```bash
nvm --version
```

能看到版本号就 OK。


---


#### 2️⃣ 用 nvm 安装 Node.js（LTS 版本）

推荐装 **LTS（长期支持版）**：


```bash
nvm install --lts
```

设置为默认版本：


```bash
nvm alias default 'lts/*'

```

验证：


```bash
node -v
npm -v
```

如果都能输出版本号，说明 Node + npm 已经装好了 ✅


---


### 二、安装 pnpm（官方推荐方式）

现在 Node 已经有了，装 pnpm 很简单。


#### 方式一（推荐）：用 corepack（Node 自带）

Node 16.13+ 自带 `corepack`，**这是官方最推荐方式**。


```bash
corepack enable
corepack prepare pnpm@latest --activate
```

验证：


```bash
pnpm -v
```

看到版本号就成功 🎉


### 三、最终检查清单（很重要）

你现在执行下面这些都应该 **不报错**：


```bash
node -v
npm -v
pnpm -v

```


---


### 四、常见坑位提醒 ⚠️

- ❌ **不要用 ****`apt install nodejs`**
    Ubuntu 仓库里的 Node 版本通常很老，容易踩坑

- ✅ 用 `nvm + corepack` 是目前最干净、最主流的方案
- 如果你以后装前端框架（Vite / Next.js / Vue / React），这套环境都完全没问题

---

如果你愿意，我也可以帮你：

- 检查你现在 Ubuntu 的版本
- 给你配 **pnpm + monorepo**
- 或者直接帮你初始化一个 `pnpm + vite / next` 项目
你现在是准备用 pnpm 干啥？😄
