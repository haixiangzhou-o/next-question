#!/usr/bin/env python3
"""校验题库 JSON：结构 schema + 跨字段业务规则 + id 唯一性。

用法:
  python validate.py <file.json> [more.json ...]

支持两种输入：
  1. 题目数组文件（structure.py 直接产出）
  2. 带 meta 的题库文件 {meta, questions}
"""
import json
import sys
from pathlib import Path

from jsonschema import Draft7Validator

SCHEMA_PATH = Path(__file__).resolve().parents[2] / "schema" / "question.schema.json"


def load_schema():
    with SCHEMA_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def validate_questions(questions):
    """返回 (errors, warning_count)。errors 为致命错误列表。"""
    schema = load_schema()
    validator = Draft7Validator(schema)
    errors = []
    seen_ids = set()

    for i, q in enumerate(questions):
        loc = f"题目[{i}]"
        if not isinstance(q, dict):
            errors.append(f"{loc} 不是对象")
            continue

        # 结构校验
        for err in validator.iter_errors(q):
            errors.append(f"{loc} schema: {err.message} @ {'/'.join(map(str, err.path))}")

        qid = q.get("id")
        if qid in seen_ids:
            errors.append(f"{loc} id 重复: {qid}")
        seen_ids.add(qid)

        # 跨字段业务规则
        t = q.get("type")
        if t == "single":
            if not q.get("options") or len(q["options"]) < 2:
                errors.append(f"{loc} single 缺 options 或少于 2 项")
            if not q.get("answer"):
                errors.append(f"{loc} single 缺 answer")
            if "referenceAnswer" in q:
                errors.append(f"{loc} single 不应有 referenceAnswer")
        elif t in ("short_answer", "essay"):
            if not q.get("referenceAnswer"):
                errors.append(f"{loc} {t} 缺 referenceAnswer")
            if "options" in q or "answer" in q:
                errors.append(f"{loc} {t} 不应有 options/answer")
        elif t is not None:
            errors.append(f"{loc} 未知题型: {t}")

    return errors


def main(argv=None):
    if len(argv) < 2:
        print(__doc__)
        return 2

    total_errors = 0
    for arg in argv[1:]:
        path = Path(arg)
        if not path.exists():
            print(f"[跳过] 文件不存在: {path}", file=sys.stderr)
            total_errors += 1
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict) and "questions" in data:
            questions = data["questions"]
        elif isinstance(data, list):
            questions = data
        else:
            print(f"[失败] {path}: 既不是数组也不是 {meta, questions}", file=sys.stderr)
            total_errors += 1
            continue

        errors = validate_questions(questions)
        if errors:
            total_errors += len(errors)
            print(f"[失败] {path}: {len(questions)} 题, {len(errors)} 个错误")
            for e in errors:
                print(f"   - {e}")
        else:
            print(f"[通过] {path}: {len(questions)} 题")

    return 1 if total_errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
