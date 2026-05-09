/* AI Assistant drawer for the writing page.
   Load AFTER icons.jsx, BEFORE the page App script:
     <script type="text/babel" src="ai-drawer.jsx"></script>
   Exposes (on window): AIDrawer, FloatingToolbar, runDiff, MOCK_RESULTS, getMockResult
*/

const { useState: aiUseState, useEffect: aiUseEffect, useRef: aiUseRef, useMemo: aiUseMemo } = React;

/* ====================================================================
   1) DIFF ENGINE — char-level for CJK, word-level for Latin
   ==================================================================== */

function tokenize(s) {
  const out = [];
  // each CJK char is one token; Latin words; whitespace runs; punct each one
  const re = /[\u4e00-\u9fff]|[A-Za-z0-9]+|[\s]+|[^\s\u4e00-\u9fffA-Za-z0-9]/g;
  let m;
  while ((m = re.exec(s)) !== null) out.push(m[0]);
  return out;
}

function diffTokens(a, b) {
  const aT = tokenize(a), bT = tokenize(b);
  const n = aT.length, m = bT.length;
  // LCS DP — capped to avoid pathological huge cost
  if (n * m > 1_500_000) {
    // fallback: treat as one big delete + insert
    return [{ type: 'delete', text: a }, { type: 'insert', text: b }];
  }
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = aT[i - 1] === bT[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const out = [];
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (aT[i - 1] === bT[j - 1]) { out.push({ type: 'equal',  text: aT[i - 1] }); i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) { out.push({ type: 'delete', text: aT[i - 1] }); i--; }
    else { out.push({ type: 'insert', text: bT[j - 1] }); j--; }
  }
  while (i > 0) { out.push({ type: 'delete', text: aT[i - 1] }); i--; }
  while (j > 0) { out.push({ type: 'insert', text: bT[j - 1] }); j--; }
  out.reverse();
  // merge consecutive same-type tokens
  const merged = [];
  for (const t of out) {
    const last = merged[merged.length - 1];
    if (last && last.type === t.type) last.text += t.text;
    else merged.push({ ...t });
  }
  return merged;
}

/* group merged diff into change-hunks (used for per-block accept).
   Each hunk = a contiguous run of inserts/deletes, optionally separated
   by ≤ 2-token equal "glue". Returns array of:
   { kind:'equal', text } | { kind:'hunk', id, dels, adds, deleted, added } */
function buildHunks(diffs) {
  // first, fold tiny equals (≤ 2 tokens of length, e.g. punctuation) between
  // non-equals into a single hunk so consecutive edits group together.
  const isShortEqual = (t) =>
    t.type === 'equal' && tokenize(t.text).length <= 1 && !/[\u4e00-\u9fff]/.test(t.text);

  const folded = [];
  let i = 0;
  while (i < diffs.length) {
    const t = diffs[i];
    if (t.type === 'equal' && !isShortEqual(t)) {
      folded.push(t); i++; continue;
    }
    // collect a run starting from this non-equal (or short-equal) until we
    // see a non-short equal.
    const run = [];
    while (i < diffs.length) {
      const u = diffs[i];
      if (u.type === 'equal' && !isShortEqual(u)) break;
      run.push(u); i++;
    }
    // if the run is purely short-equals (no actual change), demote to equal
    if (run.every(u => u.type === 'equal')) {
      folded.push({ type: 'equal', text: run.map(u => u.text).join('') });
    } else {
      folded.push({ kind: 'hunk', tokens: run });
    }
  }

  // build hunks list
  const hunks = [];
  let id = 0;
  for (const t of folded) {
    if (t.kind === 'hunk') {
      const deleted = t.tokens.filter(u => u.type !== 'insert').map(u => u.text).join('');
      const added   = t.tokens.filter(u => u.type !== 'delete').map(u => u.text).join('');
      hunks.push({ kind: 'hunk', id: id++, tokens: t.tokens, deleted, added });
    } else {
      hunks.push({ kind: 'equal', text: t.text });
    }
  }
  return hunks;
}

