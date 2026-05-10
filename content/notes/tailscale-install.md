---
id: note_tools_winbeau_036
slug: tailscale-install
title: Tailscale 安装
summary: 在拥有 sudo 权限的 Linux 服务器上，执行官方一键安装脚本：
category: tools
tags: [Tailscale, VPN, 网络]
author: winbeau
createdAt: 2026-03-20T16:01:45Z
readMinutes: 9
notionUuid: 328fed6a-f36f-8010-b573-f8c69df33182
---

> 📡
> 这份文档总结了我们在香港纯 CPU 服务器上部署和优化 Tailscale 的全过程。它涵盖了从基础安装到解决系统资源瓶颈，再到实现"全速直连"的核心配置。
>


---


## Tailscale 香港服务器极速部署与优化指南 (2026版)


### 一、基础安装与环境准备

在拥有 `sudo` 权限的 Linux 服务器上，执行官方一键安装脚本：


```bash
curl -fsSL https://tailscale.com/install.sh | sh
```


---


### 二、系统资源调优 (解决 "Too many open files")

针对资源受限或负载较高的服务器（如本次遇到的 `container` 与 `python` 占用过高问题），必须提升内核句柄上限，否则会由于无法打开配置文件导致 `sudo` 或 `systemctl` 失效。


#### 1. 永久提升系统限制

编辑 `/etc/sysctl.conf`，在末尾添加：


```
fs.file-max = 500000
fs.inotify.max_user_instances = 1024
fs.inotify.max_user_watches = 524288
```

执行 `sudo sysctl -p` 立即生效。


#### 2. 提升用户级限制

编辑 `/etc/security/limits.conf`，添加：


```
* soft nofile 65535
* hard nofile 65535
root soft nofile 65535
root hard nofile 65535
```


---


### 三、网络性能优化 (实现"无损"连接)

针对香港到内地的跨境链路，开启 **BBR 加速** 和 **IP 转发** 是跑满带宽的关键。


#### 1. 开启 BBR 与 IP 转发


```bash
echo "net.core.default_qdisc=fq" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.tcp_congestion_control=bbr" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.ip_forward = 1" | sudo tee -a /etc/sysctl.conf
echo "net.ipv6.conf.all.forwarding = 1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```


#### 2. 固定 Tailscale 监听端口 (强制 P2P 直连)

为了穿透机房防火墙，建议固定使用 UDP 41641 端口。

编辑 `/etc/default/tailscaled`：


```
FLAGS="--port=41641"
```

重启服务：


```bash
sudo systemctl restart tailscaled
```


---


### 四、核心功能部署

执行以下命令上线，并开启 **出口节点 (Exit Node)** 和 **Tailscale SSH** 功能：


```bash
sudo tailscale up --advertise-exit-node --ssh --reset
```


#### 关键步骤

1. **管理后台授权**：登录 [Tailscale Admin Console](https://login.tailscale.com/admin/machines)，找到该机器，在 **Edit route settings** 中勾选 **Exit Node**。
1. **取消 SSH 二次验证 (可选)**：在后台 **ACL** 设置中，将 `ssh` 策略的 `action` 从 `check` 改为 `accept`，即可实现免网页点击秒连。

---


### 五、共享与连接策略


#### 1. 共享给他人

- 在后台点击 **Share**，生成邀请链接。
- 勾选 `Allow use as an exit node` 和 `Allow Tailscale SSH access`。
- **对方要求**：必须安装并登录 Tailscale 客户端，然后点击分享链接接受。

#### 2. 客户端连接测试

在本地终端执行，确认是否为 **direct** (直连)：


```bash
tailscale ping [服务器内网IP]
# 预期输出：via [公网IP]:41641, direct
```


#### 3. SSH 连接方式

- **Tailscale SSH (推荐)**：`tailscale ssh root@[内网IP]`
- **Mosh 加速 (对抗延迟抖动)**：`mosh root@[内网IP]`（需在服务器安装 `apt install mosh`）

---


### 六、常用维护命令卡片


| **命令** | **用途** |
| --- | --- |
| `tailscale status` | 查看当前所有节点连接状态 |
| `tailscale ip -4` | 获取本机内网 IP |
| `tailscale netcheck` | 检查当前网络是否支持 UDP 直连 |
| `lsof -n \| awk '{print $1}' \| sort \| uniq -c \| sort -rn \| head` | 诊断文件句柄占用大户 |
| `journalctl -u tailscaled -f` | 查看 Tailscale 实时运行日志 |


---

> 💡
> **文档说明**：本方案已在香港 CPU 服务器验证通过。若未来遇到连接变慢，优先检查 UDP 41641 端口在服务商防火墙（安全组）中是否保持开启。
>
