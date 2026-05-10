---
id: note_tools_winbeau_030
slug: docker-container-setup
title: Docker 容器配置
summary: 该文档记录了如何配置一个适合深度学习开发的 Docker 容器环境，包括 Jupyter 端口穿透、Zsh + Starship 终端美化，以及 Vim 配…
category: tools
tags: [Docker, 容器]
author: winbeau
createdAt: 2026-05-01T16:29:58Z
readMinutes: 20
notionUuid: ce5fed6a-f36f-8309-8ace-81932f6ddfb6
---

该文档记录了如何配置一个适合深度学习开发的 Docker 容器环境，包括 Jupyter 端口穿透、Zsh + Starship 终端美化，以及 Vim 配置的现代化迁移。


### 1. 启动容器与端口穿透


#### 1.1 创建带 Jupyter 穿透的 Docker 容器


```bash
docker run --gpus '"device=0"' \
    -it --name winbeau-dev \
    -v /home/jiayu/winbeau_zhao:/workspace \
    -p 8890:8888 \
    nvcr.io/nvidia/pytorch:23.10-py3 bash
```


```bash
docker run --gpus all \
    -it --name winbeau \
    -v /home/jiayu/winbeau_zhao/Root:/root \
    -v /home/jiayu/winbeau_zhao/Workspace:/workspace \
    -p 8890:8888 \
    -p 7860:7860 \
    -p 8000:8000 \
    -p 6006:6006 \
    nvidia/cuda:12.1.1-cudnn8-devel-ubuntu22.04 bash
```


#### 1.2 在容器内启动 Jupyter


```bash
jupyter lab --ip=0.0.0.0 --no-browser --allow-root --port=8888
```


#### 1.3 在本地终端建立 SSH 隧道


```bash
ssh -L 8890:localhost:8890 target-server
```


```bash
ssh \
  -L 8890:localhost:8888 \
  -L 7860:localhost:7860 \
  -L 8000:localhost:8000 \
  -L 6006:localhost:6006 \
  target-server
```


#### 1.4 浏览器访问


```
http://localhost:8890
```


---


### 2. Shell 环境配置 (Zsh + Starship)


#### 2.1 安装 Zsh 和 Starship

**① 安装 Zsh (容器内执行)**


```bash
apt update
apt install -y zsh curl git
```

**② 安装 Starship**


```bash
curl -sS https://starship.rs/install.sh | sh
```

**③ 在 Zsh 中启用 Starship**


```bash
echo 'eval "$(starship init zsh)"' >> ~/.zshrc
```

**④ 切换到 Zsh**


```bash
zsh
```


#### 2.2 Starship 初始化配置

**① 确认安装状态**


```bash
starship --version
```

若提示找不到，请重新执行安装命令：


```bash
curl -sS https://starship.rs/install.sh | sh
```

**② 创建配置目录**


```bash
mkdir -p ~/.config
```

**③ 写入配置文件**


```bash
nano ~/.config/starship.toml
```

将以下配置内容复制进去：


```toml
# ~/.config/starship.toml

# 1. 配置用户名 (User)
[username]
style_user = "yellow bold"
style_root = "red bold"
format = "[$user]($style)"
show_always = true

# 2. 配置主机名 (Hostname)
[hostname]
ssh_only = false
format = "@[$hostname]($style) "
trim_at = "."
style = "cyan"

# =======================
# 2. 路径 (视觉焦点)
# =======================
[directory]
style = "yellow"
truncation_length = 4
truncation_symbol = "…/"
format = "[$path]($style)[$read_only]($read_only_style) "

# =======================
# 3. Git 状态 (优雅点缀)
# =======================
[git_branch]
symbol = ""
style = "purple bold"
format = "[$symbol$branch]($style)"

[git_status]
disabled = false
format = ' ([$all_status$ahead_behind]($style) )'
style = "red bold"
staged = "[+](green) "
modified = "[!](red) "
untracked = "[?](yellow) "
deleted = "[✘](red) "
renamed = "[»](yellow) "
conflicted = "[=](red bold) "
stashed = "[$](cyan) "
ahead = "⇡"
behind = "⇣"
diverged = "⇕"
up_to_date = ""

# =======================
# 4. Conda 环境 (重写标识)
# =======================
[conda]
disabled = true
ignore_base = false
style = "#78E08F bold"
symbol = ""
format = "[\\($symbol$environment\\)]($style) "

# =======================
# 5. 提示符 (灵动指针)
# =======================
[character]
success_symbol = "[❯](white bold)"
error_symbol = "[❯](red bold)"
vimcmd_symbol = "[❮](green bold)"
```


#### 2.3 配置 Zsh 插件与 .zshrc

**① 创建插件目录**


```bash
mkdir -p ~/.zsh/plugins
```

