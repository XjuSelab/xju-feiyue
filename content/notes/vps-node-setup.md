---
id: note_tools_winbeau_018
slug: vps-node-setup
title: VPS 结点配置
summary: 在 Ubuntu 上安装 Xray（Project X）最推荐、最方便的方式是使用官方提供的一键安装脚本。这不仅能自动检测架构，还会自动配置 systemd…
category: tools
tags: [Node.js, 前端, VPS, 服务器]
author: winbeau
createdAt: 2026-03-10T15:13:05Z
readMinutes: 20
notionUuid: a16fed6a-f36f-8233-9285-818195c2916d
---

## 海外 VPS


### 安装 Xray

在 Ubuntu 上安装 Xray（Project X）最推荐、最方便的方式是使用官方提供的一键安装脚本。这不仅能自动检测架构，还会自动配置 systemd 服务。

以下是针对 Linux 环境（适合你的 CS 背景）的详细步骤：


#### 1. 准备工作

首先，确保你的系统是最新的，并安装必要的工具（`curl` 和 `unzip` 是必须的）。


```bash
sudo apt update
sudo apt install -y curl zip unzip
```


#### 2. 使用官方脚本安装

Project X 官方提供了一个脚本，可以一键安装或升级 Xray-core，并自动处理 GeoIP 和 GeoSite 文件。

运行以下命令进行安装：


```bash
bash -c "$(curl -L [https://github.com/XTLS/Xray-install/raw/main/install-release.sh](https://github.com/XTLS/Xray-install/raw/main/install-release.sh))" @ install
```

**该脚本主要做了以下几件事：**

- 将 Xray 二进制文件安装到 `/usr/local/bin/xray`
- 将配置文件目录创建在 `/usr/local/etc/xray/`
- 将资源文件（geoip.dat, geosite.dat）放在 `/usr/local/share/xray/`
- 创建并启用 systemd 服务：`xray.service`

#### 3. 配置 Xray

安装完成后，Xray 不会自动运行，因为它需要一个有效的配置文件。默认的配置文件路径是 `/usr/local/etc/xray/config.json`。

你需要先生成一个 UUID（用户 ID）：


```bash
xray uuid
# 输出示例: 00484590-25e2-4809-9852-04022631557c (记下这个 ID)
```

使用你喜欢的编辑器（既然你用 Vim/LazyVim，我就直接写 vim 了）编辑配置：


```bash
sudo vim /usr/local/etc/xray/config.json
```

这里提供一个**最简化的服务端配置模板**（VLESS + TCP + XTLS-rprx-vision 是目前较推荐的组合，或者简单的 VLESS+TCP）：


```json
{
  "log": {
    "loglevel": "warning"
  },
  "inbounds": [
    {
      "port": 443,
      "protocol": "vless",
      "settings": {
        "clients": [
          {
            "id": "你的UUID_填在这里",
            "flow": "xtls-rprx-vision",
            "email": "[user@example.com](mailto:user@example.com)"
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
              "certificateFile": "/path/to/your/certificate.crt",
              "keyFile": "/path/to/your/private.key"
            }
          ]
        }
      }
    }
  ],
  "outbounds": [
    {
      "protocol": "freedom"
    }
  ]
}
```

> 注意：如果你没有域名和证书，或者只是想先测试连通性，可以先配置一个简单的 VMess 或 VLESS (不带 TLS)，将端口改为非 443（如 8080），并去掉 streamSettings 中的 TLS 部分。
>


#### 4. 启动与管理服务

配置完成后，启动服务：


```bash
# 启动 Xray
sudo systemctl start xray

# 设置开机自启
sudo systemctl enable xray

# 检查运行状态
sudo systemctl status xray
```

如果启动失败，可以通过查看日志来 Debug：


```bash
journalctl -u xray --no-pager | tail -n 20
```


#### 5. 防火墙设置

别忘了在防火墙放行你在配置文件中设定的端口（例如上面的 443 或 8080）。如果你使用的是 Ubuntu 默认的 `ufw`：


```bash
sudo ufw allow 443/tcp
sudo ufw reload
```


---


#### 常用命令备忘

- **手动更新 GeoIP/GeoSite 库：**

```bash
bash -c "$(curl -L [https://github.com/XTLS/Xray-install/raw/main/install-release.sh](https://github.com/XTLS/Xray-install/raw/main/install-release.sh))" @ install-geodata
```

- **卸载 Xray：**

```bash
bash -c "$(curl -L [https://github.com/XTLS/Xray-install/raw/main/install-release.sh](https://github.com/XTLS/Xray-install/raw/main/install-release.sh))" @ remove
```


### 配置 Xray (Reality)

既然你决定用 Reality，那我们就来个“一把梭”。要让本机的客户端连上服务器，核心在于**服务器的配置**和**客户端的填空**必须严格对应。

