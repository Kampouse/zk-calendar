// ZK Calendar Availability Proof
//
// Proves that a given time slot is free WITHOUT revealing:
// - What other events exist
// - Where you are
// - What you're doing

global MAX_BUSY_SLOTS: u32 = 32;

// Returns the claimed free slot (public output) after proving no overlap
fn main(
    // PUBLIC outputs (return values)
    claim_start: pub u64,
    claim_duration: pub u64,

    // PRIVATE inputs: your busy slots - never revealed
    busy_starts: [u64; MAX_BUSY_SLOTS],
    busy_durations: [u64; MAX_BUSY_SLOTS],

    // PRIVATE: number of actual busy slots (rest are padding)
    num_busy: u32,
) {
    // For each busy slot, prove it does not overlap with the claimed free slot
    for i in 0..MAX_BUSY_SLOTS {
        let is_real = i < num_busy;

        if is_real {
            let busy_start = busy_starts[i];
            let busy_duration = busy_durations[i];

            let claim_end = claim_start + claim_duration * 60;
            let busy_end = busy_start + busy_duration * 60;

            let no_overlap_left = claim_end <= busy_start;
            let no_overlap_right = busy_end <= claim_start;
            let no_overlap = no_overlap_left | no_overlap_right;

            assert(no_overlap);
        }
    }
}
