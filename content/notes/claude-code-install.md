---
id: note_tools_winbeau_032
slug: claude-code-install
title: Claude Code 下载
summary: 适用于 macOS 和 Ubuntu，自动处理依赖和环境配置。
category: tools
tags: [Claude, 工具]
author: winbeau
createdAt: 2026-03-05T15:51:15Z
readMinutes: 4
notionUuid: 337fed6a-f36f-832a-9b42-01b26f23d19f
---

**Claude Code** 是 Anthropic 官方推出的命令行工具，支持在终端中直接与 Claude 交互进行代码开发。


#### 1. 安装 (Installation)


#### 方法一：自动安装脚本 (推荐)

适用于 macOS 和 Ubuntu，自动处理依赖和环境配置。


```bash
curl -fsSL https://claude.ai/install.sh | bash
```

> 安装完成后，运行 `claude` 启动并进行首次授权。


#### 方法二：通过 NPM 安装

需 Node.js 18+ 环境。


```bash
npm install -g @anthropic-ai/claude-code
```


#### 2. 必备工具

建议安装以下工具以获得最佳体验（提升文件搜索与版本控制能力）。


```bash
sudo apt update
sudo apt install -y git ripgrep
```


#### 3. 环境配置

将以下环境变量添加到你的 Shell 配置文件 (`~/.zshrc` 或 `~/.bashrc`) 中，以配置 API Key 和自定义 Base URL。


```bash
# Claude Code Configuration
export ANTHROPIC_AUTH_TOKEN="sk-9yQxN4LkDR1ZFUpEIKHb0XJQKUjwupucBRMWmugJocUtJ4Vz"
export ANTHROPIC_BASE_URL="https://anyrouter.top"
export MORPH_API_KEY="sk-IubCKmeMJnv7eSbf1DwacEPcA40Piq0HZ_h0X_WYrSJdPBcC"
export TWENTYFIRST_API_KEY="59d90a411938b3693e74218e5ffd2ab20a1c74c553577344fa9f297bc7f9e9a4"
```

> 💡 **提示**：修改配置文件后，记得运行 `source ~/.zshrc` (或 `source ~/.bashrc`) 使其生效。


#### 4. 常用命令


|  |  |
| --- | --- |
| 命令 | 说明 |
| :--- | :--- |
| `claude` | 启动交互式会话 |
| `claude doctor` | 检查环境与权限 (排错推荐) |
| `claude update` | 更新到最新版本 |


#### 5. 常见问题

- **权限报错 (EACCES)**: NPM 全局安装失败时，建议使用 `nvm` 管理 Node 版本或改用官方安装脚本。
- **Command not found**: 检查 `~/.npm-global/bin` 是否已加入 PATH，或尝试重启终端。
