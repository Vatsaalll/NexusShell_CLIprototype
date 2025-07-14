/**
 * NexusShell JavaScript Pipeline Examples
 * Demonstrates the power of dual-mode syntax and object pipelines
 */

// Example 1: File System Operations
async function fileSystemExamples() {
    console.log('=== File System Pipeline Examples ===');
    
    // Find large files in current directory
    const largeFiles = await nexus.fs.dir('.')
        .filter(f => f.isFile && f.size > 1024 * 1024) // > 1MB
        .map(f => ({ name: f.name, size: nexus.formatBytes(f.size) }))
        .toArray();
    
    console.log('Large files:', largeFiles);
    
    // Process log files
    const logAnalysis = await nexus.fs.find(/\.log$/, { type: 'file' })
        .then(async files => {
            const analysis = [];
            for (const file of files) {
                const content = await nexus.fs.file(file).read();
                const lines = content.split('\n');
                const errors = lines.filter(line => line.includes('ERROR')).length;
                const warnings = lines.filter(line => line.includes('WARN')).length;
                
                analysis.push({
                    file,
                    totalLines: lines.length,
                    errors,
                    warnings,
                    size: nexus.formatBytes((await nexus.fs.file(file).stat()).size)
                });
            }
            return analysis;
        });
    
    console.log('Log analysis:', logAnalysis);
    
    // Create backup with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await nexus.fs.dir('./important')
        .list()
        .then(files => {
            return nexus.transaction(tx => {
                files.forEach(file => {
                    tx.add(
                        () => nexus.fs.file(`./backup/${timestamp}/${file.name}`)
                                   .write(nexus.fs.file(`./important/${file.name}`).read()),
                        () => nexus.fs.file(`./backup/${timestamp}/${file.name}`).remove()
                    );
                });
                return tx.execute();
            });
        });
}

// Example 2: Process Management
async function processExamples() {
    console.log('=== Process Management Examples ===');
    
    // Find high CPU processes
    const highCpuProcesses = await nexus.proc.list()
        .filter(p => p.cpu > 5.0)
        .sortBy('cpu', 'desc')
        .map(p => ({
            name: p.name,
            pid: p.pid,
            cpu: `${p.cpu.toFixed(1)}%`,
            memory: nexus.formatBytes(p.memory * 1024 * 1024)
        }))
        .toArray();
    
    console.log('High CPU processes:', highCpuProcesses);
    
    // Monitor system resources
    const monitor = nexus.proc.monitor(async (processes, error) => {
        if (error) {
            console.error('Monitor error:', error);
            return;
        }
        
        const totalCpu = processes.reduce((sum, p) => sum + p.cpu, 0);
        const totalMemory = processes.reduce((sum, p) => sum + p.memory, 0);
        
        console.log(`System load: CPU ${totalCpu.toFixed(1)}%, Memory ${nexus.formatBytes(totalMemory * 1024 * 1024)}`);
        
        // Alert on high usage
        if (totalCpu > 80) {
            console.warn('🚨 High CPU usage detected!');
        }
    }, 5000);
    
    // Stop monitoring after 30 seconds
    setTimeout(() => monitor.stop(), 30000);
    
    // Execute multiple commands in parallel
    const results = await Promise.all([
        nexus.proc.exec('ps aux'),
        nexus.proc.exec('df -h'),
        nexus.proc.exec('free -m'),
        nexus.proc.exec('uptime')
    ]);
    
    console.log('System info collected:', results.map(r => r.command));
}

// Example 3: Network Operations
async function networkExamples() {
    console.log('=== Network Pipeline Examples ===');
    
    // API data processing pipeline
    const githubUsers = await nexus.net.get('https://api.github.com/users')
        .then(response => response.json())
        .then(users => users.slice(0, 5)) // First 5 users
        .then(async users => {
            // Fetch detailed info for each user
            const detailed = await Promise.all(
                users.map(user => 
                    nexus.net.get(user.url).then(r => r.json())
                )
            );
            
            return detailed.map(user => ({
                login: user.login,
                name: user.name || 'N/A',
                company: user.company || 'N/A',
                publicRepos: user.public_repos,
                followers: user.followers,
                profileUrl: user.html_url
            }));
        });
    
    console.log('GitHub users:', githubUsers);
    
    // Download and process multiple files
    const urls = [
        'https://jsonplaceholder.typicode.com/posts/1',
        'https://jsonplaceholder.typicode.com/posts/2',
        'https://jsonplaceholder.typicode.com/posts/3'
    ];
    
    const posts = await Promise.all(
        urls.map(url => nexus.net.get(url).then(r => r.json()))
    ).then(posts => 
        posts.map(post => ({
            id: post.id,
            title: post.title.substring(0, 50) + '...',
            wordCount: post.body.split(' ').length,
            charCount: post.body.length
        }))
    );
    
    console.log('Processed posts:', posts);
    
    // Health check multiple services
    const services = [
        'https://httpbin.org/status/200',
        'https://httpbin.org/status/404',
        'https://httpbin.org/delay/2'
    ];
    
    const healthChecks = await Promise.allSettled(
        services.map(async url => {
            const start = Date.now();
            try {
                const response = await nexus.net.get(url, { timeout: 3000 });
                return {
                    url,
                    status: response.status,
                    responseTime: Date.now() - start,
                    healthy: response.ok
                };
            } catch (error) {
                return {
                    url,
                    status: 'error',
                    responseTime: Date.now() - start,
                    healthy: false,
                    error: error.message
                };
            }
        })
    );
    
    console.log('Health checks:', healthChecks.map(result => result.value || result.reason));
}

