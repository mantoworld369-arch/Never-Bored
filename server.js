const express = require("express");
const app = express();
app.use(express.json());

const SYSTEM_PROMPT = `You are a topic generator for a curiosity app. Generate exactly 20 unique, fascinating topics spanning all human knowledge — science, history, nature, culture, philosophy, food, mathematics, technology, art, language, psychology, space, and more.

Avoid repeating any topics from the provided exclusion list.

Respond ONLY with a valid JSON array of 20 objects. No markdown, no backticks, no explanation. Each object must have exactly these fields:
{
  "category": "one lowercase word",
  "title_en": "Topic Name (3-6 words)",
  "title_zh": "Traditional Chinese title",
  "summary_en": "2-3 sentence summary in English",
  "summary_zh": "2-3 sentence summary in Traditional Chinese",
  "fun_en": "One sentence on why this is fascinating, in English",
  "fun_zh": "One sentence in Traditional Chinese on why this is fascinating",
  "search": "best YouTube search query for this topic"
}`;

app.post("/api/topics", async (req, res) => {
  const { exclude = [] } = req.body;
  const userPrompt = exclude.length
    ? `Generate 20 fascinating topics. Do NOT include any of these: ${exclude.join(", ")}.`
    : "Generate 20 fascinating topics from across all domains of human knowledge.";

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://never-bored.onrender.com",
        "X-Title": "Never Bored"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct:free",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 8000,
        temperature: 1.0
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("OpenRouter error:", data);
      return res.status(500).json({ error: data.error?.message || "OpenRouter error" });
    }

    const raw = data.choices?.[0]?.message?.content || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const topics = JSON.parse(clean);
    if (!Array.isArray(topics) || topics.length === 0) throw new Error("Invalid format");
    res.json({ topics });
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: "Failed to generate topics" });
  }
});

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>never bored</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0a0a0a;--surface:#111;--border:#252525;--border-hover:#383838;--text-primary:#e8e8e8;--text-secondary:#888;--text-muted:#555;--accent-like:#c0555a;--accent-yt:#c03030;--accent-google:#3a6fbf}
body{background:var(--bg);color:var(--text-primary);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:2rem 1rem 4rem}
#app{width:100%;max-width:480px;display:flex;flex-direction:column;align-items:center}
.screen{display:none;width:100%;flex-direction:column;align-items:center}
.screen.active{display:flex}
#bored-screen{min-height:80vh;justify-content:center;gap:12px}
.bored-btn{background:var(--surface);color:var(--text-primary);border:0.5px solid #3a3a3a;border-radius:999px;padding:18px 56px;font-size:17px;font-weight:500;cursor:pointer;transition:background .15s,transform .1s;font-family:inherit}
.bored-btn:hover{background:#1e1e1e}
.bored-btn:active{transform:scale(0.97)}
.bored-hint{font-size:12px;color:var(--text-muted)}
.tabs{display:flex;gap:3px;margin-bottom:1.5rem;background:#0e0e0e;border-radius:999px;padding:4px;border:0.5px solid var(--border)}
.tab{padding:7px 22px;font-size:13px;border-radius:999px;cursor:pointer;color:var(--text-muted);background:transparent;border:none;font-family:inherit;transition:all .15s}
.tab.active{background:#222;color:var(--text-primary)}
.status-bar{width:100%;display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;padding:0 2px}
.status-tag{font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.07em}
.status-badge{font-size:11px;color:#3a3a3a;display:flex;align-items:center;gap:4px}
.dot{width:6px;height:6px;border-radius:50%;background:#333}
.dot.pulse{background:#4a7a4a;animation:pulse 1.4s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.topic-card{background:var(--surface);border:0.5px solid var(--border);border-radius:16px;padding:1.5rem;width:100%;margin-bottom:1rem}
.topic-category{font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
.topic-title-en{font-size:21px;font-weight:500;color:#ebebeb;line-height:1.3;margin-bottom:4px}
.topic-title-zh{font-size:15px;color:#666;margin-bottom:1rem}
.divider{height:0.5px;background:var(--border);margin:1rem 0}
.summary-en{font-size:14px;line-height:1.75;color:#c0c0c0;margin-bottom:.6rem}
.summary-zh{font-size:13px;line-height:1.75;color:#5e5e5e}
.fun-label{font-size:10px;color:#3e3e3e;text-transform:uppercase;letter-spacing:.1em;margin:1rem 0 6px}
.fun-en{font-size:13px;color:#888;line-height:1.65;margin-bottom:4px;font-style:italic}
.fun-zh{font-size:12px;color:#484848;line-height:1.65;font-style:italic}
.action-row{display:flex;gap:8px;width:100%;margin-bottom:.75rem}
.action-btn{flex:1;padding:11px 0;border-radius:999px;border:0.5px solid var(--border);background:#0e0e0e;color:var(--text-secondary);font-size:13px;cursor:pointer;transition:all .15s;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:5px}
.action-btn:hover{background:#181818;border-color:var(--border-hover);color:var(--text-primary)}
.like-btn:hover{border-color:var(--accent-like);color:#d97070}
.dislike-btn:hover{border-color:#3a3a3a;color:#555}
.yt-btn:hover{border-color:var(--accent-yt);color:#d06060}
.google-btn:hover{border-color:var(--accent-google);color:#6a9ae0}
.like-btn.active{border-color:var(--accent-like);color:#d97070;background:#1a1010}
.next-btn{width:100%;padding:12px;border-radius:999px;border:0.5px solid var(--border);background:#0e0e0e;color:#666;font-size:14px;cursor:pointer;transition:all .15s;font-family:inherit}
.next-btn:hover{background:#181818;color:var(--text-primary);border-color:var(--border-hover)}
.next-btn:disabled{opacity:.4;cursor:not-allowed}
.skeleton-card{background:var(--surface);border:0.5px solid var(--border);border-radius:16px;padding:1.5rem;width:100%;margin-bottom:1rem}
.skel{background:#1a1a1a;border-radius:4px;margin-bottom:10px;animation:shimmer 1.5s ease-in-out infinite}
@keyframes shimmer{0%,100%{opacity:.5}50%{opacity:1}}
.list-empty{font-size:14px;color:var(--text-muted);text-align:center;padding:4rem 0}
.list-item{background:var(--surface);border:0.5px solid var(--border);border-radius:12px;padding:1rem 1.25rem;width:100%;margin-bottom:8px;position:relative}
.li-title-en{font-size:14px;font-weight:500;color:#d0d0d0;padding-right:28px}
.li-title-zh{font-size:12px;color:#555;margin-top:3px}
.li-summary{font-size:12px;color:#777;margin-top:8px;line-height:1.55}
.li-remove{position:absolute;top:10px;right:12px;background:none;border:none;cursor:pointer;color:#333;font-size:14px;line-height:1;font-family:inherit}
.li-remove:hover{color:#666}
.li-links{display:flex;gap:6px;margin-top:10px}
.li-link{font-size:11px;padding:4px 12px;border-radius:999px;border:0.5px solid var(--border);background:transparent;color:#555;text-decoration:none;transition:all .12s}
.li-link:hover{border-color:var(--border-hover);color:#aaa}
#toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e1e1e;color:#bbb;border:0.5px solid #333;padding:9px 22px;border-radius:999px;font-size:13px;opacity:0;transition:opacity .2s;pointer-events:none;white-space:nowrap;z-index:100}
@media(max-width:520px){body{padding:1.5rem .75rem 4rem}.topic-title-en{font-size:18px}}
</style>
</head>
<body>
<div id="app">
  <div id="bored-screen" class="screen active">
    <button class="bored-btn" onclick="start()">i'm bored</button>
    <span class="bored-hint">discover something new</span>
  </div>
  <div id="main-screen" class="screen">
    <div class="tabs">
      <button class="tab active" onclick="switchTab('discover',this)">discover</button>
      <button class="tab" onclick="switchTab('liked',this)">liked</button>
      <button class="tab" onclick="switchTab('history',this)">history</button>
    </div>
    <div id="discover-view" style="width:100%">
      <div class="status-bar">
        <span class="status-tag" id="status-category"></span>
        <span class="status-badge"><span class="dot" id="status-dot"></span><span id="status-text"></span></span>
      </div>
      <div id="skeleton-card" class="skeleton-card">
        <div class="skel" style="height:11px;width:60px"></div>
        <div class="skel" style="height:22px;width:75%;margin-top:8px"></div>
        <div class="skel" style="height:15px;width:45%"></div>
        <div style="height:0.5px;background:#1e1e1e;margin:16px 0"></div>
        <div class="skel" style="height:13px;width:100%"></div>
        <div class="skel" style="height:13px;width:90%"></div>
        <div class="skel" style="height:13px;width:80%"></div>
      </div>
      <div id="topic-card" class="topic-card" style="display:none"></div>
      <div class="action-row">
        <button class="action-btn like-btn" id="like-btn" onclick="likeTopic()">&#9825; like</button>
        <button class="action-btn dislike-btn" onclick="dislikeTopic()">&#10005; not for me</button>
      </div>
      <div class="action-row">
        <button class="action-btn yt-btn" onclick="openYT()">&#9654; youtube</button>
        <button class="action-btn google-btn" onclick="openGoogle()">&#8853; google</button>
      </div>
      <button class="next-btn" id="next-btn" onclick="showNext()">next topic &#8594;</button>
    </div>
    <div id="liked-view" style="display:none;width:100%"><div id="liked-list"></div></div>
    <div id="history-view" style="display:none;width:100%"><div id="history-list"></div></div>
  </div>
</div>
<div id="toast"></div>
<script>
let queue=[],seen=0,current=null,fetching=false,allSeen=[],disliked=[],liked=[],history=[];

async function start(){
  document.getElementById('bored-screen').classList.remove('active');
  document.getElementById('main-screen').classList.add('active');
  await fetchBatch();
  showNext();
}

async function fetchBatch(){
  if(fetching)return;
  fetching=true;setFetchStatus('fetching');
  try{
    const res=await fetch('/api/topics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({exclude:allSeen.slice(0,80)})});
    const data=await res.json();
    if(data.topics){
      const fresh=data.topics.filter(t=>!disliked.includes(t.title_en));
      queue.push(...fresh);
    }
  }catch(e){console.error('Fetch error:',e);}
  fetching=false;setFetchStatus('idle');
}

async function showNext(){
  document.getElementById('next-btn').disabled=true;
  if(queue.length<=10&&!fetching)fetchBatch();
  if(queue.length===0){
    setFetchStatus('fetching');
    while(queue.length===0&&fetching)await sleep(300);
  }
  const next=queue.shift();
  if(!next){document.getElementById('next-btn').disabled=false;return;}
  current=next;seen++;allSeen.push(next.title_en);history.unshift(next);
  renderTopic(next);
  document.getElementById('next-btn').disabled=false;
  if(seen%10===0&&!fetching)fetchBatch();
}

function renderTopic(t){
  document.getElementById('skeleton-card').style.display='none';
  const card=document.getElementById('topic-card');
  card.style.display='block';
  card.innerHTML='<div class="topic-category">'+t.category+'</div>'
    +'<div class="topic-title-en">'+t.title_en+'</div>'
    +'<div class="topic-title-zh">'+t.title_zh+'</div>'
    +'<div class="divider"></div>'
    +'<div class="summary-en">'+t.summary_en+'</div>'
    +'<div class="summary-zh">'+t.summary_zh+'</div>'
    +'<div class="fun-label">why it\'s fascinating</div>'
    +'<div class="fun-en">'+t.fun_en+'</div>'
    +'<div class="fun-zh">'+t.fun_zh+'</div>';
  document.getElementById('status-category').textContent=t.category;
  const lb=document.getElementById('like-btn');
  lb.classList.remove('active');lb.innerHTML='&#9825; like';
}

function likeTopic(){
  if(!current)return;
  const lb=document.getElementById('like-btn');
  if(liked.find(l=>l.title_en===current.title_en)){
    liked=liked.filter(l=>l.title_en!==current.title_en);
    lb.classList.remove('active');lb.innerHTML='&#9825; like';showToast('removed from liked');
  }else{
    liked.unshift(current);lb.classList.add('active');lb.innerHTML='&#9829; liked';showToast('saved &#9825;');
  }
}

function dislikeTopic(){
  if(!current)return;
  disliked.push(current.title_en);
  queue=queue.filter(t=>!disliked.includes(t.title_en));
  showToast('got it - never again');showNext();
}

function openYT(){if(!current)return;window.open('https://www.youtube.com/results?search_query='+encodeURIComponent(current.search),'_blank');}
function openGoogle(){if(!current)return;window.open('https://www.google.com/search?q='+encodeURIComponent(current.title_en),'_blank');}

function switchTab(tab,btn){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('discover-view').style.display=tab==='discover'?'block':'none';
  document.getElementById('liked-view').style.display=tab==='liked'?'block':'none';
  document.getElementById('history-view').style.display=tab==='history'?'block':'none';
  if(tab==='liked')renderLiked();
  if(tab==='history')renderHistory();
}

function makeLink(t,removeFn){
  return '<div class="list-item">'
    +(removeFn?'<button class="li-remove" onclick="'+removeFn+'">&#10005;</button>':'')
    +'<div class="li-title-en">'+t.title_en+'</div>'
    +'<div class="li-title-zh">'+t.title_zh+'</div>'
    +'<div class="li-summary">'+t.summary_en+'</div>'
    +'<div class="li-links">'
    +'<a class="li-link" href="https://www.youtube.com/results?search_query='+encodeURIComponent(t.search)+'" target="_blank">&#9654; youtube</a>'
    +'<a class="li-link" href="https://www.google.com/search?q='+encodeURIComponent(t.title_en)+'" target="_blank">&#8853; google</a>'
    +'</div></div>';
}

function renderLiked(){
  const el=document.getElementById('liked-list');
  el.innerHTML=liked.length?liked.map((t,i)=>makeLink(t,'removeLiked('+i+')')).join(''):'<div class="list-empty">no liked topics yet</div>';
}
function removeLiked(i){liked.splice(i,1);renderLiked();}
function renderHistory(){
  const el=document.getElementById('history-list');
  el.innerHTML=history.length?history.map(t=>makeLink(t,null)).join(''):'<div class="list-empty">no history yet</div>';
}

function setFetchStatus(state){
  const dot=document.getElementById('status-dot'),txt=document.getElementById('status-text');
  if(state==='fetching'){dot.classList.add('pulse');txt.textContent='loading more';}
  else{dot.classList.remove('pulse');txt.textContent=queue.length+' ready';}
}

let toastTimer;
function showToast(msg){
  const t=document.getElementById('toast');t.innerHTML=msg;t.style.opacity='1';
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.style.opacity='0',2000);
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
</script>
</body>
</html>`;

app.get("/", (req, res) => res.send(HTML));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Never Bored on port " + PORT));
