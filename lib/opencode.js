import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

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
export function runOpencode({ prompt, cwd, settings, signal, onOutput, idleTimeoutMs = 120000 }) {
  const config = buildOpencodeConfig(settings);
  const model = `${PROVIDER_ID}/${settings?.modelName || 'gpt-4o'}`;

  // Isolate OpenCode's global config/state to a per-run folder so the host's
  // ~/.config/opencode and ~/.opencode files can't override our inline config
  // (a common cause of the process stalling right after "init").
  const isolatedHome = path.join(cwd, '.opencode-home');

  const env = {
    ...process.env,
    HOME: isolatedHome,
    XDG_CONFIG_HOME: path.join(isolatedHome, '.config'),
    XDG_DATA_HOME: path.join(isolatedHome, '.local', 'share'),
    XDG_CACHE_HOME: path.join(isolatedHome, '.cache'),
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

  // Ensure the isolated home dir exists so OpenCode doesn't fall back to the
  // host's global config.
  try { fs.mkdirSync(isolatedHome, { recursive: true }); } catch {}

  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(opencodeBin(), args, { cwd, env, shell: false });
    } catch (err) {
      reject(err);
      return;
    }

    // Idle watchdog: if OpenCode produces no output for idleTimeoutMs (e.g. it
    // hangs after "init" waiting on the gateway), kill it so the task fails
    // cleanly and the loop can continue instead of stalling forever.
    let killedByTimeout = false;
    let idleTimer;
    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        killedByTimeout = true;
        onOutput(`⏱️ Tidak ada aktivitas selama ${Math.round(idleTimeoutMs / 1000)}s — menghentikan OpenCode (kemungkinan hang / gateway tidak merespons).`);
        try { child.kill('SIGKILL'); } catch {}
      }, idleTimeoutMs);
    };
    resetIdle();

    const onAbort = () => {
      try { child.kill('SIGTERM'); } catch {}
    };
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort);
    }

    const pump = (chunk) => {
      resetIdle();
      const text = chunk.toString();
      for (const line of text.split('\n')) {
        if (line.trim().length) onOutput(line);
      }
    };

    child.stdout.on('data', pump);
    child.stderr.on('data', pump);

    child.on('error', (err) => {
      if (idleTimer) clearTimeout(idleTimer);
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(err);
    });

    child.on('close', (code) => {
      if (idleTimer) clearTimeout(idleTimer);
      if (signal) signal.removeEventListener('abort', onAbort);
      if (killedByTimeout) {
        reject(new Error('OpenCode timed out (no output within idle window)'));
        return;
      }
      resolve(code ?? 0);
    });
  });
}
