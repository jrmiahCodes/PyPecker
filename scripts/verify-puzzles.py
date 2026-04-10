#!/usr/bin/env python3
"""Run each puzzle's solution and confirm it matches expected_output.

Mirrors the validation logic in public/pyodide-worker.js so we catch
mismatches before they hit the browser.
"""
import json
import sys
from pathlib import Path


def normalize(value):
    if isinstance(value, dict):
        return {str(k): normalize(v) for k, v in sorted(value.items(), key=lambda kv: str(kv[0]))}
    if isinstance(value, (set, frozenset)):
        items = [normalize(v) for v in value]
        try:
            items.sort(key=lambda x: json.dumps(x, sort_keys=True, default=str))
        except Exception:
            items.sort(key=lambda x: str(x))
        return items
    if isinstance(value, tuple):
        return [normalize(v) for v in value]
    if isinstance(value, list):
        return [normalize(v) for v in value]
    return value


def hydrate_expected(expected_json: str, expected_type: str):
    parsed = json.loads(expected_json)
    if expected_type == "set" and isinstance(parsed, list):
        return set(parsed)
    if expected_type == "tuple" and isinstance(parsed, list):
        return tuple(parsed)
    return parsed


def run_puzzle(puzzle):
    globals_dict: dict = {}
    if puzzle.get("given_variables"):
        exec(puzzle["given_variables"], globals_dict)
    if puzzle.get("given_code"):
        exec(puzzle["given_code"], globals_dict)
    user_code = puzzle["solution"]
    try:
        result = eval(user_code, globals_dict)
    except SyntaxError:
        exec(user_code, globals_dict)
        result = globals_dict.get("result")
    actual_norm = normalize(result)
    expected_norm = normalize(hydrate_expected(puzzle["expected_output"], puzzle["expected_output_type"]))
    return actual_norm == expected_norm, actual_norm, expected_norm


def main():
    base = Path(__file__).resolve().parent.parent / "public" / "puzzles"
    failures = 0
    for path in sorted(base.glob("*.json")):
        puzzles = json.loads(path.read_text())
        print(f"\n== {path.name} ({len(puzzles)} puzzles) ==")
        for p in puzzles:
            try:
                ok, actual, expected = run_puzzle(p)
            except Exception as exc:
                print(f"  FAIL {p['id']}: raised {type(exc).__name__}: {exc}")
                failures += 1
                continue
            status = "PASS" if ok else "FAIL"
            print(f"  {status} {p['id']}")
            if not ok:
                failures += 1
                print(f"    actual:   {json.dumps(actual, default=str)}")
                print(f"    expected: {json.dumps(expected, default=str)}")
    if failures:
        print(f"\n{failures} puzzle(s) failed")
        sys.exit(1)
    print("\nall puzzles pass")


if __name__ == "__main__":
    main()
