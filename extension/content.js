/*
 * 飞跃 · 成绩单一键导入 —— content script（manifest 声明 world:MAIN，运行在页面上下文，
 * 行为等同书签/用户脚本）。点按钮 → 同源 topdf/下载 PDF → no-cors POST 回传飞跃中转端点
 * → 打开飞跃学分统计页(进页面自动取回解析)。全程用你已登录的教务会话，不碰密码。
 *
 * v1.1：只在顶层框架注入(教务是 frameset)；不再用 cookie 读学号(可能 HttpOnly)，
 *       改从 topdf 返回的 `<学号>_时间.pdf` 取真实学号，kingo.guest 才算真未登录。
 */
;(function () {
  if (window.top !== window.self) return
  if (window.__feiyueImporter) return
  window.__feiyueImporter = true

  var PDF_API = 'https://jwxt-443.webvpn.xju.edu.cn:8040/xjdxjw/frame/pdf'
  var STASH = 'https://feiyue.selab.top/notes/transcript-stash'
  var FEIYUE = 'https://feiyue.selab.top/credits'
  var TITLE = '%25E6%259F%25A5%25E7%259C%258B%25E6%2588%2590%25E7%25BB%25A9'

  var btn = document.createElement('button')
  btn.id = 'feiyue-import-btn'
  btn.type = 'button'
  btn.textContent = '📥 导入飞跃'
  btn.style.cssText = [
    'position:fixed', 'right:20px', 'bottom:20px', 'z-index:2147483647',
    'padding:10px 16px', 'border:none', 'border-radius:9999px',
    'background:#16a34a', 'color:#fff',
    'font:600 14px/1.2 system-ui,-apple-system,sans-serif',
    'cursor:pointer', 'box-shadow:0 4px 14px rgba(0,0,0,.25)',
  ].join(';')

  var busy = false
  function set(text, bg) { btn.textContent = text; if (bg) btn.style.background = bg }
  function reset(ms) { setTimeout(function () { busy = false; set('📥 导入飞跃', '#16a34a') }, ms) }
  function guessRxnj() {
    try {
      var m = (document.documentElement.innerText || '').match(/\b(20\d{9})\b/)
      if (m) return m[1].slice(0, 4)
    } catch (e) {}
    return '2024'
  }

  btn.addEventListener('click', function () {
    if (busy) return
    busy = true
    var ry = guessRxnj()
    var sid = ''
    var body =
      'pageurl=student%252Fxscj.stuckcj_data.jsp%253Fsjxz%253Dsjxz1%2526ysyx%253Dyxcj%2526zx%253D1%2526fx%253D1%2526wz%253D0%2526rxnj%253D' +
      ry + '%2526nj%253D' + ry +
      '%2526btnExport%253D%2525E5%2525AF%2525BC%2525E5%252587%2525BA%2526xn%253D2025%2526xn1%253D2026%2526xq%253D1%2526ysyxS%253Don%2526sjxzS%253Don%2526zxC%253Don%2526fxC%253Don%2526xsjd%253D1%2526menucode_current%253DS40303' +
      '&pageSize=A4&orientation=L&top=0&bottom=10&left=20&right=20&title=' + TITLE
    set('⏳ 导出中…', '#6b7280')
    fetch(PDF_API + '?method=topdf', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
      body: body,
    })
      .then(function (r) { return r.json() })
      .then(function (j) {
        var path = (j.result || '').split(';;')[1] || ''
        var m = path.match(/output\/([^/_]+)_\d+\.pdf/)
        sid = m ? m[1] : ''
        if (!sid || /guest/i.test(sid)) throw new Error('未登录教务系统或会话已过期，请先登录后再点')
        return fetch(PDF_API + '?method=download&title=' + TITLE + '.pdf&fileSavePath=' + path, { credentials: 'include' })
      })
      .then(function (r) { return r.blob() })
      .then(function (blob) {
        var fd = new FormData(); fd.append('sid', sid); fd.append('file', blob, '查看成绩.pdf')
        return fetch(STASH, { method: 'POST', mode: 'no-cors', body: fd })
      })
      .then(function () {
        // 不再自动开新标签(会抢焦点)。切回飞跃「学分统计」标签页即自动刷出报告。
        set('✅ 已回传，切到飞跃标签页查看', '#16a34a')
        reset(6000)
      })
      .catch(function (e) { set('✗ ' + (e && e.message ? e.message : e), '#dc2626'); reset(6000) })
  })

  function mount() {
    if (!document.getElementById('feiyue-import-btn')) {
      ;(document.body || document.documentElement).appendChild(btn)
    }
  }
  if (document.body) mount()
  else document.addEventListener('DOMContentLoaded', mount)
})()
