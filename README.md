# NexusShell - Next-Generation CLI

A revolutionary command-line shell that combines C++ performance with JavaScript extensibility, featuring dual-mode syntax, zero-copy pipelines, and advanced security.

## 🌟 Features

### Core Architecture
- **C++ Core Engine**: High-performance kernel with <500KB footprint
- **V8 JavaScript Runtime**: Full ES2023 support with isolate sandboxing
- **Dual-Mode Syntax**: Traditional shell commands + JavaScript object pipelines
- **Zero-Copy Pipelines**: Shared memory between C++ and JavaScript
- **JIT Compilation**: Optimized execution for hot command paths
- **Multi-threaded Execution**: Concurrent pipeline processing

### Advanced Capabilities
- **Time Travel Debugging**: Record and replay command sessions
- **Transaction Support**: Atomic operations with automatic rollback
- **Capability-based Security**: Fine-grained permission system
- **Plugin Architecture**: Extensible with native and JavaScript modules
- **Real-time Monitoring**: Performance metrics and resource tracking
- **AI Integration**: Intelligent command prediction and assistance

## 🚀 Quick Start

### Installation

#### Prerequisites
```bash
# Ubuntu/Debian
sudo apt-get install build-essential cmake libv8-dev libuv1-dev libabsl-dev

# macOS
brew install cmake v8 libuv abseil simdjson

# Arch Linux
sudo pacman -S cmake v8 libuv abseil-cpp simdjson
```

#### Build from Source
```bash
git clone https://github.com/nexusshell/nexusshell.git
cd nexusshell
chmod +x build.sh
./build.sh
```

#### Binary Installation
```bash
# Download latest release
curl -L https://github.com/nexusshell/nexusshell/releases/latest/download/nexus-linux-x64.tar.gz | tar xz
sudo mv nexus /usr/local/bin/
```

### First Run
```bash
nexus
```

## 💡 Usage Examples

### Traditional Shell Mode
```bash
# Standard commands work as expected
ls -la | grep ".txt" | wc -l
cd /var/log && tail -f syslog
ps aux | grep nginx | awk '{print $2}' | xargs kill
```

### JavaScript Object Pipeline Mode
```javascript
// File system operations
nexus.fs.dir("/data")
  .filter(f => f.size > 1024 * 1024)  // Files > 1MB
  .map(f => ({ name: f.name, size: nexus.formatBytes(f.size) }))
  .forEach(f => console.log(`${f.name}: ${f.size}`))

// Process management
nexus.proc.list()
  .filter(p => p.cpu > 5.0)
  .sortBy('cpu', 'desc')
  .map(p => ({ name: p.name, cpu: `${p.cpu}%`, memory: nexus.formatBytes(p.memory) }))
  .toJSON()

// Network operations
const response = await nexus.net.get("https://api.github.com/users/octocat")
const user = await response.json()
console.log(`${user.name} has ${user.public_repos} repositories`)
```

### Advanced Pipelines
```javascript
// Log analysis pipeline
const errors = await nexus.fs.find(/\.log$/, { type: 'file' })
  .then(async files => {
    const analysis = []
    for (const file of files) {
      const lines = await nexus.fs.file(file).lines()
      const errorCount = lines.filter(line => line.includes('ERROR')).length
      analysis.push({ file, errors: errorCount })
    }
    return analysis.filter(a => a.errors > 0)
  })

// System monitoring
nexus.proc.monitor((processes) => {
  const highCpu = processes.filter(p => p.cpu > 80)
  if (highCpu.length > 0) {
    console.warn('🚨 High CPU usage detected:', highCpu.map(p => p.name))
  }
}, 5000)

// Automated deployment
await nexus.transaction(tx => {
  tx.add(() => nexus.proc.exec('git pull origin main'))
  tx.add(() => nexus.proc.exec('npm install'))
  tx.add(() => nexus.proc.exec('npm run build'))
  tx.add(() => nexus.proc.exec('pm2 restart all'))
  return tx.execute()
}).onRollback(() => {
  console.log('Deployment failed, rolling back...')
  nexus.proc.exec('git reset --hard HEAD~1')
})
```

## 🔧 Configuration

### Shell Configuration (`/etc/nexus/nexus.conf`)
```json
{
  "shell": {
    "maxMemory": "50MB",
    "enableJIT": true,
    "enableSandbox": true,
    "enableDebug": false,
    "threadPoolSize": 8
  },
  "security": {
    "defaultPolicy": "sandbox",
    "auditLogging": true,
    "capabilities": ["fs:user-directory", "net:local", "proc:list"]
  },
  "performance": {
    "monitoring": true,
    "thresholds": {
      "memoryWarning": "40MB",
      "latencyWarning": "1000ms"
    }
  }
}
```