/* given hunks and a per-hunk accepted map, produce final string */
function applyDecisions(hunks, accepted /* Map<id, bool> */) {
  let out = '';
  for (const h of hunks) {
    if (h.kind === 'equal') out += h.text;
    else out += accepted.get(h.id) === false ? h.deleted : h.added;
  }
  return out;
}

/* ====================================================================
   2) MOCK CONTENT — the drawer can ALWAYS render diffs even when
      window.claude is unavailable (or for the pre-loaded demo).
   ==================================================================== */

const DEMO_ORIGINAL =
`今天看了一篇 NeurIPS 上挺有意思的论文，讲的是怎么用对比学习来做长尾分布。说实话作者的实验设计挺有问题的，比如他们 baseline 选的特别老，2020 年的 ResNet 改一改就当 baseline 了。然后 ablation 也只跑了一个 seed，这个东西在小数据集上方差挺大的，我觉得不太靠谱。

不过 idea 还可以，就是把对比学习的 anchor 换成了类原型，这样长尾里那些数据特别少的稀有类也能有个稳定的 anchor。`;

const DEMO_POLISH =
`今日精读 NeurIPS 一篇基于对比学习的长尾分布方法。作者实验设计存在若干问题：所选 baseline 较为陈旧，仅以 2020 年的 ResNet 略作改动；ablation 也只在单一 seed 下进行，而该指标在小数据集上方差较大，结论的可靠性存疑。

不过，论文的核心思路具有一定启发性 —— 将对比学习的 anchor 替换为类原型，使长尾分布中的稀有类亦能获得稳定的 anchor。`;

/* canned suggestions per action (used as fallback when claude API is not
   reachable). Keyed by `${action}/${tone||''}` -> function(orig)->str. */
const CANNED = {
  'polish': (s) => s === DEMO_ORIGINAL ? DEMO_POLISH :
    s.replace(/挺/g, '较').replace(/我觉得/g, '我认为').replace(/不太靠谱/g, '可靠性存疑')
     .replace(/这个东西/g, '该指标').replace(/说实话/g, '坦率而言').replace(/挺有意思/g, '颇具意义'),
  'tone/学术正式': (s) => s === DEMO_ORIGINAL ? DEMO_POLISH :
    s.replace(/今天/g, '今日').replace(/看了/g, '精读').replace(/挺/g, '较').replace(/我觉得/g, '我认为')
     .replace(/不太/g, '并不').replace(/这个东西/g, '该指标'),
  'tone/通俗易懂': (s) =>
    s.replace(/精读/g, '认真读了').replace(/陈旧/g, '比较老').replace(/存疑/g, '不太可信')
     .replace(/具有/g, '有').replace(/亦/g, '也'),
  'tone/简洁专业': (s) =>
    s.replace(/挺有意思的/g, '').replace(/说实话/g, '').replace(/这个东西/g, '其').replace(/我觉得/g, '').replace(/  +/g, ' ').trim(),
  'tone/轻松随和': (s) =>
    s.replace(/精读/g, '翻了翻').replace(/存疑/g, '有点悬').replace(/具有/g, '有'),
  'shorten': (s) => s === DEMO_ORIGINAL
    ? '今日读到 NeurIPS 一篇对比学习处理长尾分布的论文。实验设计有问题：baseline 老旧（2020 ResNet），ablation 仅单 seed，小数据集上方差大，结论存疑。\n\n核心思路是把对比学习的 anchor 换成类原型，使稀有类也能获得稳定 anchor。'
    : s.replace(/，比如/g, '，').replace(/这个东西/g, '其').replace(/挺有意思的/g, ''),
  'expand': (s) => s === DEMO_ORIGINAL
    ? `今天看了一篇 NeurIPS 上挺有意思的论文，讲的是怎么用对比学习来做长尾分布——这是一个长期以来困扰分类任务的问题，因为头部类别的样本量可能是尾部的成百上千倍。说实话作者的实验设计挺有问题的，比如他们 baseline 选的特别老，2020 年的 ResNet 改一改就当 baseline 了，完全忽视了近两年 Transformer-based 方法的进展。然后 ablation 也只跑了一个 seed，这个东西在小数据集上方差挺大的，我觉得不太靠谱，按惯例至少应该跑 3 个 seed 取均值和标准差。\n\n不过 idea 还可以，就是把对比学习的 anchor 换成了类原型（class prototypes），这样长尾里那些数据特别少的稀有类也能有个稳定的 anchor，避免被头部类别的特征空间淹没。这一思路与近期一些 prototype-based few-shot 工作有相通之处。`
    : s,
  'translate/zh2en': (s) => s === DEMO_ORIGINAL
    ? `Today I read an interesting NeurIPS paper on using contrastive learning for long-tailed distributions. Frankly, the experimental design has several issues: the chosen baseline is fairly outdated — they merely tweaked a 2020 ResNet and called it the baseline. The ablation was also run on only one seed, and given the high variance of this metric on small datasets, I find the results somewhat unconvincing.\n\nThat said, the idea is interesting: replacing the anchor in contrastive learning with class prototypes, so that rare classes in the long tail can also have a stable anchor.`
    : s,
  'translate/en2zh': (s) => s === DEMO_ORIGINAL ? DEMO_POLISH : s,
  'translate/keep_terms': (s) => s === DEMO_ORIGINAL
    ? `今日精读 NeurIPS 一篇基于 contrastive learning 的 long-tailed distribution 方法。作者实验设计存在若干问题：所选 baseline 较为陈旧，仅以 2020 年的 ResNet 略作改动；ablation 也只在单一 seed 下进行，而该指标在小数据集上方差较大，结论的可靠性存疑。\n\n不过，论文的核心思路具有一定启发性 —— 将 contrastive learning 的 anchor 替换为 class prototype，使 long-tailed distribution 中的 rare class 亦能获得稳定的 anchor。`
    : s,
};

