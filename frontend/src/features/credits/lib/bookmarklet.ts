/**
 * 「导入飞跃」书签 + 自动导入用到的跨域常量。
 *
 * 为什么需要书签：feiyue 与教务系统(jwxt)是不同源，浏览器同源策略/CORS 使 feiyue 的 JS
 * 无法跨域拉取 jwxt 的 PDF。书签运行在 jwxt 页面内（同源），导出 PDF 后用 postMessage
 * 把字节回传给 feiyue 这个 opener 窗口。feiyue 侧只信任来自 JWXT_ORIGIN 的消息。
 *
 * 回传消息协议（origin 必为 JWXT_ORIGIN）：
 *   {type:'feiyue-transcript-start'}                     书签开始执行（feiyue 转绿、进入拉取态）
 *   {type:'feiyue-transcript', name, buf:ArrayBuffer}    PDF 字节
 *   {type:'feiyue-transcript-error', msg}                导出失败
 */

export const JWXT_ORIGIN = 'https://jwxt-443.webvpn.xju.edu.cn:8040'

/** 教务系统「查看成绩」页（登录后到这里点书签）。 */
export const JWXT_GRADES_URL =
  JWXT_ORIGIN + '/xjdxjw/student/xscj.stuckcj.jsp?menucode=S40303'

/**
 * 书签源码（javascript: 形式，拖到书签栏即可）。在 jwxt 成绩页运行：
 * topdf 生成 → 同源 fetch 下载 PDF → postMessage 回 feiyue；opener 丢失则降级为下载。
 * rxnj（入学年级）从 webvpn_username cookie 取学号前 4 位，自动适配各年级。
 */
export const FEIYUE_BOOKMARKLET =
  "javascript:(function(){var B='https://jwxt-443.webvpn.xju.edu.cn:8040/xjdxjw/frame/pdf';" +
  "if(location.hostname.indexOf('jwxt-443.webvpn.xju.edu.cn')<0){alert('请先在教务系统成绩页里点此书签');return;}" +
  "function back(m){try{if(window.opener)window.opener.postMessage(m,'*');}catch(e){}}" +
  "back({type:'feiyue-transcript-start'});" +
  "var mm=document.cookie.match(/(?:^|; )webvpn_username=(\\d{4})/);var ry=mm?mm[1]:'2024';" +
  "var body='pageurl=student%252Fxscj.stuckcj_data.jsp%253Fsjxz%253Dsjxz1%2526ysyx%253Dyxcj%2526zx%253D1%2526fx%253D1%2526wz%253D0%2526rxnj%253D'+ry+'%2526nj%253D'+ry+'%2526btnExport%253D%2525E5%2525AF%2525BC%2525E5%252587%2525BA%2526xn%253D2025%2526xn1%253D2026%2526xq%253D1%2526ysyxS%253Don%2526sjxzS%253Don%2526zxC%253Don%2526fxC%253Don%2526xsjd%253D1%2526menucode_current%253DS40303&pageSize=A4&orientation=L&top=0&bottom=10&left=20&right=20&title=%25E6%259F%25A5%25E7%259C%258B%25E6%2588%2590%25E7%25BB%25A9';" +
  "fetch(B+'?method=topdf',{method:'POST',credentials:'include',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'},body:body})" +
  ".then(function(r){return r.json();})" +
  ".then(function(j){var p=(j.result||'').split(';;');var path=p[1]||p[0];if(!path)throw new Error(j.message||'生成失败');" +
  "return fetch(B+'?method=download&title=%25E6%259F%25A5%25E7%259C%258B%25E6%2588%2590%25E7%25BB%25A9.pdf&fileSavePath='+path,{credentials:'include'});})" +
  ".then(function(r){return r.arrayBuffer();})" +
  ".then(function(buf){if(window.opener){back({type:'feiyue-transcript',name:'查看成绩.pdf',buf:buf});alert('已回传到飞跃，请切回飞跃标签页查看');}" +
  "else{var b=new Blob([buf],{type:'application/pdf'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='查看成绩.pdf';a.click();alert('无法自动回传(登录跳转切断了连接)，已改为下载，请把文件拖到飞跃页上传');}})" +
  ".catch(function(e){back({type:'feiyue-transcript-error',msg:String(e&&e.message||e)});alert('导出失败: '+e);});})();"
