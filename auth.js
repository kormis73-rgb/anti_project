/**
 * S2T 인증 및 세션 관리 매니저 (auth.js)
 * 
 * [세션 충돌 방지 아키텍처]
 * - sessionStorage 기반으로 탭별 세션 격리 지원 (동일 브라우저에서 관리자/농가 동시 실행 가능)
 * - 권한별 독립 네임스페이스 키: 's2t_admin_session', 's2t_user_session'
 * - 각 페이지 진입 시 requireRole() 가드를 통해 비인가 접근 자동 차단
 */

const AUTH_KEYS = {
  ADMIN_SESSION: "s2t_admin_session",
  USER_SESSION: "s2t_user_session",
  ACTIVE_ROLE: "s2t_active_role",
  REMEMBER_ACCOUNT: "s2t_remembered_account"
};

// 기본 사전 정의 계정 (오프라인 및 즉시 체험용)
const DEFAULT_ACCOUNTS = {
  admin: [
    {
      id: "admin",
      password: "admin", // 또는 admin1234
      role: "admin",
      name: "총괄 관리자",
      department: "S2T 생산관리팀"
    }
  ],
  user: [
    {
      id: "farm1",
      password: "1234",
      role: "user",
      farmId: "FARM-001",
      name: "김성주",
      farmName: "김성주 (성주일등농원)",
      cropType: "하미과멜론"
    },
    {
      id: "farm2",
      password: "1234",
      role: "user",
      farmId: "FARM-002",
      name: "박부여",
      farmName: "박부여 (백제수박작목반)",
      cropType: "수박 고상재배"
    },
    {
      id: "farm3",
      password: "1234",
      role: "user",
      farmId: "FARM-003",
      name: "이영동",
      farmName: "이영동 (황금과채농장)",
      cropType: "하미과멜론"
    }
  ]
};

class S2TAuthManager {
  constructor() {
    this.sessionStorage = window.sessionStorage;
  }

  /**
   * 로그인 처리
   * @param {string} username 
   * @param {string} password 
   * @param {'admin'|'user'} role 
   */
  async login(username, password, role = "admin") {
    const cleanUser = (username || "").trim();
    const cleanPw = (password || "").trim();

    if (!cleanUser || !cleanPw) {
      return { success: false, message: "아이디와 비밀번호를 모두 입력해 주세요." };
    }

    // 1. 관리자 로그인 검증
    if (role === "admin") {
      const isAdmin = (cleanUser === "admin" && (cleanPw === "admin" || cleanPw === "admin1234" || cleanPw === "1234"));
      if (isAdmin) {
        const sessionData = {
          token: "SESS_ADMIN_" + Math.random().toString(36).substring(2, 10).toUpperCase(),
          role: "admin",
          userId: cleanUser,
          userName: "총괄 관리자",
          farmId: null,
          loginAt: new Date().toISOString()
        };
        this.sessionStorage.setItem(AUTH_KEYS.ADMIN_SESSION, JSON.stringify(sessionData));
        this.sessionStorage.setItem(AUTH_KEYS.ACTIVE_ROLE, "admin");
        return { success: true, role: "admin", session: sessionData };
      }
      return { success: false, message: "관리자 아이디 또는 비밀번호가 올바르지 않습니다." };
    }

    // 2. 농가 회원 로그인 검증
    if (role === "user") {
      // 기본 데모 계정에서 검색
      let matched = DEFAULT_ACCOUNTS.user.find(acc => acc.id === cleanUser && acc.password === cleanPw);

      // 등록된 농가 목록에서도 매칭 검사 (농가코드 또는 전화번호 뒷자리 등)
      if (!matched) {
        try {
          const farms = JSON.parse(localStorage.getItem("s2t_farms_data") || "[]");
          const farm = farms.find(f => f.id.toLowerCase() === cleanUser.toLowerCase() || (f.phone && f.phone.replace(/[^0-9]/g, "").endsWith(cleanUser)));
          if (farm && (cleanPw === "1234" || cleanPw === "farm1234")) {
            matched = {
              id: farm.id,
              role: "user",
              farmId: farm.id,
              name: farm.farm_name.split(" ")[0],
              farmName: farm.farm_name,
              cropType: farm.crop_type
            };
          }
        } catch (e) {
          console.warn("농가 목록 조회 오류:", e);
        }
      }

      if (matched) {
        const sessionData = {
          token: "SESS_USER_" + Math.random().toString(36).substring(2, 10).toUpperCase(),
          role: "user",
          userId: matched.id,
          userName: matched.name,
          farmId: matched.farmId,
          farmName: matched.farmName,
          cropType: matched.cropType,
          loginAt: new Date().toISOString()
        };
        this.sessionStorage.setItem(AUTH_KEYS.USER_SESSION, JSON.stringify(sessionData));
        this.sessionStorage.setItem(AUTH_KEYS.ACTIVE_ROLE, "user");
        return { success: true, role: "user", session: sessionData };
      }
      return { success: false, message: "농가 회원 정보가 일치하지 않습니다. (데모 ID: farm1, farm2 / PW: 1234)" };
    }

    return { success: false, message: "유효하지 않은 권한 요청입니다." };
  }

