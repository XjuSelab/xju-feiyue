---
id: note_tools_winbeau_029
slug: cuda-install
title: CUDA 安装
summary: 安装 CUDA 11.6：
category: tools
tags: [CUDA, GPU, 深度学习]
author: winbeau
createdAt: 2026-03-02T06:45:06Z
readMinutes: 5
notionUuid: 165fed6a-f36f-82c9-882e-8165ffda72ae
---

### 1.可能遇到 驱动失败


```bash
sudo apt update
sudo apt install -y nvidia-driver-550 # 5090 要求 550版本以上
sudo reboot
```


### 2.安装官方库


```bash
sudo apt update
sudo apt install -y gnupg
wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb
sudo dpkg -i cuda-keyring_1.1-1_all.deb
sudo apt update
```


### 3.安装指定cuda版本

安装 CUDA 11.6：


```bash
wget https://developer.download.nvidia.com/compute/cuda/11.6.0/local_installers/cuda_11.6.0_510.39.01_linux.run
sudo sh cuda_11.6.0_510.39.01_linux.run
```


```bash
wget https://developer.download.nvidia.com/compute/redist/cudnn/v8.4.1/local_installers/11.6/cudnn-linux-x86_64-8.4.1.50_cuda11.6-archive.tar.xz
tar -xJvf cudnn-linux-x86_64-8.4.1.50_cuda11.6-archive.tar.xz
cd cudnn-linux-x86_64-8.4.1.50_cuda11.6-archive
sudo mv include/* /usr/local/cuda-11.6/include/
sudo mv lib/libcudnn* /usr/local/cuda-11.6/lib64/
```

或者安装 CUDA 11.8：


```bash
sudo apt install -y cuda-toolkit-11-8
```

> 💡 这不会冲突，它们会分别安装在 `/usr/local/cuda-11.x` 下。


### 4.软链接切换（系统层面）

CUDA 默认路径是 `/usr/local/cuda`，PyTorch、nvcc 默认找这个目录。

你只需修改链接：

切换到 **11.6**：


```bash
sudo rm -f /usr/local/cuda
sudo ln -s /usr/local/cuda-11.6 /usr/local/cuda
```

切换到 **11.8**：


```bash
sudo rm -f /usr/local/cuda
sudo ln -s /usr/local/cuda-11.8 /usr/local/cuda
```

检查结果：


```bash
ls -l /usr/local | grep cuda
nvcc -V
```


### 5.或者写在配置脚本里切换


```bash
export CUDA_HOME=/usr/local/cuda-11.6
export PATH=$CUDA_HOME/bin:$PATH
export LD_LIBRARY_PATH=$CUDA_HOME/lib64:$LD_LIBRARY_PATH
```
