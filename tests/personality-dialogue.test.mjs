import assert from 'node:assert/strict';
import { collectConversationCandidates, getDialogueLines, getConversationLine, selectConversationCandidate } from '../js/dialogue/dialogueEngine.js';
import { PERSONALITY_LINES, PERSONALITY_TOPICS } from '../js/data/dialogue/personalityLines.js';
import { TONE_PROFILES, resolveDialogueTone } from '../js/data/dialogue/toneProfiles.js';
import { readFileSync } from 'node:fs';
// 生成モジュール全体は画面処理を読み込むため、宣言された特性名だけを検証する。
const definitions=readFileSync(new URL('../js/createVillagers.js',import.meta.url),'utf8');
const traitNames=name=>[...definitions.split(`const ${name} = [`)[1].split('\n];')[0].matchAll(/name: "([^"]+)"/g)].map(m=>m[1]);
const EXCLUSIVE_BODY_TRAITS=traitNames('BODY_TRAIT_DEFINITIONS');
const EXCLUSIVE_MIND_TRAITS=traitNames('MIND_TRAIT_DEFINITIONS');
const person = {speechType:'普通Ｍ',spiritSex:'男',spiritAge:25,bodySex:'女',bodyAge:20,bodyTraits:[],mindTraits:[],hp:100,mp:100,ind:15};
const village = {villageTraits:['春']};
const candidates=(character,v=village)=>collectConversationCandidates({character,village:v});
const keys=(character,v=village)=>candidates(character,v).filter(c=>c.scene==='personality').map(c=>c.key);
const withTopic=(topic,value=Array.isArray(topic.value)?topic.value[0]:topic.value)=>({...person,[topic.field]:topic.field==='hobby'?value:[value]});
assert.deepEqual(keys(person),[]);
assert.deepEqual(keys({...person,bodyTraits:['光合成']}),['photosynthesis']);
assert.deepEqual(keys({...person,mindTraits:['光合成']}),[]);
assert.deepEqual(keys({...person,mindTraits:['好奇心旺盛']}),['curiosity']);
assert.deepEqual(keys({...person,bodyTraits:['好奇心旺盛']}),[]);
const refs=new Set();
const topicKeys=new Set();
let assertions=0;
for(const topic of PERSONALITY_TOPICS){
 assert(!topicKeys.has(topic.key),`duplicate topic: ${topic.key}`);topicKeys.add(topic.key);
 assert(['bodyTraits','mindTraits','hobby'].includes(topic.field));
 if(topic.field==='bodyTraits'&&!['光合成','水中呼吸'].includes(topic.value)) assert(EXCLUSIVE_BODY_TRAITS.includes(topic.value),topic.value);
 if(topic.field==='mindTraits') assert(EXCLUSIVE_MIND_TRAITS.includes(topic.value),topic.value);
 for(const key of [topic.key,...Object.values(topic.seasons||{}),...Object.values(topic.maleMindBodyVariants||{}),topic.apocalypse].filter(Boolean)) {
  refs.add(key);assert(PERSONALITY_LINES[key],`missing lines: ${key}`);
  for(const [tone,line] of Object.entries(PERSONALITY_LINES[key])) {
   assert(TONE_PROFILES[tone]&&!TONE_PROFILES[tone].aliasOf,`unknown tone: ${tone}`);
   assert.equal(typeof line,'string');assert(line.trim().length>0);
   assert.deepEqual(getDialogueLines({character:{...person,speechType:tone,mindTraits:tone==='男児'||tone==='女児'?['萌芽']:[],spiritSex:tone==='女児'?'女':'男'},scene:'personality',key}),[line]);
  }
 }
 for(const value of Array.isArray(topic.value)?topic.value:[topic.value]) {
  const character=withTopic(topic,value);
  for(const season of ['春','夏','秋','冬']) for(const apocalypseActive of [false,true]) {
   const v={apocalypseStarted:apocalypseActive,villageTraits:[season,...(apocalypseActive?['黙示録']:[])]};
   for(const tone of Object.keys(TONE_PROFILES).filter(t=>t!=='無垢')) {
    const c={...character,speechType:tone,spiritSex:tone==='女児'?'女':'男'};
    if(['赤子','男児','女児'].includes(tone)) c.mindTraits=[...c.mindTraits,tone==='赤子'?'無垢':'萌芽'];
    const resolved=resolveDialogueTone(c);
    const seasonalKey=topic.seasons?.[season];
    const key=topic.maleMindBodyVariants?.female || (apocalypseActive?(topic.apocalypse||topic.key):(PERSONALITY_LINES[seasonalKey]?.[resolved]?seasonalKey:topic.key));
    const eligible=!topic.maleMindBodyVariants || c.spiritSex==='男';
    const expected=eligible && PERSONALITY_LINES[key]?.[resolved]?[key]:[];
    assert.deepEqual(keys(c,v),expected,`${topic.key}/${tone}/${season}/${apocalypseActive}`);assertions++;
   }
  }
 }
}
assert.deepEqual([...refs].sort(),Object.keys(PERSONALITY_LINES).sort(),'orphan scene');
// 成人男性精神だけに、現在の身体を使って3差分を選ぶ。狼は非性的な文だけ。
for (const [hobby,prefix] of [['露出','exposure'],['自家発電','privateTime']]) {
 for (const spiritSex of ['男','女',undefined]) for(const spiritAge of [0,17,18,80]) {
  for (const race of ['人間','ゴブリン','狼','スフィンクス']) for(const bodySex of ['男','女',undefined]) for(const bodyAge of [0,1,17,18,80]) {
   const c={...person,hobby,spiritSex,spiritAge,race,bodySex,bodyAge};
   let expected=[];
   if(spiritSex==='男'&&spiritAge>=18) {
    if(race==='狼'&&bodyAge>=1) expected=[prefix+'Wolf'];
    else if(!['狼','スフィンクス'].includes(race)&&bodyAge>=18&&['男','女'].includes(bodySex)) expected=[prefix+(bodySex==='男'?'Male':'Female')];
   }
   assert.deepEqual(keys(c),expected,`${hobby}/${spiritSex}/${spiritAge}/${race}/${bodySex}/${bodyAge}`);
  }
 }
 // 実効口調が子供・赤子なら、年齢数値だけ成人でも性的な会話は出ない。
 for(const trait of ['無垢','萌芽']) assert.deepEqual(keys({...person,hobby,mindTraits:[trait]}),[]);
 assert.deepEqual(keys({...person,hobby,speechType:'普通Ｆ'}),[]);
 assert.deepEqual(keys({...person,hobby,race:'狼',bodyAge:2,speechType:'狼'}),[prefix+'Wolf']);
 const visitor={...person,hobby,name:'旅人のテスト',mindTraits:['訪問者']};
 assert(!Object.values(PERSONALITY_LINES[prefix+'Female']).includes(getConversationLine({character:visitor,village})));
}
// 元の所有者や精神の性別ではなく、現在の身体で外見を選ぶ。口調は精神側。
const swapped={...person,bodyTraits:['絶世の美女'],speechType:'老人',spiritAge:80,bodyAge:25,bodyOwnerId:999};
assert.deepEqual(keys(swapped),['peerlessBeauty']);
assert(getDialogueLines({character:swapped,scene:'personality',key:'peerlessBeauty'})[0].includes('わし'));
assert.deepEqual(keys({...swapped,bodyTraits:[],mindTraits:['正直者']}),['honest']);
// 趣味変更・種別の別名・年齢条件。
assert.deepEqual(keys({...person,hobby:'読書'}),['reading']);
assert.deepEqual(keys({...person,hobby:'狩り'}),['hunting']);
assert.deepEqual(keys({...person,hobby:'狩猟'}),['hunting']);
assert.deepEqual(keys({...person,hobby:'ハンティング'}),['hunting']);
for(const ages of [[17,25],[25,17],[17,17]]) assert.deepEqual(keys({...person,hobby:'飲酒',spiritAge:ages[0],bodyAge:ages[1]}),[]);
assert.deepEqual(keys({...person,hobby:'飲酒',spiritAge:18,bodyAge:18}),['drinking']);
// 黙示録は全4趣味で季節より優先。フラグが欠ける時は平時。
for(const hobby of ['釣り','滝行','園芸','天体観測']) {
 const topic=PERSONALITY_TOPICS.find(t=>t.value===hobby);
 assert.deepEqual(keys({...person,hobby},{apocalypseStarted:true,villageTraits:['黙示録','冬']}),[topic.apocalypse]);
 assert.deepEqual(keys({...person,hobby},{villageTraits:['黙示録','冬']}),[topic.seasons.冬]);
}
// 重傷・襲撃時は趣味と外見より状態会話が優先される。
for(const state of [{village,bodyTraits:['負傷']},{village:{villageTraits:['襲撃中']},bodyTraits:[]}]) {
 const c={...person,hobby:'園芸',bodyTraits:state.bodyTraits,mindTraits:['好奇心旺盛']};
 for(let i=0;i<20;i++) assert.notEqual(selectConversationCandidate(candidates(c,state.village)).scene,'personality');
}
// 訪問者は従来の専用会話、空/不明データでは追加なし。
const visitor={...person,name:'旅人のテスト',mindTraits:['訪問者'],hobby:'読書'};
assert(!Object.values(PERSONALITY_LINES.reading).includes(getConversationLine({character:visitor,village})));
assert.deepEqual(keys({...person,hobby:'未知の趣味'}),[]);
assert.deepEqual(keys({},{}),[]);
console.log(`PASS: ${assertions} tone/season/apocalypse combinations; ${refs.size} scenes; ${Object.values(PERSONALITY_LINES).flatMap(Object.values).length} lines; trait axes, body exchange, priority, aliases, ages, visitor routing`);
