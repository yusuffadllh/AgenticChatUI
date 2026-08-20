import { spawn } from 'node:child_process';

// Provider id we register for the user's custom OpenAI-compatible gateway.
const PROVIDER_ID = 'custom';

// Build the inline OpenCode config. The user's endpoint is an OpenAI-compatible
// gateway (not OpenRouter's catalog), so we register a custom provider and
// declare the exact model name — otherwise OpenCode rejects it as "not found".
export function buildOpencodeConfig(settings) {
  const modelName = settings?.modelName || 'gpt-4o';
  const baseURL = settings?.baseUrl || 'https://openrouter.ai/api/v1';
  return {
    $schema: 'https://opencode.ai/config.json',
    model: `${PROVIDER_ID}/${modelName}`,
    provider: {
      [PROVIDER_ID]: {
        npm: '@ai-sdk/openai-compatible',
        name: 'Custom Gateway',
        options: {
          baseURL,
          apiKey: '{env:OPENCODE_API_KEY}',
        },
        // Register the model so OpenCode accepts it without a catalog lookup.
        models: {
          [modelName]: { name: modelName },
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
  const model = `${PROVIDER_ID}/${settings?.modelName || 'gpt-4o'}`;

  const env = {
    ...process.env,
    OPENCODE_API_KEY: settings?.apiKey || '',
    OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
    OPENCODE_DISABLE_AUTOUPDATE: 'true',
    // Cegah hang saat first-run: jangan fetch model list & jangan prune.
    OPENCODE_DISABLE_MODELS_FETCH: 'true',
    OPENCODE_DISABLE_PRUNE: 'true',
    // Non-interactive.
    CI: 'true',
  };

  // --auto: auto-approve semua permission (tidak nunggu prompt).
  // --print-logs --log-level INFO: tampilkan progress ke stderr supaya
  // eksekusi tidak terlihat "diam" padahal model sedang bekerja.
  const args = [
    'run',
    prompt,
    '--model',
    model,
    '--auto',
    '--print-logs',
    '--log-level',
    'INFO',
  ];

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
