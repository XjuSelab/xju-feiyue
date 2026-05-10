---
id: note_tools_winbeau_022
slug: spring-boot-deploy
title: "Spring-Boot 服务器部署"
summary: 本文档介绍如何使用 Systemd 将 Spring Boot 后端应用配置为 Linux 系统服务，实现开机自启、后台运行及环境变量管理。
category: tools
tags: ["Spring-Boot", Java, 后端]
author: winbeau
createdAt: 2026-03-02T06:44:52Z
readMinutes: 5
notionUuid: cfdfed6a-f36f-8249-9c0d-017c12f9b2f1
---

本文档介绍如何使用 Systemd 将 Spring Boot 后端应用配置为 Linux 系统服务，实现开机自启、后台运行及环境变量管理。


#### 1. 创建 Systemd 服务文件

使用 `nano` 编辑服务配置文件（无需额外创建 env 文件，直接在配置中定义环境变量）：


```bash
sudo nano /etc/systemd/system/knohub-backend.service
```

**配置文件内容：**


```
[Unit]
Description=KnoHub Spring Boot Backend (mvn spring-boot:run)
# 确保在网络和 Docker 启动后再启动
After=[network.target](http://network.target) docker.service
Requires=docker.service

[Service]
User=winbeau
WorkingDirectory=/home/winbeau/KnoHub/backend

# ===== 数据库环境变量配置 =====
# 使用 Environment 指令直接定义变量
Environment="DB_URL=jdbc:postgresql://[localhost:5432/knohub](http://localhost:5432/knohub)"
Environment="DB_USERNAME=postgres"
Environment="DB_PASSWORD=@Geralt123"
Environment="DB_DRIVER=org.postgresql.Driver"
Environment="DB_DIALECT=org.hibernate.dialect.PostgreSQLDialect"

# ===== 启动命令 =====
# 这里直接使用 mvn spring-boot:run 运行
ExecStart=/usr/bin/mvn spring-boot:run

# 退出信号与重启策略
SuccessExitStatus=143
Restart=always
RestartSec=5

[Install]
WantedBy=[multi-user.target](http://multi-user.target)
```


#### 2. 启动服务

保存文件后，按照以下步骤加载并启动服务：


```bash
# 1. 重载 Systemd 守护进程以读取新文件
sudo systemctl daemon-reload

# 2. 设置开机自启
sudo systemctl enable knohub-backend

# 3. 立即启动服务
sudo systemctl start knohub-backend
```


#### 3. 验证状态

检查服务运行状态及日志：


```bash
sudo systemctl status knohub-backend
```


---

**配置说明：**

- **Environment**: 直接在 `[Service]` 块中使用 `Environment="KEY=VALUE"` 格式定义，无需外部文件。
- **User**: 指定运行服务的用户（这里是 `winbeau`），避免使用 root 运行应用。
- **Restart**: 设置为 `always` 确保服务崩溃或被杀掉后自动重启。
