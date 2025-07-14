import { NexusShell } from '../core/shell.js';
import { registerCoreCommands } from '../commands/index.js';
import chalk from 'chalk';

/**
 * Simple test runner for NexusShell
 */
class TestRunner {
    constructor() {
        this.tests = [];
        this.results = [];
    }

    /**
     * Add a test
     */
    test(name, testFn) {
        this.tests.push({ name, testFn });
    }

    /**
     * Run all tests
     */
    async run() {
        console.log(chalk.blue('🧪 Running NexusShell Tests'));
        console.log(chalk.gray('='.repeat(50)));

        const startTime = Date.now();
        
        for (const test of this.tests) {
            try {
                await test.testFn();
                this.results.push({ name: test.name, status: 'pass' });
                console.log(chalk.green(`✅ ${test.name}`));
            } catch (error) {
                this.results.push({ name: test.name, status: 'fail', error: error.message });
                console.log(chalk.red(`❌ ${test.name}`));
                console.log(chalk.red(`   Error: ${error.message}`));
            }
        }

        const endTime = Date.now();
        const duration = endTime - startTime;
        
        const passed = this.results.filter(r => r.status === 'pass').length;
        const failed = this.results.filter(r => r.status === 'fail').length;
        
        console.log(chalk.gray('='.repeat(50)));
        console.log(chalk.blue('📊 Test Results:'));
        console.log(`${chalk.green('Passed:')} ${passed}`);
        console.log(`${chalk.red('Failed:')} ${failed}`);
        console.log(`${chalk.blue('Total:')} ${this.tests.length}`);
        console.log(`${chalk.yellow('Duration:')} ${duration}ms`);
        
        if (failed > 0) {
            process.exit(1);
        }
    }
}

/**
 * Test utilities
 */
function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEquals(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

/**
 * Test suite
 */
async function runTests() {
    const runner = new TestRunner();
    
    // Test shell initialization
    runner.test('Shell should initialize correctly', async () => {
        const shell = new NexusShell();
        assert(shell !== null, 'Shell should be created');
        assert(shell.isRunning === false, 'Shell should not be running initially');
        assert(shell.stats.commandsExecuted === 0, 'No commands should be executed initially');
    });
    
    // Test command registration
    runner.test('Commands should be registered correctly', async () => {
        const shell = new NexusShell();
        await registerCoreCommands(shell);
        
        const commandCount = shell.commandEngine.getCommandCount();
        assert(commandCount > 0, 'Commands should be registered');
        
        const lsCommand = shell.commandEngine.getCommand('ls');
        assert(lsCommand !== undefined, 'ls command should be registered');
        assert(lsCommand.name === 'ls', 'Command name should be correct');
    });
    
    // Test command execution
    runner.test('Commands should execute correctly', async () => {
        const shell = new NexusShell();
        await registerCoreCommands(shell);
        await shell.start();
        
        const result = await shell.executeCommand('pwd');
        assert(typeof result === 'string', 'Command should return a string');
        assert(result.length > 0, 'Result should not be empty');
        
        await shell.stop();
    });
    
    // Test error handling
    runner.test('Error handling should work correctly', async () => {
        const shell = new NexusShell();
        await registerCoreCommands(shell);
        await shell.start();
        
        try {
            await shell.executeCommand('nonexistent-command');
            assert(false, 'Should have thrown an error');
        } catch (error) {
            assert(error instanceof Error, 'Should throw an Error');
            assert(error.message.length > 0, 'Error should have a message');
        }
        
        await shell.stop();
    });
    
    // Test security context
    runner.test('Security context should work correctly', async () => {
        const shell = new NexusShell();
        await shell.securityContext.initialize();
        
        const hasPermission = await shell.securityContext.checkPermission('command:execute');
        assert(hasPermission === true, 'Should have basic command execution permission');
        
        shell.securityContext.revokePermission('command:execute');
        const hasPermissionAfterRevoke = await shell.securityContext.checkPermission('command:execute');
        assert(hasPermissionAfterRevoke === false, 'Permission should be revoked');
    });
    
    // Test object bridge
    runner.test('Object bridge should work correctly', async () => {
        const shell = new NexusShell();
        await shell.objectBridge.initialize();
        
        const fsAPI = shell.objectBridge.getFileSystemAPI();
        assert(fsAPI !== null, 'File system API should be available');
        assert(typeof fsAPI.readFile === 'function', 'readFile should be a function');
        
        const procAPI = shell.objectBridge.getProcessAPI();
        assert(procAPI !== null, 'Process API should be available');
        assert(typeof procAPI.exec === 'function', 'exec should be a function');
    });
    
    // Test performance monitoring
    runner.test('Performance monitoring should work correctly', async () => {
        const shell = new NexusShell();
        shell.performanceMonitor.start();
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const uptime = shell.performanceMonitor.getUptime();
        assert(uptime > 0, 'Uptime should be greater than 0');
        
        shell.performanceMonitor.stop();
    });
    
    // Test execution recorder
    runner.test('Execution recorder should work correctly', async () => {
        const shell = new NexusShell();
        
        await shell.executionRecorder.startRecording('test-recording');
        assert(shell.executionRecorder.isRecording() === true, 'Should be recording');
        
        shell.executionRecorder.recordCommand('test-command', {});
        
        const recording = await shell.executionRecorder.stopRecording();
        assert(recording.commands.length === 1, 'Should have recorded one command');
        assert(recording.commands[0].input === 'test-command', 'Command should be recorded correctly');
    });
    
    // Test plugin system
    runner.test('Plugin system should work correctly', async () => {
        const shell = new NexusShell();
        
        const testPlugin = {
            name: 'test-plugin',
            initialize: async () => {}
        };
        
        await shell.registerPlugin('test-plugin', testPlugin);
        assert(shell.plugins.has('test-plugin'), 'Plugin should be registered');
        
        const plugin = shell.plugins.get('test-plugin');
        assert(plugin.name === 'test-plugin', 'Plugin name should be correct');
    });
    
    // Test transaction support
    runner.test('Transaction support should work correctly', async () => {
        const shell = new NexusShell();
        await registerCoreCommands(shell);
        await shell.start();
        
        const commands = ['pwd', 'date'];
        const results = await shell.executeTransaction(commands);
        
        assert(results.length === 2, 'Should execute all commands in transaction');
        assert(typeof results[0] === 'string', 'First result should be a string');
        assert(typeof results[1] === 'string', 'Second result should be a string');
        
        await shell.stop();
    });
    
    // Test file system commands
    runner.test('File system commands should work correctly', async () => {
        const shell = new NexusShell();
        await registerCoreCommands(shell);
        await shell.start();
        
        const result = await shell.executeCommand('ls');
        assert(typeof result === 'string', 'ls should return a string');
        
        const pwdResult = await shell.executeCommand('pwd');
        assert(typeof pwdResult === 'string', 'pwd should return a string');
        assert(pwdResult.length > 0, 'pwd should return non-empty string');
        
        await shell.stop();
    });
    
    // Run all tests
    await runner.run();
}

// Execute tests
runTests().catch(error => {
    console.error(chalk.red('Test runner failed:'), error);
    process.exit(1);
});