**② 下载插件**


```bash
# 1. zsh-autosuggestions（自动补全）
git clone https://github.com/zsh-users/zsh-autosuggestions ~/.zsh/plugins/zsh-autosuggestions

# 2. zsh-syntax-highlighting（语法高亮）
git clone https://github.com/zsh-users/zsh-syntax-highlighting ~/.zsh/plugins/zsh-syntax-highlighting
```

**③ 更新 .zshrc 配置文件**

打开文件：


```bash
nano ~/.zshrc
```

写入以下内容：


```bash
# ==============================================
# 1. 初始化 Starship
# ==============================================
eval "$(starship init zsh)"

# ==============================================
# 2. 基础配置
# ==============================================
# 开启颜色
export CLICOLOR=1
export LSCOLORS=ExFxBxDxCxegedabagacad
alias ls='ls --color=auto'  # 让 ls 自动开启颜色
alias ll='ls -lh --color=auto'
alias grep='grep --color=auto'
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"

# 历史记录配置 (按上下键查找历史)
HISTFILE="$HOME/.zsh_history"
HISTSIZE=10000
SAVEHIST=10000
setopt EXTENDED_HISTORY
setopt SHARE_HISTORY
setopt HIST_EXPIRE_DUPS_FIRST
setopt HIST_IGNORE_DUPS
setopt HIST_IGNORE_ALL_DUPS
setopt HIST_FIND_NO_DUPS
setopt HIST_IGNORE_SPACE
setopt HIST_SAVE_NO_DUPS
setopt HIST_REDUCE_BLANKS

# 补全系统初始
autoload -Uz compinit
compinit

# ==============================================
# end. 加载插件 (必须放在文件最后)
# ==============================================
# 加载自动建议
source ~/.zsh/plugins/zsh-autosuggestions/zsh-autosuggestions.zsh

# 加载语法高亮 (这个必须是最后一行)
source ~/.zsh/plugins/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
```

**④ 重新加载配置**


```bash
source ~/.zshrc
```


---


### 3. Vim 配置迁移 (Vim-Plug)

使用 Vim-Plug 替代 Vundle，可以实现并发下载、按需加载和更简单的配置管理。迁移后操作习惯保持不变。


#### 3.1 安装 Vim-Plug


```bash
# 下载 Vim-Plug 到 autoload 目录
curl -fLo ~/.vim/autoload/plug.vim --create-dirs \
    https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim`
```


#### 3.2 更新 .vimrc

将以下内容覆盖你的 `~/.vimrc`：


```
" ====================================================================
" 1. Vim-Plug 插件管理 (替代 Vundle)
" ====================================================================
set nocompatible
filetype off

" 指定插件安装目录 (自动管理，无需手动 clone)
call plug#begin('~/.vim/plugged')

" --- 界面与外观 ---
Plug 'NLKNguyen/papercolor-theme'           " Material 风格主题
Plug 'vim-airline/vim-airline'              " 状态栏
Plug 'vim-airline/vim-airline-themes'       " 状态栏主题
Plug 'Yggdroot/indentLine'                  " 缩进线

" --- 核心功能 (无损保留) ---
Plug 'scrooloose/nerdtree', { 'on': 'NERDTreeToggle' }  " 懒加载：按 F3 才加载，启动更快！
Plug 'jiangmiao/auto-pairs'                 " 括号自动补全
Plug 'vim-syntastic/syntastic'              " 语法检查
Plug 'mattn/emmet-vim'                      " HTML/CSS 神器
Plug 'posva/vim-vue'                        " Vue 高亮
Plug 'tpope/vim-fugitive'                   " Git 集成

call plug#end()
filetype plugin indent on

" ====================================================================
" 2. 基础设置 (保留你的高性能习惯)
" ====================================================================
set encoding=utf-8
set fileencodings=utf8,ucs-bom,gbk,cp936,gb2312,gb18030
set number                      " 显示行号
set history=1000                " 历史记录
set autoread                    " 外部修改自动载入
set autowrite                   " 自动保存
set mouse=a                     " 启用鼠标
set backspace=2                 " 优化删除键
set whichwrap+=<,>,h,l          " 允许跨行
set scrolloff=5                 " 垂直滚动保留视野
set laststatus=2                " 总是显示状态栏
set lazyredraw                  " 提升宏运行速度
set ttyfast                     " 提升终端重绘速度

" --- 缩进设置 ---
set autoindent
set smartindent
set tabstop=4
set softtabstop=4
set shiftwidth=4
set expandtab                   " Tab转空格

" --- 搜索设置 ---
set hlsearch
set incsearch
set ignorecase

" ====================================================================
" 3. 补全体验 (完全保留原版逻辑)
" ====================================================================
" 核心：保留 wildmenu (命令行/路径补全)
set wildmenu
set wildmode=full
set completeopt=longest,menu    " 经典的列表补全模式

