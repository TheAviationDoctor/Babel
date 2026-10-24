/*
 * The sentences that come in dreams: grammatical, and not necessarily sensible, like
 * surreal poetry. A small English grammar (agreement of verbs with their subjects,
 * "a" and "an", plurals, tenses, relative pronouns) builds them from a vocabulary whose
 * lexical field is that of Algernon Blackwood, Jorge Luis Borges, Italo Calvino, Ted
 * Chiang, Julio Cortázar, Brian Evenson, Thomas Ligotti, H. P. Lovecraft, Arthur Machen,
 * Guy de Maupassant, China Miéville, Edgar Allan Poe, Clark Ashton Smith and Jeff
 * VanderMeer: single words only, chosen for the worlds those writers share (labyrinths and
 * mirrors, spores and lighthouses, puppets, crypts, willows, clockwork, salt), never
 * their phrases, names or invented places.
 *
 * BabelQuotes.quote(seed, n) returns quote number n of the sequence that a seed (four
 * unsigned 32-bit integers) gives: the same seed and n always give the same quote.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BabelQuotes = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Vocabulary
   * ------------------------------------------------------------------ */

  // Nouns that can be counted: "singular" or "singular/plural" when the plural is irregular.
  const COUNT = [
    'abyss', 'altar', 'angel', 'archive', 'atlas', 'automaton/automata', 'axolotl', 'beetle', 'bell', 'bone',
    'bridge', 'candle', 'carapace', 'catacomb', 'cathedral', 'cell', 'chamber', 'chimera', 'city/cities', 'clock',
    'cocoon', 'coin', 'compass', 'corridor', 'crow', 'crypt', 'dagger', 'door', 'dream', 'eel',
    'encyclopedia', 'engine', 'eye', 'face', 'fungus/fungi', 'garden', 'gear', 'glove', 'glyph', 'heart',
    'heron', 'hexagon', 'hill', 'hive', 'hourglass', 'idol', 'island', 'jewel', 'key', 'labyrinth',
    'ladder', 'lamp', 'lamprey', 'lantern', 'larva/larvae', 'lattice', 'leaf/leaves', 'lens', 'library/libraries', 'lighthouse',
    'lung', 'map', 'mannequin', 'marionette', 'mask', 'mirror', 'moon', 'moth', 'mouth', 'mushroom',
    'orchid', 'organ', 'owl', 'pendulum', 'puppet', 'raven', 'river', 'room', 'rose', 'ruin',
    'scaffold', 'sepulchre', 'shadow', 'shell', 'skull', 'sphinx', 'spiral', 'spore', 'staircase', 'star',
    'stone', 'sun', 'swamp', 'tentacle', 'theorem', 'thread', 'tiger', 'tomb', 'tongue', 'tooth/teeth',
    'tower', 'tram', 'tunnel', 'vault', 'veil', 'vessel', 'volume', 'wall', 'wasp', 'well',
    'wheel', 'willow', 'window', 'wing', 'wolf/wolves', 'wound', 'alphabet', 'knife/knives', 'reed', 'jellyfish/jellyfish',
    'mycelium/mycelia', 'obelisk', 'pupil', 'reliquary/reliquaries', 'seashell', 'snail', 'tide', 'vertebra/vertebrae', 'wick', 'zodiac',
  ];
  // People, who are "who" rather than "which".
  const PERSONS = [
    'librarian', 'sleeper', 'stranger', 'sorcerer', 'necromancer', 'monk', 'twin', 'child/children', 'cartographer', 'oracle',
    'god', 'ghoul', 'drowned man/drowned men', 'widow', 'pilgrim', 'clockmaker', 'translator', 'biologist', 'surveyor', 'twin sister',
  ];
  // Nouns that are not counted: "the dust", "no silence", "some salt".
  const MASS = [
    'ash', 'dust', 'salt', 'ichor', 'moss', 'lichen', 'smoke', 'silence', 'ink', 'rust',
    'velvet', 'amber', 'nacre', 'snow', 'incense', 'mercury', 'sand', 'fog', 'honey', 'brine',
    'wax', 'mildew', 'darkness', 'light', 'eternity', 'oblivion', 'memory', 'hunger', 'sorrow', 'madness',
    'nothingness', 'vertigo', 'longing', 'sleep', 'rain', 'mist', 'marrow', 'frost', 'twilight', 'music',
    'laughter', 'grammar', 'geometry', 'symmetry', 'infinity', 'glass', 'water', 'iron', 'gold', 'copper',
    'tar', 'pollen', 'chalk', 'ivory', 'ebony', 'patience', 'decay', 'dread', 'wonder', 'brightness',
  ];
  const ADJECTIVES = [
    'ashen', 'amber', 'ancient', 'antediluvian', 'black', 'blind', 'boundless', 'brackish', 'carmine', 'cyclopean',
    'crystalline', 'drowned', 'eldritch', 'endless', 'eyeless', 'faceless', 'famished', 'fungal', 'gibbous', 'gilded',
    'glassy', 'gray', 'hollow', 'hooded', 'immeasurable', 'infinite', 'invisible', 'iridescent', 'labyrinthine', 'leaden',
    'lunar', 'luminous', 'mirrored', 'molten', 'nacreous', 'nameless', 'nocturnal', 'obsidian', 'opaline', 'pale',
    'patient', 'phosphorescent', 'porous', 'quiet', 'rotting', 'rusted', 'sallow', 'sealed', 'secret', 'sleepless',
    'slow', 'spectral', 'stagnant', 'sunken', 'swollen', 'tender', 'threadbare', 'tidal', 'translucent', 'trembling',
    'unborn', 'uncounted', 'unlit', 'unwritten', 'velvet', 'vertiginous', 'violet', 'waxen', 'wet', 'whispering',
    'white', 'wingless', 'withered', 'wordless', 'yellow', 'sepulchral', 'squamous', 'rugose', 'fungoid', 'chitinous',
    'vitreous', 'murmuring', 'gelatinous', 'mechanical', 'copper', 'inverted', 'symmetrical', 'forgotten', 'sleeping', 'weeping',
    'clockwork', 'mycelial', 'salt-white', 'moth-eaten', 'abyssal', 'blighted', 'vestigial', 'tenebrous', 'febrile', 'lambent',
  ];

  // Verbs: the base form, then, where they are not regular, the past, the past participle and the -ing form.
  const V = (base, past, pp, ing) => ({ base, past, pp, ing });
  const TRANSITIVE = [
    V('remember'), V('devour'), V('swallow'), V('dream'), V('carry'), V('bury'), V('count'), V('copy'), V('erase'), V('inherit'),
    V('forget', 'forgot', 'forgotten', 'forgetting'), V('follow'), V('haunt'), V('worship', 'worshipped', 'worshipped', 'worshipping'),
    V('weave', 'wove', 'woven'), V('unweave', 'unwove', 'unwoven'), V('unravel', 'unraveled', 'unraveled', 'unraveling'), V('translate'),
    V('multiply'), V('dissolve'), V('contain'), V('imitate'), V('mirror'), V('open'), V('close'), V('breathe'), V('drown'),
    V('feed', 'fed', 'fed'), V('measure'), V('gnaw'), V('sharpen'), V('kindle'), V('map', 'mapped', 'mapped', 'mapping'),
    V('misplace'), V('rehearse'), V('catalogue', 'catalogued', 'catalogued', 'cataloguing'), V('inhale'), V('cradle'), V('mourn'),
    V('recite'), V('rewrite', 'rewrote', 'rewritten'), V('hide', 'hid', 'hidden'), V('seek', 'sought', 'sought'), V('sing', 'sang', 'sung'),
    V('wear', 'wore', 'worn'), V('steal', 'stole', 'stolen'), V('bite', 'bit', 'bitten'), V('hold', 'held', 'held'), V('keep', 'kept', 'kept'),
    V('break', 'broke', 'broken'), V('eat', 'ate', 'eaten'), V('shelter'), V('dismantle'), V('unlock'), V('embroider'), V('gild'),
    V('fold'), V('unfold'), V('nurse'), V('invent'), V('summon'), V('conceal'), V('betray'), V('wake', 'woke', 'woken'), V('reflect'),
    V('illuminate'), V('extinguish'), V('outlive'), V('know', 'knew', 'known'), V('forgive', 'forgave', 'forgiven'),
    V('understand', 'understood', 'understood'), V('envy', 'envied', 'envied'), V('pollinate'), V('salt'), V('hatch'),
  ];
  const INTRANSITIVE = [
    V('dream'), V('whisper'), V('rot', 'rotted', 'rotted', 'rotting'), V('bloom'), V('sleep', 'slept', 'slept'), V('wait'), V('burn'), V('drift'),
    V('hum', 'hummed', 'hummed', 'humming'), V('weep', 'wept', 'wept'), V('wander'), V('sing', 'sang', 'sung'), V('decay'),
    V('rise', 'rose', 'risen'), V('sink', 'sank', 'sunk'), V('kneel', 'knelt', 'knelt'), V('flicker'), V('murmur'), V('crawl'),
    V('fester'), V('glimmer'), V('howl'), V('unfold'), V('coil'), V('shiver'), V('breathe'), V('listen'), V('pray'), V('sprout'),
    V('return'), V('vanish'), V('dissolve'), V('multiply'), V('drown'), V('grow', 'grew', 'grown'), V('fall', 'fell', 'fallen'),
    V('spin', 'spun', 'spun', 'spinning'), V('creep', 'crept', 'crept'), V('echo'), V('die', 'died', 'died', 'dying'), V('hunger'),
    V('rust'), V('ripen'), V('sway'), V('tremble'), V('glow'), V('waver'), V('linger'), V('recede'), V('blossom'), V('dwindle'),
    V('swarm'), V('hibernate'), V('fossilize'),
  ];
  // Verbs of knowing, for "Only the herons remember…"
  const KNOWING = [V('remember'), V('know', 'knew', 'known'), V('understand', 'understood', 'understood'), V('forgive', 'forgave', 'forgiven'), V('mourn'), V('envy', 'envied', 'envied')];
  const ADVERBS = [
    'slowly', 'silently', 'forever', 'endlessly', 'patiently', 'backwards', 'tenderly', 'softly', 'again', 'invisibly',
    'ceaselessly', 'sideways', 'alone', 'in silence', 'without end', 'at last', 'in reverse', 'by candlelight', 'all night', 'in vain',
  ];
  const PLACES = ['in', 'beneath', 'behind', 'beyond', 'inside', 'under', 'within', 'above', 'below', 'against', 'through',
    'at the bottom of', 'at the edge of', 'on the far side of', 'at the heart of', 'between', 'among'];
  const NUMBERS = ['seven', 'nine', 'a thousand', 'a hundred', 'countless', 'three', 'eleven', 'uncounted'];
  // Mass nouns that are ideas rather than stuff: "oblivion" rather than "the oblivion".
  const ABSTRACT = new Set(['silence', 'darkness', 'eternity', 'oblivion', 'memory', 'hunger', 'sorrow', 'madness', 'nothingness',
    'vertigo', 'longing', 'sleep', 'twilight', 'music', 'laughter', 'grammar', 'geometry', 'symmetry', 'infinity', 'patience',
    'decay', 'dread', 'wonder', 'brightness']);

  /* ------------------------------------------------------------------ *
   * Word forms
   * ------------------------------------------------------------------ */

  function plural(w) {
    if (/(s|x|z|ch|sh)$/.test(w)) return w + 'es';
    if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ies';
    return w + 's';
  }
  const thirdPerson = (w) => {
    if (/(s|x|z|ch|sh|o)$/.test(w)) return w + 'es';
    if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ies';
    return w + 's';
  };
  const pastOf = (w) => {
    if (/e$/.test(w)) return w + 'd';
    if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ied';
    return w + 'ed';
  };
  const ingOf = (w) => {
    if (/ie$/.test(w)) return w.slice(0, -2) + 'ying';
    if (/[^aeiouy]e$/.test(w) && !/(ee|ye|oe)$/.test(w)) return w.slice(0, -1) + 'ing';
    return w + 'ing';
  };
  function forms(v) {
    return {
      base: v.base, s: thirdPerson(v.base), past: v.past || pastOf(v.base),
      pp: v.pp || v.past || pastOf(v.base), ing: v.ing || ingOf(v.base),
    };
  }

  function noun(entry, person, mass) {
    const [sg, pl] = entry.split('/');
    return { sg, pl: mass ? sg : pl || plural(sg), person: !!person, mass: !!mass, abstract: mass && ABSTRACT.has(sg) };
  }
  const COUNT_N = COUNT.map((e) => noun(e, false, false));
  const PERSON_N = PERSONS.map((e) => noun(e, true, false));
  const MASS_N = MASS.map((e) => noun(e, false, true));
  const T_V = TRANSITIVE.map(forms), I_V = INTRANSITIVE.map(forms), K_V = KNOWING.map(forms);

  /** "a" or "an", by the sound the next word begins with. */
  function article(word) {
    const w = word.toLowerCase();
    if (/^(hour|honest|heir|honou?r)/.test(w)) return 'an';
    if (/^(uni|use|usu|eu|one|ou?ija)/.test(w)) return 'a';
    return /^[aeiou]/.test(w) ? 'an' : 'a';
  }

  const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  /* ------------------------------------------------------------------ *
   * A sentence, built from a seeded random stream
   * ------------------------------------------------------------------ */

  function sfc32(a, b, c, d) {
    return function () {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      const t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      const r = (t + d) | 0;
      c = (c + r) | 0;
      return (r >>> 0) / 4294967296;
    };
  }

  class Sentence {
    constructor(rng) {
      this.r = rng;
      this.used = new Set();
    }

    chance(p) { return this.r() < p; }
    pick(list) { return list[Math.floor(this.r() * list.length)]; }

    /** A word from the list not used yet in this sentence (when possible). */
    fresh(list, key) {
      let w = this.pick(list);
      for (let k = 0; k < 12 && this.used.has(key ? key(w) : w); k++) w = this.pick(list);
      this.used.add(key ? key(w) : w);
      return w;
    }

    adj() { return this.fresh(ADJECTIVES); }
    adv() { return this.fresh(ADVERBS); }

    /**
     * A noun phrase. o.number: 'sg', 'pl', 'mass' or undefined (any); o.det: 'def', 'indef',
     * 'none' or undefined (any); o.person: true, false or undefined; o.adj and o.of are the
     * chances of an adjective and of an "of" complement; o.plain: only "the", "a" or no
     * determiner (no "every", "no", "seven"…); o.neg === false: never "no".
     * Returns { text, pl, person }.
     */
    np(o) {
      o = o || {};
      let number = o.number || this.pick(['sg', 'sg', 'sg', 'pl', 'pl', 'mass']);
      let pool;
      if (number === 'mass') pool = MASS_N;
      else if (o.person === true) pool = PERSON_N;
      else if (o.person === false) pool = COUNT_N;
      else pool = this.chance(0.18) ? PERSON_N : COUNT_N;
      const n = this.fresh(pool, (x) => x.sg);
      const words = [];
      const adjChance = o.adj === undefined ? 0.55 : o.adj;
      if (this.chance(adjChance)) {
        words.push(this.adj());
        if (this.chance(0.1)) words.push('and', this.adj());
      }
      words.push(number === 'pl' ? n.pl : n.sg);
      const det = o.det || this.pick(['def', 'def', 'def', 'indef', 'indef']);
      const plain = !!o.plain, noNo = plain || o.neg === false;
      const quantifiers = (list) => list.filter((q) => !(noNo && q === 'no'));
      let d = '';
      if (number === 'sg') {
        if (det === 'def') d = plain || this.chance(0.85) ? 'the' : this.pick(['this', 'that']);
        else if (det === 'indef') d = plain || this.chance(0.75) ? article(words[0]) : this.pick(quantifiers(['every', 'no', 'each', 'another']));
        else d = article(words[0]);
      } else if (number === 'pl') {
        if (det === 'def') d = plain || this.chance(0.85) ? 'the' : this.pick(['these', 'those', 'all the']);
        else if (det === 'indef') d = plain || this.chance(0.5) ? '' : this.pick(quantifiers(NUMBERS.concat(['some', 'no'])));
        else d = '';
      } else if (n.abstract) {
        // ideas take no article: "oblivion", "patient silence"
        d = det === 'indef' && !noNo && this.chance(0.1) ? 'no' : '';
      } else {
        if (det === 'def') d = 'the';
        else if (det === 'indef') d = plain || this.chance(0.6) ? '' : this.pick(quantifiers(['some', 'no']));
        else d = '';
      }
      let text = (d ? d + ' ' : '') + words.join(' ');
      const ofChance = o.of === undefined ? 0.22 : o.of;
      if (this.chance(ofChance)) {
        const c = this.np({ number: this.pick(['sg', 'pl', 'mass', 'mass']), det: this.pick(['def', 'indef']), adj: 0.35, of: 0, person: false, plain: true });
        text += ' of ' + c.text;
      }
      return { text, pl: number === 'pl', person: n.person };
    }

    /** A place: "beneath the gibbous moon", "between the mirrors", "among the ash". */
    place() {
      const p = this.fresh(PLACES);
      if (p === 'between') return p + ' ' + this.np({ number: 'pl', det: this.pick(['def', 'indef']), of: 0.1, neg: false }).text;
      if (p === 'among') return p + ' ' + this.np({ number: this.pick(['pl', 'mass']), det: this.pick(['def', 'indef']), of: 0.1, neg: false }).text;
      return p + ' ' + this.np({ det: this.pick(['def', 'def', 'indef']), of: 0.15, neg: false }).text;
    }

    /** What may follow an intransitive verb: a place, an adverb, both, or nothing. */
    tail() {
      const x = this.r();
      if (x < 0.45) return ' ' + this.place();
      if (x < 0.7) return ' ' + this.adv();
      if (x < 0.82) return ' ' + this.adv() + ' ' + this.place();
      return '';
    }

    tv() { return this.fresh(T_V, (v) => v.base); }
    iv() { return this.fresh(I_V, (v) => v.base); }

    /** The verb agreeing with its subject, in the given tense. */
    say(v, pl, tense) {
      switch (tense) {
        case 'past': return v.past;
        case 'perfect': return (pl ? 'have ' : 'has ') + v.pp;
        case 'progressive': return (pl ? 'are ' : 'is ') + v.ing;
        case 'future': return 'will ' + v.base;
        case 'modal': return this.pick(['must', 'may', 'cannot', 'will not', 'should']) + ' ' + v.base;
        default: return pl ? v.base : v.s;
      }
    }

    tense() { return this.pick(['present', 'present', 'present', 'present', 'past', 'past', 'perfect', 'progressive', 'future', 'modal']); }
  }

  const rel = (np) => (np.person ? 'who' : 'which');

  /* Each template returns a sentence, with its final punctuation. */
  const TEMPLATES = [
    // The ashen lighthouse weeps beneath a gibbous moon.
    [6, (s) => { const S = s.np(); return `${S.text} ${s.say(s.iv(), S.pl, s.tense())}${s.tail()}.`; }],
    // Every mirror devours the silence of the drowned cities.
    [6, (s) => { const S = s.np(); return `${S.text} ${s.say(s.tv(), S.pl, s.tense())} ${s.np().text}.`; }],
    // Beneath the gibbous lighthouse, seven moths are dreaming.
    [4, (s) => { const P = s.place(), S = s.np(); return `${P}, ${S.text} ${s.say(s.iv(), S.pl, s.pick(['present', 'progressive', 'past']))}.`; }],
    // The library is a lung that breathes the dust of absent stars. / The corridors are tongues that…
    [5, (s) => {
      const S = s.np({ number: s.pick(['sg', 'pl', 'mass']), det: 'def' });
      const P = S.pl ? s.np({ number: 'pl', det: 'none', of: 0.1 }) : s.np({ number: 'sg', det: 'none', of: 0.1 });
      return `${S.text} ${S.pl ? 'are' : 'is'} ${P.text} ${rel(P) === 'who' ? 'who' : 'that'} ${s.say(s.tv(), P.pl, 'present')} ${s.np().text}.`;
    }],
    // The willows whisper like drowned bells.
    [4, (s) => { const S = s.np(); return `${S.text} ${s.say(s.iv(), S.pl, s.pick(['present', 'past']))} like ${s.np({ det: 'indef', plain: true, of: 0.15 }).text}.`; }],
    // There is an eyeless orchid behind every door, and it remembers the sea.
    [4, (s) => {
      if (s.chance(0.5)) {
        const N = s.np({ number: 'sg', det: 'none', person: false, of: 0 });
        return `there is ${N.text} ${s.place()}, and it ${s.say(s.tv(), false, s.pick(['present', 'progressive']))} ${s.np().text}.`;
      }
      const N = s.np({ number: 'pl', det: 'indef', person: false, of: 0 });
      return `there are ${N.text} ${s.place()}, and they ${s.say(s.tv(), true, s.pick(['present', 'progressive']))} ${s.np().text}.`;
    }],
    // Do not wake the sleeping idol, for it remembers the hunger of the sea.
    [3, (s) => {
      const O = s.np({ det: 'def', person: false, of: 0.1 });
      const pron = O.pl ? 'they' : 'it';
      return `${s.pick(['do not', 'never'])} ${s.tv().base} ${O.text}, for ${pron} ${s.say(s.tv(), O.pl, s.pick(['present', 'perfect', 'future']))} ${s.np({ neg: false }).text}.`;
    }],
    // Count the hexagons slowly.
    [2, (s) => `${s.tv().base} ${s.np({ det: 'def' }).text} ${s.adv()}.`],
    // Who swallowed the lantern of the drowned?
    [2, (s) => `who ${s.tv().past} ${s.np().text}?`],
    // What does the mannequin remember beneath the salt?
    [2, (s) => { const S = s.np({ det: 'def' }); return `what ${S.pl ? 'do' : 'does'} ${S.text} ${s.tv().base} ${s.place()}?`; }],
    // Why do the moths kneel in silence?
    [2, (s) => { const S = s.np({ det: 'def' }); return `why ${S.pl ? 'do' : 'does'} ${S.text} ${s.iv().base}${s.tail()}?`; }],
    // Where are the ravens drifting?
    [1, (s) => { const S = s.np({ det: 'def' }); return `where ${S.pl ? 'are' : 'is'} ${S.text} ${s.iv().ing}?`; }],
    // I have swallowed the moon, and the moths remembered me.
    [3, (s) => { const S = s.np(); return `I have ${s.tv().pp} ${s.np().text}, and ${S.text} ${s.tv().past} me.`; }],
    // I dreamed that a hooded engine wept beneath the salt.
    [3, (s) => { const S = s.np({ plain: true }); return `I ${s.pick(['dreamed', 'knew', 'was told', 'remember'])} that ${S.text} ${s.say(s.iv(), S.pl, 'past')}${s.tail()}.`; }],
    // I am a lamp that remembers the sea. / We are tongues that rehearse the alphabet.
    [3, (s) => {
      if (s.chance(0.5)) { const P = s.np({ number: 'sg', det: 'none', of: 0.1 }); return `I am ${P.text} ${P.person ? 'who' : 'that'} ${s.say(s.tv(), false, 'present')} ${s.np().text}.`; }
      const P = s.np({ number: 'pl', det: 'none', of: 0.1 });
      return `we are ${P.text} ${P.person ? 'who' : 'that'} ${s.say(s.tv(), true, 'present')} ${s.np().text}.`;
    }],
    // We are the moths of a drowned library, rehearsing the silence of salt.
    [3, (s) => {
      const N = s.fresh(COUNT_N.concat(PERSON_N), (x) => x.sg);
      return `we are the ${N.pl} of ${s.np({ number: s.pick(['sg', 'pl', 'mass']), det: s.pick(['def', 'indef']), of: 0 }).text}, ${s.tv().ing} ${s.np().text}${s.chance(0.4) ? ' ' + s.adv() : ''}.`;
    }],
    // To count the hexagons is to forget the sea.
    [4, (s) => `to ${s.tv().base} ${s.np().text} is to ${s.tv().base} ${s.np().text}.`],
    // The lighthouse, which swallowed a thousand moths, now sleeps beneath the salt.
    [4, (s) => {
      const S = s.np({ det: 'def', of: 0 });
      return `${S.text}, ${rel(S)} ${s.tv().past} ${s.np().text}, now ${s.say(s.iv(), S.pl, 'present')}${s.tail()}.`;
    }],
    // Nothing grows in the drowned library but the patience of moths.
    [3, (s) => `nothing ${s.iv().s} ${s.pick(['in', 'beneath', 'inside', 'within'])} ${s.np({ det: 'def', of: 0 }).text} but ${s.np({ neg: false }).text}.`],
    // When the moon rots, the corridors weep backwards.
    [3, (s) => {
      const A = s.np(), B = s.np({ det: 'def' }), t = s.pick(['present', 'past']);
      return `when ${A.text} ${s.say(s.iv(), A.pl, t)}, ${B.text} ${s.say(s.iv(), B.pl, t)}${s.tail()}.`;
    }],
    // Beneath every mirror there is another mirror, eyeless and patient.
    [3, (s) => {
      const n = s.fresh(COUNT_N, (x) => x.sg).sg;
      return `${s.pick(['beneath', 'behind', 'inside', 'within', 'beyond'])} every ${n} there is another ${n}, ${s.adj()} and ${s.adj()}.`;
    }],
    // It was the gilded sphinx that devoured the alphabet.
    [2, (s) => { const S = s.np({ det: 'def' }); return `it was ${S.text} ${S.person ? 'who' : 'that'} ${s.tv().past} ${s.np().text}.`; }],
    // The twin has never forgotten the geometry of salt.
    [2, (s) => { const S = s.np({ plain: true }); return `${S.text} ${S.pl ? 'have' : 'has'} never ${s.tv().pp} ${s.np({ neg: false }).text}.`; }],
    // In the city of spores, the clockmaker gilds the moon and buries the sea.
    [3, (s) => { const P = s.place(), S = s.np(), t = s.pick(['present', 'past']); return `${P}, ${S.text} ${s.say(s.tv(), S.pl, t)} ${s.np({ of: 0 }).text} and ${s.say(s.tv(), S.pl, t)} ${s.np({ of: 0 }).text}.`; }],
    // Somewhere, a hooded lighthouse is devouring its own shadow.
    [3, (s) => {
      const S = s.np({ det: 'indef', person: false, of: 0 });
      const own = s.chance(0.3) ? s.fresh(MASS_N, (x) => x.sg).sg : (S.pl ? s.fresh(COUNT_N, (x) => x.sg).pl : s.fresh(COUNT_N, (x) => x.sg).sg);
      return `somewhere, ${S.text} ${S.pl ? 'are' : 'is'} ${s.tv().ing} ${S.pl ? 'their' : 'its'} own ${own}.`;
    }],
    // Patient is the moth that waits beneath the salt.
    [3, (s) => {
      const S = s.np({ det: 'def', adj: 0, of: 0 });
      return `${s.adj()} ${S.pl ? 'are' : 'is'} ${S.text} ${S.person ? 'who' : 'that'} ${s.say(s.iv(), S.pl, 'present')}${s.tail()}.`;
    }],
    // Every wasp remembers a door; every door forgets a wasp.
    [2, (s) => {
      const a = s.fresh(COUNT_N.concat(PERSON_N), (x) => x.sg), b = s.fresh(COUNT_N.concat(PERSON_N), (x) => x.sg), v = s.tv(), w = s.tv();
      return `every ${a.sg} ${v.s} ${article(b.sg)} ${b.sg}; every ${b.sg} ${w.s} ${article(a.sg)} ${a.sg}.`;
    }],
    // Only the eyeless herons remember the geometry of salt.
    [3, (s) => { const S = s.np({ det: 'def' }); const v = s.fresh(K_V, (x) => x.base); return `only ${S.text} ${s.say(v, S.pl, s.pick(['present', 'past', 'perfect']))} ${s.np().text}.`; }],
    // The bells unfold in silence, and the twins sleep among the ash.
    [3, (s) => {
      const A = s.np({ of: 0 }), B = s.np({ of: 0 }), t = s.pick(['present', 'past']);
      return `${A.text} ${s.say(s.iv(), A.pl, t)}${s.tail()}, and ${B.text} ${s.say(s.iv(), B.pl, t)}${s.tail()}.`;
    }],
    // Once, the corridors dreamed; now they swallow the moon.
    [3, (s) => {
      const S = s.np({ det: 'def', person: false, of: 0 });
      return `once, ${S.text} ${s.iv().past}${s.tail()}; now ${S.pl ? 'they' : 'it'} ${s.say(s.tv(), S.pl, 'present')} ${s.np().text}.`;
    }],
  ];
  const TOTAL = TEMPLATES.reduce((n, [w]) => n + w, 0);

  function sentence(rng) {
    let x = rng() * TOTAL;
    for (const [w, make] of TEMPLATES) {
      if ((x -= w) < 0) return make(new Sentence(rng));
    }
    return TEMPLATES[0][1](new Sentence(rng));
  }

  function tidy(text) {
    text = text.replace(/\s+/g, ' ').replace(/\s+([,.;?])/g, '$1').trim();
    return capital(text);
  }

  /** Quote number n of the sequence given by a seed of four unsigned 32-bit integers. */
  function quote(seed, n) {
    const k = (n >>> 0) * 0x9e3779b1;
    const rng = sfc32(seed[0] ^ k, seed[1] ^ 0x85ebca6b, (seed[2] + n) | 0, seed[3] ^ (k >>> 7));
    for (let i = 0; i < 12; i++) rng(); // stir
    let best = null;
    for (let tries = 0; tries < 6; tries++) {
      const s = tidy(sentence(rng));
      const words = s.split(' ').length;
      if (words <= 22 && words >= 5) return s;
      if (!best || Math.abs(words - 14) < Math.abs(best.split(' ').length - 14)) best = s;
    }
    return best;
  }

  return { quote, vocabulary: { COUNT, PERSONS, MASS, ADJECTIVES, TRANSITIVE: TRANSITIVE.map((v) => v.base), INTRANSITIVE: INTRANSITIVE.map((v) => v.base) } };
});
