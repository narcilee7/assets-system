#!/bin/bash
# Multi-node distributed launcher for llm_trainer.
# Usage (on each node):
#   NODE_RANK=0 NNODES=4 NODE_ADDR=10.0.0.1 bash scripts/launch_distributed.sh configs/pretrain.yaml
#   NODE_RANK=1 NNODES=4 NODE_ADDR=10.0.0.1 bash scripts/launch_distributed.sh configs/pretrain.yaml

set -euo pipefail

CONFIG_FILE=${1:-configs/pretrain.yaml}
NNODES=${NNODES:-1}
NODE_RANK=${NODE_RANK:-0}
NODE_ADDR=${NODE_ADDR:-localhost}
NPROC_PER_NODE=${NPROC_PER_NODE:-8}

# Optional Wandb / Weave env
# export WANDB_API_KEY=...
# export WANDB_PROJECT=llm-agent-train

echo "Launching distributed training: node $NODE_RANK / $NNODES, $NPROC_PER_NODE GPUs per node"

torchrun \
    --nnodes="$NNODES" \
    --node_rank="$NODE_RANK" \
    --nproc_per_node="$NPROC_PER_NODE" \
    --master_addr="$NODE_ADDR" \
    --master_port=29500 \
    -m llm_trainer.main "$CONFIG_FILE"
