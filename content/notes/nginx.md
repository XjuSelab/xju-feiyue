---
id: note_tools_winbeau_002
slug: nginx
title: Nginx
summary: 将以下干净的 server 块贴进去
category: tools
tags: [Nginx, 服务器, 部署]
author: winbeau
createdAt: 2026-03-02T06:44:57Z
readMinutes: 8
notionUuid: 0a6fed6a-f36f-83f2-aa0d-816354a6029f
---

## 历史


## Nginx基础


## Nginx 配置步骤


#### 0-规范化/etc/nginx/nginx.conf


```md
user www-data; # 建议改为 www-data，配合后面提到的目录权限修改
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 768;
}

http {
    ##
    # 基础设置
    ##
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    ##
    # SSL 设置
    ##
    ssl_protocols TLSv1.2 TLSv1.3; # 弃用过时的 TLS 1.0/1.1
    ssl_prefer_server_ciphers on;

    ##
    # 日志设置
    ##
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    ##
    # Gzip 压缩 (建议开启，提升前端加载速度)
    ##
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    ##
    # 虚拟主机配置 (核心！)
    ##
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
```


#### 1-部署前端目录 /var/www/xx，修改权限www-data


```md
cp -r xx/fontend/dist /var/www/xx
```


#### 2-配置 /etc/nginx/sites-available/xx

将以下干净的 `server` 块贴进去


```toml
server {
    listen 80;
    server_name 82.157.209.193;

    # 前端
    location /paper-insight {
        alias /var/www/paper-insight/;
        index index.html;
        try_files $uri $uri/ /paper-insight/index.html;
    }

    # API
    location /paper-insight/api/ {
        proxy_pass http://127.0.0.1:8000/; 
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 后端静态资源
    location /paper-insight/static/ {
        proxy_pass http://127.0.0.1:8000/static/;
    }
}
```

> 强制 刷新缓存


```bash
location /paper-insight/ {
    alias /var/www/paper-insight/;
    index index.html;
    
    # 针对 HTML 文件设置不缓存，确保每次都拉取最新的 JS 引用
    location ~* \.html$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    try_files $uri $uri/ /paper-insight/index.html;
}
```


#### 3-软连接 /etc/nginx/sites-enable/xx

1. 移除旧的软链接
    原来的 `default` 只是一个指向 `sites-available/default` 的软链接。我们把它删掉（这不会删除原始文件，只是取消激活）：


```bash
sudo rm /etc/nginx/sites-enabled/default
```

1.  激活新的规范配置
    创建指向你新配置文件的软链接：


```bash
sudo ln -s /etc/nginx/sites-available/xx /etc/nginx/sites-enabled/
```


#### 4-重启服务

检查与重载


```bash
sudo nginx -t          # 确保没有重复定义的 server_name
sudo systemctl reload nginx
```
