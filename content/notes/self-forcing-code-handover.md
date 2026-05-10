---
id: note_tools_winbeau_023
slug: self-forcing-code-handover
title: "Self-Forcing Code Handover"
summary: 一键复制脚本已经写好了(docker_cp.sh) 不传参数也可以，默认名字是
category: tools
tags: [AI 训练, 工程]
author: winbeau
createdAt: 2026-03-02T06:45:03Z
readMinutes: 3
notionUuid: 77efed6a-f36f-8277-9459-81e76f0e76b0
---

> 🌟
> **直接复制docker最简单省事！**
>
> 测试了一键复制脚本，Claude Code、git、alias命令、zsh 提示信息等等都完好无损可以直接用
>
> **QA**
>
> 1. docker 挂载在哪里？
>     /root/ → ~/winbeau_zhao/Root/ | uv 管理的 torch 等等依赖都存在 /root/ 目录
>
>     /workspace/ → ~/winbeau_zhao/Workspace/ | 论文项目在 /workspace/ 目录
>
> 1. 新 docker 的 /root/ 目录挂载到 ~/winbeau_zhao/Root/，如果在 docker 内进行一些全局操作会不会造成一些不好的影响？
>     /root/ 里只有 uv packages cache、 zsh + starship 配置、NeoVim 配置、**.git-credentials 保存了 http的 GitHub 令牌**，除了 `cd /root && rm *` 99%不会有事
>
> 1. 新 docker 里有什么？
>     1. Claude Code (Opus 4.5 还有额度$253，anyrouter.top 免费领的)
>     1. zsh + starship 可以很好的显示 git 提交情况还有当前分支、当前的 uv 包环境


## 1. docker 复制

一键复制脚本已经写好了(docker_cp.sh) 不传参数也可以，默认名字是


```bash
cd ~/winbeau_zhao
./docker_cp.sh <docker-name>
```


## 2. git 仓库

创建了新分支 senior，在senior分支任意修改即可，对main分支不会有影响


```bash
cd /workspace/Self-Forcing-fork

# 设置仅在这个项目生效的邮箱和名字
git config --local user.name "Senior_Name"
git config --local user.email "senior@example.com"
# 这会让 Git 在处理这个项目时使用独立的凭据存储（如果需要）
git config --local credential.helper store
```
