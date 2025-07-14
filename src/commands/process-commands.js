import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execAsync = promisify(exec);

/**
 * Register process management commands
 */
export async function registerProcessCommands(shell) {
    
    // List processes
    shell.registerCommand('ps', async ({ flags }) => {
        const all = flags.a || flags.all;
        const format = flags.f || flags.format || 'simple';
        
        try {
            // Get process list (simplified for demo)
            const processes = [
                { pid: process.pid, name: 'nexus-shell', cpu: 0.5, memory: 25, uptime: Math.floor(process.uptime()) },
                { pid: 1, name: 'init', cpu: 0.1, memory: 5, uptime: 86400 },
                { pid: 1234, name: 'node', cpu: 2.1, memory: 45, uptime: 3600 }
            ];
            
            if (format === 'json') {
                return JSON.stringify(processes, null, 2);
            }
            
            const headers = ['PID', 'NAME', 'CPU%', 'MEM(MB)', 'UPTIME'];
            const rows = processes.map(p => [
                p.pid.toString(),
                p.name,
                p.cpu.toFixed(1),
                p.memory.toString(),
                formatUptime(p.uptime)
            ]);
            
            return formatTable(headers, rows);
            
        } catch (error) {
            throw new Error(`Cannot list processes: ${error.message}`);
        }
    }, {
        description: 'List running processes',
        usage: 'ps [-a|--all] [-f|--format json]',
        flags: {
            a: 'Show all processes',
            all: 'Show all processes',
            f: 'Output format (json)',
            format: 'Output format (json)'
        }
    });

    // Kill process
    shell.registerCommand('kill', async ({ args, flags }) => {
        if (args.length === 0) {
            throw new Error('Process ID required');
        }
        
        const pid = parseInt(args[0]);
        const signal = flags.s || flags.signal || 'SIGTERM';
        
        if (isNaN(pid)) {
            throw new Error('Invalid process ID');
        }
        
        try {
            process.kill(pid, signal);
            return `Sent ${signal} to process ${pid}`;
        } catch (error) {
            throw new Error(`Cannot kill process ${pid}: ${error.message}`);
        }
    }, {
        description: 'Terminate process by PID',
        usage: 'kill <pid> [-s|--signal SIGNAL]',
        flags: {
            s: 'Signal to send (default: SIGTERM)',
            signal: 'Signal to send (default: SIGTERM)'
        }
    });

    // Execute command
    shell.registerCommand('exec', async ({ args, flags }) => {
        if (args.length === 0) {
            throw new Error('Command required');
        }
        
        const command = args.join(' ');
        const timeout = flags.t || flags.timeout;
        const background = flags.b || flags.background;
        
        try {
            if (background) {
                const child = spawn('sh', ['-c', command], {
                    detached: true,
                    stdio: 'ignore'
                });
                child.unref();
                return `Started background process: ${child.pid}`;
            } else {
                const options = {};
                if (timeout) {
                    options.timeout = parseInt(timeout) * 1000;
                }
                
                const { stdout, stderr } = await execAsync(command, options);
                return stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
            }
        } catch (error) {
            throw new Error(`Command failed: ${error.message}`);
        }
    }, {
        description: 'Execute system command',
        usage: 'exec <command> [-t|--timeout seconds] [-b|--background]',
        flags: {
            t: 'Timeout in seconds',
            timeout: 'Timeout in seconds',
            b: 'Run in background',
            background: 'Run in background'
        }
    });

    // Show process information
    shell.registerCommand('pinfo', async ({ args }) => {
        const pid = args[0] ? parseInt(args[0]) : process.pid;
        
        if (isNaN(pid)) {
            throw new Error('Invalid process ID');
        }
        
        try {
            if (pid === process.pid) {
                const memUsage = process.memoryUsage();
                const cpuUsage = process.cpuUsage();
                
                const info = [
                    `Process ID: ${process.pid}`,
                    `Node.js Version: ${process.version}`,
                    `Platform: ${process.platform}`,
                    `Architecture: ${process.arch}`,
                    `Uptime: ${formatUptime(process.uptime())}`,
                    `Working Directory: ${process.cwd()}`,
                    `Memory Usage:`,
                    `  RSS: ${formatBytes(memUsage.rss)}`,
                    `  Heap Total: ${formatBytes(memUsage.heapTotal)}`,
                    `  Heap Used: ${formatBytes(memUsage.heapUsed)}`,
                    `  External: ${formatBytes(memUsage.external)}`,
                    `CPU Usage:`,
                    `  User: ${cpuUsage.user / 1000}ms`,
                    `  System: ${cpuUsage.system / 1000}ms`
                ];
                
                return info.join('\n');
            } else {
                return `Process information for PID ${pid} not available (requires system integration)`;
            }
        } catch (error) {
            throw new Error(`Cannot get process info: ${error.message}`);
        }
    }, {
        description: 'Show detailed process information',
        usage: 'pinfo [pid]'
    });

    // Monitor processes
    shell.registerCommand('top', async ({ flags }) => {
        const interval = flags.i || flags.interval || 5;
        const count = flags.c || flags.count || 10;
        
        console.log(chalk.blue('📊 Process Monitor (press Ctrl+C to stop)'));
        console.log(chalk.gray(`Refreshing every ${interval} seconds\n`));
        
        const monitor = setInterval(async () => {
            try {
                const processes = [
                    { pid: process.pid, name: 'nexus-shell', cpu: Math.random() * 5, memory: 20 + Math.random() * 10 },
                    { pid: 1, name: 'init', cpu: Math.random() * 0.5, memory: 5 + Math.random() * 2 },
                    { pid: 1234, name: 'node', cpu: Math.random() * 3, memory: 40 + Math.random() * 20 }
                ];
                
                // Sort by CPU usage
                processes.sort((a, b) => b.cpu - a.cpu);
                
                // Clear screen and show header
                console.clear();
                console.log(chalk.blue('📊 Process Monitor'));
                console.log(chalk.gray(`Updated: ${new Date().toLocaleTimeString()}\n`));
                
                const headers = ['PID', 'NAME', 'CPU%', 'MEM(MB)'];
                const rows = processes.slice(0, count).map(p => [
                    p.pid.toString(),
                    p.name,
                    p.cpu.toFixed(1),
                    p.memory.toFixed(1)
                ]);
                
                console.log(formatTable(headers, rows));
                
            } catch (error) {
                console.error(chalk.red('Monitor error:'), error.message);
            }
        }, interval * 1000);
        
        // Handle Ctrl+C
        process.on('SIGINT', () => {
            clearInterval(monitor);
            console.log(chalk.yellow('\nMonitor stopped'));
        });
        
        return 'Process monitor started (press Ctrl+C to stop)';
    }, {
        description: 'Monitor running processes',
        usage: 'top [-i|--interval seconds] [-c|--count number]',
        flags: {
            i: 'Refresh interval in seconds',
            interval: 'Refresh interval in seconds',
            c: 'Number of processes to show',
            count: 'Number of processes to show'
        }
    });

    // Job control
    shell.registerCommand('jobs', async ({ flags }) => {
        const format = flags.f || flags.format || 'simple';
        
        // Simulate job list
        const jobs = [
            { id: 1, command: 'long-running-task', status: 'running', pid: 5678 },
            { id: 2, command: 'backup-script', status: 'stopped', pid: 5679 }
        ];
        
        if (format === 'json') {
            return JSON.stringify(jobs, null, 2);
        }
        
        const headers = ['ID', 'STATUS', 'PID', 'COMMAND'];
        const rows = jobs.map(j => [
            j.id.toString(),
            j.status,
            j.pid.toString(),
            j.command
        ]);
        
        return formatTable(headers, rows);
    }, {
        description: 'List active jobs',
        usage: 'jobs [-f|--format json]',
        flags: {
            f: 'Output format (json)',
            format: 'Output format (json)'
        }
    });
}

/**
 * Format uptime in human readable format
 */
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format data as table
 */
function formatTable(headers, rows) {
    const colWidths = headers.map((header, i) => 
        Math.max(header.length, ...rows.map(row => row[i].length))
    );
    
    const formatRow = (row) => 
        row.map((cell, i) => cell.padEnd(colWidths[i])).join(' | ');
    
    const separator = colWidths.map(w => '-'.repeat(w)).join('-+-');
    
    return [
        formatRow(headers),
        separator,
        ...rows.map(formatRow)
    ].join('\n');
}