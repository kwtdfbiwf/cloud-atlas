(()=>{
const clouds=window.CLOUDS;
const WEATHER={0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Freezing fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',56:'Freezing drizzle',57:'Heavy freezing drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Heavy freezing rain',71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Light showers',81:'Showers',82:'Heavy showers',85:'Snow showers',86:'Heavy snow showers',95:'Thunderstorm',96:'Thunderstorm with hail',99:'Thunderstorm with heavy hail'};
  function inferClouds(h){
    const out=new Map(),add=(id,level,why)=>{const old=out.get(id);if(!old||(old.level==='possible'&&level==='likely'))out.set(id,{id,level,why});};
    const {low=0,mid=0,high=0,code=0,cape=0}=h,vis=h.vis??1e5;
    const thunder=[95,96,99].includes(code),showers=[80,81,82,85,86].includes(code),
      steady=[61,63,65,66,67,71,73,75,77].includes(code),drizzle=[51,53,55,56,57].includes(code),fog=[45,48].includes(code),
      snow=[71,73,75,77,85,86].includes(code);
    if(thunder)add(3,'likely','Thunderstorms are being reported');
    else if(showers&&cape>=800)add(3,'possible','Heavy showers in very unstable air');
    else if(cape>=1500&&low>=20)add(3,'possible','Unstable air that could build storm towers');
    if(steady&&(mid>=50||low>=70))add(4,'likely',`Steady ${snow?'snow':'rain'} from a thick, dark layer`);
    if(fog)add(2,'likely','Fog is stratus touching the ground');
    else if(drizzle)add(2,'likely','Drizzle falls from low stratus');
    else if(low>=80&&vis<5000)add(2,'likely','A low, even sheet with poor visibility');
    if(showers)add(0,'likely','Showers fall from growing cumulus');
    if(low>=10&&!steady&&!fog&&!drizzle){
      if(cape>=150&&low<75)add(0,'likely','Rising warm air is building heaps');
      else if(low>=40)add(1,'likely',`A lumpy low layer over ${low}% of the sky`);
      else add(cape>=50?0:1,'possible',`Some low cloud (${low}% of the sky)`);
    }
    if(mid>=60&&!steady)add(6,'likely',`A grey mid-level veil over ${mid}% of the sky`);
    else if(mid>=15&&!steady)add(5,mid>=30?'likely':'possible',`Patches in the middle layer over ${mid}% of the sky`);
    if(high>=60)add(8,'likely',`A thin, milky ice veil over ${high}% of the sky`);
    else if(high>=10)add(7,high>=25?'likely':'possible',`Wisps of high ice cloud over ${high}% of the sky`);
    if(high>=15&&high<60&&mid<15&&low<15)add(9,'possible','High cloud this thin sometimes breaks into tiny ripples');
    // a thick low deck (or steady rain) hides whatever sits above it
    const lid=low>=85||steady;
    out.forEach(c=>{c.hidden=lid&&CLOUD_TIER[c.id]!=='low'&&c.id!==4;});
    return [...out.values()].sort((a,b)=>(a.hidden-b.hidden)||(a.level==='likely'?-1:1)+(b.level==='likely'?1:-1)||ORDER.indexOf(a.id)-ORDER.indexOf(b.id));
  }
  const CLOUD_TIER=Object.fromEntries(clouds.map(c=>[c.id,c.tier]));
  const ORDER=[3,4,0,1,2,5,6,7,8,9];
// Liquid precipitation only: snowfall must not become raindrops on the window.
function rainForCode(code){
 if([55,57,65,67,82,96,99].includes(code))return 1;
 if([53,63,66,81,95].includes(code))return .8;
 if([51,56,61,80].includes(code))return .55;
 return 0;
}
window.SkyWeather={inferClouds,WEATHER,rainForCode};
})();
