/* eslint-disable */
// PyPecker Pyodide worker.
// Loaded lazily by src/lib/pyodide.ts when the user starts training.

const PYODIDE_VERSION = '0.27.5';
const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

importScripts(`${PYODIDE_INDEX_URL}pyodide.js`);

let pyodide = null;

const SETUP_PY = `
import json, traceback, builtins

def __pp_normalize(value):
    if isinstance(value, dict):
        return {str(k): __pp_normalize(v) for k, v in sorted(value.items(), key=lambda kv: str(kv[0]))}
    if isinstance(value, set) or isinstance(value, frozenset):
        items = [__pp_normalize(v) for v in value]
        try:
            items.sort(key=lambda x: json.dumps(x, sort_keys=True, default=str))
        except Exception:
            items.sort(key=lambda x: str(x))
        return items
    if isinstance(value, tuple):
        return [__pp_normalize(v) for v in value]
    if isinstance(value, list):
        return [__pp_normalize(v) for v in value]
    return value

def __pp_hydrate_expected(expected_json, expected_type):
    parsed = json.loads(expected_json)
    if expected_type == 'set' and isinstance(parsed, list):
        return set(parsed)
    if expected_type == 'tuple' and isinstance(parsed, list):
        return tuple(parsed)
    return parsed

__pp_baseline_keys__ = None

def __pp_reset():
    global __pp_baseline_keys__
    g = globals()
    # Remove internal vars
    for name in ['result', '__result__', '__error__', '__actual_json__', '__expected_json__', '__correct__',
                 '__actual_norm__', '__expected_norm__', '__pp_user_code__', '__pp_expected_output__', '__pp_expected_type__']:
        if name in g:
            try:
                del g[name]
            except Exception:
                pass
    # Remove user-injected vars from previous puzzle (files, config, pairs, etc.)
    if __pp_baseline_keys__ is not None:
        added = set(g.keys()) - __pp_baseline_keys__
        for name in added:
            try:
                del g[name]
            except Exception:
                pass
    # Snapshot current keys as the clean baseline
    __pp_baseline_keys__ = set(g.keys())
`;

async function initPyodide() {
  pyodide = await loadPyodide({ indexURL: PYODIDE_INDEX_URL });
  await pyodide.runPythonAsync(SETUP_PY);
}

self.onmessage = async (event) => {
  const data = event.data || {};
  const { type, id } = data;

  try {
    if (type === 'init') {
      if (!pyodide) {
        await initPyodide();
      }
      self.postMessage({ type: 'ready', id });
      return;
    }

    if (type === 'ping') {
      self.postMessage({ type: 'pong', id });
      return;
    }

    if (!pyodide) {
      throw new Error('Pyodide is not initialized');
    }

    if (type === 'execute') {
      const result = await executeCode(data.code ?? '');
      self.postMessage({ type: 'result', id, ...result });
      return;
    }

    if (type === 'validate') {
      const result = await validate(
        data.givenVariables ?? '',
        data.givenCode ?? '',
        data.userCode ?? '',
        data.expectedOutput ?? 'null',
        data.expectedType ?? 'str',
      );
      self.postMessage({ type: 'validation', id, ...result });
      return;
    }

    throw new Error(`Unknown worker message type: ${type}`);
  } catch (err) {
    self.postMessage({
      type: 'error',
      id,
      message: err && err.message ? err.message : String(err),
    });
  }
};

async function executeCode(code) {
  try {
    pyodide.runPython('__pp_reset()');
    pyodide.globals.set('__pp_user_code__', code);
    await pyodide.runPythonAsync(`
try:
    try:
        __result__ = eval(__pp_user_code__, globals())
    except SyntaxError:
        exec(__pp_user_code__, globals())
        try:
            __result__ = result
        except NameError:
            __result__ = None
    __error__ = None
except Exception:
    __result__ = None
    __error__ = traceback.format_exc()
`);
    const error = pyodide.globals.get('__error__');
    if (error) {
      return { success: false, output: null, error: String(error) };
    }
    const rawResult = pyodide.globals.get('__result__');
    const output = pyToJs(rawResult);
    return { success: true, output };
  } catch (err) {
    return {
      success: false,
      output: null,
      error: err && err.message ? err.message : String(err),
    };
  }
}

async function validate(givenVariables, givenCode, userCode, expectedOutput, expectedType) {
  try {
    pyodide.runPython('__pp_reset()');

    if (givenVariables && givenVariables.trim()) {
      await pyodide.runPythonAsync(givenVariables);
    }
    if (givenCode && givenCode.trim()) {
      await pyodide.runPythonAsync(givenCode);
    }

    pyodide.globals.set('__pp_user_code__', userCode);
    pyodide.globals.set('__pp_expected_output__', expectedOutput);
    pyodide.globals.set('__pp_expected_type__', expectedType);

    await pyodide.runPythonAsync(`
try:
    try:
        __result__ = eval(__pp_user_code__, globals())
    except SyntaxError:
        exec(__pp_user_code__, globals())
        try:
            __result__ = result
        except NameError:
            __result__ = None
    __error__ = None
except Exception:
    __result__ = None
    __error__ = traceback.format_exc()

if __error__ is None:
    try:
        __actual_norm__ = __pp_normalize(__result__)
        __expected_norm__ = __pp_normalize(__pp_hydrate_expected(__pp_expected_output__, __pp_expected_type__))
        __correct__ = __actual_norm__ == __expected_norm__
        __actual_json__ = json.dumps(__actual_norm__, sort_keys=True, default=str)
        __expected_json__ = json.dumps(__expected_norm__, sort_keys=True, default=str)
    except Exception:
        __correct__ = False
        try:
            __actual_json__ = json.dumps(__result__, sort_keys=True, default=str)
        except Exception:
            __actual_json__ = repr(__result__)
        try:
            __expected_json__ = json.dumps(json.loads(__pp_expected_output__), sort_keys=True, default=str)
        except Exception:
            __expected_json__ = __pp_expected_output__
else:
    __correct__ = False
    __actual_json__ = ''
    __expected_json__ = __pp_expected_output__
`);

    const error = pyodide.globals.get('__error__');
    const actualSerialized = pyodide.globals.get('__actual_json__') ?? '';
    const expectedSerialized = pyodide.globals.get('__expected_json__') ?? expectedOutput;
    const correct = Boolean(pyodide.globals.get('__correct__'));
    const rawResult = pyodide.globals.get('__result__');
    const actualOutput = rawResult === undefined || rawResult === null ? null : pyToJs(rawResult);

    const response = {
      correct,
      actualOutput,
      actualSerialized: String(actualSerialized),
      expectedSerialized: String(expectedSerialized),
    };
    if (error) response.error = String(error);
    return response;
  } catch (err) {
    return {
      correct: false,
      actualOutput: null,
      actualSerialized: '',
      expectedSerialized: expectedOutput,
      error: err && err.message ? err.message : String(err),
    };
  }
}

function pyToJs(value) {
  try {
    if (value && typeof value.toJs === 'function') {
      const js = value.toJs({ dict_converter: Object.fromEntries });
      if (value.destroy) value.destroy();
      return js;
    }
    return value === undefined ? null : value;
  } catch {
    return String(value);
  }
}
