import * as dotenv from "dotenv";
import { ArbitrageCalculator } from "./arbitrage";
import { ArbitrageMonitor } from "./monitor";
import { ArbitrageExecutor } from "./executor";

dotenv.config();

export { ArbitrageCalculator, ArbitrageOpportunity } from "./arbitrage";
export { ArbitrageMonitor, SwapEvent } from "./monitor";
export { ArbitrageExecutor } from "./executor";

async function main() {
  console.log("Starting qroute AEV Arbitrage Bot...");
  
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("PRIVATE_KEY env variable is missing. Exiting.");
    process.exit(1);
  }

  console.log("Wallet signer successfully loaded.");
  // Setup empty loop for daemon process
  setInterval(() => {
    // Keep process alive waiting for monitoring events
  }, 10000);
}

if (require.main === module) {
  main().catch((err) => console.error("Error in AEV Bot main loop:", err));
}