请按照以下 3 步操作，保证你能连上。


#### 第一步：获取 3 个关键凭证（在 VPS 上执行）

在你修改服务器配置前，我们需要先生成“钥匙”。请在 Ubuntu 终端依次运行这 3 条命令，并**把结果复制到一个记事本里备用**：

1. **生成 UUID (用户ID)**

```bash
xray uuid
```

> 🔥
> root@SelabVPS:~# xray uuid
e01c08c2-c370-482c-a997-3fd16607c724
>

1. **生成 密钥对 (Public Key 和 Private Key)**

```bash
xray x25519
```

    *
注意：你会得到两行，一行是 Private Key（填服务器），一行是 Public Key（填本机客户端）。千万别搞混！*

> 🔥
> root@SelabVPS:~# xray x25519
PrivateKey: uKBktpFHJFs2QYz_CpjDfU4VEIY4MmwgM1F2UYBCKks
Password: uOtUbqTx4UNJXIJ3xUmQlgyHDr4aBZj1sITwxMu2dmE
Hash32: -C5E0lx_Vwlhq2ahHJT23Pt_-gsjCPofihGZUnTuqMY
>

1. **生成 ShortId**

```bash
openssl rand -hex 8
```

> 🔥
> root@SelabVPS:~# openssl rand -hex 8
1744e58d702c656b
>

> 🌟
>
> ```vhdl
> root@selab:~# xray uuid
a27eeb4f-60c1-421a-8e44-2abc0a52829e
root@selab:~# sudo vim /usr/local/etc/xray/config.json
root@selab:~# xray x25519
PrivateKey: wOEyzZ0D9Xgd_C8Nw0GZagF-kE4OGCW6gnqhnwvAJng
Password: Wtp7gTkXyZc2Mp6DakWeC8TyjZKRIZ6ipI0VsUN99ns
Hash32: EbL5F9ALzXJo41DwAnouURox5m5XxL5gjJiOjRSvmDE
root@selab:~# openssl rand -hex 8
a5b05614c169a240
> ```
>


#### 第二步：写入服务器配置（在 VPS 上执行）

使用 Vim 修改配置文件：


```bash
sudo vim /usr/local/etc/xray/config.json
```

清空文件（在 Normal 模式按 dG），然后粘贴下面的内容。

> **重要：** 必须把下面代码里标注中文的地方，替换成你第一步记下来的内容。
>


```json
{
  "log": {
    "loglevel": "warning"
  },
  "inbounds": [
    {
      "port": 443,
      "protocol": "vless",
      "settings": {
        "clients": [
          {
            "id": "把你的UUID填在这里",
            "flow": "xtls-rprx-vision",
            "email": "[me@example.com](mailto:me@example.com)"
          }
        ],
        "decryption": "none"
      },
      "streamSettings": {
        "network": "tcp",
        "security": "reality",
        "realitySettings": {
          "show": false,
          "dest": "[www.microsoft.com:443](http://www.microsoft.com:443)",
          "serverNames": [
            "[www.microsoft.com](http://www.microsoft.com)",
            "[www.azure.com](http://www.azure.com)"
          ],
          "privateKey": "把你的Private Key填在这里",
          "shortIds": [
            "把你的ShortId填在这里"
          ]
        }
      },
      "sniffing": {
        "enabled": true,
        "destOverride": ["http", "tls"]
      }
    }
  ],
  "outbounds": [
    {
      "protocol": "freedom",
      "tag": "direct"
    },
    {
      "protocol": "blackhole",
      "tag": "block"
    }
  ]
}
```

保存退出 (`:wq`)，然后重启 Xray：


```bash
sudo systemctl restart xray
sudo systemctl status xray
```

*确保看到绿色的 **`active (running)`**。*


#### 第三步：本机客户端连接（最关键的一步）

假设你电脑上用的是 **v2rayN** (Windows) 或者 **V2Box / Shadowrocket** (Mac/iOS)，或者 Linux 上的 **v2rayA**。

请**手动添加**一个节点，类型选择 **VLESS**，然后按照下面的表格逐一填写。**错一个字都连不上**。


