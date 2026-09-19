import re


def _tail(text: str, n: int) -> str:
    """Last ~n chars, trimmed to a word boundary."""
    if n <= 0 or len(text) <= n:
        return text if n > 0 else ""
    t = text[-n:]
    i = t.find(" ")
    return t[i + 1 :] if 0 <= i < len(t) - 1 else t


def _hard_split(text: str, size: int, overlap: int) -> list[str]:
    """Split one oversized block by lines, then by characters."""
    out: list[str] = []
    cur = ""
    for line in text.split("\n"):
        while len(line) > size:
            if cur:
                out.append(cur)
                cur = ""
            out.append(line[:size])
            line = line[size - overlap :]
        if not cur:
            cur = line
        elif len(cur) + 1 + len(line) <= size:
            cur = f"{cur}\n{line}"
        else:
            out.append(cur)
            cur = line
    if cur:
        out.append(cur)
    return out


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 150) -> list[str]:
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[str] = []
    cur = ""

    for para in paragraphs:
        pieces = [para] if len(para) <= chunk_size else _hard_split(para, chunk_size, overlap)
        for piece in pieces:
            if not cur:
                cur = piece
            elif len(cur) + 2 + len(piece) <= chunk_size:
                cur = f"{cur}\n\n{piece}"
            else:
                chunks.append(cur)
                tail = _tail(cur, overlap)
                cur = f"{tail}\n\n{piece}" if tail else piece

    if cur:
        chunks.append(cur)
    return [c for c in chunks if c.strip()]