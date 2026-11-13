/**
 * NASA Space Apps Challenge - Cairo Venue Operations
 * Help Desk Requests & Task Management Backend (Google Apps Script)
 * Sheet ID: 1DS0NdFr91kCVAOi_YTrd_suV2DnEadu_U5qTyhPJ4Iw
 * Sheet Tab: Requests
 * 
 * Column Schema:
 * A: TaskID
 * B: Timestamp
 * C: TeamAssigned (TechOps / Logistics / Competition)
 * D: Floor
 * E: Room
 * F: IssueDescription
 * G: Status (Open / In Progress / Resolved / Done)
 * H: ClaimedBy
 * I: WifiData
 * J: Details
 * K: Reporter
 * L: ClaimedAt
 * M: ResolvedAt
 * N: HandedBy
 */

const SHEET_NAME = "Requests";

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      "TaskID", "Timestamp", "TeamAssigned", "Floor", "Room",
      "IssueDescription", "Status", "ClaimedBy", "WifiData",
      "Details", "Reporter", "ClaimedAt", "ResolvedAt", "HandedBy"
    ]);
  }
  return sheet;
}

function formatDate(d) {
  const date = d || new Date();
  const pad = n => (n < 10 ? "0" + n : n);
  const Y = date.getFullYear();
  const M = pad(date.getMonth() + 1);
  const D = pad(date.getDate());
  const h = pad(date.getHours());
  const m = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}

function jsonResponse(data, callback) {
  const jsonStr = JSON.stringify(data);
  if (callback) {
    return ContentService.createTextOutput(`${callback}(${jsonStr})`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(jsonStr)
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle GET requests: Fetch tasks with optional filters
 * Query parameters:
 *   ?team=TechOps | Logistics | Competition | all
 *   ?status=Open | Done | all
 *   ?callback=myCallback (for JSONP)
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const teamFilter = (params.team || "").toLowerCase();
    const statusFilter = (params.status || "").toLowerCase();
    const callback = params.callback;

    const sheet = getSheet();
    const rows = sheet.getDataRange().getValues();
    if (!rows || rows.length < 2) {
      return jsonResponse({ ok: true, data: [], reports: [] }, callback);
    }

    const headers = rows[0].map(h => String(h || "").trim().toLowerCase());
    const col = {
      id: headers.indexOf("taskid"),
      ts: headers.indexOf("timestamp"),
      team: headers.indexOf("teamassigned"),
      floor: headers.indexOf("floor"),
      room: headers.indexOf("room"),
      issue: headers.indexOf("issuedescription"),
      status: headers.indexOf("status"),
      claimedBy: headers.indexOf("claimedby"),
      wifi: headers.indexOf("wifidata"),
      details: headers.indexOf("details"),
      reporter: headers.indexOf("reporter"),
      claimedAt: headers.indexOf("claimedat"),
      resolvedAt: headers.indexOf("resolvedat"),
      handedBy: headers.indexOf("handedby")
    };

    const tasks = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const id = String(col.id >= 0 ? row[col.id] : row[0] || "").trim();
      if (!id) continue;

      const team = String(col.team >= 0 ? row[col.team] : "").trim() || "TechOps";
      const rawStatus = String(col.status >= 0 ? row[col.status] : "New").trim();
      const status = (rawStatus.toLowerCase() === "done" || rawStatus.toLowerCase() === "resolved") ? "Resolved" : (rawStatus.toLowerCase() === "in progress" || rawStatus.toLowerCase() === "claimed" ? "In Progress" : "New");

      // Filter by team
      if (teamFilter && teamFilter !== "all" && team.toLowerCase() !== teamFilter) {
        continue;
      }

      // Filter by status
      if (statusFilter && statusFilter !== "all") {
        if (statusFilter === "open" && status === "Resolved") continue;
        if (statusFilter === "done" && status !== "Resolved") continue;
      }

      const item = {
        id: id,
        taskId: id,
        ts: String(col.ts >= 0 ? row[col.ts] : "").trim(),
        timestamp: String(col.ts >= 0 ? row[col.ts] : "").trim(),
        team: team,
        teamAssigned: team,
        floor: String(col.floor >= 0 ? row[col.floor] : "").trim(),
        room: String(col.room >= 0 ? row[col.room] : "").trim(),
        issue: String(col.issue >= 0 ? row[col.issue] : "").trim(),
        issueDescription: String(col.issue >= 0 ? row[col.issue] : "").trim(),
        details: String(col.details >= 0 ? row[col.details] : "").trim(),
        status: status,
        assigned: String(col.claimedBy >= 0 ? row[col.claimedBy] : "").trim(),
        claimedBy: String(col.claimedBy >= 0 ? row[col.claimedBy] : "").trim(),
        wifi: String(col.wifi >= 0 ? row[col.wifi] : "").trim(),
        wifiData: String(col.wifi >= 0 ? row[col.wifi] : "").trim(),
        reporter: String(col.reporter >= 0 ? row[col.reporter] : "").trim(),
        claimedAt: String(col.claimedAt >= 0 ? row[col.claimedAt] : "").trim(),
        resolvedAt: String(col.resolvedAt >= 0 ? row[col.resolvedAt] : "").trim(),
        handedBy: String(col.handedBy >= 0 ? row[col.handedBy] : "").trim()
      };
      tasks.push(item);
    }

    return jsonResponse({ ok: true, data: tasks, reports: tasks, count: tasks.length }, callback);
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message || String(err) }, e && e.parameter && e.parameter.callback);
  }
}

