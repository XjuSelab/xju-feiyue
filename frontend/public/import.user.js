// ==UserScript==
// @name         飞跃 · 成绩单一键导入
// @namespace    https://feiyue.selab.top/
// @version      1.0.0
// @description  在新疆大学教务系统成绩页加「📥 导入飞跃」悬浮按钮，一键导出成绩单并回传飞跃学分统计，自动出结果。
// @author       feiyue
// @match        https://jwxt-443.webvpn.xju.edu.cn:8040/*
// @run-at       document-idle
// @grant        none
// @downloadURL  https://feiyue.selab.top/import.user.js
// @updateURL    https://feiyue.selab.top/import.user.js
// ==/UserScript==

/*
 * 用户脚本（Tampermonkey）。@grant none → 运行在页面上下文，行为等同书签：
 * 同源 fetch 教务的 topdf/download，再用 no-cors multipart POST 把 PDF 回传到飞跃后端
 * 中转端点（按学号暂存），随后打开飞跃学分统计页（该页进页面即自动取回解析）。
 * 全程用你自己已登录的教务会话，不碰密码。装一次后自动更新。
 */
;(function () {
  'use strict'
  if (window.__feiyueImporter) return
  window.__feiyueImporter = true

  var PDF_API = 'https://jwxt-443.webvpn.xju.edu.cn:8040/xjdxjw/frame/pdf'
  var STASH = 'https://feiyue.selab.top/notes/transcript-stash'
  var FEIYUE = 'https://feiyue.selab.top/credits'
  var TITLE = '%25E6%259F%25A5%25E7%259C%258B%25E6%2588%2590%25E7%25BB%25A9' // “查看成绩”双重编码

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
  function set(text, bg) {
    btn.textContent = text
    if (bg) btn.style.background = bg
  }
  function reset(ms) {
    setTimeout(function () {
      busy = false
      set('📥 导入飞跃', '#16a34a')
    }, ms)
  }

  btn.addEventListener('click', function () {
    if (busy) return
    var mm = document.cookie.match(/(?:^|; )webvpn_username=(\d+)/)
    var sid = mm ? mm[1] : ''
    if (!sid) {
      set('⚠ 未登录教务系统', '#dc2626')
      reset(3000)
      return
    }
    busy = true
    var ry = sid.slice(0, 4)
    var body =
      'pageurl=student%252Fxscj.stuckcj_data.jsp%253Fsjxz%253Dsjxz1%2526ysyx%253Dyxcj%2526zx%253D1%2526fx%253D1%2526wz%253D0%2526rxnj%253D' +
      ry + '%2526nj%253D' + ry +
      '%2526btnExport%253D%2525E5%2525AF%2525BC%2525E5%252587%2525BA%2526xn%253D2025%2526xn1%253D2026%2526xq%253D1%2526ysyxS%253Don%2526sjxzS%253Don%2526zxC%253Don%2526fxC%253Don%2526xsjd%253D1%2526menucode_current%253DS40303' +
      '&pageSize=A4&orientation=L&top=0&bottom=10&left=20&right=20&title=' + TITLE
    set('⏳ 导出中…', '#6b7280')
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
        var parts = (j.result || '').split(';;')
        var path = parts[1] || parts[0]
        if (!path) throw new Error(j.message || '生成失败')
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
        set('✅ 已回传，正在打开飞跃…', '#16a34a')
        window.open(FEIYUE, '_blank')
        reset(4000)
      })
      .catch(function (e) {
        set('✗ 失败：' + (e && e.message ? e.message : e), '#dc2626')
        reset(5000)
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
