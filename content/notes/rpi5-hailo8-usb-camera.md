---
id: note_tools_winbeau_041
slug: rpi5-hailo8-usb-camera
title: Raspberry Pi5 + Haili8 + USB Camera
summary: 本文档记录了使用 Windows Terminal (SSH) 结合 MobaXterm (本地 X Server)，打通从 USB 摄像头拉流到 Hail…
category: tools
tags: [Hailo8, AI 硬件, 树莓派, 硬件]
author: winbeau
createdAt: 2026-03-22T12:58:34Z
readMinutes: 20
notionUuid: 32afed6a-f36f-80c9-a429-fd9f36f5079d
---

## 树莓派 5 + Hailo-8 边缘视觉部署：USB 摄像头拉流与 Windows X11 远程可视化避坑指南

> 💡
> 在边缘计算设备（如树莓派 5）上部署 AI 视觉项目时，由于通常采用无头（Headless）模式，如何在 Windows 开发机上实时预览带 AI 渲染框的视频流是一大痛点。
>

本文档记录了使用 **Windows Terminal (SSH)** 结合 **MobaXterm (本地 X Server)**，打通从 USB 摄像头拉流到 Hailo-8 硬件推理，再到跨端 GUI 显示的完整工程链路。


---


### 🛠️ 第一阶段：解锁 USB 摄像头底层权限

在 Linux 系统中插入 UVC 免驱摄像头（如 LB-3M-B2.0）后，系统会分配 `/dev/video*` 设备节点。如果直接使用 OpenCV 读取报错 `Permission denied`，是因为当前用户没有读取视频设备的权限。

**解决方案：**


#### 1. 临时放权（适合快速测试）

直接开放设备读写权限（重启后失效）：


```bash
sudo chmod 666 /dev/video*
```


#### 2. 永久放权（推荐正式环境使用）

将当前用户加入 `video` 组：


```bash
sudo usermod -aG video $USER
```

> ⚠️
> 加入用户组后，需要断开 SSH 重新登录，或使用 **`newgrp video`** 刷新会话才能生效。
>


---


### 🌉 第二阶段：打通跨端 X11 显示隧道

我们的目标是：**在 Windows Terminal 里敲命令，在 Windows 桌面上弹视频窗口。**


#### 1. 配置 MobaXterm 作为静默 X Server

MobaXterm 内置了 X Server。我们需要让它允许接受来自外部的图形绘制请求：

- 打开 MobaXterm -> 点击上方工具栏 **Settings** -> **Configuration** -> 选择 **X11** 选项卡。
- 将 **X11 remote access** 设置为 **`full`**（或 anyhost）。
- 确保主界面右上角的 **X Server** 按钮为绿色（运行状态）。

#### 2. Windows Terminal 建立受信任的 SSH 连接

在 Windows Terminal 中，必须使用 `-Y` 参数（建立受信任的 X11 转发，比 `-X` 兼容性更好）连接树莓派：


```bash
ssh -Y -R 10808:127.0.0.1:10808 username@<树莓派IP>
```


#### 3. 手动锚定 DISPLAY 环境变量

SSH 连入后，需要明确告诉树莓派将画面发往哪里。在终端输入以下命令（将其中的 IP 替换为你 **Windows 电脑的局域网 IP**）：


```bash
export DISPLAY=192.168.x.x:0.0
```

> ✅
> **验证方法：** 运行 **`xeyes`**，如果 Windows 桌面上出现眼睛动画，说明隧道已通。
>


---


### 🚧 第三阶段：OpenCV 与 Qt 环境"防挂死"指南

在 Ubuntu 24.04 等较新系统中，即便 X11 隧道通了，运行 `cv2.imshow` 也极容易遇到**窗口不弹出且程序静默挂起**，或者疯狂输出 `QFontDatabase` 字体报错的问题。


#### 1. 补齐系统 GUI 依赖


```bash
sudo apt update
sudo apt install -y libxcb-cursor0 libgl1-mesa-glx libglib2.0-0 fonts-dejavu-core
```


#### 2. 禁用 X11 共享内存（最关键的救命稻草）

X11 协议在跨网络转发时，如果尝试使用 MIT-SHM（共享内存）加速，会导致界面死锁。必须在运行 Python 脚本前，或在代码顶部强制禁用它：


```bash
export QT_X11_NO_MITSHM=1
```

*(可选) 屏蔽烦人的 Qt 字体调试信息：*


```bash
export QT_LOGGING_RULES="qt.qpa.fonts=false;*.debug=false"
```


---


### 🚀 第四阶段：终极合体 —— Hailo-8 YOLOv8 实时推理

环境彻底打通后，即可运行以下 `live_demo.py` 脚本。

该脚本整合了：

- **摄像头低负载拉流**
- **HailoRT 字典格式输入**
- **硬件 NMS 80 类别拆分解析**
- **X11 实时渲染**

#### `live_demo.py` 完整源码


