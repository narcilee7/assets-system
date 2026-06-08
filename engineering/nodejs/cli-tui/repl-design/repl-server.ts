import repl from 'repl';

const server = repl.start({
  prompt: 'ai> ',
  useColors: true,
  useGlobal: false,
  writer: (output: any) => {
    if (typeof output === 'object') {
      return JSON.stringify(output, null, 2);
    }
    return String(output);
  },
});

(server.context as any).agent = {
  async chat(message: string) {
    return `Response to: ${message}`;
  },
  tools: ['search', 'calculate', 'deploy'],
};

(server.context as any).utils = {
  formatDate: (d: Date) => d.toISOString(),
};

server.defineCommand('tools', {
  help: 'List available tools',
  action() {
    this.clearBufferedCommand();
    console.log('Available tools:', (server.context as any).agent.tools.join(', '));
    this.displayPrompt();
  },
});

server.defineCommand('reset', {
  help: 'Reset conversation context',
  action() {
    this.clearBufferedCommand();
    console.log('Context reset.');
    this.displayPrompt();
  },
});

server.on('exit', () => {
  console.log('Goodbye!');
  process.exit(0);
});
