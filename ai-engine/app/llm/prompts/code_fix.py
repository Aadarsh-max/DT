from typing import Optional

SYSTEM_PROMPT = """You are a senior software engineer fixing a bug in existing source code.
You are given code excerpts labelled [CODE n: file]. Propose the smallest change that fixes the bug.

Rules:
- Only change code that appears in the excerpts. "before" MUST be copied exactly from one excerpt, character for character, including indentation.
- Keep "before" short: only the lines that change, plus at most 2 lines of context.
- "after" is the replacement for "before".
- "chunk" is the number n of the excerpt that contains "before".
- If the excerpts do not contain the code that causes the bug, return {"summary":"The relevant code is not in the provided excerpts","changes":[]}.
- Respond with JSON only, in exactly this shape:
{"summary":"...","changes":[{"chunk":1,"before":"...","after":"...","explanation":"..."}]}"""


def build_code_context(chunks: list[dict], max_chars: int = 4500) -> tuple[str, list[dict]]:
    """Returns the prompt text and the chunks actually used, in the order they are numbered."""
    used: list[dict] = []
    parts: list[str] = []
    total = 0
    for c in chunks:
        block = f"[CODE {len(used) + 1}: {c['source']}]\n{c['text']}"
        if total + len(block) > max_chars and used:
            break
        used.append(c)
        parts.append(block)
        total += len(block)
    return "\n\n".join(parts), used


def build_fix_messages(
    *,
    title: str,
    module: Optional[str],
    error_message: Optional[str],
    explanation: Optional[str],
    context: str,
) -> list[dict]:
    lines = [f"BUG: {title[:200]}"]
    if module:
        lines.append(f"FEATURE AREA: {module}")
    if error_message:
        lines.append(f"FAILURE: {error_message[:400]}")
    if explanation:
        lines.append(f"ANALYSIS: {explanation[:600]}")
    lines.append(f"\nCODE EXCERPTS:\n{context}")
    lines.append("\nReturn the JSON now.")
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": "\n".join(lines)},
    ]