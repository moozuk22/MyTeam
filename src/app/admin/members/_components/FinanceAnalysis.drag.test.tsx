import { expect, it, vi } from 'vitest';
import type { PointerEvent, ReactElement } from 'react';
vi.mock('react',async original=>({...await original<typeof import('react')>(),useRef:()=>({current:null})}));
import { FinanceAnalysisTable } from './FinanceAnalysis';
function setup() {
 const element = FinanceAnalysisTable({data:{year:2026,currentMonth:'2026-10',categories:[],rows:[]}}) as ReactElement<Record<string,(event:PointerEvent<HTMLDivElement>)=>void>>;
 let capture=false;
 const table={scrollLeft:200,scrollWidth:900,clientWidth:300,clientHeight:400,dataset:{} as Record<string,string>,getBoundingClientRect:()=>({left:0,top:0}),setPointerCapture:()=>{capture=true;},hasPointerCapture:()=>capture,releasePointerCapture:()=>{capture=false;}};
 const event=(clientX:number,pointerType='mouse')=>({clientX,clientY:100,pointerId:1,pointerType,button:0,currentTarget:table,preventDefault:vi.fn()}) as unknown as PointerEvent<HTMLDivElement>;
 return {handlers:element.props,table,event};
}
it('drags horizontally in both directions and stops after release or cancellation',()=>{
 const {handlers,table,event}=setup();
 handlers.onPointerDown(event(200));
 expect(table.dataset.dragging).toBe('true');
 handlers.onPointerMove(event(100));expect(table.scrollLeft).toBe(300);
 handlers.onPointerMove(event(250));expect(table.scrollLeft).toBe(150);
 handlers.onPointerUp(event(250));expect(table.dataset.dragging).toBeUndefined();
 handlers.onPointerMove(event(0));expect(table.scrollLeft).toBe(150);
 handlers.onPointerDown(event(100));handlers.onPointerCancel(event(100));
 handlers.onPointerMove(event(50));expect(table.scrollLeft).toBe(150);
});
it('leaves touch gestures and non-overflowing tables to native browser behavior',()=>{
 const {handlers,table,event}=setup();
 const touch=event(200,'touch');handlers.onPointerDown(touch);handlers.onPointerMove(event(100,'touch'));
 expect(table.scrollLeft).toBe(200);expect(touch.preventDefault).not.toHaveBeenCalled();
 table.scrollWidth=300;
 const mouse=event(200);handlers.onPointerDown(mouse);handlers.onPointerMove(event(100));
 expect(table.scrollLeft).toBe(200);expect(mouse.preventDefault).not.toHaveBeenCalled();
});
