export type Recommendation = {category:string; subcategory?:string; item_name:string; specification:string; quantity:number; unit:string; reason:string; required:boolean};

const has=(t:string,words:string[])=>words.some(w=>t.includes(w));

export function recommendRequirement(input:string):Recommendation[]{
  const t=input.toLowerCase(); const out:Recommendation[]=[];
  const add=(x:Recommendation)=>{if(!out.some(y=>y.category===x.category&&y.item_name===x.item_name))out.push(x)};
  const m=t.match(/(\d+)\s*(?:camera|cameras|cam)/);
  const cameras=m?Number(m[1]):(has(t,["camera","cctv","surveillance"])?4:0);
  if(cameras){const nvr=cameras<=8?8:cameras<=16?16:cameras<=32?32:64;const ports=cameras<=4?8:cameras<=16?16:24;
    add({category:"CCTV",subcategory:"IP Camera",item_name:"IP Camera",specification:"4MP/5MP IP camera, IR night vision, H.265, PoE",quantity:cameras,unit:"Nos",reason:"Required for the requested camera count.",required:true});
    add({category:"CCTV",subcategory:"NVR",item_name:nvr+" Channel NVR",specification:nvr+" Channel H.265 NVR",quantity:1,unit:"Nos",reason:"Central recording and management.",required:true});
    add({category:"Storage",subcategory:"Surveillance HDD",item_name:"Surveillance HDD",specification:"Surveillance-grade HDD; capacity based on retention",quantity:Math.max(1,Math.ceil(cameras*0.18*24*30/1000)),unit:"TB",reason:"Recording storage.",required:false});
    add({category:"Network",subcategory:"PoE Switch",item_name:ports+" Port PoE Switch",specification:ports+" Port PoE switch with suitable uplink",quantity:1,unit:"Nos",reason:"Power and network connectivity for cameras.",required:false});
    add({category:"Cable",subcategory:"Network Cable",item_name:"CAT6 Cable",specification:"CAT6 UTP; final quantity after site survey",quantity:305,unit:"Meter",reason:"Camera network cabling.",required:false});
    add({category:"IT Infrastructure",subcategory:"Rack",item_name:"Network Rack",specification:"Rack sized for NVR, switch and UPS",quantity:1,unit:"Nos",reason:"Organized equipment mounting.",required:false});
    add({category:"IT Infrastructure",subcategory:"UPS",item_name:"UPS",specification:"Capacity based on connected load",quantity:1,unit:"Nos",reason:"Backup power for critical equipment.",required:false});
    add({category:"Service",subcategory:"Installation",item_name:"CCTV Installation & Configuration",specification:"Mounting, termination, configuration and testing",quantity:cameras,unit:"Camera",reason:"Installation and commissioning.",required:true});
  }
  if(has(t,["firewall","network security","cyber security","dual isp","2 isp","two isp","wan"])){
    add({category:"Firewall",subcategory:"Firewall",item_name:"Next-Generation Firewall",specification:"Firewall with VPN, security policies and suitable throughput",quantity:1,unit:"Nos",reason:"Protects and controls internet traffic.",required:true});
  }
  if(has(t,["wifi","wi-fi","wireless","access point"])){
    const ap=t.match(/(\d+)\s*(?:ap|access point|wifi|wi-fi)/)?.[1];
    add({category:"Wi-Fi",subcategory:"Access Point",item_name:"Wi-Fi Access Point",specification:"Business-class dual-band access point",quantity:ap?Number(ap):1,unit:"Nos",reason:"Wireless coverage.",required:true});
    add({category:"Network",subcategory:"PoE Switch",item_name:"PoE Switch",specification:"PoE switch sized for access points",quantity:1,unit:"Nos",reason:"Can power compatible access points.",required:false});
  }
  if(has(t,["switch","lan","network","structured cabling"])){
    add({category:"Network",subcategory:"Switch",item_name:"Gigabit Network Switch",specification:"Managed/unmanaged Gigabit switch sized for required ports",quantity:1,unit:"Nos",reason:"Wired LAN connectivity.",required:true});
    add({category:"Cable",subcategory:"Network Cable",item_name:"CAT6 Cable",specification:"CAT6 UTP; final quantity after site survey",quantity:305,unit:"Meter",reason:"Structured Ethernet cabling.",required:false});
    add({category:"IT Infrastructure",subcategory:"Rack",item_name:"Network Rack",specification:"Rack sized for switch and patch panel",quantity:1,unit:"Nos",reason:"Organized network equipment.",required:false});
  }
  if(has(t,["access control","door access","attendance","fingerprint","face recognition","rfid","biometric"])){
    add({category:"Access Control",subcategory:"Controller",item_name:"Access Controller",specification:"Controller sized for required doors",quantity:1,unit:"Nos",reason:"Controls authorized door access.",required:true});
    add({category:"Access Control",subcategory:"Reader",item_name:"RFID / Face / Fingerprint Reader",specification:"Authentication terminal",quantity:1,unit:"Nos",reason:"Identifies users.",required:true});
    add({category:"Access Control",subcategory:"Lock",item_name:"Electromagnetic Lock",specification:"Suitable electromagnetic door lock",quantity:1,unit:"Nos",reason:"Controlled physical locking.",required:false});
    add({category:"Access Control",subcategory:"Exit Button",item_name:"Exit Push Button",specification:"Door exit button",quantity:1,unit:"Nos",reason:"Exit-side release.",required:false});
  }
  if(has(t,["intercom","video door","door phone"]))add({category:"Intercom",subcategory:"Video Door Phone",item_name:"Video Intercom System",specification:"Outdoor station + indoor monitor / IP intercom",quantity:1,unit:"Set",reason:"Visitor communication.",required:true});
  if(has(t,["fire alarm","smoke detector","mcp","fire safety","hooter"])){
    add({category:"Fire Alarm",subcategory:"Panel",item_name:"Fire Alarm Panel",specification:"Panel sized to detection points",quantity:1,unit:"Nos",reason:"Central alarm control.",required:true});
    add({category:"Fire Alarm",subcategory:"Smoke Detector",item_name:"Smoke Detector",specification:"Suitable smoke detector",quantity:1,unit:"Nos",reason:"Smoke detection.",required:true});
    add({category:"Fire Alarm",subcategory:"Manual Call Point",item_name:"Manual Call Point",specification:"Manual fire alarm call point",quantity:1,unit:"Nos",reason:"Manual alarm activation.",required:false});
  }
  if(has(t,["interactive panel","interactive flat panel","smart board","digital classroom","classroom display"])){
    add({category:"Display",subcategory:"Interactive Panel",item_name:"Interactive Flat Panel",specification:"75-inch interactive display; size adjustable",quantity:1,unit:"Nos",reason:"Interactive classroom/meeting display.",required:true});
    add({category:"Display",subcategory:"Mounting",item_name:"Interactive Panel Wall Mount",specification:"Heavy-duty wall mount or trolley",quantity:1,unit:"Nos",reason:"Safe installation.",required:false});
  }
  return out;
}
