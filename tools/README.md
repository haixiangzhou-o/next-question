# 题库加工工具（M1）

把 `raw_materials/` 里的真题 Word、章节 PPT、复习笔记，转换为 `question-bank/` 下的结构化 JSON。

## 依赖

- Python 3.9+
- [LibreOffice](https://www.libreoffice.org/)（仅处理 `.doc` 时需要，用于转 `.docx`）

```bash
pip install -r requirements.txt
```

## 管线

```
raw_materials/*.doc/.docx/.pptx
   │ ① extract/extract.py         文本提取
   ▼
*.txt（中间产物）
   │ ② structure/structure.py     AI 结构化（需 LLM_API_KEY）
   ▼
*.questions.json（题目数组）
   │ ③ validate/validate.py       校验（schema + 业务规则 + id 唯一）
   │ ④ generate/build.py          打包为 {meta, questions}
   ▼
question-bank/exam/*.json 或 question-bank/chapters/*.json
```

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `LLM_API_BASE` | `https://api.deepseek.com` | OpenAI 兼容 API 地址 |
| `LLM_API_KEY` | — | 必填，你的 API Key |
| `LLM_MODEL` | `deepseek-chat` | 模型名 |

Windows PowerShell 设置示例：

```powershell
$env:LLM_API_KEY = "sk-xxxx"
```

## 使用步骤

### ① 提取文本

```bash
# 真题（.doc 会自动先用 LibreOffice 转 .docx）
python tools/extract/extract.py "raw_materials/2410自考《15043中国近现代史纲要》真题和答案.docx" -o work/2410.txt
python tools/extract/extract.py "raw_materials/2510自考《15043中国近现代史纲要》真题和答案.doc" -o work/2510.txt

# 章节 PPT
python tools/extract/extract.py "raw_materials/中国近现代史纲要复习资料/中国近现代史纲要（第一章）.pptx" -o work/ch01.txt
```

### ② AI 结构化

```bash
# 真题（--kind exam --year 考期）
python tools/structure/structure.py work/2410.txt -o work/2410.questions.json --kind exam --year 2410

# 章节 PPT（--kind chapter_exercise --chapter 章节名）
python tools/structure/structure.py work/ch01.txt -o work/ch01.questions.json --kind chapter_exercise --chapter 第一章
```

### ③ 校验

```bash
python tools/validate/validate.py work/2410.questions.json work/ch01.questions.json
```

### ④ 打包

```bash
# 真题
python tools/generate/build.py -o question-bank/exam/2410.json --kind exam --year 2410 work/2410.questions.json

# 章节
python tools/generate/build.py -o question-bank/chapters/chapter-01.json --kind chapter_exercise work/ch01.questions.json
```

## 文件清单（raw_materials）

| 文件 | kind | 输出 |
| --- | --- | --- |
| 2410自考《15043中国近现代史纲要》真题和答案.docx | exam | question-bank/exam/2410.json |
| 2504自考《15043中国近现代史纲要》真题和答案.docx | exam | question-bank/exam/2504.json |
| 2510自考《15043中国近现代史纲要》真题和答案.doc | exam | question-bank/exam/2510.json |
| 15043中国近现代史纲要2026年04月真题.docx | exam | question-bank/exam/2604.json |
| 中国近现代史纲要（第一章）.pptx ~ （第十章）.pptx | chapter_exercise | question-bank/chapters/chapter-01.json ~ chapter-10.json |
| 各章节串讲笔记（总复习）.doc | notes | question-bank/notes/review-notes.json（可选） |
| 考试答题注意事项和技巧.docx | notes | question-bank/notes/exam-tips.json（可选） |

## 注意事项

- **人工校对是必须环节**：AI 结构化可能出错，务必逐题核对原文、答案、解析，尤其是真题的卷末「参考答案」与题号对齐。
- `.doc` 转换依赖 LibreOffice；若未安装，请先手动另存为 `.docx`。
- `work/` 目录用于存放中间产物，已加入 `.gitignore`（本目录下的 `.gitignore` 见项目根目录）。
