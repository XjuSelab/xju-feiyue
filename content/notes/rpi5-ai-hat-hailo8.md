---
id: note_tools_winbeau_040
slug: rpi5-ai-hat-hailo8
title: Raspberry Pi5 + AI HAT(Hailo8)
summary: "在边缘计算设备上部署大算力 AI 加速卡时，硬件通讯、环境依赖和 API 变动往往是最耗时的环节。本文记录了在 树莓派 5 上挂载 Hailo-8 (PCI…"
category: tools
tags: [Hailo8, AI 硬件, 树莓派, 硬件]
author: winbeau
createdAt: 2026-03-20T16:12:18Z
readMinutes: 20
notionUuid: 329fed6a-f36f-8048-aa19-fc2044069ffc
---

在边缘计算设备上部署大算力 AI 加速卡时，硬件通讯、环境依赖和 API 变动往往是最耗时的环节。本文记录了在 **树莓派 5** 上挂载 **Hailo-8 (PCIe Gen3 x4)** AI 算力卡，并使用最新的 **HailoRT 4.23.0** 驱动成功运行 YOLOv8 目标检测的全流程经验。


---


### 1. 硬件与底层环境


|  |  |
| --- | --- |
| **主控平台** | Raspberry Pi 5 (Ubuntu 24.04 LTS) |
| **AI 加速卡** | Hailo-8 M.2 PCIe 模块（算力：26 TOPS，典型功耗：3-5W） |
| **软件栈** | Python 3.12、`uv` 包管理器、HailoRT 4.23.0 |


---


### 2. 环境配置与包管理"坑点"

在较新的 Ubuntu 系统中（PEP 668），系统禁止通过 `pip` 直接安装全局包。推荐使用 `uv` 进行虚拟环境管理，但需要注意以下依赖陷阱：


#### 坑点 1：包名与导入名不一致

Hailo 官方提供的 Python 驱动轮子（如 `hailort-4.23.0-cp312-cp312-linux_aarch64.whl`），其**元数据包名**为 `hailort`，但在 Python 代码中的**导入名**为 `hailo_platform`。

> ⚠️
> 如果在 `pyproject.toml` 中使用 `uv` 管理依赖，必须写明正确的包名，且强烈建议锁定 Python 版本，否则 `uv sync` 会因无法解析全平台依赖而报错。
>


```toml
[project]
name = "hailo-demo"
version = "0.1.0"
requires-python = "==3.12.*" # 强制锁定版本，避免跨平台解析失败

dependencies = [
    "numpy",
    "pillow",
    "opencv-python",
    "hailort @ file:whls/hailort-4.23.0-cp312-cp312-linux_aarch64.whl", # 使用相对路径和真实包名
]
```


---


### 3. HailoRT 4.23.0 API 核心演进

相比早期的 4.1x 版本，4.23.0 在 API 层级上做了大量重构，许多旧代码会直接报错。

1. **废弃底层物理句柄**：不再推荐使用 `Device.create_pcie` 或 `PcieDevice`。全面拥抱 `VDevice`（虚拟设备），它会自动处理设备的扫描、多通道调度和资源分配。
1. **强制激活网络组**：调用 `target.configure(hef)` 只是加载配置。在进行任何数据传输前，必须使用上下文管理器 `with network_group.activate():` 显式激活网络，以唤醒硬件的 NN 计算集群并锁定 DMA 通道。
1. **推理输入格式要求**：`vstreams.infer()` 方法**不再接受单纯的 NumPy 数组**，必须传入一个字典：`{ "输入层名称": numpy_array_data }`。

---


### 4. 硬件 NMS 引擎与输出解析

Hailo-8 内部集成了非极大值抑制（NMS）硬件引擎，这意味着网络输出的不再是繁杂的特征图，而是直接过滤好的检测框，极大地释放了 CPU 算力。


#### COCO 数据集分离输出特性

在某些编译好的 YOLOv8 模型中（如 Model Zoo 提供的 `yolov8s.hef`），硬件 NMS 会将 80 个类别的结果**完全分拆为 80 个独立的张量**（以此消除分类器内存锁竞争，实现 140+ FPS 的超高吞吐）。

- 返回结果中包含 **80 个张量**
- 每个张量的维度为 `(N, 5)`，即 `N` 个目标，包含 `[ymin, xmin, ymax, xmax, score]`
- 张量在列表中的**索引（Index）即代表该目标的类别 ID**（Class ID）

---


### 5. 完整实战代码（Robust 版本）

