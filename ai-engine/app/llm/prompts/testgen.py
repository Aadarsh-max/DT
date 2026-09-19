from typing import Optional

SYSTEM_PROMPT = """You are a senior QA engineer who writes precise, executable test cases from software requirements.

Rules:
- Use ONLY facts found in the CONTEXT. Do not invent features, limits, endpoints or field names.
- Be specific: use concrete values from the context in steps and test_data.
- Write steps as short imperative sentences, one action each.
- Each test case checks ONE thing and has a clear, checkable expected_result.
- priority is one of LOW, MEDIUM, HIGH, CRITICAL.
- module is the feature area in 1 to 3 words (for example "Login", "Cart").
- Do not repeat or rephrase anything listed under ALREADY COVERED.
- If the context does not support enough test cases, return fewer.
- Respond with JSON only, in exactly this shape:
{"test_cases":[{"title":"...","description":"...","module":"...","priority":"HIGH","preconditions":"...","steps":["...","..."],"expected_result":"...","test_data":{"key":"value"}}]}"""

TYPE_GUIDE = {
    "FUNCTIONAL": "Verify that each feature works as the requirements describe: main flows, business rules and expected outcomes.",
    "BOUNDARY": "Test limits taken from the requirements: minimum and maximum values, lengths, counts, thresholds and time limits. Test just inside, exactly on, and just outside each limit.",
    "NEGATIVE": "Test invalid or unexpected use: wrong, empty or malformed input, missing required fields, disallowed actions, unauthorised users and error handling.",
    "SECURITY": "Test security behaviour: authentication and session handling, access control between roles, injection (SQL, XSS), brute force and lockout, and exposure of sensitive data.",
    "API": "Test the HTTP endpoints described in the requirements: status codes, response bodies, validation, authentication and error responses.",
}

# Used to pull the most relevant chunks out of the vector index for each type
TYPE_QUERY = {
    "FUNCTIONAL": "features, user flows, business rules and expected behaviour",
    "BOUNDARY": "limits, minimum, maximum, length, quantity, range, threshold, expiry, time limit",
    "NEGATIVE": "validation, invalid input, errors, restrictions, not allowed, must not, failure handling",
    "SECURITY": "authentication, authorization, roles, permissions, password, session, lockout, sensitive data, audit",
    "API": "API endpoint, request, response, status code, method, authentication, parameters",
}

PLATFORM_NOTE = {
    "WEB": "The application is a web app. Steps are user actions in a browser: open a page, type into a field, click a button, check what is shown.",
    "API": "The application is a backend API. Steps describe HTTP requests and checks on the response.",
    "MOBILE": "The application is an Android app. Steps are user actions on the device: tap, swipe, type, rotate, check what is shown.",
}

API_RULES = (
    'For API test cases, test_data MUST contain "method" (GET, POST, ...), "endpoint" (path only, '
    'for example "/api/login"), "expected_status" (an integer) and, when needed, "headers" and '
    '"body" (objects). Steps describe the request and the response checks.'
)


def build_context(chunks: list[dict], max_chars: int = 4000) -> str:
    parts: list[str] = []
    used = 0
    for c in chunks:
        block = f"[{c['source']} - part {c['chunk_index'] + 1}]\n{c['text']}"
        if used + len(block) > max_chars and parts:
            break
        parts.append(block[:max_chars])
        used += len(block)
    return "\n\n".join(parts)


def build_messages(
    *,
    test_type: str,
    count: int,
    project_name: str,
    platform: str,
    context: str,
    module: Optional[str] = None,
    base_url: Optional[str] = None,
    avoid_titles: Optional[list[str]] = None,
) -> list[dict]:
    system = SYSTEM_PROMPT + "\n\n" + PLATFORM_NOTE.get(platform, PLATFORM_NOTE["WEB"])
    if test_type == "API":
        system += "\n" + API_RULES

    lines = [
        f'Write {count} {test_type} test cases for "{project_name or "the application"}".',
        f"Focus: {TYPE_GUIDE[test_type]}",
    ]
    if module:
        lines.append(f"Only cover this feature area: {module}.")
    if base_url:
        lines.append(f"Base URL of the application: {base_url}")
    if avoid_titles:
        covered = "\n".join(f"- {t[:100]}" for t in avoid_titles[:20])
        lines.append(f"\nALREADY COVERED (do not repeat):\n{covered}")
    lines.append(f"\nCONTEXT:\n{context}")
    lines.append("\nReturn the JSON now. /no_think")

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": "\n".join(lines)},
    ]