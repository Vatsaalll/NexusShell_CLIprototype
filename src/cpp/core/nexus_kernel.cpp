#include "nexus_kernel.h"
#include "nova_terminal_ui.h"
#include <iostream>
#include <fstream>
#include <chrono>
#include <simdjson.h>

namespace Nexus {

NexusKernel::NexusKernel(const std::string& config_path) {
    // Load configuration
    if (!config_path.empty()) {
        std::ifstream config_file(config_path);
        if (config_file.is_open()) {
            simdjson::dom::parser parser;
            simdjson::dom::element config = parser.load(config_file);
            
            for (auto [key, value] : config.get_object()) {
                config_[std::string(key)] = std::string(value.get_string());
            }
        }
    }

    // Set default configuration
    if (config_.find("max_memory") == config_.end()) {
        config_["max_memory"] = "52428800"; // 50MB
    }
    if (config_.find("thread_pool_size") == config_.end()) {
        config_["thread_pool_size"] = "8";
    }
}

NexusKernel::~NexusKernel() {
    shutdown();
}

bool NexusKernel::initialize() {
    if (running_.load()) {
        return true;
    }

    try {
        // Initialize memory manager first
        memory_manager_ = std::make_unique<MemoryManager>(
            std::stoull(config_["max_memory"])
        );

        // Initialize thread pool
        thread_pool_ = std::make_unique<ThreadPool>(
            std::stoi(config_["thread_pool_size"])
        );

        // Initialize security context
        security_context_ = std::make_unique<SecurityContext>();
        if (!security_context_->initialize()) {
            std::cerr << "Failed to initialize security context\n";
            return false;
        }

        // Initialize V8 JavaScript engine
        if (!initialize_v8()) {
            std::cerr << "Failed to initialize V8 engine\n";
            return false;
        }

        // Initialize libuv event loop
        if (!initialize_libuv()) {
            std::cerr << "Failed to initialize libuv\n";
            return false;
        }

        // Initialize object bridge
        object_bridge_ = std::make_unique<StellarObjectBridge>(
            isolate_, security_context_.get()
        );
        if (!object_bridge_->initialize()) {
            std::cerr << "Failed to initialize object bridge\n";
            return false;
        }

        // Initialize parser
        parser_ = std::make_unique<QuantumParser>();

        // Initialize execution engine
        execution_engine_ = std::make_unique<OrionExecutionEngine>(
            this, thread_pool_.get()
        );

        // Setup JavaScript global objects
        setup_js_globals();

        running_.store(true);
        
        std::cout << "🚀 NexusShell kernel initialized successfully\n";
        return true;

    } catch (const std::exception& e) {
        std::cerr << "Kernel initialization failed: " << e.what() << "\n";
        return false;
    }
}

void NexusKernel::shutdown() {
    if (!running_.load()) {
        return;
    }

    running_.store(false);

    // Shutdown components in reverse order
    execution_engine_.reset();
    parser_.reset();
    object_bridge_.reset();
    
    cleanup_v8();
    cleanup_libuv();
    
    security_context_.reset();
    thread_pool_.reset();
    memory_manager_.reset();

    std::cout << "🛑 NexusShell kernel shutdown complete\n";
}

NexusObject NexusKernel::execute_command(const std::string& input, const CommandContext& context) {
    auto start_time = std::chrono::high_resolution_clock::now();
    
    try {
        // Security check
        if (!security_context_->check_permission("command:execute", input)) {
            throw std::runtime_error("Permission denied: " + input);
        }

        // Parse command
        auto parsed = parser_->parse(input);
        
        // Execute based on type
        NexusObject result;
        if (parsed.is_js_pipeline) {
            result = execute_js_pipeline(parsed.js_code, context);
        } else if (parsed.is_pipeline) {
            result = execute_pipeline(parsed.commands, context);
        } else {
            result = execution_engine_->execute_single_command(parsed.commands[0], context);
        }

        // Update performance metrics
        auto end_time = std::chrono::high_resolution_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::microseconds>(end_time - start_time);
        
        {
            std::lock_guard<std::mutex> lock(metrics_mutex_);
            metrics_.commands_executed++;
            metrics_.total_execution_time_us += duration.count();
            metrics_.memory_usage_bytes = memory_manager_->get_used_memory();
        }

        return result;

    } catch (const std::exception& e) {
        NexusObject error_obj;
        error_obj.metadata.type = "error";
        error_obj.value = std::string("Command execution failed: ") + e.what();
        return error_obj;
    }
}

NexusObject NexusKernel::execute_pipeline(const std::vector<std::string>& commands, const CommandContext& context) {
    return execution_engine_->execute_pipeline(commands, context);
}

NexusObject NexusKernel::execute_js_pipeline(const std::string& js_code, const CommandContext& context) {
    v8::Isolate::Scope isolate_scope(isolate_);
    v8::HandleScope handle_scope(isolate_);
    v8::Local<v8::Context> local_context = global_context_.Get(isolate_);
    v8::Context::Scope context_scope(local_context);

    try {
        // Compile JavaScript code
        v8::Local<v8::String> source = v8::String::NewFromUtf8(
            isolate_, js_code.c_str(), v8::NewStringType::kNormal
        ).ToLocalChecked();

        v8::Local<v8::Script> script = v8::Script::Compile(local_context, source).ToLocalChecked();
        
        // Execute JavaScript
        v8::Local<v8::Value> result = script->Run(local_context).ToLocalChecked();
        
        // Convert result back to NexusObject
        return object_bridge_->js_to_nexus(result);

    } catch (const std::exception& e) {
        NexusObject error_obj;
        error_obj.metadata.type = "js_error";
        error_obj.value = std::string("JavaScript execution failed: ") + e.what();
        return error_obj;
    }
}

ObjectId NexusKernel::begin_transaction() {
    ObjectId transaction_id = std::chrono::duration_cast<std::chrono::nanoseconds>(
        std::chrono::high_resolution_clock::now().time_since_epoch()
    ).count();

    TransactionState state;
    state.transaction_id = transaction_id;
    
    transactions_[transaction_id] = std::move(state);
    return transaction_id;
}

void NexusKernel::commit_transaction(ObjectId transaction_id) {
    auto it = transactions_.find(transaction_id);
    if (it != transactions_.end()) {
        transactions_.erase(it);
    }
}

void NexusKernel::rollback_transaction(ObjectId transaction_id) {
    auto it = transactions_.find(transaction_id);
    if (it != transactions_.end()) {
        if (it->second.rollback_handler) {
            it->second.rollback_handler();
        }
        transactions_.erase(it);
    }
}

PerformanceMetrics NexusKernel::get_performance_metrics() const {
    std::lock_guard<std::mutex> lock(metrics_mutex_);
    return metrics_;
}

void NexusKernel::reset_performance_metrics() {
    std::lock_guard<std::mutex> lock(metrics_mutex_);
    metrics_ = {};
}

bool NexusKernel::initialize_v8() {
    // Initialize V8
    v8::V8::InitializeICUDefaultLocation("");
    v8::V8::InitializeExternalStartupData("");
    
    std::unique_ptr<v8::Platform> platform = v8::platform::NewDefaultPlatform();
    v8::V8::InitializePlatform(platform.get());
    v8::V8::Initialize();

    // Create isolate
    v8::Isolate::CreateParams create_params;
    create_params.array_buffer_allocator = v8::ArrayBuffer::Allocator::NewDefaultAllocator();
    isolate_ = v8::Isolate::New(create_params);

    if (!isolate_) {
        return false;
    }

    // Create global context
    v8::Isolate::Scope isolate_scope(isolate_);
    v8::HandleScope handle_scope(isolate_);
    v8::Local<v8::Context> context = v8::Context::New(isolate_);
    global_context_.Reset(isolate_, context);

    return true;
}

bool NexusKernel::initialize_libuv() {
    event_loop_ = uv_default_loop();
    return event_loop_ != nullptr;
}

void NexusKernel::setup_js_globals() {
    v8::Isolate::Scope isolate_scope(isolate_);
    v8::HandleScope handle_scope(isolate_);
    v8::Local<v8::Context> context = global_context_.Get(isolate_);
    v8::Context::Scope context_scope(context);

    // Setup global nexus object
    v8::Local<v8::Object> nexus_global = v8::Object::New(isolate_);
    
    // Add filesystem API
    v8::Local<v8::Object> fs_api = object_bridge_->create_filesystem_api();
    nexus_global->Set(context, 
        v8::String::NewFromUtf8(isolate_, "fs").ToLocalChecked(), 
        fs_api
    ).Check();

    // Add process API
    v8::Local<v8::Object> proc_api = object_bridge_->create_process_api();
    nexus_global->Set(context,
        v8::String::NewFromUtf8(isolate_, "proc").ToLocalChecked(),
        proc_api
    ).Check();

    // Add network API
    v8::Local<v8::Object> net_api = object_bridge_->create_network_api();
    nexus_global->Set(context,
        v8::String::NewFromUtf8(isolate_, "net").ToLocalChecked(),
        net_api
    ).Check();

    // Set global nexus object
    context->Global()->Set(context,
        v8::String::NewFromUtf8(isolate_, "nexus").ToLocalChecked(),
        nexus_global
    ).Check();
}

void NexusKernel::cleanup_v8() {
    if (isolate_) {
        global_context_.Reset();
        isolate_->Dispose();
        isolate_ = nullptr;
    }
    v8::V8::Dispose();
    v8::V8::ShutdownPlatform();
}

void NexusKernel::cleanup_libuv() {
    if (event_loop_) {
        uv_loop_close(event_loop_);
        event_loop_ = nullptr;
    }
}

bool NexusKernel::load_plugin(const std::string& plugin_path) {
    // Plugin loading implementation
    return true;
}

void NexusKernel::unload_plugin(const std::string& plugin_name) {
    // Plugin unloading implementation
}

void NexusKernel::set_config(const std::string& key, const std::string& value) {
    config_[key] = value;
}

std::string NexusKernel::get_config(const std::string& key) const {
    auto it = config_.find(key);
    return it != config_.end() ? it->second : "";
}

} // namespace Nexus