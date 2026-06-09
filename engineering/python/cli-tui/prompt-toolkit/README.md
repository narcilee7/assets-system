# Python Prompt Toolkit

Prompt Toolkit 是构建交互式命令行应用的高级库，支持自动补全、历史记录、多行编辑。

## 核心实现

```python
# prompt_demo.py
from prompt_toolkit import PromptSession
from prompt_toolkit.completion import WordCompleter
from prompt_toolkit.history import FileHistory
from prompt_toolkit.key_binding import KeyBindings

# 自动补全
completer = WordCompleter([
    'deploy', 'rollback', 'status', 'logs', 'scale',
    'dev', 'staging', 'prod',
])

session = PromptSession(
    completer=completer,
    history=FileHistory('.deploy_history'),
)

# 快捷键绑定
kb = KeyBindings()

@kb.add('c-d')
def _(event):
    event.app.exit()

# 交互式会话
while True:
    try:
        text = session.prompt('deploy> ', key_bindings=kb)
        print(f'Executing: {text}')
    except KeyboardInterrupt:
        continue
    except EOFError:
        break
```

## 多行编辑

```python
from prompt_toolkit.validation import Validator

# 验证器
def is_valid_command(text):
    return text.startswith(('deploy', 'rollback', 'status'))

validator = Validator.from_callable(
    is_valid_command,
    error_message='Invalid command',
    move_cursor_to_end=True,
)

text = session.prompt('> ', multiline=True, validator=validator)
```

## AI Agent 交互式 REPL

```python
# agent_repl.py
from prompt_toolkit import PromptSession
from prompt_toolkit.styles import Style

style = Style.from_dict({
    'prompt': 'ansicyan bold',
    'user': 'ansigreen',
})

session = PromptSession(style=style)

while True:
    user_input = session.prompt('Agent> ', style='class:prompt')
    response = agent.process(user_input)
    print(f"Agent: {response}")
```
