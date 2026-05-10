---
id: note_tools_winbeau_042
slug: rpi5-alphadog-hotspot
title: Raspberry Pi5 + Windows 宿主机 + AlphaDog 热点网络共享配置
summary: 本项目架构中，树莓派 5 作为边缘计算节点，同时连接两个网络：
category: tools
tags: [树莓派, 硬件, AlphaDog, 网络]
author: winbeau
createdAt: 2026-04-02T05:36:10Z
readMinutes: 10
notionUuid: 336fed6a-f36f-8060-9d91-e8ac4fdf71ee
---

## 树莓派 5 (Ubuntu 24) 与 Windows 宿主机有线直连与网络共享配置指南


### 📑 场景与目标

本项目架构中，树莓派 5 作为边缘计算节点，同时连接两个网络：

1. **无线网络 (****`wlan0`****)**：连接机器狗的自带 WiFi（网段 `10.10.10.x`），用于下发控制指令和读取底层传感器数据。
1. **有线网络 (****`eth0`****)**：通过网线物理直连 Windows 主机。
    - **目标 1**：配置固定静态 IP，供 Windows 上的 PyQt 项目稳定连接并获取节点数据。
    - **目标 2**：通过 Windows 主机的网络共享功能，使树莓派能够访问外部互联网（包括通过 Windows 代理访问 GitHub/Google 等开发资源）。

---


### 🛠️ Step 1: Windows 端网络共享配置 (ICS)

首先需要让 Windows 将其连接外网的网卡（如 WiFi）网络共享给有线网口。

1. 打开 Windows **"控制面板"** → **"网络和共享中心"** → **"更改适配器设置"**
1. 找到当前正在连接互联网的网卡（如 `WLAN`）
1. 右键该网卡 → **"属性"** → **"共享"** 选项卡
1. 勾选 **"允许其他网络用户通过此计算机的 Internet 连接来连接"**
1. 在下拉菜单中选择连接树莓派的 **"以太网"** 适配器，点击"确定"
1. 打开 `cmd`，输入 `ipconfig`，确认"以太网"适配器已被 Windows 自动分配了网关 IP（通常是 **`192.168.137.1`**）

---


### 💻 Step 2: 树莓派端静态 IP 配置

Ubuntu 24 默认使用 `NetworkManager`，我们需要为 `eth0` 接口强制绑定 `192.168.137.x` 网段的静态 IP，并将网关指向 Windows 主机。

在树莓派终端中执行以下一键配置命令：


```bash
# 1. 创建名为 eth0-win 的新连接，绑定静态 IP (192.168.137.2)，设置网关和 DNS
sudo nmcli con add type ethernet ifname eth0 con-name eth0-win \
  ipv4.method manual \
  ipv4.addresses 192.168.137.2/24 \
  ipv4.gateway 192.168.137.1 \
  ipv4.dns "114.114.114.114 223.5.5.5"

# 2. 启用该网络配置
# 注意：执行此步时，当前的 SSH 可能会瞬间断开重连，属正常现象
sudo nmcli con up eth0-win
```

> ✅
> **验证配置：** 运行 `ip a` 命令，确认 `eth0` 接口下已出现 `inet 192.168.137.2/24`。
>


---


### 🔗 Step 3: 连通性测试

在两端分别进行 Ping 测试，确保局域网和外网均已打通。

**测试上位机连接（Windows ****`cmd`****）：**


```
ping 192.168.137.2
```

> 💡
> 通了即代表 PyQt 项目可以通过此 IP 稳定连接树莓派。
>

**测试外网连接（树莓派终端）：**


```bash
ping baidu.com
```

> 💡
> 通了即代表树莓派已成功通过 Windows 借道上网。
>


---


### 🌍 Step 4: 局域网代理配置（科学上网环境）

如果需要让树莓派的 `apt`、`pip`、`git` 等工具走 Windows 的代理通道：

1. 在 Windows 代理软件（如 v2rayN / Clash）中，开启 **"允许局域网连接"（Allow LAN）**，并确认代理端口（如 HTTP 端口 `10808`）
1. 在树莓派终端，临时设置环境变量（指向 Windows 的网关 IP）：

```bash
export http_proxy=http://192.168.137.1:10808
export https_proxy=http://192.168.137.1:10808
```

1. 正确测试代理连通性的方法：

```bash
curl -I https://www.google.com
```

> ✅
> 返回 **`HTTP/2 200`** 等正常 header 即代表代理配置成功。
>

> 💡
> **进阶提示：** 若需永久生效，可将 `export` 命令写入树莓派的 `~/.bashrc` 或 `~/.zshrc` 文件末尾，并执行 `source ~/.bashrc`。
>


---


### ⚠️ 踩坑与排错记录 (Troubleshooting)

> 🔴
> **坑点 1：nmcli manual 模式报错**
>
> **现象**：尝试先创建 `manual` 连接再修改 IP 时，报错 `Error: Failed to add 'eth0-win' connection: ipv4.method: method 'manual' requires at least an address or a route`。
>
> **原因**：`nmcli` 的严格校验机制要求在使用 `manual`（手动）模式时，必须在创建命令的同一行就提供 IP 地址。
>
> **解法**：如 Step 2 所示，将 `add` 和 `ipv4.addresses` 等参数合并为一条命令执行。
>

> 🔴
> **坑点 2：局域网能通，但树莓派连不上外网**
>
> **现象**：Windows 能 Ping 通树莓派，但树莓派 `ping baidu.com` 提示超时或无法解析。
>
> **原因**：Windows ICS（网络共享服务）偶发的路由假死（微软老毛病）。
>
> **解法**：在 Windows 网络适配器设置中，找到共享网络的 WiFi 网卡，**取消勾选**"允许其他网络用户..."，点击确定；再次进入属性，**重新勾选**并重新选择以太网，点击确定即可恢复。
>

> 🔴
> **坑点 3：设置了 Proxy 后，Ping Google 依然 100% 丢包**
>
> **现象**：已经配置了 `http_proxy`，但执行 `ping google.com` 依然超时。
>
> **原因**：`ping` 命令使用的是 **ICMP 协议**，而系统环境变量中的 HTTP/HTTPS 代理对 ICMP 协议无效，探测包会直接裸连公网并被墙拦截。
>
> **解法**：永远使用 `curl`（如 `curl -I https://www.google.com`）来测试代理网络连通性，而不要使用 `ping`。
>


![bd7c023f8ff2356f92c664de0a45e093.jpg](attachment:9d2a9cf7-6152-4588-a7dd-2c7bdbe804da:bd7c023f8ff2356f92c664de0a45e093.jpg)
