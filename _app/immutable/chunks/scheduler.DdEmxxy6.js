function N(){}const ct=t=>t;function T(t,e){for(const n in e)t[n]=e[n];return t}function B(t){return t()}function rt(){return Object.create(null)}function L(t){t.forEach(B)}function M(t){return typeof t=="function"}function st(t,e){return t!=t?e==e:t!==e||t&&typeof t=="object"||typeof t=="function"}function lt(t){return Object.keys(t).length===0}function j(t,...e){if(t==null){for(const i of e)i(void 0);return N}const n=t.subscribe(...e);return n.unsubscribe?()=>n.unsubscribe():n}function ot(t){let e;return j(t,n=>e=n)(),e}function ut(t,e,n){t.$$.on_destroy.push(j(e,n))}function at(t,e,n,i){if(t){const c=A(t,e,n,i);return t[0](c)}}function A(t,e,n,i){return t[1]&&i?T(n.ctx.slice(),t[1](i(e))):n.ctx}function ft(t,e,n,i){if(t[2]&&i){const c=t[2](i(n));if(e.dirty===void 0)return c;if(typeof c=="object"){const o=[],r=Math.max(e.dirty.length,c.length);for(let l=0;l<r;l+=1)o[l]=e.dirty[l]|c[l];return o}return e.dirty|c}return e.dirty}function _t(t,e,n,i,c,o){if(c){const r=A(e,n,i,o);t.p(r,c)}}function dt(t){if(t.ctx.length>32){const e=[],n=t.ctx.length/32;for(let i=0;i<n;i++)e[i]=-1;return e}return-1}function ht(t){const e={};for(const n in t)n[0]!=="$"&&(e[n]=t[n]);return e}function mt(t,e){const n={};e=new Set(e);for(const i in t)!e.has(i)&&i[0]!=="$"&&(n[i]=t[i]);return n}function pt(t,e,n){return t.set(n),e}function yt(t){return t&&M(t.destroy)?t.destroy:N}const q=["",!0,1,"true","contenteditable"];let p=!1;function bt(){p=!0}function gt(){p=!1}function I(t,e,n,i){for(;t<e;){const c=t+(e-t>>1);n(c)<=i?t=c+1:e=c}return t}function R(t){if(t.hydrate_init)return;t.hydrate_init=!0;let e=t.childNodes;if(t.nodeName==="HEAD"){const s=[];for(let u=0;u<e.length;u++){const a=e[u];a.claim_order!==void 0&&s.push(a)}e=s}const n=new Int32Array(e.length+1),i=new Int32Array(e.length);n[0]=-1;let c=0;for(let s=0;s<e.length;s++){const u=e[s].claim_order,a=(c>0&&e[n[c]].claim_order<=u?c+1:I(1,c,P=>e[n[P]].claim_order,u))-1;i[s]=n[a]+1;const k=a+1;n[k]=s,c=Math.max(k,c)}const o=[],r=[];let l=e.length-1;for(let s=n[c]+1;s!=0;s=i[s-1]){for(o.push(e[s-1]);l>=s;l--)r.push(e[l]);l--}for(;l>=0;l--)r.push(e[l]);o.reverse(),r.sort((s,u)=>s.claim_order-u.claim_order);for(let s=0,u=0;s<r.length;s++){for(;u<o.length&&r[s].claim_order>=o[u].claim_order;)u++;const a=u<o.length?o[u]:null;t.insertBefore(r[s],a)}}function z(t,e){t.appendChild(e)}function F(t){if(!t)return document;const e=t.getRootNode?t.getRootNode():t.ownerDocument;return e&&e.host?e:t.ownerDocument}function xt(t){const e=C("style");return e.textContent="/* empty */",H(F(t),e),e.sheet}function H(t,e){return z(t.head||t,e),e.sheet}function U(t,e){if(p){for(R(t),(t.actual_end_child===void 0||t.actual_end_child!==null&&t.actual_end_child.parentNode!==t)&&(t.actual_end_child=t.firstChild);t.actual_end_child!==null&&t.actual_end_child.claim_order===void 0;)t.actual_end_child=t.actual_end_child.nextSibling;e!==t.actual_end_child?(e.claim_order!==void 0||e.parentNode!==t)&&t.insertBefore(e,t.actual_end_child):t.actual_end_child=e.nextSibling}else(e.parentNode!==t||e.nextSibling!==null)&&t.appendChild(e)}function wt(t,e,n){p&&!n?U(t,e):(e.parentNode!==t||e.nextSibling!=n)&&t.insertBefore(e,n||null)}function vt(t){t.parentNode&&t.parentNode.removeChild(t)}function kt(t,e){for(let n=0;n<t.length;n+=1)t[n]&&t[n].d(e)}function C(t){return document.createElement(t)}function W(t){return document.createElementNS("http://www.w3.org/2000/svg",t)}function w(t){return document.createTextNode(t)}function Et(){return w(" ")}function Nt(){return w("")}function jt(t,e,n,i){return t.addEventListener(e,n,i),()=>t.removeEventListener(e,n,i)}function v(t,e,n){n==null?t.removeAttribute(e):t.getAttribute(e)!==n&&t.setAttribute(e,n)}const G=["width","height"];function J(t,e){const n=Object.getOwnPropertyDescriptors(t.__proto__);for(const i in e)e[i]==null?t.removeAttribute(i):i==="style"?t.style.cssText=e[i]:i==="__value"?t.value=t[i]=e[i]:n[i]&&n[i].set&&G.indexOf(i)===-1?t[i]=e[i]:v(t,i,e[i])}function At(t,e){for(const n in e)v(t,n,e[n])}function K(t,e){Object.keys(e).forEach(n=>{Q(t,n,e[n])})}function Q(t,e,n){const i=e.toLowerCase();i in t?t[i]=typeof t[i]=="boolean"&&n===""?!0:n:e in t?t[e]=typeof t[e]=="boolean"&&n===""?!0:n:v(t,e,n)}function Ct(t){return/-/.test(t)?K:J}function Ot(t){return Array.from(t.childNodes)}function V(t){t.claim_info===void 0&&(t.claim_info={last_index:0,total_claimed:0})}function O(t,e,n,i,c=!1){V(t);const o=(()=>{for(let r=t.claim_info.last_index;r<t.length;r++){const l=t[r];if(e(l)){const s=n(l);return s===void 0?t.splice(r,1):t[r]=s,c||(t.claim_info.last_index=r),l}}for(let r=t.claim_info.last_index-1;r>=0;r--){const l=t[r];if(e(l)){const s=n(l);return s===void 0?t.splice(r,1):t[r]=s,c?s===void 0&&t.claim_info.last_index--:t.claim_info.last_index=r,l}}return i()})();return o.claim_order=t.claim_info.total_claimed,t.claim_info.total_claimed+=1,o}function S(t,e,n,i){return O(t,c=>c.nodeName===e,c=>{const o=[];for(let r=0;r<c.attributes.length;r++){const l=c.attributes[r];n[l.name]||o.push(l.name)}o.forEach(r=>c.removeAttribute(r))},()=>i(e))}function St(t,e,n){return S(t,e,n,C)}function Dt(t,e,n){return S(t,e,n,W)}function X(t,e){return O(t,n=>n.nodeType===3,n=>{const i=""+e;if(n.data.startsWith(i)){if(n.data.length!==i.length)return n.splitText(i.length)}else n.data=i},()=>w(e),!0)}function Pt(t){return X(t," ")}function Y(t,e){e=""+e,t.data!==e&&(t.data=e)}function Z(t,e){e=""+e,t.wholeText!==e&&(t.data=e)}function Tt(t,e,n){~q.indexOf(n)?Z(t,e):Y(t,e)}function Bt(t,e){t.value=e??""}function Lt(t,e,n,i){n==null?t.style.removeProperty(e):t.style.setProperty(e,n,"")}function $(t,e,{bubbles:n=!1,cancelable:i=!1}={}){return new CustomEvent(t,{detail:e,bubbles:n,cancelable:i})}function Mt(t,e){return new t(e)}let m;function y(t){m=t}function d(){if(!m)throw new Error("Function called outside component initialization");return m}function qt(t){d().$$.on_mount.push(t)}function It(t){d().$$.after_update.push(t)}function Rt(t){d().$$.on_destroy.push(t)}function zt(){const t=d();return(e,n,{cancelable:i=!1}={})=>{const c=t.$$.callbacks[e];if(c){const o=$(e,n,{cancelable:i});return c.slice().forEach(r=>{r.call(t,o)}),!o.defaultPrevented}return!0}}function Ft(t,e){return d().$$.context.set(t,e),e}function Ht(t){return d().$$.context.get(t)}function Ut(t,e){const n=t.$$.callbacks[e.type];n&&n.slice().forEach(i=>i.call(this,e))}const h=[],E=[];let _=[];const g=[],D=Promise.resolve();let x=!1;function tt(){x||(x=!0,D.then(nt))}function Wt(){return tt(),D}function et(t){_.push(t)}function Gt(t){g.push(t)}const b=new Set;let f=0;function nt(){if(f!==0)return;const t=m;do{try{for(;f<h.length;){const e=h[f];f++,y(e),it(e.$$)}}catch(e){throw h.length=0,f=0,e}for(y(null),h.length=0,f=0;E.length;)E.pop()();for(let e=0;e<_.length;e+=1){const n=_[e];b.has(n)||(b.add(n),n())}_.length=0}while(h.length);for(;g.length;)g.pop()();x=!1,b.clear(),y(t)}function it(t){if(t.fragment!==null){t.update(),L(t.before_update);const e=t.dirty;t.dirty=[-1],t.fragment&&t.fragment.p(t.ctx,e),t.after_update.forEach(et)}}function Jt(t){const e=[],n=[];_.forEach(i=>t.indexOf(i)===-1?e.push(i):n.push(i)),n.forEach(i=>i()),_=e}export{Ct as $,E as A,Mt as B,Wt as C,F as D,xt as E,et as F,$ as G,ct as H,rt as I,nt as J,lt as K,Jt as L,m as M,y as N,B as O,h as P,tt as Q,bt as R,gt as S,Rt as T,ot as U,zt as V,Ft as W,Ht as X,mt as Y,T as Z,ht as _,st as a,yt as a0,J as a1,jt as a2,Ut as a3,Tt as a4,W as a5,Dt as a6,At as a7,Gt as a8,Bt as a9,kt as aa,pt as ab,Et as b,St as c,Ot as d,C as e,X as f,vt as g,Pt as h,M as i,wt as j,U as k,Y as l,ut as m,N as n,at as o,dt as p,ft as q,L as r,j as s,w as t,_t as u,Nt as v,It as w,qt as x,v as y,Lt as z};
