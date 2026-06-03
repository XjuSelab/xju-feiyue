// ==UserScript==
// @name         飞跃 · 成绩单一键导入
// @namespace    https://feiyue.selab.top/
// @version      1.4.0
// @description  在新疆大学教务系统成绩页加「导入飞跃」悬浮按钮，一键导出成绩单并回传飞跃学分统计，自动出结果。
// @author       feiyue
// @match        https://jwxt-443.webvpn.xju.edu.cn:8040/*
// @match        https://feiyue.selab.top/*
// @match        https://winbeau.top/*
// @run-at       document-idle
// @grant        none
// @downloadURL  https://feiyue.selab.top/import.user.js
// @updateURL    https://feiyue.selab.top/import.user.js
// ==/UserScript==

/*
 * 用户脚本(Tampermonkey)。@grant none → 运行在页面上下文，行为等同书签：
 * 同源 fetch 教务 topdf/download(浏览器自动带上你已登录的会话 cookie，含 HttpOnly 的)，
 * 再 no-cors multipart POST 把 PDF 回传到飞跃后端中转端点；随后切回飞跃 /credits 自动解析。
 * 全程用你自己已登录的教务会话，不碰密码。
 *
 * v1.3：悬浮按钮改用飞跃站点的 Notion 风格(白底/细边/深色字/飞跃绿 accent/12px 圆角)并加大；
 *       状态 default→loading(转圈)→success(绿勾)→error(红叉)，CSS spinner，无外部资源。
 * v1.1：① 只在顶层框架注入(教务是 frameset，否则每个子框架各冒一个按钮)；
 *       ② 不再用 document.cookie 读学号(webvpn_username 常为 HttpOnly，JS 读不到 → 误判未登录)，
 *          改为从 topdf 返回的 `<学号>_时间.pdf` 里取真实学号；kingo.guest 才是真未登录。
 */
