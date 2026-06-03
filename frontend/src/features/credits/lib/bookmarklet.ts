/**
 * 自动导入用的常量 + 「导入飞跃」书签（后端中转版）。
 *
 * 思路：feiyue 与教务系统(jwxt)不同源，前端拉不到 PDF；jwxt 登录跳转 + CAS 的 COOP
 * 又会切断 window.opener，postMessage 回传不可靠。改为——书签在 jwxt 页（同源）导出
 * PDF 后，直接 POST 到 feiyue 后端中转端点 `/notes/transcript-stash`（按学号暂存 5min），
 * 学分统计页轮询取回。no-cors 的 multipart POST 无需 CORS；不依赖 opener。
 */

/**
 * webvpn 门户（登录入口）。注意不能直接开深层 jwxt 链接——没会话时它会被弹到
 * `authserver.webvpn.xju.edu.cn` 子域，浏览器常打不开；门户才是常规登录入口。
 */
export const JWXT_LOGIN_URL = 'https://webvpn.xju.edu.cn:8040/'

/**
 * 书签把 PDF POST 到的 feiyue 中转端点（挂在已被 nginx 代理的 `/notes/*` 下）。
 * winbeau.top 与 feiyue.selab.top 同一后端，POST 到任一都进同一内存暂存，前端在哪个
 * 域轮询都取得到，故固定用 feiyue.selab.top。
 */
const STASH_URL = 'https://feiyue.selab.top/notes/transcript-stash'

/** 书签源码（javascript:）。在 jwxt 成绩页运行：topdf→同源下载 PDF→POST 到中转端点。 */
export const FEIYUE_BOOKMARKLET =
  'javascript:(function(){' +
  "var B='https://jwxt-443.webvpn.xju.edu.cn:8040/xjdxjw/frame/pdf';" +
  "if(location.hostname.indexOf('jwxt-443.webvpn.xju.edu.cn')<0){alert('请先在教务系统成绩页里点此书签');return;}" +
  "var mm=document.cookie.match(/(?:^|; )webvpn_username=(\\d+)/);var sid=mm?mm[1]:'';" +
  "if(!sid){alert('没取到学号，请确认已登录教务系统');return;}" +
  'var ry=sid.slice(0,4);' +
  "var body='pageurl=student%252Fxscj.stuckcj_data.jsp%253Fsjxz%253Dsjxz1%2526ysyx%253Dyxcj%2526zx%253D1%2526fx%253D1%2526wz%253D0%2526rxnj%253D'+ry+'%2526nj%253D'+ry+'%2526btnExport%253D%2525E5%2525AF%2525BC%2525E5%252587%2525BA%2526xn%253D2025%2526xn1%253D2026%2526xq%253D1%2526ysyxS%253Don%2526sjxzS%253Don%2526zxC%253Don%2526fxC%253Don%2526xsjd%253D1%2526menucode_current%253DS40303&pageSize=A4&orientation=L&top=0&bottom=10&left=20&right=20&title=%25E6%259F%25A5%25E7%259C%258B%25E6%2588%2590%25E7%25BB%25A9';" +
  "fetch(B+'?method=topdf',{method:'POST',credentials:'include',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'},body:body})" +
  '.then(function(r){return r.json();})' +
  ".then(function(j){var p=(j.result||'').split(';;');var path=p[1]||p[0];if(!path)throw new Error(j.message||'生成失败');" +
  "return fetch(B+'?method=download&title=%25E6%259F%25A5%25E7%259C%258B%25E6%2588%2590%25E7%25BB%25A9.pdf&fileSavePath='+path,{credentials:'include'});})" +
  '.then(function(r){return r.blob();})' +
  ".then(function(blob){var fd=new FormData();fd.append('sid',sid);fd.append('file',blob,'查看成绩.pdf');" +
  "return fetch('" +
  STASH_URL +
  "',{method:'POST',mode:'no-cors',body:fd});})" +
  ".then(function(){alert('已回传到飞跃，请回「学分统计」标签页查看（几秒内自动解析）');})" +
  ".catch(function(e){alert('导出/回传失败: '+e);});})();"
