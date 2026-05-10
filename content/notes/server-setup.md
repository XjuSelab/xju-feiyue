---
id: note_tools_winbeau_027
slug: server-setup
title: 服务器配置
summary: 安装内核头文件(可不选)
category: tools
tags: [服务器, Linux]
author: winbeau
createdAt: 2026-03-02T06:44:50Z
readMinutes: 2
notionUuid: afcfed6a-f36f-826e-a5bd-813e56672378
---

### 防止超时断连


```python
sudo vim /etc/ssh/sshd_config
# ClientAliveInterval 60 每60s查一次
# ClientAliveCountMax 99999 改为99999 近似无限次
sudo systemctl restart sshd
```


### 驱动失效重装

安装内核头文件(可不选)


```bash
sudo apt update
sudo apt install -y dkms build-essential linux-headers-$(uname -r)
```

安装**开源版本**（5090后只支持开源版本 MIT）


```bash
wget https://us.download.nvidia.com/XFree86/Linux-x86_64/580.95.05/NVIDIA-Linux-x86_64-580.95.05.run
sudo bash NVIDIA-Linux-x86_64-580.95.05.run --dkms --disable-nouveau
```


### 服务器清理


```bash
sudo du -h --max-depth=1 / | sort -hr | head -n 20
```
