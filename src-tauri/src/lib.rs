use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StopwatchSession {
    pub date: String,
    pub duration_ms: u64,
    pub started_at_iso: Option<String>,
    pub ended_at_iso: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StopwatchData {
    pub id: String,
    pub title: String,
    pub start_time: Option<u64>,
    pub accumulated_time: u64,
    pub is_running: bool,
    pub color: Option<String>,
    pub is_pomodoro: Option<bool>,
    pub sessions: Option<Vec<StopwatchSession>>,
}

fn get_data_file_path(app: &AppHandle) -> std::io::Result<PathBuf> {
    let mut path = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    fs::create_dir_all(&path)?;
    path.push("stopwatches.json");
    Ok(path)
}

#[tauri::command]
fn load_data(app: AppHandle) -> Vec<StopwatchData> {
    if let Ok(path) = get_data_file_path(&app) {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(data) = serde_json::from_str(&content) {
                return data;
            }
        }
    }
    Vec::new()
}

#[tauri::command]
fn save_data(app: AppHandle, data: Vec<StopwatchData>) -> Result<(), String> {
    let path = get_data_file_path(&app).map_err(|e| e.to_string())?;
    let content = serde_json::to_string(&data).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn open_stats(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("stats") {
        let _ = window.set_focus();
        return Ok(());
    }
    
    tauri::WebviewWindowBuilder::new(
        &app,
        "stats",
        tauri::WebviewUrl::App("index.html#stats".into())
    )
    .title("Stats")
    .inner_size(860.0, 700.0)
    .build()
    .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_positioner::init())
        .setup(|app| {
            // Hide the app from the macOS dock
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .show_menu_on_left_click(false)
                .menu(
                    &MenuBuilder::new(app)
                        .item(&MenuItemBuilder::with_id("quit", "Quit").build(app)?)
                        .build()?,
                )
                .on_tray_icon_event(|tray, event| {
                    tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.as_ref().window().set_focus();
                            
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = tauri_plugin_positioner::WindowExt::move_window(
                                    &window,
                                    tauri_plugin_positioner::Position::TrayBottomCenter,
                                );
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .on_menu_event(|app, event| {
                    if event.id().as_ref() == "quit" {
                        app.exit(0);
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![load_data, save_data, open_stats])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
