import type { BotModule } from "../../../src/battle/worker/bot/bot-contract.ts";
const module:BotModule={contractVersion:1,create(){return{decide(){while(true){/* Deliberately blocks the execution host to test the Rust watchdog. */}},sideboard(){return{exchanges:[],reason:{code:"retain",explanation:"Keep input."}}}}}};
export default module;
