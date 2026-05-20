import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend, UltraHonkVerifierBackend } from '@aztec/bb.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CIRCUIT_PATH = join(__dirname, '..', 'noir-circuit', 'target', 'calendar_availability.json');

async function main() {
    console.log('Loading circuit...');
    const circuit = JSON.parse(readFileSync(CIRCUIT_PATH, 'utf-8'));
    
    const backend = new UltraHonkBackend(circuit);
    const noir = new Noir(circuit, backend);

    console.log('Generating ZK proof...');
    
    // Claim: slot at 10pm (1747674000) for 60min is free
    // Busy: 8pm-9pm and midnight-1am (no overlap with 10pm)
    const inputs = {
        claim_start: "1747674000",
        claim_duration: "60",
        busy_starts: Array(32).fill("0").map((_, i) => i === 0 ? "1747665600" : i === 1 ? "1747680000" : "0"),
        busy_durations: Array(32).fill("0").map((_, i) => i < 2 ? "60" : "0"),
        num_busy: "2",
    };

    console.log('Claiming free slot: 10pm for 60min');
    console.log('Actual busy: 8pm-9pm, midnight-1am (no overlap)\n');
    
    // Execute circuit (compute witness)
    console.log('Computing witness...');
    const { witness, returnValue } = await noir.execute(inputs);
    console.log('Witness computed:', witness.length, 'bytes');
    
    // Generate proof
    console.log('Generating ZK proof...');
    const { proof } = await backend.generateProof(witness);
    console.log('Proof generated:', proof.length, 'bytes');
    
    // Verify the proof
    console.log('\nVerifying proof...');
    const isValid = await backend.verifyProof({ proof, publicInputs: returnValue });
    console.log('Proof valid:', isValid);
    
    if (isValid) {
        console.log('\n=== SUCCESS ===');
        console.log('ZK proof that slot is free - generated and verified!');
        console.log('Calendar data (busy slots) was NEVER revealed.');
        console.log('Only the public claim (free at 10pm) is visible.');
        
        // Save proof for OutLayer
        const proofHex = Buffer.from(proof).toString('hex');
        console.log('\nProof hex (first 200 chars):', proofHex.slice(0, 200) + '...');
        console.log('Full proof length:', proofHex.length, 'hex chars');
    } else {
        console.log('\n❌ Proof verification failed!');
    }
}

main().catch(console.error);