// Example 4: Complex Data Processing
async function dataProcessingExamples() {
    console.log('=== Data Processing Pipeline Examples ===');
    
    // Process CSV data
    const csvData = await nexus.fs.file('./data/sales.csv')
        .csv()
        .then(data => 
            data
                .filter(row => parseFloat(row.amount) > 100)
                .map(row => ({
                    ...row,
                    amount: parseFloat(row.amount),
                    date: new Date(row.date),
                    category: row.category.toLowerCase()
                }))
                .reduce((acc, row) => {
                    const month = row.date.toISOString().substring(0, 7);
                    if (!acc[month]) acc[month] = { total: 0, count: 0 };
                    acc[month].total += row.amount;
                    acc[month].count += 1;
                    return acc;
                }, {})
        )
        .then(monthlyData => 
            Object.entries(monthlyData).map(([month, data]) => ({
                month,
                totalSales: data.total,
                averageSale: data.total / data.count,
                transactionCount: data.count
            }))
        );
    
    console.log('Monthly sales summary:', csvData);
    
    // Log analysis pipeline
    const logInsights = await nexus.fs.find(/access\.log$/, { type: 'file' })
        .then(async logFiles => {
            const insights = {
                totalRequests: 0,
                statusCodes: {},
                topIPs: {},
                topPaths: {},
                errors: []
            };
            
            for (const logFile of logFiles) {
                const lines = await nexus.fs.file(logFile).lines();
                
                for (const line of lines) {
                    // Parse Apache/Nginx log format
                    const match = line.match(/^(\S+) \S+ \S+ \[(.*?)\] "(\S+) (\S+) \S+" (\d+) (\d+)/);
                    if (!match) continue;
                    
                    const [, ip, timestamp, method, path, status, size] = match;
                    
                    insights.totalRequests++;
                    
                    // Count status codes
                    insights.statusCodes[status] = (insights.statusCodes[status] || 0) + 1;
                    
                    // Count IPs
                    insights.topIPs[ip] = (insights.topIPs[ip] || 0) + 1;
                    
                    // Count paths
                    insights.topPaths[path] = (insights.topPaths[path] || 0) + 1;
                    
                    // Collect errors
                    if (status.startsWith('4') || status.startsWith('5')) {
                        insights.errors.push({ ip, path, status, timestamp });
                    }
                }
            }
            
            // Sort and limit top entries
            insights.topIPs = Object.entries(insights.topIPs)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .reduce((obj, [ip, count]) => ({ ...obj, [ip]: count }), {});
            
            insights.topPaths = Object.entries(insights.topPaths)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .reduce((obj, [path, count]) => ({ ...obj, [path]: count }), {});
            
            return insights;
        });
    
    console.log('Log insights:', logInsights);
}

