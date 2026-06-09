# CLI 脚手架

## 1. Plop

```javascript
// plopfile.js
export default function (plop) {
  plop.setGenerator('component', {
    description: 'Create a React component',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Component name:',
      },
      {
        type: 'confirm',
        name: 'withTest',
        message: 'Include test file?',
        default: true,
      },
    ],
    actions: [
      {
        type: 'add',
        path: 'src/components/{{pascalCase name}}/{{pascalCase name}}.tsx',
        templateFile: 'templates/component.hbs',
      },
      {
        type: 'add',
        path: 'src/components/{{pascalCase name}}/{{pascalCase name}}.test.tsx',
        templateFile: 'templates/component.test.hbs',
        skip: (data) => !data.withTest,
      },
      {
        type: 'add',
        path: 'src/components/{{pascalCase name}}/index.ts',
        template: "export * from './{{pascalCase name}}';",
      },
    ],
  });
}
```

```bash
npx plop component
# ? Component name: Button
# ? Include test file? Yes
# → 生成 Button.tsx, Button.test.tsx, index.ts
```

## 2. 自定义 CLI

```javascript
#!/usr/bin/env node
// bin/my-cli.js
const { program } = require('commander');

program
  .name('my-cli')
  .description('Frontend scaffolding CLI')
  .version('1.0.0');

program
  .command('create <name>')
  .description('Create a new component')
  .option('-t, --type <type>', 'component type', 'react')
  .action(async (name, options) => {
    console.log(`Creating ${options.type} component: ${name}`);
    // 执行模板生成
  });

program.parse();
```
