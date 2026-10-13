# Hubline — Warehouse Management App

Dashboard operasional gudang dengan peta 3D interaktif (React + React Three Fiber), terinspirasi
tampilan "warehouse management app" yang sedang viral. Semua berjalan di browser — tidak perlu
server — sehingga bisa di-deploy langsung ke GitHub Pages.

**Live:** https://shockwave-thevillains.github.io/015.Vibe_Coding_05_Warehouse_Management_App/

## Fitur

- **Peta 3D yard** — gudang utama, cross-dock, cold store, kantor, pallet, pohon, jalan.
  Truk benar-benar masuk dari jalan, mundur ke bay, bongkar/muat, lalu pergi. Forklift berkeliling
  di yard, pulang ke charger saat baterai lemah. Lampu status di atas tiap pintu dock.
- **Dunia di sekitarnya** — kawasan industri tetangga, perumahan warga, kota dengan gedung tinggi,
  bandara (pesawat lepas landas & mendarat bergantian), danau, ladang, turbin angin, mobil lalu-lalang,
  dan pegunungan di cakrawala. Tombol ⛰ (Panorama view) memperlihatkan semuanya; halaman dibuka
  dengan gambar panorama lalu kamera turun ke depot.
- **Satpam gerbang** — tiap kali truk masuk/keluar, satpam barat memandu truk dengan tongkat
  lampu dan satpam timur turun ke jalan memegang tanda STOP; lampu pos jaga berkedip dan mobil di
  jalan raya berhenti & antre sampai manuver selesai.
- **Minimize / Maximize** — tombol ⤡ di kontrol peta (atau tombol **H**) menyembunyikan semua panel
  sementara supaya peta tampil penuh; klik *Show panels* atau tekan **H** lagi untuk mengembalikan.
- **Bisa diklik** — gedung/pin, pintu dock, truk, forklift → panel detail di kanan dan kamera
  terbang ke objek tersebut. Drag untuk memutar, scroll/pinch untuk zoom, tombol reset view.
- **Simulasi live** — jam berjalan (1×, 5×, 20×, atau pause). Pesanan keluar mengurangi stok,
  truk masuk menambah stok + antrean putaway, pengiriman bergerak Picked → Packed → Loading →
  In transit → Delivered, on-time delivery dihitung dari hasil nyata simulasi.
- **Aksi** — Reorder SKU (menjadwalkan truk restock), prioritaskan truk, tutup/buka bay untuk
  maintenance, kirim forklift ke charger. Notifikasi aktivitas di ikon lonceng.
- **3 lokasi** (Riverside Hub, Northgate DC, Harbor Point), pencarian global (tekan `/`).
- **Tersimpan otomatis** di `localStorage` browser; menu profil → *Reset demo data* untuk mulai ulang.
- **Responsif** — di HP panel ditumpuk di bawah peta. Tanpa WebGL, dashboard tetap jalan.

Semua data adalah data demo fiktif.

## Menjalankan

```sh
npm install
npm run dev       # http://localhost:5173
npm test          # unit test mesin simulasi (vitest)
npm run build     # output statis ke dist/
npm run preview   # cek hasil build
```

## Deploy ke GitHub Pages

Workflow `.github/workflows/deploy.yml` membangun dan men-deploy otomatis setiap push ke `main`.
Satu kali saja di repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Setelah itu jalankan ulang workflow (tab *Actions* → *Deploy to GitHub Pages* → *Run workflow*)
bila run pertama gagal karena Pages belum diaktifkan.

`vite.config.ts` memakai `base: './'`, jadi build tidak bergantung pada nama repo.

## Struktur

| Path | Isi |
| --- | --- |
| `src/sim/` | Mesin simulasi murni (tanpa React): tipe, seed data, `step()`, aksi, store zustand |
| `src/scene/` | Scene three.js: gedung, truk + jalur, forklift, pallet, kamera, label; `World.tsx` = lingkungan sekitar (kota, bandara, perumahan, gunung) |
| `src/ui/` | Panel dashboard: top bar, KPI, detail, shipment tracking, tab docks/forklifts/trucks |

Ganti nama brand cukup di `src/ui/TopBar.tsx` (teks) dan `src/scene/textures.ts` (logo di dinding/truk).
