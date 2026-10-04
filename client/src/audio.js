// ============================================================
//  ระบบเสียง ECHO + master volume
//  - ทุกแหล่งเสียง (เพลง/เอฟเฟกต์/วีดีโอ/ลูป) ผ่าน masterGain() ตัวเดียวกัน สัดส่วนความดังจึงคงที่ทุกตำแหน่งหลอด
//  - เพลงเล่นต่อจากจุดเดิมเฉพาะ "ในแมตช์เดียวกัน" — เริ่มเกมใหม่รีเซ็ตทั้งหมด (resetMusicPositions)
//  - เพลงสกิล/ท่าไม้ตาย: ส่ง seq มาด้วย ถ้า seq เปลี่ยน (เปิดท่าใหม่ / ถูกทับด้วยเพลงเดียวกัน
//    ของอีกคน) เพลงจะเริ่มใหม่จากต้น
// ============================================================

const FILES = {
  main_home: "/theme_song/main_home_4.0.mp3",
  // ECHO 5.1 ORDEAL CALL: main5 = ตั้งแต่เปิดโปรแกรมจนเข้าห้องรอ · lobby5 = ห้องรอ → โหวตโหมด → ฉากเปิดตัว (จนเข้าด่าน)
  main5: "/theme_song/main5.0.mp3",
  lobby5: "/theme_song/lobby5.0.mp3",
  new_morning: "/theme_song/day_4.0.mp3",    // เพลงช่วงกลางวัน
  new_night: "/theme_song/night_4.0.mp3",    // เพลงช่วงกลางคืน
  battle_phase: "/theme_song/battle_phase.mp3", // เพลงเฉพาะช่วงโจมตี — เริ่มใหม่ทุกครั้งที่เข้าช่วง
  // การเดินทาง 7 ภูมิภาค (โหมดสงครามทั่วไป): เพลงสนามแยกกลางวัน/กลางคืนต่อภูมิภาค — แทน new_morning/new_night
  //  ไฟล์ที่มีวงเล็บในชื่อ = กลางวัน · map.mp3 = เพลงระหว่างฉากแผนที่การเดินทาง
  journey_1_day: "/journey/map1/Fire Emblem Engage Faraway Holy Land (Flare).mp3",
  journey_1_night: "/journey/map1/Fire Emblem Engage Faraway Holy Land.mp3",
  journey_2_day: "/journey/map2/Fire Emblem Engage Full Bloom in the Breeze (Blossom).mp3",
  journey_2_night: "/journey/map2/Fire Emblem Engage Full Bloom in the Breeze.mp3",
  journey_3_day: "/journey/map3/Fire Emblem Engage Trial of Dawn (Heal Us).mp3",
  journey_3_night: "/journey/map3/Fire Emblem Engage Trial of Dawn.mp3",
  journey_4_day: "/journey/map4/Fire Emblem Engage Trial of the Pact (Connect Us).mp3",
  journey_4_night: "/journey/map4/Fire Emblem Engage Trial of the Pact.mp3",
  journey_5_day: "/journey/map5/Fire Emblem Engage Bright Sandstorm (Fiery).mp3",
  journey_5_night: "/journey/map5/Fire Emblem Engage Bright Sandstorm.mp3",
  journey_6_day: "/journey/map6/Fire Emblem Engage Tear Streaked (Ice).mp3",
  journey_6_night: "/journey/map6/Fire Emblem Engage Tear Streaked.mp3",
  journey_7_day: "/journey/map7/Fire Emblem Engage Distorted Flash of Light (Battle).mp3",
  journey_7_night: "/journey/map7/Fire Emblem Engage Distorted Flash of Light.mp3",
  buy_something: "/effect_sound/buy_something.mp3",
  change_cutscene: "/effect_sound/change_cutscene.mp3",
  overload_force: "/overload_force/overload_force_connect.m4a",
  muimi: "/overload_force/overload_force_theme.mp3",
  muimi_normal_hit: "/characters/muimi/mumi_normal_hit.mp3",
  muimi_ub_hit: "/characters/muimi/mumi_ub_hit.mp3",
  shiki: "/characters/shiki/shiki_theme.mp3",         // เพลงระหว่างท่าไม้ตาย ฉันมองเห็นมันแล้ว (ชิกิ)
  shiki2: "/characters/shiki/shiki_theme2.mp3",       // เพลงระหว่างท่าไม้ตาย 2 ความตายที่โรยรา (ชิกิ patch 2.0.6)
  tohno: "/characters/tohno/tohno_theme.mp3",         // เพลงระหว่างโทโนะถือ "หลับให้สบาย" (กดท่าไม้ตายแล้วยังไม่ได้ตี)
  nanaya: "/characters/nanaya/nanaya_theme.mp3",      // เพลงระหว่างสกิลติดตัว 1 นานายะ ชิกิ เปิดใช้งาน (patch 2.1.9)
  nanayaVoice1: "/characters/nanaya/voice/nanaya_voice1.m4a", // เสียงพากย์สุ่มตอนนานายะชนะการจั่ว
  nanayaVoice2: "/characters/nanaya/voice/nanaya_voice2.m4a",
  nanayaVoice3: "/characters/nanaya/voice/nanaya_voice3.m4a",
  nanayaVoice4: "/characters/nanaya/voice/nanaya_voice4.m4a",
  nanayaVoice5: "/characters/nanaya/voice/nanaya_voice5.m4a",
  bard_dim: "/characters/bard/bard_dim_theme.mp3",    // BGM ระหว่างมิติมายาบรรเลง (Bard — วนลูป 3 เทิร์น)
  bard_note1: "/characters/bard/bard_note1.mp3",      // เสียงเติมโน้ตช่องที่ 1 (Bard)
  bard_note2: "/characters/bard/bard_note2.mp3",      // เสียงเติมโน้ตช่องที่ 2
  bard_note3: "/characters/bard/bard_note3.mp3",      // เสียงเติมโน้ตช่องที่ 3
  bard_note4: "/characters/bard/bard_note4.mp3",      // เสียงเติมโน้ต (สำรอง)
  bard_melody1: "/characters/bard/bard_melody1.mp3",  // เสียงบรรเลงทำนอง สาย Crimson
  bard_melody2: "/characters/bard/bard_melody2.mp3",  // เสียงบรรเลงทำนอง สาย Jade
  bard_melody3: "/characters/bard/bard_melody3.mp3",  // เสียงบรรเลงทำนอง Encore ทำงานซ้ำ
  ginga: "/characters/hikaru/ginga_song.mp3",
  gingastrium: "/characters/hikaru/hikaru_update/ginga_theme2.mp3", // เพลงระหว่างร่าง Ginga Strium (ท่าไม้ตาย patch 2.1.3) — แทนที่เพลง ginga ที่เล่นค้างจากสกิลรอง
  temari_final_theme: "/characters/temari/temari_final_theme.mp3", // เพลง ANATA WAAAAAAAA (เล่นถึงตอนเปิดไพ่)
  // ไรเดอร์ Zect (คาซามะ/โซ) สองคนขึ้นไป Clock Up พร้อมกัน — เพลงสนามเปลี่ยนทั้งสนาม
  full_force: "/theme_song/FULL FORCE.mp3",
  // ORT บอสมหันตภัย (โหมด Type Mercury) — ตอนนี้เล่นในหน้าตัวอย่างอนิเมชัน
  ort_theme: "/characters/ort/ort_theme.mp3",
  // โหมด Purge: ก่อน ORT โผล่ / ORT โผล่แล้ว / ORT ห่างผู้เล่นคนใดคนหนึ่งไม่เกิน 3 ช่อง / เหลือ 2 คนสุดท้าย
  purge_normal: "/purge/normal_map.mp3",
  purge_ort: "/purge/ort_came.mp3",
  purge_close: "/purge/playermore3butless.mp3",
  purge_final: "/purge/playerjust2.mp3",
  // อุซากิ: เพลงตลอดช่วงท่าไม้ตาย (โจทย์คณิต 3 เทิร์น)
  usagi_theme: "/characters/usagi/usagi_theme.mp3",
  takt_theme: "/characters/takt/takt_theme_first.m4a", // อาซาฮินะ ทักต์: ระหว่างมิวสิคคาร์ทมีบทเพลง (ต่อด้วย loop — MUSIC_SEQUENCES)
  // จอห์นนี่ โจสตาร์: เพลงตลอด Tusk Act 4 · เสียงโจมตีปกติ/ยิงเล็บ · เสียงลบ Chumimi · เสียงกด Tusk Evo Experience
  johnny_theme: "/characters/johnny/johnny_theme.mp3",
  // Echo: เพลงตลอดท่าไม้ตาย "นี่มันเกมของฉัน" (-15.5 dBFS ใกล้เป้า -14 ไม่ต้องลด)
  echo_queen_theme: "/characters/echo_queen/echo_queen_theme.mp3",
  johnny_nail: "/characters/johnny/johnny_nail.mp3",
  johnny_chumimi: "/characters/johnny/johnny_chumimi.mp3",
  johnny_tusk: "/characters/johnny/johnny_tusk.mp3",
  // Bamboo-Hatted Kim: เสียงกดสกิล / เสียงสวนกลับ / เพลงร่าง Awake (เล่นค้างถาวรหลังเข้าร่าง)
  kim_draw: "/characters/Bamboo-Hatted Kim/สกิลพื้นฐาน/สกิลพื้นฐาน ชักดาบ.mp3",
  // โอเบรอน (ฤดูร้อน): เสียงตอนกดสกิลแต่ละช่อง (ส่งชื่อมากับ skillFlash)
  oberon_summer_skill1: "/characters/oberon(summer)/oberon_summer_skill1.m4a",
  oberon_summer_skill2: "/characters/oberon(summer)/oberon_summer_skill2.m4a",
  oberon_summer_skill3: "/characters/oberon(summer)/oberon_summer_skill3.m4a",
  kim_overthrow: "/characters/Bamboo-Hatted Kim/สกิลรอง/สกิลรอง ฟาดฟันลง 01.mp3",
  kim_counter: "/characters/Bamboo-Hatted Kim/สกิลรอง/สกิลรอง ฟาดฟันลง 02.mp3",
  kim_bones: "/characters/Bamboo-Hatted Kim/Yield My Flesh To Claim Their Bones.wav",
  kim_awake: "/characters/Bamboo-Hatted Kim/Limbus Company OST - Intervallo VII-2 Boss Battle Theme [-Lu6w6_P1NA].mp3",
  // Recruit: เสียงปืนโจมตีปกติ (ไฟล์ .mov ที่ข้างในเป็น MP3) / เสียงสกิลตอนยิงโดน / เสียงสกิลพิเศษ "เตรียมตัว"
  // สไตรเกอร์ ยูเรก้า: เสียงโจมตีปกติ / เสียงยิงขีปนาวุธ-ระเบิด
  striker_hit: "/characters/striker/striker_hit.mp3",
  striker_bomb: "/characters/striker/striker_bomb.mp3",
  recruit_attack: "/characters/Recruit/โจมตีปกติ/โจมตีปกติ.mov",
  recruit_basic: "/characters/Recruit/สกิลพื้นฐาน/สกิลพื้นฐาน.mp3",
  recruit_secondary: "/characters/Recruit/สกิลรอง/สกิลรอง.mp3",
  recruit_ult: "/characters/Recruit/สกิลอันติเมต/สกิลอันติเมต.mp3",
  recruit_bandage: "/characters/Recruit/สกิลพิเศษ/รักษา.mp3",
  recruit_reload: "/characters/Recruit/สกิลพิเศษ/รีโหลด.mp3",
  recruit_armor: "/characters/Recruit/สกิลพิเศษ/เกราะ.mp3",
  // ยูนะ ไอดอลประจำสนาม (patch 2.2.6): เพลงล็อกทั้งสนามตลอด 5 เทิร์นที่เอฟเฟกต์ทำงาน
  yuna_longing: "/characters/yuna/Longing.mp3",
  yuna_delete: "/characters/yuna/Delete.mp3",
  yuna_smile: "/characters/yuna/Smile for You.mp3",
  yuna_beatbark: "/characters/yuna/Break Beat Bark!.mp3",
  oguri: "/characters/oguri/oguri_theme.mp3",          // เพลงประจำตัวโอกูริ แคป (เริ่มตอนเข้าร่าง Zone — เล่นค้างระหว่างอยู่ร่าง)
  wonderofu: "/characters/satoru/wonderofu_theme.mp3", // เพลง Wonder of U (ซาโตรุ — เล่นค้างตราบใดที่มีคนติด Calamity)
  doomguy: "/characters/doomguy/สกิลอัลติเมติ/Doom Eternal OST - The Only Thing They Fear Is You (Mick Gordon) [Doom Eternal Theme].mp3", // เพลงระหว่างท่าไม้ตาย Crucible (DoomGuy)
  takuto: "/characters/takuto/takuto_theme.mp3", // เพลงประจำตัวหลังฉันคว้ามันได้แล้ว (สึงาชิ ทาคุโตะ)
  takuto2: "/characters/takuto/upadate/takuto_theme2.m4a", // เพลงประจำตัวหลังสกิลติดตัว 1 กันตายทำงาน (สึงาชิ ทาคุโตะ patch 2.2.4)
  tepeu: "/characters/tepeu/tepeu_theme.mp3", // เพลงระหว่างฉากหลัง "นายเป็นคนทำตัวเองนะ" ทำงาน (เทเปา ชิกิ)
  tepeu_skill1_2: "/characters/tepeu/tepeu_skill1_2.m4a", // เสียงกดสกิลพื้นฐาน/สกิลรอง (เทเปา ชิกิ)
  // ไค ชิซากิ: เสียงพากย์สุ่มทุกครั้งที่ใช้สกิล (พื้นฐาน/รอง/Overhaul)
  kaiVoice1: "/characters/kai/voice/kai_voice1.m4a",
  kaiVoice2: "/characters/kai/voice/kai_voice2.m4a",
  kaiVoice3: "/characters/kai/voice/kai_voice3.m4a",
  kaiVoice4: "/characters/kai/voice/kai_voice4.m4a",
  kaiVoice5: "/characters/kai/voice/kai_voice5.m4a",
  // ผู้สังหารเมจ: เสียงโจมตีปกติเฉพาะตัว / เสียงหลัง Mana Rupture / เพลงระหว่างมี Mana Burden (spellburden) ติดตัวเอง
  mageslayer_attack: "/characters/mageslayer/BA.mp3",
  // โทโนะ ชิกิ (rework): เสียงตีธรรมดา + เสียงพากย์สุ่ม (ตี / โดนตี / กดสกิลรอง-ท่าไม้ตาย)
  tohno_hit: "/characters/tohno/tohno_update/tohno_hit.mp3",
  // ไททัน: เสียงตีปกติ / หมัดสวนกลับของคล่องตัวสูง
  titan_hit: "/characters/titan/titan_hit.mp3",
  // คอเซ็ตต์: เสียงตีปกติ (ทุกร่าง)
  destiny_hit: "/characters/destiny/destiny_hit.mp3",
  // นักบินปริศนา (Silver Bullet): เสียงเปลี่ยนแขน (สกิลพื้นฐาน) / เสียงยิง Beam Magnum (สกิลรอง)
  sliver_reload: "/characters/sliver_bullet/sliver_bullet_reload_arm.m4a",
  sliver_shot: "/characters/sliver_bullet/sliver_bullet.m4a",
  tohno_voice_hit1: "/characters/tohno/tohno_update/hit_sound/tohno_hit.m4a",
  tohno_voice_hit2: "/characters/tohno/tohno_update/hit_sound/tohno_hit2.m4a",
  tohno_voice_hit3: "/characters/tohno/tohno_update/hit_sound/tohno_hit3.m4a",
  tohno_voice_hit4: "/characters/tohno/tohno_update/hit_sound/tohno_hit4.m4a",
  tohno_voice_hit5: "/characters/tohno/tohno_update/hit_sound/tohno_hit5.m4a",
  tohno_voice_hit6: "/characters/tohno/tohno_update/hit_sound/tohno_hit6.m4a",
  tohno_hurt1: "/characters/tohno/tohno_update/hitby_sound/tohno_hitby01.m4a",
  tohno_hurt2: "/characters/tohno/tohno_update/hitby_sound/tohno_hitby02.m4a",
  tohno_skill1: "/characters/tohno/tohno_update/skill_sound/tohno_skill01.m4a",
  tohno_skill2: "/characters/tohno/tohno_update/skill_sound/tohno_skill02.m4a",
  // มิซึซาว่า ฮารุกะ: เสียงโจมตีปกติระหว่างสถานะ "โอเมก้า" (ท่าไม้ตาย New Omega)
  haruka_attack: "/characters/haruka/hit_haruka.mp3",
  mageslayer_skill2: "/characters/mageslayer/SFX_Skill_2.mp3",
  mageslayer_ult: "/characters/mageslayer/BGM_Ult.mp3",
  // เสียงอาวุธ DoomGuy (patch 2.2 full): เสียงโจมตี/เสียงใช้สกิลรอง Weapon แยกตามอาวุธที่ถืออยู่
  doomguy_cs_shoot: "/characters/doomguy/sound/CS Shoot.mp3",
  doomguy_cs_skill: "/characters/doomguy/sound/CS Skill.mp3",
  doomguy_hc_shoot: "/characters/doomguy/sound/HC Shoot.mp3",
  doomguy_hc_skill: "/characters/doomguy/sound/HC SKill.mp3",
  doomguy_pg_shoot: "/characters/doomguy/sound/PG Shoot.mp3",
  doomguy_cg_shoot: "/characters/doomguy/sound/CG Shoot.mp3",
  doomguy_cg_skill: "/characters/doomguy/sound/CG SKill.mp3",
  doomguy_rk_shoot: "/characters/doomguy/sound/RK Shoot.mp3",
  doomguy_rk_skill: "/characters/doomguy/sound/RK Skill.mp3",
  doomguy_ss_shoot: "/characters/doomguy/sound/SS Shoot.mp3",
  doomguy_ss_skill: "/characters/doomguy/sound/SS Skill.mp3",
  doomguy_bt_shoot: "/characters/doomguy/sound/BT Shoot.mp3",
  doomguy_bt_skill: "/characters/doomguy/sound/BT Skill.mp3",
  doomguy_bfg_shoot: "/characters/doomguy/sound/BFG.mp3",
  // ทาคุมิ ฟุจิวาระ: เพลงประจำตัวตามเกียร์ (เกียร์ 3-5 / เกียร์ 6) + เพลงระหว่างท่าไม้ตาย "ถึงจะมองไม่เห็น แต่ฉันยังอยู่" ทำงาน
  all_around: "/characters/takumi/all_around.mp3",
  secret_love: "/characters/takumi/secret_love.mp3",
  forever: "/characters/takumi/forever.mp3",
  // แบทแมน (เบน แอฟเฟล็ก) patch 2.2.7: เพลงระหว่างท่าไม้ตาย "เข้ามาเลย" ทำงาน (ล่อเป้า 5 เทิร์น)
  bat_ben: "/characters/bat_ben/bat_ben_theme.mp3",
  // เจ้าหญิงราก (เรียวกิ ชิกิ) patch 2.2.7: เพลงระหว่างท่าไม้ตาย "ทุกอย่างจะต้องราบรื่น" ทำงาน
  p_shiki: "/characters/princess_shiki/p_shiki_theme.m4a",
  trigger: "/characters/ultraman_trigger/trigger_theme.mp3",
  hisakawa_sunday: "/characters/hisakawa_sister/skill3/O-Ku-Ri-Mo-No.mp3",
  // ฟุจิตะ โคโตเนะ (rework 2.3): เพลงประจำร่าง [พร้อมลุย] + เพลงประกอบท่าไม้ตาย 3/4/5 (เล่นทับวีดีโอผ่าน cs.voice)
  kotone_ult1: "/characters/kotone/rework/สกิลอัลติเมติ1/ULT1.mp3",
  kotone_ult3: "/characters/kotone/rework/สกิลอัลติเมต3/ULT3.mp3",
  kotone_ult4: "/characters/kotone/rework/สกิลอัลติเมต4/ULT4.mp3",
  kotone_ult5: "/characters/kotone/rework/สกิลอัลติเมต5/ULT5.mp3",
  hisakawa_nagi_1: "/characters/hisakawa_sister/voice/nagi/nagi_voice.m4a",
  hisakawa_nagi_2: "/characters/hisakawa_sister/voice/nagi/nagi_voice2.m4a",
  hisakawa_nagi_3: "/characters/hisakawa_sister/voice/nagi/nagi_voice3.m4a",
  hisakawa_hayate_1: "/characters/hisakawa_sister/voice/hayate_voice.m4a",
  hisakawa_hayate_2: "/characters/hisakawa_sister/voice/hayate_voice2.m4a",
  hisakawa_hayate_3: "/characters/hisakawa_sister/voice/hayate_voice3.m4a",
  // เอจิ (patch 2.4 new): ท่าไม้ตาย ไม่ว่ายังก็ตาม — ไฟล์แรกของลำดับเพลง (ดู MUSIC_SEQUENCES ด้านล่าง)
  eiji_ult: "/characters/eiji/skill3/eiji_skill3_connect.m4a",
  // อาจารย์ ไบเลธ (patch 2.6 new): เพลงประจำ 3 หลักสูตร แยกไฟล์กลางวัน/กลางคืน
  //  สลับช่วงเวลาแล้วเพลงอีกไฟล์ต้องเล่น "ต่อจากตำแหน่งเดิม" ไม่เริ่มใหม่ (ดู MUSIC_POSITION_GROUPS)
  // คอนเนอร์ RK800: เพลงไล่ล่า (สกิลติดตัว 2 จับกุมขั้นเด็ดขาด) — เล่นค้างตลอด 3 เทิร์นของการไล่ล่า
  conner_theme: "/characters/connor/conner_theme.m4a",
  // อิสึกะ ชิโด: เพลง Sandalphon — เล่นค้างตลอด 3 เทิร์นที่ดาบยังอยู่
  shido_theme: "/characters/shido/shido_theme.mp3",
  // ยุย โยชิโอกะ: เพลงประจำท่าไม้ตายแต่ละเพลง — เล่นค้างตลอด 5 เทิร์นที่เพลงทำงาน
  yui_song1: "/characters/yui/song/song_3.1.mp3",
  yui_song2: "/characters/yui/song/song_3.2.mp3",
  yui_song3: "/characters/yui/song/song_3.3.mp3",
  // มาคุโนะอุจิ อิปโป: เพลงประจำท่า Dempsey roll — เล่นค้างตลอดที่บัฟยังอยู่
  ippo_theme: "/characters/ippo/ippo_theme.mp3",
  // ผู้วิงวอน: เสียงประกอบ gif ที่เล่นทับไอคอนผู้เล่น (สั้นๆ ไม่ใช่เพลงประจำตัว)
  sup_heal: "/characters/the_supplicant/sup_heal.mp3",
  sup_shield: "/characters/the_supplicant/sup_shield.mp3",
  sup_strike: "/characters/the_supplicant/sup_strike.mp3",
  // คอนเนอร์: เพลงคิดตอนกด "วิเคราะห์สถานการณ์" (เล่นครั้งเดียวจบ ไม่ใช่เพลงประจำตัวที่เล่นค้าง)
  conner_think: "/characters/connor/conner_think.m4a",
  // ไบรอัน (GT-R34): เพลงประจำร่างรถ และเพลงระหว่างการแข่งที่มีเดิมพัน (ทับเพลงร่างรถ)
  brian_theme: "/characters/brian_r34/brian_theme.mp3",
  brian_duel_theme: "/characters/brian_r34/brian_duel_theme.m4a",
  // โปรดิวเซอร์ (luminous): เพลงประจำท่าไม้ตายของไอดอลแต่ละคน + เสียงพูดตอนสลับตัว
  lumi_song_haruka: "/characters/producer_lumi/haruka/haruka_idol_song.m4a",
  lumi_song_anzu: "/characters/producer_lumi/anzu/anzu_idol_song.m4a",
  lumi_song_mirai: "/characters/producer_lumi/mirai/mirai_idol_song.m4a",
  lumi_song_kaho: "/characters/producer_lumi/kaho/kaho_idol_song.m4a",
  lumi_song_kohaku: "/characters/producer_lumi/kohaku/kohaku_idol_song.m4a",
  lumi_voice_haruka: "/characters/producer_lumi/haruka/haruka_idol_voice.m4a",
  lumi_voice_anzu: "/characters/producer_lumi/anzu/anzu_idol_voice.m4a",
  lumi_voice_mirai: "/characters/producer_lumi/mirai/mirai_idol_voice.m4a",
  lumi_voice_kaho: "/characters/producer_lumi/kaho/kaho_idol_voice.m4a",
  lumi_voice_kohaku: "/characters/producer_lumi/kohaku/kohaku_idol_voice.m4a",
  lumi_luminous: "/characters/producer_lumi/luminus/luminus_song.m4a",
  // ---------- คาเยนน์ ซูซูชิโระ ----------
  cayenne_theme: "/characters/cayenne/cayenne_theme.m4a", // เพลงประจำร่างเกพาร์ด (ขึ้นหลังวีดีโอแปลงร่าง)
  cayenne_gun: "/characters/cayenne/gun_sound.mp3",       // เสียงโจมตีปกติในร่างเกพาร์ด
  daichi_theme: "/characters/daichi/daichi_theme.mp3",    // ไดจิ โอโซระ: เพลงระหว่าง unite
  // ---------- SE.RA.PH Moon Cell (โหมดผจญภัย) — ดู SERAPH_SCENES.md §6 ----------
  //  แต่ละเพลงจำตำแหน่งของตัวเอง · วันดวลวันที่ 7 ใช้ seq ของรอบเพื่อเริ่มจากต้น
  sc_day: "/mooncell/theme/day1-4.mp3",
  sc_rest: "/mooncell/theme/rest_time.mp3",
  sc_duel_day: "/mooncell/day5theme/day_mooncell.mp3",
  sc_duel_night: "/mooncell/day5theme/night_mooncell.mp3",
  sc_glitch: "/mooncell/sond_effect/cut_glit.mp3",
  sc_noti: "/mooncell/sond_effect/noti.mp3",
  sc_noti2: "/mooncell/sond_effect/noti2.mp3",
  action_button: "/effect_sound/click.mp3",
  trun_change: "/effect_sound/trun_change.wav",
  attack: "/effect_sound/attack.wav",
};

