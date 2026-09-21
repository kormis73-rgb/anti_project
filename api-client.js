/**
 * S2T 생산 관리 API 및 데이터 매니저 (api-client.js)
 * 
 * 구글 스프레드시트 API 연동 및 브라우저 로컬 저장소(LocalStorage) 동기화를 모두 지원합니다.
 * 구글 웹 앱 URL이 설정되지 않은 상태에서도 즉시 모든 기능을 체험할 수 있는 스마트 하이브리드 엔진입니다.
 */

// 로컬 스토리지 키
const STORAGE_KEYS = {
  WEB_APP_URL: "s2t_web_app_url",
  FARMS: "s2t_farms_data",
  PREDICTIONS: "s2t_predictions_data",
  SETTLEMENTS: "s2t_settlements_data"
};

// 기본 샘플 데이터 (초기 체험용)
const INITIAL_MOCK_DATA = {
  farms: [
    {
      id: "FARM-001",
      farm_name: "김성주 (성주일등농원)",
      phone: "010-3841-5920",
      region: "경북 성주군 초전면",
      crop_type: "하미과멜론",
      greenhouse_count: 6,
      area_pyeong: 1200,
      contract_status: "계약 완료",
      created_at: "2026-03-01 10:00:00"
    },
    {
      id: "FARM-002",
      farm_name: "박부여 (백제수박작목반)",
      phone: "010-9122-4411",
      region: "충남 부여군 규암면",
      crop_type: "수박 고상재배",
      greenhouse_count: 8,
      area_pyeong: 1800,
      contract_status: "계약 완료",
      created_at: "2026-03-05 14:30:00"
    },
    {
      id: "FARM-003",
      farm_name: "이영동 (황금과채농장)",
      phone: "010-5510-7890",
      region: "충북 영동군 양산면",
      crop_type: "하미과멜론",
      greenhouse_count: 4,
      area_pyeong: 800,
      contract_status: "검토 중",
      created_at: "2026-03-10 11:20:00"
    }
  ],
  predictions: [
    {
      id: "PRED-001",
      contract_id: "CNT-2026-01",
      farm_id: "FARM-001",
      farm_name: "김성주 (성주일등농원)",
      crop_type: "하미과멜론",
      planting_date: "2026-04-15",
      fruit_set_date: "2026-05-10",
      expected_harvest_start: "2026-07-04", // 착과 후 55일
      expected_harvest_end: "2026-07-09",   // 착과 후 60일
      expected_yield: 6500,
      yield_unit: "kg",
      growth_stage: "착과·비대기",
      created_at: "2026-04-15 15:00:00"
    },
    {
      id: "PRED-002",
      contract_id: "CNT-2026-02",
      farm_id: "FARM-002",
      farm_name: "박부여 (백제수박작목반)",
      crop_type: "수박 고상재배",
      planting_date: "2026-05-01",
      fruit_set_date: "2026-05-30",
      expected_harvest_start: "2026-07-14", // 착과 후 45일
      expected_harvest_end: "2026-07-19",
      expected_yield: 2400,
      yield_unit: "통",
      growth_stage: "수확임박",
      created_at: "2026-05-01 16:30:00"
    }
  ],
  settlements: [
    {
      id: "SET-001",
      contract_id: "CNT-2026-01",
      farm_name: "김성주 (성주일등농원)",
      crop_type: "하미과멜론",
      harvest_date: "2026-07-05",
      actual_yield: 6350,
      yield_unit: "kg",
      quality_grade: "특",
      unit_price: 6800,
      settlement_amount: 43180000,
      issues: "당도 15.5브릭스 이상 매우 양호, 야간 저온기 환기관리 우수",
      created_at: "2026-07-06 18:00:00"
    }
  ]
};

class S2TDataManager {
  constructor() {
    this.webAppUrl = localStorage.getItem(STORAGE_KEYS.WEB_APP_URL) || "";
    this._initLocalData();
  }

