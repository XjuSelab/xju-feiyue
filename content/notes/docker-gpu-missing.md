---
id: note_tools_winbeau_019
slug: docker-gpu-missing
title: Docker 出现显卡丢失
summary: "之前环境配置（Zsh、Starship 等）丢失的原因是运行了基础镜像（nvidia/cuda:...），而非包含配置的构建后镜像。只要利用现有的 Dock…"
category: tools
tags: [Docker, 容器]
author: winbeau
createdAt: 2026-05-05T20:31:09Z
readMinutes: 7
notionUuid: e38fed6a-f36f-833f-b601-81f34e151ad3
---

## 问题分析

之前环境配置（Zsh、Starship 等）丢失的原因是运行了**基础镜像**（`nvidia/cuda:...`），而非包含配置的**构建后镜像**。只要利用现有的 `Dockerfile` 重新构建并运行，即可完全恢复环境。


## 操作步骤


#### 第一步：构建镜像 (Build)


#### 提交镜像也可以


```bash
docker commit -m "update environment or files" -a "intern" 1a63591b490e winbeau-dev:v2

```

在存放 `Dockerfile` 的目录下（即 `~/winbeau_zhao`），执行以下命令。这会将所有配置打包进一个新的镜像中。


```bash
# -t 指定镜像名称为 winbeau-image
# 注意命令最后有一个点 "." 代表当前目录
docker build -t winbeau-image .
```

*等待构建完成，直到出现 **`Successfully tagged winbeau-image:latest`**。*


#### 第二步：清理旧容器

删除可能存在的同名旧容器，释放名称占用：


```bash
docker rm -f winbeau
```


#### 第三步：启动新容器 (Run)

使用刚构建的 `winbeau-image` 启动容器。请直接复制以下命令（已包含 GPU、端口映射及正确的挂载路径）：


```bash
docker run --gpus all \
    -it --name winbeau \
    --shm-size=32g \
    -v /home/intern/winbeau_zhao/root:/root \
    -v /home/intern/winbeau_zhao/workspace:/workspace \
    -p 8889:8888 \
    winbeau-dev
```


```bash
docker run --gpus all \
    -it --name t2v-eval \
    --network host \
    --shm-size=32g \
    -v /home/intern/winbeau_zhao/tools:/tools \
    -v /home/intern/winbeau_zhao/localroot:/root \
    -v /home/intern/winbeau_zhao/localworkspace:/workspace \
    winbeau-dev:v4
```


---


#### 🚀 快速修复指令

在终端中执行以下命令来下载 Zsh 插件：


```bash
# 创建插件目录
mkdir -p /root/.zsh/plugins

# 下载自动建议插件
git clone https://github.com/zsh-users/zsh-autosuggestions /root/.zsh/plugins/zsh-autosuggestions

# 下载语法高亮插件
git clone https://github.com/zsh-users/zsh-syntax-highlighting /root/.zsh/plugins/zsh-syntax-highlighting

# 重新加载配置
source /root/.zshrc
```


## ⚠️ 注意事项：挂载覆盖问题

启动后如果发现 **Zsh 配置未生效** 或报错（如 `plugin not found`），通常是因为 Docker 的挂载机制：

- **原因**：宿主机的挂载目录（`/home/intern/winbeau_zhao/Root`）覆盖了容器内的 `/root` 目录，导致镜像构建时下载在容器 `/root` 下的配置文件被遮盖。
- **解决**：如果出现报错，请在容器内运行以下命令重新下载缺失插件：

```bash
mkdir -p /root/.zsh/plugins && \
git clone https://github.com/zsh-users/zsh-autosuggestions /root/.zsh/plugins/zsh-autosuggestions && \
git clone https://github.com/zsh-users/zsh-syntax-highlighting /root/.zsh/plugins/zsh-syntax-highlighting
```