function getMockResult(action, sub, original) {
  const key = sub ? `${action}/${sub}` : action;
  const fn = CANNED[key] || CANNED[action];
  if (fn) return fn(original);
  return original;
}

/* ====================================================================
   3) FLOATING SELECTION TOOLBAR
   ==================================================================== */

const FLOAT_ACTIONS = [
  { k: 'polish',    icon: 'sparkles',  tip: '润色'    },
  { k: 'tone',      icon: 'alignLeft', tip: '调整语气' },
  { k: 'shorten',   icon: 'scissors',  tip: '精简'    },
  { k: 'expand',    icon: 'bookOpen',  tip: '扩写'    },
  { k: 'translate', icon: 'languages', tip: '翻译'    },
];

function FloatingToolbar({ rect, onPick, onClose }) {
  if (!rect) return null;
  const top  = Math.max(8, rect.top - 44);
  const left = Math.max(8, rect.left + rect.width / 2);
  return (
    <div
      className="ai-float"
      style={{ top, left, transform: 'translateX(-50%)' }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {FLOAT_ACTIONS.map(a => (
        <button
          key={a.k}
          className="ai-float-btn"
          onClick={() => { onPick(a.k); onClose && onClose(); }}
          aria-label={a.tip}
        >
          <Icon name={a.icon} size={15} stroke={1.7} color="#37352F" />
          <span className="ai-float-tip">{a.tip}</span>
        </button>
      ))}
    </div>
  );
}

/* ====================================================================
   4) DIFF RENDERERS
   ==================================================================== */

function SideBySide({ hunks, accepted }) {
  return (
    <div className="ai-sbs">
      <div className="ai-card ai-card-original">
        <div className="ai-chip ai-chip-original">原文</div>
        <div className="ai-card-body">
          {hunks.map((h, i) => {
            if (h.kind === 'equal') return <span key={i}>{h.text}</span>;
            const acc = accepted.get(h.id);
            // accepted: original deleted text shown but tinted "已应用" green
            // rejected: original deleted text shown plain (no strike)
            // pending : original deleted text shown red strike-through
            if (acc === true) {
              return (
                <span key={i} className="ai-hunk ai-hunk-applied">
                  <span className="ai-mark-applied" data-label="✓ 已应用">{h.deleted}</span>
                </span>
              );
            }
            if (acc === false) {
              return <span key={i}>{h.deleted}</span>;
            }
            return (
              <span key={i} className="ai-mark-del">{h.deleted}</span>
            );
          })}
        </div>
      </div>

      <div className="ai-card ai-card-suggestion">
        <div className="ai-chip ai-chip-suggestion">AI 建议</div>
        <div className="ai-card-body">
          {hunks.map((h, i) => {
            if (h.kind === 'equal') return <span key={i}>{h.text}</span>;
            const acc = accepted.get(h.id);
            if (acc === true) return <span key={i} className="ai-hunk-resolved-add">{h.added}</span>;
            if (acc === false) return <span key={i} className="ai-hunk-rejected">{h.added}</span>;
            return <span key={i} className="ai-mark-add">{h.added}</span>;
          })}
        </div>
      </div>
    </div>
  );
}

function Inline({ hunks, accepted }) {
  return (
    <div className="ai-card ai-card-inline">
      <div className="ai-chip ai-chip-inline">行内对比</div>
      <div className="ai-card-body">
        {hunks.map((h, i) => {
          if (h.kind === 'equal') return <span key={i}>{h.text}</span>;
          const acc = accepted.get(h.id);
          if (acc === true) {
            return <span key={i} className="ai-hunk-resolved-add">{h.added}</span>;
          }
          if (acc === false) {
            return <span key={i}>{h.deleted}</span>;
          }
          return (
            <span key={i}>
              {h.deleted ? <span className="ai-mark-del">{h.deleted}</span> : null}
              {h.deleted && h.added ? ' ' : null}
              {h.added   ? <span className="ai-mark-add">{h.added}</span> : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* hunk-level accept/reject buttons rendered as floating chips next to a card.
   In keeping with spec: appear on hover of the diff card. */
function HunkOverlay({ hunks, accepted, setHunkAccepted }) {
  return (
    <div className="ai-hunk-rail">
      {hunks.map((h, i) => {
        if (h.kind === 'equal') return null;
        const acc = accepted.get(h.id);
        return (
          <div key={i} className={`ai-hunk-chips ${acc !== undefined ? 'is-set' : ''}`}>
            <button
              className={`ai-hunk-chip accept ${acc === true ? 'on' : ''}`}
              title="采纳此处"
              onClick={() => setHunkAccepted(h.id, acc === true ? undefined : true)}
            >
              <Icon name="check" size={12} stroke={2.4} />
            </button>
            <button
              className={`ai-hunk-chip reject ${acc === false ? 'on' : ''}`}
              title="拒绝此处"
              onClick={() => setHunkAccepted(h.id, acc === false ? undefined : false)}
            >
              <Icon name="x" size={12} stroke={2.4} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ====================================================================
   5) DRAWER
   ==================================================================== */

const ACTIONS = [
  { k: 'polish',    label: '润色',     btn: '润色',     primary: '开始润色',     mockKey: 'polish' },
  { k: 'tone',      label: '调整语气', btn: '调整语气', primary: '调整语气',     mockKey: 'tone',
    sub: [
      { k: '学术正式', label: '学术正式' },
      { k: '通俗易懂', label: '通俗易懂' },
      { k: '简洁专业', label: '简洁专业' },
      { k: '轻松随和', label: '轻松随和' },
    ]},
  { k: 'shorten',   label: '精简',     btn: '精简',     primary: '精简一下',     mockKey: 'shorten' },
  { k: 'expand',    label: '扩写',     btn: '扩写',     primary: '帮我扩写',     mockKey: 'expand' },
  { k: 'translate', label: '翻译',     btn: '翻译',     primary: '翻译',         mockKey: 'translate',
    sub: [
      { k: 'zh2en',      label: '中→英' },
      { k: 'en2zh',      label: '英→中' },
      { k: 'keep_terms', label: '保留术语' },
    ]},
  { k: 'custom',    label: '自定义',   btn: '自定义',   primary: '让 AI 这样改', mockKey: 'polish' },
];

function AIDrawer({
  open, width, setWidth,
  selectionText,         // current selection from editor (may be empty)
  fullText,              // full editor text
  onClose,
  onApply,               // (newSelText) => apply replacement; if no selection, replace all
  initialOp,             // { action, sub? } — set by caller to auto-run on open
  consumeInitialOp,      // ack callback
  showToast,
  history, setHistory,   // [{at:Date, action, sub, applied:bool, count:int, undoSnapshot:string}]
  onUndo,                // (entry) => restore editor
}) {
  const [action, setAction]   = aiUseState('polish');
  const [sub, setSub]         = aiUseState('学术正式');
  const [transSub, setTransSub] = aiUseState('zh2en');
  const [custom, setCustom]   = aiUseState('');
  const [status, setStatus]   = aiUseState('idle'); // idle | running | ok | error
  const [original, setOriginal]     = aiUseState('');
  const [suggestion, setSuggestion] = aiUseState('');
  const [hunks, setHunks]     = aiUseState([]);
  const [accepted, setAccepted] = aiUseState(() => new Map());
  const [mode, setMode]       = aiUseState('side');   // side | inline
  const [editingSuggestion, setEditingSuggestion] = aiUseState(null); // string | null
  const [showChat, setShowChat] = aiUseState(false);
  const [chatDraft, setChatDraft] = aiUseState('');
  const [showHistory, setShowHistory] = aiUseState(false);

  const dragRef = aiUseRef(null);

  const setHunkAccepted = (id, val) => {
    setAccepted(prev => {
      const m = new Map(prev);
      if (val === undefined) m.delete(id);
      else m.set(id, val);
      return m;
    });
  };

  const currentSubFor = (act) => act === 'tone' ? sub : act === 'translate' ? transSub : null;

  const run = async (overrideAction, overrideSub) => {
    const act = overrideAction || action;
    const subKey = overrideSub !== undefined ? overrideSub : currentSubFor(act);
    const orig = (selectionText && selectionText.trim()) ? selectionText : fullText;
    if (!orig.trim()) {
      showToast && showToast('正文为空，没什么可改的');
      return;
    }
    setOriginal(orig);
    setSuggestion('');
    setHunks([]);
    setAccepted(new Map());
    setEditingSuggestion(null);
    setStatus('running');

    let result = null;
    try {
      if (window.claude && typeof window.claude.complete === 'function' && act !== 'custom') {
        const sysPrompt = buildPrompt(act, subKey, custom);
        const text = await window.claude.complete({
          messages: [{ role: 'user', content: `${sysPrompt}\n\n原文：\n${orig}` }],
        });
        result = (text || '').trim();
      }
    } catch (e) {
      // swallow — we will fall back to canned content
    }
    if (!result) {
      // fallback: canned
      await new Promise(r => setTimeout(r, 480));   // brief faux-latency
      result = getMockResult(act, subKey, orig);
    }
    setSuggestion(result);
    const diffs = diffTokens(orig, result);
    setHunks(buildHunks(diffs));
    setStatus('ok');
  };

  // run pre-loaded initial op once on open
  aiUseEffect(() => {
    if (!open || !initialOp) return;
    if (initialOp.action) setAction(initialOp.action);
    if (initialOp.sub) {
      if (initialOp.action === 'tone') setSub(initialOp.sub);
      if (initialOp.action === 'translate') setTransSub(initialOp.sub);
    }
    run(initialOp.action, initialOp.sub);
    consumeInitialOp && consumeInitialOp();
    // eslint-disable-next-line
  }, [open, initialOp]);

  // dragging the resize handle
  aiUseEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current) return;
      const w = window.innerWidth - e.clientX;
      setWidth(Math.max(280, Math.min(560, w)));
    };
    const onUp = () => { dragRef.current = false; document.body.style.cursor = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [setWidth]);

  const finalText = aiUseMemo(() => {
    if (!hunks.length) return suggestion;
    if (editingSuggestion !== null) return editingSuggestion;
    return applyDecisions(hunks, accepted);
  }, [hunks, accepted, suggestion, editingSuggestion]);

  const acceptCount = aiUseMemo(() => {
    let n = 0; for (const h of hunks) if (h.kind === 'hunk' && accepted.get(h.id) === true) n++;
    return n;
  }, [hunks, accepted]);

  const totalHunks = hunks.filter(h => h.kind === 'hunk').length;

  const acceptAll = () => {
    if (!hunks.length) return;
    const snapshot = fullText;
    const replaced = (selectionText && selectionText.trim()) ? selectionText : fullText;
    onApply && onApply(finalText, replaced);
    pushHistory({ applied: true, count: totalHunks, undoSnapshot: snapshot });
    showToast && showToast('✓ 已采纳');
    resetResult();
  };

  const acceptSelected = () => {
    if (!hunks.length) return;
    if (acceptCount === 0) { acceptAll(); return; }
    const snapshot = fullText;
    const replaced = (selectionText && selectionText.trim()) ? selectionText : fullText;
    onApply && onApply(finalText, replaced);
    pushHistory({ applied: true, count: acceptCount, undoSnapshot: snapshot });
    showToast && showToast(`✓ 已应用 ${acceptCount} 处`);
    resetResult();
  };

  const rejectAll = () => {
    pushHistory({ applied: false, count: totalHunks });
    resetResult();
  };

  const pushHistory = ({ applied, count, undoSnapshot }) => {
    const entry = {
      at: new Date(),
      action, sub: currentSubFor(action) || (action === 'custom' ? custom.slice(0, 12) : null),
      applied, count, undoSnapshot,
    };
    setHistory(h => [entry, ...h]);
  };

  const resetResult = () => {
    setStatus('idle');
    setOriginal('');
    setSuggestion('');
    setHunks([]);
    setAccepted(new Map());
    setEditingSuggestion(null);
    setShowChat(false);
  };

  const copySuggestion = () => {
    navigator.clipboard?.writeText(finalText);
    showToast && showToast('已复制全部');
  };

  if (!open) return null;

  const cur = ACTIONS.find(a => a.k === action);
  const primaryLabel = status === 'running'
    ? '正在润色…'
    : (cur ? cur.primary : '开始');
  const showSubScope = (selectionText && selectionText.trim().length > 0)
    ? `选区 ${selectionText.length} 字`
    : `全文 ${fullText.length} 字`;

  return (
    <aside className="ai-drawer" style={{ width }}>
      {/* drag handle */}
      <div
        className="ai-resize"
        onMouseDown={(e) => { dragRef.current = true; document.body.style.cursor = 'col-resize'; e.preventDefault(); }}
      />

      <header className="ai-head">
        <span className="ai-head-title">
          <Icon name="sparkles" size={15} stroke={1.7} color="#37352F" />
          AI 助手
        </span>
        <button className="ai-icon-btn" onClick={onClose} aria-label="关闭">
          <Icon name="x" size={15} stroke={1.8} />
        </button>
      </header>

      <div className="ai-body">
        {/* upper: operation chooser */}
        <div className="ai-ops">
          <div className="ai-chips-row">
            {ACTIONS.map(a => (
              <button
                key={a.k}
                className={`ai-op-chip ${action === a.k ? 'on' : ''}`}
                onClick={() => setAction(a.k)}
              >{a.btn}</button>
            ))}
          </div>

          {action === 'tone' && (
            <div className="ai-radios">
              {cur.sub.map(s => (
                <label key={s.k} className={`ai-radio ${sub === s.k ? 'on' : ''}`}>
                  <input type="radio" name="tone" checked={sub === s.k} onChange={() => setSub(s.k)} />
                  <span className="ai-radio-dot"></span>
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
          )}
          {action === 'translate' && (
            <div className="ai-radios">
              {cur.sub.map(s => (
                <label key={s.k} className={`ai-radio ${transSub === s.k ? 'on' : ''}`}>
                  <input type="radio" name="trans" checked={transSub === s.k} onChange={() => setTransSub(s.k)} />
                  <span className="ai-radio-dot"></span>
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
          )}
          {action === 'custom' && (
            <textarea
              className="ai-custom"
              rows={3}
              placeholder="告诉 AI 你想怎么改这段文字…"
              value={custom}
              onChange={e => setCustom(e.target.value)}
            />
          )}

          <div className="ai-scope">
            <span>💡 在左侧编辑器选中文本，或留空对全文生效 · </span>
            <span className="ai-scope-cur">{showSubScope}</span>
          </div>

          <button
            className={`ai-primary ${status === 'running' ? 'is-loading' : ''}`}
            disabled={status === 'running'}
            onClick={() => run()}
          >
            {status === 'running' ? <span className="ai-spin" aria-hidden /> : <Icon name="sparkles" size={13} stroke={1.9} />}
            {primaryLabel}
          </button>
        </div>

        {/* lower: result */}
        <div className="ai-result">
          {status === 'idle' && (
            <div className="ai-empty">
              <Icon name="sparkles" size={48} stroke={1.4} color="#D6D3CC" />
              <p>选中文本或选择全文，让 AI 帮你打磨</p>
            </div>
          )}

          {status === 'error' && (
            <div className="ai-error">
              <Icon name="alertCircle" size={28} stroke={1.7} color="#B91C1C" />
              <p>AI 暂时开小差了，重试一下？</p>
              <button className="btn btn-sm btn-primary" onClick={() => run()}>重试</button>
            </div>
          )}

          {status !== 'idle' && status !== 'error' && hunks.length > 0 && (
            <>
              <div className="ai-result-tabs">
                <div className="ai-mode-group">
                  <button className={`ai-mode-btn ${mode === 'side' ? 'on' : ''}`}   onClick={() => setMode('side')}>并排对比</button>
                  <button className={`ai-mode-btn ${mode === 'inline' ? 'on' : ''}`} onClick={() => setMode('inline')}>行内对比</button>
                </div>
                <button className="ai-icon-btn" onClick={copySuggestion} title="复制全部">
                  <Icon name="copy" size={14} stroke={1.7} />
                </button>
              </div>

              <div className="ai-diff-wrap">
                {editingSuggestion !== null
                  ? (
                    <div className="ai-card ai-card-suggestion">
                      <div className="ai-chip ai-chip-suggestion">手动微调</div>
                      <textarea
                        className="ai-edit-area"
                        value={editingSuggestion}
                        onChange={e => setEditingSuggestion(e.target.value)}
                      />
                    </div>
                  )
                  : (mode === 'side'
                      ? <SideBySide hunks={hunks} accepted={accepted} />
                      : <Inline     hunks={hunks} accepted={accepted} />
                    )
                }
                {editingSuggestion === null && (
                  <HunkOverlay hunks={hunks} accepted={accepted} setHunkAccepted={setHunkAccepted} />
                )}
              </div>

              {showChat && (
                <div className="ai-chat">
                  <textarea
                    className="ai-chat-input"
                    rows={2}
                    placeholder="比如：第二句太书面了，再口语一点"
                    value={chatDraft}
                    onChange={e => setChatDraft(e.target.value)}
                  />
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      if (!chatDraft.trim()) return;
                      // re-run treating user note as a custom directive
                      setAction('custom');
                      setCustom(chatDraft);
                      setChatDraft('');
                      run('custom');
                    }}
                  >发送</button>
                </div>
              )}

              <div className="ai-actions">
                <div className="ai-actions-left">
                  <button className="ai-icon-btn" onClick={() => run()} title="重新生成">
                    <Icon name="refreshCw" size={14} stroke={1.7} />
                  </button>
                  <button
                    className="ai-icon-btn"
                    onClick={() => setEditingSuggestion(editingSuggestion === null ? finalText : null)}
                    title="在结果上手动微调"
                  >
                    <Icon name="edit3" size={14} stroke={1.7} />
                  </button>
                  <button
                    className={`ai-icon-btn ${showChat ? 'on' : ''}`}
                    onClick={() => setShowChat(s => !s)}
                    title="继续追问 AI"
                  >
                    <Icon name="messageSquare" size={14} stroke={1.7} />
                  </button>
                </div>
                <div className="ai-actions-right">
                  <button className="btn btn-sm" onClick={rejectAll}>全部拒绝</button>
                  <button className="btn btn-sm btn-primary" onClick={acceptSelected}>
                    {acceptCount > 0 && acceptCount < totalHunks ? `采纳 ${acceptCount}/${totalHunks} 处` : '全部采纳'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* history */}
        <div className={`ai-history ${showHistory ? 'open' : ''}`}>
          <button className="ai-history-toggle" onClick={() => setShowHistory(s => !s)}>
            <Icon name="scroll" size={13} stroke={1.7} />
            <span>本次会话改动记录 ({history.length})</span>
            <Icon name="chevronDown" size={11} stroke={2}
                  style={{ transform: showHistory ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }} />
          </button>
          {showHistory && (
            <ul className="ai-history-list">
              {history.length === 0 && <li className="ai-history-empty">暂无改动记录</li>}
              {history.map((h, i) => {
                const t = h.at;
                const time = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
                const actLabel = ({polish:'润色',tone:'调整语气',shorten:'精简',expand:'扩写',translate:'翻译',custom:'自定义'})[h.action] || h.action;
                const subLabel = h.sub ? `-${h.sub}` : '';
                return (
                  <li key={i} className="ai-history-row">
                    <span className="ai-history-time">{time}</span>
                    <span className="ai-history-tag">[{actLabel}{subLabel}]</span>
                    <span className="ai-history-result">
                      {h.applied ? `应用了 ${h.count} 处修改` : '拒绝'}
                    </span>
                    {h.applied && h.undoSnapshot != null && (
                      <button className="ai-history-undo" onClick={() => onUndo && onUndo(h)} title="撤销">
                        <Icon name="undo2" size={11} stroke={2} />
                        撤销
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}

/* small helper to fold a chevron icon — added to LUCIDE if not present */
if (window.LUCIDE && !window.LUCIDE.chevronDown) {
  window.LUCIDE.chevronDown = (<polyline points="6 9 12 15 18 9" />);
}

function buildPrompt(action, sub, custom) {
  switch (action) {
    case 'polish':
      return '请对下面这段中文文字进行润色：保持原意和长度，优化表达流畅度，去掉口语化表达。仅返回修改后的纯文本，不要任何解释。';
    case 'shorten':
      return '请精简下面这段文字：删减冗余信息，保留核心信息，目标长度约为原文 70%。仅返回纯文本。';
    case 'expand':
      return '请扩写下面这段文字：补充论据、例子或上下文，使其更详尽。目标长度约为原文 1.5 倍。仅返回纯文本。';
    case 'tone':
      const toneMap = {
        '学术正式': '使用书面语，避免口语化，遣词严谨；可适度使用学术修辞。',
        '通俗易懂': '拆分长句，替换生僻词，让普通读者也能理解。',
        '简洁专业': '用最少的字传达最多信息，去掉所有冗词；保留专业准确性。',
        '轻松随和': '让语气更亲切自然，可以适度口语化，但不失礼貌。',
      };
      return `请把下面这段文字改写为「${sub}」的语气：${toneMap[sub] || ''} 仅返回修改后的纯文本。`;
    case 'translate':
      const tMap = {
        'zh2en':      '请把下面这段中文翻译成自然流畅的英文。',
        'en2zh':      '请把下面这段英文翻译成自然流畅的中文。',
        'keep_terms': '请把下面这段文字翻译成中文，但所有专有名词、术语、缩写保留英文原文。',
      };
      return `${tMap[sub] || tMap.zh2en} 仅返回译文，不要任何解释。`;
    case 'custom':
      return `请按下面的指示修改文字：${custom || '（未提供具体指示，请进行通用润色）'} 仅返回修改后的纯文本，不要任何解释。`;
    default:
      return '请润色下面这段文字。仅返回纯文本。';
  }
}

Object.assign(window, {
  AIDrawer, FloatingToolbar,
  diffTokens, buildHunks, applyDecisions, getMockResult,
  DEMO_ORIGINAL, DEMO_POLISH,
});
