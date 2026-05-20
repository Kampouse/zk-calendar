use std::io::{self, Read, Write};
use serde::{Deserialize, Serialize};

// RFC 8984 JSCalendar format
#[derive(Serialize, Deserialize)]
struct JSEvent {
    #[serde(rename = "@type")]
    type_: String, // "Event"
    uid: String,
    #[serde(rename = "start")]
    start: String, // UTCDateTime: "2026-05-19T14:00:00Z"
    duration: String, // Duration: "PT1H" (ISO 8601)
    #[serde(skip_serializing_if = "Option::is_none")]
    title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    location: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    status: Option<String>, // "confirmed", "tentative", "cancelled"
    #[serde(skip_serializing_if = "Option::is_none")]
    free_busy_status: Option<String>, // "free", "busy"
    #[serde(skip_serializing_if = "Option::is_none")]
    privacy: Option<String>, // "public", "private", "secret"
    #[serde(skip_serializing_if = "Option::is_none")]
    recurrence: Option<RecurrenceRule>,
}

#[derive(Serialize, Deserialize)]
struct RecurrenceRule {
    #[serde(rename = "@type")]
    type_: String,
    frequency: String,
    interval: Option<u32>,
}

// JSCalendar Group (represents availability proof)
#[derive(Serialize, Deserialize)]
struct JSGroup {
    #[serde(rename = "@type")]
    type_: String, // "Group"
    uid: String,
    name: String,
    entries: Vec<String>, // event UIDs
}

// Incoming request to OutLayer
#[derive(Deserialize)]
struct CalendarRequest {
    action: String,
    
    // For "find_available" - range to search
    range_start: Option<String>, // UTCDateTime
    range_end: Option<String>,
    slot_duration: Option<String>, // "PT1H"
    
    // For "verify" - check a specific slot
    claim_start: Option<String>,
    claim_duration: Option<String>,
    
    // Calendar events (JSCalendar format)
    events: Option<Vec<JSEvent>>,
    
    // For "prove" - generate proof from events
    calendar_token: Option<String>,
}

// OutLayer response (also JSCalendar-compatible)
#[derive(Serialize)]
struct CalendarResponse {
    #[serde(rename = "@type")]
    type_: String,
    success: bool,
    message: String,
    uid: String,
    
    // Available slots as JSCalendar Events
    available_slots: Vec<JSEvent>,
    
    // Busy slots that were checked (without private details)
    busy_count: u32,
    
    // ZK proof (V2)
    proof: Option<String>,
    verification_key: Option<String>,
    
    // Public claim
    claim: Option<ClaimInfo>,
}

#[derive(Serialize)]
struct ClaimInfo {
    start: String,
    duration: String,
    free: bool,
}

