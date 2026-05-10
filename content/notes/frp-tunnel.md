---
id: note_tools_winbeau_015
slug: frp-tunnel
title: frp 内网穿透
summary: 本文档详细说明如何利用 FRP (Fast Reverse Proxy) 将内网 GPU 服务器的服务暴露到公网，实现“公网访问内网服务”的需求。
category: tools
tags: [frp, 内网穿透]
author: winbeau
createdAt: 2026-03-02T06:44:50Z
readMinutes: 12
notionUuid: 299fed6a-f36f-82c1-8967-01026857d4ce
---

## FRP 内网穿透部署指南

本文档详细说明如何利用 **FRP (Fast Reverse Proxy)** 将内网 GPU 服务器的服务暴露到公网，实现“公网访问内网服务”的需求。


---


### 1. 架构与准备


#### 架构原理

- **公网服务器 (Server / frps)**: 具有固定公网 IP，负责监听连接并转发流量。
- **内网服务器 (Client / frpc)**: 运行实际业务（如 Deep Learning 后端、SSH 等），无公网 IP，位于 NAT 之后。

#### 准备工作

- **公网服务器**: 确认公网 IP (例如 `1.2.3.4`)，并配置防火墙放行相关端口 (7000, 9090 等)。
- **内网服务器**: 确认本地服务端口 (例如 Docker 容器映射的 `8890` 端口)。
- **软件下载**: [FRP Github Releases](https://github.com/fatedier/frp/releases) (通常为 `frp_x.x.x_linux_amd64.tar.gz`)。

---


### 2. 公网服务端配置 (frps)

在 **公网 CPU 服务器** 上进行以下操作。


#### 2.0 防火墙开放端口

> - 开放 FRP 监听端口 7000
> - 开放 FRP 隧道转发端口 8000 (或xxxx)


#### 2.1 配置文件 `frps.toml`

解压 FRP 后，修改 `frps.toml` 文件。只需保留最基础的配置：


```toml
# ====================================
# 公网服务器配置 (frps.toml)
# ====================================

# 1. FRP 服务端监听端口 (私网服务器通过这个端口连上来)
bindPort = 7000

# 2. 身份验证 (必须和客户端一样)
auth.method = "token"
auth.token = "@Geralt123"

# 3. (可选) 如果你以后想看仪表盘，可以加 dashboardPort，暂时不需要
```


#### 2.2 配置 Systemd 自启动 (推荐)

使用 systemd 管理服务可确保开机自启和崩溃重启。

1. **创建服务文件**:

```bash
sudo vim /etc/systemd/system/frps.service
```

1. **写入内容** (注意修改 `ExecStart` 路径):

```
[Unit]
Description=Frp Server Service
After = [network.target](http://network.target)

[Service]
Type=simple
# 如需以特定用户运行，取消注释下行
# User=ubuntu

# 【重要】修改为 frps 的绝对路径
ExecStart=/home/ubuntu/frp/frps -c /home/ubuntu/frp/frps.toml

Restart=on-failure
RestartSec=5s

[Install]
WantedBy=[multi-user.target](http://multi-user.target)
```

1. **启动服务**:

```bash
sudo systemctl daemon-reload
sudo systemctl enable frps  # 设置开机自启
sudo systemctl start frps   # 立即启动
```


---


### 3. 内网客户端配置 (frpc)

在 **内网 GPU 服务器 (huaweiT4)** 上进行以下操作。


#### 3.1 配置文件 `frpc.toml`

修改 `frpc.toml`，配置连接信息和端口映射。

> **注意**: 确保 `auth.token` 与服务端一致。`localPort` 应填写实际服务的端口 (如 Docker 映射出的 8890)。


```toml
# ====================================
# 私网服务器配置 (frpc.toml)
# ====================================

serverAddr = "82.157.209.193"
serverPort = 7000

auth.method = "token"
auth.token = "@Geralt123"

[[proxies]]
name = "fastapi-backend"  # 名字改一下，清楚一点
type = "tcp"
localIP = "127.0.0.1"

# 【改动1】localPort 改为 8000 (FastAPI 标准端口)
localPort = 8000        

# 【改动2】remotePort 改为 8000 (保持一致，方便记忆)
remotePort = 8000
```


#### 3.2 配置 Systemd 自启动

1. **创建服务文件**:

```bash
sudo vim /etc/systemd/system/frpc.service
```

1. **写入内容**:

```
[Unit]
Description=Frp Client Service
# 客户端需等待网络完全就绪
After = [network.target](http://network.target) [network-online.target](http://network-online.target)
Wants = [network-online.target](http://network-online.target)

[Service]
Type=simple
User=winbeau  # 建议使用当前用户运行

# 【重要】修改为 frpc 的绝对路径
ExecStart=/home/jiayu/winbeau_zhao/frp/frpc -c /home/jiayu/winbeau_zhao/frp/frpc.toml

Restart=on-failure
RestartSec=5s

[Install]
WantedBy=[multi-user.target](http://multi-user.target)
```

1. **启动服务**:

```bash
sudo systemctl daemon-reload
sudo systemctl enable frpc
sudo systemctl start frpc
```


---


### 4. 验证与排查


#### 常用管理命令

- **查看状态**: `sudo systemctl status frps` (服务端) / `frpc` (客户端)
- **查看日志**: `journalctl -u frps -f` / `frpc`
- **重启服务**: `sudo systemctl restart frps` / `frpc`

#### 常见问题 (Troubleshooting)


#### 1. 报错 `status=1/FAILURE` 或 Parse Error

**原因**: 配置文件中包含不可见的特殊字符或不被支持的中文注释（尤其是在复制粘贴时）。

**解决**:

- 手动运行排查: `/path/to/frpc -c /path/to/frpc.toml` 查看具体报错。
- **重建纯净配置**: 删除原文件，手动输入或复制无注释的纯净配置。

#### 2. 报错 `connect to server error`

**原因**: 网络不通或端口被防火墙拦截。

**解决**:

- 检查 `serverAddr` 是否正确。
- 检查公网服务器的安全组/防火墙是否放行了 `7000` (bindPort) 和 `9090` (remotePort)。

#### 3. 验证穿透是否成功

在浏览器或终端访问: [`http://公网IP:9090`](http://公网IP:9090)。如果能正常访问内网服务，说明配置成功。
