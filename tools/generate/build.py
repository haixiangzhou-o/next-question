#!/usr/bin/env python3
"""将结构化题目数组打包为带 meta 的题库文件 {meta, questions}。

用法:
  python build.py -o <out.json> --subject 中国近现代史纲要 --kind exam --year 2410 <in1.json> [in2.json ...]

  <in*.json> 为 structure.py 产出的题目数组，可多个合并。

示例:
  python build.py -o ../question-bank/exam/2410.json --subject 中国近现代史纲要 --kind exam --year 2410 2410.questions.json
"""
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def main(argv=None):
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("inputs", nargs="+", help="输入题目数组 JSON（一个或多个）")
    parser.add_argument("-o", "--output", required=True, help="输出题库文件路径")
    parser.add_argument("--subject-code", default="15043")
    parser.add_argument("--subject", default="中国近现代史纲要")
    parser.add_argument("--kind", choices=["exam", "chapter_exercise", "notes"],
                        default="chapter_exercise")
    parser.add_argument("--year", help="真题考期（kind=exam 时）")
    args = parser.parse_args(argv)

    questions = []
    for inp in args.inputs:
        path = Path(inp)
        if not path.exists():
            print(f"文件不存在: {path}", file=sys.stderr)
            return 2
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, list):
            questions.extend(data)
        elif isinstance(data, dict) and "questions" in data:
            questions.extend(data["questions"])
        else:
            print(f"格式错误: {path}", file=sys.stderr)
            return 2

    bundle = {
        "meta": {
            "subjectCode": args.subject_code,
            "subject": args.subject,
            "kind": args.kind,
            "year": args.year,
            "version": "1.0.0",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        },
        "questions": questions,
    }
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"打包完成: {len(questions)} 题 -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
