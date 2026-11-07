const indexURL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
const sourceURL = new URL("../py/", self.location.href);

const bridge = String.raw`
import json
import sys


def summarize(value, depth=0):
    if isinstance(value, str):
        return {"preview": value[:40], "words": len(value.split())}
    if isinstance(value, (list, tuple)):
        # Bound the preview even when learner code builds a self-referencing list.
        first = summarize(value[0], depth + 1) if value and depth < 3 else None
        return {"length": len(value), "first": first}
    if value is None or isinstance(value, (int, float, bool)):
        return value
    return {"type": type(value).__name__}


def learner_error(error):
    line = 1
    traceback = error.__traceback__
    while traceback is not None:
        if traceback.tb_frame.f_code.co_filename == "<learner>":
            line = traceback.tb_lineno
        traceback = traceback.tb_next
    if isinstance(error, SyntaxError):
        if error.filename == "<learner>":
            line = error.lineno or line
        message = f"Python could not read line {line}: {error.msg.rstrip('.')}."
    elif isinstance(error, ValueError) and str(error):
        message = str(error)
    else:
        message = f"{type(error).__name__} on line {line}: {str(error) or type(error).__name__}"
    return {"ok": False, "error": " ".join(message.splitlines()), "line": line}


def run_learner(request_json):
    request = json.loads(request_json)
    fn = request["fn"]
    calls, stack = [], []
    truncated = False

    def profile(frame, event, value):
        nonlocal truncated
        code = frame.f_code
        if code.co_name != fn or code.co_filename != "<learner>":
            return
        if event == "call":
            if len(calls) == 200:
                truncated = True
                return
            names = code.co_varnames[:code.co_argcount + code.co_kwonlyargcount]
            locals_ = frame.f_locals
            arguments = {name: summarize(locals_[name]) for name in names}
            separators = locals_.get("separators")
            if "separators" in arguments and isinstance(separators, (list, tuple)):
                if all(isinstance(separator, str) for separator in separators):
                    arguments["separators"]["values"] = [separator[:40] for separator in separators]
            call = {
                "id": len(calls),
                "parent": stack[-1][1]["id"] if stack else None,
                "depth": len(stack),
                "args": arguments,
                "result": None,
            }
            calls.append(call)
            stack.append((frame, call))
        elif event == "return" and stack and stack[-1][0] is frame:
            _, call = stack.pop()
            call["result"] = summarize(value)

    namespace = {}
    previous_profile = sys.getprofile()
    try:
        exec(compile(request["code"], "<learner>", "exec"), namespace)
        if fn not in namespace:
            raise NameError(f"Define {fn} before running the code.")
        if request["trace"]:
            sys.setprofile(profile)
        try:
            value = namespace[fn](*request["args"])
        finally:
            sys.setprofile(previous_profile)
        result = {"ok": True, "value": value}
        if request["trace"]:
            result["calls"] = calls
            if truncated:
                result["truncated"] = True
        return json.dumps(result, allow_nan=False)
    except BaseException as error:
        sys.setprofile(previous_profile)
        return json.dumps(learner_error(error))


run_learner
`;

async function start() {
  importScripts(indexURL + "pyodide.js");
  const [python, files] = await Promise.all([
    loadPyodide({ indexURL }),
    Promise.all(["chunkers.py", "search.py"].map(async (file) => {
      const response = await fetch(new URL(file, sourceURL));
      if (!response.ok) throw new Error(`Could not load ${file}.`);
      return [file, await response.text()];
    })),
  ]);
  for (const [file, code] of files) python.FS.writeFile(file, code);
  const runLearner = python.runPython(bridge);

  self.onmessage = ({ data: { id, ...request } }) => {
    try {
      const result = JSON.parse(runLearner(JSON.stringify(request)));
      self.postMessage({ id, result });
    } catch {
      self.postMessage({ id, result: { ok: false, error: "Python could not run this code.", line: null } });
    }
  };
  self.postMessage({ type: "ready" });
}

start().catch(() => self.postMessage({ type: "startup-error" }));
