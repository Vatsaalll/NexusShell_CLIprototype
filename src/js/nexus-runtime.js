/**
 * NexusShell JavaScript Runtime
 * Provides high-level JavaScript APIs that interface with the C++ core
 */

// Global nexus object - populated by C++ bridge
if (typeof nexus === 'undefined') {
    globalThis.nexus = {};
}

/**
 * Enhanced filesystem API with chainable operations
 */
class NexusFileSystem {
    constructor(cppBridge) {
        this._bridge = cppBridge;
    }
    
    /**
     * Create a directory object for chaining operations
     */
    dir(path = '.') {
        return new NexusDirectory(path, this._bridge);
    }
    
    /**
     * Create a file object for operations
     */
    file(path) {
        return new NexusFile(path, this._bridge);
    }
    
    /**
     * Read file with automatic encoding detection
     */
    async readFile(path, options = {}) {
        const encoding = options.encoding || 'utf8';
        const content = await this._bridge.readFile(path, { encoding });
        
        if (options.json) {
            return JSON.parse(content);
        }
        
        return content;
    }
    
    /**
     * Write file with automatic formatting
     */
    async writeFile(path, content, options = {}) {
        let data = content;
        
        if (typeof content === 'object') {
            data = JSON.stringify(content, null, options.indent || 2);
        }
        
        return this._bridge.writeFile(path, data, options);
    }
    
    /**
     * Watch filesystem changes
     */
    watch(path, callback) {
        return this._bridge.watch(path, callback);
    }
    
    /**
     * Find files with advanced filtering
     */
    async find(pattern, options = {}) {
        const startPath = options.path || '.';
        const maxDepth = options.maxDepth || 10;
        const type = options.type; // 'file', 'directory', or undefined for both
        
        const results = [];
        
        async function searchDirectory(dirPath, depth) {
            if (depth > maxDepth) return;
            
            try {
                const entries = await this._bridge.listDir(dirPath);
                
                for (const entry of entries) {
                    const fullPath = `${dirPath}/${entry.name}`;
                    
                    // Apply type filter
                    if (type && ((type === 'file' && !entry.isFile) || 
                                (type === 'directory' && !entry.isDirectory))) {
                        continue;
                    }
                    
                    // Apply pattern matching
                    if (typeof pattern === 'string') {
                        if (entry.name.includes(pattern)) {
                            results.push(fullPath);
                        }
                    } else if (pattern instanceof RegExp) {
                        if (pattern.test(entry.name)) {
                            results.push(fullPath);
                        }
                    } else if (typeof pattern === 'function') {
                        if (pattern(entry)) {
                            results.push(fullPath);
                        }
                    }
                    
                    // Recurse into directories
                    if (entry.isDirectory) {
                        await searchDirectory(fullPath, depth + 1);
                    }
                }
            } catch (error) {
                // Ignore permission errors and continue
            }
        }
        
        await searchDirectory.call(this, startPath, 0);
        return results;
    }
}

/**
 * Directory object with chainable operations
 */
class NexusDirectory {
    constructor(path, bridge) {
        this.path = path;
        this._bridge = bridge;
        this._filters = [];
        this._transforms = [];
    }
    
    /**
     * List directory contents
     */
    async list() {
        const entries = await this._bridge.listDir(this.path);
        return this._applyFiltersAndTransforms(entries);
    }
    
    /**
     * Filter directory entries
     */
    filter(predicate) {
        const newDir = new NexusDirectory(this.path, this._bridge);
        newDir._filters = [...this._filters, predicate];
        newDir._transforms = [...this._transforms];
        return newDir;
    }
    
    /**
     * Transform directory entries
     */
    map(transform) {
        const newDir = new NexusDirectory(this.path, this._bridge);
        newDir._filters = [...this._filters];
        newDir._transforms = [...this._transforms, transform];
        return newDir;
    }
    
    /**
     * Execute callback for each entry
     */
    async forEach(callback) {
        const entries = await this.list();
        entries.forEach(callback);
    }
    
    /**
     * Get total size of directory
     */
    async size() {
        const entries = await this._bridge.listDir(this.path);
        let totalSize = 0;
        
        for (const entry of entries) {
            if (entry.isFile) {
                const stat = await this._bridge.stat(`${this.path}/${entry.name}`);
                totalSize += stat.size;
            }
        }
        
        return totalSize;
    }
    
