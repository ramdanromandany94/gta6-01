[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/ramdanromandany94/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![reward](https://make.fun/badge/gta6-01/ramdanromandany94/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# VICE SUNSET — Solmar Bay

Game open-world crime 3D orisinal untuk bounty **Make GTA 6** di make.fun.
Kau **Kai**, pendatang baru di kota pantai fiktif **Solmar Bay**. Rico punya
kerjaan untukmu: antar paket, kejar target yang kabur bawa uang, lalu kabur
dari polisi. Jelajahi kota saat sunset, curi mobil, naikkan wanted level —
atau main aman dan selesaikan semua misi.

Semua kota, karakter, kendaraan, nama, cerita, art, dan suara dibuat sendiri
dari nol. Bukan GTA, bukan Rockstar, bukan aset game komersial lain.

## Cara menjalankan

```sh
node serve.ts
# buka http://localhost:8080 di desktop Chrome
```

Tanpa build step, tanpa network request — semua file lokal di `game/`
(three.js di-vendor di `game/vendor/three.module.min.js`).

## Fitur

- **Kota 3D prosedural**: jalan grid, gedung dengan jendela bercahaya,
  trotoar, lampu jalan, pepohonan, dermaga, dan langit sunset.
- **Jalan kaki third-person** (WASD + mouse) **dan mengemudi** — masuk/keluar
  mobil dengan `E`, curi mobil traffic (naikkan wanted!).
- **Traffic AI** (mobil lalu-lalang, belok di persimpangan) + pejalan kaki.
- **Wanted level 1–5**: mobil polisi mengejar dan menabrak saat bintang naik.
- **3 misi cerita berurutan** dengan dialog Rico, marker tujuan, dan hadiah
  uang ($250 / $450 / $800). Progres tersimpan.
- **Combat**: pukul (`F`) + pistol (klik mouse, `R` isi peluru, `1`/`2`
  ganti senjata).
- **HUD**: health, uang, bintang wanted, teks objektif, kecepatan, dan
  **minimap** (player, mobil, polisi, marker misi).
- **Start screen, pause, save** ke localStorage (uang + misi selesai).
- **Suara prosedural WebAudio**: mesin, sirene, tembakan, pukulan — tanpa
  file audio eksternal.
- **Efek**: jejak ban saat drift, muzzle flash, partikel ledakan/debu,
  kamera chase yang halus.

## Kontrol

| Tombol | Aksi |
| --- | --- |
| WASD / panah | Jalan / menyetir |
| Mouse | Kamera (klik untuk pointer lock) |
| Shift | Lari |
| E | Masuk / keluar mobil |
| Klik kiri | Tembak (pistol) |
| F | Pukul |
| R | Isi peluru |
| 1 / 2 | Tangan kosong / pistol |
| Spasi | Rem tangan |
| M | Mulai misi berikutnya |
| P / Esc | Jeda |

## Struktur kode

```
game/
  index.html            # import map three.js + HUD + layar start/pause/wasted
  vendor/three.module.min.js
  src/
    config.js           # konstanta + definisi misi
    rng.js              # RNG deterministik (seed)
    input.js            # keyboard + mouse / pointer lock
    audio.js            # suara prosedural WebAudio
    city.js             # kota prosedural + langit sunset + tabrakan
    character.js        # model orang + kontrol player jalan kaki
    vehicles.js         # model mobil + fisika mengemudi arcade
    traffic.js          # mobil traffic AI + pejalan kaki
    police.js           # wanted level + mobil polisi pengejar
    missions.js         # 3 misi cerita + marker tujuan
    effects.js          # partikel, muzzle flash, jejak ban
    hud.js              # HUD + minimap canvas
    main.js             # orkestrator: loop, kamera, combat, save/load
```

## Mode screenshot

`?shot=cover|foot|chase|mission&seed=1` membuka game langsung di state
tertentu (tanpa start screen) untuk tangkapan layar deterministik.

---
Dibangun oleh agen AI untuk make.fun — main dan hasilkan uang di make.fun:
https://make.fun/r/hxd0fhbx
