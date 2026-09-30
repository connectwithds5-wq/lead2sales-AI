function Quotation({onClose,leadId}:{onClose:()=>void,leadId?:string}){const [lead,setLead]=useState<any>(null);const [items,setItems]=useState<any[]>([]);const [originalBoqIds,setOriginalBoqIds]=useState<string[]>([]);const [company,setCompany]=useState<any>(null);const [gst,setGst]=useState(18);const [quoteNo,setQuoteNo]=useState("L2S-"+new Date().getFullYear()+"-"+String(Date.now()).slice(-6));const [followDate,setFollowDate]=useState("");const [followNote,setFollowNote]=useState("");const [loading,setLoading]=useState(true);const [savingQuote,setSavingQuote]=useState(false);useEffect(()=>{(async()=>{const cid=localStorage.getItem("lead2sales_company_id");if(!cid){setLoading(false);return}const {data:co}=await supabase.from("companies").select("*").eq("id",cid).single();setCompany(co);const {data:leads}=await supabase.from("leads").select("*").eq("company_id",cid).order("created_at",{ascending:false});const l=leadId?leads?.find((x:any)=>x.id===leadId):leads?.[0];if(l){setLead(l);const {data:boq}=await supabase.from("lead_boq_items").select("*").eq("lead_id",l.id).order("created_at");if(boq&&boq.length){setItems((boq||[]).map((x:any)=>({...x,__persisted:true})));setOriginalBoqIds((boq||[]).map((x:any)=>x.id))}else{setOriginalBoqIds([]);const {data:catalog}=await supabase.from("product_catalog").select("*").eq("company_id",cid).eq("active",true);const generated=recommendRequirement(l.requirement).map((x:any)=>{const matches=(catalog||[]).filter((p:any)=>p.category===x.category&&(!x.subcategory||!p.subcategory||p.subcategory===x.subcategory));const priced=matches.filter((p:any)=>Number(p.selling_price||0)>0);const pool=priced.length?priced:matches;const match=pool.find((p:any)=>String(p.name||"").toLowerCase().includes(String(x.item_name||"").toLowerCase().replace("ip ","")))||pool[0];return {...x,product_id:match?.id||null,unit_price:match?Number(match.selling_price||0):0,__persisted:false}});setItems(generated)}}setLoading(false)})()},[]);const clientItems=items.filter(x=>!String(x.notes||"").startsWith("MANUAL REVIEW REQUIRED:"));const unresolvedItems=items.length-clientItems.length;const subtotal=clientItems.reduce((a,x)=>a+Number(x.quantity)*Number(x.unit_price),0);const tax=subtotal*gst/100;const total=subtotal+tax;if(loading)return <div className="overlay"><div className="catalogModal">Loading quotation…</div></div>;return <div className="overlay"><div className="quoteModal"><div className="quoteActions"><button className="ghost" onClick={onClose}>Close</button><div className="quoteFollowFields"><label>Follow-up date/time<input type="datetime-local" value={followDate} onChange={e=>setFollowDate(e.target.value)}/></label><label>Note<input value={followNote} onChange={e=>setFollowNote(e.target.value)} placeholder="e.g. Call customer after quotation"/></label></div><button className="ghost" onClick={async()=>{
  if(unresolvedItems>0){alert("Please complete the BOQ lines marked Needs details before creating the customer quotation.");return}
  if(!lead){alert("No lead selected.");return}
  const cid=localStorage.getItem("lead2sales_company_id");
  if(!cid){alert("Company workspace is missing. Please sign in again.");return}
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){alert("Your session has expired. Please sign in again.");return}
  if(savingQuote)return;
  setSavingQuote(true);
  const quotationPayload={company_id:cid,lead_id:lead.id,quotation_no:quoteNo,subtotal,gst_percent:gst,gst_amount:tax,grand_total:total,status:"draft"};
  const {data:existingQuote,error:lookupError}=await supabase.from("quotations").select("id").eq("company_id",cid).eq("quotation_no",quoteNo).maybeSingle();
  if(lookupError){
    console.error("Quotation lookup failed:",lookupError);
    setSavingQuote(false);
    alert("Could not check existing quotation.\n"+(lookupError.message||"Unknown database error"));
    return
  }
  let quotationId="";
  if(existingQuote?.id){
    quotationId=existingQuote.id;
    const {error:qError}=await supabase.from("quotations").update(quotationPayload).eq("id",quotationId).eq("company_id",cid);
    if(qError){
      console.error("Quotation update failed:",qError);
      setSavingQuote(false);
      alert("Could not update quotation.\n"+(qError.message||"Unknown database error"));
      return
    }
    await supabase.from("quotation_items").delete().eq("quotation_id",quotationId);
  }else{
    quotationId=crypto.randomUUID();
    const {error:qError}=await supabase.from("quotations").insert({id:quotationId,...quotationPayload});
    if(qError){
      console.error("Quotation insert failed:",qError);
      setSavingQuote(false);
      alert("Could not save quotation.\n"+(qError.message||"Unknown database error"));
      return
    }
  }
  if(qError){
    console.error("Quotation insert failed:",qError);