" 加载自定义字典 (只要你把 dict 目录拷过来，这里立刻生效)
if filereadable(expand("~/.vim/dict/php_funclist.dict"))
    au FileType php setlocal dict+=~/.vim/dict/php_funclist.dict
endif
if filereadable(expand("~/.vim/dict/css.dict"))
    au FileType css setlocal dict+=~/.vim/dict/css.dict
endif
if filereadable(expand("~/.vim/dict/javascript.dict"))
    au FileType javascript setlocal dict+=~/.vim/dict/javascript.dict
endif
" Vue 文件也用 HTML 的方式处理
autocmd BufRead,BufNewFile *.vue set filetype=html

" ====================================================================
" 4. 界面美化 (Material + Airline)
" ====================================================================
syntax on
set background=dark
set t_Co=256
try
    colorscheme PaperColor
catch
    colorscheme desert
endtry

" 高亮设置
set cul
set cuc

" Airline 设置
let g:airline_theme='papercolor'
let g:airline_powerline_fonts = 0
let g:airline#extensions#tabline#enabled = 1

" ====================================================================
" 5. 快捷键映射 (完全保留)
" ====================================================================
let mapleader = ","

" F3: 文件树
map <F3> :NERDTreeToggle<CR>
imap <F3> <ESC> :NERDTreeToggle<CR>

" F5: 编译运行 (已适配 Python3)
map <F5> :call CompileRunGcc()<CR>
func! CompileRunGcc()
    exec "w"
    if &filetype == 'c'
        exec "!g++ % -o %<"
        exec "!time ./%<"
    elseif &filetype == 'cpp'
        exec "!g++ % -o %<"
        exec "!time ./%<"
    elseif &filetype == 'java'
        exec "!javac %"
        exec "!time java %<"
    elseif &filetype == 'python'
        exec "!time python3 %"
    elseif &filetype == 'sh'
        :!time bash %
    elseif &filetype == 'html'
        exec "!firefox % &"
    elseif &filetype == 'go'
        exec "!time go run %"
    elseif &filetype == 'vue'
        exec "!npm run serve"
    endif
endfunc

" F6: 格式化
map <F6> :call FormartSrc()<CR>
" Ctrl+F: 括号内格式化
nnoremap <C-F> =%=<Up>==`.
inoremap <silent> <C-F> <Esc>:<C-u>normal! =%=k==<CR>gi
" F2: 去空行
nnoremap <F2> :g/^\s*$/d<CR>
" Ctrl+S: 保存
nmap <C-S> :w<CR>
imap <C-S> <Esc>:w<CR>
vmap <C-S> <C-C>:w<CR>
" Ctrl+A: 全选
map <C-A> ggVG$"+y

" ====================================================================
" 6. 插件特定配置
" ====================================================================
" Syntastic (性能优化：只在保存时检查，不卡顿)
let g:syntastic_check_on_open = 0
let g:syntastic_check_on_wq = 0
let g:syntastic_mode_map = { 'mode': 'passive' }
autocmd BufWritePost * SyntasticCheck

" Python 补全修正
let g:pydiction_location = '~/.vim/after/complete-dict'

" ====================================================================
" 7. 自动文件头 (SetTitle)
" ====================================================================
autocmd BufNewFile *.cpp,*.[ch],*.sh,*.rb,*.java,*.py exec ":call SetTitle()"
func SetTitle()
    if &filetype == 'sh'
        call setline(1,"#!/bin/bash")
        call append(line("."), "")
    elseif &filetype == 'python'
        call setline(1,"#!/usr/bin/env python3")
        call append(line("."),"# -*- coding: utf-8 -*-")
        call append(line(".")+1, "")
    elseif &filetype == 'vue'
        call setline(1,"<template>")
        call append(line("."),"  <div></div>")
        call append(line(".")+1,"</template>")
        call append(line(".")+2,"<script>")
        call append(line(".")+3,"export default {")
        call append(line(".")+4,"}")
        call append(line(".")+5,"</script>")
        call append(line(".")+6,"<style scoped>")
        call append(line(".")+7,"</style>")
    else
        call setline(1, "/*************************************************************************")
        call append(line("."), "    > File Name: ".expand("%"))
        call append(line(".")+1, "    > Author: winbeau")
        call append(line(".")+2, "    > Created Time: ".strftime("%c"))
        call append(line(".")+3, " ************************************************************************/")
        call append(line(".")+4, "")
    endif
    autocmd BufNewFile * normal G
endfunc
```


#### 3.3 应用更改

1. 保存退出 Vim。
1. 再次打开 Vim。
1. 输入命令安装所有插件：

```
:PlugInstall
```
