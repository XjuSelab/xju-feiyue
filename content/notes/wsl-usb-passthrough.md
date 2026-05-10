---
id: note_tools_winbeau_029
slug: wsl-usb-passthrough
title: Windows USB 设备透传至 WSL 配置指南
summary: "本文档记录如何使用 usbipd-win 将 Windows 主机的 USB 设备（如串口调试器、开发板）透传至 WSL2 环境中。"
category: tools
tags: [USB, WSL, 硬件, 工具]
author: winbeau
createdAt: 2026-03-02T06:44:53Z
readMinutes: 4
notionUuid: 12cfed6a-f36f-8320-91db-814ee39d4fde
---

本文档记录如何使用 `usbipd-win` 将 Windows 主机的 USB 设备（如串口调试器、开发板）透传至 WSL2 环境中。


### 1. 查看设备列表

在 **Windows PowerShell (管理员)** 中运行：


```powershell
usbipd list
```

**示例输出：**


```
Connected:
BUSID  VID:PID    DEVICE
1-3    10C4:EA60  CP2102 USB to UART Bridge Controller
1-7    046D:C534  Logitech USB Receiver
```

> **注意**：请记录下目标设备的 `BUSID`（例如 `1-3`）。


### 2. 绑定设备 (Bind)

设备首次使用前需要进行“绑定”，以便 usbipd 接管该设备。

在 **Windows PowerShell (管理员)** 中运行：


```powershell
# 语法：usbipd bind --busid <BUSID>
usbipd bind --busid 1-3
```


### 3. 挂载到 WSL (Attach)

绑定成功后，将设备挂载到正在运行的 WSL 实例中。

在 **Windows PowerShell** (无需管理员权限) 中运行：


```powershell
# 语法：usbipd attach --wsl --busid <BUSID>
usbipd attach --wsl --busid 1-3
```

> 💡 提示：如果 WSL 未运行，此命令会失败。请确保 WSL 已启动。


### 4. 在 WSL 中验证

回到 **WSL 终端**，检查设备是否已挂载：


```bash
lsusb
```

**预期输出：**


```
Bus 001 Device 002: ID 10c4:ea60 Silicon Labs CP2102 USB to UART Bridge Controller
```

若能看到对应设备的 ID 和描述，即表示透传成功 🎉。


---


### 常用管理命令


#### 解绑设备 (Unbind)

如果绑定错了设备，或者不再需要透传，可以进行解绑。

在 **Windows PowerShell (管理员)** 中运行：


```powershell
usbipd unbind --busid 1-3
```
