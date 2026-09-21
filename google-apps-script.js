/**
 * ==============================================================================
 * S2T 계약재배 및 생산관리 Google Apps Script (GAS) API 백엔드
 * ==============================================================================
 * 
 * [설정 및 배포 안내]
 * 1. 기존 구글 스프레드시트 메뉴에서 [확장 프로그램] > [Apps Script]를 엽니다.
 * 2. 기존 코드를 이 파일의 내용으로 전체 교체(복사/붙여넣기)합니다.
 * 3. 상단 [저장 (Ctrl + S)] 아이콘을 클릭합니다.
 * 4. 우측 상단 [배포] > [배포 관리] (또는 새 배포)를 클릭합니다.
 * 5. 수정(연필 아이콘)을 누르고 버전을 "새 버전"으로 선택 후 [배포]를 누릅니다.
 *    (처음 배포 시: [새 배포] > 유형: [웹 앱] > 액세스 권한: "모든 사용자(Anyone)" 선택)
 * 6. 생성된 "웹 앱 URL"을 S2T 관리 앱 상단의 시트 설정에 입력하면 즉시 실시간 연동됩니다.
 * 
 * ※ 구글 시트에 farms, predictions, settlements 탭이 없어도 첫 호출 시 자동으로 생성됩니다.
 */

// 시트 이름 정의
const SHEET_FARMS = "farms";
const SHEET_PREDICTIONS = "predictions";
const SHEET_SETTLEMENTS = "settlements";
const SHEET_USERS = "users"; // 이전 호환용

// 헤더 정의
const HEADERS = {
  farms: [
    "id", "farm_name", "phone", "region", "crop_type", 
    "greenhouse_count", "area_pyeong", "contract_status", "created_at"
  ],
  predictions: [
    "id", "contract_id", "farm_id", "farm_name", "crop_type", 
    "planting_date", "fruit_set_date", "expected_harvest_start", "expected_harvest_end", 
    "expected_yield", "yield_unit", "growth_stage", "created_at"
  ],
  settlements: [
    "id", "contract_id", "farm_name", "crop_type", "harvest_date", 
    "actual_yield", "yield_unit", "quality_grade", "unit_price", 
    "settlement_amount", "issues", "created_at"
  ]
};

/**
 * 시트 객체 가져오기 (없으면 자동 생성 및 첫 행 헤더 스타일링)
 */
function getOrCreateSheet(sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    
    // 헤더 서식 지정 (배경색, 볼드, 가운데정렬)
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#2e7d32"); // 농업 친화적인 딥 그린
    headerRange.setFontColor("#ffffff");
    headerRange.setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    
    // 열 너비 자동 조정
    for (let i = 1; i <= headers.length; i++) {
      sheet.setColumnWidth(i, 130);
    }
  }
  return sheet;
}

/**
 * 시트 데이터를 객체 배열로 읽어오기
 */
function readSheetAsJson(sheetName, headers) {
  const sheet = getOrCreateSheet(sheetName, headers);
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return []; // 헤더만 있는 경우
  
  const actualHeaders = data[0];
  const rows = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // 빈 행 건너뛰기
    if (!row[0] && !row[1]) continue;
    
    const obj = {};
    for (let j = 0; j < actualHeaders.length; j++) {
      const key = actualHeaders[j];
      let val = row[j];
      
      // 날짜 포맷팅 (YYYY-MM-DD)
      if (val instanceof Date) {
        val = Utilities.formatDate(val, "GMT+9", "yyyy-MM-dd");
      }
      obj[key] = val;
    }
    rows.push(obj);
  }
  return rows;
}

/**
 * GET 요청 처리: 데이터 조회
 */
