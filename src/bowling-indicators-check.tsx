import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/athlete-space.css';
import { MobileBowlingFrames } from './components/bowling/MobileBowlingFrames';
import { BowlingIndicatorButton } from './components/bowling/BowlingIndicatorButton';
import { changeThrow, emptyFrames, scoreFrames } from './lib/bowling/scoreRules';
import { calculateBowlingStats } from './lib/bowling/scoreStats';
import { resetThrowIndicators } from './lib/bowling/indicatorState';
function Harness() {
 const [frames,setFrames]=useState(()=>changeThrow(emptyFrames(),0,0,'8').frames);
 return <main className="athlete-space bg-background text-foreground" style={{width:320}}>
 <div id="combinations">{[null,true,false].flatMap((p,pi)=>[null,true,false].map((s,si)=><div key={`${pi}-${si}`} data-pair={`${pi}-${si}`} className="grid grid-cols-2 gap-2 mb-2"><BowlingIndicatorButton type="pocket" value={p} readOnly={false} onChange={()=>{}}/><BowlingIndicatorButton type="split" value={s} readOnly={false} onChange={()=>{}}/></div>))}</div>
 <MobileBowlingFrames frames={scoreFrames(frames)} stats={calculateBowlingStats(frames)} gameNumber={1} readOnly={false} trackPockets={true} onThrow={(f,r,v)=>{const next=changeThrow(frames,f,r,v).frames;setFrames(next);return next;}} onObservation={(f,r,field,v)=>setFrames(frames.map((frame,fi)=>fi!==f?frame:{...frame,throws:frame.throws.map((t,ti)=>ti!==r?t:{...t,[field]:v??false,observed:v===undefined?(t.observed??[]).filter(k=>k!==field):[...new Set([...(t.observed??[]),field])]})}))} onResetIndicators={(f,r)=>setFrames(frames.map((frame,fi)=>fi!==f?frame:{...frame,throws:frame.throws.map((t,ti)=>ti!==r?t:resetThrowIndicators(t))}))}/>
 <output id="data">{JSON.stringify(frames)}</output>
 </main>;
}
createRoot(document.getElementById('root') as HTMLElement).render(<Harness/>);
