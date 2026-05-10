---
id: note_tools_winbeau_021
slug: xray
title: Xray
summary: "本文档分为 海外服务器端配置 与 本地/国内服务器客户端配置 两部分，旨在搭建一个基于 VLESS + XTLS-Vision 的高效安全代理服务。"
category: tools
tags: [Xray, 代理, 网络]
author: winbeau
createdAt: 2026-03-02T06:45:04Z
readMinutes: 20
notionUuid: 04bfed6a-f36f-83b5-9d24-010b41228e88
---

## zgovps


### Xray 自启动


## Xray 配置指南 (VLESS + TCP + TLS)

本文档分为 **海外服务器端配置** 与 **本地/国内服务器客户端配置** 两部分，旨在搭建一个基于 VLESS + XTLS-Vision 的高效安全代理服务。

> n
>
> ## 1. 海外服务器端配置 (Server)
>


#### 1.1 安装 Xray

使用官方推荐的一键脚本安装（自动安装程序、配置文件及 systemd 服务）：


```bash
bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
```

- **程序路径**: `/usr/local/bin/xray`
- **配置路径**: `/usr/local/etc/xray/config.json`
- **服务状态**: `systemctl status xray`

#### 1.2 配置服务

编辑主配置文件：


```bash
sudo nano /usr/local/etc/xray/config.json
```

写入以下内容：


```json
{
  "log": { "loglevel": "warning" },
  "inbounds": [
    {
      "port": 443,
      "protocol": "vless",
      "settings": {
        "clients": [
          {
            "id": "bf182c5b-bb65-49fa-a84c-506263fa5f4d", 
            "flow": "xtls-rprx-vision"
          }
        ],
        "decryption": "none"
      },
      "streamSettings": {
        "network": "tcp",
        "security": "tls",
        "tlsSettings": {
          "certificates": [
            {
              "certificateFile": "/etc/ssl/private/fullchain.cer",
              "keyFile": "/etc/ssl/private/private.key"
            }
          ]
        }
      }
    }
  ],
  "outbounds": [{ "protocol": "freedom" }]
}
```

> 💡 UUID 已恢复。若需重新生成可使用命令：`cat /proc/sys/kernel/random/uuid`


#### 1.3 权限与端口绑定

为了让 Xray 能绑定 443 端口并读取证书，建议修改 systemd 服务以 root 身份运行（或通过 setcap 授权）。

编辑 `/etc/systemd/system/xray.service`，确保 `[Service]` 段配置正确：


```
[Unit]
Description=Xray Service
After=network.target nss-lookup.target

[Service]
User=root
CapabilityBoundingSet=CAP_NET_ADMIN CAP_NET_BIND_SERVICE
AmbientCapabilities=CAP_NET_ADMIN CAP_NET_BIND_SERVICE
NoNewPrivileges=true
ExecStart=/usr/local/bin/xray run -c /usr/local/etc/xray/config.json
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

重载配置：


```bash
sudo systemctl daemon-reload
```


#### 1.4 申请 TLS 证书

使用 [acme.sh](http://acme.sh) 申请 Let's Encrypt 证书：


```bash
# 1. 安装 socat (acme.sh 依赖)
sudo apt update && sudo apt install -y socat

# 2. 安装 acme.sh
curl https://github.com/acmesh-official/acme.sh/blob/master/acme.sh | sh
source ~/.bashrc

# 3. 申请证书 (替换为你的域名)
~/.acme.sh/acme.sh --issue --standalone -d your.domain.com

# 4. 安装证书到指定目录
~/.acme.sh/acme.sh --install-cert -d your.domain.com \
    --key-file       /etc/ssl/private/private.key  \
    --fullchain-file /etc/ssl/private/fullchain.cer \
    --reloadcmd     "systemctl restart xray"
```


#### 1.5 启动服务


```bash
sudo systemctl enable xray
sudo systemctl restart xray
sudo systemctl status xray
```


---

>
> ## 2. 本地/国内客户端配置 (Client)
>


#### 2.1 安装 Xray 核心

适用于无图形界面的 Linux 服务器。

1. **下载**: 从 GitHub Release 下载 [`Xray-linux-64.zip`](http://Xray-linux-64.zip)。
1. **安装**:

```bash
unzip Xray-linux-64.zip -d /usr/local/xray
chmod +x /usr/local/xray/xray
ln -sf /usr/local/xray/xray /usr/local/bin/xray

# 放置资源文件
mkdir -p /usr/local/share/xray
cp /usr/local/xray/geo* /usr/local/share/xray/

# 准备配置目录
mkdir -p /usr/local/etc/xray
```


#### 2.2 客户端配置

编辑 `/usr/local/etc/xray/config.json`：


```json
{
  "log": { "loglevel": "warning" },
  "inbounds": [
    { "port": 10809, "listen": "127.0.0.1", "protocol": "socks", "settings": { "auth": "noauth" } },
    { "port": 10810, "listen": "127.0.0.1", "protocol": "http",  "settings": { "timeout": 0 } }
  ],
  "outbounds": [
    {
      "protocol": "vless",
      "settings": {
        "vnext": [
          {
            "address": "my-domain.online",
            "port": 443,
            "users": [
              {
                "id": "bf182c5b-bb65-49fa-a84c-506263fa5f4d",
                "encryption": "none",
                "flow": "xtls-rprx-vision"
              }
            ]
          }
        ]
      },
      "streamSettings": {
        "network": "tcp",
        "security": "tls",
        "tlsSettings": { "serverName": "my-domain.online" }
      }
    }
  ]
}
```


#### 2.3 管理脚本 (一键开关 VPN)


#### 启动脚本 (`~/`[`start-vpn.sh`](http://start-vpn.sh))


```bash
#!/bin/bash
# 启动 Xray 并设置代理环境变量
# 用法: source ~/start-vpn.sh

