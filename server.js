const express=require("express");
const http=require("http");
const path=require("path");
const {Server}=require("socket.io");
const app=express(), server=http.createServer(app), io=new Server(server);
const PORT=process.env.PORT||3000, rooms=new Map();
app.use(express.static(path.join(__dirname,"public")));
app.get("/",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.get("/health",(req,res)=>res.json({ok:true,service:"EDUVERSE 3D"}));
const qs=[
{q:"O‘rganilgan ma’lumotni mustahkamlashning samarali usuli qaysi?",a:["Faol esga tushirish","Faqat qayta o‘qish","Tanaffussiz o‘qish","Umuman takrorlamaslik"],c:0},
{q:"Jamoaviy topshiriqda muhim ko‘nikma qaysi?",a:["Hamkorlik","Boshqalarni tinglamaslik","Vazifani yashirish","Muloqotdan qochish"],c:0},
{q:"Internet manbasini baholashda nimaga e’tibor beriladi?",a:["Muallif va ishonchlilik","Faqat ranglariga","Sarlavha uzunligiga","Reklama soniga"],c:0},
{q:"Muammoni hal qilishning yaxshi boshlanishi qaysi?",a:["Muammoni aniq belgilash","Taxmin bilan yakunlash","Dalillarni e’tiborsiz qoldirish","Tekshirmaslik"],c:0},
{q:"Formativ baholashning maqsadi nima?",a:["O‘rganishni yaxshilash uchun fikr bildirish","Faqat jazolash","Darsni bekor qilish","Faqat davomat"],c:0}
];
const code=()=>{let s="";const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";for(let i=0;i<6;i++)s+=chars[Math.floor(Math.random()*chars.length)];return s};
const name=x=>String(x||"Talaba").trim().slice(0,24)||"Talaba";
function snapshot(r){return {code:r.code,hostId:r.hostId,started:r.started,index:r.index,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,color:p.color,score:p.score,answered:p.answered})).sort((a,b)=>b.score-a.score)}}
function update(r){io.to(r.code).emit("room:update",snapshot(r))}
function advance(r){if(!rooms.has(r.code)||!r.started)return;r.index++;if(r.index>=r.questions.length){r.started=false;io.to(r.code).emit("game:finished",{leaderboard:snapshot(r).players});update(r);return}r.players.forEach(p=>p.answered=false);const q=r.questions[r.index];io.to(r.code).emit("game:question",{index:r.index,total:r.questions.length,question:q.q,answers:q.a});update(r)}
io.on("connection",s=>{
s.on("room:create",({name:n,color:c}={},cb=()=>{})=>{let k=code();while(rooms.has(k))k=code();const r={code:k,hostId:s.id,started:false,index:0,questions:qs,players:new Map()};r.players.set(s.id,{id:s.id,name:name(n),color:c||"#8b5cf6",score:0,answered:false});rooms.set(k,r);s.join(k);s.data.room=k;cb({ok:true,room:snapshot(r)});update(r)});
s.on("room:join",({code:k,name:n,color:c}={},cb=()=>{})=>{k=String(k||"").trim().toUpperCase();const r=rooms.get(k);if(!r)return cb({ok:false,error:"Xona kodi topilmadi."});if(r.players.size>=40)return cb({ok:false,error:"Xona 40 ishtirokchi bilan to‘lgan."});if(r.started)return cb({ok:false,error:"O‘yin boshlangan."});r.players.set(s.id,{id:s.id,name:name(n),color:c||"#22d3ee",score:0,answered:false});s.join(k);s.data.room=k;cb({ok:true,room:snapshot(r)});update(r)});
s.on("game:start",(_,cb=()=>{})=>{const r=rooms.get(s.data.room);if(!r)return cb({ok:false,error:"Avval xonaga kiring."});if(s.id!==r.hostId)return cb({ok:false,error:"Faqat xona egasi boshlashi mumkin."});r.started=true;r.index=0;r.players.forEach(p=>p.answered=false);const q=r.questions[0];io.to(r.code).emit("game:question",{index:0,total:r.questions.length,question:q.q,answers:q.a});update(r);cb({ok:true})});
s.on("game:answer",({choice}={},cb=()=>{})=>{const r=rooms.get(s.data.room);if(!r||!r.started)return cb({ok:false,error:"O‘yin boshlanmagan."});const p=r.players.get(s.id),q=r.questions[r.index];if(!p||p.answered)return cb({ok:false,error:"Javob allaqachon yuborilgan."});p.answered=true;const correct=Number(choice)===q.c;if(correct)p.score+=100;cb({ok:true,correct,score:p.score});io.to(r.code).emit("player:answered",{playerId:p.id,name:p.name});update(r);if([...r.players.values()].every(x=>x.answered))setTimeout(()=>advance(r),1200)});
s.on("disconnect",()=>{const r=rooms.get(s.data.room);if(!r)return;r.players.delete(s.id);if(r.hostId===s.id)r.hostId=r.players.keys().next().value||null;if(!r.players.size)rooms.delete(r.code);else update(r)});
});
server.listen(PORT,"0.0.0.0",()=>console.log("EDUVERSE 3D listening on "+PORT));