// เพลงสนามนี้มี intro หนึ่งครั้ง แล้วจึงเปลี่ยนเป็น theme ที่วนลูปจนจบเทิร์น
const MUSIC_SEQUENCES = {
  overload_force: [
    "/overload_force/overload_force_connect.m4a",
    "/overload_force/overload_force_theme.mp3",
  ],
  // เอจิ: วีดีโอท่าไม้ตายจบ -> ต่อด้วย eiji_skill3_connect.m4a
  //  ถ้าท่ายังไม่จบแต่ไฟล์นั้นจบก่อน -> วนลูป Break Beat Bark!.mp3 ต่อไปจนหมดผล
  eiji_ult: [
    "/characters/eiji/skill3/eiji_skill3_connect.m4a",
    "/characters/yuna/Break Beat Bark!.mp3",
  ],
  // อาซาฮินะ ทักต์: มอบบทเพลงครั้งแรก -> first ครั้งเดียว แล้ววน loop · ได้บทเพลงเพิ่มอีกคนไม่เริ่มใหม่ (seq เดิมจาก server)
  //  บทเพลงหมดทุกคนแล้วมอบใหม่ = seq ใหม่ -> เริ่มที่ first อีกครั้ง
  takt_theme: [
    "/characters/takt/takt_theme_first.m4a",
    "/characters/takt/takt_theme_loop.m4a",
  ],
};

