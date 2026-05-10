---
id: note_tools_winbeau_014
slug: neovim-install
title: NeoVim 下载及配置
summary: LazyVim 是基于 Neovim 的现代化配置框架，提供开箱即用的开发体验。本指南适用于 Ubuntu 服务器环境。
category: tools
tags: [Vim, 编辑器, NeoVim]
author: winbeau
createdAt: 2026-03-02T06:45:07Z
readMinutes: 14
notionUuid: b71fed6a-f36f-8329-80e0-8174345c49ce
---

LazyVim 是基于 Neovim 的现代化配置框架，提供开箱即用的开发体验。本指南适用于 Ubuntu 服务器环境。


#### 1. 安装 Neovim (v0.9.0+)

Ubuntu 默认源版本较旧，推荐使用 AppImage 安装最新版。


```bash
# 下载并安装 AppImage
curl -LO https://github.com/neovim/neovim/releases/download/nightly/nvim-linux-x86_64.appimage
chmod u+x nvim-linux-x86_64.appimage
sudo mv nvim-linux-x86_64.appimage /usr/local/bin/nvim

# 验证版本 (需 >= 0.9.0)
nvim --version
```

>
> #### docker 安装
>
>
> ```bash
> curl -LO https://github.com/neovim/neovim/releases/download/nightly/nvim-linux-x86_64.tar.gz
tar xzf nvim-linux-x86_64.tar.gz
mv nvim-linux-x86_64 /opt/nvim
ln -s /opt/nvim/bin/nvim /usr/local/bin/nvim
> ```
>


#### 2. 环境依赖

安装 LazyVim 核心插件所需的底层工具（GCC, Ripgrep, fd 等）。


```bash
apt update
apt install -y build-essential git unzip curl ripgrep

# 安装 fd (fdfind) 并建立软链接
apt install -y fd-find
ln -sf $(which fdfind) /usr/local/bin/fd
```


#### 3. 部署 LazyVim

备份旧配置并克隆 LazyVim 模板。


```bash
# 备份旧配置
mv ~/.config/nvim ~/.config/nvim.bak 2>/dev/null
mv ~/.local/share/nvim ~/.local/share/nvim.bak 2>/dev/null
mv ~/.local/state/nvim ~/.local/state/nvim.bak 2>/dev/null
mv ~/.cache/nvim ~/.cache/nvim.bak 2>/dev/null

# 克隆配置
git clone [https://github.com/LazyVim/starter](https://github.com/LazyVim/starter) ~/.config/nvim

# 首次启动 (会自动下载插件，国内环境可能需配置代理)
nvim
```


#### 4. 语言支持 (Python)

LazyVim 模块化管理语言支持。

1. 进入 Neovim，输入 `:LazyExtras`。
1. 选中 **lang.python**，按 `x` 启用。
1. 按 `q` 退出并重启 Neovim，自动安装 LSP (Pyright), Linter (Ruff), Formatter (Black)。

#### 5. 个性化配置

配置文件路径：`~/.config/nvim/lua/`


#### 5.1 主题设置 (PaperColor)

创建/编辑 `nvim ~/.config/nvim/lua/plugins/theme.lua`：


```lua
return {
  -- 1. 安装主题插件
  {
    -- 如果你指的是经典的 PaperColor 主题，GitHub 地址是这个：
    "nlknguyen/papercolor-theme",
    -- 如果你的主题是别的（比如是个本地文件或者其他 GitHub 仓库），
    -- 请把上面这就话换成对应的 "用户名/仓库名"

    priority = 1000, -- 极其重要：确保主题在其他插件之前加载
  },

  -- 2. 配置 LazyVim 使用该主题
  {
    "LazyVim/LazyVim",
    opts = {
      -- 这里填写主题的启动命令名
      -- 通常 PaperColor 的命令就是 "PaperColor"
      -- 如果你不确定，可以在旧 Vim 里输入 :colorscheme 看看当前叫什么
      colorscheme = "PaperColor",
    },
  },
}
```

编辑 `nvim ~/.config/nvim/lua/config/options.lua` 适配浅色背景：


```lua
vim.opt.background = "dark"
```


#### 5.2 绝对行号

编辑 `nvim ~/.config/nvim/lua/config/options.lua`：


```lua
vim.opt.relativenumber = false -- 关闭相对行号
```


#### 5.3 缩进自适应

编辑 `nvim ~/.config/nvim/lua/config/autocmds.lua`，根据文件类型自动调整缩进（前端2空格，后端4空格）：


```lua
-- 定义一个辅助函数，用于设置当前 Buffer 的缩进
local function set_indent(size)
  vim.opt_local.shiftwidth = size   -- 自动缩进的宽度
  vim.opt_local.tabstop = size      -- 按下 Tab 键时显示的宽度
  vim.opt_local.softtabstop = size  -- 编辑模式下按退格键删除的宽度
  vim.opt_local.expandtab = true    -- 将 Tab 转换为空格 (行业标准)
end

-- 第一组：公认使用 2 空格缩进的语言 (前端/配置类)
vim.api.nvim_create_autocmd("FileType", {
  pattern = {
    "html",
    "css",
    "scss",
    "javascript",
    "typescript",
    "javascriptreact", -- .jsx
    "typescriptreact", -- .tsx
    "vue",
    "json",
    "jsonc",
    "yaml",
    "lua", -- Neovim 社区通常偏好 2 空格
  },
  callback = function()
    set_indent(2)
  end,
})

-- 第二组：公认使用 4 空格缩进的语言 (后端/系统类)
vim.api.nvim_create_autocmd("FileType", {
  pattern = {
    "python", -- PEP 8 强制要求 4 空格
    "java",   -- Oracle 标准通常是 4
    "c",
    "cpp",    -- C++ 标准不一，但 4 比较通用 (Google Style 用 2，看你喜好)
    "rust",
    "go",     -- Go 比较特殊，它强制用 Tab，这里先按 4 处理显示宽度
  },
  callback = function()
    set_indent(4)
    -- Go 语言特殊处理：Go 官方强制使用 Tab 字符，而不是空格
    if vim.bo.filetype == "go" then
      vim.opt_local.expandtab = false
    end
  end,
})
```


#### 6. 常见问题

- **图标乱码**：客户端终端需安装 **Nerd Font** (如 JetBrainsMono Nerd Font) 并设置为终端字体。
- **剪贴板**：SSH 环境建议安装 `sudo apt install xclip` 以支持系统剪贴板互通。
- **Tmux 颜色**：确保 `.tmux.conf` 开启 True Color (`set-option -sa terminal-overrides ",xterm*:Tc"`)。

#### 7. 常用快捷键 (Leader = Space)


|  |  |  |
| --- | --- | --- |
| 功能 | 快捷键 | 对应 VSCode |
| **文件搜索** | `<Space> + <Space>` | Ctrl+P |
| **全局搜索** | `<Space> + s + g` | Ctrl+Shift+F |
| **文件资源管理器** | `<Space> + e` | Ctrl+Shift+E |
| **关闭当前页** | `<Space> + b + d` | Ctrl+W |
| **插件管理** | `<Space> + l` | - |
| **浮动终端** | `<Space> + f + t` | Ctrl+` |
