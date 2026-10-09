// macOS only: the overlay windows float over other apps' full-screen spaces, which a plain
// NSWindow cannot, and are handed back to tao before they close. Elsewhere these do nothing.
/// Since macOS 10.14 a regular app's NSWindow cannot float over another app's
/// fullscreen Space; a non-activating NSPanel can. tao only builds NSWindows, so the
/// overlay is re-classed as an NSPanel subclass. That is memory-safe because NSPanel
/// adds no instance variables (same instance size as NSWindow) and the subclass
/// re-declares tao's single `focusable` ivar at the same position.
/// tao's own class is remembered so the window can be handed back before it closes.
#[cfg(target_os = "macos")]
static TAO_WINDOW_CLASS: std::sync::OnceLock<usize> = std::sync::OnceLock::new();
#[cfg(target_os = "macos")]
const NONACTIVATING_PANEL: usize = 1 << 7;
#[cfg(target_os = "macos")]
pub(super) fn float_over_fullscreen(win: &tauri::WebviewWindow) {
    use objc2::runtime::{AnyClass, AnyObject, Bool, ClassBuilder, Sel};
    use objc2::{msg_send, sel};
    use std::sync::OnceLock;
    const CAN_JOIN_ALL_SPACES: usize = 1 << 0;
    const STATIONARY: usize = 1 << 4;
    const IGNORES_CYCLE: usize = 1 << 6;
    const FULL_SCREEN_AUXILIARY: usize = 1 << 8;
    const STATUS_WINDOW_LEVEL: isize = 25;
    extern "C" fn never(_: &AnyObject, _: Sel) -> Bool {
        Bool::NO
    }
    static PANEL: OnceLock<Option<&'static AnyClass>> = OnceLock::new();
    let panel = PANEL.get_or_init(|| {
        let superclass = AnyClass::get(c"NSPanel")?;
        let mut builder = ClassBuilder::new(c"PlayPetsOverlayPanel", superclass)?;
        builder.add_ivar::<Bool>(c"focusable");
        unsafe {
            builder.add_method(sel!(canBecomeKeyWindow), never as extern "C" fn(_, _) -> _);
            builder.add_method(sel!(canBecomeMainWindow), never as extern "C" fn(_, _) -> _);
        }
        Some(builder.register())
    });
    let Ok(ptr) = win.ns_window() else { return };
    let window = ptr as *mut AnyObject;
    unsafe {
        let size_matches = AnyClass::get(c"NSPanel")
            .zip(AnyClass::get(c"NSWindow"))
            .is_some_and(|(p, w)| p.instance_size() == w.instance_size());
        if let (Some(panel), true) = (panel, size_matches) {
            let original = objc2::ffi::object_setClass(window, *panel as *const AnyClass);
            TAO_WINDOW_CLASS.get_or_init(|| original as usize);
            let mask: usize = msg_send![window, styleMask];
            let _: () = msg_send![window, setStyleMask: mask | NONACTIVATING_PANEL];
            let _: () = msg_send![window, setHidesOnDeactivate: false];
            let _: () = msg_send![window, setFloatingPanel: true];
        }
        let behavior: usize = msg_send![window, collectionBehavior];
        let _: () = msg_send![window, setCollectionBehavior: behavior | CAN_JOIN_ALL_SPACES | STATIONARY | IGNORES_CYCLE | FULL_SCREEN_AUXILIARY];
        let _: () = msg_send![window, setLevel: STATUS_WINDOW_LEVEL];
    }
}
#[cfg(not(target_os = "macos"))]
pub(super) fn float_over_fullscreen(_win: &tauri::WebviewWindow) {}

/// Closing a re-classed window makes tao's teardown raise an Objective-C exception, which
/// aborts the whole app. The overlay becomes a plain tao window again before it closes.
#[cfg(target_os = "macos")]
pub(super) fn restore_window_class(win: &tauri::WebviewWindow) {
    use objc2::msg_send;
    use objc2::runtime::{AnyClass, AnyObject};
    let (Some(&original), Ok(ptr)) = (TAO_WINDOW_CLASS.get(), win.ns_window()) else {
        return;
    };
    let window = ptr as *mut AnyObject;
    unsafe {
        let mask: usize = msg_send![window, styleMask];
        let _: () = msg_send![window, setStyleMask: mask & !NONACTIVATING_PANEL];
        objc2::ffi::object_setClass(window, original as *const AnyClass);
    }
}
#[cfg(not(target_os = "macos"))]
pub(super) fn restore_window_class(_win: &tauri::WebviewWindow) {}
