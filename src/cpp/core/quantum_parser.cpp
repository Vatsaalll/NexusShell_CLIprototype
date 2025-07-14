#include "quantum_parser.h"
#include <regex>
#include <sstream>
#include <algorithm>

namespace Nexus {

QuantumParser::QuantumParser() {
    initialize_command_registry();
}

QuantumParser::~QuantumParser() = default;

ParsedInput QuantumParser::parse(const std::string& input) {
    std::string trimmed = trim_whitespace(input);
    
    if (trimmed.empty()) {
        return ParsedInput{};
    }

    // Detect syntax type and parse accordingly
    if (is_javascript_syntax(trimmed)) {
        return parse_javascript_pipeline(trimmed);
    } else if (is_pipeline_syntax(trimmed)) {
        return parse_mixed_pipeline(trimmed);
    } else {
        return parse_traditional_shell(trimmed);
    }
}

bool QuantumParser::is_valid_syntax(const std::string& input) {
    try {
        parse(input);
        return true;
    } catch (const std::exception&) {
        return false;
    }
}

std::vector<std::string> QuantumParser::get_syntax_errors(const std::string& input) {
    std::vector<std::string> errors;
    
    try {
        parse(input);
    } catch (const std::exception& e) {
        errors.push_back(e.what());
    }
    
    // Additional syntax validation
    if (input.find("&&") != std::string::npos || input.find("||") != std::string::npos) {
        errors.push_back("Logical operators not yet supported");
    }
    
    return errors;
}

bool QuantumParser::is_javascript_syntax(const std::string& input) {
    // Check for JavaScript-specific patterns
    return has_js_method_calls(input) || 
           has_js_arrow_functions(input) || 
           has_js_async_await(input) ||
           input.find("const ") != std::string::npos ||
           input.find("let ") != std::string::npos ||
           input.find("var ") != std::string::npos ||
           input.find("function") != std::string::npos ||
           input.find("=>") != std::string::npos;
}

bool QuantumParser::is_traditional_shell_syntax(const std::string& input) {
    return !is_javascript_syntax(input);
}

bool QuantumParser::is_pipeline_syntax(const std::string& input) {
    return input.find("|") != std::string::npos;
}

ParsedInput QuantumParser::parse_traditional_shell(const std::string& input) {
    ParsedInput result;
    result.original_input = input;
    result.is_pipeline = is_pipeline_syntax(input);
    result.is_js_pipeline = false;
    
    if (result.is_pipeline) {
        auto pipeline_commands = split_pipeline(input);
        for (const auto& cmd : pipeline_commands) {
            result.commands.push_back(parse_single_command(cmd));
        }
    } else {
        result.commands.push_back(parse_single_command(input));
    }
    
    return result;
}

ParsedInput QuantumParser::parse_javascript_pipeline(const std::string& input) {
    ParsedInput result;
    result.original_input = input;
    result.is_pipeline = false;
    result.is_js_pipeline = true;
    result.js_code = input;
    
    return result;
}

ParsedInput QuantumParser::parse_mixed_pipeline(const std::string& input) {
    ParsedInput result;
    result.original_input = input;
    result.is_pipeline = true;
    result.is_js_pipeline = false;
    
    auto pipeline_commands = split_pipeline(input);
    for (const auto& cmd : pipeline_commands) {
        if (is_javascript_syntax(cmd)) {
            // Convert to JS pipeline
            result.is_js_pipeline = true;
            result.js_code = input;
            result.commands.clear();
            break;
        } else {
            result.commands.push_back(parse_single_command(cmd));
        }
    }
    
    return result;
}

ParsedCommand QuantumParser::parse_single_command(const std::string& command_str) {
    ParsedCommand cmd;
    cmd.raw_input = command_str;
    
    auto tokens = tokenize(command_str);
    if (tokens.empty()) {
        return cmd;
    }
    
    cmd.command = tokens[0];
    
    // Parse arguments and flags
    for (size_t i = 1; i < tokens.size(); ++i) {
        const std::string& token = tokens[i];
        
        if (token.starts_with("--")) {
            // Long flag
            auto eq_pos = token.find('=');
            if (eq_pos != std::string::npos) {
                std::string key = token.substr(2, eq_pos - 2);
                std::string value = token.substr(eq_pos + 1);
                cmd.flags[key] = unquote_string(value);
            } else {
                cmd.flags[token.substr(2)] = "true";
            }
        } else if (token.starts_with("-") && token.length() > 1) {
            // Short flag(s)
            for (size_t j = 1; j < token.length(); ++j) {
                cmd.flags[std::string(1, token[j])] = "true";
            }
        } else {
            // Regular argument
            cmd.args.push_back(unquote_string(token));
        }
    }
    
    // Check for async/background execution
    if (command_str.ends_with("&")) {
        cmd.is_background = true;
    }
    
    return cmd;
}

std::vector<std::string> QuantumParser::split_pipeline(const std::string& input) {
    std::vector<std::string> commands;
    std::stringstream ss(input);
    std::string command;
    
    while (std::getline(ss, command, '|')) {
        commands.push_back(trim_whitespace(command));
    }
    
    return commands;
}

std::string QuantumParser::trim_whitespace(const std::string& str) {
    size_t start = str.find_first_not_of(" \t\n\r");
    if (start == std::string::npos) return "";
    
    size_t end = str.find_last_not_of(" \t\n\r");
    return str.substr(start, end - start + 1);
}

std::vector<std::string> QuantumParser::tokenize(const std::string& input) {
    std::vector<std::string> tokens;
    std::string current_token;
    bool in_quotes = false;
    char quote_char = '\0';
    
    for (size_t i = 0; i < input.length(); ++i) {
        char c = input[i];
        
        if (!in_quotes && (c == '"' || c == '\'')) {
            in_quotes = true;
            quote_char = c;
            current_token += c;
        } else if (in_quotes && c == quote_char) {
            in_quotes = false;
            current_token += c;
            quote_char = '\0';
        } else if (!in_quotes && std::isspace(c)) {
            if (!current_token.empty()) {
                tokens.push_back(current_token);
                current_token.clear();
            }
        } else {
            current_token += c;
        }
    }
    
    if (!current_token.empty()) {
        tokens.push_back(current_token);
    }
    
    return tokens;
}

bool QuantumParser::is_quoted_string(const std::string& token) {
    return (token.length() >= 2) && 
           ((token.front() == '"' && token.back() == '"') ||
            (token.front() == '\'' && token.back() == '\''));
}

std::string QuantumParser::unquote_string(const std::string& quoted) {
    if (is_quoted_string(quoted)) {
        return quoted.substr(1, quoted.length() - 2);
    }
    return quoted;
}

bool QuantumParser::has_js_method_calls(const std::string& input) {
    std::regex method_call_pattern(R"(\w+\.\w+\s*\()");
    return std::regex_search(input, method_call_pattern);
}

bool QuantumParser::has_js_arrow_functions(const std::string& input) {
    return input.find("=>") != std::string::npos;
}

bool QuantumParser::has_js_async_await(const std::string& input) {
    return input.find("async") != std::string::npos || 
           input.find("await") != std::string::npos;
}

std::vector<std::string> QuantumParser::get_completions(const std::string& partial_input, size_t cursor_pos) {
    std::vector<std::string> completions;
    
    // Extract the word at cursor position
    size_t word_start = partial_input.find_last_of(" \t", cursor_pos);
    if (word_start == std::string::npos) word_start = 0;
    else word_start++;
    
    std::string partial_word = partial_input.substr(word_start, cursor_pos - word_start);
    
    // Complete commands
    for (const auto& cmd : known_commands_) {
        if (cmd.starts_with(partial_word)) {
            completions.push_back(cmd);
        }
    }
    
    // Complete JavaScript API methods
    if (partial_word.starts_with("fs.")) {
        std::vector<std::string> fs_methods = {
            "fs.readFile", "fs.writeFile", "fs.dir", "fs.stat", "fs.watch"
        };
        for (const auto& method : fs_methods) {
            if (method.starts_with(partial_word)) {
                completions.push_back(method);
            }
        }
    }
    
    return completions;
}

std::vector<QuantumParser::SyntaxToken> QuantumParser::tokenize_for_highlighting(const std::string& input) {
    std::vector<SyntaxToken> tokens;
    
    if (is_javascript_syntax(input)) {
        // JavaScript syntax highlighting
        std::regex js_patterns[] = {
            std::regex(R"(\b(const|let|var|function|async|await|return)\b)"), // keywords
            std::regex(R"(\w+\.\w+)"), // method calls
            std::regex(R"(=>)"), // arrow functions
            std::regex(R"("([^"\\]|\\.)*"|'([^'\\]|\\.)*')"), // strings
        };
        
        std::string types[] = {"keyword", "method", "operator", "string"};
        
        for (size_t i = 0; i < 4; ++i) {
            std::sregex_iterator iter(input.begin(), input.end(), js_patterns[i]);
            std::sregex_iterator end;
            
            for (; iter != end; ++iter) {
                const std::smatch& match = *iter;
                tokens.push_back({
                    static_cast<size_t>(match.position()),
                    static_cast<size_t>(match.length()),
                    types[i]
                });
            }
        }
    } else {
        // Traditional shell syntax highlighting
        auto parsed_tokens = tokenize(input);
        size_t pos = 0;
        
        for (size_t i = 0; i < parsed_tokens.size(); ++i) {
            const std::string& token = parsed_tokens[i];
            size_t token_pos = input.find(token, pos);
            
            std::string type;
            if (i == 0) {
                type = "command";
            } else if (token.starts_with("-")) {
                type = "flag";
            } else if (is_quoted_string(token)) {
                type = "string";
            } else {
                type = "argument";
            }
            
            tokens.push_back({token_pos, token.length(), type});
            pos = token_pos + token.length();
        }
    }
    
    return tokens;
}

void QuantumParser::initialize_command_registry() {
    known_commands_ = {
        "ls", "cd", "pwd", "mkdir", "rm", "cp", "mv", "cat", "touch", "find", "stat",
        "ps", "kill", "exec", "pinfo", "top", "jobs",
        "curl", "wget", "ping", "portscan", "nslookup", "ifconfig",
        "sysinfo", "env", "export", "unset", "date", "uptime", "df", "free", "perf",
        "git", "docker", "package", "ai", "analyze", "test",
        "hello", "plugin-info", "echo-color", "random", "timer",
        "base64", "urlencode", "hash", "uuid", "json", "transform", "calc", "colors"
    };
    
    // Initialize command flags
    command_flags_["ls"] = {"-a", "--all", "-l", "--long", "-h", "--human"};
    command_flags_["rm"] = {"-r", "--recursive", "-f", "--force"};
    command_flags_["cp"] = {"-r", "--recursive"};
    command_flags_["curl"] = {"-X", "--method", "-H", "--headers", "-d", "--data", "-o", "--output", "-s", "--silent"};
    // ... more command flags
}

} // namespace Nexus