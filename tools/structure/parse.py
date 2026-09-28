#!/usr/bin/env python3
"""规则解析器：将提取的文本解析为结构化题目数组（无需 LLM）。

支持两种来源：
  exam  真题（2410 答案嵌题干/题号缺失；2504/2604 答案独立行 + 题解）
  ppt   章节 PPT 练习题（仅提取带「答案/答/解析」的题型块，跳过知识点讲义）

用法:
  python parse.py <input.txt> -o <output.json> --kind exam --year 2410
  python parse.py <input.txt> -o <output.json> --kind ppt --chapter 第一章
"""
import argparse
import json
import re
import sys
from pathlib import Path

OPTION_RE = re.compile(r'^([A-H])[.．、:：]\s*(.*)$')
NUMBER_RE = re.compile(r'^(\d{1,3})[、.．:：]\s*(.*)$')
ANSWER_IN_STEM_RE = re.compile(r'（\s*([A-H])\s*）\s*$')  # 题干末尾 (A)
PPT_TYPE_RE = re.compile(r'^【(单选题|多选题|简答题|论述题|判断题|单选|多选|简答|论述|判断)】\s*(.*)$')
PAGE_SPLIT_RE = re.compile(r'^=+\s*第\s*\d+\s*页\s*=+$')

TYPE_ALIAS = {'single': 'single', 'short_answer': 'short_answer', 'essay': 'essay'}


def detect_section(line: str):
    """识别大题标题，返回题型或 None。仅匹配完整题型词，避免题干中的「论述/简答」误触。"""
    s = line.strip()
    if '单项选择' in s:
        return 'single'
    if '简答题' in s:
        return 'short_answer'
    if '论述题' in s or '论说题' in s:
        return 'essay'
    return None


def is_answer_start(line: str) -> bool:
    s = line.strip()
    return (s.startswith('答案') or s.startswith('答')
            or s.startswith('【答案') or s.startswith('[答案')
            or s.startswith('参考答案'))


def is_explanation_start(line: str) -> bool:
    return line.strip().startswith('题解') or line.strip().startswith('解析')


def is_list_continuation(s: str) -> bool:
    """判断是否为列表续行：(1) / 1. / 数字、 开头。"""
    return bool(re.match(r'^[（(]\d+[）)]', s) or re.match(r'^\d+[.、．]', s))


def is_stem_line(s: str) -> bool:
    """判断一行是否为题干（完整句）。用于无题号的主观题切分。"""
    if is_answer_start(s) or is_explanation_start(s):
        return False
    if is_list_continuation(s):
        return False
    if len(s) < 3 or len(s) > 80:
        return False
    return s.endswith(('。', '？', '！', '?', '!'))


def strip_answer_prefix(s: str) -> str:
    s = s.strip()
    for pre in ('参考答案', '答案', '【答案]', '【答案】', '[答案]', '[答案]', '答'):
        if s.startswith(pre):
            s = s[len(pre):]
            break
    return s.lstrip('：:】]').strip()


def strip_explanation_prefix(s: str) -> str:
    s = s.strip()
    for pre in ('题解', '解析'):
        if s.startswith(pre):
            s = s[len(pre):]
            break
    return s.lstrip('：:').strip()


def normalize_stem(stem: str, type_: str):
    """选择题题干：若末尾含 (A) 提取答案并从题干移除。返回 (stem, answer)。"""
    answer = None
    if type_ == 'single':
        m = ANSWER_IN_STEM_RE.search(stem)
        if m:
            answer = m.group(1)
            stem = ANSWER_IN_STEM_RE.sub('（ ）', stem).strip()
    return stem, answer


def new_question(prefix, type_, stem, chapter):
    q = {
        'id': '',
        'type': type_,
        'chapter': chapter or '未分类',
        'knowledgePoint': '',
        'difficulty': 2,
        'stem': stem,
        'explanation': '',
        'source': {'kind': '', 'year': '', 'file': ''},
        'tags': [],
    }
    if type_ == 'single':
        q['options'] = []
    return q


