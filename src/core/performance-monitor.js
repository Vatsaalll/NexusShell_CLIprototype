import { EventEmitter } from 'events';
import chalk from 'chalk';

/**
 * Performance Monitor - Tracks shell performance and resource usage
 */
export class PerformanceMonitor extends EventEmitter {
    constructor(shell) {
        super();
        this.shell = shell;
        this.startTime = Date.now();
        this.isRunning = false;
        this.metrics = {
            commandLatency: [],
            memoryUsage: [],
            cpuUsage: [],
            commandThroughput: 0,
            errors: 0,
            warnings: 0
        };
        this.intervals = [];
        this.thresholds = {
            memoryWarning: 40 * 1024 * 1024, // 40MB
            memoryError: 60 * 1024 * 1024,   // 60MB
            latencyWarning: 1000,             // 1 second
            latencyError: 5000                // 5 seconds
        };
    }

    /**
     * Start monitoring
     */
    start() {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;
        this.startTime = Date.now();

        // Monitor memory usage every 5 seconds
        this.intervals.push(setInterval(() => {
            this.recordMemoryUsage();
        }, 5000));

        // Monitor CPU usage every 10 seconds
        this.intervals.push(setInterval(() => {
            this.recordCPUUsage();
        }, 10000));

        // Setup shell event listeners
        this.setupEventListeners();

        console.log(chalk.green('📊 Performance monitoring started'));
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        
        // Clear intervals
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals = [];

        // Remove event listeners
        this.removeEventListeners();

        console.log(chalk.yellow('📊 Performance monitoring stopped'));
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.shell.on('commandExecuted', (data) => {
            this.recordCommandLatency(data.executionTime);
            this.metrics.commandThroughput++;
        });

        this.shell.on('commandError', () => {
            this.metrics.errors++;
        });
    }

    /**
     * Remove event listeners
     */
    removeEventListeners() {
        this.shell.removeAllListeners('commandExecuted');
        this.shell.removeAllListeners('commandError');
    }

    /**
     * Record command latency
     */
    recordCommandLatency(latency) {
        this.metrics.commandLatency.push({
            timestamp: Date.now(),
            latency
        });

        // Keep only last 100 entries
        if (this.metrics.commandLatency.length > 100) {
            this.metrics.commandLatency.shift();
        }

        // Check thresholds
        if (latency > this.thresholds.latencyError) {
            this.metrics.errors++;
            console.log(chalk.red(`⚠️  High latency detected: ${latency}ms`));
        } else if (latency > this.thresholds.latencyWarning) {
            this.metrics.warnings++;
            console.log(chalk.yellow(`⚠️  Elevated latency: ${latency}ms`));
        }
    }

    /**
     * Record memory usage
     */
    recordMemoryUsage() {
        const usage = process.memoryUsage();
        const timestamp = Date.now();

        this.metrics.memoryUsage.push({
            timestamp,
            heapUsed: usage.heapUsed,
            heapTotal: usage.heapTotal,
            external: usage.external,
            rss: usage.rss
        });

        // Keep only last 100 entries
        if (this.metrics.memoryUsage.length > 100) {
            this.metrics.memoryUsage.shift();
        }

        // Check thresholds
        if (usage.heapUsed > this.thresholds.memoryError) {
            this.metrics.errors++;
            console.log(chalk.red(`⚠️  High memory usage: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`));
        } else if (usage.heapUsed > this.thresholds.memoryWarning) {
            this.metrics.warnings++;
            console.log(chalk.yellow(`⚠️  Elevated memory usage: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`));
        }
    }

    /**
     * Record CPU usage
     */
    recordCPUUsage() {
        const usage = process.cpuUsage();
        const timestamp = Date.now();

        this.metrics.cpuUsage.push({
            timestamp,
            user: usage.user,
            system: usage.system
        });

        // Keep only last 100 entries
        if (this.metrics.cpuUsage.length > 100) {
            this.metrics.cpuUsage.shift();
        }
    }

