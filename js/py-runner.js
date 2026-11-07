(() => {
  const scriptURL = document.currentScript.src;
  const workerURL = new URL("py-worker.js", scriptURL);
  const sourceURL = new URL("../py/", scriptURL);
  const startupError = "Python could not load. Check your connection and reload the page.";
  const timeoutError = "Your code ran for more than 2 seconds. Check for a loop that never ends.";
  const pending = new Map();
  const sources = new Map();
  let worker, ready;
  let nextId = 0;
  let queue = Promise.resolve();

  function startWorker() {
    ready = new Promise((resolve, reject) => {
      const current = new Worker(workerURL);
      worker = current;

      function fail() {
        current.terminate();
        if (worker !== current) return;
        worker = null;
        reject(new Error(startupError));
        for (const finish of pending.values()) {
          finish({ ok: false, error: "Python stopped unexpectedly. Try running your code again.", line: null });
        }
      }

      current.onmessage = ({ data }) => {
        if (worker !== current) return;
        if (data.type === "ready") resolve();
        else if (data.type === "startup-error") fail();
        else pending.get(data.id)?.(data.result);
      };
      current.onerror = (event) => {
        event.preventDefault();
        fail();
      };
    });
    // Widgets can await readiness later, after the learner makes a prediction.
    ready.catch(() => {});
  }

  function run(code, fn, args, trace) {
    // Start the clock only after startup and any earlier request have finished.
    const task = queue.then(async () => {
      if (!worker) startWorker();
      try {
        await ready;
      } catch {
        return { ok: false, error: startupError, line: null };
      }
      return new Promise((resolve) => {
        const id = nextId++;
        const current = worker;
        const finish = (result) => {
          clearTimeout(timer);
          pending.delete(id);
          resolve(result);
        };
        const timer = setTimeout(() => {
          current.terminate();
          startWorker();
          finish({ ok: false, error: timeoutError });
        }, 2000);
        pending.set(id, finish);
        try {
          current.postMessage({ id, code, fn, args, trace });
        } catch {
          finish({ ok: false, error: "Python could not read the inputs for this run.", line: null });
        }
      });
    });
    queue = task.catch(() => {});
    return task;
  }

  async function source(module, fn) {
    if (!sources.has(module)) {
      sources.set(module, fetch(new URL(`${module}.py`, sourceURL)).then(async (response) => {
        if (!response.ok) throw new Error(`Could not load ${module}.py.`);
        return (await response.text()).split(/\r?\n/);
      }).catch((error) => {
        sources.delete(module);
        throw error;
      }));
    }
    const lines = await sources.get(module);
    const start = lines.indexOf(`# >>> ${fn}`);
    const end = lines.indexOf(`# <<< ${fn}`, start + 1);
    if (start < 0 || end < 0) throw new Error(`Could not find the code for ${fn}.`);
    return lines.slice(start + 1, end).join("\n");
  }

  startWorker();
  ChunkLab.py = {
    get ready() { return ready; },
    source,
    call: (code, fn, args) => run(code, fn, args, false),
    trace: (code, fn, args) => run(code, fn, args, true),
  };
})();