function doGet(e) {
  try {
    const action = (e.parameter && e.parameter.action) ? e.parameter.action : "getAll";
    let responseData = {};

    if (action === "getFarms") {
      responseData = { success: true, data: readSheetAsJson(SHEET_FARMS, HEADERS.farms) };
    } else if (action === "getPredictions") {
      responseData = { success: true, data: readSheetAsJson(SHEET_PREDICTIONS, HEADERS.predictions) };
    } else if (action === "getSettlements") {
      responseData = { success: true, data: readSheetAsJson(SHEET_SETTLEMENTS, HEADERS.settlements) };
    } else if (action === "getAll") {
      responseData = {
        success: true,
        data: {
          farms: readSheetAsJson(SHEET_FARMS, HEADERS.farms),
          predictions: readSheetAsJson(SHEET_PREDICTIONS, HEADERS.predictions),
          settlements: readSheetAsJson(SHEET_SETTLEMENTS, HEADERS.settlements)
        }
      };
    } else {
      responseData = {
        success: true,
        message: "S2T 생산관리 Google Sheet API가 정상 작동 중입니다.",
        supportedActions: ["getAll", "getFarms", "getPredictions", "getSettlements"]
      };
    }

    return createJsonResponse(responseData);
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * POST 요청 처리: 등록, 수정, 삭제
 */
function doPost(e) {
  try {
    let requestData = {};
    if (e.postData && e.postData.contents) {
      requestData = JSON.parse(e.postData.contents);
    } else {
      return createJsonResponse({ success: false, error: "요청 본문(Body)이 비어 있습니다." });
    }

    const action = requestData.action;
    const item = requestData.data || {};
    const now = Utilities.formatDate(new Date(), "GMT+9", "yyyy-MM-dd HH:mm:ss");

    if (action === "saveFarm") {
      const result = upsertRow(SHEET_FARMS, HEADERS.farms, item, "id", "FARM-", now);
      return createJsonResponse({ success: true, data: result });
    } 
    else if (action === "deleteFarm") {
      deleteRow(SHEET_FARMS, item.id);
      return createJsonResponse({ success: true, message: "농가 삭제 완료" });
    }
    else if (action === "savePrediction") {
      const result = upsertRow(SHEET_PREDICTIONS, HEADERS.predictions, item, "id", "PRED-", now);
      return createJsonResponse({ success: true, data: result });
    }
    else if (action === "deletePrediction") {
      deleteRow(SHEET_PREDICTIONS, item.id);
      return createJsonResponse({ success: true, message: "생산예측 삭제 완료" });
    }
    else if (action === "saveSettlement") {
      const result = upsertRow(SHEET_SETTLEMENTS, HEADERS.settlements, item, "id", "SET-", now);
      return createJsonResponse({ success: true, data: result });
    }
    else if (action === "deleteSettlement") {
      deleteRow(SHEET_SETTLEMENTS, item.id);
      return createJsonResponse({ success: true, message: "정산/이슈 삭제 완료" });
    }
    else {
      return createJsonResponse({ success: false, error: "알 수 없는 요청 action: " + action });
    }
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * 행 추가 또는 업데이트(Upsert) 공통 헬퍼
 */
function upsertRow(sheetName, headers, item, idKey, idPrefix, nowStr) {
  const sheet = getOrCreateSheet(sheetName, headers);
  const data = sheet.getDataRange().getValues();
  
  let targetRowIndex = -1;
  let itemId = item[idKey];

  // ID가 있으면 기존 행 찾기
  if (itemId) {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(itemId)) {
        targetRowIndex = i + 1; // 1-indexed
        break;
      }
    }
  } else {
    // 신규 ID 자동 생성
    itemId = idPrefix + Utilities.getUuid().substring(0, 8).toUpperCase();
    item[idKey] = itemId;
  }

  if (!item.created_at) {
    item.created_at = nowStr;
  }

  const rowValues = headers.map(key => item[key] !== undefined ? item[key] : "");

  if (targetRowIndex > 0) {
    // 기존 행 업데이트
    sheet.getRange(targetRowIndex, 1, 1, headers.length).setValues([rowValues]);
  } else {
    // 신규 행 추가
    sheet.appendRow(rowValues);
  }

  return item;
}

/**
 * 행 삭제 공통 헬퍼
 */
function deleteRow(sheetName, idValue) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(idValue)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

/**
 * JSON 응답 생성기 (CORS 호환)
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
