---
id: note_tools_winbeau_007
slug: vim-vimrc-detail
title: Vim 配置文件 (.vimrc) 详细分析
summary: 这个配置文件非常完整，包含了：
category: tools
tags: [Vim, 编辑器]
author: winbeau
createdAt: 2026-03-02T06:44:55Z
readMinutes: 20
notionUuid: 458fed6a-f36f-838d-8a77-815ca1128100
---

### Vim 升级


### 第一部分：基础编辑设置


```
set sw=4
set ts=4
set et
set smarttab
set smartindent
set lbr
set fo+=mB
set sm
set selection=inclusive
set wildmenu
set mousemodel=popup

```

**详细说明：**

- `set sw=4`：设置自动缩进的宽度为4个空格
- `set ts=4`：设置Tab键的宽度为4个空格
- `set et`：使用空格替代Tab字符（expandtab的缩写）
- `set smarttab`：智能Tab处理，在行首使用shiftwidth的值
- `set smartindent`：智能自动缩进
- `set lbr`：在单词边界处换行（linebreak）
- `set fo+=mB`：格式化选项，mB表示多字节字符的处理
- `set sm`：显示匹配的括号（showmatch）
- `set selection=inclusive`：选择模式为包含性选择
- `set wildmenu`：命令行补全时显示菜单
- `set mousemodel=popup`：右键点击显示弹出菜单

### 第二部分：文件类型字典配置


```
au FileType php setlocal dict+=~/.vim/dict/php_funclist.dict
au FileType css setlocal dict+=~/.vim/dict/css.dict
au FileType c setlocal dict+=~/.vim/dict/c.dict
au FileType cpp setlocal dict+=~/.vim/dict/cpp.dict
au FileType scale setlocal dict+=~/.vim/dict/scale.dict
au FileType javascript setlocal dict+=~/.vim/dict/javascript.dict
au FileType html setlocal dict+=~/.vim/dict/javascript.dict
au FileType html setlocal dict+=~/.vim/dict/css.dict

```

**详细说明：**

- 这些是自动命令（autocmd），为不同文件类型设置字典文件
- `au FileType`：当检测到特定文件类型时执行
- `setlocal dict+=`：为当前缓冲区添加字典文件路径
- 字典文件用于代码补全，包含各语言的函数列表和关键词

### 第三部分：Syntastic和Go语言配置


```
execute pathogen#infect()
let g:syntastic_python_checkers=['pylint']
let g:syntastic_php_checkers=['php', 'phpcs', 'phpmd']
let g:fencview_autodetect=0
set rtp+=$GOROOT/misc/vim

```

**详细说明：**

- `execute pathogen#infect()`：加载Pathogen插件管理器
- `let g:syntastic_python_checkers=['pylint']`：设置Python语法检查器为pylint
- `let g:syntastic_php_checkers=['php', 'phpcs', 'phpmd']`：设置PHP语法检查器
- `let g:fencview_autodetect=0`：禁用文件编码自动检测
- `set rtp+=$GOROOT/misc/vim`：添加Go语言的Vim支持路径

### 第四部分：显示相关设置


```
syntax on
set cul "高亮光标所在行
set cuc
set shortmess=atI   " 启动的时候不显示那个援助乌干达儿童的提示
set go=             " 不要图形按钮
color ron     " 设置背景主题
set guifont=Consolas:h11:antialias=1   " 设置字体
autocmd InsertEnter * se cul    " 用浅色高亮当前行

```

**详细说明：**

- `syntax on`：启用语法高亮
- `set cul`：高亮显示光标所在行（cursorline）
- `set cuc`：高亮显示光标所在列（cursorcolumn）
- `set shortmess=atI`：简化启动消息，不显示乌干达儿童捐助信息
- `set go=`：移除GUI选项，隐藏工具栏等
- `color ron`：设置配色方案为ron
- `set guifont=Consolas:h11:antialias=1`：设置GUI字体为Consolas，大小11，开启反锯齿
- `autocmd InsertEnter * se cul`：进入插入模式时高亮当前行

### 第五部分：状态栏和基础显示设置


