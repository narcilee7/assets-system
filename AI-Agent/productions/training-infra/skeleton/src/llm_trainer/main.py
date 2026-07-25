"""Unified entry point for all training stages."""

import argparse
import random
from pathlib import Path

import numpy as np
import torch

from llm_trainer.checkpoint import CheckpointManager
from llm_trainer.config import ExperimentConfig, load_config, log_config_to_wandb
from llm_trainer.data import DataModule
from llm_trainer.distributed import DistributedBackend
from llm_trainer.evaluation import WeaveEvaluator
from llm_trainer.models import build_model_and_tokenizer
from llm_trainer.tracking import WandbTracker
from llm_trainer.trainer import build_trainer


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="LLM/Agent Training Infrastructure")
    parser.add_argument("config", type=str, help="Path to config YAML")
    parser.add_argument("--resume", type=str, default=None, help="Resume from checkpoint path")
    parser.add_argument("--wandb-offline", action="store_true", help="Run Wandb in offline mode")
    parser.add_argument("--overrides", nargs="*", default=[], help="OmegaConf overrides (key=value)")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = load_config(args.config)

    if args.resume:
        config.checkpoint.resume_from_checkpoint = args.resume
    if args.wandb_offline:
        config.wandb.offline = True

    set_seed(config.training.seed)

    # Initialize distributed backend
    distributed = DistributedBackend(config.distributed)

    # Build model and tokenizer
    model, tokenizer = build_model_and_tokenizer(config)

    # Prepare data
    data_module = DataModule(config.data, tokenizer, config.stage)
    data_module.setup()
    train_dataloader = data_module.train_dataloader()
    eval_dataloader = data_module.eval_dataloader()

    # Tracking
    tracker = WandbTracker(config.wandb, run_name=config.run_name)
    if distributed.is_main_process:
        tracker.init(config_dict=log_config_to_wandb(config))

    # Checkpoint
    checkpoint_manager = CheckpointManager(config.checkpoint, tracker)

    # Optional: resume
    if config.checkpoint.resume_from_checkpoint:
        # Load from path or find latest
        resume_path = Path(config.checkpoint.resume_from_checkpoint)
        if not resume_path.exists():
            latest = checkpoint_manager.find_latest_checkpoint()
            if latest:
                resume_path = latest
        # In real code, resume optimizer/scheduler/rng states here.

    # Weave evaluation
    weave_evaluator = WeaveEvaluator(config.weave, model, tokenizer)
    if distributed.is_main_process:
        weave_evaluator.init()

    # Wrap model for distributed training
    model = distributed.prepare_model(model)

    # Build trainer
    trainer = build_trainer(
        config=config,
        model=model,
        tokenizer=tokenizer,
        train_dataloader=train_dataloader,
        eval_dataloader=eval_dataloader,
        tracker=tracker,
        checkpoint_manager=checkpoint_manager,
        distributed=distributed,
    )

    # Run training
    trainer.train()

    # Final evaluation
    if config.weave.enabled and distributed.is_main_process:
        eval_results = weave_evaluator.evaluate()
        tracker.log_metrics({"weave/eval": eval_results})

    # Cleanup
    checkpoint_manager.wait_for_uploads()
    distributed.cleanup()


if __name__ == "__main__":
    main()
