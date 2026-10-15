import assert from 'node:assert/strict';
import { collectConversationCandidates, getDialogueLines, selectConversationCandidate } from '../js/dialogue/dialogueEngine.js';
import { PERSONALITY_LINES, PERSONALITY_TOPICS } from '../js/data/dialogue/personalityLines.js';
const person = {speechType:'普通Ｍ',spiritSex:'男',spiritAge:25,bodySex:'女',bodyAge:20,bodyTraits:[],mindTraits:[],hp:100,mp:100,ind:15};
const village = {villageTraits:['春']};
const keys=(character, v=village)=>collectConversationCandidates({character,village:v}).filter(c=>c.scene==='personality').map(c=>c.key);
assert.deepEqual(keys(person),[]);
assert.deepEqual(keys({...person,bodyTraits:['光合成']}),['photosynthesis']);
assert.deepEqual(keys({...person,mindTraits:['光合成']}),[]);
assert.deepEqual(keys({...person,mindTraits:['好奇心旺盛']}),['curiosity']);
assert.deepEqual(keys({...person,bodyTraits:['好奇心旺盛']}),[]);
for(const topic of PERSONALITY_TOPICS){
 const character={...person,[topic.field]:topic.field==='hobby'?topic.value:[topic.value]};
 const expected=topic.seasons?.春 || topic.key;
 for(const tone of Object.keys(PERSONALITY_LINES[expected])) {
   const c={...character,speechType:tone};
   assert.deepEqual(keys(c),[expected]);
   assert.deepEqual(getDialogueLines({character:c,scene:'personality',key:expected}),[PERSONALITY_LINES[expected][tone]]);
 }
 // 未収録口調は他口調を流用しない。子供・赤子は精神特性で判定。
 for(const c of [{...character,speechType:'お嬢様'},{...character,mindTraits:[...character.mindTraits,'萌芽']},{...character,mindTraits:[...character.mindTraits,'無垢']}]) assert.deepEqual(keys(c),[]);
}
assert.deepEqual(keys({...person,hobby:'釣り'},{villageTraits:['冬']}),['fishingWinter']);
assert.deepEqual(keys({...person,hobby:'園芸'}),['gardeningSpring']);
assert.deepEqual(keys({...person,hobby:'園芸'},{villageTraits:['夏']}),['gardening']);
const apocalypse={apocalypseStarted:true,villageTraits:['黙示録','春']};
assert.deepEqual(keys({...person,hobby:'滝行'},apocalypse),['waterfallApocalypse']);
assert.deepEqual(keys({...person,hobby:'天体観測'},apocalypse),['stargazingApocalypse']);
assert.deepEqual(keys({...person,hobby:'園芸'},apocalypse),['gardening']);
assert.deepEqual(keys({...person,hobby:'釣り'},{...apocalypse,villageTraits:['黙示録','冬']}),['fishing']);
for(const v of [village,{villageTraits:['襲撃中']}]) {
 const character={...person,hobby:'園芸',bodyTraits:['負傷']};
 const candidates=collectConversationCandidates({character,village:v});
 for(let i=0;i<20;i++) assert.notEqual(selectConversationCandidate(candidates).scene,'personality');
}
assert.deepEqual(keys({...person,hobby:'読書'}),[]);
assert.equal(Object.values(PERSONALITY_LINES).flatMap(Object.values).length,108);
console.log('PASS: 108 lines, 9 exact tones, trait axes, unsupported/child tones, seasonal/apocalypse precedence, severe/raid priority, hobby changes');
