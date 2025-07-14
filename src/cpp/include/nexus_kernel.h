#pragma once

#include "nexus_types.h"
#include "quantum_parser.h"
#include "orion_execution_engine.h"
#include "stellar_object_bridge.h"
#include "security_context.h"
#include "memory_manager.h"
#include "thread_pool.h"

#include <v8.h>
#include <uv.h>
#include <memory>
#include <atomic>
#include <unordered_map>

namespace Nexus {

/**
 * NexusKernel - Core shell engine
 * Manages all shell components and coordinates execution
 */
class NexusKernel {
public:
    explicit NexusKernel(const std::string& config_path = "");
    ~NexusKernel();

    // Lifecycle management
    bool initialize();
    void shutdown();
    bool is_running() const { return running_.load(); }

    // Command execution
    NexusObject execute_command(const std::string& input, const CommandContext& context = {});
    NexusObject execute_pipeline(const std::vector<std::string>& commands, const CommandContext& context = {});
    NexusObject execute_js_pipeline(const std::string& js_code, const CommandContext& context = {});

    // Transaction support
    ObjectId begin_transaction();
    void commit_transaction(ObjectId transaction_id);
    void rollback_transaction(ObjectId transaction_id);

    // Component access
    QuantumParser* parser() { return parser_.get(); }
    OrionExecutionEngine* execution_engine() { return execution_engine_.get(); }
    StellarObjectBridge* object_bridge() { return object_bridge_.get(); }
    SecurityContext* security_context() { return security_context_.get(); }
    MemoryManager* memory_manager() { return memory_manager_.get(); }
    ThreadPool* thread_pool() { return thread_pool_.get(); }

    // Performance monitoring
    PerformanceMetrics get_performance_metrics() const;
    void reset_performance_metrics();

    // Plugin management
    bool load_plugin(const std::string& plugin_path);
    void unload_plugin(const std::string& plugin_name);

    // Configuration
    void set_config(const std::string& key, const std::string& value);
    std::string get_config(const std::string& key) const;

private:
    // Core components
    std::unique_ptr<QuantumParser> parser_;
    std::unique_ptr<OrionExecutionEngine> execution_engine_;
    std::unique_ptr<StellarObjectBridge> object_bridge_;
    std::unique_ptr<SecurityContext> security_context_;
    std::unique_ptr<MemoryManager> memory_manager_;
    std::unique_ptr<ThreadPool> thread_pool_;

    // V8 JavaScript runtime
    v8::Isolate* isolate_;
    v8::Global<v8::Context> global_context_;

    // libuv event loop
    uv_loop_t* event_loop_;

    // State management
    std::atomic<bool> running_{false};
    std::unordered_map<std::string, std::string> config_;
    std::unordered_map<ObjectId, TransactionState> transactions_;
    
    // Performance tracking
    mutable std::mutex metrics_mutex_;
    PerformanceMetrics metrics_{};

    // Internal methods
    bool initialize_v8();
    bool initialize_libuv();
    void setup_js_globals();
    void cleanup_v8();
    void cleanup_libuv();
};

} // namespace Nexus