// Example 5: System Administration Tasks
async function systemAdminExamples() {
    console.log('=== System Administration Examples ===');
    
    // Disk usage analysis
    const diskUsage = await nexus.fs.dir('/')
        .list()
        .then(async entries => {
            const usage = [];
            for (const entry of entries.filter(e => e.isDirectory)) {
                try {
                    const size = await nexus.fs.dir(entry.path).size();
                    usage.push({
                        directory: entry.name,
                        size: nexus.formatBytes(size),
                        sizeBytes: size
                    });
                } catch (error) {
                    // Skip directories we can't access
                }
            }
            return usage.sort((a, b) => b.sizeBytes - a.sizeBytes);
        });
    
    console.log('Disk usage by directory:', diskUsage.slice(0, 10));
    
    // Service health monitoring
    const serviceCheck = await nexus.transaction(tx => {
        const services = ['nginx', 'mysql', 'redis'];
        
        services.forEach(service => {
            tx.add(
                () => nexus.proc.exec(`systemctl is-active ${service}`),
                () => console.log(`Failed to check ${service}`)
            );
        });
        
        return tx.execute();
    }).then(results => 
        results.map((result, index) => ({
            service: ['nginx', 'mysql', 'redis'][index],
            status: result.stdout.trim(),
            healthy: result.success
        }))
    );
    
    console.log('Service status:', serviceCheck);
    
    // Automated backup with verification
    const backupResult = await nexus.transaction(tx => {
        const timestamp = new Date().toISOString().split('T')[0];
        const backupPath = `/backup/${timestamp}`;
        
        tx.add(
            () => nexus.proc.exec(`mkdir -p ${backupPath}`),
            () => nexus.proc.exec(`rm -rf ${backupPath}`)
        );
        
        tx.add(
            () => nexus.proc.exec(`tar -czf ${backupPath}/data.tar.gz /var/data`),
            () => nexus.proc.exec(`rm -f ${backupPath}/data.tar.gz`)
        );
        
        tx.add(
            () => nexus.proc.exec(`tar -czf ${backupPath}/config.tar.gz /etc/myapp`),
            () => nexus.proc.exec(`rm -f ${backupPath}/config.tar.gz`)
        );
        
        return tx.execute();
    }).then(async results => {
        // Verify backup integrity
        const verification = await nexus.proc.exec(`tar -tzf /backup/${new Date().toISOString().split('T')[0]}/data.tar.gz | wc -l`);
        
        return {
            backupCompleted: results.every(r => r.success),
            filesBackedUp: parseInt(verification.stdout.trim()),
            timestamp: new Date().toISOString()
        };
    });
    
    console.log('Backup result:', backupResult);
}

// Example 6: Real-time Data Streaming
async function streamingExamples() {
    console.log('=== Real-time Streaming Examples ===');
    
    // WebSocket data processing
    const ws = await nexus.net.websocket('wss://stream.example.com/data').connect();
    
    const dataBuffer = [];
    const batchSize = 100;
    
    ws.on('message', async (data) => {
        dataBuffer.push({
            ...data,
            timestamp: Date.now(),
            processed: false
        });
        
        if (dataBuffer.length >= batchSize) {
            const batch = dataBuffer.splice(0, batchSize);
            
            // Process batch
            const processed = batch
                .filter(item => item.value > 0)
                .map(item => ({
                    ...item,
                    normalized: item.value / 100,
                    category: item.value > 50 ? 'high' : 'low',
                    processed: true
                }));
            
            // Save to file
            await nexus.fs.file(`./data/batch-${Date.now()}.json`)
                .write(JSON.stringify(processed, null, 2));
            
            console.log(`Processed batch of ${processed.length} items`);
        }
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
    
    // File watching and processing
    const watcher = nexus.fs.watch('./incoming', async (event) => {
        if (event.eventType === 'rename' && event.filename.endsWith('.json')) {
            const filePath = `./incoming/${event.filename}`;
            
            try {
                // Wait a bit for file to be fully written
                await nexus.sleep(100);
                
                const data = await nexus.fs.file(filePath).json();
                
                // Process the data
                const processed = {
                    ...data,
                    processedAt: new Date().toISOString(),
                    checksum: nexus.utils.hash(JSON.stringify(data))
                };
                
                // Move to processed directory
                await nexus.fs.file(`./processed/${event.filename}`)
                    .write(JSON.stringify(processed, null, 2));
                
                // Remove original
                await nexus.proc.exec(`rm ${filePath}`);
                
                console.log(`Processed file: ${event.filename}`);
                
            } catch (error) {
                console.error(`Failed to process ${event.filename}:`, error);
                
                // Move to error directory
                await nexus.proc.exec(`mv ${filePath} ./error/`);
            }
        }
    });
    
    // Stop watching after 5 minutes
    setTimeout(() => watcher.stop(), 5 * 60 * 1000);
}

// Run all examples
async function runAllExamples() {
    try {
        await fileSystemExamples();
        await nexus.sleep(1000);
        
        await processExamples();
        await nexus.sleep(1000);
        
        await networkExamples();
        await nexus.sleep(1000);
        
        await dataProcessingExamples();
        await nexus.sleep(1000);
        
        await systemAdminExamples();
        await nexus.sleep(1000);
        
        await streamingExamples();
        
    } catch (error) {
        console.error('Example execution failed:', error);
    }
}

// Export for use in NexusShell
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        fileSystemExamples,
        processExamples,
        networkExamples,
        dataProcessingExamples,
        systemAdminExamples,
        streamingExamples,
        runAllExamples
    };
}

// Auto-run if executed directly
if (typeof nexus !== 'undefined') {
    console.log('🚀 Running NexusShell JavaScript Pipeline Examples');
    runAllExamples();
}