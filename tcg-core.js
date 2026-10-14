// Shared NOXCAT TCG card data and card-face renderer (generated from the pack page by build_core.py)
window.NOX = (function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // ───────── Data ─────────
  const TYPE = {
    grass: { n: '草', name: '草木', c: '#7fd858' },
    fire:  { n: '火', name: '火焰', c: '#ff7b47' },
    water: { n: '水', name: '水流', c: '#52b9ff' },
    volt:  { n: '雷', name: '雷電', c: '#ffd23f' },
    psy:   { n: '幻', name: '幻惑', c: '#c48cff' },
    earth: { n: '地', name: '大地', c: '#d9a066' },
    dark:  { n: '暗', name: '暗黑', c: '#8a8fc4' },
    metal: { n: '金', name: '金屬', c: '#c3cad4' },
    any:   { n: '通', name: '通用', c: '#eceee4' }
  };
  const ATTR = TYPE;
  const TYPE_ORDER = ['grass', 'fire', 'water', 'volt', 'psy', 'earth', 'dark', 'metal'];
  const WEAK = { grass: 'fire', fire: 'water', water: 'volt', volt: 'earth', earth: 'grass', dark: 'psy', metal: 'dark', psy: 'metal' };
  const RESIST = { grass: 'earth', fire: 'grass', water: 'fire', volt: 'water', earth: 'volt', dark: 'metal', metal: 'psy', psy: 'dark' };
  const TIERS = {
    N:   { code: 'N',   label: '普通',     sym: '●', rank: 0, col: '#e9eee0', edge: 0x9da394, n: 0 },
    R:   { code: 'R',   label: '稀有',     sym: '◆', rank: 1, col: '#dfe4ec', edge: 0xc9ced6, n: 0 },
    SR:  { code: 'SR',  label: '超稀有',   sym: '★', rank: 2, col: '#9fd0ff', edge: 0xe4ecff, n: 0 },
    SSR: { code: 'SSR', label: '特級稀有', sym: '★', rank: 3, col: '#ffcc45', edge: 0xf5c451, n: 0 },
    UR:  { code: 'UR',  label: '究極稀有', sym: '✦', rank: 4, col: '#9ef0ff', edge: 0xbfeaff, n: 0, full: true },
    SEC: { code: 'SEC', label: '秘藏',     sym: '✦', rank: 5, col: '#ff8ae6', edge: 0xffffff, n: 0, full: true },
    B:   { code: '基本', label: '基本資源', sym: '○', rank: 0, col: '#e9eee0', edge: 0x9da394, n: 0 }
  };
  const TIER_ORDER = ['N', 'R', 'SR', 'SSR', 'UR', 'SEC'];
  const RAINBOW_CSS = 'linear-gradient(90deg,#ff6b6b,#ffe66b,#6bff9d,#6bc8ff,#c77bff)';
  const CARDS = [
    {"kind":"cat","name":"OG 經典","tier":"SSR","type":"grass","stage":0,"np":110,"retreat":1,"moves":[{"cost":["grass"],"name":"初代認證","dmg":"20","text":"從牌庫找 1 張基本資源貼到自己身上。"},{"cost":["grass","grass","any"],"name":"NOX 起源","dmg":"70","text":""}],"flavor":"一切從這隻戴著護目鏡的黑貓開始。"},
    {"kind":"cat","name":"宇航員","tier":"R","type":"metal","stage":0,"np":80,"retreat":2,"moves":[{"cost":["metal","any"],"name":"無重力漫步","dmg":"30","text":"下回合這隻 NOXCAT 受到的傷害 −20。"}],"flavor":"帶了一塊綠色隕石回來，說是月球紀念品。"},
    {"kind":"cat","name":"金鏈街頭","tier":"N","type":"fire","stage":0,"np":70,"retreat":1,"moves":[{"cost":["fire"],"name":"噴漆塗鴉","dmg":"20","text":""},{"cost":["fire","any"],"name":"金鏈甩擊","dmg":"40","text":""}],"flavor":"整條街的牆，都是牠的畫布。"},
    {"kind":"cat","name":"雷射眼","tier":"R","type":"volt","stage":0,"np":80,"retreat":1,"moves":[{"cost":["volt","any"],"name":"綠光射線","dmg":"40","text":"擲硬幣，正面多 30 傷害。"}],"flavor":"盯著 K 線太久，眼睛就會發光。"},
    {"kind":"cat","name":"賽博武士","tier":"R","type":"metal","stage":0,"np":80,"retreat":1,"moves":[{"cost":["metal","any"],"name":"霓虹一閃","dmg":"50","text":"這招不計對手的抵抗。"}],"flavor":"刀是光做的，規矩是自己定的。"},
    {"kind":"cat","name":"皇冠國王","tier":"SSR","type":"earth","stage":0,"np":110,"retreat":2,"moves":[{"cost":["earth"],"name":"王之權杖","dmg":"","text":"從牌庫找 1 張夥伴卡加入手牌。"},{"cost":["earth","earth","any"],"name":"加冕","dmg":"80","text":""}],"flavor":"綠寶石權杖一舉，整個王國都要排隊。"},
    {"kind":"cat","name":"禮服紳士","tier":"N","type":"water","stage":0,"np":70,"retreat":1,"moves":[{"cost":["water"],"name":"舉杯致意","dmg":"","text":"回復自己 30 NP。"},{"cost":["water","any"],"name":"冰塊彈","dmg":"30","text":""}],"flavor":"單片眼鏡、領結和一杯綠色特調，禮數不能少。"},
    {"kind":"cat","name":"電競玩家","tier":"N","type":"volt","stage":0,"np":60,"retreat":1,"moves":[{"cost":["volt"],"name":"連擊","dmg":"10×","text":"擲 3 次硬幣，每次正面 10 傷害。"},{"cost":["volt","any"],"name":"快捷鍵","dmg":"30","text":""}],"flavor":"耳機一戴上，誰叫都聽不到。"},
    {"kind":"cat","name":"巫師","tier":"R","type":"psy","stage":0,"np":70,"retreat":1,"moves":[{"cost":["psy"],"name":"熬夜研究","dmg":"","text":"抽 2 張卡。"},{"cost":["psy","any"],"name":"綠光法球","dmg":"30","text":""}],"flavor":"法杖上的綠光，是牠熬夜研究出來的。"},
    {"kind":"cat","name":"黑客","tier":"N","type":"dark","stage":0,"np":70,"retreat":1,"moves":[{"cost":["dark"],"name":"入侵","dmg":"","text":"查看對手的手牌。"},{"cost":["dark","any"],"name":"病毒植入","dmg":"20","text":"對手前線 NOXCAT 陷入毒蝕。"}],"flavor":"一台筆電、一件帽 T，系統就是牠的遊樂場。"},
    {"kind":"cat","name":"惡魔","tier":"SR","type":"fire","stage":0,"np":90,"retreat":2,"moves":[{"cost":["fire"],"name":"綠焰","dmg":"20","text":"對手前線 NOXCAT 陷入灼燒。"},{"cost":["fire","fire","any"],"name":"惡魔之角","dmg":"70","text":""}],"flavor":"角是真的，火是真的，只有笑容是假的。"},
    {"kind":"cat","name":"天使","tier":"SR","type":"psy","stage":0,"np":90,"retreat":1,"moves":[{"cost":["psy"],"name":"光之祝福","dmg":"","text":"回復你場上 1 隻 NOXCAT 40 NP。"},{"cost":["psy","any"],"name":"聖光","dmg":"40","text":""}],"flavor":"翅膀很白，眼睛還是那個綠。"},
    {"kind":"cat","name":"忍者","tier":"N","type":"dark","stage":0,"np":60,"retreat":0,"moves":[{"cost":["dark"],"name":"手裏劍","dmg":"","text":"對手場上 1 隻 NOXCAT 受到 20 傷害（不計剋制和抵抗）。"}],"flavor":"你看到牠的時候，牠已經不在那裡了。"},
    {"kind":"cat","name":"海盜","tier":"N","type":"water","stage":0,"np":80,"retreat":2,"moves":[{"cost":["water"],"name":"暴風彎刀","dmg":"20","text":""},{"cost":["water","any","any"],"name":"登船","dmg":"50","text":""}],"flavor":"風浪越大，牠笑得越開心。"},
    {"kind":"cat","name":"殭屍","tier":"N","type":"grass","stage":0,"np":70,"retreat":2,"moves":[{"cost":["grass"],"name":"綠色藥水","dmg":"","text":"回復自己 20 NP。"},{"cost":["grass","any"],"name":"殭屍撲擊","dmg":"30","text":""}],"flavor":"說是喝了提神飲料，結果睡了一百年。"},
    {"kind":"cat","name":"斗笠俠客","tier":"N","type":"grass","stage":0,"np":70,"retreat":1,"moves":[{"cost":["grass"],"name":"扇風","dmg":"20","text":"對手前線 NOXCAT 下回合不能撤離。"}],"flavor":"一頂斗笠、一把扇子，江湖就是牠的家。"},
    {"kind":"cat","name":"龍帝","tier":"SSR","type":"fire","stage":0,"np":120,"retreat":2,"moves":[{"cost":["fire","any"],"name":"金龍纏身","dmg":"40","text":"下回合這隻 NOXCAT 受到的傷害 −20。"},{"cost":["fire","fire","any","any"],"name":"龍帝之怒","dmg":"120","text":""}],"flavor":"金龍纏身的那一刻，夜空都亮了。"},
    {"kind":"cat","name":"鳳凰","tier":"SSR","type":"fire","stage":0,"np":110,"retreat":2,"moves":[{"cost":["fire","any"],"name":"浴火","dmg":"30","text":"回復自己 30 NP。"},{"cost":["fire","fire","any"],"name":"燃盡過去","dmg":"100","text":"棄掉自己身上 1 張資源。"}],"flavor":"燒掉的不是羽毛，是過去。"},
    {"kind":"cat","name":"雷神","tier":"SR","type":"volt","stage":0,"np":100,"retreat":2,"moves":[{"cost":["volt","any"],"name":"落雷","dmg":"40","text":"擲硬幣，正面對手前線 NOXCAT 陷入癱瘓。"}],"flavor":"牠一生氣，整座城的路燈都會閃。"},
    {"kind":"cat","name":"仙尊","tier":"SR","type":"psy","stage":0,"np":100,"retreat":2,"moves":[{"cost":["psy","any"],"name":"太極","dmg":"40","text":"下回合這隻 NOXCAT 受到的傷害 −30。"}],"flavor":"修行三百年，鬍子終於白了。"},
    {"kind":"cat","name":"創始者","tier":"SSR","type":"metal","stage":0,"np":110,"retreat":1,"moves":[{"cost":["metal"],"name":"創世區塊","dmg":"","text":"從牌庫找 1 張基礎 NOXCAT 放到後援區。"},{"cost":["metal","metal","any"],"name":"創始共識","dmg":"70","text":""}],"flavor":"第一個區塊，是牠親手寫下的。"},
    {"kind":"cat","name":"水晶透明","tier":"UR","type":"water","stage":0,"np":200,"retreat":2,"moves":[{"ability":1,"name":"透明之心","text":"這隻 NOXCAT 不會陷入任何異常狀態。"},{"cost":["water","any"],"name":"折射","dmg":"60","text":"對手後援區 1 隻 NOXCAT 受到 30 傷害。"},{"cost":["water","water","water","any"],"name":"水晶風暴","dmg":"200","text":"下回合這隻 NOXCAT 不能用招式。"}],"flavor":"透明到看得見心跳，堅硬到砍不出裂痕。","legend":1},
    {"kind":"cat","name":"純金","tier":"UR","type":"metal","stage":0,"np":200,"retreat":3,"moves":[{"ability":1,"name":"全身 24K","text":"這隻 NOXCAT 不會因為剋制受到加倍傷害。"},{"cost":["metal","metal","any","any"],"name":"黃金重擊","dmg":"180","text":""}],"flavor":"全身 24K，連鬍鬚都會反光。","legend":1},
    {"kind":"cat","name":"外星人","tier":"SR","type":"psy","stage":0,"np":90,"retreat":1,"moves":[{"cost":["psy"],"name":"未知訊號","dmg":"","text":"對手前線 NOXCAT 陷入錯亂。"},{"cost":["psy","any","any"],"name":"光波探測","dmg":"50","text":""}],"flavor":"牠說牠來自很遠的鏈，沒人聽得懂那串地址。"},
    {"kind":"cat","name":"機械體","tier":"R","type":"metal","stage":0,"np":80,"retreat":2,"moves":[{"cost":["metal"],"name":"綠能核心","dmg":"","text":"從棄牌區把 1 張基本資源貼到自己身上。"},{"cost":["metal","metal","any"],"name":"機械拳","dmg":"60","text":""}],"flavor":"一半是貓，一半是程式碼，兩邊都很可愛。"},
    {"kind":"cat","name":"殭屍腦","tier":"R","type":"grass","stage":0,"np":90,"retreat":2,"moves":[{"cost":["grass","any"],"name":"想太多","dmg":"30×","text":"擲 2 次硬幣，每次正面 30 傷害。"},{"cost":["grass","grass","any"],"name":"腦波干擾","dmg":"60","text":"對手前線 NOXCAT 陷入錯亂。"}],"flavor":"想太多的結果，大家都看得到。"},
    {"kind":"cat","name":"彩虹全息","tier":"SEC","type":"psy","stage":0,"np":210,"retreat":2,"moves":[{"cost":["psy","any"],"name":"全息投影","dmg":"60","text":"擲硬幣，正面下回合對手的招式對這隻 NOXCAT 無效。"},{"cost":["psy","psy","psy","any","any"],"name":"七彩終焉","dmg":"250","text":""}],"flavor":"每轉一個角度，牠就換一種顏色。","legend":1},
    {"kind":"cat","name":"像素忍者","tier":"N","type":"dark","stage":1,"np":100,"retreat":0,"moves":[{"cost":["dark","any"],"name":"影分身","dmg":"30","text":"擲硬幣，正面下回合這隻 NOXCAT 不會受到招式傷害。"},{"cost":["dark","dark","any"],"name":"像素斬","dmg":"80","text":""}],"flavor":"從老遊戲機裡跑出來的忍者，跳起來還有音效。","from":"忍者"},
    {"kind":"cat","name":"像素電競","tier":"N","type":"volt","stage":1,"np":100,"retreat":1,"moves":[{"cost":["volt","any"],"name":"連打","dmg":"20×","text":"擲 4 次硬幣，每次正面 20 傷害。"},{"cost":["volt","volt","any"],"name":"連段終結","dmg":"80","text":""}],"flavor":"按鍵聲比背景音樂還大聲。","from":"電競玩家"},
    {"kind":"cat","name":"網點海盜","tier":"N","type":"water","stage":1,"np":110,"retreat":2,"moves":[{"cost":["water","any"],"name":"連載衝擊","dmg":"50","text":""},{"cost":["water","water","any"],"name":"黑旗掠奪","dmg":"80","text":"棄掉對手前線 NOXCAT 身上 1 張資源。"}],"flavor":"從週刊連載裡跳出來的船長。","from":"海盜"},
    {"kind":"cat","name":"網點街頭","tier":"N","type":"fire","stage":1,"np":110,"retreat":1,"moves":[{"cost":["fire","any"],"name":"網點噴射","dmg":"50","text":"對手前線 NOXCAT 陷入灼燒。"},{"cost":["fire","fire","any"],"name":"街頭狂潮","dmg":"90","text":""}],"flavor":"每一個點，都是牠親手噴上去的。","from":"金鏈街頭"},
    {"kind":"cat","name":"夜視黑客","tier":"N","type":"dark","stage":1,"np":110,"retreat":1,"moves":[{"cost":["dark","any"],"name":"關燈","dmg":"30","text":"對手下回合不能使用道具卡。"},{"cost":["dark","dark","any"],"name":"系統癱瘓","dmg":"80","text":"擲硬幣，正面對手前線 NOXCAT 陷入癱瘓。"}],"flavor":"關掉燈，牠反而看得更清楚。","from":"黑客"},
    {"kind":"cat","name":"墨韻俠客","tier":"N","type":"grass","stage":1,"np":100,"retreat":1,"moves":[{"cost":["grass"],"name":"潑墨","dmg":"","text":"對手後援區 1 隻 NOXCAT 受到 20 傷害。"},{"cost":["grass","grass","any"],"name":"墨韻斬","dmg":"80","text":""}],"flavor":"一滴墨、一把扇，畫完就走。","from":"斗笠俠客"},
    {"kind":"cat","name":"白夜殭屍","tier":"N","type":"grass","stage":1,"np":110,"retreat":2,"moves":[{"cost":["grass","any"],"name":"白夜甦醒","dmg":"50","text":"擲硬幣，正面讓對手前線 NOXCAT 陷入沉睡。"},{"cost":["grass","grass","any"],"name":"不死之身","dmg":"80","text":"回復自己 30 NP。"}],"flavor":"顏色全反過來之後，連個性都變溫柔了。","from":"殭屍"},
    {"kind":"cat","name":"霓虹武士","tier":"R","type":"metal","stage":1,"np":110,"retreat":1,"moves":[{"cost":["metal"],"name":"斷訊斬","dmg":"30","text":"棄掉對手前線 NOXCAT 身上的裝備卡。"},{"cost":["metal","metal","any"],"name":"霓虹居合","dmg":"100","text":"這招不計對手的抵抗。"}],"flavor":"訊號越亂，牠的刀越快。","from":"賽博武士"},
    {"kind":"cat","name":"冰霜宇航員","tier":"R","type":"metal","stage":1,"np":120,"retreat":2,"moves":[{"cost":["metal","any"],"name":"結霜護目鏡","dmg":"40","text":"擲硬幣，正面對手前線 NOXCAT 陷入癱瘓。"},{"cost":["metal","metal","any"],"name":"隕石墜落","dmg":"100","text":""}],"flavor":"在太空待太久，連護目鏡都結霜了。","from":"宇航員"},
    {"kind":"cat","name":"熔岩惡魔","tier":"R","type":"fire","stage":1,"np":120,"retreat":2,"moves":[{"cost":["fire","any"],"name":"冒煙腳步","dmg":"40","text":"對手後援區 1 隻 NOXCAT 受到 20 傷害。"},{"cost":["fire","fire","any"],"name":"熔岩爆發","dmg":"100","text":"棄掉自己身上 1 張火焰資源。"}],"flavor":"牠走過的地方，地板都會冒煙。","from":"惡魔"},
    {"kind":"cat","name":"霓光巫師","tier":"R","type":"psy","stage":1,"np":100,"retreat":1,"moves":[{"cost":["psy"],"name":"光圈","dmg":"","text":"查看牌庫上方 4 張，選 1 張加入手牌，其餘洗回牌庫。"},{"cost":["psy","psy","any"],"name":"霓光魔彈","dmg":"80","text":""}],"flavor":"只剩一圈綠光，大家還是一眼認出牠。","from":"巫師"},
    {"kind":"cat","name":"紫外雷射眼","tier":"R","type":"volt","stage":1,"np":110,"retreat":1,"moves":[{"cost":["volt"],"name":"瞄準","dmg":"","text":"對手後援區 1 隻 NOXCAT 受到 20 傷害。"},{"cost":["volt","volt","any"],"name":"紫外光束","dmg":"90","text":""}],"flavor":"換了波長，射得更遠。","from":"雷射眼"},
    {"kind":"cat","name":"普普紳士","tier":"R","type":"water","stage":1,"np":110,"retreat":1,"moves":[{"cost":["water"],"name":"四杯連飲","dmg":"","text":"回復你場上每隻 NOXCAT 各 20 NP。"},{"cost":["water","water","any"],"name":"普普衝擊","dmg":"80","text":""}],"flavor":"一次舉四杯，四種心情。","from":"禮服紳士"},
    {"kind":"cat","name":"黑金天使","tier":"SR","type":"psy","stage":1,"np":130,"retreat":1,"moves":[{"cost":["psy","any"],"name":"黃金祝福","dmg":"","text":"回復你場上每隻 NOXCAT 各 30 NP。"},{"cost":["psy","psy","any"],"name":"黑金審判","dmg":"100","text":""}],"flavor":"翅膀鍍了金，祝福也更閃亮了。","from":"天使"},
    {"kind":"cat","name":"雙生雷神","tier":"SR","type":"volt","stage":1,"np":130,"retreat":2,"moves":[{"cost":["volt","volt"],"name":"平行雷擊","dmg":"50","text":"對手後援區 1 隻 NOXCAT 也受到 30 傷害。"},{"cost":["volt","volt","any"],"name":"雙生雷霆","dmg":"110","text":"自己也受到 20 傷害。"}],"flavor":"一半是今天，一半是另一個平行世界。","from":"雷神"},
    {"kind":"cat","name":"故障外星人","tier":"SR","type":"psy","stage":1,"np":120,"retreat":1,"moves":[{"cost":["psy","any"],"name":"傳送故障","dmg":"40","text":"對手把前線 NOXCAT 和後援區 1 隻交換（對手選）。"},{"cost":["psy","psy","any"],"name":"錯誤代碼","dmg":"90","text":""}],"flavor":"傳送時出了點錯，但牠覺得這樣比較帥。","from":"外星人"},
    {"kind":"cat","name":"紫電仙尊","tier":"SR","type":"psy","stage":1,"np":130,"retreat":2,"moves":[{"cost":["psy","psy"],"name":"紫電修為","dmg":"60","text":"擲硬幣，正面對手前線 NOXCAT 陷入沉睡。"},{"cost":["psy","psy","any","any"],"name":"百年一擊","dmg":"130","text":""}],"flavor":"鬍子染紫之後，修為又多了一百年。","from":"仙尊"},
    {"kind":"cat","name":"血月機械體","tier":"SR","type":"metal","stage":1,"np":130,"retreat":2,"moves":[{"cost":["metal","any"],"name":"核心過熱","dmg":"60","text":"自己也受到 10 傷害。"},{"cost":["metal","metal","any","any"],"name":"血月砲","dmg":"120","text":""}],"flavor":"月亮變紅的那晚，牠的核心也跟著發燙。","from":"機械體"},
    {"kind":"cat","name":"黑金國王","tier":"SSR","type":"earth","stage":1,"np":140,"retreat":2,"moves":[{"cost":["earth","any"],"name":"夜之王權","dmg":"60","text":"對手後援區每隻 NOXCAT 各受到 10 傷害。"},{"cost":["earth","earth","any","any"],"name":"黑金王國","dmg":"140","text":""}],"flavor":"王冠還是金的，只是王國換成了夜晚。","from":"皇冠國王"},
    {"kind":"cat","name":"冰龍帝","tier":"SSR","type":"water","stage":1,"np":150,"retreat":2,"moves":[{"cost":["water","any"],"name":"冰封","dmg":"50","text":"擲硬幣，正面對手前線 NOXCAT 陷入癱瘓。"},{"cost":["water","water","any","any"],"name":"冰龍吐息","dmg":"140","text":""}],"flavor":"同一條龍，換了季節就換了脾氣。","from":"龍帝"},
    {"kind":"cat","name":"闇鳳凰","tier":"SSR","type":"dark","stage":1,"np":150,"retreat":2,"moves":[{"ability":1,"name":"紫灰重生","text":"這隻 NOXCAT 被擊倒時擲硬幣，正面就把它放回手牌，身上的卡全部棄掉。"},{"cost":["dark","dark","any","any"],"name":"闇炎","dmg":"140","text":""}],"flavor":"從紫色的灰燼裡，第二次重生。","from":"鳳凰"},
    {"kind":"cat","name":"宇宙 OG","tier":"UR","type":"grass","stage":1,"np":240,"retreat":2,"moves":[{"cost":["grass","any"],"name":"星際訊號","dmg":"","text":"從牌庫找 2 張卡加入手牌。"},{"cost":["grass","grass","grass","any"],"name":"宇宙大爆炸","dmg":"220","text":"棄掉自己身上 2 張資源。"}],"flavor":"背景換成整個宇宙，牠還是那隻 OG。","from":"OG 經典","legend":1},
    {"kind":"cat","name":"全息創始者","tier":"SEC","type":"metal","stage":1,"np":240,"retreat":2,"moves":[{"cost":["metal","any"],"name":"全息區塊","dmg":"60","text":"從牌庫找 2 張卡加入手牌。"},{"cost":["metal","metal","psy","any"],"name":"萬色創世","dmg":"230","text":""}],"flavor":"第一個區塊，被重新寫成了彩虹色。","from":"創始者","legend":1},
    {"kind":"cat","name":"竹林劍聖","tier":"SSR","type":"grass","stage":2,"np":170,"retreat":2,"moves":[{"cost":["grass","grass"],"name":"葉刃旋風","dmg":"60","text":"對手後援區每隻 NOXCAT 各受到 10 傷害。"},{"cost":["grass","grass","any","any"],"name":"竹林一閃","dmg":"160","text":""}],"flavor":"刀還沒出鞘，竹葉已經落了一地。","from":"墨韻俠客"},
    {"kind":"cat","name":"煉獄魔王","tier":"SSR","type":"fire","stage":2,"np":180,"retreat":3,"moves":[{"cost":["fire","fire"],"name":"地獄王座","dmg":"60","text":"雙方前線 NOXCAT 都陷入灼燒。"},{"cost":["fire","fire","fire","any"],"name":"煉獄審判","dmg":"180","text":"棄掉自己身上 2 張資源。"}],"flavor":"王座很燙，但牠坐得很舒服。","from":"熔岩惡魔"},
    {"kind":"cat","name":"深海船長","tier":"SSR","type":"water","stage":2,"np":170,"retreat":3,"moves":[{"cost":["water","water"],"name":"觸手纏繞","dmg":"60","text":"擲硬幣，正面對手前線 NOXCAT 陷入癱瘓。"},{"cost":["water","water","water","any"],"name":"深淵巨浪","dmg":"170","text":""}],"flavor":"沉船是牠的家，章魚是牠的船員。","from":"網點海盜"},
    {"kind":"cat","name":"雷霆主宰","tier":"UR","type":"volt","stage":2,"np":310,"retreat":3,"moves":[{"cost":["volt","volt"],"name":"雷雲統御","dmg":"","text":"從牌庫找最多 2 張雷電資源，貼到你場上的 NOXCAT 身上。"},{"cost":["volt","volt","volt","any"],"name":"萬雷審判","dmg":"250","text":"棄掉自己身上 2 張資源。"}],"flavor":"雷雲聽牠的，閃電也聽牠的。","from":"雙生雷神","legend":1},
    {"kind":"cat","name":"大魔導師","tier":"SSR","type":"psy","stage":2,"np":160,"retreat":2,"moves":[{"ability":1,"name":"禁書","text":"每回合一次，可以從牌庫找 1 張指令卡加入手牌。"},{"cost":["psy","psy","any"],"name":"星陣崩落","dmg":"130","text":"對手前線 NOXCAT 陷入錯亂。"}],"flavor":"那本書只有牠翻得開。","from":"霓光巫師"},
    {"kind":"cat","name":"粉紅甜心","tier":"R","type":"psy","stage":0,"np":70,"retreat":1,"moves":[{"cost":["psy"],"name":"甜心馬卡龍","dmg":"","text":"回復你場上 1 隻 NOXCAT 30 NP。"},{"cost":["psy","any"],"name":"愛心攻勢","dmg":"30","text":"擲硬幣，正面對手前線 NOXCAT 陷入錯亂。"}],"flavor":"馬卡龍只分給喜歡的人。"},
    {"kind":"cat","name":"影子貓","tier":"N","type":"dark","stage":0,"np":60,"retreat":0,"moves":[{"cost":["dark"],"name":"融入陰影","dmg":"","text":"擲硬幣，正面下回合這隻 NOXCAT 不會受到招式傷害。"},{"cost":["dark","any"],"name":"暗巷偷襲","dmg":"30","text":""}],"flavor":"路燈下有兩個影子，其中一個是牠。"},
    {"kind":"cat","name":"深淵之影","tier":"SR","type":"dark","stage":1,"np":120,"retreat":1,"moves":[{"cost":["dark","any"],"name":"黑洞吸引","dmg":"","text":"把對手後援區 1 隻 NOXCAT 和對手前線 NOXCAT 交換。"},{"cost":["dark","dark","any"],"name":"深淵吞噬","dmg":"90","text":"回復自己 30 NP。"}],"flavor":"看太久黑洞，黑洞也會看回來。","from":"影子貓"},
    {"kind":"cat","name":"影之上忍","tier":"SSR","type":"dark","stage":2,"np":160,"retreat":1,"moves":[{"cost":["dark","dark"],"name":"千影手裏劍","dmg":"","text":"對手場上任選 3 隻 NOXCAT，各受到 30 傷害（不計剋制和抵抗）。"},{"cost":["dark","dark","any","any"],"name":"月下暗殺","dmg":"130","text":"如果對手前線 NOXCAT 已經有傷痕，多 50 傷害。"}],"flavor":"月亮底下站著七隻，其中六隻是假的。","from":"像素忍者"},
    {"kind":"cat","name":"終極機甲","tier":"SSR","type":"metal","stage":2,"np":180,"retreat":3,"moves":[{"ability":1,"name":"機甲裝甲","text":"這隻 NOXCAT 受到的招式傷害 −30。"},{"cost":["metal","metal","metal","any"],"name":"全彈發射","dmg":"180","text":"下回合這隻 NOXCAT 不能用「全彈發射」。"}],"flavor":"駕照考了三次，終於能開最大的那台。","from":"血月機械體"},
    {"kind":"cat","name":"石像守衛","tier":"N","type":"earth","stage":0,"np":80,"retreat":2,"moves":[{"cost":["earth"],"name":"石盾","dmg":"","text":"下回合這隻 NOXCAT 受到的傷害 −30。"},{"cost":["earth","any","any"],"name":"符文撞擊","dmg":"50","text":""}],"flavor":"守著一座沒人記得的神殿，一守就是一千年。"},
    {"kind":"cat","name":"遠古石像","tier":"R","type":"earth","stage":1,"np":130,"retreat":3,"moves":[{"cost":["earth","any"],"name":"岩石軌道","dmg":"40","text":"擲硬幣，正面對手前線 NOXCAT 陷入癱瘓。"},{"cost":["earth","earth","any"],"name":"遠古之拳","dmg":"100","text":""}],"flavor":"身上的苔蘚，比牠的年紀還老。","from":"石像守衛"},
    {"kind":"cat","name":"大地泰坦","tier":"SSR","type":"earth","stage":2,"np":180,"retreat":4,"moves":[{"cost":["earth","earth"],"name":"山脈崩裂","dmg":"80","text":"雙方後援區每隻 NOXCAT 各受到 10 傷害。"},{"cost":["earth","earth","any","any"],"name":"泰坦重踏","dmg":"180","text":""}],"flavor":"牠一伸懶腰，整片山脈就裂開了。","from":"遠古石像"},
    {"kind":"cat","name":"水晶礦工","tier":"N","type":"earth","stage":0,"np":70,"retreat":1,"moves":[{"cost":["earth"],"name":"挖礦","dmg":"","text":"從牌庫找 1 張大地資源貼到自己身上。"},{"cost":["earth","any"],"name":"十字鎬","dmg":"30","text":""}],"flavor":"挖到綠水晶的那天，牠請全礦坑喝牛奶。"},
    {"kind":"cat","name":"鑽頭礦工","tier":"R","type":"earth","stage":1,"np":110,"retreat":2,"moves":[{"cost":["earth","any"],"name":"破岩鑽","dmg":"60","text":"這招不計對手的抵抗。"},{"cost":["earth","earth","any"],"name":"鑽穿","dmg":"90","text":"棄掉對手前線 NOXCAT 身上 1 張資源。"}],"flavor":"手換成鑽頭之後，再硬的牆都只是門。","from":"水晶礦工"},
    {"kind":"cmd","sub":"夥伴","name":"首席研究員","tier":"R","text":"把手牌全部棄掉，然後抽 7 張卡。"},
    {"kind":"cmd","sub":"夥伴","name":"夜班店長","tier":"R","text":"抽 3 張卡。"},
    {"kind":"cmd","sub":"夥伴","name":"交易員","tier":"R","text":"雙方把手牌洗回牌庫，各抽 4 張卡。"},
    {"kind":"cmd","sub":"夥伴","name":"鏈上偵探","tier":"R","text":"從牌庫找 1 張 NOXCAT 卡和 1 張基本資源，給對手看過後加入手牌，然後洗牌。"},
    {"kind":"cmd","sub":"夥伴","name":"保安隊長","tier":"R","text":"選對手後援區 1 隻 NOXCAT，和對手的前線 NOXCAT 交換。"},
    {"kind":"cmd","sub":"夥伴","name":"覺醒導師","tier":"SR","text":"從牌庫找 1 張覺醒卡，讓你場上可以覺醒的 NOXCAT 立刻覺醒，然後洗牌。"},
    {"kind":"cmd","sub":"道具","name":"貓薄荷探測器","tier":"N","text":"從牌庫找 1 張基礎 NOXCAT，給對手看過後加入手牌，然後洗牌。"},
    {"kind":"cmd","sub":"道具","name":"傳送門","tier":"R","text":"把你的前線 NOXCAT 和後援區 1 隻 NOXCAT 交換，不用付撤離成本。"},
    {"kind":"cmd","sub":"道具","name":"急救罐頭","tier":"N","text":"回復你場上 1 隻 NOXCAT 30 NP。"},
    {"kind":"cmd","sub":"道具","name":"九條命","tier":"R","text":"從棄牌區選 1 張 NOXCAT 卡加入手牌。"},
    {"kind":"cmd","sub":"道具","name":"覺醒糖果","tier":"SR","text":"選你場上 1 隻基礎 NOXCAT，從手牌直接放上它的二階覺醒卡（跳過一階）。不能用在你的第一回合，也不能用在這回合剛放上場的 NOXCAT。"},
    {"kind":"cmd","sub":"道具","name":"幸運貓爪","tier":"N","text":"擲硬幣，正面抽 2 張卡。"},
    {"kind":"cmd","sub":"道具","name":"資源補給包","tier":"N","text":"從棄牌區選最多 2 張基本資源加入手牌。"},
    {"kind":"cmd","sub":"道具","name":"訊號干擾器","tier":"N","text":"擲硬幣，正面棄掉對手前線 NOXCAT 身上 1 張資源。"},
    {"kind":"cmd","sub":"裝備","name":"綠光護目鏡","tier":"R","text":"裝備的 NOXCAT 對對手前線 NOXCAT 的招式傷害 +20。"},
    {"kind":"cmd","sub":"裝備","name":"鈦合金背心","tier":"R","text":"裝備的 NOXCAT 受到的招式傷害 −20。"},
    {"kind":"cmd","sub":"裝備","name":"NOX 吊牌","tier":"R","text":"裝備的 NOXCAT 撤離成本 −1。"},
    {"kind":"cmd","sub":"場地","name":"夜之城","tier":"SR","text":"雙方的暗黑和雷電 NOXCAT，招式傷害 +10。"},
    {"kind":"cmd","sub":"場地","name":"翡翠森林","tier":"SR","text":"每回合一次，雙方都可以從手牌多貼 1 張草木資源到草木 NOXCAT 身上。"},
    {"kind":"cmd","sub":"場地","name":"地下礦坑","tier":"SR","text":"雙方的大地 NOXCAT 撤離成本變成 0。"},
    {"kind":"energy","name":"雙重資源","tier":"SR","type":"any","text":"算 2 個通用資源。"},
    {"kind":"energy","name":"彩虹資源","tier":"SEC","type":"any","text":"可以當作任何 1 種屬性的資源。貼上時，這隻 NOXCAT 受到 10 傷害。"},
    {"kind":"energy","name":"回收資源","tier":"SR","type":"any","text":"算 1 個通用資源。貼著的 NOXCAT 被擊倒時，這張回到手牌。"},
    {"kind":"energy","name":"護盾資源","tier":"SR","type":"any","text":"算 1 個通用資源。貼著的 NOXCAT 受到的招式傷害 −10。"},
    {"kind":"energy","basic":1,"name":"基本草木資源","tier":"B","type":"grass","text":"提供 1 個草木資源。"},
    {"kind":"energy","basic":1,"name":"基本火焰資源","tier":"B","type":"fire","text":"提供 1 個火焰資源。"},
    {"kind":"energy","basic":1,"name":"基本水流資源","tier":"B","type":"water","text":"提供 1 個水流資源。"},
    {"kind":"energy","basic":1,"name":"基本雷電資源","tier":"B","type":"volt","text":"提供 1 個雷電資源。"},
    {"kind":"energy","basic":1,"name":"基本幻惑資源","tier":"B","type":"psy","text":"提供 1 個幻惑資源。"},
    {"kind":"energy","basic":1,"name":"基本大地資源","tier":"B","type":"earth","text":"提供 1 個大地資源。"},
    {"kind":"energy","basic":1,"name":"基本暗黑資源","tier":"B","type":"dark","text":"提供 1 個暗黑資源。"},
    {"kind":"energy","basic":1,"name":"基本金屬資源","tier":"B","type":"metal","text":"提供 1 個金屬資源。"}
  ];
  const SETS = {
    1: { label: '第一彈', name: 'NOXCAT 集結', en: 'CYBERCAT COLLECTION', total: 0 },
    2: { label: '第二彈', name: '異色重生', en: 'ALTER EGO', total: 0 },
    3: { label: '第三彈', name: '覺醒之戰', en: 'AWAKENING', total: 0 },
    0: { label: '基本資源', name: '基本資源', en: 'BASIC RESOURCES', total: 0 }
  };
  const SET_ORDER = [1, 2, 3];
  CARDS.forEach((c, i) => {
    c.id = i + 1; c.no = String(c.id).padStart(3, '0');
    c.set = c.id <= 27 ? 1 : c.id <= 50 ? 2 : c.id <= 89 ? 3 : 0;
    c.attr = c.type || 'any'; c.flavor = c.flavor || ''; c.moves = c.moves || [];
    SETS[c.set].total++; c.sn = String(SETS[c.set].total).padStart(3, '0');
  });
  const ALL = CARDS.length;
  TIER_ORDER.concat('B').forEach(k => { TIERS[k].n = CARDS.filter(c => c.tier === k).length; });
  const tierCount = (set, k) => CARDS.filter(c => c.set === set && c.tier === k).length;
  const POOL = {}; SET_ORDER.forEach(st => { POOL[st] = {}; TIER_ORDER.forEach(t => POOL[st][t] = []); });
  CARDS.forEach(c => { if (c.set) POOL[c.set][c.tier].push(c); });
  const PACKS = [
    { id: 'og', set: 1, label: 'OG 經典', art: 1, accent: '#b4f01e', glow: 'rgba(180,240,30,.6)', ed: 'OG EDITION' },
    { id: 'king', set: 1, label: '皇冠國王', art: 6, accent: '#f5c451', glow: 'rgba(245,196,81,.6)', ed: 'ROYAL EDITION' },
    { id: 'holo', set: 1, label: '彩虹全息', art: 27, accent: '#ff8ae6', glow: 'rgba(255,138,230,.55)', ed: 'HOLO EDITION', rainbow: true },
    { id: 'ice', set: 2, label: '冰龍帝', art: 47, accent: '#6fd8ff', glow: 'rgba(111,216,255,.6)', ed: 'ICE EDITION' },
    { id: 'glitch', set: 2, label: '霓虹武士', art: 35, accent: '#ff3ea5', glow: 'rgba(255,62,165,.55)', ed: 'GLITCH EDITION' },
    { id: 'titan', set: 3, label: '大地泰坦', art: 63, accent: '#e0a868', glow: 'rgba(224,168,104,.6)', ed: 'TITAN EDITION' },
    { id: 'thunder', set: 3, label: '雷霆主宰', art: 54, accent: '#ffd23f', glow: 'rgba(255,210,63,.6)', ed: 'THUNDER EDITION' }
  ];

  // ───────── Art + canvas helpers ─────────
  const artCache = {};
  function loadArt(n) {
    if (!artCache[n]) artCache[n] = new Promise(res => {
      const img = new Image();
      img.onload = () => res(img); img.onerror = () => res(null);
      img.src = `art/${String(n).padStart(2, '0')}.jpg`;
    });
    return artCache[n];
  }
  const FB = '"Noto Sans TC","PingFang TC","Microsoft JhengHei","Heiti TC",sans-serif';
  const FM = 'Unbounded,"Arial Black","Noto Sans TC",sans-serif';
  const LOGO = {"cat": "M3.9 14.8Q3.4 15.2 2.8 17.3Q2.2 19.4 2.2 22.2Q2.2 25.1 3.4 33.6Q4.6 42.0 3.4 45.7Q2.1 49.4 1.3 53.2Q0.5 57.1 0.2 59.4Q0.0 61.6 0.1 66.8Q0.2 71.9 0.7 74.8Q1.1 77.8 2.1 81.1Q3.1 84.5 4.9 87.7Q6.8 90.9 8.3 92.3Q9.9 93.8 12.0 94.8Q14.1 95.9 16.4 96.2Q18.6 96.6 51.5 96.6Q84.4 96.6 86.7 96.2Q89.0 95.8 91.1 94.9Q93.2 94.0 94.9 92.9Q96.5 91.8 98.1 90.2Q99.6 88.6 101.3 85.8Q103.0 83.0 104.1 79.8Q105.1 76.6 105.7 72.8Q106.2 68.9 106.1 63.2Q105.9 57.5 105.1 54.2Q104.2 51.0 102.4 47.0Q100.6 43.0 97.9 39.5Q95.2 36.0 92.6 33.6Q90.0 31.2 86.5 28.9Q83.0 26.6 80.2 25.2Q77.5 23.9 73.5 22.4Q69.5 21.0 65.5 20.0Q61.5 19.0 58.1 14.1Q54.6 9.1 53.1 7.2Q51.5 5.4 49.2 3.3Q47.0 1.2 45.6 0.6Q44.2 0.0 43.3 0.0Q42.4 0.0 41.7 0.3Q41.0 0.6 39.9 2.1Q38.8 3.5 37.8 6.4Q36.9 9.2 36.3 13.8Q35.8 18.2 35.2 18.8Q34.8 19.4 29.1 21.0Q23.5 22.6 19.0 19.8Q14.5 16.9 12.6 15.9Q10.6 15.0 8.2 14.5Q5.8 14.0 5.1 14.2Q4.4 14.4 3.9 14.8Z", "eyes": "M14.8 41.4Q15.9 40.4 16.9 40.3Q18.0 40.2 19.2 40.9Q20.5 41.5 21.8 42.9Q23.0 44.4 23.9 46.3Q24.8 48.2 25.1 49.9Q25.5 51.6 25.4 53.7Q25.4 55.8 24.8 57.2Q24.1 58.6 23.1 59.3Q22.1 60.0 21.0 59.9Q19.9 59.9 18.8 59.2Q17.8 58.6 16.4 56.9Q15.0 55.1 14.3 53.5Q13.6 51.9 13.2 50.4Q12.9 48.9 12.9 47.0Q12.9 45.1 13.3 43.8Q13.8 42.4 14.8 41.4ZM35.9 33.5Q36.9 32.9 37.9 32.9Q38.9 32.9 39.9 33.4Q41.0 34.0 42.1 35.1Q43.1 36.2 44.2 38.3Q45.2 40.4 45.7 42.1Q46.1 43.8 46.1 45.9Q46.1 48.0 45.6 49.4Q45.1 50.8 44.1 51.6Q43.0 52.5 42.0 52.6Q41.0 52.6 39.8 52.0Q38.5 51.4 37.2 49.8Q35.9 48.2 35.0 46.2Q34.1 44.2 33.8 42.8Q33.5 41.2 33.6 38.9Q33.8 36.5 34.4 35.3Q35.0 34.1 35.9 33.5Z", "cw": 106.25, "ch": 96.62, "word": "M228.8 2.2Q228.5 2.8 228.5 6.6Q228.5 10.5 228.6 10.7Q228.6 10.9 228.8 11.1Q229.0 11.2 229.6 11.4Q230.1 11.6 235.7 11.6Q241.2 11.6 241.3 11.6Q241.4 11.5 241.8 11.5Q242.2 11.5 242.3 11.6Q242.4 11.6 242.8 11.6Q243.1 11.6 243.5 11.9Q243.9 12.1 244.0 12.4Q244.1 12.8 244.1 13.4Q244.1 14.0 244.1 14.1Q244.0 14.1 244.0 14.7Q244.0 15.2 244.1 15.3Q244.1 15.4 244.1 15.8Q244.1 16.1 244.1 16.2Q244.0 16.2 244.0 24.2Q244.0 32.2 244.2 32.9Q244.4 33.6 244.6 33.8Q244.8 34.0 245.1 34.1Q245.4 34.2 245.8 34.2Q246.1 34.2 246.2 34.2Q246.2 34.1 246.9 34.1Q247.6 34.1 247.7 34.2Q247.8 34.2 251.6 34.2Q255.5 34.2 255.6 34.2Q255.6 34.1 256.0 34.1Q256.4 34.1 256.6 33.9Q256.9 33.8 257.1 33.2Q257.2 32.8 257.2 22.7Q257.2 12.6 257.3 12.4Q257.4 12.2 257.6 12.0Q257.9 11.8 258.1 11.7Q258.2 11.6 260.4 11.6Q262.6 11.6 262.7 11.6Q262.8 11.5 262.9 11.6Q263.0 11.6 267.1 11.6Q271.2 11.6 271.8 11.4Q272.4 11.2 272.6 10.7Q272.9 10.1 272.9 6.6Q272.9 3.1 272.7 2.6Q272.5 2.0 272.3 1.8Q272.1 1.6 271.8 1.5Q271.4 1.4 250.7 1.4Q230.0 1.4 229.6 1.6Q229.1 1.8 228.8 2.2ZM183.0 30.3Q182.0 32.4 182.0 32.9Q182.0 33.5 182.1 33.7Q182.2 33.9 182.8 34.1Q183.2 34.2 184.3 34.2Q185.4 34.2 185.4 34.2Q185.5 34.1 186.1 34.1Q186.6 34.1 186.7 34.2Q186.8 34.2 187.4 34.2Q188.0 34.2 188.1 34.2Q188.1 34.1 190.8 34.2Q193.5 34.2 194.1 34.1Q194.8 33.9 195.1 33.6Q195.4 33.2 196.2 31.1Q197.1 29.0 197.6 28.6Q198.0 28.1 198.6 28.0Q199.2 27.9 205.4 27.9Q211.6 27.9 212.2 28.0Q212.9 28.1 213.3 28.5Q213.8 28.9 214.7 31.1Q215.6 33.2 215.9 33.6Q216.2 33.9 216.5 34.0Q216.8 34.1 220.8 34.1Q224.9 34.1 224.9 34.2Q225.0 34.2 225.9 34.2Q226.9 34.2 226.9 34.2Q227.0 34.1 227.8 34.1Q228.5 34.0 228.8 33.8Q229.0 33.5 228.9 32.8Q228.9 32.0 228.4 31.2Q228.0 30.4 226.5 26.9Q225.0 23.5 223.8 20.9Q222.5 18.4 222.4 17.9Q222.2 17.5 220.6 13.9Q218.9 10.2 218.7 9.6Q218.5 9.0 218.0 8.1Q217.5 7.1 216.6 4.9Q215.6 2.6 215.2 2.2Q214.9 1.9 214.3 1.6Q213.8 1.4 212.8 1.4Q211.9 1.4 211.8 1.4Q211.8 1.5 211.4 1.4Q211.1 1.4 204.2 1.4Q197.4 1.4 196.9 1.5Q196.5 1.6 196.2 1.8Q195.9 2.0 195.5 2.6Q195.1 3.2 194.4 5.1Q193.6 6.9 193.0 8.1Q192.4 9.2 192.3 9.6Q192.2 9.9 191.8 10.8Q191.2 11.8 190.9 12.6Q190.6 13.5 190.0 14.7Q189.4 15.9 189.2 16.4Q189.0 17.0 187.6 20.1Q186.1 23.1 186.0 23.6Q185.9 24.0 185.1 25.5Q184.4 27.0 184.2 27.6Q184.0 28.2 183.0 30.3ZM204.9 10.6Q205.4 10.1 205.5 10.1Q205.6 10.1 205.9 10.3Q206.1 10.5 208.1 14.7Q210.0 18.9 210.1 19.3Q210.1 19.8 209.8 20.1Q209.5 20.4 209.3 20.4Q209.1 20.5 208.4 20.5Q207.6 20.5 207.6 20.4Q207.5 20.4 207.1 20.4Q206.8 20.4 206.7 20.4Q206.6 20.5 204.2 20.5Q201.9 20.5 201.6 20.4Q201.4 20.2 201.2 20.0Q201.0 19.8 201.1 19.2Q201.1 18.6 202.8 14.9Q204.5 11.2 204.5 11.1Q204.5 11.0 204.9 10.6ZM94.5 1.8Q94.2 2.0 94.2 2.3Q94.2 2.6 94.8 3.4Q95.4 4.2 100.2 9.5Q105.1 14.8 105.9 15.7Q106.8 16.6 106.9 16.9Q107.0 17.2 106.9 17.6Q106.9 18.0 106.6 18.4Q106.4 18.8 105.3 19.9Q104.2 21.0 100.7 25.2Q97.1 29.5 95.9 30.8Q94.6 32.1 94.4 32.6Q94.1 33.0 94.1 33.2Q94.1 33.5 94.2 33.7Q94.4 33.9 94.9 34.1Q95.5 34.2 96.3 34.2Q97.1 34.2 97.2 34.2Q97.2 34.1 98.1 34.1Q98.9 34.1 98.9 34.2Q99.0 34.2 99.4 34.2Q99.9 34.2 99.9 34.2Q100.0 34.1 100.9 34.1Q101.9 34.1 101.9 34.2Q102.0 34.2 104.4 34.2Q106.8 34.1 106.8 34.2Q106.9 34.2 107.2 34.2Q107.5 34.2 107.9 34.1Q108.4 34.0 108.7 33.8Q109.0 33.6 109.4 33.2Q109.8 32.9 111.9 30.1Q114.1 27.2 114.4 26.9Q114.8 26.6 115.0 26.5Q115.2 26.4 115.6 26.4Q115.9 26.5 116.3 26.9Q116.8 27.4 117.8 28.8Q118.9 30.2 119.5 30.9Q120.1 31.6 120.4 32.1Q120.8 32.6 121.3 33.2Q121.9 33.8 122.3 33.9Q122.8 34.1 124.1 34.1Q125.4 34.1 125.4 34.2Q125.5 34.2 126.5 34.2Q127.5 34.2 127.6 34.2Q127.6 34.1 130.6 34.2Q133.6 34.2 133.7 34.2Q133.8 34.1 134.8 34.1Q135.9 34.1 136.2 33.9Q136.5 33.6 136.6 33.4Q136.6 33.2 136.6 33.1Q136.5 32.9 135.9 32.1Q135.4 31.2 133.5 29.2Q131.6 27.1 131.4 26.8Q131.1 26.4 129.1 24.0Q127.0 21.6 126.4 21.0Q125.8 20.4 124.8 19.2Q123.9 18.0 123.9 17.5Q123.9 17.0 124.1 16.6Q124.2 16.2 130.1 10.0Q135.9 3.8 136.2 3.3Q136.5 2.9 136.6 2.6Q136.6 2.4 136.6 2.1Q136.5 1.9 136.4 1.8Q136.2 1.6 135.9 1.5Q135.5 1.4 129.4 1.4Q123.2 1.4 122.8 1.5Q122.4 1.6 122.0 1.9Q121.6 2.1 121.2 2.6Q120.8 3.0 118.9 5.2Q117.1 7.5 116.5 8.1Q115.9 8.8 115.7 8.8Q115.5 8.9 115.1 8.8Q114.8 8.6 113.2 6.9Q111.8 5.2 110.8 4.1Q109.9 2.9 109.4 2.4Q109.0 2.0 108.5 1.8Q108.0 1.5 107.8 1.4Q107.5 1.4 101.3 1.4Q95.1 1.4 94.9 1.4Q94.8 1.5 94.5 1.8ZM0.6 1.8Q0.4 2.0 0.2 2.3Q0.1 2.6 0.1 14.7Q0.1 26.8 0.1 26.8Q0.0 26.9 0.0 27.2Q0.0 27.6 0.1 27.7Q0.1 27.8 0.1 30.4Q0.1 33.1 0.3 33.5Q0.5 33.9 0.7 34.0Q0.9 34.1 1.2 34.2Q1.5 34.2 4.2 34.2Q7.0 34.2 7.1 34.2Q7.1 34.1 8.2 34.1Q9.2 34.1 9.3 34.2Q9.4 34.2 10.5 34.2Q11.6 34.1 11.7 34.2Q11.8 34.2 12.1 34.2Q12.4 34.2 12.8 34.1Q13.1 33.9 13.2 33.7Q13.4 33.5 13.5 33.0Q13.6 32.5 13.6 24.7Q13.6 16.9 13.6 16.8Q13.5 16.8 13.5 16.1Q13.5 15.5 13.6 15.4Q13.6 15.4 13.6 15.0Q13.6 14.6 13.8 14.4Q14.0 14.1 14.2 14.2Q14.4 14.2 14.7 14.6Q15.0 15.0 17.2 19.4Q19.5 23.8 19.5 23.9Q19.5 24.0 20.4 25.8Q21.4 27.6 21.4 27.9Q21.5 28.1 21.6 28.2Q21.8 28.4 22.9 30.8Q24.1 33.1 24.4 33.4Q24.8 33.8 25.2 33.9Q25.6 34.1 26.0 34.1Q26.4 34.1 26.4 34.2Q26.5 34.2 27.4 34.2Q28.4 34.2 28.4 34.2Q28.5 34.1 29.4 34.1Q30.2 34.1 30.3 34.2Q30.4 34.2 34.8 34.2Q39.1 34.2 39.2 34.2Q39.2 34.1 40.8 34.1Q42.4 34.1 42.8 33.9Q43.1 33.6 43.2 33.4Q43.4 33.1 43.4 31.7Q43.4 30.2 43.4 30.2Q43.5 30.1 43.4 29.9Q43.4 29.6 43.4 29.2Q43.4 28.9 43.4 28.8Q43.5 28.8 43.5 16.1Q43.5 3.4 43.4 3.3Q43.4 3.2 43.4 2.9Q43.4 2.6 43.0 2.1Q42.6 1.6 42.2 1.5Q41.8 1.4 36.6 1.4Q31.4 1.4 31.2 1.4Q31.0 1.5 30.8 1.8Q30.5 2.0 30.4 2.4Q30.2 2.9 30.2 12.0Q30.2 21.1 30.2 21.2Q30.1 21.2 30.1 21.6Q30.1 21.9 29.9 22.1Q29.8 22.4 29.4 22.1Q29.1 21.9 28.4 20.3Q27.6 18.8 27.4 18.2Q27.2 17.6 26.8 16.9Q26.4 16.1 26.0 15.2Q25.6 14.2 24.2 11.4Q22.8 8.6 22.5 7.9Q22.2 7.2 22.0 6.9Q21.8 6.5 20.8 4.5Q19.9 2.5 19.5 2.1Q19.1 1.8 18.6 1.6Q18.0 1.4 9.7 1.4Q1.4 1.4 1.1 1.4Q0.9 1.5 0.6 1.8ZM138.4 9.2Q137.8 10.1 137.2 11.1Q136.8 12.1 136.3 13.3Q135.9 14.5 135.8 15.2Q135.8 16.0 135.7 16.1Q135.6 16.1 135.6 16.7Q135.6 17.2 135.6 17.3Q135.5 17.4 135.6 19.0Q135.8 20.6 136.3 22.2Q136.9 23.9 137.4 24.8Q137.9 25.6 138.5 26.5Q139.1 27.4 140.2 28.5Q141.4 29.6 142.9 30.8Q144.5 31.9 146.4 32.8Q148.4 33.8 150.3 34.4Q152.2 35.0 152.9 35.1Q153.5 35.1 154.2 35.3Q155.0 35.5 155.4 35.5Q155.8 35.5 155.8 35.6Q155.9 35.6 159.1 35.7Q162.2 35.8 162.3 35.7Q162.4 35.6 163.0 35.6Q163.6 35.6 163.7 35.6Q163.8 35.5 164.8 35.4Q165.8 35.2 166.1 35.1Q166.4 35.0 166.7 35.0Q167.0 35.0 168.7 34.5Q170.4 34.0 172.2 33.1Q174.1 32.2 175.0 31.7Q175.9 31.1 176.8 30.4Q177.6 29.8 178.8 28.5Q180.0 27.2 180.3 26.8Q180.6 26.2 180.7 25.8Q180.8 25.2 180.3 24.8Q179.9 24.4 179.1 24.1Q178.2 23.9 177.4 23.4Q176.5 23.0 175.7 22.8Q174.9 22.5 174.4 22.2Q174.0 22.0 173.7 21.9Q173.4 21.9 172.1 21.3Q170.9 20.8 170.6 20.8Q170.4 20.8 170.1 20.9Q169.8 21.0 168.8 22.0Q167.8 23.0 166.9 23.6Q166.0 24.2 165.0 24.7Q164.0 25.1 163.3 25.3Q162.6 25.5 161.8 25.6Q160.9 25.6 160.8 25.7Q160.8 25.8 159.1 25.7Q157.5 25.6 156.5 25.4Q155.5 25.1 153.9 24.4Q152.4 23.6 151.3 22.6Q150.2 21.5 149.8 20.8Q149.4 20.0 149.2 18.8Q149.0 17.5 149.1 17.4Q149.1 17.4 149.1 16.9Q149.1 16.5 149.6 15.5Q150.0 14.5 151.2 13.2Q152.5 12.0 153.5 11.4Q154.5 10.9 156.3 10.4Q158.1 9.9 159.8 9.9Q161.4 9.9 162.1 10.1Q162.9 10.4 163.4 10.4Q163.9 10.5 164.2 10.6Q164.6 10.8 165.8 11.4Q166.9 12.0 167.5 12.5Q168.1 13.0 168.8 13.7Q169.4 14.4 169.6 14.5Q169.9 14.6 170.6 14.6Q171.4 14.5 172.0 14.2Q172.6 13.9 175.0 13.1Q177.4 12.2 178.8 11.6Q180.2 11.0 180.5 10.8Q180.8 10.5 180.8 10.2Q180.9 9.9 180.8 9.6Q180.6 9.2 180.3 8.8Q180.0 8.4 178.7 7.1Q177.4 5.8 175.9 4.7Q174.4 3.6 172.3 2.6Q170.2 1.6 167.9 1.0Q165.5 0.4 164.8 0.3Q164.1 0.2 164.1 0.2Q164.0 0.1 163.2 0.1Q162.5 0.1 162.4 0.1Q162.4 0.0 159.6 0.0Q156.8 0.0 156.7 0.1Q156.6 0.1 156.1 0.1Q155.5 0.1 152.9 0.7Q150.2 1.2 148.2 2.1Q146.2 2.9 146.1 3.0Q146.0 3.1 145.2 3.5Q144.4 3.9 143.4 4.6Q142.4 5.2 140.8 6.8Q139.1 8.4 138.4 9.2ZM50.4 9.1Q49.6 10.1 48.9 11.5Q48.2 12.9 47.8 14.5Q47.4 16.1 47.4 17.9Q47.4 19.6 47.9 21.3Q48.4 23.0 49.0 24.2Q49.6 25.4 50.4 26.5Q51.2 27.6 52.3 28.7Q53.4 29.8 54.6 30.7Q55.9 31.6 57.7 32.6Q59.5 33.5 60.9 34.0Q62.4 34.5 63.6 34.8Q64.8 35.1 66.2 35.3Q67.6 35.5 67.7 35.6Q67.8 35.6 68.5 35.6Q69.2 35.6 69.3 35.7Q69.4 35.8 72.4 35.7Q75.4 35.6 75.4 35.6Q75.5 35.5 75.9 35.5Q76.2 35.5 77.9 35.2Q79.5 34.9 80.3 34.6Q81.1 34.2 81.9 34.1Q82.6 33.9 83.9 33.3Q85.2 32.8 87.4 31.4Q89.5 30.0 90.9 28.6Q92.4 27.1 93.1 26.0Q93.9 24.9 94.4 23.8Q94.9 22.8 95.1 21.9Q95.4 21.1 95.4 20.4Q95.5 19.8 95.6 19.7Q95.6 19.6 95.6 19.1Q95.6 18.5 95.7 18.4Q95.8 18.4 95.8 17.6Q95.8 16.9 95.7 16.8Q95.6 16.8 95.6 16.3Q95.6 15.9 95.4 15.0Q95.2 14.1 94.6 12.6Q94.0 11.0 93.0 9.6Q92.0 8.1 90.6 6.8Q89.1 5.4 87.8 4.5Q86.5 3.6 84.4 2.6Q82.2 1.6 79.8 1.0Q77.4 0.4 76.6 0.3Q75.9 0.2 75.8 0.2Q75.8 0.1 74.9 0.1Q74.0 0.1 73.9 0.1Q73.9 0.0 71.4 0.0Q68.9 0.0 68.8 0.1Q68.8 0.1 68.1 0.1Q67.5 0.1 67.4 0.2Q67.4 0.2 66.6 0.3Q65.9 0.4 63.6 0.9Q61.4 1.5 60.2 1.9Q59.1 2.4 57.4 3.2Q55.8 4.1 54.3 5.2Q52.9 6.4 52.0 7.2Q51.1 8.1 50.4 9.1ZM61.3 15.8Q61.6 15.0 61.8 14.7Q62.0 14.4 63.1 13.3Q64.1 12.2 65.6 11.5Q67.0 10.8 68.8 10.4Q70.5 10.0 71.6 10.0Q72.8 10.0 72.8 10.1Q72.9 10.1 73.5 10.2Q74.1 10.2 75.3 10.6Q76.5 10.9 77.2 11.2Q78.0 11.6 78.9 12.2Q79.8 12.9 80.2 13.3Q80.6 13.8 81.0 14.2Q81.4 14.8 81.7 15.4Q82.0 16.1 82.1 16.8Q82.1 17.5 82.2 17.6Q82.2 17.6 82.2 18.4Q82.1 19.1 81.8 20.0Q81.4 20.9 81.1 21.3Q80.8 21.8 80.1 22.4Q79.5 23.0 78.9 23.4Q78.2 23.9 77.5 24.2Q76.8 24.6 75.6 25.0Q74.5 25.4 73.6 25.4Q72.8 25.5 72.7 25.6Q72.6 25.6 71.6 25.6Q70.6 25.6 70.6 25.6Q70.5 25.5 69.6 25.4Q68.8 25.4 68.1 25.2Q67.4 25.0 66.2 24.5Q65.0 24.0 64.3 23.5Q63.6 23.0 62.8 22.1Q62.0 21.2 61.7 20.7Q61.4 20.1 61.1 19.0Q60.9 17.9 60.9 17.2Q61.0 16.5 61.3 15.8Z", "ww": 272.88, "wh": 35.75};
  const LOGO_GREEN = '#8eb943';
  let P2D = null;
  const paths = () => P2D || (P2D = { cat: new Path2D(LOGO.cat), eyes: new Path2D(LOGO.eyes), word: new Path2D(LOGO.word) });
  const ALLTEXT = JSON.stringify(CARDS) + JSON.stringify(TYPE) + JSON.stringify(SETS) + Object.values(TIERS).map(t => t.label).join('') +
    '基礎一階覺醒二階從傳奇特性剋制抵抗撤離指令卡夥伴道具裝備場地基本特殊資源每回合只能使用張先攻玩家的第一回合不能可以任意裝在你場上隻身上放到後雙方都適用有新會蓋掉舊進牌組數沒限制從手牌貼同名裡最多被擊倒時對手拿戰利品每包全種稀有度保底以上展示用頁面不涉及付款收藏撕開·●◆★✦○→×−—…+0123456789NoP./「」、，。：（） ' +
    '異色重生第二彈兩俠貓集結第一彈每包張全種稀有度保底以上展示用頁面不涉及付款收藏內含隨機卡片封面經典皇冠國王彩虹全息撕開·●◆★✦→×−+0123456789NoP./ ';
  const fontsReady = (document.fonts && document.fonts.load)
    ? Promise.race([
        Promise.all(['400', '500', '700', '900'].map(w => document.fonts.load(`${w} 20px "Noto Sans TC"`, ALLTEXT)).concat([
          document.fonts.load('800 30px Unbounded', 'NOXCATTCGCYBERCOLLECTIONSRUSEDITIONOYALH0123456789/'),
          document.fonts.load('600 16px Unbounded', 'NOXCATTCG0123456789/NP')
        ])),
        new Promise(r => setTimeout(r, 3500))
      ]).catch(() => {})
    : Promise.resolve();
  function rr(x, X, Y, W, H, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }
  function mixHex(a, b, t) { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(v * t + B[i] * (1 - t))).join(',')})`; }
  const NOSTART = '，。、！？：；）」』…';
  // CJK breaks anywhere; runs of latin letters/digits (NOXCAT, 24K, −30) stay whole
  function wrap(x, text, maxW) {
    const tokens = text.match(/[A-Za-z0-9+\-−×.%]+|./gu) || [];
    const lines = []; let line = '';
    for (const tk of tokens) {
      const t = line + tk;
      if (x.measureText(t).width > maxW && line.trim() && !NOSTART.includes(tk)) { lines.push(line.trimEnd()); line = tk === ' ' ? '' : tk; }
      else line = t;
    }
    if (line.trim()) lines.push(line.trimEnd());
    return lines;
  }
  function spaced(x, text, cx, y, gap) {
    const ws = [...text].map(ch => x.measureText(ch).width);
    const total = ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1);
    let px = cx - total / 2; x.textAlign = 'left';
    [...text].forEach((ch, i) => { x.fillText(ch, px, y); px += ws[i] + gap; });
  }
  function cover(x, img, X, Y, W, H, anchorTop) {
    if (!img) { x.fillStyle = '#1b1e16'; x.fillRect(X, Y, W, H); return; }
    const s = Math.max(W / img.width, H / img.height), w = img.width * s, h = img.height * s;
    x.drawImage(img, X + (W - w) / 2, anchorTop ? Y : Y + (H - h) / 2, w, h);
  }
  function blurFill(x, img, X, Y, W, H) {
    if (!img) return;
    const sm = document.createElement('canvas'); sm.width = 18; sm.height = 26;
    cover(sm.getContext('2d'), img, 0, 0, 18, 26);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(sm, X - W * 0.1, Y - H * 0.06, W * 1.2, H * 1.12);
  }
  function logoAt(x, cx, cy, size, glow, fill) {
    const P = paths();
    x.save(); x.translate(cx - size / 2, cy - size / 2);
    if (glow) { x.shadowColor = 'rgba(142,185,67,.75)'; x.shadowBlur = glow; }
    rr(x, 0, 0, size, size, size * 0.23); x.fillStyle = fill || LOGO_GREEN; x.fill(); x.shadowBlur = 0;
    const k = size * 0.76 / LOGO.cw;
    x.translate((size - LOGO.cw * k) / 2, (size - LOGO.ch * k) / 2 + size * 0.02); x.scale(k, k);
    x.fillStyle = '#1f1c1b'; x.fill(P.cat); x.fillStyle = '#ffffff'; x.fill(P.eyes);
    x.restore();
  }
  function markAt(x, X, Y, h, color, eye) {
    const P = paths(), k = h / LOGO.ch;
    x.save(); x.translate(X, Y); x.scale(k, k);
    x.fillStyle = color; x.fill(P.cat); x.fillStyle = eye || '#ffffff'; x.fill(P.eyes);
    x.restore();
    return LOGO.cw * k;
  }
  function wordAt(x, X, baseY, h, color, align) {
    const P = paths(), k = h / LOGO.wh, w = LOGO.ww * k;
    const x0 = align === 'center' ? X - w / 2 : align === 'right' ? X - w : X;
    x.save(); x.translate(x0, baseY - h); x.scale(k, k); x.fillStyle = color; x.fill(P.word, 'evenodd'); x.restore();
    return w;
  }
  function wordTCG(x, cx, baseY, h, color) {
    x.font = `800 ${Math.round(h * 0.95)}px ${FM}`;
    const tw = x.measureText('TCG').width, w = LOGO.ww * h / LOGO.wh, gap = h * 0.5;
    const x0 = cx - (w + gap + tw) / 2;
    wordAt(x, x0, baseY, h, color, 'left');
    x.fillStyle = color; x.textAlign = 'left'; x.fillText('TCG', x0 + w + gap, baseY);
  }
  function rainbow(x, x0, y0, x1, y1, a) {
    const g = x.createLinearGradient(x0, y0, x1, y1);
    [0, 50, 120, 190, 260, 320].forEach((h, i, arr) => g.addColorStop(i / (arr.length - 1), `hsla(${h},95%,68%,${a})`));
    return g;
  }
  function grad(x, x0, y0, x1, y1, stops) { const g = x.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
  function rng(seed) { let a = seed * 9301 + 49297; return () => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; }; }
  const RIM = {
    N: [[0, '#40443a'], [1, '#1c1f18']],
    B: [[0, '#40443a'], [1, '#1c1f18']],
    R: [[0, '#eef1f5'], [.25, '#9aa1ab'], [.5, '#f7f8fa'], [.75, '#7f8792'], [1, '#dfe3e8']],
    SR: [[0, '#f4f6fb'], [.3, '#a7b2c6'], [.5, '#ffffff'], [.7, '#9aa6bd'], [1, '#e7ecf5']],
    SSR: [[0, '#fff2ad'], [.28, '#d39a2c'], [.5, '#fff6cc'], [.72, '#b37814'], [1, '#ffe07f']],
    UR: [[0, '#f2fbff'], [.25, '#8fd0ff'], [.5, '#ffffff'], [.75, '#7fb6ff'], [1, '#d9f3ff']]
  };
  const PANEL = { N: '#121410', B: '#121410', R: '#111316', SR: '#0f1218', SSR: '#17120a' };
  const CW = 600, CH = 838;
  const SUBCOL = { 夥伴: '#ff9a6b', 道具: '#5fd0ff', 裝備: '#c48cff', 場地: '#7fd858' };
  const SUBRULE = {
    夥伴: '夥伴卡每回合只能使用 1 張。先攻玩家的第一回合不能使用。',
    道具: '道具卡每回合可以使用任意張。',
    裝備: '裝在你場上的 1 隻 NOXCAT 身上。每隻 NOXCAT 只能裝 1 張裝備卡。',
    場地: '放到場上後雙方都適用。場上只能有 1 張場地卡，新的會蓋掉舊的。'
  };
  const ENERGY_RULE = {
    basic: '基本資源放進牌組的張數沒有限制。每回合可以從手牌貼 1 張資源到你的 NOXCAT 身上。',
    special: '同名的特殊資源，牌組裡最多放 3 張。每回合可以從手牌貼 1 張資源到你的 NOXCAT 身上。'
  };
  const LEGEND_RULE = '傳奇 NOXCAT 被擊倒時，對手拿 2 張戰利品。';
  const STAGE = ['基礎', '一階覺醒', '二階覺醒'];
  const kindLabel = c => c.kind === 'cat' ? `${TYPE[c.type].name} NOXCAT` : c.kind === 'cmd' ? `指令卡・${c.sub}` : (c.basic ? '基本資源' : '特殊資源');
  const accentOf = c => c.kind === 'cmd' ? SUBCOL[c.sub] : c.type === 'any' ? '#b4f01e' : TYPE[c.type].c;

  function typeDot(x, t, cx, cy, r) {
    const A = TYPE[t];
    x.fillStyle = A.c; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = Math.max(1, r * 0.1); x.stroke();
    x.fillStyle = '#0d1203'; x.font = `900 ${Math.round(r * 1.08)}px ${FB}`; x.textAlign = 'center';
    x.fillText(A.n, cx, cy + r * 0.38);
  }
  function pill(x, text, X, baseY, col, fill, font) {
    x.font = font || `700 15px ${FB}`;
    const w = x.measureText(text).width + 22;
    rr(x, X, baseY - 17, w, 24, 12); x.fillStyle = fill || 'rgba(8,9,7,.6)'; x.fill();
    x.lineWidth = 1.5; x.strokeStyle = col; x.stroke();
    x.fillStyle = col; x.textAlign = 'left'; x.fillText(text, X + 11, baseY);
    return w;
  }
  function topLine(x, c, L, y) {
    x.textBaseline = 'alphabetic';
    const col = accentOf(c);
    let label, sub = '';
    if (c.kind === 'cat') { label = STAGE[c.stage]; if (c.from) sub = `從「${c.from}」覺醒`; }
    else if (c.kind === 'cmd') label = `指令卡・${c.sub}`;
    else label = c.basic ? '基本資源' : '特殊資源';
    let nx = L + pill(x, label, L, y, col) + 8;
    if (c.legend) {
      x.font = `800 15px ${FB}`;
      const w = x.measureText('傳奇').width + 22;
      rr(x, nx, y - 17, w, 24, 12); x.fillStyle = grad(x, nx, 0, nx + w, 0, [[0, '#ffe07f'], [0.5, '#fff6cc'], [1, '#d39a2c']]); x.fill();
      x.fillStyle = '#2a1d04'; x.textAlign = 'left'; x.fillText('傳奇', nx + 11, y);
      nx += w + 8;
    }
    if (sub) { x.font = `500 15px ${FB}`; x.fillStyle = '#c9cfbe'; x.textAlign = 'left'; x.fillText(sub, nx + 2, y); }
  }
  function drawHeader(x, c, L, R, base) {
    x.textBaseline = 'alphabetic';
    const tcx = R - 20, tcy = base - 13;
    let rightEdge;
    if (c.kind === 'cat') {
      typeDot(x, c.type, tcx, tcy, 20);
      const npX = R - 52;
      x.textAlign = 'right'; x.font = `800 32px ${FM}`; x.fillStyle = '#f2f5ea'; x.fillText(String(c.np), npX, base);
      const npW = x.measureText(String(c.np)).width;
      x.font = `600 14px ${FM}`; x.fillStyle = '#a8af9b'; x.fillText('NP', npX - npW - 6, base);
      rightEdge = npX - npW - 6 - x.measureText('NP').width - 14;
    } else if (c.kind === 'cmd') {
      x.fillStyle = SUBCOL[c.sub]; x.beginPath(); x.arc(tcx, tcy, 20, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#0d1203'; x.font = `900 20px ${FB}`; x.textAlign = 'center'; x.fillText(c.sub[0], tcx, tcy + 7);
      rightEdge = R - 54;
    } else {
      if (c.type === 'any') {
        x.fillStyle = rainbow(x, tcx - 20, 0, tcx + 20, 0, 1); x.beginPath(); x.arc(tcx, tcy, 20, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#0d1203'; x.font = `900 20px ${FB}`; x.textAlign = 'center'; x.fillText('特', tcx, tcy + 7);
      } else typeDot(x, c.type, tcx, tcy, 20);
      rightEdge = R - 54;
    }
    const nameMax = rightEdge - L;
    let fs = 38; x.font = `900 ${fs}px ${FB}`;
    while (x.measureText(c.name).width > nameMax && fs > 22) { fs -= 2; x.font = `900 ${fs}px ${FB}`; }
    x.textAlign = 'left'; x.fillStyle = '#f7faf0'; x.fillText(c.name, L, base);
  }
  function tierBadge(x, T, X, Y) {
    x.font = `800 17px ${FM}`; const tw = x.measureText(T.code).width;
    x.font = `700 15px ${FB}`; const lw = x.measureText(T.label).width;
    const w = tw + lw + 34;
    const col = T.code === 'SEC' ? rainbow(x, X, Y, X + w, Y, 1) : T.col;
    rr(x, X, Y, w, 32, 16); x.fillStyle = 'rgba(8,9,7,.8)'; x.fill();
    x.lineWidth = 1.5; x.strokeStyle = col; x.stroke();
    x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    x.font = `800 17px ${FM}`; x.fillStyle = col; x.fillText(T.code, X + 13, Y + 23);
    x.font = `700 15px ${FB}`; x.fillStyle = '#f2f5ea'; x.fillText(T.label, X + 21 + tw, Y + 22);
  }
  // one attack or ability; returns its height
  function moveBlock(x, m, L, R, y, s, dry) {
    let tx;
    if (m.ability) {
      x.font = `800 ${Math.round(15 * s)}px ${FB}`;
      const lw = x.measureText('特性').width + 18 * s;
      if (!dry) { rr(x, L, y + 7 * s, lw, 26 * s, 13 * s); x.fillStyle = '#e0483e'; x.fill(); x.fillStyle = '#fff'; x.textAlign = 'left'; x.fillText('特性', L + 9 * s, y + 25.5 * s); }
      tx = L + lw + 10 * s;
    } else {
      const step = 29 * s;
      if (!dry) m.cost.forEach((t, k) => typeDot(x, t, L + 14 * s + k * step, y + 20 * s, 13.5 * s));
      tx = L + m.cost.length * step + 8 * s;
    }
    if (!dry) {
      if (m.dmg) { x.font = `800 ${Math.round(30 * s)}px ${FM}`; x.textAlign = 'right'; x.fillStyle = '#f2f5ea'; x.fillText(m.dmg, R, y + 32 * s); }
      x.textAlign = 'left'; x.font = `900 ${Math.round(23 * s)}px ${FB}`; x.fillStyle = m.ability ? '#ff9a8f' : '#f2f5ea'; x.fillText(m.name, tx, y + 28 * s);
    }
    x.font = `400 ${Math.round(18 * s)}px ${FB}`;
    const lh = 24 * s, lines = m.text ? wrap(x, m.text, R - L - 22 * s) : [];
    if (!dry) { x.fillStyle = '#c3c9b6'; x.textAlign = 'left'; lines.forEach((l, j) => x.fillText(l, L + 2, y + 57 * s + j * lh)); }
    return Math.max(42 * s, 38 * s + lines.length * lh + (lines.length ? 6 * s : 0));
  }
  function statsRow(x, c, L, R, y, s) {
    const h = 34 * s, cy = y + h / 2, colW = (R - L) / 3;
    rr(x, L, y, R - L, h, 10 * s); x.fillStyle = 'rgba(255,255,255,.06)'; x.fill();
    x.strokeStyle = 'rgba(255,255,255,.08)'; x.lineWidth = 1; x.stroke();
    const lab = (t, X) => { x.font = `500 ${Math.round(14 * s)}px ${FB}`; x.fillStyle = '#a8af9b'; x.textAlign = 'left'; x.fillText(t, X, cy + 5 * s); return X + x.measureText(t).width + 8 * s; };
    const val = (t, X) => { x.font = `700 ${Math.round(15 * s)}px ${FM}`; x.fillStyle = '#f2f5ea'; x.textAlign = 'left'; x.fillText(t, X, cy + 5.5 * s); };
    const r = 10.5 * s;
    let X = lab('剋制', L + 12 * s); typeDot(x, WEAK[c.type], X + r, cy, r); val('×2', X + 2 * r + 5 * s);
    X = lab('抵抗', L + colW + 10 * s);
    const rs = (c.stage > 0 || c.legend) ? RESIST[c.type] : null;
    if (rs) { typeDot(x, rs, X + r, cy, r); val('−30', X + 2 * r + 5 * s); } else val('—', X);
    X = lab('撤離', L + colW * 2 + 8 * s);
    if (c.retreat) for (let i = 0; i < c.retreat; i++) typeDot(x, 'any', X + r + i * (2 * r + 3 * s), cy, r); else val('0', X);
    for (let i = 1; i < 3; i++) { x.fillStyle = 'rgba(255,255,255,.1)'; x.fillRect(L + colW * i, y + 7 * s, 1, h - 14 * s); }
    return h;
  }
  function oneLine(x, text, maxW) {
    if (x.measureText(text).width <= maxW) return text;
    let t = text; while (t.length > 1 && x.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }
  // the text half of a card; dry run measures only
  function drawBody(x, c, L, R, y, s, dry, withFlavor) {
    const y0 = y;
    if (c.kind === 'cat') {
      c.moves.forEach((m, i) => {
        y += moveBlock(x, m, L, R, y, s, dry);
        if (i < c.moves.length - 1) { if (!dry) { x.fillStyle = 'rgba(255,255,255,.09)'; x.fillRect(L, y + 4 * s, R - L, 2); } y += 12 * s; }
      });
      y += 8 * s;
      if (!dry) statsRow(x, c, L, R, y, s);
      y += 34 * s;
      if (c.legend) {
        x.font = `700 ${Math.round(15 * s)}px ${FB}`;
        if (!dry) { x.fillStyle = '#ffd77a'; x.textAlign = 'left'; x.fillText(oneLine(x, LEGEND_RULE, R - L), L + 2, y + 22 * s); }
        y += 28 * s;
      }
      if (withFlavor && c.flavor) {
        x.font = `400 ${Math.round(16 * s)}px ${FB}`;
        if (!dry) { x.fillStyle = '#b8bfab'; x.textAlign = 'left'; x.fillText(oneLine(x, c.flavor, R - L), L + 2, y + 24 * s); }
        y += 30 * s;
      }
    } else {
      x.font = `700 ${Math.round(22 * s)}px ${FB}`;
      const lines = wrap(x, c.text, R - L - 26 * s), lh = 32 * s;
      if (!dry) { x.fillStyle = '#f2f5ea'; x.textAlign = 'left'; lines.forEach((l, j) => x.fillText(l, L + 2, y + 28 * s + j * lh)); }
      y += 14 * s + lines.length * lh;
      const rule = c.kind === 'cmd' ? SUBRULE[c.sub] : ENERGY_RULE[c.basic ? 'basic' : 'special'];
      if (!dry) { x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(L, y + 4 * s, R - L, 2); }
      y += 10 * s;
      x.font = `400 ${Math.round(16 * s)}px ${FB}`;
      const rl = wrap(x, rule, R - L - 20 * s), rh = 23 * s;
      if (!dry) { x.fillStyle = '#a8af9b'; rl.forEach((l, j) => x.fillText(l, L + 2, y + 22 * s + j * rh)); }
      y += 8 * s + rl.length * rh;
    }
    return y - y0;
  }
  // pick a text scale (and whether the flavor line fits) for a body box
  function fitBody(x, c, L, R, avail) {
    for (const s of [1, .94, .88, .82, .76, .7, .64]) {
      if (drawBody(x, c, L, R, 0, s, true, true) <= avail) return { s, flavor: true };
      if (drawBody(x, c, L, R, 0, s, true, false) <= avail) return { s, flavor: false };
    }
    return { s: .6, flavor: false };
  }
  function footer(x, c, T, L, R, y) {
    x.textBaseline = 'alphabetic';
    x.font = `800 14px ${FM}`; x.textAlign = 'left';
    x.fillStyle = T.code === 'SEC' ? rainbow(x, L, 0, L + 90, 0, 1) : (T.code === 'N' || c.basic ? '#f2f5ea' : T.col);
    x.fillText(`${T.sym} ${T.code}`, L, y);
    x.font = `500 14px ${FB}`; x.fillStyle = '#a8af9b'; x.textAlign = 'center';
    x.fillText(`${SETS[c.set].label} · No.${c.no} · ${kindLabel(c)}`, CW / 2, y);
    x.font = `600 14px ${FM}`; x.textAlign = 'right'; x.fillText(`${c.sn}/${String(SETS[c.set].total).padStart(3, '0')}`, R, y);
  }
  function corners(x, X, Y, W, H, col, len) {
    x.strokeStyle = col; x.lineWidth = 3; x.lineCap = 'round';
    [[X, Y, 1, 1], [X + W, Y, -1, 1], [X, Y + H, 1, -1], [X + W, Y + H, -1, -1]].forEach(([cx, cy, sx, sy]) => {
      x.beginPath(); x.moveTo(cx, cy + sy * len); x.lineTo(cx, cy); x.lineTo(cx + sx * len, cy); x.stroke();
    });
    x.lineCap = 'butt';
  }
  const diamond = (x, cx, cy, r) => { x.beginPath(); x.moveTo(cx, cy - r); x.lineTo(cx + r, cy); x.lineTo(cx, cy + r); x.lineTo(cx - r, cy); x.closePath(); x.fill(); };
  // draw img into a window: cats keep the face (top), everything else is centred
  function artInto(x, img, a, anchor) {
    if (!img) { x.fillStyle = '#1b1e16'; x.fillRect(a.x, a.y, a.w, a.h); return; }
    const s = Math.max(a.w / img.width, a.h / img.height), w = img.width * s, h = img.height * s;
    x.drawImage(img, a.x + (a.w - w) / 2, a.y + (a.h - h) * anchor, w, h);
  }

  async function drawCardFace(c) {
    await fontsReady;
    const img = await loadArt(c.id);
    const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
    const x = cv.getContext('2d');
    const T = TIERS[c.tier];
    if (T.full) drawFull(x, c, T, img); else drawStd(x, c, T, img);
    return cv;
  }
  function drawStd(x, c, T, img) {
    const k = c.tier, acc = accentOf(c);
    rr(x, 0, 0, CW, CH, 30); x.fillStyle = grad(x, 0, 0, CW, CH, RIM[k]); x.fill();
    if (k === 'SR') { rr(x, 0, 0, CW, CH, 30); x.fillStyle = rainbow(x, 0, 0, CW, CH, 0.42); x.fill(); }
    rr(x, 18, 18, CW - 36, CH - 36, 16);
    x.fillStyle = grad(x, 0, 18, 0, 18 + (CH - 36) * 0.3, [[0, mixHex(acc, PANEL[k], 0.24)], [1, PANEL[k]]]); x.fill();
    if (k === 'N' || k === 'B') { x.strokeStyle = k === 'B' ? acc : 'rgba(180,240,30,.3)'; x.globalAlpha = k === 'B' ? 0.55 : 1; x.lineWidth = 2; rr(x, 25, 25, CW - 50, CH - 50, 12); x.stroke(); x.globalAlpha = 1; }
    if (k === 'R') { x.strokeStyle = 'rgba(230,234,240,.4)'; x.lineWidth = 2; rr(x, 25, 25, CW - 50, CH - 50, 12); x.stroke(); corners(x, 25, 25, CW - 50, CH - 50, '#b4f01e', 26); }
    if (k === 'SR') { x.strokeStyle = rainbow(x, 0, 0, CW, CH, 0.85); x.lineWidth = 2.5; rr(x, 25, 25, CW - 50, CH - 50, 12); x.stroke(); }
    if (k === 'SSR') {
      x.strokeStyle = '#e7b54a'; x.lineWidth = 2; rr(x, 25, 25, CW - 50, CH - 50, 12); x.stroke();
      x.strokeStyle = 'rgba(231,181,74,.45)'; x.lineWidth = 1.2; rr(x, 31, 31, CW - 62, CH - 62, 9); x.stroke();
      x.fillStyle = '#f5c451'; diamond(x, 300, 25, 8); diamond(x, 300, CH - 25, 8);
    }
    topLine(x, c, 40, 54);
    drawHeader(x, c, 40, CW - 40, 98);
    // art grows or shrinks so the text always fits
    const L = 40, R = CW - 40, top = 110, bottom = 786;
    const need = drawBody(x, c, L, R, 0, 1, true, c.kind === 'cat');
    const ah = Math.max(300, Math.min(c.kind === 'cat' ? 480 : 540, bottom - 12 - need - top));
    c._ah = ah;
    const fit = fitBody(x, c, L, R, bottom - (top + ah + 12));
    const a = { x: 34, y: top, w: 532, h: ah };
    x.save(); rr(x, a.x, a.y, a.w, a.h, 10); x.clip();
    artInto(x, img, a, c.kind === 'cat' || c.sub === '夥伴' ? 0.12 : 0.5);
    x.restore();
    if (k === 'N' || k === 'B') { x.lineWidth = 5; x.strokeStyle = '#2f3329'; rr(x, a.x + 2.5, a.y + 2.5, a.w - 5, a.h - 5, 9); x.stroke(); }
    if (k === 'R') { x.lineWidth = 6; x.strokeStyle = grad(x, a.x, a.y, a.x + a.w, a.y + a.h, RIM.R); rr(x, a.x + 3, a.y + 3, a.w - 6, a.h - 6, 9); x.stroke(); x.lineWidth = 1.5; x.strokeStyle = '#b4f01e'; rr(x, a.x + 7, a.y + 7, a.w - 14, a.h - 14, 6); x.stroke(); }
    if (k === 'SR') { x.lineWidth = 7; x.strokeStyle = '#f4f7ff'; rr(x, a.x + 3.5, a.y + 3.5, a.w - 7, a.h - 7, 9); x.stroke(); x.lineWidth = 2; x.strokeStyle = rainbow(x, a.x, a.y, a.x + a.w, a.y + a.h, 1); rr(x, a.x + 8, a.y + 8, a.w - 16, a.h - 16, 6); x.stroke(); }
    if (k === 'SSR') {
      x.lineWidth = 9; x.strokeStyle = grad(x, a.x, a.y, a.x + a.w, a.y + a.h, RIM.SSR); rr(x, a.x + 4.5, a.y + 4.5, a.w - 9, a.h - 9, 9); x.stroke();
      x.lineWidth = 2; x.strokeStyle = '#3a2a08'; rr(x, a.x + 10, a.y + 10, a.w - 20, a.h - 20, 5); x.stroke();
      x.fillStyle = '#fff2ad';
      [[a.x + 9, a.y + 9], [a.x + a.w - 9, a.y + 9], [a.x + 9, a.y + a.h - 9], [a.x + a.w - 9, a.y + a.h - 9]].forEach(([dx, dy]) => diamond(x, dx, dy, 9));
    }
    if (!c.basic) tierBadge(x, T, a.x + 16, a.y + a.h - 48);
    drawBody(x, c, L, R, a.y + a.h + 12, fit.s, false, fit.flavor);
    footer(x, c, T, L, R, CH - 30);
  }
  function drawFull(x, c, T, img) {
    const sec = T.code === 'SEC';
    rr(x, 0, 0, CW, CH, 30);
    x.fillStyle = sec ? rainbow(x, 0, 0, CW, CH, 1) : grad(x, 0, 0, CW, CH, RIM.UR); x.fill();
    const L = 46, R = CW - 46, bottom = 784;
    const need = drawBody(x, c, L, R, 0, 1, true, true);
    const pTop = Math.max(456, bottom - need - 12);
    const fit = fitBody(x, c, L, R, bottom - pTop - 12);
    x.save(); rr(x, 14, 14, CW - 28, CH - 28, 20); x.clip();
    x.fillStyle = '#08090a'; x.fillRect(0, 0, CW, CH);
    blurFill(x, img, 14, 14, CW - 28, CH - 28);
    x.fillStyle = 'rgba(6,7,8,.38)'; x.fillRect(0, 0, CW, CH);
    if (img) {
      const s = 572 / img.width, h = img.height * s;
      x.drawImage(img, 14, c.kind === 'cat' ? 46 : Math.min(60, (pTop - h) / 2 + 30), 572, h);
    }
    x.fillStyle = grad(x, 0, 14, 0, 170, [[0, 'rgba(6,7,8,.9)'], [1, 'rgba(6,7,8,0)']]); x.fillRect(0, 0, CW, 180);
    x.fillStyle = grad(x, 0, pTop - 140, 0, pTop + 20, [[0, 'rgba(6,7,8,0)'], [1, 'rgba(6,7,8,.9)']]); x.fillRect(0, pTop - 140, CW, CH);
    if (sec) {
      x.globalAlpha = 0.09; x.lineWidth = 2;
      for (let i = -CH; i < CW; i += 16) { x.strokeStyle = `hsl(${(i * 1.3 + 720) % 360},100%,70%)`; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + CH * 0.6, CH); x.stroke(); }
      x.globalAlpha = 1;
    } else {
      x.globalAlpha = 0.5; x.fillStyle = '#eafcff';
      const Rg = rng(9);
      for (let i = 0; i < 60; i++) { const px = 20 + Rg() * 560, py = 20 + Rg() * 560, s = 0.8 + Rg() * 2.2; x.beginPath(); x.moveTo(px, py - s * 3); x.lineTo(px + s, py); x.lineTo(px, py + s * 3); x.lineTo(px - s, py); x.closePath(); x.fill(); }
      x.globalAlpha = 1;
    }
    x.restore();
    x.lineWidth = sec ? 3 : 2; x.strokeStyle = sec ? rainbow(x, 0, CH, CW, 0, 0.95) : 'rgba(210,244,255,.75)';
    rr(x, 22, 22, CW - 44, CH - 44, 14); x.stroke();
    x.save(); x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = 10;
    topLine(x, c, 40, 56);
    drawHeader(x, c, 40, CW - 40, 100);
    x.restore();
    tierBadge(x, T, 40, 116);
    if (sec) {
      x.save(); x.translate(500, Math.min(pTop - 70, 520)); x.rotate(-0.22);
      x.lineWidth = 4; x.strokeStyle = rainbow(x, -56, 0, 56, 0, 1); x.beginPath(); x.arc(0, 0, 54, 0, Math.PI * 2); x.stroke();
      x.lineWidth = 1.5; x.beginPath(); x.arc(0, 0, 45, 0, Math.PI * 2); x.stroke();
      x.fillStyle = 'rgba(8,9,10,.55)'; x.beginPath(); x.arc(0, 0, 43, 0, Math.PI * 2); x.fill();
      x.fillStyle = rainbow(x, -40, 0, 40, 0, 1); x.textAlign = 'center';
      x.font = `800 15px ${FM}`; x.fillText('SECRET', 0, -2); x.font = `800 12px ${FM}`; x.fillText('RARE', 0, 16);
      x.restore();
    }
    rr(x, 30, pTop, CW - 60, 796 - pTop, 16); x.fillStyle = 'rgba(10,12,10,.66)'; x.fill();
    x.lineWidth = 1.2; x.strokeStyle = 'rgba(255,255,255,.14)'; x.stroke();
    drawBody(x, c, L, R, pTop + 6, fit.s, false, fit.flavor);
    footer(x, c, T, 40, CW - 40, CH - 30);
  }
  function drawCardBack() {
    const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
    const x = cv.getContext('2d');
    rr(x, 0, 0, CW, CH, 30); x.fillStyle = '#1b1e16'; x.fill();
    rr(x, 18, 18, CW - 36, CH - 36, 18);
    const g = x.createRadialGradient(300, 390, 0, 300, 390, 480); g.addColorStop(0, '#203109'); g.addColorStop(1, '#060705');
    x.fillStyle = g; x.fill();
    x.save(); x.clip();
    x.strokeStyle = 'rgba(180,240,30,.08)'; x.lineWidth = 1.5;
    const s = 26, h = s * Math.sqrt(3);
    for (let row = -1; row < CH / h + 2; row++) for (let col = -1; col < CW / (s * 1.5) + 2; col++) {
      const cx = col * s * 1.5, cy = row * h + (col % 2 ? h / 2 : 0);
      x.beginPath(); for (let i = 0; i < 6; i++) { const an = Math.PI / 3 * i; x[i ? 'lineTo' : 'moveTo'](cx + Math.cos(an) * s * 0.92, cy + Math.sin(an) * s * 0.92); } x.closePath(); x.stroke();
    }
    x.strokeStyle = 'rgba(180,240,30,.16)'; x.lineWidth = 3;
    [150, 200, 260].forEach(r => { x.beginPath(); x.arc(300, 350, r, 0, Math.PI * 2); x.stroke(); });
    x.restore();
    x.strokeStyle = 'rgba(180,240,30,.45)'; x.lineWidth = 3; rr(x, 30, 30, CW - 60, CH - 60, 14); x.stroke();
    corners(x, 44, 44, CW - 88, CH - 88, '#b4f01e', 34);
    logoAt(x, 300, 345, 210, 80);
    x.textBaseline = 'alphabetic';
    wordAt(x, 300, 566, 46, '#f2f5ea', 'center');
    x.fillStyle = 'rgba(242,245,234,.55)'; x.font = `600 15px ${FM}`; spaced(x, 'CYBERCAT COLLECTION', 300, 600, 5);
    x.fillStyle = 'rgba(242,245,234,.35)'; x.font = `600 13px ${FM}`; spaced(x, 'TRADING CARD GAME', 300, 760, 6);
    return cv;
  }
  return { CARDS, TYPE, TYPE_ORDER, WEAK, RESIST, TIERS, TIER_ORDER, SETS, STAGE, drawCardFace, drawCardBack, fontsReady, loadArt, logoAt, wordAt, rr };
})();