```
set ruler           " 显示标尺
set showcmd         " 输入的命令显示出来，看的清楚些
set scrolloff=3     " 光标移动到buffer的顶部和底部时保持3行距离
set statusline=%F%m%r%h%w\ [FORMAT=%{&ff}]\ [TYPE=%Y]\ [POS=%l,%v][%p%%]\ %{strftime(\"%d/%m/%y\ -\ %H:%M\")}
set laststatus=2    " 启动显示状态行(1),总是显示状态行(2)

```

**详细说明：**

- `set ruler`：在右下角显示光标位置
- `set showcmd`：在状态行显示正在输入的命令
- `set scrolloff=3`：滚动时在顶部和底部保持3行可见
- `set statusline=...`：自定义状态行显示内容，包括文件名、格式、类型、位置、时间等
- `set laststatus=2`：总是显示状态行

### 第六部分：编码和帮助设置


```
set nocompatible  "去掉讨厌的有关vi一致性模式，避免以前版本的一些bug和局限
if version >= 603
        set helplang=cn
        set encoding=utf-8
endif

```

**详细说明：**

- `set nocompatible`：关闭Vi兼容模式，启用Vim增强功能
- `if version >= 603`：检查Vim版本
- `set helplang=cn`：设置帮助语言为中文
- `set encoding=utf-8`：设置内部编码为UTF-8

### 第七部分：缩进和Tab设置


```
set autoindent
set cindent
set tabstop=4
set softtabstop=4
set shiftwidth=4
set expandtab
set smarttab

```

**详细说明：**

- `set autoindent`：自动缩进
- `set cindent`：C语言风格的智能缩进
- `set tabstop=4`：Tab键显示宽度为4
- `set softtabstop=4`：软制表符宽度为4
- `set shiftwidth=4`：自动缩进和>>、<<命令的缩进宽度
- `set expandtab`：用空格替换Tab
- `set smarttab`：行首的制表符按shiftwidth处理

### 第八部分：行号和搜索设置


```
set number
set history=1000
set hlsearch
set incsearch
set langmenu=zh_CN.UTF-8
set helplang=cn

```

**详细说明：**

- `set number`：显示行号
- `set history=1000`：命令历史记录保存1000条
- `set hlsearch`：高亮搜索结果
- `set incsearch`：增量搜索，边输入边搜索
- `set langmenu=zh_CN.UTF-8`：菜单语言设为中文UTF-8
- `set helplang=cn`：帮助语言设为中文

### 第九部分：文件类型和补全设置


```
set cmdheight=2
filetype on
filetype plugin on
filetype indent on
set viminfo+=!
set iskeyword+=_,$,@,%,#,-

```

**详细说明：**

- `set cmdheight=2`：命令行高度为2行
- `filetype on`：启用文件类型检测
- `filetype plugin on`：启用文件类型插件
- `filetype indent on`：启用文件类型缩进
- `set viminfo+=!`：保存全局变量到viminfo文件
- `set iskeyword+=_,$,@,%,#,-`：将这些字符视为关键字的一部分

### 第十部分：文件类型关联


```
au BufRead,BufNewFile *.{md,mdown,mkd,mkdn,markdown,mdwn}   set filetype=mkd
au BufRead,BufNewFile *.{go}   set filetype=go
au BufRead,BufNewFile *.{js}   set filetype=javascript

```

**详细说明：**

- 为不同扩展名的文件设置正确的文件类型
- markdown文件设为mkd类型
- go文件设为go类型
- js文件设为javascript类型

### 第十一部分：快捷键映射


```
nmap md :!~/.vim/markdown.pl % > %.html <CR><CR>
nmap fi :!firefox %.html & <CR><CR>
nmap \ \cc
vmap \ \cc
nmap tt :%s/\t/    /g<CR>

```

**详细说明：**

- `nmap md`：将markdown文件转换为HTML
- `nmap fi`：用Firefox打开HTML文件
- `nmap \ \cc`和`vmap \ \cc`：注释快捷键
- `nmap tt`：将所有Tab替换为4个空格

### 第十二部分：新文件模板函数


```
autocmd BufNewFile *.cpp,*.[ch],*.sh,*.rb,*.java,*.py exec ":call SetTitle()"
func SetTitle()
        if &filetype == 'sh'
                call setline(1,"\#!/bin/bash")
                call append(line("."), "")
        elseif &filetype == 'python'
                call setline(1,"#!/usr/bin/env python")
                call append(line("."),"# coding=utf-8")
                call append(line(".")+1, "")
        # ... 更多文件类型处理
endfunc

```

