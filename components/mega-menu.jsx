/* MegaMenu — hover/click dropdown for the "浏览" nav tab.
   Load AFTER icons.jsx, BEFORE the page script:
     <script type="text/babel" src="mega-menu.jsx"></script>
   Exposes (on window): MegaMenu, BrowseTabWithMenu

   Usage:
     <BrowseTabWithMenu active={false} />
*/

const MEGA_COUNTS = {
  research:    { count: 47, weekly: 3 },
  course:      { count: 29, weekly: 2 },
  recommend:   { count: 18, weekly: 1 },
  competition: { count: 15, weekly: 0 },
  kaggle:      { count: 22, weekly: 4 },
  tool:        { count: 31, weekly: 2 },
  life:        { count: 11, weekly: 1 },
};
const MEGA_TOTAL  = { count: 173, authors: 28 };

const MEGA_TRENDING = [
  { cat: 'competition', title: '美赛 O 奖论文 + 建模思路全公开', likes: 92 },
  { cat: 'kaggle',      title: '从 LB 第 27 跌到 312 的 shake-up 教训', likes: 89 },
  { cat: 'recommend',   title: '2024 浙大 CS 夏令营复盘 + 时间线', likes: 76 },
];
const MEGA_TOP_SAVED = [
  { cat: 'tool',     title: '在 tmux 里用 uv 管理多个实验环境', likes: 214 },
  { cat: 'research', title: 'DDPM 精读：从 ELBO 推导到代码实现', likes: 198 },
  { cat: 'course',   title: '高等数理统计 · 期末重点整理', likes: 167 },
];
const MEGA_LATEST = [
  { cat: 'kaggle',      title: 'CIBMTR 银牌：CV-LB 一致性的两个细节', ago: '2 天前' },
  { cat: 'life',        title: '在城西科创园找午饭的 N 种方式',         ago: '4 天前' },
  { cat: 'tool',        title: 'SSH 跳板机配置：踩过的 5 个坑',         ago: '5 天前' },
];

function MegaCatCard({ cat, onPick }) {
  const c = CATS[cat];
  const m = MEGA_COUNTS[cat];
  // resolve cat color → rgba 10% via known map (CSS var would need getComputedStyle; bake it)
  return (
    <div
      className="mega-card"
      role="link"
      tabIndex={0}
      onClick={() => onPick(cat)}
      onKeyDown={e => { if (e.key === 'Enter') onPick(cat); }}
    >
      <div className="mega-icon" data-cat={cat}>
        <CatIcon cat={cat} size={22} stroke={1.75} />
      </div>
      <div className="mega-text">
        <div className="mega-title">{c.label}</div>
        <div className="mega-desc">{c.desc}</div>
        <div className="mega-stat">{m.count} 篇{m.weekly > 0 ? ` · 本周 +${m.weekly}` : ''}</div>
      </div>
    </div>
  );
}

function MegaAllCard({ onPick }) {
  return (
    <div
      className="mega-card mega-card--all"
      role="link"
      tabIndex={0}
      onClick={() => onPick('all')}
      onKeyDown={e => { if (e.key === 'Enter') onPick('all'); }}
    >
      <div className="mega-icon mega-icon--all">
        <Icon name="layoutGrid" size={22} stroke={1.75} color="#FFFFFF" />
      </div>
      <div className="mega-text">
        <div className="mega-title">全部笔记</div>
        <div className="mega-desc">浏览所有 7 个板块的内容</div>
        <div className="mega-stat">共 {MEGA_TOTAL.count} 篇 · {MEGA_TOTAL.authors} 位作者</div>
      </div>
    </div>
  );
}

