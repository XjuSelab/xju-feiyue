---
id: note_tools_winbeau_041
slug: rpi5-lidar
title: Raspberry Pi5 + 激光雷达
summary: 1.
category: tools
tags: [树莓派, 硬件, 激光雷达, 传感器]
author: winbeau
createdAt: 2026-03-29T10:10:00Z
readMinutes: 9
notionUuid: 332fed6a-f36f-8097-9e46-dfa0c7884ef8
---

1. 通信的事：
    1. 怎么连热点 - 接屏幕大法，直接连接，设置连接权重：AlphaDog > Phone > xjuD2L
1.  docker + 树莓派跑通激光雷达
    - [x] docker 挂载设计
        1. 硬件挂载 - 找到激光雷达的/dev/xxx
        1. 网络挂载 - `--net=host`
        1. 内存共享 `--ipc=host`
        1. 底层操控 `--privileged`
        1. 统一工作目录挂载 /alphadog
        1. 开发模式设置 `ROS_MASTER` 为本机

```bash
docker run -it \
  --name alphadog-dev \
  --net=host \
  --ipc=host \
  --privileged \
  --device=/dev/ttyUSB0:/dev/ttyUSB0 \
  -e ROS_MASTER_URI=http://localhost:11311 \
  -e ROS_HOSTNAME=localhost \
  -e ROS_IP=127.0.0.1 \
  -e DISPLAY=$DISPLAY \
  -v $HOME/.Xauthority:/root/.Xauthority:rw \
  -v /alphadog:/root \
  -w /root \
  alphadog-noetic:ready \
  bash
```

    - [ ] 跑通雷达，并且 Windows 同步画面（X11转发）
        1. Win端：使用MobaXterm做 Win 的X11接收
        1. 树莓派：上设置DISPLAY转发目标环境变量 `export DISPLAY=10.122.90.130:0.0`
        1. 树莓派：如上创建docker转发挂载
        1. 树莓派：安装RViz（雷达可视化）

```bash
# 1. 再次确认安装 RViz（确保网络畅通，等待它跑完）
apt update && apt install -y ros-noetic-rviz

# 2. 刷新 ROS 的软件包索引（非常重要，让系统知道 RViz 装好了）
rospack profile

# 3. 重新加载基础环境和你的工作空间环境
source /opt/ros/noetic/setup.bash
source /root/rplidar_ws/devel/setup.bash
```

        1. 树莓派：启动激光雷达

```bash
roslaunch rplidar_ros view_rplidar_a1.launch
```

        1. Win端：呈现雷达点云

![屏幕截图 2026-03-29 165056.png](attachment:cc9ac7c8-067d-4be5-bdc5-e1fadcbd4bff:屏幕截图_2026-03-29_165056.png)

    - [ ]
1.

```bash
# 任务目标
请帮我用 Python 编写一个基于 PyQt5 的 ROS 上位机（地面站）可视化项目。我需要它能通过 WebSockets 实时接收并渲染 2D SLAM 地图和雷达扫描点云。

# 系统架构与网络情况
- **边缘端（ROS Master）**：树莓派 5，IP 地址为 `10.122.90.153`。运行 ROS 1 Noetic。目前正在运行 Hector SLAM（纯激光 2D 建图），并通过 `rosbridge_server` 在 `9090` 端口对外暴露了 WebSocket 服务。
- **客户端（上位机）**：Windows 11 系统下的 WSL2 (Ubuntu 22.04)，IP 地址为 `10.122.90.130`（与树莓派在同一局域网）。通过 WSLg 原生支持 GUI 显示。

# 客户端环境限制（极度重要）
- 客户端使用的是 Python 3.10 的虚拟环境（由 `uv` 管理）。
- **客户端没有安装任何原生的 ROS 环境**，不能使用 `rospy` 或原生的 `nav_msgs`。
- 仅通过第三方库与树莓派通信。目前已安装：`roslibpy` (用于 WebSocket 通信)、`PyQt5`、`numpy`。

# 需求细节
1. **连接管理**：使用 `roslibpy.Ros(host='10.122.90.153', port=9090)` 连接树莓派。
2. **地图订阅与渲染 (/map)**：
   - 订阅 `/map` 话题，数据格式对应 ROS 的 `nav_msgs/OccupancyGrid`（接收到的是 JSON/Dict 格式）。
   - 将接收到的 1 维 `data` 数组，根据 `width` 和 `height` 用 `numpy` 重塑为 2D 矩阵。
   - 数据映射：`-1` (未知) 映射为灰色，`0` (空闲) 映射为白色，`100` (障碍物) 映射为黑色。
   - **注意**：ROS 地图原点在左下角，而 QImage 原点在左上角，需要沿 Y 轴翻转。
3. **激光覆盖渲染 (/scan) [可选进阶功能]**：
   - 订阅 `/scan` 话题，对应 `sensor_msgs/LaserScan`。
   - 解析 `ranges`、`angle_min`、`angle_increment`，将其转换为相对于雷达原点的 (X, Y) 像素坐标，并在刚刚渲染的地图上用红色画点叠加显示。
4. **多线程安全（核心痛点）**：
   - `roslibpy` 的 `subscribe` 回调函数是在后台独立线程中触发的。
   - **严禁**在回调函数中直接操作 PyQt 的 UI 组件。
   - 必须设计 `pyqtSignal` 信号槽机制，将 numpy 处理好的图像数据（或合并好的 QPixmap）发射给 GUI 主线程进行 `setPixmap` 更新。

# 包管理要求
- 使用uv 管理项目，所有安装python包不要用pip install，全部用uv add代替
- 执行python脚本不要直接python xxx.py，一律用 uv run

# 代码设计要求
- 严禁一切fallback，务必做好条件控制
- 每一个函数、每一份文件要写最严格的pytest，确保项目代码与逻辑相符、不会出现执行问题
```
