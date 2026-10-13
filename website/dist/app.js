// The page reads a local data snapshot. It does not fetch market data or choose weights.
'use strict';
let data, selected, visible = new Set(), allocation = 'optimised', chartState;
const colors = ['#47735e', '#bd8b42', '#8598aa'];
const firms = {BE:['Bloom Energy','Fuel cells'],CVX:['Chevron','Oil & gas'],XOM:['ExxonMobil','Oil & gas'],NEE:['NextEra Energy','Power & renewables'],VST:['Vistra','Power generation'],SHEL:['Shell','Oil & gas']};
const allocationColors=['#b6caba','#d4c6a9','#819887','#345846','#a4b4ab','#b6c2a0'];
const figures = [
 ['1_growth','Asset growth','A common starting point','Each asset starts at 100. The logarithmic scale helps compare proportional changes.'],
 ['2_rolling_volatility','Rolling volatility','How risk changes over time','Daily returns, a 63-day window and annualisation using √252.'],
 ['3_correlation','Return correlations','What moves together','Monthly returns reveal relationships within the energy universe and against SPY.'],
 ['4_frontier','Portfolio possibilities','2,000 ways to allocate','Training-period samples, coloured by Sharpe, with minimum variance and equal weight marked.'],
 ['5_out_of_sample','The out-of-sample test','The period the model never saw','Weights selected through 2022, applied to subsequent monthly returns.'],
 ['6_weights','The final allocation','Risk shapes the weights','Long-only targets sum to 100%. Zero-weight assets remain part of the research universe.']
];
const $ = id => document.getElementById(id);
const pct = n => Number.isFinite(n) ? `${(n*100).toFixed(2)}%` : '—';
const number = n => Number.isFinite(n) ? n.toFixed(3) : '—';
const month = s => new Date(s+'T12:00:00').toLocaleDateString('en-GB',{month:'short',year:'numeric'});
const strategyNames = () => Object.keys(data.metrics);
const colorFor = name => colors[strategyNames().indexOf(name)%colors.length];
function metrics(){
 const m=data.metrics[selected];
 const items=[['Annual return',pct(m.annual_return),'Arithmetic mean · annualised'],['Annual volatility',pct(m.annual_volatility),'Standard deviation · annualised'],['Sharpe ratio',number(m.sharpe),`${pct(data.risk_free)} risk-free assumption`],['Maximum drawdown',pct(m.max_drawdown),'Peak to trough · month ends']];
 $('metrics').innerHTML=items.map(([name,value,note])=>`<article class="metric"><span class="metric-label">${name}</span><strong>${value}</strong><small>${note}</small></article>`).join('');
 document.querySelectorAll('[data-strategy]').forEach(b=>{const on=b.dataset.strategy===selected;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
 $('scorecard').innerHTML=strategyNames().map(name=>{const m=data.metrics[name];return `<tr class="${name===selected?'selected':''}"><td><span class="dot" style="background:${colorFor(name)}"></span> ${name}</td><td>${pct(m.annual_return)}</td><td>${pct(m.annual_volatility)}</td><td>${number(m.sharpe)}</td><td>${pct(m.max_drawdown)}</td></tr>`;}).join('');
}
function holdings(){
 const tickers=Object.keys(data.weights), weights=tickers.map(t=>allocation==='equal'?1/tickers.length:data.weights[t]);
 let total=0;
 $('donut').style.background=`conic-gradient(${weights.map((w,i)=>{const a=total;total+=w*100;return `${allocationColors[i]} ${a}% ${total}%`;}).join(',')})`;
 $('holdings-count').textContent=weights.filter(w=>w>1e-6).length;
 $('donut').setAttribute('aria-label',`${allocation==='equal'?'Equal-weight':'Optimised'} allocation: ${tickers.map((t,i)=>`${t} ${pct(weights[i])}`).join(', ')}`);
 $('holdings').innerHTML=tickers.map((t,i)=>`<tr><td><div class="company"><span class="ticker-icon">${t}</span><div>${firms[t]?.[0]||t}<small>${t} · USD</small></div></div></td><td class="exposure">${firms[t]?.[1]||'Energy'}</td><td class="right weight-cell">${pct(weights[i])}<div class="weight-track"><span style="width:${weights[i]*100}%"></span></div></td></tr>`).join('');
 document.querySelectorAll('[data-allocation]').forEach(b=>{const on=b.dataset.allocation===allocation;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
}
function renderLegend(){
 $('legend').innerHTML=strategyNames().map(name=>`<button class="legend-button" data-series="${name}" aria-pressed="${visible.has(name)}"><span class="dot" style="background:${colorFor(name)}"></span>${name}</button>`).join('');
 $('legend').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{const n=b.dataset.series;if(visible.has(n)&&visible.size>1)visible.delete(n);else visible.add(n);renderLegend();renderChart();}));
}
function renderChart(){
 const source=data.growth[data.fund], windowSize=$('range').value;
 const start=windowSize==='all'?0:Math.max(0,source.length-1-Number(windowSize));
 // Rebase to 100 at the selected window's start; headline statistics stay full-period.
 const lines=strategyNames().filter(n=>visible.has(n)).map(name=>({name,points:data.growth[name].slice(start).map(p=>({date:p.date,value:p.value/data.growth[name][start].value*100}))}));
 const width=Math.max($('growth-chart').clientWidth,250),height=$('growth-chart').clientHeight;
 const pad={left:38,right:12,top:18,bottom:28}, values=lines.flatMap(l=>l.points.map(p=>p.value));
 const low=Math.floor(Math.min(...values)/25)*25, high=Math.ceil(Math.max(...values)/25)*25+10;
 const count=lines[0].points.length;
 const x=i=>pad.left+i/(count-1)*(width-pad.left-pad.right);
 const y=v=>height-pad.bottom-(v-low)/(high-low)*(height-pad.top-pad.bottom);
 let svg=`<svg viewBox="0 0 ${width} ${height}" role="presentation">`;
 for(let k=0;k<5;k++){const v=low+(high-low)*k/4,yy=y(v);svg+=`<line x1="${pad.left}" x2="${width-pad.right}" y1="${yy}" y2="${yy}" stroke="#e8ece5"/><text x="${pad.left-9}" y="${yy+3}" text-anchor="end" fill="#7c857d" font-size="9">${Math.round(v)}</text>`;}
 const ticks=width<500?3:6;
 for(let k=0;k<ticks;k++){const i=Math.round(k*(count-1)/(ticks-1));svg+=`<text x="${x(i)}" y="${height-4}" text-anchor="${k===0?'start':k===ticks-1?'end':'middle'}" fill="#7c857d" font-size="9">${month(lines[0].points[i].date)}</text>`;}
 for(const l of lines){const path=l.points.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`).join(' ');svg+=`<path d="${path}" fill="none" stroke="${colorFor(l.name)}" stroke-width="${l.name===selected?2.7:1.8}" ${l.name===data.benchmark?'stroke-dasharray="5 4"':''} stroke-linejoin="round"/>`;}
 svg+='<g id="crosshair"></g></svg>';
 $('growth-chart').innerHTML=svg;chartState={lines,x,y,width,height,pad,count,index:count-1};
 $('range-note').textContent=start===0?'All strategies start at 100.':'Chart rebased to 100 at window start. Headline metrics remain full-period.';
 inspect(count-1);
}
function inspect(index){
 const c=chartState;if(!c)return;c.index=Math.min(c.count-1,Math.max(0,index));
 const date=c.lines[0].points[c.index].date;
 $('chart-detail').innerHTML=`<b>${month(date)}</b>`+c.lines.map(l=>`<span><span class="dot" style="background:${colorFor(l.name)}"></span> ${l.name}: <b>${l.points[c.index].value.toFixed(2)}</b></span>`).join('');
 $('crosshair').innerHTML=`<line x1="${c.x(c.index)}" x2="${c.x(c.index)}" y1="${c.pad.top}" y2="${c.height-c.pad.bottom}" stroke="#cbd3ca" stroke-dasharray="3 4"/>`+c.lines.map(l=>`<circle cx="${c.x(c.index)}" cy="${c.y(l.points[c.index].value)}" r="3.5" fill="${colorFor(l.name)}" stroke="white" stroke-width="1.5"/>`).join('');
}
function download(){
 const rows=[['Strategy','Annual arithmetic return','Annual volatility','Sharpe','Monthly max drawdown','Test start','Test end']];
 for(const [name,m]of Object.entries(data.metrics))rows.push([name,m.annual_return,m.annual_volatility,m.sharpe,m.max_drawdown,data.test_start,data.test_end]);
 const csv=rows.map(row=>row.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='energy-mix-factsheet.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function research(){
 $('research-grid').innerHTML=figures.map(([id,title,sub,desc],i)=>`<button class="figure-card" data-figure="${i}" aria-label="Open figure ${i+1}: ${title}"><img src="figures/${id}.png" alt="${title} chart" loading="lazy"><div class="figure-copy"><span>FIGURE 0${i+1} / ${sub.toUpperCase()}</span><h3>${title} ↗</h3><p>${desc}</p></div></button>`).join('');
 document.querySelectorAll('[data-figure]').forEach(b=>b.addEventListener('click',()=>{const [id,title,,desc]=figures[Number(b.dataset.figure)];$('figure-title').textContent=title;$('figure-image').src=`figures/${id}.png`;$('figure-image').alt=title;$('figure-caption').textContent=desc;$('figure-dialog').showModal();}));
}
async function init(){
 try{
  const response=await fetch('results.json',{cache:'no-store'});if(!response.ok)throw new Error('Data snapshot unavailable');data=await response.json();
  if(!data.metrics?.[data.fund]||!data.growth?.[data.fund]?.length)throw new Error('Invalid data snapshot');
  selected=data.fund;visible=new Set(strategyNames());
  $('period').textContent=`${month(data.test_start)} — ${month(data.test_end)}`;
  $('updated').textContent=`Prices through ${data.price_end} · snapshot ${new Date(data.generated_at).toLocaleDateString('en-GB')}`;
  $('strategy-tabs').innerHTML=strategyNames().map(n=>`<button data-strategy="${n}" aria-pressed="${n===selected}">${n}</button>`).join('');
  document.querySelectorAll('[data-strategy]').forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.strategy;metrics();renderChart();}));
  document.querySelectorAll('[data-allocation]').forEach(b=>b.addEventListener('click',()=>{allocation=b.dataset.allocation;holdings();}));
  const f=data.metrics[data.fund],e=data.metrics['Equal weight'];
  $('takeaway').textContent=`The optimised fund delivered ${f.annual_volatility<e.annual_volatility?'lower':'higher'} volatility than equal weighting (${pct(f.annual_volatility)} vs ${pct(e.annual_volatility)}), with ${f.annual_return<e.annual_return?'lower':'higher'} annualised arithmetic return (${pct(f.annual_return)} vs ${pct(e.annual_return)}). Risk reduction and return leadership are different objectives.`;
  metrics();holdings();renderLegend();renderChart();research();
  $('download').disabled=false;$('download').addEventListener('click',download);
  $('range').addEventListener('change',renderChart);
  new ResizeObserver(()=>renderChart()).observe($('growth-chart'));
  $('growth-chart').addEventListener('pointermove',event=>{const r=$('growth-chart').getBoundingClientRect();const c=chartState;inspect(Math.round((event.clientX-r.left-c.pad.left)/(c.width-c.pad.left-c.pad.right)*(c.count-1)));});
  $('growth-chart').addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();inspect(chartState.index+(event.key==='ArrowRight'?1:-1));}});
  $('close-dialog').addEventListener('click',()=>$('figure-dialog').close());
 }catch(error){$('load-error').hidden=false;$('load-error').textContent='The results could not be loaded. Run python fund_project.py, then python serve_dashboard.py, and open the printed local URL. '+error.message;}
}
init();