// เพลงที่อยู่กลุ่มเดียวกัน = สลับไฟล์กันแล้ว "เล่นต่อจากตำแหน่งเดิม" ไม่เริ่มนับหนึ่งใหม่
//  ใช้กับหลักสูตรของไบเลธ: ไฟล์กลางวัน/กลางคืนของ "หลักสูตรเดียวกัน" คือเพลงเดียวกันคนละเวอร์ชัน
//  -> สลับช่วงเวลาแล้วเพลงอีกไฟล์เริ่มที่วินาทีเดียวกับที่เพลงเก่าเล่นค้างไว้ (ไหลลื่นไม่สะดุด)
//  แต่ละหลักสูตรเป็นกลุ่มของตัวเอง — "สลับหลักสูตร" จึงไม่ใช่การต่อเพลง แต่เป็นการเปิดเพลงใหม่
//  ซึ่ง server จะขยับ seq (transformAt) ให้ทุกครั้งที่กด -> เพลงของหลักสูตรใหม่เริ่มจากต้นเสมอ
const MUSIC_POSITION_GROUPS = {
  // SE.RA.PH: **ห้ามจับ sc_day กับ sc_rest เป็นกลุ่มเดียวกัน** — กลุ่มตำแหน่งมีไว้สำหรับ
  //  "เพลงเดียวกันคนละเวอร์ชัน" (กลางวัน/กลางคืนของหลักสูตรไบเลธ) เท่านั้น
  //  สองเพลงนี้เป็นคนละเพลงกันและยาวไม่เท่ากัน: ถ้าอยู่กลุ่มเดียวกัน ตอนสลับจะ carry ตำแหน่งข้ามมา
  //  แล้วเพลงใหม่ที่ยังไม่โหลด metadata จะมี duration = NaN -> seek เลยจุดจบเพลง = เงียบสนิท
};

