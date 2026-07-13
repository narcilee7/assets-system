.PHONY: install install-dev format lint test sft sft-single sft-multi pretrain pretrain-multi dpo dpo-multi clean

PYTHON := python
CONFIG_DIR := configs
SRC_DIR := src

install:
	pip install -e .

install-dev:
	pip install -e ".[dev]"

install-all:
	pip install -e ".[dev,deepspeed,flash]"

format:
	black $(SRC_DIR)
	ruff check --fix $(SRC_DIR)

lint:
	black --check $(SRC_DIR)
	ruff check $(SRC_DIR)

test:
	pytest tests/ -v

sft:
	bash scripts/launch_single.sh configs/sft.yaml

sft-multi:
	bash scripts/launch_distributed.sh configs/sft.yaml

pretrain:
	bash scripts/launch_single.sh configs/pretrain.yaml

pretrain-multi:
	bash scripts/launch_distributed.sh configs/pretrain.yaml

dpo:
	bash scripts/launch_single.sh configs/dpo.yaml

dpo-multi:
	bash scripts/launch_distributed.sh configs/dpo.yaml

clean:
	find $(SRC_DIR) -type d -name __pycache__ -exec rm -rf {} +
	find $(SRC_DIR) -type f -name "*.pyc" -delete
	rm -rf outputs/ checkpoints/ wandb/ .pytest_cache/