    /**
     * Get performance report
     */
    getReport() {
        const uptime = Date.now() - this.startTime;
        const latencies = this.metrics.commandLatency.map(entry => entry.latency);
        const memoryUsages = this.metrics.memoryUsage.map(entry => entry.heapUsed);

        return {
            uptime,
            commandThroughput: this.metrics.commandThroughput,
            errors: this.metrics.errors,
            warnings: this.metrics.warnings,
            latency: {
                count: latencies.length,
                avg: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
                min: latencies.length > 0 ? Math.min(...latencies) : 0,
                max: latencies.length > 0 ? Math.max(...latencies) : 0,
                p95: latencies.length > 0 ? this.percentile(latencies, 0.95) : 0,
                p99: latencies.length > 0 ? this.percentile(latencies, 0.99) : 0
            },
            memory: {
                current: memoryUsages.length > 0 ? memoryUsages[memoryUsages.length - 1] : 0,
                avg: memoryUsages.length > 0 ? memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length : 0,
                min: memoryUsages.length > 0 ? Math.min(...memoryUsages) : 0,
                max: memoryUsages.length > 0 ? Math.max(...memoryUsages) : 0
            }
        };
    }

    /**
     * Display performance report
     */
    displayReport() {
        const report = this.getReport();
        
        console.log(chalk.blue('📊 Performance Report:'));
        console.log(chalk.gray('='.repeat(50)));
        
        console.log(`${chalk.cyan('Uptime:')} ${Math.round(report.uptime / 1000)}s`);
        console.log(`${chalk.cyan('Commands executed:')} ${report.commandThroughput}`);
        console.log(`${chalk.cyan('Errors:')} ${report.errors}`);
        console.log(`${chalk.cyan('Warnings:')} ${report.warnings}`);
        
        console.log(chalk.blue('\nLatency Metrics:'));
        console.log(`  Average: ${Math.round(report.latency.avg)}ms`);
        console.log(`  Min: ${Math.round(report.latency.min)}ms`);
        console.log(`  Max: ${Math.round(report.latency.max)}ms`);
        console.log(`  95th percentile: ${Math.round(report.latency.p95)}ms`);
        console.log(`  99th percentile: ${Math.round(report.latency.p99)}ms`);
        
        console.log(chalk.blue('\nMemory Usage:'));
        console.log(`  Current: ${Math.round(report.memory.current / 1024 / 1024)}MB`);
        console.log(`  Average: ${Math.round(report.memory.avg / 1024 / 1024)}MB`);
        console.log(`  Min: ${Math.round(report.memory.min / 1024 / 1024)}MB`);
        console.log(`  Max: ${Math.round(report.memory.max / 1024 / 1024)}MB`);
        
        console.log(chalk.gray('='.repeat(50)));
    }

    /**
     * Get uptime
     */
    getUptime() {
        return Date.now() - this.startTime;
    }

    /**
     * Calculate percentile
     */
    percentile(values, p) {
        const sorted = values.slice().sort((a, b) => a - b);
        const index = (sorted.length - 1) * p;
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index % 1;
        
        return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    }

    /**
     * Reset metrics
     */
    resetMetrics() {
        this.metrics = {
            commandLatency: [],
            memoryUsage: [],
            cpuUsage: [],
            commandThroughput: 0,
            errors: 0,
            warnings: 0
        };
        
        console.log(chalk.green('📊 Performance metrics reset'));
    }

    /**
     * Export metrics
     */
    exportMetrics() {
        return {
            timestamp: Date.now(),
            uptime: this.getUptime(),
            metrics: { ...this.metrics },
            report: this.getReport()
        };
    }

    /**
     * Set thresholds
     */
    setThresholds(thresholds) {
        this.thresholds = { ...this.thresholds, ...thresholds };
        console.log(chalk.blue('📊 Performance thresholds updated'));
    }
}