**详细说明：**

- `autocmd BufNewFile`：新建文件时自动执行
- `SetTitle()`函数为不同文件类型插入相应的文件头
- 包括shebang行、编码声明、作者信息等
- 自动定位到文件末尾准备编辑

### 第十三部分：功能键映射


```
:nmap <silent> <F9> <ESC>:Tlist<RETURN>
map <S-Left> :tabp<CR>
map <S-Right> :tabn<CR>
map <F3> :NERDTreeToggle<CR>
map <F5> :call CompileRunGcc()<CR>

```

**详细说明：**

- `<F9>`：打开/关闭标签列表
- `<S-Left>`和`<S-Right>`：切换标签页
- `<F3>`：打开/关闭NERDTree文件浏览器
- `<F5>`：编译并运行代码

### 第十四部分：编译运行函数


```
func! CompileRunGcc()
        exec "w"
        if &filetype == 'c'
                exec "!g++ % -o %<"
                exec "!time ./%<"
        elseif &filetype == 'cpp'
                exec "!g++ % -o %<"
                exec "!time ./%<"
        # ... 其他语言处理
endfunc

```

**详细说明：**

- 保存文件后根据文件类型选择相应的编译和运行命令
- 支持C、C++、Java、Python、Go等多种语言
- 使用time命令显示运行时间

### 第十五部分：代码格式化


```
map <F6> :call FormartSrc()<CR><CR>
func FormartSrc()
    exec "w"
    if &filetype == 'c'
        exec "!astyle --style=ansi -a --suffix=none %"
    # ... 其他格式化工具
endfunc

```

**详细说明：**

- `<F6>`键调用代码格式化
- 使用astyle工具格式化C/C++代码
- 使用autopep8格式化Python代码

### 第十六部分：实用设置


```
set autoread
set completeopt=preview,menu
set autowrite
set magic
set guioptions-=T
set guioptions-=m

```

**详细说明：**

- `set autoread`：文件被外部修改时自动重新加载
- `set completeopt=preview,menu`：补全时显示预览窗口和菜单
- `set autowrite`：自动保存
- `set magic`：启用正则表达式的特殊字符
- `set guioptions-=T`：隐藏工具栏
- `set guioptions-=m`：隐藏菜单栏

### 第十七部分：CTags配置


```
let Tlist_Sort_Type = "name"
let Tlist_Use_Right_Window = 1
let Tlist_Compart_Format = 1
let Tlist_Exist_OnlyWindow = 1
set tags=tags;
set autochdir

```

**详细说明：**

- 配置TagList插件的行为
- 按名称排序，在右窗口显示
- 设置tags文件路径
- `set autochdir`：自动切换到当前文件目录

### 第十八部分：编码设置


```
set iskeyword+=.
set termencoding=utf-8
set encoding=utf8
set fileencodings=utf8,ucs-bom,gbk,cp936,gb2312,gb18030

```

**详细说明：**

- `set iskeyword+=.`：将点号视为关键字一部分
- `set termencoding=utf-8`：终端编码
- `set encoding=utf8`：内部编码
- `set fileencodings=...`：文件编码检测顺序

### 第十九部分：Vundle插件管理


```
set rtp+=~/.vim/bundle/vundle/
call vundle#rc()
Bundle 'https://gitee.com/suyelu/vundle'
Bundle 'https://gitee.com/suyelu/vim-fugitive'
# ... 更多插件

```

**详细说明：**

- 配置Vundle插件管理器
- 从gitee镜像安装各种插件
- 包括git集成、代码补全、文件管理等插件

### 主要插件功能说明

1. **vim-fugitive**：Git集成
1. **indentLine**：显示缩进线
1. **Auto-Pairs**：自动配对括号
1. **ctrlp.vim**：模糊文件查找
1. **The-NERD-Commenter**：快速注释
1. **django_templates.vim**：Django模板支持

### 总结

这个配置文件非常完整，包含了：

- 完善的编辑环境设置
- 多语言支持和语法高亮
- 智能补全和代码格式化
- 便捷的快捷键映射
- 丰富的插件生态
- 中文本地化支持
适合进行多种编程语言的开发工作，特别是C/C++、Python、JavaScript、Go等语言。
