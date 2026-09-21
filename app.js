/**
 * S2T 계약재배 및 생산관리 시스템 프론트엔드 비즈니스 로직 (app.js)
 */

let currentTab = "farms";
let state = {
  farms: [],
  predictions: [],
  settlements: []
};

// ==============================================================================
// 1. 초기화 및 데이터 로드
// ==============================================================================
document.addEventListener("DOMContentLoaded", async () => {
  if (typeof s2tAuth !== "undefined") {
    s2tAuth.renderHeaderProfile("adminProfileContainer", "admin");
  }
  updateSyncBadge();
  await reloadAllData();
});

async function reloadAllData() {
  state.farms = await s2tDB.getFarms();
  state.predictions = await s2tDB.getPredictions();
  state.settlements = await s2tDB.getSettlements();

  renderAll();
}

function renderAll() {
  updateKpiSummary();
  renderFarmsTable();
  renderPredictionsTable();
  renderSettlementsTable();
  populateDropdowns();
}

// ==============================================================================
// 2. 탭 전환
// ==============================================================================
function switchTab(tabName) {
  currentTab = tabName;

  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.remove("active"));

  if (tabName === "farms") {
    document.querySelectorAll(".tab-btn")[0].classList.add("active");
    document.getElementById("tabFarms").classList.add("active");
  } else if (tabName === "predictions") {
    document.querySelectorAll(".tab-btn")[1].classList.add("active");
    document.getElementById("tabPredictions").classList.add("active");
  } else if (tabName === "settlements") {
    document.querySelectorAll(".tab-btn")[2].classList.add("active");
    document.getElementById("tabSettlements").classList.add("active");
  }
}

// ==============================================================================
// 3. KPI 대시보드 요약 지표 산출
// ==============================================================================
function extractCityGun(regionStr) {
  if (!regionStr) return "기타";
  const tokens = regionStr.trim().split(/\s+/);
  for (const token of tokens) {
    if (token.endsWith("시") || token.endsWith("군")) {
      return token.replace(/(시|군)$/, "");
    }
  }
  const match = regionStr.match(/([가-힣]{2,4})(?:시|군)/);
  if (match) return match[1];
  return tokens[0] || "기타";
}

