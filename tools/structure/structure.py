#!/usr/bin/env python3
"""调用大模型，把提取的文本结构化为题库 JSON。

通过 OpenAI 兼容 API 调用（默认 DeepSeek），需设置环境变量:
  LLM_API_BASE   默认 https://api.deepseek.com
  LLM_API_KEY    必填
  LLM_MODEL      默认 deepseek-chat

用法:
  python structure.py <input.txt> -o <output.json> --kind exam --year 2410

--kind:
  exam              真题试卷（单选/简答/论述，需对齐卷末答案）
  chapter_exercise  章节 PPT 练习题
  notes             复习笔记/答题技巧
"""
import argparse
import json
import os
import sys
from pathlib import Path

SCHEMA_SPEC = """每个题目对象字段如下（JSON）：
{
  "id": "唯一ID，格式 15043-<考期或章节>-<题型>-<序号>，如 15043-2410-single-01",
  "type": "single | short_answer | essay",
  "chapter": "章节，如 第一章",
  "knowledgePoint": "知识点（可空）",
  "difficulty": 1到5的整数，默认 2,
  "stem": "题干（中文原文）",
  "options": ["A. ...", "B. ...", ...],   // 仅 single
  "answer": "A",                           // 仅 single，正确选项字母
  "referenceAnswer": "参考答案全文",         // 仅 short_answer / essay
  "explanation": "解析（可空）",
  "source": {"kind": "exam", "year": "2410", "file": "xxx.docx", "page": null},
  "tags": ["标签1", "标签2"]
}
约束：
- single：必须有 options（≥2 项）和 answer，不得有 referenceAnswer
- short_answer / essay：必须有 referenceAnswer，不得有 options 和 answer
- 题干、选项、答案、解析必须保持中文原文，不得翻译、改写或省略
- 只输出一个 JSON 对象，形如 {"questions": [...]}，不要任何解释文字或 markdown 代码块
"""

KIND_EXTRA = {
    "exam": (
        "这是自考《中国近现代史纲要》(15043) 的真题试卷，含单项选择题（25 题）、"
        "简答题（5 题）、论述题（3 题选做 2 题）。请全部提取：单选题归为 single，"
        "简答题归为 short_answer，论述题归为 essay。试卷末尾的“参考答案”区需与题号对齐，"
        "把正确答案/参考答案填入对应题目。论述题 3 题全部提取为独立 essay 题，"
        "“3 选 2”规则在试卷层面处理，不在单题字段体现。"
    ),
    "chapter_exercise": (
        "这是《中国近现代史纲要》某一章节复习 PPT 中的练习题。请提取其中的题目，"
        "选择题归为 single，简答/问答归为 short_answer。章节名请按 PPT 对应章节填写。"
    ),
    "notes": (
        "这是复习笔记或考试答题注意事项/技巧。请把知识点或考点整理为 short_answer 形式"
        "（题干为考点问题，referenceAnswer 为要点说明），并打上 tags 标签。"
    ),
}


def call_llm(text: str, kind: str, base: str, key: str, model: str,
             year: str, chapter: str):
    import requests

    kind_extra = KIND_EXTRA[kind]
    year_line = f"考期(year) 统一填 \"{year}\"。\n" if year else ""
    chapter_line = f"章节(chapter) 统一填 \"{chapter}\"。\n" if chapter else ""
    user = (
        f"{kind_extra}\n{year_line}{chapter_line}\n\n"
        f"{SCHEMA_SPEC}\n\n试题文本如下：\n\n{text}"
    )

    resp = requests.post(
        f"{base.rstrip('/')}/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": "你是题库数据整理助手，把试题文本精确结构化为 JSON。"},
                {"role": "user", "content": user},
            ],
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
        },
        timeout=600,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def parse_questions(content: str):
    """解析 LLM 输出为题目数组，兼容 markdown 代码块。"""
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        # 去掉可能的 ```json ... ``` 包裹后重试
        stripped = content.strip()
        if stripped.startswith("```"):
            stripped = stripped.split("\n", 1)[1] if "\n" in stripped else stripped
            if stripped.rstrip().endswith("```"):
                stripped = stripped.rstrip()[:-3]
        data = json.loads(stripped)

    if isinstance(data, dict) and "questions" in data:
        return data["questions"]
    if isinstance(data, list):
        return data
    raise ValueError("LLM 输出既不是 {questions: [...]} 也不是数组")


def main(argv=None):
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("input", help="提取后的文本文件")
    parser.add_argument("-o", "--output", required=True, help="输出 JSON 文件（题目数组）")
    parser.add_argument("--kind", choices=["exam", "chapter_exercise", "notes"],
                        default="chapter_exercise")
    parser.add_argument("--year", help="真题考期，如 2410")
    parser.add_argument("--chapter", help="章节名，如 第一章")
    args = parser.parse_args(argv)

    api_base = os.environ.get("LLM_API_BASE", "https://api.deepseek.com")
    api_key = os.environ.get("LLM_API_KEY")
    model = os.environ.get("LLM_MODEL", "deepseek-chat")
    if not api_key:
        print("请先设置环境变量 LLM_API_KEY", file=sys.stderr)
        return 2

    src = Path(args.input)
    if not src.exists():
        print(f"文件不存在: {src}", file=sys.stderr)
        return 2
    text = src.read_text(encoding="utf-8")

    print(f"调用 LLM（model={model}）处理 {len(text)} 字符文本……")
    content = call_llm(text, args.kind, api_base, api_key, model,
                       args.year, args.chapter)
    questions = parse_questions(content)

    out = Path(args.output)
    out.write_text(json.dumps(questions, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"结构化完成，共 {len(questions)} 题 -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