// สัดส่วนผสมเสียง: เอฟเฟกต์/เสียงพากย์ต้องเด่นกว่าเพลงประกอบ (เพลงเป็นพื้นหลัง)
//  ระหว่างวีดีโอเพลงถูกพักอยู่แล้ว วีดีโอจึงเต็ม 1 ได้โดยไม่แย่งกับเพลง
//  เดิม 0.5 (-6 dB) ผู้เล่นบอกว่าเพลงเบาเกินไป -> 0.75 (-2.5 dB) เอฟเฟกต์ยังเด่นกว่าเพลงอยู่
const MUSIC_BASE = 0.75;
const SFX_BASE = 1;
const CLICK_BASE = 0.55;
const VIDEO_BASE = 1;

// ความดังต่อไฟล์ (สร้างจากการวัดจริง: RMS แบบตัดช่วงเงียบ) — ไฟล์ต้นฉบับดังไม่เท่ากันมาก (ต่างกันถึง ~30 dB)
//  เป้า: เพลง -14 · เอฟเฟกต์ -14 · วีดีโอ -16 dBFS — ลดได้อย่างเดียว (HTMLAudio ตั้ง volume เกิน 1 ไม่ได้)
//  ไฟล์ที่เบากว่าเป้ามากถูกทำให้ดังขึ้นที่ตัวไฟล์แล้ว (ต้นฉบับสำรองไว้ที่ R2 _backup_audio/)
//  ไฟล์ใหม่ที่ไม่อยู่ในตาราง = 1 (ไม่ลด) · key = path ของไฟล์ (ตรงกับ FILES / MUSIC_SEQUENCES / วีดีโอ src)
const LOUDNESS_GAIN = {
  "/characters/Bamboo-Hatted Kim/Limbus Company OST - Intervallo VII-2 Boss Battle Theme [-Lu6w6_P1NA].mp3": 0.49,
  "/characters/Recruit/สกิลอันติเมต/สกิลอัลติเมติ.mp4": 0.44,
  "/characters/reines/reines_skill3.mp4": 0.77, // ไรเนส: วีดีโอท่าไม้ตาย -13.8 dBFS (เป้าวีดีโอ -16)
  "/characters/andersen/andersen_skill3.mp4": 0.64,
  "/characters/takt/titan/takt_titan_skill2.mp4": 0.79, // ไททัน: วีดีโอ Vigorous Rising Sun (เป้าวีดีโอ -16)
  "/characters/takt/titan/takt_titan_skill3.mp4": 0.71, // ไททัน: วีดีโอ Triumphant (เป้าวีดีโอ -16)
  "/characters/destiny/destiny_skill3.mp4": 0.89, // คอเซ็ตต์: วีดีโอทิ่มแทง (เป้าวีดีโอ -16)
  "/characters/dio_brando/dio_laststand_fail.mp4": 0.76, // ดิโอ: วีดีโอ Last stand แพ้ -13.6 dBFS (เป้าวีดีโอ -16 · คลิปอื่นของดิโอเบาเกินจึงขยายที่ตัวไฟล์แล้ว)
  "/characters/takt/destiny/takt_destiny.mp4": 0.97, // คอเซ็ตต์: วีดีโอได้บทเพลง (เป้าวีดีโอ -16)
  "/characters/takt/destiny/takt_destiny_skill3_I.mp4": 0.76, // คอเซ็ตต์: วีดีโอ Destiny I (เป้าวีดีโอ -16)
  "/characters/takt/takt_passive3-titan.mp4": 0.98, // ทักต์: วีดีโอสั่งไททัน (เป้าวีดีโอ -16)
  "/characters/takt/takt_passive3-destiny.mp4": 0.68, // ทักต์: วีดีโอสั่งเดสตินี่ (เป้าวีดีโอ -16)
  "/characters/titan/titan_hit.mp3": 0.64, // ไททัน: เสียงตีปกติ (เป้าเอฟเฟกต์ -14)
  "/characters/destiny/destiny_hit.mp3": 0.71, // คอเซ็ตต์: เสียงตีปกติ -11.0 dBFS (เป้าเอฟเฟกต์ -14)
  "/characters/johnny/johnny_theme.mp3": 0.61,   // จอห์นนี่: เพลง Act 4 -9.7 dBFS (เป้าเพลง -14)
  "/characters/johnny/johnny_nail.mp3": 0.81,    // -12.2 dBFS (เป้าเอฟเฟกต์ -14)
  "/characters/johnny/johnny_chumimi.mp3": 0.94, // -13.5 dBFS
  "/characters/johnny/johnny_ora.mp4": 0.6,      // วีดีโอ Ora -11.6 dBFS (เป้าวีดีโอ -16)
  "/characters/johnny/johnny_act4_evo.mp4": 0.92, // -15.3 dBFS
  "/characters/johnny/johnny_lesson5.mp4": 0.92,  // -15.3 dBFS
  "/characters/sliver_bullet/sliver_bullet_skill1.mp4": 0.95, // นักบินปริศนา: วีดีโอเปลี่ยนชิ้นส่วน -15.6 dBFS (เป้าวีดีโอ -16)
  "/characters/sliver_bullet/sliver_bullet_skill2.mp4": 0.69, // วีดีโอ Beam Magnum -12.8 dBFS
  "/characters/sliver_bullet/sliver_bullet.m4a": 0.94,        // เสียงยิง -13.5 dBFS (เป้าเอฟเฟกต์ -14)
  "/characters/sliver_bullet/sliver_bullet_reload_arm.m4a": 0.97, // เสียงเปลี่ยนแขน -13.7 dBFS
  "/characters/escanor/New Last Stand.mp4": 0.58, // เอสคานอร์: วีดีโอ Last Stand ใหม่ -11.3 dBFS (เป้าวีดีโอ -16) // แอนเดอร์เซน: วีดีโอท่าไม้ตาย -12.1 dBFS (เป้าวีดีโอ -16)
  "/characters/Recruit/โจมตีปกติ/โจมตีปกติ.mov": 0.66,
  "/characters/appleguy/appleguy_final.mp4": 0.4,
  "/characters/bard/bard_dim.mp4": 0.33,
  "/characters/bard/bard_dim_theme.mp3": 0.76,
  "/characters/bard/bard_melody3.mp3": 0.77,
  "/characters/bat_ben/bat_ben_theme.mp3": 0.68,
  "/characters/bat_ben/bat_update/skill3.2/bat_ben_skill3.2.mp4": 0.89,
  "/characters/brian_r34/brian_duel_theme.m4a": 0.54,
  "/characters/brian_r34/brian_theme.mp3": 0.47,
  "/characters/brian_r34/skill1/brian_skill1.mp4": 0.44,
  "/characters/brian_r34/skill1/brian_skill1_boost.mp4": 0.42,
  "/characters/brian_r34/skill2/brian_skill2.mp4": 0.43,
  "/characters/brian_r34/skill3/brian_skill3.2.mp4": 0.51,
  "/characters/brian_r34/skill3/brian_skill3.2_hit.mp4": 0.59,
  "/characters/brian_r34/skill3/duel/brian_duel.mp4": 0.42,
  "/characters/brian_r34/skill3/duel/brian_duel_lost.mp4": 0.45,
  "/characters/brian_r34/skill3/duel/brian_duel_win.mp4": 0.5,
  "/characters/cayenne/cayenne_theme.m4a": 0.72,
  "/characters/cayenne/gepard.mp4": 0.64,
  "/characters/cayenne/gun_sound.mp3": 0.88,
  "/characters/cayenne/skill2/cayenne_skill2.mp4": 0.7,
  "/characters/cayenne/skill3/cayenne_skill3.mp4": 0.74,
  "/characters/connor/arrest/connor_arrest_1.mp4": 0.56,
  "/characters/connor/arrest/connor_arrest_2.mp4": 0.71,
  "/characters/connor/arrest/connor_arrest_3.mp4": 0.54,
  "/characters/connor/arrest/connor_arrest_false.mp4": 0.61,
  "/characters/connor/arrest/connor_arrest_true.mp4": 0.58,
  "/characters/connor/conner_theme.m4a": 0.68,
  "/characters/connor/conner_think.m4a": 0.92,
  "/characters/connor/connor_passive4.mp4": 0.53,
  "/characters/connor/skill3/connor_skill3.mp4": 0.47,
  "/characters/daichi/daichi_theme.mp3": 0.54,
  "/characters/daisuke/daisuke.mp4": 0.62,
  "/characters/daisuke/daisuke_skill1.mp4": 0.83,
  "/characters/daisuke/daisuke_skill2.mp4": 0.72,
  "/characters/daisuke/daisuke_skill3.mp4": 0.58,
  "/characters/dan/dan_passive.mp4": 0.61,
  "/characters/doomguy/sound/BFG.mp3": 0.81,
  "/characters/doomguy/sound/BT Skill.mp3": 0.87,
  "/characters/doomguy/sound/CG SKill.mp3": 0.91,
  "/characters/doomguy/sound/CG Shoot.mp3": 0.74,
  "/characters/doomguy/sound/RK Skill.mp3": 0.75,
  "/characters/doomguy/sound/SS Skill.mp3": 0.81,
  "/characters/doomguy/สกิลอัลติเมติ/Doom Eternal OST - The Only Thing They Fear Is You (Mick Gordon) [Doom Eternal Theme].mp3": 0.51,
  "/characters/doomguy/สกิลอัลติเมติ/doom.mp4": 0.86,
  "/characters/eiji/skill3/eiji_skill3_connect.m4a": 0.76,
  "/characters/escanor/Last Stand.mp4": 0.42,
  "/characters/escanor/สกิลพื้นฐาน/สกิลพื้นฐาน 1 บอลเพลิงสุริยะ.mp4": 0.84,
  "/characters/escanor/สกิลรอง/สกิลรอง 1 เพลิงปะทุ.mp4": 0.34,
  "/characters/escanor/สกิลรอง/สกิลรอง 3 หมัดเพลิงสุริยัน.mp4": 0.29,
  "/characters/escanor/สกิลอัลติเมต/สกิลอัลติเมต 1 Divin Axe Rhitta.mp4": 0.37,
  "/characters/escanor/สกิลอัลติเมต/สกิลอัลติเมต 3 ดวงอาทิตย์จำลอง.mp4": 0.31,
  "/characters/hikaru/ginga_song.mp3": 0.47,
  "/characters/hikaru/hikaru_update/ginga_theme2.mp3": 0.43,
  "/characters/hisakawa_sister/skill3/O-Ku-Ri-Mo-No.mp3": 0.42,
  "/characters/ippo/ippo_dodge.mp4": 0.82,
  "/characters/ippo/ippo_theme.mp3": 0.51,
  "/characters/kagami/kagami.mp4": 0.54,
  "/characters/kagami/kagami_skill1.mp4": 0.67,
  "/characters/kagami/kagami_skill2.mp4": 0.72,
  "/characters/kagami/kagami_skill3_final.mp4": 0.6,
  "/characters/kagami/kagami_skill3_one.mp4": 0.62,
  "/characters/kagami/kagami_skill3_three.mp4": 0.6,
  "/characters/kai/voice/kai_voice1.m4a": 0.79,
  "/characters/kai/voice/kai_voice2.m4a": 0.54,
  "/characters/kai/voice/kai_voice3.m4a": 0.49,
  "/characters/kai/voice/kai_voice4.m4a": 0.56,
  "/characters/kai/voice/kai_voice5.m4a": 0.63,
  "/characters/kotone/rework/สกิลอัลติเมต3/ULT3.mp3": 0.58,
  "/characters/kotone/rework/สกิลอัลติเมต3/ULT3.mp4": 0.75,
  "/characters/kotone/rework/สกิลอัลติเมต4/ULT4.mp3": 0.77,
  "/characters/kotone/rework/สกิลอัลติเมต4/ULT4.mp4": 0.73,
  "/characters/kotone/rework/สกิลอัลติเมต5/ULT5.mp3": 0.61,
  "/characters/kotone/rework/สกิลอัลติเมติ1/ULT1.mp3": 0.88,
  "/characters/mageslayer/SFX_Skill_2.mp3": 0.53,
  "/characters/mageslayer/VDO_Skill_1.mp4": 0.47,
  "/characters/muimi/muimi_skill3_short.mp4": 0.88,
  "/characters/muimi/mumi_ub_hit.mp3": 0.79,
  "/characters/nanaya/voice/nanaya_voice4.m4a": 0.62,
  "/characters/nanaya/voice/nanaya_voice5.m4a": 0.64,
  "/characters/oguri/Skill 3 The Beat of Victory.mp4": 0.92,
  "/characters/oguri/Skill 3-2 Ashen Trail Cinderella Gray.mp4": 0.39,
  "/characters/ort/ort_theme.mp3": 0.87,
  "/characters/princess_shiki/p_shiki_theme.m4a": 0.74,
  "/characters/producer_lumi/anzu/anzu_idol_intro.mp4": 0.91,
  "/characters/producer_lumi/anzu/anzu_idol_song.m4a": 0.89,
  "/characters/producer_lumi/haruka/haruka_idol_song.m4a": 0.91,
  "/characters/producer_lumi/kaho/kaho_idol_intro.mp4": 0.94,
  "/characters/producer_lumi/kaho/kaho_idol_song.m4a": 0.91,
  "/characters/producer_lumi/kohaku/kohaku_idol_intro.mp4": 0.66,
  "/characters/producer_lumi/kohaku/kohaku_idol_song.m4a": 0.76,
  "/characters/producer_lumi/luminus/luminus_burst.mp4": 0.56,
  "/characters/producer_lumi/luminus/luminus_song.m4a": 0.79,
  "/characters/producer_lumi/mirai/mirai_idol_intro.mp4": 0.8,
  "/characters/satoru/Ultimate.mp4": 0.38,
  "/characters/satoru/wonderofu_theme.mp3": 0.78,
  "/characters/shido/shido_theme.mp3": 0.94,
  "/characters/shiki/shiki_theme.mp3": 0.46,
  "/characters/shiki/shiki_theme2.mp3": 0.71,
  "/characters/striker/skill2/striker_skill2.mp4": 0.66,
  "/characters/striker/skill2/striker_skill2_final.mp4": 0.54,
  "/characters/striker/skill3/striker_skill3.2.mp4": 0.63,
  "/characters/striker/skill3/striker_skill3.2_final.mp4": 0.54,
  "/characters/striker/skill3/striker_skill3.mp4": 0.69,
  "/characters/striker/striker_intro.mp4": 0.53,
  "/characters/striker/striker_passive.mp4": 0.58,
  "/characters/striker/striker_passive3.mp4": 0.64,
  "/characters/takumi/all_around.mp3": 0.86,
  "/characters/takumi/forever.mp3": 0.57,
  "/characters/takumi/secret_love.mp3": 0.83,
  "/characters/takumi/takumi_skill3_second.mp4": 0.92,
  "/characters/takuto/takuto_theme.mp3": 0.68,
  "/characters/takuto/upadate/takuto_theme2.m4a": 0.47,
  "/characters/temari/temari_final_theme.mp3": 0.58,
  "/characters/tepeu/tepeu_theme.mp3": 0.87,
  "/characters/the_supplicant/sup_strike.mp3": 0.73,
  "/characters/tohno/tohno_theme.mp3": 0.51,
  "/characters/tohno/tohno_update/hit_sound/tohno_hit.m4a": 0.44,
  "/characters/tohno/tohno_update/hit_sound/tohno_hit2.m4a": 0.73,
  "/characters/tohno/tohno_update/hit_sound/tohno_hit3.m4a": 0.42,
  "/characters/tohno/tohno_update/hit_sound/tohno_hit4.m4a": 0.65,
  "/characters/tohno/tohno_update/hit_sound/tohno_hit5.m4a": 0.46,
  "/characters/tohno/tohno_update/hit_sound/tohno_hit6.m4a": 0.42,
  "/characters/tohno/tohno_update/hitby_sound/tohno_hitby01.m4a": 0.45,
  "/characters/tohno/tohno_update/hitby_sound/tohno_hitby02.m4a": 0.44,
  "/characters/tohno/tohno_update/skill_sound/tohno_skill01.m4a": 0.56,
  "/characters/tohno/tohno_update/skill_sound/tohno_skill02.m4a": 0.58,
  "/characters/tohno/tohno_update/tohno_skill3.mp4": 0.94,
  "/characters/tsurugi/tsurugi.mp4": 0.65,
  "/characters/tsurugi/tsurugi_skill1.mp4": 0.63,
  "/characters/tsurugi/tsurugi_skill2.mp4": 0.52,
  "/characters/tsurugi/tsurugi_skill3_final.mp4": 0.6,
  "/characters/tsurugi/tsurugi_skill3_first.mp4": 0.56,
  "/characters/ultraman_trigger/skill3/trigger_skill3.mp4": 0.92,
  "/characters/ultraman_trigger/trigger_theme.mp3": 0.86,
  "/characters/usagi/usagi_theme.mp3": 0.85,
  "/characters/takt/takt_theme_first.m4a": 0.85, // อาซาฮินะ ทักต์: -12.6 dBFS (เป้าเพลง -14)
  "/characters/takt/takt_theme_loop.m4a": 0.95,  // -13.6 dBFS
  "/characters/yaguruma/yaguruma.mp4": 0.68,
  "/characters/yaguruma/yaguruma_skill1.mp4": 0.66,
  "/characters/yaguruma/yaguruma_skill3.mp4": 0.65,
  "/characters/yui/skill2/yui_skill2.mp4": 0.66,
  "/characters/yui/skill3/yui_skill3_false.mp4": 0.68,
  "/characters/yui/song/song_3.1.mp3": 0.65,
  "/characters/yui/song/song_3.2.mp3": 0.73,
  "/characters/yuna/Break Beat Bark!.mp3": 0.59,
  "/characters/yuna/Delete.mp3": 0.56,
  "/characters/yuna/Longing.mp3": 0.62,
  "/item/guts_key/shockwave_boost.mp4": 0.92,
  "/mooncell/day5theme/day_mooncell.mp3": 0.79,
  "/mooncell/day5theme/night_mooncell.mp3": 0.74,
  "/mooncell/sond_effect/noti2.mp3": 0.75,
  "/mooncell/theme/day1-4.mp3": 0.5,
  "/mooncell/theme/rest_time.mp3": 0.51,
  "/overload_force/overload_force_connect.m4a": 0.67,
  "/overload_force/overload_force_theme.mp3": 0.53,
  "/theme_song/FULL FORCE.mp3": 0.44,
  // การเดินทาง (วัดด้วย Web Audio: RMS บล็อก 0.4 วิ ตัดบล็อกที่เบากว่า -50 dBFS) — ไฟล์ที่เบากว่า -14 อยู่แล้วไม่อยู่ในตาราง
  //  ⚠️ map2 กลางคืน (Full Bloom in the Breeze.mp3) เบากว่าเป้า ~5 dB — ต้องเข้ารหัสใหม่ให้ดังขึ้นที่ตัวไฟล์ถ้าต้องการให้เท่ากัน
  "/journey/map1/Fire Emblem Engage Faraway Holy Land (Flare).mp3": 0.61,
  "/journey/map2/Fire Emblem Engage Full Bloom in the Breeze (Blossom).mp3": 0.59,
  "/journey/map3/Fire Emblem Engage Trial of Dawn (Heal Us).mp3": 0.7,
  "/journey/map4/Fire Emblem Engage Trial of the Pact (Connect Us).mp3": 0.62,
  "/journey/map6/Fire Emblem Engage Tear Streaked (Ice).mp3": 0.66,
  "/journey/map6/Fire Emblem Engage Tear Streaked.mp3": 0.66,
  "/journey/map7/Fire Emblem Engage Distorted Flash of Light (Battle).mp3": 0.71,
  "/theme_song/battle_phase.mp3": 0.65,
  "/theme_song/day_4.0.mp3": 0.78,
  "/theme_song/main_home_4.0.mp3": 0.69,
  "/theme_song/main5.0.mp3": 0.85, // -11.7 LUFS
  "/theme_song/lobby5.0.mp3": 1, // -15.7 LUFS (เบากว่าเป้าเล็กน้อย ดันได้สุด 1)
};
function pathGain(path) { return LOUDNESS_GAIN[path] ?? 1; }
export function soundGain(name) { return pathGain(FILES[name]); }
const activeSfx = new Map();
const musicSuspensions = new Set();

