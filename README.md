# 🤖 CPAgents

**CPAgents** adalah web app AI agent otonom yang bisa memecah sebuah goal menjadi task-task, mengeksekusinya secara nyata (bikin file, jalanin command) lewat [OpenCode](https://opencode.ai), mengevaluasi hasilnya, mengulang (looping) sampai selesai, lalu **men-deploy hasilnya sendiri** ke Vercel/Netlify.

Semua berjalan lewat gateway yang OpenAI-compatible, jadi kamu bisa pakai model apa pun (Claude, GPT, Grok, dll) via satu baseURL.

---

## ✨ Fitur

- **🧠 Planner → Executor → Reviewer loop** — goal dipecah jadi 3-5 task, dieksekusi satu per satu, lalu direview otomatis untuk menambah task lanjutan sampai tuntas.
- **⚙️ Eksekusi nyata via OpenCode** — bukan sekadar teks; agent benar-benar membuat & mengubah file dan menjalankan command di workspace terisolasi per project.
- **📡 Log real-time** — output OpenCode di-stream langsung ke UI (via SSE + PTY), jadi kamu lihat progres tanpa nunggu diam.
- **📂 File browser** — jelajahi & lihat isi file setiap project langsung dari UI, seperti explorer.
- **🚀 Self-deploy** — publish project ke **Vercel** / **Netlify** otomatis atau lewat satu tombol, lengkap dengan input nama web custom (`nama-web.vercel.app`).
- **🗂️ Manajemen project** — daftar project, pindah workspace, lanjutkan task/looping, dengan progress bar & status badge (Berjalan / Selesai / Ada yang gagal).
- **❌ Status task jujur** — kalau eksekusi gagal (exit code ≠ 0), ditandai **FAILED** dengan tombol mulai ulang, bukan fake "sukses".
- **💾 Settings persisten** — baseURL, API key (tersensor di UI), model, dan token deploy tersimpan di DB; otomatis ter-load tiap buka web.
- **🔁 Anti rate-limit** — auto-retry dengan backoff saat gateway kena 429/5xx.
- **🎯 Token budget 150k** — prompt dibangun bertahap dengan estimasi token supaya tidak langsung membengkak.

---

## 🏗️ Arsitektur

```mermaid
flowchart LR
    U[User: goal] --> P[Planner /api/agent]
    P --> T[(Tasks di DB)]
    T --> E[Executor /api/agent/execute]
    E --> OC[OpenCode CLI di workspace]
    OC --> E
    E --> R[Reviewer /api/agent/review]
    R -->|task lanjutan| T
    E --> D[Deploy /api/agent/deploy]
    D --> V[Vercel / Netlify]
```

- **Planner** memecah goal menjadi task.
- **Executor** menjalankan OpenCode untuk tiap task di `workspaces/<sessionId>`.
- **Reviewer** mengevaluasi hasil dan menambah task recovery/lanjutan.
- **Deploy** mem-publish project ke Vercel/Netlify (token di-inject sebagai env var, tidak pernah ter-print).

---

## 🛠️ Tech Stack

- **Next.js 14** (App Router, JavaScript)
- **Prisma 7** + **SQLite** (`@prisma/adapter-better-sqlite3`)
- **OpenCode CLI** untuk eksekusi agent
- **Server-Sent Events (SSE)** untuk streaming log
- Gateway **OpenAI-compatible** (model apa pun via baseURL)

---

## 🚀 Menjalankan Secara Lokal

### 1. Prasyarat
- Node.js 18+
- [OpenCode CLI](https://opencode.ai) terinstall (`opencode` ada di PATH, atau set `OPENCODE_BIN`)
- Gateway/endpoint OpenAI-compatible + API key

### 2. Install & setup

```bash
git clone https://github.com/yusuffadllh/CPAgents.git
cd CPAgents
npm install
```

Buat file `.env`:

```env
DATABASE_URL="file:./dev.db"
# Opsional: path ke binary opencode kalau tidak di PATH
OPENCODE_BIN=/path/to/opencode
```

Siapkan database:

```bash
npx prisma db push
```

### 3. Jalankan

```bash
npm run dev
```

Buka [http://localhost:3005](http://localhost:3005).

### 4. Konfigurasi
Klik **Settings** dan isi:
- **Base URL** — endpoint gateway OpenAI-compatible (mis. `http://host:port/v1`)
- **API Key**
- **Model** — mis. `provider/model-name`
- **(Opsional) Vercel / Netlify Token** — untuk fitur self-deploy

Semua tersimpan otomatis, tidak perlu diisi ulang tiap buka web.

---

## 🚀 Self-Deploy

CPAgents bisa mem-publish project yang dibuatnya sendiri:

1. Isi **Vercel Token** (dari [vercel.com/account/tokens](https://vercel.com/account/tokens)) atau **Netlify Token** di Settings.
2. Pilih sebuah project, (opsional) ketik **nama web** di kolom deploy.
3. Klik **🚀 Deploy** — atau tulis goal yang mengandung kata "deploy/online/publish" agar planner menambah task deploy otomatis.
4. URL live (`https://nama-web.vercel.app`) muncul di log setelah selesai.

Token di-inject sebagai environment variable, jadi model tidak pernah melihat atau mencetak nilainya.

---

## 📦 Deploy CPAgents ke Server (PM2)

```bash
pkill -9 -f "opencode run"
cd ~/CPAgents
git pull
npx prisma db push        # jika ada perubahan schema
npm run build
pm2 restart ai-chat --update-env   # ganti "ai-chat" dengan nama PM2 app-mu
pm2 logs ai-chat
```

---

## 📁 Struktur Singkat

```
app/
  api/agent/            # planner, executor, review, deploy, files, retry
  api/chat|settings|export
  components/           # Sidebar, SettingsModal, FileBrowser
  page.js               # UI utama agent
lib/
  opencode.js           # spawn OpenCode (PTY, env, config)
  context.js            # token budget, goal cleaner, retry gateway
  prisma.js
prisma/schema.prisma
workspaces/<sessionId>/ # folder kerja tiap project (dibuat saat runtime)
```

---

## 📝 Catatan

- Setiap project punya **workspace terisolasi** di `workspaces/<sessionId>`.
- Menghapus history di UI hanya menghapus record di DB — **file project di disk tetap aman**.
- Deploy yang sudah live tidak terpengaruh saat history dihapus.
