# Asset CDN (Cloudflare R2) — runbook

## Kiến trúc

- `src/presentation/assets/AssetBaseUrl.ts` — `resolveAssetUrl()` đọc env `VITE_ASSET_BASE_URL` lúc build. Rỗng (default) → giữ nguyên đường dẫn cũ (`/assets/...` trên cùng origin). Có giá trị → prefix vào mọi URL asset phía runtime: Phaser loader (`AssetLoaderScene`, `CombatScene`, `TranPhapCombatPreviewScene`, `CombatPreload`, `TribulationPreload`, `InkWashUiPhaser`), DOM image/audio (`AssetBundleManager`), và các `<img>`/table URL trong Vue (`inkWashUi`, `Tooltip`, `InkWashBackdrop`, `PlayerPortrait`, `CharacterPanel`).
- R2 bucket mirror y hệt layout `public/assets/` — không có bảng mapping.
- Electron build: KHÔNG bật env này — assets đi kèm installer (file://), không động vào CDN.
- `<style>` `url('/assets/...')` literals (SlotView v.v. — chỉ ~15MB trong `ui/`) chưa qua resolver: giữ file đó trong `public/` khi migrate; heavy dirs mới là phần upload.

## Quy trình

```bash
cd game
node scripts/assets/optimize.mjs              # public/assets -> cdn-assets/ (palette-quantized PNG, giữ tên)
R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
  node scripts/assets/upload-r2.mjs           # PUT chỉ file đổi (ETag/md5 compare)
# Vercel: set VITE_ASSET_BASE_URL=https://<pub>.r2.dev (Production + Preview)
```

## Setup một lần (Minh)

1. Cloudflare → R2 → Create bucket `tutienidle-assets` → Settings → Public access → Allow (lấy `pub-xxx.r2.dev` URL; custom domain tuỳ chọn).
2. R2 → Manage API Tokens → Create token (Object Read & Write, bucket scope) → gửi Access Key + Secret + Account ID cho Devin.
3. Vercel project → Settings → Environment Variables → `VITE_ASSET_BASE_URL` = `https://<pub-xxx>.r2.dev` → redeploy.

## Giới hạn đã biết

- `upload-r2.mjs` là client SigV4 tự viết — CHƯA verify được tới khi có credentials thật (hàng hoá trước, chữ ký sau).
- Optimize chạy lại bao nhiêu lần cũng được: cùng input → cùng output; upload chỉ PUT file đổi md5.
- Rollback: xoá `VITE_ASSET_BASE_URL` → redeploy → game quay về serve từ Vercel ngay.
- Nếu sau này xoá `public/` heavy dirs khỏi repo: nhớ giữ `ui/` (CSS literals) + bất kỳ file nào Electron vẫn cần, hoặc hoàn tất CSS sweep trước.