    /**
     * Convert to different formats
     */
    async toArray() {
        return this.list();
    }
    
    async toJSON() {
        const entries = await this.list();
        return JSON.stringify(entries, null, 2);
    }
    
    async toCSV() {
        const entries = await this.list();
        if (entries.length === 0) return '';
        
        const headers = Object.keys(entries[0]);
        const csvRows = [headers.join(',')];
        
        for (const entry of entries) {
            const row = headers.map(header => {
                const value = entry[header];
                return typeof value === 'string' ? `"${value}"` : value;
            });
            csvRows.push(row.join(','));
        }
        
        return csvRows.join('\n');
    }
    
    async _applyFiltersAndTransforms(entries) {
        let result = entries;
        
        // Apply filters
        for (const filter of this._filters) {
            result = result.filter(filter);
        }
        
        // Apply transforms
        for (const transform of this._transforms) {
            result = result.map(transform);
        }
        
        return result;
    }
}

/**
 * File object with advanced operations
 */
class NexusFile {
    constructor(path, bridge) {
        this.path = path;
        this._bridge = bridge;
    }
    
    /**
     * Read file content
     */
    async read(options = {}) {
        return this._bridge.readFile(this.path, options);
    }
    
    /**
     * Write file content
     */
    async write(content, options = {}) {
        return this._bridge.writeFile(this.path, content, options);
    }
    
    /**
     * Append to file
     */
    async append(content) {
        const existing = await this.read().catch(() => '');
        return this.write(existing + content);
    }
    
    /**
     * Get file statistics
     */
    async stat() {
        return this._bridge.stat(this.path);
    }
    
    /**
     * Watch file for changes
     */
    watch(callback) {
        return this._bridge.watch(this.path, callback);
    }
    
    /**
     * Process file content line by line
     */
    async lines() {
        const content = await this.read();
        return content.split('\n');
    }
    
    /**
     * Search file content
     */
    async grep(pattern, options = {}) {
        const lines = await this.lines();
        const regex = new RegExp(pattern, options.flags || 'i');
        
        return lines
            .map((line, index) => ({ line, number: index + 1 }))
            .filter(({ line }) => regex.test(line));
    }
    
    /**
     * Parse file as JSON
     */
    async json() {
        const content = await this.read();
        return JSON.parse(content);
    }
    
    /**
     * Parse file as CSV
     */
    async csv(options = {}) {
        const content = await this.read();
        const lines = content.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) return [];
        
        const delimiter = options.delimiter || ',';
        const headers = lines[0].split(delimiter);
        
        return lines.slice(1).map(line => {
            const values = line.split(delimiter);
            const obj = {};
            headers.forEach((header, index) => {
                obj[header.trim()] = values[index]?.trim() || '';
            });
            return obj;
        });
    }
}

/**
 * Enhanced process management API
 */
class NexusProcess {
    constructor(cppBridge) {
        this._bridge = cppBridge;
    }
    
    /**
     * Execute command with advanced options
     */
    async exec(command, options = {}) {
        const result = await this._bridge.exec(command, {
            timeout: options.timeout || 30000,
            cwd: options.cwd,
            env: options.env,
            capture: true
        });
        
        return new ProcessResult(result, command);
    }
    
    /**
     * List processes with filtering
     */
    async list() {
        const processes = await this._bridge.list();
        return new ProcessList(processes, this._bridge);
    }
    
    /**
     * Spawn long-running process
     */
    async spawn(command, args = [], options = {}) {
        return this._bridge.spawn(command, args, options);
    }
    
    /**
     * Kill process by PID
     */
    async kill(pid, signal = 'SIGTERM') {
        return this._bridge.kill(pid, signal);
    }
    
    /**
     * Get process information
     */
    async info(pid) {
        return this._bridge.info(pid);
    }
    
    /**
     * Monitor processes
     */
    monitor(callback, interval = 1000) {
        const monitor = setInterval(async () => {
            try {
                const processes = await this.list();
                callback(processes);
            } catch (error) {
                callback(null, error);
            }
        }, interval);
        
        return {
            stop: () => clearInterval(monitor)
        };
    }
}

/**
 * Process list with chainable operations
 */
class ProcessList {
    constructor(processes, bridge) {
        this.processes = processes;
        this._bridge = bridge;
    }
    
