#[cfg(desktop)]
mod ai;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  #[allow(unused_mut)]
  let mut builder = tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_store::Builder::default().build())
    .setup(|app| {
      #[cfg(desktop)]
      {
        use tauri::Manager;
        app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
        app.handle().plugin(tauri_plugin_process::init())?;
        app.manage(ai::AiState::default());
      }

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    });

  // Local-AI commands (desktop only).
  #[cfg(desktop)]
  {
    builder = builder.invoke_handler(tauri::generate_handler![
      ai::ai_model_exists,
      ai::ai_download,
      ai::ai_remove,
      ai::ai_server_installed,
      ai::ai_server_install,
      ai::ai_engine_running,
      ai::ai_start,
      ai::ai_stop,
      ai::ai_generate
    ]);
  }

  let app = builder
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|_app_handle, _event| {
    // Make sure the llama-server child is killed when the app exits.
    #[cfg(desktop)]
    if let tauri::RunEvent::Exit = _event {
      ai::shutdown(_app_handle);
    }
  });
}