;(function () {
  'use strict'
  if (window.top !== window.self) return // 只在顶层框架

  // 在飞跃站点：只「自报已安装」，供学分统计页的导入向导检测安装进度；不注入按钮。
  var HOST = location.hostname
  if (HOST === 'feiyue.selab.top' || HOST === 'winbeau.top') {
    try {
      window.__feiyueImporterReady = true
      var handler =
        (typeof GM_info !== 'undefined' && GM_info && GM_info.scriptHandler) || '1'
      document.documentElement.setAttribute('data-feiyue-importer', handler)
      window.dispatchEvent(new Event('feiyue:importer-ready'))
    } catch (e) {}
    return
  }

  if (window.__feiyueImporter) return
  window.__feiyueImporter = true

  var PDF_API = 'https://jwxt-443.webvpn.xju.edu.cn:8040/xjdxjw/frame/pdf'
  var STASH = 'https://feiyue.selab.top/notes/transcript-stash'
  var TITLE = '%25E6%259F%25A5%25E7%259C%258B%25E6%2588%2590%25E7%25BB%25A9' // “查看成绩”双重编码

  // —— 飞跃设计 token(与站点 tokens.css 对齐)——
  var C = {
    bg: '#ffffff',
    bgHover: '#f7f6f3',
    text: '#37352f',
    muted: '#787774',
    line: '#dcdad4',
    green: '#0f7b6c', // cat-tools
    greenBg: 'rgba(15,123,108,.08)',
    greenLine: 'rgba(15,123,108,.4)',
    red: '#e03e3e', // cat-research
    redBg: 'rgba(224,62,62,.08)',
    redLine: 'rgba(224,62,62,.4)',
  }
  var FONT =
    "600 15px/1.25 'Inter Tight','PingFang SC',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

  // —— 图标(line-icon，stroke=currentColor，Notion 感)——
  var SVG_OPEN = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
  var IC_DOWNLOAD = SVG_OPEN + '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
  var IC_CHECK = SVG_OPEN + '<polyline points="20 6 9 17 4 12"/></svg>'
  var IC_CROSS = SVG_OPEN + '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  var IC_SPIN = '<span class="fy-spin"></span>'

  // 注入 keyframes + hover(只注一次)。
  var style = document.createElement('style')
  style.textContent =
    '@keyframes fy-spin{to{transform:rotate(360deg)}}' +
    '.fy-spin{display:inline-block;width:15px;height:15px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:fy-spin .7s linear infinite}' +
    '#feiyue-import-btn:hover{background:' + C.bgHover + ';transform:translateY(-1px)}' +
    '#feiyue-import-btn:active{transform:translateY(0)}' +
    '#feiyue-import-btn .fy-ic{display:inline-flex;align-items:center}'
  ;(document.head || document.documentElement).appendChild(style)

  var btn = document.createElement('button')
  btn.id = 'feiyue-import-btn'
  btn.type = 'button'
  btn.style.cssText = [
    'position:fixed', 'right:24px', 'bottom:24px', 'z-index:2147483647',
    'display:inline-flex', 'align-items:center', 'gap:10px',
    'padding:13px 20px', 'border-radius:12px',
    'font:' + FONT, 'cursor:pointer',
    'box-shadow:0 6px 20px rgba(15,15,15,.13),0 1px 3px rgba(15,15,15,.08)',
    'transition:background .15s ease,border-color .15s ease,color .15s ease,transform .1s ease',
    '-webkit-font-smoothing:antialiased',
  ].join(';')

  var busy = false
  // variant: default | loading | success | error；default 时图标用飞跃绿点缀。
  function render(variant, iconHtml, text) {
    var border = C.line, bg = C.bg, color = C.text, icColor = ''
    if (variant === 'loading') { color = C.muted }
    else if (variant === 'success') { border = C.greenLine; bg = C.greenBg; color = C.green }
    else if (variant === 'error') { border = C.redLine; bg = C.redBg; color = C.red }
    else { icColor = C.green } // default
    btn.style.border = '1px solid ' + border
    btn.style.background = bg
    btn.style.color = color
    btn.innerHTML =
      '<span class="fy-ic"' + (icColor ? ' style="color:' + icColor + '"' : '') + '>' + iconHtml + '</span>' +
      '<span>' + text + '</span>'
  }
  function idle() { busy = false; render('default', IC_DOWNLOAD, '导入飞跃 · 成绩单') }
  function reset(ms) { setTimeout(idle, ms) }
  idle()

  // 入学年级(rxnj)尽力从页面里的学号取前4位，取不到用 2024；「入学以来」基本不依赖它。
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
    render('loading', IC_SPIN, '正在导出成绩单…')
    fetch(PDF_API + '?method=topdf', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: body,
    })
      .then(function (r) { return r.json() })
      .then(function (j) {
        var path = (j.result || '').split(';;')[1] || ''
        var m = path.match(/output\/([^/_]+)_\d+\.pdf/)
        sid = m ? m[1] : ''
        if (!sid || /guest/i.test(sid)) {
          throw new Error('未登录教务系统或会话已过期，请先在教务系统登录后再点')
        }
        render('loading', IC_SPIN, '正在回传飞跃…')
        return fetch(
          PDF_API + '?method=download&title=' + TITLE + '.pdf&fileSavePath=' + path,
          { credentials: 'include' },
        )
      })
      .then(function (r) { return r.blob() })
      .then(function (blob) {
        var fd = new FormData()
        fd.append('sid', sid)
        fd.append('file', blob, '查看成绩.pdf')
        return fetch(STASH, { method: 'POST', mode: 'no-cors', body: fd })
      })
      .then(function () {
        // 不再自动开新标签(会抢焦点)。切回飞跃「学分统计」标签页即自动刷出报告。
        render('success', IC_CHECK, '已回传 · 切回飞跃标签页查看')
        reset(6000)
      })
      .catch(function (e) {
        render('error', IC_CROSS, (e && e.message ? e.message : String(e)))
        reset(6000)
      })
  })

  function mount() {
    if (!document.getElementById('feiyue-import-btn')) {
      ;(document.body || document.documentElement).appendChild(btn)
    }
  }
  if (document.body) mount()
  else document.addEventListener('DOMContentLoaded', mount)
})()
