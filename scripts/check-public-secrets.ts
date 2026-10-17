import { readdir, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createSupportVault } from "../src/lib/support.secrets";
const directory=resolve(process.env["DEMO_DATA_DIR"]||".local/labor");
const whatsapp=await createSupportVault(directory,"whatsapp").get();
const record=whatsapp?JSON.parse(whatsapp):{};
const secrets=[record.token,record.appSecret,record.verifyToken,record.identityKey,await createSupportVault(directory).get()].filter((s):s is string=>typeof s==="string"&&s.length>10);
async function scan(path:string):Promise<boolean>{for(const entry of await readdir(path,{withFileTypes:true})){const file=join(path,entry.name);if(entry.isDirectory()){if(await scan(file))return true;}else if(/\.(js|json|html|css|map)$/.test(entry.name)){const content=await readFile(file,"utf8");if(secrets.some(secret=>content.includes(secret)))return true;}}return false;}
if(await scan(resolve(".output/public"))){console.error("Verificação falhou: segredo encontrado no build público.");process.exitCode=1;}else console.log("Build público verificado: nenhum segredo configurado exposto.");
