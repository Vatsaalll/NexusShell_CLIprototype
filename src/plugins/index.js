import { loadExamplePlugin } from './example-plugin.js';
import { loadUtilsPlugin } from './utils-plugin.js';
import chalk from 'chalk';

/**
 * Initialize all plugins
 */
export async function initializePlugins(shell) {
    console.log(chalk.blue('🔌 Initializing plugins...'));
    
    try {
        // Load example plugin
        await loadExamplePlugin(shell);
        
        // Load utils plugin
        await loadUtilsPlugin(shell);
        
        console.log(chalk.green('✅ Plugins initialized'));
        
    } catch (error) {
        console.error(chalk.red('❌ Plugin initialization failed:'), error.message);
        throw error;
    }
}