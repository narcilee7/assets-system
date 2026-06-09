import { spawn } from 'child_process';
import { Readable } from 'stream';

interface RunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeout?: number;
  stdin?: string | Buffer | Readable;
}

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function runCommand(
  command: string,
  args: string[],
  options: RunOptions = {},
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timeoutId: NodeJS.Timeout | undefined;

    if (options.timeout) {
      timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Command timed out after ${options.timeout}ms`));
      }, options.timeout);
    }

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    if (options.stdin) {
      if (typeof options.stdin === 'string' || Buffer.isBuffer(options.stdin)) {
        child.stdin?.write(options.stdin);
        child.stdin?.end();
      } else if (options.stdin instanceof Readable) {
        options.stdin.pipe(child.stdin!);
      }
    } else {
      child.stdin?.end();
    }

    child.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timeoutId);
      resolve({ stdout, stderr, exitCode: code || 0 });
    });
  });
}