    filter(predicate) {
        return new ProcessList(this.processes.filter(predicate), this._bridge);
    }
    
    map(transform) {
        return new ProcessList(this.processes.map(transform), this._bridge);
    }
    
    sortBy(key, direction = 'asc') {
        const sorted = [...this.processes].sort((a, b) => {
            const aVal = a[key];
            const bVal = b[key];
            
            if (direction === 'asc') {
                return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            } else {
                return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
            }
        });
        
        return new ProcessList(sorted, this._bridge);
    }
    
    async killAll(signal = 'SIGTERM') {
        const results = [];
        for (const proc of this.processes) {
            try {
                await this._bridge.kill(proc.pid, signal);
                results.push({ pid: proc.pid, success: true });
            } catch (error) {
                results.push({ pid: proc.pid, success: false, error: error.message });
            }
        }
        return results;
    }
    
    toArray() {
        return this.processes;
    }
    
    toJSON() {
        return JSON.stringify(this.processes, null, 2);
    }
    
    forEach(callback) {
        this.processes.forEach(callback);
    }
    
    get length() {
        return this.processes.length;
    }
}

/**
 * Process execution result
 */
class ProcessResult {
    constructor(result, command) {
        this.command = command;
        this.exitCode = result.exitCode || 0;
        this.stdout = result.stdout || '';
        this.stderr = result.stderr || '';
        this.success = this.exitCode === 0;
    }
    
    toString() {
        return this.stdout;
    }
    
    toJSON() {
        return {
            command: this.command,
            exitCode: this.exitCode,
            stdout: this.stdout,
            stderr: this.stderr,
            success: this.success
        };
    }
    
    lines() {
        return this.stdout.split('\n').filter(line => line.trim());
    }
    
    json() {
        return JSON.parse(this.stdout);
    }
}

/**
 * Enhanced network API
 */
class NexusNetwork {
    constructor(cppBridge) {
        this._bridge = cppBridge;
    }
    
    /**
     * HTTP GET with advanced options
     */
    async get(url, options = {}) {
        const response = await this._bridge.get(url, {
            headers: options.headers || {},
            timeout: options.timeout || 30000,
            followRedirects: options.followRedirects !== false
        });
        
        return new HttpResponse(response);
    }
    
    /**
     * HTTP POST with automatic serialization
     */
    async post(url, data, options = {}) {
        let body = data;
        let headers = options.headers || {};
        
        if (typeof data === 'object') {
            body = JSON.stringify(data);
            headers['Content-Type'] = 'application/json';
        }
        
        const response = await this._bridge.post(url, body, {
            headers,
            timeout: options.timeout || 30000
        });
        
        return new HttpResponse(response);
    }
    
    /**
     * Download file with progress
     */
    async download(url, filePath, options = {}) {
        return this._bridge.download(url, filePath, {
            onProgress: options.onProgress,
            timeout: options.timeout || 300000 // 5 minutes default
        });
    }
    
    /**
     * WebSocket connection
     */
    websocket(url, options = {}) {
        return new NexusWebSocket(url, options, this._bridge);
    }
    
    /**
     * Ping host
     */
    async ping(host, options = {}) {
        return this._bridge.ping(host, {
            count: options.count || 4,
            timeout: options.timeout || 5000
        });
    }
    
    /**
     * Port scan
     */
    async scan(host, ports, options = {}) {
        return this._bridge.scan(host, ports, {
            timeout: options.timeout || 3000,
            concurrent: options.concurrent || 10
        });
    }
}

/**
 * HTTP Response wrapper
 */
class HttpResponse {
    constructor(response) {
        this.status = response.status;
        this.statusText = response.statusText;
        this.headers = response.headers;
        this.ok = response.ok;
        this._response = response;
    }
    
    async text() {
        return this._response.text();
    }
    
    async json() {
        return this._response.json();
    }
    
    async blob() {
        return this._response.blob();
    }
    
    async buffer() {
        return this._response.buffer();
    }
    
    header(name) {
        return this.headers[name.toLowerCase()];
    }
}

/**
 * WebSocket wrapper
 */
class NexusWebSocket {
    constructor(url, options, bridge) {
        this.url = url;
        this.options = options;
        this._bridge = bridge;
        this._handlers = {};
    }
    
