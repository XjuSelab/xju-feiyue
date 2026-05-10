---
id: note_tools_winbeau_003
slug: esp32s3-board-dev
title: ESP32S3 板开发流程
summary: 只有“绑定（bind）”后的设备，才能被 WSL 共享。
category: tools
tags: [ESP32, 嵌入式]
author: winbeau
createdAt: 2026-03-02T06:45:07Z
readMinutes: 2
notionUuid: 73bfed6a-f36f-8335-bab2-819a35d46a6a
---

### 一、插线


### 二、打开 Power Shell

只有“绑定（bind）”后的设备，才能被 WSL 共享。

运行：


```powershell
usbipd bind --busid 1-1 # 绑定
usbipd attach --wsl --busid 1-1 # 挂载(若WSL未启动 先启动WSL)
```

（把 `1-3` 换成你刚才看到的 BUSID）

>
> #### 解绑错误设备
>
> 在 **Windows PowerShell（管理员）** 执行：
>
>
> ```powershell
> usbipd unbind --busid 1-1
> ```
>
> （把 `1-3` 替换成你绑定错的 BUSID）
>


### 三、打开 WSL Ubuntu


```bash
lsusb
ls /dev/ttyACM0
```


### 四、进入项目目录


```bash
pio run # 编译
pio run -t clean
pio run -t upload # 编译烧录
```


### 配置文件在


```bash
vim .pio/libdeps/esp32s3_devkit/TFT_eSPI/User_Setup.h   
```
