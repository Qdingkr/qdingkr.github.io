/* QdingOrder — 공통 Supabase 클라이언트 & 헬퍼
   supabase-js UMD를 먼저 로드한 뒤 이 파일을 불러오세요. */

const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

const Q = {
  configured() {
    return !SUPABASE_URL.startsWith('YOUR_') && !SUPABASE_ANON_KEY.startsWith('YOUR_');
  },

  param(name) {
    return new URLSearchParams(location.search).get(name);
  },

  won(n) {
    return (Number(n) || 0).toLocaleString('ko-KR') + '원';
  },

  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  /* 기기 로컬 기준 오늘 0시 (오너 단말은 KST 전제) */
  todayISO() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  },

  time(iso) {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  },

  /* 화면이 보일 때만 도는 폴링. 백그라운드에서 요청 낭비 안 함 */
  poll(fn, ms) {
    let timer = null, stopped = false;
    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState === 'visible') {
        try { await fn(); } catch (e) { console.error(e); }
      }
      timer = setTimeout(tick, ms);
    };
    tick();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !stopped) { clearTimeout(timer); tick(); }
    });
    return () => { stopped = true; clearTimeout(timer); };
  },

  /* --- 알림음: 첫 터치에서 잠금 해제해야 모바일에서 울립니다 --- */
  _ctx: null,
  unlockAudio() {
    try {
      if (!this._ctx) this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this._ctx.state === 'suspended') this._ctx.resume();
      return this._ctx.state === 'running';
    } catch (e) { return false; }
  },
  audioReady() { return !!this._ctx && this._ctx.state === 'running'; },
  beep(count = 2) {
    if (!this.audioReady()) return false;
    const ctx = this._ctx;
    for (let i = 0; i < count; i++) {
      const t0 = ctx.currentTime + i * 0.28;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.24);
    }
    return true;
  },

  toast(msg, kind) {
    let el = document.getElementById('q-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'q-toast';
      document.body.appendChild(el);
    }
    el.className = 'q-toast' + (kind === 'bad' ? ' bad' : '');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._tt);
    this._tt = setTimeout(() => el.classList.remove('show'), 2600);
  },

  /* 로그인 필수 화면에서 사용 */
  async requireOwner() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { location.replace('index.html'); return null; }
    return session.user;
  },

  /* qr_owers 행이 없으면 만들어 줌 (id = auth.uid()) — 테이블명 오타는 원본 그대로 */
  async ensureOwerRow(user) {
    const { data, error } = await sb.from('qr_owers').select('*').eq('id', user.id).maybeSingle();
    if (error) throw error;
    if (data) return data;
    const { data: created, error: e2 } = await sb.from('qr_owers')
      .insert({ id: user.id, store_name: '내 가게', is_open: false })
      .select().single();
    if (e2) throw e2;
    return created;
  }
};

if (!Q.configured()) {
  document.addEventListener('DOMContentLoaded', () => {
    const bar = document.createElement('div');
    bar.className = 'q-config-warn';
    bar.textContent = 'supabase.js에 URL과 anon key를 넣어야 동작합니다';
    document.body.prepend(bar);
  });
}