XRAY_BIN="/usr/local/bin/xray"
XRAY_CONF="/usr/local/etc/xray/config.json"
XRAY_LOG="$HOME/xray.log"

# 清理旧进程
pkill -f "$XRAY_BIN run" >/dev/null 2>&1

# 启动后台进程
nohup "$XRAY_BIN" run -c "$XRAY_CONF" >"$XRAY_LOG" 2>&1 &
sleep 1

if pgrep -x "xray" >/dev/null; then
    echo "✅ Xray Started."
else
    echo "❌ Start Failed. Check log: $XRAY_LOG"
    return 1
fi

# 设置环境变量
export http_proxy="http://127.0.0.1:10810"
export https_proxy="http://127.0.0.1:10810"
export all_proxy="socks5://127.0.0.1:10809"

echo "🌐 Proxy Env Set. Testing connectivity..."
curl -s --max-time 5 google.com >/dev/null && echo "✅ Google Connectable" || echo "⚠️  Network Check Failed"
```


#### 关闭脚本 (`~/`[`stop-vpn.sh`](http://stop-vpn.sh))


```bash
#!/bin/bash
unset http_proxy https_proxy all_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY
pkill -f "/usr/local/bin/xray run"
echo "🛑 Xray Stopped & Proxy Unset."
```


#### 使用方法


```bash
source ~/start-vpn.sh  # 开启
source ~/stop-vpn.sh   # 关闭
```


---


#### 附录：Windows 客户端链接 (v2rayN/NekoBox)


```
vless://bf182c5b-bb65-49fa-a84c-506263fa5f4d@my-domain.online:443?encryption=none&flow=xtls-rprx-vision&security=tls&sni=my-domain.online&type=tcp&headerType=none#My-Xray-VPS
```


## VPS 放行防火墙（支持Tun）

下面为你整理一份 **HostHatch VPS（基于 nftables）开启端口放行的完整文档**，包含你刚才遇到的问题与解决步骤，适合作为记录或发给他人直接使用。


---


## 📘 **HostHatch VPS：防火墙（nftables）放行端口设置文档**

HostHatch 新版系统（Debian 12 / Ubuntu 22.04+）默认使用 **nftables** 而不是 iptables。

因此传统的 iptables 命令（例如 `--dport`）会报错，必须改用 nft。


---


## 📌 **一、检查系统是否使用 nftables**

执行：


```bash
nft list tables
```

若看到：


```
table inet ...

```

说明系统已经启用 nftables。


---


## 📌 **二、创建 nftables 的 filter 表（若不存在）**

如果系统中还没有 `inet filter` 表，请手动创建：


```bash
sudo nft add table inet filter

```


---


## 📌 **三、创建 input 链（用于处理进入 VPS 的请求）**

在 zsh 下必须用引号包住 `{}`，否则会报语法错误。

正确写法：


```bash
sudo nft add chain inet filter input ' { type filter hook input priority 0; policy accept; } '

```

说明：

- `hook input`：让链接管进入 VPS 的流量
- `policy accept`：默认允许（你也可以改成 drop）

---


## 📌 **四、放行需要的端口（例如 443）**


### 放行 TCP 443：


```bash
sudo nft add rule inet filter input tcp dport 443 accept

```


### 放行 UDP 443：


```bash
sudo nft add rule inet filter input udp dport 443 accept

```

说明：

- 大多数代理协议（VLESS、VMess、Trojan 等）都需要 TCP
- FakeIP / TUN / 游戏代理通常还需要 UDP

---


## 📌 **五、查看当前规则（确认是否成功）**


```bash
sudo nft list ruleset

```

正常输出示例：


```
table inet filter {
    chain input {
        type filter hook input priority 0; policy accept;
        tcp dport 443 accept
        udp dport 443 accept
    }
}

```

你应该能看到两个规则（tcp/udp）。


---


## 📌 **六、让规则在重启后仍然生效（可选但推荐）**

Debian/Ubuntu 保存 nft 配置：


```bash
sudo sh -c "nft list ruleset > /etc/nftables.conf"
sudo systemctl enable nftables

```

重启测试：


```bash
sudo reboot

```

验证：


```bash
sudo nft list ruleset

```


---


## 📘 **完整参考示例（可以直接复制运行）**


```bash
sudo nft add table inet filter

sudo nft add chain inet filter input ' { type filter hook input priority 0; policy accept; } '

sudo nft add rule inet filter input tcp dport 443 accept
sudo nft add rule inet filter input udp dport 443 accept

sudo sh -c "nft list ruleset > /etc/nftables.conf"
sudo systemctl enable nftables

```


---


## 🎯 文档总结（简版）


| 目的 | 命令 |
| --- | --- |
| 创建 filter 表 | `nft add table inet filter` |
| 创建 input 链 | `nft add chain inet filter input ' {...} '` |
| 放行 TCP 443 | `nft add rule inet filter input tcp dport 443 accept` |
| 放行 UDP 443 | `nft add rule inet filter input udp dport 443 accept` |
| 查看规则 | `nft list ruleset` |
| 保存规则 | `nft list ruleset > /etc/nftables.conf` |


---

如果你需要，我还能帮你进一步整理成：

- Markdown 文档（适合保存）
- Shell 自动化脚本
- 配套 v2rayN 设置指南
- HostHatch VPS 最佳优化指南
你需要哪一种？我可以直接生成。
