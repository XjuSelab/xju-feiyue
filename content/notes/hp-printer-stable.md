---
id: note_tools_winbeau_013
slug: hp-printer-stable
title: 惠普打印机电脑稳定链接
summary: 本文档旨在解决打印机因 IP 变动导致的连接不稳定问题，包含固定打印机 IP 与 Windows 端口绑定 两个核心步骤。
category: tools
tags: [硬件, 故障排查]
author: winbeau
createdAt: 2026-03-02T06:45:00Z
readMinutes: 5
notionUuid: 01cfed6a-f36f-83a1-b448-014ce96e2711
---

## 惠普打印机稳定连接配置指南

本文档旨在解决打印机因 IP 变动导致的连接不稳定问题，包含**固定打印机 IP** 与 **Windows 端口绑定** 两个核心步骤。


### 第一步：固定打印机 IP (Web 后台)


#### ⚠️ 关键警告

- **禁止使用 ****`.255`**** 结尾的地址**（如 `192.168.5.255`）：这是广播地址，会导致网络故障。
- **建议 IP**：选择 `254` 以下且不易冲突的大号数字，例如 **`192.168.5.250`**。

#### 配置步骤

1. 进入打印机网页后台，勾选 **Manual IP** (手动 IP)。
1. **自动填充 (推荐)**：点击 **"Suggest a Manual IP Address"** 按钮，系统会自动获取正确的子网掩码和网关。
1. **手动填写 (参考)**：
    - **IP Address**: `192.168.5.250`
    - **Subnet Mask**: `255.255.255.0`
    - **Default Gateway**: `192.168.5.1` (需根据实际路由器地址填写)
1. 点击 **Apply** 保存。
    - *注：保存后网页会断开，需使用新 IP (192.168.5.250) 重新访问。*

![image.png](attachment:19cb6fe7-6ad9-495a-b45b-5cb25d6b4a81:image.png)


---


### 第二步：绑定 Windows TCP/IP 端口

此步骤在电脑系统设置中进行，确保电脑通过固定的 IP 连接打印机。


#### 1. 打开设置入口

- **控制面板** > **查看设备和打印机** (Windows 11 可直接搜索“打印机和扫描仪”)。
- 找到 **HP DeskJet 4900** 图标。

#### 2. 进入属性设置

- **在设置**中找到**”打印机和扫描仪”**。

![image.png](attachment:5688a9bd-0e97-45ef-9563-6bc51fea7f2c:image.png)

- 选择 **“HP DeskJet 4900 series”(若没有找到则先添加设备)**

![image.png](attachment:7dc2e5ab-6486-483e-88b2-6867e9a95f3c:image.png)


#### 3. 添加标准 TCP/IP 端口

1. 切换到 **“端口” (Ports)** 选项卡。(下图中已经修改完成)

![image.png](attachment:3418095a-b8bd-4d50-b606-8c2c62b46271:image.png)

1. 点击 **“添加端口...” (Add Port)** > 选择 **“Standard TCP/IP Port”** > **“新端口...” (New Port)**。
1. 在向导中填入第一步设置的 IP 地址（如 `192.168.5.250`）。
1. 一路点击“下一步”直到完成。

#### 4. 确认应用

回到端口列表，确认已勾选新创建的 IP 端口，点击 **“应用”** 和 **“确定”**。


---

**验证**：打印测试页。如正常出纸，说明连接已锁定，后续不再受网络波动影响。
