export type Recommendation = {
  category: string;
  subcategory?: string;
  item_name: string;
  specification: string;
  quantity: number;
  unit: string;
  reason: string;
  required: boolean;
  review_required?: boolean;
};

const has = (t: string, words: string[]) => words.some((w) => t.includes(w));

const firstNumber = (t: string, patterns: RegExp[]) => {
  for (const p of patterns) {
    const m = t.match(p);
    if (m) return Number(m[1]);
  }
  return 0;
};

const ceilTo = (n: number, step: number) => Math.ceil(n / step) * step;

const addUnique = (out: Recommendation[], x: Recommendation) => {
  const key = (y: Recommendation) => [y.category, y.item_name].join("|").toLowerCase();
  if (!out.some((y) => key(y) === key(x))) out.push(x);
};

const manual = (out: Recommendation[], note: string, source: string) => {
  addUnique(out, {
    category: "Manual Review",
    subcategory: "Sales / Engineering",
    item_name: "MANUAL REVIEW: " + note,
    specification: "Customer mentioned: " + source + ". Confirm exact quantity, specification, route, brand/model, site condition and installation scope before quotation.",
    quantity: 1,
    unit: "Job",
    reason: "AI could not safely derive a final BOQ quantity/specification. Sales/engineering must confirm this item.",
    required: true,
    review_required: true,
  });
};

