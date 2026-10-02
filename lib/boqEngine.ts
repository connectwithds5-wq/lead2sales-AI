import { recommendRequirement, type Recommendation } from "./recommendations";

type CatalogRow = {
  id:string; category?:string|null; subcategory?:string|null; brand?:string|null; model?:string|null;
  name:string; specification?:string|null; unit?:string|null; selling_price?:number|null;
  master_product_id?:string|null; active?:boolean;
};
const norm=(s?:string|null)=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
const tokens=(s:string)=>new Set(norm(s).split(" ").filter(x=>x.length>1));
function findNumber(input:string,patterns:RegExp[],fallback=0){for(const p of patterns){const m=input.match(p);if(m)return Number(m[1]);}return fallback;}
function cameraBreakdown(input:string){
 const t=norm(input);
 const dome=findNumber(t,[/(\d+)\s*(?:dome|dome camera|dome cctv)\b/,/(?:dome|dome camera|dome cctv)\s*(?:x|:|of)?\s*(\d+)\b/]);
 const bullet=findNumber(t,[/(\d+)\s*(?:bullet|bullet camera|bullet cctv)\b/,/(?:bullet|bullet camera|bullet cctv)\s*(?:x|:|of)?\s*(\d+)\b/]);
 const total=findNumber(t,[/(\d+)\s*(?:cctv|cameras?|cams?)\b/,/(?:cctv|cameras?|cams?)\s*(?:x|:|of)?\s*(\d+)\b/]);
 return {dome,bullet,total:Math.max(total,dome+bullet)};
}
function preferredBrand(input:string){
 const t=norm(input);
 for(const b of ["hikvision","cp plus","dahua","prama","axis","bosch","zkteco","suprema","d link","dlink","apc","seagate","wd","polycab","finolex","honeywell","fortinet","sophos","cisco","aruba","tp link"]) if(t.includes(b)) return b;
 return "";
}
function compatibleUnit(a:string,b?:string|null){
 const x=norm(a),y=norm(b);
 if(!y||x===y)return true;
 const groups=[["nos","no","pcs","piece","pieces","camera"],["meter","m","metre","meter"],["job"],["set"],["box"],["tb","terabyte","terabytes"],["point","points"]];
 return groups.some(g=>g.includes(x)&&g.includes(y));
}
function semanticHints(item:Recommendation){
 const s=norm([item.item_name,item.specification,item.subcategory].join(" "));
 return {
  dome:s.includes("dome"),
  bullet:s.includes("bullet"),
  cat6:s.includes("cat6"),
  nvr:s.includes("nvr"),
  poe:s.includes("poe"),
  rj45:s.includes("rj45"),
  patch:s.includes("patch"),
  rack:s.includes("rack"),
  ups:s.includes("ups"),
  hdd:s.includes("hdd")||s.includes("storage"),
  installation:s.includes("installation")||s.includes("configuration")||s.includes("laying")
 };
}
function enrich(item:Recommendation,master:CatalogRow[],company:CatalogRow[],input:string){
 const brand=preferredBrand(input), hints=semanticHints(item);
 let best:CatalogRow|null=null,bestScore=0;
 for(const p of master.filter(x=>x.active!==false)){
  const pCategory=norm(p.category), pSub=norm(p.subcategory), iCategory=norm(item.category), iSub=norm(item.subcategory);
  if(iCategory && pCategory && iCategory!==pCategory) continue;
  if(iSub && pSub && iSub!==pSub && !(iSub.includes(pSub)||pSub.includes(iSub))) continue;
  if(!compatibleUnit(item.unit,p.unit)) continue;
  const hay=norm([p.category,p.subcategory,p.brand,p.model,p.name,p.specification].filter(Boolean).join(" "));
  let score=30;
  if(iSub && pSub===iSub) score+=35;
  else if(iSub && (iSub.includes(pSub)||pSub.includes(iSub))) score+=15;
  if(brand&&norm(p.brand||"").includes(brand))score+=25;
  for(const t of tokens(item.item_name))if(hay.includes(t))score+=6;
  for(const t of tokens(item.specification))if(hay.includes(t))score+=2;
  if(hints.dome && hay.includes("dome")) score+=25;
  if(hints.dome && hay.includes("bullet")) score-=40;
  if(hints.bullet && hay.includes("bullet")) score+=25;
  if(hints.bullet && hay.includes("dome")) score-=40;
  if(hints.cat6 && hay.includes("cat6")) score+=15;
  if(hints.nvr && hay.includes("nvr")) score+=20;
  if(hints.poe && hay.includes("poe")) score+=15;
  if(hints.rj45 && hay.includes("rj45")) score+=20;
  if(hints.patch && hay.includes("patch")) score+=15;
  if(hints.installation && !(hay.includes("installation")||hay.includes("configuration")||hay.includes("laying"))) score-=30;
  if(p.model&&norm(input).includes(norm(p.model)))score+=100;
  if(p.name&&norm(input).includes(norm(p.name)))score+=80;
  if(score>bestScore){bestScore=score;best=p;}
 }
 const matched=bestScore>=55?best:null;
 const priced=matched?company.find(p=>p.active!==false&&(p.master_product_id===matched.id||(matched.model&&p.model===matched.model)||(matched.name&&norm(p.name)===norm(matched.name)))):null;
 return {...item,
  item_name:matched?.name||item.item_name,
  specification:matched?[matched.brand,matched.model,matched.specification].filter(Boolean).join(" · "):item.specification,
  unit:compatibleUnit(item.unit,matched?.unit)?(matched?.unit||item.unit):item.unit,
  unit_price:priced&&compatibleUnit(item.unit,priced.unit)?Number(priced.selling_price||0):0,
  master_product_id:matched?.id||undefined,
  notes:[item.reason,
    matched?"MASTER CATALOGUE: "+[matched.brand,matched.model,matched.name].filter(Boolean).join(" "):"MASTER CATALOGUE: no confident semantic match",
    priced&&compatibleUnit(item.unit,priced.unit)?"COMPANY PRICE: ₹"+Number(priced.selling_price||0):"PRICE PENDING: add/activate a compatible unit price in Product Catalogue or enter a manual rate.",
    item.review_required?"ENGINEERING REVIEW: verify against site/drawing before final quotation.":""].filter(Boolean).join(" ")
 };
}
export function buildEngineeringBoq(input:string,master:CatalogRow[],company:CatalogRow[]){
 const result:Recommendation[]=[...recommendRequirement(input)], b=cameraBreakdown(input);
 if(b.dome||b.bullet){
  const filtered=result.filter(x=>norm(x.item_name)!=="ip camera");
  if(b.dome)filtered.unshift({category:"CCTV",subcategory:"IP Dome Camera",item_name:"IP Dome Camera",specification:"IP PoE dome camera; H.265/H.265+, IR, resolution/lens to be confirmed",quantity:b.dome,unit:"Nos",reason:"Dome quantity parsed from customer requirement.",required:true,review_required:true,priority:"mandatory"});
  if(b.bullet)filtered.unshift({category:"CCTV",subcategory:"IP Bullet Camera",item_name:"IP Bullet Camera",specification:"IP PoE outdoor bullet camera; H.265/H.265+, IR, weatherproof rating and lens to be confirmed",quantity:b.bullet,unit:"Nos",reason:"Bullet quantity parsed from customer requirement.",required:true,review_required:true,priority:"mandatory"});
  result.splice(0,result.length,...filtered);
 }
 if(b.total>0){
  const extra:Recommendation[]=[
   {category:"Cable",subcategory:"Power Cable",item_name:"3 Core Power Cable - CCTV",specification:"3-core copper power cable for auxiliary CCTV power as required; final route and size to be confirmed",quantity:Math.max(1,b.total*10),unit:"Meter",reason:"Planning allowance of 10 m/camera; revise after site survey.",required:false,review_required:true},
   {category:"Installation",subcategory:"Cable Management",item_name:"PVC Conduit / Flexible Pipe / Cable Protection",specification:"Cable protection for exposed/field runs; final type and route length after site survey",quantity:Math.max(1,b.total*10),unit:"Meter",reason:"Planning allowance of 10 m/camera for protected routing.",required:false,review_required:true},
   {category:"Installation",subcategory:"Accessories",item_name:"CCTV Cable Fasteners / Clips / Screws",specification:"Fasteners and consumables for camera/cable installation",quantity:b.total,unit:"Set",reason:"One installation consumables set per camera.",required:false}
  ];
  for(const x of extra)if(!result.some(y=>norm(y.item_name)===norm(x.item_name)))result.push(x);
 }
 return result.map(x=>enrich(x,master,company,input));
}
