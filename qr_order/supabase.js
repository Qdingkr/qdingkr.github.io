// ============================================
// QdingOrder - Supabase 클라이언트 공통 설정
// ============================================

const SUPABASE_URL = 'https://knwaqyeznxvhkmvqigaf.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtud2FxeWV6bnh2aGttdnFpZ2FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NDUxODUsImV4cCI6MjA5NzMyMTE4NX0.7WZwkIXnMxzCDvAy8JCRUp5ybXwFDQJc7GHfHhfXF_M'

const { createClient } = window.supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
 
// ============================================
// Auth 유틸
// ============================================
 
// 현재 로그인 유저 반환 (없으면 null)
async function getUser() {
  const { data: { user } } = await sb.auth.getUser();
  return user;
}
 
// 로그인 필요 페이지에서 호출 — 미로그인 시 index.html로 이동
async function requireAuth() {
  const user = await getUser();
  if (!user) {
    location.href = '/index.html';
    return null;
  }
  return user;
}
 
// 이메일/패스워드 로그인
async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
 
// 로그아웃
async function signOut() {
  await sb.auth.signOut();
  location.href = '/index.html';
}
 
// ============================================
// qr_owers 유틸
// ============================================
 
// 오너 정보 조회
async function getOwner(ownerId) {
  const { data, error } = await sb
    .from('qr_owers')
    .select('*')
    .eq('id', ownerId)
    .single();
  if (error) throw error;
  return data;
}
 
// 영업 상태 토글
async function setIsOpen(ownerId, isOpen) {
  const { error } = await sb
    .from('qr_owers')
    .update({ is_open: isOpen })
    .eq('id', ownerId);
  if (error) throw error;
}
 
// ============================================
// qr_menus 유틸
// ============================================
 
// 메뉴 목록 조회 (sort_order 순)
async function getMenus(ownerId, onlyAvailable = false) {
  let query = sb
    .from('qr_menus')
    .select('*')
    .eq('owner_id', ownerId)
    .order('sort_order', { ascending: true });
 
  if (onlyAvailable) query = query.eq('is_available', true);
 
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
 
// 메뉴 추가
async function addMenu(ownerId, name, price) {
  const { data, error } = await sb
    .from('qr_menus')
    .insert({ owner_id: ownerId, name, price })
    .select()
    .single();
  if (error) throw error;
  return data;
}
 
// 메뉴 수정 (이름/가격)
async function updateMenu(menuId, fields) {
  const { error } = await sb
    .from('qr_menus')
    .update(fields)
    .eq('id', menuId);
  if (error) throw error;
}
 
// 품절 토글
async function toggleAvailable(menuId, isAvailable) {
  const { error } = await sb
    .from('qr_menus')
    .update({ is_available: isAvailable })
    .eq('id', menuId);
  if (error) throw error;
}
 
// 메뉴 삭제
async function deleteMenu(menuId) {
  const { error } = await sb
    .from('qr_menus')
    .delete()
    .eq('id', menuId);
  if (error) throw error;
}
 
// ============================================
// qr_orders 유틸
// ============================================
 
// 주문 등록 (손님)
// items: [{name, price, qty}, ...]
async function createOrder(ownerId, items) {
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.qty, 0);
 
  // 당일 order_number 계산 (해당 오너 기준 max+1)
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const { data: maxData } = await sb
    .from('qr_orders')
    .select('order_number')
    .eq('owner_id', ownerId)
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59`)
    .order('order_number', { ascending: false })
    .limit(1);
 
  const orderNumber = maxData && maxData.length > 0
    ? maxData[0].order_number + 1
    : 1;
 
  const { data, error } = await sb
    .from('qr_orders')
    .insert({
      owner_id: ownerId,
      items,
      total_price: totalPrice,
      order_number: orderNumber,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
 
// 단일 주문 조회 (손님 상태 화면)
async function getOrder(orderId) {
  const { data, error } = await sb
    .from('qr_orders')
    .select('*')
    .eq('id', orderId)
    .single();
  if (error) throw error;
  return data;
}
 
// 오늘 주문 목록 (오너 대시보드)
async function getTodayOrders(ownerId) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await sb
    .from('qr_orders')
    .select('*')
    .eq('owner_id', ownerId)
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
 
// 주문 상태 변경 (오너)
// status: 'confirmed' | 'ready' | 'done'
async function updateOrderStatus(orderId, status) {
  const { error } = await sb
    .from('qr_orders')
    .update({ status })
    .eq('id', orderId);
  if (error) throw error;
}
 
// 디스플레이용 — ready/submitted/confirmed 주문 조회
async function getActiveOrders(ownerId) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await sb
    .from('qr_orders')
    .select('order_number, status')
    .eq('owner_id', ownerId)
    .in('status', ['submitted', 'confirmed', 'ready'])
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59`)
    .order('order_number', { ascending: true });
  if (error) throw error;
  return data;
}
 
// ============================================
// 공통 유틸
// ============================================
 
// URL 파라미터 파싱
function getParam(key) {
  return new URLSearchParams(location.search).get(key);
}
 
// 금액 포맷 (1000 → 1,000원)
function formatPrice(price) {
  return price.toLocaleString('ko-KR') + '원';
}
 
// 진동 (ready 상태 알림)
function vibrate() {
  if (navigator.vibrate) {
    navigator.vibrate([500, 200, 500, 200, 500]);
  }
}
 
// beep 소리 (새 주문 알림 — 대시보드용)
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    // 소리 재생 실패 시 무시
  }
}
