
import React,{useEffect,useMemo,useState} from 'react';
import { Sparkles, RotateCcw, Shuffle, Plus, ArrowDownToLine, Trophy, Brain, Info, X, Check, Undo2 } from 'lucide-react';
import { createGame,drawTile,applyHumanMove,aiTurn,shuffle,isValidGroup,points,COLORS } from './game';

const colorNames={red:'אדום',blue:'כחול',black:'שחור',orange:'כתום'};
function Tile({tile,selected,onClick,small=false,draggable=false,onDragStart}){
  return <button draggable={draggable} onDragStart={onDragStart} onClick={onClick} className={`tile ${tile.joker?'joker':tile.color} ${selected?'selected':''} ${small?'small':''}`} aria-label={tile.joker?'ג׳וקר':`${tile.value} ${colorNames[tile.color]||''}`}>
    {tile.joker?<span className="joker-mark">★</span>:tile.value}
  </button>
}
function App(){
  const [count,setCount]=useState(3),[difficulty,setDifficulty]=useState('medium');
  const [game,setGame]=useState(()=>createGame(3,'medium'));
  const [selected,setSelected]=useState([]),[tableSelected,setTableSelected]=useState([]),[draft,setDraft]=useState(null),[draftHand,setDraftHand]=useState(null);
  const [showRules,setShowRules]=useState(false),[notice,setNotice]=useState('');
  const human=game.players[0],isHumanTurn=game.turn===0&&!game.finished;
  const totalScore=human?.hand.reduce((s,t)=>s+points(t),0)||0;
  useEffect(()=>{
    if(!game.finished && game.turn!==0){
      const timer=setTimeout(()=>setGame(g=>aiTurn(g)),850);
      return ()=>clearTimeout(timer);
    }
  },[game.turn,game.finished,game.round]);
  const activeHand=draftHand||human.hand;
  const selectedTiles=activeHand.filter(t=>selected.includes(t.id));
  function toggleTile(id){setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);}
  function newGame(){setGame(createGame(count,difficulty));setSelected([]);setTableSelected([]);setDraft(null);setDraftHand(null);setNotice('');}
  function draw(){if(!isHumanTurn)return;setGame(g=>{let n=drawTile(g,0);n.turn=1%n.players.length;n.message='לקחת אבן מהקופה. תור המחשב.';return n;});setSelected([]);}
  function makeGroup(){
    if(selected.length<3){setNotice('בחרו לפחות 3 אבנים כדי ליצור סדרה או קבוצה.');return;}
    const group=selectedTiles;
    if(!isValidGroup(group)){setNotice('האבנים שנבחרו אינן יוצרות סדרה או קבוצה חוקית.');return;}
    setDraft(d=>[...(d||game.table.map(x=>[...x])),group]);
    setDraftHand(h=>(h||human.hand).filter(t=>!selected.includes(t.id)));
    setSelected([]);setNotice('הקבוצה נוספה לטיוטה. לחצו על סיום תור כדי לאמת את כל השולחן.');
  }
  function addToGroup(index){
    if(!selected.length)return;
    const groups=(draft||game.table.map(x=>[...x])).map(x=>[...x]);
    groups[index]=[...groups[index],...selectedTiles];
    setDraft(groups);setDraftHand(h=>(h||human.hand).filter(t=>!selected.includes(t.id)));setSelected([]);setNotice('האבנים נוספו לטיוטה. יש לוודא שהסדרה חוקית בסיום התור.');
  }
  function removeTableTile(gi,ti){
    const groups=(draft||game.table.map(x=>[...x])).map(x=>[...x]);
    const [tile]=groups[gi].splice(ti,1);
    if(groups[gi].length===0)groups.splice(gi,1);
    setDraft(groups);
    // Removed table tiles are temporarily returned to the player's rack for rearrangement.
    setDraftHand(h=>[...(h||human.hand),tile]);
    setNotice('האבנים הועברו למעמד שלך. בסיום התור צריך שכל הקבוצות יהיו חוקיות.');
  }
  function endTurn(){
    if(!draft){setNotice('לא ביצעת שינוי בשולחן. אפשר לקחת אבן מהקופה.');return;}
    const nextTable=draft;
    const nextHand=draftHand||human.hand;
    const result=applyHumanMove(game,nextTable,nextHand);
    if((!result.finished && result.turn===game.turn) || result.message.includes('אינו חוקי') || result.message.includes('צריך לפחות')){
      setGame(result);setNotice(result.message);return;
    }
    setGame(result);setDraft(null);setDraftHand(null);setSelected([]);setTableSelected([]);
  }
  function undoDraft(){setDraft(null);setDraftHand(null);setSelected([]);setNotice('הטיוטה בוטלה.');}
  const table=draft||game.table;
  function dragStart(e,id){e.dataTransfer.setData('tile-id',id);}
  function dropToGroup(e,index){e.preventDefault();const id=e.dataTransfer.getData('tile-id');if(id) {setSelected(s=>s.includes(id)?s:[...s,id]);setTimeout(()=>addToGroup(index),0);}}
  const aiPlayers=game.players.slice(1);
  return <div className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-icon">R</div><div><b>Rummikub <span>AI</span></b><small>המשחק הקלאסי, חכם יותר</small></div></div><div className="top-actions"><button className="icon-btn" onClick={()=>setShowRules(true)}><Info size={18}/> חוקים</button><button className="new-btn" onClick={newGame}><RotateCcw size={17}/> משחק חדש</button></div></header>
    <main className="main">
      <section className="hero"><div><div className="eyebrow"><Sparkles size={14}/> משחק אסטרטגיה נגד מחשב</div><h1>השולחן שלך.<br/><span>המהלך הבא שלך.</span></h1><p>בנה רצפים, פרק קבוצות ותכנן כמה צעדים קדימה.</p></div><div className="hero-stats"><div><small>אבנים במעמד</small><strong>{human.hand.length}</strong></div><div><small>נקודות ביד</small><strong>{totalScore}</strong></div><div><small>בקופה</small><strong>{game.pool.length}</strong></div></div></section>
      <section className="settings-row"><div className="setting"><label>מספר שחקנים</label><select value={count} onChange={e=>setCount(+e.target.value)}><option value={2}>2 שחקנים</option><option value={3}>3 שחקנים</option><option value={4}>4 שחקנים</option></select></div><div className="setting"><label>רמת מחשב</label><select value={difficulty} onChange={e=>setDifficulty(e.target.value)}><option value="easy">קל</option><option value="medium">בינוני</option><option value="hard">קשה</option></select></div><div className="turn-pill"><span className={isHumanTurn?'pulse':''}></span>{game.finished?'המשחק הסתיים':isHumanTurn?'התור שלך':'המחשב חושב...'}</div></section>
      <section className="players">
        {aiPlayers.map((p,i)=><div className="player-card" key={p.id}><div className="avatar"><Brain size={20}/></div><div className="player-info"><b>{p.name}</b><small>{p.opened?'כבר פתח/ה':'טרם פתח/ה'} · {p.hand.length} אבנים</small></div><div className="back-tiles"><i/><i/><i/></div></div>)}
      </section>
      <section className="table-section">
        <div className="section-head"><div><span className="section-kicker">THE GAME TABLE</span><h2>השולחן הפתוח</h2></div><span className="table-count">{table.length} סדרות וקבוצות</span></div>
        <div className="game-table">
          {table.length===0?<div className="empty-table"><div className="empty-icon">✦</div><b>השולחן עדיין ריק</b><span>הנח את הפתיחה הראשונה שלך – לפחות 30 נקודות</span></div>:
            table.map((group,gi)=><div className={`meld ${isValidGroup(group)?'':'invalid'}`} key={gi} onDragOver={e=>e.preventDefault()} onDrop={e=>dropToGroup(e,gi)}>
              <div className="meld-label">{group.length>=3?(new Set(group.filter(t=>!t.joker).map(t=>t.value)).size===1?'קבוצה':'רצף'):'לא שלם'} {selected.length>0&&<button className="meld-add" onClick={()=>addToGroup(gi)}>+ הוסף {selected.length}</button>}</div>
              <div className="meld-tiles">{group.map((tile,ti)=><div className="table-tile-wrap" key={tile.id}><Tile tile={tile} small onClick={()=>removeTableTile(gi,ti)}/></div>)}</div>
            </div>)}
          {draft&&<div className="draft-tag">טיוטה – טרם אושרה</div>}
        </div>
        <div className="table-help">לחיצה על אבן בשולחן מחזירה אותה למעמד שלך כדי לארגן מחדש. כל הסדרות חייבות להיות חוקיות בסיום התור.</div>
      </section>
      <section className="rack-section">
        <div className="section-head"><div><span className="section-kicker">YOUR RACK</span><h2>האבנים שלך <span className="rack-number">{human.hand.length}</span></h2></div><div className="rack-actions"><button className="soft-btn" onClick={()=>setSelected(human.hand.map(t=>t.id))}><Shuffle size={15}/> בחר הכל</button><button className="soft-btn" onClick={()=>setGame(g=>({...g,players:g.players.map((p,i)=>i===0?{...p,hand:shuffle(p.hand)}:p)}))}><RotateCcw size={15}/> ערבב</button></div></div>
        <div className="rack">
          {human.hand.map(tile=><Tile key={tile.id} tile={tile} selected={selected.includes(tile.id)} onClick={()=>toggleTile(tile.id)} draggable onDragStart={e=>dragStart(e,tile.id)}/>)}
        </div>
        <div className="selection-bar"><span>{selected.length?`נבחרו ${selected.length} אבנים`:'בחר אבנים כדי ליצור קבוצה או להוסיף לשולחן'}</span><div className="selection-actions"><button className="soft-btn" disabled={!selected.length||!isHumanTurn} onClick={makeGroup}><Plus size={16}/> צור קבוצה</button><button className="soft-btn" disabled={!selected.length||!table.length||!isHumanTurn} onClick={()=>{setNotice('בחרו סדרה בשולחן כדי להוסיף אליה.');}} onClick={()=>setNotice('בחרו אבנים ואז לחצו על + הוסף בתוך הקבוצה הרצויה.')}>הוסף לשולחן</button></div></div>
      </section>
      <section className="bottom-actions">
        <button className="draw-btn" disabled={!isHumanTurn} onClick={draw}><ArrowDownToLine size={18}/> קח אבן מהקופה</button>
        <button className="finish-btn" disabled={!isHumanTurn||!draft} onClick={endTurn}><Check size={18}/> סיום תור ואימות</button>
        <button className="undo-btn" disabled={!draft} onClick={undoDraft}><Undo2 size={17}/> בטל שינויים</button>
      </section>
      {notice&&<div className="notice" role="status"><span>{notice}</span><button onClick={()=>setNotice('')}><X size={16}/></button></div>}
      <div className="message-line">{game.finished?<><Trophy size={17}/> {game.message}</>:game.message}</div>
      <footer>Rummikub AI · משחק דפדפן · המשחק נשמר בזיכרון המקומי של הסשן</footer>
    </main>
    {showRules&&<div className="modal-backdrop" onClick={()=>setShowRules(false)}><div className="modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setShowRules(false)}><X/></button><div className="eyebrow">HOW TO PLAY</div><h2>חוקי רמי פתוח</h2><ul><li><b>פתיחה:</b> בפעם הראשונה שמניחים אבנים, יש להניח סדרות בשווי 30 נקודות לפחות.</li><li><b>רצף:</b> לפחות 3 מספרים עוקבים באותו צבע.</li><li><b>קבוצה:</b> לפחות 3 אבנים עם אותו מספר בצבעים שונים.</li><li><b>רמי פתוח:</b> לאחר הפתיחה ניתן לפרק ולבנות מחדש סדרות שעל השולחן.</li><li><b>סיום תור:</b> כל הסדרות חייבות להיות חוקיות, ולכל סדרה לפחות 3 אבנים.</li><li><b>אין מהלך:</b> לוקחים אבן מהקופה. כשהקופה מתרוקנת, מערבבים מחדש את האבנים שנאספו.</li><li><b>ניצחון:</b> הראשון שמרוקן את המעמד שלו מנצח.</li></ul><p className="rules-note">הערה: זהו מימוש משחקי ראשוני. כללי ג׳וקר, ניקוד סופי ותזמון תור עשויים להשתנות לפי גרסת הבית.</p><button className="new-btn full" onClick={()=>setShowRules(false)}>הבנתי, בוא נשחק</button></div></div>}
  </div>
}
export default App;
