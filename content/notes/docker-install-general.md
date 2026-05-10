---
id: note_tools_winbeau_044
slug: docker-install-general
title: "docker 安装-普适"
summary: 这份文档为你总结了在 Ubuntu（特别是树莓派等 ARM 架构设备）上从零安装 Docker、配置无 sudo 访问以及设置双层代理的完整流程。你可以直接…
category: tools
tags: [Docker, 容器]
author: winbeau
createdAt: 2026-04-22T13:54:13Z
readMinutes: 9
notionUuid: 33efed6a-f36f-80d3-971a-e22873c67643
---

这份文档为你总结了在 Ubuntu（特别是树莓派等 ARM 架构设备）上从零安装 Docker、配置无 `sudo` 访问以及设置双层代理的完整流程。你可以直接收藏，下次换新机时直接复制粘贴。


---


### 🛠️ 第一阶段：安装 Docker Engine

清理旧版本并从官方源安装，确保版本最新且安全。


#### 1. 清理旧版


```bash
sudo apt-get remove docker docker-engine docker.io containerd runc
```


#### 2. 安装基础依赖


```bash
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg lsb-release
```


#### 3. 添加 GPG 密钥与仓库（避坑版）


```bash
# 创建密钥目录
sudo mkdir -p /etc/apt/keyrings

# 下载密钥
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 写入软件源（注意 [arch=...] 别被翻译成"座机"）
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```


#### 4. 正式安装


```bash
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-compose-plugin
```


---


### 🔐 第二阶段：配置非 Root 用户权限

解决每次都要敲 `sudo` 的烦恼。


#### 1. 加入 Docker 组


```bash
sudo usermod -aG docker $USER
```


#### 2. 即时生效（无需注销）


```bash
newgrp docker
```

> 💡
> 如果某些 IDE（如 VS Code）还是提示没权限，请彻底重启系统。
>


---


### 🌐 第三阶段：双层代理配置（核心）

这是解决"下载镜像慢"和"容器内没网"的关键。


#### 第一层：Daemon 代理（解决 `docker pull` 慢）

作用于 Docker 后台服务，专门负责下载镜像。

**创建目录：**


```bash
sudo mkdir -p /etc/systemd/system/docker.service.d
```

**新建配置文件：**


```bash
sudo nano /etc/systemd/system/docker.service.d/http-proxy.conf
```

**写入内容：**


```
[Service]
Environment="HTTP_PROXY=http://127.0.0.1:10808"
Environment="HTTPS_PROXY=http://127.0.0.1:10808"
Environment="NO_PROXY=localhost,127.0.0.1"
```

**重载配置：**


```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
```


#### 第二层：Client 代理（解决容器内部连网）

作用于容器内部，比如你在容器里运行 `pip install` 或 `apt update`。

**新建配置文件：**


```bash
nano ~/.docker/config.json
```

**写入内容：**


```json
{
  "proxies": {
    "default": {
      "httpProxy": "http://127.0.0.1:10808",
      "httpsProxy": "http://127.0.0.1:10808",
      "noProxy": "localhost,127.0.0.1"
    }
  }
}
```


---


### ✅ 第四阶段：验证与常用命令


| **任务** | **命令** |
| --- | --- |
| 验证安装 | `docker version` |
| 验证权限 | `docker run hello-world`（不带 sudo） |
| 验证代理 | `docker info \| grep Proxy` |
| 查看容器 | `docker ps -a` |
| 开机自启 | `sudo systemctl enable docker` |


---


### 💡 避坑小贴士

> 1️⃣
> **IP 地址**：这里的 `192.168.137.1` 通常是 Windows 主机的虚拟网卡 IP（开启网络共享后的默认 IP）。如果换了环境，记得用 `ipconfig` 或 `hostname -I` 确认。
>

> 2️⃣
> **代理软件设置**：记得在你的代理客户端（如 Clash、V2Ray）中开启 **"Allow LAN"（允许来自局域网的连接）**，否则树莓派访问不到主机的端口。
>

> 3️⃣
> **NO_PROXY**：如果你自己搭建了私有仓库（Registry），一定要把私有仓库的 IP 加入 `NO_PROXY`。
>
