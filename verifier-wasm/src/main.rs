//! ZK Calendar TEE Worker — OutLayer WASI component
//!
//! Stores Google OAuth credentials encrypted in TEE storage,
//! fetches calendar events, and generates ZK availability proofs.
//!
//! Actions:
//!   health              — version check
//!   store_credential   — store encrypted Google refresh token
//!   get_credential     — check if credential exists (never returns the token)
//!   delete_credential  — remove stored credential
//!   fetch_and_prove    — fetch Google Calendar + generate ZK proof
//!   find_available     — find free slots (from raw events)
//!   verify             — verify a time slot is free against events
//!   prove              — generate ZK proof placeholder for a slot

use outlayer::{env, storage};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use wasi_http_client::Client;

// ==================== Data Structures ====================

/// RFC 8984 JSCalendar event format
#[derive(Serialize, Deserialize, Clone, Debug)]
struct JSEvent {
    #[serde(rename = "@type")]
    type_: String,
    uid: String,
    #[serde(rename = "start")]
    start: String,
    duration: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    location: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    free_busy_status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    privacy: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    recurrence: Option<RecurrenceRule>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct RecurrenceRule {
    #[serde(rename = "@type")]
    type_: String,
    frequency: String,
    interval: Option<u32>,
}

/// Stored credential (encrypted by TEE)
#[derive(Serialize, Deserialize, Clone, Debug)]
struct StoredCredential {
    refresh_token: String,
    scopes: Vec<String>,
    stored_at: u64,
    account_id: String,
}

/// Calendar API response (Google Calendar V3)
#[derive(Deserialize, Debug)]
struct GoogleCalendarResponse {
    items: Option<Vec<GoogleEvent>>,
}

#[derive(Deserialize, Debug)]
struct GoogleEvent {
    id: Option<String>,
    start: Option<GoogleEventTime>,
    end: Option<GoogleEventTime>,
    summary: Option<String>,
    #[serde(default)]
    transparency: Option<String>,
    #[serde(default)]
    status: Option<String>,
}

#[derive(Deserialize, Debug)]
struct GoogleEventTime {
    date_time: Option<String>,
    date: Option<String>,
}

/// Google OAuth token response
#[derive(Deserialize, Debug)]
struct TokenResponse {
    access_token: String,
    #[serde(default)]
    expires_in: Option<u64>,
    #[serde(default)]
    token_type: Option<String>,
}

/// Incoming request
#[derive(Deserialize, Debug)]
struct CalendarRequest {
    action: String,

    // Credential storage
    #[serde(default)]
    refresh_token: Option<String>,
    #[serde(default)]
    account_id: Option<String>,

    // Calendar fetch + prove
    #[serde(default)]
    google_client_id: Option<String>,
    #[serde(default)]
    google_client_secret: Option<String>,

    // Find/verify/prove
    #[serde(default)]
    range_start: Option<String>,
    #[serde(default)]
    range_end: Option<String>,
    #[serde(default)]
    slot_duration: Option<String>,
    #[serde(default)]
    claim_start: Option<String>,
    #[serde(default)]
    claim_duration: Option<String>,