// เพลงบางเพลงต้นฉบับดังกว่าเพลงอื่นมาก (เพลงคุวากาตะทั้ง 2 แบบ) — ลดเฉพาะตัวให้สมดุลกับเพลงอื่น
const MUSIC_TRACK_SCALE = {
  // การเดินทาง ภูมิภาค 2 กลางคืน: ไฟล์เบากว่าเพลงอื่น ~5 dB (-19 เทียบ -14 dBFS) — ดันขึ้นให้เท่ากัน (ชนเพดาน volume 1 เมื่อหลอดเสียงสูง)
  journey_2_night: 1.78,
};
// "หรี่เพลงหลัก" (patch 3.4.2 — เพลงคิดของคอนเนอร์): ระหว่างมีลูปเสียงเฉพาะกิจเล่นอยู่
//  เพลง BGM ปกติจะถูกหรี่ลงแทนที่จะหยุด เพราะเอฟเฟกต์เพลงใน App.jsx สั่งเล่นซ้ำทุกครั้งที่ state เปลี่ยน
//  (ถ้าใช้ pause จะถูกสั่ง play() กลับมาทันทีในบรอดแคสต์ถัดไป)
let musicDuck = 1;
let loopSfx = null; // ลูปเสียงเฉพาะกิจที่เล่นอยู่ (ดู startLoopSfx ท้ายไฟล์)
function musicPath(name) {
  const sequence = MUSIC_SEQUENCES[name];
  return sequence ? sequence[musicCache[name]?._echoSequenceStage || 0] : FILES[name];
}
function trackVolume(name) {
  return Math.min(1, MUSIC_BASE * pathGain(musicPath(name)) * (MUSIC_TRACK_SCALE[name] ?? 1) * masterGain() * musicDuck);
}

