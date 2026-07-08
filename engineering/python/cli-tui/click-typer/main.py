from enum import Enum
from typing import List, Optional

import typer

app = typer.Typer(help="Deployment CLI")


class Environment(str, Enum):
    dev = "dev"
    staging = "staging"
    prod = "prod"


@app.command()
def deploy(
    env: Environment = typer.Argument(..., help="Target environment"),
    tag: str = typer.Option("latest", "--tag", "-t", help="Docker image tag"),
    dry_run: bool = typer.Option(False, "--dry-run", "-n", help="Dry run"),
    regions: List[str] = typer.Option(
        [], "--region", "-r", help="Regions to deploy to"
    ),
):
    typer.echo(f"Deploying to {env} with tag {tag} in regions {regions}")
    if dry_run:
        typer.echo("(dry run mode)")
    for region in regions:
        typer.echo(f"  - {region}")


@app.command()
def rollback(
    env: Environment,
    version: Optional[str] = typer.Option(None, "--to", help="Version to rollback to"),
):
    target = version or "previous"
    typer.echo(f"Rolling back to {target} in {env}")


if __name__ == "__main__":
    app()