  /**
   * 로컬 데이터가 비어있으면 초기 샘플 데이터로 세팅
   */
  _initLocalData() {
    if (!localStorage.getItem(STORAGE_KEYS.FARMS)) {
      localStorage.setItem(STORAGE_KEYS.FARMS, JSON.stringify(INITIAL_MOCK_DATA.farms));
    }
    if (!localStorage.getItem(STORAGE_KEYS.PREDICTIONS)) {
      localStorage.setItem(STORAGE_KEYS.PREDICTIONS, JSON.stringify(INITIAL_MOCK_DATA.predictions));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SETTLEMENTS)) {
      localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(INITIAL_MOCK_DATA.settlements));
    }
  }

  // ==========================================
  // 구글 시트 URL 설정 및 연결 상태 확인
  // ==========================================
  setWebAppUrl(url) {
    this.webAppUrl = (url || "").trim();
    localStorage.setItem(STORAGE_KEYS.WEB_APP_URL, this.webAppUrl);
  }

  getWebAppUrl() {
    return this.webAppUrl;
  }

  isConnected() {
    return Boolean(this.webAppUrl && this.webAppUrl.startsWith("https://script.google.com"));
  }

  /**
   * 구글 시트와의 연결 상태 및 데이터 동기화 테스트
   */
  async testConnection() {
    if (!this.isConnected()) {
      return { connected: false, message: "구글 시트 URL이 등록되지 않았습니다. 로컬 모드로 작동합니다." };
    }
    try {
      const res = await fetch(`${this.webAppUrl}?action=getAll`, { method: "GET" });
      const json = await res.json();
      if (json.success) {
        return { connected: true, message: "구글 스프레드시트와 실시간 연동되었습니다.", data: json.data };
      } else {
        return { connected: false, message: "응답 오류: " + (json.error || "알 수 없는 오류") };
      }
    } catch (e) {
      return { connected: false, message: "구글 시트 연결 실패: " + e.message };
    }
  }

  // ==========================================
  // 농가 관리 (Farms) CRUD
  // ==========================================
  async getFarms() {
    let localFarms = JSON.parse(localStorage.getItem(STORAGE_KEYS.FARMS) || "[]");
    if (!Array.isArray(localFarms)) localFarms = [];

    if (this.isConnected()) {
      try {
        const res = await fetch(`${this.webAppUrl}?action=getFarms`, { method: "GET" });
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const sheetFarms = json.data;
          const sheetIds = new Set(sheetFarms.map(f => String(f.id)));
          const unSyncedLocal = localFarms.filter(f => f.id && !sheetIds.has(String(f.id)));
          const merged = [...unSyncedLocal, ...sheetFarms];
          localStorage.setItem(STORAGE_KEYS.FARMS, JSON.stringify(merged));
          return merged;
        }
      } catch (err) {
        console.warn("구글 시트 조회 실패, 로컬 데이터 사용:", err);
      }
    }
    return localFarms;
  }

  async saveFarm(farmData) {
    // 1. 로컬 저장소 우선 반영
    let farms = JSON.parse(localStorage.getItem(STORAGE_KEYS.FARMS) || "[]");
    if (!Array.isArray(farms)) farms = [];

    if (!farmData.id) {
      farmData.id = "FARM-" + Math.random().toString(36).substr(2, 6).toUpperCase();
      farmData.created_at = new Date().toISOString().replace("T", " ").substring(0, 19);
      farms.unshift(farmData);
    } else {
      const idx = farms.findIndex(f => String(f.id) === String(farmData.id));
      if (idx >= 0) farms[idx] = { ...farms[idx], ...farmData };
      else farms.unshift(farmData);
    }
    localStorage.setItem(STORAGE_KEYS.FARMS, JSON.stringify(farms));

    // 2. 구글 시트 연동 전송
    if (this.isConnected()) {
      try {
        await this._sendPost({ action: "saveFarm", data: farmData });
      } catch (e) {
        console.warn("구글 시트 저장 전송 실패 (로컬엔 정상 반영):", e);
      }
    }
    return farmData;
  }

  async deleteFarm(farmId) {
    let farms = JSON.parse(localStorage.getItem(STORAGE_KEYS.FARMS) || "[]");
    farms = farms.filter(f => f.id !== farmId);
    localStorage.setItem(STORAGE_KEYS.FARMS, JSON.stringify(farms));

    if (this.isConnected()) {
      try {
        await this._sendPost({ action: "deleteFarm", data: { id: farmId } });
      } catch (e) {
        console.warn("구글 시트 삭제 전송 실패:", e);
      }
    }
    return true;
  }

  // ==========================================
  // 생산 예측 (Predictions) CRUD
  // ==========================================
  async getPredictions() {
    if (this.isConnected()) {
      try {
        const res = await fetch(`${this.webAppUrl}?action=getPredictions`, { method: "GET" });
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          localStorage.setItem(STORAGE_KEYS.PREDICTIONS, JSON.stringify(json.data));
          return json.data;
        }
      } catch (err) {
        console.warn("구글 시트 조회 실패, 로컬 데이터 사용:", err);
      }
    }
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.PREDICTIONS) || "[]");
  }

  async savePrediction(predData) {
    const predictions = JSON.parse(localStorage.getItem(STORAGE_KEYS.PREDICTIONS) || "[]");
    if (!predData.id) {
      predData.id = "PRED-" + Math.random().toString(36).substr(2, 6).toUpperCase();
      if (!predData.contract_id) {
        predData.contract_id = "CNT-" + new Date().getFullYear() + "-" + (predictions.length + 1).toString().padStart(2, "0");
      }
      predData.created_at = new Date().toISOString().replace("T", " ").substring(0, 19);
      predictions.unshift(predData);
    } else {
      const idx = predictions.findIndex(p => p.id === predData.id);
      if (idx >= 0) predictions[idx] = { ...predictions[idx], ...predData };
      else predictions.unshift(predData);
    }
    localStorage.setItem(STORAGE_KEYS.PREDICTIONS, JSON.stringify(predictions));

    if (this.isConnected()) {
      try {
        await this._sendPost({ action: "savePrediction", data: predData });
      } catch (e) {
        console.warn("구글 시트 저장 실패 (로컬 반영됨):", e);
      }
    }
    return predData;
  }

  async deletePrediction(predId) {
    let predictions = JSON.parse(localStorage.getItem(STORAGE_KEYS.PREDICTIONS) || "[]");
    predictions = predictions.filter(p => p.id !== predId);
    localStorage.setItem(STORAGE_KEYS.PREDICTIONS, JSON.stringify(predictions));

    if (this.isConnected()) {
      try {
        await this._sendPost({ action: "deletePrediction", data: { id: predId } });
      } catch (e) {
        console.warn("구글 시트 삭제 전송 실패:", e);
      }
    }
    return true;
  }

  // ==========================================
  // 정산 및 이슈 (Settlements) CRUD
  // ==========================================
  async getSettlements() {
    if (this.isConnected()) {
      try {
        const res = await fetch(`${this.webAppUrl}?action=getSettlements`, { method: "GET" });
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(json.data));
          return json.data;
        }
      } catch (err) {
        console.warn("구글 시트 조회 실패, 로컬 데이터 사용:", err);
      }
    }
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTLEMENTS) || "[]");
  }

  async saveSettlement(setData) {
    const settlements = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTLEMENTS) || "[]");
    if (!setData.id) {
      setData.id = "SET-" + Math.random().toString(36).substr(2, 6).toUpperCase();
      setData.created_at = new Date().toISOString().replace("T", " ").substring(0, 19);
      settlements.unshift(setData);
    } else {
      const idx = settlements.findIndex(s => s.id === setData.id);
      if (idx >= 0) settlements[idx] = { ...settlements[idx], ...setData };
      else settlements.unshift(setData);
    }
    localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(settlements));

    if (this.isConnected()) {
      try {
        await this._sendPost({ action: "saveSettlement", data: setData });
      } catch (e) {
        console.warn("구글 시트 저장 실패 (로컬 반영됨):", e);
      }
    }
    return setData;
  }

  async deleteSettlement(setId) {
    let settlements = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTLEMENTS) || "[]");
    settlements = settlements.filter(s => s.id !== setId);
    localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(settlements));

    if (this.isConnected()) {
      try {
        await this._sendPost({ action: "deleteSettlement", data: { id: setId } });
      } catch (e) {
        console.warn("구글 시트 삭제 전송 실패:", e);
      }
    }
    return true;
  }

  // ==========================================
  // S2T 생육 및 수확일 계산 스마트 헬퍼
  // ==========================================
  /**
   * 품목별 착과 및 수확 주기 계산 (S2T 스마트 계산기)
   * 1. 수박 고상재배(반촉성):
   *    - 정식일 후 착과일: 35 ~ 40일 (평균 38일)
   *    - 수정(착과) 후 수확일: 45 ~ 50일 (시작: +45일, 종료: +50일, 평균: +48일)
   * 2. 하미과멜론:
   *    - 정식일 후 착과일: 30 ~ 35일 (평균 33일)
   *    - 착과 후 수확일: 55 ~ 60일 (시작: +55일, 종료: +60일, 평균: +58일)
   */
  calculateHarvestWindow(cropType, baseDate, isFruitSetDate = true) {
    const base = new Date(baseDate);
    if (isNaN(base.getTime())) return null;

    const isWatermelon = (cropType || "").includes("수박");

    // 정식 후 착과 평균 일수
    const fruitSetAvgDays = isWatermelon ? 38 : 33;
    // 착과 후 수확 시작, 종료, 평균 일수
    const harvestStartOffset = isWatermelon ? 45 : 55;
    const harvestEndOffset = isWatermelon ? 50 : 60;
    const harvestAvgOffset = isWatermelon ? 48 : 58;

    let fruitSetDateObj;
    if (isFruitSetDate) {
      // 전달받은 baseDate가 착과일인 경우
      fruitSetDateObj = new Date(base);
    } else {
      // 전달받은 baseDate가 정식일인 경우 -> 평균 착과일 자동 산출
      fruitSetDateObj = new Date(base);
      fruitSetDateObj.setDate(fruitSetDateObj.getDate() + fruitSetAvgDays);
    }

    const startDateObj = new Date(fruitSetDateObj);
    startDateObj.setDate(startDateObj.getDate() + harvestStartOffset);

    const endDateObj = new Date(fruitSetDateObj);
    endDateObj.setDate(endDateObj.getDate() + harvestEndOffset);

    const avgHarvestDateObj = new Date(fruitSetDateObj);
    avgHarvestDateObj.setDate(avgHarvestDateObj.getDate() + harvestAvgOffset);

    const formatDate = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    return {
      suggestedFruitSetDate: formatDate(fruitSetDateObj),
      harvestStartDate: formatDate(startDateObj),
      harvestEndDate: formatDate(endDateObj),
      harvestAvgDate: formatDate(avgHarvestDateObj),
      fruitSetDaysAvg: fruitSetAvgDays,
      harvestStartOffset: harvestStartOffset,
      harvestEndOffset: harvestEndOffset,
      harvestAvgOffset: harvestAvgOffset,
      isWatermelon: isWatermelon
    };
  }

  /**
   * D-Day 계산 함수
   */
  calculateDDay(targetDateStr) {
    if (!targetDateStr) return { text: "-", isNear: false, diffDays: 999 };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDateStr);
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return { text: "D-Day (오늘)", isNear: true, diffDays: 0 };
    if (diffDays > 0) return { text: `D-${diffDays}`, isNear: diffDays <= 7, diffDays };
    return { text: `D+${Math.abs(diffDays)} (수확 경과)`, isNear: false, diffDays };
  }

  /**
   * 구글 앱스 스크립트 전송 공통 POST 헬퍼
   */
  async _sendPost(payload) {
    if (!this.isConnected()) return;
    const response = await fetch(this.webAppUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    return await response.json();
  }
}

// 글로벌 인스턴스 생성
const s2tDB = new S2TDataManager();