def parse_single(lines, year, base_idx, end_idx):
    """解析选择题区域。"""
    questions = []
    cur = None
    field = 'stem'
    for k in range(base_idx, end_idx):
        ln = lines[k].strip()
        if not ln:
            continue

        m = NUMBER_RE.match(ln)
        if m:
            num, rest = m.group(1), m.group(2).strip()
            if not rest:
                k += 1
                rest = lines[k].strip() if k < end_idx else ''
            stem, embedded = normalize_stem(rest, 'single')
            cur = new_question(f'15043-{year}', 'single', stem, '未分类')
            cur['id'] = f'15043-{year}-single-{num}'
            cur['source'] = {'kind': 'exam', 'year': year, 'file': ''}
            if embedded:
                cur['answer'] = embedded
            field = 'stem'
            questions.append(cur)
            continue

        om = OPTION_RE.match(ln)
        if cur and om:
            cur['options'].append(om.group(1) + '.' + om.group(2))
            field = 'options'
            continue

        if cur and is_answer_start(ln):
            content = strip_answer_prefix(ln)
            m2 = re.match(r'^([A-H])\s*$', content)
            cur['answer'] = m2.group(1) if m2 else content
            field = 'answer'
            continue

        if cur and is_explanation_start(ln):
            cur['explanation'] = strip_explanation_prefix(ln)
            field = 'explanation'
            continue

        # 续行
        if cur and field == 'explanation':
            cur['explanation'] = (cur['explanation'] + '\n' + ln).strip()
    return questions


def parse_subjective(lines, year, base_idx, end_idx, mode):
    """解析简答/论述区域，兼容题号缺失、答案标记混乱、空标记、无标记末题。"""
    questions = []
    cur = None
    pending = []      # 潜在题干行缓冲
    in_answer = False  # 是否处于答案收集状态

    def extract_stem():
        for s in reversed(pending):
            if is_stem_line(s):
                return s
        return pending[0] if pending else ''

    def new_subjective(stem):
        q = new_question(f'15043-{year}', mode, stem, '未分类')
        q['id'] = f'15043-{year}-{mode}-{len(questions) + 1}'
        q['source'] = {'kind': 'exam', 'year': year, 'file': ''}
        questions.append(q)
        return q

    for k in range(base_idx, end_idx):
        ln = lines[k].strip()
        if not ln:
            continue

        # 题号行 → 新题（有题号，可靠）
        m = NUMBER_RE.match(ln)
        if m:
            num, rest = m.group(1), m.group(2).strip()
            cur = new_question(f'15043-{year}', mode, rest, '未分类')
            cur['id'] = f'15043-{year}-{mode}-{num}'
            cur['source'] = {'kind': 'exam', 'year': year, 'file': ''}
            questions.append(cur)
            pending = []
            in_answer = False
            continue

        # 答案标记行
        if is_answer_start(ln):
            content = strip_answer_prefix(ln)
            if pending:
                # pending 里是上一题答案完成后的下一题题干
                cur = new_subjective(extract_stem())
                pending = []
            if content:
                cur['referenceAnswer'] = content
            in_answer = True  # 即使 content 为空，也进入答案收集状态
            continue

        # 列表续行（答案内容，如 (1)… / 1.…）
        if in_answer and is_list_continuation(ln):
            if cur.get('referenceAnswer'):
                cur['referenceAnswer'] = (cur['referenceAnswer'] + '\n' + ln).strip()
            else:
                cur['referenceAnswer'] = ln
            continue

        # 完整句 → 潜在题干（视为上一题答案段结束）
        pending.append(ln)
        in_answer = False

    # 收尾：处理无答案标记的末题（题干 + 直接列表答案）
    if pending:
        stem_idx = None
        for i, s in enumerate(pending):
            if is_stem_line(s):
                stem_idx = i
                break
        if stem_idx is not None:
            stem = pending[stem_idx]
            answer_lines = [s for s in pending[stem_idx + 1:] if s.strip()]
            if answer_lines:
                q = new_subjective(stem)
                q['referenceAnswer'] = '\n'.join(answer_lines)
            elif cur is not None and stem != cur.get('stem'):
                # 单行完整句无后续 → 更可能是上一题答案的续行，追加
                if cur.get('referenceAnswer'):
                    cur['referenceAnswer'] = (cur['referenceAnswer'] + '\n' + stem).strip()
                else:
                    cur['referenceAnswer'] = stem

    return questions