export function recommendRequirement(input: string): Recommendation[] {
  const t = input.toLowerCase().replace(/[;,]/g, " ");
  const out: Recommendation[] = [];

  // CCTV
  const cameras = firstNumber(t, [
    /(\d+)\s*(?:cctv|cameras?|cams?)\b/,
    /(?:cctv|cameras?|cams?)\s*(?:of|x|:)?\s*(\d+)\b/,
  ]) || (has(t, ["cctv", "camera", "surveillance"]) ? 4 : 0);

  const retention = firstNumber(t, [
    /(\d+)\s*(?:day|days)\s*(?:recording|retention|backup)/,
    /(?:recording|retention)\s*(?:for|of)?\s*(\d+)\s*(?:day|days)/,
  ]) || 30;

  if (cameras > 0) {
    // Presales sizing: keep recorder headroom and size PoE by both ports and power.
    // NVR: current cameras + 20% expansion/headroom, then select the next standard tier.
    const requiredChannels = Math.ceil(cameras * 1.2);
    const nvr = requiredChannels <= 8 ? 8 : requiredChannels <= 16 ? 16 : requiredChannels <= 32 ? 32 : requiredChannels <= 64 ? 64 : requiredChannels <= 128 ? 128 : 256;

    // Fixed-camera planning assumption: 15 W/camera + 20% PoE headroom.
    // 48-port PoE+ class is used for high-density CCTV; 740 W is a common enterprise tier.
    const cameraPortsPerSwitch = cameras <= 8 ? 8 : cameras <= 16 ? 16 : cameras <= 24 ? 24 : 48;
    const switchCount = Math.max(1, Math.ceil(cameras / cameraPortsPerSwitch));
    const poeBudgetRequired = Math.ceil(cameras * 15 * 1.2);
    const poeBudgetPerSwitch = Math.ceil(poeBudgetRequired / switchCount);

    const cableMeters = cameras * 60;

    // Storage is bitrate-driven, not a fixed camera-count multiplier.
    // Default planning assumption: H.265, 4 Mbps/camera, 24x7 recording.
    const motionFactor = has(t, ["motion recording", "motion only", "event recording", "event only"]) ? 0.4 : 1;
    const planningBitrateMbps = 4;
    const rawStorageTb = (cameras * planningBitrateMbps * 10.8 * retention * motionFactor) / 1000;
    const storageTb = Math.max(1, Math.ceil(rawStorageTb * 1.2));

    addUnique(out, { category:"CCTV", subcategory:"IP Camera", item_name:"IP Camera", specification:"IP camera, PoE, H.265/H.265+, IR night vision; megapixel/lens/type to be confirmed", quantity:cameras, unit:"Nos", reason:"Exact camera quantity parsed from customer requirement.", required:true });
    addUnique(out, { category:"CCTV", subcategory:"NVR", item_name:nvr+" Channel NVR", specification:nvr+" Channel H.265/H.265+ NVR; minimum "+requiredChannels+" channels required after 20% headroom; confirm incoming bandwidth, decoding and HDD bays against final camera bitrate/resolution", quantity:1, unit:"Nos", reason:"NVR sized from "+cameras+" cameras plus 20% design headroom ("+requiredChannels+" channels required).", required:true, review_required:true });
    addUnique(out, { category:"Storage", subcategory:"Surveillance HDD", item_name:"Surveillance Storage - "+storageTb+" TB", specification:"Surveillance-grade storage target "+storageTb+" TB including 20% design headroom; planning basis "+planningBitrateMbps+" Mbps/camera, H.265, "+(motionFactor<1?"motion/event recording":"24x7 continuous recording")+", "+retention+" days. Final HDD count/RAID must match NVR supported bays and drive size.", quantity:storageTb, unit:"TB", reason:"Calculated from camera bitrate × camera count × recording time × retention, then 20% design headroom.", required:true, review_required:true });
    addUnique(out, { category:"Network", subcategory:"PoE Switch", item_name:cameraPortsPerSwitch+" Port PoE+ Managed Switch", specification:cameraPortsPerSwitch+"-port Gigabit PoE+ managed switch; total PoE budget requirement ≈ "+poeBudgetRequired+" W, so provide "+switchCount+" switch(es) with at least "+poeBudgetPerSwitch+" W PoE budget each; uplinks to CCTV aggregation/core", quantity:switchCount, unit:"Nos", reason:"PoE sized from "+cameras+" cameras at 15 W/camera with 20% power headroom and "+cameraPortsPerSwitch+"-port switch density.", required:true, review_required:true });
    addUnique(out, { category:"Cable", subcategory:"CCTV Cabling", item_name:"CAT6 Cable - CCTV", specification:"CAT6 UTP; planning allowance 60 m per camera; final route length after site survey", quantity:cableMeters, unit:"Meter", reason:"60 m average planning allowance × "+cameras+" cameras.", required:true, review_required:true });
    addUnique(out, { category:"Cable", subcategory:"RJ45 Connector", item_name:"RJ45 CAT6 Connector - CCTV", specification:"RJ45 connectors for both ends of CCTV CAT6 runs", quantity:cameras*2, unit:"Nos", reason:"Two termination ends per camera run.", required:false });
    addUnique(out, { category:"CCTV", subcategory:"Junction Box", item_name:"CCTV Junction Box", specification:"Junction/mounting box suitable for selected camera", quantity:cameras, unit:"Nos", reason:"One mounting/junction accessory per camera.", required:false });
    const patchPanels = Math.max(1, Math.ceil(cameras / 24));
    addUnique(out, { category:"Network", subcategory:"Patch Panel", item_name:"CAT6 Patch Panel - CCTV", specification:"24-port loaded CAT6 patch panel for CCTV terminations; "+patchPanels+" panels provide "+(patchPanels*24)+" ports for "+cameras+" camera runs", quantity:patchPanels, unit:"Nos", reason:"Patch panel capacity calculated as 24 ports per panel for "+cameras+" camera runs.", required:false });
    addUnique(out, { category:"Network", subcategory:"Patch Cord", item_name:"CAT6 Patch Cord - CCTV", specification:"Rack-side CAT6 patch cords", quantity:cameras, unit:"Nos", reason:"Rack-side patching for camera links.", required:false });
    const estimatedRackU = 2 + (switchCount * 1) + (patchPanels * 1) + 1 + 2 + 2;
    const rackSizeU = estimatedRackU <= 18 ? 18 : estimatedRackU <= 27 ? 27 : estimatedRackU <= 42 ? 42 : 45;
    addUnique(out, { category:"IT Infrastructure", subcategory:"Rack", item_name:rackSizeU+"U Network Rack", specification:rackSizeU+"U floor/wall rack sized for "+nvr+"-channel NVR, "+switchCount+" PoE switch(es), "+patchPanels+" patch panel(s), PDU, cable management and UPS/interface accessories", quantity:1, unit:"Nos", reason:"Rack size estimated from active CCTV equipment and termination hardware.", required:false, review_required:true });
    addUnique(out, { category:"IT Infrastructure", subcategory:"PDU", item_name:"Rack PDU", specification:"Rack-mount PDU with adequate sockets", quantity:1, unit:"Nos", reason:"Rack power distribution.", required:false });
    addUnique(out, { category:"IT Infrastructure", subcategory:"UPS", item_name:"UPS", specification:"UPS sized from actual NVR/switch/network load and required backup time", quantity:1, unit:"Nos", reason:"Backup power for active equipment.", required:false, review_required:true });
    addUnique(out, { category:"Service", subcategory:"Site Survey", item_name:"Site Survey & CCTV Consultation", specification:"Camera placement, viewing angle, cable route, power, network and recording validation", quantity:1, unit:"Job", reason:"Required to validate assumptions and final scope.", required:true });
    addUnique(out, { category:"Service", subcategory:"Installation", item_name:"CCTV Installation & Configuration", specification:"Mounting, termination, rack/PoE/NVR configuration, testing and commissioning", quantity:cameras, unit:"Camera", reason:"Installation and commissioning per camera.", required:true });
    addUnique(out, { category:"Service", subcategory:"Cable Laying", item_name:"CAT6 Cable Laying & Dressing - CCTV", specification:"Laying, routing, dressing, tagging and termination support", quantity:cableMeters, unit:"Meter", reason:"Installation service for estimated CCTV cable route.", required:false, review_required:true });

    if (has(t, ["analog camera","analog cctv","dvr","ahd","hd-tvi","cvi"])) manual(out, "Analog CCTV / DVR architecture", input);
    if (has(t, ["ptz","speed dome"])) {
      const ptz = firstNumber(t, [/(\d+)\s*(?:ptz|speed\s*dome)/]) || 1;
      addUnique(out, { category:"CCTV", subcategory:"PTZ", item_name:"PTZ / Speed Dome Camera", specification:"PTZ camera; zoom, IR range and mounting to be confirmed", quantity:ptz, unit:"Nos", reason:"PTZ camera requirement detected.", required:true, review_required:true });
    }
    if (has(t, ["monitor","display screen","client monitor"])) {
      const monitors = firstNumber(t, [/(\d+)\s*(?:monitor|display\s*screen)/]) || 1;
      addUnique(out, { category:"Display", subcategory:"CCTV Monitor", item_name:"CCTV Monitor", specification:"Commercial/security monitor sized for viewing requirement", quantity:monitors, unit:"Nos", reason:"Monitoring display requirement detected.", required:false, review_required:true });
    }
    if (!/(?:day|days)\s*(?:recording|retention|backup)|(?:recording|retention)\s*(?:for|of)?\s*\d+\s*days?/.test(t)) manual(out, "Recording retention period", "Retention/recording duration was not specified.");
  }

  // LAN / structured cabling
  const lanPoints = firstNumber(t, [
    /(\d+)\s*(?:lan|data|network|ethernet)\s*(?:points?|ports?|outlets?|nodes?)/,
    /(?:lan|data|network|ethernet)\s*(?:points?|ports?|outlets?|nodes?)\s*(?:x|:|of)?\s*(\d+)/,
  ]);
  const structured = has(t, ["lan","data point","network point","ethernet point","structured cabling","data outlet","network outlet"]);
  if (structured || lanPoints > 0) {
    const points = lanPoints || 1;
    const lanCable = points * 45;
    const switchPorts = points <= 8 ? 8 : points <= 16 ? 16 : points <= 24 ? 24 : points <= 48 ? 48 : 48;
    const patchPorts = Math.max(1, Math.ceil(points / 24));
    if (!lanPoints) manual(out, "LAN/data point quantity", input);
    addUnique(out, { category:"Network", subcategory:"LAN Point", item_name:"LAN Data Point", specification:"CAT6 data outlet/keystone + faceplate; exact outlet type to be confirmed", quantity:points, unit:"Point", reason:lanPoints ? "Exact LAN/data point quantity parsed from requirement." : "LAN requirement detected but quantity was not specified.", required:true, review_required:!lanPoints });
    addUnique(out, { category:"Network", subcategory:"Switch", item_name:switchPorts+" Port Gigabit Network Switch", specification:switchPorts+" port Gigabit switch; managed/unmanaged and PoE requirement to be confirmed", quantity:1, unit:"Nos", reason:"Switch sized for LAN point count with spare capacity.", required:true, review_required:true });
    addUnique(out, { category:"Cable", subcategory:"LAN Cabling", item_name:"CAT6 Cable - LAN", specification:"CAT6 UTP; planning allowance 45 m per LAN point; final route length after site survey", quantity:lanCable, unit:"Meter", reason:"45 m average planning allowance × "+points+" LAN points.", required:true, review_required:true });
    addUnique(out, { category:"Cable", subcategory:"RJ45 Connector", item_name:"RJ45 CAT6 Connector - LAN", specification:"RJ45 connectors for both ends of LAN runs", quantity:points*2, unit:"Nos", reason:"Two termination ends per LAN point.", required:false });
    addUnique(out, { category:"Network", subcategory:"Patch Panel", item_name:"CAT6 Patch Panel - LAN", specification:"Loaded CAT6 patch panel", quantity:patchPorts, unit:"Nos", reason:"Patch panel capacity for LAN terminations.", required:true });
    addUnique(out, { category:"Network", subcategory:"Patch Cord", item_name:"CAT6 Patch Cord - LAN", specification:"Rack-side CAT6 patch cord", quantity:points, unit:"Nos", reason:"Rack-side patching for LAN points.", required:false });
    addUnique(out, { category:"IT Infrastructure", subcategory:"Rack", item_name:"Network Rack - LAN", specification:"Rack sized for switch, patch panel, PDU and accessories", quantity:1, unit:"Nos", reason:"LAN equipment mounting.", required:false });
    addUnique(out, { category:"Service", subcategory:"Installation", item_name:"LAN Point Installation & Termination", specification:"Outlet installation, CAT6 termination, labeling, testing and certification", quantity:points, unit:"Point", reason:"Installation per LAN point.", required:true });
    addUnique(out, { category:"Service", subcategory:"Testing", item_name:"LAN Cable Testing & Certification", specification:"Continuity/wiremap testing; certification if required", quantity:points, unit:"Point", reason:"Verify every installed LAN point.", required:false });
  }

  // Wi-Fi
  const apCount = firstNumber(t, [
    /(\d+)\s*(?:wifi|wi-fi|wireless)\s*(?:aps?|access\s*points?)/,
    /(\d+)\s*(?:aps?|access\s*points?)/,
  ]);
  if (has(t, ["wifi","wi-fi","wireless","access point"]) || apCount > 0) {
    const aps = apCount || 1;
    if (!apCount) manual(out, "Wi-Fi access point quantity", input);
    addUnique(out, { category:"Wi-Fi", subcategory:"Access Point", item_name:"Wi-Fi Access Point", specification:"Business-class dual-band/tri-band AP; Wi-Fi generation and indoor/outdoor type to be confirmed", quantity:aps, unit:"Nos", reason:apCount ? "Exact AP quantity parsed from requirement." : "Wi-Fi requirement detected without exact AP count.", required:true, review_required:!apCount });
    addUnique(out, { category:"Wi-Fi", subcategory:"Controller", item_name:"Wi-Fi Controller / Cloud Management", specification:"Controller/cloud management as required by selected AP ecosystem", quantity:1, unit:"Set", reason:"Central Wi-Fi management may be required.", required:false, review_required:true });
    addUnique(out, { category:"Network", subcategory:"PoE Switch", item_name:"PoE Switch - Wi-Fi", specification:"PoE switch sized for AP count and power budget", quantity:1, unit:"Nos", reason:"Power/network connectivity for APs.", required:false, review_required:true });
    addUnique(out, { category:"Service", subcategory:"Wi-Fi Survey", item_name:"Wi-Fi Site Survey & Heatmap", specification:"Coverage, capacity and interference survey", quantity:1, unit:"Job", reason:"Required for final AP placement.", required:false, review_required:true });
  }

  // Firewall / WAN
  if (has(t, ["firewall","next generation firewall","ngfw","network security","cyber security","dual isp","2 isp","two isp","wan","vpn"])) {
    const isps = firstNumber(t, [/(\d+)\s*(?:isp|internet\s*lines?|wan\s*links?)/]) || (has(t, ["dual isp","2 isp","two isp"]) ? 2 : 1);
    addUnique(out, { category:"Firewall", subcategory:"Firewall", item_name:"Next-Generation Firewall", specification:"NGFW with VPN, security policies, IPS/UTM as required; throughput/users/features to be confirmed", quantity:1, unit:"Nos", reason:"Firewall/security requirement detected.", required:true, review_required:true });
    addUnique(out, { category:"Firewall", subcategory:"WAN", item_name:"WAN / ISP Connection", specification:"ISP/WAN links", quantity:isps, unit:"Link", reason:"WAN/ISP requirement detected.", required:false, review_required:true });
    if (has(t, ["vpn"])) addUnique(out, { category:"Firewall", subcategory:"VPN", item_name:"VPN Configuration", specification:"Site-to-site or remote-access VPN; topology/users to be confirmed", quantity:1, unit:"Job", reason:"VPN requirement detected.", required:false, review_required:true });
  }

  // Access control
  const doors = firstNumber(t, [
    /(\d+)\s*(?:door|doors)\b/,
    /(?:door|doors)\s*(?:x|:|of)?\s*(\d+)\b/,
  ]);
  if (has(t, ["access control","door access","attendance","fingerprint","face recognition","rfid","biometric","magnetic lock","em lock"]) || doors > 0) {
    const d = doors || 1;
    if (has(t, ["access control","door access"]) && !doors) manual(out, "Access-control door count", input);
    addUnique(out, { category:"Access Control", subcategory:"Controller", item_name:"Access Controller", specification:"Controller sized for "+d+" door(s); architecture to be confirmed", quantity:Math.max(1,Math.ceil(d/2)), unit:"Nos", reason:"Controller capacity based on door count.", required:true, review_required:!doors });
    addUnique(out, { category:"Access Control", subcategory:"Reader", item_name:"Access Reader", specification:"RFID/face/fingerprint reader as required", quantity:d, unit:"Nos", reason:"Reader per controlled door/entry point.", required:true, review_required:true });
    addUnique(out, { category:"Access Control", subcategory:"Lock", item_name:"Electromagnetic / Electric Lock", specification:"Door lock compatible with selected access system", quantity:d, unit:"Nos", reason:"Lock per controlled door.", required:false, review_required:true });
    addUnique(out, { category:"Access Control", subcategory:"Exit Button", item_name:"Exit Push Button / REX", specification:"Exit release device", quantity:d, unit:"Nos", reason:"Exit-side release per controlled door.", required:false });
    addUnique(out, { category:"Access Control", subcategory:"Door Contact", item_name:"Door Contact", specification:"Door status contact", quantity:d, unit:"Nos", reason:"Door status monitoring.", required:false });
    addUnique(out, { category:"Service", subcategory:"Installation", item_name:"Access Control Installation & Configuration", specification:"Reader, controller, lock, exit device, wiring and testing", quantity:d, unit:"Door", reason:"Installation per controlled door.", required:true });
  }

  // Intercom
  const intercomCount = firstNumber(t, [/(\d+)\s*(?:intercom|door\s*phone|video\s*door)/]);
  if (has(t, ["intercom","video door","door phone"]) || intercomCount > 0) {
    const q = intercomCount || 1;
    addUnique(out, { category:"Intercom", subcategory:"Video Door Phone", item_name:"Video Intercom System", specification:"Outdoor station + indoor monitor/IP intercom; number of indoor stations to be confirmed", quantity:q, unit:"Set", reason:"Intercom requirement detected.", required:true, review_required:true });
  }

  // Fire alarm
  const detectors = firstNumber(t, [/(\d+)\s*(?:smoke|heat)\s*(?:detectors?)/]);
  const mcp = firstNumber(t, [/(\d+)\s*(?:mcp|manual\s*call\s*points?)/]);
  if (has(t, ["fire alarm","smoke detector","mcp","fire safety","hooter","heat detector"])) {
    addUnique(out, { category:"Fire Alarm", subcategory:"Panel", item_name:"Fire Alarm Panel", specification:"Addressable/conventional panel sized to final detection points", quantity:1, unit:"Nos", reason:"Fire alarm system detected.", required:true, review_required:true });
    addUnique(out, { category:"Fire Alarm", subcategory:"Smoke Detector", item_name:"Smoke / Heat Detector", specification:"Detector type to be confirmed", quantity:detectors || 1, unit:"Nos", reason:detectors ? "Exact detector quantity parsed." : "Detector requirement detected without quantity.", required:true, review_required:!detectors });
    addUnique(out, { category:"Fire Alarm", subcategory:"Manual Call Point", item_name:"Manual Call Point", specification:"Manual fire alarm call point", quantity:mcp || 1, unit:"Nos", reason:mcp ? "Exact MCP quantity parsed." : "MCP quantity to be confirmed if required.", required:false, review_required:!mcp });
    addUnique(out, { category:"Fire Alarm", subcategory:"Hooter", item_name:"Fire Alarm Hooter / Sounder", specification:"Audible alarm sounder", quantity:1, unit:"Nos", reason:"Audible alarm output required; final count after coverage design.", required:false, review_required:true });
    addUnique(out, { category:"Service", subcategory:"Fire Alarm", item_name:"Fire Alarm Design & Commissioning", specification:"Point layout, loop/zoning, testing and commissioning", quantity:1, unit:"Job", reason:"Final design requires site and code review.", required:true, review_required:true });
  }

  // Display
  const panelCount = firstNumber(t, [/(\d+)\s*(?:interactive\s*panels?|smart\s*boards?|ifp)/]);
  if (has(t, ["interactive panel","interactive flat panel","smart board","digital classroom","classroom display"]) || panelCount > 0) {
    addUnique(out, { category:"Display", subcategory:"Interactive Panel", item_name:"Interactive Flat Panel", specification:"Interactive display; size, OS and accessories to be confirmed", quantity:panelCount || 1, unit:"Nos", reason:"Interactive display requirement detected.", required:true, review_required:!panelCount });
    addUnique(out, { category:"Display", subcategory:"Mounting", item_name:"Interactive Panel Wall Mount / Trolley", specification:"Heavy-duty mount/trolley compatible with selected panel", quantity:panelCount || 1, unit:"Nos", reason:"Mounting accessory for each panel.", required:false });
  }

  // Fiber
  if (has(t, ["fiber","fibre","optical fiber","ofc","sfp"])) {
    const fiberMeters = firstNumber(t, [
      /(\d+)\s*(?:m|meter|metre|meters|metres)\s*(?:fiber|fibre|ofc)/,
      /(?:fiber|fibre|ofc)\s*(?:cable)?\s*(\d+)\s*(?:m|meter|metre)/,
    ]);
    if (!fiberMeters) manual(out, "Fiber length / core count", input);
    addUnique(out, { category:"Fiber", subcategory:"Fiber Cable", item_name:"Optical Fiber Cable", specification:"Fiber cable; core count, OM/OS type and route to be confirmed", quantity:fiberMeters || 1, unit:fiberMeters ? "Meter" : "Job", reason:fiberMeters ? "Fiber length parsed from requirement." : "Fiber requirement detected without enough technical detail.", required:true, review_required:true });
    addUnique(out, { category:"Fiber", subcategory:"Termination", item_name:"Fiber Termination / Splicing", specification:"Fiber termination, splicing, ODF/LIU as required", quantity:1, unit:"Job", reason:"Fiber termination scope requires site/topology confirmation.", required:false, review_required:true });
  }

  // Server / NAS
  if (has(t, ["server","rack server","tower server","nas","storage server"])) {
    const servers = firstNumber(t, [/(\d+)\s*servers?\b/]) || 1;
    addUnique(out, { category:"Storage", subcategory:"Server", item_name:"Server / NAS", specification:"Server/NAS sized for application, users, storage, RAID and backup requirements", quantity:servers, unit:"Nos", reason:"Server/storage requirement detected.", required:true, review_required:true });
    addUnique(out, { category:"Service", subcategory:"Server", item_name:"Server Installation & Configuration", specification:"OS, RAID, network, backup and hardening as required", quantity:servers, unit:"Nos", reason:"Server deployment scope.", required:false, review_required:true });
  }

  // UPS
  if (has(t, ["ups","online ups","inverter","backup power"])) {
    addUnique(out, { category:"IT Infrastructure", subcategory:"UPS", item_name:"UPS", specification:"UPS; capacity, topology and backup time to be confirmed from connected load", quantity:1, unit:"Nos", reason:"Power backup requirement detected.", required:true, review_required:true });
  }

  // Piping / conduit / civil
  if (has(t, ["piping","pipe","conduit","pvc conduit","gi pipe","raceway","trunking","cable tray","trench","civil work","core cutting"])) {
    const meters = firstNumber(t, [
      /(\d+)\s*(?:m|meter|metre|meters|metres)\s*(?:piping|pipe|conduit|trunking|raceway|cable\s*tray)/,
      /(?:piping|pipe|conduit|trunking|raceway|cable\s*tray)\s*(?:of|:|x)?\s*(\d+)\s*(?:m|meter|metre)/,
    ]);
    addUnique(out, { category:"Civil / Installation", subcategory:"Conduit / Piping", item_name:meters ? "Conduit / Piping" : "MANUAL REVIEW: Conduit / Piping", specification:meters ? "Conduit/pipe/trunking; type and diameter to be confirmed" : "Customer requested piping/conduit but length/type was not specified. Confirm route, material, diameter and quantity.", quantity:meters || 1, unit:meters ? "Meter" : "Job", reason:meters ? "Piping/conduit length parsed; technical type still requires confirmation." : "Piping/conduit requirement detected without measurable quantity.", required:true, review_required:true });
  }

  // Electrical
  if (has(t, ["power point","electrical point","socket","mcb","db","electrical work","power supply"])) {
    const powerPoints = firstNumber(t, [/(\d+)\s*(?:power|electrical)\s*(?:points?|sockets?)/, /(\d+)\s*sockets?/]);
    if (!powerPoints) manual(out, "Electrical/power point quantity and load", input);
    addUnique(out, { category:"Electrical", subcategory:"Power Point", item_name:"Electrical Power Point", specification:"Power point/socket; circuit, load, cable size, MCB and DB scope to be confirmed", quantity:powerPoints || 1, unit:powerPoints ? "Point" : "Job", reason:powerPoints ? "Power point quantity parsed." : "Electrical requirement detected without enough design detail.", required:true, review_required:true });
  }

  // AMC
  if (has(t, ["amc","annual maintenance","maintenance contract","warranty"])) {
    addUnique(out, { category:"Service", subcategory:"AMC", item_name:"AMC / Maintenance", specification:"Maintenance scope, SLA, visits and response time to be confirmed", quantity:1, unit:"Year", reason:"AMC/maintenance requirement detected.", required:false, review_required:true });
  }

  // Vehicle gate / boom barrier
  const barrierQty = firstNumber(t, [
    /(\d+)\s*(?:boom\s*barriers?|boom\s*gates?|barrier\s*gates?|gate\s*barriers?)/,
    /(?:boom\s*barriers?|boom\s*gates?|barrier\s*gates?|gate\s*barriers?)\s*(?:x|:|of)?\s*(\d+)\b/,
  ]);
  const barrierMentioned = has(t, ["boom barrier","boom gate","barrier gate","gate barrier","vehicle barrier","automatic barrier"]);
  if (barrierMentioned) {
    const bq = barrierQty || 1;
    addUnique(out, { category:"Access Control", subcategory:"Vehicle Barrier", item_name:"Automatic Boom Barrier Gate", specification:"Automatic boom barrier for vehicle entry/exit; arm length, duty cycle, mounting and control interface to be confirmed", quantity:bq, unit:"Nos", reason:barrierQty ? "Exact barrier quantity parsed from customer requirement." : "Vehicle barrier was explicitly mentioned; quantity defaulted to 1 pending confirmation.", required:true, review_required:!barrierQty });
    addUnique(out, { category:"Access Control", subcategory:"Vehicle Barrier", item_name:"Vehicle Barrier Safety / Loop Detector", specification:"Inductive loop detector and safety sensing/access interface for each barrier lane; final arrangement to suit site traffic design", quantity:bq, unit:"Set", reason:"Safety/accessory package sized one set per barrier lane.", required:false, review_required:true });
    addUnique(out, { category:"Service", subcategory:"Vehicle Barrier", item_name:"Boom Barrier Installation & Commissioning", specification:"Mechanical installation, controller wiring, safety sensor/loop integration, access interface and testing", quantity:bq, unit:"Nos", reason:"Installation and commissioning per barrier lane.", required:true });
  }

  // Explicit manual-review triggers for technical scopes we don't yet have a safe quantity model for.
  const manualSignals = [
    "turnstile","pa system","public address","speaker",
    "amplifier","epabx","ip phone","telephone","solar","gate automation","home automation",
    "smart home","bms","fire hydrant","fire fighting","sprinkler","water leak","gps",
    "tracking","vehicle tracking","asset tracking","visitor management","time attendance"
  ];
  for (const signal of manualSignals) {
    if (t.includes(signal)) {
      manual(out, "Technical scope: " + signal, input);
      break;
    }
  }

  // Do not silently lose a requirement. Unknown scopes remain internal review items,
  // while known scopes above produce customer-ready BOQ lines.
  if (!out.length) manual(out, "Requirement could not be classified", input);
  return out;
}