    async connect() {
        this._ws = await this._bridge.websocket(this.url, this.options);
        this._setupEventHandlers();
        return this;
    }
    
    send(data) {
        if (typeof data === 'object') {
            this._ws.send(JSON.stringify(data));
        } else {
            this._ws.send(data);
        }
    }
    
    on(event, handler) {
        this._handlers[event] = handler;
    }
    
    close() {
        if (this._ws) {
            this._ws.close();
        }
    }
    
    _setupEventHandlers() {
        this._ws.onmessage = (event) => {
            if (this._handlers.message) {
                let data = event.data;
                try {
                    data = JSON.parse(data);
                } catch (e) {
                    // Keep as string if not JSON
                }
                this._handlers.message(data);
            }
        };
        
        this._ws.onopen = () => {
            if (this._handlers.open) {
                this._handlers.open();
            }
        };
        
        this._ws.onclose = () => {
            if (this._handlers.close) {
                this._handlers.close();
            }
        };
        
        this._ws.onerror = (error) => {
            if (this._handlers.error) {
                this._handlers.error(error);
            }
        };
    }
}

/**
 * Utility functions
 */
class NexusUtils {
    /**
     * Sleep for specified milliseconds
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Retry function with exponential backoff
     */
    static async retry(fn, options = {}) {
        const maxAttempts = options.maxAttempts || 3;
        const baseDelay = options.baseDelay || 1000;
        const maxDelay = options.maxDelay || 10000;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                if (attempt === maxAttempts) {
                    throw error;
                }
                
                const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
                await this.sleep(delay);
            }
        }
    }
    
    /**
     * Debounce function
     */
    static debounce(fn, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    }
    
    /**
     * Throttle function
     */
    static throttle(fn, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    /**
     * Format bytes to human readable
     */
    static formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
    /**
     * Generate UUID
     */
    static uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    /**
     * Deep clone object
     */
    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
    
    /**
     * Merge objects deeply
     */
    static deepMerge(target, ...sources) {
        if (!sources.length) return target;
        const source = sources.shift();
        
        if (this.isObject(target) && this.isObject(source)) {
            for (const key in source) {
                if (this.isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    this.deepMerge(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }
        
        return this.deepMerge(target, ...sources);
    }
    
    static isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }
}

/**
 * Transaction support for atomic operations
 */
class NexusTransaction {
    constructor(kernel) {
        this._kernel = kernel;
        this._operations = [];
        this._rollbackHandlers = [];
    }
    
    /**
     * Add operation to transaction
     */
    add(operation, rollback) {
        this._operations.push(operation);
        if (rollback) {
            this._rollbackHandlers.unshift(rollback); // Reverse order for rollback
        }
        return this;
    }
    
    /**
     * Execute all operations atomically
     */
    async execute() {
        const results = [];
        let executed = 0;
        
        try {
            for (const operation of this._operations) {
                const result = await operation();
                results.push(result);
                executed++;
            }
            
            return results;
            
        } catch (error) {
            // Rollback executed operations
            for (let i = 0; i < executed && i < this._rollbackHandlers.length; i++) {
                try {
                    await this._rollbackHandlers[i]();
                } catch (rollbackError) {
                    console.error('Rollback failed:', rollbackError);
                }
            }
            
            throw error;
        }
    }
    
    /**
     * Set rollback handler for the entire transaction
     */
    onRollback(handler) {
        this._globalRollback = handler;
        return this;
    }
}

// Initialize enhanced APIs when C++ bridge is available
if (typeof nexus !== 'undefined' && nexus.fs) {
    // Enhance the existing APIs
    nexus.fs = new NexusFileSystem(nexus.fs);
    nexus.proc = new NexusProcess(nexus.proc);
    nexus.net = new NexusNetwork(nexus.net);
    nexus.utils = NexusUtils;
    
    // Add transaction support
    nexus.transaction = (operations) => {
        const tx = new NexusTransaction();
        if (typeof operations === 'function') {
            return operations(tx);
        }
        return tx;
    };
    
    // Add convenience methods
    nexus.sleep = NexusUtils.sleep;
    nexus.retry = NexusUtils.retry;
    nexus.formatBytes = NexusUtils.formatBytes;
    nexus.uuid = NexusUtils.uuid;
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        NexusFileSystem,
        NexusProcess,
        NexusNetwork,
        NexusUtils,
        NexusTransaction
    };
}