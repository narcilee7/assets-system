from rich import print as rprint
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.syntax import Syntax
from rich.table import Table

console = Console()

rprint("[bold red]Error:[/bold red] Something went wrong")
rprint("[green]Success![/green] Operation completed")

table = Table(title="Service Status", show_header=True, header_style="bold magenta")
table.add_column("Service", style="cyan")
table.add_column("Status", style="green")
table.add_column("Latency", justify="right")

table.add_row("api-gateway", "[green]●[/green] running", "12ms")
table.add_row("order-service", "[yellow]●[/yellow] degraded", "145ms")
table.add_row("payment", "[red]●[/red] down", "timeout")

console.print(table)

# 面板
console.print(Panel.fit("[bold blue]AI Agent CLI v2.0[/bold blue]", title="Welcome"))

# 代码高亮
code = """def hello():
    print("Hello, World!")"""
syntax = Syntax(code, "python", theme="monokai")
console.print(syntax)

# Markdown
md = Markdown("# Hello\n\nThis is **bold** and _italic_ text.")
console.print(md)

# 进度条
with Progress(
    SpinnerColumn(),
    TextColumn("[progress.description]{task.description}"),
    console=console,
) as progress:
    task = progress.add_task("Processing...", total=None)
    # 模拟工作
    import time

    time.sleep(2)
    progress.update(task, description="Done!")
