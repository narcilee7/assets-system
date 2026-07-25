#!/bin/bash
# Single-node launcher for llm_trainer.
# Usage: bash scripts/launch_single.sh configs/sft.yaml

set -euo pipefail

CONFIG_FILE=${1:-configs/sft.yaml}
NUM_GPUS=${2:-$(nvidia-smi -L | wc -l)}

# Fallback to CPU if no GPU detected
if [ "$NUM_GPUS" -eq 0 ]; then
    echo "No GPU detected, running on CPU."
    NUM_GPUS=1
fi

echo "Launching $CONFIG_FILE on $NUM_GPUS GPU(s)..."

if [ "$NUM_GPUS" -eq 1 ]; then
    python -m llm_trainer.main "$CONFIG_FILE"
else
    torchrun \
        --nnodes=1 \
        --nproc_per_node="$NUM_GPUS" \
        --rdzv_id=llm-train \
        --rdzv_backend=c10d \
        --rdzv_endpoint=localhost:29500 \
        -m llm_trainer.main "$CONFIG_FILE"
fi
