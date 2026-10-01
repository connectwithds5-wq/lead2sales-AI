export type CatalogProduct = {
 id:string; category?:string|null; subcategory?:string|null; brand?:string|null; model?:string|null;
 name:string; specification?:string|null; unit?:string|null; attributes?:Record<string,unknown>|null;
};

const normalize=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
const stop=new Set(["the","a","an","for","with","and","of","nos","no","qty","quantity","pcs","piece","pieces","required","requirement","customer","mentioned"]);

export function extractRequestedQuantity(input:string){
 const m=input.match(/(?:-|x|×|:|\b)(\d+)\s*(?:nos?|pcs?|pieces?)\b/i)
   || input.match(/\b(\d+)\s*(?:nos?|pcs?|pieces?)\b/i);
 return m ? Math.max(1,Number(m[1])) : 1;
}

export function resolveCatalogProduct(input:string, products:CatalogProduct[]){
 const q=normalize(input);
 if(!q) return null;
 const qTokens=q.split(" ").filter(x=>!stop.has(x));
 let best:CatalogProduct|null=null;
 let bestScore=0;

 for(const p of products){
   const fields=[p.model,p.name,p.brand].filter(Boolean).map(x=>normalize(String(x)));
   const model=normalize(String(p.model||""));
   const name=normalize(p.name);
   const brand=normalize(String(p.brand||""));
   let score=0;
   if(model && (q===model || q.includes(model))) score+=100;
   if(name && (q===name || q.includes(name))) score+=90;
   if(brand && q.includes(brand)) score+=25;

   const searchable=normalize([p.brand,p.model,p.name,p.subcategory].filter(Boolean).join(" "));
   const hits=qTokens.filter(t=>searchable.split(" ").includes(t));
   score+=Math.min(50,hits.length*8);

   // Strong exact identity requirement: avoid turning a generic phrase into a catalogue match.
   const identity=model||name;
   const identityTokens=identity.split(" ").filter(x=>!stop.has(x));
   const identityHits=identityTokens.filter(t=>qTokens.includes(t)).length;
   const identityRatio=identityTokens.length?identityHits/identityTokens.length:0;
   if(identityRatio<0.75) continue;
   if(brand && q.includes(brand) && identityRatio<0.6) continue;

   if(score>bestScore){bestScore=score;best=p;}
 }
 return best && bestScore>=70 ? {product:best,score:bestScore,quantity:extractRequestedQuantity(input)} : null;
}
