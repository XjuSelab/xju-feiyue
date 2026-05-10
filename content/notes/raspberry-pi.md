---
id: note_tools_winbeau_012
slug: raspberry-pi
title: 树莓派
summary: 本文档记录了在树莓派 (Ubuntu Server/Raspberry Pi OS) 上进行终端字体调整、Emoji 支持及中文环境配置的步骤。
category: tools
tags: [树莓派, 硬件]
author: winbeau
createdAt: 2026-03-02T06:44:51Z
readMinutes: 6
notionUuid: 33afed6a-f36f-838f-9e84-01c1215289ff
---

本文档记录了在树莓派 (Ubuntu Server/Raspberry Pi OS) 上进行终端字体调整、Emoji 支持及中文环境配置的步骤。


### 1. 终端字体大小调整

适用于 Ubuntu Server (无 GUI) 连接显示器时字体过小的情况。


#### 配置步骤

运行以下命令进入交互式配置界面：


```bash
sudo dpkg-reconfigure console-setup
```

**推荐配置选项：**

1. **Encoding**: `UTF-8`
1. **Character set**: `Guess optimal character set`
1. **Font**: `TerminusBold` (清晰度较高) 或 `VGA`
1. **Font size**:
    - 一般屏幕推荐 `8x16`
    - 高分屏 (如 27寸 2K) 推荐 **`16x32`** 或 `14x28`
配置完成后重启生效：


```bash
sudo reboot
```


---


### 2. Emoji 字体支持

安装以下字体库以确保在 CLI、终端及部分 GUI 应用中正常显示彩色 Emoji (如 🔵🟩🟦)。


#### 安装命令

适用于 Raspberry Pi OS / Ubuntu / Debian / WSL：


```bash
sudo apt update
# 安装 Google Noto Color Emoji 和 Symbola 兼容库
sudo apt install -y fonts-noto-color-emoji fonts-symbola
```


#### 验证


```bash
echo "test emoji: 😀🚀✨🔥❤️🟩🟥🟦中国🇨🇳"
```


---


### 3. 中文环境与 UTF-8 编码配置

解决中文显示为乱码、问号或方块的问题。核心在于**安装中文语言包**并**正确配置 UTF-8 编码**。


#### 3.1 安装中文语言包


```bash
sudo apt install -y language-pack-zh-hans
```


#### 3.2 配置 Locale

编辑 `/etc/default/locale` 文件：


```bash
sudo nano /etc/default/locale
```

确保文件内容如下（强制指定 UTF-8）：


```
LANG=en_US.UTF-8
LC_ALL=en_US.UTF-8
LC_CTYPE=en_US.UTF-8
LC_NUMERIC=en_US.UTF-8
LC_TIME=en_US.UTF-8
LC_COLLATE=en_US.UTF-8
LC_MONETARY=en_US.UTF-8
LC_PAPER=en_US.UTF-8
LC_NAME=en_US.UTF-8
LC_ADDRESS=en_US.UTF-8
LC_TELEPHONE=en_US.UTF-8
LC_MEASUREMENT=en_US.UTF-8
LC_IDENTIFICATION=en_US.UTF-8
```


#### 3.3 生成并更新 Locale


```bash
# 生成语言环境
sudo locale-gen en_US.UTF-8
sudo locale-gen zh_CN.UTF-8

# 更新环境变量
sudo update-locale LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
```


#### 3.4 重启验证

重启系统：


```bash
sudo reboot
```

验证当前 Locale：


```bash
locale
# 输出应包含 LANG=en_US.UTF-8 或 zh_CN.UTF-8 (取决于你的首选设置)
```