def parse_notes(text: str) -> list:
    """解析串讲笔记：每个带题型标记的考点 → 一道 short_answer 题。

    题型标记形如 ［单选］ / [简答] / ［简答、论述］ / [论述题]，可能含全角/半角括号。
    题干 = 考点描述（标记后文字），答案 = 后续知识点正文，题型存入 tags。
    """
    lines = [ln.rstrip() for ln in text.split('\n')]
    questions = []
    chapter = '未分类'
    cur = None
    seq = 0

    # 题型标记：行首为 [ 或 ［，内容含题型词
    mark_re = re.compile(r'^[\[［]([^\]］]*)[\]］]\s*(.*)$')
    type_words = ['单选', '多选', '简答', '论述', '判断', '选择', '问答']

    for ln in lines:
        s = ln.strip()
        if not s:
            continue

        # 章节标题
        m_ch = re.match(r'^第([一二三四五六七八九十]+)章\s*(.*)$', s)
        if m_ch:
            chapter = '第' + m_ch.group(1) + '章'
            if m_ch.group(2):
                chapter = chapter + ' ' + m_ch.group(2).strip()
            cur = None
            continue

        # 题型标记行
        m = mark_re.match(s)
        if m:
            tag_content = m.group(1)
            rest = m.group(2).strip()
            has_type = any(w in tag_content for w in type_words)
            if has_type:
                # 结束上一题
                # 提取 tags（拆分「简答、论述」等）
                tags = []
                for w in type_words:
                    if w in tag_content:
                        tags.append(w)
                # 考点描述：去掉开头的（数字）序号
                rest = re.sub(r'^[（(]\d*[）)]\s*', '', rest).strip()
                stem = rest if rest else tag_content
                seq += 1
                cur = new_question('15043-notes', 'short_answer', stem, chapter)
                cur['id'] = f'15043-notes-{seq}'
                cur['source'] = {'kind': 'notes', 'year': '', 'file': '各章节串讲笔记（总复习）'}
                cur['tags'] = tags
                questions.append(cur)
            continue

        # 正文 → 追加到当前题答案
        if cur is not None:
            if cur.get('referenceAnswer'):
                cur['referenceAnswer'] = (cur['referenceAnswer'] + '\n' + s).strip()
            else:
                cur['referenceAnswer'] = s

    # 兜底：无正文的考点（标记行本身即完整陈述），答案 = 考点描述
    for q in questions:
        if not q.get('referenceAnswer'):
            q['referenceAnswer'] = q['stem']

    return questions


def parse_exam(text: str, year: str) -> list:
    lines = [ln.rstrip() for ln in text.split('\n')]
    n = len(lines)

    # 检测「答案分离」格式：卷末出现字母串答案（如 1-5 BACAC）
    if any(re.match(r'^\d+-\d+\s+[A-Z]{2,}\s*$', ln.strip()) for ln in lines):
        return parse_exam_separated(text, year)

    # 找出大题分界
    sections = []  # (start_idx, mode)
    i = 0
    while i < n:
        m = detect_section(lines[i])
        if m:
            sections.append((i, m))
        i += 1

    questions = []
    for si, (start, mode) in enumerate(sections):
        end = sections[si + 1][0] if si + 1 < len(sections) else n
        if mode == 'single':
            questions.extend(parse_single(lines, year, start + 1, end))
        else:
            questions.extend(parse_subjective(lines, year, start + 1, end, mode))
    return questions


