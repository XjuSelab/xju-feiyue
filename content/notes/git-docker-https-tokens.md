---
id: note_tools_winbeau_032
slug: git-docker-https-tokens
title: "Git(docker tokens - https)"
summary: 该文档旨在解决 Docker 环境下 Git HTTPS 推送代码时需反复输入密码的问题，提供 Token 生成及持久化存储的最佳实践。
category: tools
tags: [Docker, 容器, Git, 工具]
author: winbeau
createdAt: 2026-03-02T06:45:05Z
readMinutes: 5
notionUuid: 635fed6a-f36f-829a-ac3d-0199bca85831
---

>
> #### Git 提交规范
>
>
> |  |  |  |
> | --- | --- | --- |
> | **类型 (type)** | **中文含义** | **适用场景** |
> | **feat** | 新功能 | 开发了新需求、新接口、新页面 |
> | **fix** | 修复 | 修复 Bug |
> | **docs** | 文档 | 仅修改了文档（README, 注释等） |
> | **style** | 格式 | 代码风格调整（空格、分号、缩进），不影响运行逻辑 |
> | **refactor** | 重构 | 代码重构（既不修复 Bug 也不添加新功能，优化逻辑） |
> | **perf** | 性能 | 提升性能的代码更改 |
> | **test** | 测试 | 添加或修改测试用例 |
> | **chore** | 杂项 | 构建过程或辅助工具的变动（如 build, ci, 依赖库升级） |
> | **revert** | 回滚 | 撤销之前的提交 |
>

该文档旨在解决 Docker 环境下 Git HTTPS 推送代码时需反复输入密码的问题，提供 Token 生成及持久化存储的最佳实践。


#### 1. 生成 GitHub Access Token

在使用 HTTPS 协议操作私有仓库时，需使用 Personal Access Token (PAT) 代替密码。

1. **访问生成页**：点击 [Generate new token (classic)](https://github.com/settings/tokens) 直达 GitHub 设置页。
1. **创建 Token**：
    - 点击 **Generate new token** -> **Generate new token (classic)**。
    - **Note**: 备注用途 (如 `Docker Dev`)。
    - **Expiration**: 建议设为 **No expiration** (永不过期) 以避免频繁更换。
    - **Scopes**: 勾选 **`repo`** (授予完全的仓库读写权限)。
1. **保存 Token**: 生成后请立即复制 (以 `ghp_` 开头)，刷新页面后将无法查看。

#### 2. 配置免密 (Credential Helper)

通过配置 Git 的凭证助手，可实现 Token 的自动存储与读取。


#### 方案 A：常规存储 (容器销毁即失)

适用于临时环境，Token 保存在容器内的 `~/.git-credentials`。


```bash
git config --global credential.helper store
```


#### 方案 B：持久化存储 (推荐 🚀)

适用于挂载了数据卷 (Volume) 的 Docker 环境。将凭证文件存在挂载目录 (如 `/workspace`)，**即使删除/重建容器，登录状态依然保留**。


```bash
# 指定凭证文件路径为挂载目录下的文件
git config --global credential.helper 'store --file /workspace/.git-credentials'
```


#### 3. 激活配置

配置完成后，需手动执行一次推送以触发保存机制：


```bash
git push
# Username: <你的GitHub用户名>
# Password: <粘贴刚才生成的 Token>
```

**成功推送一次后，Git 会自动在指定位置生成凭证文件，后续操作完全免密。**