// ---------- master volume (จำค่าไว้ใน localStorage) ----------
let masterVolume = 0.8;
try {
  const saved = parseFloat(localStorage.getItem("echo_vol"));
  if (!Number.isNaN(saved)) masterVolume = Math.max(0, Math.min(1, saved));
} catch {}
const volListeners = new Set();

// ทุกแหล่งเสียงต้องผ่าน curve เดียวกัน ไม่งั้นสัดส่วนความดังจะเพี้ยนไปตามตำแหน่งหลอด
//  (ก่อนหน้านี้เพลง/เอฟเฟกต์คูณ masterVolume ตรงๆ แต่วีดีโอกับลูปเสียงคูณ masterVolume² —
//   ที่หลอด 0.8 เพลงได้ 0.80 แต่วีดีโอได้ 0.51 และยิ่งหรี่หลอดยิ่งถ่างออกจากกัน)
//  เลขชี้กำลัง 1.6 อยู่กึ่งกลาง: หรี่แล้วรู้สึกเปลี่ยนจริง แต่ไม่ทำให้เพลงเบาลงมากเหมือนยกกำลังสอง
export function masterGain() { return Math.pow(masterVolume, 1.6); }

export function getMasterVolume() { return masterVolume; }
export function videoVolume(src) { return VIDEO_BASE * pathGain(src) * masterGain(); } // ให้ <video> ใช้ (ผ่าน curve เดียวกัน)
export function onVolumeChange(fn) { volListeners.add(fn); return () => volListeners.delete(fn); }
export function setMasterVolume(v) {
  masterVolume = Math.max(0, Math.min(1, v));
  try { localStorage.setItem("echo_vol", String(masterVolume)); } catch {}
  if (currentMusic) getMusic(currentMusic).volume = trackVolume(currentMusic);
  if (loopSfx) loopSfx.volume = loopVolume(loopSfx._echoName); // ลูปเสียงเฉพาะกิจต้องตามหลอดเสียงด้วย
  for (const [a, base] of activeSfx) a.volume = base * masterGain();
  volListeners.forEach((fn) => fn(masterVolume));
}

