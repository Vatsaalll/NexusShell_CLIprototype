#include "nexus_kernel.h"
#include "nova_terminal_ui.h"
#include <iostream>
#include <string>
#include <csignal>

namespace {
    Nexus::NexusKernel* g_kernel = nullptr;
    
    void signal_handler(int signal) {
        if (g_kernel && signal == SIGINT) {
            std::cout << "\n🛑 Shutting down NexusShell...\n";
            g_kernel->shutdown();
            exit(0);
        }
    }
}

int main(int argc, char* argv[]) {
    // Setup signal handling
    std::signal(SIGINT, signal_handler);
    
    try {
        // Initialize NexusShell kernel
        std::string config_path = argc > 1 ? argv[1] : "";
        Nexus::NexusKernel kernel(config_path);
        g_kernel = &kernel;
        
        if (!kernel.initialize()) {
            std::cerr << "❌ Failed to initialize NexusShell kernel\n";
            return 1;
        }
        
        // Initialize terminal UI
        Nexus::NovaTerminalUI terminal(&kernel);
        if (!terminal.initialize()) {
            std::cerr << "❌ Failed to initialize terminal UI\n";
            return 1;
        }
        
        // Display welcome message
        std::cout << R"(
🌟 NexusShell v1.0.0 - Next-Generation CLI
Built with C++ performance and JavaScript extensibility

Features:
  • Dual-mode syntax (traditional shell + JavaScript pipelines)
  • Zero-copy pipeline execution with C++ performance
  • V8 JavaScript runtime for extensibility
  • Capability-based security model
  • Time travel debugging and command recording
  • JIT compilation for hot command paths
  • Multi-threaded execution engine

Type 'help' for commands or start with JavaScript:
  nexus.fs.readFile('/etc/passwd')
  nexus.proc.list().filter(p => p.cpu > 5)
  nexus.net.get('https://api.github.com/users/octocat')

)" << std::endl;
        
        // Start interactive shell
        terminal.run_interactive_shell();
        
        // Cleanup
        kernel.shutdown();
        
    } catch (const std::exception& e) {
        std::cerr << "❌ NexusShell error: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}