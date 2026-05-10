---
id: note_tools_winbeau_035
slug: tailscale-lan
title: "Tailscale-服务器建立局域网"
summary: 服务器端需要开 两个终端：
category: tools
tags: [Tailscale, VPN, 网络]
author: winbeau
createdAt: 2026-03-20T16:01:45Z
readMinutes: 3
notionUuid: 31efed6a-f36f-80cf-9c67-c742970a4af0
---

服务器端需要开 **两个终端**：

**终端 1：启动 tailscaled**


```bash
cd ~/tailscale_1.66.4_amd64
mkdir -p $HOME/.tailscale
./tailscaled \
  --tun=userspace-networking \
  --socks5-server=localhost:1055 \
  --state=$HOME/.tailscale/tailscaled.state \
  --socket=$HOME/.tailscale/tailscaled.sock
```

**终端 2：启动端口转发**


```bash
cd ~/tailscale_1.66.4_amd64
./tailscale --socket=$HOME/.tailscale/tailscaled.sock serve --tcp 2222 127.0.0.1:22
```

> 🔥
> **获取服务器实际监听的 SSH 端口**
>
> 服务器 SSH 不一定跑在默认的 22 端口，用以下两条命令快速确认：
>
>
> ```bash
> echo $SSH_CONNECTION
# 输出格式：客户端IP 客户端端口 服务器IP 服务器端口
# 最后一个数字就是当前 SSH 会话实际连入的服务端端口
> ```
>
>
> ```bash
> ss -tln
# 确认该端口确实在监听
> ```
>
> 例如 `$SSH_CONNECTION` 末尾是 **51702**，则 Tailscale 转发应写：
>
>
> ```bash
> ./tailscale ... serve --tcp 2222 127.0.0.1:51702
> ```
>
> 而不是 `127.0.0.1:22`。
>

本地端连接命令：


```bash
ssh intern@100.125.120.21 -p 2222
```

要点：

- 服务器端这 **两个终端都不能关**
- 关掉终端 1，Tailscale 断开
- 关掉终端 2，2222 到 22 的转发失效

---