let currentMusic = null;
// seq ล่าสุด "ต่อเพลง" (ไม่ใช่ต่อการสลับเพลง): จำไว้แม้เพลงถูกพัก/สลับออก
// -> กลับมาเล่นเพลงเดิมด้วย seq เดิม (เช่น หลังจบ cutscene ของคนอื่น) = เล่นต่อจากจุดเดิม ไม่เริ่มใหม่
// -> seq ใหม่ (เปิดท่าครั้งใหม่ / คนอื่นเปิดท่าเพลงเดียวกันทับ) = เริ่มจากต้น
const musicSeq = {};
const musicCache = {};
function getMusic(name) {
  if (!musicCache[name]) {
    const sequence = MUSIC_SEQUENCES[name];
    const a = new Audio(sequence ? sequence[0] : FILES[name]);
    a.loop = !sequence;
    a._echoSequenceStage = 0;
    a.addEventListener("playing", () => {
      // A delayed play() must not revive a track after a cutscene or another song took over.
      if (currentMusic !== name || musicSuspensions.size) a.pause();
    });
    if (sequence) {
      a.addEventListener("ended", () => {
        if (currentMusic !== name || musicSuspensions.size) return;
        a._echoSequenceStage = 1;
        a.src = sequence[1];
        a.loop = true;
        a.currentTime = 0;
        a.volume = trackVolume(name); // ไฟล์ช่วงถัดไปดังไม่เท่าไฟล์แรก
        playCurrentMusic(name, a);
      });
    }
    musicCache[name] = a;
  }
  musicCache[name].volume = trackVolume(name);
  return musicCache[name];
}

function playCurrentMusic(name, a) {
  if (musicSuspensions.size || currentMusic !== name) return;
  applyHandoff(name, a);
  a.play().then(() => {
    if (musicSuspensions.size || currentMusic !== name) a.pause();
  }).catch(() => armUnlock());
}
// เบราว์เซอร์ที่ยังไม่ให้เล่นเสียงเอง (ไม่ใช่โปรแกรม ECHO) -> ลองเล่นเพลงปัจจุบันอีกครั้งเมื่อผู้เล่นแตะจอครั้งแรก
let unlockArmed = false;
function armUnlock() {
  if (unlockArmed || typeof document === "undefined") return;
  unlockArmed = true;
  const retry = () => {
    unlockArmed = false;
    document.removeEventListener("pointerdown", retry, true);
    document.removeEventListener("keydown", retry, true);
    if (currentMusic) playCurrentMusic(currentMusic, getMusic(currentMusic));
  };
  document.addEventListener("pointerdown", retry, true);
  document.addEventListener("keydown", retry, true);
}
// เพลงต่อจากหน้าแรกของโปรแกรม: launcher ส่ง #music=main5&mt=<วินาที> มากับ URL ของห้อง
//  -> เพลงเดียวกันเล่นต่อจากจุดเดิมแทนที่จะเริ่มใหม่ (ใช้ครั้งเดียว แล้วล้าง hash ทิ้ง)
//  &vol=<0..1> = ระดับเสียงที่ตั้งไว้ในหน้าแรก → หน้าเกมเริ่มที่ระดับเดียวกัน (localStorage แยกตาม origin ของห้อง)
let handoff = null;
try {
  const h = new URLSearchParams((typeof location !== "undefined" && location.hash || "").slice(1));
  const t = parseFloat(h.get("mt"));
  if (h.get("music") && Number.isFinite(t)) handoff = { name: h.get("music"), t };
  const vol = h.has("vol") ? parseFloat(h.get("vol")) : NaN;
  if (Number.isFinite(vol) && vol >= 0 && vol <= 1) setMasterVolume(vol);
  if (h.has("mt") || h.has("vol")) history.replaceState(null, "", location.pathname + location.search);
} catch { /* ไม่มี location (เทสต์) */ }
function applyHandoff(name, a) {
  if (!handoff || handoff.name !== name) return;
  const t = handoff.t; handoff = null;
  const seek = () => { try { a.currentTime = a.duration && isFinite(a.duration) ? t % a.duration : t; } catch { /* ยังไม่มี metadata */ } };
  if (a.readyState >= 1) seek(); else a.addEventListener("loadedmetadata", seek, { once: true });
}

// Foreground video/voice owns the audio until its component releases this lease.
export function suspendMusic() {
  const token = {};
  musicSuspensions.add(token);
  for (const a of Object.values(musicCache)) a.pause();
  return () => {
    if (!musicSuspensions.delete(token)) return;
    if (!musicSuspensions.size && currentMusic) playMusic(currentMusic);
  };
}

// seq: identity ของการเปิดเพลงสกิล — เปิดท่าใหม่/คนใหม่ทับเพลงเดิม = seq ใหม่ -> เริ่มจากต้น
// เพลงทั่วไป (main_home) ไม่ส่ง seq -> เล่นต่อจากจุดเดิม (เฉพาะในแมตช์)
export function playMusic(name, seq) {
  if (!FILES[name]) return;
  const a = getMusic(name);
  // สลับเพลงภายในกลุ่มเดียวกัน (กลางวัน <-> กลางคืนของหลักสูตรไบเลธ): จำตำแหน่งเพลงเดิมไว้เล่นต่อ
  const group = MUSIC_POSITION_GROUPS[name];
  let carryPos = null;
  if (group && currentMusic && currentMusic !== name && MUSIC_POSITION_GROUPS[currentMusic] === group) {
    const prev = getMusic(currentMusic);
    carryPos = prev.currentTime || 0;
  }
  // seq เดิมของเพลงนี้ (จำข้ามการพัก/สลับเพลง) — เปลี่ยนเมื่อไหร่ค่อยเริ่มเพลงใหม่จากต้น
  const isNewSeq = seq != null && seq !== musicSeq[name];
  if (isNewSeq) {
    musicSeq[name] = seq;
    const sequence = MUSIC_SEQUENCES[name];
    if (sequence && a._echoSequenceStage !== 0) {
      a.src = sequence[0];
      a.loop = false;
      a._echoSequenceStage = 0;
    }
    a.currentTime = 0; // การเปิดร่างครั้งใหม่ (กดใหม่/โดนคนอื่นทับ) -> เริ่มจากต้น
  }
  if (carryPos != null) {
    // เพลงใหม่อาจสั้นกว่าเพลงเดิม -> วนตำแหน่งด้วย modulo (ยังไม่รู้ความยาว = ใส่ตรงๆ แล้วปล่อยให้เบราว์เซอร์ clamp)
    const dur = a.duration;
    try { a.currentTime = dur && isFinite(dur) && dur > 0 ? carryPos % dur : carryPos; } catch { /* metadata ยังไม่มา */ }
  }
  const changed = currentMusic !== name;
  currentMusic = name;
  stopMusicExcept(name);
  if (changed || isNewSeq || a.paused) playCurrentMusic(name, a);
}
// หยุดทุกแทร็กยกเว้นตัวที่ระบุ — ตาข่ายกันเพลงซ้อน
//  playMusic พักเฉพาะแทร็กที่ currentMusic ชี้อยู่ ถ้าตัวแปรนั้นหลุดซิงก์เมื่อไหร่
//  (เช่นมีอะไรสั่งเล่นข้ามทาง หรือ effect ทำงานสลับกันหลายตัว) จะมีแทร็กเก่าค้างเล่นอยู่เงียบ ๆ
//  เรียกตัวนี้ก่อนเปลี่ยนเพลงจะการันตีว่าเหลือเสียงเดียวจริง ๆ
export function stopMusicExcept(keep) {
  for (const [name, a] of Object.entries(musicCache)) {
    if (name === keep) continue;
    if (!a.paused) a.pause();
  }
  if (currentMusic !== keep) currentMusic = musicCache[keep] ? keep : null;
}
export function stopMusic() {
  stopMusicExcept(null);
}
// เริ่มเกมใหม่ / จบแมตช์: รีเซ็ตตำแหน่งเพลงทุกเพลง -> ครั้งถัดไปเริ่มจากต้นทั้งหมด
export function resetMusicPositions() {
  stopLoopSfx();
  for (const [name, a] of Object.entries(musicCache)) {
    a.pause();
    const sequence = MUSIC_SEQUENCES[name];
    if (sequence) {
      a.src = sequence[0];
      a.loop = false;
      a._echoSequenceStage = 0;
    }
    a.currentTime = 0;
  }
  for (const k of Object.keys(musicSeq)) delete musicSeq[k];
  currentMusic = null;
}
// สร้าง <audio> ใหม่ทุกครั้งที่เล่น = ต้องต่อ resource + ถอดรหัสเสียงใหม่ทุกครั้ง
//  เสียงคลิกดังแทบทุกการกด จึงเห็นเป็นอาการกระตุกสะสม -> เก็บ element ที่เล่นจบแล้วไว้ใช้ซ้ำ
const sfxPool = new Map(); // ชื่อเสียง -> element ที่ว่างอยู่
const POOL_PER_SOUND = 4;  // เสียงเดียวกันซ้อนกันเกินนี้แทบไม่เกิด — ที่เกินปล่อยให้ GC เก็บ
let playSeq = 0;