def parse_exam_separated(text: str, year: str) -> list:
    """解析「答案分离」格式真题（如 2510）：选择题答案在卷末字母串，主观题答案在卷末参考答案区。"""
    lines = [ln.rstrip() for ln in text.split('\n')]
    n = len(lines)

    # 定位答案区起点
    answer_zone = n
    for i, ln in enumerate(lines):
        s = ln.strip()
        if re.match(r'^\d+-\d+\s+[A-Z]{2,}\s*$', s) or '解析版' in s:
            answer_zone = i
            break

    singles = []
    subjects = []  # 按出现顺序 (type, stem)

    # 解析正文（答案区之前）：选择题题干+选项，主观题题干
    mode = None
    i = 0
    cur = None
    while i < answer_zone:
        ln = lines[i].strip()
        if not ln:
            i += 1
            continue

        m_sec = detect_section(ln)
        if m_sec:
            mode = m_sec
            i += 1
            continue

        # 题号行（点号分隔，如 1.xxx / 26.xxx）
        m = re.match(r'^(\d{1,3})\.+\s*(.*)$', ln)
        if m:
            num = int(m.group(1))
            stem = m.group(2).strip()
            if mode == 'single' and 1 <= num <= 25:
                cur = new_question(f'15043-{year}', 'single', stem, '未分类')
                cur['id'] = f'15043-{year}-single-{num}'
                cur['source'] = {'kind': 'exam', 'year': year, 'file': ''}
                singles.append(cur)
            elif mode in ('short_answer', 'essay'):
                cur = new_question(f'15043-{year}', mode, stem, '未分类')
                cur['id'] = f'15043-{year}-{mode}-{num}'
                cur['source'] = {'kind': 'exam', 'year': year, 'file': ''}
                subjects.append(cur)
            i += 1
            continue

        # 选项行
        om = OPTION_RE.match(ln)
        if cur and cur['type'] == 'single' and om:
            cur['options'].append(om.group(1) + '.' + om.group(2))
        i += 1

    # 解析卷末选择题答案字母串
    choice_answers = []
    for i in range(answer_zone, n):
        m = re.match(r'^(\d+)-(\d+)\s+([A-Z]+)\s*$', lines[i].strip())
        if m:
            choice_answers.extend(list(m.group(3)))
    for j, q in enumerate(singles):
        if j < len(choice_answers):
            q['answer'] = choice_answers[j]

    # 解析卷末主观题参考答案
    subj_answers = {}
    cur_num = None
    cur_text = []
    for i in range(answer_zone, n):
        s = lines[i].strip()
        if not s:
            continue
        m = re.match(r'^(\d+)、参考答案\s*(.*)$', s)
        if m:
            if cur_num is not None:
                subj_answers[cur_num] = '\n'.join(cur_text).strip()
            cur_num = int(m.group(1))
            cur_text = [m.group(2)] if m.group(2) else []
            continue
        m2 = re.match(r'^参考答案\s*(.*)$', s)
        if m2:
            if cur_num is not None:
                subj_answers[cur_num] = '\n'.join(cur_text).strip()
            cur_num = (cur_num or 30) + 1  # 裸「参考答案」按题号递增
            cur_text = [m2.group(1)] if m2.group(1) else []
            continue
        if cur_num is not None and s and not s.startswith('【评分说明】'):
            cur_text.append(s)
    if cur_num is not None:
        subj_answers[cur_num] = '\n'.join(cur_text).strip()

    # 回填主观题答案
    for q in subjects:
        num = int(q['id'].rsplit('-', 1)[1])
        if num in subj_answers:
            q['referenceAnswer'] = subj_answers[num]

    return singles + subjects


