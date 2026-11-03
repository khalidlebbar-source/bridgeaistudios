/* Outils de calculs des ponts — socle : solveur de portiques et modèles de charges (node tools/test-outils-socle.js). */
const P=require('../outils/js/portique.js');
const C=require('../outils/js/charges.js');
const near=(a,b,t=1e-6)=>Math.abs(a-b)<=t*Math.max(1,Math.abs(b));
let f=0;const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m);if(!c)f++;};
// 1. poutre simple L=10, q=-10 : M=125, flèche 5qL4/384EI
let m={nodes:[{x:0,y:0},{x:10,y:0}],elems:[{i:0,j:1,E:3e7,A:1,I:0.1}],supports:[{n:0,ux:true,uy:true},{n:1,uy:true}]};
let r=P.solve(m,{elem:[{e:0,type:'u',q:-10}]});
let d=r.diagram(0,40);let mid=d.find(p=>Math.abs(p.x-5)<1e-9);
ok(near(mid.M,125),'M mi-travée '+mid.M);ok(near(mid.v,-5*10*1e4/384/3e6,1e-4),'flèche '+mid.v);
ok(near(r.reac[0].Ry,50)&&near(r.reac[1].Ry,50),'réactions '+r.reac.map(x=>x.Ry));
// 2. encastrée-encastrée charge ponctuelle P=-100 à a=3, L=10: MA=-Pab²/L²
m={nodes:[{x:0,y:0},{x:10,y:0}],elems:[{i:0,j:1,E:3e7,A:1,I:0.1}],supports:[{n:0,ux:true,uy:true,rz:true},{n:1,ux:true,uy:true,rz:true}]};
r=P.solve(m,{elem:[{e:0,type:'p',P:-100,a:3}]});
ok(near(r.at(0,0).M,-100*3*49/100),'M encastrement A '+r.at(0,0).M+' attendu '+(-147));
ok(near(r.at(0,3).M,2*100*9*49/1000),'M sous charge '+r.at(0,3).M+' attendu 88.2');
// 3. poutre continue 2 travées 10 m, q=-10: M appui = -qL²/8=-125
const pc=P.poutreContinue([10,10],{EI:1e6,nseg:10});
r=P.solve(pc,{elem:pc.elems.map((e,i)=>({e:i,type:'u',q:-10}))});
ok(near(r.at(9,1).M,-125,1e-6),'M appui central '+r.at(9,1).M);
ok(near(r.reac[1].Ry,125),'R centrale 1,25qL '+r.reac[1].Ry);
// 4. portique 2 poteaux encastrés, charge horizontale H=10 en tête, traverse infiniment rigide approx: M pied = H h/4
m={nodes:[{x:0,y:0},{x:0,y:4},{x:6,y:4},{x:6,y:0}],elems:[{i:0,j:1,E:3e7,A:1,I:0.01},{i:1,j:2,E:3e7,A:1,I:100},{i:2,j:3,E:3e7,A:1,I:0.01}],supports:[{n:0,ux:true,uy:true,rz:true},{n:3,ux:true,uy:true,rz:true}]};
r=P.solve(m,{nodal:[{n:1,Fx:10}]});
ok(near(Math.abs(r.reac[0].Mz),10,1e-2),'M pied portique Hh/4 '+r.reac[0].Mz);
ok(near(r.reac[0].Rx+r.reac[1].Rx,-10),'équilibre H');
// 5. articulation : poutre encastrée-articulée par relâchement → M appui droit 0
m={nodes:[{x:0,y:0},{x:10,y:0}],elems:[{i:0,j:1,E:3e7,A:1,I:0.1,rel:[false,true]}],supports:[{n:0,ux:true,uy:true,rz:true},{n:1,uy:true,rz:true}]};
r=P.solve(m,{elem:[{e:0,type:'u',q:-10}]});
ok(near(r.at(0,10).M,0,1e-6)&&near(r.at(0,0).M,-125),'encastrée-articulée M=-qL²/8 '+r.at(0,0).M);
// 6. dilatation libre : aucun effort ; bridée : N=-EAε
m={nodes:[{x:0,y:0},{x:10,y:0}],elems:[{i:0,j:1,E:3e7,A:1,I:0.1}],supports:[{n:0,ux:true,uy:true},{n:1,ux:true,uy:true}]};
r=P.solve(m,{strain:[{e:0,eps:1e-4}]});ok(near(r.at(0,5).N,-3000),'N bridé '+r.at(0,5).N);
// 7. trapèze sur poutre simple 0→-10 : M max = 0.0642 qL²
m={nodes:[{x:0,y:0},{x:10,y:0}],elems:[{i:0,j:1,E:3e7,A:1,I:0.1}],supports:[{n:0,ux:true,uy:true},{n:1,uy:true}]};
r=P.solve(m,{elem:[{e:0,type:'t',q1:0,q2:-10}]});
const mx=Math.max(...r.diagram(0,200).map(p=>p.M));ok(near(mx,10*100/(9*Math.sqrt(3)),1e-3),'trapèze Mmax '+mx);
ok(near(r.reac[1].Ry,100/3),'R triangle '+r.reac[1].Ry);
// 8. ressort
m={nodes:[{x:0,y:0},{x:10,y:0}],elems:[{i:0,j:1,E:3e7,A:1,I:0.1}],supports:[{n:0,ux:true,uy:1000},{n:1,uy:1000}]};
r=P.solve(m,{elem:[{e:0,type:'u',q:-10}]});ok(near(r.reac[0].Ry,50)&&near(r.nodeDisp(0).uy,-0.05),'ressorts '+r.reac[0].Ry+' '+r.nodeDisp(0).uy);
// 9. dénivellation δ de l'appui central (2 travées L) : M appui = +3EIδ/L²
{const pc=P.poutreContinue([10,10],{EI:1e5,nseg:10});const r=P.solve(pc,{disp:[{n:pc.appuis[1],dof:'uy',v:-0.01}]});ok(near(r.at(9,1).M,3*1e5*0.01/100,1e-6),'dénivellation '+r.at(9,1).M);}
// 10. charges sur ligne d'influence du moment à mi-portée d'une travée de 20 m
{const xs=[],ys=[];for(let k=0;k<=400;k++){const x=k*0.05;xs.push(x);ys.push(x<=10?x/2:(20-x)/2);}const li=C.mkLI(xs,ys);
ok(near(C.uic71(li).max,6075.2,1e-4),'UIC 71 : groupe excentré de 0,80 m, 6075,2 kN·m');
ok(near(C.swModel(li,'SW/2').max,7500),'SW/2 = 150 × aire');
ok(near(C.convoi(li,C.CONVOIS.Bt).max,1492),'Bt');
ok(near(C.chenille(li,'Mc120').max,4661.25),'Mc120');
ok(near(C.AL(li,3.5,1,1).max,(2.3+360/32)*3.5*50),'A(l)');
ok(near(C.phi2(20),1.157068,1e-5)&&near(C.phi3(20),1.235602,1e-5),'Φ2, Φ3 pour LΦ = 20 m');}
process.exit(f?1:0);
