#pragma once

#include "nexus_types.h"
#include <string>
#include <vector>
#include <memory>

namespace Nexus {

/**
 * ParsedCommand - Represents a parsed command with metadata
 */
struct ParsedCommand {
    std::string command;
    std::vector<std::string> args;
    std::unordered_map<std::string, std::string> flags;
    std::string raw_input;
    bool is_async = false;
    bool is_background = false;
};

/**
 * ParsedInput - Complete parsed input structure
 */
struct ParsedInput {
    std::vector<ParsedCommand> commands;
    bool is_pipeline = false;
    bool is_js_pipeline = false;
    std::string js_code;
    std::string original_input;
};

/**
 * QuantumParser - Advanced command parser with dual-mode syntax support
 */
class QuantumParser {
public:
    QuantumParser();
    ~QuantumParser();

    // Main parsing interface
    ParsedInput parse(const std::string& input);
    
    // Validation
    bool is_valid_syntax(const std::string& input);
    std::vector<std::string> get_syntax_errors(const std::string& input);
    
    // Syntax detection
    bool is_javascript_syntax(const std::string& input);
    bool is_traditional_shell_syntax(const std::string& input);
    bool is_pipeline_syntax(const std::string& input);
    
    // Auto-completion support
    std::vector<std::string> get_completions(const std::string& partial_input, size_t cursor_pos);
    
    // Syntax highlighting tokens
    struct SyntaxToken {
        size_t start;
        size_t length;
        std::string type; // "command", "argument", "flag", "string", "operator", etc.
    };
    std::vector<SyntaxToken> tokenize_for_highlighting(const std::string& input);

private:
    // Internal parsing methods
    ParsedInput parse_traditional_shell(const std::string& input);
    ParsedInput parse_javascript_pipeline(const std::string& input);
    ParsedInput parse_mixed_pipeline(const std::string& input);
    
    ParsedCommand parse_single_command(const std::string& command_str);
    std::vector<std::string> split_pipeline(const std::string& input);
    
    // Utility methods
    std::string trim_whitespace(const std::string& str);
    std::vector<std::string> tokenize(const std::string& input);
    bool is_quoted_string(const std::string& token);
    std::string unquote_string(const std::string& quoted);
    
    // JavaScript parsing helpers
    bool has_js_method_calls(const std::string& input);
    bool has_js_arrow_functions(const std::string& input);
    bool has_js_async_await(const std::string& input);
    
    // Command registry for completion
    std::vector<std::string> known_commands_;
    std::unordered_map<std::string, std::vector<std::string>> command_flags_;
    
    void initialize_command_registry();
};

} // namespace Nexus