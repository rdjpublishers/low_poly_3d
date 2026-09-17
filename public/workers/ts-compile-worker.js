// v1.35 / v8.26 — Off-main-thread TypeScript compiler Worker
//
// Why this exists:
// The renderer used to call ts.transpileModule() synchronously on the
// main UI thread, which BLOCKS the entire browser (spinner stops,
// inputs don't respond, scroll freezes) for 50-200ms per demo model
// load. This Worker moves the compile off-thread so the UI stays
// responsive and the loading spinner keeps spinning.
//
// How it's used:
// runTsBlueprint() in index.html posts the raw .ts source to this
// Worker via { source, id }, awaits the reply on { id, compiledSource,
// diagnostics | error }, then proceeds with the existing blob-import
// + factory() invocation. If the Worker fails to load (older browser,
// CSP, etc.) the caller falls back to the inline compile path that
// was already there.
//
// Module Worker:
// Loaded with `new Worker(url, { type: 'module' })` so it can use
// `import()` to pull typescript@5.5 from esm.sh — the SAME CDN the
// inline path already uses, so behaviour matches.

'use strict';

let __tsLib = null;

async function getTs() {
  if (__tsLib) return __tsLib;
  try {
    const mod = await import('https://esm.sh/typescript@5.5');
    __tsLib = mod.default || mod;
    return __tsLib;
  } catch (err) {
    throw new Error(
      'Could not load the TypeScript compiler inside the compile ' +
      'worker. Either come back online, or the inline fallback will ' +
      'be used. (' + (err.message || String(err)) + ')'
    );
  }
}

self.addEventListener('message', async (e) => {
  const { id, source } = e.data || {};
  if (typeof id !== 'number' || typeof source !== 'string') {
    self.postMessage({
      id: id || 0,
      ok: false,
      error: 'Worker expected { id: number, source: string }',
    });
    return;
  }
  try {
    const ts = await getTs();
    const out = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        esModuleInterop: true,
        isolatedModules: true,
      },
      reportDiagnostics: true,
    });
    // Mirror the inline compile's error mapping so the caller can
    // produce an identical error message ("TypeScript syntax error
    // at line N: ...").
    if (out.diagnostics && out.diagnostics.length) {
      const d = out.diagnostics[0];
      const msg = ts.flattenDiagnosticMessageText(d.messageText, ' ');
      if (d.file && d.start != null) {
        const { line } = d.file.getLineAndCharacterOfPosition(d.start);
        self.postMessage({
          id,
          ok: false,
          error: `TypeScript syntax error at line ${line + 1}: ${msg}`,
        });
        return;
      }
      self.postMessage({
        id,
        ok: false,
        error: `TypeScript syntax error: ${msg}`,
      });
      return;
    }
    self.postMessage({
      id,
      ok: true,
      compiledSource: out.outputText,
      // No diagnostics on the happy path — keep the message small.
    });
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: (err && err.message) || String(err),
    });
  }
});