### Environment Variables
```bash
export NEXUS_DEBUG=true
export NEXUS_MAX_MEMORY=100MB
export NEXUS_PLUGIN_PATH="/usr/local/lib/nexus/plugins"
export NEXUS_JS_PATH="/usr/local/share/nexus/js"
```

## 🔒 Security Model

### Capability-based Permissions
```javascript
// Grant specific permissions
nexus.security.grant('fs:read:/var/log/*')
nexus.security.grant('proc:kill:self-owned')
nexus.security.grant('net:connect:api.example.com:443')

// Create sandboxed environment
const sandbox = nexus.security.createSandbox(['fs:read:./data/*'])
sandbox.execute(() => {
  // Limited access within sandbox
  nexus.fs.readFile('./data/safe.txt')
})
```

### Security Policies
```javascript
// Apply predefined security policy
nexus.security.applyPolicy('developer')  // Full access for development
nexus.security.applyPolicy('production') // Restricted for production
nexus.security.applyPolicy('sandbox')    // Minimal permissions
```

## 🔌 Plugin Development

### Native C++ Plugin
```cpp
#include "nexus_plugin.h"

class MyPlugin : public Nexus::Plugin {
public:
    bool initialize(Nexus::NexusKernel* kernel) override {
        kernel->execution_engine()->register_native_command(
            "my-command", 
            [](const Nexus::CommandContext& ctx) {
                Nexus::NexusObject result;
                result.metadata.type = "string";
                result.value = "Hello from C++ plugin!";
                return result;
            }
        );
        return true;
    }
};

NEXUS_PLUGIN_EXPORT(MyPlugin)
```

### JavaScript Plugin
```javascript
// my-plugin.js
export async function initialize(nexus) {
    nexus.registerCommand('my-js-command', async ({ args, flags }) => {
        return `Hello ${args[0] || 'World'} from JavaScript plugin!`
    }, {
        description: 'Example JavaScript command',
        usage: 'my-js-command [name]'
    })
    
    // Add custom API
    nexus.myPlugin = {
        async processData(data) {
            return data.map(item => ({ ...item, processed: true }))
        }
    }
}
```

## 📊 Performance Monitoring

### Built-in Metrics
```javascript
// Get performance report
const metrics = nexus.performance.getReport()
console.log(`Commands executed: ${metrics.commandThroughput}`)
console.log(`Average latency: ${metrics.latency.avg}ms`)
console.log(`Memory usage: ${nexus.formatBytes(metrics.memory.current)}`)

// Set performance thresholds
nexus.performance.setThresholds({
    memoryWarning: 40 * 1024 * 1024,  // 40MB
    latencyWarning: 1000,             // 1 second
    cpuWarning: 80                    // 80%
})
```

### Real-time Monitoring
```javascript
// Monitor shell performance
nexus.performance.monitor((metrics) => {
    if (metrics.memory.current > metrics.thresholds.memory) {
        console.warn('🚨 High memory usage:', nexus.formatBytes(metrics.memory.current))
    }
    
    if (metrics.latency.p95 > metrics.thresholds.latency) {
        console.warn('🚨 High latency detected:', `${metrics.latency.p95}ms`)
    }
}, 10000) // Every 10 seconds
```

## 🎯 Time Travel Debugging

### Recording Sessions
```javascript
// Start recording
nexus.recorder.start('deployment-session')

// Execute commands...
await nexus.proc.exec('git pull')
await nexus.proc.exec('npm install')
await nexus.proc.exec('npm run build')

// Stop recording
const recording = await nexus.recorder.stop()
console.log(`Recorded ${recording.commands.length} commands`)
```

### Replay and Debug
```javascript
// List recordings
const recordings = nexus.recorder.list()
console.log('Available recordings:', recordings.map(r => r.name))

// Replay with breakpoints
await nexus.recorder.replay(1, {
    breakpoints: [2, 4],  // Stop at commands 2 and 4
    speed: 0.5,           // Half speed
    stepMode: true        // Manual stepping
})

// Export recording as script
const script = nexus.recorder.export(1, 'script')
await nexus.fs.writeFile('./deployment.nx', script)
```

## 🌐 Network Operations

### HTTP Client
```javascript
// Simple requests
const response = await nexus.net.get('https://api.example.com/data')
const data = await response.json()

// Advanced requests with options
const result = await nexus.net.post('https://api.example.com/users', {
    name: 'John Doe',
    email: 'john@example.com'
}, {
    headers: { 'Authorization': 'Bearer token123' },
    timeout: 10000,
    retry: { maxAttempts: 3, backoff: 'exponential' }
})
```

