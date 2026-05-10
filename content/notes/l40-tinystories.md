---
id: note_tools_winbeau_027
slug: l40-tinystories
title: "L40 - TinyStories"
summary: "L40 - TinyStories —— 工程速查 / 实操记录。"
category: tools
tags: [LLM, 训练, GPU]
author: winbeau
createdAt: 2026-03-02T06:45:00Z
readMinutes: 4
notionUuid: 320fed6a-f36f-8231-9184-8158443e49dd
---

#### 尝试


```bash
python scripts/train.py \
  --train_data data/TinyStories/train_tokens.npy \
  --val_data data/TinyStories/valid_tokens.npy \
  --device cuda:2 \
  --vocab_size 16384 \
  --num_layers 12 \
  --num_heads 12 \
  --d_model 768 \
  --context_len 1024 \
  --batch_size 32 \
  --grad_accum 8 \
  --total_steps 15000 \
  --eval_every 500 \
  --ckpt_every 3000 \
  --warmup_iters 1000 \
  --lr_max 6e-4 \
  --device cuda:2
```


#### 41GB 榨干


```bash
CUDA_VISIBLE_DEVICES=2 python scripts/train.py \
    --train_data data/TinyStories/train_tokens.npy \
    --val_data data/TinyStories/valid_tokens.npy \
    --device cuda \
    --vocab_size 16384 \
    --num_layers 12 \
    --num_heads 12 \
    --d_model 768 \
    --context_len 1024 \
    --batch_size 16 \
    --total_steps 30000 \
    --eval_every 500 \
    --ckpt_every 3000 \
    --warmup_iters 1000 \
    --lr_max 6e-4
```


#### 长上下文


```bash
CUDA_VISIBLE_DEVICES=2 python scripts/train.py \
  --train_data data/TinyStories/train_tokens.npy \
  --val_data data/TinyStories/valid_tokens.npy \
  --device cuda \
  --vocab_size 16384 \
  --num_layers 12 \
  --num_heads 12 \
  --d_model 768 \
  --context_len 1536 \
  --batch_size 8 \
  --grad_accum_steps 4 \
  --total_steps 30000 \
  --eval_every 500 \
  --ckpt_every 3000 \
  --warmup_iters 1000 \
  --lr_max 6e-4 \

```
