---
id: note_tools_winbeau_008
slug: wsl-git-ssh-cheatsheet
title: WSL Git(SSH) 操作速查表
summary: "示例配置（HTTP 代理 127.0.0.1:9098）："
category: tools
tags: [SSH, 网络, Git, 工具]
author: winbeau
createdAt: 2026-03-02T06:44:59Z
readMinutes: 7
notionUuid: 426fed6a-f36f-835e-8939-0118b7a9c01c
---

## 新服务器配置 && git https 切换 git ssh


## WSL Git + SSH 操作速查表


### 1️⃣ 进入仓库


```bash
cd ~/dl-setup    # 替换成你的项目目录
ls -la           # 查看文件确认位置
```


### 2️⃣ 初始化仓库（第一次创建）


```bash
git init
git branch -M main           # 改名为 main
git config --global user.name "winbeau"
git config --global user.email "geneva4869@163.com"
```


### 3️⃣ 添加文件 & 提交


```bash
git add .                    # 添加所有文件到暂存区
git commit -m "Initial commit"  # 提交到本地仓库
```


### 4️⃣ 远程仓库操作


```bash
git remote add origin git@github.com:winbeau/dl-jupyter.git  # SSH
git remote -v          # 查看远程仓库
git remote remove origin  # 删除远程仓库（如果要改地址）
```


### 5️⃣ 推送 / 拉取


```bash
git push -u origin main   # 第一次推送并建立跟踪关系
git push                  # 后续推送更新
git pull                  # 拉取远程更新
```


### 6️⃣ 查看状态和历史


```bash
git status                # 查看修改状态
git log --oneline         # 查看提交历史
git diff                  # 查看修改细节
git branch                # 查看本地分支
git branch -r             # 查看远程分支
```


### 7️⃣ SSH + 代理设置（WSL 特殊情况）


```bash
nano ~/.ssh/config
```

示例配置（HTTP 代理 127.0.0.1:9098）：


```
Host github.com
  HostName github.com
  User git
  Port 22
  IdentityFile ~/.ssh/id_ed25519
  ProxyCommand nc -X connect -x 127.0.0.1:9098 %h %p
```

- SOCKS5 代理改为：

```
  ProxyCommand nc -X 5 -x 127.0.0.1:9098 %h %p
```

- 测试 SSH：

```bash
ssh -T git@github.com
```


### 8️⃣ 常用快捷操作


```bash
git add <file>           # 添加单个文件
git commit -am "msg"     # 修改+提交（已经 add 过的文件）
git push origin main     # 推送到远程 main 分支
git checkout -b dev      # 创建并切换到新分支 dev
git merge dev            # 合并 dev 分支到当前分支
git stash                # 临时保存未提交修改
git stash pop            # 恢复临时保存的修改
```


### 9️⃣ HTTPS 备用方案（当 SSH 被封）


```bash
git remote set-url origin https://github.com/winbeau/dl-jupyter.git
git config --global credential.helper store   # 保存 PAT
git push                                       # 会要求输入用户名+PAT
```


---

> ⚠️ 代理小提示：

- http_proxy/https_proxy 只对 HTTPS 生效，SSH 需配置 ProxyCommand。
- 第一次 SSH 连接 GitHub 会提示确认指纹，输入 `yes` 即可。
