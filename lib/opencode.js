import { spawn } from 'node:child_process';

// Build the inline OpenCode config that maps the user's OpenRouter settings
// (baseUrl + model) so model and endpoint can be changed from the UI.
export function buildOpencodeConfig(settings) {
  const model = settings?.modelName || 'google/gemini-2.5-pro';
  const baseURL = settings?.baseUrl || 'https://openrouter.ai/api/v1';
  return {
    $schema: 'https://opencode.ai/config.json',
    model: `openrouter/${model}`,
    provider: {
      openrouter: {
        options: {
          baseURL,
          apiKey: '{env:OPENROUTER_API_KEY}',
        },
      },
    },
    // Non-interactive runs: auto-approve so it never blocks on a prompt.
    permission: { edit: 'allow', bash: 'allow', webfetch: 'allow' },
    share: 'disabled',
    autoupdate: false,
  };
}

// Resolve the opencode binary. Allow override via env for servers where it's
// not on PATH for the PM2 process.
function opencodeBin() {
  return process.env.OPENCODE_BIN || 'opencode';
}

/**
 * Run `opencode run` non-interactively in a working directory, streaming
 * stdout/stderr lines to onOutput. Resolves with the exit code.
 *
 * @param {object} params
 * @param {string} params.prompt   The task prompt.
 * @param {string} params.cwd      Working directory (isolated per session).
 * @param {object} params.settings Settings row (baseUrl, apiKey, modelName).
 * @param {AbortSignal} [params.signal]
 * @param {(line: string) => void} params.onOutput
 */
export function runOpencode({ prompt, cwd, settings, signal, onOutput }) {
  const config = buildOpencodeConfig(settings);
  const model = `openrouter/${settings?.modelName || 'google/gemini-2.5-pro'}`;

  const env = {
    ...process.env,
    OPENROUTER_API_KEY: settings?.apiKey || '',
    OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
    OPENCODE_DISABLE_AUTOUPDATE: 'true',
    // Keep it quiet and non-interactive.
    CI: 'true',
  };

  const args = ['run', prompt, '--model', model, '--print-logs', '--log-level', 'ERROR'];

  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(opencodeBin(), args, { cwd, env, shell: false });
    } catch (err) {
      reject(err);
      return;
    }

    const onAbort = () => {
      try { child.kill('SIGTERM'); } catch {}
    };
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort);
    }

    const pump = (chunk) => {
      const text = chunk.toString();
      for (const line of text.split('\n')) {
        if (line.trim().length) onOutput(line);
      }
    };

    child.stdout.on('data', pump);
    child.stderr.on('data', pump);

    child.on('error', (err) => {
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(err);
    });

    child.on('close', (code) => {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve(code ?? 0);
    });
  });
}