  /**
   * 세션 조회
   * @param {'admin'|'user'} role 
   */
  getSession(role) {
    const key = role === "admin" ? AUTH_KEYS.ADMIN_SESSION : AUTH_KEYS.USER_SESSION;
    const data = this.sessionStorage.getItem(key);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }

  /**
   * 활성 세션 가져오기
   */
  getActiveSession() {
    const activeRole = this.sessionStorage.getItem(AUTH_KEYS.ACTIVE_ROLE);
    if (activeRole === "admin") return this.getSession("admin");
    if (activeRole === "user") return this.getSession("user");
    return this.getSession("admin") || this.getSession("user") || null;
  }

  /**
   * 로그아웃 처리
   * @param {'admin'|'user'} [role]
   */
  logout(role) {
    if (role === "admin") {
      this.sessionStorage.removeItem(AUTH_KEYS.ADMIN_SESSION);
    } else if (role === "user") {
      this.sessionStorage.removeItem(AUTH_KEYS.USER_SESSION);
    } else {
      this.sessionStorage.removeItem(AUTH_KEYS.ADMIN_SESSION);
      this.sessionStorage.removeItem(AUTH_KEYS.USER_SESSION);
      this.sessionStorage.removeItem(AUTH_KEYS.ACTIVE_ROLE);
    }
    window.location.href = "login.html";
  }

  /**
   * 페이지 권한 라우트 가드 (Route Guard)
   * 비인가 접속 시 로그인 페이지로 즉시 리다이렉트
   * @param {'admin'|'user'} expectedRole 
   */
  requireRole(expectedRole) {
    const session = this.getSession(expectedRole);
    if (!session || session.role !== expectedRole) {
      // 세션 없음 또는 권한 불일치 -> login.html로 이동
      const currentPath = window.location.pathname.split("/").pop() || "";
      window.location.href = `login.html?redirect=${encodeURIComponent(currentPath)}&reqRole=${expectedRole}`;
      return false;
    }
    return session;
  }

  /**
   * 헤더용 프로필 바 자동 주입 헬퍼
   */
  renderHeaderProfile(containerId, role = "admin") {
    const container = document.getElementById(containerId);
    if (!container) return;

    const session = this.getSession(role);
    if (!session) return;

    if (role === "admin") {
      container.innerHTML = `
        <div class="user-profile-badge" style="display: flex; align-items: center; gap: 10px; padding: 4px 12px; background: #e8f5e9; border: 1px solid #c8e6c9; border-radius: 20px; font-size: 0.83rem;">
          <i class="fa-solid fa-user-shield" style="color: #2e7d32;"></i>
          <span style="font-weight: 700; color: #1b5e20;">${session.userName}</span>
          <span style="color: #4caf50; font-size: 0.75rem;">(관리자)</span>
          <button onclick="s2tAuth.logout('admin')" title="로그아웃" style="background: none; border: none; color: #666; cursor: pointer; padding: 2px 4px; font-size: 0.85rem; margin-left: 4px;">
            <i class="fa-solid fa-arrow-right-from-bracket"></i>
          </button>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="user-profile-badge" style="display: flex; align-items: center; gap: 10px; padding: 4px 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 20px; font-size: 0.83rem;">
          <i class="fa-solid fa-wheat-awn" style="color: #166534;"></i>
          <span style="font-weight: 700; color: #166534;">${session.farmName || session.userName}</span>
          <span style="background: #dcfce7; color: #15803d; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 600;">${session.cropType || '농가회원'}</span>
          <button onclick="s2tAuth.logout('user')" title="로그아웃" style="background: none; border: none; color: #666; cursor: pointer; padding: 2px 4px; font-size: 0.85rem; margin-left: 4px;">
            <i class="fa-solid fa-arrow-right-from-bracket"></i>
          </button>
        </div>
      `;
    }
  }
}

// 글로벌 인스턴스 생성
const s2tAuth = new S2TAuthManager();
