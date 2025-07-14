#pragma once

#include "nexus_types.h"
#include "security_context.h"
#include <v8.h>
#include <memory>
#include <unordered_map>

namespace Nexus {

/**
 * StellarObjectBridge - Bi-directional C++/JavaScript object conversion
 * Handles type marshaling and provides JavaScript APIs for system operations
 */
class StellarObjectBridge {
public:
    explicit StellarObjectBridge(v8::Isolate* isolate, SecurityContext* security_context);
    ~StellarObjectBridge();

    bool initialize();

    // Core conversion methods
    v8::Local<v8::Value> nexus_to_js(const NexusObject& obj);
    NexusObject js_to_nexus(v8::Local<v8::Value> js_value);

    // Batch conversion for performance
    v8::Local<v8::Array> nexus_array_to_js(const std::vector<NexusObject>& objects);
    std::vector<NexusObject> js_array_to_nexus(v8::Local<v8::Array> js_array);

    // JavaScript API creation
    v8::Local<v8::Object> create_filesystem_api();
    v8::Local<v8::Object> create_process_api();
    v8::Local<v8::Object> create_network_api();
    v8::Local<v8::Object> create_utils_api();

    // Memory management
    void register_native_object(ObjectId id, std::shared_ptr<void> native_obj);
    void unregister_native_object(ObjectId id);
    std::shared_ptr<void> get_native_object(ObjectId id);

    // Type system
    void register_custom_type(const std::string& type_name, 
                             std::function<v8::Local<v8::Value>(const NexusObject&)> to_js,
                             std::function<NexusObject(v8::Local<v8::Value>)> from_js);

private:
    v8::Isolate* isolate_;
    SecurityContext* security_context_;
    
    // Object registry for memory management
    std::unordered_map<ObjectId, std::shared_ptr<void>> native_objects_;
    
    // Type conversion registry
    std::unordered_map<std::string, 
        std::pair<std::function<v8::Local<v8::Value>(const NexusObject&)>,
                  std::function<NexusObject(v8::Local<v8::Value>)>>> type_converters_;

    // JavaScript API implementations
    static void js_fs_read_file(const v8::FunctionCallbackInfo<v8::Value>& args);
    static void js_fs_write_file(const v8::FunctionCallbackInfo<v8::Value>& args);
    static void js_fs_list_dir(const v8::FunctionCallbackInfo<v8::Value>& args);
    static void js_fs_stat(const v8::FunctionCallbackInfo<v8::Value>& args);
    static void js_fs_watch(const v8::FunctionCallbackInfo<v8::Value>& args);

    static void js_proc_exec(const v8::FunctionCallbackInfo<v8::Value>& args);
    static void js_proc_list(const v8::FunctionCallbackInfo<v8::Value>& args);
    static void js_proc_kill(const v8::FunctionCallbackInfo<v8::Value>& args);
    static void js_proc_info(const v8::FunctionCallbackInfo<v8::Value>& args);

    static void js_net_get(const v8::FunctionCallbackInfo<v8::Value>& args);
    static void js_net_post(const v8::FunctionCallbackInfo<v8::Value>& args);
    static void js_net_download(const v8::FunctionCallbackInfo<v8::Value>& args);

    // Utility methods
    void setup_default_type_converters();
    v8::Local<v8::Function> create_js_function(const char* name, v8::FunctionCallback callback);
    
    // Error handling
    void throw_js_error(const std::string& message);
    NexusObject create_error_object(const std::string& message);
};

/**
 * JavaScript object wrappers for C++ types
 */
class JSFileObject {
public:
    static v8::Local<v8::Object> create(v8::Isolate* isolate, const std::string& path);
    static void setup_prototype(v8::Isolate* isolate, v8::Local<v8::ObjectTemplate> tmpl);
    
private:
    static void read(const v8::FunctionCallbackInfo<v8::Value>& args);
    static void write(const v8::FunctionCallbackInfo<v8::Value>& args);
    static void stat(const v8::FunctionCallbackInfo<v8::Value>& args);
    static void watch(const v8::FunctionCallbackInfo<v8::Value>& args);
};

class JSDirectoryObject {
public:
    static v8::Local<v8::Object> create(v8::Isolate* isolate, const std::string& path);
    static void setup_prototype(v8::Isolate* isolate, v8::Local<v8::ObjectTemplate> tmpl);
    
private:
    static void list(const v8::FunctionCallbackInfo<v8::Value>& args);
    static void filter(const v8::FunctionCallbackInfo<v8::Value>& args);
    static void map(const v8::FunctionCallbackInfo<v8::Value>& args);
    static void forEach(const v8::FunctionCallbackInfo<v8::Value>& args);
};

class JSProcessObject {
public:
    static v8::Local<v8::Object> create(v8::Isolate* isolate, ProcessId pid);
    static void setup_prototype(v8::Isolate* isolate, v8::Local<v8::ObjectTemplate> tmpl);
    
private:
    static void kill(const v8::FunctionCallbackInfo<v8::Value>& args);
    static void info(const v8::FunctionCallbackInfo<v8::Value>& args);
    static void wait(const v8::FunctionCallbackInfo<v8::Value>& args);
};

} // namespace Nexus