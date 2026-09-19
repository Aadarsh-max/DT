import json
import re
from typing import Any

_THINK = re.compile(r"<think>.*?</think>", re.S | re.I)
_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.I)
_TRAILING_COMMA = re.compile(r",\s*([}\]])")


def _clean(text: str) -> str:
    text = _THINK.sub("", text or "")
    text = text.split("</think>")[-1].strip()
    return _FENCE.sub("", text).strip()


def loads_lenient(text: str) -> Any:
    """Parse JSON that may have fences, think-blocks, trailing commas or trailing text."""
    s = _clean(text)
    starts = [i for i in (s.find("{"), s.find("[")) if i != -1]
    if not starts:
        raise ValueError("no JSON found")
    s = s[min(starts):]

    for candidate in (s, _TRAILING_COMMA.sub(r"\1", s)):
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass
        try:
            obj, _ = json.JSONDecoder().raw_decode(candidate)
            return obj
        except json.JSONDecodeError:
            pass
    raise ValueError("invalid JSON")


def salvage_objects(text: str) -> list[dict]:
    """Recover every complete {...} object from truncated or broken output."""
    s = _clean(text)
    m = re.search(r'"test_cases"\s*:\s*\[', s)
    if m:
        start = m.end()
    else:
        start = s.find("[") + 1 if "[" in s else 0

    objs: list[dict] = []
    depth = 0
    in_str = False
    esc = False
    begin = None

    for i in range(start, len(s)):
        ch = s[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            if depth == 0:
                begin = i
            depth += 1
        elif ch == "}" and depth > 0:
            depth -= 1
            if depth == 0 and begin is not None:
                chunk = _TRAILING_COMMA.sub(r"\1", s[begin : i + 1])
                try:
                    objs.append(json.loads(chunk))
                except json.JSONDecodeError:
                    pass
                begin = None

    return [o for o in objs if isinstance(o, dict)]


def extract_items(text: str, key: str = "test_cases") -> list[dict]:
    """Return the list of objects under `key`, falling back to salvage on broken JSON."""
    try:
        data = loads_lenient(text)
        items = None
        if isinstance(data, dict):
            items = data.get(key)
            if items is None:
                items = next((v for v in data.values() if isinstance(v, list)), None)
            if items is None and "title" in data:
                items = [data]
        elif isinstance(data, list):
            items = data
        if isinstance(items, list):
            return [i for i in items if isinstance(i, dict)]
    except ValueError:
        pass
    return salvage_objects(text)