### WebSocket Support
```javascript
// Real-time data streaming
const ws = await nexus.net.websocket('wss://stream.example.com/data')
await ws.connect()

ws.on('message', (data) => {
    console.log('Received:', data)
    
    // Process and store data
    nexus.fs.file(`./data/${Date.now()}.json`)
        .write(JSON.stringify(data, null, 2))
})

ws.on('error', (error) => {
    console.error('WebSocket error:', error)
})
```

### File Downloads
```javascript
// Download with progress
await nexus.net.download(
    'https://example.com/large-file.zip',
    './downloads/file.zip',
    {
        onProgress: (progress) => {
            console.log(`Download progress: ${progress.percent}%`)
        }
    }
)
```

## 🤖 AI Integration

### Command Prediction
```javascript
// Enable AI assistance
nexus.ai.enable()

// Get command suggestions
const suggestions = await nexus.ai.suggest('find large files in /var/log')
console.log('Suggested commands:', suggestions)

// Auto-complete with AI
nexus.ai.onComplete((partial) => {
    return nexus.ai.complete(partial)
})
```

### Natural Language Processing
```javascript
// Convert natural language to commands
const command = await nexus.ai.parse('show me all running processes using more than 100MB of memory')
console.log('Generated command:', command)
// Output: nexus.proc.list().filter(p => p.memory > 100 * 1024 * 1024)

// Execute AI-generated commands
const result = await nexus.ai.execute('backup all log files from last week')
```

## 📚 API Reference

### File System API
```javascript
// Directory operations
nexus.fs.dir(path)
  .list()                    // List contents
  .filter(predicate)         // Filter entries
  .map(transform)           // Transform entries
  .forEach(callback)        // Execute for each
  .size()                   // Get total size
  .toArray()               // Convert to array
  .toJSON()                // Convert to JSON
  .toCSV()                 // Convert to CSV

// File operations
nexus.fs.file(path)
  .read(options)           // Read content
  .write(content, options) // Write content
  .append(content)         // Append content
  .stat()                  // Get file stats
  .watch(callback)         // Watch for changes
  .lines()                 // Get lines array
  .grep(pattern)           // Search content
  .json()                  // Parse as JSON
  .csv()                   // Parse as CSV
```

### Process API
```javascript
// Process management
nexus.proc.list()
  .filter(predicate)       // Filter processes
  .map(transform)          // Transform data
  .sortBy(key, direction)  // Sort processes
  .killAll(signal)         // Kill all processes
  .toArray()              // Convert to array
  .toJSON()               // Convert to JSON

// Process execution
nexus.proc.exec(command, options)
nexus.proc.spawn(command, args, options)
nexus.proc.kill(pid, signal)
nexus.proc.info(pid)
nexus.proc.monitor(callback, interval)
```

### Network API
```javascript
// HTTP operations
nexus.net.get(url, options)
nexus.net.post(url, data, options)
nexus.net.put(url, data, options)
nexus.net.delete(url, options)
nexus.net.download(url, path, options)

// WebSocket operations
nexus.net.websocket(url, options)
  .connect()
  .send(data)
  .on(event, handler)
  .close()

// Network utilities
nexus.net.ping(host, options)
nexus.net.scan(host, ports, options)
nexus.net.resolve(hostname)
```

### Utility Functions
```javascript
// Common utilities
nexus.sleep(ms)                    // Sleep for milliseconds
nexus.retry(fn, options)           // Retry with backoff
nexus.formatBytes(bytes)           // Format bytes to human readable
nexus.uuid()                       // Generate UUID
nexus.hash(data, algorithm)        // Generate hash
nexus.timestamp()                  // Get current timestamp
nexus.parseArgs(args)              // Parse command arguments
```

## 🛠️ Development

### Building from Source
```bash
# Clone repository
git clone https://github.com/nexusshell/nexusshell.git
cd nexusshell

# Install dependencies
./scripts/install-deps.sh

# Build
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)

# Install
sudo make install
```

### Running Tests
```bash
# C++ tests
cd build && make test

# JavaScript tests
npm test

# Integration tests
./scripts/test-integration.sh
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

NexusShell is released under the MIT License. See [LICENSE](LICENSE) for details.



## 🙏 Acknowledgments

NexusShell is inspired by the best features of modern shells and development tools:

- **Bash**: Time-tested shell functionality
- **PowerShell**: Object-oriented pipeline concepts
- **Fish**: User-friendly interactive features
- **Zsh**: Advanced completion and customization
- **Node.js**: JavaScript runtime capabilities
- **V8**: High-performance JavaScript engine

---

**NexusShell** - *Where Performance Meets Flexibility*

Built with ❤️ by the NexusShell team and contributors worldwide.
