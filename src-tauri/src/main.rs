// PlayPets desktop app. Called with a CLI command (hook, mcp, …) the same binary runs the agent
// CLI instead of opening a window; otherwise this wires the app together:
//   app       the state, loading and saving it, telling every window of a change
//   commands  what the pages can ask for
//   chat/     conversations and the AI connections behind them
//   pets/     pet files, importing them, and the friends in the yard
//   agent/    coding agents: the CLI mode and the bridge it reaches the app through
//   desktop/  friends on the desktop
//   links     playpets:// links handed to the app
//   menu      what the tray menu and the macOS menu bar do
//   window, tray, system, store, i18n, update (the app updating itself)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod agent;
mod app;
mod chat;
mod commands;
mod desktop;
mod i18n;
mod links;
mod menu;
mod pets;
mod store;
mod system;
mod tray;
mod update;
mod window;

use crate::app::lock;
use app::{CliHandle, OverlayHandle, PositionSink, Shared};
use desktop::overlay;
use std::sync::{Arc, Mutex};
use tauri::Manager;

fn main() {
    // Agents call this same binary (hooks, MCP, CLI) — no Node.js, no window.
    let cli_args: Vec<String> = std::env::args().collect();
    if agent::cli::is_cli(&cli_args) {
        std::process::exit(agent::cli::run(&cli_args[1..]));
    }
    let at_login = cli_args.iter().any(|a| a == AUTOSTART_ARG);
    let mut builder = tauri::Builder::default();
    // A second launch normally just brings the running app forward and hands over any link it
    // was opened with (the single-instance plugin goes first for that). The e2e harness runs a
    // throwaway instance with its own data folder, so it must not defer to the user's app.
    if !commands::e2e_mode() {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| window::show(app)));
    }
    // Starting at login: a test run must not add the app to the person's login items.
    if !commands::e2e_mode() {
        builder = builder.plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![AUTOSTART_ARG]),
        ));
    }
    builder = builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init());
    builder
        // Sheets are megabytes: they are read off the main thread, which serves the protocol.
        .register_asynchronous_uri_scheme_protocol("pet-asset", |ctx, request, responder| {
            let app = ctx.app_handle().clone();
            tauri::async_runtime::spawn_blocking(move || responder.respond(app::sprite_response(&app, request.uri())));
        })
        .invoke_handler(tauri::generate_handler![commands::call])
        .setup(move |app| {
            let mut data = app::load_state(app)?;
            if !commands::e2e_mode() {
                use tauri_plugin_autostart::ManagerExt;
                data.autostart = app.autolaunch().is_enabled().unwrap_or(false);
            }
            // Started at login with friends on the desktop, the app stays out of the way: the
            // friends come out, the yard window waits in the tray.
            let quiet = at_login && data.prefs.desktop;
            app.manage(Mutex::new(data));
            app.manage(CliHandle(chat::cli::CliManager::new()));
            app.manage(update::Found::default());
            start_overlay(app);

            // Only macOS has a menu bar outside the window; elsewhere it would sit on top of the drawn title bar.
            #[cfg(target_os = "macos")]
            app.set_menu(menu::app_menu(app.handle(), false, false, false, true)?)?;
            // The tray's items and the menu bar's come to one handler.
            app.on_menu_event(|app, e| {
                menu::act(app, e.id().as_ref());
            });
            let win = window::build_main(app, &commands::bridge_js())?;
            // playpets://import?url=… from a pet gallery. Windows and Linux register the scheme
            // here for unpackaged builds; installers and the macOS bundle carry it themselves.
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                #[cfg(any(windows, target_os = "linux"))]
                // Not from a test build: a test run must not take over playpets:// links.
                if !commands::e2e_mode() {
                    let _ = app.deep_link().register_all();
                }
                let handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    for url in event.urls() {
                        links::open(&handle, url.as_str());
                    }
                });
                if let Ok(Some(urls)) = app.deep_link().get_current() {
                    for url in urls {
                        links::open(app.handle(), url.as_str());
                    }
                }
            }
            // The e2e scenario is handed over as a script and runs once the page has had time to load.
            if let Some(scenario) = commands::e2e_mode().then(|| std::env::var(commands::E2E_ENV).ok()).flatten() {
                let page = win.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(3));
                    let _ = page.eval(&scenario);
                });
            }
            // Closing the window only hides it: the app lives on in the tray.
            let handle = app.handle().clone();
            win.on_window_event(move |event| match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    window::hide(&handle);
                }
                // Minimized from the title bar or the taskbar, and back: the page draws only when seen.
                tauri::WindowEvent::Resized(_) | tauri::WindowEvent::Focused(true) => {
                    window::moved(&handle);
                    if let Some(w) = handle.get_webview_window("main") {
                        let seen = w.is_visible().unwrap_or(true) && !w.is_minimized().unwrap_or(false);
                        window::shown(&handle, seen);
                    }
                }
                tauri::WindowEvent::Moved(_) => window::moved(&handle),
                _ => {}
            });

            if quiet {
                window::hide(app.handle());
            }
            tray::build(app)?;
            chat::providers::detect(app.handle().clone());
            agent::start(app);
            update::check_later(app.handle());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("PlayPets failed to start")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                app::flush(app);
                app.state::<CliHandle>().0.close();
            }
            // macOS: a click on the Dock icon (while it is there) opens the yard.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = event {
                window::show(app);
            }
        });
}

/// The argument the system starts the app with at login (see the autostart plugin above).
const AUTOSTART_ARG: &str = "--autostart";

/// The desktop overlay, told where friends are set down so it is kept for the next start.
fn start_overlay(app: &tauri::App) {
    let handle = app.handle().clone();
    let sink: overlay::PositionFn = Arc::new(move |id, x, y| {
        let state = handle.state::<Shared>();
        let mut d = lock(&state);
        if let Some(p) = d.pets.iter_mut().find(|p| p.id == id) {
            p.desktop_position = Some(pets::model::Pos { x, y });
        }
        // Only the overlay, which already has it, uses a friend's place on the desktop: saved with
        // the next few, without sending every window the whole state again.
        app::persist_soon(&handle);
    });
    app.manage(PositionSink(sink.clone()));
    let overlay = overlay::Overlay::new(app.handle().clone(), sink);
    {
        let state = app.state::<Shared>();
        let d = lock(&state);
        overlay.sync(app::pets_lite(&d), d.prefs.desktop, d.prefs.wander);
    }
    app.manage(OverlayHandle(overlay));
}
