#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![cfg(feature = "gui")]

use std::path::PathBuf;
use tracing::{info, warn};
use tracing_subscriber::EnvFilter;
use agent_manager::{
    db::Database,
    error::AppResult,
    commands::connectors::ConnectorState,
    commands::runtime::RuntimeState,
};

fn main() -> AppResult<()> {
  init_logging();
  
  info!("Starting Agent Manager application");

  let app_data_dir = get_app_data_dir();
  info!("App data directory: {:?}", app_data_dir);

  if let Err(e) = std::fs::create_dir_all(&app_data_dir) {
    warn!("Failed to create app data directory: {}", e);
  }

  let db_path = app_data_dir.join("agent-manager.db");
  info!("Database path: {:?}", db_path);

  let rt = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");
  rt.block_on(async {
    match Database::init(&db_path).await {
      Ok(_) => info!("Database initialized successfully"),
      Err(e) => {
        eprintln!("Failed to initialize database: {}", e);
        std::process::exit(1);
      }
    }
  });

  tauri::Builder::default()
    .manage(ConnectorState::new())
    .manage(RuntimeState::new())
    .invoke_handler(tauri::generate_handler![
      cmd_list_sessions,
      cmd_create_session,
      agent_manager::commands::connectors::init_connector,
      agent_manager::commands::connectors::init_ollama,
      agent_manager::commands::connectors::get_connector_health,
      agent_manager::commands::connectors::get_connector_metrics,
      agent_manager::commands::connectors::switch_codex_model,
      agent_manager::commands::connectors::check_ollama_health,
      agent_manager::commands::connectors::list_ollama_models,
      agent_manager::commands::runtime::register_agent,
      agent_manager::commands::runtime::unregister_agent,
      agent_manager::commands::runtime::list_agents,
      agent_manager::commands::runtime::get_agent_metadata,
      agent_manager::commands::runtime::create_orchestrator,
      agent_manager::commands::runtime::start_orchestrator,
      agent_manager::commands::runtime::stop_orchestrator,
      agent_manager::commands::runtime::get_orchestrator_metrics,
      agent_manager::commands::runtime::get_queue_depth,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");

  Ok(())
}

#[tauri::command]
fn cmd_list_sessions() -> Result<Vec<String>, String> {
  Ok(vec![])
}

#[tauri::command]
fn cmd_create_session(name: String) -> Result<String, String> {
  Ok(format!("Created session: {}", name))
}

fn init_logging() {
  let env_filter = EnvFilter::try_from_default_env()
    .unwrap_or_else(|_| EnvFilter::new("info"));

  tracing_subscriber::fmt()
    .with_env_filter(env_filter)
    .with_target(false)
    .with_level(true)
    .init();
}

fn get_app_data_dir() -> PathBuf {
  #[cfg(target_os = "macos")]
  {
    let home = std::env::var("HOME").expect("HOME env var not set");
    PathBuf::from(home).join("Library/Application Support/com.agent-manager.app")
  }
  
  #[cfg(target_os = "windows")]
  {
    let app_data = std::env::var("APPDATA").expect("APPDATA env var not set");
    PathBuf::from(app_data).join("agent-manager")
  }
  
  #[cfg(target_os = "linux")]
  {
    let home = std::env::var("HOME").expect("HOME env var not set");
    PathBuf::from(home).join(".local/share/agent-manager")
  }
}