以下代码集成了图像预处理、硬件调度配置、防崩溃张量提取以及 OpenCV 结果绘制，可直接保存为 `main.py` 运行：


```python
import numpy as np
import cv2
import os
from PIL import Image
from hailo_platform import VDevice, HEF, InferVStreams, InputVStreamParams, OutputVStreamParams, FormatType

HEF_PATH = "yolov8s.hef"
IMAGE_PATH = "test.jpg"
OUTPUT_PATH = "result_detected.jpg"

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
    """万能张量提取器：递归扒出所有嵌套结构中的 NumPy 数组"""
    tensors = []
    if isinstance(data, dict):
        for v in data.values():
            tensors.extend(extract_tensors(v))
    elif isinstance(data, (list, tuple)):
        for v in data:
            tensors.extend(extract_tensors(v))
    elif isinstance(data, np.ndarray):
        tensors.append(data)
    return tensors


def run_hailo_inference():
    if not os.path.exists(HEF_PATH):
        raise FileNotFoundError(f"找不到模型文件 {HEF_PATH}")

    hef = HEF(HEF_PATH)
    input_vstream_info = hef.get_input_vstream_infos()[0]
    input_name = input_vstream_info.name
    height, width, _ = input_vstream_info.shape

    print(f"📦 模型加载成功，输入层: {input_name} ({width}x{height})")

    # 预处理：缩放并转为 uint8 格式以最大化 PCIe 传输带宽
    raw_img = Image.open(IMAGE_PATH).convert('RGB')
    resized_img = raw_img.resize((width, height), Image.BILINEAR)
    input_data = np.expand_dims(np.array(resized_img, dtype=np.uint8), axis=0)

    # 核心：必须以字典形式包裹输入数据
    input_dict = {input_name: input_data}

    with VDevice() as target:
        network_group = target.configure(hef)[0]
        # 激活网络组，唤醒硬件集群
        with network_group.activate():
            input_params = InputVStreamParams.make_from_network_group(network_group, FormatType.UINT8)
            output_params = OutputVStreamParams.make_from_network_group(network_group, FormatType.UINT8)

            with InferVStreams(network_group, input_params, output_params) as vstreams:
                print(f"🚀 正在利用 26 TOPS 算力进行推理...")
                results = vstreams.infer(input_dict)
                return results


def visualize_results(results, original_image_path):
    img = cv2.imread(original_image_path)
    h_orig, w_orig = img.shape[:2]

    tensors = extract_tensors(results)

    # 匹配硬件 NMS 的 80 类别分离输出格式
    if len(tensors) >= 80 and all(len(t.shape) == 2 and t.shape[1] == 5 for t in tensors[:80]):
        print(f"🎯 识别到按类别分离的 NMS 输出结构")
        count = 0

        for class_id in range(80):
            data = tensors[class_id]
            if data.shape[0] > 0:
                for detection in data:
                    ymin, xmin, ymax, xmax, score = detection

                    if score > 0.45:  # 过滤低置信度结果
                        count += 1
                        left, top = int(xmin * w_orig), int(ymin * h_orig)
                        right, bottom = int(xmax * w_orig), int(ymax * h_orig)

                        cv2.rectangle(img, (left, top), (right, bottom), (0, 255, 0), 2)
                        label = f"{COCO_CLASSES[class_id]} {score:.2f}"
                        cv2.putText(img, label, (left, top - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

                        print(f"  └─ 检出: {COCO_CLASSES[class_id]} (置信度: {score:.2f})")

        if count > 0:
            cv2.imwrite(OUTPUT_PATH, img)
            print(f"🎉 结果已保存至: {OUTPUT_PATH}")
    else:
        print("❌ 无法匹配当前张量结构，请检查模型输出日志。")


if __name__ == "__main__":
    try:
        results = run_hailo_inference()
        if results is not None:
            visualize_results(results, IMAGE_PATH)
    except Exception as e:
        print(f"❌ 运行失败: {e}")
```


---


### 6. 进阶调试建议

> 🔍
> **硬件监控**：在运行推理脚本时，建议开启新终端执行 `hailortcli monitor`。可以实时观测到执行 `infer` 时的瞬时功耗变化（通常在 4.7W 左右）以及芯片温度，确保散热状态良好。
>

> ⚡
> **性能榨取**：当前的单图同步推理尚未完全榨干 26 TOPS 算力。如果接入视频流，可以利用 `AsyncInferJob`（异步流 API）构建流水线，或者将图像预处理/裁剪逻辑交由芯片内部的硬件插值引擎完成，进一步降低 CPU 负载。
>
