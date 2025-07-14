#pragma once

#include "nexus_types.h"
#include "thread_pool.h"
#include <memory>
#include <future>
#include <unordered_map>

namespace Nexus {

// Forward declaration
class NexusKernel;

/**
 * OrionExecutionEngine - JIT compilation and concurrent execution engine
 */
class OrionExecutionEngine {
public:
    explicit OrionExecutionEngine(NexusKernel* kernel, ThreadPool* thread_pool);
    ~OrionExecutionEngine();

    // Command execution
    NexusObject execute_single_command(const ParsedCommand& command, const CommandContext& context);
    NexusObject execute_pipeline(const std::vector<std::string>& commands, const CommandContext& context);
    
    // Async execution
    std::future<NexusObject> execute_async(const std::string& command, const CommandContext& context);
    std::future<NexusObject> execute_pipeline_async(const std::vector<std::string>& commands, const CommandContext& context);
    
    // Command registration
    void register_native_command(const std::string& name, CommandHandler handler);
    void unregister_command(const std::string& name);
    
    // JIT compilation
    bool compile_pipeline(const std::vector<std::string>& commands);
    void clear_compiled_cache();
    
    // Performance optimization
    void enable_jit_compilation(bool enable) { jit_enabled_ = enable; }
    void set_pipeline_cache_size(size_t size) { max_cache_size_ = size; }

private:
    NexusKernel* kernel_;
    ThreadPool* thread_pool_;
    
    // Command registry
    std::unordered_map<std::string, CommandHandler> native_commands_;
    
    // JIT compilation
    bool jit_enabled_ = true;
    size_t max_cache_size_ = 1000;
    std::unordered_map<std::string, std::shared_ptr<void>> compiled_pipelines_;
    
    // Internal execution methods
    NexusObject execute_native_command(const std::string& name, const CommandContext& context);
    NexusObject execute_system_command(const std::string& command, const CommandContext& context);
    
    // Pipeline optimization
    std::vector<std::string> optimize_pipeline(const std::vector<std::string>& commands);
    bool can_parallelize_pipeline(const std::vector<std::string>& commands);
    
    // Built-in commands
    void register_builtin_commands();
    
    // Command implementations
    static NexusObject cmd_ls(const CommandContext& context);
    static NexusObject cmd_cd(const CommandContext& context);
    static NexusObject cmd_pwd(const CommandContext& context);
    static NexusObject cmd_mkdir(const CommandContext& context);
    static NexusObject cmd_rm(const CommandContext& context);
    static NexusObject cmd_cp(const CommandContext& context);
    static NexusObject cmd_mv(const CommandContext& context);
    static NexusObject cmd_cat(const CommandContext& context);
    static NexusObject cmd_ps(const CommandContext& context);
    static NexusObject cmd_kill(const CommandContext& context);
    static NexusObject cmd_help(const CommandContext& context);
    static NexusObject cmd_exit(const CommandContext& context);
};

} // namespace Nexus