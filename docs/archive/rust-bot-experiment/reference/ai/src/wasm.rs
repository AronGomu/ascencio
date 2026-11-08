//! Length-delimited JSON ABI. Each host owns one isolated module instance.
//! Split prepare/execute/serialize entrypoints permit measuring computation
//! independently of JSON transport without granting a clock capability.
use crate::Bot;
use serde_json::{Value, json};
use std::cell::RefCell;
thread_local! {
    static BOT:RefCell<Bot>=RefCell::new(Bot::default());
    static REQUEST:RefCell<Result<Value,String>>=RefCell::new(Err("No request".into()));
    static RESPONSE:RefCell<Value>=const{RefCell::new(Value::Null)};
    static OUTPUT:RefCell<Vec<u8>>=const{RefCell::new(Vec::new())};
}
#[unsafe(no_mangle)]
pub extern "C" fn allocate(len: usize) -> *mut u8 {
    if len > 64 * 1024 * 1024 {
        return std::ptr::null_mut();
    }
    Box::into_raw(vec![0u8; len].into_boxed_slice()) as *mut u8
}
/// The host returns exactly an allocation made by allocate, once.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn deallocate(ptr: *mut u8, len: usize) {
    unsafe {
        drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(ptr, len)));
    }
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn prepare(ptr: *const u8, len: usize) {
    let result = if len > 64 * 1024 * 1024 {
        Err("Input exceeds 64 MiB".to_owned())
    } else {
        let bytes = unsafe { std::slice::from_raw_parts(ptr, len) };
        serde_json::from_slice::<Value>(bytes).map_err(|e| e.to_string())
    };
    REQUEST.with(|r| *r.borrow_mut() = result);
}
#[unsafe(no_mangle)]
pub extern "C" fn execute() {
    let result = REQUEST.with(|r| match r.borrow().as_ref() {
        Ok(request) => BOT.with(|bot| bot.borrow_mut().request(request)),
        Err(error) => Err(error.clone()),
    });
    RESPONSE.with(|r| {
        *r.borrow_mut() = match result {
            Ok(value) => json!({"ok":value}),
            Err(error) => json!({"error":error}),
        }
    });
}
#[unsafe(no_mangle)]
pub extern "C" fn serialize() -> *const u8 {
    OUTPUT.with(|output| {
        *output.borrow_mut() = RESPONSE.with(|r| serde_json::to_vec(&*r.borrow()).unwrap());
        output.borrow().as_ptr()
    })
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn invoke(ptr: *const u8, len: usize) -> *const u8 {
    unsafe { prepare(ptr, len) };
    execute();
    serialize()
}
#[unsafe(no_mangle)]
pub extern "C" fn output_len() -> usize {
    OUTPUT.with(|o| o.borrow().len())
}
