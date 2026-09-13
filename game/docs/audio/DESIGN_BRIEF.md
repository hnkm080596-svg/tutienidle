# Audio Design Brief — TutienIdle

> Phong cách cốt lõi: **Tân Quốc phong nhẹ nhàng** (nhẹ, sâu lắng, hiện đại pha truyền thống).
> Game idle tu tiên — thiên về thư giãn + treo máy. Âm thanh phải **tinh tế, không gây mệt mỏi/ồn ào**.

---

## 1. Tinh thần thiết kế (không phá)

| Nguyên tắc | Áp dụng |
|---|---|
| Nhạc nền: đàn cổ (cầm/tranh), sáo trúc, tiêu + âm thanh tự nhiên (gió, suối, chim) | Không gian huyền ảo, thanh tịnh |
| Tương tác: mềm mại, **độ vang nhẹ**, cảm giác "chạm vào tiên khí" | UI click, toast, equip — KHÔNG chói |
| Hiệu ứng đặc biệt: có **lực** nhưng giữ chất cổ điển | Trống nhẹ, chuông gió, sấm xa — tạo trang trọng |
| **Luôn cho chỉnh volume riêng** music/SFX/voice | Settings panel — BẮT BUỘC |
| **Ngắn, mềm** — không sắc, không dài | Click nhiều không gây khó chịu |

---

## 2. Bảng âm thanh theo tình huống

| Tình huống | Âm thanh | Synth engine Tone.js |
|---|---|---|
| Treo máy / tu luyện | Đàn cổ du dương + gió thoảng + suối chảy — loop êm | Tone.AMSynth + slow LFO + reverb dài, HOẶC sample file đàn cổ (sau này) |
| Chiến đấu / đột phá | Trống lực + âm thanh năng lượng dồn nén + chuông báo hiệu | MembraneSynth (trống) + MetalSynth (chuông) + noise burst dồn nén |
| Tương tác (bấm nút, nhặt vật phẩm, thăng cấp) | Chuông ngọc, pha lê chạm, đàn ngân ngắn | MetalSynth (pha lê) + FMSynth harmonicity cao (chuông ngọc) + reverb ngắn |
| Sự kiện đặc biệt (kỳ ngộ, thiên kiếp) | Không gian vang vọng, trời đất rung chuyển nhưng huyền bí | NoiseSynth dồn nén + MetalSynth low + reverb dài 4-6s + filter sweep |

---

## 3. Implementation mapping (Đợt 1)

| SoundId | Engine | Note | Tinh thần | Test lúc nào |
|---|---|---|---|---|
| uiClick | MetalSynth | A3 (220Hz) | Chuông ngọc — chạm tiên khí | ✅ Đã implement Bước 1 |
| uiConfirm | MetalSynth | C4 (261Hz) pitch up so với click | Confirm — "lên" | Bước 1 |
| uiCancel | MetalSynth | E3 (164Hz) pitch down | Cancel — "xuống" | Bước 1 |
| toastLoot | FMSynth harmonicity=4 | E5 | Chuông ngọc — phần thưởng | Bước 2 |
| toastCraft | FMSynth harmonicity=3 | C5 | Pha lê chạm | Bước 2 |
| toastUpgrade | FMSynth harmonicity=5 | G5 | Đàn ngân lên | Bước 2 |
| toastError | NoiseSynth | — | Tiếng "tạch" gỗ nhẹ (không harsh) | Bước 2 |
| toastWarning | FMSynth harmonicity=2.5 | A3 | Chuông gió cảnh báo | Bước 2 |
| toastSave | FMSynth harmonicity=3 | C4 | Pha lê "lưu" | Bước 2 |
| combatAttack | NoiseSynth | — | Whoosh kiếm/pháp | Bước 3 |
| combatHit | MetalSynth | G3 | Va chạm kim loại — "chanh" nhẹ | Bước 3 |
| combatCritical | MetalSynth | C3 + lowpass thấp | Trống + chuông — **có lực nhưng không harsh** | Bước 3 |
| combatDodge | FMSynth harmonicity=6 | G6 | Gió vio vio | Bước 3 |
| combatBlock | MetalSynth | D3 | Kim loại chạm — "keng" | Bước 3 |
| combatKill | MetalSynth | A2 + reverb dài | Chuông trầm — kết thúc | Bước 3 |
| battleStart | FMSynth harmonicity=2 | A3 | Chuông báo — huyền ảo | Bước 4 |
| battleVictory | FMSynth harmonicity=3 | C4 | Đàn ngân chiến thắng | Bước 4 |
| battleDefeat | MetalSynth | A2 | Chuông trầm — kết thúc | Bước 4 |

---

## 4. Đợt 2 (polish — sau khi đợt 1 ổn)

| Tính năng | Triển khai |
|---|---|
| Ambient music loop theo scene (Dongfu home / Combat / Tribulation) | Tone.Transport + Sequence — đàn cổ procedural |
| Volume slider riêng music/SFX | useAudioStore + SettingsPanel UI scale pattern |
| On/Off toggle | Lưu localStorage |

---

## 5. Đợt 3 (cuối cùng — khi có file audio thật)

| Tính năng | Triển khai |
|---|---|
| File nhạc nền tu-tiên thật (cầm, sáo, suối) | Howler.js load file `.mp3` / `.ogg` |
| Sample đàn cổ cho combat fanfare | Howler.js sprite sheet |

---

## 6. Tiêu chí "đã đạt" cho mỗi sound

- ✅ Nghe thấy rõ nhưng không chói (peak gain ≤ 0.5, duration ≤ 300ms cho UI)
- ✅ Có reverb nhẹ tạo cảm giác "tiên khí"
- ✅ Mỗi lần click 20 lần liên tiếp không mệt
- ✅ Phù hợp với tình huống (toast khác combat khác)
- ✅ Bạn nghe và xác nhận: "OK, đúng phong cách"