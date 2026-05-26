/* =========================================================
   CCF 推荐国际学术会议 — 数据
   依据：《中国计算机学会推荐国际学术会议和期刊目录》
         第七版（2026 年 3 月更新）
   字段说明:
     abbr        会议简称
     name_full   会议全称
     field       领域 id（详见 CCF_FIELDS）
     tier        CCF 级别 A | B | C
     publisher   出版方
     dblp        DBLP 索引
     homepage    会议官网（最新一届/历届入口；未发布的写 null）
     cycle       本条数据指向的届次（如 "2027"）
     location    会议地点
     conf_date   会议日期（区间）
     deadline    截稿日期（ISO；摘要/全文以最近一档为准），null = 未公布
     note        额外备注（如 ABCD 双盲/多档 deadline）

   ⚠️ 截稿日期、地点等 2026/2027 周期信息为人工整理，
      以会议官方网站公告为准。
   ========================================================= */

const CCF_FIELDS = [
  { id: 'arch',     name_cn: '体系结构 / 并行 / 存储',   short: '体系',   color: '#0B6E99' },
  { id: 'network',  name_cn: '计算机网络',                short: '网络',   color: '#0F7B6C' },
  { id: 'security', name_cn: '网络与信息安全',            short: '安全',   color: '#E03E3E' },
  { id: 'se',       name_cn: '软工 / 系统软件 / 程设语言',short: '软工',   color: '#D9730D' },
  { id: 'db',       name_cn: '数据库 / 数据挖掘 / 检索',  short: '数据',   color: '#9065B0' },
  { id: 'theory',   name_cn: '计算机科学理论',            short: '理论',   color: '#B5926A' },
  { id: 'graphics', name_cn: '图形学 / 多媒体',           short: '图形',   color: '#B8405E' },
  { id: 'ai',       name_cn: '人工智能',                  short: 'AI',     color: '#37352F' },
  { id: 'hci',      name_cn: '人机交互 / 普适计算',       short: 'HCI',    color: '#0F5E54' },
  { id: 'misc',     name_cn: '交叉 / 综合 / 新兴',        short: '交叉',   color: '#787774' },
];

/* ----- helper: terser entry literal -----
   extra 额外键：
     h/cy/loc/cd/dl/n     主页 / 届 / 地点 / 会期 / 截稿 / 备注
     sub/acc/rate/sy      投稿数 / 接受数 / 接受率(%) / 统计数据年份
   录取统计为人工整理的近期公开数据，sy 标注来源年份；以官网为准。 */
const _c = (abbr, name_full, field, tier, publisher, dblp, extra = {}) => ({
  abbr, name_full, field, tier, publisher, dblp,
  homepage: extra.h ?? null,
  cycle:    extra.cy ?? null,
  location: extra.loc ?? null,
  conf_date:extra.cd ?? null,
  deadline: extra.dl ?? null,
  note:     extra.n ?? null,
  submissions:     extra.sub  ?? null,
  accepted:        extra.acc  ?? null,
  acceptance_rate: extra.rate ?? null,
  stats_year:      extra.sy   ?? null,
});

