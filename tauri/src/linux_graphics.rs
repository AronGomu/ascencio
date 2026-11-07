pub(crate) fn configure() {
    // WebKitGTK's DMA-BUF path can fail on NVIDIA under both Wayland and X11.
    // Apply before GTK starts; preserve an explicitly selected renderer.
    // https://v2.tauri.app/develop/debug/linux-graphics/
    if std::path::Path::new("/sys/module/nvidia").exists()
        && std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none()
    {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
}