def parse_ppt(text: str, chapter: str) -> list:
    """解析 PPT：只提取带答案的题型块。"""
    questions = []
    lines = [ln.rstrip() for ln in text.split('\n')]
    i = 0
    seq = {'single': 0, 'short_answer': 0, 'essay': 0}
    type_map = {'单选题': 'single', '多选题': 'single', '简答题': 'short_answer',
                '论述题': 'essay', '判断题': 'single',
                '单选': 'single', '多选': 'single', '简答': 'short_answer',
                '论述': 'essay', '判断': 'single'}

    while i < len(lines):
        ln = lines[i].strip()
        m = PPT_TYPE_RE.match(ln)
        if not m:
            i += 1
            continue

        type_label, stem = m.group(1), m.group(2).strip()
        type_ = type_map.get(type_label, 'short_answer')

        block = []
        j = i + 1
        while j < len(lines):
            if PPT_TYPE_RE.match(lines[j].strip()):
                break
            block.append(lines[j])
            j += 1

        block_text = '\n'.join(block)
        if not (re.search(r'\b答案[：:]', block_text) or re.search(r'\b答[：:]', block_text)):
            i = j
            continue

        stem, embedded = normalize_stem(stem, type_)
        cur = new_question(f'15043-{chapter}', type_, stem, chapter)
        seq[type_] += 1
        cur['id'] = f'15043-{chapter}-{type_}-{seq[type_]}'
        cur['source'] = {'kind': 'chapter_exercise', 'year': '', 'file': ''}

        field = 'stem'
        for blk in block:
            s = blk.strip()
            if not s or PAGE_SPLIT_RE.match(s):
                continue
            om = OPTION_RE.match(s)
            if type_ == 'single' and om:
                cur['options'].append(om.group(1) + '.' + om.group(2))
                field = 'options'
            elif is_answer_start(s):
                content = strip_answer_prefix(s)
                if type_ == 'single':
                    m2 = re.match(r'^([A-H])\s*$', content)
                    cur['answer'] = m2.group(1) if m2 else content
                else:
                    cur['referenceAnswer'] = content
                field = 'answer'
            elif is_explanation_start(s):
                cur['explanation'] = strip_explanation_prefix(s)
                field = 'explanation'
            elif field == 'answer' and type_ != 'single':
                cur['referenceAnswer'] = (cur['referenceAnswer'] + '\n' + s).strip()
            elif field == 'explanation':
                cur['explanation'] = (cur['explanation'] + '\n' + s).strip()

        questions.append(cur)
        i = j

    return questions


def main(argv=None):
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('input', help='提取后的文本文件')
    parser.add_argument('-o', '--output', required=True, help='输出 JSON（题目数组）')
    parser.add_argument('--kind', choices=['exam', 'ppt', 'notes'], required=True)
    parser.add_argument('--year', help='真题考期（kind=exam）')
    parser.add_argument('--chapter', help='章节名（kind=ppt）')
    args = parser.parse_args(argv)

    src = Path(args.input)
    if not src.exists():
        print(f'文件不存在: {src}', file=sys.stderr)
        return 2
    text = src.read_text(encoding='utf-8')

    if args.kind == 'exam':
        if not args.year:
            print('kind=exam 需要 --year', file=sys.stderr)
            return 2
        questions = parse_exam(text, args.year)
    elif args.kind == 'notes':
        questions = parse_notes(text)
    else:
        if not args.chapter:
            print('kind=ppt 需要 --chapter', file=sys.stderr)
            return 2
        questions = parse_ppt(text, args.chapter)

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(questions, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'解析完成: {len(questions)} 题 -> {out}')
    dist = {}
    for q in questions:
        dist[q['type']] = dist.get(q['type'], 0) + 1
    print('题型分布:', dist)
    return 0


if __name__ == '__main__':
    sys.exit(main())