function MegaList({ heading, icon, items, showDate, onPick }) {
  return (
    <div className="mega-list">
      <div className="mega-list-h">
        {icon}
        <span>{heading}</span>
      </div>
      <ul>
        {items.map((it, i) => {
          const c = CATS[it.cat];
          return (
            <li key={i} className="mega-list-row" onClick={() => onPick(it.cat)}>
              <span className="mega-list-dot" style={{ background: c.color }}></span>
              <span className="mega-list-title">{it.title}</span>
              <span className="mega-list-meta">
                {showDate ? it.ago : (
                  <>
                    <Icon name="arrowRight" size={11} stroke={2} style={{ display: 'none' }} />
                    👍 {it.likes}
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MegaMenu({ open, onClose, onNavigate }) {
  // onNavigate(cat) — 'all' or category key; route to browse.html?cat=...
  const pick = (cat) => {
    onClose();
    if (onNavigate) onNavigate(cat);
    else location.href = cat === 'all' ? 'browse.html' : `browse.html?cat=${cat}`;
  };

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div
      className={`mega-panel ${open ? 'is-open' : ''}`}
      aria-hidden={!open}
      onMouseEnter={() => window.dispatchEvent(new CustomEvent('mega-keep'))}
      onMouseLeave={() => window.dispatchEvent(new CustomEvent('mega-close'))}
    >
      <div className="mega-grid">
        {CAT_ORDER.slice(0, 4).map(k => <MegaCatCard key={k} cat={k} onPick={pick} />)}
        {CAT_ORDER.slice(4).map(k => <MegaCatCard key={k} cat={k} onPick={pick} />)}
        <MegaAllCard onPick={pick} />
      </div>

      <div className="mega-divider"></div>

      <div className="mega-cols">
        <MegaList
          heading="本周热门"
          icon={<Icon name="flame" size={12} stroke={1.75} color="#9B9A97" />}
          items={MEGA_TRENDING}
          onPick={pick}
        />
        <MegaList
          heading="高赞收藏"
          icon={<Icon name="star" size={12} stroke={1.75} color="#9B9A97" />}
          items={MEGA_TOP_SAVED}
          onPick={pick}
        />
        <MegaList
          heading="最新发布"
          icon={<Icon name="sparkles" size={12} stroke={1.75} color="#9B9A97" />}
          items={MEGA_LATEST}
          showDate
          onPick={pick}
        />
      </div>

      <div className="mega-foot">
        <a className="mega-foot-link mega-foot-link--blue" onClick={() => pick('all')}>
          想看更多？前往全部浏览页 <ArrowRight size={12} />
        </a>
        <a
          className="mega-foot-link mega-foot-link--muted"
          onClick={() => { onClose(); location.href = 'write.html'; }}
        >
          + 写一篇新笔记
        </a>
      </div>
    </div>
  );
}

/* Trigger tab — combines hover-intent + click + keyboard.
   Wraps a <div className="nav-tab"> and a <MegaMenu> sibling.
*/
function BrowseTabWithMenu({ active, disabled }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(null);

  const cancelClose = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  // Listen to panel's own enter/leave so user can travel cursor into it
  useEffect(() => {
    const keep  = () => cancelClose();
    const close = () => scheduleClose();
    window.addEventListener('mega-keep', keep);
    window.addEventListener('mega-close', close);
    return () => {
      window.removeEventListener('mega-keep', keep);
      window.removeEventListener('mega-close', close);
    };
  }, []);

  const onTriggerEnter = () => { cancelClose(); setOpen(true); };
  const onTriggerLeave = () => { scheduleClose(); };
  const onTriggerClick = (e) => {
    // On touch / no-hover, toggle. Desktop fallback: full nav to browse.
    const isCoarse = window.matchMedia('(hover: none)').matches;
    if (isCoarse) {
      e.preventDefault();
      setOpen(o => !o);
    } else {
      // desktop: clicking the word itself jumps to /browse
      location.href = 'browse.html';
    }
  };
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); }
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div
      className="nav-browse-wrap"
      onMouseEnter={onTriggerEnter}
      onMouseLeave={onTriggerLeave}
    >
      <div
        className={`nav-tab ${active ? 'active' : ''} ${open ? 'is-mega-open' : ''}`}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={onTriggerClick}
        onKeyDown={onKey}
      >
        浏览
      </div>
      <MegaMenu
        open={open}
        onClose={() => setOpen(false)}
        onNavigate={(cat) => {
          location.href = cat === 'all' ? 'browse.html' : `browse.html?cat=${cat}`;
        }}
      />
    </div>
  );
}

Object.assign(window, { MegaMenu, BrowseTabWithMenu, MEGA_COUNTS, MEGA_TOTAL });
