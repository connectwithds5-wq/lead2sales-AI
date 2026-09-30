import crypto from "crypto";

const encKey = () => {
  const secret = process.env.EMAIL_TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new Error("EMAIL_TOKEN_ENCRYPTION_KEY is not configured.");
  return crypto.createHash("sha256").update(secret).digest();
};

export function encryptToken(value:string){
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv("aes-256-gcm",encKey(),iv);
  const encrypted=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
  const tag=cipher.getAuthTag();
  return [iv.toString("base64url"),tag.toString("base64url"),encrypted.toString("base64url")].join(".");
}

export function decryptToken(value:string){
  const [iv,tag,data]=String(value||"").split(".");
  if(!iv||!tag||!data) throw new Error("Invalid encrypted token.");
  const decipher=crypto.createDecipheriv("aes-256-gcm",encKey(),Buffer.from(iv,"base64url"));
  decipher.setAuthTag(Buffer.from(tag,"base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data,"base64url")),decipher.final()]).toString("utf8");
}

export function signState(payload:Record<string,unknown>){
  const body=Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig=crypto.createHmac("sha256",encKey()).update(body).digest("base64url");
  return body+"."+sig;
}

export function verifyState(state:string){
  const [body,sig]=String(state||"").split(".");
  if(!body||!sig) return null;
  const expected=crypto.createHmac("sha256",encKey()).update(body).digest("base64url");
  if(!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) return null;
  const payload=JSON.parse(Buffer.from(body,"base64url").toString("utf8"));
  if(!payload.exp || Number(payload.exp)<Date.now()) return null;
  return payload;
}

export function googleRedirectUri(){
  return `${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/gmail/callback`;
}

export function base64Url(value:Buffer|string){
  const b=Buffer.isBuffer(value)?value:Buffer.from(value);
  return b.toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

export function mimeHeader(value:string){
  return `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`;
}