| **客户端选项 (英文/中文)** | **填入内容** | **说明** |
| --- | --- | --- |
| **Address (地址/IP)** | `你的VPS公网IP` | 不要填域名，直接填 IP |
| **Port (端口)** | `443` | 必须对应配置文件里的 port |
| **UUID (用户ID)** | `你的UUID` | 第一步生成的那个长字符串 |
| **Flow (流控)** | `xtls-rprx-vision` | **极其重要**，不填会被限速或阻断 |
| **Network (传输协议)** | `tcp` | 选 TCP |
| **Security (传输层安全)** | `reality` | **注意：**这里不要选 TLS，要选 **Reality** |
| **SNI / ServerName** | [`www.microsoft.com`](http://www.microsoft.com) | 必须和服务器配置的一样 |
| **Fingerprint (指纹)** | `chrome` | 模拟 Chrome 浏览器 |
| **PublicKey (公钥)** | `你的Public Key/Passward` | **这是最大的坑！** 这里填第一步生成的 **Public Key**，不是 Private Key |
| **ShortId (简略ID)** | `你的ShortId` | 第一步生成的那个短字符串 |
| **SpiderX** | (留空) | 不需要填 |


#### 常见排错 CheckList

如果你填完后，只有发送没有接收（无法上网），请检查：

1. **Public Key 填反了没？** 客户端里必须填 `Public Key`，服务器配置文件里填 `Private Key`。
1. **核心版本太老？** Reality 是新协议，如果你的客户端（v2rayN 等）很久没更新，可能不支持。请确保 Xray 核心版本至少在 **1.8.0** 以上。
1. **时间同步：** 你的本机时间和 VPS 时间误差不能超过 90 秒，否则无法连接。
填好后，先在客户端里测一下**真连接延迟**（不是 Ping，是 TCP 连接测试），如果有数字（比如 200ms），那就说明通了！


## 海外 VPS 启用 TUN 与优化

既然你的 Xray 已经跑通了，现在的 VPS 设置主要围绕 **“加速”**、**“稳定”** 和 **“安全”** 这三个维度。

针对你作为 CS 学生的背景，以下是建议在 VPS 上必须执行的几项优化操作（直接在 SSH 终端执行即可）：


#### 1. 开启 TCP BBR 加速 (最重要)

BBR 是 Google 开发的 TCP 拥塞控制算法，能显著提高在有丢包网络环境下的吞吐量（就是让你看视频不卡）。

复制粘贴执行：


```bash
echo "net.core.default_qdisc=fq" >> /etc/sysctl.conf
echo "net.ipv4.tcp_congestion_control=bbr" >> /etc/sysctl.conf
sysctl -p
```

**检查是否生效：**


```bash
lsmod | grep bbr
```

*如果输出里有 **`tcp_bbr`**，说明开启成功。*


#### 2. 增加 Swap 虚拟内存 (防崩溃)

大部分 VPS 内存较小（比如 512MB 或 1GB）。如果内存跑满了（比如系统更新或 Xray 突发流量），Linux 会触发 OOM Killer 把 Xray 杀掉，导致你断连。

加 1GB 的 Swap 可以保命：


```bash
# 创建 1GB 的 swap 文件
fallocate -l 1G /swapfile
# 设置权限
chmod 600 /swapfile
# 格式化并启用
mkswap /swapfile
swapon /swapfile
# 设置开机自动挂载
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```


#### 3. 强制时间同步 (Reality 核心要求)

Reality 协议对时间非常敏感，客户端和服务端时间误差不能超过 90 秒。VPS 运行久了时间可能会偏。


```bash
# 安装 chrony (比 ntp 更快更准)
apt update && apt install -y chrony
# 立即启动并同步
systemctl enable chrony --now
chronyc makestep
```

**验证：** 输入 `date`，看输出的时间是否和现在的 UTC 时间（或你当地时间）对得上。


#### 4. 基础安全防护 (UFW 防火墙)

虽然你之前开放了 443，但建议明确关闭不必要的端口，防止被扫描爆破。


```bash
# 1. 允许 SSH (非常重要！否则你会把自己锁在外面)
ufw allow ssh
# 或者如果你的 ssh 端口不是 22，比如是 12345： ufw allow 12345/tcp

# 2. 允许 Xray 端口
ufw allow 443/tcp
ufw allow 80/tcp

# 3. 启用防火墙
ufw enable
```

*输入 **`y`** 确认开启。*


#### 5. (可选) 安装 Docker 环境

既然你是搞开发的，VPS 除了翻墙，以后肯定会用来跑 Docker 项目（比如你提到的 lab 资料站）。现在装好 Docker 备用：


```bash
curl -fsSL [https://get.docker.com](https://get.docker.com) | bash
```


---


### 总结

你现在的 VPS 状态应该是：

1. **Xray 服务**：运行中 (Reality + Vision)
1. **网络**：已开启 BBR 加速
1. **内存**：有 Swap 防止崩溃
1. **时间**：自动同步
> **接下来的建议：**
>
> 尽量不要去折腾这台 VPS 的网络设置（比如乱改 IP table），也不要在这台机器上跑 BT 下载，这样能保证你的 IP 长期稳定。
>
> **如果在 Tun 模式下遇到问题，或者想在这个 VPS 上部署你的 Python/Vue 项目，随时告诉我。**
>
