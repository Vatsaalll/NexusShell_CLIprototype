import chalk from 'chalk';

/**
 * Register system commands
 */
export async function registerSystemCommands(shell) {
    
    // System information
    shell.registerCommand('sysinfo', async ({ flags }) => {
        const format = flags.f || flags.format || 'simple';
        
        try {
            const os = await import('os');
            const systemInfo = {
                platform: os.platform(),
                architecture: os.arch(),
                hostname: os.hostname(),
                release: os.release(),
                type: os.type(),
                version: os.version(),
                uptime: os.uptime(),
                totalMemory: os.totalmem(),
                freeMemory: os.freemem(),
                cpus: os.cpus().length,
                loadAverage: os.loadavg(),
                networkInterfaces: Object.keys(os.networkInterfaces()).length,
                nodeVersion: process.version,
                pid: process.pid,
                processUptime: process.uptime()
            };
            
            if (format === 'json') {
                return JSON.stringify(systemInfo, null, 2);
            }
            
            const info = [
                chalk.blue('🖥️  System Information'),
                chalk.gray('=' .repeat(40)),
                `Platform: ${systemInfo.platform} (${systemInfo.architecture})`,
                `Hostname: ${systemInfo.hostname}`,
                `OS Release: ${systemInfo.release}`,
                `OS Type: ${systemInfo.type}`,
                `OS Version: ${systemInfo.version}`,
                `System Uptime: ${formatUptime(systemInfo.uptime)}`,
                `Total Memory: ${formatBytes(systemInfo.totalMemory)}`,
                `Free Memory: ${formatBytes(systemInfo.freeMemory)}`,
                `CPU Cores: ${systemInfo.cpus}`,
                `Load Average: ${systemInfo.loadAverage.map(l => l.toFixed(2)).join(', ')}`,
                `Network Interfaces: ${systemInfo.networkInterfaces}`,
                '',
                chalk.blue('🟢 Node.js Information'),
                chalk.gray('=' .repeat(40)),
                `Node.js Version: ${systemInfo.nodeVersion}`,
                `Process ID: ${systemInfo.pid}`,
                `Process Uptime: ${formatUptime(systemInfo.processUptime)}`
            ];
            
            return info.join('\n');
            
        } catch (error) {
            throw new Error(`Cannot get system information: ${error.message}`);
        }
    }, {
        description: 'Display system information',
        usage: 'sysinfo [-f|--format json]',
        flags: {
            f: 'Output format (json)',
            format: 'Output format (json)'
        }
    });

    // Environment variables
    shell.registerCommand('env', async ({ args, flags }) => {
        const format = flags.f || flags.format || 'simple';
        const filter = args[0];
        
        let envVars = { ...process.env };
        
        if (filter) {
            envVars = Object.fromEntries(
                Object.entries(envVars).filter(([key]) => 
                    key.toLowerCase().includes(filter.toLowerCase())
                )
            );
        }
        
        if (format === 'json') {
            return JSON.stringify(envVars, null, 2);
        }
        
        const entries = Object.entries(envVars).sort();
        return entries.map(([key, value]) => `${key}=${value}`).join('\n');
    }, {
        description: 'Display environment variables',
        usage: 'env [filter] [-f|--format json]',
        flags: {
            f: 'Output format (json)',
            format: 'Output format (json)'
        }
    });

    // Set environment variable
    shell.registerCommand('export', async ({ args, shell }) => {
        if (args.length === 0) {
            throw new Error('Variable assignment required (KEY=VALUE)');
        }
        
        const results = [];
        
        for (const arg of args) {
            const [key, ...valueParts] = arg.split('=');
            const value = valueParts.join('=');
            
            if (!key || value === undefined) {
                throw new Error(`Invalid assignment: ${arg}`);
            }
            
            shell.environment[key] = value;
            process.env[key] = value;
            results.push(`Exported: ${key}=${value}`);
        }
        
        return results.join('\n');
    }, {
        description: 'Set environment variables',
        usage: 'export KEY=VALUE [KEY2=VALUE2...]'
    });

    // Remove environment variable
    shell.registerCommand('unset', async ({ args, shell }) => {
        if (args.length === 0) {
            throw new Error('Variable name required');
        }
        
        const results = [];
        
        for (const key of args) {
            if (shell.environment[key] !== undefined) {
                delete shell.environment[key];
                delete process.env[key];
                results.push(`Unset: ${key}`);
            } else {
                results.push(`Variable not found: ${key}`);
            }
        }
        
        return results.join('\n');
    }, {
        description: 'Remove environment variables',
        usage: 'unset <variable> [variable2...]'
    });

    // Display current date and time
    shell.registerCommand('date', async ({ flags }) => {
        const format = flags.f || flags.format || 'default';
        const utc = flags.u || flags.utc;
        
        const now = new Date();
        const targetDate = utc ? now : now;
        
        switch (format) {
            case 'iso':
                return targetDate.toISOString();
            case 'json':
                return JSON.stringify({ timestamp: targetDate.getTime(), iso: targetDate.toISOString() });
            case 'unix':
                return Math.floor(targetDate.getTime() / 1000).toString();
            default:
                return targetDate.toString();
        }
    }, {
        description: 'Display current date and time',
        usage: 'date [-f|--format default|iso|json|unix] [-u|--utc]',
        flags: {
            f: 'Output format',
            format: 'Output format',
            u: 'Display UTC time',
            utc: 'Display UTC time'
        }
    });

    // Display uptime
    shell.registerCommand('uptime', async ({ flags }) => {
        const format = flags.f || flags.format || 'simple';
        
        const os = await import('os');
        const systemUptime = os.uptime();
        const processUptime = process.uptime();
        const loadAvg = os.loadavg();
        
        if (format === 'json') {
            return JSON.stringify({
                systemUptime,
                processUptime,
                loadAverage: loadAvg,
                timestamp: Date.now()
            }, null, 2);
        }
        
        const info = [
            `System uptime: ${formatUptime(systemUptime)}`,
            `Process uptime: ${formatUptime(processUptime)}`,
            `Load average: ${loadAvg.map(l => l.toFixed(2)).join(', ')}`
        ];
        
        return info.join('\n');
    }, {
        description: 'Display system uptime',
        usage: 'uptime [-f|--format json]',
        flags: {
            f: 'Output format (json)',
            format: 'Output format (json)'
        }
    });

    // Display disk usage
    shell.registerCommand('df', async ({ flags }) => {
        const human = flags.h || flags.human;
        const format = flags.f || flags.format || 'simple';
        
        try {
            const fs = await import('fs');
            const { promisify } = await import('util');
            const stat = promisify(fs.stat);
            
            // Get stats for current directory (simplified)
            const stats = await stat('.');
            const usage = process.memoryUsage();
            
            // Simulate disk usage information
            const diskInfo = {
                filesystem: 'simulated',
                size: usage.heapTotal * 100,
                used: usage.heapUsed * 100,
                available: (usage.heapTotal - usage.heapUsed) * 100,
                mountpoint: process.cwd()
            };
            
            diskInfo.percentUsed = (diskInfo.used / diskInfo.size) * 100;
            
            if (format === 'json') {
                return JSON.stringify(diskInfo, null, 2);
            }
            
            const formatSize = human ? formatBytes : (size) => size.toString();
            
            const headers = ['Filesystem', 'Size', 'Used', 'Available', 'Use%', 'Mounted on'];
            const row = [
                diskInfo.filesystem,
                formatSize(diskInfo.size),
                formatSize(diskInfo.used),
                formatSize(diskInfo.available),
                diskInfo.percentUsed.toFixed(1) + '%',
                diskInfo.mountpoint
            ];
            
            return formatTable(headers, [row]);
            
        } catch (error) {
            throw new Error(`Cannot get disk usage: ${error.message}`);
        }
    }, {
        description: 'Display disk usage',
        usage: 'df [-h|--human] [-f|--format json]',
        flags: {
            h: 'Human readable format',
            human: 'Human readable format',
            f: 'Output format (json)',
            format: 'Output format (json)'
        }
    });

    // Display memory usage
    shell.registerCommand('free', async ({ flags }) => {
        const human = flags.h || flags.human;
        const format = flags.f || flags.format || 'simple';
        
        try {
            const os = await import('os');
            const process_usage = process.memoryUsage();
            
            const memInfo = {
                total: os.totalmem(),
                free: os.freemem(),
                used: os.totalmem() - os.freemem(),
                process: {
                    rss: process_usage.rss,
                    heapTotal: process_usage.heapTotal,
                    heapUsed: process_usage.heapUsed,
                    external: process_usage.external
                }
            };
            
            if (format === 'json') {
                return JSON.stringify(memInfo, null, 2);
            }
            
            const formatSize = human ? formatBytes : (size) => size.toString();
            
            const info = [
                chalk.blue('🧠 Memory Usage'),
                chalk.gray('=' .repeat(40)),
                `Total: ${formatSize(memInfo.total)}`,
                `Used: ${formatSize(memInfo.used)}`,
                `Free: ${formatSize(memInfo.free)}`,
                `Usage: ${((memInfo.used / memInfo.total) * 100).toFixed(1)}%`,
                '',
                chalk.blue('🔄 Process Memory'),
                chalk.gray('=' .repeat(40)),
                `RSS: ${formatSize(memInfo.process.rss)}`,
                `Heap Total: ${formatSize(memInfo.process.heapTotal)}`,
                `Heap Used: ${formatSize(memInfo.process.heapUsed)}`,
                `External: ${formatSize(memInfo.process.external)}`
            ];
            
            return info.join('\n');
            
        } catch (error) {
            throw new Error(`Cannot get memory usage: ${error.message}`);
        }
    }, {
        description: 'Display memory usage',
        usage: 'free [-h|--human] [-f|--format json]',
        flags: {
            h: 'Human readable format',
            human: 'Human readable format',
            f: 'Output format (json)',
            format: 'Output format (json)'
        }
    });

    // System performance monitor
    shell.registerCommand('perf', async ({ shell }) => {
        const report = shell.performanceMonitor.getReport();
        
        const info = [
            chalk.blue('⚡ Performance Report'),
            chalk.gray('=' .repeat(40)),
            `Shell Uptime: ${formatUptime(report.uptime / 1000)}`,
            `Commands Executed: ${report.commandThroughput}`,
            `Errors: ${report.errors}`,
            `Warnings: ${report.warnings}`,
            '',
            chalk.blue('🚀 Latency Metrics'),
            chalk.gray('=' .repeat(40)),
            `Average: ${Math.round(report.latency.avg)}ms`,
            `Min: ${Math.round(report.latency.min)}ms`,
            `Max: ${Math.round(report.latency.max)}ms`,
            `95th percentile: ${Math.round(report.latency.p95)}ms`,
            `99th percentile: ${Math.round(report.latency.p99)}ms`,
            '',
            chalk.blue('💾 Memory Metrics'),
            chalk.gray('=' .repeat(40)),
            `Current: ${formatBytes(report.memory.current)}`,
            `Average: ${formatBytes(report.memory.avg)}`,
            `Min: ${formatBytes(report.memory.min)}`,
            `Max: ${formatBytes(report.memory.max)}`
        ];
        
        return info.join('\n');
    }, {
        description: 'Display shell performance metrics',
        usage: 'perf'
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
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0) parts.push(`${secs}s`);
    
    return parts.join(' ') || '0s';
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