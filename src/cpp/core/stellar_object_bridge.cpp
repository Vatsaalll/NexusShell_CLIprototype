#include "stellar_object_bridge.h"
#include <iostream>
#include <filesystem>
#include <fstream>

namespace Nexus {

StellarObjectBridge::StellarObjectBridge(v8::Isolate* isolate, SecurityContext* security_context)
    : isolate_(isolate), security_context_(security_context) {
}

StellarObjectBridge::~StellarObjectBridge() = default;

bool StellarObjectBridge::initialize() {
    setup_default_type_converters();
    return true;
}

v8::Local<v8::Value> StellarObjectBridge::nexus_to_js(const NexusObject& obj) {
    v8::EscapableHandleScope handle_scope(isolate_);
    
    // Check for custom type converter
    auto it = type_converters_.find(obj.metadata.type);
    if (it != type_converters_.end()) {
        return handle_scope.Escape(it->second.first(obj));
    }
    
    // Default conversion based on variant type
    return std::visit([&](const auto& value) -> v8::Local<v8::Value> {
        using T = std::decay_t<decltype(value)>;
        
        if constexpr (std::is_same_v<T, std::nullptr_t>) {
            return handle_scope.Escape(v8::Null(isolate_));
        } else if constexpr (std::is_same_v<T, bool>) {
            return handle_scope.Escape(v8::Boolean::New(isolate_, value));
        } else if constexpr (std::is_same_v<T, int64_t>) {
            return handle_scope.Escape(v8::Number::New(isolate_, static_cast<double>(value)));
        } else if constexpr (std::is_same_v<T, double>) {
            return handle_scope.Escape(v8::Number::New(isolate_, value));
        } else if constexpr (std::is_same_v<T, std::string>) {
            return handle_scope.Escape(v8::String::NewFromUtf8(isolate_, value.c_str()).ToLocalChecked());
        } else if constexpr (std::is_same_v<T, std::vector<uint8_t>>) {
            auto buffer = v8::ArrayBuffer::New(isolate_, value.size());
            std::memcpy(buffer->GetBackingStore()->Data(), value.data(), value.size());
            return handle_scope.Escape(buffer);
        } else {
            return handle_scope.Escape(v8::Undefined(isolate_));
        }
    }, obj.value);
}

NexusObject StellarObjectBridge::js_to_nexus(v8::Local<v8::Value> js_value) {
    NexusObject obj;
    obj.metadata.id = std::chrono::duration_cast<std::chrono::nanoseconds>(
        std::chrono::high_resolution_clock::now().time_since_epoch()
    ).count();
    obj.metadata.created_at = obj.metadata.id;
    obj.metadata.modified_at = obj.metadata.id;
    
    if (js_value->IsNull() || js_value->IsUndefined()) {
        obj.metadata.type = "null";
        obj.value = nullptr;
    } else if (js_value->IsBoolean()) {
        obj.metadata.type = "boolean";
        obj.value = js_value->BooleanValue(isolate_);
    } else if (js_value->IsNumber()) {
        obj.metadata.type = "number";
        if (js_value->IsInt32()) {
            obj.value = static_cast<int64_t>(js_value->Int32Value(isolate_->GetCurrentContext()).FromJust());
        } else {
            obj.value = js_value->NumberValue(isolate_->GetCurrentContext()).FromJust();
        }
    } else if (js_value->IsString()) {
        obj.metadata.type = "string";
        v8::String::Utf8Value utf8_value(isolate_, js_value);
        obj.value = std::string(*utf8_value, utf8_value.length());
    } else if (js_value->IsArrayBuffer()) {
        obj.metadata.type = "buffer";
        auto buffer = v8::Local<v8::ArrayBuffer>::Cast(js_value);
        auto backing_store = buffer->GetBackingStore();
        std::vector<uint8_t> data(static_cast<uint8_t*>(backing_store->Data()),
                                  static_cast<uint8_t*>(backing_store->Data()) + backing_store->ByteLength());
        obj.value = std::move(data);
    } else {
        obj.metadata.type = "object";
        obj.value = std::string("[Object]");
    }
    
    return obj;
}

v8::Local<v8::Array> StellarObjectBridge::nexus_array_to_js(const std::vector<NexusObject>& objects) {
    v8::EscapableHandleScope handle_scope(isolate_);
    v8::Local<v8::Array> js_array = v8::Array::New(isolate_, objects.size());
    v8::Local<v8::Context> context = isolate_->GetCurrentContext();
    
    for (size_t i = 0; i < objects.size(); ++i) {
        js_array->Set(context, i, nexus_to_js(objects[i])).Check();
    }
    
    return handle_scope.Escape(js_array);
}

std::vector<NexusObject> StellarObjectBridge::js_array_to_nexus(v8::Local<v8::Array> js_array) {
    std::vector<NexusObject> objects;
    v8::Local<v8::Context> context = isolate_->GetCurrentContext();
    
    for (uint32_t i = 0; i < js_array->Length(); ++i) {
        v8::Local<v8::Value> element = js_array->Get(context, i).ToLocalChecked();
        objects.push_back(js_to_nexus(element));
    }
    
    return objects;
}

v8::Local<v8::Object> StellarObjectBridge::create_filesystem_api() {
    v8::EscapableHandleScope handle_scope(isolate_);
    v8::Local<v8::Object> fs_api = v8::Object::New(isolate_);
    v8::Local<v8::Context> context = isolate_->GetCurrentContext();
    
    // Add filesystem methods
    fs_api->Set(context, 
        v8::String::NewFromUtf8(isolate_, "readFile").ToLocalChecked(),
        create_js_function("readFile", js_fs_read_file)
    ).Check();
    
    fs_api->Set(context,
        v8::String::NewFromUtf8(isolate_, "writeFile").ToLocalChecked(),
        create_js_function("writeFile", js_fs_write_file)
    ).Check();
    
    fs_api->Set(context,
        v8::String::NewFromUtf8(isolate_, "listDir").ToLocalChecked(),
        create_js_function("listDir", js_fs_list_dir)
    ).Check();
    
    fs_api->Set(context,
        v8::String::NewFromUtf8(isolate_, "stat").ToLocalChecked(),
        create_js_function("stat", js_fs_stat)
    ).Check();
    
    fs_api->Set(context,
        v8::String::NewFromUtf8(isolate_, "watch").ToLocalChecked(),
        create_js_function("watch", js_fs_watch)
    ).Check();
    
    return handle_scope.Escape(fs_api);
}

v8::Local<v8::Object> StellarObjectBridge::create_process_api() {
    v8::EscapableHandleScope handle_scope(isolate_);
    v8::Local<v8::Object> proc_api = v8::Object::New(isolate_);
    v8::Local<v8::Context> context = isolate_->GetCurrentContext();
    
    proc_api->Set(context,
        v8::String::NewFromUtf8(isolate_, "exec").ToLocalChecked(),
        create_js_function("exec", js_proc_exec)
    ).Check();
    
    proc_api->Set(context,
        v8::String::NewFromUtf8(isolate_, "list").ToLocalChecked(),
        create_js_function("list", js_proc_list)
    ).Check();
    
    proc_api->Set(context,
        v8::String::NewFromUtf8(isolate_, "kill").ToLocalChecked(),
        create_js_function("kill", js_proc_kill)
    ).Check();
    
    proc_api->Set(context,
        v8::String::NewFromUtf8(isolate_, "info").ToLocalChecked(),
        create_js_function("info", js_proc_info)
    ).Check();
    
    return handle_scope.Escape(proc_api);
}

v8::Local<v8::Object> StellarObjectBridge::create_network_api() {
    v8::EscapableHandleScope handle_scope(isolate_);
    v8::Local<v8::Object> net_api = v8::Object::New(isolate_);
    v8::Local<v8::Context> context = isolate_->GetCurrentContext();
    
    net_api->Set(context,
        v8::String::NewFromUtf8(isolate_, "get").ToLocalChecked(),
        create_js_function("get", js_net_get)
    ).Check();
    
    net_api->Set(context,
        v8::String::NewFromUtf8(isolate_, "post").ToLocalChecked(),
        create_js_function("post", js_net_post)
    ).Check();
    
    net_api->Set(context,
        v8::String::NewFromUtf8(isolate_, "download").ToLocalChecked(),
        create_js_function("download", js_net_download)
    ).Check();
    
    return handle_scope.Escape(net_api);
}

v8::Local<v8::Object> StellarObjectBridge::create_utils_api() {
    v8::EscapableHandleScope handle_scope(isolate_);
    v8::Local<v8::Object> utils_api = v8::Object::New(isolate_);
    // Add utility functions
    return handle_scope.Escape(utils_api);
}

// JavaScript API implementations
void StellarObjectBridge::js_fs_read_file(const v8::FunctionCallbackInfo<v8::Value>& args) {
    v8::Isolate* isolate = args.GetIsolate();
    v8::HandleScope handle_scope(isolate);
    
    if (args.Length() < 1 || !args[0]->IsString()) {
        isolate->ThrowException(v8::Exception::TypeError(
            v8::String::NewFromUtf8(isolate, "File path required").ToLocalChecked()));
        return;
    }
    
    v8::String::Utf8Value path(isolate, args[0]);
    std::string file_path(*path);
    
    try {
        std::ifstream file(file_path, std::ios::binary);
        if (!file.is_open()) {
            isolate->ThrowException(v8::Exception::Error(
                v8::String::NewFromUtf8(isolate, ("Cannot open file: " + file_path).c_str()).ToLocalChecked()));
            return;
        }
        
        std::string content((std::istreambuf_iterator<char>(file)),
                           std::istreambuf_iterator<char>());
        
        args.GetReturnValue().Set(v8::String::NewFromUtf8(isolate, content.c_str()).ToLocalChecked());
        
    } catch (const std::exception& e) {
        isolate->ThrowException(v8::Exception::Error(
            v8::String::NewFromUtf8(isolate, e.what()).ToLocalChecked()));
    }
}

void StellarObjectBridge::js_fs_write_file(const v8::FunctionCallbackInfo<v8::Value>& args) {
    v8::Isolate* isolate = args.GetIsolate();
    v8::HandleScope handle_scope(isolate);
    
    if (args.Length() < 2 || !args[0]->IsString() || !args[1]->IsString()) {
        isolate->ThrowException(v8::Exception::TypeError(
            v8::String::NewFromUtf8(isolate, "File path and content required").ToLocalChecked()));
        return;
    }
    
    v8::String::Utf8Value path(isolate, args[0]);
    v8::String::Utf8Value content(isolate, args[1]);
    
    try {
        std::ofstream file(*path);
        if (!file.is_open()) {
            isolate->ThrowException(v8::Exception::Error(
                v8::String::NewFromUtf8(isolate, ("Cannot create file: " + std::string(*path)).c_str()).ToLocalChecked()));
            return;
        }
        
        file << *content;
        args.GetReturnValue().Set(v8::Boolean::New(isolate, true));
        
    } catch (const std::exception& e) {
        isolate->ThrowException(v8::Exception::Error(
            v8::String::NewFromUtf8(isolate, e.what()).ToLocalChecked()));
    }
}

void StellarObjectBridge::js_fs_list_dir(const v8::FunctionCallbackInfo<v8::Value>& args) {
    v8::Isolate* isolate = args.GetIsolate();
    v8::HandleScope handle_scope(isolate);
    v8::Local<v8::Context> context = isolate->GetCurrentContext();
    
    std::string dir_path = ".";
    if (args.Length() > 0 && args[0]->IsString()) {
        v8::String::Utf8Value path(isolate, args[0]);
        dir_path = *path;
    }
    
    try {
        v8::Local<v8::Array> result = v8::Array::New(isolate);
        uint32_t index = 0;
        
        for (const auto& entry : std::filesystem::directory_iterator(dir_path)) {
            v8::Local<v8::Object> file_obj = v8::Object::New(isolate);
            
            file_obj->Set(context,
                v8::String::NewFromUtf8(isolate, "name").ToLocalChecked(),
                v8::String::NewFromUtf8(isolate, entry.path().filename().c_str()).ToLocalChecked()
            ).Check();
            
            file_obj->Set(context,
                v8::String::NewFromUtf8(isolate, "isFile").ToLocalChecked(),
                v8::Boolean::New(isolate, entry.is_regular_file())
            ).Check();
            
            file_obj->Set(context,
                v8::String::NewFromUtf8(isolate, "isDirectory").ToLocalChecked(),
                v8::Boolean::New(isolate, entry.is_directory())
            ).Check();
            
            if (entry.is_regular_file()) {
                auto size = std::filesystem::file_size(entry);
                file_obj->Set(context,
                    v8::String::NewFromUtf8(isolate, "size").ToLocalChecked(),
                    v8::Number::New(isolate, static_cast<double>(size))
                ).Check();
            }
            
            result->Set(context, index++, file_obj).Check();
        }
        
        args.GetReturnValue().Set(result);
        
    } catch (const std::exception& e) {
        isolate->ThrowException(v8::Exception::Error(
            v8::String::NewFromUtf8(isolate, e.what()).ToLocalChecked()));
    }
}

void StellarObjectBridge::js_fs_stat(const v8::FunctionCallbackInfo<v8::Value>& args) {
    // Implementation for file stat
}

void StellarObjectBridge::js_fs_watch(const v8::FunctionCallbackInfo<v8::Value>& args) {
    // Implementation for file watching
}

void StellarObjectBridge::js_proc_exec(const v8::FunctionCallbackInfo<v8::Value>& args) {
    // Implementation for process execution
}

void StellarObjectBridge::js_proc_list(const v8::FunctionCallbackInfo<v8::Value>& args) {
    // Implementation for process listing
}

void StellarObjectBridge::js_proc_kill(const v8::FunctionCallbackInfo<v8::Value>& args) {
    // Implementation for process killing
}

void StellarObjectBridge::js_proc_info(const v8::FunctionCallbackInfo<v8::Value>& args) {
    // Implementation for process info
}

void StellarObjectBridge::js_net_get(const v8::FunctionCallbackInfo<v8::Value>& args) {
    // Implementation for HTTP GET
}

void StellarObjectBridge::js_net_post(const v8::FunctionCallbackInfo<v8::Value>& args) {
    // Implementation for HTTP POST
}

void StellarObjectBridge::js_net_download(const v8::FunctionCallbackInfo<v8::Value>& args) {
    // Implementation for file download
}

v8::Local<v8::Function> StellarObjectBridge::create_js_function(const char* name, v8::FunctionCallback callback) {
    return v8::Function::New(isolate_->GetCurrentContext(), callback).ToLocalChecked();
}

void StellarObjectBridge::setup_default_type_converters() {
    // Setup default type converters for common types
}

void StellarObjectBridge::register_native_object(ObjectId id, std::shared_ptr<void> native_obj) {
    native_objects_[id] = native_obj;
}

void StellarObjectBridge::unregister_native_object(ObjectId id) {
    native_objects_.erase(id);
}

std::shared_ptr<void> StellarObjectBridge::get_native_object(ObjectId id) {
    auto it = native_objects_.find(id);
    return it != native_objects_.end() ? it->second : nullptr;
}

} // namespace Nexus