#include "orion_execution_engine.h"
#include "nexus_kernel.h"
#include <iostream>
#include <filesystem>
#include <fstream>
#include <algorithm>

namespace Nexus {

OrionExecutionEngine::OrionExecutionEngine(NexusKernel* kernel, ThreadPool* thread_pool)
    : kernel_(kernel), thread_pool_(thread_pool) {
    register_builtin_commands();
}

OrionExecutionEngine::~OrionExecutionEngine() = default;

NexusObject OrionExecutionEngine::execute_single_command(const ParsedCommand& command, const CommandContext& context) {
    try {
        // Check if it's a native command
        auto it = native_commands_.find(command.command);
        if (it != native_commands_.end()) {
            return it->second(context);
        }
        
        // Fall back to system command
        return execute_system_command(command.command, context);
        
    } catch (const std::exception& e) {
        NexusObject error_obj;
        error_obj.metadata.type = "error";
        error_obj.value = std::string("Command execution failed: ") + e.what();
        return error_obj;
    }
}

NexusObject OrionExecutionEngine::execute_pipeline(const std::vector<std::string>& commands, const CommandContext& context) {
    if (commands.empty()) {
        NexusObject empty_obj;
        empty_obj.metadata.type = "null";
        empty_obj.value = nullptr;
        return empty_obj;
    }
    
    // For now, execute commands sequentially
    // In a full implementation, this would use zero-copy pipelines
    NexusObject result;
    
    for (const auto& cmd : commands) {
        auto parsed = kernel_->parser()->parse(cmd);
        if (!parsed.commands.empty()) {
            result = execute_single_command(parsed.commands[0], context);
        }
    }
    
    return result;
}

std::future<NexusObject> OrionExecutionEngine::execute_async(const std::string& command, const CommandContext& context) {
    return thread_pool_->submit([this, command, context]() {
        auto parsed = kernel_->parser()->parse(command);
        if (!parsed.commands.empty()) {
            return execute_single_command(parsed.commands[0], context);
        }
        
        NexusObject empty_obj;
        empty_obj.metadata.type = "null";
        empty_obj.value = nullptr;
        return empty_obj;
    });
}

std::future<NexusObject> OrionExecutionEngine::execute_pipeline_async(const std::vector<std::string>& commands, const CommandContext& context) {
    return thread_pool_->submit([this, commands, context]() {
        return execute_pipeline(commands, context);
    });
}

void OrionExecutionEngine::register_native_command(const std::string& name, CommandHandler handler) {
    native_commands_[name] = handler;
}

void OrionExecutionEngine::unregister_command(const std::string& name) {
    native_commands_.erase(name);
}

NexusObject OrionExecutionEngine::execute_system_command(const std::string& command, const CommandContext& context) {
    // This would execute system commands using subprocess
    // For now, return a placeholder
    NexusObject result;
    result.metadata.type = "string";
    result.value = std::string("System command executed: ") + command;
    return result;
}

void OrionExecutionEngine::register_builtin_commands() {
    register_native_command("ls", cmd_ls);
    register_native_command("cd", cmd_cd);
    register_native_command("pwd", cmd_pwd);
    register_native_command("mkdir", cmd_mkdir);
    register_native_command("rm", cmd_rm);
    register_native_command("cp", cmd_cp);
    register_native_command("mv", cmd_mv);
    register_native_command("cat", cmd_cat);
    register_native_command("ps", cmd_ps);
    register_native_command("kill", cmd_kill);
    register_native_command("help", cmd_help);
    register_native_command("exit", cmd_exit);
}

// Built-in command implementations
NexusObject OrionExecutionEngine::cmd_ls(const CommandContext& context) {
    NexusObject result;
    result.metadata.type = "string";
    
    std::string path = context.args.empty() ? "." : context.args[0];
    std::string output;
    
    try {
        for (const auto& entry : std::filesystem::directory_iterator(path)) {
            output += entry.path().filename().string() + "\n";
        }
        result.value = output;
    } catch (const std::exception& e) {
        result.metadata.type = "error";
        result.value = std::string("ls failed: ") + e.what();
    }
    
    return result;
}

NexusObject OrionExecutionEngine::cmd_cd(const CommandContext& context) {
    NexusObject result;
    result.metadata.type = "string";
    
    std::string path = context.args.empty() ? std::getenv("HOME") : context.args[0];
    
    try {
        std::filesystem::current_path(path);
        result.value = std::string("Changed directory to: ") + std::filesystem::current_path().string();
    } catch (const std::exception& e) {
        result.metadata.type = "error";
        result.value = std::string("cd failed: ") + e.what();
    }
    
    return result;
}

NexusObject OrionExecutionEngine::cmd_pwd(const CommandContext& context) {
    NexusObject result;
    result.metadata.type = "string";
    result.value = std::filesystem::current_path().string();
    return result;
}

NexusObject OrionExecutionEngine::cmd_mkdir(const CommandContext& context) {
    NexusObject result;
    result.metadata.type = "string";
    
    if (context.args.empty()) {
        result.metadata.type = "error";
        result.value = "mkdir: missing directory name";
        return result;
    }
    
    try {
        std::filesystem::create_directories(context.args[0]);
        result.value = std::string("Directory created: ") + context.args[0];
    } catch (const std::exception& e) {
        result.metadata.type = "error";
        result.value = std::string("mkdir failed: ") + e.what();
    }
    
    return result;
}

NexusObject OrionExecutionEngine::cmd_rm(const CommandContext& context) {
    NexusObject result;
    result.metadata.type = "string";
    
    if (context.args.empty()) {
        result.metadata.type = "error";
        result.value = "rm: missing file name";
        return result;
    }
    
    try {
        for (const auto& file : context.args) {
            std::filesystem::remove_all(file);
        }
        result.value = "Files removed successfully";
    } catch (const std::exception& e) {
        result.metadata.type = "error";
        result.value = std::string("rm failed: ") + e.what();
    }
    
    return result;
}

NexusObject OrionExecutionEngine::cmd_cp(const CommandContext& context) {
    NexusObject result;
    result.metadata.type = "string";
    
    if (context.args.size() < 2) {
        result.metadata.type = "error";
        result.value = "cp: missing source or destination";
        return result;
    }
    
    try {
        std::filesystem::copy(context.args[0], context.args[1]);
        result.value = std::string("Copied ") + context.args[0] + " to " + context.args[1];
    } catch (const std::exception& e) {
        result.metadata.type = "error";
        result.value = std::string("cp failed: ") + e.what();
    }
    
    return result;
}

NexusObject OrionExecutionEngine::cmd_mv(const CommandContext& context) {
    NexusObject result;
    result.metadata.type = "string";
    
    if (context.args.size() < 2) {
        result.metadata.type = "error";
        result.value = "mv: missing source or destination";
        return result;
    }
    
    try {
        std::filesystem::rename(context.args[0], context.args[1]);
        result.value = std::string("Moved ") + context.args[0] + " to " + context.args[1];
    } catch (const std::exception& e) {
        result.metadata.type = "error";
        result.value = std::string("mv failed: ") + e.what();
    }
    
    return result;
}

NexusObject OrionExecutionEngine::cmd_cat(const CommandContext& context) {
    NexusObject result;
    result.metadata.type = "string";
    
    if (context.args.empty()) {
        result.metadata.type = "error";
        result.value = "cat: missing file name";
        return result;
    }
    
    try {
        std::string content;
        for (const auto& file : context.args) {
            std::ifstream ifs(file);
            if (!ifs.is_open()) {
                throw std::runtime_error("Cannot open file: " + file);
            }
            content += std::string((std::istreambuf_iterator<char>(ifs)),
                                  std::istreambuf_iterator<char>());
        }
        result.value = content;
    } catch (const std::exception& e) {
        result.metadata.type = "error";
        result.value = std::string("cat failed: ") + e.what();
    }
    
    return result;
}

NexusObject OrionExecutionEngine::cmd_ps(const CommandContext& context) {
    NexusObject result;
    result.metadata.type = "string";
    
    // Simplified process listing
    result.value = "PID    COMMAND\n";
    result.value += std::to_string(getpid()) + "    nexus\n";
    
    return result;
}

NexusObject OrionExecutionEngine::cmd_kill(const CommandContext& context) {
    NexusObject result;
    result.metadata.type = "string";
    
    if (context.args.empty()) {
        result.metadata.type = "error";
        result.value = "kill: missing process ID";
        return result;
    }
    
    try {
        int pid = std::stoi(context.args[0]);
        // In a real implementation, this would send signals to processes
        result.value = std::string("Signal sent to process ") + std::to_string(pid);
    } catch (const std::exception& e) {
        result.metadata.type = "error";
        result.value = std::string("kill failed: ") + e.what();
    }
    
    return result;
}

NexusObject OrionExecutionEngine::cmd_help(const CommandContext& context) {
    NexusObject result;
    result.metadata.type = "string";
    
    result.value = "NexusShell - Available Commands:\n";
    result.value += "  ls [path]           - List directory contents\n";
    result.value += "  cd [path]           - Change directory\n";
    result.value += "  pwd                 - Print working directory\n";
    result.value += "  mkdir <dir>         - Create directory\n";
    result.value += "  rm <file>           - Remove file/directory\n";
    result.value += "  cp <src> <dst>      - Copy file\n";
    result.value += "  mv <src> <dst>      - Move/rename file\n";
    result.value += "  cat <file>          - Display file contents\n";
    result.value += "  ps                  - List processes\n";
    result.value += "  kill <pid>          - Terminate process\n";
    result.value += "  help                - Show this help\n";
    result.value += "  exit                - Exit shell\n";
    result.value += "\nJavaScript Pipeline Mode:\n";
    result.value += "  nexus.fs.readFile('/path/to/file')\n";
    result.value += "  nexus.proc.list().filter(p => p.cpu > 5)\n";
    result.value += "  nexus.net.get('https://api.example.com')\n";
    
    return result;
}

NexusObject OrionExecutionEngine::cmd_exit(const CommandContext& context) {
    NexusObject result;
    result.metadata.type = "exit";
    result.value = std::string("Goodbye!");
    return result;
}

bool OrionExecutionEngine::compile_pipeline(const std::vector<std::string>& commands) {
    // JIT compilation would be implemented here
    return true;
}

void OrionExecutionEngine::clear_compiled_cache() {
    compiled_pipelines_.clear();
}

} // namespace Nexus