/**
 * Handle POST requests: Create new tasks, Claim, Resolve (Mark Done), Handout
 * Payload can be application/json or urlencoded / text/plain
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // 10s concurrency lock
  } catch (err) {
    return jsonResponse({ ok: false, error: "Server busy, please retry in a moment." });
  }

  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (ex) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = String(payload.action || "create").toLowerCase();
    const sheet = getSheet();
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0].map(h => String(h || "").trim().toLowerCase());

    const col = {
      id: headers.indexOf("taskid"),
      ts: headers.indexOf("timestamp"),
      team: headers.indexOf("teamassigned"),
      floor: headers.indexOf("floor"),
      room: headers.indexOf("room"),
      issue: headers.indexOf("issuedescription"),
      status: headers.indexOf("status"),
      claimedBy: headers.indexOf("claimedby"),
      wifi: headers.indexOf("wifidata"),
      details: headers.indexOf("details"),
      reporter: headers.indexOf("reporter"),
      claimedAt: headers.indexOf("claimedat"),
      resolvedAt: headers.indexOf("resolvedat"),
      handedBy: headers.indexOf("handedby")
    };

    // ------------------------------------------------------------------------
    // ACTION: CREATE (New submission from form)
    // ------------------------------------------------------------------------
    if (action === "create" || action === "new" || action === "add") {
      const team = payload.team || payload.teamAssigned || "TechOps";
      const prefix = team === "Logistics" ? "LGR-" : (team === "Competition" ? "CMP-" : "RPT-");
      const randNum = Math.floor(100 + Math.random() * 900);
      const taskId = payload.id || payload.taskId || (prefix + randNum);
      const nowStr = formatDate(new Date());

      const floor = payload.floor || "";
      const room = payload.room || "";
      const issue = payload.issue || payload.issueDescription || "";
      const details = payload.details || "";
      const status = payload.status || "Open";
      const claimedBy = payload.claimedBy || payload.assigned || "";
      const wifiData = payload.wifiData || payload.wifi || "";
      const reporter = payload.reporter || "";

      // Ensure row matches schema width
      const newRow = new Array(headers.length).fill("");
      if (col.id >= 0) newRow[col.id] = taskId;
      if (col.ts >= 0) newRow[col.ts] = nowStr;
      if (col.team >= 0) newRow[col.team] = team;
      if (col.floor >= 0) newRow[col.floor] = floor;
      if (col.room >= 0) newRow[col.room] = room;
      if (col.issue >= 0) newRow[col.issue] = issue;
      if (col.status >= 0) newRow[col.status] = status;
      if (col.claimedBy >= 0) newRow[col.claimedBy] = claimedBy;
      if (col.wifi >= 0) newRow[col.wifi] = wifiData;
      if (col.details >= 0) newRow[col.details] = details;
      if (col.reporter >= 0) newRow[col.reporter] = reporter;

      sheet.appendRow(newRow);

      lock.releaseLock();
      return jsonResponse({
        ok: true,
        id: taskId,
        taskId: taskId,
        status: status,
        team: team,
        message: "Request logged successfully"
      });
    }

    // ------------------------------------------------------------------------
    // ACTION: CLAIM, RESOLVE / DONE, HANDOUT, UPDATE
    // ------------------------------------------------------------------------
    const targetId = String(payload.id || payload.taskId || "").trim();
    if (!targetId) {
      lock.releaseLock();
      return jsonResponse({ ok: false, error: "Missing TaskID" });
    }

    let foundRowIndex = -1;
    for (let r = 1; r < rows.length; r++) {
      const cellId = String(col.id >= 0 ? rows[r][col.id] : rows[r][0] || "").trim();
      if (cellId.toLowerCase() === targetId.toLowerCase()) {
        foundRowIndex = r + 1; // 1-based index in Sheet
        break;
      }
    }

    if (foundRowIndex === -1) {
      lock.releaseLock();
      return jsonResponse({ ok: false, error: `Task ${targetId} not found in sheet.` });
    }

    const nowStr = formatDate(new Date());

    if (action === "claim") {
      const member = payload.user || payload.claimedBy || payload.assigned || "Volunteer";
      if (col.status >= 0) sheet.getRange(foundRowIndex, col.status + 1).setValue("In Progress");
      if (col.claimedBy >= 0) sheet.getRange(foundRowIndex, col.claimedBy + 1).setValue(member);
      if (col.claimedAt >= 0) sheet.getRange(foundRowIndex, col.claimedAt + 1).setValue(nowStr);

      lock.releaseLock();
      return jsonResponse({
        ok: true,
        id: targetId,
        status: "In Progress",
        assigned: member,
        claimedBy: member,
        claimedAt: nowStr
      });
    }

    if (action === "resolve" || action === "done") {
      if (col.status >= 0) sheet.getRange(foundRowIndex, col.status + 1).setValue("Done");
      if (col.resolvedAt >= 0) sheet.getRange(foundRowIndex, col.resolvedAt + 1).setValue(nowStr);
      if (payload.user && col.claimedBy >= 0) {
        const curClaimed = sheet.getRange(foundRowIndex, col.claimedBy + 1).getValue();
        if (!curClaimed) sheet.getRange(foundRowIndex, col.claimedBy + 1).setValue(payload.user);
      }

      lock.releaseLock();
      return jsonResponse({
        ok: true,
        id: targetId,
        status: "Resolved",
        resolvedAt: nowStr
      });
    }

    if (action === "handout") {
      const member = payload.member || payload.assigned || "";
      const handedBy = payload.user || payload.handedBy || "";
      if (col.status >= 0) sheet.getRange(foundRowIndex, col.status + 1).setValue("In Progress");
      if (col.claimedBy >= 0) sheet.getRange(foundRowIndex, col.claimedBy + 1).setValue(member);
      if (col.handedBy >= 0) sheet.getRange(foundRowIndex, col.handedBy + 1).setValue(handedBy);

      lock.releaseLock();
      return jsonResponse({
        ok: true,
        id: targetId,
        status: "In Progress",
        assigned: member,
        handedBy: handedBy
      });
    }

    // Generic update
    if (payload.status && col.status >= 0) {
      sheet.getRange(foundRowIndex, col.status + 1).setValue(payload.status);
    }
    if (payload.claimedBy && col.claimedBy >= 0) {
      sheet.getRange(foundRowIndex, col.claimedBy + 1).setValue(payload.claimedBy);
    }

    lock.releaseLock();
    return jsonResponse({ ok: true, id: targetId, message: "Task updated" });

  } catch (err) {
    try { lock.releaseLock(); } catch (e) {}
    return jsonResponse({ ok: false, error: err.message || String(err) });
  }
}
