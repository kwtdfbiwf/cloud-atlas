// The ten cloud genera. `id` is the shader's cloud type; `rainFx` turns on live rain.
window.CLOUDS = [
  {
    id: 0, name: 'Cumulus', abbr: 'Cu', tier: 'low',
    tip: 'Flat bottom. Fluffy top. Probably cumulus.',
    latin: 'cumulus — “heap”',
    base: '0.6–2 km', made: 'Water droplets', rain: 10,
    desc: 'Bubbles of warm air called thermals rise and cool until their moisture condenses into separate heaps.',
    weather: 'Usually fair; growing towers can signal showers.',
    spot: 'Late mornings on sunny days. Brilliant white where the sun hits, grey underneath, with edges sharp enough to trace.',
    fact: 'A small fair-weather cumulus can hold around 500 tonnes of water, spread through billions of tiny droplets.',
    look: 'Separate heaps with flat grey bases and bright, sharp cauliflower tops'
  },
  {
    id: 1, name: 'Stratocumulus', abbr: 'Sc', tier: 'low',
    tip: 'Big, lumpy rolls. A patchwork sky.',
    latin: 'stratus + cumulus — “flattened heap”',
    base: '0.5–2 km', made: 'Water droplets', rain: 20,
    desc: 'Low, rounded rolls join into a broken layer, often as cumulus spreads out.',
    weather: 'Mostly dry, with occasional drizzle.',
    spot: 'At arm’s length each lump is about the size of your fist. Shaded undersides give them a texture that plain stratus lacks.',
    fact: 'These widespread cloud decks reflect sunlight and help cool Earth.',
    look: 'Grey-white lumps joined into a sheet, with blue gaps. Each lump is about a fist wide',
    scale: { label: 'Fist at arm’s length', deg: 10 }
  },
  {
    id: 2, name: 'Stratus', abbr: 'St', tier: 'low',
    tip: 'One grey blanket. No bumps needed.',
    latin: 'stratus — “spread out”',
    base: '0–0.6 km', made: 'Water droplets', rain: 30,
    desc: 'A low, smooth blanket forms as moist air cools, sometimes from lifting fog.',
    weather: 'Grey skies, with possible drizzle or snow grains.',
    spot: 'If the sun shows through, its outline is crisp. Hilltops and tall buildings vanish into the base.',
    fact: 'Fog is stratus at ground level: you can walk inside a cloud.',
    look: 'An even grey sheet with no shapes at all, like fog that’s lifted'
  },
  {
    id: 3, name: 'Cumulonimbus', abbr: 'Cb', tier: 'low', rainFx: true, lightning: true, rainNote: 'in bursts',
    tip: 'A towering top. An anvil. A storm brewing.',
    latin: 'cumulus + nimbus — “heaped rain cloud”',
    base: '0.3–2 km; tops 11–13 km', made: 'Droplets, hail & ice', rain: 95,
    desc: 'Strong updrafts build a towering storm cloud that spreads into a flat anvil.',
    weather: 'Heavy rain, thunder, hail and gusty winds.',
    spot: 'A dark, rain-curtained base under a brilliant white tower. Count from a lightning flash to its thunder: every 3 seconds is about 1 km away.',
    fact: 'Its tower can reach the top of the troposphere.',
    look: 'A huge tower with a flat, spreading anvil on top and a dark, rainy base'
  },
  {
    id: 5, name: 'Altocumulus', abbr: 'Ac', tier: 'mid',
    tip: 'Little shaded puffs. A sky full of ripples.',
    latin: 'altus + cumulus — “high heap”',
    base: '2–6 km', made: 'Supercooled droplets', rain: 10,
    desc: 'Patches of shaded cloudlets in the middle layer form ripples or rows.',
    weather: 'Usually dry; morning turrets can signal later storms.',
    spot: 'Try the finger test: at arm’s length each cloudlet is about one to three fingers wide. Smaller than a fingertip means cirrocumulus.',
    fact: 'Evenly sized droplets can create colourful rings called a corona.',
    look: 'Small shaded cloudlets, often in rows. Each is one to three fingers wide',
    scale: { label: 'Three fingers at arm’s length', deg: 5 }
  },
  {
    id: 6, name: 'Altostratus', abbr: 'As', tier: 'mid',
    tip: 'A grey veil. The sun on dimmer mode.',
    latin: 'altus + stratus — “high layer”',
    base: '2–7 km', made: 'Droplets & ice crystals', rain: 25,
    desc: 'A broad sheet of cloud spreads across the whole sky, often ahead of a warm front.',
    weather: 'Light rain or snow; thickening cloud may bring steady rain.',
    spot: 'The “watery sun”: a dim disc with no halo around it, and nothing on the ground casts a shadow.',
    fact: 'Rain can evaporate before reaching the ground, forming wisps called virga.',
    look: 'A smooth grey veil; the sun shows as a dim disc with no halo'
  },
  {
    id: 4, name: 'Nimbostratus', abbr: 'Ns', tier: 'mid', rainFx: true, rainNote: 'steady',
    tip: 'Dark blanket. Hidden sun. Rain for hours.',
    latin: 'nimbus + stratus — “rain layer”',
    base: '0.5–3 km; several km thick', made: 'Droplets, rain, snow & ice', rain: 95,
    desc: 'A thick, dark cloud layer hides the sun as warm air rises over colder air.',
    weather: 'Hours of steady rain or snow.',
    spot: 'Even, dark grey and evenly lit, as if from inside. Ragged scraps of low cloud often drift underneath it.',
    fact: 'Its base can sit low even though the cloud extends through several levels.',
    look: 'A dark, shapeless, low ceiling with steady rain falling from it'
  },
  {
    id: 7, name: 'Cirrus', abbr: 'Ci', tier: 'high',
    tip: 'Wispy hooks. A sky brushed with ice.',
    latin: 'cirrus — “curl of hair”',
    base: '5–13 km', made: 'Ice crystals', rain: 2,
    desc: 'High winds stretch falling ice crystals into fine white threads and hooks.',
    weather: 'Dry below; spreading cirrus may signal an approaching front.',
    spot: 'Bright white and silky, never grey. They often glow pink and orange long after sunset because they sit so high.',
    fact: 'Cirrus streaks show the wind high up, where jet-stream winds can blow at over 200 km/h.',
    look: 'Thin white streaks and hooks, high up, never grey'
  },
  {
    id: 8, name: 'Cirrostratus', abbr: 'Cs', tier: 'high',
    tip: 'A milky veil. A halo gives it away.',
    latin: 'cirrus + stratus — “hair-like layer”',
    base: '5.5–12 km', made: 'Ice crystals', rain: 10,
    desc: 'A thin ice-crystal veil gives the sky a milky tint.',
    weather: 'Dry below, but may signal an approaching warm front.',
    spot: 'Look for a halo: a ring around the sun or moon about as wide as your outstretched hand. Six-sided ice crystals bend the light into it.',
    fact: 'Cirrostratus often thickens into altostratus as a warm front arrives, so rain may follow within a day.',
    look: 'A faint milky veil, and a ring of light around the sun'
  },
  {
    id: 9, name: 'Cirrocumulus', abbr: 'Cc', tier: 'high',
    tip: 'Tiny white grains. No shadows. Look higher.',
    latin: 'cirrus + cumulus — “hair-like heap”',
    base: '5–12 km', made: 'Ice & supercooled droplets', rain: 2,
    desc: 'Tiny, unshaded ice cloudlets form delicate ripples high in the sky.',
    weather: 'Usually fair; these cloudlets are often short-lived.',
    spot: 'Tiny, bright and shadowless. If the grains have grey shading, you are probably looking at altocumulus.',
    fact: 'Rows of cirrocumulus are sometimes called a “mackerel sky”, after the pattern of fish scales.',
    look: 'Tiny white grains in ripples, no shading. Each is smaller than a fingertip',
    scale: { label: 'Fingertip at arm’s length', deg: 1 }
  }
];

window.CLOUDS.forEach(c=>{c.image=`assets/${c.name.toLowerCase()}.png`;});
