# Python Click & Typer

Click 是 Python 最成熟的 CLI 框架，Typer 基于 Click 构建，支持类型注解自动生成参数。

## Typer（推荐新项目）

```python
# main.py
import typer
from typing import Optional, List
from enum import Enum

app = typer.Typer(help="Deployment CLI")

class Environment(str, Enum):
    dev = "dev"
    staging = "staging"
    prod = "prod"

@app.command()
def deploy(
    environment: Environment = typer.Argument(..., help="Target environment"),
    tag: str = typer.Option("latest", "--tag", "-t", help="Docker image tag"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Simulate deployment"),
    regions: List[str] = typer.Option(["us-east-1"], "--region", help="Target regions"),
):
    """Deploy application to specified environment."""
    typer.echo(f"Deploying to {environment.value} with tag {tag}")
    if dry_run:
        typer.echo("(dry run mode)")
    for region in regions:
        typer.echo(f"  - {region}")

@app.command()
def rollback(
    environment: Environment,
    version: Optional[str] = typer.Option(None, "--to", help="Target version"),
):
    """Rollback deployment."""
    target = version or "previous"
    typer.echo(f"Rolling back {environment.value} to {target}")

if __name__ == "__main__":
    app()
```

## Rich 集成

```python
# rich_cli.py
from typer import Typer
from rich import print as rprint
from rich.table import Table
from rich.panel import Panel

app = Typer()

@app.command()
def status():
    table = Table(title="Service Status")
    table.add_column("Service", style="cyan")
    table.add_column("Status", style="green")
    table.add_column("Replicas")
    
    table.add_row("api-gateway", "[green]running[/green]", "3/3")
    table.add_row("order-service", "[yellow]degraded[/yellow]", "2/3")
    table.add_row("payment", "[red]failed[/red]", "0/2")
    
    rprint(table)

@app.command()
def info():
    rprint(Panel.fit("[bold blue]AI Agent CLI v1.0[/bold blue]"))
```