fn main() {
    std::panic::set_hook(Box::new(|p| eprintln!("PANIC: {}", p)));

    let mut buf = Vec::new();
    io::stdin().read_to_end(&mut buf).unwrap_or(0);
    eprintln!("zk-calendar: {} bytes input", buf.len());

    let resp = match serde_json::from_slice::<CalendarRequest>(&buf) {
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

    let out = serde_json::to_string(&resp).unwrap();
    io::stdout().write_all(out.as_bytes()).unwrap();
}

fn handle(req: &CalendarRequest) -> CalendarResponse {
    match req.action.as_str() {
        "health" => CalendarResponse {
            type_: "Group".into(),
            success: true,
            message: "zk-calendar-tee v0.3.0 (JSCalendar RFC 8984)".into(),
            uid: new_uid(),
            available_slots: vec![],
            busy_count: 0,
            proof: None,
            verification_key: None,
            claim: None,
        },

        "find_available" => {
            let events = req.events.as_deref().unwrap_or(&[]);
            let range_start = req.range_start.as_deref().unwrap_or("2026-05-19T00:00:00Z");
            let range_end = req.range_end.as_deref().unwrap_or("2026-05-26T00:00:00Z");
            let slot_dur = req.slot_duration.as_deref().unwrap_or("PT1H");
            find_available(events, range_start, range_end, slot_dur)
        }

        "verify" => {
            let events = req.events.as_deref().unwrap_or(&[]);
            let claim_start = req.claim_start.as_deref().unwrap_or("2026-05-19T14:00:00Z");
            let claim_dur = req.claim_duration.as_deref().unwrap_or("PT1H");
            verify_claim(events, claim_start, claim_dur)
        }

        "prove" => {
            // V2: actual ZK proof generation
            let events = req.events.as_deref().unwrap_or(&[]);
            let claim_start = req.claim_start.as_deref().unwrap_or("2026-05-19T14:00:00Z");
            let claim_dur = req.claim_duration.as_deref().unwrap_or("PT1H");
            let mut resp = verify_claim(events, claim_start, claim_dur);
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

fn find_available(events: &[JSEvent], range_start: &str, range_end: &str, slot_dur: &str) -> CalendarResponse {
    let rs = parse_utc(range_start);
    let re = parse_utc(range_end);
    let dur_secs = parse_duration(slot_dur);
    
    if rs == 0 || re == 0 || dur_secs == 0 {
        return CalendarResponse {
            type_: "Group".into(),
            success: false,
            message: "Invalid range or duration".into(),
            uid: new_uid(),
            available_slots: vec![],
            busy_count: events.len() as u32,
            proof: None,
            verification_key: None,
            claim: None,
        };
    }

    // Parse busy intervals from events
    let busy = parse_busy(events);

    // Find free slots
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
        message: format!("{} free slots found (checked against {} events)", free_slots.len(), events.len()),
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
        message: if free { "Slot is free (verified)".into() } else { format!("{} conflicts found", conflicts) },
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

fn parse_busy(events: &[JSEvent]) -> Vec<(u64, u64)> {
    events.iter()
        .filter(|e| e.free_busy_status.as_deref() != Some("free"))
        .filter(|e| e.status.as_deref() != Some("cancelled"))
        .filter_map(|e| {
            let s = parse_utc(&e.start);
            let dur = parse_duration(&e.duration);
            if s > 0 && dur > 0 { Some((s, s + dur)) } else { None }
        })
        .collect()
}

// Parse "2026-05-19T14:00:00Z" -> unix timestamp
fn parse_utc(s: &str) -> u64 {
    let s = s.trim().trim_end_matches('Z');
    let parts: Vec<&str> = s.split('T').collect();
    if parts.len() != 2 { return 0; }
    let dp: Vec<u32> = parts[0].split('-').filter_map(|x| x.parse().ok()).collect();
    let tp: Vec<u32> = parts[1].split(':').filter_map(|x| x.parse().ok()).collect();
    if dp.len() != 3 || tp.len() < 2 { return 0; }
    
    let year_starts: [(u64, u64); 12] = [
        (2020, 18262), (2021, 18628), (2022, 18993), (2023, 19358),
        (2024, 19723), (2025, 20089), (2026, 20454), (2027, 20819),
        (2028, 21184), (2029, 21550), (2030, 21915), (2031, 22280),
    ];
    let mdays = [0u64, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    
    let y = dp[0] as u64;
    let mut days = 0u64;
    for &(yr, ys) in &year_starts {
        if yr == y { days = ys; break; }
    }
    if days == 0 { return 0; }
    
    let m = dp[1] as u64;
    let d = dp[2] as u64;
    let leap = (y % 4 == 0 && (y % 100 != 0 || y % 400 == 0));
    days += mdays.get(m as usize - 1).unwrap_or(&0);
    if m > 2 && leap { days += 1; }
    days += d - 1;
    
    days * 86400 + tp[0] as u64 * 3600 + tp[1] as u64 * 60 + tp.get(2).copied().unwrap_or(0) as u64
}

// unix timestamp -> "2026-05-19T14:00:00Z"
fn format_utc(ts: u64) -> String {
    let d = ts / 86400;
    let t = ts % 86400;
    let (year, month, day) = days_to_date(d);
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", year, month, day, t/3600, (t%3600)/60, t%60)
}

fn days_to_date(days: u64) -> (u64, u64, u64) {
    // Simple lookup for common years 2020-2030
    // Precomputed cumulative days from epoch for Jan 1 of each year
    let year_starts: [(u64, u64); 12] = [
        (2020, 18262), (2021, 18628), (2022, 18993), (2023, 19358),
        (2024, 19723), (2025, 20089), (2026, 20454), (2027, 20819),
        (2028, 21184), (2029, 21550), (2030, 21915), (2031, 22280),
    ];
    let mdays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    
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

// Parse ISO 8601 duration: "PT1H", "PT30M", "PT1H30M", "P1D"
fn parse_duration(s: &str) -> u64 {
    let mut secs: u64 = 0;
    let mut num: u64 = 0;
    let mut in_time = false;
    
    for c in s.chars() {
        match c {
            'P' => continue,
            'T' => { in_time = true; continue; }
            '0'..='9' => {
                num = num * 10 + (c as u64 - '0' as u64);
            }
            'D' => { secs = secs.saturating_add(num * 86400); num = 0; }
            'H' if in_time => { secs = secs.saturating_add(num * 3600); num = 0; }
            'M' if in_time => { secs = secs.saturating_add(num * 60); num = 0; }
            'S' if in_time => { secs = secs.saturating_add(num); num = 0; }
            _ => { num = 0; }
        }
    }
    secs
}

fn new_uid() -> String {
    format!("zk-cal-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis())
}
