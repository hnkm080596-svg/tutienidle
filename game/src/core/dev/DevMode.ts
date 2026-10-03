// Co test tam thoi (2026-08-20) - bat de bo qua MOI gate Building/canh
// gioi, cho phep thu toan bo he thong trong game ma khong can grind that.
//
// 2026-08-26 - doi sang OVERRIDE qua localStorage thay vi hang so compile-
// time: nguoi choi/lead can BAT TAT nhanh khi test chuc nang building
// (xay mien phi moi cong trinh) ma khong phai build lai. Cach bat:
//   localStorage.setItem('dev.testModeUnlockAll', '1')  -> reload trang
// Tat: removeItem('dev.testModeUnlockAll') hoac set gia tri khac '1'.
// Mac dinh FALSE cho ban chay thuc te.
//
// 2026-08-28 (review 2026-08-28 bug #11) - co nay CHI con hieu luc trong
// dev build: production build ma doc duoc flag tu localStorage se bypass
// realm gate + chi phi vat lieu, xay moi cong trinh mien phi.
//
// B1.9a (beta-final PR3) - dev tools are explicit MOCK-only: under
// VITE_BACKEND_MODE=supabase a free build/write would land in the
// remote-committed save and poison the authoritative row. Reads the env
// directly (core must not import the service composition root); the
// resolver's development default is mock, so an unset value still
// enables the flag in dev.

export function isTestModeUnlockAll(): boolean {
  if (!import.meta.env.DEV) {
    return false
  }

  if (import.meta.env.VITE_BACKEND_MODE === 'supabase') {
    return false
  }

  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem('dev.testModeUnlockAll') === '1'
  } catch {
    return false
  }
}