    // Raw events (for verify/prove without Google)
    #[serde(default)]
    events: Option<Vec<JSEvent>>,
}

/// OutLayer response
#[derive(Serialize)]
struct CalendarResponse {
    #[serde(rename = "@type")]
    type_: String,
    success: bool,
    message: String,
    uid: String,
    available_slots: Vec<JSEvent>,
    busy_count: u32,
    proof: Option<String>,
    verification_key: Option<String>,
    claim: Option<ClaimInfo>,
}

#[derive(Serialize)]
struct ClaimInfo {
    start: String,
    duration: String,
    free: bool,
}

// ==================== Storage Keys ====================

/// Worker-private encrypted storage key for Google credentials
fn cred_key(account_id: &str) -> String {
    format!("credential:{}", account_id)
}

/// Worker-private encrypted storage key for cached access tokens
fn token_key(account_id: &str) -> String {
    format!("access_token:{}", account_id)
}

// ==================== Main ====================

fn main() {
    std::panic::set_hook(Box::new(|p| eprintln!("PANIC: {}", p)));

    let input = env::input();

    let resp = match serde_json::from_slice::<CalendarRequest>(&input) {
        Ok(req) => handle(&req),
        Err(e) => CalendarResponse {
            type_: "Group".into(),
            success: false,
            message: format!("Bad request: {}", e),
            uid: new_uid(),
            available_slots: vec![],
            busy_count: 0,
            proof: None,
            verification_key: None,
            claim: None,
        },
    };

    let _ = env::output_json(&resp);
}

fn handle(req: &CalendarRequest) -> CalendarResponse {
    match req.action.as_str() {
        "health" => CalendarResponse {
            type_: "Group".into(),
            success: true,
            message: "zk-calendar-tee v0.4.0 (OutLayer + encrypted storage)".into(),
            uid: new_uid(),
            available_slots: vec![],
            busy_count: 0,
            proof: None,
            verification_key: None,
            claim: None,
        },

        "store_credential" => store_credential(req),
        "get_credential" => get_credential(req),
        "delete_credential" => delete_credential(req),
        "fetch_and_prove" => fetch_and_prove(req),

        "find_available" => {
            let events = req.events.as_deref().unwrap_or(&[]);
            let rs = req.range_start.as_deref().unwrap_or("2026-05-19T00:00:00Z");
            let re = req.range_end.as_deref().unwrap_or("2026-05-26T00:00:00Z");
            let dur = req.slot_duration.as_deref().unwrap_or("PT1H");
            find_available(events, rs, re, dur)
        }

        "verify" => {
            let events = req.events.as_deref().unwrap_or(&[]);
            let cs = req.claim_start.as_deref().unwrap_or("2026-05-19T14:00:00Z");
            let cd = req.claim_duration.as_deref().unwrap_or("PT1H");
            verify_claim(events, cs, cd)
        }

        "prove" => {
            let events = req.events.as_deref().unwrap_or(&[]);
            let cs = req.claim_start.as_deref().unwrap_or("2026-05-19T14:00:00Z");
            let cd = req.claim_duration.as_deref().unwrap_or("PT1H");
            let mut resp = verify_claim(events, cs, cd);
            resp.proof = Some("ZK_PROOF_V2_PLACEHOLDER".into());
            resp.verification_key = Some("VK_V2_PLACEHOLDER".into());
            resp
        }

        _ => CalendarResponse {
            type_: "Group".into(),
            success: false,
            message: format!("Unknown action: {}", req.action),
            uid: new_uid(),
            available_slots: vec![],
            busy_count: 0,
            proof: None,
            verification_key: None,
            claim: None,
        },
    }
}

// ==================== Credential Management ====================

fn store_credential(req: &CalendarRequest) -> CalendarResponse {
    let account_id = req.account_id.as_deref().unwrap_or("default");
    let refresh_token = match &req.refresh_token {
        Some(t) => t,
        None => return error_resp("store_credential", "refresh_token is required"),
    };

    let cred = StoredCredential {
        refresh_token: refresh_token.clone(),
        scopes: vec!["https://www.googleapis.com/auth/calendar.readonly".into()],
        stored_at: now_ms(),
        account_id: account_id.into(),
    };

    let data = match serde_json::to_vec(&cred) {
        Ok(d) => d,
        Err(e) => return error_resp("store_credential", &format!("serialize error: {}", e)),
    };

    // Store in worker-private encrypted storage — TEE handles encryption
    if let Err(e) = storage::set_worker(&cred_key(account_id), &data) {
        return error_resp("store_credential", &format!("storage error: {}", e));
    }

    CalendarResponse {
        type_: "Group".into(),
        success: true,
        message: format!("Credential stored for {} (encrypted in TEE)", account_id),
        uid: new_uid(),
        available_slots: vec![],
        busy_count: 0,
        proof: None,
        verification_key: None,
        claim: None,
    }
}

fn get_credential(req: &CalendarRequest) -> CalendarResponse {
    let account_id = req.account_id.as_deref().unwrap_or("default");

    // Only confirm existence — NEVER return the actual token via API
    match storage::get_worker(&cred_key(account_id)) {
        Ok(Some(_)) => CalendarResponse {
            type_: "Group".into(),
            success: true,
            message: format!("Credential exists for {}", account_id),
            uid: new_uid(),
            available_slots: vec![],
            busy_count: 0,
            proof: None,
            verification_key: None,
            claim: None,
        },
        Ok(None) => CalendarResponse {
            type_: "Group".into(),
            success: false,
            message: format!("No credential found for {}", account_id),
            uid: new_uid(),
            available_slots: vec![],
            busy_count: 0,
            proof: None,
            verification_key: None,
            claim: None,
        },
        Err(e) => error_resp("get_credential", &format!("storage error: {}", e)),
    }
}

fn delete_credential(req: &CalendarRequest) -> CalendarResponse {
    let account_id = req.account_id.as_deref().unwrap_or("default");

    let cred_deleted = storage::delete(&cred_key(account_id));
    let token_deleted = storage::delete(&token_key(account_id));

    CalendarResponse {
        type_: "Group".into(),
        success: true,
        message: format!(
            "Deleted credential for {} (cred={}, token={})",
            account_id, cred_deleted, token_deleted
        ),
        uid: new_uid(),
        available_slots: vec![],
        busy_count: 0,
        proof: None,
        verification_key: None,
        claim: None,
    }
}

// ==================== Google Calendar Fetch ====================

fn fetch_and_prove(req: &CalendarRequest) -> CalendarResponse {
    let account_id = req.account_id.as_deref().unwrap_or("default");

    // 1. Get encrypted credential from TEE storage (auto-decryption inside enclave)
    let cred_data = match storage::get_worker(&cred_key(account_id)) {
        Ok(Some(d)) => d,
        Ok(None) => {
            return error_resp(
                "fetch_and_prove",
                &format!(
                    "No credential for {}. Call store_credential first.",
                    account_id
                ),
            )
        }
        Err(e) => return error_resp("fetch_and_prove", &format!("storage error: {}", e)),
    };

    let cred: StoredCredential = match serde_json::from_slice(&cred_data) {
        Ok(c) => c,
        Err(e) => {
            return error_resp("fetch_and_prove", &format!("credential parse error: {}", e))
        }
    };

    // 2. Get Google client credentials from environment or request
    let env_client_id = env::var("GOOGLE_CLIENT_ID").unwrap_or_default();
    let env_client_secret = env::var("GOOGLE_CLIENT_SECRET").unwrap_or_default();

    let client_id = req
        .google_client_id
        .as_deref()
        .filter(|s| !s.is_empty())
        .unwrap_or(&env_client_id);
    let client_secret = req
        .google_client_secret
        .as_deref()
        .filter(|s| !s.is_empty())
        .unwrap_or(&env_client_secret);

    if client_id.is_empty() || client_secret.is_empty() {
        return error_resp(
            "fetch_and_prove",
            "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET required (env var or request param)",
        );
    }

    // 3. Refresh the Google access token (inside TEE — token never leaks)
    let access_token = match refresh_google_token(&cred.refresh_token, client_id, client_secret) {
        Ok(t) => t,
        Err(e) => {
            return error_resp("fetch_and_prove", &format!("token refresh failed: {}", e))
        }
    };

    // 4. Cache the access token in worker storage
    let _ = storage::set_worker(&token_key(account_id), access_token.as_bytes());

    // 5. Fetch calendar events from Google
    let range_start = req.range_start.as_deref().unwrap_or("2026-05-19T00:00:00Z");
    let range_end = req.range_end.as_deref().unwrap_or("2026-05-26T00:00:00Z");

    let events = match fetch_google_events(&access_token, range_start, range_end) {
        Ok(evts) => evts,
        Err(e) => {
            return error_resp("fetch_and_prove", &format!("calendar fetch failed: {}", e))
        }
    };

    // 6. Convert to JSCalendar format (privacy: no titles)
    let js_events: Vec<JSEvent> = events
        .iter()
        .map(|e| JSEvent {
            type_: "Event".into(),
            uid: e.id.clone().unwrap_or_default(),
            start: e
                .start
                .as_ref()
                .and_then(|s| s.date_time.clone())
                .unwrap_or_default(),
            duration: "PT1H".into(),
            title: None, // privacy — never reveal event titles
            location: None,
            status: e.status.clone(),
            free_busy_status: Some(
                if e.transparency.as_deref() == Some("transparent") {
                    "free".into()
                } else {
                    "busy".into()
                },
            ),
            privacy: Some("private".into()),
            recurrence: None,
        })
        .collect();

    // 7. Find available slots
    let slot_dur = req.slot_duration.as_deref().unwrap_or("PT1H");
    let mut resp = find_available(&js_events, range_start, range_end, slot_dur);

    // 8. Generate ZK proof placeholder
    resp.proof = Some("ZK_PROOF_V2_PLACEHOLDER".into());
    resp.verification_key = Some("VK_V2_PLACEHOLDER".into());
    resp.message = format!(
        "Fetched {} events from Google Calendar for {} (inside TEE)",
        events.len(),
        account_id
    );

    resp
}

fn refresh_google_token(
    refresh_token: &str,
    client_id: &str,
    client_secret: &str,
) -> Result<String, String> {
    let body_json = serde_json::json!({
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token"
    });
    let body_bytes =
        serde_json::to_vec(&body_json).map_err(|e| format!("json error: {}", e))?;

    let response = Client::new()
        .post("https://oauth2.googleapis.com/token")
        .header("Content-Type", "application/json")
        .body(&body_bytes)
        .connect_timeout(Duration::from_secs(10))
        .send()
        .map_err(|e| format!("HTTP error: {}", e))?;

    let status = response.status();
    let body = response.body().map_err(|e| format!("body read error: {}", e))?;

    if status != 200 {
        let body_str = String::from_utf8_lossy(&body);
        return Err(format!("Google OAuth returned {}: {}", status, body_str));
    }

    let token: TokenResponse =
        serde_json::from_slice(&body).map_err(|e| format!("token parse error: {}", e))?;

    Ok(token.access_token)
}

fn fetch_google_events(
    access_token: &str,
    range_start: &str,
    range_end: &str,
) -> Result<Vec<GoogleEvent>, String> {
    let url = format!(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin={}&timeMax={}&singleEvents=true",
        urlencoding(range_start),
        urlencoding(range_end),
    );

    let response = Client::new()
        .get(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .connect_timeout(Duration::from_secs(10))
        .send()
        .map_err(|e| format!("HTTP error: {}", e))?;

    let status = response.status();
    let body = response
        .body()
        .map_err(|e| format!("body read error: {}", e))?;

    if status != 200 {
        let body_str = String::from_utf8_lossy(&body);
        return Err(format!(
            "Google Calendar API returned {}: {}",
            status,
            body_str
        ));
    }

    let cal: GoogleCalendarResponse =
        serde_json::from_slice(&body).map_err(|e| format!("calendar parse error: {}", e))?;

    Ok(cal.items.unwrap_or_default())
}

fn urlencoding(s: &str) -> String {
    s.replace(':', "%3A").replace('+', "%2B")
}

// ==================== Calendar Logic ====================

fn find_available(
    events: &[JSEvent],
    range_start: &str,
    range_end: &str,
    slot_dur: &str,
) -> CalendarResponse {
    let rs = parse_utc(range_start);
    let re = parse_utc(range_end);
    let dur_secs = parse_duration(slot_dur);

    if rs == 0 || re == 0 || dur_secs == 0 {
        return error_resp("find_available", "Invalid range or duration");
    }

    let busy = parse_busy(events);

    let mut free_slots = vec![];
    let mut t = rs;
    while t + dur_secs <= re {
        let slot_end = t + dur_secs;
        let is_free = busy.iter().all(|(bs, be)| slot_end <= *bs || *be <= t);
        if is_free {
            free_slots.push(JSEvent {
                type_: "Event".into(),
                uid: format!("free-{}", t),
                start: format_utc(t),
                duration: slot_dur.to_string(),
                title: None,
                location: None,
                status: Some("confirmed".into()),
                free_busy_status: Some("free".into()),
                privacy: Some("private".into()),
                recurrence: None,
            });
        }
        t += dur_secs;
    }

    CalendarResponse {
        type_: "Group".into(),
        success: true,
        message: format!(
            "{} free slots found (checked against {} events)",
            free_slots.len(),
            events.len()
        ),
        uid: format!("availability-{}", rs),
        available_slots: free_slots,
        busy_count: events.len() as u32,
        proof: None,
        verification_key: None,
        claim: None,
    }
}

fn verify_claim(events: &[JSEvent], claim_start: &str, claim_dur: &str) -> CalendarResponse {
    let cs = parse_utc(claim_start);
    let dur = parse_duration(claim_dur);
    let ce = cs + dur;

    let busy = parse_busy(events);
    let mut conflicts = 0;

    for (bs, be) in &busy {
        if !(ce <= *bs || *be <= cs) {
            conflicts += 1;
        }
    }

    let free = conflicts == 0;
    CalendarResponse {
        type_: "Group".into(),
        success: free,
        message: if free {
            "Slot is free (verified)".into()
        } else {
            format!("{} conflicts found", conflicts)
        },
        uid: format!("claim-{}", cs),
        available_slots: if free {
            vec![JSEvent {
                type_: "Event".into(),
                uid: format!("verified-{}", cs),
                start: claim_start.to_string(),
                duration: claim_dur.to_string(),
                title: Some("Verified Free Slot".into()),
                location: None,
                status: Some("confirmed".into()),
                free_busy_status: Some("free".into()),
                privacy: Some("private".into()),
                recurrence: None,
            }]
        } else {
            vec![]
        },
        busy_count: events.len() as u32,
        proof: None,
        verification_key: None,
        claim: Some(ClaimInfo {
            start: claim_start.to_string(),
            duration: claim_dur.to_string(),
            free,
        }),
    }
}

// ==================== Helpers ====================

fn parse_busy(events: &[JSEvent]) -> Vec<(u64, u64)> {
    events
        .iter()
        .filter(|e| e.free_busy_status.as_deref() != Some("free"))
        .filter(|e| e.status.as_deref() != Some("cancelled"))
        .filter_map(|e| {
            let s = parse_utc(&e.start);
            let dur = parse_duration(&e.duration);
            if s > 0 && dur > 0 {
                Some((s, s + dur))
            } else {
                None
            }
        })
        .collect()
}

fn parse_utc(s: &str) -> u64 {
    let s = s.trim().trim_end_matches('Z');
    let parts: Vec<&str> = s.split('T').collect();
    if parts.len() != 2 {
        return 0;
    }
    let dp: Vec<u32> = parts[0].split('-').filter_map(|x| x.parse().ok()).collect();
    let tp: Vec<u32> = parts[1].split(':').filter_map(|x| x.parse().ok()).collect();
    if dp.len() != 3 || tp.len() < 2 {
        return 0;
    }

    // Pre-computed day-of-year offsets (2020-2031)
    let year_starts: [(u64, u64); 12] = [
        (2020, 18262), (2021, 18628), (2022, 18993), (2023, 19358),
        (2024, 19723), (2025, 20089), (2026, 20454), (2027, 20819),
        (2028, 21184), (2029, 21550), (2030, 21915), (2031, 22280),
    ];
    let mdays = [0u64, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

    let y = dp[0] as u64;
    let mut days = 0u64;
    for &(yr, ys) in &year_starts {
        if yr == y {
            days = ys;
            break;
        }
    }
    if days == 0 {
        return 0;
    }

    let m = dp[1] as u64;
    let d = dp[2] as u64;
    let leap = (y % 4 == 0 && (y % 100 != 0 || y % 400 == 0));
    days += mdays.get(m as usize - 1).unwrap_or(&0);
    if m > 2 && leap {
        days += 1;
    }
    days += d - 1;

    days * 86400 + tp[0] as u64 * 3600 + tp[1] as u64 * 60 + tp.get(2).copied().unwrap_or(0) as u64
}

fn format_utc(ts: u64) -> String {
    let d = ts / 86400;
    let t = ts % 86400;
    let (year, month, day) = days_to_date(d);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year,
        month,
        day,
        t / 3600,
        (t % 3600) / 60,
        t % 60
    )
}

fn days_to_date(days: u64) -> (u64, u64, u64) {
    let year_starts: [(u64, u64); 12] = [
        (2020, 18262), (2021, 18628), (2022, 18993), (2023, 19358),
        (2024, 19723), (2025, 20089), (2026, 20454), (2027, 20819),
        (2028, 21184), (2029, 21550), (2030, 21915), (2031, 22280),
    ];
    let mdays = [0u64, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

    for i in (0..year_starts.len()).rev() {
        let (y, ys) = year_starts[i];
        if days >= ys {
            let day_of_year = days - ys;
            let leap = (y % 4 == 0 && (y % 100 != 0 || y % 400 == 0)) as u64;
            for m in (0..12).rev() {
                let mstart = mdays[m] + if m > 1 { leap } else { 0 };
                if day_of_year >= mstart {
                    return (y, (m + 1) as u64, day_of_year - mstart + 1);
                }
            }
        }
    }
    (2026, 1, 1)
}

fn parse_duration(s: &str) -> u64 {
    let mut secs: u64 = 0;
    let mut num: u64 = 0;
    let mut in_time = false;

    for c in s.chars() {
        match c {
            'P' => continue,
            'T' => {
                in_time = true;
                continue;
            }
            '0'..='9' => {
                num = num * 10 + (c as u64 - '0' as u64);
            }
            'D' => {
                secs = secs.saturating_add(num * 86400);
                num = 0;
            }
            'H' if in_time => {
                secs = secs.saturating_add(num * 3600);
                num = 0;
            }
            'M' if in_time => {
                secs = secs.saturating_add(num * 60);
                num = 0;
            }
            'S' if in_time => {
                secs = secs.saturating_add(num);
                num = 0;
            }
            _ => {
                num = 0;
            }
        }
    }
    secs
}

fn new_uid() -> String {
    format!("zk-cal-{}", now_ms())
}

fn now_ms() -> u64 {
    // OutLayer provides timestamps via env vars or VRF; approximate for now
    // In production, use VRF output or storage-based counter
    0
}

fn error_resp(action: &str, msg: &str) -> CalendarResponse {
    CalendarResponse {
        type_: "Group".into(),
        success: false,
        message: format!("{}: {}", action, msg),
        uid: new_uid(),
        available_slots: vec![],
        busy_count: 0,
        proof: None,
        verification_key: None,
        claim: None,
    }
}