```python
import numpy as np
import cv2
import os
import time
from hailo_platform import VDevice, HEF, InferVStreams, InputVStreamParams, OutputVStreamParams, FormatType

# === 1. 核心环境注入 ===
# 极其重要：禁用 X11 共享内存，防止远程 SSH 转发时窗口挂死
os.environ["QT_X11_NO_MITSHM"] = "1"
# 屏蔽 Qt 字体报错日志
os.environ["QT_LOGGING_RULES"] = "qt.qpa.fonts=false;*.debug=false"

# === 2. 基础配置 ===
HEF_PATH = "yolov8s.hef"
CAMERA_ID = 0  # USB 摄像头挂载点 /dev/video0

# COCO 80 类别标签 (YOLOv8 默认)
COCO_CLASSES = [
    "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
    "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat",
    "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack",
    "umbrella", "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball",
    "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket",
    "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
    "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake",
    "chair", "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop",
    "mouse", "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
    "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"
]

def extract_tensors(data):
    """递归提取 HailoRT 返回的各类嵌套 NumPy 张量"""
    tensors = []
    if isinstance(data, dict):
        for v in data.values(): tensors.extend(extract_tensors(v))
    elif isinstance(data, (list, tuple)):
        for v in data: tensors.extend(extract_tensors(v))
    elif isinstance(data, np.ndarray):
        tensors.append(data)
    return tensors

def run_live_demo():
    if not os.path.exists(HEF_PATH):
        print(f"❌ 找不到模型文件: {HEF_PATH}")
        return

    # 初始化 Hailo 模型
    hef = HEF(HEF_PATH)
    input_info = hef.get_input_vstream_infos()[0]
    input_name = input_info.name
    net_h, net_w, _ = input_info.shape
    print(f"📦 Hailo-8 模型就绪 | 输入尺寸要求: {net_w}x{net_h}")

    # 初始化摄像头
    cap = cv2.VideoCapture(CAMERA_ID)
    if not cap.isOpened():
        print("❌ 无法打开摄像头，请检查权限或设备连接。")
        return
    
    # 强制限制摄像头采集分辨率，减轻树莓派 CPU 预处理负担与网络转发带宽
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cam_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    cam_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"📷 摄像头捕获中: {cam_w}x{cam_h}")

    # 开启虚拟设备与硬件推理引擎
    with VDevice() as target:
        network_group = target.configure(hef)[0]
        with network_group.activate():
            input_params = InputVStreamParams.make_from_network_group(network_group, FormatType.UINT8)
            output_params = OutputVStreamParams.make_from_network_group(network_group, FormatType.UINT8)

            with InferVStreams(network_group, input_params, output_params) as vstreams:
                print("🚀 26 TOPS 算力已上线！画面将通过 X11 发送至本地桌面...")
                print("💡 提示: 选中弹出的视频窗口，按下键盘上的 'q' 键即可退出。")

                fps_start = time.time()
                frame_count = 0
                avg_fps = 0

                while True:
                    ret, frame = cap.read()
                    if not ret: break

                    # 预处理：缩放并转换颜色空间
                    resized = cv2.resize(frame, (net_w, net_h))
                    rgb_frame = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
                    
                    # 必须以字典形式包裹输入数据 (HailoRT 4.23.0 规范)
                    input_data = {input_name: np.expand_dims(rgb_frame, axis=0)}

                    # 核心推理调用
                    results = vstreams.infer(input_data)
                    
                    # 结果解析
                    tensors = extract_tensors(results)
                    
                    # 解析硬件 NMS 引擎输出的 80 类别拆分格式
                    if len(tensors) >= 80:
                        for class_id in range(80):
                            data = tensors[class_id] # 维度: (N, 5) -> [ymin, xmin, ymax, xmax, score]
                            if data.shape[0] > 0:
                                for ymin, xmin, ymax, xmax, score in data:
                                    if score > 0.45:
                                        # 将归一化坐标还原至原始帧尺寸
                                        x1, y1 = int(xmin * cam_w), int(ymin * cam_h)
                                        x2, y2 = int(xmax * cam_w), int(ymax * cam_h)
                                        
                                        # 绘制边界框与标签
                                        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                                        label = f"{COCO_CLASSES[class_id]} {score:.2f}"
                                        cv2.putText(frame, label, (x1, y1 - 10), 
                                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

                    # 计算并绘制 FPS
                    frame_count += 1
                    if frame_count % 10 == 0:
                        now = time.time()
                        avg_fps = 10 / (now - fps_start)
                        fps_start = now
                    cv2.putText(frame, f"AI FPS: {avg_fps:.1f}", (20, 40), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

                    # 渲染窗口
                    cv2.imshow("Hailo-8 Real-time Detection", frame)

                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        break

    # 释放硬件资源
    cap.release()
    cv2.destroyAllWindows()
    print("\n✅ 推理任务圆满结束。")

if __name__ == "__main__":
    run_live_demo()
```


---


### ✅ 验证步骤

确保 Windows 端的 MobaXterm 正在运行，在终端执行：


```bash
uv run python live_demo.py
```

> 🎉
> 若一切顺利，你将在 Windows 屏幕上看到低延迟、高帧率的实时目标检测画面。
>


---

完成这套流程，边缘侧从环境配置到硬件加速的底层通路就算彻底被打通了！有问题随时复查这些配置点。