function updateKpiSummary() {
  // 1. 총 계약 농가 지표 (최근 1개월 신규 & 시/군별 집계)
  const totalFarms = state.farms.length;
  const totalHouses = state.farms.reduce((acc, f) => acc + (Number(f.greenhouse_count) || 0), 0);
  const totalPyeong = state.farms.reduce((acc, f) => acc + (Number(f.area_pyeong) || 0), 0);

  // 최근 1개월 이내 등록 농가 계산 (30일 이내)
  const now = new Date();
  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(now.getDate() - 30);
  let newFarmsCount = 0;

  // 시/군별 계약 농가 수 집계
  const farmRegionCounts = {};
  state.farms.forEach(f => {
    if (f.created_at) {
      const d = new Date(f.created_at.replace(" ", "T"));
      if (!isNaN(d.getTime()) && d >= oneMonthAgo) {
        newFarmsCount++;
      }
    }
    const city = extractCityGun(f.region);
    farmRegionCounts[city] = (farmRegionCounts[city] || 0) + 1;
  });

  const farmRegionText = Object.entries(farmRegionCounts)
    .map(([city, count]) => `${city} ${count}`)
    .join(" · ");

  document.getElementById("kpiFarmCount").textContent = totalFarms.toLocaleString();
  document.getElementById("kpiFarmSub").textContent = `하우스 ${totalHouses}동 / ${totalPyeong.toLocaleString()}평`;

  const newBadgeEl = document.getElementById("kpiNewFarmBadge");
  if (newBadgeEl) {
    newBadgeEl.textContent = `신규(1개월) ${newFarmsCount}개소`;
  }
  const farmRegSubEl = document.getElementById("kpiFarmRegionSub");
  if (farmRegSubEl) {
    farmRegSubEl.innerHTML = `<i class="fa-solid fa-map-pin" style="color: var(--primary); font-size: 0.7rem; margin-right: 3px;"></i>지역별: ${farmRegionText || "데이터 없음"}`;
  }

  // 2. 생산 예측 물량 (멜론 kg / 수박 통 & 시/군별 총생산 물량)
  let melonKg = 0;
  let waterTong = 0;
  const prodRegionTotals = {};

  state.predictions.forEach(p => {
    const yieldVal = Number(p.expected_yield) || 0;
    const isWater = (p.crop_type || "").includes("수박");
    if (isWater) {
      waterTong += yieldVal;
    } else {
      melonKg += yieldVal;
    }

    const linkedFarm = state.farms.find(f => f.id === p.farm_id || f.farm_name === p.farm_name);
    const city = extractCityGun(linkedFarm ? linkedFarm.region : "");

    if (!prodRegionTotals[city]) prodRegionTotals[city] = { kg: 0, tong: 0 };
    if (isWater) {
      prodRegionTotals[city].tong += yieldVal;
    } else {
      prodRegionTotals[city].kg += yieldVal;
    }
  });

  const prodRegionText = Object.entries(prodRegionTotals)
    .map(([city, data]) => {
      const parts = [];
      if (data.kg > 0) parts.push(`${data.kg.toLocaleString()}kg`);
      if (data.tong > 0) parts.push(`${data.tong.toLocaleString()}통`);
      return `${city} ${parts.join("/")}`;
    })
    .join(" · ");

  if (waterTong > 0 && melonKg > 0) {
    document.getElementById("kpiYieldValue").innerHTML = `${melonKg.toLocaleString()}<small style="font-size: 0.75rem; font-weight: normal;">kg</small> · ${waterTong.toLocaleString()}<small style="font-size: 0.75rem; font-weight: normal;">통</small>`;
  } else if (waterTong > 0) {
    document.getElementById("kpiYieldValue").innerHTML = `${waterTong.toLocaleString()} <small style="font-size: 0.85rem; font-weight: normal;">통</small>`;
  } else {
    document.getElementById("kpiYieldValue").innerHTML = `${melonKg.toLocaleString()} <small style="font-size: 0.85rem; font-weight: normal;">kg</small>`;
  }
  document.getElementById("kpiYieldSub").textContent = `하미과 ${melonKg.toLocaleString()}kg · 수박 ${waterTong.toLocaleString()}통`;

  const yieldRegSubEl = document.getElementById("kpiYieldRegionSub");
  if (yieldRegSubEl) {
    yieldRegSubEl.innerHTML = `<i class="fa-solid fa-chart-pie" style="font-size: 0.7rem; margin-right: 3px;"></i>지역별: ${prodRegionText || "예측 데이터 없음"}`;
  }

  // 3. 수확 임박 농가 (D-7 이내 또는 오늘) & 구체적 농가명 표기
  const nearFarms = [];
  state.predictions.forEach(p => {
    if (p.expected_harvest_start) {
      const dday = s2tDB.calculateDDay(p.expected_harvest_start);
      if (dday.diffDays >= 0 && dday.diffDays <= 7) {
        nearFarms.push({
          name: p.farm_name ? p.farm_name.split(" ")[0] : "농가",
          fullName: p.farm_name,
          ddayText: dday.text,
          crop: p.crop_type
        });
      }
    }
  });

  document.getElementById("kpiNearHarvestCount").textContent = nearFarms.length;
  document.getElementById("kpiNearHarvestSub").textContent = nearFarms.length > 0 ? "출하 일정 점검 대상" : "현재 임박 농가 없음";

  const nearListEl = document.getElementById("kpiNearHarvestFarmsList");
  if (nearListEl) {
    if (nearFarms.length > 0) {
      nearListEl.innerHTML = nearFarms.map(f => `<b>${f.name}</b>(${f.ddayText})`).join(" · ");
      nearListEl.style.background = "#fee2e2";
      nearListEl.style.borderColor = "#fca5a5";
      nearListEl.style.color = "#b91c1c";
    } else {
      nearListEl.innerHTML = "현재 임박 농가 없음";
      nearListEl.style.background = "#fef3c7";
      nearListEl.style.borderColor = "#fde68a";
      nearListEl.style.color = "#b45309";
    }
  }

  // 4. 누적 정산액 및 평균 달성률 & 농가별 정산금액 (최근 3개 + 스크롤)
  const totalSettlement = state.settlements.reduce((acc, s) => acc + (Number(s.settlement_amount) || 0), 0);
  document.getElementById("kpiTotalSettlement").textContent = totalSettlement.toLocaleString();

  let rateSum = 0;
  let rateCount = 0;
  state.settlements.forEach(s => {
    const linkedPred = state.predictions.find(p => p.contract_id === s.contract_id);
    if (linkedPred && linkedPred.expected_yield > 0 && s.actual_yield > 0) {
      const rate = (s.actual_yield / linkedPred.expected_yield) * 100;
      rateSum += rate;
      rateCount++;
    }
  });
  const avgRate = rateCount > 0 ? Math.round(rateSum / rateCount) : 100;
  document.getElementById("kpiSettlementSub").textContent = `출하 물량 평균 달성률 ${avgRate}%`;

  // 농가별 정산금액 리스트 (최근 순)
  const recentListEl = document.getElementById("kpiRecentSettlementsList");
  if (recentListEl) {
    if (state.settlements.length > 0) {
      const sortedSettle = [...state.settlements].sort((a, b) => {
        const da = new Date((a.harvest_date || a.created_at || "").replace(" ", "T")).getTime() || 0;
        const db = new Date((b.harvest_date || b.created_at || "").replace(" ", "T")).getTime() || 0;
        return db - da;
      });

      recentListEl.innerHTML = sortedSettle.map(s => {
        const shortName = s.farm_name ? s.farm_name.split(" ")[0] : "농가";
        const amt = (Number(s.settlement_amount) || 0).toLocaleString();
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dotted #e5e7eb; padding: 2px 0;">
            <span style="font-weight: 600; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${shortName}</span>
            <span style="color: #15803d; font-weight: 700;">${amt}원</span>
          </div>
        `;
      }).join("");
    } else {
      recentListEl.innerHTML = `<span style="color: #9ca3af;">정산 내역 없음</span>`;
    }
  }
}

// ==============================================================================
// 4. 탭 1: 농가 관리 (Farms) 테이블 렌더링 및 모달
// ==============================================================================
function renderFarmsTable() {
  const tbody = document.getElementById("farmsTableBody");
  const keyword = (document.getElementById("farmSearchInput")?.value || "").toLowerCase().trim();
  const cropFilter = document.getElementById("farmCropFilter")?.value || "";
  const statusFilter = document.getElementById("farmStatusFilter")?.value || "";

  let list = state.farms.filter(item => {
    const matchKey = (item.farm_name || "").toLowerCase().includes(keyword) ||
                     (item.region || "").toLowerCase().includes(keyword) ||
                     (item.id || "").toLowerCase().includes(keyword);
    const matchCrop = !cropFilter || item.crop_type === cropFilter;
    const matchStatus = !statusFilter || item.contract_status === statusFilter;
    return matchKey && matchCrop && matchStatus;
  });

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="empty-state">
            <i class="fa-solid fa-users-slash"></i>
            <p>등록된 농가 정보가 없거나 검색 조건과 일치하는 농가가 없습니다.</p>
            <button class="btn btn-outline btn-sm" onclick="openFarmModal()">+ 첫 농가 등록하기</button>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(f => {
    const isMelon = (f.crop_type || "").includes("멜론");
    const cropBadgeClass = isMelon ? "badge-melon" : "badge-water";
    const statusBadgeClass = f.contract_status === "계약 완료" ? "badge-complete" : "badge-review";

    return `
      <tr>
        <td><strong style="color: #4b5563; font-size: 0.82rem;">${f.id}</strong></td>
        <td>
          <div style="font-weight: 600; color: var(--text-main); font-size: 0.94rem;">${f.farm_name}</div>
        </td>
        <td>
          <a href="tel:${f.phone}" style="color: var(--primary); text-decoration: none; font-size: 0.85rem;">
            <i class="fa-solid fa-phone" style="font-size: 0.75rem;"></i> ${f.phone}
          </a>
        </td>
        <td style="color: #4b5563;">${f.region || "-"}</td>
        <td>
          <span class="badge ${cropBadgeClass}">
            ${isMelon ? "🍈" : "🍉"} ${f.crop_type}
          </span>
        </td>
        <td>${f.greenhouse_count || 0}동 / ${(Number(f.area_pyeong) || 0).toLocaleString()}평</td>
        <td><span class="badge ${statusBadgeClass}">${f.contract_status}</span></td>
        <td style="font-size: 0.8rem; color: var(--text-muted);">${(f.created_at || "").substring(0, 10)}</td>
        <td style="text-align: right;">
          <div class="action-btns" style="justify-content: flex-end;">
            <button class="btn-icon" title="수정" onclick="editFarm('${f.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="btn-icon delete" title="삭제" onclick="deleteFarmConfirm('${f.id}')"><i class="fa-solid fa-trash"></i></button>
            <button class="btn-icon" title="생산예측 바로등록" onclick="quickAddPrediction('${f.id}')"><i class="fa-solid fa-seedling" style="color: var(--primary);"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function openFarmModal(farm = null) {
  document.getElementById("farmModalTitle").textContent = farm ? "농가 정보 수정" : "신규 농가 등록";
  document.getElementById("farmFormId").value = farm ? farm.id : "";
  document.getElementById("farmFormName").value = farm ? farm.farm_name : "";
  document.getElementById("farmFormPhone").value = farm ? farm.phone : "";
  document.getElementById("farmFormCrop").value = farm ? farm.crop_type : "하미과멜론";

  const regionInput = document.getElementById("farmFormRegion");
  regionInput.value = farm ? (farm.base_address || farm.region || "") : "";
  regionInput.readOnly = false;
  regionInput.style.background = "#ffffff";
  regionInput.style.cursor = "text";

  document.getElementById("farmFormDetailAddress").value = farm ? (farm.detail_address || "") : "";
  document.getElementById("farmFormHouses").value = farm ? (farm.greenhouse_count || "") : "";
  document.getElementById("farmFormArea").value = farm ? (farm.area_pyeong || "") : "";
  document.getElementById("farmFormStatus").value = farm ? farm.contract_status : "계약 완료";

  document.getElementById("farmModalBackdrop").classList.add("open");
}

function closeFarmModal() {
  document.getElementById("farmModalBackdrop").classList.remove("open");
}

/**
 * 카카오/다음 우편번호 자동 검색 레이어 열기
 */
function searchFarmAddress() {
  if (typeof daum === "undefined" || !daum.Postcode) {
    alert("카카오/다음 주소 검색 서비스를 불러오는 중이거나 인터넷 연결이 필요합니다.\n주소 입력창에 직접 주소를 타이핑하여 등록/수정하실 수 있습니다.");
    const regionInput = document.getElementById("farmFormRegion");
    regionInput.focus();
    return;
  }

  const container = document.getElementById("postcodeLayerContent");
  container.innerHTML = "";

  new daum.Postcode({
    oncomplete: function(data) {
      // 도로명 또는 지번 또는 기본 주소 안전 추출
      let fullAddr = data.roadAddress || data.address || data.jibunAddress || "";
      if (data.userSelectedType === "J" && data.jibunAddress) {
        fullAddr = data.jibunAddress;
      }

      let extraAddr = "";
      if (data.userSelectedType === "R" || data.roadAddress) {
        if (data.bname && /[동|로|가]$/g.test(data.bname)) {
          extraAddr += data.bname;
        }
        if (data.buildingName) {
          extraAddr += (extraAddr ? ", " + data.buildingName : data.buildingName);
        }
        if (extraAddr) {
          fullAddr += ` (${extraAddr})`;
        }
      }

      const regionInput = document.getElementById("farmFormRegion");
      regionInput.value = fullAddr;
      regionInput.readOnly = false;
      regionInput.style.background = "#ffffff";
      regionInput.style.cursor = "text";

      closePostcodeModal();

      const detailInput = document.getElementById("farmFormDetailAddress");
      if (detailInput) detailInput.focus();
    },
    width: "100%",
    height: "100%"
  }).embed(container);

  document.getElementById("postcodeModalBackdrop").classList.add("open");
}

function closePostcodeModal() {
  document.getElementById("postcodeModalBackdrop").classList.remove("open");
}

async function submitFarmForm() {
  const name = document.getElementById("farmFormName").value.trim();
  const phone = document.getElementById("farmFormPhone").value.trim();
  if (!name || !phone) {
    alert("농가명(대표자)과 연락처는 필수 항목입니다.");
    return;
  }

  const baseAddress = document.getElementById("farmFormRegion").value.trim();
  const detailAddress = document.getElementById("farmFormDetailAddress").value.trim();
  const fullRegion = detailAddress ? (baseAddress ? `${baseAddress} ${detailAddress}` : detailAddress) : baseAddress;

  const farmId = document.getElementById("farmFormId").value.trim();
  const isEdit = Boolean(farmId);

  const farmData = {
    id: farmId || undefined,
    farm_name: name,
    phone: phone,
    crop_type: document.getElementById("farmFormCrop").value,
    region: fullRegion,
    base_address: baseAddress,
    detail_address: detailAddress,
    greenhouse_count: Number(document.getElementById("farmFormHouses").value) || 0,
    area_pyeong: Number(document.getElementById("farmFormArea").value) || 0,
    contract_status: document.getElementById("farmFormStatus").value
  };

  try {
    await s2tDB.saveFarm(farmData);
    closeFarmModal();
    await reloadAllData();
    alert(isEdit ? "농가 정보가 성공적으로 수정되었습니다." : `[${farmData.farm_name}] 신규 농가가 성공적으로 등록되었습니다.`);
  } catch (err) {
    console.error("농가 저장 실패:", err);
    alert("농가 저장 중 오류가 발생했습니다: " + err.message);
  }
}

function editFarm(id) {
  const farm = state.farms.find(f => f.id === id);
  if (farm) openFarmModal(farm);
}

async function deleteFarmConfirm(id) {
  if (confirm("정말 이 농가를 삭제하시겠습니까? 연결된 데이터가 있을 수 있습니다.")) {
    await s2tDB.deleteFarm(id);
    await reloadAllData();
  }
}

// ==============================================================================
// 5. 탭 2: 생산 예측 (Predictions) 테이블 렌더링 및 모달
// ==============================================================================
function renderPredictionsTable() {
  const tbody = document.getElementById("predictionsTableBody");
  const keyword = (document.getElementById("predSearchInput")?.value || "").toLowerCase().trim();
  const cropFilter = document.getElementById("predCropFilter")?.value || "";
  const stageFilter = document.getElementById("predStageFilter")?.value || "";

  let list = state.predictions.filter(item => {
    const matchKey = (item.contract_id || "").toLowerCase().includes(keyword) ||
                     (item.farm_name || "").toLowerCase().includes(keyword);
    const matchCrop = !cropFilter || item.crop_type === cropFilter;
    const matchStage = !stageFilter || item.growth_stage === stageFilter;
    return matchKey && matchCrop && matchStage;
  });

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10">
          <div class="empty-state">
            <i class="fa-solid fa-calendar-xmark"></i>
            <p>등록된 생산 예측(S2T) 데이터가 없습니다.</p>
            <button class="btn btn-outline btn-sm" onclick="openPredictionModal()">+ 첫 생산예측 등록</button>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(p => {
    const isMelon = (p.crop_type || "").includes("멜론");
    const cropBadgeClass = isMelon ? "badge-melon" : "badge-water";

    // 생육 단계별 뱃지
    let stageClass = "badge-stage-2";
    if (p.growth_stage === "활착기") stageClass = "badge-stage-1";
    else if (p.growth_stage === "생장기") stageClass = "badge-stage-2";
    else if (p.growth_stage === "착과·비대기") stageClass = "badge-stage-3";
    else if (p.growth_stage === "수확임박") stageClass = "badge-stage-4";
    else if (p.growth_stage === "수확완료") stageClass = "badge-stage-5";

    // D-Day 계산
    const dday = s2tDB.calculateDDay(p.expected_harvest_start);
    const ddayClass = dday.isNear ? "d-day-urgent" : "d-day-normal";

    return `
      <tr>
        <td><strong>${p.contract_id || p.id}</strong></td>
        <td>
          <div style="font-weight: 600;">${p.farm_name}</div>
        </td>
        <td>
          <span class="badge ${cropBadgeClass}">${isMelon ? "🍈" : "🍉"} ${p.crop_type}</span>
        </td>
        <td style="font-size: 0.85rem;">${p.planting_date || "-"}</td>
        <td style="font-size: 0.85rem; color: var(--primary-dark); font-weight: 600;">
          ${p.fruit_set_date ? `${p.fruit_set_date}` : `<span style="color:#9ca3af; font-weight:normal;">미정</span>`}
        </td>
        <td style="font-size: 0.85rem;">
          ${p.expected_harvest_start || "-"} ~ ${p.expected_harvest_end ? p.expected_harvest_end.substring(5) : ""}
        </td>
        <td>
          <span class="d-day-tag ${ddayClass}">${dday.text}</span>
        </td>
        <td>
          <strong style="color: var(--text-main); font-size: 0.95rem;">${(Number(p.expected_yield) || 0).toLocaleString()}</strong>
          <small style="color: var(--text-muted);">${p.yield_unit || "kg"}</small>
        </td>
        <td><span class="badge ${stageClass}">${p.growth_stage}</span></td>
        <td style="text-align: right;">
          <div class="action-btns" style="justify-content: flex-end;">
            <button class="btn-icon" title="수정" onclick="editPrediction('${p.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="btn-icon delete" title="삭제" onclick="deletePredictionConfirm('${p.id}')"><i class="fa-solid fa-trash"></i></button>
            <button class="btn-icon" title="정산등록" onclick="quickAddSettlement('${p.id}')"><i class="fa-solid fa-box-open" style="color: #7e22ce;"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function openPredictionModal(pred = null, defaultFarmId = null) {
  document.getElementById("predModalTitle").textContent = pred ? "생산 예측 수정" : "생산 예측 등록 (S2T 핵심)";
  document.getElementById("predFormId").value = pred ? pred.id : "";
  document.getElementById("predFormContractId").value = pred ? (pred.contract_id || "") : "";

  // 농가 셀렉트박스 채우기
  const farmSelect = document.getElementById("predFormFarmSelect");
  farmSelect.innerHTML = '<option value="">농가를 선택하세요</option>' + 
    state.farms.map(f => `<option value="${f.id}" data-crop="${f.crop_type}">${f.farm_name} (${f.crop_type})</option>`).join("");

  if (pred) {
    farmSelect.value = pred.farm_id;
    document.getElementById("predFormCrop").value = pred.crop_type;
    document.getElementById("predFormStage").value = pred.growth_stage;
    document.getElementById("predFormPlantingDate").value = pred.planting_date || "";
    document.getElementById("predFormFruitSetDate").value = pred.fruit_set_date || "";
    document.getElementById("predFormHarvestStart").value = pred.expected_harvest_start || "";
    document.getElementById("predFormHarvestEnd").value = pred.expected_harvest_end || "";
    document.getElementById("predFormYield").value = pred.expected_yield || "";
    document.getElementById("predFormUnit").value = pred.yield_unit || "kg";

    if (pred.fruit_set_date) {
      const calc = s2tDB.calculateHarvestWindow(pred.crop_type, pred.fruit_set_date, true);
      updateHarvestNotice(calc);
    } else if (pred.planting_date) {
      const calc = s2tDB.calculateHarvestWindow(pred.crop_type, pred.planting_date, false);
      updateHarvestNotice(calc);
    } else {
      clearHarvestNotice();
    }
  } else {
    document.getElementById("predFormPlantingDate").value = new Date().toISOString().split("T")[0];
    document.getElementById("predFormFruitSetDate").value = "";
    document.getElementById("predFormHarvestStart").value = "";
    document.getElementById("predFormHarvestEnd").value = "";
    document.getElementById("predFormYield").value = "";
    document.getElementById("predFormStage").value = "활착기";

    if (defaultFarmId) {
      farmSelect.value = defaultFarmId;
      const opt = farmSelect.options[farmSelect.selectedIndex];
      if (opt && opt.dataset.crop) {
        document.getElementById("predFormCrop").value = opt.dataset.crop;
        document.getElementById("predFormUnit").value = opt.dataset.crop.includes("수박") ? "통" : "kg";
      }
    } else {
      farmSelect.selectedIndex = 0;
      document.getElementById("predFormCrop").value = "하미과멜론";
      document.getElementById("predFormUnit").value = "kg";
    }

    // 신규 등록 시 오늘 정식일 기준으로 착과일(평균) 및 수확 시작/종료일 자동 산출
    onPlantingDateChange();
  }

  document.getElementById("predModalBackdrop").classList.add("open");
}

function closePredictionModal() {
  document.getElementById("predModalBackdrop").classList.remove("open");
}

function onFarmSelectChange() {
  const farmSelect = document.getElementById("predFormFarmSelect");
  const selectedOpt = farmSelect.options[farmSelect.selectedIndex];
  if (selectedOpt && selectedOpt.dataset.crop) {
    document.getElementById("predFormCrop").value = selectedOpt.dataset.crop;
    const unitSelect = document.getElementById("predFormUnit");
    unitSelect.value = selectedOpt.dataset.crop.includes("수박") ? "통" : "kg";
    recalculateHarvestDates();
  }
}

// 정식일 변경 시 스마트 계산 (정식일 입력 시 착과일 평균 및 수확 시작/종료/평균일 자동 산출)
function onPlantingDateChange() {
  const pDate = document.getElementById("predFormPlantingDate").value;
  if (!pDate) {
    clearHarvestNotice();
    return;
  }
  const crop = document.getElementById("predFormCrop").value;

  // 정식일 기준 착과일(평균) 및 수확일 자동 추천
  const calc = s2tDB.calculateHarvestWindow(crop, pDate, false);
  if (calc) {
    // 착과일 평균 날짜로 자동 갱신
    document.getElementById("predFormFruitSetDate").value = calc.suggestedFruitSetDate;
    document.getElementById("predFormHarvestStart").value = calc.harvestStartDate;
    document.getElementById("predFormHarvestEnd").value = calc.harvestEndDate;

    updateHarvestNotice(calc);
  }
}

// 착과일 변경 시 (수박 착과후 45~50일, 멜론 착과후 55~60일 기준 재계산)
function onFruitSetDateChange() {
  const fDate = document.getElementById("predFormFruitSetDate").value;
  if (!fDate) {
    onPlantingDateChange();
    return;
  }
  const crop = document.getElementById("predFormCrop").value;
  const calc = s2tDB.calculateHarvestWindow(crop, fDate, true);
  if (calc) {
    document.getElementById("predFormHarvestStart").value = calc.harvestStartDate;
    document.getElementById("predFormHarvestEnd").value = calc.harvestEndDate;

    updateHarvestNotice(calc);
  }
}

function recalculateHarvestDates() {
  // 품목 변경 시: 정식일이 있으면 정식일 기준으로 새 품목의 기준에 맞게 착과일 및 수확일 재계산
  const pDate = document.getElementById("predFormPlantingDate").value;
  if (pDate) {
    onPlantingDateChange();
  } else {
    const fDate = document.getElementById("predFormFruitSetDate").value;
    if (fDate) onFruitSetDateChange();
  }
}

function updateHarvestNotice(calc) {
  if (!calc) return;
  const isWater = calc.isWatermelon;
  const cropName = isWater ? "수박 고상재배" : "하미과멜론";

  const fruitSetBadge = document.getElementById("predFruitSetBadge");
  if (fruitSetBadge) {
    fruitSetBadge.textContent = `(정식 후 평균 ${calc.fruitSetDaysAvg}일)`;
  }

  const startBadge = document.getElementById("predHarvestStartBadge");
  if (startBadge) {
    startBadge.textContent = `(착과 후 ${calc.harvestStartOffset}일)`;
  }

  const endBadge = document.getElementById("predHarvestEndBadge");
  if (endBadge) {
    endBadge.textContent = `(착과 후 ${calc.harvestEndOffset}일)`;
  }

  const noticeDiv = document.getElementById("predAvgHarvestNotice");
  if (noticeDiv) {
    noticeDiv.style.display = "block";
    noticeDiv.innerHTML = `<i class="fa-solid fa-calendar-check" style="margin-right: 6px;"></i><b>${cropName} 평균 수확 예정일:</b> ${calc.harvestAvgDate} <span style="font-weight: normal; color: #166534;">(수정/착과 후 약 ${calc.harvestAvgOffset}일경)</span>`;
  }
}

function clearHarvestNotice() {
  const fruitSetBadge = document.getElementById("predFruitSetBadge");
  if (fruitSetBadge) fruitSetBadge.textContent = "";
  const startBadge = document.getElementById("predHarvestStartBadge");
  if (startBadge) startBadge.textContent = "";
  const endBadge = document.getElementById("predHarvestEndBadge");
  if (endBadge) endBadge.textContent = "";
  const noticeDiv = document.getElementById("predAvgHarvestNotice");
  if (noticeDiv) {
    noticeDiv.style.display = "none";
    noticeDiv.innerHTML = "";
  }
}

async function submitPredictionForm() {
  const farmSelect = document.getElementById("predFormFarmSelect");
  const farmId = farmSelect.value;
  if (!farmId) {
    alert("대상 농가를 선택해주세요.");
    return;
  }
  const farmName = farmSelect.options[farmSelect.selectedIndex].text.split(" (")[0];

  const plantingDate = document.getElementById("predFormPlantingDate").value;
  const yieldAmount = Number(document.getElementById("predFormYield").value);
  if (!plantingDate || !yieldAmount) {
    alert("정식일과 예상 출하 물량은 필수 항목입니다.");
    return;
  }

  const predData = {
    id: document.getElementById("predFormId").value || undefined,
    contract_id: document.getElementById("predFormContractId").value.trim() || undefined,
    farm_id: farmId,
    farm_name: farmName,
    crop_type: document.getElementById("predFormCrop").value,
    growth_stage: document.getElementById("predFormStage").value,
    planting_date: plantingDate,
    fruit_set_date: document.getElementById("predFormFruitSetDate").value,
    expected_harvest_start: document.getElementById("predFormHarvestStart").value,
    expected_harvest_end: document.getElementById("predFormHarvestEnd").value,
    expected_yield: yieldAmount,
    yield_unit: document.getElementById("predFormUnit").value
  };

  await s2tDB.savePrediction(predData);
  closePredictionModal();
  await reloadAllData();
}

function editPrediction(id) {
  const pred = state.predictions.find(p => p.id === id);
  if (pred) openPredictionModal(pred);
}

async function deletePredictionConfirm(id) {
  if (confirm("정말 이 생산 예측 건을 삭제하시겠습니까?")) {
    await s2tDB.deletePrediction(id);
    await reloadAllData();
  }
}

function quickAddPrediction(farmId) {
  switchTab("predictions");
  openPredictionModal(null, farmId);
}

// ==============================================================================
// 6. 탭 3: 정산 및 이슈 관리 (Settlements) 테이블 렌더링 및 모달
// ==============================================================================
function renderSettlementsTable() {
  const tbody = document.getElementById("settlementsTableBody");
  const keyword = (document.getElementById("settleSearchInput")?.value || "").toLowerCase().trim();
  const gradeFilter = document.getElementById("settleGradeFilter")?.value || "";

  let list = state.settlements.filter(item => {
    const matchKey = (item.contract_id || "").toLowerCase().includes(keyword) ||
                     (item.farm_name || "").toLowerCase().includes(keyword) ||
                     (item.issues || "").toLowerCase().includes(keyword);
    const matchGrade = !gradeFilter || item.quality_grade === gradeFilter;
    return matchKey && matchGrade;
  });

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11">
          <div class="empty-state">
            <i class="fa-solid fa-box-open"></i>
            <p>등록된 정산 및 출하 이슈 내역이 없습니다.</p>
            <button class="btn btn-outline btn-sm" onclick="openSettlementModal()">+ 첫 정산 및 이슈 등록</button>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(s => {
    const isMelon = (s.crop_type || "").includes("멜론");
    const cropBadgeClass = isMelon ? "badge-melon" : "badge-water";

    let gradeBadge = "badge-grade-high";
    if (s.quality_grade === "특") gradeBadge = "badge-grade-special";
    else if (s.quality_grade === "중") gradeBadge = "badge-grade-mid";

    // 달성률 계산
    const linkedPred = state.predictions.find(p => p.contract_id === s.contract_id);
    let rateText = "";
    if (linkedPred && linkedPred.expected_yield > 0) {
      const rate = Math.round((s.actual_yield / linkedPred.expected_yield) * 100);
      rateText = `<span style="font-size: 0.76rem; font-weight: 700; color: ${rate >= 95 ? '#15803d' : '#b45309'};">(${rate}%)</span>`;
    }

    return `
      <tr>
        <td><strong style="color:#6b7280; font-size:0.82rem;">${s.id}</strong></td>
        <td><strong>${s.contract_id || "-"}</strong></td>
        <td><div style="font-weight: 600;">${s.farm_name}</div></td>
        <td><span class="badge ${cropBadgeClass}">${isMelon ? "🍈" : "🍉"} ${s.crop_type}</span></td>
        <td style="font-size: 0.85rem;">${s.harvest_date || "-"}</td>
        <td>
          <strong style="font-size: 0.95rem;">${(Number(s.actual_yield) || 0).toLocaleString()}</strong>
          <small>${s.yield_unit || "kg"}</small> ${rateText}
        </td>
        <td><span class="badge ${gradeBadge}">${s.quality_grade}</span></td>
        <td>${(Number(s.unit_price) || 0).toLocaleString()}원</td>
        <td><strong style="color: #15803d; font-size: 0.95rem;">${(Number(s.settlement_amount) || 0).toLocaleString()}원</strong></td>
        <td style="max-width: 240px; font-size: 0.84rem; color: #4b5563;">
          ${s.issues ? `<i class="fa-solid fa-note-sticky" style="color: var(--warning); margin-right: 4px;"></i>${s.issues}` : "-"}
        </td>
        <td style="text-align: right;">
          <div class="action-btns" style="justify-content: flex-end;">
            <button class="btn-icon" title="수정" onclick="editSettlement('${s.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="btn-icon delete" title="삭제" onclick="deleteSettlementConfirm('${s.id}')"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function openSettlementModal(settle = null, defaultPredId = null) {
  document.getElementById("settleModalTitle").textContent = settle ? "정산 및 이슈 수정" : "정산 및 이슈 등록 (유통/품질)";
  document.getElementById("settleFormId").value = settle ? settle.id : "";

  // 예측 계약 건 셀렉트박스 채우기
  const predSelect = document.getElementById("settleFormPredSelect");
  predSelect.innerHTML = '<option value="">계약 건을 선택하세요</option>' + 
    state.predictions.map(p => `
      <option value="${p.contract_id || p.id}" 
        data-farm="${p.farm_name}" 
        data-crop="${p.crop_type}" 
        data-unit="${p.yield_unit || 'kg'}" 
        data-predyield="${p.expected_yield}">
        [${p.contract_id || p.id}] ${p.farm_name} - ${p.crop_type} (예상: ${(p.expected_yield||0).toLocaleString()}${p.yield_unit||'kg'})
      </option>
    `).join("");

  if (settle) {
    predSelect.value = settle.contract_id;
    document.getElementById("settleFormFarmName").value = settle.farm_name;
    document.getElementById("settleFormCrop").value = settle.crop_type;
    document.getElementById("settleFormHarvestDate").value = settle.harvest_date || "";
    document.getElementById("settleFormGrade").value = settle.quality_grade || "특";
    document.getElementById("settleFormActualYield").value = settle.actual_yield || "";
    document.getElementById("settleFormUnit").value = settle.yield_unit || "kg";
    document.getElementById("settleFormUnitPrice").value = settle.unit_price || "";
    document.getElementById("settleFormAmount").value = (settle.settlement_amount || 0).toLocaleString() + "원";
    document.getElementById("settleFormIssues").value = settle.issues || "";
  } else {
    if (defaultPredId) {
      predSelect.value = defaultPredId;
      onSettlementPredSelectChange();
    } else {
      predSelect.selectedIndex = 0;
      document.getElementById("settleFormFarmName").value = "";
      document.getElementById("settleFormCrop").value = "";
      document.getElementById("settleFormHarvestDate").value = new Date().toISOString().split("T")[0];
      document.getElementById("settleFormGrade").value = "특";
      document.getElementById("settleFormActualYield").value = "";
      document.getElementById("settleFormUnit").value = "kg";
      document.getElementById("settleFormUnitPrice").value = "";
      document.getElementById("settleFormAmount").value = "0원";
      document.getElementById("settleFormIssues").value = "";
    }
  }

  document.getElementById("settleModalBackdrop").classList.add("open");
}

function closeSettlementModal() {
  document.getElementById("settleModalBackdrop").classList.remove("open");
}

function onSettlementPredSelectChange() {
  const predSelect = document.getElementById("settleFormPredSelect");
  const opt = predSelect.options[predSelect.selectedIndex];
  if (opt && opt.dataset.farm) {
    document.getElementById("settleFormFarmName").value = opt.dataset.farm;
    document.getElementById("settleFormCrop").value = opt.dataset.crop;
    document.getElementById("settleFormUnit").value = opt.dataset.unit || "kg";
    calculateSettlementAmount();
  }
}

function calculateSettlementAmount() {
  const qty = Number(document.getElementById("settleFormActualYield").value) || 0;
  const price = Number(document.getElementById("settleFormUnitPrice").value) || 0;
  const total = qty * price;
  document.getElementById("settleFormAmount").value = total > 0 ? total.toLocaleString() + "원" : "0원";
}

function addIssueTag(tagText) {
  const issuesTextarea = document.getElementById("settleFormIssues");
  const current = issuesTextarea.value.trim();
  if (current) {
    issuesTextarea.value = current + ", " + tagText;
  } else {
    issuesTextarea.value = tagText;
  }
}

async function submitSettlementForm() {
  const predSelect = document.getElementById("settleFormPredSelect");
  const contractId = predSelect.value;
  if (!contractId) {
    alert("연계할 계약 건을 선택해주세요.");
    return;
  }

  const harvestDate = document.getElementById("settleFormHarvestDate").value;
  const actualYield = Number(document.getElementById("settleFormActualYield").value);
  const unitPrice = Number(document.getElementById("settleFormUnitPrice").value);

  if (!harvestDate || !actualYield || !unitPrice) {
    alert("수확일, 실제 출하 물량, 책정 단가는 필수 입력 항목입니다.");
    return;
  }

  const totalAmount = actualYield * unitPrice;

  const settleData = {
    id: document.getElementById("settleFormId").value || undefined,
    contract_id: contractId,
    farm_name: document.getElementById("settleFormFarmName").value,
    crop_type: document.getElementById("settleFormCrop").value,
    harvest_date: harvestDate,
    actual_yield: actualYield,
    yield_unit: document.getElementById("settleFormUnit").value,
    quality_grade: document.getElementById("settleFormGrade").value,
    unit_price: unitPrice,
    settlement_amount: totalAmount,
    issues: document.getElementById("settleFormIssues").value.trim()
  };

  await s2tDB.saveSettlement(settleData);
  closeSettlementModal();
  await reloadAllData();
}

function editSettlement(id) {
  const settle = state.settlements.find(s => s.id === id);
  if (settle) openSettlementModal(settle);
}

async function deleteSettlementConfirm(id) {
  if (confirm("정말 이 정산 내역을 삭제하시겠습니까?")) {
    await s2tDB.deleteSettlement(id);
    await reloadAllData();
  }
}

function quickAddSettlement(predId) {
  const pred = state.predictions.find(p => p.id === predId);
  const contractId = pred ? (pred.contract_id || pred.id) : predId;
  switchTab("settlements");
  openSettlementModal(null, contractId);
}

function populateDropdowns() {
  // 모달이 열릴 때 동적으로 세팅되므로 필요 시 추가
}

// ==============================================================================
// 7. 구글 스프레드시트 설정 관리
// ==============================================================================
function updateSyncBadge() {
  const badge = document.getElementById("syncStatusBadge");
  const text = document.getElementById("syncStatusText");
  if (!badge || !text) return;
  if (s2tDB.isConnected()) {
    badge.classList.add("connected");
    text.textContent = "구글 시트 연동 중";
  } else {
    badge.classList.remove("connected");
    text.textContent = "로컬 모드";
  }
}

function openConfigModal() {
  document.getElementById("configUrlInput").value = s2tDB.getWebAppUrl();
  const resDiv = document.getElementById("configTestResult");
  resDiv.style.display = "none";
  document.getElementById("configModalBackdrop").classList.add("open");
}

function closeConfigModal() {
  document.getElementById("configModalBackdrop").classList.remove("open");
}

async function testSheetConnection() {
  const url = document.getElementById("configUrlInput").value.trim();
  const resDiv = document.getElementById("configTestResult");
  resDiv.style.display = "block";
  resDiv.style.background = "#eff6ff";
  resDiv.style.color = "#1d4ed8";
  resDiv.textContent = "구글 스프레드시트 서버와 통신 중입니다...";

  s2tDB.setWebAppUrl(url);
  const result = await s2tDB.testConnection();

  if (result.connected) {
    resDiv.style.background = "#dcfce7";
    resDiv.style.color = "#15803d";
    resDiv.innerHTML = `<b>연결 성공!</b> 스프레드시트와 정상 연동되었습니다.`;
    updateSyncBadge();
  } else {
    resDiv.style.background = "#fee2e2";
    resDiv.style.color = "#b91c1c";
    resDiv.innerHTML = `<b>연결 실패:</b> ${result.message}`;
  }
}

async function saveSheetConfig() {
  const url = document.getElementById("configUrlInput").value.trim();
  s2tDB.setWebAppUrl(url);
  updateSyncBadge();
  closeConfigModal();
  await reloadAllData();
  alert(url ? "구글 시트 URL이 설정되었습니다. 최신 데이터를 동기화합니다." : "로컬 모드로 전환되었습니다.");
}
