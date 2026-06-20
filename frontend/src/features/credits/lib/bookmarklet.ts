/**
 * 自动导入用的常量 + 「导入飞跃」书签（后端中转版）。
 *
 * 书签运行在教务页面内（同源），用你已登录的会话 fetch topdf/download(浏览器自动带上
 * 会话 cookie，含 HttpOnly 的)，再 no-cors multipart POST 把 PDF 回传到飞跃后端中转端点。
 * 学号不从 cookie 读(webvpn_username 常为 HttpOnly → JS 读不到)，改从 topdf 返回的
 * `<学号>_时间.pdf` 取真实学号；kingo.guest 才算真未登录。
 */

/** webvpn 门户(登录入口；深层 jwxt 链接冷启动会被弹到打不开的 authserver 子域)。 */
export const JWXT_LOGIN_URL = 'https://webvpn.xju.edu.cn:8040/'

/** 脚本猫官网(下载/安装用户脚本管理器)。 */
export const SCRIPTCAT_HOME_URL = 'https://scriptcat.org/'

/**
 * 「飞跃导入」用户脚本的安装地址(由飞跃站点静态托管；脚本管理器在场时点开即弹安装)。
 * 带版本 query 绕过 Cloudflare 4h 缓存，保证向导里点「安装脚本」拿到的是最新版；
 * Tampermonkey 自动更新走 @updateURL(无 query)，二者互不影响。
 */
export const IMPORT_USERJS_URL = '/feiyue-importer.user.js?v=1.6.0'

/** 书签把 PDF POST 到的飞跃中转端点(挂在已被 nginx 代理的 /notes 下)。 */
const STASH_URL = 'https://feiyue.selab.top/notes/transcript-stash'

/** 书签源码(javascript:)。在教务任意页面运行:topdf→同源下载 PDF→POST 中转端点。 */
export const FEIYUE_BOOKMARKLET =
  'javascript:(function(){' +
  "var B='https://jwxt-443.webvpn.xju.edu.cn:8040/xjdxjw/frame/pdf';" +
  "var T='%25E6%259F%25A5%25E7%259C%258B%25E6%2588%2590%25E7%25BB%25A9';" +
  "if(location.hostname.indexOf('jwxt-443.webvpn.xju.edu.cn')<0){alert('请先在教务系统页面里点此书签');return;}" +
  "var rm=(document.documentElement.innerText||'').match(/\\b(20\\d{9})\\b/);var ry=rm?rm[1].slice(0,4):'2024';var sid='';" +
  "var body='pageurl=student%252Fxscj.stuckcj_data.jsp%253Fsjxz%253Dsjxz1%2526ysyx%253Dyxcj%2526zx%253D1%2526fx%253D1%2526wz%253D0%2526rxnj%253D'+ry+'%2526nj%253D'+ry+'%2526btnExport%253D%2525E5%2525AF%2525BC%2525E5%252587%2525BA%2526xn%253D2025%2526xn1%253D2026%2526xq%253D1%2526ysyxS%253Don%2526sjxzS%253Don%2526zxC%253Don%2526fxC%253Don%2526xsjd%253D1%2526menucode_current%253DS40303&pageSize=A4&orientation=L&top=0&bottom=10&left=20&right=20&title='+T;" +
  "fetch(B+'?method=topdf',{method:'POST',credentials:'include',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'},body:body})" +
  '.then(function(r){return r.json();})' +
  ".then(function(j){var p=(j.result||'').split(';;')[1]||'';var m=p.match(/output\\/([^/_]+)_\\d+\\.pdf/);sid=m?m[1]:'';if(!sid||/guest/i.test(sid))throw new Error('未登录教务系统或会话过期，请先登录');" +
  "return fetch(B+'?method=download&title='+T+'.pdf&fileSavePath='+p,{credentials:'include'});})" +
  '.then(function(r){return r.blob();})' +
  ".then(function(blob){var fd=new FormData();fd.append('sid',sid);fd.append('file',blob,'查看成绩.pdf');" +
  "return fetch('" +
  STASH_URL +
  "',{method:'POST',mode:'no-cors',body:fd});})" +
  ".then(function(){alert('已回传到飞跃，请回「学分统计」标签页查看(几秒内自动解析)');})" +
  ".catch(function(e){alert('导出/回传失败: '+(e&&e.message||e));});})();"
