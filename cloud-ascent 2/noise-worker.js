import { buildNoiseData } from './noise-data.js';
try { const data=buildNoiseData(); postMessage({data},Object.values(data).map(t=>t.data.buffer)); } catch(error) { postMessage({error:String(error)}); }
