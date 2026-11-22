// Vice Sunset — config: satu tempat untuk semua konstanta gameplay.
// Kota fiktif "Solmar Bay": semua nama, tempat, dan cerita di game ini orisinal.
export const CFG = {
  // Kota: grid jalan. PITCH = jarak antar sumbu jalan, ROAD = lebar jalan.
  PITCH: 58,
  ROAD: 14,
  GRID: 3, // jalan di x/z = -3..3  -> kota selebar ~7*58 = 406 m
  BLOCK: 44,
  // Player
  WALK_SPEED: 6.5,
  SPRINT_SPEED: 11,
  PLAYER_HEALTH: 100,
  // Mobil
  CAR_ACCEL: 22,
  CAR_BRAKE: 34,
  CAR_MAX_SPEED: 34,
  CAR_REVERSE_MAX: 10,
  CAR_TURN: 1.9,
  // Wanted
  WANTED_DECAY_SECONDS: 25,
  MAX_WANTED: 5,
  // Misi
  MISSION_REWARDS: [250, 450, 800],
  // Dunia
  DAY_SEED: 1,
  SAVE_KEY: 'vice-sunset-save-v1',
  // Warna sunset
  SKY_TOP: 0x2b1a4e,
  SKY_HORIZON: 0xff7a3c,
  FOG_COLOR: 0xe86a4a,
  SUN_COLOR: 0xffb36b,
};

export const CAR_COLORS = [
  0xc0392b, 0x2980b9, 0xf1c40f, 0x27ae60, 0x8e44ad,
  0xecf0f1, 0x2c3e50, 0xe67e22, 0x16a085, 0xd35400,
];

export const MISSION_DEFS = [
  {
    id: 1,
    title: 'Misi 1 — Paket Kilat',
    intro: 'Rico: "Yo, Kai! Paket ini harus sampai ke dermaga sebelum gelap. Jangan ditanya isinya."',
    steps: [
      { type: 'goto', label: 'Ambil paket di gang Merak', at: 'pickup' },
      { type: 'goto', label: 'Antar paket ke Dermaga Selatan', at: 'dropoff' },
    ],
    outro: 'Rico: "Bagus. Klien senang, kau dibayar. Ada kerjaan lain kalau berani."',
  },
  {
    id: 2,
    title: 'Misi 2 — Kejar Target',
    intro: 'Rico: "Si Botak kabur bawa uang kita. Kejar mobilnya, hentikan dia. Jangan sampai lolos."',
    steps: [
      { type: 'chase', label: 'Kejar dan hentikan mobil target', at: 'target' },
    ],
    outro: 'Rico: "Uang kembali. Kau makin dipercaya di Solmar Bay."',
  },
  {
    id: 3,
    title: 'Misi 3 — Kabur dari Polisi',
    intro: 'Rico: "Polisi mengepungmu! Kabur ke tempat persembunyian di ujung utara. Jangan ketangkap!"',
    steps: [
      { type: 'escape', label: 'Kabur ke tempat persembunyian (tahan 3 bintang)', at: 'hideout' },
    ],
    outro: 'Rico: "Kau lolos. Solmar Bay milikmu malam ini."',
  },
];