function takeVoice(name) {
  const idle = sfxPool.get(name);
  if (idle && idle.length) {
    const a = idle.pop();
    a._echoIdle = false;
    try { a.currentTime = 0; } catch { /* ยังโหลดไม่เสร็จ: เล่นจากต้นอยู่แล้ว */ }
    return a;
  }
  const a = new Audio(FILES[name]);
  a.preload = "auto";
  const release = () => {
    activeSfx.delete(a);
    if (a._echoIdle) return; // ปล่อยคืนไปแล้ว (ended กับ pause ยิงต่อกันได้)
    a._echoIdle = true;
    const pool = sfxPool.get(name);
    if (!pool) sfxPool.set(name, [a]);
    else if (pool.length < POOL_PER_SOUND) pool.push(a);
  };
  a.addEventListener("ended", release);
  a.addEventListener("pause", release);
  a.addEventListener("error", release);
  return a;
}

// โหลดเสียงที่ใช้บ่อยไว้ล่วงหน้า — ครั้งแรกที่เล่นคือครั้งที่กระตุกที่สุด (ต่อเน็ต + ถอดรหัส)
export function prewarmSfx(names) {
  for (const name of names) {
    if (!FILES[name] || sfxPool.has(name)) continue;
    const a = takeVoice(name);
    a._echoIdle = true;
    sfxPool.set(name, [a]);
    try { a.load(); } catch { /* เบราว์เซอร์บางตัวห้ามโหลดก่อนมี gesture */ }
  }
}

// คืน element ที่เล่นอยู่ ให้ผู้เรียกหยุดเองได้ (เช่น เพลงประกอบคัตซีนที่ต้องหยุดตอนฉากจบ)
export function playSfx(name) {
  if (!FILES[name]) return null;
  const a = takeVoice(name);
  const base = name === "action_button" ? CLICK_BASE : SFX_BASE * soundGain(name);
  a.volume = base * masterGain();
  a._echoPlay = ++playSeq;
  activeSfx.set(a, base);
  a.play().then(() => { if (!activeSfx.has(a)) a.pause(); }).catch(() => {
    activeSfx.delete(a);
  });
  return a;
}
// playId: กันสั่งหยุด element ที่ถูกรีไซเคิลไปใช้กับเสียงอื่นแล้ว (ดู sfxPlayId)
export function stopSfx(a, playId) {
  if (!a) return;
  if (playId !== undefined && a._echoPlay !== playId) return;
  activeSfx.delete(a);
  a.pause();
}
export function sfxPlayId(a) { return a ? a._echoPlay : undefined; }
// เสียงคลิก (click.mp3) — กันเล่นซ้อน: ตัวดักทั้งหน้า (installClickSound) กับโค้ดที่เรียกเองในจังหวะเดียวกันจะดังครั้งเดียว
let lastClickAt = 0;
export function clickSound() {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (now - lastClickAt < 90) return;
  lastClickAt = now;
  playSfx("action_button");
}
// ทุกการกด (ปุ่ม/ลิงก์/สวิตช์/ป้ายบนลูกโลก) มีเสียงคลิกเสมอ — ปุ่มธีมใหม่ไม่ต้องเรียก clickSound เอง
//  การกดบนลูกโลก (canvas) ไม่ใช่ element พวกนี้ — หน้าจอต้องเรียก clickSound() เองตอนเลือกของบนโลก
//  ไม่อยากให้ดัง: ใส่ data-no-click-sound ที่ element หรือบรรพบุรุษ
const CLICKABLE = 'button, a[href], [role="button"], input[type="checkbox"], input[type="radio"], select, summary, label[for], .oc-tag, [data-click-sound]';
export function installClickSound(root = typeof document !== "undefined" ? document : null) {
  if (!root) return () => {};
  const onClick = (e) => {
    const el = e.target instanceof Element ? e.target.closest(CLICKABLE) : null;
    if (!el || el.disabled || el.getAttribute("aria-disabled") === "true" || el.closest("[data-no-click-sound]")) return;
    clickSound();
  };
  root.addEventListener("click", onClick, true);
  return () => root.removeEventListener("click", onClick, true);
}

// ---------- ลูปเสียงเฉพาะกิจ (ช่องอิสระ ไม่ยุ่งกับ BGM หลัก) ----------
//  ใช้กับเสียงที่ต้องเล่น "ตราบใดที่ UI ฝั่งเราเปิดอยู่" เท่านั้น — ไม่ได้ผูกกับ state ของ server
//  (เพลงคิดของคอนเนอร์: เล่นระหว่างกำลังเรียงลำดับในโมดัล แล้วหยุดทันทีที่ปิด)
//  ระหว่างเล่น เพลงหลักจะถูกหรี่ลงเหลือ DUCK_LEVEL แทนการหยุด — ดูคอมเมนต์ที่ musicDuck
const DUCK_LEVEL = 0.25;
// ลูปเสียงเฉพาะกิจ (เพลงคิดของคอนเนอร์) ทำหน้าที่แทนเพลงประกอบ -> ใช้ระดับเดียวกับเพลง
function loopVolume(name) { return MUSIC_BASE * soundGain(name) * masterGain(); }
export function startLoopSfx(name) {
  if (!FILES[name]) return null;
  stopLoopSfx();
  const a = new Audio(FILES[name]);
  a.loop = true;
  a._echoName = name;
  a.volume = loopVolume(name);
  loopSfx = a;
  musicDuck = DUCK_LEVEL;
  if (currentMusic) getMusic(currentMusic).volume = trackVolume(currentMusic);
  const release = () => { if (loopSfx === a) stopLoopSfx(); };
  a.addEventListener("error", release);
  a.play().then(() => { if (loopSfx !== a) a.pause(); }).catch(release);
  return a;
}
export function stopLoopSfx() {
  if (!loopSfx) return;
  try { loopSfx.pause(); loopSfx.currentTime = 0; } catch { /* element อาจถูกทิ้งไปแล้ว */ }
  loopSfx = null;
  musicDuck = 1;
  if (currentMusic) getMusic(currentMusic).volume = trackVolume(currentMusic);
}

// DoomGuy (patch 2.2 full): อาวุธ id (ตาม server) -> ชื่อไฟล์เสียงยิง/เสียงสกิลใน FILES ด้านบน
export const DOOM_WEAPON_SOUNDS = {
  shotgun: { shoot: "doomguy_cs_shoot", skill: "doomguy_cs_skill" },
  heavy: { shoot: "doomguy_hc_shoot", skill: "doomguy_hc_skill" },
  plasma: { shoot: "doomguy_pg_shoot", skill: null },
  chaingun: { shoot: "doomguy_cg_shoot", skill: "doomguy_cg_skill" },
  rocket: { shoot: "doomguy_rk_shoot", skill: "doomguy_rk_skill" },
  supershotgun: { shoot: "doomguy_ss_shoot", skill: "doomguy_ss_skill" },
  ballista: { shoot: "doomguy_bt_shoot", skill: "doomguy_bt_skill" },
  bfg: { shoot: "doomguy_bfg_shoot", skill: null },
};

function resumeCurrent() {
  if (currentMusic) {
    const a = getMusic(currentMusic);
    if (a.paused) playCurrentMusic(currentMusic, a);
  }
}
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", resumeCurrent);
  window.addEventListener("keydown", resumeCurrent);
}

// Start a foreground clip and restore sound on the next gesture if autoplay required muting.
// Cleanup prevents a rejected play promise from restarting a clip that has already unmounted.
export function playCutsceneVideo(video) {
  const releaseMusic = suspendMusic();
  let disposed = false;
  let awaitingGesture = false;
  const updateVolume = () => { video.volume = videoVolume(video.getAttribute("src")); };
  updateVolume();
  video.currentTime = 0;
  video.muted = false;
  const play = () => video.play().then(() => {
    if (disposed) video.pause();
  });
  const restoreSound = () => {
    if (disposed || !awaitingGesture) return;
    video.muted = false;
    awaitingGesture = false;
    play().catch(() => { if (!disposed) { video.muted = true; awaitingGesture = true; } });
  };
  if (typeof window !== "undefined") {
    window.addEventListener("pointerdown", restoreSound);
    window.addEventListener("keydown", restoreSound);
  }
  play().catch((error) => {
    if (disposed || error?.name !== "NotAllowedError") return;
    video.muted = true;
    awaitingGesture = true;
    play().catch(() => {});
  });
  const unsubscribe = onVolumeChange(updateVolume);
  return () => {
    disposed = true;
    video.pause();
    unsubscribe();
    if (typeof window !== "undefined") {
      window.removeEventListener("pointerdown", restoreSound);
      window.removeEventListener("keydown", restoreSound);
    }
    releaseMusic();
  };
}