const CCF_CONFS = [
  /* ===== 1 · 体系结构 / 并行与分布计算 / 存储系统 ===== */
  /* A */
  _c('PPoPP',  'ACM SIGPLAN Symposium on Principles & Practice of Parallel Programming', 'arch','A','ACM','http://dblp.uni-trier.de/db/conf/ppopp/',
     { h:'https://ppopp26.sigplan.org/', cy:'2026', loc:'Seoul, Korea', cd:'2026-03-07 ~ 03-11', dl:'2025-08-08', n:'已截止' }),
  _c('FAST',   'USENIX Conference on File and Storage Technologies','arch','A','USENIX','http://dblp.uni-trier.de/db/conf/fast/',
     { h:'https://www.usenix.org/conference/fast26', cy:'2026', loc:'Santa Clara, USA', cd:'2026-02-23 ~ 02-26', dl:'2025-09-18', n:'已截止' }),
  _c('DAC',    'Design Automation Conference','arch','A','ACM','https://dblp.uni-trier.de/db/conf/dac/',
     { h:'https://www.dac.com/', cy:'2026', loc:'San Francisco, USA', cd:'2026-06-21 ~ 06-25', dl:'2025-11-17' }),
  _c('HPCA',   'IEEE International Symposium on High Performance Computer Architecture','arch','A','IEEE','http://dblp.uni-trier.de/db/conf/hpca/',
     { h:'https://hpca-conf.org/2027/', cy:'2027', loc:'TBA', cd:'2027-02', dl:'2026-08-01', n:'摘要 7.25 · 全文 8.1' }),
  _c('MICRO',  'IEEE/ACM International Symposium on Microarchitecture','arch','A','IEEE/ACM','https://dblp.uni-trier.de/db/conf/micro/index.html',
     { h:'https://microarch.org/micro59/', cy:'2026', loc:'Tokyo, Japan', cd:'2026-10-17 ~ 10-21', dl:'2026-04-09', n:'已截止' }),
  _c('SC',     'International Conference for High Performance Computing, Networking, Storage, and Analysis','arch','A','IEEE','http://dblp.uni-trier.de/db/conf/sc/',
     { h:'https://sc26.supercomputing.org/', cy:'2026', loc:'St. Louis, USA', cd:'2026-11-15 ~ 11-20', dl:'2026-04-02', n:'已截止' }),
  _c('ASPLOS', 'International Conference on Architectural Support for Programming Languages and Operating Systems','arch','A','ACM','http://dblp.uni-trier.de/db/conf/asplos/',
     { h:'https://www.asplos-conference.org/asplos2027/', cy:'2027', loc:'TBA', cd:'2027-03', dl:'2026-07-17', n:'秋档 7.17 截稿' }),
  _c('ISCA',   'International Symposium on Computer Architecture','arch','A','IEEE/ACM','http://dblp.uni-trier.de/db/conf/isca/',
     { h:'https://iscaconf.org/isca2026/', cy:'2026', loc:'Seoul, Korea', cd:'2026-06-27 ~ 07-01', dl:'2025-11-13', n:'已截止' }),
  _c('ATC',    'ACM SIGOPS Annual Technical Conference','arch','A','ACM','http://dblp.uni-trier.de/db/conf/usenix/index.html',
     { h:'https://www.usenix.org/conference/atc26', cy:'2026', loc:'Boston, USA', cd:'2026-07-13 ~ 07-15', dl:'2026-01-09', n:'原 USENIX ATC · 已截止' }),
  _c('EuroSys','European Conference on Computer Systems','arch','A','ACM','http://dblp.uni-trier.de/db/conf/eurosys/',
     { h:'https://2026.eurosys.org/', cy:'2026', loc:'Lisbon, Portugal', cd:'2026-04-20 ~ 04-23', dl:'2025-10-17', n:'已结束' }),
  _c('HPDC',   'International ACM Symposium on High-Performance Parallel and Distributed Computing','arch','A','IEEE','http://dblp.uni-trier.de/db/conf/hpdc/',
     { h:'https://www.hpdc.org/2026/', cy:'2026', loc:'Munich, Germany', cd:'2026-07-20 ~ 07-24', dl:'2026-01-23', n:'已截止' }),

  /* B - selected */
  _c('SoCC',   'ACM Symposium on Cloud Computing','arch','B','ACM','http://dblp.uni-trier.de/db/conf/cloud/',
     { h:'https://acmsocc.org/2026/', cy:'2026', loc:'Online + Berkeley, USA', cd:'2026-11-09 ~ 11-12', dl:'2026-06-18' }),
  _c('PODC',   'ACM Symposium on Principles of Distributed Computing','arch','B','ACM','http://dblp.uni-trier.de/db/conf/podc/',
     { h:'https://www.podc.org/podc2026/', cy:'2026', loc:'Lisbon, Portugal', cd:'2026-07-20 ~ 07-23', dl:'2026-02-13', n:'已截止' }),
  _c('FPGA',   'ACM/SIGDA International Symposium on Field-Programmable Gate Arrays','arch','B','ACM','http://dblp.uni-trier.de/db/conf/fpga/',
     { h:'https://www.isfpga.org/', cy:'2026', loc:'Monterey, USA', cd:'2026-02-22 ~ 02-24', dl:'2025-08-29', n:'已结束' }),
  _c('CGO',    'International Symposium on Code Generation and Optimization','arch','B','IEEE/ACM','http://dblp.uni-trier.de/db/conf/cgo/',
     { h:'https://conf.researchr.org/home/cgo-2026', cy:'2026', loc:'Sapporo, Japan', cd:'2026-03-07 ~ 03-11', dl:'2025-09-05', n:'已结束' }),
  _c('DATE',   'Design, Automation & Test in Europe','arch','B','IEEE/ACM','http://dblp.uni-trier.de/db/conf/date/',
     { h:'https://www.date-conference.com/', cy:'2026', loc:'Verona, Italy', cd:'2026-04-13 ~ 04-17', dl:'2025-09-14', n:'已结束' }),
  _c('CLUSTER','IEEE International Conference on Cluster Computing','arch','B','IEEE','https://dblp.uni-trier.de/db/conf/cluster/',
     { h:'https://clustercomp.org/2026/', cy:'2026', loc:'Edinburgh, UK', cd:'2026-09-14 ~ 09-18', dl:'2026-04-24', n:'已截止' }),
  _c('ICCAD',  'International Conference on Computer-Aided Design','arch','B','IEEE/ACM','http://dblp.uni-trier.de/db/conf/iccad/',
     { h:'https://iccad.com/', cy:'2026', loc:'Munich, Germany', cd:'2026-10-25 ~ 10-29', dl:'2026-05-08', n:'已截止' }),
  _c('ICDCS',  'IEEE International Conference on Distributed Computing Systems','arch','B','IEEE','http://dblp.uni-trier.de/db/conf/icdcs/',
     { h:'https://icdcs2026.icdcs.org/', cy:'2026', loc:'Hong Kong', cd:'2026-07-21 ~ 07-24', dl:'2026-01-14', n:'已截止' }),
  _c('SIGMETRICS','International Conference on Measurement and Modeling of Computer Systems','arch','B','ACM','http://dblp.uni-trier.de/db/conf/sigmetrics/',
     { h:'https://www.sigmetrics.org/sigmetrics2026/', cy:'2026', loc:'Beijing, China', cd:'2026-06-08 ~ 06-12', dl:'2025-10-10' }),
  _c('PACT',   'International Conference on Parallel Architectures and Compilation Techniques','arch','B','IEEE/ACM','http://dblp.uni-trier.de/db/conf/IEEEpact/'),
  _c('ICPP',   'International Conference on Parallel Processing','arch','B','ACM','http://dblp.uni-trier.de/db/conf/icpp/',
     { h:'https://icpp2026.org/', cy:'2026', loc:'San Diego, USA', cd:'2026-08-31 ~ 09-03', dl:'2026-03-30', n:'已截止' }),
  _c('ICS',    'International Conference on Supercomputing','arch','B','ACM','http://dblp.uni-trier.de/db/conf/ics/',
     { h:'https://ics2026.github.io/', cy:'2026', loc:'Glasgow, UK', cd:'2026-06-09 ~ 06-12', dl:'2026-01-19', n:'已结束' }),
  _c('IPDPS',  'IEEE International Parallel & Distributed Processing Symposium','arch','B','IEEE','http://dblp.uni-trier.de/db/conf/ipps/',
     { h:'https://www.ipdps.org/', cy:'2026', loc:'Glasgow, UK', cd:'2026-05-31 ~ 06-04', dl:'2025-10-09', n:'已截止' }),
  _c('RTAS',   'IEEE Real-Time and Embedded Technology and Applications Symposium','arch','B','IEEE','http://dblp.uni-trier.de/db/conf/rtas/'),
  _c('Euro-Par','European Conference on Parallel and Distributed Computing','arch','B','Springer','http://dblp.uni-trier.de/db/conf/europar/',
     { h:'https://2026.europar.org/', cy:'2026', loc:'Glasgow, UK', cd:'2026-08-24 ~ 08-28', dl:'2026-03-06', n:'已截止' }),
  _c('ISCAS',  'IEEE International Symposium on Circuits and Systems','arch','B','IEEE','http://dblp.uni-trier.de/db/conf/hpdc/'),

  /* C - selected */
  _c('CCGRID', 'IEEE/ACM International Symposium on Cluster, Cloud and Grid Computing','arch','C','IEEE/ACM','http://dblp.uni-trier.de/db/conf/IEEEpact/'),
  _c('ICA3PP', 'International Conference on Algorithms and Architectures for Parallel Processing','arch','C','IEEE','http://dblp.uni-trier.de/db/conf/ics/'),
  _c('FCCM',   'IEEE Symposium on Field-Programmable Custom Computing Machines','arch','C','IEEE','http://dblp.uni-trier.de/db/conf/fccm/'),
  _c('ASP-DAC','Asia and South Pacific Design Automation Conference','arch','C','IEEE/ACM','http://dblp.uni-trier.de/db/conf/aspdac'),
  _c('HiPC',   'IEEE International Conference on High Performance Computing, Data and Analytics','arch','C','IEEE/ACM','http://dblp.uni-trier.de/db/conf/hipc/index.html'),
  _c('SEC',    'ACM/IEEE Symposium on Edge Computing','arch','C','IEEE/ACM','https://dblp.uni-trier.de/db/conf/ieeesec/index.html'),

  /* ===== 2 · 计算机网络 ===== */
  /* A */
  _c('SIGCOMM','ACM International Conference on Applications, Technologies, Architectures, and Protocols for Computer Communication','network','A','ACM','http://dblp.uni-trier.de/db/conf/sigcomm/index.html',
     { h:'https://conferences.sigcomm.org/sigcomm/2026/', cy:'2026', loc:'Stockholm, Sweden', cd:'2026-09-07 ~ 09-11', dl:'2026-02-05', n:'已截止' }),
  _c('MobiCom','ACM International Conference on Mobile Computing and Networking','network','A','ACM','http://dblp.uni-trier.de/db/conf/mobicom/',
     { h:'https://www.sigmobile.org/mobicom/2026/', cy:'2026', loc:'Hong Kong', cd:'2026-11-09 ~ 11-13', dl:'2026-03-13', n:'已截止' }),
  _c('INFOCOM','IEEE International Conference on Computer Communications','network','A','IEEE','http://dblp.uni-trier.de/db/conf/infocom/',
     { h:'https://infocom2027.ieee-infocom.org/', cy:'2027', loc:'TBA', cd:'2027-05', dl:'2026-07-31', n:'摘要 7.24 · 全文 7.31' }),
  _c('NSDI',   'Symposium on Network System Design and Implementation','network','A','USENIX','http://dblp.uni-trier.de/db/conf/nsdi/',
     { h:'https://www.usenix.org/conference/nsdi26', cy:'2026', loc:'Renton, USA', cd:'2026-04-13 ~ 04-15', dl:'2025-09-18', n:'已结束' }),

  /* B */
  _c('SenSys', 'ACM Conference on Embedded Networked Sensor Systems','network','B','ACM','http://dblp.uni-trier.de/db/conf/sensys/',
     { h:'https://sensys.acm.org/2026/', cy:'2026', loc:'Beijing, China', cd:'2026-11-04 ~ 11-07', dl:'2026-04-06', n:'已截止' }),
  _c('CoNEXT', 'ACM International Conference on Emerging Networking Experiments and Technologies','network','B','ACM','http://dblp.uni-trier.de/db/conf/conext/'),
  _c('IPSN',   'International Conference on Information Processing in Sensor Networks','network','B','IEEE/ACM','http://dblp.uni-trier.de/db/conf/ipsn/'),
  _c('MobiSys','ACM International Conference on Mobile Systems, Applications, and Services','network','B','ACM','http://dblp.uni-trier.de/db/conf/mobisys/',
     { h:'https://www.sigmobile.org/mobisys/2026/', cy:'2026', loc:'Singapore', cd:'2026-06-15 ~ 06-19', dl:'2025-12-01', n:'已结束' }),
  _c('ICNP',   'IEEE International Conference on Network Protocols','network','B','IEEE','http://dblp.uni-trier.de/db/conf/icnp/'),
  _c('MobiHoc','International Symposium on Theory, Algorithmic Foundations, and Protocol Design for Mobile Networks and Mobile Computing','network','B','IEEE/ACM','http://dblp.uni-trier.de/db/conf/mobihoc/'),
  _c('IWQoS',  'IEEE/ACM International Workshop on Quality of Service','network','B','IEEE','http://dblp.uni-trier.de/db/conf/iwqos/'),
  _c('IMC',    'ACM Internet Measurement Conference','network','B','ACM/USENIX','http://dblp.uni-trier.de/db/conf/imc/',
     { h:'https://www.sigcomm.org/imc-2026/', cy:'2026', loc:'Madrid, Spain', cd:'2026-10-26 ~ 10-28', dl:'2026-05-15', n:'已截止' }),
  _c('NOSSDAV','International Workshop on Network and Operating System Support for Digital Audio and Video','network','B','ACM','http://dblp.uni-trier.de/db/conf/nossdav/'),

  /* C */
  _c('HotNets','ACM The Workshop on Hot Topics in Networks','network','C','ACM','http://dblp.uni-trier.de/db/conf/hotnets/'),
  _c('APNet',  'Asia-Pacific Workshop on Networking','network','C','ACM','https://dblp.org/db/conf/apnet/index.html'),
  _c('GLOBECOM','IEEE Global Communications Conference','network','C','IEEE','http://dblp.uni-trier.de/db/conf/globecom/'),
  _c('ICC',    'IEEE International Conference on Communications','network','C','IEEE','http://dblp.uni-trier.de/db/conf/icc/'),
  _c('LCN',    'IEEE Conference on Local Computer Networks','network','C','IEEE','http://dblp.uni-trier.de/db/conf/lcn/'),
  _c('WCNC',   'IEEE Wireless Communications and Networking Conference','network','C','IEEE','http://dblp.uni-trier.de/db/conf/wcnc/'),

  /* ===== 3 · 网络与信息安全 ===== */
  /* A */
  _c('CCS',    'ACM Conference on Computer and Communications Security','security','A','ACM','http://dblp.uni-trier.de/db/conf/ccs/',
     { h:'https://www.sigsac.org/ccs/CCS2026/', cy:'2026', loc:'Taipei, Taiwan', cd:'2026-10-12 ~ 10-16', dl:'2026-05-08', n:'第二轮截止' }),
  _c('EUROCRYPT','International Conference on the Theory and Applications of Cryptographic Techniques','security','A','Springer','http://dblp.uni-trier.de/db/conf/eurocrypt/',
     { h:'https://eurocrypt.iacr.org/2026/', cy:'2026', loc:'Zagreb, Croatia', cd:'2026-05-24 ~ 05-28', dl:'2025-10-09', n:'已结束' }),
  _c('S&P',    'IEEE Symposium on Security and Privacy','security','A','IEEE','http://dblp.uni-trier.de/db/conf/sp/',
     { h:'https://sp2026.ieee-security.org/', cy:'2026', loc:'San Francisco, USA', cd:'2026-05-18 ~ 05-21', dl:'2025-12-04', n:'已结束' }),
  _c('CRYPTO', 'International Cryptology Conference','security','A','Springer','http://dblp.uni-trier.de/db/conf/crypto/',
     { h:'https://crypto.iacr.org/2026/', cy:'2026', loc:'Santa Barbara, USA', cd:'2026-08-16 ~ 08-20', dl:'2026-02-12', n:'已截止' }),
  _c('USENIX-Security','USENIX Security Symposium','security','A','USENIX','http://dblp.uni-trier.de/db/conf/uss/',
     { h:'https://www.usenix.org/conference/usenixsecurity26', cy:'2026', loc:'Boston, USA', cd:'2026-08-12 ~ 08-14', dl:'2026-06-04', n:'冬轮 6.4 即将截稿' }),
  _c('NDSS',   'Network and Distributed System Security Symposium','security','A','ISOC','http://dblp.uni-trier.de/db/conf/ndss/',
     { h:'https://www.ndss-symposium.org/ndss2027/', cy:'2027', loc:'San Diego, USA', cd:'2027-02-22 ~ 02-25', dl:'2026-07-17', n:'夏轮截稿' }),

  /* B */
  _c('ACSAC',  'Annual Computer Security Applications Conference','security','B','IEEE','http://dblp.uni-trier.de/db/conf/ancs/'),
  _c('ASIACRYPT','Annual International Conference on the Theory and Application of Cryptology and Information Security','security','B','Springer','http://dblp.uni-trier.de/db/conf/apnoms/',
     { h:'https://asiacrypt.iacr.org/2026/', cy:'2026', loc:'Mumbai, India', cd:'2026-12-07 ~ 12-11', dl:'2026-05-29', n:'已截止' }),
  _c('ESORICS','European Symposium on Research in Computer Security','security','B','Springer','http://dblp.uni-trier.de/db/conf/forte/',
     { h:'https://esorics2026.org/', cy:'2026', loc:'Bucharest, Romania', cd:'2026-09-14 ~ 09-18', dl:'2026-04-09', n:'已截止' }),
  _c('FSE',    'Fast Software Encryption','security','B','Springer','http://dblp.uni-trier.de/db/conf/lcn/'),
  _c('CSFW',   'IEEE Computer Security Foundations Workshop','security','B','IEEE','http://dblp.uni-trier.de/db/conf/globecom/'),
  _c('SRDS',   'IEEE International Symposium on Reliable Distributed Systems','security','B','IEEE','http://dblp.uni-trier.de/db/conf/icc/'),
  _c('CHES',   'International Conference on Cryptographic Hardware and Embedded Systems','security','B','Springer','http://dblp.uni-trier.de/db/conf/icccn/'),
  _c('DSN',    'International Conference on Dependable Systems and Networks','security','B','IEEE/IFIP','http://dblp.uni-trier.de/db/conf/mass/index.html'),
  _c('RAID',   'International Symposium on Recent Advances in Intrusion Detection','security','B','Springer','http://dblp.uni-trier.de/db/conf/p2p/'),
  _c('PKC',    'International Workshop on Practice and Theory in Public Key Cryptography','security','B','Springer','http://dblp.uni-trier.de/db/conf/ipccc/'),
  _c('TCC',    'Theory of Cryptography Conference','security','B','Springer','http://dblp.uni-trier.de/db/conf/wowmom/'),

  /* C */
  _c('AsiaCCS','ACM Asia Conference on Computer and Communications Security','security','C','ACM','http://dblp.uni-trier.de/db/conf/icc/'),
  _c('ACNS',   'International Conference on Applied Cryptography and Network Security','security','C','Springer','http://dblp.uni-trier.de/db/conf/globecom/'),
  _c('PETS',   'Privacy Enhancing Technologies Symposium','security','C','Springer','http://dblp.uni-trier.de/db/conf/pet/'),
  _c('EuroS&P','IEEE European Symposium on Security and Privacy','security','C','IEEE','https://dblp.org/db/conf/eurosp/index.html'),
  _c('Inscrypt','International Conference on Information Security and Cryptology','security','C','Springer','https://dblp.org/db/conf/cisc/index.html'),
  _c('SOUPS',  'Symposium On Usable Privacy and Security','security','C','USENIX','http://dblp.uni-trier.de/db/conf/soups/'),
  _c('PAM',    'Passive and Active Measurement Conference','security','C','Springer','http://dblp.uni-trier.de/db/conf/pam/'),
  _c('TrustCom','IEEE International Conference on Trust, Security and Privacy in Computing and Communications','security','C','IEEE','http://dblp.uni-trier.de/db/conf/iscc/'),

  /* ===== 4 · 软件工程 / 系统软件 / 程序设计语言 ===== */
  /* A */
  _c('PLDI',   'ACM SIGPLAN Conference on Programming Language Design and Implementation','se','A','ACM','http://dblp.uni-trier.de/db/conf/pldi/',
     { h:'https://pldi26.sigplan.org/', cy:'2026', loc:'Seattle, USA', cd:'2026-06-15 ~ 06-19', dl:'2025-11-13', n:'已结束' }),
  _c('POPL',   'ACM SIGPLAN-SIGACT Symposium on Principles of Programming Languages','se','A','ACM','http://dblp.uni-trier.de/db/conf/popl/',
     { h:'https://popl27.sigplan.org/', cy:'2027', loc:'TBA', cd:'2027-01', dl:'2026-07-09', n:'夏轮 7.9 截稿' }),
  _c('FSE',    'ACM International Conference on the Foundations of Software Engineering','se','A','ACM','http://dblp.uni-trier.de/db/conf/sigsoft/',
     { h:'https://conf.researchr.org/home/fse-2026', cy:'2026', loc:'Honolulu, USA', cd:'2026-06-22 ~ 06-26', dl:'2025-09-25', n:'已结束 · 多档' }),
  _c('SOSP',   'ACM Symposium on Operating Systems Principles','se','A','ACM','http://dblp.uni-trier.de/db/conf/sosp/',
     { h:'https://sigops.org/s/conferences/sosp/2026/', cy:'2026', loc:'Seoul, Korea', cd:'2026-10-26 ~ 10-29', dl:'2026-04-17', n:'已截止' }),
  _c('OOPSLA', 'Conference on Object-Oriented Programming Systems, Languages, and Applications','se','A','ACM','http://dblp.uni-trier.de/db/conf/oopsla/',
     { h:'https://2026.splashcon.org/', cy:'2026', loc:'Singapore', cd:'2026-10-19 ~ 10-23', dl:'2026-04-16', n:'秋轮已截止' }),
  _c('ASE',    'International Conference on Automated Software Engineering','se','A','IEEE/ACM','http://dblp.uni-trier.de/db/conf/kbse/',
     { h:'https://conf.researchr.org/home/ase-2026', cy:'2026', loc:'Seoul, Korea', cd:'2026-11-08 ~ 11-12', dl:'2026-05-08', n:'已截止' }),
  _c('ICSE',   'International Conference on Software Engineering','se','A','IEEE/ACM','http://dblp.uni-trier.de/db/conf/icse/',
     { h:'https://conf.researchr.org/home/icse-2027', cy:'2027', loc:'Rio de Janeiro, Brazil', cd:'2027-05-23 ~ 05-29', dl:'2026-07-31', n:'第一轮截止' }),
  _c('ISSTA',  'International Symposium on Software Testing and Analysis','se','A','ACM','http://dblp.uni-trier.de/db/conf/issta/',
     { h:'https://conf.researchr.org/home/issta-2026', cy:'2026', loc:'Tokyo, Japan', cd:'2026-09-21 ~ 09-25', dl:'2025-12-12', n:'已截止' }),
  _c('OSDI',   'USENIX Symposium on Operating Systems Design and Implementation','se','A','USENIX','http://dblp.uni-trier.de/db/conf/osdi/',
     { h:'https://www.usenix.org/conference/osdi26', cy:'2026', loc:'Boston, USA', cd:'2026-07-08 ~ 07-10', dl:'2025-12-04', n:'已截止' }),
  _c('FM',     'International Symposium on Formal Methods','se','A','FME','http://dblp.uni-trier.de/db/conf/fm/'),

  /* B */
  _c('ECOOP',  'European Conference on Object-Oriented Programming','se','B','AITO','http://dblp.uni-trier.de/db/conf/pldi/'),
  _c('ETAPS',  'European Joint Conferences on Theory and Practice of Software','se','B','Springer','http://dblp.uni-trier.de/db/conf/popl/'),
  _c('ICPC',   'IEEE International Conference on Program Comprehension','se','B','IEEE','http://dblp.uni-trier.de/db/conf/sigsoft/'),
  _c('RE',     'IEEE International Requirements Engineering Conference','se','B','IEEE','http://dblp.uni-trier.de/db/conf/sosp/'),
  _c('ICFP',   'ACM SIGPLAN International Conference on Function Programming','se','B','ACM','http://dblp.uni-trier.de/db/conf/kbse/'),
  _c('SANER',  'IEEE International Conference on Software Analysis, Evolution, and Reengineering','se','B','IEEE','http://dblp.uni-trier.de/db/conf/wcre/'),
  _c('ICSME',  'International Conference on Software Maintenance and Evolution','se','B','IEEE','http://dblp.uni-trier.de/db/conf/icsm/'),
  _c('Middleware','International Middleware Conference','se','B','ACM/IFIP/USENIX','http://dblp.uni-trier.de/db/conf/middleware/'),
  _c('ICWS',   'IEEE International Conference on Web Services','se','B','IEEE','http://dblp.uni-trier.de/db/conf/icws/'),
  _c('SAS',    'International Static Analysis Symposium','se','B','Springer','http://dblp.uni-trier.de/db/conf/sas/'),
  _c('ISSRE',  'IEEE International Symposium on Software Reliability Engineering','se','B','IEEE','http://dblp.uni-trier.de/db/conf/issre/'),
  _c('HotOS',  'USENIX Workshop on Hot Topics in Operating Systems','se','B','USENIX','http://dblp.uni-trier.de/db/conf/hotos/'),
  _c('CC',     'International Conference on Compiler Construction','se','B','ACM','https://dblp.uni-trier.de/db/conf/cc/index.html'),
  _c('MoDELS', 'ACM/IEEE International Conference on Model Driven Engineering Languages and Systems','se','B','IEEE/ACM','http://dblp.uni-trier.de/db/conf/issta/'),

  /* C */
  _c('APSEC',  'Asia-Pacific Software Engineering Conference','se','C','IEEE','http://dblp.uni-trier.de/db/conf/apsec/'),
  _c('APLAS',  'Asian Symposium on Programming Languages and Systems','se','C','Springer','http://dblp.uni-trier.de/db/conf/aplas/'),
  _c('ICST',   'IEEE International Conference on Software Testing, Verification and Validation','se','C','IEEE','http://dblp.uni-trier.de/db/conf/icst/'),
  _c('MSR',    'Mining Software Repositories','se','C','IEEE/ACM','http://dblp.uni-trier.de/db/conf/msr/'),
  _c('COMPSAC','International Computer Software and Applications Conference','se','C','IEEE','http://dblp.uni-trier.de/db/conf/compsac/'),
  _c('Internetware','Asia-Pacific Symposium on Internetware','se','C','ACM','https://dblp.org/db/conf/internetware/index.html'),

  /* ===== 5 · 数据库 / 数据挖掘 / 内容检索 ===== */
  /* A */
  _c('SIGMOD', 'ACM SIGMOD Conference','db','A','ACM','http://dblp.uni-trier.de/db/conf/sigmod/',
     { h:'https://2026.sigmod.org/', cy:'2026', loc:'Bangalore, India', cd:'2026-06-14 ~ 06-19', dl:'2025-10-15', n:'已结束' }),
  _c('SIGKDD', 'ACM SIGKDD Conference on Knowledge Discovery and Data Mining','db','A','ACM','http://dblp.uni-trier.de/db/conf/kdd/',
     { h:'https://kdd2026.kdd.org/', cy:'2026', loc:'Toronto, Canada', cd:'2026-08-09 ~ 08-13', dl:'2026-02-10', n:'已截止' }),
  _c('ICDE',   'IEEE International Conference on Data Engineering','db','A','IEEE','http://dblp.uni-trier.de/db/conf/icde/',
     { h:'https://icde2027.dbgroup.cs.tsinghua.edu.cn/', cy:'2027', loc:'Beijing, China', cd:'2027-04', dl:'2026-07-15', n:'第二轮 7.15 截稿' }),
  _c('SIGIR',  'International ACM SIGIR Conference on Research and Development in Information Retrieval','db','A','ACM','http://dblp.uni-trier.de/db/conf/sigir/',
     { h:'https://sigir2026.org/', cy:'2026', loc:'Padua, Italy', cd:'2026-07-12 ~ 07-16', dl:'2026-01-22', n:'已截止' }),
  _c('VLDB',   'International Conference on Very Large Data Bases','db','A','Morgan Kaufmann/ACM','http://dblp.uni-trier.de/db/conf/vldb/',
     { h:'https://vldb.org/2026/', cy:'2026', loc:'Tokyo, Japan', cd:'2026-08-31 ~ 09-04', dl:'2026-06-01', n:'滚动评审 · 月度截止' }),

  /* B */
  _c('CIKM',   'ACM International Conference on Information and Knowledge Management','db','B','ACM','http://dblp.uni-trier.de/db/journals/tkdd/',
     { h:'https://cikm2026.org/', cy:'2026', loc:'Atlanta, USA', cd:'2026-10-19 ~ 10-23', dl:'2026-05-22', n:'已截止' }),
  _c('WSDM',   'ACM International Conference on Web Search and Data Mining','db','B','ACM','http://dblp.uni-trier.de/db/journals/tweb/',
     { h:'https://www.wsdm-conference.org/2026/', cy:'2026', loc:'Phuket, Thailand', cd:'2026-03-09 ~ 03-13', dl:'2025-08-12', n:'已结束' }),
  _c('PODS',   'ACM SIGMOD-SIGACT-SIGAI Symposium on Principles of Database Systems','db','B','ACM','http://dblp.uni-trier.de/db/journals/aei/'),
  _c('DASFAA', 'International Conference on Database Systems for Advanced Applications','db','B','Springer','http://dblp.uni-trier.de/db/journals/dke/'),
  _c('ECML-PKDD','European Conference on Machine Learning and Principles and Practice of Knowledge Discovery in Databases','db','B','Springer','http://dblp.uni-trier.de/db/journals/datamine/'),
  _c('ISWC',   'IEEE International Semantic Web Conference','db','B','IEEE','http://dblp.uni-trier.de/db/journals/ejis/'),
  _c('ICDM',   'IEEE International Conference on Data Mining','db','B','IEEE','http://dblp.uni-trier.de/db/journals/geoinformatica/',
     { h:'https://icdm2026.icdm.org/', cy:'2026', loc:'Seoul, Korea', cd:'2026-12-07 ~ 12-10', dl:'2026-06-05', n:'即将截稿' }),
  _c('EDBT',   'International Conference on Extending Database Technology','db','B','Springer','http://dblp.uni-trier.de/db/journals/isci/'),
  _c('CIDR',   'Conference on Innovative Data Systems Research','db','B','Online Proceeding','http://dblp.uni-trier.de/db/journals/is/'),
  _c('SDM',    'SIAM International Conference on Data Mining','db','B','SIAM','http://dblp.uni-trier.de/db/journals/jasis/'),
  _c('RecSys', 'ACM Conference on Recommender Systems','db','B','ACM','http://dblp.uni-trier.de/db/journals/ws/'),

  /* C */
  _c('PAKDD',  'Pacific-Asia Conference on Knowledge Discovery and Data Mining','db','C','Springer','http://dblp.uni-trier.de/db/conf/pakdd/'),
  _c('ECIR',   'European Conference on Information Retrieval','db','C','Springer','http://dblp.uni-trier.de/db/conf/ecir/'),
  _c('APWeb',  'Asia Pacific Web Conference','db','C','Springer','http://dblp.uni-trier.de/db/conf/apweb/'),
  _c('DEXA',   'International Conference on Database and Expert System Applications','db','C','Springer','http://dblp.uni-trier.de/db/conf/dexa/'),
  _c('WAIM',   'International Conference on Web Age Information Management','db','C','Springer','http://dblp.uni-trier.de/db/conf/waim/'),
  _c('WISE',   'Web Information Systems Engineering Conference','db','B','Springer','http://dblp.uni-trier.de/db/conf/wise/'),

  /* ===== 6 · 计算机科学理论 ===== */
  /* A */
  _c('STOC',   'ACM Symposium on the Theory of Computing','theory','A','ACM','http://dblp.uni-trier.de/db/conf/stoc/',
     { h:'https://acm-stoc.org/stoc2026/', cy:'2026', loc:'Prague, Czechia', cd:'2026-06-22 ~ 06-26', dl:'2025-11-04', n:'已结束' }),
  _c('SODA',   'ACM-SIAM Symposium on Discrete Algorithms','theory','A','SIAM','http://dblp.uni-trier.de/db/conf/soda/',
     { h:'https://www.siam.org/conferences/cm/conference/soda27', cy:'2027', loc:'TBA', cd:'2027-01', dl:'2026-07-09', n:'摘要 7.2 · 全文 7.9' }),
  _c('CAV',    'International Conference on Computer Aided Verification','theory','A','Springer','http://dblp.uni-trier.de/db/conf/cav/'),
  _c('FOCS',   'IEEE Annual Symposium on Foundations of Computer Science','theory','A','IEEE','http://dblp.uni-trier.de/db/conf/focs/',
     { h:'https://focs.computer.org/2026/', cy:'2026', loc:'Sydney, Australia', cd:'2026-10-19 ~ 10-22', dl:'2026-04-08', n:'已截止' }),
  _c('LICS',   'ACM/IEEE Symposium on Logic in Computer Science','theory','A','IEEE','http://dblp.uni-trier.de/db/conf/lics/'),

  /* B */
  _c('SoCG',   'International Symposium on Computational Geometry','theory','B','ACM','http://dblp.uni-trier.de/db/conf/compgeom/'),
  _c('ESA',    'European Symposium on Algorithms','theory','B','Springer','http://dblp.uni-trier.de/db/conf/esa/'),
  _c('CCC',    'Conference on Computational Complexity','theory','B','IEEE','http://dblp.uni-trier.de/db/conf/coco/'),
  _c('ICALP',  'International Colloquium on Automata, Languages and Programming','theory','B','Springer','http://dblp.uni-trier.de/db/conf/icalp/'),
  _c('CADE',   'Conference on Automated Deduction','theory','B','Springer','http://dblp.uni-trier.de/db/conf/cade/'),
  _c('CONCUR', 'International Conference on Concurrency Theory','theory','B','Springer','http://dblp.uni-trier.de/db/conf/concur/'),
  _c('SAT',    'International Conference on Theory and Applications of Satisfiability Testing','theory','B','Springer','http://dblp.uni-trier.de/db/conf/sat/'),
  _c('HSCC',   'International Conference on Hybrid Systems: Computation and Control','theory','B','Springer/ACM','http://dblp.uni-trier.de/db/conf/hybrid/'),

  /* C */
  _c('CSL',    'Computer Science Logic','theory','C','Springer','http://dblp.uni-trier.de/db/journals/acta/'),
  _c('ISAAC',  'International Symposium on Algorithms and Computation','theory','C','Springer','http://dblp.uni-trier.de/db/journals/jsyml/'),
  _c('STACS',  'Symposium on Theoretical Aspects of Computer Science','theory','C','Springer','http://dblp.uni-trier.de/db/journals/siamdm/'),

  /* ===== 7 · 计算机图形学与多媒体 ===== */
  /* A */
  _c('ACM MM', 'ACM International Conference on Multimedia','graphics','A','ACM','http://dblp.uni-trier.de/db/conf/mm/',
     { h:'https://2026.acmmm.org/', cy:'2026', loc:'Dublin, Ireland', cd:'2026-10-26 ~ 10-30', dl:'2026-04-12', n:'已截止' }),
  _c('SIGGRAPH','ACM Special Interest Group on Computer Graphics','graphics','A','ACM','http://dblp.uni-trier.de/db/conf/siggraph/index.html',
     { h:'https://s2026.siggraph.org/', cy:'2026', loc:'Vancouver, Canada', cd:'2026-08-09 ~ 08-13', dl:'2026-01-21', n:'已结束' }),
  _c('VR',     'IEEE Virtual Reality','graphics','A','IEEE','http://dblp.uni-trier.de/db/conf/vr/',
     { h:'https://ieeevr.org/2027/', cy:'2027', loc:'TBA', cd:'2027-03', dl:'2026-09-10', n:'秋档截稿' }),
  _c('IEEE VIS','IEEE Visualization Conference','graphics','A','IEEE','http://dblp.uni-trier.de/db/conf/visualization/index.html',
     { h:'https://ieeevis.org/year/2026/', cy:'2026', loc:'Vienna, Austria', cd:'2026-10-25 ~ 10-30', dl:'2026-03-31', n:'已截止' }),

  /* B */
  _c('ICMR',   'ACM SIGMM International Conference on Multimedia Retrieval','graphics','B','ACM','http://dblp.uni-trier.de/db/conf/mir/'),
  _c('I3D',    'ACM SIGGRAPH Symposium on Interactive 3D Graphics and Games','graphics','B','ACM','http://dblp.uni-trier.de/db/conf/si3d/'),
  _c('SCA',    'ACM SIGGRAPH/Eurographics Symposium on Computer Animation','graphics','B','ACM','http://dblp.uni-trier.de/db/conf/sca/index.html'),
  _c('DCC',    'Data Compression Conference','graphics','B','IEEE','http://dblp.uni-trier.de/db/conf/dcc/'),
  _c('Eurographics','Annual Conference of the European Association for Computer Graphics','graphics','B','Wiley/Blackwell','http://dblp.uni-trier.de/db/conf/eurographics/'),
  _c('EuroVis','Eurographics Conference on Visualization','graphics','B','ACM','http://dblp.uni-trier.de/db/conf/vissym/'),
  _c('ICASSP', 'IEEE International Conference on Acoustics, Speech and Signal Processing','graphics','B','IEEE','http://dblp.uni-trier.de/db/conf/icassp/',
     { h:'https://2027.ieeeicassp.org/', cy:'2027', loc:'Barcelona, Spain', cd:'2027-05-04 ~ 05-08', dl:'2026-09-08', n:'秋档截稿' }),
  _c('ICME',   'IEEE International Conference on Multimedia & Expo','graphics','B','IEEE','http://dblp.uni-trier.de/db/conf/icmcs/'),
  _c('ISMAR',  'International Symposium on Mixed and Augmented Reality','graphics','B','IEEE/ACM','http://dblp.uni-trier.de/db/conf/ismar/'),
  _c('PG',     'Pacific Conference on Computer Graphics and Applications','graphics','B','Wiley/Blackwell','http://dblp.uni-trier.de/db/conf/pg/index.html'),
  _c('INTERSPEECH','Conference of the International Speech Communication Association','graphics','B','ISCA','http://dblp.uni-trier.de/db/conf/interspeech/index.html',
     { h:'https://interspeech2026.org/', cy:'2026', loc:'Rotterdam, Netherlands', cd:'2026-09-06 ~ 09-10', dl:'2026-02-19', n:'已截止' }),

  /* C */
  _c('VRST',   'ACM Symposium on Virtual Reality Software and Technology','graphics','C','ACM','http://dblp2.uni-trier.de/db/conf/vrst/'),
  _c('CGI',    'Computer Graphics International','graphics','C','Springer','http://dblp.uni-trier.de/db/conf/cgi/'),
  _c('PacificVis','IEEE Pacific Visualization Symposium','graphics','C','IEEE','http://dblp.uni-trier.de/db/conf/apvis/'),
  _c('3DV',    'International Conference on 3D Vision','graphics','C','IEEE','https://dblp.uni-trier.de/db/conf/3dim/'),
  _c('ICIP',   'IEEE International Conference on Image Processing','graphics','C','IEEE','http://dblp.uni-trier.de/db/conf/icip/'),
  _c('MMM',    'International Conference on Multimedia Modeling','graphics','C','Springer','http://dblp.uni-trier.de/db/conf/mmm/index.html'),
  _c('PRCV',   'Chinese Conference on Pattern Recognition and Computer Vision','graphics','C','Springer','https://dblp.org/db/conf/prcv/index.html'),

  /* ===== 8 · 人工智能 ===== */
  /* A */
  _c('AAAI',   'AAAI Conference on Artificial Intelligence','ai','A','AAAI','http://dblp.uni-trier.de/db/conf/aaai/',
     { h:'https://aaai.org/conference/aaai/aaai-27/', cy:'2027', loc:'San Francisco, USA', cd:'2027-01-21 ~ 01-28', dl:'2026-08-11', n:'摘要 8.4 · 全文 8.11', sub:9862, acc:2342, rate:23.8, sy:2024 }),
  _c('NeurIPS','Conference on Neural Information Processing Systems','ai','A','MIT Press','http://dblp.uni-trier.de/db/conf/nips/',
     { h:'https://neurips.cc/Conferences/2026', cy:'2026', loc:'San Diego, USA', cd:'2026-12-07 ~ 12-12', dl:'2026-05-15', n:'已截止', sub:12343, acc:3218, rate:26.1, sy:2023 }),
  _c('ACL',    'Annual Meeting of the Association for Computational Linguistics','ai','A','ACL','http://dblp.uni-trier.de/db/conf/acl/',
     { h:'https://2026.aclweb.org/', cy:'2026', loc:'Vienna, Austria', cd:'2026-07-26 ~ 08-01', dl:'2026-02-15', n:'ARR 滚动' }),
  _c('CVPR',   'IEEE/CVF Computer Vision and Pattern Recognition Conference','ai','A','IEEE','http://dblp.uni-trier.de/db/conf/cvpr/',
     { h:'https://cvpr.thecvf.com/Conferences/2026', cy:'2026', loc:'Nashville, USA', cd:'2026-06-21 ~ 06-26', dl:'2025-11-14', n:'已结束', sub:11532, acc:2719, rate:23.6, sy:2024 }),
  _c('ICCV',   'International Conference on Computer Vision','ai','A','IEEE','http://dblp.uni-trier.de/db/conf/iccv/',
     { h:'https://iccv.thecvf.com/Conferences/2027', cy:'2027', loc:'TBA', cd:'2027-10', dl:'2027-03-08', n:'隔年举办', sub:8068, acc:2161, rate:26.8, sy:2023 }),
  _c('ICML',   'International Conference on Machine Learning','ai','A','ACM','http://dblp.uni-trier.de/db/conf/icml/',
     { h:'https://icml.cc/Conferences/2026', cy:'2026', loc:'Vancouver, Canada', cd:'2026-07-19 ~ 07-25', dl:'2026-01-30', n:'已截止', sub:9473, acc:2610, rate:27.5, sy:2024 }),
  _c('ICLR',   'International Conference on Learning Representations','ai','A','OpenReview','https://dblp.uni-trier.de/db/conf/iclr/index.html',
     { h:'https://iclr.cc/Conferences/2027', cy:'2027', loc:'TBA', cd:'2027-04', dl:'2026-09-25', n:'秋档截稿', sub:7262, acc:2260, rate:31.1, sy:2024 }),

  /* B */
  _c('COLT',   'Annual Conference on Computational Learning Theory','ai','B','Springer','http://dblp.uni-trier.de/db/conf/colt/'),
  _c('EMNLP',  'Conference on Empirical Methods in Natural Language Processing','ai','B','ACL','http://dblp.uni-trier.de/db/conf/emnlp/',
     { h:'https://2026.emnlp.org/', cy:'2026', loc:'Suzhou, China', cd:'2026-11-04 ~ 11-09', dl:'2026-06-15', n:'即将截稿' }),
  _c('ECAI',   'European Conference on Artificial Intelligence','ai','B','IOS Press','http://dblp.uni-trier.de/db/conf/ecai/'),
  _c('ECCV',   'European Conference on Computer Vision','ai','B','Springer','http://dblp.uni-trier.de/db/conf/eccv/',
     { h:'https://eccv2026.ecva.net/', cy:'2026', loc:'Malmö, Sweden', cd:'2026-09-21 ~ 09-26', dl:'2026-03-07', n:'已截止' }),
  _c('ICRA',   'IEEE International Conference on Robotics and Automation','ai','B','IEEE','http://dblp.uni-trier.de/db/conf/icra/',
     { h:'https://2026.ieee-icra.org/', cy:'2026', loc:'Vienna, Austria', cd:'2026-05-31 ~ 06-04', dl:'2025-09-15', n:'已结束' }),
  _c('ICAPS',  'International Conference on Automated Planning and Scheduling','ai','B','AAAI','http://dblp.uni-trier.de/db/conf/aips/'),
  _c('UAI',    'Conference on Uncertainty in Artificial Intelligence','ai','B','AUAI','http://dblp.uni-trier.de/db/conf/uai/'),
  _c('COLING', 'International Conference on Computational Linguistics','ai','B','ICCL','http://dblp.uni-trier.de/db/conf/coling/'),
  _c('KR',     'International Conference on Principles of Knowledge Representation and Reasoning','ai','B','Morgan Kaufmann','http://dblp.uni-trier.de/db/conf/kr/'),
  _c('AAMAS',  'International Joint Conference on Autonomous Agents and Multi-agent Systems','ai','B','Springer','http://dblp.uni-trier.de/db/conf/atal/index.html'),
  _c('IJCAI',  'International Joint Conference on Artificial Intelligence','ai','B','Morgan Kaufmann','http://dblp.uni-trier.de/db/conf/ijcai/',
     { h:'https://2026.ijcai.org/', cy:'2026', loc:'Montréal, Canada', cd:'2026-08-15 ~ 08-21', dl:'2026-01-16', n:'已截止', rate:14, sy:2024 }),
  _c('NAACL',  'North American Chapter of the Association for Computational Linguistics','ai','B','ACL','http://dblp.uni-trier.de/db/conf/naacl/'),

  /* C */
  _c('AISTATS','International Conference on Artificial Intelligence and Statistics','ai','C','JMLR','http://dblp.uni-trier.de/db/conf/aistats/'),
  _c('ACCV',   'Asian Conference on Computer Vision','ai','C','Springer','http://dblp.uni-trier.de/db/conf/accv/'),
  _c('ACML',   'Asian Conference on Machine Learning','ai','C','JMLR','http://dblp.uni-trier.de/db/conf/acml/'),
  _c('BMVC',   'British Machine Vision Conference','ai','C','BMVA','http://dblp.uni-trier.de/db/conf/bmvc/'),
  _c('NLPCC',  'CCF International Conference on Natural Language Processing and Chinese Computing','ai','C','Springer','https://dblp.uni-trier.de/db/conf/nlpcc/'),
  _c('CoNLL',  'Conference on Computational Natural Language Learning','ai','C','ACL','http://dblp.uni-trier.de/db/conf/conll'),
  _c('IROS',   'IEEE\\RSJ International Conference on Intelligent Robots and Systems','ai','C','IEEE','http://dblp.uni-trier.de/db/conf/iros/',
     { h:'https://www.iros2026.org/', cy:'2026', loc:'Hangzhou, China', cd:'2026-10-19 ~ 10-23', dl:'2026-03-01', n:'已截止' }),
  _c('ICPR',   'International Conference on Pattern Recognition','ai','C','IEEE','http://dblp.uni-trier.de/db/conf/icpr/'),
  _c('IJCNN',  'International Joint Conference on Neural Networks','ai','C','IEEE','http://dblp.uni-trier.de/db/conf/ijcnn/'),
  _c('PRICAI', 'Pacific Rim International Conference on Artificial Intelligence','ai','C','Springer','http://dblp.uni-trier.de/db/conf/pricai/'),
  _c('ICDAR',  'International Conference on Document Analysis and Recognition','ai','C','IEEE','http://dblp.uni-trier.de/db/conf/icdar/'),
  _c('ICONIP', 'International Conference on Neural Information Processing','ai','C','Springer','http://dblp.uni-trier.de/db/conf/iconip/'),

  /* ===== 9 · 人机交互 / 普适计算 ===== */
  /* A */
  _c('CSCW',   'ACM Conference On Computer-Supported Cooperative Work And Social Computing','hci','A','ACM','http://dblp.uni-trier.de/db/conf/cscw',
     { h:'https://cscw.acm.org/2026/', cy:'2026', loc:'Vancouver, Canada', cd:'2026-11-07 ~ 11-11', dl:'2026-07-15', n:'冬轮 7.15 截稿' }),
  _c('CHI',    'ACM Conference on Human Factors in Computing Systems','hci','A','ACM','http://dblp.uni-trier.de/db/conf/chi',
     { h:'https://chi2027.acm.org/', cy:'2027', loc:'Yokohama, Japan', cd:'2027-04', dl:'2026-09-10', n:'秋档截稿' }),
  _c('UbiComp','ACM international joint conference on Pervasive and Ubiquitous Computing','hci','A','ACM','https://dblp.uni-trier.de/db/conf/huc/',
     { h:'https://ubicomp.org/ubicomp-issn-2026/', cy:'2026', loc:'Melbourne, Australia', cd:'2026-09-21 ~ 09-25', dl:'2026-05-15', n:'已截止' }),
  _c('UIST',   'ACM Symposium on User Interface Software and Technology','hci','A','ACM','http://dblp.uni-trier.de/db/conf/uist/',
     { h:'https://uist.acm.org/2026/', cy:'2026', loc:'Pittsburgh, USA', cd:'2026-09-27 ~ 10-01', dl:'2026-04-02', n:'已截止' }),

  /* B */
  _c('IUI',    'ACM International Conference on Intelligent User Interfaces','hci','B','ACM','http://dblp.uni-trier.de/db/conf/iui/'),
  _c('GROUP',  'ACM International Conference on Supporting Group Work','hci','B','ACM','http://dblp.uni-trier.de/db/conf/group/'),
  _c('PERCOM', 'IEEE International Conference on Pervasive Computing and Communications','hci','B','IEEE','http://dblp.uni-trier.de/db/conf/percom/'),
  _c('MobileHCI','ACM International Conference on Mobile Human-Computer Interaction','hci','B','ACM','http://dblp.uni-trier.de/db/conf/mhci/'),
  _c('ICWSM',  'The International AAAI Conference on Web and Social Media','hci','B','AAAI','https://dblp.org/db/conf/icwsm/index.html'),
  _c('ECSCW',  'European Conference on Computer Supported Cooperative Work','hci','B','Springer','http://dblp.uni-trier.de/db/conf/ecscw/'),
  _c('ISS',    'ACM International Conference on Interactive Surfaces and Spaces','hci','B','ACM','http://dblp.uni-trier.de/db/conf/tabletop/'),

  /* C */
  _c('DIS',    'ACM SIGCHI Conference on Designing Interactive Systems','hci','C','ACM','http://dblp.uni-trier.de/db/conf/ACMdis'),
  _c('ICMI',   'ACM International Conference on Multimodal Interaction','hci','C','ACM','http://dblp.uni-trier.de/db/conf/icmi/'),
  _c('INTERACT','International Conference on Human-Computer Interaction of IFIP','hci','C','IFIP','http://dblp.uni-trier.de/db/conf/interact/'),
  _c('ASSETS', 'International ACM SIGACCESS Conference on Computers and Accessibility','hci','C','ACM','http://dblp.uni-trier.de/db/conf/assets'),
  _c('CSCWD',  'International Conference on Computer Supported Cooperative Work in Design','hci','C','Springer','http://dblp.uni-trier.de/db/conf/cscwd/'),

  /* ===== 10 · 交叉 / 综合 / 新兴 ===== */
  /* A */
  _c('WWW',    'International World Wide Web Conference','misc','A','ACM','http://dblp.uni-trier.de/db/conf/www/',
     { h:'https://www2026.thewebconf.org/', cy:'2026', loc:'Dubai, UAE', cd:'2026-04-13 ~ 04-17', dl:'2025-10-13', n:'已结束' }),
  _c('RTSS',   'IEEE Real-Time Systems Symposium','misc','A','IEEE','http://dblp.uni-trier.de/db/conf/rtss/',
     { h:'https://2026.rtss.org/', cy:'2026', loc:'Sydney, Australia', cd:'2026-12-01 ~ 12-04', dl:'2026-05-15', n:'已截止' }),

  /* B */
  _c('MICCAI', 'International Conference on Medical Image Computing and Computer-Assisted Intervention','misc','B','Springer','https://dblp.org/db/conf/miccai/index.html',
     { h:'https://conferences.miccai.org/2026/', cy:'2026', loc:'Daejeon, Korea', cd:'2026-09-21 ~ 09-25', dl:'2026-03-02', n:'已截止' }),
  _c('CogSci', 'Annual Meeting of the Cognitive Science Society','misc','B','Psychology Press','https://dblp.uni-trier.de/db/conf/cogsci/'),
  _c('BIBM',   'IEEE International Conference on Bioinformatics and Biomedicine','misc','B','IEEE','http://dblp.uni-trier.de/db/conf/bibm/'),
  _c('EMSOFT', 'International Conference on Embedded Software','misc','B','IEEE/ACM/IFIP','http://dblp.uni-trier.de/db/conf/emsoft/'),
  _c('ISMB',   'International conference on Intelligent Systems for Molecular Biology','misc','B','Oxford Journals','https://dblp.org/db/conf/ismb/index.html'),
  _c('RECOMB', 'Annual International Conference on Research in Computational Molecular Biology','misc','B','Springer','http://dblp.uni-trier.de/db/conf/recomb/'),
  _c('WINE',   'Conference on Web and Internet Economics','misc','B','Springer','https://dblp.org/db/conf/wine/index.html'),

  /* C */
  _c('IEEE BigData','IEEE International Conference on Big Data','misc','C','IEEE','https://dblp.uni-trier.de/db/conf/bigdataconf/'),
  _c('IEEE CLOUD','IEEE International Conference on Cloud Computing','misc','C','IEEE','http://dblp.uni-trier.de/db/conf/IEEEcloud/'),
  _c('APBC',   'Asia Pacific Bioinformatics Conference','misc','C','BioMed Central','http://dblp.uni-trier.de/db/conf/apbc/'),
  _c('SMC',    'IEEE International Conference on Systems, Man, and Cybernetics','misc','C','IEEE','https://dblp.uni-trier.de/db/conf/smc/'),
  _c('SIGSPATIAL','ACM Special Interest Group on Spatial Information','misc','C','ACM','https://dblp.org/db/journals/sigspatial/index.html'),
  _c('ICIC',   'International Conference on Intelligent Computing','misc','C','Springer-Nature','https://dblp.org/db/conf/icic/index.html'),
  _c('AFT',    'Advances in Financial Technologies','misc','C','Springer','https://dblp.uni-trier.de/db/conf/aft/index.html'),
];

/* Add an internal id to each entry */
CCF_CONFS.forEach((c, i) => { c.id = `${c.field}-${c.tier}-${c.abbr.replace(/\W+/g, '').toLowerCase()}-${i}`; });

window.CCF_FIELDS = CCF_FIELDS;
window.CCF_CONFS  = CCF_CONFS;
