---
id: note_tools_winbeau_035
slug: tmp
title: tmp
summary: "在 Ragged-Cache Attention 支持变长 head-level KV cache 的统一计算后，最后一步是依据不同 attention h…"
category: tools
tags: [速记]
author: winbeau
createdAt: 2026-04-04T08:34:42Z
readMinutes: 7
notionUuid: 325fed6a-f36f-80d5-b1c8-dd0af93e83e2
---

在 Ragged-Cache Attention 支持变长 head-level KV cache 的统一计算后，最后一步是依据不同 attention head 的历史关注模式与时序行为，为其设计 head-specific 的 KV cache 策略。由于邻近历史帧对视频块之间的连贯性、平滑过渡与局部时序一致性至关重要，我们对所有 head 统一固定保留最近 ⁍ 帧作为共享的 recent 窗口，并将更早历史中补充进入该窗口的压缩支持部分记为 middle。因此，对第 ⁍ 个 head 在时刻 ⁍ （时间索引按 ⁍ 编号）的候选历史集合，定义为


$$
\mathcal{U}_h(t) = \big\{ n_{\mathcal{S}}^{(h)},\; n_{\mathcal{S}}^{(h)}+1,\; \dots,\; t - n_{\mathcal{R}} \big\},
$$

即位于当前 head 的 sink 与共享 recent 之间的候选中间历史；不同 head 的策略差异主要体现在如何从 ⁍ 中构造 middle 集合 ⁍ 。

**Anchor Heads.** Anchor Head 对长跨度历史保持稳定而持续的高响应，因此需要跨时间均匀分布的稀疏支撑。为此，我们采用 stride 压缩策略。给定步长 ⁍ ，定义全局固定采样栅格


$$
\mathcal{A}_{\Delta} = \big\{ \tau \mid \tau \bmod \Delta = 0 \big\},
$$

则


$$
\mathcal{M}_{\text{anchor}}(t) = \operatorname{TopLast}_{cap}\!\big( \mathcal{U}_h(t) \cap \mathcal{A}_{\Delta} \big).
$$

因此，stride 在整个时间轴上采用与当前 ⁍ 无关的固定采样模式；主配置中取 ⁍ 。

**Wave Heads.** Wave Head 的注意力沿时间呈现明显的周期起伏，因此只需保留与当前时刻相位对齐的少量历史峰值帧。为此，我们采用 cyclic 压缩策略。给定周期 ⁍ ，按相位划分


$$
\mathcal{B}_h^{(q)}(t) = \big\{ \tau \in \mathcal{U}_h(t) \mid \tau \bmod T = q \big\}, \qquad q \in \{0, \dots, T-1\},
$$

并仅保留当前相位对应 bucket 中最近的 ⁍ 个锚点：


$$
\mathcal{M}_{\text{wave}}(t) = \operatorname{TopLast}_{cap}\!\big( \mathcal{B}_h^{(t \bmod T)}(t) \big).
$$

因此，cyclic 的采样模式会随当前时刻的相位而变化；主配置中取 ⁍ 。

**Veil Heads.** Veil Head 对远程历史中的细粒度信息依赖较弱，更需要压缩后的粗粒度上下文概要。为此，我们采用 merge 压缩策略，将 ⁍ 划分为若干连续时间块，并将每个时间块压缩为一个代表性历史单元。设 merge block 的 patch 大小为 ⁍ ，其时间跨度为


$$
L_{\mathrm{blk}} = s^2.
$$

于是


$$
\mathcal{G}_j(t) = \big\{ \tau_j,\; \tau_j + 1,\; \dots,\; \tau_j + L_{\mathrm{blk}} - 1 \big\}, \qquad \bar{\mathcal{G}}_j(t) = \phi_{\mathrm{merge}}\!\big( \mathcal{G}_j(t) \big),
$$

并定义


$$
\mathcal{M}_{\text{veil}}(t) = \operatorname{TopLast}_{cap}\!\big( \{\bar{\mathcal{G}}_j(t)\}_j \big).
$$

因此，merge 保留的不是原始逐帧中间历史，而是压缩后的块级上下文概要；主配置中取 ⁍ 。

综上，我们将不同 head 的历史需求分别落实为 Anchor: stride、Wave: cyclic 和 Veil: merge 三种 middle 压缩方式。整体上，所有 head 统一采用 recent4；sink 原本也希望统一，但实验表明，若对 Wave Head 同样保留 sink3，会明显破坏生成稳定性，因此最终采用 Wave: sink1，而 Anchor/Veil: sink3。此外，我们在 attention 计算前对保留历史统一施加 Dynamic RoPE，以缓解长视频自回归生成超出训练时间窗口后的时序位置失真。
