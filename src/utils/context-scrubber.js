import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';
import SessionContext from './session-context.js';

const HOME_DIR = os.homedir();
const DB_PATH = path.join(HOME_DIR, '.nebula-cli', 'vector.db');

export class ContextScrubber {
  /**
   * Detect if session has entered "logic loop" (self-healing prompts)
   * @param {Array} recentHistory - Last 10 commands
   * @returns {boolean} - true if loop detected
   */
  static detectLoop(recentHistory) {
    const loopPatterns = [
      // Single-letter prompt leakage or simple yes/no
      /^(y|n|yes|no)$/i,
      
      // AI hallucination chains (e.g. repeated sudo calls without logic)
      /sudo.*(apt|mv|chmod|install)/i,
      
      // Self-referential healing
      /nebula.*(fix|y|n|heal)/i,
    ];

    // Check last 10 commands only
    const recent = recentHistory.slice(-10);
    
    // Count how many recent commands match suspicious patterns
    const suspiciousCount = recent.filter(entry => 
      loopPatterns.some(pattern => pattern.test(entry.command))
    ).length;

    // If 3 or more recent commands are suspicious, flagging as loop
    return suspiciousCount >= 3; 
  }

  /**
   * Emergency scrub: Clear vector cache + reset session
   */
  static async emergencyScrub() {
    try {
      // 1. Clear vector database
      if (fs.existsSync(DB_PATH)) {
        fs.unlinkSync(DB_PATH);
        console.log(chalk.yellow('🧹 Vector cache cleared (confused state reset)'));
      }

      // 2. Truncate session history to last 5 good commands
      // We modify the singleton instance directly
      if (SessionContext.history.length > 5) {
          SessionContext.history = SessionContext.history.slice(-5);
          console.log(chalk.yellow('📜 Session history truncated to last 5 commands'));
      }

      console.log(chalk.green('✅ Context scrubbed. Session ready for productive work.'));
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Scrub failed:', error.message));
      return false;
    }
  }

  /**
   * Filter accidental prompt input (y/n leakage)
   * @param {string} command - Raw user input
   * @returns {boolean} - true if should be ignored
   */
  static isPromptLeakage(command) {
    const leakagePatterns = [
      /^[yn]$/i,                    // Single y/n
      /^[yesno]+$/i,                // yes/no variants
    ];
    // Also ignore empty input, though usually handled by REPL logic
    if (!command.trim()) return true;
    
    return leakagePatterns.some(p => p.test(command.trim()));
  }
}
